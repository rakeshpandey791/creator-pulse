import { Queue } from "bullmq";
import type { GenerationJob, GenerationQueue } from "./generation.service.js";

export const GENERATION_QUEUE_NAME = "content-generation";

export class BullMqGenerationQueue implements GenerationQueue {
  private readonly queue: Queue<GenerationJob>;

  constructor(redisUrl: string) {
    this.queue = new Queue(GENERATION_QUEUE_NAME, {
      connection: redisConnection(redisUrl),
    });
  }

  async enqueue(job: GenerationJob) {
    await this.queue.add("generate", job, {
      jobId: job.operationId,
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
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
