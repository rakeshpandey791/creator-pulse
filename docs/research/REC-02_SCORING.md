# REC-02: Explainable opportunity scoring

REC-02 calculates a deterministic, directional opportunity score for a content
idea. It is not a prediction of reach or a guarantee of market demand.

## Scoring contract

Every snapshot contains four bounded dimensions, each scored from 0 to 100:

| Dimension      | Weight | Meaning                                                                                                                     |
| -------------- | -----: | --------------------------------------------------------------------------------------------------------------------------- |
| Relevance      |    35% | Fit with the creator context supplied by the caller. If no profile match is available, this is explicitly estimated.        |
| Trend momentum |    30% | Mean normalized `momentum` and `volume` signals. Missing signals are a visible coverage gap.                                |
| Freshness      |    20% | Publication/observation recency over a 30-day window; stale sources score zero.                                             |
| Competition    |    15% | Opportunity from low saturation. A supplied competition signal is inverted; otherwise source coverage provides an estimate. |

The release is `rec-02-v1`. Labels are deterministic: `Strong opportunity`
for 75–100, `Emerging opportunity` for 50–74.99, and `Limited signal` below 50. The snapshot stores the dimension value, weight, observed/estimated kind,
and a plain-language explanation so the UI does not need to reconstruct the
reasoning.

## Coverage and snapshots

The snapshot records source count, signal count, stale source count, a coverage
state, uncertainty, and a caveat. Missing or stale evidence never gets hidden
behind a confident label.

Snapshots are append-only score records. Re-scoring writes a new snapshot and
marks the previous current snapshot false. Mongo uses a transaction when the
deployment supports replica sets or sharding; standalone Mongo uses a
compensating write path so local development does not require unsupported
transactions. The `idea_scores` partial unique index permits one current
snapshot per idea while retaining the full version history.
