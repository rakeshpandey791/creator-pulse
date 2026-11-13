import { describe, expect, it } from "vitest";
import type { ContentIdea } from "../apps/api/src/research/idea-creation.service.js";
import {
  generateRecommendations,
  InMemoryRecommendationStore,
  RecommendationService,
  type RecommendationCandidate,
} from "../apps/api/src/discovery/recommendations.service.js";
import type { IdeaScoreSnapshot } from "../apps/api/src/research/scoring.service.js";

const now = new Date("2026-11-11T10:30:00.000Z");

function idea(id: string, overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    _id: id,
    topicId: `topic-${id}`,
    title: `Idea ${id}`,
    summary: "A useful short-form idea.",
    languageId: "en",
    platformId: "youtube",
    nicheId: "fitness",
    origin: "research",
    canonicalKey: `idea-${id}`,
    searchText: `idea ${id}`,
    coverage: {
      sourceCount: 2,
      signalCount: 2,
      staleSourceCount: 0,
      missingEvidence: false,
      uncertainty: "none",
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function score(
  id: string,
  overallScore: number,
  overrides: Partial<IdeaScoreSnapshot["dimensions"]> = {},
): IdeaScoreSnapshot {
  const dimensions = {
    relevance: {
      value: overallScore,
      weight: 0.35,
      kind: "observed" as const,
      explanation: "profile fit",
    },
    trendMomentum: {
      value: overallScore,
      weight: 0.3,
      kind: "observed" as const,
      explanation: "momentum",
    },
    freshness: {
      value: overallScore,
      weight: 0.2,
      kind: "observed" as const,
      explanation: "fresh",
    },
    competition: {
      value: overallScore,
      weight: 0.15,
      kind: "estimated" as const,
      explanation: "competition",
    },
    ...overrides,
  };
  return {
    _id: `score-${id}`,
    ideaId: id,
    scoreVersion: "rec-02-v1",
    overallScore,
    label:
      overallScore >= 75
        ? "Strong opportunity"
        : overallScore >= 50
          ? "Emerging opportunity"
          : "Limited signal",
    dimensions,
    explanation: "Score explanation.",
    coverage: {
      sourceCount: 2,
      signalCount: 2,
      staleSourceCount: 0,
      complete: true,
      uncertainty: "none",
      caveat: "Coverage is current.",
    },
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
  };
}

function candidate(
  id: string,
  overallScore: number,
  overrides: Partial<ContentIdea> = {},
): RecommendationCandidate {
  return { idea: idea(id, overrides), score: score(id, overallScore) };
}

const profile = {
  creatorId: "creator-1",
  profileVersion: 3,
  nicheIds: ["fitness"],
  platformIds: ["youtube"],
  languageIds: ["en"],
};

describe("REC-03 candidate generation and ranking", () => {
  it("applies hard profile filters, suppresses seen/dismissed ideas, and ranks reproducibly", () => {
    const result = generateRecommendations({
      profile,
      candidates: [
        candidate("high", 90),
        candidate("seen", 100),
        candidate("wrong-language", 100, { languageId: "hi" }),
        candidate("wrong-platform", 100, { platformId: "instagram" }),
        candidate("wrong-niche", 100, { nicheId: "food" }),
      ],
      seenIdeaIds: ["seen"],
      dismissedIdeaIds: ["wrong-niche"],
      limit: 10,
    });
    expect(result.items.map((item) => item.candidate.idea._id)).toEqual([
      "high",
    ]);
    expect(result.items[0]?.reason).toContain("creative direction");
    expect(result.items[0]?.reason).not.toContain("youtube");
    expect(result.items[0]?.reason).not.toContain("fitness");
    expect(result.rankingVersion).toBe("rec-03-v1");
  });

  it("deduplicates canonical and near-identical titles while preserving topic diversity", () => {
    const result = generateRecommendations({
      profile,
      candidates: [
        candidate("a", 90, {
          title: "Morning fitness routine",
          canonicalKey: "same",
        }),
        candidate("b", 80, {
          title: "Morning fitness routine",
          canonicalKey: "same",
        }),
        candidate("near", 70, {
          title: "Morning fitness routines",
          canonicalKey: "different",
        }),
        candidate("topic-a-2", 69, { topicId: "topic-a" }),
        candidate("topic-a-3", 68, { topicId: "topic-a" }),
        candidate("topic-b", 67, { topicId: "topic-b" }),
      ],
      limit: 10,
    });
    expect(result.items.map((item) => item.candidate.idea._id)).toEqual([
      "a",
      "topic-a-2",
      "topic-b",
    ]);
  });

  it("enforces the topic cap even when every candidate has the same topic", () => {
    const result = generateRecommendations({
      profile,
      candidates: [
        candidate("one", 90, { topicId: "shared-topic" }),
        candidate("two", 80, { topicId: "shared-topic" }),
        candidate("three", 70, { topicId: "shared-topic" }),
      ],
      limit: 10,
    });
    expect(result.items.map((item) => item.candidate.idea._id)).toEqual([
      "one",
      "two",
    ]);
  });

  it("returns a transparent fallback for empty or mismatched candidate sets", () => {
    expect(
      generateRecommendations({ profile, candidates: [] }).fallback,
    ).toMatchObject({ kind: "no_candidates" });
    expect(
      generateRecommendations({
        profile,
        candidates: [candidate("x", 80, { nicheId: "food" })],
      }).fallback,
    ).toMatchObject({ kind: "no_eligible_candidates" });
  });

  it("materializes deterministic daily recommendations and preserves interaction state on rerank", async () => {
    const store = new InMemoryRecommendationStore();
    const service = new RecommendationService(store, () => now);
    const input = { profile, candidates: [candidate("x", 80)], feedDate: now };
    const first = await service.materialize(input);
    const record = first.records[0]!;
    store.records.set(record._id, { ...record, seenAt: now });
    const second = await service.materialize(input);
    expect(second.records[0]?._id).toBe(record._id);
    expect(second.records[0]?.seenAt).toEqual(now);
    expect(store.records.size).toBe(1);
    expect(second.records[0]?.feedDate.toISOString()).toBe(
      "2026-11-11T00:00:00.000Z",
    );
  });
});
