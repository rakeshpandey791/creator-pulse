# Safety and claim-risk policy

SAFE-01 uses the provider-independent `@creator-pulse/contracts` safety policy at both generation boundaries:

- `allow`: no deterministic risk was found and publication may continue.
- `warn`: the topic is sensitive and the creator receives an actionable disclaimer.
- `review`: unsupported, absolute, financial-guarantee or medical claims require human review before publication.
- `reject`: unsafe instructions are blocked and cannot be silently published.

Finance, fitness and health content always receives a topic warning. Deterministic checks flag absolute promises, guaranteed returns, cure/no-doctor claims and unsafe instructions. The API exposes the same policy through `POST /v1/safety/check` so the UI and future generation worker can present consistent warnings. The `POST /v1/safety/publish` boundary calls the publish guard and refuses review/reject decisions.

Safety reports are persisted in the `safety_reports` collection (or the in-memory store for local development) and contain only language, platform, niche, decision, flags, warning counts and source-claim counts. They do not persist prompts, raw output, tokens or creator profile content. Reports should be grouped by language, niche and platform for review; raw content remains transient and bounded at the policy boundary.
