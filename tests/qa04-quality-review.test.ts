import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectLanguage, evaluateSafety } from "@creator-pulse/contracts";
import { evaluateFixture } from "../scripts/language-evaluation-core.mjs";

const fixture = JSON.parse(
  readFileSync("evaluation/language-fixtures.v1.json", "utf8"),
);

describe("QA-04 multilingual and AI quality review", () => {
  it("evaluates every launch language and representative context", () => {
    const report = evaluateFixture(fixture, detectLanguage);
    expect(report.failedThresholds).toEqual([]);
    expect(Object.keys(report.byContext)).toHaveLength(7);
    expect(report.byContext).toMatchObject({
      "hi/fitness/youtube_shorts": { humanReviewPassRate: 1 },
      "te/lifestyle/facebook_reels": { languagePassRate: 1 },
    });
  });

  it("keeps unsafe and unsupported content from passing as clean output", () => {
    const review = evaluateSafety({
      niche: "finance",
      text: "This investment guarantees 100% profit and is risk-free.",
    });
    const reject = evaluateSafety({
      niche: "fitness",
      text: "Stop breathing during the exercise for better results.",
    });
    expect(review.decision).toBe("review");
    expect(review.flags).toContain("requires_human_review");
    expect(reject.decision).toBe("reject");
    expect(reject.flags).toContain("unsafe_instruction");
    expect(review.report).not.toHaveProperty("text");
    expect(reject.report).not.toHaveProperty("text");
  });

  it("requires complete human review coverage with no escalations", () => {
    const report = evaluateFixture(fixture, detectLanguage);
    expect(report.humanReview.requiredReviewers).toBe(2);
    expect(report.humanReview.cases).toHaveLength(7);
    expect(
      report.humanReview.cases.every((item) => item.reviewerCount === 2),
    ).toBe(true);
    expect(
      report.humanReview.cases.every((item) => item.passed && !item.escalated),
    ).toBe(true);
  });
});
