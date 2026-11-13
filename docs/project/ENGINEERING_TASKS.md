# CreatorPulse Engineering Tasks

**Status:** Draft for engineering-plan approval  
**Priority key:** P0 = MVP mandatory, P1 = post-MVP planning, P2 = future planning  
**Complexity:** S = small, M = medium, L = large

Each task below is actionable and includes its dependency, validation and completion boundary. Tasks are grouped as Epic → Story → Engineering task.

## E0 — Scope, contracts and project foundation

### Story E0-S1 — Resolve implementation inputs

#### SETUP-01 — Create initial application folders and baseline tooling

- **Description:** Establish the initial code workspace before feature development: web, API, worker, shared contracts, tests, scripts, configuration and documentation folders.
- **Business objective:** Give all engineering agents a predictable structure and prevent feature work from creating inconsistent project foundations.
- **Technical implementation:** Create the approved modular-monolith layout; add placeholder entry points for Next.js web, NestJS API and worker; add shared TypeScript configuration, environment-example files, package scripts, lint/format/test configuration, `.gitignore`, contribution guidance and local command documentation. Do not implement product features.
- **Dependencies:** None.
- **Acceptance criteria:** A clean checkout has the documented folders; web/API/worker processes have minimal health/start placeholders; lint, type-check and test commands execute; secrets are excluded; the folder layout matches the engineering design.
- **Test requirements:** Clean-checkout bootstrap test; command smoke tests; secret-detection check.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 1, 5–7 and 22; `IMPLEMENTATION_ROADMAP.md`; `DEFINITION_OF_DONE.md`.
- **Definition of Done:** Folder structure and baseline tooling are reviewed and committed before `INF-01` or any feature task begins.

#### CP-01 — Resolve MVP scope and design coverage

- **Description:** Record the governing decision for six PRD launch niches versus the earlier “all niches” statement, and inventory missing desktop/mobile Stitch states for P0 screens.
- **Business objective:** Prevent engineering from implementing conflicting scope or leaving required journeys without approved visual behavior.
- **Technical implementation:** Create a signed decision record; use the PRD six-niche set as the default until changed; mark missing responsive screens as design-validation work; confirm UI chrome language policy and recovery-screen behavior.
- **Dependencies:** SETUP-01.
- **Acceptance criteria:** Decision is recorded; all P0 routes have a desktop/mobile behavior owner; unresolved items have an explicit product decision owner and do not silently change the PRD.
- **Test requirements:** Documentation lint/check for route and priority coverage.
- **Priority:** P0. **Complexity:** S.
- **References:** `PRD.md` sections 7, 10, 16; `SCREEN_INVENTORY.md`; Stitch project `projects/3503066722097683519`.
- **Definition of Done:** Decision record reviewed and linked from the roadmap.

#### INF-01 — Establish repository and workspace conventions

- **Description:** Create the approved workspace layout for Next.js web, NestJS API, worker, shared contracts, tests, docs and operational configuration.
- **Business objective:** Enable parallel delivery without ambiguous ownership or inconsistent tooling.
- **Technical implementation:** Configure TypeScript strictness, package scripts, linting, formatting, commit checks and module dependency rules; do not add microservices.
- **Dependencies:** SETUP-01, CP-01.
- **Acceptance criteria:** Fresh checkout can install, lint, type-check and run the documented test command; forbidden cross-layer imports are detectable.
- **Test requirements:** CI smoke job on a clean checkout.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 1–7, 22–23.
- **Definition of Done:** CI executes foundation checks successfully.

#### INF-02 — Build local Docker Compose environment

- **Description:** Provide reproducible local Next.js, NestJS API, worker, MongoDB Community and Redis-compatible services.
- **Business objective:** Reduce onboarding friction and make integration tests repeatable.
- **Technical implementation:** Add health checks, isolated local volumes, environment examples, mocked providers by default and explicit Gemini-key opt-in.
- **Dependencies:** INF-01.
- **Acceptance criteria:** A developer can start all services, run migrations/seeds and execute a health check; no real provider call occurs by default.
- **Test requirements:** Compose smoke test and provider-disabled test.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 22, 24.
- **Definition of Done:** Local setup is documented and verified on a clean machine.

#### INF-03 — Configure CI quality gates

- **Description:** Add CI stages for lint, type-check, unit/integration/contract tests, security scanning, container build and migration validation.
- **Business objective:** Catch regressions before shared environments and protect a small team from manual release drift.
- **Technical implementation:** Use service containers or Compose; publish test artifacts; fail on secret detection and critical dependency vulnerabilities.
- **Dependencies:** INF-01, INF-02.
- **Acceptance criteria:** Pull requests cannot pass with failed required checks; test and scan results are retained.
- **Test requirements:** Deliberate failing-fixture run proves each gate fails correctly.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 20, 22–23; `DEFINITION_OF_DONE.md`.
- **Definition of Done:** Required checks are branch-protection-ready.

## E1 — Database implementation

### Story E1-S1 — Establish MongoDB persistence

#### DB-01 — Implement versioned validators, migrations and reference seeds

- **Description:** Implement MongoDB shell-compatible validators, indexes and versioned migrations for all required collections.
- **Business objective:** Make persistence consistent with the approved database design and safe for rolling releases.
- **Technical implementation:** Implement the collections in `SCHEMA.sql`, UUID string IDs, timestamps, soft-delete fields, enum validation, partial unique indexes and six-niche/seven-language/platform seed data.
- **Dependencies:** CP-01, INF-02.
- **Acceptance criteria:** Migrations are repeatable/idempotent; validators reject invalid required fields; seeds are stable; indexes match `INDEX_STRATEGY.md`.
- **Test requirements:** Migration up/re-run, validator rejection, unique-index and seed-count tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `DATABASE_DESIGN.md` sections 2–4, 8–10; `SCHEMA.sql`; `INDEX_STRATEGY.md`; `DATA_DICTIONARY.md`.
- **Definition of Done:** Fresh and upgraded databases pass migration and integrity tests.

#### DB-02 — Build repository interfaces and ownership-scoped persistence

- **Description:** Create repository ports and MongoDB implementations for identity, creator, taxonomy, research, ideas, scores, recommendations, assets, feedback, operations, credits and subscriptions.
- **Business objective:** Keep modules testable and prevent MongoDB details from leaking into application services.
- **Technical implementation:** Require creator/user ownership scope in creator-owned queries; return DTO-safe projections; implement cursors and bounded joins/enrichment in application services.
- **Dependencies:** DB-01, INF-01.
- **Acceptance criteria:** Every creator-owned repository method requires scope; password hashes and provider payloads cannot be selected by default; orphan references are rejected or reported.
- **Test requirements:** Repository integration tests, cross-creator access tests, cursor pagination tests and orphan-reference tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `DATABASE_DESIGN.md` sections 3, 5–7, 11; `ENGINEERING_DESIGN.md` sections 6–7.
- **Definition of Done:** All API modules use repository ports rather than direct MongoDB access.

#### DB-03 — Implement vector/full-text abstraction

- **Description:** Implement the `VectorStore` and normalized search ports with MongoDB-first storage and a future pgvector adapter boundary.
- **Business objective:** Support useful search without prematurely adding a second database.
- **Technical implementation:** Store model/version/dimensions with embeddings; provide prefix/text fallback; reject incompatible vector versions; expose re-embedding as a resumable job interface.
- **Dependencies:** DB-01, DB-02.
- **Acceptance criteria:** Search returns deterministic normalized matches without vectors; vector adapter can be replaced in tests; incompatible embeddings never mix in an active query.
- **Test requirements:** Retrieval contract, model-version isolation and fallback tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `DATABASE_DESIGN.md` section 8; `ENGINEERING_DESIGN.md` sections 11, 21 and 25.
- **Definition of Done:** Discovery can use the abstraction without importing MongoDB-specific vector APIs.

