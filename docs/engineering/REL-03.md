# REL-03 launch readiness review

This document is the release-candidate checklist for CreatorPulse. The release
decision is evidence-based and must be approved by both the product owner and
engineering lead. A missing approval, failed threshold, untested recovery path
or unaccepted P0/P1 defect is a `no-go`.

## Release evidence matrix

| Area   | Required evidence                                                          | Source                                                          | Gate                                  |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| QA-01  | Unit, integration, contract and coverage results                           | `npm run check`, `npm run test:coverage`                        | Review approved and QA passed         |
| QA-02  | Signup/onboarding journey, accessibility, responsive/UI regression results | `npm run test:e2e:qa02` and release QA artifacts                | Review approved and QA passed         |
| QA-03  | Bounded latency, retry, quota and credit-cost baseline                     | `npm run qa03:baseline`                                         | Thresholds pass and evidence retained |
| QA-04  | Seven-language golden set, safety regressions and human review             | `npm run qa04:review`                                           | Decision is `go`                      |
| REL-01 | Separate containers, health checks, staging smoke and rollback log         | `npm run test:release` and CI release artifacts                 | Review approved and QA passed         |
| REL-02 | Encrypted backup, checksum verification and isolated restore               | `npm run backup:create`, `npm run backup:verify`, restore drill | Review approved and QA passed         |
| SEC-01 | Authorization, rate-limit, privacy and secret-scan evidence                | security checks and task review                                 | Must be implementation-complete       |

The machine-readable checker reads the task tracker and writes
`.ci-artifacts/rel03-readiness.json`:

```sh
npm run test:rel03
npm run release:readiness
```

`release:readiness` exits non-zero for `no-go`, so it can be used as the final
deployment gate without relying on a human to notice a missing prerequisite.

## Go/no-go decision

The current working-tree candidate is `no-go` until SEC-01 is complete and the
required review/QA approvals for QA-01 through QA-04 and REL-02 are recorded.
This is an intentional launch hold, not an accepted defect. The report lists
each blocker and must be regenerated after every review or QA update.

## Known limitations

- Direct publishing is excluded from the MVP.
- Free-source availability, freshness and language coverage may produce
  explicitly labeled partial-data states.
- AI output requires safety review and creator verification before publishing.
- Final activation, repeat-use, quality, cost and support-burden thresholds
  require beta-cohort measurement before a broad launch.

## Launch metrics

Track activation from signup to first saved idea/script, onboarding completion,
first-session relevance feedback, seven-day return, generation success/failure,
credit cost per successful draft, provider latency/error rate, safety review
rate, stale-source rate and support contacts per active creator. Review daily
during beta and set numeric thresholds before changing the decision to `go`.

## Support process

Support owns creator-facing triage, reproduction details and status updates.
Engineering owns request/operation lookup, queue reconciliation, credit-ledger
correction and provider/database incidents. Every incident records creator ID
only when access is authorized, request/operation IDs, timestamps, impact,
mitigation, data-safety assessment and follow-up owner. Never request passwords,
tokens or raw provider payloads in support channels.

## Rollback decision

Rollback the application image when health checks fail, error rates or provider
failures exceed the approved threshold, unsafe output bypasses review, or
credits cannot be reconciled. Follow REL-01 for container rollback and REL-02
for backup/restore and queue reconciliation. Do not delete database volumes or
run an unreviewed destructive migration as a rollback mechanism.

## Product-owner sign-off

The product owner confirms the MVP launch criteria, known limitations and beta
support capacity. The engineering lead confirms evidence integrity, security,
observability, restore readiness and rollback viability. Both approvals, the
candidate identifier and the final report path must be recorded in the task
tracker before release.
