import { mkdir, writeFile } from "node:fs/promises";
import {
  AI_POC_BUDGET,
  AI_POC_CASES,
  AI_POC_THRESHOLDS,
  AiPocRunner,
  buildPocRequest,
  summarizePoc,
} from "../apps/worker/dist/ai/poc.js";
import { createTextGenerationProvider } from "../apps/worker/dist/ai/provider.js";
import { InMemoryCreditLedgerService } from "../apps/api/dist/commercial/credit-ledger.service.js";

const provider = createTextGenerationProvider({ AI_PROVIDER: "fake" });
const runner = new AiPocRunner(provider, AI_POC_BUDGET);
const startedAt = performance.now();
const results = await Promise.all(
  AI_POC_CASES.map((example) =>
    runner.run(
      buildPocRequest(example),
      { userId: "qa03-user", requestId: `qa03-${example.id}` },
      example.id,
    ),
  ),
);
const report = summarizePoc(results, {
  provider: provider.name,
  model: "deterministic-v1",
  durationMs: Math.round(performance.now() - startedAt),
  outcome: "success",
});

const ledger = new InMemoryCreditLedgerService();
ledger.balances.set("qa03-user", 3);
const creditAttempts = await Promise.allSettled(
  ["qa03-a", "qa03-b"].map((operationId) =>
    ledger.reserve("qa03-user", operationId, 3),
  ),
);
const fulfilledReservations = creditAttempts.filter(
  (result) => result.status === "fulfilled",
).length;
const costControl = {
  initialCredits: 3,
  operationCost: 3,
  successfulReservations: fulfilledReservations,
  finalBalance: ledger.balances.get("qa03-user") ?? 0,
  noOverspend:
    fulfilledReservations === 1 && ledger.balances.get("qa03-user") === 0,
};

const output = {
  generatedAt: new Date().toISOString(),
  provider: report.provider,
  model: report.model,
  targets: {
    p95LatencyMs: AI_POC_THRESHOLDS.maxP95LatencyMs,
    failureRate: AI_POC_THRESHOLDS.maxFailureRate,
    retryRate: AI_POC_THRESHOLDS.maxRetryRate,
    maxConcurrency: AI_POC_BUDGET.maxConcurrency,
    perUserRequests: AI_POC_BUDGET.perUserRequests,
    globalRequests: AI_POC_BUDGET.globalRequests,
  },
  observed: {
    p95LatencyMs: report.latencyMs.p95,
    failureRate: report.failureRate,
    retryRate: report.retryRate,
    cases: report.cases,
    durationMs: report.latencyMs.max,
  },
  costControl,
  decision:
    report.decision === "go" && costControl.noOverspend ? "go" : "no-go",
  thresholdFailures: [
    ...report.thresholdFailures,
    ...(costControl.noOverspend ? [] : ["credit overspend"]),
  ],
};

await mkdir(".ci-artifacts", { recursive: true });
await writeFile(
  ".ci-artifacts/qa03-baseline.json",
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(`QA-03 baseline: ${JSON.stringify(output)}`);
if (output.decision === "no-go") process.exitCode = 1;
