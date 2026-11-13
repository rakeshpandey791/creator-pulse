import { Worker, type Job } from "bullmq";
import { GENERATION_QUEUE_NAME } from "./queue-name.js";
import { MetricsRegistry, StructuredLogger } from "@creator-pulse/contracts";

const logger = new StructuredLogger("worker.generation");
const metrics = new MetricsRegistry();

export function createGenerationWorker(
  redisUrl: string,
  apiUrl: string,
  workerSecret: string,
  concurrency = Number(process.env.GENERATION_WORKER_CONCURRENCY ?? 2),
) {
  return new Worker(
    GENERATION_QUEUE_NAME,
    async (job: Job<{ operationId: string; requestId?: string }>) => {
      const startedAt = Date.now();
      metrics.increment("generation_jobs_total", { state: "started" });
      logger.info("generation.job.forwarding", {
        jobId: job.id ?? "unknown",
        operationId: job.data.operationId,
        attempt: job.attemptsMade + 1,
      });
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/v1/internal/generation/jobs/${encodeURIComponent(job.data.operationId)}`,
        {
          method: "POST",
          headers: {
            "x-generation-worker-secret": workerSecret,
            "x-request-id": job.data.requestId ?? job.id ?? "worker-job",
          },
        },
      );
      if (!response.ok) {
        metrics.increment("generation_jobs_total", { state: "failed" });
        logger.warn("generation.job.failed", {
          jobId: job.id ?? "unknown",
          operationId: job.data.operationId,
          status: response.status,
          durationMs: Date.now() - startedAt,
        });
        throw new Error("Generation API job execution failed");
      }
      metrics.increment("generation_jobs_total", { state: "completed" });
      logger.info("generation.job.completed", {
        jobId: job.id ?? "unknown",
        operationId: job.data.operationId,
        durationMs: Date.now() - startedAt,
      });
    },
    {
      connection: redisConnection(redisUrl),
      concurrency,
    },
  );
}

function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.pathname.length > 1 ? { db: Number(url.pathname.slice(1)) } : {}),
  };
}
