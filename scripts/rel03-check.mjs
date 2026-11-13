import { readFileSync } from "node:fs";

const runbook = readFileSync("docs/engineering/REL-03.md", "utf8");
const readiness = readFileSync("scripts/release-readiness.mjs", "utf8");
const requiredSections = [
  "Release evidence matrix",
  "Go/no-go decision",
  "Known limitations",
  "Launch metrics",
  "Support process",
  "Rollback decision",
  "Product-owner sign-off",
];
const requiredMarkers = [
  "QA-01",
  "QA-02",
  "QA-03",
  "QA-04",
  "REL-01",
  "REL-02",
  "SEC-01",
  "no-go",
  "rel03-readiness.json",
];
const missingSections = requiredSections.filter(
  (section) => !runbook.includes(section),
);
const missingMarkers = requiredMarkers.filter(
  (marker) => !readiness.includes(marker),
);
if (missingSections.length > 0 || missingMarkers.length > 0) {
  throw new Error(
    `REL-03 check failed: ${JSON.stringify({ missingSections, missingMarkers })}`,
  );
}
console.log(
  "REL-03 launch-readiness check passed: evidence matrix, decision gate and support/rollback controls are present.",
);
