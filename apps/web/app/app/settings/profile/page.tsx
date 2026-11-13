"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  authApi,
  getAccessToken,
  type AuthUser,
  type CreatorProfile,
} from "../../../../lib/api";
import {
  cityOptions,
  countryOptions,
  languageOptions,
  nicheOptions,
  platformOptions,
  regionOptions,
  type ProfileDraft,
} from "../../../../lib/profile-options";
import {
  Alert,
  Button,
  FormField,
  Panel,
  StatusPill,
} from "../../../../components/primitives";
import { DiscoveryShell } from "../../../../components/discovery-ui";

const DRAFT_KEY = "creatorpulse.profileSettingsDraft";

function draftFromProfile(
  profile: CreatorProfile,
  user: AuthUser,
): ProfileDraft {
  return {
    displayName: user.displayName ?? "",
    nicheIds: [...profile.nicheIds],
    platformIds: [...profile.platformIds],
    languageIds: [...profile.languageIds],
    audience: profile.audience.description,
    contentStyle: profile.contentStyle ?? "",
    creatorGoal: profile.creatorGoal ?? "",
    experienceLevel: profile.experienceLevel ?? "",
    locationCountryCode: profile.location?.countryCode ?? "",
    locationRegionCode: profile.location?.regionCode ?? "",
    locationCity: profile.location?.city ?? "",
  };
}

