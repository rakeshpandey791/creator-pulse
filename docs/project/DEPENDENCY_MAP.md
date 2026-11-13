# CreatorPulse Dependency Map

## 1. Workstream dependency graph

```mermaid
flowchart TD
  S0[Scope and design decisions] --> S1[Repo, Docker, CI and config]
  S1 --> S2[Mongo validators, indexes, migrations and seeds]
  S1 --> S3[NestJS module skeleton and REST conventions]
  S1 --> S4[Next.js shell and shared UI primitives]
  S2 --> S5[Repositories and ownership scopes]
  S3 --> S5
  S5 --> S6[Identity and sessions]
  S5 --> S7[Creator profile and onboarding]
  S2 --> S8[Research source adapters]
  S8 --> S9[Topics, signals and evidence]
  S9 --> S10[Scoring and recommendation materialization]
  S7 --> S10
  S10 --> S11[Feed, search and idea detail APIs]
  S11 --> S12[Discovery UI]
  S7 --> S13[Language policy and evaluation harness]
  S9 --> S14[Generation prompts and safety checks]
  S13 --> S14
  S14 --> S15[Async worker and Gemini adapter]
  S15 --> S16[Hook/script/CTA UI]
  S7 --> S21[Coarse location consent]
  S9 --> S22[Local pulse and evidence boundary]
  S21 --> S22
  S22 --> S23[Grounded angle and script orchestration]
  S15 --> S23
  S23 --> S24[Rural-first new-script flow]
  S16 --> S24
  S6 --> S17[Credits and subscription state]
  S17 --> S15
  S11 --> S18[Library, status and feedback]
  S12 --> S19[Journey E2E]
  S16 --> S19
  S24 --> S19
  S17 --> S19
  S19 --> S20[Security, load, multilingual and release validation]
```

## 2. External dependencies

| Dependency                          | Required for                                 | Failure strategy                                                            | Owner           |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | --------------- |
| Gemini free model/key/quota         | Generation and possibly language checks      | Fake provider, bounded queue, retry classification, clear unavailable state | AI/backend      |
| Permitted free research sources/RSS | Trend signals and evidence                   | Manual seed fallback, stale/partial-data labels                             | Data/backend    |
| SMTP or local mail adapter          | Password recovery and transactional messages | Development sink; retryable worker job                                      | Backend/infra   |
| Payment provider or mock adapter    | Subscription boundary                        | Mock/manual transaction path in MVP                                         | Backend         |
| MongoDB Community                   | Persistence                                  | Local Docker, backups and restore test                                      | Backend/infra   |
| Redis-compatible store              | Queues, locks, cache and rate limits         | Safe degradation for non-critical reads; fail closed for security limits    | Backend/infra   |
| Google Stitch references            | Visual implementation fidelity               | Approved design docs and screen IDs remain the fallback                     | Frontend/design |

## 3. Critical-path tasks

`CP-01` scope resolution → `INF-01` foundation → `DB-01` migrations/seeds → `BE-01` API skeleton → `ID-01` auth/profile → `RS-01` research normalization → `REC-01` scoring/ranking → `FE-03` discovery UI → `AI-03` async generation/credits → `FE-05` script workspace → `QA-06` end-to-end launch gate.

## 4. High-risk tasks requiring a proof of concept

- `RS-02`: permitted free-source feasibility and source-term review.
- `REC-02`: retrieval quality using MongoDB-first vector abstraction.
- `AI-02`: Gemini structured output, quota and latency test.
- `LANG-02`: seven-language naturalness and mixed-language detection evaluation.
- `CR-02`: credit atomicity under retries and duplicate requests.
