import type {
  Collection,
  Db,
  Document,
  Filter,
  OptionalUnlessRequiredId,
  UpdateFilter,
} from "mongodb";
import type {
  AuthSession,
  AuditLogRecord,
  AuditLogRepository,
  AssetRecord,
  CreatorProfile,
  CreatorProfileRepository,
  CreatorScope,
  CreditRecord,
  CursorPage,
  Entity,
  FeedbackRecord,
  GlobalRepository,
  IdeaRecord,
  OperationRecord,
  RecommendationRecord,
  RepositoryPorts,
  ResearchRecord,
  SafeUser,
  ScopedRepository,
  SessionRepository,
  SubscriptionRecord,
  TaxonomyRecord,
  TaxonomyRepository,
  UserRepository,
  UserRecord,
  UserScope,
  PasswordResetRecord,
  PasswordResetRepository,
} from "./repository-ports.js";

const SAFE_USER_PROJECTION = { passwordHash: 0 };
const SAFE_OPERATION_PROJECTION = {
  prompt: 0,
  providerPayload: 0,
  rawResponse: 0,
};
const DEFAULT_LIMIT = 50;

export class OrphanReferenceError extends Error {
  constructor(
    public readonly collectionName: string,
    public readonly documentId: string,
    public readonly reference: string,
  ) {
    super(
      `Cannot persist ${collectionName}/${documentId}: referenced ${reference} does not exist`,
    );
    this.name = "OrphanReferenceError";
  }
}

export class OwnershipMutationError extends Error {
  constructor(public readonly ownerField: string) {
    super(`Scoped updates cannot modify ownership field ${ownerField}`);
    this.name = "OwnershipMutationError";
  }
}

type ReferenceGuard<T> = (document: T) => Promise<void>;

function assertOwnershipImmutable<T extends Entity>(
  update: UpdateFilter<T>,
  ownerField: string,
) {
  const changes = update as Record<string, unknown>;
  if (ownerField in changes) throw new OwnershipMutationError(ownerField);

  for (const [operator, value] of Object.entries(changes)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const fields = value as Record<string, unknown>;
    if (ownerField in fields) throw new OwnershipMutationError(ownerField);
    if (
      operator === "$rename" &&
      Object.values(fields).some((target) => target === ownerField)
    ) {
      throw new OwnershipMutationError(ownerField);
    }
  }
}

export class ScopedMongoRepository<
  T extends Entity,
> implements ScopedRepository<T> {
  constructor(
    private readonly collection: Collection<T>,
    private readonly ownerField = "creatorId",
    private readonly projection?: Document,
    private readonly referenceGuard?: ReferenceGuard<T>,
  ) {}

  private ownerFilter(
    scope: CreatorScope,
    filter: Filter<T> = {} as Filter<T>,
  ): Filter<T> {
    return { ...filter, [this.ownerField]: scope.creatorId } as Filter<T>;
  }

  async findById(scope: CreatorScope, id: string): Promise<Readonly<T> | null> {
    return this.collection.findOne(
      this.ownerFilter(scope, { _id: id } as Filter<T>),
      {
        projection: this.projection,
      },
    ) as Promise<Readonly<T> | null>;
  }

  async list(
    scope: CreatorScope,
    filter = {} as Filter<T>,
    limit = DEFAULT_LIMIT,
    cursor?: string,
  ): Promise<CursorPage<Readonly<T>>> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const ownerFilter = this.ownerFilter(scope, filter);
    const query = cursor
      ? ({ $and: [ownerFilter, { _id: { $gt: cursor } }] } as Filter<T>)
      : ownerFilter;
    const items = await this.collection
      .find(query, { projection: this.projection })
      .sort({ _id: 1 })
      .limit(boundedLimit + 1)
      .toArray();
    const hasNext = items.length > boundedLimit;
    const page = hasNext ? items.slice(0, boundedLimit) : items;
    return {
      items: page as Readonly<T>[],
      nextCursor: hasNext ? (page.at(-1)?._id ?? null) : null,
    };
  }

  async insert(scope: CreatorScope, document: T): Promise<Readonly<T>> {
    const owned = { ...document, [this.ownerField]: scope.creatorId } as T;
    await this.referenceGuard?.(owned);
    await this.collection.insertOne(owned as OptionalUnlessRequiredId<T>);
    const inserted = await this.collection.findOne(
      { _id: owned._id } as Filter<T>,
      { projection: this.projection },
    );
    if (!inserted) {
      throw new Error(`Inserted document ${owned._id} could not be read back`);
    }
    return inserted as Readonly<T>;
  }

  async update(
    scope: CreatorScope,
    id: string,
    update: UpdateFilter<T>,
  ): Promise<Readonly<T> | null> {
    assertOwnershipImmutable(update, this.ownerField);
    await this.collection.updateOne(
      this.ownerFilter(scope, { _id: id } as Filter<T>),
      update,
    );
    return this.findById(scope, id);
  }

  async updateIfVersion(
    scope: CreatorScope,
    id: string,
    expectedVersion: number,
    update: UpdateFilter<T>,
  ): Promise<Readonly<T> | null> {
    assertOwnershipImmutable(update, this.ownerField);
    const result = await this.collection.updateOne(
      this.ownerFilter(scope, {
        _id: id,
        profileVersion: expectedVersion,
      } as unknown as Filter<T>),
      update,
    );
    return result.matchedCount === 1 ? this.findById(scope, id) : null;
  }
}