## E2 — Authentication and user management

### Story E2-S1 — Secure identity lifecycle

#### ID-01 — Implement signup, login, refresh, logout and `/me`

- **Description:** Implement the Identity module and REST endpoints for creator sessions.
- **Business objective:** Give creators secure, persistent access to their workspace.
- **Technical implementation:** Hash passwords with a standard adaptive algorithm; issue short-lived access tokens and hashed rotating refresh tokens; persist/revoke sessions; use safe error messages and audit events.
- **Dependencies:** DB-02, INF-01.
- **Acceptance criteria:** Duplicate active email is rejected; refresh rotation and replay rejection work; logout revokes the session; `/me` returns identity and entitlement summary without secrets.
- **Test requirements:** Unit password/session tests, API auth tests, refresh replay and brute-force/rate-limit tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` FR-1; `ENGINEERING_DESIGN.md` sections 8–9; `DATABASE_DESIGN.md` collections `users`, `auth_sessions`, `audit_logs`.
- **Definition of Done:** Auth contract is OpenAPI-documented and security-tested.

#### ID-02 — Implement password recovery states

- **Description:** Implement recovery-token issuance, expiry, reset and safe transactional messaging through an email port.
- **Business objective:** Prevent account lockout while avoiding account-enumeration leaks.
- **Technical implementation:** Store only hashed one-time tokens or equivalent session-safe records; rate-limit requests; use development mail sink and production adapter boundary; audit outcomes without token contents.
- **Dependencies:** ID-01, INF-02.
- **Acceptance criteria:** Recovery response does not reveal whether an email exists; expired/reused tokens fail; reset invalidates active sessions according to policy; messages are retryable.
- **Test requirements:** Token expiry/replay, enumeration, rate-limit and mail-adapter contract tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `SCREEN_INVENTORY.md` AUTH-03/AUTH-04; `ENGINEERING_DESIGN.md` sections 8, 14–15.
- **Definition of Done:** Auth recovery behavior is covered in the approved mobile design states or an explicit design decision.

## E3 — Creator onboarding and profile

### Story E3-S1 — Configure creator context

#### CRE-01 — Implement creator profile and taxonomy APIs

- **Description:** Implement `GET/PUT/PATCH /creator/profile` with validation for niche, audience, platforms, languages, style and goal.
- **Business objective:** Create a usable cold-start context for personalized recommendations.
- **Technical implementation:** Validate taxonomy IDs against active references; increment `profileVersion` on ranking-affecting changes; bound audience fields and reject sensitive unrestricted data.
- **Dependencies:** DB-01, DB-02, ID-01.
- **Acceptance criteria:** Required fields are enforced; multiple languages/platforms persist; ownership is enforced; invalid combinations return actionable errors; profile version changes on relevant edits.
- **Test requirements:** DTO, service, repository, authorization and profile-version tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` FR-1, section 10.1; `ENGINEERING_DESIGN.md` creator API; `DATABASE_DESIGN.md` `creator_profiles`.
- **Definition of Done:** API supports onboarding and later settings edits.

#### FE-01 — Build auth and onboarding flows

- **Description:** Build Next.js signup/login/recovery and four-step onboarding using approved Stitch references and shared accessible controls.
- **Business objective:** Get a new creator from account creation to a relevant first feed with minimal friction.
- **Technical implementation:** Typed API client; route guards; form validation; progress state; native-script language samples; preserve state on retry; responsive desktop/mobile behavior.
- **Dependencies:** ID-01, ID-02, CRE-01, INF-01.
- **Acceptance criteria:** A new user can complete required profile context; validation and server errors are actionable; refresh does not lose progress unexpectedly; supported languages render correctly.
- **Test requirements:** Component tests, accessibility checks, responsive visual regression and auth-to-onboarding E2E.
- **Priority:** P0. **Complexity:** L.
- **References:** `SCREEN_INVENTORY.md` AUTH-01–04/ONB-01–06; `DESIGN_SYSTEM.md`; `USER_FLOWS.md` sections 1–2; Stitch references.
- **Definition of Done:** Approved auth/onboarding journeys work on mobile and desktop.

## E4 — Trend data ingestion and research

### Story E4-S1 — Supply trustworthy research signals

#### RS-01 — Define source adapter and normalization contracts

- **Description:** Implement source adapter ports for permitted official free APIs, RSS/public sources and manual seeds.
- **Business objective:** Provide credible, attributable inputs without illegal or brittle data acquisition.
- **Technical implementation:** Normalize source name, URL, title, excerpt, language, timestamps, hash, license note and retrieval status; treat source text as untrusted input; enforce retention rules.
- **Dependencies:** DB-02, INF-01.
- **Acceptance criteria:** Each adapter returns normalized provenance and a classified error; duplicate source documents are deduplicated by canonical key/hash; prohibited scraping is not supported.
- **Test requirements:** Adapter contract tests, fixture normalization, deduplication and malformed-source tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 12, 15, 17–18; `DATABASE_DESIGN.md` `source_documents`.
- **Definition of Done:** At least one permitted source and manual-seed adapter pass the feasibility gate.

#### RS-02 — Prove free-source feasibility and provenance quality

- **Description:** Run a bounded proof of concept for one free source plus manual seeds across representative niches/languages.
- **Business objective:** Validate that the MVP can show useful evidence without paid acquisition or unsupported platform claims.
- **Technical implementation:** Measure availability, rate limits, freshness, source terms, normalization completeness and signal coverage; document gaps.
- **Dependencies:** RS-01, CP-01.
- **Acceptance criteria:** Go/no-go criteria are recorded; fallback behavior is defined; no source is used without provenance and permitted-use review.
- **Test requirements:** Repeat fetch, outage, stale-data and empty-result tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` FR-5, risks/open questions; `ENGINEERING_DESIGN.md` sections 12 and 25.
- **Definition of Done:** Product owner accepts the source set and limitations.

#### RS-03 — Implement ingestion jobs and trend signals

- **Description:** Build scheduled BullMQ ingestion, normalization, trend-signal derivation and source-quality checks.
- **Business objective:** Keep ideas fresh enough for daily discovery while avoiding duplicate or misleading observations.
- **Technical implementation:** Idempotent job keys, bounded retries, rate limits, signal windows, confidence/coverage fields, stale-source marking and integrity reporting.
- **Dependencies:** RS-01, RS-02, DB-01, INF-02.
- **Acceptance criteria:** A repeated job does not duplicate observations; source outage produces a visible partial-data state; signals link to source documents and timestamps.
- **Test requirements:** Worker integration, duplicate job, rate-limit, malformed payload and stale-signal tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 12, 15, 17; `DATABASE_DESIGN.md` `trend_signals`.
- **Definition of Done:** Scheduler and manual re-run are safe and observable.

## E5 — Content ideas, scoring and recommendations

### Story E5-S1 — Produce explainable opportunities

#### REC-01 — Implement idea/topic creation and evidence assembly

- **Description:** Create reusable content topics and ideas from normalized signals, manual seeds and search requests, attaching bounded evidence.
- **Business objective:** Turn research into creator-readable opportunities with provenance.
- **Technical implementation:** Canonical keys, normalized search text, supported context fields, source/evidence joins, safe excerpts and uncertainty/coverage metadata.
- **Dependencies:** RS-03, DB-02.
- **Acceptance criteria:** Ideas are reusable across creators; evidence always links to a source document; missing evidence is represented honestly; duplicate canonical ideas are avoided.
- **Test requirements:** Service, repository, provenance and duplicate-idea tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` FR-5; `DATABASE_DESIGN.md` `content_topics`, `content_ideas`, `idea_evidence`.
- **Definition of Done:** Feed and search can consume bounded idea/evidence records.

