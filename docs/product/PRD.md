# CreatorPulse Product Requirements Document

**Status:** Draft for product approval  
**Phase:** 1 — Product requirements  
**Last updated:** 2026-11-10  
**Owner:** Product

## 1. Executive summary

CreatorPulse is an AI-powered content intelligence platform for Indian micro-creators with 10K–100K followers. It helps creators discover relevant video ideas, understand why an idea may be worth creating, and turn a selected idea into a ready-to-record 30–60 second script.

The MVP covers Instagram, YouTube and Facebook short-form video; six initial niches (fitness, food, finance, education, entertainment and lifestyle); and Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and Kannada. It combines personalized recommendations, search, trend/topic research, explainable opportunity scoring, evidence, hooks, scripts, calls to action, saving, status management and optional creator feedback.

The product will launch as freemium with a shared monthly credit system. Direct publishing to social platforms is deliberately planned after MVP because it requires platform-specific permissions, OAuth, API availability, review and operational support.

## 2. Product vision and objectives

### Vision

Help Indian creators consistently find relevant, engaging and personalized video ideas in natural preferred languages, understand the opportunity behind each idea, and convert ideas into action.

### Objectives

1. Reduce the time from “I need an idea” to “I know what to record next.”
2. Make recommendations useful for a creator’s niche, audience, language and platform.
3. Make AI outputs explainable, source-aware and appropriately uncertain.
4. Make regional-language creation feel native rather than translated.
5. Establish a repeatable daily workflow that supports retention.
6. Validate willingness to use and pay before expanding feature breadth.

### Product principles

- Solve creator problems before adding AI capabilities.
- Optimize for affordability and practical usefulness.
- Personalize recommendations and explain their reasoning.
- Treat language quality as a product requirement.
- Show sources, evidence and limitations.
- Prefer scalable simplicity over unnecessary system complexity.
- Do not promise virality or guaranteed performance.

## 3. Problem statement and opportunity

Micro-creators often need to publish consistently but face a fragmented workflow: finding topics, checking whether they are timely, judging competition, adapting an idea to their audience and language, and writing a usable script. Existing inspiration sources may be generic, language-limited, difficult to verify or disconnected from execution.

CreatorPulse’s opportunity is to combine discovery, evidence and execution in one creator-friendly workflow for India. The size of the opportunity, willingness to pay, retention potential and strongest initial niche-language combinations are hypotheses to validate through interviews, usability tests and a controlled launch; this PRD does not assert unverified market statistics.

## 4. Target personas and segments

### Primary persona: consistency-focused micro-creator

- 10K–100K followers
- Publishes short-form video on one or more supported platforms
- Has a defined or emerging niche
- Works alone or with a very small team
- Needs ideas quickly and cannot afford expensive research tools
- May think and create in a regional language, Hinglish or a mix

### Secondary persona: growth-oriented niche creator

- Tracks trends and competing creators
- Wants differentiated ideas rather than broad topics
- Values evidence, freshness and opportunity signals

### Secondary persona: early monetizing creator

- Wants a reliable publishing cadence
- Needs scripts, hooks and CTAs that fit a platform and audience
- Is price-sensitive but may pay for repeated time savings

### Initial segments

All six priority niches are in scope at launch: fitness, food, finance, education, entertainment and lifestyle. CreatorPulse should measure quality by niche rather than assume that one model or signal works equally well across all of them.

## 5. User pain points and use cases

### Pain points

- “I do not know what to post today.”
- Ideas are generic or copied from broad trend lists.
- It is hard to tell whether a topic is timely, saturated or still fresh.
- Research takes too long and sources are unclear.
- English-first tools do not sound natural in the creator’s language.
- Turning an idea into a strong hook and short script is a separate effort.
- Creators cannot easily learn whether recommendations improve over time.

### Core use cases

1. Set preferences and receive a daily set of relevant ideas.
2. Search a topic and discover related opportunities.
3. Inspect evidence, score dimensions, competition and freshness.
4. Generate a hook, CTA and 30–60 second script in a selected language.
5. Save an idea, change its status and return to it later.
6. Give optional feedback when an idea is especially useful or unsuitable.
7. Monitor monthly credits and choose a paid plan when limits become restrictive.

## 6. Goals and measurable success metrics

Metrics are proposed targets and require baseline validation during discovery and beta.

### Activation

- Percentage of new users who complete onboarding and view at least one personalized idea.
- Percentage who save, dismiss or open details for an idea in the first session.
- Time from signup to first saved idea.

