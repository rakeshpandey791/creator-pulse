"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_CATALOG } from "@creator-pulse/contracts";
import {
  ApiError,
  authApi,
  getAccessToken,
  hasAccessToken,
} from "../../lib/api";
import {
  emptyDraft,
  loadDraft,
  saveDraft,
  type OnboardingDraft,
  validateStep,
} from "../../lib/onboarding";

const niches = [
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000001", "Fitness"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000002", "Food"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000003", "Finance"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000004", "Education"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000005", "Entertainment"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000006", "Lifestyle"],
];
const platforms = [
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000001", "Instagram"],
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000002", "YouTube"],
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000003", "Facebook"],
];
const languages = LANGUAGE_CATALOG.map(({ id, name, nativeName }) => [
  id,
  name,
  nativeName,
]);

function ToggleChoices({
  items,
  selected,
  onToggle,
}: {
  items: string[][];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="choice-grid">
      {items.map(([id, name, sample]) => (
        <button
          type="button"
          className={`choice ${selected.includes(id) ? "selected" : ""}`}
          aria-pressed={selected.includes(id)}
          key={id}
          onClick={() => onToggle(id)}
        >
          <strong>{name}</strong>
          {sample && (
            <small
              lang={
                name === "Punjabi"
                  ? "pa"
                  : name === "Telugu"
                    ? "te"
                    : name === "Kannada"
                      ? "kn"
                      : "hi"
              }
            >
              {sample}
            </small>
          )}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!hasAccessToken()) router.replace("/login");
    else setDraft(loadDraft());
  }, [router]);
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);
  function toggle(
    field: "nicheIds" | "platformIds" | "languageIds",
    id: string,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((item) => item !== id)
        : [...current[field], id],
    }));
    setError("");
  }
  function next() {
    const issue = validateStep(step, draft);
    if (issue) return setError(issue);
    setError("");
    setStep((current) => Math.min(4, current + 1));
  }
  async function finish() {
    const issue = validateStep(4, draft);
    if (issue) return setError(issue);
    const token = getAccessToken();
    if (!token) return router.replace("/login");
    setBusy(true);
    setError("");
    try {
      await authApi.saveProfile(token, {
        nicheIds: draft.nicheIds,
        platformIds: draft.platformIds,
        languageIds: draft.languageIds,
        audience: { description: draft.audience.trim() },
        contentStyle: draft.contentStyle || undefined,
        creatorGoal: draft.creatorGoal || undefined,
      });
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not save your profile. Your answers are saved; please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <main className="site-shell">
        <section className="auth-layout">
          <div className="auth-card">
            <div className="eyebrow">You’re all set</div>
            <h2>Your pulse is ready.</h2>
            <p className="lead">
              We’ll use your context to surface ideas that feel native to your
              audience.
            </p>
            <button
              className="button button-primary"
              onClick={() => router.push("/app")}
            >
              Explore CreatorPulse →
            </button>
          </div>
        </section>
      </main>
    );
  return (
    <main className="site-shell">
      <section className="onboarding-layout">
        <div className="onboarding-card">
          <div className="step-label">Setup / 0{step} of 04</div>
          <div className="progress" aria-label={`Step ${step} of 4`}>
            {[1, 2, 3, 4].map((item) => (
              <span className={item <= step ? "active" : ""} key={item} />
            ))}
          </div>
          {step === 1 && (
            <>
              <h2>What do you want to talk about?</h2>
              <p className="helper">
                Pick the spaces where your point of view is strongest.
              </p>
              <ToggleChoices
                items={niches}
                selected={draft.nicheIds}
                onToggle={(id) => toggle("nicheIds", id)}
              />
            </>
          )}
          {step === 2 && (
            <>
              <h2>Where does your community live?</h2>
              <p className="helper">
                Choose every platform you actively create for.
              </p>
              <ToggleChoices
                items={platforms}
                selected={draft.platformIds}
                onToggle={(id) => toggle("platformIds", id)}
              />
            </>
          )}
          {step === 3 && (
            <>
              <h2>What should your ideas sound like?</h2>
              <p className="helper">
                Choose languages. We’ll keep the nuance, script, and energy
                intact.
              </p>
              <ToggleChoices
                items={languages}
                selected={draft.languageIds}
                onToggle={(id) => toggle("languageIds", id)}
              />
            </>
          )}
          {step === 4 && (
            <>
              <h2>Give us the audience context.</h2>
              <p className="helper">
                One sentence is enough. Who are you helping, entertaining, or
                inspiring?
              </p>
              <div className="form">
                <label className="field">
                  My audience is…
                  <textarea
                    value={draft.audience}
                    onChange={(e) =>
                      setDraft({ ...draft, audience: e.target.value })
                    }
                    placeholder="People in their 20s who want simple, practical fitness habits"
                    maxLength={500}
                  />
                </label>
                <label className="field">
                  My content style
                  <input
                    value={draft.contentStyle}
                    onChange={(e) =>
                      setDraft({ ...draft, contentStyle: e.target.value })
                    }
                    placeholder="Warm, practical, a little playful"
                    maxLength={300}
                  />
                </label>
                <label className="field">
                  My creator goal
                  <input
                    value={draft.creatorGoal}
                    onChange={(e) =>
                      setDraft({ ...draft, creatorGoal: e.target.value })
                    }
                    placeholder="Grow a trusted community"
                    maxLength={300}
                  />
                </label>
              </div>
            </>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="onboarding-actions">
            <button
              className="button button-quiet"
              type="button"
              disabled={step === 1 || busy}
              onClick={() => {
                setError("");
                setStep((current) => current - 1);
              }}
            >
              ← Back
            </button>
            {step < 4 ? (
              <button
                className="button button-primary"
                type="button"
                onClick={next}
              >
                Continue →
              </button>
            ) : (
              <button
                className="button button-soft"
                type="button"
                disabled={busy}
                onClick={finish}
              >
                {busy ? "Saving…" : "Finish setup →"}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
