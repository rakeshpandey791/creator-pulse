/*
  CreatorPulse MongoDB schema artifact.

  IMPORTANT: This file intentionally uses MongoDB shell-compatible JavaScript
  syntax despite the required .sql filename. MongoDB does not support SQL
  tables, foreign keys, or JSONB columns. References are UUID strings and are
  validated by application services. Run only after adapting to the selected
  MongoDB shell/driver version; do not execute against production directly.
*/

const uuid = { bsonType: "string", pattern: "^[0-9a-fA-F-]{36}$" };
const utcDate = { bsonType: "date" };
const nullableDate = { bsonType: ["date", "null"] };

function createValidated(name, properties, required, indexes = []) {
  const options = {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required,
        properties,
        additionalProperties: true
      }
    },
    validationLevel: "strict",
    validationAction: "error"
  };
  if (db.getCollectionInfos({ name }).length === 0) {
    db.createCollection(name, options);
  } else {
    db.runCommand({ collMod: name, ...options });
  }
  indexes.forEach((index) => db[name].createIndex(index.keys, index.options || {}));
}

createValidated("users", {
  _id: uuid,
  emailNormalized: { bsonType: "string", minLength: 3, maxLength: 320 },
  passwordHash: { bsonType: "string", minLength: 20 },
  role: { enum: ["creator", "admin"] },
  status: { enum: ["pending", "active", "suspended", "deleted"] },
  createdAt: utcDate, updatedAt: utcDate, deletedAt: nullableDate
}, ["_id", "emailNormalized", "passwordHash", "role", "status", "createdAt", "updatedAt"], [
  { keys: { emailNormalized: 1 }, options: { unique: true, partialFilterExpression: { deletedAt: null } } },
  { keys: { status: 1, createdAt: -1 } }
]);

createValidated("auth_sessions", {
  _id: uuid, userId: uuid, refreshTokenHash: { bsonType: "string" },
  issuedAt: utcDate, expiresAt: utcDate, lastUsedAt: utcDate,
  revokedAt: nullableDate, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "userId", "refreshTokenHash", "issuedAt", "expiresAt", "lastUsedAt", "createdAt", "updatedAt"], [
  { keys: { refreshTokenHash: 1 }, options: { unique: true } },
  { keys: { userId: 1, revokedAt: 1, expiresAt: 1 } },
  { keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }
]);

createValidated("password_resets", {
  _id: uuid, userId: uuid, tokenHash: { bsonType: "string" },
  expiresAt: utcDate, usedAt: nullableDate, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "userId", "tokenHash", "expiresAt", "createdAt", "updatedAt"], [
  { keys: { tokenHash: 1 }, options: { unique: true } },
  { keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }
]);

createValidated("creator_profiles", {
  _id: uuid, userId: uuid, nicheIds: { bsonType: "array", minItems: 1, items: uuid },
  platformIds: { bsonType: "array", minItems: 1, items: uuid },
  languageIds: { bsonType: "array", minItems: 1, items: uuid },
  audience: { bsonType: "object" }, profileVersion: { bsonType: "int", minimum: 1 },
  location: {
    bsonType: ["object", "null"],
    properties: {
      countryCode: { bsonType: "string", pattern: "^[A-Z]{2}$" },
      regionCode: { bsonType: "string", maxLength: 16 },
      city: { bsonType: "string", minLength: 1, maxLength: 80 },
      scope: { enum: ["country", "region", "city"] },
      source: { enum: ["manual", "approximate"] }
    },
    additionalProperties: false
  },
  locationConsent: { enum: ["manual", "approximate", "declined"] },
  createdAt: utcDate, updatedAt: utcDate, deletedAt: nullableDate
}, ["_id", "userId", "nicheIds", "platformIds", "languageIds", "audience", "profileVersion", "createdAt", "updatedAt"], [
  { keys: { userId: 1 }, options: { unique: true, partialFilterExpression: { deletedAt: null } } }
]);