### Core value

- Weekly active creators who view at least one recommendation or search result.
- Percentage of active creators who generate a hook or script.
- Percentage of saved ideas moved to planned or scripted.
- Self-reported usefulness of recommendations and generated scripts.

### Retention

- 7-day and 30-day return rates.
- Number of active creation sessions per creator per month.
- Repeat use of the idea-to-script workflow.

### Quality and trust

- Relevance and language-quality ratings by niche, language and platform.
- Source availability and source-link click-through rate.
- Rate of clearly incorrect, stale, unsafe or unsupported claims.
- Percentage of score explanations that identify evidence and uncertainty.

### Commercial

- Free-to-paid conversion.
- Paid retention and monthly recurring revenue.
- Average credits consumed and AI/research cost per active creator.
- Support contacts related to limits, billing or inaccurate content.

Launch targets should be set after qualitative research and a baseline beta; the team must not backfill targets with invented market benchmarks.

## 7. Scope prioritization

### P0 — Mandatory for MVP

- Account creation and creator onboarding
- Niche, audience, platform and language preferences
- Personalized idea discovery and daily recommendation feed
- Manual topic search
- Regional-language idea generation for the seven launch languages
- Basic trend and topic research
- Explainable opportunity scoring
- Competition and freshness indicators, labeled as estimates where appropriate
- Idea details with supporting evidence and source links
- AI-generated hooks, 30–60 second scripts and CTAs
- Saving/bookmarking and basic idea statuses: saved, planned, scripted, published, dismissed
- Optional creator feedback
- Shared monthly credit system, usage visibility and limit handling
- Basic subscription and entitlement management

### P1 — Important after MVP

- Trend alerts and notifications
- Behavior-based personalization beyond onboarding preferences
- More advanced platform-specific optimization
- Script variations by tone, duration and format
- Creator performance feedback loops
- Content calendar and publishing planner
- Advanced competitor and opportunity analysis
- More regional languages
- Direct publishing to Instagram, YouTube and Facebook where supported by approved APIs and permissions

### P2 — Future enhancement

- Automated analysis of a creator’s published content
- Competitor profile tracking
- Cross-platform performance benchmarking
- Voice-based idea and script workflows
- Thumbnail and cover suggestions
- Repurposing one idea into multiple platform formats
- Predictive performance forecasting
- Creator collaboration features
- Brand sponsorship and campaign matching

### Out of scope

- Guaranteed virality or performance claims
- Fully autonomous content creation
- Automated video production or editing in the original MVP; the separately planned, bounded script-to-video pilot is specified in `VIDEO_PILOT.md`.
- Scraping private, restricted or unauthorized platform data
- Enterprise analytics and agency management
- Comprehensive influencer marketplace functionality
- Replacing professional financial, medical or legal advice

## 8. Functional requirements

### FR-1: Account and onboarding

The product shall allow a creator to create an account, select a niche, describe their audience, choose platforms, choose one or more supported languages, and optionally provide creator context such as experience level and content style. The system shall support editing these preferences later.

### FR-2: Personalized discovery

The product shall generate a ranked set of ideas using onboarding preferences, selected platform, language, niche, audience and available research signals. The cold-start experience shall work without historical behavior data.

### FR-3: Daily feed

The product shall present a daily recommended feed with idea cards showing title, language, niche, platform, opportunity label, key score dimensions and credit implications. The feed shall distinguish new recommendations from previously seen ideas.

### FR-4: Search

Creators shall be able to search manually by topic or phrase and filter or refine by niche, language, platform and freshness/relevance where data supports it.

### FR-5: Research and evidence

Each researched idea shall show available evidence, source links, source dates where available, signal type and a clear statement when a score is inferred, incomplete or stale. The product shall not imply universal platform coverage.

### FR-6: Scoring

The system shall provide an overall opportunity score and dimensions for relevance, trend momentum, freshness and competition. It shall also show a plain-language label such as “Strong opportunity” or “Emerging opportunity.” Score explanations shall identify the main drivers and uncertainty.

### FR-7: Generation

From an idea, the creator shall be able to generate a hook, CTA and 30–60 second script in a selected supported language and for a selected platform. Outputs shall be editable and regenerated with transparent credit consumption.

### FR-8: Library and status

Creators shall save, bookmark, dismiss and change idea status. They shall be able to retrieve saved items and distinguish ideas that are planned, scripted or published. In the MVP, “published” is a manual status and does not imply direct publishing through CreatorPulse.

