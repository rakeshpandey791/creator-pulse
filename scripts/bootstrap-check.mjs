import { existsSync } from "node:fs";
import { join } from "node:path";

const required = [
  "apps/web/app/page.tsx",
  "apps/api/src/main.ts",
  "apps/worker/src/main.ts",
  "packages/contracts/src/index.ts",
  ".env.example",
  "CONTRIBUTING.md",
];

const missing = required.filter(
  (file) => !existsSync(join(process.cwd(), file)),
);
if (missing.length > 0) {
  console.error(`Bootstrap check failed; missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Bootstrap check passed (${required.length} foundation paths).`);
