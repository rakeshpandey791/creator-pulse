import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  console.log("Git hooks configured at .githooks.");
} catch {
  console.log("Git metadata is unavailable; skip local hook installation.");
}
