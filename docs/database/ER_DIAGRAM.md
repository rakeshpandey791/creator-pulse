# CreatorPulse Entity Relationship Diagram

MongoDB does not enforce relational foreign keys. This Mermaid ER diagram shows logical references and cardinality for review; implementation uses MongoDB collections and application-enforced references.

```mermaid
erDiagram
  USERS ||--|| CREATOR_PROFILES : owns
  USERS ||--o{ AUTH_SESSIONS : has
  CREATOR_PROFILES }o--o{ NICHES : selects
  CREATOR_PROFILES }o--o{ LANGUAGES : selects
  CREATOR_PROFILES }o--o{ PLATFORMS : selects

  CONTENT_TOPICS ||--o{ CONTENT_IDEAS : informs
  CONTENT_TOPICS ||--o{ TREND_SIGNALS : receives
  SOURCE_DOCUMENTS ||--o{ TREND_SIGNALS : produces
  SOURCE_DOCUMENTS ||--o{ IDEA_EVIDENCE : supports
  CONTENT_IDEAS ||--o{ IDEA_EVIDENCE : has
  TREND_SIGNALS ||--o{ IDEA_EVIDENCE : explains
  CONTENT_IDEAS ||--o{ IDEA_SCORES : scored_as

  CREATOR_PROFILES ||--o{ IDEA_RECOMMENDATIONS : receives
  CONTENT_IDEAS ||--o{ IDEA_RECOMMENDATIONS : appears_in
  IDEA_SCORES ||--o{ IDEA_RECOMMENDATIONS : ranks

  CREATOR_PROFILES ||--o{ SAVED_IDEAS : saves
  CONTENT_IDEAS ||--o{ SAVED_IDEAS : saved_as
  CREATOR_PROFILES ||--o{ IDEA_STATUS_EVENTS : changes
  CONTENT_IDEAS ||--o{ IDEA_STATUS_EVENTS : transitions

  CREATOR_PROFILES ||--o{ CREATOR_FEEDBACK : submits
  CONTENT_IDEAS ||--o{ CREATOR_FEEDBACK : receives
  CREATOR_PROFILES ||--o{ AI_OPERATIONS : requests
  CONTENT_IDEAS ||--o{ IDEA_ASSETS : generates
  AI_OPERATIONS ||--o{ IDEA_ASSETS : produces

  SUBSCRIPTION_PLANS ||--o{ CREATOR_SUBSCRIPTIONS : defines
  CREATOR_PROFILES ||--o{ CREATOR_SUBSCRIPTIONS : holds
  CREATOR_PROFILES ||--o{ CREDIT_LEDGER : owns
  CREATOR_SUBSCRIPTIONS ||--o{ CREDIT_LEDGER : grants
  CREATOR_PROFILES ||--o{ PAYMENT_TRANSACTIONS : initiates
  CREATOR_SUBSCRIPTIONS ||--o{ PAYMENT_TRANSACTIONS : relates_to
  CREATOR_PROFILES ||--o{ AUDIT_LOGS : acts
```

## Cardinality notes

- A creator has one active profile in MVP, but profile history is represented through `profileVersion` rather than separate profile documents.
- A content idea is reusable across creators; creator-specific saves, recommendations, assets and feedback are separate records.
- A score is versioned because ranking logic and source coverage can change.
- A generated asset belongs to both an idea and a creator, and references the AI operation that produced it.
- A credit ledger is append-only and may contain multiple entries for one generation operation: reservation, consumption, release or refund.
- Social-platform account entities are intentionally absent from the MVP diagram because direct publishing is P1/V2.
