import type {
  IdeaGenerationProvider,
  IdeaRankingProvider,
  IdeaRankingRequest,
} from "@creator-pulse/contracts";

/** Keeps local development and tests deterministic when Gemini is disabled. */
export class InMemoryIdeaRankingProvider
  implements IdeaRankingProvider, IdeaGenerationProvider
{
  readonly name = "deterministic";

  async rankIdeas(request: IdeaRankingRequest) {
    return {
      result: {
        rankedIds: request.candidates.map((candidate) => candidate.id),
        reasons: {},
      },
      telemetry: {
        provider: this.name,
        model: "deterministic-idea-ranking-v1",
        durationMs: 0,
        outcome: "success" as const,
      },
    };
  }

  async generateIdeas(
    request: Parameters<IdeaGenerationProvider["generateIdeas"]>[0],
  ) {
    const subject = request.query?.trim() || "a practical daily habit";
    return {
      ideas: Array.from({ length: 5 }, (_, index) => ({
        title: `${subject}: simple step ${index + 1}`,
        summary: `A clear, practical way to explain ${subject} with one example viewers can try today.`,
        audienceAngle:
          "Creators who want a useful idea they can record quickly.",
        recommendedAction:
          "Show the first step, then invite viewers to try it today.",
      })),
      telemetry: {
        provider: this.name,
        model: "deterministic-idea-generation-v1",
        durationMs: 0,
        outcome: "success" as const,
      },
    };
  }
}
