"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  authApi,
  discoveryApi,
  generationApi,
  getAccessToken,
  researchApi,
  type GenerationOperation,
  type IdeaDetail,
  type LocalPulse,
} from "../../../../../lib/api";
import {
  SCRIPT_CREDIT_COST,
  SCRIPT_DURATION_SECONDS,
  SCRIPT_DURATION_OPTIONS,
  SCRIPT_JOURNEY_STEPS,
  assetsFor,
  buildScriptGenerationInput,
  draftStorageKey,
  generationPhaseLabel,
  firstAsset,
  operationStorageKey,
  shouldApplyGeneratedContent,
} from "../../../../../lib/script-workspace";
import {
  DiscoveryShell,
  taxonomyLabel,
} from "../../../../../components/discovery-ui";

type DraftState = {
  selectedHook: number;
  script: string;
  cta: string;
  creatorBrief?: string;
  durationSeconds?: number;
  savedAt: string;
};

export default function ScriptWorkspacePage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const [ideaId, setIdeaId] = useState("");
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [operation, setOperation] = useState<GenerationOperation | null>(null);
  const [selectedHook, setSelectedHook] = useState(0);
  const [script, setScript] = useState("");
  const [cta, setCta] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [creatorContext, setCreatorContext] = useState("");
  const [creatorBrief, setCreatorBrief] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(
    SCRIPT_DURATION_SECONDS,
  );
  const [journeyStep, setJourneyStep] = useState(1);
  const [localPulse, setLocalPulse] = useState<LocalPulse | null>(null);
  const [readyForTomorrow, setReadyForTomorrow] = useState(false);
  const [readyPending, setReadyPending] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const hooks = useMemo(
    () => assetsFor(operation, "hook").map((asset) => asset.content),
    [operation],
  );
  const status = operation?.status;
  const isWorking = status === "queued" || status === "running";
  const activeHook =
    hooks[selectedHook] ?? hooks[0] ?? "Your hook will appear here.";

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    params.then(({ ideaId: nextIdeaId }) => {
      setIdeaId(nextIdeaId);
      const stored = readDraft(nextIdeaId);
      if (stored) {
        setSelectedHook(stored.selectedHook);
        setScript(stored.script);
        setCta(stored.cta);
        setCreatorBrief(stored.creatorBrief ?? "");
        setDurationSeconds(stored.durationSeconds ?? SCRIPT_DURATION_SECONDS);
        setSavedMessage(
          `Saved locally ${new Date(stored.savedAt).toLocaleTimeString()}`,
        );
      }
      const previousOperation = sessionStorage.getItem(
        operationStorageKey(nextIdeaId),
      );
      if (previousOperation)
        setOperationIdFromStorage(nextIdeaId, previousOperation, setOperation);
      Promise.all([
        discoveryApi.detail(token, nextIdeaId),
        authApi.profile(token).catch(() => null),
        researchApi.localPulse(token).catch(() => null),
      ])
        .then(([nextIdea, profile, pulse]) => {
          setIdea(nextIdea);
          setLocalPulse(pulse);
          if (profile) {
            setCreatorContext(
              [
                `Audience: ${profile.audience.description}`,
                profile.contentStyle ? `Style: ${profile.contentStyle}` : "",
                profile.creatorGoal ? `Goal: ${profile.creatorGoal}` : "",
              ]
                .filter(Boolean)
                .join(". "),
            );
          }
        })
        .catch((cause) =>
          setError(apiMessage(cause, "We could not open this idea.")),
        )
        .finally(() => setLoading(false));
    });
  }, [params]);

  useEffect(() => {
    if (!operation || !ideaId || !isWorking) return;
    const token = getAccessToken();
    if (!token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    const poll = async () => {
      let finished = false;
      try {
        const next = await generationApi.status(token, operation.operationId);
        if (active) {
          setOperation(next);
          finished = !["queued", "running"].includes(next.status);
          setError("");
          if (next.status === "succeeded") setJourneyStep(5);
        }
      } catch (cause) {
        if (active)
          setError(
            apiMessage(cause, "We could not refresh generation status."),
          );
      }
      if (active && !finished)
        timer = setTimeout(() => void poll(), ++checks < 4 ? 3000 : 6000);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ideaId, isWorking, operation?.operationId]);

  useEffect(() => {
    if (!isWorking && !pending) return;
    const started = Date.now();
    setElapsedSeconds(0);
    const timer = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [isWorking, pending]);

  useEffect(() => {
    if (operation?.status !== "succeeded") return;
    const generatedScript = firstAsset(operation, "script")?.content ?? "";
    const generatedCta = firstAsset(operation, "cta")?.content ?? "";
    if (shouldApplyGeneratedContent(dirty)) {
      setScript(generatedScript);
      setCta(generatedCta);
      setSelectedHook(0);
    }
    setJourneyStep(5);
  }, [dirty, operation?.operationId, operation?.status]);

  function continueToBrief() {
    setError("");
    setJourneyStep(2);
  }

  function continueToFormat() {
    if (!creatorBrief.trim()) {
      setError("Write one short sentence so the script sounds like you.");
      return;
    }
    setError("");
    setJourneyStep(3);
  }

  async function createScript() {
    setJourneyStep(4);
    await generate();
  }

  async function generate() {
    if (!idea || pending || isWorking) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setPending(true);
    setError("");
    setOperation(null);
    setConfirmRegenerate(false);
    try {
      const input = buildScriptGenerationInput(
        idea,
        creatorContext,
        creatorBrief,
        durationSeconds,
      );
      const next = await generationApi.start(
        token,
        idea.id,
        input,
        `web-${idea.id}-${crypto.randomUUID()}`,
      );
      sessionStorage.setItem(operationStorageKey(idea.id), next.operationId);
      setOperation(next);
    } catch (cause) {
      setError(
        apiMessage(cause, "Generation could not start. Your edits are safe."),
      );
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (!operation || !getAccessToken()) return;
    setPending(true);
    try {
      const next = await generationApi.cancel(
        getAccessToken()!,
        operation.operationId,
      );
      setOperation(next);
    } catch (cause) {
      setError(apiMessage(cause, "This generation could not be cancelled."));
    } finally {
      setPending(false);
    }
  }

  function saveDraft() {
    if (!ideaId) return;
    const savedAt = new Date().toISOString();
    const draft: DraftState = {
      selectedHook,
      script,
      cta,
      creatorBrief,
      durationSeconds,
      savedAt,
    };
    localStorage.setItem(draftStorageKey(ideaId), JSON.stringify(draft));
    setDirty(false);
    setSavedMessage(`Saved locally ${new Date(savedAt).toLocaleTimeString()}`);
  }

  async function markReadyForTomorrow() {
    if (!idea || readyPending) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setReadyPending(true);
    setError("");
    try {
      saveDraft();
      await discoveryApi.save(token, idea.id);
      await discoveryApi.updateStatus(token, idea.id, "planned");
      await discoveryApi.updateStatus(token, idea.id, "scripted");
      setReadyForTomorrow(true);
      setSavedMessage("Ready for tomorrow");
    } catch (cause) {
      setError(
        apiMessage(cause, "We could not save this as ready for tomorrow."),
      );
    } finally {
      setReadyPending(false);
    }
  }

  async function copyDraft() {
    await navigator.clipboard?.writeText(
      `${activeHook}\n\n${script}\n\nCTA: ${cta}`,
    );
    setSavedMessage("Draft copied to clipboard");
  }

  if (loading) {
    return (
      <DiscoveryShell active="today">
        <div className="script-workspace-loading" aria-busy="true">
          <div className="detail-skeleton" />
          <div className="detail-skeleton short" />
        </div>
      </DiscoveryShell>
    );
  }

  if (!idea) {
    return (
      <DiscoveryShell active="today">
        <div className="error discovery-error" role="alert">
          {error || "This idea is not available."}
        </div>
        <Link className="button button-quiet" href="/app">
          Back to Today
        </Link>
      </DiscoveryShell>
    );
  }

  const isReviewStep = journeyStep === 5 || operation?.status === "succeeded";
  const pulseMessage = localPulse
    ? localPulse.coverage === "strong"
      ? `Local signals for ${localPulse.locationLabel ?? "your area"} · updated ${formatPulseTime(localPulse.updatedAt)}`
      : localPulse.limitation === "location_not_set"
        ? "We are using broader signals because no location was selected."
        : "Local signals are limited, so we will keep the script grounded and clear."
    : "Your saved context will guide this script.";

  return (
    <DiscoveryShell active="today">
      <div className="script-workspace">
        <div className="script-workspace-back">
          <Link href={`/app/ideas/${encodeURIComponent(idea.id)}`}>
            ← Back to idea
          </Link>
          <span>Workspace / {idea.title}</span>
        </div>
        <header className="script-workspace-heading">
          <div>
            <div className="eyebrow">Tomorrow / script workspace</div>
            <div className="script-stepper" aria-label="Script progress">
              {SCRIPT_JOURNEY_STEPS.map((step, index) => (
                <span
                  className={index + 1 <= journeyStep ? "active" : ""}
                  key={step}
                >
                  {index + 1} {step}
                </span>
              ))}
            </div>
            <h1>
              {isReviewStep
                ? "Your script is ready to make yours."
                : "Make tomorrow’s post easier to record."}
            </h1>
            <p className="detail-summary">
              {isReviewStep
                ? "Read it aloud once, change anything that feels unlike you, then save it for tomorrow."
                : "We will choose an idea, ask what you want to say, and make a short script you can record."}
            </p>
          </div>
          <span className="ai-label">
            <span aria-hidden="true">✦</span> AI-assisted draft
          </span>
        </header>

        {!isReviewStep && (
          <section className="script-journey-panel" aria-live="polite">
            <div className="script-journey-copy">
              <span className="section-kicker">Step {journeyStep} of 5</span>
              {journeyStep === 1 && (
                <>
                  <h2>Start with this idea.</h2>
                  <p>{idea.title}</p>
                  <small>{idea.summary}</small>
                  <div className="script-local-note">{pulseMessage}</div>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={continueToBrief}
                  >
                    Use this idea <span aria-hidden="true">→</span>
                  </button>
                  <Link
                    className="text-action"
                    href="/app/explore?compose=1&mode=own-topic"
                  >
                    I have my own topic
                  </Link>
                </>
              )}
              {journeyStep === 2 && (
                <>
                  <h2>What do you want to say?</h2>
                  <p>
                    One sentence is enough. Write it the way you would tell a
                    friend.
                  </p>
                  <label className="sr-only" htmlFor="creator-brief">
                    What do you want to say?
                  </label>
                  <textarea
                    id="creator-brief"
                    className="creator-brief"
                    value={creatorBrief}
                    onChange={(event) => setCreatorBrief(event.target.value)}
                    placeholder="For example: I want to show a simple morning stretch for people who sit all day."
                    maxLength={500}
                  />
                  <span className="field-counter">
                    {creatorBrief.length}/500
                  </span>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={continueToFormat}
                  >
                    Continue <span aria-hidden="true">→</span>
                  </button>
                </>
              )}
              {journeyStep === 3 && (
                <>
                  <h2>How long should your video be?</h2>
                  <p>
                    Your language and platform come from your setup. Choose the
                    length you can record comfortably.
                  </p>
                  <div
                    className="duration-options"
                    role="radiogroup"
                    aria-label="Video length"
                  >
                    {SCRIPT_DURATION_OPTIONS.map((duration) => (
                      <button
                        className={
                          durationSeconds === duration
                            ? "duration-option active"
                            : "duration-option"
                        }
                        type="button"
                        role="radio"
                        aria-checked={durationSeconds === duration}
                        key={duration}
                        onClick={() => setDurationSeconds(duration)}
                      >
                        <strong>
                          {duration === 30
                            ? "Short"
                            : duration === 60
                              ? "Normal"
                              : duration === 90
                                ? "Long"
                                : "My usual"}
                        </strong>
                        <span>{duration} seconds</span>
                      </button>
                    ))}
                  </div>
                  <div className="script-promise">
                    We will make 3 opening lines, your full spoken script and
                    one clear CTA.
                  </div>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void createScript()}
                    disabled={pending || isWorking}
                  >
                    Create my script <span aria-hidden="true">→</span>
                  </button>
                </>
              )}
              {journeyStep === 4 && (
                <>
                  <h2>
                    {operation?.status === "failed" || error
                      ? "Your script couldn’t be created"
                      : generationPhaseLabel(operation?.phase)}
                  </h2>
                  <p>
                    {operation?.status === "failed" || error
                      ? "Your topic and words are saved. You can try again."
                      : "We’re turning your idea into a script you can record. Keep this page open — your draft will appear here."}
                  </p>
                  {(isWorking || pending) && (
                    <div
                      className="generation-live"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="generation-activity" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                      <strong>
                        {pending
                          ? "Starting your script…"
                          : generationPhaseLabel(operation?.phase)}
                      </strong>
                      <span>
                        {elapsedSeconds} seconds elapsed
                        {elapsedSeconds >= 20
                          ? " — this is taking longer than usual. We’re still waiting for the writing service."
                          : " — working on your draft"}
                      </span>
                    </div>
                  )}
                  <div
                    className="generation-stage-list"
                    aria-label="Script creation progress"
                  >
                    {[
                      "Finding the angle",
                      "Writing your words",
                      "Checking the script",
                    ].map((label, index) => (
                      <span
                        className={
                          isWorking &&
                          operation?.phase ===
                            [
                              "finding_angle",
                              "writing_script",
                              "checking_script",
                            ][index]
                            ? "active"
                            : ""
                        }
                        key={label}
                      >
                        <b>{index + 1}</b>
                        {label}
                      </span>
                    ))}
                  </div>
                  {operation?.status === "failed" && (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void generate()}
                      disabled={pending}
                    >
                      Try again <span aria-hidden="true">→</span>
                    </button>
                  )}
                  {(error || operation?.error) && (
                    <div className="error generation-error" role="alert">
                      <strong>{operation?.error?.message ?? error}</strong>
                      <span>
                        The writing service couldn’t finish this attempt. Your
                        words are saved; no draft was created.
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {isReviewStep && (
          <div className="script-workspace-grid">
            <main className="script-canvas">
              <section className="script-idea-strip">
                <div className="section-kicker">Your plan for tomorrow</div>
                <strong>{idea.title}</strong>
                <span>{idea.summary}</span>
                {creatorBrief && (
                  <span className="brief-summary">
                    You want to say: {creatorBrief}
                  </span>
                )}
              </section>

              <section className="hook-section" aria-labelledby="hook-heading">
                <div className="script-section-heading">
                  <div>
                    <div className="section-kicker">01 / Opening</div>
                    <h2 id="hook-heading">Choose your opening line.</h2>
                  </div>
                  {hooks.length > 0 && <span>{hooks.length} options</span>}
                </div>
                {hooks.length ? (
                  <div
                    className="hook-tabs"
                    role="tablist"
                    aria-label="Generated hooks"
                  >
                    {hooks.map((hook, index) => (
                      <button
                        key={`${hook}-${index}`}
                        className={
                          selectedHook === index
                            ? "hook-tab active"
                            : "hook-tab"
                        }
                        type="button"
                        role="tab"
                        aria-selected={selectedHook === index}
                        onClick={() => {
                          setSelectedHook(index);
                          setDirty(true);
                        }}
                      >
                        <span>Hook {String(index + 1).padStart(2, "0")}</span>
                        {hook}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="workspace-empty">
                    Create a draft to get three opening lines to choose from.
                  </div>
                )}
              </section>

              <section
                className="editor-section"
                aria-labelledby="script-heading"
              >
                <div className="script-section-heading">
                  <div>
                    <div className="section-kicker">02 / Main script</div>
                    <h2 id="script-heading">Write what you’ll say.</h2>
                  </div>
                  <span>{script.length} characters</span>
                </div>
                <label className="sr-only" htmlFor="script-editor">
                  Editable script
                </label>
                <textarea
                  id="script-editor"
                  className="script-editor"
                  value={script}
                  onChange={(event) => {
                    setScript(event.target.value);
                    setDirty(true);
                  }}
                  placeholder="Your generated script will appear here. You can edit every line."
                />
                <p className="editor-hint">
                  Make it sound like you. Your edits stay safe if you
                  regenerate.
                </p>
              </section>

              <section className="cta-section" aria-labelledby="cta-heading">
                <div className="script-section-heading">
                  <div>
                    <div className="section-kicker">03 / Close</div>
                    <h2 id="cta-heading">Tell viewers what to do next.</h2>
                  </div>
                </div>
                <label className="sr-only" htmlFor="cta-editor">
                  Editable call to action
                </label>
                <input
                  id="cta-editor"
                  className="cta-editor"
                  value={cta}
                  onChange={(event) => {
                    setCta(event.target.value);
                    setDirty(true);
                  }}
                  placeholder="Add a simple call to action"
                />
              </section>
            </main>

            <aside
              className="script-context-rail"
              aria-label="Draft context and controls"
            >
              <div className="context-rail-header">
                <span className="section-kicker">Context</span>
                <span className="context-status">
                  {dirty ? "Unsaved edits" : savedMessage || "Ready"}
                </span>
              </div>
              <dl className="script-context-list">
                <div>
                  <dt>Language</dt>
                  <dd>{taxonomyLabel(idea.languageId)}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{taxonomyLabel(idea.platformId)}</dd>
                </div>
                <div>
                  <dt>Video length</dt>
                  <dd>{durationSeconds} seconds</dd>
                </div>
                <div>
                  <dt>Draft cost</dt>
                  <dd>{SCRIPT_CREDIT_COST} credits</dd>
                </div>
              </dl>
              <div className="script-safety-note">
                <strong>Quick check before you record</strong>
                <span>
                  This is a first draft. Check facts, examples, and language so
                  it sounds right for your audience before publishing.
                </span>
              </div>
              <div className="script-actions">
                {!operation ||
                operation.status === "failed" ||
                operation.status === "cancelled" ? (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void generate()}
                    disabled={pending}
                  >
                    {pending
                      ? "Starting…"
                      : operation?.status === "failed"
                        ? "Try generation again"
                        : "Create tomorrow’s draft"}{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                ) : isWorking ? (
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={() => void cancel()}
                    disabled={pending}
                  >
                    {pending ? "Cancelling…" : "Cancel generation"}
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setConfirmRegenerate(true)}
                    disabled={pending}
                  >
                    Regenerate <span aria-hidden="true">↻</span>
                  </button>
                )}
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={saveDraft}
                >
                  Save my draft
                </button>
                {operation?.status === "succeeded" && (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void markReadyForTomorrow()}
                    disabled={readyPending || readyForTomorrow}
                  >
                    {readyForTomorrow
                      ? "Ready for tomorrow"
                      : readyPending
                        ? "Saving your draft…"
                        : "Mark ready for tomorrow"}
                  </button>
                )}
                <button
                  className="text-action script-copy"
                  type="button"
                  onClick={() => void copyDraft()}
                >
                  Copy script ↗
                </button>
              </div>
              {confirmRegenerate && (
                <div
                  className="regenerate-confirm"
                  role="dialog"
                  aria-label="Confirm regeneration"
                >
                  <strong>
                    Use {SCRIPT_CREDIT_COST} credits to regenerate?
                  </strong>
                  <p>Your unsaved edits will stay in this canvas.</p>
                  <div>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void generate()}
                    >
                      Continue
                    </button>
                    <button
                      className="button button-quiet"
                      type="button"
                      onClick={() => setConfirmRegenerate(false)}
                    >
                      Keep draft
                    </button>
                  </div>
                </div>
              )}
              {isWorking && (
                <div
                  className="generation-progress"
                  role="status"
                  aria-live="polite"
                >
                  <span className="progress-dot" aria-hidden="true" />
                  <strong>{generationPhaseLabel(operation?.phase)}</strong>
                  <span>"Your idea and edits are safe while we work."</span>
                </div>
              )}
              {operation?.status === "succeeded" && (
                <div className="generation-provenance" role="status">
                  <strong>
                    Draft generated with{" "}
                    {operation.model ?? operation.provider ?? "CreatorPulse AI"}
                  </strong>
                  <span>
                    Prompt policy {operation.promptVersion} ·{" "}
                    {operation.attempts} attempt
                    {operation.attempts === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              {operation?.error && (
                <div className="error generation-error" role="alert">
                  <strong>{operation.error.message}</strong>
                  <span>
                    Your edits are preserved. You can try again when ready.
                  </span>
                </div>
              )}
              {error && (
                <div className="error generation-error" role="alert">
                  {error}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </DiscoveryShell>
  );
}

function readDraft(ideaId: string): DraftState | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(ideaId));
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

function setOperationIdFromStorage(
  ideaId: string,
  operationId: string,
  setOperation: (operation: GenerationOperation) => void,
) {
  const token = getAccessToken();
  if (!token) return;
  void generationApi
    .status(token, operationId)
    .then(setOperation)
    .catch(() => {
      sessionStorage.removeItem(operationStorageKey(ideaId));
    });
}

function apiMessage(cause: unknown, fallback: string) {
  if (!(cause instanceof ApiError) || cause.status >= 500) return fallback;
  if (cause.status === 402) {
    return "You need 3 credits to create this draft. Add credits, then try again.";
  }
  return cause.message;
}

function formatPulseTime(value: string | null) {
  if (!value) return "recently";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "recently"
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
