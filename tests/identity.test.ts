import { describe, expect, it } from "vitest";
import { InMemoryIdentityRepositories } from "../apps/api/src/identity/in-memory-identity-repositories.js";
import { IdentityService } from "../apps/api/src/identity/identity.service.js";
import { DevelopmentMailSink } from "../apps/api/src/identity/password-reset-mailer.js";

function service() {
  const repositories = new InMemoryIdentityRepositories();
  return new IdentityService(
    {
      users: repositories.users,
      sessions: repositories.sessions,
      passwordResets: repositories.passwordResets,
      auditLogs: repositories.auditLogs,
    },
    new DevelopmentMailSink(),
  );
}

describe("identity lifecycle", () => {
  it("signs up, authenticates and returns a secret-free me response", async () => {
    const identity = service();
    const result = await identity.signup(
      " Creator@Example.com ",
      "correct horse battery staple",
    );
    expect(result.user.email).toBe("creator@example.com");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect((await identity.me(result.accessToken)).entitlements.plan).toBe(
      "free",
    );
  });

  it("updates the creator display name without exposing account secrets", async () => {
    const identity = service();
    const result = await identity.signup(
      "creator@example.com",
      "correct horse battery staple",
      "Asha",
    );
    const updated = await identity.updateDisplayName(
      result.user.id,
      "Asha Verma",
    );
    expect(updated.displayName).toBe("Asha Verma");
    expect(updated).not.toHaveProperty("passwordHash");
    await expect(
      identity.updateDisplayName(result.user.id, "1"),
    ).rejects.toThrow("must be between");
  });

  it("rejects duplicate active emails and rotates refresh tokens", async () => {
    const identity = service();
    const first = await identity.signup(
      "creator@example.com",
      "correct horse battery staple",
    );
    await expect(
      identity.signup("CREATOR@example.com", "another password"),
    ).rejects.toThrow("already exists");
    const rotated = await identity.refresh(first.refreshToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    await expect(identity.refresh(first.refreshToken)).rejects.toThrow(
      "Invalid refresh token",
    );
  });

  it("allows only one concurrent refresh rotation", async () => {
    const identity = service();
    const first = await identity.signup(
      "creator@example.com",
      "correct horse battery staple",
    );
    const results = await Promise.allSettled([
      identity.refresh(first.refreshToken),
      identity.refresh(first.refreshToken),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("revokes the session on logout and rate-limits brute-force attempts", async () => {
    const identity = service();
    const result = await identity.signup(
      "creator@example.com",
      "correct horse battery staple",
    );
    await identity.logout(result.accessToken);
    await expect(identity.me(result.accessToken)).rejects.toThrow(
      "Invalid access token",
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        identity.login("creator@example.com", "wrong password", "test-ip"),
      ).rejects.toThrow();
    }
    await expect(
      identity.login("creator@example.com", "wrong password", "test-ip"),
    ).rejects.toThrow("Too many login attempts");
  });

  it("keeps recovery requests indistinguishable and resets once", async () => {
    const repositories = new InMemoryIdentityRepositories();
    const mailer = new DevelopmentMailSink();
    const identity = new IdentityService(
      {
        users: repositories.users,
        sessions: repositories.sessions,
        passwordResets: repositories.passwordResets,
        auditLogs: repositories.auditLogs,
      },
      mailer,
    );
    const signup = await identity.signup(
      "creator@example.com",
      "correct horse battery staple",
    );
    const unknown = await identity.requestPasswordReset(
      "missing@example.com",
      "recovery-a",
    );
    const known = await identity.requestPasswordReset(
      "creator@example.com",
      "recovery-b",
    );
    expect(known).toEqual(unknown);
    expect(mailer.messages).toHaveLength(1);
    await identity.resetPassword(mailer.messages[0]!.token, "new password");
    await expect(
      identity.resetPassword(mailer.messages[0]!.token, "new password"),
    ).rejects.toThrow("Invalid or expired");
    await expect(identity.refresh(signup.refreshToken)).rejects.toThrow(
      "Invalid refresh token",
    );
    await expect(
      identity.login("creator@example.com", "new password"),
    ).resolves.toBeDefined();
  });

  it("rate-limits recovery without exposing account existence", async () => {
    const identity = service();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await identity.requestPasswordReset("missing@example.com", "same-ip");
    }
    await expect(
      identity.requestPasswordReset("creator@example.com", "same-ip"),
    ).rejects.toThrow("Too many recovery attempts");
  });
});
