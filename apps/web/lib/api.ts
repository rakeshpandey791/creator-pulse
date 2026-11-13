export type AuthUser = { id: string; email: string; displayName?: string };
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
export type CreatorProfile = {
  profileVersion: number;
  nicheIds: string[];
  platformIds: string[];
  languageIds: string[];
  audience: {
    description: string;
    ageBands?: string[];
    geography?: string[];
    interests?: string[];
  };
  contentStyle?: string;
  creatorGoal?: string;
  experienceLevel?: string;
  location?: {
    countryCode: string;
    regionCode?: string;
    city?: string;
    scope: "country" | "region" | "city";
    source: "manual" | "approximate";
  } | null;
  locationConsent?: "manual" | "approximate" | "declined";
};
export type LocalPulse = {
  requestedScope: "country" | "region" | "city";
  scope: "country" | "region" | "city" | null;
  locationLabel: string | null;
  fallbackUsed: boolean;
  coverage: "strong" | "limited" | "unavailable";
  limitation?:
    | "location_not_set"
    | "weak_local_evidence"
    | "stale_evidence"
    | "no_evidence"
    | "source_outage";
  updatedAt: string | null;
  sources: Array<{
    id: string;
    url: string;
    title: string;
    excerpt: string;
    freshness: "fresh" | "aging" | "stale";
    publishedAt: string | null;
    observedAt: string;
  }>;
  signals: Array<{
    id: string;
    topicId: string;
    signalType: string;
    value: number;
    confidence: number | null;
    observedAt: string;
    sourceDocumentId: string;
  }>;
};
export type Plan = {
  id: string;
  code: string;
  name: string;
  monthlyCredits: number;
  isFree: boolean;
  priceMinor: number;
  currency: string;
  operationCosts: { generation: number };
  version: number;
};
export type Credits = {
  balance: number;
  renewalAt: string;
  plan: Omit<Plan, "isFree" | "operationCosts">;
  operationCosts: { generation: number };
  recentActivity: Array<{
    entryType: string;
    amount: number;
    occurredAt: string;
  }>;
};
export type SubscriptionStatus = {
  status: "none" | "active" | "trialing" | "manual" | "cancelled";
  subscriptionId?: string;
  plan?: { id: string; code: string; name: string };
  periodStart?: string;
  periodEnd?: string;
  creditsGranted?: number;
};
export type PaymentCheckoutResponse = {
  transactionId: string;
  providerTransactionId?: string;
  status: "created" | "pending" | "succeeded" | "failed" | "cancelled";
  amountMinor: number;
  currency: string;
  failureCode?: string;
  subscriptionId?: string;
};

export type DiscoveryDimension = {
  value: number;
  weight: number;
  kind: "observed" | "estimated";
  explanation: string;
};

