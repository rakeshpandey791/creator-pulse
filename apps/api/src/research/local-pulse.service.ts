import { Injectable } from "@nestjs/common";
import type { Db, Filter } from "mongodb";
import type { CreatorProfile } from "../infrastructure/persistence/repository-ports.js";
import type { CreatorProfileService } from "../creator/creator-profile.service.js";

export type LocalPulseScope = NonNullable<CreatorProfile["location"]>;
export type LocalPulseFilters = {
  languageIds: string[];
  nicheIds: string[];
};

export type LocalPulseSourceRecord = {
  _id: string;
  canonicalUrl: string;
  title?: string;
  excerpt?: string;
  languageId?: string;
  retrievalStatus: "active" | "stale" | "blocked" | "failed";
  location?: Pick<LocalPulseScope, "countryCode" | "regionCode" | "city">;
  publishedAt?: Date | null;
  observedAt: Date;
};

export type LocalPulseSignalRecord = {
  _id: string;
  sourceDocumentId: string;
  topicId: string;
  signalType: string;
  value: number;
  confidence?: number;
  observedAt: Date;
};

export interface LocalPulseStore {
  list(
    scope: LocalPulseScope,
    filters: LocalPulseFilters,
    limit: number,
  ): Promise<{
    sources: LocalPulseSourceRecord[];
    signals: LocalPulseSignalRecord[];
  }>;
}

export type LocalPulseResult = {
  requestedScope: LocalPulseScope["scope"];
  scope: LocalPulseScope["scope"] | null;
  locationLabel: string | null;
  fallbackUsed: boolean;
  coverage: "strong" | "limited" | "unavailable";
  limitation?:
    | "location_not_set"
    | "weak_local_evidence"
    | "stale_evidence"
    | "no_evidence"
    | "source_outage";
  updatedAt: Date | null;
  sources: Array<{
    id: string;
    url: string;
    title: string;
    excerpt: string;
    freshness: "fresh" | "aging" | "stale";
    publishedAt: Date | null;
    observedAt: Date;
  }>;
  signals: Array<{
    id: string;
    topicId: string;
    signalType: string;
    value: number;
    confidence: number | null;
    observedAt: Date;
    sourceDocumentId: string;
  }>;
};

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;
const MAX_SOURCES = 8;
const MAX_SIGNALS = 16;

@Injectable()
export class LocalPulseService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; result: LocalPulseResult }
  >();

  constructor(
    private readonly profiles: CreatorProfileService,
    private readonly store: LocalPulseStore,
  ) {}

  async getForCreator(
    creatorId: string,
    now = new Date(),
  ): Promise<LocalPulseResult> {
    const profile = await this.profiles.get(creatorId);
    const location = profile?.location;
    if (!location || profile?.locationConsent === "declined") {
      return unavailable("country", "location_not_set");
    }

    const filters = {
      languageIds: profile.languageIds,
      nicheIds: profile.nicheIds,
    } satisfies LocalPulseFilters;
    const key = cacheKey(location, filters);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now.getTime()) return cached.result;
    if (cached) this.cache.delete(key);

    let best: LocalPulseResult | null = null;
    for (const scope of fallbackScopes(location)) {
      let records: Awaited<ReturnType<LocalPulseStore["list"]>>;
      try {
        records = await this.store.list(scope, filters, MAX_SOURCES);
      } catch {
        return unavailable(location.scope, "source_outage");
      }
      const result = buildResult(location, scope, records, now);
      if (!best || resultQuality(result) > resultQuality(best)) best = result;
      if (result.coverage === "strong") break;
    }

    const result = best ?? unavailable(location.scope, "no_evidence");
    this.cache.set(key, { expiresAt: now.getTime() + CACHE_TTL_MS, result });
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
      else break;
    }
    return result;
  }
}

