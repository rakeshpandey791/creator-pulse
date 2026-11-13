# CreatorPulse Data Dictionary

This dictionary defines the logical MongoDB collections used by the MVP. `ID` fields are UUID strings unless stated otherwise. `Date` means a UTC BSON date. `Object` means a bounded validated subdocument.

## Common fields

| Field       | Type        | Nullability | Default    | Meaning                                 |
| ----------- | ----------- | ----------- | ---------- | --------------------------------------- |
| `_id`       | UUID string | Required    | Generated  | Public-safe entity identifier           |
| `createdAt` | Date        | Required    | Server now | Creation timestamp                      |
| `updatedAt` | Date        | Required    | Server now | Last mutation timestamp                 |
| `deletedAt` | Date        | Nullable    | `null`     | Soft-deletion timestamp where supported |

## Identity and creator collections

### `users`

| Field             | Type   | Required | Constraints                                          |
| ----------------- | ------ | -------: | ---------------------------------------------------- |
| `emailNormalized` | String |      Yes | Lowercase canonical email; unique while active       |
| `passwordHash`    | String |      Yes | Argon2id output; never returned                      |
| `role`            | Enum   |      Yes | `creator`, `admin`; default `creator`                |
| `status`          | Enum   |      Yes | `pending`, `active`, `suspended`, `deleted`          |
| `displayName`     | String |       No | Length-limited                                       |
| `emailVerifiedAt` | Date   |       No | Required before sensitive actions if policy requires |
| `lastLoginAt`     | Date   |       No | Updated on successful login                          |
| `deletedAt`       | Date   |       No | Soft deletion                                        |

### `auth_sessions`

| Field              | Type        | Required | Constraints              |
| ------------------ | ----------- | -------: | ------------------------ |
| `userId`           | UUID string |      Yes | Reference to `users`     |
| `refreshTokenHash` | String      |      Yes | Unique; never raw token  |
| `issuedAt`         | Date        |      Yes | Server time              |
| `expiresAt`        | Date        |      Yes | Future date              |
| `lastUsedAt`       | Date        |      Yes | Session activity         |
| `revokedAt`        | Date        |       No | Set on logout/revocation |
| `revokeReason`     | String      |       No | Bounded reason           |

### `creator_profiles`

| Field             | Type        | Required | Constraints                                     |
| ----------------- | ----------- | -------: | ----------------------------------------------- |
| `userId`          | UUID string |      Yes | One active profile per user                     |
| `nicheIds`        | UUID[]      |      Yes | Non-empty IDs to `niches`                       |
| `platformIds`     | UUID[]      |      Yes | Non-empty IDs to `platforms`                    |
| `languageIds`     | UUID[]      |      Yes | Non-empty IDs to `languages`                    |
| `audience`        | Object      |      Yes | Bounded description/age/geography/interests     |
| `contentStyle`    | String      |       No | Length-limited                                  |
| `creatorGoal`     | String      |       No | Length-limited                                  |
| `experienceLevel` | Enum        |       No | `new`, `growing`, `experienced`                 |
| `profileVersion`  | Integer     |      Yes | Starts at `1`; increments on preference changes |

## Taxonomy and research collections

### `niches`, `languages`, `platforms`

| Field              | Type    |       Required | Constraints           |
| ------------------ | ------- | -------------: | --------------------- |
| `code`             | String  |            Yes | Stable unique key     |
| `name`             | String  |            Yes | Display label         |
| `isActive`         | Boolean |            Yes | Default `true`        |
| `sortOrder`        | Integer |            Yes | Default `0`           |
| `script`           | String  | Languages only | Script identifier     |
| `supportsHinglish` | Boolean | Languages only | Default `false`       |
| `contentFormat`    | String  | Platforms only | `short_video` for MVP |
| `isMvpSupported`   | Boolean | Platforms only | Default `false`       |

### `content_topics`

| Field              | Type     | Required | Constraints                             |
| ------------------ | -------- | -------: | --------------------------------------- |
| `canonicalKey`     | String   |      Yes | Unique normalized topic key             |
| `canonicalTitle`   | String   |      Yes | Creator-safe title                      |
| `languageIds`      | UUID[]   |      Yes | Supported language references           |
| `nicheIds`         | UUID[]   |      Yes | Supported niche references              |
| `aliases`          | String[] |       No | Bounded aliases                         |
| `searchText`       | String   |       No | Normalized search representation        |
| `coverage`         | Object   |       No | Source count, staleness and uncertainty |
| `embedding`        | Number[] |       No | Vector-store controlled dimensions      |
| `embeddingModel`   | String   |       No | Model identifier                        |
| `embeddingVersion` | String   |       No | Rebuild/version marker                  |

