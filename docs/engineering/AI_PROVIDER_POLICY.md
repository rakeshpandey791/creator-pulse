# AI provider policy

AI-01 defines provider boundaries without making an external provider a test or
development dependency. The worker uses the deterministic fake by default. Set
`AI_PROVIDER=gemini` and `GEMINI_API_KEY` to opt into Gemini; `GEMINI_MODEL`
and `AI_TIMEOUT_MS` are optional configuration values. A missing key is reported
as a safe `unavailable` provider error rather than being logged or silently
falling back during an explicitly configured Gemini run.

## Contract and safety rules

- Text generation, embeddings, safety, and language quality are ports from
  `@creator-pulse/contracts`.
- Generation responses must be JSON matching the shared schema. Missing fields,
  invalid JSON, an unsupported language, or request-context mismatches are
  classified as malformed or partial output.
- Prompt policy `ai-01-v1` bounds idea/source context and wraps source material
  in delimiters. Source material is untrusted reference text and never supplies
  instructions to the model.
- Gemini requests use a 20-second default timeout and a 2,000-token output
  budget. The timeout may be configured only between one and sixty seconds.
- Telemetry contains provider, model, duration, outcome, and a safe error code.
  Prompts, source text, API keys, and full provider responses must not be logged.

## Failure handling

The adapter classifies timeout, rate limiting, quota exhaustion, provider
unavailability, malformed/partial output, and invalid requests. Only transient
timeouts, rate limits, and provider outages are retryable. The deterministic
fakes exercise every failure classification without network access, so the
full test suite remains runnable with no provider secret.