function createReference(name) {
  createValidated(name, {
    _id: uuid, code: { bsonType: "string" }, name: { bsonType: "string" },
    isActive: { bsonType: "bool" }, sortOrder: { bsonType: "int" },
    createdAt: utcDate, updatedAt: utcDate
  }, ["_id", "code", "name", "isActive", "sortOrder", "createdAt", "updatedAt"], [
    { keys: { code: 1 }, options: { unique: true } },
    { keys: { isActive: 1, sortOrder: 1 } }
  ]);
}
createReference("niches");
createReference("languages");
createReference("platforms");

createValidated("content_topics", {
  _id: uuid, canonicalKey: { bsonType: "string" }, canonicalTitle: { bsonType: "string" },
  languageIds: { bsonType: "array", items: uuid }, nicheIds: { bsonType: "array", items: uuid },
  aliases: { bsonType: "array", items: { bsonType: "string" } },
  searchText: { bsonType: "string" }, embedding: { bsonType: "array", items: { bsonType: "double" } },
  embeddingModel: { bsonType: "string" }, embeddingVersion: { bsonType: "string" },
  embeddingDimensions: { bsonType: "int" }, embeddedAt: nullableDate,
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "canonicalKey", "canonicalTitle", "languageIds", "nicheIds", "createdAt", "updatedAt"], [
  { keys: { canonicalKey: 1 }, options: { unique: true } },
  { keys: { languageIds: 1, nicheIds: 1, updatedAt: -1 } }
]);

createValidated("source_documents", {
  _id: uuid, sourceType: { enum: ["official_api", "rss", "public_web", "manual_seed"] },
  sourceName: { bsonType: "string" }, canonicalUrl: { bsonType: "string" },
  location: {
    bsonType: "object",
    properties: {
      countryCode: { bsonType: "string", pattern: "^[A-Z]{2}$" },
      regionCode: { bsonType: "string", maxLength: 16 },
      city: { bsonType: "string", minLength: 1, maxLength: 80 }
    },
    additionalProperties: false
  },
  observedAt: utcDate, publishedAt: nullableDate, rawContentHash: { bsonType: "string" },
  retrievalStatus: { enum: ["active", "stale", "blocked", "failed"] },
  expiresAt: nullableDate, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "sourceType", "sourceName", "canonicalUrl", "observedAt", "createdAt", "updatedAt"], [
  { keys: { canonicalUrl: 1 }, options: { unique: true } },
  { keys: { sourceType: 1, observedAt: -1 } },
  { keys: { expiresAt: 1 } },
  { keys: { rawContentHash: 1, sourceName: 1 }, options: { sparse: true } }
]);

createValidated("trend_signals", {
  _id: uuid, topicId: uuid, sourceDocumentId: uuid, platformId: uuid, languageId: uuid, nicheId: uuid,
  signalType: { enum: ["momentum", "volume", "freshness", "competition", "source_count"] },
  value: { bsonType: ["double", "int", "long", "decimal"] }, valueUnit: { bsonType: "string" },
  confidence: { bsonType: ["double", "int", "decimal"] }, observedAt: utcDate,
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "topicId", "sourceDocumentId", "signalType", "value", "valueUnit", "observedAt", "createdAt", "updatedAt"], [
  { keys: { topicId: 1, observedAt: -1 } },
  { keys: { platformId: 1, languageId: 1, signalType: 1, observedAt: -1 } },
  { keys: { sourceDocumentId: 1, topicId: 1, signalType: 1, observedAt: 1 }, options: { unique: true } },
  { keys: { observedAt: 1, signalType: 1 } }
]);

createValidated("research_integrity_reports", {
  _id: uuid, jobId: { bsonType: "string" }, sourceName: { bsonType: "string" },
  status: { enum: ["succeeded", "partial", "failed"] },
  fetchedCount: { bsonType: "int" }, acceptedCount: { bsonType: "int" },
  signalCount: { bsonType: "int" }, duplicateCount: { bsonType: "int" },
  staleCount: { bsonType: "int" }, errorCode: { bsonType: "string" },
  observedAt: utcDate, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "jobId", "sourceName", "status", "fetchedCount", "acceptedCount", "signalCount", "duplicateCount", "staleCount", "observedAt", "createdAt", "updatedAt"], [
  { keys: { jobId: 1, sourceName: 1 }, options: { unique: true } },
  { keys: { sourceName: 1, observedAt: -1 } }
]);

