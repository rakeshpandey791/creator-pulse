# CP-01 — MVP Scope and Design Coverage Decision

**Decision ID:** CP-01  
**Status:** Approved for implementation planning  
**Recorded:** 2026-11-11  
**Decision owners:** Product Owner, Design Owner, Engineering Owner  
**Depends on:** SETUP-01  
**References:** `docs/product/PRD.md`, `docs/product/PRD_DECISIONS.md`, `docs/design/SCREEN_INVENTORY.md`, `projects/3503066722097683519`

## Decision

CreatorPulse MVP launches with the six PRD niches:

1. Fitness
2. Food
3. Finance
4. Education
5. Entertainment
6. Lifestyle

The earlier broad “all niches” wording is interpreted as future extensibility, not an MVP requirement. Engineering must seed, test and present only these six niches for the MVP. Adding a seventh niche requires a new product decision and a corresponding quality/evidence plan; it must not enter through an implementation default.

The MVP language set remains Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and Kannada. The MVP platform set remains Instagram, YouTube and Facebook short-form video. Direct publishing, connected social accounts and published-content analytics remain outside MVP scope.

## UI policy decisions

### UI chrome language

Navigation, buttons, field labels, system messages, loading states and error states use English UI chrome for the MVP. Creator-generated content, examples and user-entered content may use the selected creator language. This keeps interaction terminology consistent while preserving regional-language output quality.

### Recovery and failure behavior

- Authentication recovery screens (`/forgot-password` and `/reset-password`) must be safe to retry, must not reveal whether an account exists, and must provide a clear route back to login.
- Async generation failures must preserve the creator’s unsaved edits, show the failed operation state and offer retry without silently consuming another credit.
- Missing research/evidence must be shown as an explicit unavailable or limited-evidence state; the UI must not invent confidence or replace missing sources with empty decorative content.
- Session expiry must preserve the current route and recover after re-authentication where safe; destructive or billable actions require explicit re-confirmation.
- Global error, empty and loading states are part of every P0 route’s responsive behavior, not post-MVP polish.

## P0 responsive behavior ownership

Every row below has an explicit desktop and mobile behavior owner. “Design validation” means the behavior is specified here for implementation but still requires review against the corresponding Stitch artifact or a new screen before visual approval.

| ID      | Route/concept                                | Priority | Desktop behavior owner   | Mobile behavior owner    | Current coverage                      | Open validation / decision owner                                   |
| ------- | -------------------------------------------- | -------- | ------------------------ | ------------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| AUTH-01 | `/signup`                                    | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile auth draft                     | Design validation — Design Owner                                   |
| AUTH-02 | `/login`                                     | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile auth draft                     | Design validation — Design Owner                                   |
| AUTH-03 | `/forgot-password`                           | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Recovery policy only                  | Create responsive recovery state — Product Owner + Design Owner    |
| AUTH-04 | `/reset-password`                            | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Recovery policy only                  | Create responsive recovery state — Product Owner + Design Owner    |
| ONB-01  | `/onboarding/profile`                        | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile choose-context draft           | Validate full profile form — Design Owner                          |
| ONB-02  | `/onboarding/niches`                         | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile choose-context draft           | Validate six-niche selection — Product Owner + Design Owner        |
| ONB-03  | `/onboarding/platforms`                      | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile choose-context draft           | Validate selection/error states — Design Owner                     |
| ONB-04  | `/onboarding/languages`                      | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile choose-context draft           | Validate seven-language selection — Product Owner + Design Owner   |
| ONB-05  | `/onboarding/audience`                       | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Mobile choose-context draft           | Validate field density and keyboard behavior — Design Owner        |
| ONB-06  | `/onboarding/complete`                       | P0       | Design Owner + Web Owner | Design Owner + Web Owner | No dedicated Stitch state             | Create completion state — Design Owner                             |
| APP-01  | `/app`                                       | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop and mobile dashboard drafts   | Validate loading/empty/error variants — Design Owner               |
| APP-02  | `/app/search`                                | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop Explore draft                 | Create mobile search behavior — Design Owner                       |
| APP-03  | `/app/ideas/:id`                             | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop and mobile idea-detail drafts | Validate evidence states — Design Owner + Research Owner           |
| APP-04  | Idea-detail score panel/modal                | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Included in idea-detail draft         | Validate mobile panel/modal behavior — Design Owner                |
| APP-05  | `/app/ideas/:id/script`                      | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop and mobile script drafts      | Validate editing and recovery states — Design Owner                |
| APP-06  | Script workspace generation state            | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Policy only                           | Create progress/error variants — Design Owner + Engineering Owner  |
| APP-07  | `/app/library`                               | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop Library draft                 | Create mobile library behavior — Design Owner                      |
| APP-08  | Library status filter/state                  | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop Library draft                 | Validate filter and empty states — Design Owner                    |
| APP-09  | Idea/card/detail feedback panel              | P0       | Design Owner + Web Owner | Design Owner + Web Owner | No dedicated Stitch state             | Create optional feedback state — Product Owner + Design Owner      |
| APP-10  | `/app/usage`                                 | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop Library & Usage draft         | Validate mobile usage hierarchy — Design Owner                     |
| APP-11  | `/app/billing`                               | P0       | Design Owner + Web Owner | Design Owner + Web Owner | No dedicated Stitch state             | Create plan/entitlement states — Product Owner + Design Owner      |
| APP-12  | `/app/settings/profile`                      | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop Settings draft                | Create mobile settings behavior — Design Owner                     |
| APP-13  | Settings language/platform quick preferences | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Desktop Settings draft                | Validate quick-edit flow — Product Owner + Design Owner            |
| APP-14  | Cross-screen loading/empty/error states      | P0       | Design Owner + Web Owner | Design Owner + Web Owner | Policy only                           | Produce state matrix and review — Design Owner + Engineering Owner |

The owner assignments above are implementation owners, not approvals. Visual approval remains a design-review gate. Missing Stitch screens are tracked as design-validation work and do not silently change route scope or priority.

## Consequences

- Database/reference seeds and onboarding choices use exactly six niches and seven languages for MVP.
- API contracts and frontend route work may proceed against the listed P0 inventory, including explicit loading, empty, error and recovery states.
- Design work must close the open validation items before the affected route is marked visually approved.
- Any scope expansion or change to UI chrome/recovery policy requires a new decision record linked from the roadmap.
