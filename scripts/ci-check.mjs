import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const required = [
  "Quality and tests",
  "Security and secrets",
  "Compose and migration validation",
  "npm run check",
  "npm run build",
  "npm run test:language-eval",
  "npm run check:secrets",
  "npm audit --omit=dev --audit-level=critical",
  "docker compose config --quiet",
  "docker compose build",
  "Container release smoke",
  "npm run test:release",
  "npm run test:rel02",
  "npm run test:rel03",
  "docker-compose.staging.yml",
  "actions/upload-artifact@v4",
  "if: always()",
];
const missing = required.filter((value) => !workflow.includes(value));

if (missing.length > 0) {
  console.error(
    `CI configuration check failed. Missing: ${missing.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  "CI configuration check passed: required quality, security and Compose gates are configured.",
);