export class GlobalMongoRepository<
  T extends Entity,
> implements GlobalRepository<T> {
  constructor(
    private readonly collection: Collection<T>,
    private readonly projection?: Document,
  ) {}

  async findById(id: string): Promise<Readonly<T> | null> {
    return this.collection.findOne({ _id: id } as Filter<T>, {
      projection: this.projection,
    }) as Promise<Readonly<T> | null>;
  }

  async list(
    filter = {} as Filter<T>,
    limit = DEFAULT_LIMIT,
    cursor?: string,
  ): Promise<CursorPage<Readonly<T>>> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const query = cursor
      ? ({ $and: [filter, { _id: { $gt: cursor } }] } as Filter<T>)
      : filter;
    const items = await this.collection
      .find(query, { projection: this.projection })
      .sort({ _id: 1 })
      .limit(boundedLimit + 1)
      .toArray();
    const hasNext = items.length > boundedLimit;
    const page = hasNext ? items.slice(0, boundedLimit) : items;
    return {
      items: page as Readonly<T>[],
      nextCursor: hasNext ? (page.at(-1)?._id ?? null) : null,
    };
  }

  async insert(document: T): Promise<Readonly<T>> {
    await this.collection.insertOne(document as OptionalUnlessRequiredId<T>);
    const inserted = await this.findById(document._id);
    if (!inserted) {
      throw new Error(
        `Inserted document ${document._id} could not be read back`,
      );
    }
    return inserted;
  }

  async update(
    id: string,
    update: UpdateFilter<T>,
  ): Promise<Readonly<T> | null> {
    await this.collection.updateOne({ _id: id } as Filter<T>, update);
    return this.findById(id);
  }
}

class TaxonomyMongoRepository<
  T extends TaxonomyRecord,
> implements TaxonomyRepository<T> {
  constructor(private readonly collection: Collection<T>) {}

  async listActive(): Promise<Readonly<T>[]> {
    return (await this.collection
      .find({ isActive: true } as Filter<T>)
      .sort({ sortOrder: 1 })
      .toArray()) as Readonly<T>[];
  }

  async findByCodes(codes: string[]): Promise<Readonly<T>[]> {
    return (await this.collection
      .find({ code: { $in: codes }, isActive: true } as Filter<T>)
      .toArray()) as Readonly<T>[];
  }
}

class MongoUsers implements UserRepository {
  constructor(private readonly collection: Collection<UserRecord>) {}