#### REC-02 — Implement explainable score calculation

- **Description:** Calculate relevance, trend momentum, freshness and competition dimensions, overall score, label, explanation and coverage caveat.
- **Business objective:** Let creators understand why an idea is recommended without implying guaranteed performance.
- **Technical implementation:** Version scoring rules; separate observed values from estimates; persist immutable score snapshots with one current marker; expose plain-language drivers and uncertainty.
- **Dependencies:** REC-01, CRE-01.
- **Acceptance criteria:** Every displayed score has four dimensions and an explanation; stale/incomplete source coverage is visible; score versions are traceable.
- **Test requirements:** Domain unit tests, boundary/weight tests, snapshot regression and explanation-consistency tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` FR-6 and section 10.4; `DATABASE_DESIGN.md` `idea_scores`; `ENGINEERING_DESIGN.md` section 11.
- **Definition of Done:** Product-approved examples reproduce expected labels and caveats.

#### REC-03 — Implement candidate generation, ranking and deduplication

- **Description:** Build cold-start recommendation pipeline using profile filters, topic retrieval, scores, freshness, diversity, platform/language fit and seen/dismissed suppression.
- **Business objective:** Make the daily feed useful before behavior history exists.
- **Technical implementation:** Candidate → hard filters → scoring → diversity/deduplication → rank; materialize `idea_recommendations` with profile/ranking versions and deterministic keys.
- **Dependencies:** REC-01, REC-02, CRE-01, DB-03.
- **Acceptance criteria:** Feed respects creator context; duplicates are minimized; ranking is reproducible for a version; empty candidate sets return transparent fallback behavior.
- **Test requirements:** Offline relevance/diversity/duplicate evaluation, property tests and feed-materialization integration tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` FR-2/FR-3; `ENGINEERING_DESIGN.md` section 11; `DATABASE_DESIGN.md` `idea_recommendations`.
- **Definition of Done:** Ranking evaluation meets the agreed MVP threshold and limitations are documented.

#### DISC-01 — Implement feed, search and idea-detail APIs

- **Description:** Implement `/feed/daily`, `/ideas/search` and `/ideas/{ideaId}` with cursor pagination, filters, evidence, scores and credit-aware actions.
- **Business objective:** Expose the discovery workflow through stable REST contracts.
- **Technical implementation:** Use typed DTOs, ownership-safe enrichment, bounded evidence, cache keys containing context/version and consistent error envelopes.
- **Dependencies:** REC-02, REC-03, DB-02, ID-01.
- **Acceptance criteria:** APIs return approved fields and cursors; search works without authoritative trends; detail shows evidence limitations; no cross-creator data leaks.
- **Test requirements:** OpenAPI contract, API integration, pagination, cache invalidation and authorization tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` section 9; `PRD.md` sections 10.2–10.4.
- **Definition of Done:** API contract is reviewed and consumed by the frontend.

#### FE-02 — Build Today, Explore, idea detail and score explanation UI

- **Description:** Implement core discovery screens from Stitch: daily feed, search, detail, evidence and score explanation.
- **Business objective:** Help a creator reach and trust a useful idea quickly.
- **Technical implementation:** Shared cards, filters, progressive evidence disclosure, visible language/platform/credits, loading/empty/stale/error states, mobile bottom navigation and desktop shell.
- **Dependencies:** DISC-01, FE-01.
- **Acceptance criteria:** User can open, inspect, save/dismiss and start generation; score explanation does not depend on color alone; source links and caveats are visible.
- **Test requirements:** Component, accessibility, responsive visual regression and discovery-flow E2E tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `SCREEN_INVENTORY.md` APP-01–04/APP-14; `DESIGN_SYSTEM.md`; `USER_FLOWS.md` sections 3–4; Stitch screen IDs.
- **Definition of Done:** Core discovery flow matches approved design references on target breakpoints.

## E6 — Regional-language intelligence and safety

### Story E6-S1 — Keep content natural and safe

#### LANG-01 — Implement language catalog, detection and prompt policy

- **Description:** Implement supported-language metadata and language normalization for Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and Kannada.
- **Business objective:** Make regional-language output feel natural rather than literally translated.
- **Technical implementation:** Store script/dialect metadata; define selected-language precedence; detect mixed-language output; provide language-specific prompt guidance and fallback behavior.
- **Dependencies:** DB-01, CRE-01.
- **Acceptance criteria:** Unsupported language is rejected clearly; selected language/platform context is passed to generation; mixed-language or script mismatch is flagged.
- **Test requirements:** Language metadata, detection and precedence tests across all launch languages.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` FR-1/FR-7 and language risks; `ENGINEERING_DESIGN.md` section 13; `DESIGN_SYSTEM.md` localization rules.
- **Definition of Done:** Language contract is used by API, worker and UI.

#### LANG-02 — Build multilingual AI evaluation harness

- **Description:** Create fixed prompts and human-review rubric for language fidelity, naturalness, duration, safety and unsupported claims across launch languages and representative niches.
- **Business objective:** Detect quality gaps before creators receive misleading or unnatural drafts.
- **Technical implementation:** Version fixtures; score structured and human-reviewed results; preserve minimal outputs for evaluation; report by language/niche/platform.
- **Dependencies:** LANG-01, AI-01.
- **Acceptance criteria:** All seven languages have fixtures; failure thresholds and escalation rules are recorded; evaluation runs in CI or a repeatable job.
- **Test requirements:** Golden-set, mixed-language, unsupported-claim and duration tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` quality metrics and risks; `ENGINEERING_DESIGN.md` sections 13 and 23.
- **Definition of Done:** Product and language reviewers accept the initial quality baseline.

#### SAFE-01 — Implement safety and claim-risk checks

- **Description:** Add pre/post generation safety policy checks, sensitive-topic reminders and inaccurate/unsafe-result reporting.
- **Business objective:** Reduce harm in finance, fitness/health and other sensitive niches.
- **Technical implementation:** Provider-independent policy interface; deterministic checks for required disclaimers/flags; source claims remain bounded and labeled; unsafe output is not silently published as fact.
- **Dependencies:** LANG-01, AI-01.
- **Acceptance criteria:** Sensitive outputs receive an actionable warning; unsafe output is rejected or requires explicit review state; reports are stored without exposing prompts.
- **Test requirements:** Policy unit tests, adversarial fixtures and E2E warning tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` FR-11 and edge cases; `ENGINEERING_DESIGN.md` sections 10 and 18.
- **Definition of Done:** Safety behavior is visible in API and script UI.

## E7 — AI hooks, scripts and CTAs

### Story E7-S1 — Generate editable creator assets

#### AI-01 — Implement provider ports, Gemini adapter and structured schemas

- **Description:** Implement text generation, embedding, safety and language-quality ports with a Gemini free-model adapter and deterministic test fakes.
- **Business objective:** Use the approved free/open-source-first MVP approach while keeping providers replaceable.
- **Technical implementation:** Version prompts/configuration; request structured JSON; delimit source text as untrusted; enforce model/time/token budgets and provider-specific telemetry.
- **Dependencies:** INF-01, LANG-01, RS-03.
- **Acceptance criteria:** Adapter conforms to provider port; malformed/partial output is classified; no provider secret or full prompt is logged; fake supports all failure modes.
- **Test requirements:** Adapter contract, schema, timeout, quota, malformed JSON and prompt-injection tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 10, 14, 17, 24–25; `TECHNICAL_DECISIONS.md`.
- **Definition of Done:** Gemini use is opt-in/configured and fake provider runs the full test suite.