### FR-9: Feedback

Creators may voluntarily submit a rating and structured or written feedback. Feedback shall support reasons such as generic, already covered, wrong language, wrong audience, not timely or otherwise unsuitable. Feedback shall be used for product evaluation and, when sufficient data exists, personalization.

### FR-10: Credits and subscriptions

The product shall show a monthly credit balance, operation cost before generation/research, consumption confirmation, renewal date and what happens at the limit. Plans shall be configurable without a client release.

### FR-11: Safety and trust

The system shall label AI-generated content, avoid unsupported factual claims, provide safety reminders for sensitive topics and make it easy to report an inaccurate or unsafe result.

### FR-12: Direct publishing (P1)

After MVP, the product may support authorized publishing or scheduling to supported platforms. It shall require explicit OAuth consent, show the destination account and privacy settings, confirm the final content, report platform-specific failures and never retain credentials directly. Support shall depend on each platform’s approved APIs, permissions and policy review.

## 9. Non-functional requirements

- **Language quality:** Native-speaker evaluation is required for all seven launch languages. Outputs must preserve natural phrasing, code-switching conventions where appropriate and culturally suitable CTAs.
- **Trust and provenance:** Research outputs must retain source metadata and timestamps. The system must distinguish observed signals from generated interpretation.
- **Availability:** Core feed, search and saved-library actions should be resilient to temporary research-provider or model-provider failures.
- **Performance:** Common feed, search and library interactions should feel responsive; long-running research and generation must expose progress and recoverable failure states.
- **Privacy:** Collect the minimum personal and creator data required, provide account deletion/export pathways and protect tokens and payment data through appropriate providers.
- **Security:** Use secure authentication, authorization, secret management, rate limits, audit logging for sensitive actions and least-privilege third-party scopes.
- **Cost control:** Enforce per-user, per-operation and system-wide budgets for model and research calls.
- **Scalability:** Separate ingestion, scoring, generation and product APIs sufficiently to scale independently without prematurely introducing unnecessary services.
- **Accessibility:** Support readable typography, keyboard navigation where applicable, clear error states and accessible controls.
- **Observability:** Track provider failures, stale data, generation quality signals, credit consumption and language/niche-specific errors.

## 10. Detailed MVP feature specifications

### 10.1 Onboarding and profile

**User value:** Establish enough context to produce useful first-session recommendations.

**Required inputs:** niche, target audience, one or more platforms, preferred language(s), optional content style and creator goals.

**Acceptance conditions:** A completed profile produces a usable feed without requiring prior content history; preferences can be changed; unsupported combinations are explained rather than silently ignored.

### 10.2 Daily recommendation feed

**User value:** Provide a repeatable “what should I make today?” workflow.

**Requirements:** ranked cards, concise rationale, freshness indicator, opportunity label, language/platform visibility, save/dismiss/details actions and credit-aware generation actions.

**Acceptance conditions:** The feed is personalized from profile data, avoids obvious duplicates within a session and shows an empty/fallback state when research is unavailable.

### 10.3 Search and research

**User value:** Let creators pursue their own topics while still receiving intelligence.

**Requirements:** topic search, filters, related ideas, evidence panel, source link, date/recency display and uncertainty messaging.

**Acceptance conditions:** A search can return useful results even when no authoritative trend signal exists; unsupported or ambiguous queries produce a useful refinement prompt.

### 10.4 Explainable scoring

**Requirements:** overall score, four dimensions, summary label, explanation, source/signal references, confidence or coverage note and freshness timestamp.

**Acceptance conditions:** A user can answer “why this idea?” and “what might be missing?” without reading internal model terminology.

### 10.5 Idea-to-script generation

**Requirements:** hook options, one editable 30–60 second script, CTA suggestions, selected language/platform, regeneration, copy/export action and credit estimate.

**Acceptance conditions:** The output stays within the requested duration range under a documented word-rate assumption, is clearly AI-generated, avoids unsupported claims and can be edited before use.

### 10.6 Library and status management

**Requirements:** save, bookmark, search/filter saved ideas, status changes and delete/dismiss actions.

**Acceptance conditions:** A creator can return to a saved idea and see its associated evidence, generated assets and current status.

### 10.7 Feedback

**Requirements:** optional rating/reason, optional free text, no forced interruption, privacy-safe storage and admin analysis by language/niche/platform.

