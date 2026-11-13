import type {
  AuthSession,
  AuditLogRecord,
  AuditLogRepository,
  PasswordResetRecord,
  PasswordResetRepository,
  SafeUser,
  SessionRepository,
  UserRecord,
  UserRepository,
  UserScope,
} from "../infrastructure/persistence/repository-ports.js";

class MemoryUsers implements UserRepository {
  private readonly users = new Map<string, UserRecord>();

  findForAuthentication(emailNormalized: string): Promise<UserRecord | null> {
    return Promise.resolve(
      [...this.users.values()].find(
        (user) =>
          user.emailNormalized === emailNormalized && user.deletedAt == null,
      ) ?? null,
    );
  }

  findSafeById(id: string): Promise<SafeUser | null> {
    const user = this.users.get(id);
    if (!user) return Promise.resolve(null);
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return Promise.resolve(safe);
  }

  findSafeByEmail(emailNormalized: string): Promise<SafeUser | null> {
    return this.findForAuthentication(emailNormalized).then((user) => {
      if (!user) return null;
      const { passwordHash, ...safe } = user;
      void passwordHash;
      return safe;
    });
  }

  insert(document: UserRecord): Promise<SafeUser> {
    this.users.set(document._id, { ...document });
    return this.findSafeById(document._id) as Promise<SafeUser>;
  }

  async updateDisplayName(userId: string, displayName: string) {
    const user = this.users.get(userId);
    if (!user || user.status !== "active" || user.deletedAt != null)
      return null;
    this.users.set(userId, { ...user, displayName, updatedAt: new Date() });
    return this.findSafeById(userId);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || user.status !== "active" || user.deletedAt != null)
      return false;
    this.users.set(userId, { ...user, passwordHash, updatedAt: new Date() });
    return true;
  }
}

class MemorySessions implements SessionRepository {
  private readonly sessions = new Map<string, AuthSession>();

  findById(
    scope: UserScope,
    id: string,
  ): Promise<Readonly<AuthSession> | null> {
    const session = this.sessions.get(id);
    return Promise.resolve(
      session?.userId === scope.userId ? { ...session } : null,
    );
  }

  findForRefresh(scope: UserScope, id: string): Promise<AuthSession | null> {
    const session = this.sessions.get(id);
    return Promise.resolve(
      session?.userId === scope.userId ? { ...session } : null,
    );
  }

  insert(
    scope: UserScope,
    document: AuthSession,
  ): Promise<Readonly<AuthSession>> {
    const owned = { ...document, userId: scope.userId };
    this.sessions.set(owned._id, owned);
    return Promise.resolve({ ...owned });
  }

  revoke(
    scope: UserScope,
    id: string,
    reason: string,
  ): Promise<Readonly<AuthSession> | null> {
    const session = this.sessions.get(id);
    if (!session || session.userId !== scope.userId)
      return Promise.resolve(null);
    const revoked = {
      ...session,
      revokedAt: new Date(),
      revokeReason: reason,
      updatedAt: new Date(),
    };
    this.sessions.set(id, revoked);
    return Promise.resolve({ ...revoked });
  }

  async revokeAll(scope: UserScope, reason: string): Promise<void> {
    const now = new Date();
    for (const [id, session] of this.sessions) {
      if (session.userId === scope.userId && session.revokedAt == null) {
        this.sessions.set(id, {
          ...session,
          revokedAt: now,
          revokeReason: reason,
          updatedAt: now,
        });
      }
    }
  }

  rotate(
    scope: UserScope,
    id: string,
    refreshTokenHash: string,
    replacement: AuthSession,
  ): Promise<boolean> {
    const current = this.sessions.get(id);
    if (
      !current ||
      current.userId !== scope.userId ||
      current.revokedAt ||
      current.expiresAt.getTime() <= Date.now() ||
      current.refreshTokenHash !== refreshTokenHash
    )
      return Promise.resolve(false);
    this.sessions.set(id, {
      ...current,
      revokedAt: new Date(),
      revokeReason: "refresh_rotation",
      updatedAt: new Date(),
    });
    this.sessions.set(replacement._id, { ...replacement });
    return Promise.resolve(true);
  }
}

class MemoryPasswordResets implements PasswordResetRepository {
  private readonly records = new Map<string, PasswordResetRecord>();

  insert(document: PasswordResetRecord): Promise<void> {
    this.records.set(document._id, { ...document });
    return Promise.resolve();
  }

  findValid(tokenHash: string, now: Date): Promise<PasswordResetRecord | null> {
    return Promise.resolve(
      [...this.records.values()].find(
        (record) =>
          record.tokenHash === tokenHash &&
          record.usedAt == null &&
          record.expiresAt.getTime() > now.getTime(),
      ) ?? null,
    );
  }

  async consume(id: string, tokenHash: string, now: Date): Promise<boolean> {
    const record = this.records.get(id);
    if (
      !record ||
      record.tokenHash !== tokenHash ||
      record.usedAt != null ||
      record.expiresAt.getTime() <= now.getTime()
    )
      return false;
    this.records.set(id, { ...record, usedAt: now, updatedAt: now });
    return true;
  }
}

export class MemoryAuditLogRepository implements AuditLogRepository {
  readonly records: AuditLogRecord[] = [];

  insert(document: AuditLogRecord): Promise<void> {
    this.records.push({ ...document });
    return Promise.resolve();
  }
}

export class InMemoryIdentityRepositories {
  readonly users: UserRepository = new MemoryUsers();
  readonly sessions: SessionRepository = new MemorySessions();
  readonly passwordResets: PasswordResetRepository = new MemoryPasswordResets();
  readonly auditLogs: AuditLogRepository = new MemoryAuditLogRepository();
}
