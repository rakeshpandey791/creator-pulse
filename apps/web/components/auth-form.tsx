"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, authApi, storeAuth } from "../lib/api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8)
      return setError("Use at least 8 characters for your password.");
    if (mode === "signup" && !displayName.trim())
      return setError("Tell us your name to personalize your workspace.");
    setBusy(true);
    try {
      const response =
        mode === "login"
          ? await authApi.login(email, password)
          : await authApi.signup(email, password, displayName.trim());
      storeAuth(response);
      if (mode === "login") {
        const profile = await authApi.profile(response.accessToken);
        router.push(profile ? "/app" : "/onboarding");
      } else {
        router.push("/onboarding");
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof TypeError
            ? "CreatorPulse is having trouble connecting. Please try again in a moment."
            : "We could not complete that request. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      {mode === "signup" && (
        <label className="field">
          Your first and last name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </label>
      )}
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
      <label className="field">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
        <span className="helper">At least 8 characters.</span>
      </label>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button className="button button-primary" disabled={busy}>
        {busy
          ? "One moment…"
          : mode === "login"
            ? "Sign in →"
            : "Create my workspace →"}
      </button>
      {mode === "login" && (
        <Link className="helper" href="/recover">
          Forgot your password?
        </Link>
      )}
    </form>
  );
}
