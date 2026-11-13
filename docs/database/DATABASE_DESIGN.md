# CreatorPulse Database Design

**Status:** Draft for database approval  
**Phase:** 3 — Database design  
**Date:** 2026-11-10  
**Source of truth:** Approved PRD and engineering design

## 1. Database strategy

MongoDB is the MVP system of record. The model uses bounded collections, explicit application-owned references, schema validation for critical fields and indexes designed around the approved API query paths.

`SCHEMA.sql` is provided because the requested artifact name requires it, but it is not SQL. It contains MongoDB shell-compatible JavaScript-style collection validators and index definitions. MongoDB has no relational foreign keys; referential integrity is enforced by application services, repository checks, unique indexes and periodic integrity checks.

### MVP storage decisions

- MongoDB Community is the primary datastore.
- Redis remains a cache/queue/rate-limit store and is not represented in this database schema.
- Embeddings use a replaceable `VectorStore` abstraction and are stored with content records only if the selected MongoDB deployment supports the required vector index. Otherwise, the embedding fields remain portable for a later pgvector migration.
- No connected social-platform account collection is required for MVP because publishing and published-content analysis are post-MVP.
- Audience preferences are embedded in the creator profile because they are owned by one creator and read with onboarding/preferences.
- High-volume or independently queried relationships—recommendations, feedback, ledger entries, evidence and audit events—use separate collections.

## 2. Collection inventory

| Collection              | Purpose                                                  | MVP status                        |
| ----------------------- | -------------------------------------------------------- | --------------------------------- |
| `users`                 | Identity, credentials and account lifecycle              | Required                          |
| `auth_sessions`         | Refresh-token sessions and revocation                    | Required                          |
| `creator_profiles`      | Niche, audience, platform and language preferences       | Required                          |
| `niches`                | Controlled niche taxonomy                                | Required                          |
| `languages`             | Supported language catalog                               | Required                          |
| `platforms`             | Supported short-form platforms                           | Required                          |
| `content_topics`        | Normalized topic concepts and embeddings                 | Required                          |
| `source_documents`      | Source provenance and normalized source content metadata | Required                          |
| `trend_signals`         | Time-varying trend/freshness/competition observations    | Required                          |
| `content_ideas`         | Creator-facing idea records                              | Required                          |
| `idea_evidence`         | Evidence links and signal references for ideas           | Required                          |
| `idea_scores`           | Versioned explainable opportunity scores                 | Required                          |
| `idea_recommendations`  | Feed/search ranking results and impressions              | Required                          |
| `idea_assets`           | Hooks, scripts and CTAs generated for an idea            | Required                          |
| `saved_ideas`           | Creator library/save state                               | Required                          |
| `idea_status_events`    | Workflow status history                                  | Required                          |
| `creator_feedback`      | Optional creator feedback                                | Required                          |
| `ai_operations`         | Asynchronous AI operation state and provider metadata    | Required                          |
| `subscription_plans`    | Configurable free/paid plan definitions                  | Required                          |
| `creator_subscriptions` | Creator entitlement/subscription state                   | Required                          |
| `credit_ledger`         | Immutable credit reservations, consumption and refunds   | Required                          |
| `payment_transactions`  | Mock/manual and future provider transaction references   | Required for entitlement boundary |
| `audit_logs`            | Security and sensitive business-action trail             | Required                          |

## 3. Modeling conventions

### Identifiers

Use UUIDv4 strings for externally visible IDs, stored as strings for portability between MongoDB and future stores. Internal MongoDB `_id` values may be the same UUID string. UUIDs prevent enumeration and avoid coupling API contracts to MongoDB ObjectId or database sequence behavior.

### References

References use `<entity>Id` fields. They are not MongoDB-enforced foreign keys. Application services must verify referenced records, ownership and lifecycle state before writes. Deletion must use explicit policies rather than cascading blindly.

### Timestamps

