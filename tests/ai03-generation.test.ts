import { describe, expect, it } from "vitest";
import {
  AiProviderError,
  type GenerationRequest,
  type TextGenerationProvider,
} from "@creator-pulse/contracts";
import { InMemoryGenerationProvider } from "../apps/api/src/generation/in-memory-generation-provider.js";
import {
  GENERATION_CREDIT_COST,
  GenerationService,
  InMemoryGenerationQueue,
  InMemoryGenerationStore,
  type GenerationInput,
} from "../apps/api/src/generation/generation.service.js";
import type { GroundedAngleProvider } from "@creator-pulse/contracts";

const input: GenerationInput = {
  language: "hi",
  platform: "youtube_shorts",
  outputs: ["hooks", "script", "cta"],
  durationSeconds: 45,
  tone: "conversational",
};

function setup(
  provider: TextGenerationProvider = new InMemoryGenerationProvider(),
) {
  const store = new InMemoryGenerationStore();
  store.ideas.set("idea-1", {
    _id: "idea-1",
    title: "A practical fitness habit",
    summary: "A simple idea for a useful short video.",
    languageId: "hi",
    platformId: "youtube_shorts",
    nicheId: "fitness",
    topicId: "topic-1",
  });
  store.evidence.set("idea-1", [{ summary: "A source-backed observation." }]);
  const queue = new InMemoryGenerationQueue();
  const service = new GenerationService(store, queue, provider);
  queue.register((job) => service.process(job));
  return { store, queue, service };
}