export type DiscoveryScore = {
  _id: string;
  ideaId: string;
  scoreVersion: string;
  overallScore: number;
  label: "Strong opportunity" | "Emerging opportunity" | "Limited signal";
  dimensions: {
    relevance: DiscoveryDimension;
    trendMomentum: DiscoveryDimension;
    freshness: DiscoveryDimension;
    competition: DiscoveryDimension;
  };
  explanation: string;
  coverage: {
    sourceCount: number;
    signalCount: number;
    staleSourceCount: number;
    complete: boolean;
    uncertainty: "none" | "limited" | "unavailable";
    caveat: string;
  };
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IdeaCard = {
  id: string;
  title: string;
  summary: string;
  languageId: string;
  platformId: string;
  nicheId: string;
  score: DiscoveryScore | null;
  reason?: string;
  coverage: {
    sourceCount: number;
    signalCount: number;
    staleSourceCount: number;
    missingEvidence: boolean;
    uncertainty: "none" | "limited" | "unavailable";
  };
};

export type DiscoveryFeed = {
  items: IdeaCard[];
  nextCursor: string | null;
  fallback: {
    kind: "none" | "no_candidates" | "no_eligible_candidates";
    message: string | null;
  };
  rankingVersion: string;
  profileVersion: number;
};

export type IdeaDetail = IdeaCard & {
  topicId: string;
  origin: string;
  audienceAngle?: string;
  recommendedAction?: string;
  evidence: Array<{
    id: string;
    sourceDocumentId: string;
    trendSignalId?: string;
    evidenceType: "trend" | "source" | "freshness" | "competition" | "context";
    summary: string;
    limitations?: string;
    observedAt: string;
    rank: number;
    source: { canonicalUrl: string; title?: string } | null;
  }>;
};

export type IdeaAction = "save" | "dismiss";
export type IdeaStatus =
  "saved" | "planned" | "scripted" | "published" | "dismissed";
export type SavedIdea = {
  _id: string;
  creatorId: string;
  ideaId: string;
  savedAt: string;
  bookmarkLabel?: string;
  currentStatus?: IdeaStatus;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type IdeaStatusEvent = {
  _id: string;
  creatorId: string;
  ideaId: string;
  status: IdeaStatus;
  occurredAt: string;
  source: "user" | "system";
  note?: string;
  createdAt: string;
  updatedAt: string;
};
export type FeedbackReasonCode =
  | "too_generic"
  | "already_covered"
  | "wrong_language"
  | "wrong_audience"
  | "not_timely"
  | "unsafe"
  | "other";
export type FeedbackSubmission = {
  id: string;
  ideaId: string;
  recommendationId: string | null;
  rating: number | null;
  reasonCodes: FeedbackReasonCode[];
  comment: string | null;
  languageId: string | null;
  nicheId: string | null;
  platformId: string | null;
  createdAt: string;
};
export type LibraryItem = {
  saved: SavedIdea;
  status: IdeaStatusEvent | null;
  idea: IdeaDetail;
  assets: GenerationAsset[];
};
export type IdeaActionResponse = {
  ideaId: string;
  action: IdeaAction;
  savedAt: string | null;
  dismissedAt: string | null;
};
export type DraftStartResponse = {
  operationId: string;
  ideaId: string;
  status: "queued" | "running";
};

export type GenerationInput = {
  language: string;
  platform: string;
  outputs: Array<"hooks" | "script" | "cta">;
  durationSeconds: number;
  tone: string;
  creatorContext?: string;
};

export type GenerationAsset = {
  _id: string;
  assetType: "hook" | "script" | "cta";
  content: string;
  languageId: string;
  platformId: string;
  durationSeconds: number;
  tone: string;
  safetyFlags: string[];
  generationId: string;
};

export type GenerationOperation = {
  operationId: string;
  ideaId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
  languageId: string;
  platformId: string;
  promptVersion: string;
  attempts: number;
  phase?: "finding_angle" | "writing_script" | "checking_script";
  groundedAngle?: {
    angle: string;
    rationale: string;
    sourceRefs: string[];
    uncertainty: "none" | "limited" | "unavailable";
  };
  provider?: string;
  model?: string;
  resultAssetIds?: string[];
  error?: { code: string; message: string; retryable: boolean };
  assets?: GenerationAsset[];
};

export type SafetyCheckResponse = {
  decision: "allow" | "warn" | "review" | "reject";
  flags: string[];
  warnings: string[];
  requiredDisclaimers: string[];
  report: {
    language?: string;
    platform?: string;
    niche: string;
    decision: string;
    flags: string[];
    warningCount: number;
    sourceClaimCount: number;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";
const ACCESS_KEY = "creatorpulse.accessToken";
const REFRESH_KEY = "creatorpulse.refreshToken";
let refreshInFlight: Promise<string> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (
    response.status === 401 &&
    allowRefresh &&
    path !== "/auth/refresh" &&
    getRefreshToken() &&
    hasAuthorization(init.headers)
  ) {
    try {
      const accessToken = await refreshAccessToken();
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${accessToken}`);
      return request<T>(path, { ...init, headers }, false);
    } catch {
      clearAuth();
      throw new ApiError(401, "Your session expired. Please sign in again.");
    }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message;
    throw new ApiError(
      response.status,
      message || "Something went wrong. Please try again.",
    );
  }
  return response.json() as Promise<T>;
}

function hasAuthorization(headers?: HeadersInit) {
  if (!headers) return false;
  return new Headers(headers).has("Authorization");
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    const refreshToken = getRefreshToken();
    if (!refreshToken)
      throw new ApiError(401, "No refresh token is available.");
    refreshInFlight = request<AuthTokens>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      false,
    )
      .then((tokens) => {
        storeTokens(tokens);
        return tokens.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

type AuthTokens = Pick<AuthResponse, "accessToken" | "refreshToken">;

export const authApi = {
  signup: (email: string, password: string, displayName: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  profile: (accessToken: string) =>
    request<CreatorProfile | null>("/creator/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  me: (accessToken: string) =>
    request<AuthUser>("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  updateMe: (accessToken: string, displayName: string) =>
    request<AuthUser>("/auth/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ displayName }),
    }),
  logout: (accessToken: string) =>
    request<{ success: true }>("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  recover: (email: string) =>
    request<{ message: string }>("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ success: true }>("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  saveProfile: (accessToken: string, profile: unknown) =>
    request<CreatorProfile>("/creator/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(profile),
    }),
};

export const researchApi = {
  localPulse: (accessToken: string) =>
    request<LocalPulse>("/local-pulse", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

export const commercialApi = {
  plans: () => request<Plan[]>("/plans"),
  credits: (accessToken: string) =>
    request<Credits>("/credits", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  subscription: (accessToken: string) =>
    request<SubscriptionStatus>("/subscriptions", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  checkout: (
    accessToken: string,
    planId: string,
    idempotencyKey: string,
    outcome: "success" | "pending" | "failed" = "success",
  ) =>
    request<PaymentCheckoutResponse>("/subscriptions/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ planId, outcome }),
    }),
  cancel: (accessToken: string) =>
    request<{ subscriptionId: string; status: string; periodEnd: string }>(
      "/subscriptions/cancel",
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
    ),
};

export const discoveryApi = {
  dailyFeed: (
    accessToken: string,
    params: { limit?: number; cursor?: string } = {},
  ) =>
    request<DiscoveryFeed>(`/feed/daily${queryString(params)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  search: (
    accessToken: string,
    params: { q?: string; limit?: number; cursor?: string } = {},
  ) =>
    request<{ items: IdeaCard[]; nextCursor: string | null; query: string }>(
      `/ideas/search${queryString(params)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
  detail: (accessToken: string, ideaId: string) =>
    request<IdeaDetail>(`/ideas/${encodeURIComponent(ideaId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  action: (accessToken: string, ideaId: string, action: IdeaAction) =>
    request<IdeaActionResponse>(
      `/ideas/${encodeURIComponent(ideaId)}/actions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action }),
      },
    ),
  startDraft: (accessToken: string, ideaId: string) =>
    request<DraftStartResponse>(`/ideas/${encodeURIComponent(ideaId)}/drafts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({}),
    }),
  save: (accessToken: string, ideaId: string, bookmarkLabel?: string) =>
    request<LibraryItem>(`/ideas/${encodeURIComponent(ideaId)}/save`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...(bookmarkLabel ? { bookmarkLabel } : {}) }),
    }),
  removeSave: (accessToken: string, ideaId: string) =>
    request<{ ideaId: string; removed: true }>(
      `/ideas/${encodeURIComponent(ideaId)}/save`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    ),
  updateStatus: (
    accessToken: string,
    ideaId: string,
    status: IdeaStatus,
    note?: string,
  ) =>
    request<IdeaStatusEvent>(`/ideas/${encodeURIComponent(ideaId)}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status, ...(note ? { note } : {}) }),
    }),
  library: (
    accessToken: string,
    params: { limit?: number; cursor?: string; status?: IdeaStatus } = {},
  ) =>
    request<{ items: LibraryItem[]; nextCursor: string | null }>(
      `/library${queryString(params)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    ),
  status: (accessToken: string, ideaId: string) =>
    request<{ current: IdeaStatusEvent | null; history: IdeaStatusEvent[] }>(
      `/ideas/${encodeURIComponent(ideaId)}/status`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    ),
  submitFeedback: (
    accessToken: string,
    ideaId: string,
    input: {
      rating?: number;
      reasonCodes?: FeedbackReasonCode[];
      comment?: string;
      recommendationId?: string;
      languageId?: string;
      nicheId?: string;
      platformId?: string;
    },
  ) =>
    request<{ feedback: FeedbackSubmission; duplicate: boolean }>(
      `/ideas/${encodeURIComponent(ideaId)}/feedback`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input),
      },
    ),
  feedbackAnalysis: (
    accessToken: string,
    params: { languageId?: string; nicheId?: string; platformId?: string } = {},
  ) =>
    request<{
      filters: { languageId?: string; nicheId?: string; platformId?: string };
      total: number;
      rated: number;
      averageRating: number | null;
      reasonCounts: Partial<Record<FeedbackReasonCode, number>>;
    }>(`/feedback/analysis${queryString(params)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

export const generationApi = {
  start: (
    accessToken: string,
    ideaId: string,
    input: GenerationInput,
    idempotencyKey: string,
  ) =>
    request<
      GenerationOperation & {
        estimatedCreditCost?: number;
        balanceAfterReservation?: number;
      }
    >(`/ideas/${encodeURIComponent(ideaId)}/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    }),
  status: (accessToken: string, operationId: string) =>
    request<GenerationOperation>(
      `/operations/${encodeURIComponent(operationId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
  cancel: (accessToken: string, operationId: string) =>
    request<GenerationOperation>(
      `/operations/${encodeURIComponent(operationId)}/cancel`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
    ),
};

export const safetyApi = {
  check: (input: {
    text: string;
    niche: string;
    language?: string;
    platform?: string;
  }) =>
    request<SafetyCheckResponse>("/safety/check", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

function queryString(params: Record<string, string | number | undefined>) {
  const values = Object.entries(params).filter(
    ([, value]) => value !== undefined,
  );
  if (!values.length) return "";
  const query = new URLSearchParams(
    values.map(([key, value]) => [key, String(value)]),
  );
  return `?${query.toString()}`;
}

export function storeAuth(auth: AuthResponse) {
  storeTokens(auth);
}

function storeTokens(auth: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_KEY, auth.refreshToken);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}
