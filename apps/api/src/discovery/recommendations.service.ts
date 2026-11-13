import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import type { ContentIdea } from "../research/idea-creation.service.js";
import type {
  IdeaScoreSnapshot,
  ScoreDimensionName,
} from "../research/scoring.service.js";

export const REC03_RANKING_VERSION = "rec-03-v1";

export type RecommendationSurface = "daily_feed" | "search";

export type RecommendationProfile = {
  creatorId: string;
  profileVersion: number;
  nicheIds: string[];
  platformIds: string[];
  languageIds: string[];
};

export type RecommendationCandidate = {
  idea: ContentIdea;
  score: IdeaScoreSnapshot;
};

export type RecommendationRecord = {
  _id: string;
  creatorId: string;
  ideaId: string;
  feedDate: Date;
  surface: RecommendationSurface;
  rank: number;
  scoreSnapshotId: string;
  profileVersion: number;
  rankingVersion: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
  seenAt?: Date | null;
  openedAt?: Date | null;
  savedAt?: Date | null;
  dismissedAt?: Date | null;
};

export type RecommendationFallback =
  | { kind: "none"; message: null }
  | {
      kind: "no_candidates" | "no_eligible_candidates";
      message: string;
    };

export type RecommendationResult = {
  items: RankedRecommendation[];
  fallback: RecommendationFallback;
  rankingVersion: string;
};

export type RankedRecommendation = {
  candidate: RecommendationCandidate;
  rank: number;
  rankScore: number;
  reason: string;
};

export type RecommendationInput = {
  profile: RecommendationProfile;
  candidates: RecommendationCandidate[];
  seenIdeaIds?: Iterable<string>;
  dismissedIdeaIds?: Iterable<string>;
  feedDate?: Date;
  surface?: RecommendationSurface;
  limit?: number;
  rankingVersion?: string;
  now?: Date;
};

