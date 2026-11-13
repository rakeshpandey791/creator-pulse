import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonAiClient, aiMode } from "@creator-pulse/ai";
import { ApiGeminiGenerationProvider } from "../apps/api/src/generation/gemini-generation-provider.js";
import { RoutedTextGenerationProvider } from "../apps/worker/src/ai/routed-provider.js";
import {
  GenerationService,
  InMemoryGenerationStore,
} from "../apps/api/src/generation/generation.service.js";

const env = {
  AI_PROVIDER: "groq",
  GROQ_API_KEY: "test-groq",
  GEMINI_API_KEY: "test-gemini",
  AI_TIMEOUT_MS: "1000",
};
const script = {
  language: "hi",
  platform: "instagram",
  hooks: ["पहला", "दूसरा", "तीसरा"],
  script: "फोन दूर रखें और एक काम पर ध्यान दें।",
  cta: "आज इसे आजमाएँ।",
  durationSeconds: 45,
  safetyFlags: [],
};
const request = {
  language: "hi",
  platform: "instagram",
  durationSeconds: 45,
  tone: "friendly",
  outputs: ["hooks", "script", "cta"] as const,
  prompt: "Return a JSON Hindi script",
};
const angle = {
  angle: "A practical study habit",
  rationale: "Creator topic",
  sourceRefs: [],
  uncertainty: "unavailable",
};
const ideas = {
  ideas: Array.from({ length: 5 }, (_, i) => ({
    title: `Study habit ${i}`,
    summary: "A practical habit",
    audienceAngle: "Students",
    recommendedAction: "Try this",
  })),
};
const response = (
  provider: "groq" | "gemini",
  value: unknown,
  finish?: string,
) =>
  new Response(
    JSON.stringify(
      provider === "groq"
        ? {
            choices: [
              {
                message: {
                  content:
                    typeof value === "string" ? value : JSON.stringify(value),
                },
                finish_reason: finish ?? "stop",
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }
        : {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text:
                        typeof value === "string"
                          ? value
                          : JSON.stringify(value),
                    },
                  ],
                },
                finishReason: finish ?? "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 11,
              candidatesTokenCount: 21,
              totalTokenCount: 32,
            },
          },
    ),
  );

afterEach(() => vi.useRealTimers());

