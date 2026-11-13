/* global ISODate, db */

// DB-01: stable MVP taxonomy seeds. Re-running this file is idempotent.
const now = ISODate("2026-11-11T00:00:00.000Z");

const niches = [
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000001", "fitness", "Fitness"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000002", "food", "Food"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000003", "finance", "Finance"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000004", "education", "Education"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000005", "entertainment", "Entertainment"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000006", "lifestyle", "Lifestyle"],
].map(([id, code, name], sortOrder) => ({
  _id: id,
  code,
  name,
  isActive: true,
  sortOrder,
  createdAt: now,
  updatedAt: now,
}));

const languages = [
  ["6f4e5c8b-3f7b-4f2a-9b31-000000000001", "hi", "Hindi", "Devanagari", true],
  [
    "6f4e5c8b-3f7b-4f2a-9b31-000000000002",
    "hinglish",
    "Hinglish",
    "Latin",
    true,
  ],
  [
    "6f4e5c8b-3f7b-4f2a-9b31-000000000003",
    "bho",
    "Bhojpuri",
    "Devanagari",
    false,
  ],
  ["6f4e5c8b-3f7b-4f2a-9b31-000000000004", "pa", "Punjabi", "Gurmukhi", false],
  [
    "6f4e5c8b-3f7b-4f2a-9b31-000000000005",
    "bgc",
    "Haryanvi",
    "Devanagari",
    false,
  ],
  ["6f4e5c8b-3f7b-4f2a-9b31-000000000006", "te", "Telugu", "Telugu", false],
  ["6f4e5c8b-3f7b-4f2a-9b31-000000000007", "kn", "Kannada", "Kannada", false],
].map(([id, code, name, script, supportsHinglish], sortOrder) => ({
  _id: id,
  code,
  name,
  script,
  supportsHinglish,
  isActive: true,
  sortOrder,
  createdAt: now,
  updatedAt: now,
}));

const platforms = [
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000001", "instagram", "Instagram"],
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000002", "youtube", "YouTube"],
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000003", "facebook", "Facebook"],
].map(([id, code, name], sortOrder) => ({
  _id: id,
  code,
  name,
  contentFormat: "short_video",
  isMvpSupported: true,
  isActive: true,
  sortOrder,
  createdAt: now,
  updatedAt: now,
}));

function upsert(collection, record) {
  db[collection].updateOne(
    { _id: record._id },
    { $set: record },
    { upsert: true },
  );
}

niches.forEach((record) => upsert("niches", record));
languages.forEach((record) => upsert("languages", record));
platforms.forEach((record) => upsert("platforms", record));