export type RecommendationStore = {
  upsert(record: RecommendationRecord): Promise<RecommendationRecord>;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PER_TOPIC = 2;

/**
 * Generates a cold-start feed from already retrieved ideas and score snapshots.
 * Retrieval is deliberately an input: DISC-01 can use Mongo/vector retrieval
 * without changing ranking or deduplication behavior.
 */
export function generateRecommendations(
  input: RecommendationInput,
): RecommendationResult {
  const rankingVersion = input.rankingVersion ?? REC03_RANKING_VERSION;
  const limit = boundedLimit(input.limit ?? DEFAULT_LIMIT);
  const seen = new Set(input.seenIdeaIds ?? []);
  const dismissed = new Set(input.dismissedIdeaIds ?? []);

  if (!input.candidates.length) {
    return emptyResult(rankingVersion, "no_candidates");
  }

  const eligible = input.candidates.filter(({ idea }) => {
    if (seen.has(idea._id) || dismissed.has(idea._id)) return false;
    return (
      input.profile.nicheIds.includes(idea.nicheId) &&
      input.profile.platformIds.includes(idea.platformId) &&
      input.profile.languageIds.includes(idea.languageId)
    );
  });
  if (!eligible.length)
    return emptyResult(rankingVersion, "no_eligible_candidates");

  const deduplicated = deduplicate(eligible);
  const ranked = deduplicated
    .map((candidate) => ({
      candidate,
      rankScore: rankingScore(candidate),
      reason: recommendationReason(candidate),
    }))
    .sort(compareRanked);
  const selected: RankedRecommendation[] = [];
  const topicCounts = new Map<string, number>();
  for (const item of ranked) {
    const count = topicCounts.get(item.candidate.idea.topicId) ?? 0;
    if (count >= MAX_PER_TOPIC) continue;
    topicCounts.set(item.candidate.idea.topicId, count + 1);
    selected.push({ ...item, rank: selected.length + 1 });
    if (selected.length === limit) break;
  }

  return {
    items: selected,
    fallback: { kind: "none", message: null },
    rankingVersion,
  };
}

export class RecommendationService {
  constructor(
    private readonly store: RecommendationStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async materialize(
    input: RecommendationInput,
  ): Promise<RecommendationResult & { records: RecommendationRecord[] }> {
    const now = input.now ?? this.now();
    const result = generateRecommendations({ ...input, now });
    const feedDate = startOfUtcDay(input.feedDate ?? now);
    const surface = input.surface ?? "daily_feed";
    const records = await Promise.all(
      result.items.map((item) =>
        this.store.upsert({
          _id: stableId(
            `recommendation|${input.profile.creatorId}|${item.candidate.idea._id}|${feedDate.toISOString()}|${surface}`,
          ),
          creatorId: input.profile.creatorId,
          ideaId: item.candidate.idea._id,
          feedDate,
          surface,
          rank: item.rank,
          scoreSnapshotId: item.candidate.score._id,
          profileVersion: input.profile.profileVersion,
          rankingVersion: result.rankingVersion,
          reason: item.reason,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
    return { ...result, records };
  }
}

export class InMemoryRecommendationStore implements RecommendationStore {
  readonly records = new Map<string, RecommendationRecord>();

  async upsert(record: RecommendationRecord) {
    const existing = this.records.get(record._id);
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
    this.records.set(record._id, saved);
    return saved;
  }
}

export class MongoRecommendationStore implements RecommendationStore {
  constructor(private readonly db: Db) {}

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
}

function deduplicate(candidates: RecommendationCandidate[]) {
  const unique = new Map<string, RecommendationCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.idea.languageId}|${candidate.idea.platformId}|${candidate.idea.nicheId}|${candidate.idea.canonicalKey}`;
    const existing = unique.get(key);
    if (!existing || compareCandidates(candidate, existing) < 0)
      unique.set(key, candidate);
  }
  const result: RecommendationCandidate[] = [];
  for (const candidate of [...unique.values()].sort(compareCandidates)) {
    const duplicate = result.some(
      (existing) =>
        existing.idea.languageId === candidate.idea.languageId &&
        existing.idea.platformId === candidate.idea.platformId &&
        titleSimilarity(existing.idea.title, candidate.idea.title) >= 0.8,
    );
    if (!duplicate) result.push(candidate);
  }
  return result;
}

function rankingScore(candidate: RecommendationCandidate) {
  const { dimensions } = candidate.score;
  const score =
    candidate.score.overallScore * 0.7 +
    dimensions.freshness.value * 0.12 +
    dimensions.trendMomentum.value * 0.1 +
    dimensions.relevance.value * 0.08;
  return round(score);
}

function recommendationReason(candidate: RecommendationCandidate) {
  const dimensions = candidate.score.dimensions;
  const strongest = (Object.keys(dimensions) as ScoreDimensionName[]).sort(
    (left, right) => dimensions[right].value - dimensions[left].value,
  )[0]!;
  const label = strongest === "trendMomentum" ? "trend momentum" : strongest;
  const coverage = candidate.score.coverage.caveat;
  return `This idea fits your creative direction: ${label} is a leading signal at ${dimensions[strongest].value}/100. ${coverage}`;
}

function compareRanked(
  left: { candidate: RecommendationCandidate; rankScore: number },
  right: { candidate: RecommendationCandidate; rankScore: number },
) {
  return (
    right.rankScore - left.rankScore ||
    compareCandidates(left.candidate, right.candidate)
  );
}

function compareCandidates(
  left: RecommendationCandidate,
  right: RecommendationCandidate,
) {
  return (
    rankingScore(right) - rankingScore(left) ||
    right.score.overallScore - left.score.overallScore ||
    left.idea._id.localeCompare(right.idea._id)
  );
}

function titleSimilarity(left: string, right: string) {
  const leftTokens = new Set(
    normalizeTitle(left).split(" ").filter(Boolean).map(singularize),
  );
  const rightTokens = new Set(
    normalizeTitle(right).split(" ").filter(Boolean).map(singularize),
  );
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function singularize(value: string) {
  return value.length > 3 && value.endsWith("s") ? value.slice(0, -1) : value;
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function boundedLimit(value: number) {
  return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function emptyResult(
  rankingVersion: string,
  kind: "no_candidates" | "no_eligible_candidates",
): RecommendationResult {
  return {
    items: [],
    rankingVersion,
    fallback: {
      kind,
      message:
        kind === "no_candidates"
          ? "No ideas are available yet. Try again after research sources are refreshed."
          : "No ideas match your current language, platform, and niche preferences. Try updating your profile or broadening the search.",
    },
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
