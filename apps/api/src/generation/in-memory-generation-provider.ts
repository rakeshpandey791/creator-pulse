import {
  parseGeneratedContent,
  type GroundedAngle,
  type GroundedAngleProvider,
  type GroundedAngleRequest,
  type GenerationRequest,
  type ProviderTelemetry,
  type TextGenerationProvider,
} from "@creator-pulse/contracts";

export class InMemoryGenerationProvider
  implements TextGenerationProvider, GroundedAngleProvider
{
  readonly name = "fake";

  async selectAngle(
    request: GroundedAngleRequest,
  ): Promise<{ angle: GroundedAngle; telemetry: ProviderTelemetry }> {
    const evidence = request.evidence[0];
    return {
      angle: {
        angle: evidence?.summary
          ? `A practical way to apply ${request.ideaTitle} using the latest available signal.`
          : `A simple first step for ${request.ideaTitle}.`,
        rationale: evidence?.summary
          ? "The angle is grounded in the available source evidence."
          : "No local evidence was available, so this uses the creator's topic without claiming a trend.",
        sourceRefs: request.evidence
          .map((item) => item.sourceTitle)
          .filter((title): title is string => Boolean(title)),
        uncertainty: evidence ? "limited" : "unavailable",
      },
      telemetry: {
        provider: this.name,
        model: "deterministic-angle-v1",
        durationMs: 0,
        outcome: "success",
      },
    };
  }

  async generate(request: GenerationRequest) {
    const startedAt = Date.now();
    const idea = extractIdea(request.prompt);
    const content = parseGeneratedContent(
      {
        language: request.language,
        platform: request.platform,
        hooks: [
          `Most creators miss this about ${idea}.`,
          `Try this ${idea} check before your next post.`,
          `If ${idea} feels difficult, start here.`,
        ],
        script: `Here is a practical way to think about ${idea}. Start with one small change, show your viewers how it works, and give them a simple example they can try today. Keep the explanation focused, then remind them why this matters for their routine.`,
        cta: "Save this for tomorrow and try the first step.",
        durationSeconds: request.durationSeconds,
        safetyFlags: [],
      },
      request,
    );
    const telemetry: ProviderTelemetry = {
      provider: this.name,
      model: "deterministic-v1",
      durationMs: Date.now() - startedAt,
      outcome: "success",
    };
    return { content, telemetry };
  }
}

function extractIdea(prompt: string) {
  const match = prompt.match(/<idea>\s*\n?([\s\S]*?)\n?<\/idea>/i);
  return (
    ((match?.[1] ?? "this idea").split("\n")[0] ?? "this idea")
      .trim()
      .slice(0, 100) || "this idea"
  );
}
