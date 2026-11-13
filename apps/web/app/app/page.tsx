"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApiError,
  discoveryApi,
  getAccessToken,
  type DiscoveryFeed,
} from "../../lib/api";
import {
  DiscoveryShell,
  EmptyDiscovery,
  IdeaCardView,
  LoadingFeed,
} from "../../components/discovery-ui";

export default function TodayPage() {
  const [feed, setFeed] = useState<DiscoveryFeed | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [composeMode, setComposeMode] = useState(false);
  useEffect(() => {
    setComposeMode(
      new URLSearchParams(window.location.search).get("compose") === "1",
    );
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    discoveryApi
      .dailyFeed(token, { limit: 20 })
      .then(setFeed)
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "We could not load your signal.",
        ),
      );
  }, []);
  async function loadMore() {
    if (!feed?.nextCursor || loadingMore) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoadingMore(true);
    try {
      const next = await discoveryApi.dailyFeed(token, {
        limit: 20,
        cursor: feed.nextCursor,
      });
      setFeed((current) =>
        current
          ? {
              ...next,
              items: [...current.items, ...next.items],
            }
          : next,
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not load more ideas.",
      );
    } finally {
      setLoadingMore(false);
    }
  }
  return (
    <DiscoveryShell active="today">
      <header className="page-heading page-heading-today">
        <div>
          <div className="eyebrow">
            {composeMode
              ? "Tomorrow / one clear next step"
              : "Today / your next idea"}
          </div>
          <h1>
            {composeMode
              ? "Start with your best next idea."
              : "Good morning, creator."}
          </h1>
          <p className="lead">
            {composeMode
              ? "We’ll use your audience and niche to help you choose one idea, then turn it into a script you can record tomorrow."
              : "High-probability narrative angles for your audience, grounded in what is moving right now."}
          </p>
        </div>
        {!composeMode && (
          <div className="pulse-status">
            <span className="pulse-mark" aria-hidden="true">
              ◉
            </span>{" "}
            Editorial pulse updated at 06:00 IST
          </div>
        )}
      </header>
      {!composeMode && (
        <div className="rhythm-strip">
          <strong>Your creative rhythm:</strong>
          <span>
            <b>6</b> ideas saved this week
          </span>
          <span>
            <b>3</b> scripts in progress
          </span>
          <span>
            <b>2</b> reels ahead of schedule
          </span>
          <Link href="/app/explore">Explore all signals →</Link>
        </div>
      )}
      {error && (
        <div className="error discovery-error" role="alert">
          {error}
        </div>
      )}
      {!feed && !error && <LoadingFeed />}
      {feed && !feed.items.length && (
        <EmptyDiscovery
          title="Your signal is still forming."
          message={
            feed.fallback.message ??
            "Refresh after your research sources are ready."
          }
          action={
            <Link className="button button-quiet" href="/onboarding">
              Tune your context
            </Link>
          }
        />
      )}
      {feed?.items.length ? (
        <>
          {composeMode ? (
            <section
              className="tomorrow-plan"
              aria-labelledby="tomorrow-plan-title"
            >
              <div className="section-kicker">
                Your recommended starting point
              </div>
              <h2 id="tomorrow-plan-title">
                Plan tomorrow’s post in five simple steps.
              </h2>
              <strong>{feed.items[0].title}</strong>
              <p>{feed.items[0].summary}</p>
              <div
                className="tomorrow-plan-steps"
                aria-label="What happens next"
              >
                <span>
                  <b>1</b> Choose the idea
                </span>
                <span>
                  <b>2</b> Tell us your message
                </span>
                <span>
                  <b>3</b> Make, edit and save
                </span>
              </div>
              <div className="tomorrow-plan-actions">
                <Link
                  className="button button-primary"
                  href={`/app/ideas/${encodeURIComponent(feed.items[0].id)}`}
                >
                  Review this idea <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-action" href="/app/explore">
                  I have my own topic
                </Link>
              </div>
            </section>
          ) : (
            <div className="feed-section-heading">
              <div>
                <div className="section-kicker">Featured recommendation</div>
                <p>Top pick for today</p>
              </div>
              <span>Curated for your creative direction</span>
            </div>
          )}
          {!composeMode && (
            <div className="discovery-grid">
              {feed.items.map((idea, index) => (
                <IdeaCardView
                  key={idea.id}
                  idea={idea}
                  featured={index === 0}
                />
              ))}
            </div>
          )}
          {composeMode && (
            <Link className="text-action tomorrow-more" href="/app/explore">
              See more ideas
            </Link>
          )}
        </>
      ) : null}
      {feed?.nextCursor && (
        <button
          className="button button-quiet load-more"
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading ideas…" : "Load more ideas"}
        </button>
      )}
    </DiscoveryShell>
  );
}