#### AI-02 — Prove Gemini quota, latency and output quality

- **Description:** Run bounded generation tests using the free model for hooks, 30–60 second scripts and CTAs in representative languages/niches.
- **Business objective:** Validate that free-provider assumptions support a viable MVP.
- **Technical implementation:** Measure latency, failure rate, token usage where available, output length, structured validity and retry behavior under bounded concurrency.
- **Dependencies:** AI-01, LANG-02.
- **Acceptance criteria:** Go/no-go thresholds are recorded; queue concurrency and per-user/global budgets are defined; fallback messaging is approved.
- **Test requirements:** Quota exhaustion, timeout, rate-limit and duplicate-request tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 15, 21, 24–25; `PRD.md` assumptions.
- **Definition of Done:** Product owner accepts the provider/quota limitations.

#### AI-03 — Implement generation operations, validation and persistence

- **Description:** Implement `POST /ideas/{ideaId}/generations`, worker execution, operation polling/cancel, asset persistence and credit settlement.
- **Business objective:** Convert trusted ideas into usable scripts with transparent cost and reliable failure recovery.
- **Technical implementation:** Validate ownership/context; reserve credits idempotently; enqueue BullMQ job; build bounded prompt from idea/evidence/profile; validate schema/language/duration/safety; persist `idea_assets`; settle/refund credits; expose operation status.
- **Dependencies:** AI-01, AI-02, SAFE-01, CR-01, DB-02, DISC-01.
- **Acceptance criteria:** Duplicate idempotency key does not double-charge or duplicate assets; successful result references operation/model/prompt version; failed provider work releases/refunds according to policy; polling never exposes provider internals.
- **Test requirements:** Unit pipeline, queue integration, duplicate job, worker crash, malformed output, credit failure and operation polling tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 9–10, 15, 17; `DATABASE_DESIGN.md` `ai_operations`, `idea_assets`, `credit_ledger`.
- **Definition of Done:** End-to-end generation works with fake and configured Gemini provider.

#### FE-03 — Build script drafting workspace

- **Description:** Implement desktop/mobile script workspace with hook selection, editable script, CTA, language/platform/duration context, credit cost, safety note and regeneration states.
- **Business objective:** Help creators move from idea selection to recording-ready draft.
- **Technical implementation:** Poll operation status; preserve unsaved local edits; disable/confirm costly actions; show AI-generated label, provenance and recovery state; use approved Stitch layout and tokens.
- **Dependencies:** AI-03, FE-02.
- **Acceptance criteria:** Creator can select a hook, edit content, save draft, regenerate after cost confirmation and recover from failure without losing edits.
- **Test requirements:** Component, accessibility, mobile visual regression, polling and script-edit preservation E2E tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `SCREEN_INVENTORY.md` APP-05/06; `DESIGN_SYSTEM.md`; `USER_FLOWS.md` section 3; Stitch script screens.
- **Definition of Done:** Idea-to-script journey is demonstrable on mobile and desktop.

## E8 — Idea management and feedback

### Story E8-S1 — Preserve creator workflow state

#### IDE-01 — Implement save, bookmark and status APIs

- **Description:** Implement save/remove-save and status transitions with history for saved, planned, scripted, published and dismissed.
- **Business objective:** Ensure useful ideas are not lost and creator work is trackable.
- **Technical implementation:** Idempotent mutations, ownership checks, latest-status query or maintained projection, append-only status events and explicit manual-published semantics.
- **Dependencies:** DB-02, DISC-01.
- **Acceptance criteria:** Repeated save/status requests are safe; saved idea returns evidence/assets/current score; invalid transitions are handled consistently; published is manual-only.
- **Test requirements:** API, repository, authorization, idempotency and status-transition tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` FR-8; `DATABASE_DESIGN.md` `saved_ideas`, `idea_status_events`; `USER_FLOWS.md` section 5.
- **Definition of Done:** Library APIs support cursor-based retrieval and filters.

#### IDE-02 — Implement feedback API and quality signal storage

- **Description:** Implement optional rating/reason/comment capture for ideas and recommendations.
- **Business objective:** Learn where recommendations fail without interrupting creator workflows.
- **Technical implementation:** Validate reason codes, bound comment size, capture context fields, redact sensitive content and expose no internal prompts.
- **Dependencies:** DB-02, DISC-01.
- **Acceptance criteria:** Feedback is optional, ownership-protected and confirmed; duplicate/spam policy is defined; feedback is queryable for analysis by language/niche/platform.
- **Test requirements:** DTO, authorization, abuse/rate-limit and privacy tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` FR-9; `DATABASE_DESIGN.md` `creator_feedback`; `SCREEN_INVENTORY.md` APP-09.
- **Definition of Done:** Feedback appears in the relevant card/detail state and is observable.

#### FE-04 — Build Library, status and feedback UI

- **Description:** Implement saved ideas/library, status filters, manual published state, feedback panel and empty/loading/error states.
- **Business objective:** Help creators return to and organize opportunities.
- **Technical implementation:** Cursor list, mutation invalidation, optimistic state only where safe, explicit published copy, accessible feedback drawer/modal and mobile/desktop responsive behavior.
- **Dependencies:** IDE-01, IDE-02, FE-02, FE-03.
- **Acceptance criteria:** Save/status changes persist across refresh; feedback never blocks navigation; library shows evidence/assets links and safe empty states.
- **Test requirements:** Component, API integration, accessibility, visual regression and E2E library-flow tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `SCREEN_INVENTORY.md` APP-07–09; `DESIGN_SYSTEM.md`; `USER_FLOWS.md` section 5.
- **Definition of Done:** Library journey is complete at target breakpoints.

## E9 — Credits, subscriptions and payments

### Story E9-S1 — Enforce usage and entitlement controls

#### CR-01 — Implement plans, subscriptions and credit policy

- **Description:** Implement configurable plans, creator entitlement state, monthly grants, operation pricing and usage reads.
- **Business objective:** Make affordability and spend control explicit for Indian micro-creators.
- **Technical implementation:** Seed free/paid plan records; expose `/plans`, `/credits`; version plan interpretation; define renewal/expiry and insufficient-credit behavior.
- **Dependencies:** DB-01, DB-02, ID-01.
- **Acceptance criteria:** Current balance and renewal are correct; plan changes do not rewrite history; operation costs are configuration-driven; limits return structured errors.
- **Test requirements:** Entitlement, period boundary, plan-version and insufficient-credit tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` FR-10 and section 14; `DATABASE_DESIGN.md` subscription collections; `ENGINEERING_DESIGN.md` section 9.
- **Definition of Done:** Credits and plans are available to API and UI without hardcoded client authority.

#### CR-02 — Implement atomic credit reservation and settlement

- **Description:** Implement immutable credit ledger operations for reserve, consume, release, refund, grant and expiry.
- **Business objective:** Prevent double charging and preserve trust when AI or payment operations fail.
- **Technical implementation:** MongoDB transaction where supported; otherwise conditional single-writer strategy; idempotency/reference keys; balance-after audit; reconcile stuck reservations.
- **Dependencies:** DB-02, CR-01.
- **Acceptance criteria:** Concurrent requests cannot overspend; duplicate settlement is a no-op; failed generation does not permanently consume credits; reconciliation identifies stuck operations.
- **Test requirements:** Concurrency, crash/retry, duplicate settlement, rollback and ledger-integrity tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 2, 9, 15, 17; `DATABASE_DESIGN.md` `credit_ledger`.
- **Definition of Done:** AI-03 and payment flows use this service exclusively.

#### BILL-01 — Implement mock/manual payment adapter and subscription endpoints

- **Description:** Implement checkout/cancel boundary using a mock/manual provider for MVP and preserve future provider adapter compatibility.
- **Business objective:** Validate subscription and entitlement behavior before committing to paid external dependencies.
- **Technical implementation:** `/subscriptions/checkout` and `/subscriptions/cancel`; transaction idempotency; delayed-success/failure simulation; no card data; audit events.
- **Dependencies:** CR-01, CR-02, DB-02.
- **Acceptance criteria:** Successful mock checkout updates entitlement idempotently; provider failure leaves entitlement unchanged; cancellation is explicit and visible; transaction records reconcile.
- **Test requirements:** Contract, delayed-webhook simulation, duplicate checkout, failure and authorization tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` sections 10.8 and 14–15; `ENGINEERING_DESIGN.md` section 14; `DATABASE_DESIGN.md` `payment_transactions`.
- **Definition of Done:** Billing boundary is testable without a paid provider.

