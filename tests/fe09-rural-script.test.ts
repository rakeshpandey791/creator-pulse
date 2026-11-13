import { describe, expect, it } from "vitest";
import {
  SCRIPT_DURATION_OPTIONS,
  SCRIPT_JOURNEY_STEPS,
  buildScriptGenerationInput,
  generationPhaseLabel,
} from "../apps/web/lib/script-workspace";
import type { IdeaDetail } from "../apps/web/lib/api";

const idea = {
  id: "idea-1",
  title: "A simple morning stretch",
  summary: "A practical routine for people who sit all day.",
  languageId: "6f4e5c8b-3f7b-4f2a-9b31-000000000001",
  platformId: "7f4e5c8b-3f7b-4f2a-9b31-000000000002",
  nicheId: "5f4e5c8b-3f7b-4f2a-9b31-000000000001",
  score: null,
  coverage: {
    sourceCount: 0,
    signalCount: 0,
    staleSourceCount: 0,
    missingEvidence: true,
    uncertainty: "unavailable" as const,
  },
  topicId: "topic-1",
  origin: "recommended",
  evidence: [],
} satisfies IdeaDetail;

describe("FE-09 rural-first script journey", () => {
  it("keeps the five creator-facing steps and simple duration choices", () => {
    expect(SCRIPT_JOURNEY_STEPS).toHaveLength(5);
    expect(SCRIPT_JOURNEY_STEPS[0]).toBe("Choose an idea");
    expect(SCRIPT_JOURNEY_STEPS[4]).toBe("Review and save");
    expect(SCRIPT_DURATION_OPTIONS).toEqual([30, 45, 60, 90]);
  });

  it("carries the creator message and selected duration into generation", () => {
    const request = buildScriptGenerationInput(
      idea,
      "Audience: busy parents in Bihar",
      "I want to show one stretch people can do before work.",
      60,
    );
    expect(request.durationSeconds).toBe(60);
    expect(request.creatorContext).toContain("What the creator wants to say");
    expect(request.creatorContext).toContain("before work");
    expect(request.language).toBe(idea.languageId);
    expect(request.platform).toBe(idea.platformId);
  });

  it("uses plain-language generation phases", () => {
    expect(generationPhaseLabel("finding_angle")).toBe("Finding the angle");
    expect(generationPhaseLabel("writing_script")).toBe("Writing your words");
    expect(generationPhaseLabel("checking_script")).toBe("Checking the script");
  });
});
