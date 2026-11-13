import {
  AiProviderError,
  parseGeneratedContent,
  type GeneratedContent,
  type GenerationRequest,
  type ProviderTelemetry,
  type TextGenerationProvider,
} from "@creator-pulse/contracts";

export type FakeFailureMode =
  | "timeout"
  | "rate_limited"
  | "quota_exhausted"
  | "unavailable"
  | "malformed_json"
  | "partial_output";

export class DeterministicFakeTextGenerationProvider implements TextGenerationProvider {
  readonly name = "fake";

  constructor(private readonly failure?: FakeFailureMode) {}

  async generate(request: GenerationRequest) {
    const startedAt = Date.now();
    if (this.failure) {
      const code =
        this.failure === "malformed_json" ? "malformed_output" : this.failure;
      throw new AiProviderError(
        code,
        `Fake provider failure: ${code}`,
        code === "timeout" || code === "rate_limited" || code === "unavailable",
      );
    }
    const content: GeneratedContent = parseGeneratedContent(
      {
        language: request.language,
        platform: request.platform,
        hooks: [
          "The detail most people miss is this.",
          "Try this before your next post.",
          "Here is the simplest place to begin.",
        ],
        script:
          "Start with the practical problem, show one clear example, and give viewers a small step they can try today. Keep the language natural and focused on the audience.",
        cta: "Save this and try the first step tomorrow.",
        durationSeconds: request.durationSeconds,
        safetyFlags: [],
      },
      request,
    );
    return {
      content,
      telemetry: telemetry(startedAt, "success"),
    };
  }
}

function telemetry(
  startedAt: number,
  outcome: ProviderTelemetry["outcome"],
): ProviderTelemetry {
  return {
    provider: "fake",
    model: "deterministic-v1",
    durationMs: Date.now() - startedAt,
    outcome,
  };
}
