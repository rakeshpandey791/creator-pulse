import {
  Queue,
  Worker,
  type Job,
  type QueueOptions,
  type WorkerOptions,
} from "bullmq";
import type {
  IngestionJob,
  IngestionResult,
  IngestionRunner,
} from "./ingestion.js";
import { MetricsRegistry, StructuredLogger } from "@creator-pulse/contracts";

const logger = new StructuredLogger("worker.research");
const metrics = new MetricsRegistry();

export const RESEARCH_QUEUE = "research-ingestion";
export const DAILY_INGESTION_SCHEDULE = "daily-research-ingestion";

export type ResearchQueuePayload = IngestionJob & { kind: "ingest" };

export function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.pathname.length > 1 ? { db: Number(url.pathname.slice(1)) } : {}),
  };
}

export function createResearchQueue(redisUrl: string) {
  const options: QueueOptions = { connection: redisConnection(redisUrl) };
  return new Queue<ResearchQueuePayload>(RESEARCH_QUEUE, options);
}

export async function scheduleDailyIngestion(
  queue: Queue<ResearchQueuePayload>,
  everyMs = 24 * 60 * 60 * 1000,
) {
  await queue.upsertJobScheduler(
    DAILY_INGESTION_SCHEDULE,
    { every: everyMs },
    {
      name: "scheduled-research-ingestion",
      data: { kind: "ingest", jobId: `scheduled:${DAILY_INGESTION_SCHEDULE}` },
      opts: { removeOnComplete: 100, removeOnFail: 100 },
    },
  );
}

export function createResearchWorker(
  redisUrl: string,
  runner: IngestionRunner,
  options: Omit<WorkerOptions, "connection"> = {},
) {
  return new Worker<ResearchQueuePayload, IngestionResult>(
    RESEARCH_QUEUE,
    async (job: Job<ResearchQueuePayload>) => {
      const startedAt = Date.now();
      metrics.increment("research_jobs_total", { state: "started" });
      logger.info("research.job.started", {
        jobId: job.id ?? "unknown",
        operationId: job.data.jobId,
      });
      try {
        const result = await runner.run(job.data);
        metrics.increment("research_jobs_total", { state: "completed" });
        logger.info("research.job.completed", {
          jobId: job.id ?? "unknown",
          operationId: job.data.jobId,
          durationMs: Date.now() - startedAt,
          sourceCount: result.sources.length,
          signalCount: result.sources.reduce(
            (total, source) => total + source.signalCount,
            0,
          ),
        });
        return result;
      } catch (error) {
        metrics.increment("research_jobs_total", { state: "failed" });
        logger.warn("research.job.failed", {
          jobId: job.id ?? "unknown",
          operationId: job.data.jobId,
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof Error ? error.name : "unknown",
        });
        throw error;
      }
    },
    {
      ...options,
      connection: redisConnection(redisUrl),
      concurrency:
        options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? 1),
      limiter: options.limiter ?? { max: 1, duration: 1000 },
    },
  );
}
