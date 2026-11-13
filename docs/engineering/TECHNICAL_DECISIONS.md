# CreatorPulse Technical Decisions

**Status:** Draft for engineering approval  
**Date:** 2026-11-10  
**Scope:** MVP engineering design derived from the approved PRD

## Decision summary

| ID     | Decision                                                                         | Status           |
| ------ | -------------------------------------------------------------------------------- | ---------------- |
| TD-001 | Use a modular NestJS monolith plus a separate worker process                     | Agreed direction |
| TD-002 | Use Next.js, React and TypeScript for the frontend                               | Agreed direction |
| TD-003 | Use MongoDB as the system of record                                              | Agreed direction |
| TD-004 | Use a vector-store abstraction with MongoDB-first retrieval; defer pgvector      | Agreed direction |
| TD-005 | Use self-managed NestJS authentication with Argon2id and rotating JWT sessions   | Agreed direction |
| TD-006 | Use Redis-compatible storage and BullMQ for jobs, scheduling, caching and limits | Agreed direction |
| TD-007 | Use Gemini free-model integration behind an AI provider port                     | Agreed direction |
| TD-008 | Use official free APIs plus permitted public RSS/web source adapters             | Agreed direction |
| TD-009 | Use an internal credits/entitlements engine with mock/manual payment adapter     | Agreed direction |
| TD-010 | Defer direct social publishing implementation to post-MVP                        | PRD-aligned      |

## 1. Architecture style

### Chosen: modular monolith with worker

The API remains one deployable business application, but modules own their business capabilities and infrastructure ports. A worker process consumes asynchronous jobs from the same codebase. This provides a practical separation for long-running work without introducing distributed service-to-service contracts prematurely.

### Rejected: microservices from day one

Microservices would add network contracts, deployment units, service discovery, distributed tracing and operational work before traffic or team boundaries justify them. Modules can be extracted later if a real scaling or ownership boundary appears.

### Rejected: serverless-first

Serverless can reduce idle cost, but long-running research/AI jobs, local development parity, provider-specific limits and free-tier constraints would become architectural concerns. The worker model remains portable across container hosts.

## 2. Frontend and backend stack

### Chosen

- React + Next.js + TypeScript
- Node.js + NestJS
- REST + OpenAPI

The stack matches the technical preference and supports shared TypeScript contracts, conventional module boundaries, testability and a future separation of frontend/backend deployments.

### Trade-off

REST requires explicit polling or a later push mechanism for asynchronous status. This is acceptable for MVP; WebSockets or server-sent events can be added if polling becomes a measured usability issue.

## 3. Data architecture

### Chosen: MongoDB first

MongoDB is the system of record for creator-oriented, evolving content objects and evidence metadata. Repositories hide persistence details. Indexes and query plans must be reviewed before launch.

### Chosen: vector abstraction

The application depends on a `VectorStore` port rather than directly coupling recommendation logic to a vector database. The first implementation uses MongoDB-compatible retrieval or a local/free implementation supported by the selected deployment. pgvector is the next option if semantic retrieval needs a separate relational/vector engine.

### Rejected: MongoDB + pgvector immediately

Two databases would add synchronization, backups, migrations, operational cost and failure modes before retrieval quality is known.

## 4. Authentication

### Chosen: self-managed authentication

NestJS owns email/password signup/login, Argon2id hashing, JWT access tokens, rotating refresh tokens and session revocation.

### Rejected: Keycloak for MVP

Keycloak is capable and open source, but a separate identity server adds deployment and operational complexity for the initial creator flow. It remains a possible future choice if identity requirements expand.

### Rejected: hosted auth provider

A hosted provider could reduce security operations, but conflicts with the current free/open-source-first constraint and introduces provider coupling.

## 5. Queues, jobs and caching

### Chosen: Redis-compatible store + BullMQ

BullMQ provides queues, retries, backoff, job scheduling, concurrency controls, rate limiting and stalled-job recovery. The application must design for at-least-once processing and idempotent handlers.

