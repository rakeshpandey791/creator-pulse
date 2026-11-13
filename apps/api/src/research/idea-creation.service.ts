import { createHash } from "node:crypto";
import type { Db } from "mongodb";

export type IdeaOrigin =
  "research" | "manual_search" | "recommendation" | "generated_variant";

export type IdeaSourceDocument = {
  _id: string;
  canonicalUrl: string;
  title?: string;
  excerpt?: string;
  location?: {
    countryCode: string;
    regionCode?: string;
    city?: string;
  };
  retrievalStatus?: "active" | "stale" | "blocked" | "failed";
  observedAt: Date;
  publishedAt?: Date | null;
};

export type IdeaTrendSignal = {
  _id: string;
  sourceDocumentId: string;
  topicId: string;
  signalType: string;
  value: number;
  observedAt: Date;
  confidence?: number;
};

export type ContentTopic = {
  _id: string;
  canonicalKey: string;
  canonicalTitle: string;
  languageIds: string[];
  nicheIds: string[];
  aliases: string[];
  searchText: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeaCoverage = {
  sourceCount: number;
  signalCount: number;
  staleSourceCount: number;
  missingEvidence: boolean;
  uncertainty: "none" | "limited" | "unavailable";
};

export type ContentIdea = {
  _id: string;
  topicId: string;
  title: string;
  summary: string;
  languageId: string;
  platformId: string;
  nicheId: string;
  origin: IdeaOrigin;
  audienceAngle?: string;
  recommendedAction?: string;
  canonicalKey: string;
  searchText: string;
  coverage: IdeaCoverage;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeaEvidence = {
  _id: string;
  ideaId: string;
  sourceDocumentId: string;
  trendSignalId?: string;
  evidenceType: "trend" | "source" | "freshness" | "competition" | "context";
  summary: string;
  limitations?: string;
  observedAt: Date;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTopicInput = {
  title: string;
  languageIds: string[];
  nicheIds: string[];
  aliases?: string[];
};

export type CreateIdeaInput = {
  title: string;
  summary: string;
  languageId: string;
  platformId: string;
  nicheId: string;
  origin: IdeaOrigin;
  topic?: CreateTopicInput;
  topicId?: string;
  audienceAngle?: string;
  recommendedAction?: string;
  sourceDocumentIds?: string[];
  trendSignalIds?: string[];
};

export type IdeaCreationStore = {
  findTopicByCanonicalKey(canonicalKey: string): Promise<ContentTopic | null>;
  findTopicById(id: string): Promise<ContentTopic | null>;
  saveTopic(topic: ContentTopic): Promise<ContentTopic>;
  findIdeaByCanonicalKey(canonicalKey: string): Promise<ContentIdea | null>;
  saveIdea(idea: ContentIdea): Promise<ContentIdea>;
  persistIdeaAndEvidence(
    idea: ContentIdea,
    evidence: IdeaEvidence[],
  ): Promise<{ idea: ContentIdea; evidence: IdeaEvidence[] }>;
  findSourceDocument(id: string): Promise<IdeaSourceDocument | null>;
  findTrendSignal(id: string): Promise<IdeaTrendSignal | null>;
  saveEvidence(evidence: IdeaEvidence): Promise<IdeaEvidence>;
};

export class IdeaCreationError extends Error {
  constructor(public readonly code: "invalid" | "missing_reference") {
    super(
      code === "invalid"
        ? "Idea input is invalid"
        : "Idea reference is missing",
    );
    this.name = "IdeaCreationError";
  }
}

export class IdeaCreationService {
  constructor(
    private readonly store: IdeaCreationStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createTopic(input: CreateTopicInput) {
    const title = boundedText(input.title, 160);
    const languageIds = uniqueIds(input.languageIds);
    const nicheIds = uniqueIds(input.nicheIds);
    if (!title || !languageIds.length || !nicheIds.length)
      throw new IdeaCreationError("invalid");
    const canonicalKey = canonicalTopicKey(title, languageIds, nicheIds);
    const existing = await this.store.findTopicByCanonicalKey(canonicalKey);
    if (existing) return existing;
    const now = this.now();
    return this.store.saveTopic({
      _id: stableId(`topic|${canonicalKey}`),
      canonicalKey,
      canonicalTitle: title,
      languageIds,
      nicheIds,
      aliases: uniqueText(input.aliases ?? [], 100, 20),
      searchText: normalizeText([title, ...(input.aliases ?? [])].join(" ")),
      createdAt: now,
      updatedAt: now,
    });
  }

  async createIdea(input: CreateIdeaInput) {
    const title = boundedText(input.title, 180);
    const summary = boundedText(input.summary, 1200);
    if (
      !title ||
      !summary ||
      !input.languageId ||
      !input.platformId ||
      !input.nicheId
    )
      throw new IdeaCreationError("invalid");
    const topic = input.topicId
      ? await this.store.findTopicById(input.topicId)
      : input.topic
        ? await this.createTopic(input.topic)
        : null;
    if (!topic) throw new IdeaCreationError("missing_reference");
    const canonicalKey = canonicalIdeaKey(
      title,
      input.languageId,
      input.platformId,
      input.nicheId,
    );
    const existing = await this.store.findIdeaByCanonicalKey(canonicalKey);
    if (existing) return { idea: existing, evidence: [] as IdeaEvidence[] };
    const now = this.now();
    const sourceIds = uniqueIds(input.sourceDocumentIds ?? []).slice(0, 5);
    const signalIds = uniqueIds(input.trendSignalIds ?? []).slice(0, 5);
    const sources = await Promise.all(
      sourceIds.map((id) => this.store.findSourceDocument(id)),
    );
    const signals = await Promise.all(
      signalIds.map((id) => this.store.findTrendSignal(id)),
    );
    const validSources = sources.filter(
      (source): source is IdeaSourceDocument => Boolean(source),
    );
    const validSignals = signals.filter((signal): signal is IdeaTrendSignal =>
      Boolean(signal),
    );
    if (
      validSources.length !== sourceIds.length ||
      validSignals.length !== signalIds.length
    )
      throw new IdeaCreationError("missing_reference");
    if (
      validSignals.some(
        (signal) =>
          signal.topicId !== topic._id ||
          !validSources.some(
            (source) => source._id === signal.sourceDocumentId,
          ),
      )
    )
      throw new IdeaCreationError("missing_reference");
    const idea: ContentIdea = {
      _id: stableId(`idea|${canonicalKey}`),
      topicId: topic._id,
      title,
      summary,
      languageId: input.languageId,
      platformId: input.platformId,
      nicheId: input.nicheId,
      origin: input.origin,
      ...(input.audienceAngle
        ? { audienceAngle: boundedText(input.audienceAngle, 500) }
        : {}),
      ...(input.recommendedAction
        ? { recommendedAction: boundedText(input.recommendedAction, 500) }
        : {}),
      canonicalKey,
      searchText: normalizeText(
        [title, summary, input.audienceAngle ?? ""].join(" "),
      ),
      coverage: {
        sourceCount: validSources.length,
        signalCount: validSignals.length,
        staleSourceCount: validSources.filter(
          (source) => source.retrievalStatus === "stale",
        ).length,
        missingEvidence: validSources.length === 0,
        uncertainty:
          validSources.length === 0
            ? "unavailable"
            : validSources.length < sourceIds.length
              ? "limited"
              : "none",
      },
      createdAt: now,
      updatedAt: now,
    };
    const evidence = validSources.map((source, index) => {
      const signal = validSignals.find(
        (candidate) => candidate.sourceDocumentId === source._id,
      );
      return {
        _id: stableId(
          `evidence|${idea._id}|${source._id}|${signal?._id ?? "source"}`,
        ),
        ideaId: idea._id,
        sourceDocumentId: source._id,
        ...(signal ? { trendSignalId: signal._id } : {}),
        evidenceType: signal ? "trend" : "source",
        summary: safeEvidenceSummary(source),
        ...(source.retrievalStatus === "stale"
          ? {
              limitations:
                "Source is stale; treat this as directional evidence only.",
            }
          : {}),
        observedAt: signal?.observedAt ?? source.observedAt,
        rank: index + 1,
        createdAt: now,
        updatedAt: now,
      } satisfies IdeaEvidence;
    });
    return this.store.persistIdeaAndEvidence(idea, evidence);
  }
}

export class InMemoryIdeaCreationStore implements IdeaCreationStore {
  readonly topics = new Map<string, ContentTopic>();
  readonly ideas = new Map<string, ContentIdea>();
  readonly sources = new Map<string, IdeaSourceDocument>();
  readonly signals = new Map<string, IdeaTrendSignal>();
  readonly evidence = new Map<string, IdeaEvidence>();

  async findTopicByCanonicalKey(key: string) {
    return (
      [...this.topics.values()].find((topic) => topic.canonicalKey === key) ??
      null
    );
  }
  async findTopicById(id: string) {
    return this.topics.get(id) ?? null;
  }
  async saveTopic(topic: ContentTopic) {
    const existing = this.topics.get(topic._id);
    if (existing) return existing;
    this.topics.set(topic._id, topic);
    return topic;
  }
  async findIdeaByCanonicalKey(key: string) {
    return (
      [...this.ideas.values()].find((idea) => idea.canonicalKey === key) ?? null
    );
  }
  async saveIdea(idea: ContentIdea) {
    const existing = this.ideas.get(idea._id);
    if (existing) return existing;
    this.ideas.set(idea._id, idea);
    return idea;
  }
  async persistIdeaAndEvidence(idea: ContentIdea, evidence: IdeaEvidence[]) {
    const topics = new Map(this.topics);
    const ideas = new Map(this.ideas);
    const storedEvidence = new Map(this.evidence);
    try {
      const savedIdea = await this.saveIdea(idea);
      const savedEvidence = await Promise.all(
        evidence.map((item) => this.saveEvidence(item)),
      );
      return { idea: savedIdea, evidence: savedEvidence };
    } catch (error) {
      this.topics.clear();
      this.ideas.clear();
      this.evidence.clear();
      for (const [key, value] of topics) this.topics.set(key, value);
      for (const [key, value] of ideas) this.ideas.set(key, value);
      for (const [key, value] of storedEvidence) this.evidence.set(key, value);
      throw error;
    }
  }
  async findSourceDocument(id: string) {
    return this.sources.get(id) ?? null;
  }
  async findTrendSignal(id: string) {
    return this.signals.get(id) ?? null;
  }
  async saveEvidence(evidence: IdeaEvidence) {
    const existing = this.evidence.get(evidence._id);
    if (existing) return existing;
    this.evidence.set(evidence._id, evidence);
    return evidence;
  }
}

export class MongoIdeaCreationStore implements IdeaCreationStore {
  private readonly transactionSupport: Promise<boolean>;

  constructor(
    private readonly db: Db,
    options: { transactionMode?: "auto" | "enabled" | "disabled" } = {},
  ) {
    this.transactionSupport =
      options.transactionMode === "enabled"
        ? Promise.resolve(true)
        : options.transactionMode === "disabled"
          ? Promise.resolve(false)
          : this.detectTransactionSupport();
  }

  findTopicByCanonicalKey(canonicalKey: string) {
    return this.db
      .collection<ContentTopic>("content_topics")
      .findOne({ canonicalKey });
  }

  findTopicById(id: string) {
    return this.db
      .collection<ContentTopic>("content_topics")
      .findOne({ _id: id });
  }

  async saveTopic(topic: ContentTopic) {
    const existing = await this.findTopicByCanonicalKey(topic.canonicalKey);
    if (existing) return existing;
    await this.db.collection<ContentTopic>("content_topics").insertOne(topic);
    return topic;
  }

  findIdeaByCanonicalKey(canonicalKey: string) {
    return this.db
      .collection<ContentIdea>("content_ideas")
      .findOne({ canonicalKey, deletedAt: null });
  }

  async saveIdea(idea: ContentIdea) {
    const existing = await this.findIdeaByCanonicalKey(idea.canonicalKey);
    if (existing) return existing;
    await this.db.collection<ContentIdea>("content_ideas").insertOne(idea);
    return idea;
  }

  async persistIdeaAndEvidence(idea: ContentIdea, evidence: IdeaEvidence[]) {
    if (!(await this.transactionSupport))
      return this.persistWithoutTransaction(idea, evidence);
    const session = this.db.client.startSession();
    try {
      let savedIdea = idea;
      let savedEvidence: IdeaEvidence[] = [];
      await session.withTransaction(async () => {
        const existing = await this.db
          .collection<ContentIdea>("content_ideas")
          .findOne(
            { canonicalKey: idea.canonicalKey, deletedAt: null },
            { session },
          );
        if (existing) savedIdea = existing;
        else
          await this.db
            .collection<ContentIdea>("content_ideas")
            .insertOne(idea, { session });
        savedEvidence = await Promise.all(
          evidence.map(async (item) => {
            const persisted = { ...item, ideaId: savedIdea._id };
            await this.db
              .collection<IdeaEvidence>("idea_evidence")
              .updateOne(
                { _id: persisted._id },
                { $setOnInsert: persisted },
                { upsert: true, session },
              );
            return persisted;
          }),
        );
      });
      return { idea: savedIdea, evidence: savedEvidence };
    } finally {
      await session.endSession();
    }
  }

  private async detectTransactionSupport() {
    const hello = await this.db.command({ hello: 1 });
    return Boolean(hello.setName || hello.msg === "isdbgrid");
  }

  private async persistWithoutTransaction(
    idea: ContentIdea,
    evidence: IdeaEvidence[],
  ) {
    const existing = await this.findIdeaByCanonicalKey(idea.canonicalKey);
    const savedIdea = existing ?? idea;
    const insertedIdea = !existing;
    const insertedEvidence: string[] = [];
    try {
      if (insertedIdea)
        await this.db.collection<ContentIdea>("content_ideas").insertOne(idea);
      const savedEvidence = [] as IdeaEvidence[];
      for (const item of evidence) {
        const persisted = { ...item, ideaId: savedIdea._id };
        const existingEvidence = await this.db
          .collection<IdeaEvidence>("idea_evidence")
          .findOne({ _id: persisted._id });
        if (!existingEvidence) {
          await this.db
            .collection<IdeaEvidence>("idea_evidence")
            .insertOne(persisted);
          insertedEvidence.push(persisted._id);
        }
        savedEvidence.push(persisted);
      }
      return { idea: savedIdea, evidence: savedEvidence };
    } catch (error) {
      if (insertedEvidence.length)
        await this.db.collection<IdeaEvidence>("idea_evidence").deleteMany({
          _id: { $in: insertedEvidence },
        });
      if (insertedIdea)
        await this.db
          .collection<ContentIdea>("content_ideas")
          .deleteOne({ _id: savedIdea._id });
      throw error;
    }
  }

  findSourceDocument(id: string) {
    return this.db.collection<IdeaSourceDocument>("source_documents").findOne(
      { _id: id },
      {
        projection: {
          _id: 1,
          canonicalUrl: 1,
          title: 1,
          excerpt: 1,
          location: 1,
          retrievalStatus: 1,
          observedAt: 1,
          publishedAt: 1,
        },
      },
    );
  }

  findTrendSignal(id: string) {
    return this.db
      .collection<IdeaTrendSignal>("trend_signals")
      .findOne({ _id: id });
  }

  async saveEvidence(evidence: IdeaEvidence) {
    await this.db
      .collection<IdeaEvidence>("idea_evidence")
      .updateOne(
        { _id: evidence._id },
        { $setOnInsert: evidence },
        { upsert: true },
      );
    return (
      (await this.db
        .collection<IdeaEvidence>("idea_evidence")
        .findOne({ _id: evidence._id })) ?? evidence
    );
  }
}

function canonicalTopicKey(
  title: string,
  languageIds: string[],
  nicheIds: string[],
) {
  return normalizeText(
    `${title}|${[...languageIds].sort().join(",")}|${[...nicheIds].sort().join(",")}`,
  );
}

function canonicalIdeaKey(
  title: string,
  languageId: string,
  platformId: string,
  nicheId: string,
) {
  return normalizeText(`${title}|${languageId}|${platformId}|${nicheId}`);
}

function safeEvidenceSummary(source: IdeaSourceDocument) {
  const value = source.excerpt || source.title || "Source evidence available.";
  return (
    boundedText(value.replace(/<[^>]+>/g, " "), 500) ??
    "Source evidence available."
  );
}

function uniqueIds(values: string[]) {
  return [
    ...new Set(
      values.filter((value) => typeof value === "string" && value.trim()),
    ),
  ];
}

function uniqueText(values: string[], max: number, limit: number) {
  return [
    ...new Set(
      values
        .map((value) => boundedText(value, max))
        .filter(Boolean) as string[],
    ),
  ].slice(0, limit);
}

function boundedText(value: string | undefined, max: number) {
  const normalized = value?.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 36);
}