All collections use `createdAt` and `updatedAt` UTC dates unless noted. Event/ledger collections also use immutable event timestamps. Server time is authoritative.

### Soft deletion

- `users`, `creator_profiles`, `content_ideas`, `idea_assets` and `saved_ideas` use `deletedAt: null | Date` where recovery or auditability matters.
- Unique active-record indexes use partial filters where supported.
- `auth_sessions`, `ai_operations`, `credit_ledger` and `audit_logs` are not soft-deleted; retention jobs archive or purge according to policy.
- Reference taxonomies are deactivated with `isActive`, not deleted.

## 4. Collection designs

### 4.1 `users`

Identity and account lifecycle. One user maps to one creator profile for MVP.

Required fields: `_id`, `emailNormalized`, `passwordHash`, `role`, `status`, `createdAt`, `updatedAt`. Optional fields: `emailVerifiedAt`, `lastLoginAt`, `deletedAt`, `displayName`.

Constraints: active email is unique; password hashes are never returned by repositories; status is one of `pending`, `active`, `suspended`, `deleted`; role is `creator` or `admin`.

### 4.2 `auth_sessions`

Refresh-token sessions. Required fields: `_id`, `userId`, `refreshTokenHash`, `issuedAt`, `expiresAt`, `lastUsedAt`, `createdAt`, `updatedAt`. Optional `revokedAt`, `revokeReason`, `userAgentHash`, `ipHash`.

Constraints: token hashes are unique; expired sessions are removable by TTL policy; user ownership is checked before revoke.

### 4.3 `creator_profiles`

Creator preferences and onboarding context. Required fields: `_id`, `userId`, `nicheIds`, `platformIds`, `languageIds`, `audience`, `profileVersion`, `createdAt`, `updatedAt`. Optional `contentStyle`, `creatorGoal`, `experienceLevel`, coarse `location`, `locationConsent` and `deletedAt`.

`audience` is a bounded embedded object containing audience description, age bands, geography and interests where supplied. It must not contain unrestricted sensitive personal data.

Constraints: one active profile per user; IDs must resolve to active taxonomy records; `profileVersion` increments when recommendation-affecting preferences change.

`location` contains only a two-letter country code, optional bounded region code/city, a `scope` (`country`, `region` or `city`) and a `source` (`manual` or `approximate`). Raw coordinates, IP-derived location and browser permission payloads are not stored. A declined consent state stores no location object and does not block onboarding or recommendations.

### 4.4 `niches`, `languages`, `platforms`

Small reference collections. Each has `_id`, stable `code`, display names, `isActive`, `sortOrder`, `createdAt`, `updatedAt`. Languages additionally include `script`, `supportsHinglish` and optional evaluation metadata. Platforms include `contentFormat` and `isMvpSupported`.

Seed MVP records are the six PRD niches, seven languages and Instagram/YouTube/Facebook short-form platform variants.

### 4.5 `content_topics`

Normalized topic concepts used for research, retrieval and idea generation. Required fields: `_id`, `canonicalKey`, `canonicalTitle`, `languageIds`, `nicheIds`, `createdAt`, `updatedAt`. Optional `aliases`, `description`, `embedding`, `embeddingModel`, `embeddingVersion`, `embeddingDimensions`, `embeddedAt`, `searchText`, `isActive`, `lastEnrichedAt`.

Constraints: `canonicalKey` is unique; embedding dimensions and model version are validated by the vector-store adapter; source text is not treated as trusted instructions.

### 4.6 `source_documents`

Source provenance and normalized source metadata. Required fields: `_id`, `sourceType`, `sourceName`, `canonicalUrl`, `observedAt`, `createdAt`, `updatedAt`. Optional `publishedAt`, `title`, `excerpt`, `languageId`, `rawContentHash`, `retrievalStatus`, `licenseNote`, `expiresAt`.

