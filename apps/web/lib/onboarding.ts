export type OnboardingDraft = {
  nicheIds: string[];
  platformIds: string[];
  languageIds: string[];
  audience: string;
  contentStyle: string;
  creatorGoal: string;
};

export const emptyDraft: OnboardingDraft = {
  nicheIds: [],
  platformIds: [],
  languageIds: [],
  audience: "",
  contentStyle: "",
  creatorGoal: "",
};

export function validateStep(
  step: number,
  draft: OnboardingDraft,
): string | null {
  if (step === 1 && draft.nicheIds.length === 0)
    return "Choose at least one niche to continue.";
  if (step === 2 && draft.platformIds.length === 0)
    return "Choose at least one platform to continue.";
  if (step === 3 && draft.languageIds.length === 0)
    return "Choose at least one language to continue.";
  if (step === 4 && !draft.audience.trim())
    return "Tell us who you create for so recommendations feel relevant.";
  return null;
}

const KEY = "creatorpulse.onboardingDraft";
export function saveDraft(draft: OnboardingDraft) {
  if (typeof window !== "undefined")
    sessionStorage.setItem(KEY, JSON.stringify(draft));
}
export function loadDraft(): OnboardingDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    return {
      ...emptyDraft,
      ...JSON.parse(sessionStorage.getItem(KEY) ?? "{}"),
    };
  } catch {
    return emptyDraft;
  }
}
