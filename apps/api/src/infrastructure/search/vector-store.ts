import type { Collection, Db, OptionalUnlessRequiredId } from "mongodb";

export interface EmbeddingProfile {
  model: string;
  version: string;
  dimensions: number;
}

export interface VectorDocument {
  id: string;
  namespace: string;
  text: string;
  embedding?: number[];
  embeddingProfile?: EmbeddingProfile;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface VectorQuery {
  namespace: string;
  text?: string;
  embedding?: number[];
  embeddingProfile?: EmbeddingProfile;
  limit?: number;
}

export interface VectorMatch {
  id: string;
  score: number;
  text: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ReembeddingJob {
  id: string;
  namespace: string;
  targetProfile: EmbeddingProfile;
  cursor: string | null;
  status: "pending" | "running" | "complete";
  updatedAt: Date;
}

export interface ReembeddingJobStore {
  start(
    namespace: string,
    targetProfile: EmbeddingProfile,
  ): Promise<ReembeddingJob>;
  get(jobId: string): Promise<ReembeddingJob | null>;
  checkpoint(
    jobId: string,
    cursor: string | null,
    status?: ReembeddingJob["status"],
  ): Promise<ReembeddingJob | null>;
}

export interface VectorStore {
  upsert(document: VectorDocument): Promise<void>;
  search(query: VectorQuery): Promise<VectorMatch[]>;
  remove(namespace: string, id: string): Promise<void>;
  reembedding: ReembeddingJobStore;
}

export class EmbeddingCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingCompatibilityError";
  }
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function assertEmbedding(document: VectorDocument) {
  if (!document.embedding) return;
  if (!document.embeddingProfile) {
    throw new EmbeddingCompatibilityError(
      "An embedding requires a model profile",
    );
  }
  if (document.embedding.length !== document.embeddingProfile.dimensions) {
    throw new EmbeddingCompatibilityError(
      "Embedding dimensions do not match its profile",
    );
  }
  if (document.embedding.some((value) => !Number.isFinite(value))) {
    throw new EmbeddingCompatibilityError(
      "Embedding values must be finite numbers",
    );
  }
}

function sameProfile(left: EmbeddingProfile, right: EmbeddingProfile) {
  return (
    left.model === right.model &&
    left.version === right.version &&
    left.dimensions === right.dimensions
  );
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }
  return leftMagnitude && rightMagnitude
    ? dot / Math.sqrt(leftMagnitude * rightMagnitude)
    : 0;
}

function textScore(query: string, candidate: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCandidate = normalizeSearchText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedQuery) return 1;
  if (normalizedCandidate.startsWith(normalizedQuery)) return 0.9;
  const queryTokens = new Set(normalizedQuery.split(" "));
  const candidateTokens = normalizedCandidate.split(" ");
  const matched = candidateTokens.filter((token) =>
    [...queryTokens].some((queryToken) => token.startsWith(queryToken)),
  ).length;
  return matched
    ? 0.5 * (matched / Math.max(queryTokens.size, candidateTokens.length))
    : 0;
}

type MongoVectorRecord = VectorDocument & {
  normalizedText: string;
  active: boolean;
  updatedAt: Date;
};

export class MongoReembeddingJobs implements ReembeddingJobStore {
  constructor(private readonly collection: Collection<ReembeddingJob>) {}

  async start(
    namespace: string,
    targetProfile: EmbeddingProfile,
  ): Promise<ReembeddingJob> {
    const job: ReembeddingJob = {
      id: crypto.randomUUID(),
      namespace,
      targetProfile,
      cursor: null,
      status: "pending",
      updatedAt: new Date(),
    };
    await this.collection.insertOne(
      job as OptionalUnlessRequiredId<ReembeddingJob>,
    );
    return job;
  }

  get(jobId: string) {
    return this.collection.findOne({ id: jobId });
  }

