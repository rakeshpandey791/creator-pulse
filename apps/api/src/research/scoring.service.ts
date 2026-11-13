import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import type {
  ContentIdea,
  IdeaSourceDocument,
  IdeaTrendSignal,
} from "./idea-creation.service.js";

export const REC02_SCORE_VERSION = "rec-02-v1";
export const SCORE_WEIGHTS = {
  relevance: 0.35,
  trendMomentum: 0.3,
  freshness: 0.2,
  competition: 0.15,
} as const;

export type ScoreDimensionName = keyof typeof SCORE_WEIGHTS;
export type ScoreValueKind = "observed" | "estimated";

export type ScoreDimension = {
  value: number;
  weight: number;
  kind: ScoreValueKind;
  explanation: string;
};

export type ScoreDimensions = Record<ScoreDimensionName, ScoreDimension>;

export type ScoreCoverage = {
  sourceCount: number;
  signalCount: number;
  staleSourceCount: number;
  complete: boolean;
  uncertainty: "none" | "limited" | "unavailable";
  caveat: string;
};

export type IdeaScoreLabel =
  "Strong opportunity" | "Emerging opportunity" | "Limited signal";

export type IdeaScoreSnapshot = {
  _id: string;
  ideaId: string;
  scoreVersion: string;
  overallScore: number;
  label: IdeaScoreLabel;
  dimensions: ScoreDimensions;
  explanation: string;
  coverage: ScoreCoverage;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ScoreInput = {
  idea: ContentIdea;
  sources: IdeaSourceDocument[];
  signals: IdeaTrendSignal[];
  /** Creator/profile matching supplied by a caller that has that context. */
  relevance?: number;
  /** Saturation estimate from a research provider, normalized to 0..1. */
  competition?: number;
};

export type IdeaScoreStore = {
  findCurrent(ideaId: string): Promise<IdeaScoreSnapshot | null>;
  persistCurrent(snapshot: IdeaScoreSnapshot): Promise<IdeaScoreSnapshot>;
};

const FRESHNESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function calculateIdeaScore(
  input: ScoreInput,
  now = new Date(),
  scoreVersion = REC02_SCORE_VERSION,
): IdeaScoreSnapshot {
  const dimensions = calculateDimensions(input, now);
  const overallScore = round(
    (Object.keys(SCORE_WEIGHTS) as ScoreDimensionName[]).reduce(
      (total, name) => total + dimensions[name].value * dimensions[name].weight,
      0,
    ),
  );
  const label = labelForScore(overallScore);
  const coverage = calculateCoverage(input, now);
  const explanation = explainScore(label, dimensions, coverage);
  const timestamp = now.toISOString();

  return {
    _id: stableId(`idea-score|${input.idea._id}|${scoreVersion}|${timestamp}`),
    ideaId: input.idea._id,
    scoreVersion,
    overallScore,
    label,
    dimensions,
    explanation,
    coverage,
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
  };
}

export class IdeaScoringService {
  constructor(
    private readonly store: IdeaScoreStore,
    private readonly now: () => Date = () => new Date(),
    private readonly scoreVersion = REC02_SCORE_VERSION,
  ) {}

  async score(input: ScoreInput) {
    const snapshot = calculateIdeaScore(input, this.now(), this.scoreVersion);
    return this.store.persistCurrent(snapshot);
  }

  getCurrent(ideaId: string) {
    return this.store.findCurrent(ideaId);
  }
}

export class InMemoryIdeaScoreStore implements IdeaScoreStore {
  readonly snapshots = new Map<string, IdeaScoreSnapshot>();

  async findCurrent(ideaId: string) {
    return (
      [...this.snapshots.values()].find(
        (snapshot) => snapshot.ideaId === ideaId && snapshot.isCurrent,
      ) ?? null
    );
  }

  async persistCurrent(snapshot: IdeaScoreSnapshot) {
    for (const [id, current] of this.snapshots) {
      if (current.ideaId === snapshot.ideaId && current.isCurrent)
        this.snapshots.set(id, { ...current, isCurrent: false });
    }
    this.snapshots.set(snapshot._id, structuredClone(snapshot));
    return snapshot;
  }
}

export class MongoIdeaScoreStore implements IdeaScoreStore {
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

  findCurrent(ideaId: string) {
    return this.db.collection<IdeaScoreSnapshot>("idea_scores").findOne({
      ideaId,
      isCurrent: true,
    });
  }

  async persistCurrent(snapshot: IdeaScoreSnapshot) {
    if (await this.transactionSupport) {
      const session = this.db.client.startSession();
      try {
        await session.withTransaction(async () => {
          await this.db
            .collection<IdeaScoreSnapshot>("idea_scores")
            .updateMany(
              { ideaId: snapshot.ideaId, isCurrent: true },
              { $set: { isCurrent: false, updatedAt: snapshot.updatedAt } },
              { session },
            );
          await this.db
            .collection<IdeaScoreSnapshot>("idea_scores")
            .insertOne(snapshot, { session });
        });
        return snapshot;
      } finally {
        await session.endSession();
      }
    }
    return this.persistWithoutTransaction(snapshot);
  }

  private async persistWithoutTransaction(snapshot: IdeaScoreSnapshot) {
    const collection = this.db.collection<IdeaScoreSnapshot>("idea_scores");
    const previous = await collection.findOne({
      ideaId: snapshot.ideaId,
      isCurrent: true,
    });
    try {
      if (previous)
        await collection.updateOne(
          { _id: previous._id, isCurrent: true },
          { $set: { isCurrent: false, updatedAt: snapshot.updatedAt } },
        );
      await collection.insertOne(snapshot);
      return snapshot;
    } catch (error) {
      await collection.deleteOne({ _id: snapshot._id });
      if (previous)
        await collection.updateOne(
          { _id: previous._id },
          { $set: { isCurrent: true, updatedAt: previous.updatedAt } },
        );
      throw error;
    }
  }

  private async detectTransactionSupport() {
    const hello = await this.db.command({ hello: 1 });
    return Boolean(hello.setName || hello.msg === "isdbgrid");
  }
}

function calculateDimensions(input: ScoreInput, now: Date): ScoreDimensions {
  const relevance = clampPercent(input.relevance ?? 0.75);
  const relevanceKind: ScoreValueKind =
    input.relevance === undefined ? "estimated" : "observed";
  const momentumSignals = input.signals.filter(
    (signal) =>
      signal.signalType === "momentum" || signal.signalType === "volume",
  );
  const momentum = mean(
    momentumSignals.map((signal) => normalizeSignal(signal.value)),
  );
  const freshnessValues = input.sources.map((source) => {
    if (source.retrievalStatus === "stale") return 0;
    const publishedAt = source.publishedAt ?? source.observedAt;
    return clamp01(
      1 - (now.getTime() - publishedAt.getTime()) / FRESHNESS_WINDOW_MS,
    );
  });
  const competitionSignals = input.signals.filter(
    (signal) => signal.signalType === "competition",
  );
  const competitionObserved =
    input.competition ??
    (competitionSignals.length
      ? mean(
          competitionSignals.map((signal) => 1 - normalizeSignal(signal.value)),
        )
      : undefined);
  const estimatedCompetition = 1 - Math.min(input.sources.length / 10, 0.8);

  return {
    relevance: {
      value: relevance,
      weight: SCORE_WEIGHTS.relevance,
      kind: relevanceKind,
      explanation:
        input.relevance === undefined
          ? "Creator-specific fit is estimated because no profile match was supplied."
          : "Matches the creator profile context supplied for this calculation.",
    },
    trendMomentum: {
      value: clampPercent(momentum),
      weight: SCORE_WEIGHTS.trendMomentum,
      kind: momentumSignals.length ? "observed" : "estimated",
      explanation: momentumSignals.length
        ? `Derived from ${momentumSignals.length} observed momentum/volume signal${momentumSignals.length === 1 ? "" : "s"}.`
        : "No momentum signal was observed; the score is treated as a coverage gap.",
    },
    freshness: {
      value: clampPercent(mean(freshnessValues)),
      weight: SCORE_WEIGHTS.freshness,
      kind: input.sources.length ? "observed" : "estimated",
      explanation: input.sources.length
        ? `Based on publication/observation age over a ${Math.round(FRESHNESS_WINDOW_MS / 86_400_000)}-day window.`
        : "No source evidence was available to measure freshness.",
    },
    competition: {
      value: clampPercent(competitionObserved ?? estimatedCompetition),
      weight: SCORE_WEIGHTS.competition,
      kind: competitionObserved === undefined ? "estimated" : "observed",
      explanation:
        competitionObserved === undefined
          ? "Competition is estimated from source coverage; this is not a market guarantee."
          : "Lower observed saturation is converted into a higher opportunity score.",
    },
  };
}

function calculateCoverage(input: ScoreInput, now: Date): ScoreCoverage {
  const staleSourceCount = input.sources.filter((source) => {
    const publishedAt = source.publishedAt ?? source.observedAt;
    return (
      source.retrievalStatus === "stale" ||
      now.getTime() - publishedAt.getTime() > FRESHNESS_WINDOW_MS
    );
  }).length;
  const sourceCount = input.sources.length;
  const signalCount = input.signals.length;
  const complete = sourceCount > 0 && signalCount > 0 && staleSourceCount === 0;
  const uncertainty =
    sourceCount === 0 && signalCount === 0
      ? "unavailable"
      : complete
        ? "none"
        : "limited";
  const caveat = complete
    ? "Coverage is current for the supplied evidence."
    : sourceCount === 0
      ? "No source evidence is available; treat this score as directional only."
      : staleSourceCount > 0
        ? `${staleSourceCount} source${staleSourceCount === 1 ? " is" : "s are"} stale; treat this score as directional only.`
        : "Some dimensions are estimated because supporting signals are incomplete.";
  return {
    sourceCount,
    signalCount,
    staleSourceCount,
    complete,
    uncertainty,
    caveat,
  };
}

function explainScore(
  label: IdeaScoreLabel,
  dimensions: ScoreDimensions,
  coverage: ScoreCoverage,
) {
  const values = (Object.keys(SCORE_WEIGHTS) as ScoreDimensionName[])
    .map((name) => `${prettyName(name)} ${dimensions[name].value}/100`)
    .join(", ");
  return `${label}: ${values}. ${coverage.caveat}`;
}

export function labelForScore(score: number): IdeaScoreLabel {
  if (score >= 75) return "Strong opportunity";
  if (score >= 50) return "Emerging opportunity";
  return "Limited signal";
}

function prettyName(name: ScoreDimensionName) {
  return name === "trendMomentum" ? "trend momentum" : name;
}

function normalizeSignal(value: number) {
  return clamp01(Math.abs(value) > 1 ? value / 100 : value);
}

function clampPercent(value: number) {
  return round(clamp01(value) * 100);
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