`sourceType` values include `official_api`, `rss`, `public_web`, `manual_seed`. Store only content allowed by source terms and retention policy. Avoid retaining full pages when a title, excerpt, URL and hash are sufficient.

### 4.7 `trend_signals`

Time-bounded observations derived from source documents. Required fields: `_id`, `topicId`, `sourceDocumentId`, `signalType`, `observedAt`, `value`, `valueUnit`, `createdAt`, `updatedAt`. Optional `platformId`, `languageId`, `nicheId`, `confidence`, `windowStart`, `windowEnd`, `rawMetricName`.

Signal types include `momentum`, `volume`, `freshness`, `competition`, `source_count`. Values are observations, not guaranteed outcomes. A unique deduplication key prevents repeated ingestion of the same source observation.

### 4.8 `content_ideas`

Creator-facing idea records. Required fields: `_id`, `topicId`, `title`, `summary`, `languageId`, `platformId`, `nicheId`, `origin`, `createdAt`, `updatedAt`. Optional `audienceAngle`, `recommendedAction`, `canonicalKey`, `searchText`, `embedding`, `embeddingModel`, `embeddingVersion`, `embeddingDimensions`, `embeddedAt`, `expiresAt`, `deletedAt`.

`origin` is `research`, `manual_search`, `recommendation`, or `generated_variant`. Ideas are reusable system records; creator ownership is represented by saved/recommendation records, not duplicated idea documents.

### 4.9 `idea_evidence`

Evidence attached to an idea. Required fields: `_id`, `ideaId`, `sourceDocumentId`, `evidenceType`, `summary`, `observedAt`, `createdAt`, `updatedAt`. Optional `trendSignalId`, `relevance`, `limitations`, `rank`.

An evidence record must point to a source document and may point to a signal. The API only returns safe source metadata and summaries.

### 4.10 `idea_scores`

Versioned explainable score snapshots. Required fields: `_id`, `ideaId`, `scoreVersion`, `overallScore`, `label`, `dimensions`, `explanation`, `coverage`, `createdAt`, `updatedAt`. `dimensions` contains relevance, trendMomentum, freshness and competition, each with a numeric score and explanation. `coverage` records source count, staleness and uncertainty.

Only one current score is selected by `isCurrent: true`; historical scores remain for audit/evaluation. A unique index prevents multiple current scores per idea/version policy.

### 4.11 `idea_recommendations`

Materialized recommendation/feed results. Required fields: `_id`, `creatorId`, `ideaId`, `feedDate`, `surface`, `rank`, `scoreSnapshotId`, `createdAt`, `updatedAt`. Optional `reason`, `seenAt`, `openedAt`, `savedAt`, `dismissedAt`, `profileVersion`, `rankingVersion`.

`surface` is `daily_feed` or `search`. Search recommendations may expire sooner. A deterministic uniqueness key prevents duplicate daily-feed entries for the same creator, date, idea and surface.

### 4.12 `idea_assets`

Generated hooks, scripts and CTAs. Required fields: `_id`, `ideaId`, `creatorId`, `assetType`, `languageId`, `platformId`, `content`, `generationId`, `createdAt`, `updatedAt`. Optional `durationSeconds`, `tone`, `isCurrent`, `safetyFlags`, `deletedAt`.

Assets are creator-scoped even when the underlying idea is reusable. The content is labeled AI-generated at the API layer.

### 4.13 `saved_ideas`

Creator library state. Required fields: `_id`, `creatorId`, `ideaId`, `savedAt`, `createdAt`, `updatedAt`. Optional `bookmarkLabel`, `deletedAt`.

One active save per creator and idea. Removing a save sets `deletedAt` to preserve analytics and restore behavior.

### 4.14 `idea_status_events`

Workflow history for manual statuses. Required fields: `_id`, `creatorId`, `ideaId`, `status`, `occurredAt`, `createdAt`, `updatedAt`. Optional `note`, `source`.

