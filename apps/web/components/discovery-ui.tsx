"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLanguage } from "@creator-pulse/contracts";
import {
  ApiError,
  authApi,
  clearAuth,
  commercialApi,
  discoveryApi,
  getAccessToken,
  type DiscoveryScore,
  type IdeaCard,
} from "../lib/api";

type NavIconName =
  | "today"
  | "explore"
  | "library"
  | "usage"
  | "settings"
  | "context"
  | "help"
  | "signout";

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "today":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 9h8M8 13h5M8 17h3" />
        </svg>
      );
    case "explore":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9 3.9-1.7Z" />
        </svg>
      );
    case "library":
      return (
        <svg {...common}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z" />
          <path d="M5 5.5V21M9 7h6M9 11h6" />
        </svg>
      );
    case "usage":
      return (
        <svg {...common}>
          <path d="M5 19V9M12 19V5M19 19v-7" />
          <path d="M3 19h18" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="m19 13 .1-1-.1-1 2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a8 8 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.5 3.1h5l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4L19 13Z" />
        </svg>
      );
    case "context":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.8 9.5a2.3 2.3 0 1 1 3.7 1.8c-.9.7-1.5 1.1-1.5 2.2M12 16.5h.01" />
        </svg>
      );
    case "signout":
      return (
        <svg {...common}>
          <path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
          <path d="M10 16l4-4-4-4M14 12H4" />
        </svg>
      );
  }
}

export function DiscoveryShell({
  active,
  children,
}: {
  active: "today" | "explore" | "library" | "usage" | "settings";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [accountName, setAccountName] = useState("Creator");
  const [accountFocus, setAccountFocus] = useState("Your creative context");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    Promise.all([
      authApi.me(token),
      authApi.profile(token),
      commercialApi.credits(token),
    ])
      .then(([user, profile, credits]) => {
        setAccountName(user.displayName?.trim() || "Creator");
        setCreditBalance(credits.balance);
        if (profile?.nicheIds.length) {
          setAccountFocus(
            profile.nicheIds.slice(0, 2).map(taxonomyLabel).join(" · "),
          );
        }
      })
      .catch(() => {
        // The shell remains usable if account context is temporarily unavailable.
      });
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const token = getAccessToken();
      if (token) await authApi.logout(token);
    } finally {
      clearAuth();
      router.push("/login");
    }
  }

  return (
    <main className="discovery-shell">
      <aside className="discovery-rail">
        <Link className="brand" href="/app">
          <span className="brand-mark" aria-hidden="true">
            CP
          </span>
          CreatorPulse
        </Link>
        <Link className="rail-primary" href="/app?compose=1">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Create script</span>
        </Link>
        <nav className="discovery-nav-links" aria-label="Primary navigation">
          <Link className={active === "today" ? "active" : ""} href="/app">
            <span className="nav-glyph">
              <NavIcon name="today" />
            </span>
            <span>Today</span>
          </Link>
          <Link
            className={active === "explore" ? "active" : ""}
            href="/app/explore"
          >
            <span className="nav-glyph">
              <NavIcon name="explore" />
            </span>
            <span>Explore</span>
          </Link>
          <span className="nav-section-label">Workspace</span>
          <Link
            className={active === "library" ? "active" : ""}
            href="/app/library"
          >
            <span className="nav-glyph">
              <NavIcon name="library" />
            </span>
            <span>Library</span>
          </Link>
          <Link
            className={active === "usage" ? "active" : ""}
            href="/app/usage"
          >
            <span className="nav-glyph">
              <NavIcon name="usage" />
            </span>
            Usage
          </Link>
          <Link
            className={active === "settings" ? "active" : ""}
            href="/app/settings/profile"
          >
            <span className="nav-glyph">
              <NavIcon name="settings" />
            </span>
            Settings
          </Link>
        </nav>
        <div className="rail-footer">
          <div className="rail-footer-actions">
            <Link className="rail-help" href="/help">
              <span className="nav-glyph">
                <NavIcon name="help" />
              </span>
              <span>Help</span>
            </Link>
            <button
              className="rail-signout"
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <span className="nav-glyph">
                <NavIcon name="signout" />
              </span>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <button
            className="profile-button"
            type="button"
            aria-label="Edit creative context"
            onClick={() => router.push("/onboarding")}
          >
            <span className="profile-avatar" aria-hidden="true">
              <NavIcon name="context" />
            </span>
            <span className="profile-copy">
              <strong>{accountName}</strong>
              <small>{accountFocus}</small>
            </span>
          </button>
        </div>
      </aside>
      <section className="discovery-main">
        <header className="discovery-topbar">
          <Link className="topbar-search" href="/app/explore">
            <span aria-hidden="true">⌕</span>
            Search hooks, niches, or signals...
            <kbd>⌘K</kbd>
          </Link>
          <div className="topbar-actions">
            <span className="language-pill">
              EN <span aria-hidden="true">⌄</span>
            </span>
            <Link className="credit-balance" href="/app/usage">
              <span className="credit-dot" aria-hidden="true" />
              {creditBalance === null ? "Credits" : `${creditBalance} credits`}
            </Link>
          </div>
        </header>
        <div className="discovery-content">{children}</div>
      </section>
      <nav className="mobile-discovery-nav" aria-label="Mobile navigation">
        <Link className={active === "today" ? "active" : ""} href="/app">
          <span className="nav-glyph">
            <NavIcon name="today" />
          </span>
          Today
        </Link>
        <Link
          className={active === "explore" ? "active" : ""}
          href="/app/explore"
        >
          <span className="nav-glyph">
            <NavIcon name="explore" />
          </span>
          Explore
        </Link>
        <Link
          className={active === "library" ? "active" : ""}
          href="/app/library"
        >
          <span className="nav-glyph">
            <NavIcon name="library" />
          </span>
          Library
        </Link>
        <Link
          className={active === "settings" ? "active" : ""}
          href="/app/settings/profile"
        >
          <span className="nav-glyph">
            <NavIcon name="settings" />
          </span>
          Settings
        </Link>
      </nav>
    </main>
  );
}

