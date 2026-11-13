import { describe, expect, it } from "vitest";
import {
  ManualSeedSourceAdapter,
  RssSourceAdapter,
  deduplicateSourceDocuments,
} from "../apps/api/src/research/source-adapters.js";
import type { SourceAdapterError } from "../apps/api/src/research/source-adapters.js";

const now = new Date("2026-11-11T00:00:00.000Z");

describe("source adapter contracts", () => {
  it("normalizes manual seeds with provenance and a stable content hash", async () => {
    const documents = await new ManualSeedSourceAdapter("CreatorPulse seeds", [
      {
        url: "https://example.com/story#tracking",
        title: "  A useful title  ",
        excerpt: "A short excerpt.",
        licenseNote: "Editorial seed; permitted for MVP research.",
      },
    ]).fetch({ now });

    expect(documents[0]).toMatchObject({
      sourceType: "manual_seed",
      canonicalUrl: "https://example.com/story",
      title: "A useful title",
      rawContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      retrievalStatus: "active",
      observedAt: now,
    });
  });

  it("parses bounded RSS items without treating markup as trusted content", async () => {
    const fetchImpl = async () =>
      new Response(
        `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Local fitness ideas]]></title><link>https://example.com/fitness</link><description><![CDATA[<script>ignore</script> Practical habits for creators.]]></description><pubDate>Tue, 10 Nov 2026 00:00:00 GMT</pubDate></item></channel></rss>`,
        { status: 200 },
      );
    const [document] = await new RssSourceAdapter({
      sourceName: "Permitted RSS",
      feedUrl: "https://example.com/feed.xml",
      fetchImpl,
    }).fetch({ now });

    expect(document.title).toBe("Local fitness ideas");
    expect(document.excerpt).toContain("ignore");
    expect(document.excerpt).not.toContain("<script>");
    expect(document.publishedAt?.toISOString()).toBe(
      "2026-11-10T00:00:00.000Z",
    );
  });

  it("classifies rate limits and rejects non-HTTP sources", async () => {
    const adapter = new RssSourceAdapter({
      sourceName: "Rate limited feed",
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: async () => new Response("", { status: 429 }),
    });
    await expect(adapter.fetch()).rejects.toMatchObject<
      Partial<SourceAdapterError>
    >({
      code: "rate_limited",
      retryable: true,
    });
    expect(
      () =>
        new ManualSeedSourceAdapter("Bad", [
          { url: "javascript:alert(1)", title: "Unsafe" },
        ]),
    ).not.toThrow();
    await expect(
      new ManualSeedSourceAdapter("Bad", [
        { url: "javascript:alert(1)", title: "Unsafe" },
      ]).fetch(),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("deduplicates by canonical URL and normalized content hash", async () => {
    const adapter = new ManualSeedSourceAdapter("Seeds", [
      { url: "https://example.com/story", title: "Same story" },
      { url: "https://example.com/story#duplicate", title: "Same story" },
      { url: "https://example.com/other", title: "Other story" },
    ]);
    const documents = await adapter.fetch({ now });
    expect(deduplicateSourceDocuments(documents)).toHaveLength(2);
  });
});
