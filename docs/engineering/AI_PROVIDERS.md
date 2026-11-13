# AI-05 — Groq primary, Gemini fallback

**Priority:** P0 highest; precedes all other pending work, including video. Shared `@creator-pulse/ai` transport and typed validation serve the API and worker; existing prompts/domain rules stay in their current modules.

## Configuration

| Setting          | Meaning                                                                                    | Default            |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| `AI_PROVIDER`    | `groq` routes Groq → Gemini; `gemini` preserves explicit legacy mode; `fake` stays offline | `groq`             |
| `GROQ_API_KEY`   | Server-only Groq credential                                                                | unset              |
| `GROQ_MODEL`     | Groq JSON object chat model                                                                | `qwen/qwen3.8-27b` |
| `GEMINI_API_KEY` | Server-only fallback credential                                                            | unset              |
| `GEMINI_MODEL`   | Existing Gemini configuration                                                              | `gemini-3.5-flash` |
| `AI_TIMEOUT_MS`  | Per-provider timeout, 1000–60000 ms                                                        | 20000              |

Both keys belong in local `.env` or deployment secrets, never browser configuration. Compose/staging explicitly default to `fake` for offline smoke/CI safety; select `AI_PROVIDER=groq` for live operation. The local `.env` and `.env.example` select Groq. `GEMINI_ENABLED` and `PROVIDER_MODE` remain compatibility flags; `AI_PROVIDER` is authoritative for text/idea routing. Invalid provider/timeout settings fail configuration validation. A missing Groq credential attempts Gemini, never silently a fake.

## Covered features

- Explore initial ideas and searches: Groq → Gemini; five structured starters, existing persistence and database-search fallback if both fail.
- Candidate ranking: Groq → Gemini with existing candidate/DTO boundaries.
- Grounded angle selection: Groq → Gemini with bounded evidence and uncertainty.
- Hooks, script and CTA: Groq → Gemini, preserving language/platform/duration, safety, operation persistence and credit controls.
- Worker text-generation factory and proof-of-concept tool: Groq → Gemini; explicit fake fixtures stay deterministic.
- Research ingestion, deterministic embeddings, language checks and safety rules currently use no remote generative request and are unchanged. No remote embedding model is introduced.

Each request tries each provider at most once. Groq HTTP errors, rate limits, transport errors, timeouts, truncation, invalid JSON and typed validation failures attempt Gemini. Gemini failures propagate safely: no reverse fallback or quota retry loop. Business/safety validation remains outside fallback; it cannot be bypassed by changing providers. Each phase independently starts with Groq. Maximum provider wait per phase is approximately twice the configured timeout, plus overhead; a script has both angle and writing phases.

Failover stays inside the existing operation reservation, so no second job or credit charge is created. Both-provider failure preserves the existing release/refund path. Actual successful provider/model/token counts are returned; fallback telemetry adds only `fallbackFrom` and a normalized reason. Token counts describe the successful request, not any potentially billed failed-primary usage. Never log raw error bodies, prompts, output or credentials. Daily quota exhaustion is distinguished from temporary rate limits when metadata permits; fallback does not create more Gemini quota.

## Evidence and operation

Validated 2026-11-14: all 203 tests across 40 files and full production workspace build passed. A live minimal Groq JSON request succeeded in 225 ms. Live five-idea generation, two-candidate ranking and Hindi angle-to-script generation succeeded on `qwen/qwen3.8-27b`; the complete angle/script operation took 2.737 seconds and saved five assets using isolated test credits. A model-not-found Groq response exercised successful live Gemini fallback. The initial Llama candidate was unavailable to this account; model discovery informed the final configured/default Qwen model. No secrets or raw generated output are retained as evidence.

`tests/ai-routing.test.ts` covers transport ordering, bounded calls, missing key, 429/5xx, timeout abort, parsing, every API capability, worker parity and settlement/release. Existing AI/discovery/language/safety suites remain mandatory. Live checks use a single bounded real Groq request; failures are tested with mocked HTTP instead of exhausting live quotas. Keys remain outside evidence.

Build contracts/shared AI before direct runtime imports (`npm run typecheck` builds project references). Docker includes the AI workspace manifest before dependency install. Restart API and worker after changing environment configuration. Roll back explicitly with `AI_PROVIDER=gemini`, or use `fake` for offline smoke tests. Production evidence still needs independent review/QA; browser tests are not run in this chat.

References: [Groq JSON mode](https://console.groq.com/docs/structured-outputs), [Groq chat API](https://console.groq.com/docs/api-reference).