#### FE-05 — Build credits, plans and billing UI

- **Description:** Implement usage, plan comparison, checkout/cancel states and payment failure recovery using approved design references.
- **Business objective:** Help creators understand and control spend before generation.
- **Technical implementation:** Read authoritative API state; show per-operation cost, balance, renewal, limit and mock/manual payment status; never calculate entitlement locally.
- **Dependencies:** CR-01, BILL-01, FE-02.
- **Acceptance criteria:** User sees cost before generation; insufficient credits provide recovery path; delayed payment state is clear; cancellation/renewal copy is accurate.
- **Test requirements:** Component, API contract, accessibility, visual regression and payment-failure E2E tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `SCREEN_INVENTORY.md` APP-10/11; `DESIGN_SYSTEM.md`; `USER_FLOWS.md` section 6.
- **Definition of Done:** Usage and entitlement journey is complete without client-side authority.

## E10 — Frontend application shell and profile management

### Story E10-S1 — Deliver consistent responsive application

#### FE-06 — Build application shell and shared design system primitives

- **Description:** Implement navigation, layout, typography, color tokens, cards, score indicators, filters, forms, alerts, drawers, loading and error primitives.
- **Business objective:** Make the product feel coherent, premium and usable across languages and devices.
- **Technical implementation:** Encode approved Stitch tokens; Geist/Geist Mono; mobile-first breakpoints; 44px targets; focus/reduced-motion support; no generic AI-dashboard drift.
- **Dependencies:** INF-01, CP-01.
- **Acceptance criteria:** Shared primitives pass accessibility checks; responsive shell supports all approved routes; tokens are centralized; forbidden visual patterns are absent.
- **Test requirements:** Story/component tests, keyboard navigation, contrast, reduced-motion and visual regression.
- **Priority:** P0. **Complexity:** L.
- **References:** `DESIGN.md`, `DESIGN_SYSTEM.md`, `SCREEN_INVENTORY.md`.
- **Definition of Done:** Feature teams consume shared primitives rather than duplicating style logic.

#### FE-07 — Build profile/settings and quick-preference editing

- **Description:** Implement desktop/mobile profile settings for creator identity, niches, audience, platforms, languages and recommendation controls.
- **Business objective:** Let creators correct personalization without repeating onboarding.
- **Technical implementation:** Typed profile API; unsaved-changes state; native-script samples; privacy copy; save/reset behavior; cache invalidation of feed/search after profile version change.
- **Dependencies:** CRE-01, FE-06, FE-01.
- **Acceptance criteria:** Settings edits persist; feed context refreshes after relevant changes; unsaved edits are recoverable; unsupported combinations are explained.
- **Test requirements:** Form, accessibility, responsive visual regression and profile-to-feed E2E tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `SCREEN_INVENTORY.md` APP-12/13; Stitch Settings screen; `DESIGN_SYSTEM.md`.
- **Definition of Done:** Profile management matches approved settings design and does not expose sensitive data.

#### FE-08 — Rework the tomorrow-script creator journey

- **Description:** Rework the creator’s primary path from “New script” to a clear next-day publishing plan: choose a recommended idea or start with an own-topic brief, confirm the creator context, generate useful hooks/script/CTA, edit the result and mark it ready for tomorrow.
- **Business objective:** Make the MVP’s core promise immediately understandable and help a 10K–100K follower creator move from intention to a recording-ready script without guessing what happens next.
- **Technical implementation:** Replace the New script dead end with a guided entry state; add an own-topic path; surface niche, audience, language, platform, duration, credit cost and expected outputs before generation; add explicit generation phases and a completion state; allow language/platform adjustment before generation; persist the resulting draft/status through the existing APIs; improve generation context and deterministic demo content so outputs are specific to the idea and creator profile.
- **Dependencies:** FE-02, FE-03, FE-04, FE-05, FE-06, FE-07, AI-03, IDE-01, LANG-02, SAFE-01.
- **Acceptance criteria:**
  - “New script” clearly offers “Use a recommended idea” and “Start with my own topic” rather than silently routing to search.
  - The flow explains that it prepares tomorrow’s post and shows the selected audience, niche, language, platform, duration, output bundle and credit cost before a billable action.
  - A creator can generate three distinct hooks, one editable spoken script and a CTA, with meaningful progress phases and recoverable failure states.
  - The script workspace follows the approved Stitch structure: hook selection, editable script canvas, CTA, persistent context rail and one primary next action.
  - Regeneration preserves edits; save and “Ready for tomorrow” persist the draft/status and survive refresh.
  - Generated content is specific to the idea/profile context, follows the selected language/platform, avoids generic filler and surfaces safety or unsupported-claim review states.
  - The journey has approved desktop/mobile layouts, accessible 44px targets, keyboard/focus states, loading/empty/error/success states and plain-language copy for creators.
- **Test requirements:** Component and API integration tests for both entry paths, generation context, status persistence and edit preservation; accessibility and responsive visual regression coverage; browser E2E coverage for recommended-idea and own-topic journeys when browser testing is authorized; generation-quality fixtures across representative niche/language/platform contexts.
- **Priority:** P0. **Complexity:** L.
- **References:** `DESIGN.md` sections 4–8; `DESIGN_SYSTEM.md`; `SCREEN_INVENTORY.md` APP-01/05/06/15/16; `USER_FLOWS.md` sections 3–4; `PRD.md` FR-5, FR-7 and section 10.5; Stitch project `projects/3503066722097683519`.
- **Definition of Done:** Product owner approves the revised Stitch screens and copy; the recommended and own-topic journeys are demonstrable end to end; generated output is useful enough for creator review; implementation, review and QA evidence are recorded.

#### CRE-02 — Add explicit coarse location context and consent

- **Description:** Add creator-controlled country, region and optional city context for local relevance without collecting or exposing exact coordinates.
- **Business objective:** Make regional recommendations useful for creators in Bihar and other states while preserving trust for creators with limited connectivity or privacy concerns.
- **Technical implementation:** Extend the creator profile contract and persistence with coarse location scope, consent state and source (`manual` or `approximate`); support country fallback; expose read/update/remove operations; never persist raw coordinates, IP-derived location or browser permission results as exact location; invalidate relevant recommendation context when the setting changes.
- **Dependencies:** CRE-01, FE-01, FE-07.
- **Acceptance criteria:** A creator can manually select country and optionally region/city; approximate location is an explicit one-time opt-in; declining or removing location never blocks the product; API responses expose only the displayable coarse label and scope; unauthorized profile access is rejected; profile edits are ownership-scoped and versioned.
- **Test requirements:** Contract, validation, ownership, privacy-redaction and profile-version tests; tests for permission declined/unavailable and country-only fallback; no browser permission test is required for this task.
- **Priority:** P0. **Complexity:** M.
- **References:** `DESIGN.md` local pulse and rural-first pipeline sections; `USER_FLOWS.md` sections 2 and 3.3; `DESIGN_DECISIONS.md` UX-011, UX-014 and UX-016.
- **Definition of Done:** Coarse location is editable/removable, privacy boundaries are evidenced, and the design does not require exact geolocation.

