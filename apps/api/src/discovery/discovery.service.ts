import { BadRequestException, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { buildLanguagePromptContext } from "@creator-pulse/contracts";
import type {
  IdeaGenerationProvider,
  IdeaRankingProvider,
  IdeaRankingCandidate,
} from "@creator-pulse/contracts";
import type { Db, Filter } from "mongodb";
import type {
  ContentIdea,
  IdeaEvidence,
  IdeaSourceDocument,
} from "../research/idea-creation.service.js";
import type { IdeaScoreSnapshot } from "../research/scoring.service.js";
import {
  RecommendationService,
  type RecommendationRecord,
  type RecommendationStore,
} from "./recommendations.service.js";
import type { CreatorProfile } from "../infrastructure/persistence/repository-ports.js";
import type { CreatorProfileService } from "../creator/creator-profile.service.js";

export type DiscoveryPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DiscoveryListInput = {
  query?: string;
  languageId?: string;
  platformId?: string;
  nicheId?: string;
  limit: number;
  cursor?: string;
};

export type IdeaStatus =
  "saved" | "planned" | "scripted" | "published" | "dismissed";

export type SavedIdeaRecord = {
  _id: string;
  creatorId: string;
  ideaId: string;
  savedAt: Date;
  bookmarkLabel?: string;
  currentStatus?: IdeaStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeaStatusEventRecord = {
  _id: string;
  creatorId: string;
  ideaId: string;
  status: IdeaStatus;
  occurredAt: Date;
  source: "user" | "system";
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeaAssetRecord = {
  _id: string;
  ideaId: string;
  creatorId: string;
  assetType: "hook" | "script" | "cta";
  languageId?: string;
  platformId?: string;
  content: string;
  generationId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DiscoveryStore = RecommendationStore & {
  listIdeas(input: DiscoveryListInput): Promise<DiscoveryPage<ContentIdea>>;
  saveGeneratedIdea(idea: ContentIdea): Promise<ContentIdea>;
  findIdeaById(ideaId: string): Promise<ContentIdea | null>;
  findCurrentScore(ideaId: string): Promise<IdeaScoreSnapshot | null>;
  listEvidence(ideaId: string, limit: number): Promise<IdeaEvidence[]>;
  findSourceDocument(
    sourceDocumentId: string,
  ): Promise<IdeaSourceDocument | null>;
  listRecommendations(
    creatorId: string,
    feedDate: Date,
    surface: "daily_feed" | "search",
    limit: number,
    cursor?: string,
    profileVersion?: number,
  ): Promise<DiscoveryPage<RecommendationRecord>>;
  listSuppressedIdeaIds(creatorId: string): Promise<string[]>;
  updateRecommendationAction(
    creatorId: string,
    ideaId: string,
    action: "save" | "dismiss",
    feedDate: Date,
  ): Promise<RecommendationRecord | null>;
  saveIdea(
    creatorId: string,
    ideaId: string,
    bookmarkLabel?: string,
  ): Promise<SavedIdeaRecord>;
  removeSavedIdea(
    creatorId: string,
    ideaId: string,
  ): Promise<SavedIdeaRecord | null>;
  listSavedIdeas(
    creatorId: string,
    limit: number,
    cursor?: string,
    status?: IdeaStatus,
  ): Promise<DiscoveryPage<SavedIdeaRecord>>;
  getCurrentIdeaStatus(
    creatorId: string,
    ideaId: string,
  ): Promise<IdeaStatusEventRecord | null>;
  listIdeaStatusEvents(
    creatorId: string,
    ideaId: string,
  ): Promise<IdeaStatusEventRecord[]>;
  appendIdeaStatus(
    event: IdeaStatusEventRecord,
  ): Promise<IdeaStatusEventRecord>;
  listIdeaAssets(creatorId: string, ideaId: string): Promise<IdeaAssetRecord[]>;
  setSavedIdeaStatus(
    creatorId: string,
    ideaId: string,
    status: IdeaStatus,
  ): Promise<void>;
};

export type IdeaCard = {
  id: string;
  title: string;
  summary: string;
  languageId: string;
  platformId: string;
  nicheId: string;
  score: IdeaScoreSnapshot | null;
  reason?: string;
  coverage: ContentIdea["coverage"];
};

export type IdeaDetail = IdeaCard & {
  topicId: string;
  origin: ContentIdea["origin"];
  audienceAngle?: string;
  recommendedAction?: string;
  evidence: Array<{
    id: string;
    sourceDocumentId: string;
    trendSignalId?: string;
    evidenceType: IdeaEvidence["evidenceType"];
    summary: string;
    limitations?: string;
    observedAt: Date;
    rank: number;
    source: {
      canonicalUrl: string;
      title?: string;
    } | null;
  }>;
};

export type FeedResponse = {
  items: IdeaCard[];
  nextCursor: string | null;
  fallback: {
    kind: "none" | "no_candidates" | "no_eligible_candidates";
    message: string | null;
  };
  rankingVersion: string;
  profileVersion: number;
};

export type SearchResponse = {
  items: IdeaCard[];
  nextCursor: string | null;
  query: string;
};

export type LibraryItem = {
  saved: SavedIdeaRecord;
  status: IdeaStatusEventRecord | null;
  idea: IdeaDetail;
  assets: IdeaAssetRecord[];
};

export type LibraryResponse = {
  items: LibraryItem[];
  nextCursor: string | null;
};

export class DiscoveryService {
  private readonly recommendations: RecommendationService;

  constructor(
    private readonly store: DiscoveryStore,
    private readonly profiles: CreatorProfileService,
    private readonly ideaRanking?: IdeaRankingProvider,
    private readonly ideaGeneration?: IdeaGenerationProvider,
  ) {
    this.recommendations = new RecommendationService(store);
  }

  async dailyFeed(
    creatorId: string,
    input: Omit<DiscoveryListInput, "query"> & { surface?: "daily_feed" },
  ): Promise<FeedResponse> {
    const profile = await this.profiles.get(creatorId);
    const profileVersion = profile?.profileVersion ?? 0;
    if (!profile) {
      return {
        items: [],
        nextCursor: null,
        fallback: {
          kind: "no_eligible_candidates",
          message:
            "Complete your creator profile to receive a personalized feed.",
        },
        rankingVersion: "rec-03-v1",
        profileVersion,
      };
    }
    const feedDate = startOfUtcDay(new Date());
    const page = await this.store.listRecommendations(
      creatorId,
      feedDate,
      "daily_feed",
      input.limit,
      input.cursor,
      profileVersion,
    );
    if (page.items.length || input.cursor) {
      return {
        items: await this.cardsFromRecommendations(page.items),
        nextCursor: page.nextCursor,
        fallback: { kind: "none", message: null },
        rankingVersion: page.items[0]?.rankingVersion ?? "rec-03-v1",
        profileVersion,
      };
    }

    const candidatesPage = await this.store.listIdeas({
      languageId: input.languageId,
      platformId: input.platformId,
      nicheId: input.nicheId,
      limit: 100,
    });
    const candidates = await Promise.all(
      candidatesPage.items.map(async (idea) => {
        const score = await this.store.findCurrentScore(idea._id);
        return score ? { idea, score } : null;
      }),
    );
    const result = await this.recommendations.materialize({
      profile: toRecommendationProfile(creatorId, profile),
      candidates: candidates.filter(Boolean) as Array<{
        idea: ContentIdea;
        score: IdeaScoreSnapshot;
      }>,
      seenIdeaIds: await this.store.listSuppressedIdeaIds(creatorId),
      limit: input.limit,
      feedDate,
    });
    return {
      items: await this.cardsFromRecommendations(result.records),
      nextCursor: null,
      fallback: result.fallback,
      rankingVersion: result.rankingVersion,
      profileVersion,
    };
  }

  async search(
    input: DiscoveryListInput,
    creatorId?: string,
  ): Promise<SearchResponse> {
    if (
      this.ideaGeneration &&
      ["gemini", "groq"].includes(this.ideaGeneration.name)
    )
      return this.geminiGeneratedSearch(input, creatorId);
    if (this.ideaRanking && ["gemini", "groq"].includes(this.ideaRanking.name))
      return this.geminiSearch(input);
    const page = await this.store.listIdeas(input);
    return {
      items: await Promise.all(page.items.map((idea) => this.card(idea))),
      nextCursor: page.nextCursor,
      query: input.query ?? "",
    };
  }

  private async geminiGeneratedSearch(
    input: DiscoveryListInput,
    creatorId?: string,
  ): Promise<SearchResponse> {
    const ideaGeneration = this.ideaGeneration;
    if (!ideaGeneration)
      throw new BadRequestException("Idea generation is unavailable");
    const references = await this.store.listIdeas({
      languageId: input.languageId,
      platformId: input.platformId,
      nicheId: input.nicheId,
      limit: 100,
    });
    const profile = creatorId ? await this.profiles.get(creatorId) : null;
    const reference = references.items[0];
    if (!reference)
      return { items: [], nextCursor: null, query: input.query ?? "" };
    try {
      const generated = await ideaGeneration.generateIdeas({
        query: input.query,
        languageId:
          input.languageId ?? profile?.languageIds[0] ?? reference.languageId,
        platformId:
          input.platformId ?? profile?.platformIds[0] ?? reference.platformId,
        nicheId: input.nicheId ?? profile?.nicheIds[0] ?? reference.nicheId,
        count: 5,
        creatorContext: profile
          ? [
              profile.audience.description,
              profile.contentStyle,
              profile.creatorGoal,
            ]
              .filter(Boolean)
              .join(". ")
          : undefined,
        referenceIdeas: references.items.slice(0, 12).map(toRankingCandidate),
      });
      const now = new Date();
      const ideas = await Promise.all(
        generated.ideas.slice(0, 5).map((idea, index) =>
          this.store.saveGeneratedIdea({
            _id: stableUuid(
              `gemini-idea|${input.query ?? "browse"}|${idea.title}|${index}`,
            ),
            topicId: reference.topicId,
            title: idea.title,
            summary: idea.summary,
            languageId:
              input.languageId ??
              profile?.languageIds[0] ??
              reference.languageId,
            platformId:
              input.platformId ??
              profile?.platformIds[0] ??
              reference.platformId,
            nicheId: input.nicheId ?? profile?.nicheIds[0] ?? reference.nicheId,
            origin: "generated_variant",
            audienceAngle: idea.audienceAngle,
            recommendedAction: idea.recommendedAction,
            canonicalKey:
              `gemini:${input.query ?? "browse"}:${idea.title}`.toLowerCase(),
            searchText:
              `${idea.title} ${idea.summary} ${idea.audienceAngle}`.toLowerCase(),
            coverage: {
              sourceCount: 0,
              signalCount: 0,
              staleSourceCount: 0,
              missingEvidence: true,
              uncertainty: "unavailable",
            },
            createdAt: now,
            updatedAt: now,
          }),
        ),
      );
      return {
        items: await Promise.all(
          ideas.map(async (idea) => ({
            ...(await this.card(idea)),
            reason: "Created from your direction and creator context.",
          })),
        ),
        nextCursor: null,
        query: input.query ?? "",
      };
    } catch {
      const fallback = await this.store.listIdeas(input);
      return {
        items: await Promise.all(fallback.items.map((idea) => this.card(idea))),
        nextCursor: fallback.nextCursor,
        query: input.query ?? "",
      };
    }
  }

  private async geminiSearch(
    input: DiscoveryListInput,
  ): Promise<SearchResponse> {
    const ideaRanking = this.ideaRanking;
    if (!ideaRanking)
      throw new BadRequestException("Idea ranking is unavailable");
    const candidatePage = await this.store.listIdeas({
      languageId: input.languageId,
      platformId: input.platformId,
      nicheId: input.nicheId,
      limit: 100,
    });
    if (!candidatePage.items.length)
      return { items: [], nextCursor: null, query: input.query ?? "" };

    let rankedIds: string[];
    let reasons: Record<string, string>;
    try {
      const ranked = await ideaRanking.rankIdeas({
        query: input.query,
        languageId: input.languageId,
        platformId: input.platformId,
        nicheId: input.nicheId,
        candidates: candidatePage.items.map(toRankingCandidate),
      });
      rankedIds = ranked.result.rankedIds;
      reasons = ranked.result.reasons;
    } catch {
      // Gemini is an enhancement to discovery, not a prerequisite for access
      // to persisted ideas. Fall back to deterministic database search.
      const page = await this.store.listIdeas(input);
      return {
        items: await Promise.all(page.items.map((idea) => this.card(idea))),
        nextCursor: page.nextCursor,
        query: input.query ?? "",
      };
    }

    const byId = new Map(candidatePage.items.map((idea) => [idea._id, idea]));
    const ordered = [
      ...rankedIds
        .map((id) => byId.get(id))
        .filter((idea): idea is ContentIdea => Boolean(idea)),
      ...candidatePage.items.filter((idea) => !rankedIds.includes(idea._id)),
    ];
    const start = input.cursor ? decodeIdeaRankingCursor(input.cursor) : 0;
    if (start > ordered.length) throw new BadRequestException("Invalid cursor");
    const page = ordered.slice(start, start + input.limit);
    return {
      items: await Promise.all(
        page.map(async (idea) => {
          const card = await this.card(idea);
          const reason = reasons[idea._id];
          return reason
            ? { ...card, reason: sanitizePublicReason(reason) }
            : card;
        }),
      ),
      nextCursor:
        start + input.limit < ordered.length
          ? encodeIdeaRankingCursor(start + input.limit)
          : null,
      query: input.query ?? "",
    };
  }

  async detail(ideaId: string): Promise<IdeaDetail> {
    const idea = await this.store.findIdeaById(ideaId);
    if (!idea) throw new NotFoundException("Idea not found");
    const [card, evidence] = await Promise.all([
      this.card(idea),
      this.store.listEvidence(ideaId, 10),
    ]);
    return {
      ...card,
      topicId: idea.topicId,
      origin: idea.origin,
      ...(idea.audienceAngle ? { audienceAngle: idea.audienceAngle } : {}),
      ...(idea.recommendedAction
        ? { recommendedAction: idea.recommendedAction }
        : {}),
      evidence: await Promise.all(
        evidence.map(async (item) => {
          const source = await this.store.findSourceDocument(
            item.sourceDocumentId,
          );
          return {
            id: item._id,
            sourceDocumentId: item.sourceDocumentId,
            ...(item.trendSignalId
              ? { trendSignalId: item.trendSignalId }
              : {}),
            evidenceType: item.evidenceType,
            summary: item.summary,
            ...(item.limitations ? { limitations: item.limitations } : {}),
            observedAt: item.observedAt,
            rank: item.rank,
            source: source
              ? {
                  canonicalUrl: source.canonicalUrl,
                  ...(source.title ? { title: source.title } : {}),
                }
              : null,
          };
        }),
      ),
    };
  }

  async updateIdeaAction(
    creatorId: string,
    ideaId: string,
    action: "save" | "dismiss",
  ) {
    const idea = await this.store.findIdeaById(ideaId);
    if (!idea) throw new NotFoundException("Idea not found");
    const feedDate = startOfUtcDay(new Date());
    const profile = await this.profiles.get(creatorId);
    const existing = await this.store.updateRecommendationAction(
      creatorId,
      ideaId,
      action,
      feedDate,
    );
    if (!existing) {
      const score = await this.store.findCurrentScore(ideaId);
      const now = new Date();
      await this.store.upsert({
        _id: `rec:${creatorId}:${ideaId}:${feedDate.toISOString().slice(0, 10)}`,
        creatorId,
        ideaId,
        feedDate,
        surface: "daily_feed",
        rank: 999,
        scoreSnapshotId: score?._id ?? "unscored",
        profileVersion: profile?.profileVersion ?? 0,
        rankingVersion: "rec-03-v1",
        reason: "Saved from Explore",
        createdAt: now,
        updatedAt: now,
        ...(action === "save" ? { savedAt: now } : { dismissedAt: now }),
      });
    }
    const updated =
      (await this.store.updateRecommendationAction(
        creatorId,
        ideaId,
        action,
        feedDate,
      )) ?? null;
    if (!updated) throw new NotFoundException("Idea action could not be saved");
    if (action === "save") await this.saveIdea(creatorId, ideaId);
    else {
      await this.transitionIdeaStatus(creatorId, ideaId, "dismissed");
      await this.store.removeSavedIdea(creatorId, ideaId);
    }
    return {
      ideaId,
      action,
      savedAt: updated.savedAt?.toISOString() ?? null,
      dismissedAt: updated.dismissedAt?.toISOString() ?? null,
    };
  }

  async saveIdea(creatorId: string, ideaId: string, bookmarkLabel?: string) {
    await this.requireIdea(ideaId);
    const saved = await this.store.saveIdea(creatorId, ideaId, bookmarkLabel);
    const current = await this.store.getCurrentIdeaStatus(creatorId, ideaId);
    if (!current) await this.transitionIdeaStatus(creatorId, ideaId, "saved");
    return this.libraryItem(saved);
  }

  async removeSavedIdea(creatorId: string, ideaId: string) {
    await this.requireIdea(ideaId);
    const removed = await this.store.removeSavedIdea(creatorId, ideaId);
    if (!removed) throw new NotFoundException("Saved idea not found");
    return { ideaId, removed: true };
  }

  async transitionIdeaStatus(
    creatorId: string,
    ideaId: string,
    status: IdeaStatus,
    note?: string,
  ) {
    await this.requireIdea(ideaId);
    const current = await this.store.getCurrentIdeaStatus(creatorId, ideaId);
    if (current?.status === status) return current;
    if (!isAllowedStatusTransition(current?.status, status)) {
      throw new BadRequestException(
        `Invalid idea status transition from ${current?.status ?? "none"} to ${status}`,
      );
    }
    const now = new Date();
    const event: IdeaStatusEventRecord = {
      _id: randomUUID(),
      creatorId,
      ideaId,
      status,
      occurredAt: now,
      source: "user",
      ...(note ? { note } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.store.appendIdeaStatus(event);
    await this.store.setSavedIdeaStatus(creatorId, ideaId, status);
    return saved;
  }

  async status(creatorId: string, ideaId: string) {
    await this.requireIdea(ideaId);
    return {
      current: await this.store.getCurrentIdeaStatus(creatorId, ideaId),
      history: await this.store.listIdeaStatusEvents(creatorId, ideaId),
    };
  }

  async library(
    creatorId: string,
    input: { limit: number; cursor?: string; status?: IdeaStatus },
  ): Promise<LibraryResponse> {
    const page = await this.store.listSavedIdeas(
      creatorId,
      input.limit,
      input.cursor,
      input.status,
    );
    return {
      items: await Promise.all(
        page.items.map((saved) => this.libraryItem(saved)),
      ),
      nextCursor: page.nextCursor,
    };
  }

  private async requireIdea(ideaId: string) {
    const idea = await this.store.findIdeaById(ideaId);
    if (!idea) throw new NotFoundException("Idea not found");
    return idea;
  }

  private async libraryItem(saved: SavedIdeaRecord): Promise<LibraryItem> {
    const [idea, status, assets] = await Promise.all([
      this.detail(saved.ideaId),
      this.store.getCurrentIdeaStatus(saved.creatorId, saved.ideaId),
      this.store.listIdeaAssets(saved.creatorId, saved.ideaId),
    ]);
    return { saved, status, idea, assets };
  }

  async startDraft(creatorId: string, ideaId: string) {
    const idea = await this.store.findIdeaById(ideaId);
    if (!idea) throw new NotFoundException("Idea not found");
    const operationId = `draft:${creatorId}:${ideaId}`;
    return {
      operationId,
      ideaId,
      status: "queued" as const,
      languageContext: buildLanguagePromptContext({
        language: idea.languageId,
        platform: idea.platformId,
        fallback: "explicit_choice_only",
      }),
    };
  }

  private async cardsFromRecommendations(records: RecommendationRecord[]) {
    return (
      await Promise.all(
        records.map(async (record) => {
          const idea = await this.store.findIdeaById(record.ideaId);
          if (!idea) return null;
          const card = await this.card(idea);
          return { ...card, reason: sanitizePublicReason(record.reason) };
        }),
      )
    ).filter((card): card is IdeaCard & { reason: string } => Boolean(card));
  }

  private async card(idea: ContentIdea): Promise<IdeaCard> {
    return {
      id: idea._id,
      title: idea.title,
      summary: idea.summary,
      languageId: idea.languageId,
      platformId: idea.platformId,
      nicheId: idea.nicheId,
      score: await this.store.findCurrentScore(idea._id),
      coverage: idea.coverage,
    };
  }
}

export class InMemoryDiscoveryStore implements DiscoveryStore {
  readonly ideas = new Map<string, ContentIdea>();
  readonly scores = new Map<string, IdeaScoreSnapshot>();
  readonly evidence = new Map<string, IdeaEvidence>();
  readonly sources = new Map<string, IdeaSourceDocument>();
  readonly recommendations = new Map<string, RecommendationRecord>();
  readonly savedIdeas = new Map<string, SavedIdeaRecord>();
  readonly statusEvents = new Map<string, IdeaStatusEventRecord[]>();
  readonly assets = new Map<string, IdeaAssetRecord>();

  async listIdeas(input: DiscoveryListInput) {
    const queryTokens = input.query
      ?.trim()
      .toLocaleLowerCase("en-US")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8);
    const items = [...this.ideas.values()]
      .filter(
        (idea) => !input.languageId || idea.languageId === input.languageId,
      )
      .filter(
        (idea) => !input.platformId || idea.platformId === input.platformId,
      )
      .filter((idea) => !input.nicheId || idea.nicheId === input.nicheId)
      .filter(
        (idea) =>
          !queryTokens?.length ||
          queryTokens.some((token) =>
            `${idea.title} ${idea.summary} ${idea.searchText}`
              .toLocaleLowerCase("en-US")
              .includes(token),
          ),
      )
      .sort((left, right) => left._id.localeCompare(right._id));
    return pageById(items, input.limit, input.cursor);
  }

  async saveGeneratedIdea(idea: ContentIdea) {
    const existing = [...this.ideas.values()].find(
      (candidate) => candidate.canonicalKey === idea.canonicalKey,
    );
    if (existing) return existing;
    this.ideas.set(idea._id, idea);
    return idea;
  }

  async findIdeaById(ideaId: string) {
    return this.ideas.get(ideaId) ?? null;
  }
  async findCurrentScore(ideaId: string) {
    return (
      [...this.scores.values()].find(
        (score) => score.ideaId === ideaId && score.isCurrent,
      ) ?? null
    );
  }
  async listEvidence(ideaId: string, limit: number) {
    return [...this.evidence.values()]
      .filter((item) => item.ideaId === ideaId)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
  }
  async findSourceDocument(sourceDocumentId: string) {
    return this.sources.get(sourceDocumentId) ?? null;
  }
  async upsert(record: RecommendationRecord) {
    const existing = this.recommendations.get(record._id);
    const saved = existing
      ? {
          ...existing,
          ...record,
          seenAt: existing.seenAt,
          openedAt: existing.openedAt,
          savedAt: existing.savedAt,
          dismissedAt: existing.dismissedAt,
        }
      : record;
    this.recommendations.set(record._id, saved);
    return saved;
  }
  async listRecommendations(
    creatorId: string,
    feedDate: Date,
    surface: "daily_feed" | "search",
    limit: number,
    cursor?: string,
    profileVersion?: number,
  ) {
    const items = [...this.recommendations.values()]
      .filter(
        (record) =>
          record.creatorId === creatorId &&
          record.surface === surface &&
          record.feedDate.getTime() === feedDate.getTime() &&
          (profileVersion === undefined ||
            record.profileVersion === profileVersion) &&
          !record.seenAt &&
          !record.dismissedAt,
      )
      .sort((a, b) => a.rank - b.rank || a._id.localeCompare(b._id));
    const start = cursor
      ? recommendationStartIndex(items, decodeRecommendationCursor(cursor))
      : 0;
    const page = items.slice(start, start + limit);
    return {
      items: page,
      nextCursor:
        start + limit < items.length
          ? encodeRecommendationCursor(page.at(-1)!)
          : null,
    };
  }
  async listSuppressedIdeaIds(creatorId: string) {
    return [...this.recommendations.values()]
      .filter(
        (record) =>
          record.creatorId === creatorId &&
          (record.seenAt || record.dismissedAt),
      )
      .map((record) => record.ideaId);
  }
  async updateRecommendationAction(
    creatorId: string,
    ideaId: string,
    action: "save" | "dismiss",
    feedDate: Date,
  ) {
    const record = [...this.recommendations.values()].find(
      (item) =>
        item.creatorId === creatorId &&
        item.ideaId === ideaId &&
        item.feedDate.getTime() === feedDate.getTime() &&
        item.surface === "daily_feed",
    );
    if (!record) return null;
    const updated = {
      ...record,
      updatedAt: new Date(),
      ...(action === "save"
        ? { savedAt: new Date(), dismissedAt: null }
        : { dismissedAt: new Date() }),
    };
    this.recommendations.set(record._id, updated);
    return updated;
  }

  async saveIdea(creatorId: string, ideaId: string, bookmarkLabel?: string) {
    const key = `${creatorId}:${ideaId}`;
    const existing = this.savedIdeas.get(key);
    const now = new Date();
    const record: SavedIdeaRecord = existing
      ? {
          ...existing,
          savedAt: existing.savedAt,
          deletedAt: null,
          updatedAt: now,
          ...(bookmarkLabel ? { bookmarkLabel } : {}),
        }
      : {
          _id: `saved:${creatorId}:${ideaId}`,
          creatorId,
          ideaId,
          savedAt: now,
          ...(bookmarkLabel ? { bookmarkLabel } : {}),
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
    this.savedIdeas.set(key, record);
    return record;
  }

  async removeSavedIdea(creatorId: string, ideaId: string) {
    const key = `${creatorId}:${ideaId}`;
    const existing = this.savedIdeas.get(key);
    if (!existing || existing.deletedAt) return null;
    const record = {
      ...existing,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    this.savedIdeas.set(key, record);
    return record;
  }

  async listSavedIdeas(
    creatorId: string,
    limit: number,
    cursor?: string,
    status?: IdeaStatus,
  ) {
    let items = [...this.savedIdeas.values()]
      .filter((item) => item.creatorId === creatorId && !item.deletedAt)
      .filter((item) => !status || item.currentStatus === status)
      .sort(
        (a, b) =>
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          b._id.localeCompare(a._id),
      );
    if (cursor) {
      const decoded = decodeSavedIdeaCursor(cursor);
      items = items.filter(
        (item) =>
          item.updatedAt < decoded.updatedAt ||
          (item.updatedAt.getTime() === decoded.updatedAt.getTime() &&
            item._id < decoded.id),
      );
    }
    const page = items.slice(0, limit);
    return {
      items: page,
      nextCursor:
        page.length && page.length < items.length
          ? encodeSavedIdeaCursor(page.at(-1)!)
          : null,
    };
  }

  async getCurrentIdeaStatus(creatorId: string, ideaId: string) {
    return (
      (this.statusEvents.get(`${creatorId}:${ideaId}`) ?? []).at(-1) ?? null
    );
  }
  async listIdeaStatusEvents(creatorId: string, ideaId: string) {
    return [...(this.statusEvents.get(`${creatorId}:${ideaId}`) ?? [])];
  }
  async appendIdeaStatus(event: IdeaStatusEventRecord) {
    const key = `${event.creatorId}:${event.ideaId}`;
    const events = this.statusEvents.get(key) ?? [];
    events.push(event);
    this.statusEvents.set(key, events);
    return event;
  }
  async listIdeaAssets(creatorId: string, ideaId: string) {
    return [...this.assets.values()].filter(
      (asset) => asset.creatorId === creatorId && asset.ideaId === ideaId,
    );
  }
  async setSavedIdeaStatus(
    creatorId: string,
    ideaId: string,
    status: IdeaStatus,
  ) {
    const item = this.savedIdeas.get(`${creatorId}:${ideaId}`);
    if (item)
      this.savedIdeas.set(`${creatorId}:${ideaId}`, {
        ...item,
        currentStatus: status,
        updatedAt: new Date(),
      });
  }
}

export class MongoDiscoveryStore implements DiscoveryStore {
  constructor(private readonly db: Db) {}

  async listIdeas(input: DiscoveryListInput) {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (input.languageId) filter.languageId = input.languageId;
    if (input.platformId) filter.platformId = input.platformId;
    if (input.nicheId) filter.nicheId = input.nicheId;
    if (input.query?.trim()) {
      const tokens = input.query.trim().split(/\s+/).slice(0, 8);
      filter.$or = tokens.map((token) => ({
        searchText: { $regex: escapeRegex(token), $options: "i" },
      }));
    }
    if (input.cursor) filter._id = { $gt: decodeCursor(input.cursor) };
    const items = await this.db
      .collection<ContentIdea>("content_ideas")
      .find(filter as Filter<ContentIdea>)
      .sort({ _id: 1 })
      .limit(input.limit + 1)
      .toArray();
    const hasNext = items.length > input.limit;
    const page = hasNext ? items.slice(0, input.limit) : items;
    return {
      items: page,
      nextCursor: hasNext ? encodeCursor(page.at(-1)!._id) : null,
    };
  }

  async saveGeneratedIdea(idea: ContentIdea) {
    await this.db.collection<ContentIdea>("content_ideas").updateOne(
      {
        canonicalKey: idea.canonicalKey,
        deletedAt: null,
      } as Filter<ContentIdea>,
      { $setOnInsert: idea },
      { upsert: true },
    );
    return (
      (await this.db.collection<ContentIdea>("content_ideas").findOne({
        canonicalKey: idea.canonicalKey,
        deletedAt: null,
      } as Filter<ContentIdea>)) ?? idea
    );
  }
  findIdeaById(ideaId: string) {
    return this.db
      .collection<ContentIdea>("content_ideas")
      .findOne({ _id: ideaId, deletedAt: null } as Filter<ContentIdea>);
  }
  findCurrentScore(ideaId: string) {
    return this.db
      .collection<IdeaScoreSnapshot>("idea_scores")
      .findOne({ ideaId, isCurrent: true });
  }
  listEvidence(ideaId: string, limit: number) {
    return this.db
      .collection<IdeaEvidence>("idea_evidence")
      .find({ ideaId })
      .sort({ rank: 1, observedAt: -1 })
      .limit(limit)
      .toArray();
  }
  findSourceDocument(sourceDocumentId: string) {
    return this.db
      .collection<IdeaSourceDocument>("source_documents")
      .findOne({ _id: sourceDocumentId });
  }
  async upsert(record: RecommendationRecord) {
    const collection = this.db.collection<RecommendationRecord>(
      "idea_recommendations",
    );
    await collection.updateOne(
      {
        creatorId: record.creatorId,
        ideaId: record.ideaId,
        feedDate: record.feedDate,
        surface: record.surface,
      },
      {
        $set: {
          rank: record.rank,
          scoreSnapshotId: record.scoreSnapshotId,
          profileVersion: record.profileVersion,
          rankingVersion: record.rankingVersion,
          reason: record.reason,
          updatedAt: record.updatedAt,
        },
        $setOnInsert: {
          _id: record._id,
          creatorId: record.creatorId,
          ideaId: record.ideaId,
          feedDate: record.feedDate,
          surface: record.surface,
          createdAt: record.createdAt,
        },
      },
      { upsert: true },
    );
    const saved = await collection.findOne({
      creatorId: record.creatorId,
      ideaId: record.ideaId,
      feedDate: record.feedDate,
      surface: record.surface,
    });
    if (!saved)
      throw new Error("Recommendation could not be read after upsert");
    return saved;
  }
  async listRecommendations(
    creatorId: string,
    feedDate: Date,
    surface: "daily_feed" | "search",
    limit: number,
    cursor?: string,
    profileVersion?: number,
  ) {
    const filter: Record<string, unknown> = {
      creatorId,
      feedDate,
      surface,
      ...(profileVersion === undefined ? {} : { profileVersion }),
      $and: [
        { $or: [{ seenAt: null }, { seenAt: { $exists: false } }] },
        { $or: [{ dismissedAt: null }, { dismissedAt: { $exists: false } }] },
      ],
    };
    if (cursor) {
      filter.$and = [
        ...(filter.$and as unknown[]),
        recommendationCursorFilter(decodeRecommendationCursor(cursor)),
      ];
    }
    const items = await this.db
      .collection<RecommendationRecord>("idea_recommendations")
      .find(filter)
      .sort({ rank: 1, _id: 1 })
      .limit(limit + 1)
      .toArray();
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasNext ? encodeRecommendationCursor(page.at(-1)!) : null,
    };
  }
  async listSuppressedIdeaIds(creatorId: string) {
    return (
      await this.db
        .collection<RecommendationRecord>("idea_recommendations")
        .find({
          creatorId,
          $or: [{ seenAt: { $ne: null } }, { dismissedAt: { $ne: null } }],
        })
        .project({ ideaId: 1 })
        .toArray()
    ).map((record) => record.ideaId);
  }
  async updateRecommendationAction(
    creatorId: string,
    ideaId: string,
    action: "save" | "dismiss",
    feedDate: Date,
  ) {
    const collection = this.db.collection<RecommendationRecord>(
      "idea_recommendations",
    );
    const now = new Date();
    await collection.updateOne(
      { creatorId, ideaId, feedDate, surface: "daily_feed" },
      {
        $set: {
          updatedAt: now,
          ...(action === "save"
            ? { savedAt: now, dismissedAt: null }
            : { dismissedAt: now }),
        },
      },
    );
    return collection.findOne(
      { creatorId, ideaId, feedDate, surface: "daily_feed" },
      { sort: { updatedAt: -1 } },
    );
  }

  async saveIdea(creatorId: string, ideaId: string, bookmarkLabel?: string) {
    const collection = this.db.collection<SavedIdeaRecord>("saved_ideas");
    const now = new Date();
    await collection.updateOne(
      { creatorId, ideaId },
      {
        $set: {
          savedAt: now,
          deletedAt: null,
          updatedAt: now,
          ...(bookmarkLabel ? { bookmarkLabel } : {}),
        },
        $setOnInsert: { _id: randomUUID(), creatorId, ideaId, createdAt: now },
      },
      { upsert: true },
    );
    const record = await collection.findOne({ creatorId, ideaId });
    if (!record) throw new Error("Saved idea could not be read after upsert");
    return record;
  }

  async removeSavedIdea(creatorId: string, ideaId: string) {
    const now = new Date();
    return this.db
      .collection<SavedIdeaRecord>("saved_ideas")
      .findOneAndUpdate(
        { creatorId, ideaId, deletedAt: null },
        { $set: { deletedAt: now, updatedAt: now } },
        { returnDocument: "after" },
      );
  }

  async listSavedIdeas(
    creatorId: string,
    limit: number,
    cursor?: string,
    status?: IdeaStatus,
  ) {
    const filter: Record<string, unknown> = { creatorId, deletedAt: null };
    if (status) filter.currentStatus = status;
    if (cursor) {
      const decoded = decodeSavedIdeaCursor(cursor);
      filter.$or = [
        { updatedAt: { $lt: decoded.updatedAt } },
        { updatedAt: decoded.updatedAt, _id: { $lt: decoded.id } },
      ];
    }
    const items = await this.db
      .collection<SavedIdeaRecord>("saved_ideas")
      .find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasNext ? encodeSavedIdeaCursor(page.at(-1)!) : null,
    };
  }

  async getCurrentIdeaStatus(creatorId: string, ideaId: string) {
    return this.db
      .collection<IdeaStatusEventRecord>("idea_status_events")
      .findOne({ creatorId, ideaId }, { sort: { occurredAt: -1, _id: -1 } });
  }
  async listIdeaStatusEvents(creatorId: string, ideaId: string) {
    return this.db
      .collection<IdeaStatusEventRecord>("idea_status_events")
      .find({ creatorId, ideaId })
      .sort({ occurredAt: 1, _id: 1 })
      .toArray();
  }
  async appendIdeaStatus(event: IdeaStatusEventRecord) {
    await this.db
      .collection<IdeaStatusEventRecord>("idea_status_events")
      .insertOne(event);
    return event;
  }
  async listIdeaAssets(creatorId: string, ideaId: string) {
    return this.db
      .collection<IdeaAssetRecord>("idea_assets")
      .find({ creatorId, ideaId, isCurrent: true } as Filter<IdeaAssetRecord>)
      .sort({ createdAt: -1 })
      .toArray();
  }
  async setSavedIdeaStatus(
    creatorId: string,
    ideaId: string,
    status: IdeaStatus,
  ) {
    await this.db
      .collection<SavedIdeaRecord>("saved_ideas")
      .updateOne(
        { creatorId, ideaId },
        { $set: { currentStatus: status, updatedAt: new Date() } },
      );
  }
}

function isAllowedStatusTransition(
  current: IdeaStatus | undefined,
  next: IdeaStatus,
) {
  if (!current) return next === "saved";
  if (current === next) return true;
  if (current === "published") return false;
  if (next === "published") return current === "scripted";
  if (next === "dismissed") return true;
  if (next === "saved") return current === "dismissed";
  return (
    (current === "saved" && next === "planned") ||
    (current === "planned" && next === "scripted")
  );
}

function encodeSavedIdeaCursor(
  record: Pick<SavedIdeaRecord, "updatedAt" | "_id">,
) {
  return Buffer.from(
    JSON.stringify({
      updatedAt: record.updatedAt.toISOString(),
      id: record._id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeSavedIdeaCursor(value: string) {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { updatedAt?: string; id?: string };
    const updatedAt = new Date(decoded.updatedAt ?? "");
    if (!decoded.id || Number.isNaN(updatedAt.getTime()))
      throw new Error("invalid");
    return { updatedAt, id: decoded.id };
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

function toRecommendationProfile(creatorId: string, profile: CreatorProfile) {
  return {
    creatorId,
    profileVersion: profile.profileVersion,
    nicheIds: profile.nicheIds,
    platformIds: profile.platformIds,
    languageIds: profile.languageIds,
  };
}

function pageById<T extends { _id: string }>(
  items: T[],
  limit: number,
  cursor?: string,
): DiscoveryPage<T> {
  const cursorIndex = cursor
    ? items.findIndex((item) => item._id === decodeCursor(cursor))
    : -1;
  if (cursor && cursorIndex < 0)
    throw new BadRequestException("Invalid cursor");
  const start = cursor ? cursorIndex + 1 : 0;
  const page = items.slice(start, start + limit);
  return {
    items: page,
    nextCursor:
      start + limit < items.length ? encodeCursor(page.at(-1)!._id) : null,
  };
}

function encodeCursor(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function encodeIdeaRankingCursor(offset: number) {
  return encodeCursor(`gemini:${offset}`);
}

function decodeIdeaRankingCursor(value: string) {
  const decoded = decodeCursor(value);
  const match = /^gemini:(\d+)$/.exec(decoded);
  if (!match) throw new BadRequestException("Invalid cursor");
  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new BadRequestException("Invalid cursor");
  return offset;
}

export type RecommendationCursor = { rank: number; id: string };

export function encodeRecommendationCursor(
  record: Pick<RecommendationRecord, "rank" | "_id">,
) {
  return Buffer.from(
    JSON.stringify({ rank: record.rank, id: record._id }),
    "utf8",
  ).toString("base64url");
}

export function decodeRecommendationCursor(
  value: string,
): RecommendationCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<RecommendationCursor>;
    if (
      typeof decoded.rank !== "number" ||
      !Number.isInteger(decoded.rank) ||
      decoded.rank < 1 ||
      typeof decoded.id !== "string" ||
      !decoded.id
    )
      throw new Error("invalid");
    return { rank: decoded.rank, id: decoded.id };
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

export function recommendationCursorFilter(cursor: RecommendationCursor) {
  return {
    $or: [
      { rank: { $gt: cursor.rank } },
      { rank: cursor.rank, _id: { $gt: cursor.id } },
    ],
  };
}

function recommendationStartIndex(
  items: RecommendationRecord[],
  cursor: RecommendationCursor,
) {
  const index = items.findIndex(
    (item) =>
      item.rank > cursor.rank ||
      (item.rank === cursor.rank && item._id > cursor.id),
  );
  return index < 0 ? items.length : index;
}

function decodeCursor(value: string) {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (!decoded || decoded.length > 200 || /[^\w:.\-/]/.test(decoded))
      throw new Error("invalid");
    return decoded;
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRankingCandidate(idea: ContentIdea): IdeaRankingCandidate {
  return {
    id: idea._id,
    title: idea.title,
    summary: idea.summary,
    languageId: idea.languageId,
    platformId: idea.platformId,
    nicheId: idea.nicheId,
  };
}

function sanitizePublicReason(reason: string) {
  return reason
    .replace(
      /^Recommended for [^:]+:\s*/i,
      "This idea fits your creative direction: ",
    )
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "this idea")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 240);
}

function stableUuid(value: string) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
