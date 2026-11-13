# CreatorPulse Definition of Done

## 1. Task-level DoD

A task is Done only when:

- The implementation matches the approved PRD, engineering design, database design and design references.
- Acceptance criteria are covered by automated tests or an explicitly recorded manual test where automation is not practical.
- Ownership checks, validation, error codes and telemetry are included where relevant.
- API changes have updated DTOs, OpenAPI output, typed client usage and contract tests.
- Database changes have a versioned migration/validator/index change, rollback or forward-recovery notes, and fixture coverage.
- UI changes use approved design tokens, responsive behavior, accessible labels/focus states and loading/empty/error/success states.
- AI changes include prompt/output versioning, schema validation, safety handling, cost accounting and an evaluation case.
- Documentation and operational notes are updated.
- No secrets, provider payloads, passwords or unnecessary personal data are committed or logged.

## 2. Epic-level DoD

- All stories in the epic meet task-level DoD.
- Cross-module boundaries remain explicit; controllers do not call repositories/providers directly.
- Integration tests cover the primary success path and at least one failure/retry path.
- Metrics, structured logs and correlation IDs are available for production diagnosis.
- Security and privacy review is complete for data touched by the epic.
- The epic is demonstrated through the relevant user journey using approved screen references.

## 3. MVP release DoD

### Functional

- Signup → onboarding → daily feed → evidence/score → generation → save/status → credits works end to end.
- Search works with useful results, including a transparent fallback when trend data is absent.
- Seven launch languages are represented in supported content generation and evaluated for language fidelity.
- Six PRD launch niches have representative seed/research coverage, unless the scope decision resolves the earlier “all niches” statement differently.
- Direct publishing is absent from the MVP product and code paths, except for clearly isolated future adapter interfaces.

### Reliability and operations

- API, worker, MongoDB and Redis health checks work.
- Queue retries, stalled jobs, duplicate operations and provider outages are tested.
- Credit reservation/settlement/refund is idempotent and audited.
- Backups and a restore test are complete before real creator data is accepted.
- Dashboards/alerts cover API errors, queue health, provider failures, credits and database/Redis health.

### Quality and security

- Unit, integration, contract, E2E, UI regression, security, load and multilingual/AI evaluation suites pass their release thresholds.
- Authorization tests show that creator A cannot read or mutate creator B’s profile, ideas, assets, credits or feedback.
- Dependency and container scans pass or have documented accepted exceptions.
- Accessibility checks cover keyboard navigation, focus visibility, labels, contrast, reduced motion and mobile touch targets.
- No known P0/P1 launch defect remains without explicit product-owner acceptance.

## 4. Release evidence

The release candidate must include test reports, migration/index report, backup/restore evidence, AI evaluation summary, multilingual review summary, security scan output, performance baseline, runbook links and a list of known limitations.
