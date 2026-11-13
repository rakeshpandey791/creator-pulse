import { describe, expect, it } from "vitest";
import {
  IngestionError,
  IngestionRunner,
  InMemoryIngestionStore,
  type SourceAdapter,
  type SourceDocument,
} from "../apps/worker/src/research/ingestion.js";

const now = new Date("2026-11-11T00:00:00.000Z");

function document(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    _id: "source-1",
    sourceType: "rss",
    sourceName: "Fixture RSS",
    canonicalUrl: "https://source.test/story",
    title: "Creator fitness habits",
    languageId: "hi",
    publishedAt: new Date("2026-11-10T00:00:00.000Z"),
    observedAt: now,
    rawContentHash: "hash-1",
    retrievalStatus: "active",
    licenseNote: "Fixture terms approved for MVP research.",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function adapter(fetch: SourceAdapter["fetch"]): SourceAdapter {
  return {
    name: "Fixture RSS",
    permittedUse: true,
    licenseNote: "Fixture terms approved for MVP research.",
    fetch,
  };
}

describe("RS-03 ingestion runner", () => {
  it("does not duplicate a repeated job or its signals", async () => {
    const store = new InMemoryIngestionStore();
    const runner = new IngestionRunner(
      store,
      [adapter(async () => [document()])],
      { rateLimitMs: 0 },
    );
    const first = await runner.run({ jobId: "job-1", now });
    const second = await runner.run({ jobId: "job-1", now });
    expect(first).toEqual(second);
    expect(store.sourceDocuments.size).toBe(1);
    expect(store.trendSignals.size).toBe(3);
    expect(store.integrityReports.size).toBe(1);
  });

  it("persists language taxonomy UUIDs after accepting language codes", async () => {
    const store = new InMemoryIngestionStore();
    await new IngestionRunner(
      store,
      [adapter(async () => [document({ languageId: "hi" })])],
      { rateLimitMs: 0 },
    ).run({ jobId: "language-id", now });

    const languageId = "6f4e5c8b-3f7b-4f2a-9b31-000000000001";
    expect([...store.sourceDocuments.values()][0].languageId).toBe(languageId);
    expect([...store.topics.values()][0].languageIds).toEqual([languageId]);
    expect(
      [...store.trendSignals.values()].every(
        (signal) => signal.languageId === languageId,
      ),
    ).toBe(true);
  });

  it("replays a completed job from the store after a worker restart", async () => {
    const store = new InMemoryIngestionStore();
    let fetches = 0;
    const source = adapter(async () => {
      fetches += 1;
      return [document()];
    });
    await new IngestionRunner(store, [source], { rateLimitMs: 0 }).run({
      jobId: "persisted-job",
      now,
    });
    const restarted = await new IngestionRunner(store, [source], {
      rateLimitMs: 0,
    }).run({
      jobId: "persisted-job",
      now: new Date(now.getTime() + 60_000),
    });
    expect(fetches).toBe(1);
    expect(restarted.jobId).toBe("persisted-job");
    expect(store.trendSignals.size).toBe(3);
  });

  it("updates one canonical source when its content changes", async () => {
    const store = new InMemoryIngestionStore();
    await new IngestionRunner(
      store,
      [
        adapter(async () => [
          document({ rawContentHash: "original", title: "Original" }),
        ]),
      ],
      { rateLimitMs: 0 },
    ).run({ jobId: "content-v1", now });
    await new IngestionRunner(
      store,
      [
        adapter(async () => [
          document({
            _id: "new-id",
            rawContentHash: "changed",
            title: "Updated",
          }),
        ]),
      ],
      { rateLimitMs: 0 },
    ).run({ jobId: "content-v2", now: new Date(now.getTime() + 60_000) });
    expect(store.sourceDocuments.size).toBe(1);
    expect([...store.sourceDocuments.values()][0].title).toBe("Updated");
    expect(
      [...store.trendSignals.values()].every(
        (signal) => signal.sourceDocumentId === "source-1",
      ),
    ).toBe(true);
  });

  it("retries bounded transient failures and exposes rate limits", async () => {
    let attempts = 0;
    const store = new InMemoryIngestionStore();
    const runner = new IngestionRunner(
      store,
      [
        adapter(async () => {
          attempts += 1;
          if (attempts === 1)
            throw new IngestionError("temporary", "rate_limited", true);
          return [document()];
        }),
      ],
      { retryDelayMs: 0, rateLimitMs: 1000 },
    );
    const success = await runner.run({ jobId: "job-2", now });
    expect(success.sources[0].attempts).toBe(2);
    const limited = await runner.run({
      jobId: "job-3",
      now: new Date(now.getTime() + 100),
    });
    expect(limited.sources[0].status).toBe("rate_limited");
    expect(limited.sources[0].errorCode).toBe("rate_limited");
  });

  it("rejects malformed payloads without persisting them", async () => {
    const store = new InMemoryIngestionStore();
    const runner = new IngestionRunner(
      store,
      [adapter(async () => [{ ...document(), canonicalUrl: "" }])],
      { rateLimitMs: 0 },
    );
    const result = await runner.run({ jobId: "job-4", now });
    expect(result.status).toBe("partial");
    expect(result.sources[0].errorCode).toBe("malformed");
    expect(store.sourceDocuments.size).toBe(0);
  });

  it("rejects invalid enums, URLs, and dates before persistence", async () => {
    const store = new InMemoryIngestionStore();
    const runner = new IngestionRunner(
      store,
      [
        adapter(async () => [
          document({
            sourceType: "not-a-source" as SourceDocument["sourceType"],
            canonicalUrl: "javascript:alert(1)",
            observedAt: new Date("invalid"),
          }),
        ]),
      ],
      { rateLimitMs: 0 },
    );
    const result = await runner.run({ jobId: "job-invalid", now });
    expect(result.sources[0].errorCode).toBe("malformed");
    expect(store.sourceDocuments.size).toBe(0);
  });

  it("marks stale documents and emits low-confidence freshness signals", async () => {
    const store = new InMemoryIngestionStore();
    const runner = new IngestionRunner(
      store,
      [
        adapter(async () => [
          document({ publishedAt: new Date("2026-10-01T00:00:00.000Z") }),
        ]),
      ],
      { rateLimitMs: 0, maxAgeMs: 1000 * 60 * 60 * 24 * 7 },
    );
    const result = await runner.run({ jobId: "job-5", now });
    expect(result.status).toBe("partial");
    expect(result.sources[0].staleCount).toBe(1);
    expect([...store.sourceDocuments.values()][0].retrievalStatus).toBe(
      "stale",
    );
    expect(
      [...store.trendSignals.values()].find(
        (item) => item.signalType === "freshness",
      )?.confidence,
    ).toBe(0.4);
  });
});