#### RS-04 — Build the local pulse and evidence coverage boundary

- **Description:** Create a bounded local-pulse service that turns permitted current research signals into attributable, freshness-aware regional context for recommendations.
- **Business objective:** Give Gemini reliable local evidence without presenting unsupported claims as current trends.
- **Technical implementation:** Aggregate permitted source signals by coarse location, niche, language and platform; apply city → region → country fallback; return source links, publication/update dates, coverage level and uncertainty; distinguish observed facts from derived candidate angles; cache bounded results for slow connections; return explicit weak, stale, empty and source-outage states.
- **Dependencies:** RS-03, REC-01, CRE-02.
- **Acceptance criteria:** Local pulse results are attributable and freshness-aware; insufficient local evidence falls back to a broader scope with an explanation; source outages do not create fabricated trends; result size and source text are bounded; creator-specific location data is not leaked into global research records; repeated requests are idempotent and cache-safe.
- **Test requirements:** Unit and service tests for scope fallback, freshness, weak evidence, source outage, empty results, bounded payloads, cache behavior and provenance; API authorization tests where creator context is involved.
- **Priority:** P0. **Complexity:** L.
- **References:** `DESIGN.md` local pulse; `USER_FLOWS.md` sections 3 and 3.2; `DESIGN_DECISIONS.md` UX-012 and UX-014; `SCREEN_INVENTORY.md` APP-18.
- **Definition of Done:** The API can provide a safe local-pulse response or an honest limitation state for every supported location scope.

#### AI-04 — Orchestrate grounded angle selection and script expansion

- **Description:** Separate current-signal interpretation from creator-specific script generation and expose the pipeline as meaningful progress states.
- **Business objective:** Make it clear how a recommendation becomes a usable next-day script while preventing Gemini from inventing local trend claims.
- **Technical implementation:** Define structured inputs/outputs for bounded local evidence, candidate angle selection, one-sentence creator brief, language/platform/duration defaults, three hooks, spoken script and CTA; require source references and uncertainty on interpreted angles; carry safety/language checks through generation; preserve idempotency, credit behavior and recoverable failure state from AI-03.
- **Dependencies:** AI-03, RS-04, LANG-02, SAFE-01.
- **Acceptance criteria:** Gemini receives only the bounded evidence bundle plus creator context; observed facts and model interpretation remain distinguishable; own-topic generation works without local evidence; output matches selected language, platform and duration; progress reports “Finding the angle”, “Writing your words” and “Checking the script”; unsupported-claim or weak-evidence states are actionable; retries do not duplicate credits or drafts.
- **Test requirements:** Contract and provider-fake tests for both recommended-idea and own-topic paths, evidence grounding, source citation retention, weak coverage, language/duration fidelity, safety review, idempotency and retry/refund behavior; Gemini integration remains opt-in.
- **Priority:** P0. **Complexity:** L.
- **References:** `DESIGN.md` local pulse and rural-first pipeline; `USER_FLOWS.md` sections 3.2 and 3.3; `DESIGN_DECISIONS.md` UX-012, UX-013 and UX-018.
- **Definition of Done:** The generation operation has a testable two-stage contract and produces a reviewable, grounded script without requiring a complex prompt.

#### FE-09 — Implement the rural-first new-script experience

- **Description:** Replace the dense multi-decision script entry with a simple five-step flow that uses onboarding defaults and plain regional-language-first copy.
- **Business objective:** Help creators with limited bandwidth or lower comfort with long English forms move from an idea to a recording-ready script without confusion.
- **Technical implementation:** Build the five steps: choose an idea, say what you want to say, confirm duration, create the script and review/save for tomorrow; show one primary action per step; use cached context and text-first loading; preserve typed content across retry; show local-pulse scope/freshness and meaningful generation phases; keep voice input as a non-blocking future affordance.
- **Dependencies:** FE-08, CRE-02, RS-04, AI-04.
- **Acceptance criteria:** Recommended-idea and own-topic paths are clear; language/platform/audience defaults are carried forward; duration choices are simple; the output promise is visible before generation; the creator can edit hooks/script/CTA and save for tomorrow; weak, loading, retry and failure states are plain-language and non-destructive; Hindi/Bhojpuri or the selected language is primary in labels/examples; responsive Stitch layouts preserve 44px targets and one clear action.
- **Test requirements:** Component, accessibility, API integration and responsive contract tests for both paths, default propagation, preserved drafts, progress/error states and status persistence; browser E2E and visual review are required only when browser testing is authorized.
- **Priority:** P0. **Complexity:** L.
- **References:** `DESIGN.md` rural-first script pipeline; `USER_FLOWS.md` section 3.3; `DESIGN_REVIEW.md`; `SCREEN_INVENTORY.md` APP-17/18/19; Stitch project `projects/3503066722097683519`.
- **Definition of Done:** Product owner approves the frozen Stitch design; both paths are understandable in the selected language; the complete flow is implemented with non-browser evidence and browser validation deferred only when explicitly disallowed.

## E11 — Observability, security and abuse prevention

### Story E11-S1 — Make behavior diagnosable and safe

#### OBS-01 — Implement structured logs, metrics and correlation

- **Description:** Add request, operation, job, provider, database and cache telemetry with safe redaction.
- **Business objective:** Diagnose failures and monitor free-provider/resource constraints before creator trust is damaged.
- **Technical implementation:** JSON logs with request/operation IDs, endpoint latency/error metrics, queue depth/retries/stalls, provider quota/latency, cache hit rate and health metrics.
- **Dependencies:** INF-01, API/worker skeleton.
- **Acceptance criteria:** A generation can be traced request → queue → worker → provider → persistence without full prompts or secrets; dashboards expose required signals.
- **Test requirements:** Redaction tests, correlation propagation and metric emission tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 20–21; `DEFINITION_OF_DONE.md`.
- **Definition of Done:** Runbook can identify common failure classes from telemetry.

#### SEC-01 — Implement authorization, rate limits and privacy controls

- **Description:** Protect creator-owned resources, auth endpoints, generation/payment actions and sensitive data paths.
- **Business objective:** Preserve creator trust and prevent abuse of limited AI/provider resources.
- **Technical implementation:** Ownership guards, role separation, Redis counters with fail-closed security limits, input validation, SSRF/source URL controls, redaction, retention/anonymization jobs and audit events.
- **Dependencies:** ID-01, DB-02, OBS-01.
- **Acceptance criteria:** Cross-creator access is rejected; auth/generation/payment abuse is throttled; secrets and sensitive payloads are absent from logs; deletion policy is executable.
- **Test requirements:** Security tests for IDOR, auth abuse, injection, SSRF, secret leakage, rate limits and deletion/anonymization.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 18–19; `DATABASE_DESIGN.md` section 9; `PRD.md` safety/privacy requirements.
- **Definition of Done:** Security review has no open P0/P1 findings.

## E12 — Testing and quality assurance

### Story E12-S1 — Validate the complete MVP

#### QA-01 — Build unit, integration and contract test suites

