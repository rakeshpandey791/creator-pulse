import { describe, expect, it } from "vitest";
import { emptyDraft, validateStep } from "../apps/web/lib/onboarding";

describe("FE-01 onboarding validation", () => {
  it("requires a selection at each taxonomy step", () => {
    expect(validateStep(1, emptyDraft)).toContain("niche");
    expect(validateStep(2, emptyDraft)).toContain("platform");
    expect(validateStep(3, emptyDraft)).toContain("language");
  });

  it("requires audience context before saving", () => {
    expect(validateStep(4, emptyDraft)).toContain("Tell us");
    expect(
      validateStep(4, {
        ...emptyDraft,
        audience: "New creators learning practical fitness",
      }),
    ).toBeNull();
  });
});
