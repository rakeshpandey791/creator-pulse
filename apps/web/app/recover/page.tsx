"use client";
import Link from "next/link";
import { useState } from "react";
import { ApiError, authApi } from "../../lib/api";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      await authApi.recover(email);
      setMessage(
        "If an account matches that email, recovery instructions are on their way.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not send recovery instructions. Try again.",
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
          <h2>Back to making.</h2>
          <p className="helper">
            Enter your email and we’ll send a secure reset link if there’s an
            account.
          </p>
          <form className="form" onSubmit={submit} noValidate>
            <label className="field">
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="success" role="status">
                {message}
              </div>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy ? "Sending…" : "Send reset link →"}
            </button>
            <Link className="helper" href="/login">
              ← Back to sign in
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