export class InMemoryLocalPulseStore implements LocalPulseStore {
  constructor(
    private readonly sources: LocalPulseSourceRecord[] = [],
    private readonly signals: LocalPulseSignalRecord[] = [],
    private readonly unavailable = false,
  ) {}

  async list(
    scope: LocalPulseScope,
    filters: LocalPulseFilters,
    limit: number,
  ) {
    if (this.unavailable) throw new Error("research source unavailable");
    const sourceIds = new Set(
      this.sources
        .filter(
          (source) =>
            matchesScope(source.location, scope) &&
            source.retrievalStatus !== "blocked" &&
            source.retrievalStatus !== "failed" &&
            (!source.languageId ||
              filters.languageIds.includes(source.languageId)),
        )
        .sort(
          (left, right) =>
            right.observedAt.getTime() - left.observedAt.getTime(),
        )
        .slice(0, limit)
        .map((source) => source._id),
    );
    return {
      sources: this.sources.filter((source) => sourceIds.has(source._id)),
      signals: this.signals
        .filter((signal) => sourceIds.has(signal.sourceDocumentId))
        .slice(0, MAX_SIGNALS),
    };
  }
}

export class MongoLocalPulseStore implements LocalPulseStore {
  constructor(private readonly db: Db) {}

  async list(
    scope: LocalPulseScope,
    filters: LocalPulseFilters,
    limit: number,
  ) {
    const topics = await this.db
      .collection("content_topics")
      .find({
        nicheIds: { $in: filters.nicheIds },
        languageIds: { $in: filters.languageIds },
      })
      .project({ _id: 1 })
      .limit(100)
      .toArray();
    const topicIds = topics.map((topic) => topic._id);
    if (!topicIds.length) return { sources: [], signals: [] };

    const sourceFilter = {
      "location.countryCode": scope.countryCode,
      ...(scope.scope === "region" || scope.scope === "city"
        ? { "location.regionCode": scope.regionCode }
        : {}),
      ...(scope.scope === "city" ? { "location.city": scope.city } : {}),
      retrievalStatus: { $in: ["active", "stale"] as const },
    } as unknown as Filter<LocalPulseSourceRecord>;
    const sources = (await this.db
      .collection<LocalPulseSourceRecord>("source_documents")
      .find(sourceFilter)
      .sort({ observedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), MAX_SOURCES))
      .project({
        _id: 1,
        canonicalUrl: 1,
        title: 1,
        excerpt: 1,
        languageId: 1,
        retrievalStatus: 1,
        location: 1,
        publishedAt: 1,
        observedAt: 1,
      })
      .toArray()) as unknown as LocalPulseSourceRecord[];
    const sourceIds = sources.map((source) => source._id);
    if (!sourceIds.length) return { sources, signals: [] };
    const signals = (await this.db
      .collection<LocalPulseSignalRecord>("trend_signals")
      .find({
        sourceDocumentId: { $in: sourceIds },
        topicId: { $in: topicIds },
      })
      .sort({ observedAt: -1 })
      .limit(MAX_SIGNALS)
      .toArray()) as unknown as LocalPulseSignalRecord[];
    return { sources, signals };
  }
}

function fallbackScopes(location: LocalPulseScope): LocalPulseScope[] {
  const scopes: LocalPulseScope[] = [];
  if (location.scope === "city" && location.regionCode && location.city) {
    scopes.push(location);
    scopes.push({
      countryCode: location.countryCode,
      regionCode: location.regionCode,
      scope: "region",
      source: location.source,
    });
  }
  if (location.scope === "region" && location.regionCode) scopes.push(location);
  scopes.push({
    countryCode: location.countryCode,
    scope: "country",
    source: location.source,
  });
  return scopes.filter(
    (scope, index) =>
      scopes.findIndex(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(scope),
      ) === index,
  );
}

function matchesScope(
  sourceLocation: LocalPulseSourceRecord["location"],
  scope: LocalPulseScope,
) {
  if (!sourceLocation || sourceLocation.countryCode !== scope.countryCode)
    return false;
  if (scope.scope === "country") return true;
  if (sourceLocation.regionCode !== scope.regionCode) return false;
  return scope.scope === "region" || sourceLocation.city === scope.city;
}

