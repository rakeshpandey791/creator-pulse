import { describe, expect, it } from "vitest";
import {
  calculateIdeaScore,
  IdeaScoringService,
  InMemoryIdeaScoreStore,
  labelForScore,
  SCORE_WEIGHTS,
} from "../apps/api/src/research/scoring.service.js";
import type {
  ContentIdea,
  IdeaSourceDocument,
  IdeaTrendSignal,
} from "../apps/api/src/research/idea-creation.service.js";

const now = new Date("2026-11-11T00:00:00.000Z");

const idea: ContentIdea = {
  _id: "idea-1",
  topicId: "topic-1",
  title: "Morning fitness routines",
  summary: "A practical short-form routine for busy creators.",
  languageId: "en",
  platformId: "youtube",
  nicheId: "fitness",
  origin: "research",
  canonicalKey: "morning-fitness-routines|en|youtube|fitness",
  searchText: "morning fitness routines practical short-form",
  coverage: {
    sourceCount: 1,
    signalCount: 1,
    staleSourceCount: 0,
    missingEvidence: false,
    uncertainty: "none",
  },
  createdAt: now,
  updatedAt: now,
};

const source: IdeaSourceDocument = {
  _id: "source-1",
  canonicalUrl: "https://source.test/fitness",
  title: "Fitness trends",
  observedAt: now,
  publishedAt: now,
  retrievalStatus: "active",
};

function signal(signalType: string, value: number): IdeaTrendSignal {
  return {
    _id: `${signalType}-1`,
    sourceDocumentId: source._id,
    topicId: idea.topicId,
    signalType,
    value,
    observedAt: now,
  };
}

describe("REC-02 explainable score calculation", () => {
  it("applies the documented weights and exposes all four dimensions", () => {
    const snapshot = calculateIdeaScore(
      {
        idea,
        sources: [source],
        signals: [signal("momentum", 0.8), signal("competition", 0.2)],
        relevance: 0.6,
      },
      now,
    );

    expect(snapshot.dimensions).toMatchObject({
      relevance: {
        value: 60,
        weight: SCORE_WEIGHTS.relevance,
        kind: "observed",
      },
      trendMomentum: { value: 80, weight: SCORE_WEIGHTS.trendMomentum },
      freshness: { value: 100, weight: SCORE_WEIGHTS.freshness },
      competition: { value: 80, weight: SCORE_WEIGHTS.competition },
    });
    expect(snapshot.overallScore).toBe(77);
    expect(snapshot.label).toBe("Strong opportunity");
    expect(snapshot.explanation).toContain("relevance 60/100");
    expect(snapshot.explanation).toContain("trend momentum 80/100");
    expect(snapshot.explanation).toContain("freshness 100/100");
    expect(snapshot.explanation).toContain("competition 80/100");
  });

  it("keeps score boundaries and labels deterministic", () => {
    expect(labelForScore(0)).toBe("Limited signal");
    expect(labelForScore(49.99)).toBe("Limited signal");
    expect(labelForScore(50)).toBe("Emerging opportunity");
    expect(labelForScore(74.99)).toBe("Emerging opportunity");
    expect(labelForScore(75)).toBe("Strong opportunity");
    expect(labelForScore(100)).toBe("Strong opportunity");

    const bounded = calculateIdeaScore(
      {
        idea,
        sources: [source],
        signals: [signal("momentum", 900), signal("competition", -20)],
        relevance: 4,
      },
      now,
    );
    for (const dimension of Object.values(bounded.dimensions)) {
      expect(dimension.value).toBeGreaterThanOrEqual(0);
      expect(dimension.value).toBeLessThanOrEqual(100);
    }
    expect(bounded.overallScore).toBeLessThanOrEqual(100);
  });

  it("makes stale and incomplete evidence visible instead of implying certainty", () => {
    const stale = calculateIdeaScore(
      {
        idea,
        sources: [
          {
            ...source,
            publishedAt: new Date("2026-09-01T00:00:00.000Z"),
            retrievalStatus: "stale",
          },
        ],
        signals: [],
      },
      now,
    );
    expect(stale.coverage).toMatchObject({
      staleSourceCount: 1,
      complete: false,
      uncertainty: "limited",
    });
    expect(stale.dimensions.trendMomentum.kind).toBe("estimated");
    expect(stale.explanation).toContain("stale");

    const unavailable = calculateIdeaScore(
      { idea, sources: [], signals: [] },
      now,
    );
    expect(unavailable.coverage.uncertainty).toBe("unavailable");
    expect(unavailable.explanation).toContain(
      "No source evidence is available",
    );
  });

  it("creates immutable versioned snapshots with exactly one current snapshot", async () => {
    const store = new InMemoryIdeaScoreStore();
    const first = new IdeaScoringService(store, () => now, "rec-02-v1");
    const firstSnapshot = await first.score({
      idea,
      sources: [source],
      signals: [signal("momentum", 0.5)],
    });
    const second = await new IdeaScoringService(
      store,
      () => new Date("2026-11-11T01:00:00.000Z"),
      "rec-02-v2",
    ).score({ idea, sources: [source], signals: [signal("momentum", 0.9)] });

    expect(store.snapshots.size).toBe(2);
    expect((await store.findCurrent(idea._id))?._id).toBe(second._id);
    expect(store.snapshots.get(firstSnapshot._id)?.isCurrent).toBe(false);
    expect(store.snapshots.get(firstSnapshot._id)?.scoreVersion).toBe(
      "rec-02-v1",
    );
    expect(store.snapshots.get(firstSnapshot._id)?.dimensions).toEqual(
      firstSnapshot.dimensions,
    );
  });
});
