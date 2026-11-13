/* global assert, db */

// DB-01 smoke checks. Run after the schema migration and reference seed.
const expectedCollections = [
  "users",
  "auth_sessions",
  "password_resets",
  "creator_profiles",
  "niches",
  "languages",
  "platforms",
  "content_topics",
  "source_documents",
  "trend_signals",
  "content_ideas",
  "idea_evidence",
  "idea_scores",
  "idea_recommendations",
  "idea_assets",
  "saved_ideas",
  "idea_status_events",
  "creator_feedback",
  "ai_operations",
  "subscription_plans",
  "creator_subscriptions",
  "credit_ledger",
  "payment_transactions",
  "audit_logs",
];

const actualCollections = db.getCollectionNames();
expectedCollections.forEach((name) =>
  assert(actualCollections.includes(name), `missing collection: ${name}`),
);
assert(db.niches.countDocuments() === 6, "niche seed count");
assert(db.languages.countDocuments() === 7, "language seed count");
assert(db.platforms.countDocuments() === 3, "platform seed count");
assert(db.content_topics.countDocuments() >= 3, "demo topic seed count");
assert(db.content_ideas.countDocuments() >= 3, "demo idea seed count");
assert(
  db.idea_scores.countDocuments({ isCurrent: true }) >= 3,
  "demo score seed count",
);

function hasIndex(collection, expectedKey) {
  return db[collection]
    .getIndexes()
    .some((index) => JSON.stringify(index.key) === JSON.stringify(expectedKey));
}

assert(
  hasIndex("source_documents", { rawContentHash: 1, sourceName: 1 }),
  "source content-hash index",
);
assert(
  hasIndex("trend_signals", {
    platformId: 1,
    languageId: 1,
    signalType: 1,
    observedAt: -1,
  }),
  "trend filter index",
);
assert(
  hasIndex("trend_signals", { observedAt: 1, signalType: 1 }),
  "trend freshness index",
);
assert(
  hasIndex("idea_recommendations", { creatorId: 1, createdAt: -1 }),
  "recommendation analytics index",
);
assert(
  hasIndex("creator_feedback", { ideaId: 1, createdAt: -1 }),
  "idea feedback index",
);

try {
  db.niches.insertOne({
    _id: "invalid",
    code: "invalid",
    name: "Invalid",
    isActive: true,
    sortOrder: 99,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  throw new Error("validator accepted an invalid UUID");
} catch (error) {
  assert(!String(error).includes("validator accepted"), error);
}

try {
  db.niches.insertOne({
    _id: "5f4e5c8b-3f7b-4f2a-9b31-000000000099",
    code: "fitness",
    name: "Duplicate",
    isActive: true,
    sortOrder: 99,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  throw new Error("unique code index accepted a duplicate");
} catch (error) {
  assert(!String(error).includes("unique code index accepted"), error);
}

print(
  "DB-01 integrity checks passed: collections, validators, unique indexes and seed counts.",
);
