# REC-01 idea and evidence assembly

REC-01 creates reusable topics and creator-facing ideas from research, manual search or recommendation inputs. Canonical keys normalize title, language, platform and niche so repeated requests resolve to one reusable idea rather than creator-specific copies.

Evidence is bounded to five requested source documents and five signals. Every persisted evidence record references an existing source document; trend evidence additionally references an existing signal whose source document is included. Source excerpts are stripped of markup and capped before persistence. An idea with no usable evidence is still representable, but its `coverage` explicitly reports zero sources, `missingEvidence: true` and `uncertainty: unavailable`.

Stale sources remain visible as directional evidence with a limitation and a stale-source count. Missing references are rejected instead of silently producing unsupported evidence. Mongo persistence uses the existing unique canonical-key indexes; replica-set or sharded Mongo uses a transaction, while standalone Mongo is detected and uses deterministic insert-and-compensate cleanup. The in-memory store is used for deterministic service tests.

Run the focused evidence with:

```bash
npm run test:rec01
```