createValidated("research_ingestion_jobs", {
  _id: { bsonType: "string" }, status: { enum: ["succeeded", "partial"] },
  result: { bsonType: "object" }, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "status", "result", "createdAt", "updatedAt"], [
  { keys: { _id: 1 }, options: { unique: true } },
  { keys: { updatedAt: -1 } }
]);

createValidated("content_ideas", {
  _id: uuid, topicId: uuid, title: { bsonType: "string" }, summary: { bsonType: "string" },
  languageId: uuid, platformId: uuid, nicheId: uuid,
  origin: { enum: ["research", "manual_search", "recommendation", "generated_variant"] },
  audienceAngle: { bsonType: "string" }, recommendedAction: { bsonType: "string" },
  canonicalKey: { bsonType: "string" }, searchText: { bsonType: "string" },
  coverage: { bsonType: "object" },
  embedding: { bsonType: "array", items: { bsonType: "double" } }, embeddingModel: { bsonType: "string" },
  embeddingVersion: { bsonType: "string" }, embeddingDimensions: { bsonType: "int" }, embeddedAt: nullableDate,
  expiresAt: nullableDate,
  createdAt: utcDate, updatedAt: utcDate, deletedAt: nullableDate
}, ["_id", "topicId", "title", "summary", "languageId", "platformId", "nicheId", "origin", "createdAt", "updatedAt"], [
  { keys: { canonicalKey: 1 }, options: { unique: true, partialFilterExpression: { deletedAt: null, canonicalKey: { $exists: true } } } },
  { keys: { languageId: 1, platformId: 1, nicheId: 1, updatedAt: -1 } },
  { keys: { expiresAt: 1 } }
]);

createValidated("idea_evidence", {
  _id: uuid, ideaId: uuid, sourceDocumentId: uuid, trendSignalId: uuid,
  evidenceType: { enum: ["trend", "source", "freshness", "competition", "context"] },
  summary: { bsonType: "string" }, limitations: { bsonType: "string" }, observedAt: utcDate,
  rank: { bsonType: "int" }, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "ideaId", "sourceDocumentId", "evidenceType", "summary", "observedAt", "createdAt", "updatedAt"], [
  { keys: { ideaId: 1, rank: 1, observedAt: -1 } },
  { keys: { sourceDocumentId: 1, createdAt: -1 } }
]);

createValidated("idea_scores", {
  _id: uuid, ideaId: uuid, scoreVersion: { bsonType: "string" },
  overallScore: { bsonType: ["double", "int", "decimal"] }, label: { bsonType: "string" },
  dimensions: { bsonType: "object" }, explanation: { bsonType: "string" }, coverage: { bsonType: "object" },
  isCurrent: { bsonType: "bool" }, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "ideaId", "scoreVersion", "overallScore", "label", "dimensions", "explanation", "coverage", "isCurrent", "createdAt", "updatedAt"], [
  { keys: { ideaId: 1, isCurrent: 1 }, options: { unique: true, partialFilterExpression: { isCurrent: true } } },
  { keys: { ideaId: 1, scoreVersion: -1, createdAt: -1 } }
]);

createValidated("idea_recommendations", {
  _id: uuid, creatorId: uuid, ideaId: uuid, feedDate: { bsonType: "date" },
  surface: { enum: ["daily_feed", "search"] }, rank: { bsonType: "int" }, scoreSnapshotId: uuid,
  profileVersion: { bsonType: "int" }, rankingVersion: { bsonType: "string" },
  reason: { bsonType: "string" }, seenAt: nullableDate, openedAt: nullableDate, savedAt: nullableDate,
  dismissedAt: nullableDate, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "ideaId", "feedDate", "surface", "rank", "scoreSnapshotId", "profileVersion", "rankingVersion", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, feedDate: 1, surface: 1, rank: 1 } },
  { keys: { creatorId: 1, createdAt: -1 } },
  { keys: { creatorId: 1, ideaId: 1, feedDate: 1, surface: 1 }, options: { unique: true } }
]);

