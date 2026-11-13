import { describe, expect, it } from "vitest";
import {
  IdeaCreationService,
  InMemoryIdeaCreationStore,
} from "../apps/api/src/research/idea-creation.service.js";

const now = new Date("2026-11-11T00:00:00.000Z");

function setup() {
  const store = new InMemoryIdeaCreationStore();
  store.sources.set("source-1", {
    _id: "source-1",
    canonicalUrl: "https://source.test/fitness",
    title: "Fitness habits",
    excerpt: "<b>Practical</b> habits for creators.",
    retrievalStatus: "active",
    observedAt: now,
  });
  store.signals.set("signal-1", {
    _id: "signal-1",
    sourceDocumentId: "source-1",
    topicId: "topic-1",
    signalType: "freshness",
    value: 0.9,
    observedAt: now,
  });
  return { store, service: new IdeaCreationService(store, () => now) };
}

describe("REC-01 idea creation", () => {
  it("creates a reusable topic, idea and bounded provenance evidence", async () => {
    const { store, service } = setup();
    const topic = await service.createTopic({
      title: "Fitness routines",
      languageIds: ["hi"],
      nicheIds: ["fitness"],
    });
    store.signals.get("signal-1")!.topicId = topic._id;
    const result = await service.createIdea({
      title: "Morning fitness routines",
      summary: "A practical short-form routine for busy creators.",
      languageId: "hi",
      platformId: "instagram",
      nicheId: "fitness",
      origin: "research",
      topicId: topic._id,
      sourceDocumentIds: ["source-1"],
      trendSignalIds: ["signal-1"],
    });
    expect(result.idea.coverage).toMatchObject({
      sourceCount: 1,
      signalCount: 1,
      missingEvidence: false,
    });
    expect(result.evidence[0]).toMatchObject({
      sourceDocumentId: "source-1",
      trendSignalId: "signal-1",
      evidenceType: "trend",
    });
    expect(result.evidence[0].summary).not.toContain("<b>");
    expect(store.topics.size).toBe(1);
  });

  it("deduplicates canonical ideas across repeated creation requests", async () => {
    const { store, service } = setup();
    const input = {
      title: "Morning fitness routines",
      summary: "A useful routine.",
      languageId: "hi",
      platformId: "instagram",
      nicheId: "fitness",
      origin: "manual_search" as const,
      topic: {
        title: "Fitness routines",
        languageIds: ["hi"],
        nicheIds: ["fitness"],
      },
    };
    const first = await service.createIdea(input);
    const second = await service.createIdea({
      ...input,
      summary: "A changed summary.",
    });
    expect(second.idea._id).toBe(first.idea._id);
    expect(store.ideas.size).toBe(1);
  });

  it("represents absent evidence honestly and rejects orphan signals", async () => {
    const { store, service } = setup();
    const noEvidence = await service.createIdea({
      title: "A manual idea",
      summary: "No source was found.",
      languageId: "en",
      platformId: "youtube",
      nicheId: "food",
      origin: "manual_search",
      topic: { title: "Food ideas", languageIds: ["en"], nicheIds: ["food"] },
    });
    expect(noEvidence.idea.coverage).toMatchObject({
      sourceCount: 0,
      missingEvidence: true,
      uncertainty: "unavailable",
    });
    const topic = await service.createTopic({
      title: "Unrelated topic",
      languageIds: ["en"],
      nicheIds: ["food"],
    });
    store.signals.set("unrelated-signal", {
      _id: "unrelated-signal",
      sourceDocumentId: "source-1",
      topicId: "different-topic",
      signalType: "freshness",
      value: 0.5,
      observedAt: now,
    });
    await expect(
      service.createIdea({
        title: "Orphaned signal idea",
        summary: "Should fail safely.",
        languageId: "en",
        platformId: "youtube",
        nicheId: "food",
        origin: "research",
        topicId: topic._id,
        sourceDocumentIds: ["source-1"],
        trendSignalIds: ["unrelated-signal"],
      }),
    ).rejects.toMatchObject({ code: "missing_reference" });
  });

  it("rolls back the idea when evidence persistence fails, allowing retry", async () => {
    const { store, service } = setup();
    const topic = await service.createTopic({
      title: "Fitness routines",
      languageIds: ["hi"],
      nicheIds: ["fitness"],
    });
    store.signals.get("signal-1")!.topicId = topic._id;
    const saveEvidence = store.saveEvidence.bind(store);
    let fail = true;
    store.saveEvidence = async (evidence) => {
      if (fail) throw new Error("evidence write failed");
      return saveEvidence(evidence);
    };
    const input = {
      title: "Retryable fitness idea",
      summary: "A retryable evidence-backed idea.",
      languageId: "hi",
      platformId: "instagram",
      nicheId: "fitness",
      origin: "research" as const,
      topicId: topic._id,
      sourceDocumentIds: ["source-1"],
      trendSignalIds: ["signal-1"],
    };
    await expect(service.createIdea(input)).rejects.toThrow(
      "evidence write failed",
    );
    expect(store.ideas.size).toBe(0);
    fail = false;
    const retried = await service.createIdea(input);
    expect(retried.evidence).toHaveLength(1);
    expect(store.ideas.size).toBe(1);
  });
});
