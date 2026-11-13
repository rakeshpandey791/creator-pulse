import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  AuthSession,
  AuditLogRepository,
  PasswordResetRepository,
  SafeUser,
  SessionRepository,
  UserRecord,
  UserRepository,
} from "../infrastructure/persistence/repository-ports.js";
import {
  createToken,
  hashPassword,
  hashRefreshToken,
  verifyPassword,
  verifyToken,
} from "./auth-crypto.js";
import type { PasswordResetMailer } from "./password-reset-mailer.js";

export interface IdentityRepositories {
  users: UserRepository;
  sessions: SessionRepository;
  passwordResets: PasswordResetRepository;
  auditLogs: AuditLogRepository;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MeResponse {
  id: string;
  email: string;
  displayName?: string;
  role: UserRecord["role"];
  status: UserRecord["status"];
  entitlements: { plan: "free"; status: "active" };
}

const ACCESS_TTL_SECONDS = 24 * 60 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_LOGIN_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export class IdentityService {
  private readonly failures = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly recoveryAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("AUTH_SECRET must be configured in production");
        })()
      : randomBytes(32).toString("hex"));

  constructor(
    private readonly repositories: IdentityRepositories,
    private readonly mailer: PasswordResetMailer,
  ) {}

  async requestPasswordReset(
    email: string,
    key = "unknown",
  ): Promise<{ message: string }> {
    try {
      this.assertRecoveryRateLimited(key);
    } catch (error) {
      await this.audit("password_recovery_requested", "failure", undefined, {
        rateLimited: true,
      });
      throw error;
    }
    const emailNormalized = normalizeEmail(email);
    this.recordRecoveryAttempt(key);
    const user = await this.repositories.users.findSafeByEmail(emailNormalized);
    if (user?.status === "active") {
      const token = randomBytes(32).toString("base64url");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
      try {
        await this.repositories.passwordResets.insert({
          _id: randomUUID(),
          userId: user._id,
          tokenHash: hashRefreshToken(token),
          expiresAt,
          usedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        await this.mailer.sendPasswordReset({
          to: user.emailNormalized,
          token,
          expiresAt,
        });
        await this.audit("password_recovery_requested", "success", user._id);
      } catch (error) {
        await this.audit("password_recovery_requested", "failure", user._id);
        throw error;
      }
    } else {
      await this.audit("password_recovery_requested", "success", undefined, {
        accountFound: false,
      });
    }
    return {
      message: "If an account exists, recovery instructions will be sent",
    };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ success: true }> {
    if (password.length < 8) {
      await this.audit("password_reset", "failure");
      throw new BadRequestException("Password must be at least 8 characters");
    }
    const now = new Date();
    const record = await this.repositories.passwordResets.findValid(
      hashRefreshToken(token),
      now,
    );
    if (
      !record ||
      !(await this.repositories.passwordResets.consume(
        record._id,
        hashRefreshToken(token),
        now,
      ))
    ) {
      await this.audit("password_reset", "failure");
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    const updated = await this.repositories.users.updatePassword(
      record.userId,
      await hashPassword(password),
    );
    if (!updated) {
      await this.audit("password_reset", "failure", record.userId);
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    await this.repositories.sessions.revokeAll(
      { userId: record.userId },
      "password_reset",
    );
    await this.audit("password_reset", "success", record.userId);
    return { success: true };
  }

  async signup(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<AuthTokens & { user: MeResponse }> {
    const emailNormalized = normalizeEmail(email);
    validateCredentials(emailNormalized, password);
    if (await this.repositories.users.findSafeByEmail(emailNormalized)) {
      throw new ConflictException("An account with this email already exists");
    }
    const now = new Date();
    const user: UserRecord = {
      _id: randomUUID(),
      emailNormalized,
      ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
      passwordHash: await hashPassword(password),
      role: "creator",
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    try {
      await this.repositories.users.insert(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          "An account with this email already exists",
        );
      }
      throw error;
    }
    return this.issueForUser(user);
  }

  async login(
    email: string,
    password: string,
    key = "unknown",
  ): Promise<AuthTokens & { user: MeResponse }> {
    this.assertNotRateLimited(key);
    const emailNormalized = normalizeEmail(email);
    const user =
      await this.repositories.users.findForAuthentication(emailNormalized);
    if (
      !user ||
      user.status !== "active" ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      this.recordFailure(key);
      throw new UnauthorizedException("Invalid email or password");
    }
    this.failures.delete(key);
    return this.issueForUser(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const claims = verifyToken(refreshToken, this.secret);
    if (!claims || claims.typ !== "refresh")
      throw new UnauthorizedException("Invalid refresh token");
    const session = await this.repositories.sessions.findForRefresh(
      { userId: claims.sub },
      claims.sid,
    );
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !safeEqual(session.refreshTokenHash, hashRefreshToken(refreshToken))
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const user = await this.repositories.users.findSafeById(claims.sub);
    if (!user || user.status !== "active")
      throw new UnauthorizedException("Invalid refresh token");
    return this.issueForUser(user, {
      previousSessionId: session._id,
      previousRefreshHash: hashRefreshToken(refreshToken),
    });
  }

  async logout(accessToken: string): Promise<{ success: true }> {
    const claims = verifyToken(accessToken, this.secret);
    if (!claims || claims.typ !== "access")
      throw new UnauthorizedException("Invalid access token");
    await this.repositories.sessions.revoke(
      { userId: claims.sub },
      claims.sid,
      "logout",
    );
    return { success: true };
  }

  async me(accessToken: string): Promise<MeResponse> {
    return this.authenticate(accessToken);
  }

  async authenticate(accessToken: string): Promise<MeResponse> {
    const claims = verifyToken(accessToken, this.secret);
    if (!claims || claims.typ !== "access")
      throw new UnauthorizedException("Invalid access token");
    const session = await this.repositories.sessions.findById(
      { userId: claims.sub },
      claims.sid,
    );
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException("Invalid access token");
    }
    const user = await this.repositories.users.findSafeById(claims.sub);
    if (!user || user.status !== "active")
      throw new UnauthorizedException("Invalid access token");
    return toMe(user);
  }

  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<MeResponse> {
    const normalized = displayName.trim();
    if (normalized.length < 2 || normalized.length > 80)
      throw new BadRequestException(
        "Your name must be between 2 and 80 characters",
      );
    if (!/[\p{L}]/u.test(normalized))
      throw new BadRequestException(
        "Your name must include at least one letter",
      );
    const user = await this.repositories.users.updateDisplayName(
      userId,
      normalized,
    );
    if (!user) throw new UnauthorizedException("Your account is not active");
    return toMe(user);
  }

  private async issueForUser(
    user: UserRecord | SafeUser,
    rotation?: { previousSessionId: string; previousRefreshHash: string },
  ): Promise<AuthTokens & { user: MeResponse }> {
    const now = new Date();
    const sessionId = randomUUID();
    const refreshToken = createToken(
      {
        sub: user._id,
        sid: sessionId,
        typ: "refresh",
        exp: Math.floor(now.getTime() / 1000) + REFRESH_TTL_SECONDS,
      },
      this.secret,
    );
    const session: AuthSession = {
      _id: sessionId,
      userId: user._id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
      lastUsedAt: now,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const rotated = rotation
      ? await this.repositories.sessions.rotate(
          { userId: user._id },
          rotation.previousSessionId,
          rotation.previousRefreshHash,
          session,
        )
      : false;
    if (rotation && !rotated) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (!rotation)
      await this.repositories.sessions.insert({ userId: user._id }, session);
    return {
      accessToken: createToken(
        {
          sub: user._id,
          sid: sessionId,
          typ: "access",
          exp: Math.floor(now.getTime() / 1000) + ACCESS_TTL_SECONDS,
        },
        this.secret,
      ),
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
      user: toMe(user),
    };
  }

  private assertNotRateLimited(key: string) {
    const failure = this.failures.get(key);
    if (
      failure &&
      failure.resetAt > Date.now() &&
      failure.count >= MAX_LOGIN_FAILURES
    ) {
      throw new HttpException(
        "Too many login attempts; try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string) {
    const current = this.failures.get(key);
    const now = Date.now();
    const next =
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + FAILURE_WINDOW_MS }
        : { count: current.count + 1, resetAt: current.resetAt };
    this.failures.set(key, next);
  }

  private assertRecoveryRateLimited(key: string) {
    const attempt = this.recoveryAttempts.get(key);
    if (attempt && attempt.resetAt > Date.now() && attempt.count >= 3) {
      throw new HttpException(
        "Too many recovery attempts; try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordRecoveryAttempt(key: string) {
    const current = this.recoveryAttempts.get(key);
    const now = Date.now();
    this.recoveryAttempts.set(
      key,
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + FAILURE_WINDOW_MS }
        : { count: current.count + 1, resetAt: current.resetAt },
    );
  }

  private audit(
    action: string,
    result: "success" | "failure",
    actorId?: string,
    metadata?: Record<string, string | number | boolean>,
  ) {
    const now = new Date();
    return this.repositories.auditLogs.insert({
      _id: randomUUID(),
      eventType: "auth.recovery",
      actorType: actorId ? "user" : "system",
      actorId,
      action,
      result,
      metadata,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function validateCredentials(email: string, password: string) {
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new BadRequestException("A valid email is required");
  if (password.length < 8)
    throw new BadRequestException("Password must be at least 8 characters");
}

function toMe(user: SafeUser | UserRecord): MeResponse {
  return {
    id: user._id,
    email: user.emailNormalized,
    ...(user.displayName ? { displayName: user.displayName } : {}),
    role: user.role,
    status: user.status,
    entitlements: { plan: "free", status: "active" },
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