createValidated("idea_assets", {
  _id: uuid, ideaId: uuid, creatorId: uuid, assetType: { enum: ["hook", "script", "cta"] },
  languageId: uuid, platformId: uuid, content: { bsonType: "string" }, generationId: uuid,
  durationSeconds: { bsonType: "int" }, tone: { bsonType: "string" }, safetyFlags: { bsonType: "array", items: { bsonType: "string" } },
  isCurrent: { bsonType: "bool" }, createdAt: utcDate, updatedAt: utcDate, deletedAt: nullableDate
}, ["_id", "ideaId", "creatorId", "assetType", "languageId", "platformId", "content", "generationId", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, ideaId: 1, createdAt: -1 } },
  { keys: { creatorId: 1, ideaId: 1, assetType: 1, isCurrent: 1 } }
]);

createValidated("saved_ideas", {
  _id: uuid, creatorId: uuid, ideaId: uuid, savedAt: utcDate, bookmarkLabel: { bsonType: "string" },
  deletedAt: nullableDate, currentStatus: { enum: ["saved", "planned", "scripted", "published", "dismissed"] }, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "ideaId", "savedAt", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, deletedAt: 1, updatedAt: -1 } },
  { keys: { creatorId: 1, currentStatus: 1, deletedAt: 1, updatedAt: -1 } },
  { keys: { creatorId: 1, ideaId: 1 }, options: { unique: true, partialFilterExpression: { deletedAt: null } } }
]);

createValidated("idea_status_events", {
  _id: uuid, creatorId: uuid, ideaId: uuid,
  status: { enum: ["saved", "planned", "scripted", "published", "dismissed"] },
  occurredAt: utcDate, source: { enum: ["user", "system"] }, note: { bsonType: "string" },
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "ideaId", "status", "occurredAt", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, ideaId: 1, occurredAt: -1 } },
  { keys: { creatorId: 1, occurredAt: -1 } }
]);

createValidated("creator_feedback", {
  _id: uuid, creatorId: uuid, ideaId: uuid, recommendationId: uuid,
  rating: { bsonType: "int", minimum: 1, maximum: 5 }, reasonCodes: { bsonType: "array", items: { enum: ["too_generic", "already_covered", "wrong_language", "wrong_audience", "not_timely", "unsafe", "other"] } },
  comment: { bsonType: "string", maxLength: 1000 }, languageId: uuid, nicheId: uuid, platformId: uuid,
  dedupeKey: { bsonType: "string" },
  createdAt: utcDate, updatedAt: utcDate, deletedAt: nullableDate
}, ["_id", "creatorId", "ideaId", "dedupeKey", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, createdAt: -1 } },
  { keys: { creatorId: 1, languageId: 1, nicheId: 1, platformId: 1, createdAt: -1 } },
  { keys: { creatorId: 1, dedupeKey: 1 }, options: { unique: true } },
  { keys: { ideaId: 1, createdAt: -1 } }
]);

createValidated("ai_operations", {
  _id: uuid, creatorId: uuid, ideaId: uuid,
  operationType: { enum: ["generation", "embedding", "research", "scoring"] },
  status: { enum: ["queued", "running", "succeeded", "failed", "cancelled"] },
  idempotencyKey: { bsonType: "string" }, provider: { bsonType: "string" }, model: { bsonType: "string" },
  promptVersion: { bsonType: "string" }, attempts: { bsonType: "int", minimum: 0 },
  requestedAt: utcDate, startedAt: nullableDate, completedAt: nullableDate,
  failureCode: { bsonType: "string" }, failureMessage: { bsonType: "string" }, usage: { bsonType: "object" },
  resultAssetIds: { bsonType: "array", items: uuid }, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "operationType", "status", "idempotencyKey", "requestedAt", "attempts", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, idempotencyKey: 1 }, options: { unique: true } },
  { keys: { creatorId: 1, createdAt: -1 } },
  { keys: { status: 1, updatedAt: 1 } }
]);

