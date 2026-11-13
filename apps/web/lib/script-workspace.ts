import type {
  GenerationAsset,
  GenerationInput,
  GenerationOperation,
  IdeaDetail,
} from "./api";

export const SCRIPT_DURATION_SECONDS = 45;
export const SCRIPT_CREDIT_COST = 3;
export const SCRIPT_DURATION_OPTIONS = [30, 45, 60, 90] as const;
export const SCRIPT_JOURNEY_STEPS = [
  "Choose an idea",
  "Say what you want to say",
  "Confirm the format",
  "Create the script",
  "Review and save",
] as const;

export function buildScriptGenerationInput(
  idea: IdeaDetail,
  creatorContext?: string,
  creatorBrief?: string,
  durationSeconds = SCRIPT_DURATION_SECONDS,
): GenerationInput {
  const context = [
    creatorContext?.trim() ?? "",
    creatorBrief?.trim()
      ? `What the creator wants to say: ${creatorBrief.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    language: idea.languageId,
    platform: idea.platformId,
    outputs: ["hooks", "script", "cta"],
    durationSeconds,
    tone: "clear, useful and creator-friendly",
    ...(context ? { creatorContext: context } : {}),
  };
}

export function generationPhaseLabel(phase: string | undefined) {
  switch (phase) {
    case "finding_angle":
      return "Finding the angle";
    case "writing_script":
      return "Writing your words";
    case "checking_script":
      return "Checking the script";
    default:
      return "Getting your script ready";
  }
}

export function assetsFor(
  operation: GenerationOperation | null,
  type: GenerationAsset["assetType"],
) {
  return operation?.assets?.filter((asset) => asset.assetType === type) ?? [];
}

export function firstAsset(
  operation: GenerationOperation,
  type: GenerationAsset["assetType"],
) {
  return assetsFor(operation, type)[0];
}

export function shouldApplyGeneratedContent(hasUnsavedEdits: boolean) {
  return !hasUnsavedEdits;
}

export function operationStorageKey(ideaId: string) {
  return `creatorpulse.generation.${ideaId}`;
}

export function draftStorageKey(ideaId: string) {
  return `creatorpulse.script-draft.${ideaId}`;
}
