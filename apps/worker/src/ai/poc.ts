import {
  AiProviderError,
  type GenerationRequest,
  type ProviderErrorCode,
  type ProviderTelemetry,
  type TextGenerationProvider,
} from "@creator-pulse/contracts";
import { buildGenerationPrompt } from "./prompt-builder.js";

export const AI_POC_CASES = [
  {
    id: "hi-fitness",
    language: "hi",
    niche: "fitness",
    platform: "youtube_shorts",
    durationSeconds: 30,
  },
  {
    id: "hi-finance",
    language: "hi",
    niche: "finance",
    platform: "instagram_reels",
    durationSeconds: 45,
  },
  {
    id: "hinglish-comedy",
    language: "hinglish",
    niche: "comedy",
    platform: "youtube_shorts",
    durationSeconds: 60,
  },
  {
    id: "bho-food",
    language: "bho",
    niche: "food",
    platform: "instagram_reels",
    durationSeconds: 30,
  },
  {
    id: "pa-education",
    language: "pa",
    niche: "education",
    platform: "youtube_shorts",
    durationSeconds: 45,
  },
  {
    id: "te-travel",
    language: "te",
    niche: "travel",
    platform: "instagram_reels",
    durationSeconds: 60,
  },
  {
    id: "bgc-wellness",
    language: "bgc",
    niche: "wellness",
    platform: "youtube_shorts",
    durationSeconds: 30,
  },
] as const;

export type AiPocThresholds = {
  maxP95LatencyMs: number;
  maxFailureRate: number;
  minStructuredValidityRate: number;
  maxRetryRate: number;
  maxOutputCharacters: number;
};

export const AI_POC_THRESHOLDS: AiPocThresholds = {
  maxP95LatencyMs: 5_000,
  maxFailureRate: 0.1,
  minStructuredValidityRate: 0.95,
  maxRetryRate: 0.25,
  maxOutputCharacters: 12_000,
};

export type AiPocBudget = {
  maxConcurrency: number;
  perUserRequests: number;
  globalRequests: number;
  maxRetries: number;
  retryDelayMs: number;
};

export const AI_POC_BUDGET: AiPocBudget = {
  maxConcurrency: 2,
  perUserRequests: 10,
  globalRequests: 20,
  maxRetries: 1,
  retryDelayMs: 25,
};

export const AI_FALLBACK_MESSAGE =
  "AI generation is temporarily unavailable. Please try again shortly; no credits were consumed for this attempt.";

export type AiPocRequestContext = {
  userId: string;
  requestId: string;
};

export type AiPocCaseResult = {
  caseId: string;
  success: boolean;
  latencyMs: number;
  outputCharacters: number;
  totalTokens?: number;
  retries: number;
  errorCode?: ProviderErrorCode;
};

export type AiPocReport = {
  provider: string;
  model: string;
  cases: number;
  successes: number;
  failures: number;
  failureRate: number;
  structuredValidityRate: number;
  retryRate: number;
  latencyMs: { p50: number; p95: number; max: number };
  outputCharacters: { min: number; max: number; average: number };
  totalTokens?: number;
  thresholds: AiPocThresholds;
  decision: "go" | "no-go";
  thresholdFailures: string[];
  results: AiPocCaseResult[];
};

export class AiPocRunner {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private globalUsed = 0;
  private readonly userUsed = new Map<string, number>();
  private readonly deduplicated = new Map<string, Promise<AiPocCaseResult>>();