function buildResult(
  requested: LocalPulseScope,
  scope: LocalPulseScope,
  records: Awaited<ReturnType<LocalPulseStore["list"]>>,
  now: Date,
): LocalPulseResult {
  const sources = records.sources
    .filter(
      (source) =>
        source.retrievalStatus === "active" ||
        source.retrievalStatus === "stale",
    )
    .sort(
      (left, right) => right.observedAt.getTime() - left.observedAt.getTime(),
    )
    .slice(0, MAX_SOURCES)
    .map((source) => ({
      id: source._id,
      url: source.canonicalUrl,
      title: (source.title ?? "Untitled source").slice(0, 160),
      excerpt: (source.excerpt ?? "").slice(0, 280),
      freshness: freshnessOf(source.publishedAt ?? source.observedAt, now),
      publishedAt: source.publishedAt ?? null,
      observedAt: source.observedAt,
    }));
  const sourceIds = new Set(sources.map((source) => source.id));
  const signals = records.signals
    .filter((signal) => sourceIds.has(signal.sourceDocumentId))
    .sort(
      (left, right) => right.observedAt.getTime() - left.observedAt.getTime(),
    )
    .slice(0, MAX_SIGNALS)
    .map((signal) => ({
      id: signal._id,
      topicId: signal.topicId,
      signalType: signal.signalType,
      value: signal.value,
      confidence: signal.confidence ?? null,
      observedAt: signal.observedAt,
      sourceDocumentId: signal.sourceDocumentId,
    }));
  const freshSources = sources.filter(
    (source) => source.freshness === "fresh",
  ).length;
  const coverage =
    freshSources > 0 && signals.length > 0
      ? sources.length >= 2
        ? "strong"
        : "limited"
      : sources.length > 0
        ? "limited"
        : "unavailable";
  const limitation =
    coverage === "strong"
      ? undefined
      : sources.length === 0
        ? "no_evidence"
        : freshSources === 0
          ? "stale_evidence"
          : "weak_local_evidence";
  return {
    requestedScope: requested.scope,
    scope: scope.scope,
    locationLabel: labelFor(scope),
    fallbackUsed: requested.scope !== scope.scope,
    coverage,
    ...(limitation ? { limitation } : {}),
    updatedAt: sources[0]?.observedAt ?? null,
    sources,
    signals,
  };
}

function freshnessOf(date: Date, now: Date): "fresh" | "aging" | "stale" {
  const age = Math.max(0, now.getTime() - date.getTime());
  if (age <= 48 * 60 * 60 * 1000) return "fresh";
  if (age <= 7 * 24 * 60 * 60 * 1000) return "aging";
  return "stale";
}

function resultQuality(result: LocalPulseResult) {
  if (result.coverage === "strong") return 3;
  if (result.coverage === "limited") return 2;
  return result.sources.length ? 1 : 0;
}

function labelFor(scope: LocalPulseScope) {
  if (scope.scope === "city") return `${scope.city}, ${scope.regionCode}`;
  if (scope.scope === "region") return scope.regionCode ?? scope.countryCode;
  return scope.countryCode;
}

function unavailable(
  requestedScope: LocalPulseScope["scope"],
  limitation: NonNullable<LocalPulseResult["limitation"]>,
): LocalPulseResult {
  return {
    requestedScope,
    scope: null,
    locationLabel: null,
    fallbackUsed: false,
    coverage: "unavailable",
    limitation,
    updatedAt: null,
    sources: [],
    signals: [],
  };
}

function cacheKey(scope: LocalPulseScope, filters: LocalPulseFilters) {
  return JSON.stringify({
    scope,
    languages: [...filters.languageIds].sort(),
    niches: [...filters.nicheIds].sort(),
  });
}