  async checkpoint(
    jobId: string,
    cursor: string | null,
    status: ReembeddingJob["status"] = "running",
  ) {
    await this.collection.updateOne(
      { id: jobId },
      { $set: { cursor, status, updatedAt: new Date() } },
    );
    return this.get(jobId);
  }
}

export class MongoVectorStore implements VectorStore {
  readonly reembedding: ReembeddingJobStore;
  private readonly candidateLimit: number;

  constructor(
    private readonly collection: Collection<MongoVectorRecord>,
    reembedding: ReembeddingJobStore,
    candidateLimit = 500,
  ) {
    this.reembedding = reembedding;
    this.candidateLimit = Math.min(Math.max(candidateLimit, 20), 1000);
  }

  async upsert(document: VectorDocument): Promise<void> {
    assertEmbedding(document);
    const record: MongoVectorRecord = {
      ...document,
      normalizedText: normalizeSearchText(document.text),
      active: true,
      updatedAt: new Date(),
    };
    await this.collection.updateOne(
      { namespace: document.namespace, id: document.id },
      { $set: record },
      { upsert: true },
    );
  }

  async search(query: VectorQuery): Promise<VectorMatch[]> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const candidateLimit = Math.min(
      this.candidateLimit,
      Math.max(limit * 20, 100),
    );
    const filter: Record<string, unknown> = {
      namespace: query.namespace,
      active: true,
    };
    if (query.embedding) {
      if (!query.embeddingProfile) {
        throw new EmbeddingCompatibilityError(
          "A vector query requires a model profile",
        );
      }
      filter["embeddingProfile.model"] = query.embeddingProfile.model;
      filter["embeddingProfile.version"] = query.embeddingProfile.version;
      filter["embeddingProfile.dimensions"] = query.embeddingProfile.dimensions;
    } else {
      const tokens = normalizeSearchText(query.text ?? "")
        .split(" ")
        .filter(Boolean);
      if (tokens.length > 0) {
        filter.$or = tokens.map((token) => ({
          normalizedText: { $regex: escapeRegex(token) },
        }));
      }
    }
    const records = await this.collection
      .find(filter)
      .sort({ updatedAt: -1, id: 1 })
      .limit(candidateLimit)
      .toArray();
    if (query.embedding) {
      if (!query.embeddingProfile) {
        throw new EmbeddingCompatibilityError(
          "A vector query requires a model profile",
        );
      }
      if (query.embedding.length !== query.embeddingProfile.dimensions) {
        throw new EmbeddingCompatibilityError(
          "Query dimensions do not match its profile",
        );
      }
      return records
        .filter(
          (record) =>
            record.embedding &&
            record.embeddingProfile &&
            sameProfile(record.embeddingProfile, query.embeddingProfile!),
        )
        .map((record) => ({
          ...record,
          score: cosineSimilarity(query.embedding!, record.embedding!),
        }))
        .sort(
          (left, right) =>
            right.score - left.score || left.id.localeCompare(right.id),
        )
        .slice(0, limit)
        .map(toMatch);
    }
    const text = query.text ?? "";
    return records
      .map((record) => ({ ...record, score: textScore(text, record.text) }))
      .filter((record) => record.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.id.localeCompare(right.id),
      )
      .slice(0, limit)
      .map(toMatch);
  }

  async remove(namespace: string, id: string): Promise<void> {
    await this.collection.updateOne(
      { namespace, id },
      { $set: { active: false, updatedAt: new Date() } },
    );
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toMatch(record: MongoVectorRecord & { score: number }): VectorMatch {
  return {
    id: record.id,
    score: record.score,
    text: record.text,
    metadata: record.metadata,
  };
}

export function createMongoVectorStore(db: Db): MongoVectorStore {
  return new MongoVectorStore(
    db.collection<MongoVectorRecord>("vector_embeddings"),
    new MongoReembeddingJobs(db.collection<ReembeddingJob>("embedding_jobs")),
  );
}