Status values are `saved`, `planned`, `scripted`, `published`, `dismissed`. Current status can be derived from the latest event or maintained on `saved_ideas` if query profiling proves necessary. MVP publishing is manual.

### 4.15 `creator_feedback`

Optional feedback submitted by a creator. Required fields: `_id`, `creatorId`, `ideaId`, `createdAt`, `updatedAt`. Optional `recommendationId`, `rating`, `reasonCodes`, `comment`, `languageId`, `platformId`, `deletedAt`.

Reason codes include `too_generic`, `already_covered`, `wrong_language`, `wrong_audience`, `not_timely`, `unsafe`, `other`. Feedback is not required for workflow continuation.

### 4.16 `ai_operations`

Asynchronous AI operation state. Required fields: `_id`, `creatorId`, `operationType`, `status`, `idempotencyKey`, `requestedAt`, `createdAt`, `updatedAt`. Optional `ideaId`, `languageId`, `platformId`, `provider`, `model`, `promptVersion`, `attempts`, `startedAt`, `completedAt`, `failureCode`, `failureMessage`, `usage`, `resultAssetIds`.

Unique constraint: `(creatorId, idempotencyKey)` for active/recent operations. Provider payloads are not stored by default; sensitive prompt/output retention is minimized.

### 4.17 `subscription_plans`

Configurable plan definitions. Required fields: `_id`, `code`, `name`, `monthlyCredits`, `isFree`, `isActive`, `createdAt`, `updatedAt`. Optional `priceMinor`, `currency`, `featureFlags`, `version`.

Plans are versioned rather than mutated in ways that rewrite historical entitlement interpretation.

### 4.18 `creator_subscriptions`

Creator entitlement state. Required fields: `_id`, `creatorId`, `planId`, `status`, `periodStart`, `periodEnd`, `creditsGranted`, `createdAt`, `updatedAt`. Optional `provider`, `providerSubscriptionId`, `cancelledAt`, `trialEndAt`, `metadata`.

Status values: `active`, `trialing`, `past_due`, `cancelled`, `expired`, `manual`. One effective subscription is selected by application rules; historical records remain.

### 4.19 `credit_ledger`

Immutable credit movements. Required fields: `_id`, `creatorId`, `entryType`, `amount`, `balanceAfter`, `occurredAt`, `createdAt`, `updatedAt`. Optional `operationId`, `subscriptionId`, `referenceKey`, `reason`, `expiresAt`.

### 4.20 `credit_balances`

An atomic per-creator balance gate for reservations. It is not a replacement for the immutable ledger: reservations first decrement this document with a conditional update, then append a ledger entry with the resulting `balanceAfter`. If ledger insertion fails, the balance update is compensated. The document is rebuilt from ledger history when first created.

Entry types: `grant`, `reserve`, `consume`, `release`, `refund`, `adjustment`, `expiry`. `amount` is signed by convention and `balanceAfter` is recorded for audit; application transactions prevent double settlement. A separate balance cache may be maintained, but the ledger is authoritative.

### 4.20 `payment_transactions`

Mock/manual and future provider transaction records. Required fields: `_id`, `creatorId`, `transactionType`, `status`, `amountMinor`, `currency`, `createdAt`, `updatedAt`. Optional `subscriptionId`, `provider`, `providerTransactionId`, `idempotencyKey`, `failureCode`, `metadata`, `completedAt`.

No payment credentials or card data are stored. MVP may create `manual` or `mock` transactions only.

### 4.21 `audit_logs`

Security and sensitive business-action trail. Required fields: `_id`, `eventType`, `occurredAt`, `createdAt`, `actorType`, `action`, `result`. Optional `actorId`, `targetType`, `targetId`, `requestId`, `ipHash`, `metadata`.

Do not store passwords, tokens, full prompts or unnecessary personal content. Audit records are append-only and retained according to the approved privacy policy.

