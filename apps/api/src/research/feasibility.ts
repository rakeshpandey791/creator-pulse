import {
  deduplicateSourceDocuments,
  SourceAdapterError,
  type NormalizedSourceDocument,
  type SourceAdapter,
} from "./source-adapters.js";

export type TermsReview = {
  permitted: boolean;
  note: string;
  reviewedAt: Date;
};

export type FeasibilitySource = {
  adapter: SourceAdapter;
  terms: TermsReview;
  representativeSignals: readonly string[];
  signalOf?: (document: NormalizedSourceDocument) => string | undefined;
};

export type FeasibilityReport = {
  sourceName: string;
  sourceType: SourceAdapter["sourceType"];
  available: boolean;
  fetchedCount: number;
  normalizedCount: number;
  duplicateCount: number;
  normalizationCompleteness: number;
  freshnessCoverage: number;
  staleCount: number;
  missingPublishedCount: number;
  signalCoverage: number;
  rateLimitObserved: boolean;
  error?: { code: string; retryable: boolean; message: string };
  terms: TermsReview;
  gaps: string[];
};

export type FeasibilityResult = {
  report: FeasibilityReport;
  documents: NormalizedSourceDocument[];
  decision: "go" | "conditional" | "no_go";
};

export type FallbackResult = FeasibilityResult & {
  fallbackUsed: boolean;
  primary: FeasibilityResult;
  fallback?: FeasibilityResult;
};

const requiredFields = [
  "sourceType",
  "sourceName",
  "canonicalUrl",
  "title",
  "observedAt",
  "rawContentHash",
  "retrievalStatus",
  "createdAt",
  "updatedAt",
] as const;

export async function runFeasibilityProbe(
  source: FeasibilitySource,
  options: { now?: Date; maxAgeMs?: number } = {},
): Promise<FeasibilityResult> {
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? 1000 * 60 * 60 * 24 * 7;
  const gaps: string[] = [];

  if (!hasTermsEvidence(source.terms)) {
    return result(source, [], [], 0, undefined, now, maxAgeMs, [
      source.terms.permitted
        ? "source terms review evidence is missing"
        : "source terms are not approved for permitted use",
    ]);
  }

  try {
    const fetched = await source.adapter.fetch({ now });
    const documents = deduplicateSourceDocuments(fetched);
    const duplicateCount = fetched.length - documents.length;
    return result(
      source,
      fetched,
      documents,
      duplicateCount,
      undefined,
      now,
      maxAgeMs,
      gaps,
    );
  } catch (error) {
    const normalized =
      error instanceof SourceAdapterError
        ? error
        : new SourceAdapterError("unavailable", "Source fetch failed", true, {
            cause: error,
          });
    return result(source, [], [], 0, normalized, now, maxAgeMs, [
      normalized.message,
    ]);
  }
}

export async function runWithFallback(
  primary: FeasibilitySource,
  fallback: FeasibilitySource,
  options: { now?: Date; maxAgeMs?: number } = {},
): Promise<FallbackResult> {
  const primaryResult = await runFeasibilityProbe(primary, options);
  if (primaryResult.documents.length > 0 && primaryResult.report.available) {
    return { ...primaryResult, fallbackUsed: false, primary: primaryResult };
  }
  const fallbackResult = await runFeasibilityProbe(fallback, options);
  return {
    ...(fallbackResult.documents.length > 0 ? fallbackResult : primaryResult),
    fallbackUsed: fallbackResult.documents.length > 0,
    primary: primaryResult,
    fallback: fallbackResult,
  };
}

function result(
  source: FeasibilitySource,
  fetched: NormalizedSourceDocument[],
  documents: NormalizedSourceDocument[],
  duplicateCount: number,
  error: SourceAdapterError | undefined,
  now: Date,
  maxAgeMs: number,
  initialGaps: string[],
): FeasibilityResult {
  const completeness = documents.length
    ? documents.filter((document) =>
        requiredFields.every((field) => document[field] !== undefined),
      ).length / documents.length
    : 0;
  const dated = documents.filter((document) => document.publishedAt);
  const missingPublishedCount = documents.length - dated.length;
  const staleCount = dated.filter(
    (document) => now.getTime() - document.publishedAt!.getTime() > maxAgeMs,
  ).length;
  const freshnessCoverage = documents.length
    ? dated.filter(
        (document) =>
          now.getTime() - document.publishedAt!.getTime() <= maxAgeMs,
      ).length / documents.length
    : 0;
  const observedSignals = new Set(
    documents.map((document) => source.signalOf?.(document)).filter(Boolean),
  );
  const signalCoverage = source.representativeSignals.length
    ? source.representativeSignals.filter((signal) =>
        observedSignals.has(signal),
      ).length / source.representativeSignals.length
    : 1;
  const gaps = [...initialGaps];
  if (!documents.length) gaps.push("source returned no usable documents");
  if (completeness < 1) gaps.push("provenance normalization is incomplete");
  if (staleCount) gaps.push(`${staleCount} document(s) are stale`);
  if (missingPublishedCount)
    gaps.push(
      `${missingPublishedCount} document(s) are missing publication dates`,
    );
  if (signalCoverage < 1)
    gaps.push("representative signal coverage is incomplete");
  if (error instanceof SourceAdapterError) {
    gaps.push(`source error: ${error.code}`);
  }
  const report: FeasibilityReport = {
    sourceName: source.adapter.name,
    sourceType: source.adapter.sourceType,
    available: !error && documents.length > 0,
    fetchedCount: fetched.length,
    normalizedCount: documents.length,
    duplicateCount,
    normalizationCompleteness: completeness,
    freshnessCoverage,
    staleCount,
    missingPublishedCount,
    signalCoverage,
    rateLimitObserved:
      error instanceof SourceAdapterError && error.code === "rate_limited",
    ...(error instanceof SourceAdapterError
      ? {
          error: {
            code: error.code,
            retryable: error.retryable,
            message: error.message,
          },
        }
      : {}),
    terms: source.terms,
    gaps,
  };
  const decision =
    !hasTermsEvidence(source.terms) || !report.available || completeness < 1
      ? "no_go"
      : staleCount || missingPublishedCount || signalCoverage < 1
        ? "conditional"
        : "go";
  return { report, documents, decision };
}

function hasTermsEvidence(terms: TermsReview) {
  return (
    terms.permitted &&
    terms.note.trim().length > 0 &&
    Number.isFinite(terms.reviewedAt.getTime())
  );
}