const taxonomyLabels: Record<string, string> = {
  "5f4e5c8b-3f7b-4f2a-9b31-000000000001": "Fitness",
  "5f4e5c8b-3f7b-4f2a-9b31-000000000002": "Food",
  "5f4e5c8b-3f7b-4f2a-9b31-000000000003": "Comedy",
  "5f4e5c8b-3f7b-4f2a-9b31-000000000004": "Personal finance",
  "5f4e5c8b-3f7b-4f2a-9b31-000000000005": "Beauty",
  "5f4e5c8b-3f7b-4f2a-9b31-000000000006": "Education",
  "6f4e5c8b-3f7b-4f2a-9b31-000000000001": "Hindi",
  "6f4e5c8b-3f7b-4f2a-9b31-000000000002": "Hinglish",
  "6f4e5c8b-3f7b-4f2a-9b31-000000000003": "English",
  "7f4e5c8b-3f7b-4f2a-9b31-000000000001": "Instagram",
  "7f4e5c8b-3f7b-4f2a-9b31-000000000002": "YouTube",
  "7f4e5c8b-3f7b-4f2a-9b31-000000000003": "Facebook",
};

export function taxonomyLabel(value: string) {
  return (
    getLanguage(value)?.name ??
    taxonomyLabels[value] ??
    value.replace(/[-_]+/g, " ")
  );
}

export function LoadingFeed() {
  return (
    <div className="discovery-grid" aria-label="Loading ideas" aria-busy="true">
      <div className="idea-skeleton idea-skeleton-feature" />
      <div className="idea-skeleton" />
      <div className="idea-skeleton" />
    </div>
  );
}

