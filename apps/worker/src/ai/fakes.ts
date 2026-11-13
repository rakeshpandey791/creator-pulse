import {
  detectLanguage,
  evaluateSafety,
  type EmbeddingProvider,
  type LanguageQualityProvider,
  type ModerationOrSafetyProvider,
  type ProviderTelemetry,
} from "@creator-pulse/contracts";

export class DeterministicFakeEmbeddingProvider implements EmbeddingProvider {
  readonly name = "fake-embedding";

  async embed(input: string) {
    const startedAt = Date.now();
    const vector = Array.from({ length: 8 }, (_, index) => {
      let hash = 17 + index;
      for (const character of input)
        hash = (hash * 31 + character.charCodeAt(0)) % 10_007;
      return Number((hash / 10_007).toFixed(6));
    });
    return {
      vector,
      telemetry: telemetry(this.name, "deterministic-v1", startedAt),
    };
  }
}

export class DeterministicFakeSafetyProvider implements ModerationOrSafetyProvider {
  readonly name = "fake-safety";

  async check(input: string) {
    const startedAt = Date.now();
    const result = evaluateSafety({ text: input, niche: "general" });
    return {
      allowed: result.decision !== "reject" && result.decision !== "review",
      flags: [...result.flags],
      telemetry: telemetry(this.name, "deterministic-v1", startedAt),
    };
  }
}

export class DeterministicFakeLanguageQualityProvider implements LanguageQualityProvider {
  readonly name = "fake-language-quality";

  async check(input: { text: string; expectedLanguage: string }) {
    const startedAt = Date.now();
    const result = detectLanguage(input.text, input.expectedLanguage);
    return {
      detectedLanguage: result.language,
      mixedLanguage: result.mixedLanguage,
      scriptMismatch: result.scriptMismatch,
      telemetry: telemetry(this.name, "deterministic-v1", startedAt),
    };
  }
}

function telemetry(
  provider: string,
  model: string,
  startedAt: number,
): ProviderTelemetry {
  return {
    provider,
    model,
    durationMs: Date.now() - startedAt,
    outcome: "success",
  };
}
