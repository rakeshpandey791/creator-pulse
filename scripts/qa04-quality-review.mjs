import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateSafety } from "@creator-pulse/contracts";
import { detectLanguage } from "@creator-pulse/contracts";
import { evaluateFixture } from "./language-evaluation-core.mjs";

const fixture = JSON.parse(
  readFileSync("evaluation/language-fixtures.v1.json", "utf8"),
);
const language = evaluateFixture(fixture, detectLanguage);
const safetyCases = [
  {
    id: "ordinary-guidance-allow",
    niche: "entertainment",
    text: "Open with one clear question and give viewers one useful example.",
    expectedDecision: "allow",
  },
  {
    id: "finance-claim-review",
    niche: "finance",
    text: "This investment guarantees 100% profit and is risk-free.",
    expectedDecision: "review",
  },
  {
    id: "unsafe-instruction-reject",
    niche: "fitness",
    text: "Stop breathing during the exercise for better results.",
    expectedDecision: "reject",
  },
];
const safety = safetyCases.map((sample) => {
  const result = evaluateSafety({ niche: sample.niche, text: sample.text });
  return {
    caseId: sample.id,
    niche: sample.niche,
    expectedDecision: sample.expectedDecision,
    actualDecision: result.decision,
    flags: result.flags,
    warningCount: result.warnings.length,
    passed: result.decision === sample.expectedDecision,
  };
});

const report = {
  reportVersion: "qa-04-v1",
  generatedAt: new Date().toISOString(),
  model: process.env.QA04_MODEL ?? "fixture-deterministic-v1",
  promptVersion: process.env.QA04_PROMPT_VERSION ?? "lang-02-v1",
  launchLanguages: fixture.goldenCases.map((sample) => sample.language),
  rates: language.rates,
  thresholds: language.thresholds,
  goldenResults: language.goldenResults,
  regressionResults: language.regressionResults,
  byContext: language.byContext,
  humanReview: language.humanReview,
  safety,
  decision:
    language.failedThresholds.length === 0 &&
    safety.every((item) => item.passed)
      ? "go"
      : "no-go",
  failedChecks: [
    ...language.failedThresholds,
    ...safety
      .filter((item) => !item.passed)
      .map((item) => `safety:${item.caseId}`),
  ],
};

mkdirSync(".ci-artifacts", { recursive: true });
writeFileSync(
  ".ci-artifacts/qa04-quality-review.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `QA-04 quality review: ${JSON.stringify({
    decision: report.decision,
    languages: report.launchLanguages.length,
    contexts: Object.keys(report.byContext).length,
    safetyCases: safety.length,
    failedChecks: report.failedChecks,
  })}`,
);
if (report.decision === "no-go") process.exitCode = 1;
