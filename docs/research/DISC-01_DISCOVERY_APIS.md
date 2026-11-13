# DISC-01: Feed, search, and idea-detail APIs

The API exposes the discovery workflow under the global `/v1` prefix:

| Route                   | Purpose                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/feed/daily`    | Authenticated, creator-profile-filtered daily feed. It materializes REC-03 recommendations when today has no materialized feed.           |
| `GET /v1/ideas/search`  | Authenticated bounded search over normalized idea text and optional language/platform/niche filters. It works when no trend score exists. |
| `GET /v1/ideas/:ideaId` | Authenticated idea detail with the current score and at most ten evidence records, including safe public source links.                    |

All list endpoints accept `limit` (1–100) and an opaque cursor. Cursor values
are validated and results are bounded. Feed recommendation records are scoped
by creator ID; reusable ideas, scores, evidence, and public source metadata are
not creator-owned. Search and detail never return private recommendation
interaction state from another creator.

Score snapshots and coverage caveats are returned as stored by REC-02. Detail
evidence is capped to prevent unbounded payloads, and missing/stale evidence is
represented through the idea coverage and score caveat fields rather than
silently omitted.
