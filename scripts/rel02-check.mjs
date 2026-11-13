import { readFileSync } from "node:fs";

const runbook = readFileSync("docs/engineering/REL-02.md", "utf8");
const backupScript = readFileSync("scripts/backup.mjs", "utf8");
const requiredRunbookSections = [
  "Backup policy",
  "Restore drill",
  "Migration and forward recovery",
  "Queue replay and reconciliation",
  "Retention and deletion",
  "Provider outage",
  "Incident response",
];
const requiredScriptMarkers = [
  "aes-256-gcm",
  "mongodump",
  "mongorestore",
  "redis-cli",
  "sha256",
];
const missingSections = requiredRunbookSections.filter(
  (section) => !runbook.includes(section),
);
const missingScriptMarkers = requiredScriptMarkers.filter(
  (marker) => !backupScript.includes(marker),
);
if (missingSections.length > 0 || missingScriptMarkers.length > 0) {
  throw new Error(
    `REL-02 check failed: ${JSON.stringify({ missingSections, missingScriptMarkers })}`,
  );
}
console.log(
  "REL-02 runbook check passed: encrypted backup, restore, migration, queue, retention and outage procedures are present.",
);
