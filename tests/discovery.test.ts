import { describe, expect, it } from "vitest";
import { InMemoryCreatorProfileDependencies } from "../apps/api/src/creator/in-memory-creator-repositories.js";
import { CreatorProfileService } from "../apps/api/src/creator/creator-profile.service.js";
import {
  decodeRecommendationCursor,
  DiscoveryService,
  encodeRecommendationCursor,
  InMemoryDiscoveryStore,
  recommendationCursorFilter,
} from "../apps/api/src/discovery/discovery.service.js";
import type { RecommendationRecord } from "../apps/api/src/discovery/recommendations.service.js";
import type {
  ContentIdea,
  IdeaEvidence,
} from "../apps/api/src/research/idea-creation.service.js";
import type { IdeaScoreSnapshot } from "../apps/api/src/research/scoring.service.js";
import type {
  IdeaGenerationProvider,
  IdeaRankingProvider,
} from "@creator-pulse/contracts";

const now = new Date("2026-11-11T10:30:00.000Z");
const nicheFitness = "5f4e5c8b-3f7b-4f2a-9b31-000000000001";
const nicheFood = "5f4e5c8b-3f7b-4f2a-9b31-000000000002";
const platformYoutube = "7f4e5c8b-3f7b-4f2a-9b31-000000000002";
const languageHindi = "6f4e5c8b-3f7b-4f2a-9b31-000000000001";
const profileInput = {
  nicheIds: [nicheFitness],
  platformIds: [platformYoutube],
  languageIds: [languageHindi],
  audience: { description: "Fitness creators" },
};