### `source_documents`

| Field             | Type   | Required | Constraints                                                        |
| ----------------- | ------ | -------: | ------------------------------------------------------------------ |
| `sourceType`      | Enum   |      Yes | `official_api`, `rss`, `public_web`, `manual_seed`                 |
| `sourceName`      | String |      Yes | Adapter/source name                                                |
| `canonicalUrl`    | String |      Yes | Valid permitted URL                                                |
| `location`        | Object |       No | Coarse country/region/city only; no coordinates or IP-derived data |
| `title`           | String |       No | Bounded source title                                               |
| `excerpt`         | String |       No | Bounded permitted excerpt                                          |
| `observedAt`      | Date   |      Yes | When CreatorPulse observed it                                      |
| `publishedAt`     | Date   |       No | Source-provided time                                               |
| `rawContentHash`  | String |       No | Dedupe hash                                                        |
| `retrievalStatus` | Enum   |       No | `active`, `stale`, `blocked`, `failed`                             |
| `expiresAt`       | Date   |       No | Retention/refresh expiry                                           |

### `trend_signals`

| Field                       | Type        | Required | Constraints                                                      |
| --------------------------- | ----------- | -------: | ---------------------------------------------------------------- |
| `topicId`                   | UUID string |      Yes | Reference to `content_topics`                                    |
| `sourceDocumentId`          | UUID string |      Yes | Reference to `source_documents`                                  |
| `platformId`                | UUID string |       No | Reference to `platforms`                                         |
| `languageId`                | UUID string |       No | Reference to `languages`                                         |
| `nicheId`                   | UUID string |       No | Reference to `niches`                                            |
| `signalType`                | Enum        |      Yes | `momentum`, `volume`, `freshness`, `competition`, `source_count` |
| `value`                     | Decimal     |      Yes | Normalized observation                                           |
| `valueUnit`                 | String      |      Yes | Unit/key for value                                               |
| `confidence`                | Decimal     |       No | `0..1`                                                           |
| `observedAt`                | Date        |      Yes | Observation timestamp                                            |
| `windowStart` / `windowEnd` | Date        |       No | Measurement window                                               |

## Idea and recommendation collections

### `content_ideas`

| Field          | Type        | Required | Constraints                                                        |
| -------------- | ----------- | -------: | ------------------------------------------------------------------ |
| `topicId`      | UUID string |      Yes | Reference to topic                                                 |
| `title`        | String      |      Yes | Length-limited                                                     |
| `summary`      | String      |      Yes | Length-limited                                                     |
| `languageId`   | UUID string |      Yes | Reference to language                                              |
| `platformId`   | UUID string |      Yes | Reference to platform                                              |
| `nicheId`      | UUID string |      Yes | Reference to niche                                                 |
| `origin`       | Enum        |      Yes | `research`, `manual_search`, `recommendation`, `generated_variant` |
| `canonicalKey` | String      |       No | Active dedupe key                                                  |
| `searchText`   | String      |       No | Normalized searchable text                                         |
| `embedding`    | Number[]    |       No | Optional vector                                                    |
| `expiresAt`    | Date        |       No | Freshness lifecycle                                                |

### `idea_evidence`

| Field              | Type        | Required | Constraints                                              |
| ------------------ | ----------- | -------: | -------------------------------------------------------- |
| `ideaId`           | UUID string |      Yes | Reference to idea                                        |
| `sourceDocumentId` | UUID string |      Yes | Reference to source                                      |
| `trendSignalId`    | UUID string |       No | Reference to signal                                      |
| `evidenceType`     | Enum        |      Yes | `trend`, `source`, `freshness`, `competition`, `context` |
| `summary`          | String      |      Yes | Safe evidence summary                                    |
| `limitations`      | String      |       No | Coverage/uncertainty explanation                         |
| `observedAt`       | Date        |      Yes | Evidence time                                            |
| `rank`             | Integer     |       No | Display order                                            |

### `idea_scores`

