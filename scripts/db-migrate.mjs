import { execFileSync } from "node:child_process";

if (process.env.MIGRATION_FIXTURE === "fail") {
  console.error("Deliberate migration failure fixture.");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is required for db:migrate; use npm run test:db for the Docker-backed smoke test.",
  );
}

execFileSync(
  "mongosh",
  [
    process.env.MONGODB_URI,
    "--quiet",
    "--eval",
    'var CP_SCHEMA_PATH="docs/database/SCHEMA.sql"',
    "--file",
    "database/migrations/001_initial_schema.js",
  ],
  { stdio: "inherit" },
);