function makeIdea(
  id: string,
  overrides: Partial<ContentIdea> = {},
): ContentIdea {
  return {
    _id: id,
    topicId: `topic-${id}`,
    title: `Idea ${id}`,
    summary: "A practical creator idea.",
    languageId: languageHindi,
    platformId: platformYoutube,
    nicheId: nicheFitness,
    origin: "research",
    canonicalKey: id,
    searchText: `idea ${id} practical creator`,
    coverage: {
      sourceCount: 1,
      signalCount: 1,
      staleSourceCount: 0,
      missingEvidence: false,
      uncertainty: "none",
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeScore(ideaId: string): IdeaScoreSnapshot {
  const dimensions = {
    relevance: {
      value: 80,
      weight: 0.35,
      kind: "observed" as const,
      explanation: "fit",
    },
    trendMomentum: {
      value: 75,
      weight: 0.3,
      kind: "observed" as const,
      explanation: "momentum",
    },
    freshness: {
      value: 90,
      weight: 0.2,
      kind: "observed" as const,
      explanation: "fresh",
    },
    competition: {
      value: 60,
      weight: 0.15,
      kind: "estimated" as const,
      explanation: "estimate",
    },
  };
  return {
    _id: `score-${ideaId}`,
    ideaId,
    scoreVersion: "rec-02-v1",
    overallScore: 78,
    label: "Strong opportunity",
    dimensions,
    explanation: "Strong opportunity with current evidence.",
    coverage: {
      sourceCount: 1,
      signalCount: 1,
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

function setup() {
  const store = new InMemoryDiscoveryStore();
  const profiles = new CreatorProfileService(
    new InMemoryCreatorProfileDependencies(),
  );
  return { store, profiles, service: new DiscoveryService(store, profiles) };
}

function setupWithGeminiRanking(rankIdeas: IdeaRankingProvider["rankIdeas"]) {
  const base = setup();
  const provider: IdeaRankingProvider = {
    name: "gemini",
    rankIdeas,
  };
  return {
    ...base,
    service: new DiscoveryService(base.store, base.profiles, provider),
  };
}

function setupWithGeminiGeneration(
  generateIdeas: IdeaGenerationProvider["generateIdeas"],
  name = "gemini",
) {
  const base = setup();
  const provider: IdeaGenerationProvider = {
    name,
    generateIdeas,
  };
  return {
    ...base,
    service: new DiscoveryService(
      base.store,
      base.profiles,
      undefined,
      provider,
    ),
  };
}

describe("DISC-01 discovery APIs", () => {
  it("materializes a personalized daily feed and keeps it scoped to the creator", async () => {
    const { store, profiles, service } = setup();
    await profiles.replace("creator-a", profileInput);
    store.ideas.set("idea-1", makeIdea("idea-1"));
    store.ideas.set("idea-2", makeIdea("idea-2", { nicheId: nicheFood }));
    store.scores.set("score-1", makeScore("idea-1"));
    store.scores.set("score-2", makeScore("idea-2"));
    const first = await service.dailyFeed("creator-a", { limit: 20 });
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({
      id: "idea-1",
      score: { scoreVersion: "rec-02-v1" },
    });
    expect(first.items[0]?.reason).toContain("creative direction");
    expect(first.items[0]?.reason).not.toContain(nicheFitness);
    expect([...store.recommendations.values()]).toHaveLength(1);
    expect([...store.recommendations.values()][0]?.creatorId).toBe("creator-a");
    expect((await service.dailyFeed("creator-b", { limit: 20 })).items).toEqual(
      [],
    );
  });

  it("returns deterministic cursor pages for search without requiring trend data", async () => {
    const { store, service } = setup();
    for (const id of ["idea-1", "idea-2", "idea-3"])
      store.ideas.set(id, makeIdea(id));
    const first = await service.search({ query: "practical", limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await service.search({
      query: "practical",
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items).toHaveLength(1);
    expect(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
    ).toBe(3);
    expect(second.items[0]?.score).toBeNull();
  });

  it("uses Gemini ranking for browse/search while retaining database idea records", async () => {
    const calls: string[] = [];
    const { store, service } = setupWithGeminiRanking(async (request) => {
      calls.push(request.query ?? "");
      return {
        result: {
          rankedIds: ["idea-2", "idea-1"],
          reasons: {
            "idea-2":
              "Closer to 7f4e5c8b-3f7b-4f2a-9b31-000000000002 for this search.",
          },
        },
        telemetry: {
          provider: "gemini",
          model: "test-model",
          durationMs: 1,
          outcome: "success",
        },
      };
    });
    store.ideas.set("idea-1", makeIdea("idea-1", { title: "Morning routine" }));
    store.ideas.set("idea-2", makeIdea("idea-2", { title: "Morning workout" }));

    const result = await service.search({ query: "workout", limit: 1 });

    expect(calls).toEqual(["workout"]);
    expect(result.items[0]).toMatchObject({
      id: "idea-2",
      reason: "Closer to this idea for this search.",
    });
    expect(result.items[0]?.reason).not.toContain("7f4e5c8b");
    expect(result.nextCursor).toBeTruthy();
  });

  it("falls back to deterministic database search when Gemini is unavailable", async () => {
    const { store, service } = setupWithGeminiRanking(async () => {
      throw new Error("provider unavailable");
    });
    store.ideas.set("idea-1", makeIdea("idea-1", { title: "Morning routine" }));
    store.ideas.set("idea-2", makeIdea("idea-2", { title: "Evening routine" }));

    const result = await service.search({
      query: "morning workout",
      limit: 20,
    });

    expect(result.items.map((item) => item.id)).toEqual(["idea-1"]);
  });

  it.each(["groq", "gemini"])(
    "returns five persisted %s-generated ideas for the initial browse",
    async (name) => {
      const { store, service } = setupWithGeminiGeneration(
        async (request) => ({
          ideas: Array.from({ length: 5 }, (_, index) => ({
            title: `${request.query ?? "Browse"} idea ${index + 1}`,
            summary: "A practical idea to record tomorrow.",
            audienceAngle: "Creators who want a simple next post.",
            recommendedAction:
              "Show one clear step and invite viewers to try it.",
          })),
          telemetry: {
            provider: "gemini",
            model: "test-model",
            durationMs: 1,
            outcome: "success",
          },
        }),
        name,
      );
      store.ideas.set("idea-reference", makeIdea("idea-reference"));

      const result = await service.search({ limit: 20 });

      expect(result.items).toHaveLength(5);
      expect(
        result.items.every((item) => item.reason?.includes("creator context")),
      ).toBe(true);
      expect(result.items.every((item) => store.ideas.has(item.id))).toBe(true);
    },
  );

  it("regenerates a materialized feed after profile changes and filters suppressed ideas", async () => {
    const { store, profiles, service } = setup();
    await profiles.replace("creator-a", profileInput);
    const idea = makeIdea("idea-refresh");
    store.ideas.set(idea._id, idea);
    store.scores.set(idea._id, makeScore(idea._id));

    const first = await service.dailyFeed("creator-a", { limit: 20 });
    expect(first.profileVersion).toBe(1);
    await profiles.patch("creator-a", { creatorGoal: "A new goal" });
    const refreshed = await service.dailyFeed("creator-a", { limit: 20 });
    expect(refreshed.profileVersion).toBe(2);
    expect([...store.recommendations.values()][0]?.profileVersion).toBe(2);

    const record = [...store.recommendations.values()][0]!;
    store.recommendations.set(record._id, { ...record, dismissedAt: now });
    const suppressed = await service.dailyFeed("creator-a", { limit: 20 });
    expect(suppressed.items).toEqual([]);
    expect(suppressed.fallback.kind).toBe("no_eligible_candidates");
  });

  it("uses rank and id together for recommendation cursors", async () => {
    const record = {
      _id: "recommendation-b",
      rank: 2,
    } as Pick<RecommendationRecord, "_id" | "rank">;
    const cursor = encodeRecommendationCursor(record);
    expect(decodeRecommendationCursor(cursor)).toEqual({
      rank: 2,
      id: "recommendation-b",
    });
    expect(
      recommendationCursorFilter({ rank: 2, id: "recommendation-b" }),
    ).toEqual({
      $or: [
        { rank: { $gt: 2 } },
        { rank: 2, _id: { $gt: "recommendation-b" } },
      ],
    });
  });

  it("returns bounded evidence and safe public source links", async () => {
    const { store, service } = setup();
    const idea = makeIdea("idea-detail");
    store.ideas.set(idea._id, idea);
    store.scores.set(idea._id, makeScore(idea._id));
    store.sources.set("source-1", {
      _id: "source-1",
      canonicalUrl: "https://example.test/source",
      title: "Public source",
      observedAt: now,
    });
    for (let index = 0; index < 12; index += 1) {
      const evidence: IdeaEvidence = {
        _id: `evidence-${index}`,
        ideaId: idea._id,
        sourceDocumentId: "source-1",
        evidenceType: "source",
        summary: `Evidence ${index}`,
        observedAt: now,
        rank: index + 1,
        createdAt: now,
        updatedAt: now,
      };
      store.evidence.set(evidence._id, evidence);
    }
    const detail = await service.detail(idea._id);
    expect(detail.evidence).toHaveLength(10);
    expect(detail.evidence[0]?.source).toEqual({
      canonicalUrl: "https://example.test/source",
      title: "Public source",
    });
    expect(detail).not.toHaveProperty("creatorId");
  });

  it("rejects an invalid search cursor", async () => {
    const { service } = setup();
    await expect(
      service.search({ query: "x", limit: 20, cursor: "not-a-real-cursor" }),
    ).rejects.toThrow("Invalid cursor");
  });

  it("persists save and dismiss actions for the creator", async () => {
    const { store, profiles, service } = setup();
    await profiles.replace("creator-a", profileInput);
    const idea = makeIdea("idea-actions");
    store.ideas.set(idea._id, idea);
    store.scores.set(idea._id, makeScore(idea._id));

    await service.dailyFeed("creator-a", { limit: 20 });
    const saved = await service.updateIdeaAction("creator-a", idea._id, "save");
    expect(saved.action).toBe("save");
    expect(saved.savedAt).toBeTruthy();

    const dismissed = await service.updateIdeaAction(
      "creator-a",
      idea._id,
      "dismiss",
    );
    expect(dismissed.action).toBe("dismiss");
    expect(dismissed.dismissedAt).toBeTruthy();
    expect(
      [...store.recommendations.values()].find(
        (item) => item.ideaId === idea._id,
      )?.dismissedAt,
    ).toBeTruthy();
  });

  it("keeps saved ideas idempotent and returns their evidence and score", async () => {
    const { store, service } = setup();
    const idea = makeIdea("idea-library");
    store.ideas.set(idea._id, idea);
    store.scores.set(idea._id, makeScore(idea._id));
    store.sources.set("source-library", {
      _id: "source-library",
      canonicalUrl: "https://example.test/library",
      title: "Library source",
      observedAt: now,
    });
    store.evidence.set("evidence-library", {
      _id: "evidence-library",
      ideaId: idea._id,
      sourceDocumentId: "source-library",
      evidenceType: "source",
      summary: "A supporting source",
      observedAt: now,
      rank: 1,
      createdAt: now,
      updatedAt: now,
    });

    const first = await service.saveIdea("creator-a", idea._id);
    const second = await service.saveIdea("creator-a", idea._id);
    expect(first.saved._id).toBe(second.saved._id);
    expect(store.statusEvents.get(`creator-a:${idea._id}`)).toHaveLength(1);
    const library = await service.library("creator-a", { limit: 10 });
    expect(library.items[0]).toMatchObject({
      saved: { ideaId: idea._id, currentStatus: "saved" },
      status: { status: "saved" },
      idea: {
        score: { overallScore: 78 },
        evidence: [{ id: "evidence-library" }],
      },
    });
  });

  it("enforces status transitions and records an append-only history", async () => {
    const { store, service } = setup();
    const idea = makeIdea("idea-status");
    store.ideas.set(idea._id, idea);
    await service.saveIdea("creator-a", idea._id);
    await service.transitionIdeaStatus("creator-a", idea._id, "planned");
    await service.transitionIdeaStatus("creator-a", idea._id, "scripted");
    await service.transitionIdeaStatus(
      "creator-a",
      idea._id,
      "published",
      "Published manually",
    );
    await expect(
      service.transitionIdeaStatus("creator-a", idea._id, "dismissed"),
    ).rejects.toThrow("Invalid idea status transition");
    const status = await service.status("creator-a", idea._id);
    expect(status.current?.status).toBe("published");
    expect(status.history.map((event) => event.status)).toEqual([
      "saved",
      "planned",
      "scripted",
      "published",
    ]);
  });

  it("paginates the creator library with an ownership boundary", async () => {
    const { store, service } = setup();
    for (const id of ["idea-library-1", "idea-library-2", "idea-library-3"]) {
      store.ideas.set(id, makeIdea(id));
      await service.saveIdea("creator-a", id);
    }
    await service.saveIdea("creator-b", "idea-library-1");
    const first = await service.library("creator-a", { limit: 2 });
    const second = await service.library("creator-a", {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(
      [...first.items, ...second.items].every(
        (item) => item.saved.creatorId === "creator-a",
      ),
    ).toBe(true);
  });

  it("creates an idempotent queued draft operation for an idea", async () => {
    const { store, service } = setup();
    const idea = makeIdea("idea-draft");
    store.ideas.set(idea._id, idea);
    const first = await service.startDraft("creator-a", idea._id);
    const second = await service.startDraft("creator-a", idea._id);
    expect(first).toEqual(second);
    expect(first.status).toBe("queued");
  });
});