| Field          | Type        | Required | Constraints                                                         |
| -------------- | ----------- | -------: | ------------------------------------------------------------------- |
| `ideaId`       | UUID string |      Yes | Reference to idea                                                   |
| `scoreVersion` | String      |      Yes | Ranking/scoring version                                             |
| `overallScore` | Decimal     |      Yes | Normalized score, documented range                                  |
| `label`        | Enum        |      Yes | E.g. `strong_opportunity`, `emerging_opportunity`, `limited_signal` |
| `dimensions`   | Object      |      Yes | Four bounded score/explanation objects                              |
| `explanation`  | String      |      Yes | Creator-readable rationale                                          |
| `coverage`     | Object      |      Yes | Source count, staleness, uncertainty                                |
| `isCurrent`    | Boolean     |      Yes | One current score per idea                                          |

### `idea_recommendations`

| Field                                             | Type        | Required | Constraints                            |
| ------------------------------------------------- | ----------- | -------: | -------------------------------------- |
| `creatorId`                                       | UUID string |      Yes | Creator profile ID                     |
| `ideaId`                                          | UUID string |      Yes | Idea ID                                |
| `feedDate`                                        | Date        |      Yes | UTC day key normalized to UTC midnight |
| `surface`                                         | Enum        |      Yes | `daily_feed`, `search`                 |
| `rank`                                            | Integer     |      Yes | Positive display rank                  |
| `scoreSnapshotId`                                 | UUID string |      Yes | Score used for ranking                 |
| `profileVersion`                                  | Integer     |      Yes | Preference version used                |
| `rankingVersion`                                  | String      |      Yes | Ranking release/version                |
| `reason`                                          | String      |       No | Creator-readable reason                |
| `seenAt` / `openedAt` / `savedAt` / `dismissedAt` | Date        |       No | Interaction timestamps                 |

## Generated content and feedback

### `idea_assets`

| Field             | Type        | Required | Constraints                |
| ----------------- | ----------- | -------: | -------------------------- |
| `ideaId`          | UUID string |      Yes | Reference to idea          |
| `creatorId`       | UUID string |      Yes | Owner of generated asset   |
| `assetType`       | Enum        |      Yes | `hook`, `script`, `cta`    |
| `languageId`      | UUID string |      Yes | Requested language         |
| `platformId`      | UUID string |      Yes | Requested platform         |
| `content`         | String      |      Yes | Bounded generated text     |
| `generationId`    | UUID string |      Yes | Reference to AI operation  |
| `durationSeconds` | Integer     |       No | Scripts only; 30–60 target |
| `tone`            | String      |       No | Bounded tone               |
| `safetyFlags`     | String[]    |       No | Post-generation flags      |

### `saved_ideas`

| Field           | Type        | Required | Constraints                 |
| --------------- | ----------- | -------: | --------------------------- |
| `creatorId`     | UUID string |      Yes | Owner                       |
| `ideaId`        | UUID string |      Yes | Saved idea                  |
| `savedAt`       | Date        |      Yes | First/last active save time |
| `bookmarkLabel` | String      |       No | Optional bounded label      |
| `deletedAt`     | Date        |       No | Soft removal                |

### `idea_status_events`

| Field        | Type        | Required | Constraints                                              |
| ------------ | ----------- | -------: | -------------------------------------------------------- |
| `creatorId`  | UUID string |      Yes | Owner                                                    |
| `ideaId`     | UUID string |      Yes | Idea                                                     |
| `status`     | Enum        |      Yes | `saved`, `planned`, `scripted`, `published`, `dismissed` |
| `occurredAt` | Date        |      Yes | Transition time                                          |
| `source`     | Enum        |       No | `user`, `system`                                         |
| `note`       | String      |       No | Optional bounded note                                    |

### `creator_feedback`

| Field                       | Type        | Required | Constraints                |
| --------------------------- | ----------- | -------: | -------------------------- |
| `creatorId`                 | UUID string |      Yes | Submitter                  |
| `ideaId`                    | UUID string |      Yes | Rated idea                 |
| `recommendationId`          | UUID string |       No | Recommendation context     |
| `rating`                    | Integer     |       No | Documented range, e.g. 1–5 |
| `reasonCodes`               | String[]    |       No | Controlled reasons         |
| `comment`                   | String      |       No | Length-limited             |
| `languageId` / `platformId` | UUID string |       No | Context at feedback time   |

## AI, subscriptions and audit

### `ai_operations`