  constructor(
    private readonly provider: TextGenerationProvider,
    private readonly budget: AiPocBudget = AI_POC_BUDGET,
    private readonly sleep: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  run(
    request: GenerationRequest,
    context: AiPocRequestContext,
    caseId: string,
  ): Promise<AiPocCaseResult> {
    const dedupeKey = `${context.userId}:${context.requestId}`;
    const existing = this.deduplicated.get(dedupeKey);
    if (existing) return existing;
    const operation = this.execute(request, context.userId, caseId);
    this.deduplicated.set(dedupeKey, operation);
    return operation;
  }

  private async execute(
    request: GenerationRequest,
    userId: string,
    caseId: string,
  ): Promise<AiPocCaseResult> {
    this.reserve(userId);
    await this.acquire();
    const startedAt = Date.now();
    let retries = 0;
    try {
      while (true) {
        try {
          const result = await this.provider.generate(request);
          const telemetry = result.telemetry;
          return {
            caseId,
            success: true,
            latencyMs: Date.now() - startedAt,
            outputCharacters:
              result.content.hooks.join("\n").length +
              result.content.script.length +
              result.content.cta.length,
            ...(telemetry.totalTokens !== undefined
              ? { totalTokens: telemetry.totalTokens }
              : {}),
            retries,
          };
        } catch (error) {
          const providerError = toProviderError(error);
          if (!providerError.retryable || retries >= this.budget.maxRetries) {
            return {
              caseId,
              success: false,
              latencyMs: Date.now() - startedAt,
              outputCharacters: 0,
              retries,
              errorCode: providerError.code,
            };
          }
          retries += 1;
          await this.sleep(this.budget.retryDelayMs * 2 ** (retries - 1));
        }
      }
    } finally {
      this.release();
    }
  }

  private reserve(userId: string) {
    const userCount = this.userUsed.get(userId) ?? 0;
    if (userCount >= this.budget.perUserRequests)
      throw new AiProviderError(
        "quota_exhausted",
        "AI proof-of-concept user budget exhausted",
        false,
      );
    if (this.globalUsed >= this.budget.globalRequests)
      throw new AiProviderError(
        "quota_exhausted",
        "AI proof-of-concept global budget exhausted",
        false,
      );
    this.userUsed.set(userId, userCount + 1);
    this.globalUsed += 1;
  }

  private acquire() {
    if (this.active < this.budget.maxConcurrency) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve)).then(
      () => {
        this.active += 1;
      },
    );
  }

  private release() {
    this.active -= 1;
    this.waiters.shift()?.();
  }
}

export function buildPocRequest(
  example: (typeof AI_POC_CASES)[number],
): GenerationRequest {
  const requestWithoutPrompt = {
    language: example.language,
    platform: example.platform,
    outputs: ["hooks", "script", "cta"] as const,
    durationSeconds: example.durationSeconds,
    tone: "clear, useful and creator-friendly",
  };
  return {
    ...requestWithoutPrompt,
    prompt: buildGenerationPrompt({
      ...requestWithoutPrompt,
      idea: `Create a ${example.durationSeconds}-second ${example.niche} video idea for a general audience.`,
    }),
  };
}

export function summarizePoc(
  results: readonly AiPocCaseResult[],
  provider: ProviderTelemetry,
  thresholds: AiPocThresholds = AI_POC_THRESHOLDS,
): AiPocReport {
  const latencies = results
    .map((result) => result.latencyMs)
    .sort((a, b) => a - b);
  const outputs = results
    .filter((result) => result.success)
    .map((result) => result.outputCharacters);
  const successes = results.filter((result) => result.success).length;
  const retries = results.filter((result) => result.retries > 0).length;
  const failureRate = results.length
    ? (results.length - successes) / results.length
    : 1;
  const structuredValidityRate = successes / (results.length || 1);
  const retryRate = retries / (results.length || 1);
  const thresholdFailures = [
    ...(percentile(latencies, 0.95) > thresholds.maxP95LatencyMs
      ? ["p95 latency"]
      : []),
    ...(failureRate > thresholds.maxFailureRate ? ["failure rate"] : []),
    ...(structuredValidityRate < thresholds.minStructuredValidityRate
      ? ["structured validity"]
      : []),
    ...(retryRate > thresholds.maxRetryRate ? ["retry rate"] : []),
    ...(outputs.some((length) => length > thresholds.maxOutputCharacters)
      ? ["output length"]
      : []),
  ];
  const tokenValues = results.flatMap((result) =>
    result.totalTokens === undefined ? [] : [result.totalTokens],
  );
  return {
    provider: provider.provider,
    model: provider.model,
    cases: results.length,
    successes,
    failures: results.length - successes,
    failureRate,
    structuredValidityRate,
    retryRate,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(0, ...latencies),
    },
    outputCharacters: {
      min: outputs.length ? Math.min(...outputs) : 0,
      max: Math.max(0, ...outputs),
      average: outputs.length
        ? outputs.reduce((sum, value) => sum + value, 0) / outputs.length
        : 0,
    },
    ...(tokenValues.length
      ? { totalTokens: tokenValues.reduce((sum, value) => sum + value, 0) }
      : {}),
    thresholds,
    decision: thresholdFailures.length ? "no-go" : "go",
    thresholdFailures,
    results: [...results],
  };
}

function percentile(values: readonly number[], percentileValue: number) {
  if (!values.length) return 0;
  return (
    values[
      Math.min(
        values.length - 1,
        Math.ceil(values.length * percentileValue) - 1,
      )
    ] ?? 0
  );
}

function toProviderError(error: unknown) {
  if (error instanceof AiProviderError) return error;
  return new AiProviderError(
    "unavailable",
    "AI proof-of-concept provider failure",
    true,
    {
      cause: error,
    },
  );
}
