import { execFileSync } from "node:child_process";

const compose = ["compose"];
const databaseUri = "mongodb://127.0.0.1:27017/creatorpulse";

function run(args) {
  execFileSync("docker", [...compose, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

function runMongo(file, extra = []) {
  run([
    "exec",
    "-T",
    "mongodb",
    "mongosh",
    databaseUri,
    ...extra,
    "--file",
    file,
  ]);
}

function waitForMongo() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      execFileSync(
        "docker",
        [
          ...compose,
          "exec",
          "-T",
          "mongodb",
          "mongosh",
          databaseUri,
          "--quiet",
          "--eval",
          "db.runCommand({ ping: 1 }).ok",
        ],
        { cwd: process.cwd(), stdio: "ignore" },
      );
      return;
    } catch {
      execFileSync("sleep", ["1"]);
    }
  }
  throw new Error("MongoDB did not become ready within 30 seconds.");
}

run(["up", "-d", "mongodb"]);
try {
  waitForMongo();
  runMongo("/opt/database/migrations/001_initial_schema.js", [
    "--eval",
    'var CP_SCHEMA_PATH="/opt/docs/database/SCHEMA.sql"',
  ]);
  runMongo("/opt/database/migrations/001_initial_schema.js", [
    "--eval",
    'var CP_SCHEMA_PATH="/opt/docs/database/SCHEMA.sql"',
  ]);
  runMongo("/opt/database/seeds/001_reference_data.js");
  runMongo("/opt/database/seeds/001_reference_data.js");
  runMongo("/opt/database/tests/001_integrity.js");
  console.log("DB-01 live smoke check passed.");
} finally {
  run(["down", "-v"]);
}