- **Description:** Establish test coverage for domain rules, repositories, queues, auth, APIs, provider ports, scoring, credits and cache invalidation.
- **Business objective:** Make core behavior safe to change in a modular monolith.
- **Technical implementation:** Use fakes for providers; MongoDB/Redis test services; OpenAPI contract checks; deterministic fixtures and clock control.
- **Dependencies:** INF-03, DB-02, API modules as delivered.
- **Acceptance criteria:** All P0 modules have unit and integration coverage; API contracts fail on breaking changes; flaky tests are tracked and eliminated.
- **Test requirements:** This task is itself the test suite; publish coverage and failure artifacts.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` section 23; `DEFINITION_OF_DONE.md`.
- **Definition of Done:** CI runs the suites on every change.

#### QA-02 — Build full journey E2E and UI regression coverage

- **Description:** Automate signup → onboarding → feed → evidence → generation → library/status → credits, plus search and failure paths.
- **Business objective:** Prove that the product solves the complete creator workflow, not isolated endpoints.
- **Technical implementation:** Seed deterministic test creator/research; run mobile and desktop viewport tests; capture visual snapshots for approved Stitch references; mock provider failures.
- **Dependencies:** FE-01, FE-02, FE-03, FE-04, FE-05, FE-07, AI-03.
- **Acceptance criteria:** Happy path and key recovery paths pass; visual diffs are reviewed; direct publishing is absent; no test uses another creator’s data.
- **Test requirements:** Playwright/Cypress-style E2E, accessibility scan and visual regression.
- **Priority:** P0. **Complexity:** L.
- **References:** `USER_FLOWS.md`; `SCREEN_INVENTORY.md`; `DESIGN_REVIEW.md`; `DEFINITION_OF_DONE.md`.
- **Definition of Done:** Release candidate passes journey suite on supported breakpoints.

#### QA-03 — Run performance, resilience and cost tests

- **Description:** Baseline feed/search latency, queue throughput, provider concurrency, cache behavior, MongoDB indexes and free-model budget.
- **Business objective:** Ensure the free/open-source-first MVP is responsive and financially bounded.
- **Technical implementation:** Load fixtures at expected MVP scale; test Redis outage, MongoDB slowdowns, worker crash, provider timeout/quota and retry storms; document targets and observed limits.
- **Dependencies:** OBS-01, REC-03, AI-03, CR-02.
- **Acceptance criteria:** Agreed latency/error/queue targets are met or exceptions are accepted; no retry storm or double charge occurs; provider budget is enforced.
- **Test requirements:** Load, chaos/failure and budget-cap tests.
- **Priority:** P0. **Complexity:** L.
- **References:** `ENGINEERING_DESIGN.md` sections 17, 21, 24; `PRD.md` launch criteria.
- **Definition of Done:** Performance and cost baseline is attached to release evidence.

#### QA-04 — Execute multilingual and AI quality review

- **Description:** Run the fixed evaluation set and human review for all launch languages, representative niches, safety cases and script duration.
- **Business objective:** Prevent low-quality regional-language output from undermining trust.
- **Technical implementation:** Compare outputs by prompt/model version; record language fidelity, naturalness, mixed-language rate, unsupported claims, duration compliance and safety flags.
- **Dependencies:** LANG-02, AI-03, SAFE-01.
- **Acceptance criteria:** Thresholds are met or language-specific limitations are explicitly surfaced and accepted; failed outputs do not silently reach the user as clean drafts.
- **Test requirements:** Golden-set, human rubric and regression evaluation.
- **Priority:** P0. **Complexity:** L.
- **References:** `PRD.md` quality metrics, risks and launch criteria; `ENGINEERING_DESIGN.md` sections 10, 13 and 23.
- **Definition of Done:** Quality report is approved before launch.

## E13 — Deployment and production readiness

### Story E13-S1 — Operate the MVP safely

#### REL-01 — Build container deployment and environment configuration

- **Description:** Package web, API and worker as separate containers with secure environment-based configuration and health checks.
- **Business objective:** Deploy the modular monolith components independently while keeping MVP operations simple.
- **Technical implementation:** Multi-stage builds, non-root runtime where practical, readiness/liveness checks, secret injection, provider-disabled staging mode and separate worker concurrency config.
- **Dependencies:** INF-02, OBS-01, SEC-01.
- **Acceptance criteria:** Staging deploy starts all units; health checks fail correctly; secrets are not baked into images; rollback procedure is documented.
- **Test requirements:** Container smoke, health, configuration and rollback tests.
- **Priority:** P0. **Complexity:** M.
- **References:** `ENGINEERING_DESIGN.md` sections 22, 24; `DEFINITION_OF_DONE.md`.
- **Definition of Done:** Repeatable staging deployment succeeds from CI.

#### REL-02 — Implement backups, restore and operational runbooks

- **Description:** Establish MongoDB/Redis backup policy, restore test, migration runbook, incident runbook and provider-outage procedure.
- **Business objective:** Protect creator data and make failures recoverable before real users depend on the system.
- **Technical implementation:** Backup encryption/access controls; restore into isolated environment; queue replay/reconciliation instructions; data deletion and retention procedures.
- **Dependencies:** DB-01, OBS-01, SEC-01, REL-01.
- **Acceptance criteria:** Restore test passes; migration and rollback/forward-recovery steps are documented; incident response includes credits and provider failures.
- **Test requirements:** Scheduled restore drill and runbook walkthrough.
- **Priority:** P0. **Complexity:** M.
- **References:** `DATABASE_DESIGN.md` sections 9–10; `ENGINEERING_DESIGN.md` sections 18, 22 and 24.
- **Definition of Done:** Production-readiness review signs off backup and recovery evidence.

#### REL-03 — Execute launch readiness review

- **Description:** Assemble final release evidence, known limitations, launch metrics, support process and rollback decision.
- **Business objective:** Launch only when the MVP is useful, safe, observable and within the free-provider cost envelope.
- **Technical implementation:** Verify PRD launch criteria, P0 task completion, open defect severity, dashboards, backups, security, multilingual quality and manual support path.
- **Dependencies:** QA-01, QA-02, QA-03, QA-04, REL-01, REL-02.
- **Acceptance criteria:** All MVP launch criteria are evidenced; no unaccepted P0/P1 defect remains; explicit go/no-go is recorded.
- **Test requirements:** Release-candidate smoke and final E2E run.
- **Priority:** P0. **Complexity:** M.
- **References:** `PRD.md` section 17; `DEFINITION_OF_DONE.md`; `IMPLEMENTATION_ROADMAP.md`.
- **Definition of Done:** Product owner and engineering lead approve the release decision.

## E14 — Post-MVP planning only

These are not implementation commitments for the MVP: trend alerts, behavior-based personalization, advanced platform optimization, script variants, performance loops, calendar/planner, direct publishing, more languages, competitor tracking, published analytics, AI voice, thumbnails, repurposing, forecasting and collaboration. Creator-recorded narration and template video export are separately planned in E15.

#### P1-01 — Direct publishing feasibility discovery

- **Description:** Validate platform APIs, OAuth scopes, media requirements, review and policy constraints before any publishing implementation.
- **Business objective:** Determine whether direct publishing is commercially and technically viable after MVP.
- **Dependencies:** REL-03 and platform-provider review.
- **Acceptance criteria:** Platform-by-platform feasibility decision and security/privacy design exist before implementation is authorized.
- **Test requirements:** API sandbox and policy test plan.
- **Priority:** P1. **Complexity:** L.
- **References:** `PRD.md` FR-12 and roadmap; `ENGINEERING_DESIGN.md` platform integration boundary.
- **Definition of Done:** Separate post-MVP approval is obtained.

## E15 — Free-first script-to-video pilot

**Execution hold:** P0 AI-05 below precedes every pending video task.

### AI-05 — Groq primary / Gemini fallback (P0 urgent override)

- **Objective:** Default all existing remote generative features to Groq with automatic Gemini failover, preserving functionality and charges. See `../engineering/AI_PROVIDERS.md`.
- **Priority:** P0 highest, ahead of all other pending work.
- **Subtasks:** AI-05.1 path inventory/shared routing; AI-05.2 Groq structured adapter/failover; AI-05.3 API and worker wiring; AI-05.4 environment/Compose/docs; AI-05.5 tests/build/live verification. Statuses in `TASK.md`.
- **Dependencies:** Existing AI-01–AI-04 and discovery contracts; configured Groq credential for live verification. No video dependency.
- **Acceptance criteria:** Groq first for browse/search/ranking, angles and scripts/worker; Gemini on HTTP/output failures with bounded calls/timeouts; actual provider telemetry; no duplicate enqueue/reservation/charge; both-provider failures preserve recovery; explicit fake/legacy modes remain; server-only secrets.
- **Test requirements:** Groq success, 429/5xx, timeout, missing credential, invalid JSON/schema/truncation, fallback success/failure, all capabilities, worker parity and operation accounting; full checks and builds. No browser testing in this chat.
- **Definition of Done:** Implementation evidence, independent review, required release QA and one live Groq-key smoke recorded. Mocked tests alone do not imply approval/completion.

### Video pilot tasks (after AI-05)

Product scope and architecture: [`VIDEO_PILOT.md`](../product/VIDEO_PILOT.md). All tasks are planning entries, not completed implementation. P1 denotes the next additive release; existing MVP reviews and launch gates remain unchanged.

#### VID-01 — Validate free toolchain and design the video journey

- **Description:** Review Remotion Free License eligibility, FFmpeg build configuration, Whisper model/fonts and local hardware; prepare Stitch desktop/mobile screens for recording/upload, preview, caption edits, export progress/failure and Library download/expiry.
- **Dependencies:** FE-09, FE-04; review current script-generation reliability findings.
- **Acceptance criteria:** No required paid API; license/eligibility record and reproducible local media benchmark exist. If Remotion is ineligible, document a free renderer alternative before adoption. Product owner reviews concrete Stitch screens before UI implementation.
- **Test requirements:** Local toolchain smoke with sample audio and 30/60-second outputs; hardware, resource use and language limitations recorded. No browser tests in this chat.
- **Priority:** P1. **Complexity:** M.
- **Definition of Done:** Toolchain decision and design review are recorded; dependencies/risks are explicit.

#### VID-02 — Define video projects, media and ownership contracts

- **Description:** Add versioned scene/caption/export schemas, typed API contracts, Mongo validators/indexes and portable local media storage.
- **Dependencies:** VID-01, DB-02, ID-01.
- **Acceptance criteria:** Project references an approved saved script revision; ownership applies to projects, upload/download and exports; media bytes stay outside MongoDB. Validate template enums, bounded text/scene counts, revisions, uploaded content and duration. Specify MIME/size/duration limits and safe filenames; reject arbitrary remote media URLs.
- **Test requirements:** Repository/API authorization, malformed media, orphan references, migration reruns and stale-revision conflicts.
- **Priority:** P1. **Complexity:** L.
- **Definition of Done:** Contracts, storage adapter and database integration tests pass.

#### VID-03 — Build deterministic diagram templates and video renderer

- **Description:** Implement React/SVG opening, steps, comparison, timeline and closing templates; shared Remotion preview composition and FFmpeg-backed MP4 export, or the approved free renderer alternative.
- **Dependencies:** VID-02.
- **Acceptance criteria:** 30–60-second vertical 720×1280 video with readable native-script text and captions; deterministic scene planning works with Gemini disabled. Template data cannot execute code; no invented numbers/claims; no cropped text or silent audio truncation.
- **Test requirements:** Render actual 30/60-second fixtures; inspect duration, dimensions, audio presence and frames, including long labels and Devanagari shaping.
- **Priority:** P1. **Complexity:** L.
- **Definition of Done:** Real exported files and frame/media inspection evidence are retained with template versions.

#### VID-04 — Process creator narration and synchronized captions

- **Description:** Add audio normalization and self-hosted Whisper transcription with editable phrase timings, original-language text and manual correction/timing fallback.
- **Dependencies:** VID-02.
- **Acceptance criteria:** No hosted transcription or voice API required. Measured audio drives timing; captions follow speech, stay in bounds and support corrections. Out-of-range narration gives an actionable response without truncation. Hindi/Hinglish evaluated; unsupported regional accuracy disclosed through capability handling.
- **Test requirements:** Recorded Hindi/Hinglish samples, silence/noise, language mismatch, corrupt audio, overlapping/out-of-range caption timings and native-speaker review; benchmark named hardware.
- **Priority:** P1. **Complexity:** L.
- **Definition of Done:** Offline transcription/caption fixtures and quality limitations are documented; no blanket regional-language accuracy claim.

#### VID-05 — Orchestrate durable exports and enforce free-pilot limits

- **Description:** Add isolated BullMQ export jobs, stage/progress persistence, caching, allowance reservations, retries, cancellation, retention and capacity controls.
- **Dependencies:** VID-03, VID-04, CR-02, OBS-01.
- **Acceptance criteria:** Proposed defaults: three successful exports/month, one active export/creator, one worker and seven-day generated-media retention. Configure global render/disk/queue caps from benchmarks. Idempotency prevents duplicate renders/allowance charges; failures release once; restarts recover; caption edits reuse narration/transcription; re-downloads do not render. Keep script credits separate. Expiry/account deletion removes files and references consistently.
- **Test requirements:** Concurrent reservations, redelivery, crash/restart, disk exhaustion, provider-disabled run, cancellation races, retention and cross-creator access tests.
- **Priority:** P1. **Complexity:** L.
- **Definition of Done:** Durable export and usage lifecycle demonstrated with operational metrics/runbook; no paid-service dependency.

#### VID-06 — Integrate recording, preview, editing and video download UI

- **Description:** Add Create video from approved script, record/upload, editable preview, export progress and Library download/expiry controls using reviewed Stitch screens.
- **Dependencies:** VID-01 design approval, VID-05, FE-03, FE-04, FE-06.
- **Acceptance criteria:** Three-screen flow is usable on mobile; permission denial supports upload; recording uploads only after confirmation. Draft edits persist; pending actions cannot duplicate work; queued/transcribing/rendering/failure/success are distinct; leaving/reopening resumes status. Correct captions/scene text, export and re-download; show limits/expiry without exposing internal IDs.
- **Test requirements:** Component, accessibility, responsive/visual and E2E recorded-audio-to-download coverage; tests must exercise rendered behavior, not source strings. Browser execution deferred in this chat and tracked as outstanding release evidence.
- **Priority:** P1. **Complexity:** L.
- **Definition of Done:** Design alignment, rendered UI and persisted full journey validated before release.

#### VID-07 — Validate and release the bounded video pilot

- **Description:** Compile output quality, language, performance, usage, license and recovery evidence; define invited cohort/global cap and separately gated future paid expansion.
- **Dependencies:** VID-05, VID-06; existing security/release gates remain required.
- **Acceptance criteria:** End-to-end export works with paid providers and Gemini disabled; no P1 defect or unverified required journey is waived silently. Measure runtime/memory/disk and caption readability/sync on actual files; publish limitations and a go/no-go decision. No automatic billing or paid adapter activation.
- **Test requirements:** 30/45/60-second fixture matrix, language human review, render load, abuse/ownership, budget failure, restoration and retained media evidence.
- **Priority:** P1. **Complexity:** M.
- **Definition of Done:** Product and engineering approve pilot evidence and resource cap; remaining browser evidence is completed outside this chat before release.
