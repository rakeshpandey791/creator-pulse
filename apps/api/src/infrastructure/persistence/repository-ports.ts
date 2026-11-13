import type { Document, Filter, UpdateFilter } from "mongodb";

export interface CreatorScope {
  creatorId: string;
}

export interface UserScope {
  userId: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export type Entity = Document & { _id: string };

export interface ScopedRepository<T extends Entity> {
  findById(scope: CreatorScope, id: string): Promise<Readonly<T> | null>;
  list(
    scope: CreatorScope,
    filter?: Filter<T>,
    limit?: number,
    cursor?: string,
  ): Promise<CursorPage<Readonly<T>>>;
  insert(scope: CreatorScope, document: T): Promise<Readonly<T>>;
  update(
    scope: CreatorScope,
    id: string,
    update: UpdateFilter<T>,
  ): Promise<Readonly<T> | null>;
}

export interface CreatorProfileRepository extends ScopedRepository<CreatorProfile> {
  updateIfVersion(
    scope: CreatorScope,
    id: string,
    expectedVersion: number,
    update: UpdateFilter<CreatorProfile>,
  ): Promise<Readonly<CreatorProfile> | null>;
}

export interface GlobalRepository<T extends Entity> {
  findById(id: string): Promise<Readonly<T> | null>;
  list(
    filter?: Filter<T>,
    limit?: number,
    cursor?: string,
  ): Promise<CursorPage<Readonly<T>>>;
  insert(document: T): Promise<Readonly<T>>;
  update(id: string, update: UpdateFilter<T>): Promise<Readonly<T> | null>;
}

export interface UserRepository {
  findForAuthentication(emailNormalized: string): Promise<UserRecord | null>;
  findSafeById(id: string): Promise<SafeUser | null>;
  findSafeByEmail(emailNormalized: string): Promise<SafeUser | null>;
  insert(document: UserRecord): Promise<SafeUser>;
  updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<SafeUser | null>;
  updatePassword(userId: string, passwordHash: string): Promise<boolean>;
}

export type PasswordResetRecord = Entity & {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface PasswordResetRepository {
  insert(document: PasswordResetRecord): Promise<void>;
  findValid(tokenHash: string, now: Date): Promise<PasswordResetRecord | null>;
  consume(id: string, tokenHash: string, now: Date): Promise<boolean>;
}

export type AuditLogRecord = Entity & {
  eventType: string;
  actorType: "user" | "system";
  actorId?: string;
  action: string;
  result: "success" | "failure";
  metadata?: Record<string, string | number | boolean>;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export interface AuditLogRepository {
  insert(document: AuditLogRecord): Promise<void>;
}

export interface SessionRepository {
  findById(scope: UserScope, id: string): Promise<Readonly<AuthSession> | null>;
  findForRefresh(scope: UserScope, id: string): Promise<AuthSession | null>;
  insert(
    scope: UserScope,
    document: AuthSession,
  ): Promise<Readonly<AuthSession>>;
  revoke(
    scope: UserScope,
    id: string,
    reason: string,
  ): Promise<Readonly<AuthSession> | null>;
  revokeAll(scope: UserScope, reason: string): Promise<void>;
  rotate(
    scope: UserScope,
    id: string,
    refreshTokenHash: string,
    replacement: AuthSession,
  ): Promise<boolean>;
}

export interface TaxonomyRepository<T extends Entity> {
  listActive(): Promise<Readonly<T>[]>;
  findByCodes(codes: string[]): Promise<Readonly<T>[]>;
}

export type UserRecord = Entity & {
  emailNormalized: string;
  displayName?: string;
  passwordHash: string;
  role: "creator" | "admin";
  status: "pending" | "active" | "suspended" | "deleted";
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type SafeUser = Omit<UserRecord, "passwordHash">;

export type AuthSession = Entity & {
  userId: string;
  refreshTokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date | null;
  revokeReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatorProfile = Entity & {
  userId: string;
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
  profileVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};
export type TaxonomyRecord = Entity & {
  code: string;
  name?: string;
  script?: string;
  dialect?: string;
  supportsHinglish?: boolean;
  isActive: boolean;
  sortOrder: number;
};
export type ResearchRecord = Entity & { createdAt: Date; updatedAt: Date };
export type IdeaRecord = Entity & {
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type RecommendationRecord = Entity & {
  creatorId: string;
  ideaId: string;
  createdAt: Date;
  updatedAt: Date;
};
export type AssetRecord = Entity & {
  creatorId: string;
  ideaId: string;
  createdAt: Date;
  updatedAt: Date;
};
export type FeedbackRecord = Entity & {
  creatorId: string;
  ideaId?: string;
  recommendationId?: string;
  createdAt: Date;
  updatedAt: Date;
};
export type OperationRecord = Entity & {
  creatorId: string;
  ideaId?: string;
  createdAt: Date;
  updatedAt: Date;
};
export type CreditRecord = Entity & {
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionRecord = Entity & {
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface RepositoryPorts {
  users: UserRepository;
  sessions: SessionRepository;
  passwordResets: PasswordResetRepository;
  auditLogs: AuditLogRepository;
  creatorProfiles: CreatorProfileRepository;
  niches: TaxonomyRepository<TaxonomyRecord>;
  languages: TaxonomyRepository<TaxonomyRecord>;
  platforms: TaxonomyRepository<TaxonomyRecord>;
  contentTopics: GlobalRepository<ResearchRecord>;
  sourceDocuments: GlobalRepository<ResearchRecord>;
  trendSignals: GlobalRepository<ResearchRecord>;
  contentIdeas: GlobalRepository<IdeaRecord>;
  ideaEvidence: GlobalRepository<ResearchRecord>;
  ideaScores: GlobalRepository<ResearchRecord>;
  recommendations: ScopedRepository<RecommendationRecord>;
  assets: ScopedRepository<AssetRecord>;
  feedback: ScopedRepository<FeedbackRecord>;
  operations: ScopedRepository<OperationRecord>;
  credits: ScopedRepository<CreditRecord>;
  subscriptions: ScopedRepository<SubscriptionRecord>;
}
