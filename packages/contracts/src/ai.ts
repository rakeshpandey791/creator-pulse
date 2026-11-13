import { normalizeLanguageId } from "./language.js";

export const GENERATION_OUTPUTS = ["hooks", "script", "cta"] as const;
export type GenerationOutputType = (typeof GENERATION_OUTPUTS)[number];

export type GenerationRequest = {
  prompt: string;
  language: string;
  platform: string;
  outputs: readonly GenerationOutputType[];
  durationSeconds: number;
  tone: string;
  creatorContext?: string;
  groundedAngle?: string;
};

export type GroundedAngleRequest = {
  ideaTitle: string;
  ideaSummary: string;
  language: string;
  platform: string;
  creatorContext?: string;
  evidence: readonly {
    summary: string;
    sourceTitle?: string;
    limitations?: string;
  }[];
};

export type GroundedAngle = {
  angle: string;
  rationale: string;
  sourceRefs: string[];
  uncertainty: "none" | "limited" | "unavailable";
};

export type IdeaRankingCandidate = {
  id: string;
  title: string;
  summary: string;
  languageId: string;
  platformId: string;
  nicheId: string;
};

export type IdeaRankingRequest = {
  query?: string;
  languageId?: string;
  platformId?: string;
  nicheId?: string;
  candidates: readonly IdeaRankingCandidate[];
};

export type IdeaRankingResult = {
  rankedIds: string[];
  reasons: Record<string, string>;
};

export interface IdeaRankingProvider {
  readonly name: string;
  rankIdeas(request: IdeaRankingRequest): Promise<{
    result: IdeaRankingResult;
    telemetry: ProviderTelemetry;
  }>;
}

export type IdeaGenerationRequest = {
  query?: string;
  languageId?: string;
  platformId?: string;
  nicheId?: string;
  count: number;
  creatorContext?: string;
  referenceIdeas: readonly IdeaRankingCandidate[];
};

export type GeneratedIdeaSuggestion = {
  title: string;
  summary: string;
  audienceAngle: string;
  recommendedAction: string;
};

export interface IdeaGenerationProvider {
  readonly name: string;
  generateIdeas(request: IdeaGenerationRequest): Promise<{
    ideas: GeneratedIdeaSuggestion[];
    telemetry: ProviderTelemetry;
  }>;
}

export interface GroundedAngleProvider {
  selectAngle(
    request: GroundedAngleRequest,
  ): Promise<{ angle: GroundedAngle; telemetry: ProviderTelemetry }>;
}

export type GeneratedContent = {
  language: string;
  platform: string;
  hooks: string[];
  script: string;
  cta: string;
  durationSeconds: number;
  safetyFlags: string[];
};

export type ProviderTelemetry = {
  provider: string;
  model: string;
  durationMs: number;
  outcome: "success" | "failure";
  errorCode?: ProviderErrorCode;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  fallbackFrom?: string;
  fallbackReason?: ProviderErrorCode;
};

export type ProviderErrorCode =
  | "timeout"
  | "rate_limited"
  | "quota_exhausted"
  | "unavailable"
  | "malformed_output"
  | "partial_output"
  | "invalid_request";

export class AiProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiProviderError";
  }
}

export interface TextGenerationProvider {
  readonly name: string;
  generate(
    request: GenerationRequest,
  ): Promise<{ content: GeneratedContent; telemetry: ProviderTelemetry }>;
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(input: string): Promise<{
    vector: number[];
    telemetry: ProviderTelemetry;
  }>;
}

export interface ModerationOrSafetyProvider {
  readonly name: string;
  check(input: string): Promise<{
    allowed: boolean;
    flags: string[];
    telemetry: ProviderTelemetry;
  }>;
}

export interface LanguageQualityProvider {
  readonly name: string;
  check(input: { text: string; expectedLanguage: string }): Promise<{
    detectedLanguage: string;
    mixedLanguage: boolean;
    scriptMismatch: boolean;
    telemetry: ProviderTelemetry;
  }>;
}

export class GenerationSchemaError extends Error {
  constructor(
    public readonly issue: "malformed" | "partial",
    message: string,
  ) {
    super(message);
    this.name = "GenerationSchemaError";
  }
}

export function parseGeneratedContent(
  value: unknown,
  expected: Pick<GenerationRequest, "language" | "platform">,
): GeneratedContent {
  let candidate: unknown = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new GenerationSchemaError(
        "malformed",
        "Provider output is not valid JSON",
      );
    }
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    throw new GenerationSchemaError(
      "malformed",
      "Provider output must be a JSON object",
    );
  const record = candidate as Record<string, unknown>;
  const required = [
    "language",
    "platform",
    "hooks",
    "script",
    "cta",
    "durationSeconds",
  ];
  const missing = required.filter((key) => !(key in record));
  if (missing.length)
    throw new GenerationSchemaError(
      "partial",
      `Provider output is missing: ${missing.join(", ")}`,
    );
  const durationValue = record.durationSeconds;
  if (
    typeof record.language !== "string" ||
    typeof record.platform !== "string" ||
    !Array.isArray(record.hooks) ||
    record.hooks.length === 0 ||
    record.hooks.length > 5 ||
    record.hooks.some((hook) => typeof hook !== "string" || !hook.trim()) ||
    typeof record.script !== "string" ||
    !record.script.trim() ||
    typeof record.cta !== "string" ||
    !record.cta.trim() ||
    !Number.isInteger(durationValue) ||
    (durationValue as number) < 1 ||
    (durationValue as number) > 180
  )
    throw new GenerationSchemaError(
      "malformed",
      "Provider output failed the generation schema",
    );
  const durationSeconds = durationValue as number;
  let language: string;
  try {
    language = normalizeLanguageId(record.language);
  } catch {
    throw new GenerationSchemaError(
      "malformed",
      "Provider output has an unsupported language",
    );
  }
  const expectedLanguage = normalizeLanguageId(expected.language);
  if (language !== expectedLanguage || record.platform !== expected.platform)
    throw new GenerationSchemaError(
      "malformed",
      "Provider output context does not match the request",
    );
  const safetyFlags = record.safetyFlags;
  if (
    safetyFlags !== undefined &&
    (!Array.isArray(safetyFlags) ||
      safetyFlags.some((flag) => typeof flag !== "string"))
  )
    throw new GenerationSchemaError(
      "malformed",
      "Provider safety flags must be strings",
    );
  return {
    language,
    platform: record.platform,
    hooks: record.hooks as string[],
    script: record.script as string,
    cta: record.cta as string,
    durationSeconds,
    safetyFlags: (safetyFlags as string[] | undefined) ?? [],
  };
}
