import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const taskText = readFileSync("docs/project/TASK.md", "utf8");
const taskRows = new Map();
for (const line of taskText.split("\n")) {
  if (!line.startsWith("|") || line.split("|")[3]?.trim() === "Task ID")
    continue;
  const fields = line.split("|").map((field) => field.trim());
  if (fields[3]) {
    taskRows.set(fields[3], {
      priority: fields[5],
      status: fields[8],
      review: fields[11],
      qa: fields[12],
    });
  }
}

const requiredEvidence = [
  { id: "QA-01", label: "unit/integration/contract evidence" },
  { id: "QA-02", label: "journey/accessibility/UI regression evidence" },
  { id: "QA-03", label: "performance/resilience/cost evidence" },
  { id: "QA-04", label: "multilingual/AI quality evidence" },
  { id: "REL-01", label: "container deployment evidence" },
  { id: "REL-02", label: "backup/restore evidence" },
];
const blockers = [];

for (const evidence of requiredEvidence) {
  const task = taskRows.get(evidence.id);
  if (!task || task.status !== "IMPLEMENTATION_COMPLETE") {
    blockers.push(`${evidence.id}: implementation is not complete`);
  }
  if (!task || task.review !== "APPROVED") {
    blockers.push(`${evidence.id}: independent review is not approved`);
  }
  if (!task || task.qa !== "QA_PASSED") {
    blockers.push(`${evidence.id}: QA evidence is not marked QA_PASSED`);
  }
}

const security = taskRows.get("SEC-01");
if (!security || security.status !== "IMPLEMENTATION_COMPLETE") {
  blockers.push(
    "SEC-01: authorization, rate-limit and privacy controls are not complete",
  );
}

const report = {
  reportVersion: "rel-03-v1",
  reviewedAt: new Date().toISOString(),
  candidate: process.env.RELEASE_CANDIDATE ?? "working-tree",
  criteria: {
    requiredEvidence: requiredEvidence.map(({ id, label }) => ({
      id,
      label,
      ...taskRows.get(id),
    })),
    security: { id: "SEC-01", ...security },
    noUnacceptedP0P1Defects:
      blockers.filter((blocker) => blocker.includes("not complete")).length ===
      0,
  },
  decision: blockers.length === 0 ? "go" : "no-go",
  blockers,
  knownLimitations: [
    "Direct publishing is intentionally excluded from the MVP.",
    "Trend and provider coverage depends on permitted free sources and may show partial-data states.",
    "Final product-owner and engineering-lead sign-off is required before launch.",
  ],
};

mkdirSync(".ci-artifacts", { recursive: true });
writeFileSync(
  ".ci-artifacts/rel03-readiness.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `REL-03 launch readiness: ${JSON.stringify({
    decision: report.decision,
    blockerCount: blockers.length,
    report: ".ci-artifacts/rel03-readiness.json",
  })}`,
);
if (report.decision === "no-go") process.exitCode = 1;