**Acceptance conditions:** Feedback submission is never required to continue; users receive confirmation; feedback does not expose internal prompts or other creators’ data.

### 10.8 Freemium credits and subscriptions

**Requirements:** free plan, paid plan(s), monthly credits, per-operation costs, balance display, warnings, payment-provider integration, entitlement checks and cancellation/renewal handling.

**Acceptance conditions:** The creator sees the cost before an expensive operation, cannot accidentally exceed a limit, and receives a clear recovery path after payment or provider failure.

## 11. User journeys and workflows

### First-session journey

Signup → select niche/audience/platform/language → receive daily ideas → open an idea → inspect evidence and score → save or dismiss → generate hook/script if desired → optionally provide feedback.

### Search journey

Enter topic → choose language/platform → view researched results → inspect evidence and freshness → save an idea → generate script → move status to scripted.

### Repeat creator journey

Open daily feed → review new ideas → compare opportunity labels → save or dismiss → generate a script → mark planned/scripted → return later to update status.

### Subscription journey

View remaining credits → see operation cost → reach or approach limit → compare plan value → purchase/upgrade → receive updated entitlement → continue generation.

### Future publishing journey (P1)

Connect a platform account → review scopes and destination → choose approved content asset → confirm caption/privacy/schedule → publish or schedule → receive success or actionable platform error.

## 12. User stories and acceptance criteria

### US-1: Personalized start

As a creator, I want to set my niche, audience, language and platforms so that my first recommendations are relevant.

**Acceptance criteria:** preferences are saved; required fields are validated; changing preferences changes subsequent recommendations; the system handles multiple languages and platforms.

### US-2: Daily ideas

As a creator, I want a daily feed so that I can choose what to create without starting from a blank page.

**Acceptance criteria:** new ideas are visible; each has a rationale and opportunity label; duplicates are minimized; unavailable research produces a transparent fallback.

### US-3: Investigate an idea

As a creator, I want evidence and score explanations so that I can decide whether an idea is worth my time.

**Acceptance criteria:** the four dimensions and overall score are shown; sources and timestamps are shown when available; estimates and limitations are labeled.

### US-4: Create a script

As a creator, I want hooks, a short script and a CTA in my preferred language so that I can move from research to recording.

**Acceptance criteria:** selected language and platform are honored; output is editable; duration guidance is shown; credit cost is visible; unsafe or unsupported claims are flagged.

### US-5: Save and manage

As a creator, I want to save ideas and track their status so that good opportunities are not lost.

**Acceptance criteria:** save and status actions persist; saved ideas remain accessible; generated assets stay associated with the idea.

### US-6: Give feedback

As a creator, I want to report an issue when I choose so that recommendations can improve.

**Acceptance criteria:** feedback is optional; structured reasons and free text are supported; submission confirms success; feedback is available for quality analysis.

### US-7: Control spend

As a creator, I want to understand my credits before using research or generation so that I can control costs.

**Acceptance criteria:** balances, operation costs, renewal and limit behavior are visible; failed operations do not consume credits or are automatically reconciled.

## 13. Edge cases and error scenarios

- No trend data is available for a niche, language, platform or query.
- Source links are unavailable, stale, removed or contradictory.
- A topic is sensitive, regulated or potentially harmful, especially in finance or health-related fitness content.
- Language detection conflicts with the selected language.
- The model returns mixed languages, unnatural phrasing or an unsupported factual claim.
- API rate limits, permission changes or provider outages occur.
- A creator has exhausted credits during a multi-step workflow.
- Payment succeeds but entitlement update is delayed.
- Duplicate ideas appear across daily feed and search.
- A creator changes preferences after saving or generating content.
- The user deletes an account with saved ideas and feedback.
- Future publishing is attempted with expired OAuth consent, unsupported media, private account restrictions or platform policy rejection.

The product must provide recovery guidance, preserve saved work where possible, avoid charging for failed operations and log provider/error context without exposing secrets.

## 14. Monetization and subscription assumptions

The working model is freemium with a shared monthly credit balance. The free plan must demonstrate the core value loop; paid plans can increase credits and unlock deeper research or higher generation limits. Pricing, credit quantities and operation costs are hypotheses requiring willingness-to-pay testing and cost modeling.

Assumptions:

- Research and generation have different marginal costs.
- A transparent credit system is easier to operate than unlimited usage.
- Creators prefer predictable monthly limits and visible costs.
- Payment methods must support Indian users and applicable tax/compliance requirements.
- Abuse controls are necessary for free-tier model and research calls.

