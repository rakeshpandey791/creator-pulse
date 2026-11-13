# REC-03: Candidate generation, ranking and deduplication

REC-03 provides the cold-start recommendation pipeline used before behavioral
history exists. It receives bounded candidates from a retrieval layer (Mongo
filters, the vector store, or curated seeds), then applies the same deterministic
eligibility and ranking rules regardless of retrieval source.

## Pipeline

1. Apply hard language, platform, and niche filters from the creator profile.
2. Suppress ideas already seen or dismissed by the creator.
3. Deduplicate exact canonical keys and near-identical titles within the same
   language/platform context, keeping the strongest deterministic candidate.
4. Rank by the REC-02 overall score with small freshness, momentum, and
   relevance tie-break contributions.
5. Enforce a maximum of two ideas per topic when alternatives exist.
6. Materialize a deterministic daily recommendation key containing creator,
   idea, UTC feed date, and surface.

The ranking release is `rec-03-v1`. Ties resolve by score and then stable idea
ID, so the same profile, candidate set, and score snapshots reproduce the same
feed. Each recommendation stores the score snapshot ID, profile version,
ranking version, rank, and a reason derived from the same score dimensions.

## Empty states and persistence

An empty retrieval set is reported as `no_candidates`; a non-empty set with no
profile-compatible ideas is reported as `no_eligible_candidates`. Both states
include an actionable explanation instead of silently returning an empty list.

Feed materialization uses the unique creator/idea/date/surface key from the
database schema. Re-materializing a feed updates rank metadata while preserving
interaction timestamps such as seen, opened, saved, and dismissed.
