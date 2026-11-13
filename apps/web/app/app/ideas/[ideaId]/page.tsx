"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  discoveryApi,
  getAccessToken,
  safetyApi,
  type IdeaDetail,
  type SafetyCheckResponse,
} from "../../../../lib/api";
import {
  DiscoveryShell,
  EmptyDiscovery,
  GenerationNotice,
  ScoreBreakdown,
  ScoreSummary,
} from "../../../../components/discovery-ui";

export default function IdeaDetailPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<
    | "too_generic"
    | "already_covered"
    | "wrong_language"
    | "wrong_audience"
    | "not_timely"
    | "unsafe"
    | "other"
  >("too_generic");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "sending" | "sent" | "duplicate"
  >("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [safety, setSafety] = useState<SafetyCheckResponse | null>(null);
  const router = useRouter();
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    params
      .then(({ ideaId }) => discoveryApi.detail(token, ideaId))
      .then(setIdea)
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "We could not open this idea.",
        ),
      );
  }, [params]);
  async function saveIdea() {
    if (!idea) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setActionPending("save");
    setActionError("");
    try {
      await discoveryApi.action(token, idea.id, "save");
      setSaved(true);
    } catch (cause) {
      setActionError(
        cause instanceof ApiError
          ? cause.message
          : "The idea could not be saved.",
      );
    } finally {
      setActionPending(null);
    }
  }
  async function dismissIdea() {
    if (!idea) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setActionPending("dismiss");
    setActionError("");
    try {
      await discoveryApi.action(token, idea.id, "dismiss");
      setDismissed(true);
    } catch (cause) {
      setActionError(
        cause instanceof ApiError
          ? cause.message
          : "The idea could not be dismissed.",
      );
    } finally {
      setActionPending(null);
    }
  }
  async function startDraft() {
    if (!idea) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setActionPending("draft");
    setActionError("");
    try {
      const safetyResult = await safetyApi.check({
        text: `${idea.title}\n${idea.summary}`,
        niche: idea.nicheId,
        language: idea.languageId,
        platform: idea.platformId,
      });
      setSafety(safetyResult);
      if (
        safetyResult.decision === "review" ||
        safetyResult.decision === "reject"
      ) {
        setActionError(
          safetyResult.decision === "reject"
            ? "This draft is blocked because the idea contains unsafe guidance."
            : "This draft needs a safety review before generation can start.",
        );
        return;
      }
      router.push(`/app/ideas/${encodeURIComponent(idea.id)}/script`);
    } catch (cause) {
      setActionError(
        cause instanceof ApiError
          ? cause.message
          : "Draft generation could not start.",
      );
    } finally {
      setActionPending(null);
    }
  }
  async function submitFeedback() {
    if (!idea || (feedbackRating === null && !feedbackComment.trim())) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setFeedbackState("sending");
    setFeedbackError("");
    try {
      const result = await discoveryApi.submitFeedback(token, idea.id, {
        ...(feedbackRating === null ? {} : { rating: feedbackRating }),
        reasonCodes: [feedbackReason],
        ...(feedbackComment.trim() ? { comment: feedbackComment.trim() } : {}),
        languageId: idea.languageId,
        nicheId: idea.nicheId,
        platformId: idea.platformId,
      });
      setFeedbackState(result.duplicate ? "duplicate" : "sent");
    } catch (cause) {
      setFeedbackState("idle");
      setFeedbackError(
        cause instanceof ApiError
          ? cause.message
          : "We could not save your feedback. You can keep working.",
      );
    }
  }
  return (
    <DiscoveryShell active="today">
      <div className="detail-back">
        <Link href="/app">← Back to Today</Link>
      </div>
      {!idea && !error && <LoadingDetail />}
      {error && (
        <EmptyDiscovery
          title="This idea moved on."
          message={error}
          action={
            <Link className="button button-quiet" href="/app">
              Return to Today
            </Link>
          }
        />
      )}
      {idea && !dismissed && (
        <>
          <header className="detail-heading">
            <div className="eyebrow">Idea detail / {idea.origin}</div>
            <div className="idea-context">
              <span>{idea.nicheId}</span>
              <span>{idea.platformId}</span>
              <span>{idea.languageId}</span>
            </div>
            <h1>{idea.title}</h1>
            <p className="detail-summary">{idea.summary}</p>
            <div className="detail-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => void startDraft()}
                disabled={actionPending !== null}
              >
                Start a draft <span aria-hidden="true">→</span>
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void saveIdea()}
                disabled={actionPending !== null}
              >
                {saved ? "Saved" : "Save idea"}
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void dismissIdea()}
                disabled={actionPending !== null}
              >
                Dismiss
              </button>
            </div>
            {notice && <GenerationNotice onClose={() => setNotice(false)} />}
            {safety && <SafetyPanel result={safety} />}
            {actionError && (
              <div className="error card-action-error" role="alert">
                {actionError}
              </div>
            )}
            <section
              className="feedback-panel"
              aria-labelledby="feedback-heading"
            >
              <div>
                <div className="section-kicker">Help us tune your feed</div>
                <h2 id="feedback-heading">Was this idea useful?</h2>
                <p className="muted-copy">
                  Optional. A quick signal helps us show you better ideas
                  without interrupting your workflow.
                </p>
              </div>
              <div
                className="feedback-rating"
                role="group"
                aria-label="Rate this idea from 1 to 5"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    className={
                      feedbackRating === rating
                        ? "feedback-rating-selected"
                        : ""
                    }
                    key={rating}
                    type="button"
                    aria-pressed={feedbackRating === rating}
                    onClick={() => setFeedbackRating(rating)}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              <label>
                What should we improve?
                <select
                  value={feedbackReason}
                  onChange={(event) =>
                    setFeedbackReason(
                      event.target.value as typeof feedbackReason,
                    )
                  }
                >
                  <option value="too_generic">Too generic</option>
                  <option value="already_covered">
                    I’ve already covered this
                  </option>
                  <option value="wrong_language">Wrong language</option>
                  <option value="wrong_audience">Wrong audience</option>
                  <option value="not_timely">Not timely</option>
                  <option value="unsafe">Unsafe or concerning</option>
                  <option value="other">Something else</option>
                </select>
              </label>
              <label>
                Add a note <span className="muted-copy">(optional)</span>
                <textarea
                  value={feedbackComment}
                  maxLength={1000}
                  onChange={(event) => setFeedbackComment(event.target.value)}
                  placeholder="Tell us what would make this more useful."
                  rows={3}
                />
              </label>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void submitFeedback()}
                disabled={
                  feedbackState === "sending" ||
                  (feedbackRating === null && !feedbackComment.trim())
                }
              >
                {feedbackState === "sending" ? "Sending…" : "Send feedback"}
              </button>
              {feedbackState === "sent" && (
                <p className="feedback-confirmation" role="status">
                  Thanks — your feedback is recorded.
                </p>
              )}
              {feedbackState === "duplicate" && (
                <p className="feedback-confirmation" role="status">
                  We already have this exact feedback. Thanks for the signal.
                </p>
              )}
              {feedbackError && (
                <p className="error" role="alert">
                  {feedbackError}
                </p>
              )}
            </section>
          </header>
          <div className="detail-layout">
            <main>
              <section className="evidence-section">
                <div className="section-kicker">Why this is here</div>
                <h2>Evidence you can inspect.</h2>
                <p className="muted-copy">
                  Sources stay close to the idea so you can decide what feels
                  timely and true to your audience.
                </p>
                {idea.evidence.length ? (
                  <div className="evidence-list">
                    {idea.evidence.map((item) => (
                      <details
                        className="evidence-item"
                        key={item.id}
                        open={item.rank === 1}
                      >
                        <summary>
                          <span className="evidence-rank">
                            {String(item.rank).padStart(2, "0")}
                          </span>
                          <span>
                            <strong>{item.summary}</strong>
                            <small>
                              {item.evidenceType} ·{" "}
                              {new Date(item.observedAt).toLocaleDateString()}
                            </small>
                          </span>
                        </summary>
                        <div className="evidence-detail">
                          {item.limitations && (
                            <p className="coverage-warning">
                              {item.limitations}
                            </p>
                          )}
                          {item.source ? (
                            <a
                              href={item.source.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open source <span aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            <span className="muted-copy">
                              Source link unavailable.
                            </span>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <EmptyDiscovery
                    title="Evidence is still arriving."
                    message="The idea is available, but its supporting sources have not landed yet."
                  />
                )}
              </section>
            </main>
            <aside className="detail-aside">
              <ScoreSummary score={idea.score} />
              <ScoreBreakdown score={idea.score} />
            </aside>
          </div>
        </>
      )}
    </DiscoveryShell>
  );
}

function SafetyPanel({ result }: { result: SafetyCheckResponse }) {
  const tone = result.decision === "allow" ? "safe" : result.decision;
  return (
    <section className={`safety-panel safety-panel-${tone}`} aria-live="polite">
      <div>
        <strong>
          Safety check:{" "}
          {result.decision === "allow" ? "clear" : result.decision}
        </strong>
        {result.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
        {result.requiredDisclaimers.length > 0 && (
          <p>
            <strong>Include this context:</strong>{" "}
            {result.requiredDisclaimers.join(" ")}
          </p>
        )}
        {(result.decision === "review" || result.decision === "reject") && (
          <p className="safety-panel-action">
            {result.decision === "reject"
              ? "Generation is blocked until the unsafe guidance is removed."
              : "Generation is paused until a reviewer clears the claim risk."}
          </p>
        )}
      </div>
    </section>
  );
}

function LoadingDetail() {
  return (
    <div className="detail-layout" aria-busy="true">
      <div>
        <div className="detail-skeleton" />
        <div className="detail-skeleton short" />
      </div>
      <div className="idea-skeleton" />
    </div>
  );
}