  findForAuthentication(emailNormalized: string): Promise<UserRecord | null> {
    return this.collection.findOne({
      emailNormalized,
      deletedAt: null,
    } as Filter<UserRecord>);
  }

  findSafeById(id: string): Promise<SafeUser | null> {
    return this.collection.findOne({ _id: id } as Filter<UserRecord>, {
      projection: SAFE_USER_PROJECTION,
    }) as Promise<SafeUser | null>;
  }

  findSafeByEmail(emailNormalized: string): Promise<SafeUser | null> {
    return this.collection.findOne(
      { emailNormalized, deletedAt: null } as Filter<UserRecord>,
      { projection: SAFE_USER_PROJECTION },
    ) as Promise<SafeUser | null>;
  }

  async insert(document: UserRecord): Promise<SafeUser> {
    await this.collection.insertOne(document);
    return this.findSafeById(document._id) as Promise<SafeUser>;
  }

  async updateDisplayName(userId: string, displayName: string) {
    await this.collection.updateOne(
      { _id: userId, status: "active", deletedAt: null } as Filter<UserRecord>,
      { $set: { displayName, updatedAt: new Date() } },
    );
    return this.findSafeById(userId);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: userId, status: "active", deletedAt: null } as Filter<UserRecord>,
      { $set: { passwordHash, updatedAt: new Date() } },
    );
    return result.matchedCount === 1;
  }
}

class MongoSessions implements SessionRepository {
  constructor(private readonly collection: Collection<AuthSession>) {}

  findById(
    scope: UserScope,
    id: string,
  ): Promise<Readonly<AuthSession> | null> {
    return this.collection.findOne(
      { _id: id, userId: scope.userId } as Filter<AuthSession>,
      {
        projection: { refreshTokenHash: 0 },
      },
    );
  }

  findForRefresh(scope: UserScope, id: string): Promise<AuthSession | null> {
    return this.collection.findOne({
      _id: id,
      userId: scope.userId,
      revokedAt: null,
    } as Filter<AuthSession>);
  }

  async insert(
    scope: UserScope,
    document: AuthSession,
  ): Promise<Readonly<AuthSession>> {
    const owned = { ...document, userId: scope.userId };
    await this.collection.insertOne(owned);
    return this.findById(scope, document._id) as Promise<Readonly<AuthSession>>;
  }

  async revoke(
    scope: UserScope,
    id: string,
    reason: string,
  ): Promise<Readonly<AuthSession> | null> {
    await this.collection.updateOne(
      { _id: id, userId: scope.userId, revokedAt: null } as Filter<AuthSession>,
      {
        $set: {
          revokedAt: new Date(),
          revokeReason: reason,
          updatedAt: new Date(),
        },
      },
    );
    return this.findById(scope, id);
  }

  async revokeAll(scope: UserScope, reason: string): Promise<void> {
    await this.collection.updateMany(
      { userId: scope.userId, revokedAt: null } as Filter<AuthSession>,
      {
        $set: {
          revokedAt: new Date(),
          revokeReason: reason,
          updatedAt: new Date(),
        },
      },
    );
  }

  async rotate(
    scope: UserScope,
    id: string,
    refreshTokenHash: string,
    replacement: AuthSession,
  ): Promise<boolean> {
    const claimed = await this.collection.findOneAndUpdate(
      {
        _id: id,
        userId: scope.userId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      } as Filter<AuthSession>,
      {
        $set: {
          revokedAt: new Date(),
          revokeReason: "refresh_rotation",
          updatedAt: new Date(),
        },
      },
    );
    if (!claimed) return false;
    await this.collection.insertOne(replacement);
    return true;
  }
}

export class MongoPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly collection: Collection<PasswordResetRecord>) {}

  async insert(document: PasswordResetRecord): Promise<void> {
    await this.collection.insertOne(document);
  }

  findValid(tokenHash: string, now: Date): Promise<PasswordResetRecord | null> {
    return this.collection.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    } as Filter<PasswordResetRecord>);
  }

  async consume(id: string, tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.collection.updateOne(
      {
        _id: id,
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: now },
      } as Filter<PasswordResetRecord>,
      { $set: { usedAt: now, updatedAt: now } },
    );
    return result.modifiedCount === 1;
  }
}

