# RS-02 free-source feasibility proof

## Scope and evidence

The bounded proof uses one RSS adapter and a manual-seed fallback. The test fixture repeats the RSS fetch, records stable content hashes, simulates an outage, simulates an empty feed, and classifies stale data. Manual seeds cover representative MVP signals across fitness/Hindi, food/English and finance/Telugu; this is representative coverage, not a claim of complete platform coverage.

Run the evidence with:

```bash
npm run test:rs02
```

Every normalized document carries source type/name, canonical URL, observed time, published time when available, content hash, retrieval status and a license/terms note. The adapter is bounded to at most 100 RSS items per request and does not scrape authenticated or non-HTTP sources.

## Decision gate

| Measure         | Go/no-go rule                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Permitted use   | A source must have an explicit reviewed terms note and `permitted: true`; otherwise no-go and no fetch.                        |
| Availability    | A successful bounded fetch with at least one usable document is required for a primary source.                                 |
| Rate limits     | Rate-limit responses are classified and trigger the approved fallback; they are never retried unboundedly.                     |
| Normalization   | 100% of returned documents must contain all provenance fields.                                                                 |
| Freshness       | Freshness is measured from `publishedAt`; stale data and missing publication dates are conditional gaps that must be surfaced. |
| Signal coverage | Representative niche/language coverage is measured explicitly; incomplete coverage is conditional, not silently accepted.      |
| Fallback        | RSS outage, rate limit or empty result uses approved manual seeds and marks the run as fallback/partial.                       |

## Product limitations and fallback

RSS provides public editorial signals, not guaranteed platform trends, engagement metrics or complete niche/language coverage. Feeds can be stale, rate-limited, malformed or withdrawn. Manual seeds are the safe fallback for bounded development and QA only; they are not presented as live trend evidence. Production ingestion must retain provenance and re-run the terms review before adding a source.
