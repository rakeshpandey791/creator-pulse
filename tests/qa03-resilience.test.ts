import {
  AiProviderError,
  type GenerationRequest,
} from "@creator-pulse/contracts";
import { describe, expect, it } from "vitest";
import { AiPocRunner, type AiPocBudget } from "../apps/worker/src/ai/poc.js";
import {
  InMemoryCreditLedgerService,
  InsufficientCreditsError,
} from "../apps/api/src/commercial/credit-ledger.service.js";

const budget: AiPocBudget = {
  maxConcurrency: 2,
  perUserRequests: 10,
  globalRequests: 20,
  maxRetries: 1,
  retryDelayMs: 0,
};

const request: GenerationRequest = {
  language: "hi",
  platform: "youtube_shorts",
  outputs: ["hooks", "script", "cta"],
  durationSeconds: 30,
  tone: "clear",
  prompt: "Create a practical short-form video.",
};

describe("QA-03 performance, resilience and cost controls", () => {
  it("keeps provider concurrency bounded under load", async () => {
    let active = 0;
    let maxActive = 0;
    const provider = {
      name: "qa-provider",
      async generate(input: GenerationRequest) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return {
          content: {
            language: input.language,
            platform: input.platform,
            hooks: ["Try this today."],
            script: "A short, useful script.",
            cta: "Save this idea.",
            durationSeconds: input.durationSeconds,
            safetyFlags: [],
          },
          telemetry: {
            provider: "qa-provider",
            model: "test",
            durationMs: 2,
            outcome: "success" as const,
          },
        };
      },
    };
    const runner = new AiPocRunner(provider, budget);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        runner.run(
          request,
          { userId: "creator-1", requestId: `load-${index}` },
          `load-${index}`,
        ),
      ),
    );

    expect(results.every((result) => result.success)).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(budget.maxConcurrency);
  });

  it("bounds retries for provider timeouts and avoids a retry storm", async () => {
    let calls = 0;
    const provider = {
      name: "flaky-provider",
      async generate() {
        calls += 1;
        throw new AiProviderError("timeout", "timed out", true);
      },
    };
    const runner = new AiPocRunner(provider, budget);
    const results = await Promise.all(
      ["timeout-1", "timeout-2", "timeout-3"].map((id) =>
        runner.run(request, { userId: "creator-1", requestId: id }, id),
      ),
    );

    expect(results.every((result) => !result.success)).toBe(true);
    expect(
      results.every((result) => result.retries === budget.maxRetries),
    ).toBe(true);
    expect(calls).toBe(3 * (budget.maxRetries + 1));
  });

  it("enforces per-user and global provider budgets", async () => {
    const constrained: AiPocBudget = {
      ...budget,
      perUserRequests: 2,
      globalRequests: 3,
    };
    const provider = {
      name: "budget-provider",
      async generate(input: GenerationRequest) {
        return {
          content: {
            language: input.language,
            platform: input.platform,
            hooks: ["Try this."],
            script: "Useful advice.",
            cta: "Save this.",
            durationSeconds: input.durationSeconds,
            safetyFlags: [],
          },
          telemetry: {
            provider: "budget-provider",
            model: "test",
            durationMs: 0,
            outcome: "success" as const,
          },
        };
      },
    };
    const runner = new AiPocRunner(provider, constrained);
    const results = await Promise.allSettled(
      ["budget-1", "budget-2", "budget-3", "budget-4"].map((id) =>
        runner.run(request, { userId: "creator-1", requestId: id }, id),
      ),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(2);
    expect(results[2]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ code: "quota_exhausted" }),
    });
  });

  it("prevents overspend and double settlement during a worker retry", async () => {
    const ledger = new InMemoryCreditLedgerService();
    ledger.balances.set("creator-1", 3);
    const attempts = await Promise.allSettled(
      ["op-a", "op-b"].map((operationId) =>
        ledger.reserve("creator-1", operationId, 3),
      ),
    );

    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      attempts.some(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof InsufficientCreditsError,
      ),
    ).toBe(true);
    await ledger.consume("creator-1", "op-a");
    await ledger.consume("creator-1", "op-a");
    expect(
      ledger.entries.filter((entry) => entry.operationId === "op-a"),
    ).toHaveLength(2);
    expect(ledger.balances.get("creator-1")).toBe(0);
  });
});