describe("AI-05 shared Groq-first routing", () => {
  it("defaults to Groq, rejects invalid configuration, preserves fake and explicit Gemini", () => {
    expect(aiMode({})).toBe("groq");
    expect(aiMode({ AI_PROVIDER: "fake" })).toBe("fake");
    expect(aiMode({ AI_PROVIDER: "gemini" })).toBe("gemini");
    expect(() => aiMode({ AI_PROVIDER: "typo" })).toThrow("AI_PROVIDER");
    expect(() => new JsonAiClient({ AI_TIMEOUT_MS: "0" })).toThrow(
      "AI_TIMEOUT_MS",
    );
  });

  it.each([429, 500, 503, 401, 400])(
    "falls back once on Groq HTTP %i and records actual provider",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response("{}", { status }))
        .mockResolvedValueOnce(response("gemini", angle));
      const result = await new JsonAiClient(env, fetcher).request(
        "JSON angle",
        (x) => x,
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls[0]?.[0]).toContain("api.groq.com");
      expect(fetcher.mock.calls[1]?.[0]).toContain(
        "generativelanguage.googleapis.com",
      );
      expect(result.telemetry).toMatchObject({
        provider: "gemini",
        fallbackFrom: "groq",
        totalTokens: 32,
      });
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).not.toContain(env.GROQ_API_KEY);
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-groq",
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "qwen/qwen3.8-27b",
        response_format: { type: "json_object" },
      });
    },
  );

  it("falls back on transport failure and missing primary key", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network" + env.GROQ_API_KEY))
      .mockResolvedValueOnce(response("gemini", angle));
    expect(
      (await new JsonAiClient(env, fetcher).request("JSON", (x) => x)).telemetry
        .provider,
    ).toBe("gemini");
    const fallback = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("gemini", angle));
    await new JsonAiClient({ ...env, GROQ_API_KEY: "" }, fallback).request(
      "JSON",
      (x) => x,
    );
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0]?.[0]).toContain("googleapis.com");
  });

  it("aborts a hung primary before falling back", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        async (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
      )
      .mockResolvedValueOnce(response("gemini", angle));
    const pending = new JsonAiClient(env, fetcher).request("JSON", (x) => x);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).telemetry).toMatchObject({
      provider: "gemini",
      fallbackReason: "timeout",
    });
  });

  it.each(["not-json", "truncated"])(
    "falls back on %s output",
    async (kind) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response(
            "groq",
            "not-json",
            kind === "truncated" ? "length" : "stop",
          ),
        )
        .mockResolvedValueOnce(response("gemini", angle));
      expect(
        (await new JsonAiClient(env, fetcher).request("JSON", (x) => x))
          .telemetry.provider,
      ).toBe("gemini");
    },
  );

  it("never retries exhausted quotas or loops when both providers fail", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "requests per day limit exceeded" },
          }),
          { status: 429 },
        ),
      );
    await expect(
      new JsonAiClient(env, fetcher).request("private prompt", (x) => x),
    ).rejects.toMatchObject({ code: "quota_exhausted", retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "routes every API capability, fallback=%s",
    async (fallback) => {
      for (const [method, input, output] of [
        ["generate", request, script],
        [
          "selectAngle",
          {
            ideaTitle: "Study habit",
            ideaSummary: "Try a phone-free break",
            language: "hi",
            platform: "instagram",
            evidence: [],
          },
          angle,
        ],
        [
          "rankIdeas",
          {
            candidates: [
              {
                id: "one",
                title: "Study",
                summary: "A habit",
                languageId: "hi",
                platformId: "instagram",
                nicheId: "education",
              },
            ],
          },
          { rankedIds: ["one"], reasons: { one: "Useful" } },
        ],
        ["generateIdeas", { count: 5, referenceIdeas: [] }, ideas],
      ] as const) {
        const fetcher = vi.fn<typeof fetch>();
        if (fallback)
          fetcher.mockResolvedValueOnce(new Response("{}", { status: 503 }));
        fetcher.mockResolvedValueOnce(
          response(fallback ? "gemini" : "groq", output),
        );
        const provider = new ApiGeminiGenerationProvider(
          new JsonAiClient(env, fetcher),
        );
        // Each row deliberately exercises its real public parser and prompt.
        const invoke = provider[method].bind(provider) as (
          input: unknown,
        ) => Promise<{ telemetry: { provider: string } }>;
        expect((await invoke(input)).telemetry.provider).toBe(
          fallback ? "gemini" : "groq",
        );
        expect(fetcher).toHaveBeenCalledTimes(fallback ? 2 : 1);
      }
    },
  );

  it("rejects schema-invalid primary script before Gemini fallback in API and worker", async () => {
    for (const worker of [false, true]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response("groq", { ...script, language: "en" }))
        .mockResolvedValueOnce(response("gemini", script));
      const provider = worker
        ? new RoutedTextGenerationProvider(env, fetcher)
        : new ApiGeminiGenerationProvider(new JsonAiClient(env, fetcher));
      const result = await provider.generate(request);
      expect(result.content.language).toBe("hi");
      expect(result.telemetry.provider).toBe("gemini");
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });

  it.each([false, true])(
    "settles script credits once when providers %s",
    async (fail) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
        if (String(url).includes("groq") || fail)
          return new Response("{}", { status: 503 });
        return response("gemini", script);
      });
      const store = new InMemoryGenerationStore();
      store.ideas.set("idea", {
        _id: "idea",
        title: "Study",
        summary: "A practical study habit",
        languageId: "hi",
        platformId: "instagram",
        nicheId: "education",
        topicId: "topic",
      });
      // Worker-shaped text provider leaves deterministic angle selection intact,
      // exercising the existing operation reservation/persistence boundary.
      const provider = new RoutedTextGenerationProvider(env, fetcher);
      const service = new GenerationService(
        store,
        { enqueue: async () => {} },
        provider,
      );
      const op = await service.start("creator", "idea", request, "once");
      await service.process({ operationId: op.operationId });
      await service.process({ operationId: op.operationId });
      const status = await service.getStatus("creator", op.operationId);
      expect(status.status).toBe(fail ? "failed" : "succeeded");
      expect(store.assets.size).toBe(fail ? 0 : 5);
      expect(store.balances.get("creator")).toBe(fail ? 10 : 7);
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
});
