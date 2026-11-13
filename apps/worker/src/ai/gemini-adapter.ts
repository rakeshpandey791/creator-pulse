import {
  AiProviderError,
  GenerationSchemaError,
  parseGeneratedContent,
  type GenerationRequest,
  type ProviderErrorCode,
  type ProviderTelemetry,
  type TextGenerationProvider,
} from "@creator-pulse/contracts";

export type GeminiTextGenerationOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  onTelemetry?: (telemetry: ProviderTelemetry) => void;
};

export class GeminiTextGenerationProvider implements TextGenerationProvider {
  readonly name = "gemini";
  private readonly model: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GeminiTextGenerationOptions = {}) {
    this.model = options.model ?? "gemini-3.5-flash";
    this.endpoint =
      options.endpoint ??
      "https://generativelanguage.googleapis.com/v1beta/models";
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(request: GenerationRequest) {
    if (!this.options.apiKey)
      throw new AiProviderError(
        "unavailable",
        "Gemini provider is not configured",
        false,
      );
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `${this.endpoint}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.options.apiKey)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: request.prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: 4_000,
              ...(this.model.startsWith("gemini-3")
                ? { thinkingConfig: { thinkingLevel: "LOW" } }
                : {}),
            },
          }),
        },
      );
      if (!response.ok) throw providerError(response.status);
      const payload = (await response.json()) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text)
        throw new AiProviderError(
          "partial_output",
          "Gemini returned no content",
          false,
        );
      const content = parseGeneratedContent(text, request);
      const telemetry = this.telemetry(
        startedAt,
        "success",
        undefined,
        payload.usageMetadata,
      );
      this.options.onTelemetry?.(telemetry);
      return { content, telemetry };
    } catch (error) {
      const normalized =
        error instanceof AiProviderError
          ? error
          : error instanceof Error && error.name === "AbortError"
            ? new AiProviderError("timeout", "Gemini request timed out", true)
            : error instanceof GenerationSchemaError
              ? new AiProviderError(
                  error.issue === "partial"
                    ? "partial_output"
                    : "malformed_output",
                  "Gemini returned invalid structured output",
                  false,
                )
              : new AiProviderError(
                  "unavailable",
                  "Gemini request failed",
                  true,
                  {
                    cause: error,
                  },
                );
      const telemetry = this.telemetry(startedAt, "failure", normalized.code);
      this.options.onTelemetry?.(telemetry);
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  private telemetry(
    startedAt: number,
    outcome: ProviderTelemetry["outcome"],
    errorCode?: ProviderErrorCode,
    usage?: GeminiResponse["usageMetadata"],
  ): ProviderTelemetry {
    return {
      provider: this.name,
      model: this.model,
      durationMs: Date.now() - startedAt,
      outcome,
      ...(errorCode ? { errorCode } : {}),
      ...(usage?.promptTokenCount !== undefined
        ? { inputTokens: usage.promptTokenCount }
        : {}),
      ...(usage?.candidatesTokenCount !== undefined
        ? { outputTokens: usage.candidatesTokenCount }
        : {}),
      ...(usage?.totalTokenCount !== undefined
        ? { totalTokens: usage.totalTokenCount }
        : {}),
    };
  }
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function providerError(status: number) {
  if (status === 429)
    return new AiProviderError(
      "rate_limited",
      "Gemini rate limit reached",
      true,
    );
  if (status === 403)
    return new AiProviderError(
      "quota_exhausted",
      "Gemini quota is unavailable",
      false,
    );
  if (status >= 500)
    return new AiProviderError(
      "unavailable",
      "Gemini is temporarily unavailable",
      true,
    );
  return new AiProviderError(
    "invalid_request",
    "Gemini rejected the request",
    false,
  );
}
