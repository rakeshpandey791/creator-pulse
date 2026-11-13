# AI-02 provider proof of concept

The proof-of-concept runner is bounded and safe to run against either the
deterministic fake or an explicitly configured Gemini provider:

```sh
npm run test:ai-poc
AI_PROVIDER=gemini GEMINI_API_KEY=... npm run test:ai-poc
```

The runner executes seven representative language/niche/platform cases with
30, 45, and 60 second targets. It limits concurrency to two, permits ten
requests per user and twenty requests globally per run, and retries a
retryable provider failure at most once with a bounded delay. Duplicate
`userId`/`requestId` pairs share the same in-flight or completed result and do
not consume another request budget.

## Decision gate

The report is written to `.ci-artifacts/ai-poc.json` and contains only safe
metrics and error classifications. It never includes prompts, source text,
API keys, or provider response bodies.

| Metric                | Go threshold        |
| --------------------- | ------------------- |
| p95 latency           | ≤ 5 seconds         |
| failure rate          | ≤ 10%               |
| structured validity   | ≥ 95%               |
| retry rate            | ≤ 25%               |
| generated output size | ≤ 12,000 characters |

The command returns a non-zero exit code for `no-go`. Token totals are included
when Gemini returns usage metadata; the fake provider intentionally has no
token accounting and is used for offline regression coverage. These thresholds
are the MVP decision gate, not a claim about an unexecuted live-provider run.
Product-owner acceptance of free-provider quota limitations remains required
before enabling Gemini in production.

The approved fallback message for a transient failure or exhausted budget is:
“AI generation is temporarily unavailable. Please try again shortly; no
credits were consumed for this attempt.” Provider internals and raw model
responses are never shown to creators.
