import { mkdir, writeFile } from "node:fs/promises";
import {
  AI_POC_BUDGET,
  AI_POC_CASES,
  AiPocRunner,
  buildPocRequest,
  summarizePoc,
} from "../apps/worker/dist/ai/poc.js";
import { createTextGenerationProvider } from "../apps/worker/dist/ai/provider.js";

const provider = createTextGenerationProvider();
const runner = new AiPocRunner(provider, AI_POC_BUDGET);
const results = await Promise.all(
  AI_POC_CASES.map((example) =>
    runner.run(
      buildPocRequest(example),
      {
        userId: process.env.AI_POC_USER_ID ?? "ai-poc-user",
        requestId: `ai-poc-${example.id}`,
      },
      example.id,
    ),
  ),
);
const report = summarizePoc(results, {
  provider: provider.name,
  model:
    process.env.GEMINI_MODEL ??
    (provider.name === "fake" ? "deterministic-v1" : "configured"),
  durationMs: 0,
  outcome: "success",
});
const path = ".ci-artifacts/ai-poc.json";
await mkdir(".ci-artifacts", { recursive: true });
await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `AI proof of concept: ${JSON.stringify({
    provider: report.provider,
    cases: report.cases,
    p95LatencyMs: report.latencyMs.p95,
    failureRate: report.failureRate,
    structuredValidityRate: report.structuredValidityRate,
    decision: report.decision,
  })}`,
);
if (report.decision === "no-go") {
  console.error(
    `AI proof of concept failed thresholds: ${report.thresholdFailures.join(", ")}`,
  );
  process.exitCode = 1;
}
