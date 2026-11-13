import { describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import {
  createMongoRepositories,
  OrphanReferenceError,
  OwnershipMutationError,
} from "../apps/api/src/infrastructure/persistence/mongo-repositories.js";

type Row = Record<string, unknown> & { _id: string };

class FakeCursor {
  constructor(private readonly rows: Row[]) {}
  sort() {
    this.rows.sort((a, b) => a._id.localeCompare(b._id));
    return this;
  }
  limit(size: number) {
    this.rows.splice(size);
    return this;
  }
  async toArray() {
    return this.rows;
  }
}

class FakeCollection {
  constructor(private readonly rows: Row[]) {}

  find(filter: Record<string, unknown>, options?: { projection?: Row }) {
    const clauses = filter.$and as Array<Record<string, unknown>> | undefined;
    const creatorId = (filter.creatorId ?? clauses?.[0]?.creatorId) as
      string | undefined;
    const userId = (filter.userId ?? clauses?.[0]?.userId) as
      string | undefined;
    const after = (clauses?.[1]?._id as { $gt?: string } | undefined)?.$gt;
    const id = filter._id as string | undefined;
    const rows = this.rows.filter(
      (row) =>
        (!id || row._id === id) &&
        (!creatorId || row.creatorId === creatorId) &&
        (!userId || row.userId === userId) &&
        (!after || row._id > after),
    );
    return new FakeCursor(rows.map((row) => project(row, options?.projection)));
  }

  async findOne(
    filter: Record<string, unknown>,
    options?: { projection?: Row },
  ) {
    const row = this.rows.find((candidate) =>
      Object.entries(filter).every(([key, value]) => candidate[key] === value),
    );
    return row ? project(row, options?.projection) : null;
  }

  async insertOne(document: Row) {
    this.rows.push({ ...document });
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: { $set?: Record<string, unknown> },
  ) {
    const row = await this.findOne(filter);
    if (row && update.$set) Object.assign(row, update.$set);
  }
}

class FakeDb {
  private readonly collections = new Map<string, FakeCollection>();

  constructor(initial: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(initial)) {
      this.collections.set(name, new FakeCollection(rows));
    }
  }

  collection(name: string) {
    if (!this.collections.has(name))
      this.collections.set(name, new FakeCollection([]));
    return this.collections.get(name) as unknown as FakeCollection;
  }
}

function project(row: Row, projection?: Row) {
  if (!projection) return { ...row };
  const projected = { ...row };
  for (const [key, value] of Object.entries(projection)) {
    if (value === 0) delete projected[key];
  }
  return projected;
}

describe("Mongo repository adapters", () => {
  it("enforces profile ownership without replacing the profile id", async () => {
    const db = new FakeDb({
      creator_profiles: [
        { _id: "profile-1", userId: "creator-a", displayName: "A" },
      ],
    });
    const repositories = createMongoRepositories(db as unknown as Db);

    expect(
      await repositories.creatorProfiles.findById(
        { creatorId: "creator-a" },
        "profile-1",
      ),
    ).not.toBeNull();
    expect(
      await repositories.creatorProfiles.findById(
        { creatorId: "creator-b" },
        "profile-1",
      ),
    ).toBeNull();
    const inserted = await repositories.creatorProfiles.insert(
      { creatorId: "creator-a" },
      { _id: "profile-2", userId: "wrong", displayName: "A2" },
    );
    expect(inserted._id).toBe("profile-2");
    expect(inserted.userId).toBe("creator-a");
  });

  it("uses DTO-safe projections for users, sessions, and operations", async () => {
    const db = new FakeDb({
      users: [
        {
          _id: "user-1",
          passwordHash: "secret",
          emailNormalized: "a@example.com",
        },
      ],
      auth_sessions: [
        {
          _id: "session-1",
          userId: "user-1",
          refreshTokenHash: "secret-refresh",
        },
      ],
      ai_operations: [
        {
          _id: "operation-1",
          creatorId: "creator-a",
          prompt: "private prompt",
          providerPayload: { token: "private" },
          rawResponse: "private response",
        },
      ],
    });
    const repositories = createMongoRepositories(db as unknown as Db);
    const user = await repositories.users.findSafeById("user-1");
    const session = await repositories.sessions.findById(
      { userId: "user-1" },
      "session-1",
    );
    const operation = await repositories.operations.findById(
      { creatorId: "creator-a" },
      "operation-1",
    );
    expect(user).not.toHaveProperty("passwordHash");
    expect(session).not.toHaveProperty("refreshTokenHash");
    expect(operation).not.toHaveProperty("providerPayload");
    expect(operation).not.toHaveProperty("rawResponse");
    expect(operation).not.toHaveProperty("prompt");
  });

  it("rejects orphan recommendations and isolates creator records", async () => {
    const db = new FakeDb({
      content_ideas: [{ _id: "idea-1" }],
      idea_recommendations: [
        { _id: "recommendation-1", creatorId: "creator-a", ideaId: "idea-1" },
      ],
    });
    const repositories = createMongoRepositories(db as unknown as Db);
    expect(
      await repositories.recommendations.findById(
        { creatorId: "creator-b" },
        "recommendation-1",
      ),
    ).toBeNull();
    await expect(
      repositories.recommendations.insert(
        { creatorId: "creator-a" },
        { _id: "recommendation-2", creatorId: "wrong", ideaId: "missing" },
      ),
    ).rejects.toBeInstanceOf(OrphanReferenceError);
  });

  it("rejects scoped ownership mutations", async () => {
    const db = new FakeDb({
      idea_recommendations: [
        { _id: "recommendation-1", creatorId: "creator-a" },
      ],
      creator_profiles: [{ _id: "profile-1", userId: "creator-a" }],
    });
    const repositories = createMongoRepositories(db as unknown as Db);

    await expect(
      repositories.recommendations.update(
        { creatorId: "creator-a" },
        "recommendation-1",
        { $set: { creatorId: "creator-b" } },
      ),
    ).rejects.toBeInstanceOf(OwnershipMutationError);
    await expect(
      repositories.creatorProfiles.update(
        { creatorId: "creator-a" },
        "profile-1",
        { $rename: { displayName: "userId" } },
      ),
    ).rejects.toBeInstanceOf(OwnershipMutationError);
  });
});
