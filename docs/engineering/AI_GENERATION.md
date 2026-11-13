# AI-03 generation operations

Generation is an asynchronous, creator-scoped operation:

1. `POST /v1/ideas/{ideaId}/generations` validates the idea, language,
   platform, outputs, duration, tone, and required `Idempotency-Key`.
2. Three credits are reserved exactly once for the creator/idempotency pair.
3. The operation is queued. Local development uses an in-process queue; when
   `REDIS_URL` is configured, API enqueueing uses BullMQ `content-generation`.
4. The worker consumes BullMQ jobs and calls the API’s secret-protected internal
   execution endpoint. Without Redis, the API executes the same handler in
   process so the fake provider remains usable in a clean checkout.
5. The handler builds a bounded prompt from the idea and at most five evidence
   excerpts, validates structured output, duration/context, and safety, then
   persists hook/script/CTA assets and consumes the reservation.
6. Provider failure, invalid output, safety review, queue failure, or credit
   settlement failure removes generated assets and releases the reservation.

Poll with `GET /v1/operations/{operationId}`. Responses contain operation
status, safe failure codes/messages, model/prompt-version metadata, and asset
references. They never expose prompts, provider payloads, raw model output, or
provider exception messages. Queued operations can be cancelled with
`POST /v1/operations/{operationId}/cancel`; cancellation releases the
reservation before work starts.

For Redis-backed deployments configure `GENERATION_API_URL` and
`GENERATION_WORKER_SECRET` for the worker, and the same secret on the API.
Gemini is selected only with `AI_PROVIDER=gemini` and `GEMINI_API_KEY`; the
default provider is deterministic fake mode.