## 15. Third-party integrations and dependencies

- Social-platform APIs and public signals for Instagram, YouTube and Facebook, subject to access, terms and rate limits
- Search, trend and/or web data providers
- Large-language-model and language-quality providers
- Authentication and account-management provider
- Payment and subscription provider supporting relevant Indian payment methods and tax requirements
- Analytics, logging, monitoring and feature-flagging services
- Optional translation/language evaluation services, subject to quality validation

Direct publishing is dependent on approved platform publishing endpoints, OAuth scopes, media specifications, account eligibility, review processes and policy compliance. No MVP commitment should be made until each platform’s supported publishing path is verified.

## 16. Risks, assumptions and open questions

### Risks

- Quality may vary materially among seven languages and six niches.
- Trend signals may be incomplete or biased toward English and larger creators.
- Platform data access may change.
- Generated scripts may contain inaccurate or regulated claims.
- AI and data-provider costs may exceed affordable subscription economics.
- Too many onboarding choices may delay activation.
- A broad launch may dilute learning and make quality issues harder to diagnose.

### Assumptions to validate

- Creators want one integrated discovery-to-script workflow.
- Daily recommendations create a repeat habit.
- Evidence increases trust and action.
- The seven chosen languages represent meaningful early demand.
- Creators will voluntarily provide feedback.
- Credits are understandable and acceptable.

### Open questions

- What exact free and paid credit quantities and prices maximize learning and sustainable margins?
- Which sources can be licensed or accessed reliably for each platform and niche?
- What minimum native-speaker quality threshold is acceptable per language?
- How should score dimensions be calibrated when signals are sparse?
- What data retention, consent and deletion policies apply to creator profiles and connected accounts?
- Which platform publishing APIs can support direct publishing or scheduling, and for which media types?
- Should finance and fitness content require additional review or disclaimers?

## 17. MVP launch and validation criteria

The MVP is launch-ready when:

1. Onboarding, feed, search, research, scoring, evidence, generation, library, feedback, credits and subscriptions work end to end.
2. All seven languages have passed native-speaker quality review for representative hooks, scripts and CTAs.
3. All six niches have representative test coverage and known limitations.
4. Source links, timestamps and uncertainty labels are present wherever research is displayed.
5. Credit charging, failed-operation reconciliation, payment and entitlement flows have been tested.
6. Safety review covers finance, fitness and other potentially sensitive claims.
7. Monitoring can detect provider failure, stale signals, cost spikes and quality regressions.
8. A beta cohort has completed usability testing and demonstrated the core idea-to-script workflow.
9. The team has defined quantitative go/no-go thresholds after baseline testing for activation, repeat use, quality, cost and support burden.
10. Direct publishing is excluded from the MVP release unless separately approved after platform feasibility validation.

### Validation plan

- Conduct creator interviews across niches, languages and creator maturity levels.
- Test onboarding and first-session recommendation relevance.
- Run native-speaker evaluations for each supported language.
- Compare daily-feed-led and search-led workflows.
- Measure whether evidence changes save, script and return behavior.
- Test credit comprehension and willingness to pay.
- Run a limited beta with quality and cost monitoring.

## 18. Release roadmap

### V1.1

- Improve ranking from voluntary feedback and behavior signals.
- Add trend alerts and notifications.
- Add platform-specific script variations.
- Add richer script controls for tone and duration.
- Improve source confidence and freshness explanations.
- Add content calendar/planning support.

### V1.2

- Validate and add further regional languages.
- Add creator performance feedback loops where data access and consent permit.
- Add advanced competitor and opportunity analysis.
- Begin direct publishing feasibility pilots for supported platforms.
- Add stronger saved-library workflows and batch actions.

### V2

- Production-grade direct publishing and scheduling where platform policies permit.
- Published-content analysis and cross-platform benchmarking.
- Voice workflows, repurposing and visual asset suggestions.
- Predictive opportunity modeling, subject to evidence and trust validation.
- Collaboration, brand and creator ecosystem capabilities if validated.

## 19. Glossary

- **Opportunity score:** A directional estimate combining relevance, trend momentum, freshness and competition.
- **Freshness:** An estimate of how recently or unusually a topic has appeared relative to available signals.
- **Competition:** An estimate of saturation or creator coverage, not a guarantee of difficulty.
- **Credit:** A unit consumed by a defined research or generation operation.
- **Native-language quality:** Natural, culturally appropriate language reviewed for the intended creator audience.
