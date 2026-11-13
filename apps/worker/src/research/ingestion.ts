import { createHash } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import {
  getLanguage,
  isSupportedLanguageIdentifier,
} from "@creator-pulse/contracts";

export type RetrievalStatus = "active" | "stale" | "blocked" | "failed";
export type SignalType =
  "momentum" | "volume" | "freshness" | "competition" | "source_count";

export type SourceDocument = {
  _id: string;
  sourceType: "official_api" | "rss" | "public_web" | "manual_seed";
  sourceName: string;
  canonicalUrl: string;
  title?: string;
  excerpt?: string;
  languageId?: string;
  location?: {
    countryCode: string;
    regionCode?: string;
    city?: string;
  };
  publishedAt?: Date | null;
  observedAt: Date;
  rawContentHash: string;
  retrievalStatus: RetrievalStatus;
  licenseNote?: string;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SourceFetchContext = { now: Date; signal?: AbortSignal };
export type SourceAdapter = {
  name: string;
  permittedUse: boolean;
  licenseNote: string;
  fetch(context: SourceFetchContext): Promise<SourceDocument[]>;
};

export type TopicRecord = {
  _id: string;
  canonicalKey: string;
  canonicalTitle: string;
  languageIds: string[];
  nicheIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type TrendSignal = {
  _id: string;
  topicId: string;
  sourceDocumentId: string;
  signalType: SignalType;
  value: number;
  valueUnit: string;
  confidence: number;
  observedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  languageId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IntegrityReport = {
  _id: string;
  jobId: string;
  sourceName: string;
  status: "succeeded" | "partial" | "failed";
  fetchedCount: number;
  acceptedCount: number;
  signalCount: number;
  duplicateCount: number;
  staleCount: number;
  errorCode?: string;
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SourceDocumentWriteResult = {
  status: "inserted" | "updated" | "duplicate";
  documentId: string;
};

export type IngestionStore = {
  getIngestionResult(jobId: string): Promise<IngestionResult | null>;
  saveIngestionResult(result: IngestionResult, now: Date): Promise<void>;
  upsertSourceDocument(
    document: SourceDocument,
  ): Promise<SourceDocumentWriteResult>;
  upsertTopic(topic: TopicRecord): Promise<void>;
  upsertTrendSignal(signal: TrendSignal): Promise<"inserted" | "duplicate">;
  saveIntegrityReport(report: IntegrityReport): Promise<void>;
};

export type IngestionJob = {
  jobId: string;
  now?: Date;
  sourceNames?: string[];
};

export type SourceRunResult = {
  sourceName: string;
  status: "succeeded" | "partial" | "failed" | "rate_limited";
  fetchedCount: number;
  acceptedCount: number;
  signalCount: number;
  duplicateCount: number;
  staleCount: number;
  attempts: number;
  errorCode?: string;
};

export type IngestionResult = {
  jobId: string;
  status: "succeeded" | "partial";
  sources: SourceRunResult[];
};

type IngestionOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  rateLimitMs?: number;
  maxAgeMs?: number;
};

export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

export class IngestionRunner {
  private readonly completed = new Map<string, IngestionResult>();
  private readonly lastFetch = new Map<string, number>();
  private readonly options: Required<IngestionOptions>;

  constructor(
    private readonly store: IngestionStore,
    private readonly adapters: readonly SourceAdapter[],
    options: IngestionOptions = {},
  ) {
    this.options = {
      maxAttempts: Math.min(Math.max(options.maxAttempts ?? 3, 1), 5),
      retryDelayMs: Math.max(options.retryDelayMs ?? 100, 0),
      rateLimitMs: Math.max(options.rateLimitMs ?? 1000, 0),
      maxAgeMs: Math.max(options.maxAgeMs ?? 1000 * 60 * 60 * 24 * 7, 1),
    };
  }

  async run(job: IngestionJob): Promise<IngestionResult> {
    const cached = this.completed.get(job.jobId);
    if (cached) return cached;
    const persisted = await this.store.getIngestionResult(job.jobId);
    if (persisted) {
      this.completed.set(job.jobId, persisted);
      return persisted;
    }
    const now = job.now ?? new Date();
    const names = job.sourceNames ? new Set(job.sourceNames) : undefined;
    const results: SourceRunResult[] = [];
    for (const adapter of this.adapters) {
      if (names && !names.has(adapter.name)) continue;
      results.push(await this.runSource(adapter, job.jobId, now));
    }
    const result: IngestionResult = {
      jobId: job.jobId,
      status: results.some((item) => item.status !== "succeeded")
        ? "partial"
        : "succeeded",
      sources: results,
    };
    this.completed.set(job.jobId, result);
    await this.store.saveIngestionResult(result, now);
    return result;
  }

  private async runSource(
    adapter: SourceAdapter,
    jobId: string,
    now: Date,
  ): Promise<SourceRunResult> {
    if (!adapter.permittedUse || !adapter.licenseNote.trim()) {
      const result: SourceRunResult = {
        sourceName: adapter.name,
        status: "failed",
        fetchedCount: 0,
        acceptedCount: 0,
        signalCount: 0,
        duplicateCount: 0,
        staleCount: 0,
        attempts: 0,
        errorCode: "terms_not_reviewed",
      };
      await this.saveReport(jobId, now, result);
      return result;
    }
    const last = this.lastFetch.get(adapter.name);
    if (last !== undefined && now.getTime() - last < this.options.rateLimitMs) {
      const result: SourceRunResult = {
        sourceName: adapter.name,
        status: "rate_limited",
        fetchedCount: 0,
        acceptedCount: 0,
        signalCount: 0,
        duplicateCount: 0,
        staleCount: 0,
        attempts: 0,
        errorCode: "rate_limited",
      };
      await this.saveReport(jobId, now, result);
      return result;
    }
    this.lastFetch.set(adapter.name, now.getTime());
    let fetched: SourceDocument[] = [];
    let attempts = 0;
    let errorCode: string | undefined;
    for (; attempts < this.options.maxAttempts; attempts += 1) {
      try {
        fetched = await adapter.fetch({ now });
        errorCode = undefined;
        break;
      } catch (error) {
        errorCode = errorCodeOf(error);
        if (!retryable(error) || attempts + 1 >= this.options.maxAttempts)
          break;
        if (this.options.retryDelayMs)
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelayMs),
          );
      }
    }
    if (errorCode) {
      const result: SourceRunResult = {
        sourceName: adapter.name,
        status: "partial",
        fetchedCount: 0,
        acceptedCount: 0,
        signalCount: 0,
        duplicateCount: 0,
        staleCount: 0,
        attempts: Math.max(attempts, 1),
        errorCode,
      };
      await this.saveReport(jobId, now, result);
      return result;
    }

    const seen = new Set<string>();
    let acceptedCount = 0;
    let signalCount = 0;
    let duplicateCount = 0;
    let staleCount = 0;
    for (const document of fetched) {
      if (!validDocument(document)) {
        errorCode = "malformed";
        continue;
      }
      if (seen.has(document._id)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(document._id);
      const stale = isStale(document, now, this.options.maxAgeMs);
      if (stale) staleCount += 1;
      const normalized = {
        ...document,
        ...(document.languageId
          ? { languageId: getLanguage(document.languageId)?.id }
          : {}),
        retrievalStatus: stale ? "stale" : document.retrievalStatus,
        updatedAt: now,
      } satisfies SourceDocument;
      const write = await this.store.upsertSourceDocument(normalized);
      if (write.status === "duplicate") duplicateCount += 1;
      acceptedCount += 1;
      const persisted = { ...normalized, _id: write.documentId };
      const topic = topicFrom(persisted, now);
      await this.store.upsertTopic(topic);
      for (const signal of signalsFor(
        persisted,
        topic._id,
        jobId,
        now,
        this.options.maxAgeMs,
      )) {
        const signalWrite = await this.store.upsertTrendSignal(signal);
        if (signalWrite === "inserted") signalCount += 1;
      }
    }
    const result: SourceRunResult = {
      sourceName: adapter.name,
      status: errorCode || staleCount ? "partial" : "succeeded",
      fetchedCount: fetched.length,
      acceptedCount,
      signalCount,
      duplicateCount,
      staleCount,
      attempts: errorCode ? Math.max(attempts, 1) : attempts + 1,
      ...(errorCode ? { errorCode } : {}),
    };
    await this.saveReport(jobId, now, result);
    return result;
  }

  private saveReport(jobId: string, now: Date, result: SourceRunResult) {
    return this.store.saveIntegrityReport({
      _id: stableId(`integrity|${jobId}|${result.sourceName}`),
      jobId,
      sourceName: result.sourceName,
      status: result.status === "succeeded" ? "succeeded" : "partial",
      fetchedCount: result.fetchedCount,
      acceptedCount: result.acceptedCount,
      signalCount: result.signalCount,
      duplicateCount: result.duplicateCount,
      staleCount: result.staleCount,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      observedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class InMemoryIngestionStore implements IngestionStore {
  readonly ingestionResults = new Map<string, IngestionResult>();
  readonly sourceDocuments = new Map<string, SourceDocument>();
  readonly topics = new Map<string, TopicRecord>();
  readonly trendSignals = new Map<string, TrendSignal>();
  readonly integrityReports = new Map<string, IntegrityReport>();

  async getIngestionResult(jobId: string) {
    return this.ingestionResults.get(jobId) ?? null;
  }

  async saveIngestionResult(result: IngestionResult) {
    this.ingestionResults.set(result.jobId, result);
  }

  async upsertSourceDocument(
    document: SourceDocument,
  ): Promise<SourceDocumentWriteResult> {
    const existing = [...this.sourceDocuments.values()].find(
      (item) => item.canonicalUrl === document.canonicalUrl,
    );
    if (existing && existing.rawContentHash === document.rawContentHash)
      return { status: "duplicate", documentId: existing._id };
    if (existing) {
      this.sourceDocuments.set(existing._id, {
        ...document,
        _id: existing._id,
      });
      return { status: "updated", documentId: existing._id };
    }
    this.sourceDocuments.set(document._id, document);
    return { status: "inserted", documentId: document._id };
  }

  async upsertTopic(topic: TopicRecord) {
    this.topics.set(topic._id, topic);
  }

  async upsertTrendSignal(signal: TrendSignal) {
    if (this.trendSignals.has(signal._id)) return "duplicate" as const;
    this.trendSignals.set(signal._id, signal);
    return "inserted" as const;
  }

  async saveIntegrityReport(report: IntegrityReport) {
    this.integrityReports.set(report._id, report);
  }
}

export class MongoIngestionStore implements IngestionStore {
  constructor(private readonly db: Db) {}

  async getIngestionResult(jobId: string) {
    const record = await this.db
      .collection<{ _id: string; result: IngestionResult }>(
        "research_ingestion_jobs",
      )
      .findOne({ _id: jobId });
    return record?.result ?? null;
  }

  async saveIngestionResult(result: IngestionResult, now: Date) {
    await this.db
      .collection<{ _id: string; result: IngestionResult }>(
        "research_ingestion_jobs",
      )
      .updateOne(
        { _id: result.jobId },
        {
          $set: { status: result.status, result, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
  }

  async upsertSourceDocument(
    document: SourceDocument,
  ): Promise<SourceDocumentWriteResult> {
    const existing = await this.db
      .collection<SourceDocument>("source_documents")
      .findOne({ canonicalUrl: document.canonicalUrl });
    const { _id, ...fields } = document;
    const result = await this.db
      .collection<SourceDocument>("source_documents")
      .updateOne(
        { canonicalUrl: document.canonicalUrl },
        { $set: fields, $setOnInsert: { _id, createdAt: document.createdAt } },
        { upsert: true },
      );
    return {
      status: result.upsertedCount ? "inserted" : "updated",
      documentId: existing?._id ?? _id,
    };
  }

  async upsertTopic(topic: TopicRecord) {
    await this.db
      .collection<TopicRecord>("content_topics")
      .updateOne(
        { _id: topic._id },
        { $set: topic, $setOnInsert: { createdAt: topic.createdAt } },
        { upsert: true },
      );
  }

  async upsertTrendSignal(signal: TrendSignal) {
    const result = await this.db
      .collection<TrendSignal>("trend_signals")
      .updateOne(
        { _id: signal._id },
        { $setOnInsert: signal },
        { upsert: true },
      );
    return result.upsertedCount ? "inserted" : "duplicate";
  }

  async saveIntegrityReport(report: IntegrityReport) {
    await this.db
      .collection<IntegrityReport>("research_integrity_reports")
      .updateOne({ _id: report._id }, { $set: report }, { upsert: true });
  }
}

export async function connectMongoStore(uri: string, database: string) {
  const client = new MongoClient(uri);
  await client.connect();
  return { client, store: new MongoIngestionStore(client.db(database)) };
}

function validDocument(document: SourceDocument) {
  const sourceTypes = ["official_api", "rss", "public_web", "manual_seed"];
  const statuses = ["active", "stale", "blocked", "failed"];
  return Boolean(
    typeof document._id === "string" &&
    document._id.length > 0 &&
    typeof document.sourceName === "string" &&
    document.sourceName.length > 0 &&
    typeof document.canonicalUrl === "string" &&
    isHttpUrl(document.canonicalUrl) &&
    sourceTypes.includes(document.sourceType) &&
    statuses.includes(document.retrievalStatus) &&
    typeof document.rawContentHash === "string" &&
    document.rawContentHash.length > 0 &&
    (document.languageId === undefined ||
      isSupportedLanguageIdentifier(document.languageId)) &&
    validDate(document.observedAt) &&
    validDate(document.createdAt) &&
    validDate(document.updatedAt) &&
    (document.publishedAt === undefined ||
      document.publishedAt === null ||
      validDate(document.publishedAt)) &&
    typeof document.licenseNote === "string" &&
    document.licenseNote.trim().length > 0,
  );
}

function isStale(document: SourceDocument, now: Date, maxAgeMs: number) {
  return Boolean(
    document.publishedAt &&
    now.getTime() - document.publishedAt.getTime() > maxAgeMs,
  );
}

function topicFrom(document: SourceDocument, now: Date): TopicRecord {
  const canonicalKey = normalizeText(document.title ?? document.canonicalUrl);
  return {
    _id: stableId(`topic|${canonicalKey}`),
    canonicalKey,
    canonicalTitle: document.title ?? canonicalKey,
    languageIds: document.languageId ? [document.languageId] : [],
    nicheIds: [],
    createdAt: document.createdAt,
    updatedAt: now,
  };
}

function signalsFor(
  document: SourceDocument,
  topicId: string,
  jobId: string,
  now: Date,
  maxAgeMs: number,
): TrendSignal[] {
  const windowStart = document.publishedAt ?? document.observedAt;
  const freshness = document.publishedAt
    ? Math.max(
        0,
        Math.min(
          1,
          1 - (now.getTime() - document.publishedAt.getTime()) / maxAgeMs,
        ),
      )
    : 0;
  return (
    [
      ["freshness", freshness, "normalized_age"],
      ["volume", 1, "document"],
      ["source_count", 1, "source"],
    ] as const
  ).map(([signalType, value, valueUnit]) => ({
    _id: stableId(`signal|${jobId}|${document._id}|${topicId}|${signalType}`),
    topicId,
    sourceDocumentId: document._id,
    signalType,
    value,
    valueUnit,
    confidence: document.retrievalStatus === "stale" ? 0.4 : 0.8,
    observedAt: now,
    windowStart,
    windowEnd: now,
    ...(document.languageId ? { languageId: document.languageId } : {}),
    createdAt: now,
    updatedAt: now,
  }));
}

function validDate(value: Date) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isHttpUrl(value: string) {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

function errorCodeOf(error: unknown) {
  return error instanceof IngestionError
    ? error.code
    : typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "unavailable";
}

function retryable(error: unknown) {
  return error instanceof IngestionError && error.retryable;
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 36);
}
