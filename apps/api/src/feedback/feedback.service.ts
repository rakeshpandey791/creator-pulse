import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Db, Filter } from "mongodb";

export const FEEDBACK_REASON_CODES = [
  "too_generic",
  "already_covered",
  "wrong_language",
  "wrong_audience",
  "not_timely",
  "unsafe",
  "other",
] as const;

export type FeedbackReasonCode = (typeof FEEDBACK_REASON_CODES)[number];

export type CreatorFeedback = {
  _id: string;
  creatorId: string;
  ideaId: string;
  recommendationId?: string;
  rating?: number;
  reasonCodes?: FeedbackReasonCode[];
  comment?: string;
  languageId?: string;
  nicheId?: string;
  platformId?: string;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type FeedbackInput = {
  rating?: unknown;
  reasonCodes?: unknown;
  comment?: unknown;
  recommendationId?: unknown;
  languageId?: unknown;
  nicheId?: unknown;
  platformId?: unknown;
};

export type FeedbackAnalysis = {
  filters: { languageId?: string; nicheId?: string; platformId?: string };
  total: number;
  rated: number;
  averageRating: number | null;
  reasonCounts: Partial<Record<FeedbackReasonCode, number>>;
};

export type FeedbackStore = {
  findIdea(ideaId: string): Promise<boolean>;
  findOwnedRecommendation(
    creatorId: string,
    recommendationId: string,
    ideaId: string,
  ): Promise<boolean>;
  findByDedupeKey(
    creatorId: string,
    dedupeKey: string,
    since: Date,
  ): Promise<CreatorFeedback | null>;
  insert(record: CreatorFeedback): Promise<CreatorFeedback>;
  list(
    creatorId: string,
    filters: { languageId?: string; nicheId?: string; platformId?: string },
  ): Promise<CreatorFeedback[]>;
};

export class FeedbackService {
  constructor(
    private readonly store: FeedbackStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async submit(creatorId: string, ideaId: string, input: FeedbackInput) {
    if (!(await this.store.findIdea(ideaId))) {
      throw new NotFoundException("Idea not found");
    }
    const feedback = normalizeFeedback(input);
    if (feedback.recommendationId) {
      const belongs = await this.store.findOwnedRecommendation(
        creatorId,
        feedback.recommendationId,
        ideaId,
      );
      if (!belongs) throw new NotFoundException("Recommendation not found");
    }

    const day = this.now().toISOString().slice(0, 10);
    const dedupeKey = createDedupeKey(creatorId, ideaId, day, feedback);
    const duplicate = await this.store.findByDedupeKey(
      creatorId,
      dedupeKey,
      new Date(this.now().getTime() - 24 * 60 * 60 * 1000),
    );
    if (duplicate)
      return { feedback: safeFeedback(duplicate), duplicate: true };

    const recentCount = (await this.store.list(creatorId, {})).filter(
      (record) =>
        record.createdAt >= new Date(this.now().getTime() - 60 * 60 * 1000),
    ).length;
    if (recentCount >= 20) {
      throw new HttpException(
        "Feedback limit reached. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const now = this.now();
    try {
      const saved = await this.store.insert({
        _id: randomUUID(),
        creatorId,
        ideaId,
        ...(feedback.recommendationId
          ? { recommendationId: feedback.recommendationId }
          : {}),
        ...(feedback.rating === undefined ? {} : { rating: feedback.rating }),
        ...(feedback.reasonCodes?.length
          ? { reasonCodes: feedback.reasonCodes }
          : {}),
        ...(feedback.comment
          ? { comment: redactSensitiveText(feedback.comment) }
          : {}),
        ...(feedback.languageId ? { languageId: feedback.languageId } : {}),
        ...(feedback.nicheId ? { nicheId: feedback.nicheId } : {}),
        ...(feedback.platformId ? { platformId: feedback.platformId } : {}),
        dedupeKey,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      return { feedback: safeFeedback(saved), duplicate: false };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.store.findByDedupeKey(
          creatorId,
          dedupeKey,
          new Date(0),
        );
        if (existing)
          return { feedback: safeFeedback(existing), duplicate: true };
      }
      throw error;
    }
  }

  async analysis(
    creatorId: string,
    filters: { languageId?: string; nicheId?: string; platformId?: string },
  ): Promise<FeedbackAnalysis> {
    const records = await this.store.list(creatorId, filters);
    const reasonCounts: Partial<Record<FeedbackReasonCode, number>> = {};
    let ratingTotal = 0;
    let rated = 0;
    for (const record of records) {
      if (record.rating !== undefined) {
        rated += 1;
        ratingTotal += record.rating;
      }
      for (const reason of record.reasonCodes ?? [])
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }
    return {
      filters,
      total: records.length,
      rated,
      averageRating: rated
        ? Math.round((ratingTotal / rated) * 100) / 100
        : null,
      reasonCounts,
    };
  }
}

export class InMemoryFeedbackStore implements FeedbackStore {
  readonly ideas = new Set<string>();
  readonly recommendations = new Map<
    string,
    { creatorId: string; ideaId: string }
  >();
  readonly records = new Map<string, CreatorFeedback>();

  async findIdea(ideaId: string) {
    return this.ideas.has(ideaId);
  }
  async findOwnedRecommendation(
    creatorId: string,
    recommendationId: string,
    ideaId: string,
  ) {
    const record = this.recommendations.get(recommendationId);
    return record?.creatorId === creatorId && record.ideaId === ideaId;
  }
  async findByDedupeKey(creatorId: string, dedupeKey: string, since: Date) {
    return (
      [...this.records.values()].find(
        (record) =>
          record.creatorId === creatorId &&
          record.dedupeKey === dedupeKey &&
          record.createdAt >= since &&
          !record.deletedAt,
      ) ?? null
    );
  }
  async insert(record: CreatorFeedback) {
    this.records.set(record._id, record);
    return record;
  }
  async list(
    creatorId: string,
    filters: { languageId?: string; nicheId?: string; platformId?: string },
  ) {
    return [...this.records.values()].filter(
      (record) =>
        record.creatorId === creatorId &&
        !record.deletedAt &&
        (!filters.languageId || record.languageId === filters.languageId) &&
        (!filters.nicheId || record.nicheId === filters.nicheId) &&
        (!filters.platformId || record.platformId === filters.platformId),
    );
  }
}

export class MongoFeedbackStore implements FeedbackStore {
  constructor(private readonly db: Db) {}

  async findIdea(ideaId: string) {
    return Boolean(
      await this.db
        .collection<{ _id: string }>("content_ideas")
        .findOne({ _id: ideaId, deletedAt: null }),
    );
  }
  async findOwnedRecommendation(
    creatorId: string,
    recommendationId: string,
    ideaId: string,
  ) {
    return Boolean(
      await this.db
        .collection<{ _id: string }>("idea_recommendations")
        .findOne({ _id: recommendationId, creatorId, ideaId }),
    );
  }
  findByDedupeKey(creatorId: string, dedupeKey: string, since: Date) {
    return this.db.collection<CreatorFeedback>("creator_feedback").findOne({
      creatorId,
      dedupeKey,
      createdAt: { $gte: since },
      deletedAt: null,
    });
  }
  async insert(record: CreatorFeedback) {
    await this.db
      .collection<CreatorFeedback>("creator_feedback")
      .insertOne(record);
    return record;
  }
  list(
    creatorId: string,
    filters: { languageId?: string; nicheId?: string; platformId?: string },
  ) {
    const query = {
      creatorId,
      deletedAt: null,
      ...filters,
    } as Filter<CreatorFeedback>;
    return this.db
      .collection<CreatorFeedback>("creator_feedback")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
  }
}

function normalizeFeedback(input: FeedbackInput) {
  const hasRating = input.rating !== undefined;
  const hasReasons = input.reasonCodes !== undefined;
  const hasComment = input.comment !== undefined;
  if (!hasRating && !hasReasons && !hasComment)
    throw new BadRequestException(
      "Feedback must include a rating, reason, or comment",
    );

  let rating: number | undefined;
  if (hasRating) {
    if (
      typeof input.rating !== "number" ||
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    )
      throw new BadRequestException("rating must be an integer from 1 to 5");
    rating = input.rating;
  }

  let reasonCodes: FeedbackReasonCode[] | undefined;
  if (hasReasons) {
    if (
      !Array.isArray(input.reasonCodes) ||
      input.reasonCodes.length > 5 ||
      input.reasonCodes.length === 0
    )
      throw new BadRequestException(
        "reasonCodes must contain between 1 and 5 values",
      );
    const unique = [...new Set(input.reasonCodes)];
    if (
      unique.some(
        (value) =>
          typeof value !== "string" ||
          !FEEDBACK_REASON_CODES.includes(value as FeedbackReasonCode),
      )
    )
      throw new BadRequestException(
        "reasonCodes contains an unsupported value",
      );
    reasonCodes = unique as FeedbackReasonCode[];
  }

  let comment: string | undefined;
  if (hasComment) {
    if (typeof input.comment !== "string" || input.comment.length > 1000)
      throw new BadRequestException("comment must be 1000 characters or fewer");
    comment = input.comment.trim();
    if (!comment) throw new BadRequestException("comment cannot be empty");
  }

  const optionalIds = [
    "recommendationId",
    "languageId",
    "nicheId",
    "platformId",
  ] as const;
  for (const field of optionalIds) {
    if (
      input[field] !== undefined &&
      (typeof input[field] !== "string" || !input[field].trim())
    )
      throw new BadRequestException(`${field} must be a non-empty string`);
  }
  return {
    ...(rating === undefined ? {} : { rating }),
    ...(reasonCodes ? { reasonCodes } : {}),
    ...(comment ? { comment } : {}),
    ...(typeof input.recommendationId === "string"
      ? { recommendationId: input.recommendationId }
      : {}),
    ...(typeof input.languageId === "string"
      ? { languageId: input.languageId }
      : {}),
    ...(typeof input.nicheId === "string" ? { nicheId: input.nicheId } : {}),
    ...(typeof input.platformId === "string"
      ? { platformId: input.platformId }
      : {}),
  };
}

function redactSensitiveText(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "[REDACTED_TOKEN]")
    .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
      );
    })
    .join("");
}

function createDedupeKey(
  creatorId: string,
  ideaId: string,
  day: string,
  feedback: Record<string, unknown>,
) {
  return createHash("sha256")
    .update(JSON.stringify({ creatorId, ideaId, day, feedback }))
    .digest("hex");
}

function safeFeedback(record: CreatorFeedback) {
  return {
    id: record._id,
    ideaId: record.ideaId,
    recommendationId: record.recommendationId ?? null,
    rating: record.rating ?? null,
    reasonCodes: record.reasonCodes ?? [],
    comment: record.comment ?? null,
    languageId: record.languageId ?? null,
    nicheId: record.nicheId ?? null,
    platformId: record.platformId ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000,
  );
}