## 5. Relationships and integrity

- `users 1—1 creator_profiles` for MVP.
- `users 1—N auth_sessions`.
- `creator_profiles N—N niches`, `languages` and `platforms` through ID arrays validated against reference collections.
- `content_topics 1—N trend_signals` and `content_ideas`.
- `source_documents 1—N trend_signals` and `idea_evidence`.
- `content_ideas 1—N idea_evidence`, `idea_scores`, `idea_assets`, `idea_status_events` and `creator_feedback`.
- `creators N—N content_ideas` through `saved_ideas` and `idea_recommendations`.
- `creators 1—N ai_operations`, `creator_subscriptions`, `credit_ledger`, `payment_transactions` and `audit_logs`.

Referential integrity is checked at write time. A scheduled integrity job reports orphaned references and invalid taxonomy IDs.

## 6. Query-oriented design

### Daily feed

Query `idea_recommendations` by `creatorId + feedDate + surface`, sort by `rank`, then fetch ideas, current scores and bounded evidence. The primary index supports this access path.

### Search

Use normalized `searchText` and the vector-store abstraction for semantic retrieval, then filter by active language/platform/niche and enrich with current scores/evidence. Do not scan all ideas.

### Library

Query `saved_ideas` by `creatorId`, active `deletedAt`, optional status derived from recent status events, and `updatedAt` cursor.

### Generation status

Query `ai_operations` by `creatorId + idempotencyKey` or operation ID. Results reference `idea_assets`; no polling query should load full prompt payloads.

### Credits

Read current entitlement and recent ledger entries by creator. Mutations use a MongoDB transaction where deployment topology supports it; otherwise use a single-writer/conditional-update strategy and idempotency keys.

## 7. JSON and flexible fields

Use bounded subdocuments for `audience`, score dimensions, usage metadata, feature flags and safe provider metadata. Do not use an unbounded `metadata` escape hatch for core business fields. Flexible fields must have documented owners, size limits and redaction rules.

MongoDB documents should remain below practical document-size limits; generated assets and evidence are separate documents to avoid unbounded idea documents.

## 8. Vector and full-text strategy

- Store embedding values with `content_topics` and optionally `content_ideas` through the `VectorStore` port.
- Record `embeddingModel`, `embeddingVersion`, `embeddingDimensions` and `embeddedAt`.
- Never mix vectors from incompatible models in one active index.
- Use MongoDB text/search capabilities where the selected deployment supports them; otherwise use normalized prefix/search fields for MVP and retain the adapter boundary.
- Re-embedding is a background job with versioned backfill and dual-read validation before cutover.
- Move to pgvector only after measured retrieval quality or scale justifies a second datastore.

## 9. Retention and deletion

- Expire authentication sessions by TTL/maintenance job.
- Expire stale source payloads according to source terms while retaining minimal provenance where legally permitted.
- Retain credit and payment audit records for financial reconciliation requirements.
- Allow creator deletion to soft-delete or anonymize creator-owned content, sessions, profiles, feedback and assets according to the privacy policy.
- Remove or anonymize embeddings associated with deleted creator-owned data.
- Keep audit records only as long as required for security, compliance and debugging.

## 10. Migration strategy

- Use versioned application migrations for reference seeds, validators and indexes.
- Migrations must be backward-compatible with the deployed API during rolling releases.
- Build indexes in controlled operations and monitor resource impact.
- Backfill embeddings, scores and recommendations through resumable BullMQ jobs.
- Never change a score or credit interpretation without recording a version.
- Test restore from backup before production launch.

## 11. Multi-tenant considerations

CreatorPulse is logically multi-tenant by creator/user ownership, not organization tenancy in MVP. Every creator-owned collection includes `creatorId` or `userId` and every repository query requires an ownership scope. If teams or agencies are added, introduce an explicit `workspaceId`/tenant boundary rather than inferring tenancy from user IDs.
