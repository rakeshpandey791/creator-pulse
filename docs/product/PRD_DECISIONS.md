# CreatorPulse Product Decisions

**Status:** Draft for product approval  
**Last updated:** 2026-11-10

This document records decisions, rejected alternatives and unresolved questions for Phase 1. It distinguishes user-provided decisions from product recommendations and hypotheses requiring validation.

## 1. Decision log

| ID    | Decision                                                                                  | Rationale                                                                                                    | Status |
| ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| D-001 | The core workflow is idea discovery → opportunity understanding → ready-to-record script. | Covers the complete creator problem while keeping discovery as the central product value.                    | Agreed |
| D-002 | MVP supports fitness, food, finance, education, entertainment and lifestyle.              | User wants broad niche coverage at launch. Quality must be measured separately by niche.                     | Agreed |
| D-003 | MVP languages are Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and Kannada.       | Regional language quality is a strategic differentiator.                                                     | Agreed |
| D-004 | MVP platforms are Instagram, YouTube and Facebook short-form video.                       | These are the selected launch platforms; the product should avoid separate duplicated experiences.           | Agreed |
| D-005 | Research combines official APIs where available with public signals.                      | Balances reliability and coverage while acknowledging platform limitations.                                  | Agreed |
| D-006 | Evidence must include sources and limitations.                                            | Supports trust and prevents inferred scores from being presented as facts.                                   | Agreed |
| D-007 | Scoring uses dimensions plus a simple summary label.                                      | Gives transparency without forcing creators to interpret a technical score alone.                            | Agreed |
| D-008 | Monetization is freemium.                                                                 | Allows creators to experience the value before paying and supports affordability.                            | Agreed |
| D-009 | Usage is managed through shared monthly credits.                                          | Creates predictable cost control across research and generation.                                             | Agreed |
| D-010 | Feedback is optional and detailed when voluntarily provided.                              | Captures high-quality learning signals without interrupting the core workflow.                               | Agreed |
| D-011 | Direct publishing is P1, not MVP.                                                         | It requires OAuth, platform permissions, API eligibility, review, media constraints and operational support. | Agreed |

## 2. MVP prioritization decisions

### P0

Onboarding; preferences; personalized feed; daily recommendations; manual search; regional-language generation; basic research; explainable scoring; competition/freshness indicators; evidence; hooks; scripts; CTAs; saving; status management; optional feedback; credits; subscriptions and usage limits.

### P1

Advanced personalization; alerts; platform-specific optimization; script variations; performance feedback; content calendar; advanced competitor analysis; additional languages; direct publishing.

### P2

Published-content analysis; competitor tracking; cross-platform benchmarking; voice workflows; visual assets; repurposing; predictive forecasting; collaboration; sponsorship matching.

### Out of scope

Guaranteed virality; autonomous content creation; video editing; unauthorized data access; enterprise/agency analytics; full influencer marketplace; professional advice replacement.

## 3. Rejected alternatives

### R-001: Idea discovery only for MVP

Rejected because the product vision includes converting ideas into actionable scripts. Script generation is retained as P0, but remains downstream of discovery rather than becoming a separate writing product.

### R-002: English-first or Hindi-only launch

Rejected because natural regional-language support is a stated product differentiator and user requirement. The tradeoff is increased quality assurance and evaluation cost.

### R-003: Single-niche launch

Rejected by the product direction. All six priority niches are included, with an explicit risk that breadth may reduce learning clarity and output quality.

### R-004: Direct publishing in MVP

Rejected for MVP because platform permissions, OAuth, policy review, media specifications, account eligibility and failure handling are materially more complex than content intelligence. It is planned for P1/V2 subject to feasibility.

### R-005: Numeric score without explanation

Rejected because a score without evidence can create false precision and reduce trust.

### R-006: Fully automated or guaranteed trend intelligence

Rejected because data coverage, source quality and platform access vary. The product must distinguish observed signals from inference.

### R-007: Required feedback after every recommendation

Rejected because it would add friction to the primary workflow. Feedback is voluntary, with structured reasons available when submitted.

### R-008: Unlimited free usage

Rejected because research and generation have variable provider costs and unlimited access creates abuse and margin risk. Free access remains meaningful but bounded.

## 4. Assumptions versus validated facts

### User-provided requirements

- Target audience is Indian micro-creators with 10K–100K followers.
- Initial channels are Instagram, YouTube and Facebook short-form video.
- Initial languages are Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and Kannada.
- Initial niches are fitness, food, finance, education, entertainment and lifestyle.
- Freemium and shared monthly credits are desired.
- Research should combine official APIs and public signals.

### Product hypotheses requiring validation

- A daily feed will create a repeat habit.
- Evidence and explainable scores will increase trust and action.
- Creators will pay for higher credit limits.
- The seven-language scope can meet a consistent native-quality threshold at launch.
- The broad six-niche launch will outperform a narrower initial focus.
- Creators will prefer an integrated discovery-to-script workflow.
- Direct publishing will materially increase retention enough to justify its integration cost.

### Not asserted

No market size, adoption, competitor, pricing or creator-behavior statistics are treated as validated in this PRD.

## 5. Unresolved questions

1. What exact monthly credit amounts and prices are sustainable and understandable?
2. What is the minimum acceptable language-quality score for each supported language?
3. Which sources are licensed, permitted and reliable for each platform and niche?
4. How should scores behave when evidence is sparse or conflicting?
5. What disclaimers, review rules or restrictions are needed for finance and health-related content?
6. What profile, content and connected-account data may be retained, for how long and for what purposes?
7. Which direct-publishing endpoints are available for each target platform and account type?
8. Should publishing support begin with export/share workflows before API-based publishing?
9. What beta cohort size and success thresholds are sufficient for a public launch decision?

## 6. Decision gates

### Before MVP beta

- Confirm API/data-provider feasibility and policy compliance.
- Approve safety and source-provenance rules.
- Complete native-speaker language evaluation.
- Establish cost model and provisional credit economics.

### Before public MVP launch

- Review beta activation, repeat use, quality, cost and support data.
- Confirm that all launch languages and niches meet minimum quality thresholds.
- Confirm that free-to-paid assumptions are testable without overcommitting pricing.

### Before direct publishing

- Verify approved APIs and permissions for each platform.
- Define OAuth consent, token security, account disconnect and revocation behavior.
- Test media, captions, privacy, scheduling and platform failure states.
- Confirm compliance, user confirmation and audit requirements.

## 7. Change history

- 2026-11-13: Approved planning a separate free-first script-to-video pilot: 30–60-second vertical explainers, template diagrams, creator-recorded/uploaded voice, editable captions and MP4 download. Tools must not require paid generation/caption APIs; self-hosted compute still has costs. Remotion eligibility is a prerequisite. AI narration, cinematic generation, direct publishing and paid scale-up remain outside this pilot. See `VIDEO_PILOT.md` and VID-01–VID-07. Product direction approval does not mark design, implementation, review or QA complete.

- 2026-11-10: Initial decision record created from product discovery discussion.
- 2026-11-10: Direct publishing moved from out of scope to P1/V2 candidate at user request; retained outside MVP pending platform feasibility.
