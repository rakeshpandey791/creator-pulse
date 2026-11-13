# RS-03 ingestion and trend signals

The worker runs bounded, at-least-once research ingestion. BullMQ schedules the daily job when `REDIS_URL` is configured; a source fetch is persisted to MongoDB when `MONGODB_URI` is configured. `RESEARCH_RSS_URL` is opt-in and is only accepted when `RESEARCH_SOURCE_TERMS_REVIEWED=true` and `RESEARCH_SOURCE_LICENSE_NOTE` is non-empty.

Each job has an idempotency key. Replaying the same key returns the recorded result, source documents are upserted by stable identity, and trend signals use deterministic IDs. External failures are retried at most three times, with worker-level concurrency and per-source spacing limits. Rate limits, malformed payloads, stale documents and outages are written to `research_integrity_reports`; a partial result is never presented as a complete ingestion.

For every accepted document the worker creates a normalized topic and freshness, volume and source-count observations. Signals retain the source document ID, topic ID, observation timestamp, measurement window and confidence. Documents older than the configured freshness window are marked `stale` and produce lower-confidence freshness signals.

The deterministic test suite covers repeated jobs, bounded retry/rate-limit behavior, malformed payloads and stale-signal handling:

```bash
npm run test:rs03
```
