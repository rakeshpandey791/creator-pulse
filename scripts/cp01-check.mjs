import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const decision = readFileSync(
  join(root, "docs/project/CP-01_DECISION.md"),
  "utf8",
);
const requiredIds = [
  "AUTH-01",
  "AUTH-02",
  "AUTH-03",
  "AUTH-04",
  "ONB-01",
  "ONB-02",
  "ONB-03",
  "ONB-04",
  "ONB-05",
  "ONB-06",
  "APP-01",
  "APP-02",
  "APP-03",
  "APP-04",
  "APP-05",
  "APP-06",
  "APP-07",
  "APP-08",
  "APP-09",
  "APP-10",
  "APP-11",
  "APP-12",
  "APP-13",
  "APP-14",
];
const missingIds = requiredIds.filter(
  (id) => !new RegExp(`\\|\\s*${id}\\s*\\|`).test(decision),
);
const requiredTerms = [
  "Fitness",
  "Food",
  "Finance",
  "Education",
  "Entertainment",
  "Lifestyle",
  "Hindi",
  "Hinglish",
  "Bhojpuri",
  "Punjabi",
  "Haryanvi",
  "Telugu",
  "Kannada",
  "UI chrome language",
  "Recovery and failure behavior",
  "Design Owner + Web Owner",
];
const missingTerms = requiredTerms.filter((term) => !decision.includes(term));

if (missingIds.length || missingTerms.length) {
  console.error(
    `CP-01 coverage check failed. Missing IDs: ${missingIds.join(", ") || "none"}. Missing terms: ${missingTerms.join(", ") || "none"}.`,
  );
  process.exit(1);
}

console.log(
  `CP-01 coverage check passed (${requiredIds.length} P0 entries, scope and policy decisions present).`,
);