createValidated("subscription_plans", {
  _id: uuid, code: { bsonType: "string" }, name: { bsonType: "string" }, monthlyCredits: { bsonType: "int", minimum: 0 },
  isFree: { bsonType: "bool" }, isActive: { bsonType: "bool" }, priceMinor: { bsonType: "int", minimum: 0 },
  currency: { bsonType: "string" }, featureFlags: { bsonType: "object" }, version: { bsonType: "int", minimum: 1 },
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "code", "name", "monthlyCredits", "isFree", "isActive", "version", "createdAt", "updatedAt"], [
  { keys: { code: 1, version: 1 }, options: { unique: true } },
  { keys: { isActive: 1, isFree: 1 } }
]);

createValidated("creator_subscriptions", {
  _id: uuid, creatorId: uuid, planId: uuid, status: { enum: ["active", "trialing", "past_due", "cancelled", "expired", "manual"] },
  periodStart: utcDate, periodEnd: utcDate, creditsGranted: { bsonType: "int", minimum: 0 },
  provider: { bsonType: "string" }, providerSubscriptionId: { bsonType: "string" },
  cancelledAt: nullableDate, trialEndAt: nullableDate, metadata: { bsonType: "object" },
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "planId", "status", "periodStart", "periodEnd", "creditsGranted", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, status: 1, periodEnd: -1 } },
  { keys: { provider: 1, providerSubscriptionId: 1 }, options: { sparse: true, unique: true } }
]);

createValidated("credit_ledger", {
  _id: uuid, creatorId: uuid,
  entryType: { enum: ["grant", "reserve", "consume", "release", "refund", "adjustment", "expiry"] },
  amount: { bsonType: "int" }, balanceAfter: { bsonType: "int", minimum: 0 }, operationId: uuid,
  subscriptionId: uuid, referenceKey: { bsonType: "string" }, reason: { bsonType: "string" }, expiresAt: nullableDate, occurredAt: utcDate,
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "entryType", "amount", "balanceAfter", "occurredAt", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, occurredAt: -1 } },
  { keys: { creatorId: 1, referenceKey: 1 }, options: { sparse: true, unique: true } }
]);

// Mutable per-creator balance cache used only as the atomic write gate. The
// immutable credit_ledger remains the financial audit source of truth.
createValidated("credit_balances", {
  _id: uuid, creatorId: uuid, balance: { bsonType: "int", minimum: 0 }, updatedAt: utcDate
}, ["_id", "creatorId", "balance", "updatedAt"], [
  { keys: { creatorId: 1 }, options: { unique: true } }
]);

createValidated("payment_transactions", {
  _id: uuid, creatorId: uuid, subscriptionId: uuid,
  transactionType: { enum: ["checkout", "renewal", "refund", "manual_adjustment"] },
  status: { enum: ["created", "pending", "succeeded", "failed", "cancelled"] },
  amountMinor: { bsonType: "int", minimum: 0 }, currency: { bsonType: "string" }, provider: { bsonType: "string" },
  providerTransactionId: { bsonType: "string" }, idempotencyKey: { bsonType: "string" }, failureCode: { bsonType: "string" },
  metadata: { bsonType: "object" }, completedAt: nullableDate, createdAt: utcDate, updatedAt: utcDate
}, ["_id", "creatorId", "transactionType", "status", "amountMinor", "currency", "provider", "createdAt", "updatedAt"], [
  { keys: { creatorId: 1, createdAt: -1 } },
  { keys: { creatorId: 1, idempotencyKey: 1 }, options: { unique: true } },
  { keys: { provider: 1, providerTransactionId: 1 }, options: { sparse: true, unique: true } }
]);

createValidated("audit_logs", {
  _id: uuid, eventType: { bsonType: "string" }, occurredAt: utcDate,
  actorType: { enum: ["user", "admin", "system", "worker"] }, actorId: uuid, action: { bsonType: "string" },
  result: { enum: ["success", "failure"] }, targetType: { bsonType: "string" }, targetId: uuid,
  requestId: { bsonType: "string" }, ipHash: { bsonType: "string" }, metadata: { bsonType: "object" },
  createdAt: utcDate, updatedAt: utcDate
}, ["_id", "eventType", "occurredAt", "actorType", "action", "result", "createdAt", "updatedAt"], [
  { keys: { actorId: 1, occurredAt: -1 } },
  { keys: { targetType: 1, targetId: 1, occurredAt: -1 } },
  { keys: { eventType: 1, occurredAt: -1 } }
]);