export class MongoAuditLogRepository implements AuditLogRepository {
  constructor(private readonly collection: Collection<AuditLogRecord>) {}

  async insert(document: AuditLogRecord): Promise<void> {
    await this.collection.insertOne(document);
  }
}

function scoped<T extends Entity>(
  db: Db,
  collection: string,
  ownerField = "creatorId",
  projection?: Document,
  referenceGuard?: ReferenceGuard<T>,
) {
  return new ScopedMongoRepository(
    db.collection<T>(collection),
    ownerField,
    projection,
    referenceGuard,
  );
}

function global<T extends Entity>(db: Db, collection: string) {
  return new GlobalMongoRepository(db.collection<T>(collection));
}

export function createMongoRepositories(db: Db): RepositoryPorts {
  const requireReference = async (
    collectionName: string,
    documentId: string,
    reference: string,
    filter: Record<string, unknown>,
  ) => {
    if (
      !(await db.collection(collectionName).findOne(filter as Filter<Document>))
    ) {
      throw new OrphanReferenceError(collectionName, documentId, reference);
    }
  };
  const requireIdea = (document: { _id: string; ideaId?: string }) =>
    document.ideaId
      ? requireReference(
          "content_ideas",
          document._id,
          `content_ideas/${document.ideaId}`,
          { _id: document.ideaId },
        )
      : Promise.resolve();

  return {
    users: new MongoUsers(db.collection<UserRecord>("users")),
    sessions: new MongoSessions(db.collection<AuthSession>("auth_sessions")),
    passwordResets: new MongoPasswordResetRepository(
      db.collection<PasswordResetRecord>("password_resets"),
    ),
    auditLogs: new MongoAuditLogRepository(
      db.collection<AuditLogRecord>("audit_logs"),
    ),
    creatorProfiles: scoped<CreatorProfile>(
      db,
      "creator_profiles",
      "userId",
    ) as CreatorProfileRepository,
    niches: new TaxonomyMongoRepository(
      db.collection<TaxonomyRecord>("niches"),
    ),
    languages: new TaxonomyMongoRepository(
      db.collection<TaxonomyRecord>("languages"),
    ),
    platforms: new TaxonomyMongoRepository(
      db.collection<TaxonomyRecord>("platforms"),
    ),
    contentTopics: global<ResearchRecord>(db, "content_topics"),
    sourceDocuments: global<ResearchRecord>(db, "source_documents"),
    trendSignals: global<ResearchRecord>(db, "trend_signals"),
    contentIdeas: global<IdeaRecord>(db, "content_ideas"),
    ideaEvidence: global<ResearchRecord>(db, "idea_evidence"),
    ideaScores: global<ResearchRecord>(db, "idea_scores"),
    recommendations: scoped<RecommendationRecord>(
      db,
      "idea_recommendations",
      "creatorId",
      undefined,
      requireIdea,
    ),
    assets: scoped<AssetRecord>(
      db,
      "idea_assets",
      "creatorId",
      undefined,
      requireIdea,
    ),
    feedback: scoped<FeedbackRecord>(
      db,
      "creator_feedback",
      "creatorId",
      undefined,
      async (document) => {
        await requireIdea(document);
        if (document.recommendationId) {
          await requireReference(
            "idea_recommendations",
            document._id,
            `idea_recommendations/${document.recommendationId}`,
            { _id: document.recommendationId, creatorId: document.creatorId },
          );
        }
      },
    ),
    operations: scoped<OperationRecord>(
      db,
      "ai_operations",
      "creatorId",
      SAFE_OPERATION_PROJECTION,
    ),
    credits: scoped<CreditRecord>(db, "credit_ledger"),
    subscriptions: scoped<SubscriptionRecord>(db, "creator_subscriptions"),
  };
}