function ChoiceGroup({
  label,
  hint,
  items,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  items: readonly (readonly [string, string, string?])[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="settings-fieldset">
      <legend>{label}</legend>
      <p className="settings-hint">{hint}</p>
      <div className="settings-choice-grid">
        {items.map(([id, name, nativeName]) => {
          const isSelected = selected.includes(id);
          return (
            <button
              aria-pressed={isSelected}
              className={`settings-choice ${isSelected ? "selected" : ""}`}
              key={id}
              onClick={() => onToggle(id)}
              type="button"
            >
              <span>
                <strong>{name}</strong>
                {nativeName && <small lang="hi">{nativeName}</small>}
              </span>
              <span className="settings-choice-mark" aria-hidden="true">
                {isSelected ? "✓" : "＋"}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([authApi.me(token), authApi.profile(token)])
      .then(([nextUser, nextProfile]) => {
        if (!nextProfile) {
          router.replace("/onboarding");
          return;
        }
        setUser(nextUser);
        setProfile(nextProfile);
        const savedDraft = window.localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          try {
            setDraft(JSON.parse(savedDraft) as ProfileDraft);
            setHasRecoveredDraft(true);
            return;
          } catch {
            window.localStorage.removeItem(DRAFT_KEY);
          }
        }
        setDraft(draftFromProfile(nextProfile, nextUser));
      })
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "We could not load your settings. Please try again.",
        ),
      )
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const dirty = useMemo(() => {
    if (!draft || !profile || !user) return false;
    return (
      JSON.stringify(draft) !== JSON.stringify(draftFromProfile(profile, user))
    );
  }, [draft, profile, user]);

  function updateDraft(patch: Partial<ProfileDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setNotice("");
    setError("");
  }

  function toggle(
    field: "nicheIds" | "platformIds" | "languageIds",
    id: string,
  ) {
    if (!draft) return;
    const values = draft[field];
    updateDraft({
      [field]: values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    });
  }

  function reset() {
    if (!profile || !user) return;
    const next = draftFromProfile(profile, user);
    setDraft(next);
    window.localStorage.removeItem(DRAFT_KEY);
    setHasRecoveredDraft(false);
    setError("");
    setNotice(
      "Your saved settings are back in place. Nothing has changed yet.",
    );
  }

  async function save() {
    if (!draft || !profile || !user) return;
    if (
      !draft.nicheIds.length ||
      !draft.platformIds.length ||
      !draft.languageIds.length
    ) {
      setError(
        "Keep at least one niche, platform, and language so we can personalize your feed.",
      );
      return;
    }
    const token = getAccessToken();
    if (!token) return router.replace("/login");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const [nextUser, nextProfile] = await Promise.all([
        authApi.updateMe(token, draft.displayName),
        authApi.saveProfile(token, {
          nicheIds: draft.nicheIds,
          platformIds: draft.platformIds,
          languageIds: draft.languageIds,
          audience: { description: draft.audience.trim() },
          contentStyle: draft.contentStyle.trim() || undefined,
          creatorGoal: draft.creatorGoal.trim() || undefined,
          experienceLevel: draft.experienceLevel || undefined,
          location: draft.locationCountryCode
            ? {
                countryCode: draft.locationCountryCode,
                ...(draft.locationRegionCode
                  ? { regionCode: draft.locationRegionCode }
                  : {}),
                ...(draft.locationCity ? { city: draft.locationCity } : {}),
                scope: draft.locationCity
                  ? "city"
                  : draft.locationRegionCode
                    ? "region"
                    : "country",
                source: "manual",
              }
            : null,
          locationConsent: draft.locationCountryCode ? "manual" : "declined",
        }),
      ]);
      setUser(nextUser);
      setProfile(nextProfile);
      setDraft(draftFromProfile(nextProfile, nextUser));
      window.localStorage.removeItem(DRAFT_KEY);
      setHasRecoveredDraft(false);
      setNotice(
        "Saved. Your next feed refresh will use this creative context.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not save your settings. Your edits are still here; please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DiscoveryShell active="settings">
      <header className="page-heading settings-heading">
        <div>
          <div className="eyebrow">Workspace / Settings</div>
          <h1>Keep your signal close.</h1>
          <p className="lead">
            Adjust the context behind your ideas without repeating onboarding.
            Your choices shape what appears in Today and Explore.
          </p>
        </div>
        <StatusPill tone={dirty ? "warning" : "success"}>
          {dirty ? "Unsaved changes" : "Up to date"}
        </StatusPill>
      </header>
      {loading && (
        <div
          className="settings-loading"
          aria-label="Loading settings"
          aria-busy="true"
        />
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {hasRecoveredDraft && (
        <Alert tone="warning">
          We found edits from your last visit. Review them below before saving.
        </Alert>
      )}
      {draft && (
        <div className="settings-layout">
          <div className="settings-main-column">
            <Panel as="section" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <div className="section-kicker">Creator identity</div>
                  <h2>Make it feel like you.</h2>
                </div>
                <span className="settings-private-note">
                  Private to your workspace
                </span>
              </div>
              <div className="settings-form-grid">
                <FormField label="Your name" htmlFor="display-name">
                  <input
                    id="display-name"
                    value={draft.displayName}
                    onChange={(event) =>
                      updateDraft({ displayName: event.target.value })
                    }
                    maxLength={80}
                    placeholder="How should we address you?"
                  />
                </FormField>
                <FormField
                  label="Account email"
                  htmlFor="account-email"
                  hint="Used for sign-in and recovery. It is not shown in your feed."
                >
                  <input
                    id="account-email"
                    value={user?.email ?? ""}
                    readOnly
                  />
                </FormField>
              </div>
            </Panel>

            <Panel as="section" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <div className="section-kicker">Creative context</div>
                  <h2>Tell us what is useful.</h2>
                </div>
              </div>
              <ChoiceGroup
                label="Your focus areas"
                hint="Choose the topics you can speak about with confidence."
                items={nicheOptions}
                selected={draft.nicheIds}
                onToggle={(id) => toggle("nicheIds", id)}
              />
              <ChoiceGroup
                label="Where you publish"
                hint="Pick every platform you actively create for."
                items={platformOptions}
                selected={draft.platformIds}
                onToggle={(id) => toggle("platformIds", id)}
              />
              <ChoiceGroup
                label="Languages that sound like you"
                hint="Native-script examples are preserved where available."
                items={languageOptions}
                selected={draft.languageIds}
                onToggle={(id) => toggle("languageIds", id)}
              />
              <div className="settings-guidance" role="note">
                <strong>Why some combinations may be quiet</strong>
                <span>
                  We only show ideas when we have enough signal for the selected
                  language, platform, and topic. If your feed is sparse, broaden
                  one choice rather than starting over.
                </span>
              </div>
            </Panel>

            <Panel as="section" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <div className="section-kicker">Local context</div>
                  <h2>Show ideas from your area.</h2>
                </div>
                <span className="settings-private-note">
                  Coarse location only
                </span>
              </div>
              <p className="settings-hint">
                This helps us find nearby signals. We never store exact
                coordinates or ask for your live location.
              </p>
              <div className="settings-form-grid settings-location-grid">
                <FormField label="Country" htmlFor="location-country">
                  <select
                    id="location-country"
                    value={draft.locationCountryCode}
                    onChange={(event) =>
                      updateDraft({
                        locationCountryCode: event.target.value,
                        locationRegionCode: "",
                        locationCity: "",
                      })
                    }
                  >
                    <option value="">Choose a country</option>
                    {countryOptions.map(([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="State or region (optional)"
                  htmlFor="location-region"
                >
                  <select
                    id="location-region"
                    value={draft.locationRegionCode}
                    onChange={(event) =>
                      updateDraft({
                        locationRegionCode: event.target.value,
                        locationCity: "",
                      })
                    }
                    disabled={!draft.locationCountryCode}
                  >
                    <option value="">Choose a region</option>
                    {regionOptions.map(([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="City (optional)" htmlFor="location-city">
                  <select
                    id="location-city"
                    value={draft.locationCity}
                    onChange={(event) =>
                      updateDraft({ locationCity: event.target.value })
                    }
                    disabled={!draft.locationRegionCode}
                  >
                    <option value="">Choose a city</option>
                    {cityOptions.map(([code, label]) => (
                      <option value={label} key={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="settings-location-note" role="note">
                {draft.locationCountryCode
                  ? "We’ll use this broad area for local signals. You can remove it at any time."
                  : "No location selected. We’ll use broader regional signals instead."}
              </div>
            </Panel>

            <Panel as="section" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <div className="section-kicker">Audience context</div>
                  <h2>Give every idea a better angle.</h2>
                </div>
              </div>
              <FormField
                label="My audience is…"
                htmlFor="audience"
                hint="One clear sentence is enough. Avoid private or sensitive personal details."
              >
                <textarea
                  id="audience"
                  value={draft.audience}
                  onChange={(event) =>
                    updateDraft({ audience: event.target.value })
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="People in their 20s who want simple, practical fitness habits"
                />
              </FormField>
              <div className="settings-form-grid">
                <FormField label="Content style" htmlFor="content-style">
                  <input
                    id="content-style"
                    value={draft.contentStyle}
                    onChange={(event) =>
                      updateDraft({ contentStyle: event.target.value })
                    }
                    maxLength={300}
                    placeholder="Warm, practical, a little playful"
                  />
                </FormField>
                <FormField label="Creator goal" htmlFor="creator-goal">
                  <input
                    id="creator-goal"
                    value={draft.creatorGoal}
                    onChange={(event) =>
                      updateDraft({ creatorGoal: event.target.value })
                    }
                    maxLength={300}
                    placeholder="Grow a trusted community"
                  />
                </FormField>
              </div>
              <FormField
                label="Where are you in the journey?"
                htmlFor="experience-level"
              >
                <select
                  id="experience-level"
                  value={draft.experienceLevel}
                  onChange={(event) =>
                    updateDraft({ experienceLevel: event.target.value })
                  }
                >
                  <option value="">Choose one</option>
                  <option value="new">I am getting started</option>
                  <option value="growing">I am growing consistently</option>
                  <option value="experienced">
                    I have an established audience
                  </option>
                </select>
              </FormField>
            </Panel>
          </div>
          <aside className="settings-side-column">
            <Panel as="section" className="settings-summary-panel">
              <div className="section-kicker">Recommendation controls</div>
              <h2>Your feed follows this context.</h2>
              <p>
                We use these selections to rank relevant ideas. Changing them
                increments your profile version and refreshes future feed
                results.
              </p>
              <div className="settings-summary-list">
                <div>
                  <span>Focus areas</span>
                  <strong>{draft.nicheIds.length} selected</strong>
                </div>
                <div>
                  <span>Platforms</span>
                  <strong>{draft.platformIds.length} selected</strong>
                </div>
                <div>
                  <span>Languages</span>
                  <strong>{draft.languageIds.length} selected</strong>
                </div>
              </div>
            </Panel>
            <Panel as="section" className="settings-action-panel">
              <strong>
                {dirty
                  ? "Ready to save your context?"
                  : "Your context is current."}
              </strong>
              <p>
                {dirty
                  ? "Save when the choices feel right. Your edits are kept locally until then."
                  : "Make a change above whenever your creative direction shifts."}
              </p>
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save changes →"}
              </Button>
              <Button variant="quiet" onClick={reset} disabled={!dirty}>
                Reset edits
              </Button>
              <button
                className="settings-feed-link"
                type="button"
                onClick={() => router.push("/app")}
              >
                Back to Today
              </button>
            </Panel>
          </aside>
        </div>
      )}
    </DiscoveryShell>
  );
}
