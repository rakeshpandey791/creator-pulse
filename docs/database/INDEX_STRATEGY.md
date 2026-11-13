# CreatorPulse Index Strategy

Indexes are designed from the approved API and worker query paths. Every index must be verified with `explain()` against representative data before production.

## `users`

- Unique active email lookup: `{ emailNormalized: 1 }` with a partial filter for non-deleted users.
- Account administration: `{ status: 1, createdAt: -1 }`.

## `auth_sessions`

- Session lookup: `{ userId: 1, revokedAt: 1, expiresAt: 1 }`.
- Unique token hash: `{ refreshTokenHash: 1 }`.
- TTL/maintenance candidate: `{ expiresAt: 1 }`.

## `creator_profiles`

- Unique user profile: `{ userId: 1 }` with active-profile filter.
- Preference refresh/admin: `{ languageIds: 1, nicheIds: 1, updatedAt: -1 }` only if profiling proves useful; avoid premature multikey indexes.

## `password_resets`

- One-time token lookup: unique `{ tokenHash: 1 }`.
- Expiry cleanup: `{ expiresAt: 1 }` with TTL.

## Reference collections

- Unique stable code: `{ code: 1 }`.
- Active ordering: `{ isActive: 1, sortOrder: 1 }`.

## `content_topics`

- Unique canonical key: `{ canonicalKey: 1 }`.
- Filtered retrieval: `{ languageIds: 1, nicheIds: 1, isActive: 1, updatedAt: -1 }` if query plans require it.
- Text/search/vector indexes are deployment-specific and owned by the `VectorStore` adapter.

## `source_documents`

- Unique canonical source: `{ canonicalUrl: 1 }` where source identity is URL-based.
- Ingestion recency: `{ sourceType: 1, observedAt: -1 }`.
- Expiry maintenance: `{ expiresAt: 1 }`.
- Content hash dedupe: `{ rawContentHash: 1, sourceName: 1 }`.

## `trend_signals`

- Topic timeline: `{ topicId: 1, observedAt: -1 }`.
- Filtered platform/language trend retrieval: `{ platformId: 1, languageId: 1, signalType: 1, observedAt: -1 }`.
- Source dedupe: unique `{ sourceDocumentId: 1, topicId: 1, signalType: 1, observedAt: 1 }`.
- Worker freshness scans: `{ observedAt: 1, signalType: 1 }`.

## `content_ideas`

- Search/filter: `{ languageId: 1, platformId: 1, nicheId: 1, updatedAt: -1 }`.
- Active canonical idea dedupe: `{ canonicalKey: 1 }` with active filter.
- Expiry maintenance: `{ expiresAt: 1 }`.
- Vector/full-text indexes are created only by the selected adapter/deployment.

## `research_integrity_reports`

- Idempotent job/source report: unique `{ jobId: 1, sourceName: 1 }`.
- Source quality timeline: `{ sourceName: 1, observedAt: -1 }`.

## `research_ingestion_jobs`

- Persisted job idempotency: unique `{ _id: 1 }`.
- Recovery/status lookup: `{ updatedAt: -1 }`.

## `idea_evidence`

- Idea detail: `{ ideaId: 1, rank: 1, observedAt: -1 }`.
- Source reverse lookup: `{ sourceDocumentId: 1, createdAt: -1 }`.

## `idea_scores`

- Current score: `{ ideaId: 1, isCurrent: 1 }` with a unique partial index for `isCurrent: true`.
- Version history: `{ ideaId: 1, scoreVersion: -1, createdAt: -1 }`.

## `idea_recommendations`

- Primary daily feed: `{ creatorId: 1, feedDate: 1, surface: 1, rank: 1 }`.
- Seen/opened analytics: `{ creatorId: 1, createdAt: -1 }`.
- Unique daily dedupe: `{ creatorId: 1, ideaId: 1, feedDate: 1, surface: 1 }`.
- Cleanup for search materializations: `{ expiresAt: 1 }` if search recommendations are persisted with expiry.

## `idea_assets`

- Idea detail assets: `{ creatorId: 1, ideaId: 1, createdAt: -1 }`.
- Current asset lookup: `{ creatorId: 1, ideaId: 1, assetType: 1, isCurrent: 1 }`.
- Soft deletion: partial active filter where used.

## `saved_ideas`

- Creator library: `{ creatorId: 1, deletedAt: 1, updatedAt: -1 }`.
- Unique active save: `{ creatorId: 1, ideaId: 1 }` with partial filter for `deletedAt: null`.

## `idea_status_events`

- Current/latest status: `{ creatorId: 1, ideaId: 1, occurredAt: -1 }`.
- Creator workflow history: `{ creatorId: 1, occurredAt: -1 }`.

## `creator_feedback`

- Quality analysis: `{ languageId: 1, platformId: 1, createdAt: -1 }`.
- Creator history: `{ creatorId: 1, createdAt: -1 }`.
- Idea feedback: `{ ideaId: 1, createdAt: -1 }`.

## `ai_operations`

- Operation polling: `{ creatorId: 1, createdAt: -1 }`.
- Idempotency: unique `{ creatorId: 1, idempotencyKey: 1 }`.
- Worker recovery: `{ status: 1, updatedAt: 1 }`.
- Retention: `{ completedAt: 1 }`.

## Subscription and credits

- `subscription_plans`: unique `{ code: 1, version: 1 }`; active plans `{ isActive: 1, isFree: 1 }`.
- `creator_subscriptions`: `{ creatorId: 1, status: 1, periodEnd: -1 }`; provider reference `{ provider: 1, providerSubscriptionId: 1 }` when present.
- `credit_ledger`: `{ creatorId: 1, occurredAt: -1 }`; unique `{ creatorId: 1, referenceKey: 1 }` for idempotent movements where reference keys are present.
- `payment_transactions`: unique `{ provider: 1, providerTransactionId: 1 }` when provider ID exists; `{ creatorId: 1, createdAt: -1 }`.

## `audit_logs`

- Actor timeline: `{ actorId: 1, occurredAt: -1 }`.
- Target timeline: `{ targetType: 1, targetId: 1, occurredAt: -1 }`.
- Security events: `{ eventType: 1, occurredAt: -1 }`.

## Index governance

- Avoid indexing every optional field; each index has write and storage cost.
- Use partial indexes for soft-deleted/active uniqueness.
- Review multikey index size for preference arrays.
- Build indexes in staging with production-like data.
- Record index changes as versioned migrations.
- Remove unused indexes only after observing a sufficient production window.
