import { describe, expect, it } from "vitest";
import {
  runFeasibilityProbe,
  runWithFallback,
} from "../apps/api/src/research/feasibility.js";
import {
  ManualSeedSourceAdapter,
  RssSourceAdapter,
} from "../apps/api/src/research/source-adapters.js";

const now = new Date("2026-11-11T00:00:00.000Z");
const terms = {
  permitted: true,
  note: "Fixture source is approved for bounded MVP research only.",
  reviewedAt: now,
};
const signals = ["fitness-hi", "food-en", "finance-te"];

function seeds() {
  return new ManualSeedSourceAdapter("Manual fallback", [
    { url: "https://seed.test/fitness", title: "Fitness", languageId: "hi" },
    { url: "https://seed.test/food", title: "Food", languageId: "en" },
    { url: "https://seed.test/finance", title: "Finance", languageId: "te" },
  ]);
}

describe("RS-02 source feasibility", () => {
  it("supports repeat fetches with stable deduplicated provenance", async () => {
    let calls = 0;
    const source = new RssSourceAdapter({
      sourceName: "Fixture RSS",
      feedUrl: "https://source.test/feed.xml",
      fetchImpl: async () => {
        calls += 1;
        return new Response(
          `<rss><channel><item><title>Fitness</title><link>https://source.test/fitness</link><pubDate>Tue, 10 Nov 2026 00:00:00 GMT</pubDate></item></channel></rss>`,
        );
      },
    });
    const config = { adapter: source, terms, representativeSignals: [] };
    const first = await runFeasibilityProbe(config, { now });
    const second = await runFeasibilityProbe(config, { now });
    expect(calls).toBe(2);
    expect(first.documents[0].rawContentHash).toBe(
      second.documents[0].rawContentHash,
    );
    expect(first.report.normalizationCompleteness).toBe(1);
  });

  it("reports duplicates without converting a usable source into an error", async () => {
    const result = await runFeasibilityProbe(
      {
        adapter: new ManualSeedSourceAdapter("Duplicate seeds", [
          {
            url: "https://seed.test/story#one",
            title: "Story",
            publishedAt: new Date("2026-11-10T00:00:00.000Z"),
          },
          {
            url: "https://seed.test/story#two",
            title: "Story",
            publishedAt: new Date("2026-11-10T00:00:00.000Z"),
          },
        ]),
        terms,
        representativeSignals: [],
      },
      { now },
    );
    expect(result.report.duplicateCount).toBe(1);
    expect(result.report.available).toBe(true);
    expect(result.decision).toBe("go");
    expect(result.report.error).toBeUndefined();
  });

  it("uses manual seeds when the free source is unavailable", async () => {
    const primary = new RssSourceAdapter({
      sourceName: "Outage RSS",
      feedUrl: "https://source.test/feed.xml",
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });
    const result = await runWithFallback(
      { adapter: primary, terms, representativeSignals: [] },
      { adapter: seeds(), terms, representativeSignals: [] },
      { now },
    );
    expect(result.fallbackUsed).toBe(true);
    expect(result.primary.report.error?.code).toBe("unavailable");
    expect(result.documents).toHaveLength(3);
  });

  it("marks stale data conditional and records the gap", async () => {
    const result = await runFeasibilityProbe(
      {
        adapter: new ManualSeedSourceAdapter("Old seeds", [
          {
            url: "https://seed.test/old",
            title: "Old",
            publishedAt: new Date("2026-10-01T00:00:00.000Z"),
          },
        ]),
        terms,
        representativeSignals: [],
      },
      { now, maxAgeMs: 1000 * 60 * 60 * 24 * 7 },
    );
    expect(result.decision).toBe("conditional");
    expect(result.report.staleCount).toBe(1);
    expect(result.report.missingPublishedCount).toBe(0);
    expect(result.report.gaps.join(" ")).toContain("stale");
  });

  it("falls back on an empty result and rejects unapproved terms", async () => {
    const empty = new RssSourceAdapter({
      sourceName: "Empty RSS",
      feedUrl: "https://source.test/feed.xml",
      fetchImpl: async () => new Response("<rss><channel /></rss>"),
    });
    const result = await runWithFallback(
      { adapter: empty, terms, representativeSignals: [] },
      { adapter: seeds(), terms, representativeSignals: [] },
      { now },
    );
    expect(result.fallbackUsed).toBe(true);
    expect(result.primary.report.error?.code).toBe("malformed");

    const blocked = await runFeasibilityProbe({
      adapter: seeds(),
      terms: { ...terms, permitted: false },
      representativeSignals: signals,
    });
    expect(blocked.decision).toBe("no_go");
    expect(blocked.documents).toHaveLength(0);
    expect(blocked.report.gaps.join(" ")).toContain("terms");
  });

  it("measures representative signal coverage", async () => {
    const datedSeeds = new ManualSeedSourceAdapter("Dated seeds", [
      {
        url: "https://seed.test/fitness",
        title: "Fitness",
        publishedAt: new Date("2026-11-10T00:00:00.000Z"),
      },
      {
        url: "https://seed.test/food",
        title: "Food",
        publishedAt: new Date("2026-11-10T00:00:00.000Z"),
      },
      {
        url: "https://seed.test/finance",
        title: "Finance",
        publishedAt: new Date("2026-11-10T00:00:00.000Z"),
      },
    ]);
    const result = await runFeasibilityProbe(
      {
        adapter: datedSeeds,
        terms,
        representativeSignals: signals,
        signalOf: (document) =>
          document.canonicalUrl.endsWith("fitness")
            ? "fitness-hi"
            : document.canonicalUrl.endsWith("food")
              ? "food-en"
              : "finance-te",
      },
      { now },
    );
    expect(result.report.signalCoverage).toBe(1);
    expect(result.decision).toBe("go");
  });

  it("treats missing publication dates as a freshness gap", async () => {
    const result = await runFeasibilityProbe(
      {
        adapter: seeds(),
        terms,
        representativeSignals: [],
      },
      { now },
    );
    expect(result.decision).toBe("conditional");
    expect(result.report.missingPublishedCount).toBe(3);
    expect(result.report.gaps.join(" ")).toContain("missing publication dates");
  });

  it("does not fetch without complete terms-review evidence", async () => {
    let calls = 0;
    const result = await runFeasibilityProbe({
      adapter: new ManualSeedSourceAdapter("Unreviewed", [
        { url: "https://seed.test/unreviewed", title: "Unreviewed" },
      ]),
      terms: { permitted: true, note: "", reviewedAt: new Date("invalid") },
      representativeSignals: [],
    });
    calls += result.report.fetchedCount;
    expect(calls).toBe(0);
    expect(result.decision).toBe("no_go");
    expect(result.report.gaps.join(" ")).toContain("terms review evidence");
  });
});
