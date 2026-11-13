# Observability runbook

CreatorPulse emits newline-delimited JSON logs from the API and worker. Every
HTTP request receives an `x-request-id`; reuse that value when following a
generation through `generation.queued`, `generation.job.started`, provider
telemetry, persistence and `generation.completed` or `generation.failed`.

## Metrics

The API exposes a safe, no-store snapshot at `GET /v1/health/metrics`. It
contains no prompts, generated content, credentials or email addresses. The
registry also supports Prometheus text output for a future scrape adapter.

Key signals are:

- `http_requests_total` and `http_request_duration_ms`
- `generation_operations_total`, `generation_jobs_total` and
  `generation_persistence_total`
- `provider_requests_total` and `provider_latency_ms`
- `research_jobs_total`
- `cache_events_total` (currently reports the deliberate discovery-cache
  disabled state)

## Failure triage

1. Start with the request ID and inspect the matching structured events.
2. For generation failures, compare the operation status with queue and
   provider counters; the API records safe error codes, not provider payloads.
3. For research failures, inspect the job state and source counts; raw source
   documents remain outside logs.
4. A missing provider or MongoDB is reported as a typed event and the existing
   in-memory development fallback remains visible in the event fields.

Telemetry redacts authorization, cookies, passwords, tokens, API keys, email,
prompts, raw payloads and generated content before serialization.
