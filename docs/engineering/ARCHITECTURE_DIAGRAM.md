# CreatorPulse Architecture Diagrams

These diagrams describe the approved MVP engineering direction: a modular NestJS monolith, a separate worker process, MongoDB-first persistence, Redis/BullMQ asynchronous work and replaceable provider adapters.

## 1. Context diagram

```mermaid
flowchart LR
  Creator[Indian micro-creator] --> App[CreatorPulse web app]
  App --> Core[CreatorPulse API and worker system]
  Core --> Mongo[MongoDB Community]
  Core --> Redis[Redis-compatible store]
  Core --> Gemini[Gemini free model]
  Core --> Sources[Official free APIs and permitted public RSS/web]
  Core -. future .-> Payments[Payment provider]
  Core -. future .-> Social[Instagram/YouTube/Facebook publishing APIs]
```

## 2. Container diagram

```mermaid
flowchart TB
  Browser[Browser] --> Next[Next.js React TypeScript]
  Next --> API[NestJS REST API]
  API --> Mongo[(MongoDB)]
  API --> Redis[(Redis)]
  API --> Queue[BullMQ]
  Queue --> Worker[Background worker]
  Worker --> Mongo
  Worker --> Redis
  Worker --> AI[AI adapters]
  Worker --> Ingest[Research/source adapters]
  API --> Logs[Logs/metrics/traces]
  Worker --> Logs
```

## 3. Module dependency diagram

```mermaid
flowchart LR
  Identity[Identity] --> Creator[Creator]
  Creator --> Discovery[Discovery]
  Discovery --> Ideas[Ideas]
  Discovery --> Recommendations[Recommendations]
  Recommendations --> Research[Research]
  Recommendations --> Scoring[Scoring]
  Ideas --> Generation[Generation]
  Generation --> Language[Language]
  Generation --> Safety[Safety]
  Generation --> Credits[Credits]
  Subscriptions[Subscriptions] --> Credits
  Feedback[Feedback] --> Recommendations
  Jobs[Jobs] --> Research
  Jobs --> Generation
  Jobs --> Recommendations
  Integrations[Provider adapters] --> Research
  Integrations --> Generation
```

## 4. Discovery and ranking flow

```mermaid
flowchart TD
  Profile[Creator profile] --> Candidates[Candidate retrieval]
  Sources[Normalized source topics] --> Candidates
  Embeddings[Vector store abstraction] --> Candidates
  Candidates --> Eligibility[Language/niche/platform filters]
  Eligibility --> Dedup[Deduplication/diversity]
  Dedup --> Scores[Relevance + momentum + freshness + competition]
  Scores --> Explanation[Evidence-backed explanation]
  Explanation --> Feed[Daily feed/search]
```

## 5. Asynchronous generation sequence

```mermaid
sequenceDiagram
  participant UI as Web app
  participant API as REST API
  participant DB as MongoDB
  participant Q as BullMQ
  participant W as Worker
  participant LLM as Gemini adapter

  UI->>API: POST generation + Idempotency-Key
  API->>DB: Validate ownership and reserve credits
  API->>Q: Add generation job
  API-->>UI: 202 operationId
  W->>Q: Consume job
  W->>LLM: Request structured output
  LLM-->>W: Candidate output
  W->>W: Validate schema/language/safety/duration
  W->>DB: Persist asset, settle/refund credits
  UI->>API: GET operation status
  API-->>UI: Result or actionable failure
```

## 6. Failure and retry flow

```mermaid
flowchart TD
  Call[External call] --> Result{Result}
  Result -->|Success| Validate[Validate and persist]
  Result -->|Timeout/429/5xx| Retry{Retry budget left?}
  Retry -->|Yes| Backoff[Exponential backoff + jitter]
  Backoff --> Call
  Retry -->|No| Fail[Mark failed, release/refund reservation]
  Result -->|Invalid content| Repair{Safe repair allowed?}
  Repair -->|Yes| Call
  Repair -->|No| Fail
```

## 7. Future publishing boundary

```mermaid
flowchart LR
  Asset[Approved creator asset] --> PublishPort[Publishing port]
  PublishPort --> Instagram[Instagram adapter]
  PublishPort --> YouTube[YouTube adapter]
  PublishPort --> Facebook[Facebook adapter]
  PublishPort --> Confirm[Destination/privacy confirmation]
  Confirm --> Result[Publish/schedule result]
```

The publishing boundary is intentionally not connected to MVP user flows. It exists only as a future integration seam.
