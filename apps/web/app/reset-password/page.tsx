"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, authApi } from "../../lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) {
      return setError(
        "This reset link is missing its token. Request a new one.",
      );
    }
    if (password.length < 8) {
      return setError("Use at least 8 characters for your password.");
    }
    if (password !== confirmation) {
      return setError("Passwords do not match.");
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setComplete(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not reset your password. Request a new link and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="site-shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            CP
          </span>
          CreatorPulse
        </Link>
      </nav>
      <section className="auth-layout">
        <div className="auth-card">
          <div className="eyebrow">Account recovery</div>
          <h2>Choose a new password.</h2>
          {complete ? (
            <>
              <p className="success" role="status">
                Your password has been reset. You can sign in with it now.
              </p>
              <Link className="button button-primary" href="/login">
                Continue to sign in →
              </Link>
            </>
          ) : (
            <form className="form" onSubmit={submit} noValidate>
              <label className="field">
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <span className="helper">At least 8 characters.</span>
              </label>
              <label className="field">
                Confirm new password
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="button button-primary"
                disabled={busy || !token}
              >
                {busy ? "Resetting…" : "Reset password →"}
              </button>
              {!token && (
                <p className="helper">
                  This page must be opened from the password reset link in your
                  email.
                </p>
              )}
              <Link className="helper" href="/recover">
                Request another reset link
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
