import { describe, expect, it } from "vitest";
import {
  EmbeddingCompatibilityError,
  MongoReembeddingJobs,
  MongoVectorStore,
  normalizeSearchText,
} from "../apps/api/src/infrastructure/search/vector-store.js";

type Row = Record<string, unknown>;

class Cursor {
  constructor(private readonly rows: Row[]) {}
  sort() {
    this.rows.sort((left, right) =>
      String(left.id).localeCompare(String(right.id)),
    );
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

class Collection {
  constructor(private readonly rows: Row[] = []) {}

  find(filter: Row) {
    return new Cursor(this.rows.filter((row) => matches(row, filter)));
  }

  async findOne(filter: Row) {
    return (
      this.rows.find((row) =>
        Object.entries(filter).every(([key, value]) => row[key] === value),
      ) ?? null
    );
  }

  async insertOne(document: Row) {
    this.rows.push({ ...document });
  }

  async updateOne(filter: Row, update: Row, options?: { upsert?: boolean }) {
    let row = await this.findOne(filter);
    if (!row && options?.upsert) {
      row = {};
      this.rows.push(row);
    }
    if (row && update.$set) Object.assign(row, update.$set);
  }
}

function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") {
      return (value as Row[]).some((clause) => matches(row, clause));
    }
    const actual = key
      .split(".")
      .reduce<unknown>(
        (current, part) => (current as Row | undefined)?.[part],
        row,
      );
    if (value && typeof value === "object" && "$regex" in value) {
      return new RegExp(String((value as Row).$regex)).test(String(actual));
    }
    return actual === value;
  });
}

describe("Mongo vector-store adapter", () => {
  it("provides deterministic normalized text fallback", async () => {
    const store = new MongoVectorStore(
      new Collection() as never,
      new MongoReembeddingJobs(new Collection() as never),
    );
    await store.upsert({
      id: "z",
      namespace: "ideas",
      text: "Hindi cooking tips",
    });
    await store.upsert({ id: "a", namespace: "ideas", text: "Hindi cooking" });
    expect(normalizeSearchText("  HINDI—cooking! ")).toBe("hindi cooking");
    const matches = await store.search({
      namespace: "ideas",
      text: "hindi cooking",
    });
    expect(matches.map((match) => match.id)).toEqual(["a", "z"]);
  });

  it("isolates incompatible embedding profiles", async () => {
    const store = new MongoVectorStore(
      new Collection() as never,
      new MongoReembeddingJobs(new Collection() as never),
    );
    const v1 = { model: "test-model", version: "1", dimensions: 2 };
    const v2 = { model: "test-model", version: "2", dimensions: 2 };
    await store.upsert({
      id: "v1",
      namespace: "topics",
      text: "one",
      embedding: [1, 0],
      embeddingProfile: v1,
    });
    await store.upsert({
      id: "v2",
      namespace: "topics",
      text: "two",
      embedding: [0, 1],
      embeddingProfile: v2,
    });
    const matches = await store.search({
      namespace: "topics",
      embedding: [1, 0],
      embeddingProfile: v1,
    });
    expect(matches.map((match) => match.id)).toEqual(["v1"]);
    await expect(
      store.search({ namespace: "topics", embedding: [1, 0] }),
    ).rejects.toBeInstanceOf(EmbeddingCompatibilityError);
    await expect(
      store.upsert({
        id: "bad",
        namespace: "topics",
        text: "bad",
        embedding: [1],
        embeddingProfile: v1,
      }),
    ).rejects.toBeInstanceOf(EmbeddingCompatibilityError);
  });

  it("persists resumable re-embedding checkpoints", async () => {
    const jobs = new MongoReembeddingJobs(new Collection() as never);
    const profile = { model: "test-model", version: "2", dimensions: 2 };
    const job = await jobs.start("topics", profile);
    const checkpoint = await jobs.checkpoint(job.id, "topic-10", "running");
    expect(checkpoint?.cursor).toBe("topic-10");
    expect((await jobs.get(job.id))?.targetProfile).toEqual(profile);
  });
});