async function flushQueue() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("AI-03 generation operations", () => {
  it("sends the output schema, duration and tone to the script provider", async () => {
    let sent: GenerationRequest | undefined;
    const delegate = new InMemoryGenerationProvider();
    const { service } = setup({
      name: "capture",
      async generate(request) {
        sent = request;
        return delegate.generate(request);
      },
    });
    const operation = await service.start(
      "creator-1",
      "idea-1",
      input,
      "schema-request",
    );
    await flushQueue();
    expect(
      (await service.getStatus("creator-1", operation.operationId)).status,
    ).toBe("succeeded");
    expect(sent?.prompt).toContain("Required JSON fields:");
    expect(sent?.prompt).toContain("Target duration: 45 seconds");
    expect(sent?.prompt).toContain("Tone: conversational");
    expect(sent?.prompt).toContain('platform exactly "youtube_shorts"');
  });

  it("reserves once, deduplicates idempotency keys, persists assets and settles credits", async () => {
    const { store, service } = setup();
    const first = await service.start(
      "creator-1",
      "idea-1",
      input,
      "request-1",
    );
    const duplicate = await service.start(
      "creator-1",
      "idea-1",
      input,
      "request-1",
    );
    expect(duplicate.operationId).toBe(first.operationId);
    await flushQueue();
    const status = await service.getStatus("creator-1", first.operationId);
    expect(status.status).toBe("succeeded");
    expect(status.resultAssetIds).toHaveLength(5);
    expect(status).not.toHaveProperty("request");
    expect(store.balances.get("creator-1")).toBe(10 - GENERATION_CREDIT_COST);
    expect(store.assets.size).toBe(5);
  });

  it("refunds a malformed provider result and exposes only a safe failure", async () => {
    const provider: TextGenerationProvider = {
      name: "malformed",
      async generate(_request: GenerationRequest) {
        throw new AiProviderError(
          "malformed_output",
          "raw provider output",
          false,
        );
      },
    };
    const { store, service } = setup(provider);
    const operation = await service.start(
      "creator-1",
      "idea-1",
      input,
      "request-2",
    );
    await flushQueue();
    const status = await service.getStatus("creator-1", operation.operationId);
    expect(status.status).toBe("failed");
    expect(status.error).toMatchObject({
      code: "malformed_output",
      message:
        "The writing service couldn’t finish this draft. Please try again.",
    });
    expect(status.error.message).not.toContain("raw provider output");
    expect(store.balances.get("creator-1")).toBe(10);
    expect(store.assets.size).toBe(0);
  });

  it("rejects insufficient credits before queueing work", async () => {
    const { store, service } = setup();
    store.balances.set("creator-1", 1);
    await expect(
      service.start("creator-1", "idea-1", input, "request-3"),
    ).rejects.toMatchObject({ code: "CREDITS_INSUFFICIENT" });
    expect(store.operations.size).toBe(1);
    expect(store.balances.get("creator-1")).toBe(1);
  });

  it("cancels queued work and releases its reservation", async () => {
    const store = new InMemoryGenerationStore();
    store.ideas.set("idea-1", {
      _id: "idea-1",
      title: "A practical fitness habit",
      summary: "A simple idea for a useful short video.",
      languageId: "hi",
      platformId: "youtube_shorts",
      nicheId: "fitness",
      topicId: "topic-1",
    });
    const jobs: Array<{ operationId: string }> = [];
    const queue = {
      enqueue: async (job: { operationId: string }) => {
        jobs.push(job);
      },
    };
    const service = new GenerationService(
      store,
      queue,
      new InMemoryGenerationProvider(),
    );
    const operation = await service.start(
      "creator-1",
      "idea-1",
      input,
      "request-4",
    );
    const cancelled = await service.cancel("creator-1", operation.operationId);
    expect(cancelled.status).toBe("cancelled");
    expect(store.balances.get("creator-1")).toBe(10);
  });

  it("selects a grounded angle before script expansion and exposes phases", async () => {
    const prompts: string[] = [];
    const angleProvider: GroundedAngleProvider = {
      async selectAngle(request) {
        expect(request.ideaTitle).toBe("A practical fitness habit");
        expect(request.evidence).toHaveLength(1);
        return {
          angle: {
            angle: "Show one small morning mobility step.",
            rationale: "The source supports a practical, low-friction angle.",
            sourceRefs: ["Morning movement source"],
            uncertainty: "limited",
          },
          telemetry: {
            provider: "angle-test",
            model: "angle-v1",
            durationMs: 1,
            outcome: "success",
          },
        };
      },
    };
    const provider: TextGenerationProvider = {
      name: "script-test",
      async generate(request) {
        prompts.push(request.prompt);
        return new InMemoryGenerationProvider().generate(request);
      },
    };
    const store = new InMemoryGenerationStore();
    store.ideas.set("idea-1", {
      _id: "idea-1",
      title: "A practical fitness habit",
      summary: "A simple idea for a useful short video.",
      languageId: "hi",
      platformId: "youtube_shorts",
      nicheId: "fitness",
      topicId: "topic-1",
    });
    store.evidence.set("idea-1", [
      {
        summary: "Morning movement is being discussed.",
        sourceTitle: "Morning movement source",
      },
    ]);
    const queue = new InMemoryGenerationQueue();
    const service = new GenerationService(
      store,
      queue,
      provider,
      undefined,
      undefined,
      angleProvider,
    );
    queue.register((job) => service.process(job));

    const operation = await service.start(
      "creator-1",
      "idea-1",
      input,
      "grounded-1",
    );
    expect(operation.phase).toBe("finding_angle");
    await flushQueue();
    const status = await service.getStatus("creator-1", operation.operationId);
    expect(status.status).toBe("succeeded");
    expect(status.phase).toBe("checking_script");
    expect(status.groundedAngle).toMatchObject({
      angle: "Show one small morning mobility step.",
      sourceRefs: ["Morning movement source"],
    });
    expect(prompts[0]).toContain("<grounded-angle>");
    expect(prompts[0]).toContain("Show one small morning mobility step.");
  });

  it("uses an honest creator-topic fallback when local evidence is unavailable", async () => {
    const { store, service } = setup();
    store.evidence.set("idea-1", []);
    const operation = await service.start(
      "creator-1",
      "idea-1",
      input,
      "no-evidence-1",
    );
    await flushQueue();
    const status = await service.getStatus("creator-1", operation.operationId);
    expect(status.status).toBe("succeeded");
    expect(status.groundedAngle).toMatchObject({
      uncertainty: "unavailable",
      sourceRefs: [],
    });
    expect(status.groundedAngle?.rationale).toContain(
      "without claiming a trend",
    );
  });
});
