"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  discoveryApi,
  getAccessToken,
  type IdeaCard,
} from "../../../lib/api";
import {
  DiscoveryShell,
  EmptyDiscovery,
  IdeaCardView,
  LoadingFeed,
} from "../../../components/discovery-ui";

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [items, setItems] = useState<IdeaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newScriptMode, setNewScriptMode] = useState(false);
  const [plannerMode, setPlannerMode] = useState<"recommended" | "own-topic">(
    "recommended",
  );
  const [topicBrief, setTopicBrief] = useState("");
  async function search(nextQuery = submitted) {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await discoveryApi.search(token, {
        q: nextQuery || undefined,
        limit: 20,
      });
      setItems(result.items);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Search is unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const composing = params.get("compose") === "1";
    setNewScriptMode(composing);
    if (params.get("mode") === "own-topic") setPlannerMode("own-topic");
    void search("");
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    const nextQuery = (plannerMode === "own-topic" ? topicBrief : query).trim();
    setSubmitted(nextQuery);
    void search(nextQuery);
  }
  function chooseOwnTopic() {
    setPlannerMode("own-topic");
    setSubmitted("");
    setItems([]);
    setError("");
  }
  return (
    <DiscoveryShell active="explore">
      <header className="page-heading page-heading-explore">
        <div>
          <div className="eyebrow">Explore / Find your angle</div>
          <h1>Start with a question.</h1>
          <p className="lead">
            Search the idea shelf when you already have a direction. No trend
            signal required.
          </p>
        </div>
      </header>
      {newScriptMode && (
        <section className="script-planner" aria-labelledby="planner-heading">
          <div>
            <div className="eyebrow">Tomorrow / your next post</div>
            <h2 id="planner-heading">What do you want to record tomorrow?</h2>
            <p>
              Start with a recommended idea or bring your own topic. We’ll turn
              it into three hooks, a spoken script and a CTA you can edit.
            </p>
          </div>
          <div
            className="planner-options"
            role="group"
            aria-label="Script starting point"
          >
            <button
              className={
                plannerMode === "recommended"
                  ? "planner-option active"
                  : "planner-option"
              }
              type="button"
              onClick={() => setPlannerMode("recommended")}
            >
              <strong>Use a recommended idea</strong>
              <span>See what fits your niche and audience today.</span>
            </button>
            <button
              className={
                plannerMode === "own-topic"
                  ? "planner-option active"
                  : "planner-option"
              }
              type="button"
              onClick={chooseOwnTopic}
            >
              <strong>Start with my own topic</strong>
              <span>Tell us the direction already on your mind.</span>
            </button>
          </div>
        </section>
      )}
      <form className="search-bar" onSubmit={submit}>
        <label htmlFor="idea-search">
          {plannerMode === "own-topic"
            ? "What do you want to talk about?"
            : "Search ideas"}
        </label>
        <div>
          <input
            id="idea-search"
            value={plannerMode === "own-topic" ? topicBrief : query}
            onChange={(event) => {
              if (plannerMode === "own-topic")
                setTopicBrief(event.target.value);
              else setQuery(event.target.value);
            }}
            placeholder={
              plannerMode === "own-topic"
                ? "e.g. simple mobility routines for desk workers"
                : "e.g. practical fitness habits"
            }
          />
          <button className="button button-primary" type="submit">
            {plannerMode === "own-topic" ? "Find an angle" : "Search"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
      {error && (
        <div className="error discovery-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingFeed />
      ) : items.length ? (
        <div className="discovery-grid explore-grid">
          {items.map((idea) => (
            <IdeaCardView key={idea.id} idea={idea} />
          ))}
        </div>
      ) : (
        <EmptyDiscovery
          title="No close matches yet."
          message={
            submitted
              ? `Nothing matched “${submitted}”. Try a broader phrase or a different language.`
              : "Try a phrase from the kind of work you want to make."
          }
        />
      )}
    </DiscoveryShell>
  );
}