// CR-01: versioned plans keep operation pricing out of client code.
const subscriptionPlans = [
  {
    _id: "9f4e5c8b-3f7b-4f2a-9b31-000000000001",
    code: "free",
    name: "Free creator",
    monthlyCredits: 12,
    isFree: true,
    isActive: true,
    priceMinor: 0,
    currency: "INR",
    featureFlags: { generationCost: 3 },
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "9f4e5c8b-3f7b-4f2a-9b31-000000000002",
    code: "creator",
    name: "Creator",
    monthlyCredits: 60,
    isFree: false,
    isActive: true,
    priceMinor: 49900,
    currency: "INR",
    featureFlags: { generationCost: 3 },
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
];
subscriptionPlans.forEach((record) => upsert("subscription_plans", record));

// Deterministic development/demo research data. The ingestion pipeline can
// replace these records with live research; keeping a small seed set makes the
// Explore -> New Script journey demonstrable immediately after bootstrap.
const demoTopics = [
  {
    _id: "8f4e5c8b-3f7b-4f2a-9b31-000000000001",
    canonicalKey: "morning-mobility-routine",
    canonicalTitle: "Morning mobility routines",
    languageIds: [languages[2]._id],
    nicheIds: [niches[0]._id],
    aliases: ["mobility", "morning stretch", "fitness routine"],
    searchText:
      "morning mobility routine mobility morning stretch fitness routine",
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "8f4e5c8b-3f7b-4f2a-9b31-000000000002",
    canonicalKey: "budget-meal-prep",
    canonicalTitle: "Budget meal prep",
    languageIds: [languages[1]._id],
    nicheIds: [niches[1]._id],
    aliases: ["cheap meals", "meal prep", "quick recipes"],
    searchText: "budget meal prep cheap meals quick recipes",
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "8f4e5c8b-3f7b-4f2a-9b31-000000000003",
    canonicalKey: "phone-free-focus",
    canonicalTitle: "Phone-free focus habits",
    languageIds: [languages[2]._id],
    nicheIds: [niches[3]._id],
    aliases: ["deep work", "focus habits", "digital wellness"],
    searchText: "phone free focus habits deep work digital wellness",
    createdAt: now,
    updatedAt: now,
  },
];

const demoSources = [
  {
    _id: "9f4e5c8b-3f7b-4f2a-9b31-000000000001",
    sourceType: "manual_seed",
    sourceName: "CreatorPulse demo research",
    canonicalUrl: "https://example.com/creatorpulse/morning-mobility",
    title: "Why short mobility routines are easy to keep",
    excerpt: "Short, repeatable routines are easier to explain and revisit.",
    observedAt: now,
    publishedAt: now,
    rawContentHash: "demo-content-hash-morning-mobility",
    retrievalStatus: "active",
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "9f4e5c8b-3f7b-4f2a-9b31-000000000002",
    sourceType: "manual_seed",
    sourceName: "CreatorPulse demo research",
    canonicalUrl: "https://example.com/creatorpulse/budget-meal-prep",
    title: "Budget meal prep people can repeat",
    excerpt:
      "Low-cost meal formats create useful, practical short-form prompts.",
    observedAt: now,
    publishedAt: now,
    rawContentHash: "demo-content-hash-budget-meal-prep",
    retrievalStatus: "active",
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "9f4e5c8b-3f7b-4f2a-9b31-000000000003",
    sourceType: "manual_seed",
    sourceName: "CreatorPulse demo research",
    canonicalUrl: "https://example.com/creatorpulse/phone-free-focus",
    title: "Small phone-free focus experiments",
    excerpt: "Simple experiments make an abstract productivity topic tangible.",
    observedAt: now,
    publishedAt: now,
    rawContentHash: "demo-content-hash-phone-free-focus",
    retrievalStatus: "active",
    createdAt: now,
    updatedAt: now,
  },
];

const demoSignals = demoTopics.map((topic, index) => ({
  _id: `af4e5c8b-3f7b-4f2a-9b31-00000000000${index + 1}`,
  topicId: topic._id,
  sourceDocumentId: demoSources[index]._id,
  platformId: platforms[index === 1 ? 0 : 1]._id,
  languageId: topic.languageIds[0],
  nicheId: topic.nicheIds[0],
  signalType: "momentum",
  value: 0.72 - index * 0.08,
  valueUnit: "normalized_score",
  confidence: 0.9,
  observedAt: now,
  createdAt: now,
  updatedAt: now,
}));

const demoIdeas = [
  [
    "bf4e5c8b-3f7b-4f2a-9b31-000000000001",
    "Morning mobility in 5 minutes",
    "A friendly five-minute mobility routine that viewers can try before opening their workday.",
    0,
  ],
  [
    "bf4e5c8b-3f7b-4f2a-9b31-000000000002",
    "Three budget meal-prep wins",
    "Three low-cost meal-prep choices that make a busy week feel more manageable.",
    1,
  ],
  [
    "bf4e5c8b-3f7b-4f2a-9b31-000000000003",
    "Try a phone-free focus sprint",
    "A small focus experiment viewers can try today without changing their whole routine.",
    2,
  ],
].map(([id, title, summary, index]) => ({
  _id: id,
  topicId: demoTopics[index]._id,
  title,
  summary,
  languageId: demoTopics[index].languageIds[0],
  platformId: demoSignals[index].platformId,
  nicheId: demoTopics[index].nicheIds[0],
  origin: "research",
  audienceAngle: "Creators who want a practical idea they can explain quickly.",
  recommendedAction: "Turn the clearest step into a short, useful video.",
  canonicalKey: `demo-idea-${index + 1}`,
  searchText: `${title} ${summary}`.toLowerCase(),
  coverage: {
    sourceCount: 1,
    signalCount: 1,
    staleSourceCount: 0,
    missingEvidence: false,
    uncertainty: "none",
  },
  createdAt: now,
  updatedAt: now,
}));

const demoScores = demoIdeas.map((idea, index) => ({
  _id: `cf4e5c8b-3f7b-4f2a-9b31-00000000000${index + 1}`,
  ideaId: idea._id,
  scoreVersion: "rec-02-v1",
  overallScore: 78 - index * 5,
  label: index === 0 ? "Strong opportunity" : "Emerging opportunity",
  dimensions: {
    relevance: {
      value: 8.5 - index * 0.3,
      weight: 0.35,
      kind: "estimated",
      explanation: "Matches a practical creator audience need.",
    },
    trendMomentum: {
      value: 7.2 - index * 0.4,
      weight: 0.3,
      kind: "observed",
      explanation: "Supported by the seeded research signal.",
    },
    freshness: {
      value: 8,
      weight: 0.2,
      kind: "observed",
      explanation: "The source was observed recently.",
    },
    competition: {
      value: 6.5,
      weight: 0.15,
      kind: "estimated",
      explanation: "The angle leaves room for a distinct creator voice.",
    },
  },
  explanation: "A useful, timely angle with enough evidence to draft and test.",
  coverage: {
    sourceCount: 1,
    signalCount: 1,
    staleSourceCount: 0,
    complete: true,
    uncertainty: "none",
    caveat:
      "Seeded demo evidence; replace with live research before publishing.",
  },
  isCurrent: true,
  createdAt: now,
  updatedAt: now,
}));

demoTopics.forEach((record) => upsert("content_topics", record));
demoSources.forEach((record) => upsert("source_documents", record));
demoSignals.forEach((record) => upsert("trend_signals", record));
demoIdeas.forEach((record) => upsert("content_ideas", record));
demoIdeas.forEach((idea, index) =>
  upsert("idea_evidence", {
    _id: `df4e5c8b-3f7b-4f2a-9b31-00000000000${index + 1}`,
    ideaId: idea._id,
    sourceDocumentId: demoSources[index]._id,
    trendSignalId: demoSignals[index]._id,
    evidenceType: "trend",
    summary: demoSources[index].excerpt,
    observedAt: now,
    rank: 1,
    createdAt: now,
    updatedAt: now,
  }),
);
demoScores.forEach((record) => upsert("idea_scores", record));

// Development bootstrap credit so a newly seeded workspace can try a draft.
// The stable reference key keeps this grant idempotent across repeated seeds.
db.users.find({ status: "active" }).forEach((user) =>
  db.credit_ledger.updateOne(
    { _id: `grant:${user._id}:welcome-v1` },
    {
      $setOnInsert: {
        _id: `grant:${user._id}:welcome-v1`,
        creatorId: String(user._id),
        entryType: "grant",
        amount: 12,
        balanceAfter: 12,
        referenceKey: "welcome-grant-v1",
        occurredAt: now,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  ),
);