| Field                            | Type        | Required | Constraints                                             |
| -------------------------------- | ----------- | -------: | ------------------------------------------------------- |
| `creatorId`                      | UUID string |      Yes | Requester                                               |
| `ideaId`                         | UUID string |       No | Related idea                                            |
| `operationType`                  | Enum        |      Yes | `generation`, `embedding`, `research`, `scoring`        |
| `status`                         | Enum        |      Yes | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `idempotencyKey`                 | String      |      Yes | Unique per creator                                      |
| `provider` / `model`             | String      |       No | Provider metadata                                       |
| `promptVersion`                  | String      |       No | Prompt release                                          |
| `attempts`                       | Integer     |      Yes | Default `0`                                             |
| `failureCode` / `failureMessage` | String      |       No | Safe error metadata                                     |
| `usage`                          | Object      |       No | Token/latency metadata, no secrets                      |
| `resultAssetIds`                 | UUID[]      |       No | Generated assets                                        |

### `subscription_plans`

| Field                 | Type    | Required | Constraints           |
| --------------------- | ------- | -------: | --------------------- |
| `code`                | String  |      Yes | Stable code           |
| `name`                | String  |      Yes | Display name          |
| `monthlyCredits`      | Integer |      Yes | Non-negative          |
| `isFree` / `isActive` | Boolean |      Yes | Plan lifecycle        |
| `priceMinor`          | Integer |       No | Future payment amount |
| `currency`            | String  |       No | ISO currency          |
| `featureFlags`        | Object  |       No | Bounded capabilities  |
| `version`             | Integer |      Yes | Plan version          |

### `creator_subscriptions`

| Field                                 | Type        | Required | Constraints                                                        |
| ------------------------------------- | ----------- | -------: | ------------------------------------------------------------------ |
| `creatorId`                           | UUID string |      Yes | Owner                                                              |
| `planId`                              | UUID string |      Yes | Plan                                                               |
| `status`                              | Enum        |      Yes | `active`, `trialing`, `past_due`, `cancelled`, `expired`, `manual` |
| `periodStart` / `periodEnd`           | Date        |      Yes | Entitlement period                                                 |
| `creditsGranted`                      | Integer     |      Yes | Grant for period                                                   |
| `provider` / `providerSubscriptionId` | String      |       No | Future adapter metadata                                            |

### `credit_ledger`

| Field          | Type        | Required | Constraints                                                                |
| -------------- | ----------- | -------: | -------------------------------------------------------------------------- |
| `creatorId`    | UUID string |      Yes | Owner                                                                      |
| `entryType`    | Enum        |      Yes | `grant`, `reserve`, `consume`, `release`, `refund`, `adjustment`, `expiry` |
| `amount`       | Integer     |      Yes | Signed credit movement                                                     |
| `balanceAfter` | Integer     |      Yes | Audited resulting balance                                                  |
| `operationId`  | UUID string |       No | Related AI operation                                                       |
| `referenceKey` | String      |       No | Idempotent business key                                                    |
| `occurredAt`   | Date        |      Yes | Ledger event time                                                          |

### `payment_transactions`

| Field                   | Type        | Required | Constraints                                                             |
| ----------------------- | ----------- | -------: | ----------------------------------------------------------------------- |
| `creatorId`             | UUID string |      Yes | Owner                                                                   |
| `subscriptionId`        | UUID string |       No | Related subscription                                                    |
| `transactionType`       | Enum        |      Yes | `checkout`, `renewal`, `refund`, `manual_adjustment`                    |
| `status`                | Enum        |      Yes | `created`, `pending`, `succeeded`, `failed`, `cancelled`                |
| `amountMinor`           | Integer     |      Yes | Non-negative                                                            |
| `currency`              | String      |      Yes | ISO currency                                                            |
| `provider`              | String      |       No | `mock`, `manual` in MVP; required when a transaction is provider-backed |
| `providerTransactionId` | String      |       No | Future provider ID                                                      |
| `idempotencyKey`        | String      |       No | Provider-safe dedupe                                                    |

### `audit_logs`

| Field                     | Type        | Required | Constraints                         |
| ------------------------- | ----------- | -------: | ----------------------------------- |
| `eventType`               | String      |      Yes | Controlled event family             |
| `actorType`               | Enum        |      Yes | `user`, `admin`, `system`, `worker` |
| `actorId`                 | UUID string |       No | Actor if applicable                 |
| `action`                  | String      |      Yes | Action name                         |
| `result`                  | Enum        |      Yes | `success`, `failure`                |
| `targetType` / `targetId` | String/UUID |       No | Affected resource                   |
| `requestId`               | String      |       No | Correlation                         |
| `ipHash`                  | String      |       No | Privacy-preserving network context  |
| `metadata`                | Object      |       No | Redacted bounded metadata           |