export function EmptyDiscovery({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="empty-discovery" aria-live="polite">
      <span className="empty-mark" aria-hidden="true">
        —
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}

export function ScoreSummary({ score }: { score: DiscoveryScore | null }) {
  if (!score) {
    return (
      <div className="score-missing">
        Score pending · evidence is still useful
      </div>
    );
  }
  return (
    <div className="score-summary">
      <div className="score-summary-top">
        <span className="score-label">{score.label}</span>
        <span className="score-number">
          {Math.round(score.overallScore)}
          <small>/100</small>
        </span>
      </div>
      <div
        className="score-meter"
        aria-label={`${score.label}, ${Math.round(score.overallScore)} out of 100`}
      >
        <span
          style={{
            width: `${Math.min(100, Math.max(0, score.overallScore))}%`,
          }}
        />
      </div>
      <p className="score-caveat">{score.coverage.caveat}</p>
    </div>
  );
}

export function ScoreBreakdown({ score }: { score: DiscoveryScore | null }) {
  if (!score) return null;
  const dimensions = [
    ["Relevance", score.dimensions.relevance],
    ["Trend momentum", score.dimensions.trendMomentum],
    ["Freshness", score.dimensions.freshness],
    ["Competition", score.dimensions.competition],
  ] as const;
  return (
    <section className="breakdown" aria-labelledby="score-breakdown-title">
      <div className="section-kicker">How to read this</div>
      <h2 id="score-breakdown-title">The signal, in four parts.</h2>
      <p className="muted-copy">
        A directional score, built from what we can observe right now.
      </p>
      <div className="dimension-list">
        {dimensions.map(([label, dimension]) => (
          <div className="dimension" key={label}>
            <div className="dimension-top">
              <span>{label}</span>
              <strong>
                {Math.round(dimension.value)}
                <small>/100</small>
              </strong>
            </div>
            <div className="dimension-track">
              <span style={{ width: `${dimension.value}%` }} />
            </div>
            <p>
              {dimension.explanation}
              {dimension.kind === "estimated" ? " Estimated." : ""}
            </p>
          </div>
        ))}
      </div>
      <div className="uncertainty-note">
        <strong>
          {score.coverage.uncertainty === "none"
            ? "Current coverage"
            : "Coverage note"}
        </strong>
        <span>{score.coverage.caveat}</span>
      </div>
    </section>
  );
}

export function IdeaCardView({
  idea,
  featured = false,
}: {
  idea: IdeaCard;
  featured?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  async function runAction(action: "save" | "dismiss") {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setPendingAction(action);
    setActionError("");
    try {
      await discoveryApi.action(token, idea.id, action);
      if (action === "save") setSaved(true);
      else setDismissed(true);
    } catch (cause) {
      setActionError(
        cause instanceof ApiError
          ? cause.message
          : "That action could not be saved.",
      );
    } finally {
      setPendingAction(null);
    }
  }
  function startDraft() {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    window.location.href = `/app/ideas/${encodeURIComponent(idea.id)}/script`;
  }
  if (dismissed) return null;
  if (featured) {
    return (
      <article className="idea-card idea-card-featured">
        <div className="idea-card-featured-score">
          <span className="opportunity-badge">
            {idea.score?.label ?? "Research signal"}
          </span>
          <div className="featured-score-number">
            {idea.score ? Math.round(idea.score.overallScore) : "—"}
            {idea.score && (
              <small>
                /100 <span>potential</span>
              </small>
            )}
          </div>
          <div
            className="score-meter"
            aria-label={
              idea.score
                ? `${idea.score.label}, ${Math.round(idea.score.overallScore)} out of 100`
                : "Score pending"
            }
          >
            <span
              style={{
                width: `${Math.min(100, Math.max(0, idea.score?.overallScore ?? 0))}%`,
              }}
            />
          </div>
          {idea.score && (
            <dl className="featured-dimensions">
              <div>
                <dt>Audience demand</dt>
                <dd>High</dd>
              </div>
              <div>
                <dt>Format saturation</dt>
                <dd>Low</dd>
              </div>
              <div>
                <dt>Hook velocity</dt>
                <dd>
                  {Math.round(idea.score.dimensions.trendMomentum.value)}/10
                </dd>
              </div>
              <div>
                <dt>Execution effort</dt>
                <dd>~25 min</dd>
              </div>
            </dl>
          )}
          <div className="featured-source">
            Based on {idea.coverage.signalCount || 0} public signals
          </div>
        </div>
        <div className="idea-card-body idea-card-featured-body">
          <div className="idea-context">
            <span>{taxonomyLabel(idea.nicheId)}</span>
            <span>{taxonomyLabel(idea.languageId)}</span>
            <span>{taxonomyLabel(idea.platformId)} reels</span>
            <span className="positive-chip">Low competition</span>
          </div>
          <h2>
            <Link href={`/app/ideas/${encodeURIComponent(idea.id)}`}>
              {idea.title}
            </Link>
          </h2>
          <div className="editorial-rationale">
            <span className="section-kicker">Editorial rationale</span>
            <p>{idea.reason ?? idea.summary}</p>
          </div>
          <p className="idea-summary">{idea.summary}</p>
          <div className="idea-actions">
            <Link
              className="button button-primary"
              href={`/app/ideas/${encodeURIComponent(idea.id)}`}
            >
              Open idea <span aria-hidden="true">↗</span>
            </Link>
            <button
              className="button button-quiet"
              type="button"
              onClick={() => void startDraft()}
              disabled={pendingAction !== null}
            >
              Draft script <small>(3 credits)</small>
            </button>
            <div className="quiet-actions">
              <button
                className={saved ? "icon-action active" : "icon-action"}
                type="button"
                aria-pressed={saved}
                onClick={() => void runAction("save")}
                disabled={pendingAction !== null}
              >
                {saved ? "Saved" : "Save"}
              </button>
              <button
                className="icon-action"
                type="button"
                onClick={() => void runAction("dismiss")}
                disabled={pendingAction !== null}
              >
                Dismiss
              </button>
            </div>
          </div>
          {actionError && (
            <div className="error card-action-error" role="alert">
              {actionError}
            </div>
          )}
        </div>
      </article>
    );
  }
  return (
    <article className={`idea-card ${featured ? "idea-card-featured" : ""}`}>
      <div className="idea-card-rail">
        <span>{idea.score?.label ?? "Research signal"}</span>
        <span className="idea-card-index">
          {idea.score ? `${Math.round(idea.score.overallScore)}/100` : "—"}
        </span>
      </div>
      <div className="idea-card-body">
        <div className="idea-context">
          <span>{taxonomyLabel(idea.nicheId)}</span>
          <span>{taxonomyLabel(idea.platformId)}</span>
          <span>{taxonomyLabel(idea.languageId)}</span>
        </div>
        <h2>
          <Link href={`/app/ideas/${encodeURIComponent(idea.id)}`}>
            {idea.title}
          </Link>
        </h2>
        <p>{idea.summary}</p>
        {idea.reason && <p className="idea-reason">{idea.reason}</p>}
        <ScoreSummary score={idea.score} />
        <div className="idea-actions">
          <Link
            className="text-action"
            href={`/app/ideas/${encodeURIComponent(idea.id)}`}
          >
            Inspect idea <span aria-hidden="true">→</span>
          </Link>
          <button
            className="icon-action"
            type="button"
            onClick={() => void startDraft()}
            disabled={pendingAction !== null}
          >
            Draft
          </button>
          <div className="quiet-actions">
            <button
              className={saved ? "icon-action active" : "icon-action"}
              type="button"
              aria-pressed={saved}
              onClick={() => void runAction("save")}
              disabled={pendingAction !== null}
            >
              {saved ? "Saved" : "Save"}
            </button>
            <button
              className="icon-action"
              type="button"
              onClick={() => void runAction("dismiss")}
              disabled={pendingAction !== null}
            >
              Dismiss
            </button>
          </div>
        </div>
        {actionError && (
          <div className="error card-action-error" role="alert">
            {actionError}
          </div>
        )}
      </div>
    </article>
  );
}

export function GenerationNotice({
  onClose,
  message = "Generation has been queued. We’ll keep the idea ready while the draft is prepared.",
}: {
  onClose: () => void;
  message?: string;
}) {
  return (
    <div className="inline-notice" role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
