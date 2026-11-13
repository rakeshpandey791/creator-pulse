import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { detectLanguage } from "@creator-pulse/contracts";
import { evaluateFixture } from "./language-evaluation-core.mjs";

const fixture = JSON.parse(
  readFileSync("evaluation/language-fixtures.v1.json", "utf8"),
);
const report = evaluateFixture(fixture, detectLanguage);
const reportArgumentIndex = process.argv.indexOf("--report");
const reportPath =
  reportArgumentIndex >= 0 ? process.argv[reportArgumentIndex + 1] : null;

if (reportPath) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(
  `Language evaluation: ${JSON.stringify(report.rates)}; contexts=${Object.keys(report.byContext).length}`,
);
if (report.failedThresholds.length) {
  console.error(
    `Language evaluation failed thresholds: ${report.failedThresholds.join(", ")}`,
  );
  process.exit(1);
}
console.log(
  `Language evaluation passed (${fixture.goldenCases.length} golden languages, ${fixture.regressionCases.length} regression cases, ${report.humanReview.requiredReviewers} reviewers per case).`,
);
