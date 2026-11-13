"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApiError,
  discoveryApi,
  getAccessToken,
  type IdeaStatus,
  type LibraryItem,
} from "../../../lib/api";
import { reconcileLibraryStatus } from "../../../lib/library-state";
import {
  DiscoveryShell,
  EmptyDiscovery,
  taxonomyLabel,
} from "../../../components/discovery-ui";

const statusOptions: Array<{ value: IdeaStatus | "all"; label: string }> = [
  { value: "all", label: "All saved" },
  { value: "saved", label: "Saved" },
  { value: "planned", label: "Planned" },
  { value: "scripted", label: "Scripted" },
  { value: "published", label: "Published" },
  { value: "dismissed", label: "Dismissed" },
];

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "all">("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    setError("");
    discoveryApi
      .library(token, {
        limit: 20,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
      })
      .then((response) => {
        if (cancelled) return;
        setItems(response.items);
        setNextCursor(response.nextCursor);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Your library could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoadingMore(true);
    try {
      const response = await discoveryApi.library(token, {
        limit: 20,
        cursor: nextCursor,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
      });
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "More saved ideas could not be loaded.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function updateStatus(item: LibraryItem, status: IdeaStatus) {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setPending(item.idea.id);
    setError("");
    try {
      const event = await discoveryApi.updateStatus(
        token,
        item.idea.id,
        status,
      );
      setItems((current) =>
        reconcileLibraryStatus(
          current,
          item.idea.id,
          status,
          event,
          statusFilter,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "That status could not be saved.",
      );
    } finally {
      setPending(null);
    }
  }

  async function removeSave(item: LibraryItem) {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setPending(item.idea.id);
    setError("");
    try {
      await discoveryApi.removeSave(token, item.idea.id);
      setItems((current) =>
        current.filter((candidate) => candidate.idea.id !== item.idea.id),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "This idea could not be removed from your library.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <DiscoveryShell active="library">
      <header className="page-heading library-heading">
        <div>
          <div className="eyebrow">Workspace / Library</div>
          <h1>Your idea shelf.</h1>
          <p className="lead">
            Keep promising angles close, move them through your workflow, and
            return when you are ready to record.
          </p>
        </div>
        <Link className="button button-primary" href="/app/explore">
          Find another idea <span aria-hidden="true">→</span>
        </Link>
      </header>

      <div className="library-toolbar" aria-label="Library filters">
        <div className="library-filter-label">Show</div>
        <div className="library-filters" role="list">
          {statusOptions.map((option) => (
            <button
              className={statusFilter === option.value ? "active" : ""}
              key={option.value}
              type="button"
              aria-pressed={statusFilter === option.value}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="error discovery-error" role="alert">
          {error}
        </div>
      )}
      {loading && <LibraryLoading />}
      {!loading && !error && !items.length && (
        <EmptyDiscovery
          title={
            statusFilter === "all"
              ? "Your shelf is ready for its first idea."
              : `No ${statusFilter} ideas yet.`
          }
          message={
            statusFilter === "all"
              ? "Save an idea from Today or Explore and it will stay here with its evidence and score."
              : "Move an idea into this stage from its status control, or keep exploring for a better fit."
          }
          action={
            <Link className="button button-quiet" href="/app/explore">
              Explore ideas
            </Link>
          }
        />
      )}
      {!loading && items.length > 0 && (
        <div className="library-grid">
          {items.map((item, index) => (
            <LibraryCard
              item={item}
              key={item.idea.id}
              featured={index === 0}
              pending={pending === item.idea.id}
              onStatus={(status) => void updateStatus(item, status)}
              onRemove={() => void removeSave(item)}
            />
          ))}
        </div>
      )}
      {nextCursor && !loading && (
        <button
          className="button button-quiet load-more"
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading your shelf…" : "Load more saved ideas"}
        </button>
      )}
    </DiscoveryShell>
  );
}

function LibraryCard({
  item,
  featured,
  pending,
  onStatus,
  onRemove,
}: {
  item: LibraryItem;
  featured: boolean;
  pending: boolean;
  onStatus: (status: IdeaStatus) => void;
  onRemove: () => void;
}) {
  const status = item.status?.status ?? item.saved.currentStatus ?? "saved";
  return (
    <article
      className={`library-card ${featured ? "library-card-featured" : ""}`}
    >
      <div className="library-card-topline">
        <span className="status-pill">{statusLabel(status)}</span>
        {item.idea.score && (
          <span className="library-score">
            {Math.round(item.idea.score.overallScore)}/100
          </span>
        )}
      </div>
      <div className="idea-context">
        <span>{taxonomyLabel(item.idea.nicheId)}</span>
        <span>{taxonomyLabel(item.idea.platformId)}</span>
        <span>{taxonomyLabel(item.idea.languageId)}</span>
      </div>
      <h2>
        <Link href={`/app/ideas/${encodeURIComponent(item.idea.id)}`}>
          {item.idea.title}
        </Link>
      </h2>
      <p>{item.idea.summary}</p>
      <div className="library-card-meta">
        <span>{item.idea.evidence.length} evidence items</span>
        <span>{item.assets.length} saved assets</span>
      </div>
      <div className="library-card-actions">
        <label className="status-control">
          <span className="sr-only">Update status for {item.idea.title}</span>
          <select
            value={status}
            disabled={pending}
            onChange={(event) => onStatus(event.target.value as IdeaStatus)}
          >
            <option value="saved">Saved</option>
            <option value="planned">Planned</option>
            <option value="scripted">Scripted</option>
            <option value="published">Published manually</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <Link
          className="button button-quiet"
          href={`/app/ideas/${encodeURIComponent(item.idea.id)}`}
        >
          Open & give feedback
        </Link>
        <button
          className="text-button"
          type="button"
          onClick={onRemove}
          disabled={pending}
        >
          Remove save
        </button>
      </div>
      {status === "published" && (
        <p className="library-manual-note">
          Published is a manual progress marker; CreatorPulse does not publish
          for you.
        </p>
      )}
    </article>
  );
}

function statusLabel(status: IdeaStatus) {
  return status === "published"
    ? "Published manually"
    : status[0].toUpperCase() + status.slice(1);
}

function LibraryLoading() {
  return (
    <div className="library-grid" aria-busy="true" aria-label="Loading library">
      <div className="idea-skeleton library-skeleton" />
      <div className="idea-skeleton library-skeleton" />
      <div className="idea-skeleton library-skeleton" />
    </div>
  );
}
