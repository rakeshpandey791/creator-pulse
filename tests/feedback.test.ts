import { describe, expect, it } from "vitest";
import {
  FeedbackService,
  InMemoryFeedbackStore,
} from "../apps/api/src/feedback/feedback.service.js";

function setup() {
  const store = new InMemoryFeedbackStore();
  store.ideas.add("idea-1");
  store.recommendations.set("rec-1", {
    creatorId: "creator-a",
    ideaId: "idea-1",
  });
  return {
    store,
    service: new FeedbackService(
      store,
      () => new Date("2026-11-13T10:00:00.000Z"),
    ),
  };
}

describe("IDE-02 feedback", () => {
  it("validates, redacts, confirms and deduplicates optional feedback", async () => {
    const { service } = setup();
    const input = {
      rating: 2,
      reasonCodes: ["too_generic"],
      comment:
        "Please email me at creator@example.com with the source https://private.test/token",
      recommendationId: "rec-1",
      languageId: "language-hi",
      nicheId: "niche-fitness",
      platformId: "platform-youtube",
    };
    const first = await service.submit("creator-a", "idea-1", input);
    const second = await service.submit("creator-a", "idea-1", input);
    expect(first.duplicate).toBe(false);
    expect(second).toMatchObject({
      duplicate: true,
      feedback: { id: first.feedback.id },
    });
    expect(first.feedback.comment).toContain("[REDACTED_EMAIL]");
    expect(first.feedback.comment).toContain("[REDACTED_URL]");
  });

  it("protects idea and recommendation ownership and enforces bounded inputs", async () => {
    const { service } = setup();
    await expect(
      service.submit("creator-a", "missing", { rating: 5 }),
    ).rejects.toThrow("Idea not found");
    await expect(
      service.submit("creator-b", "idea-1", {
        rating: 5,
        recommendationId: "rec-1",
      }),
    ).rejects.toThrow("Recommendation not found");
    await expect(
      service.submit("creator-a", "idea-1", { rating: 6 }),
    ).rejects.toThrow("rating must be");
    await expect(
      service.submit("creator-a", "idea-1", { reasonCodes: ["made_up"] }),
    ).rejects.toThrow("unsupported");
    await expect(
      service.submit("creator-a", "idea-1", { comment: "x".repeat(1001) }),
    ).rejects.toThrow("1000");
  });

  it("aggregates quality signals by creator and taxonomy context", async () => {
    const { service } = setup();
    await service.submit("creator-a", "idea-1", {
      rating: 2,
      reasonCodes: ["too_generic"],
      languageId: "hi",
      nicheId: "fitness",
      platformId: "youtube",
    });
    await service.submit("creator-a", "idea-1", {
      rating: 4,
      reasonCodes: ["wrong_audience"],
      languageId: "en",
      nicheId: "fitness",
      platformId: "youtube",
    });
    const analysis = await service.analysis("creator-a", {
      languageId: "hi",
      nicheId: "fitness",
      platformId: "youtube",
    });
    expect(analysis).toMatchObject({
      total: 1,
      rated: 1,
      averageRating: 2,
      reasonCounts: { too_generic: 1 },
    });
  });
});
