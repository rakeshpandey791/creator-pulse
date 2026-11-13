# CreatorPulse Epics and User Stories

**Status:** Draft for approval

## Epic E1 — Identity and creator context

### US-01 — Create and access an account

As a creator, I want to sign up, log in, refresh my session and recover access so that my workspace is private and persistent.

Acceptance criteria:

- Valid signup creates one user, one initial session and no duplicate active email.
- Login returns a session without exposing password or token material in logs or responses.
- Refresh rotates the refresh token; logout revokes the current session.
- Invalid credentials and recovery attempts use safe, actionable errors without revealing account existence.

### US-02 — Set creator context

As a creator, I want to select niche, audience, platform and language preferences so that my first feed is relevant without historical data.

Acceptance criteria:

- Required preferences validate and persist with a profile version.
- Multiple supported languages and platforms are supported.
- Unsupported combinations are explained rather than silently ignored.
- Changing recommendation-affecting preferences changes subsequent recommendation context.

## Epic E2 — Research and discovery

### US-03 — Receive daily ideas

As a creator, I want a daily feed so that I can choose what to create without starting from a blank page.

Acceptance criteria:

- Feed cards show title, language, niche, platform, opportunity label, score dimensions, rationale and credit implications.
- Recommendations are ranked from profile context and available research signals.
- Obvious duplicates are removed within the feed and previously seen items are distinguishable.
- No-data and stale-data states explain limitations and provide a fallback.

### US-04 — Search and investigate

As a creator, I want to search a topic and inspect evidence so that I can evaluate an idea before spending time creating it.

Acceptance criteria:

- Search supports topic/phrase, niche, language, platform and supported freshness/relevance filters.
- Idea detail shows evidence links, dates, signal types, score dimensions and uncertainty.
- Missing, stale, contradictory or unavailable sources are labeled.
- Ambiguous queries receive useful refinement guidance.

## Epic E3 — Idea execution

### US-05 — Generate a regional-language draft

As a creator, I want hooks, a 30–60 second script and CTAs in my selected language and platform context.

Acceptance criteria:

- Cost and current balance are visible before generation.
- Generation is asynchronous and returns an operation ID.
- Valid output is editable, labeled AI-generated, duration-guided and associated with the idea.
- Invalid, unsafe, mixed-language or unsupported-claim output is rejected or flagged and credits are reconciled correctly.

## Epic E4 — Idea workflow and learning

### US-06 — Save and manage ideas

As a creator, I want to save ideas and move them through saved, planned, scripted, published or dismissed states.

Acceptance criteria:

- Save/remove-save and status mutations are idempotent and ownership-protected.
- Saved ideas remain accessible with evidence, current score and generated assets.
- Published is explicitly manual and never implies direct publishing by CreatorPulse.

### US-07 — Give optional feedback

As a creator, I want to report that an idea is unsuitable so that the product team can improve recommendations.

Acceptance criteria:

- Feedback is optional and never blocks the journey.
- Structured reasons and free text are supported with privacy-safe storage.
- Submission confirms success and cannot expose another creator’s information.

## Epic E5 — Commercial controls

### US-08 — Control usage and subscription

As a creator, I want to understand credits, plans, renewal and limits before using expensive operations.

Acceptance criteria:

- Balance, operation cost, renewal period and limit behavior are visible.
- Reservation prevents accidental overspend and settlement/refund handles failure.
- Plan and entitlement changes are configurable without a client release.
- MVP payment may use mock/manual provider records; no card credentials are stored.