Recurring work must use the current BullMQ job-scheduler API rather than legacy repeatable-job APIs. This is an implementation detail to verify against the selected BullMQ version.

### Rejected: MongoDB polling jobs

Polling can work at very small scale, but it provides weaker scheduling, locking, retry and rate-control primitives and creates avoidable load on the system of record.

## 6. AI provider strategy

### Chosen: Gemini free model behind an adapter

Gemini is the initial provider because it satisfies the current free-model requirement. The domain uses provider-neutral generation and embedding interfaces. Tests use deterministic fakes.

This is a deliberate exception to the open-source-first constraint: Gemini is a free external API/model access path, not an open-source runtime dependency. Local development and tests must work without it through fakes, and production use must be protected by explicit quotas and configuration.

### Required controls

- Per-user and global quotas
- Prompt/output versioning
- Structured output validation
- Language and safety checks
- Retry classification
- Cost/usage telemetry
- Explicit provider configuration, never hard-coded model names in business logic

### Trade-off

Free quotas may be insufficient or change over time. Caching, deduplication, bounded concurrency and provider replacement are required before growth.

## 7. Trend and research sources

### Chosen: adapter-based free sources

Use official free API quotas where available plus public RSS/web sources that permit access. Each source records provenance, timestamps and coverage limitations.

### Rejected: unrestricted scraping

It would create legal, policy, reliability and maintenance risks and conflicts with the PRD’s prohibition on private/restricted data access.

### Rejected: official APIs only

This would be more conservative but would create unacceptable coverage gaps for MVP research. The adapter design allows source quality to be tightened later.

## 8. Payments and subscriptions

### Chosen: internal entitlement engine plus mock/manual payment adapter

The product can implement real credit reservation, settlement, refunds, plan entitlements and renewal states without processing real payments. A provider interface allows a future Indian payment integration.

### Trade-off

Mock checkout does not validate real payment conversion, webhooks or reconciliation. A real provider adapter is required before charging users.

## 9. Direct publishing

Direct publishing is not implemented in MVP. A future publishing port will isolate platform OAuth, account scopes, media constraints, confirmation, scheduling and platform-specific errors. No publishing credential is collected in the MVP.

## 10. API contract policy

- Version all public endpoints under `/v1`.
- Generate and review OpenAPI documentation.
- Use DTO validation at the transport boundary.
- Use idempotency keys for billable/mutating asynchronous requests.
- Return stable machine-readable error codes.
- Never expose provider-specific errors or internal stack traces to clients.

## 11. Security decisions

- Argon2id for passwords.
- HttpOnly secure refresh-token cookies for browser sessions where deployment permits.
- Ownership checks in application services, not only controllers.
- SSRF controls for source fetching.
- Prompt-injection defenses for external content.
- Redaction-first structured logging.
- Least-privilege future integration scopes.

## 12. Open technical decisions

These are intentionally deferred and must be resolved before implementation or deployment:

1. Exact MongoDB Community version and whether its selected deployment supports required vector/full-text capabilities.
2. Exact embedding model and whether it can run within the free/open-source constraint.
3. Cloud/container host and backup strategy.
4. Production metrics/log storage choice.
5. Email delivery approach for password reset and account notifications.
6. Concrete payment provider and webhook contract before monetized launch.
7. Native-speaker evaluation process and quality thresholds.

## 13. Architecture review checklist

- [ ] All PRD P0 features map to a module and API capability.
- [ ] No P1 direct-publishing behavior is required for MVP.
- [ ] No database schema or coding work is included in this phase.
- [ ] External providers are behind replaceable ports.
- [ ] Credits are authoritative and idempotent.
- [ ] AI output is validated before persistence.
- [ ] Source provenance and uncertainty are retained.
- [ ] Free/open-source operation is feasible for local MVP and early beta.
- [ ] Migration path exists for paid providers and pgvector.
