import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectLanguage } from "@creator-pulse/contracts";
import { evaluateFixture } from "../scripts/language-evaluation-core.mjs";

type LanguageFixture = {
  version: string;
  targetDurationSeconds: { min: number; max: number };
  thresholds: {
    goldenLanguagePassRate: number;
    durationComplianceRate: number;
    humanReviewPassRate: number;
  };
  goldenCases: Array<{
    language: string;
    output: string;
    detectedLanguage: string;
    expectedScript: string;
    durationSeconds: number;
    safetyFlags: string[];
    unsupportedClaim: boolean;
  }>;
  regressionCases: Array<{
    id: string;
    language: string;
    output: string;
    expectedMixedLanguage?: boolean;
    expectedScriptMismatch?: boolean;
    durationSeconds?: number;
    expectedDurationCompliant?: boolean;
    expectedUnsupportedClaim?: boolean;
    requiredReviewFlag?: string;
  }>;
  humanReview: {
    reviewersRequired: number;
    minimumScore: number;
    scores: Array<{
      caseId: string;
      reviewerId: string;
      scores: Record<string, number>;
    }>;
  };
};

const fixture = JSON.parse(
  readFileSync("evaluation/language-fixtures.v1.json", "utf8"),
) as LanguageFixture;

describe("LANG-02 multilingual evaluation harness", () => {
  it("passes every golden language sample", () => {
    const report = evaluateFixture(fixture, detectLanguage);
    expect(report.failedThresholds).toEqual([]);
    expect(report.rates.goldenLanguagePassRate).toBe(
      fixture.thresholds.goldenLanguagePassRate,
    );
    expect(report.rates.durationComplianceRate).toBe(
      fixture.thresholds.durationComplianceRate,
    );
    expect(report.rates.humanReviewPassRate).toBe(
      fixture.thresholds.humanReviewPassRate,
    );
    expect(Object.keys(report.byContext)).toHaveLength(7);
  });

  it("fails when a configured threshold or review score is not met", () => {
    const thresholdFixture = structuredClone(fixture);
    thresholdFixture.thresholds.goldenLanguagePassRate = 1.01;
    expect(
      evaluateFixture(thresholdFixture, detectLanguage).failedThresholds,
    ).toContain("goldenLanguagePassRate");

    const reviewFixture = structuredClone(fixture);
    reviewFixture.humanReview.scores[0].scores.language_fidelity = 1;
    const report = evaluateFixture(reviewFixture, detectLanguage);
    expect(report.humanReview.passRate).toBeLessThan(1);
    expect(report.humanReview.cases[0].escalated).toBe(true);
    expect(report.failedThresholds).toContain("humanReviewPassRate");
  });

  it("keeps mixed-language, unsupported-claim and duration regressions visible", () => {
    const mixed = fixture.regressionCases.find(
      (sample) => sample.id === "mixed-hinglish-01",
    );
    const unsupported = fixture.regressionCases.find(
      (sample) => sample.id === "unsupported-claim-finance-01",
    );
    const duration = fixture.regressionCases.find(
      (sample) => sample.id === "duration-too-long-01",
    );
    const report = evaluateFixture(fixture, detectLanguage);
    const mixedResult = report.regressionResults.find(
      (sample) => sample.caseId === mixed!.id,
    );
    const unsupportedResult = report.regressionResults.find(
      (sample) => sample.caseId === unsupported!.id,
    );
    const durationResult = report.regressionResults.find(
      (sample) => sample.caseId === duration!.id,
    );
    expect(mixedResult?.mixedLanguagePass).toBe(true);
    expect(mixedResult?.detection.mixedLanguage).toBe(true);
    expect(unsupportedResult?.unsupportedClaimPass).toBe(true);
    expect(unsupportedResult?.reviewFlags).toContain("unsupported_claim");
    expect(durationResult?.durationPass).toBe(true);
    expect(durationResult?.durationCompliant).toBe(false);
  });

  it("requires human review to cover fidelity, naturalness, fit, safety and claims", () => {
    const report = evaluateFixture(fixture, detectLanguage);
    expect(report.humanReview.requiredReviewers).toBe(2);
    expect(report.humanReview.minimumScore).toBeGreaterThanOrEqual(4);
    expect(report.humanReview.cases).toHaveLength(7);
    expect(report.humanReview.cases.every((sample) => sample.passed)).toBe(
      true,
    );
    expect(report.humanReview.cases.every((sample) => !sample.escalated)).toBe(
      true,
    );
  });
});
