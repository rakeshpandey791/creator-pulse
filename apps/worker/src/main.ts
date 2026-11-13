import { unlinkSync, writeFileSync } from "node:fs";
import {
  connectMongoStore,
  IngestionRunner,
  InMemoryIngestionStore,
} from "./research/ingestion.js";
import {
  createResearchQueue,
  createResearchWorker,
  scheduleDailyIngestion,
} from "./research/queue.js";
import { RssSourceAdapter } from "./research/rss-adapter.js";
import { createGenerationWorker } from "./generation/queue.js";
import { StructuredLogger } from "@creator-pulse/contracts";

const workerLogger = new StructuredLogger("worker");

const port = Number(process.env.WORKER_PORT ?? 3002);
const readyFile = "/tmp/creator-pulse-worker-ready";
const mongoConnection = process.env.MONGODB_URI
  ? await connectMongoStore(
      process.env.MONGODB_URI,
      process.env.MONGODB_DB ?? "creatorpulse",
    )
  : undefined;
const store = mongoConnection?.store ?? new InMemoryIngestionStore();
const rssUrl = process.env.RESEARCH_RSS_URL;
const adapters = rssUrl
  ? [
      new RssSourceAdapter("Configured RSS", rssUrl, {
        permittedUse: process.env.RESEARCH_SOURCE_TERMS_REVIEWED === "true",
        licenseNote: process.env.RESEARCH_SOURCE_LICENSE_NOTE ?? "",
      }),
    ]
  : [];
const runner = new IngestionRunner(store, adapters);
const redisUrl = process.env.REDIS_URL;
const queue = redisUrl ? createResearchQueue(redisUrl) : undefined;
const worker = redisUrl ? createResearchWorker(redisUrl, runner) : undefined;
const generationWorker =
  redisUrl &&
  process.env.GENERATION_API_URL &&
  process.env.GENERATION_WORKER_SECRET
    ? createGenerationWorker(
        redisUrl,
        process.env.GENERATION_API_URL,
        process.env.GENERATION_WORKER_SECRET,
        Number(process.env.GENERATION_WORKER_CONCURRENCY ?? 2),
      )
    : undefined;

if (queue) {
  await scheduleDailyIngestion(queue);
  workerLogger.info("worker.ready", { port, researchQueue: true });
} else {
  workerLogger.info("worker.ready", { port, researchQueue: false });
}

writeFileSync(readyFile, "ready");

process.on("SIGTERM", () => {
  workerLogger.info("worker.stopping");
  unlinkSync(readyFile);
  void Promise.all([
    worker?.close(),
    generationWorker?.close(),
    queue?.close(),
    mongoConnection?.client.close(),
  ]).finally(() => process.exit(0));
});

setInterval(() => undefined, 60_000);
