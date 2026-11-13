# CreatorPulse Design System

> Canonical Stitch source: [DESIGN.md](/Users/rakeshpandey/creator-pulse/docs/design/DESIGN.md). This companion document is retained for product review; the Stitch-specific file supersedes any earlier exploratory token or typography choices.

## Stitch project

- Project: `CreatorPulse — MVP UI/UX`
- Project ID: `3503066722097683519`
- Design-system asset: `assets/0b304cabea324f9d96c88372654a3d94`

**Status:** Design specification draft  
**Design direction:** Warm, editorial creator intelligence—not a generic AI admin dashboard

## 1. Visual concept

CreatorPulse should feel like a calm creative studio with strong editorial signals: generous surfaces, confident typography, warm neutrals and focused moments of electric color for opportunity and action. The interface should make a creator want to explore, not feel like they are monitoring a data warehouse.

## 2. Color tokens

| Token        | Value     | Use                                            |
| ------------ | --------- | ---------------------------------------------- |
| Ink 950      | `#171717` | Primary text and high-contrast headings        |
| Ink 700      | `#4A4744` | Secondary text                                 |
| Ink 500      | `#77716B` | Metadata and helper text                       |
| Canvas       | `#F7F5F1` | Main application background                    |
| Surface      | `#FFFFFF` | Cards, panels and forms                        |
| Surface Warm | `#FFF9EE` | Research/evidence highlight                    |
| Saffron      | `#F59E0B` | Freshness, active focus and creator energy     |
| Coral        | `#E86A5B` | Primary action emphasis and creative accent    |
| Indigo       | `#4F46A5` | AI/generation and selected navigation          |
| Teal         | `#168A82` | Positive/validated opportunity signal          |
| Green        | `#238B5A` | Success and completed status                   |
| Red          | `#C2413B` | Errors, unsafe content and destructive actions |
| Border       | `#E7E1D8` | Dividers and control borders                   |

Use color with labels and icons; do not communicate score or status by color alone.

## 3. Typography

- Primary Latin UI: `Inter` or equivalent open-source sans-serif.
- Display/editorial headings: `Plus Jakarta Sans` or equivalent with rounded, humanist forms.
- Regional-language fallback: system fonts selected for reliable Devanagari, Gurmukhi, Telugu and Kannada rendering.
- Use sentence case, short headings and creator-native language in content previews.
- Recommended scale: 12, 14, 16, 18, 24, 32, 44px with 1.2–1.5 line-height depending on role.

## 4. Layout and spacing

- 4px base spacing unit.
- Desktop: 240px navigation rail, fluid content area, max content width 1440px.
- Mobile: bottom navigation or compact top bar; no persistent desktop rail.
- Feed cards use a 12-column desktop grid and a single-column mobile stack.
- Detail pages use a two-column desktop layout: idea/evidence left, score/action rail right; stack on mobile.
- Minimum touch target: 44px.

## 5. Navigation

Primary navigation:

- Today
- Explore
- Library
- Usage
- Settings

Persistent top-bar actions:

- Search
- Language/context selector
- Credit balance
- Profile menu

Avoid a separate “AI” section. AI generation belongs inside the idea workflow.

## 6. Core components

- **Idea card:** title, niche/language/platform metadata, opportunity label, one-sentence rationale, freshness/competition chips, save and dismiss actions.
- **Opportunity badge:** label plus compact score; never a naked number.
- **Evidence row:** source name, date, signal type, “what this means” summary and limitation link.
- **Score breakdown:** four horizontal meters with text explanations and confidence/coverage note.
- **Script workspace:** hook tabs, editable script canvas, CTA block, language/platform selector, credit estimate and primary generate/regenerate action.
- **Status pill:** saved, planned, scripted, published or dismissed with accessible text.
- **Credit meter:** balance, monthly reset date and operation cost before action.
- **Filter chips:** niche, platform, language, freshness and opportunity label.
- **Feedback drawer:** optional rating, reason chips and comment field.
- **Source disclosure:** compact but persistent “based on available signals” treatment.

## 7. Interaction patterns

- One primary action per screen; secondary actions are visually quieter.
- Use progressive disclosure for score detail and evidence rather than making every card dense.
- Keep save/dismiss available without opening detail.
- Generation is asynchronous: show progress, estimated cost and a recoverable retry path.
- Never silently change the selected language; show explicit fallback choices.
- Preserve edited script text when regenerating.
- Use confirmation only for destructive actions, credit-consuming actions or leaving unsaved edits.

## 8. Content and localization rules

- Use realistic Indian creator examples across all six niches.
- Show language names in their familiar English labels plus native script where useful.
- Do not use lorem ipsum or generic “AI-generated result” copy.
- Keep generated-language content natural and allow Hinglish code-switching.
- Translate interface labels through a localization layer; do not assume content language equals interface language.

## 9. Accessibility

- WCAG 2.2 AA target.
- Keyboard-visible focus and logical tab order.
- Semantic headings and landmark regions.
- Contrast-compliant text and controls.
- Screen-reader names for score meters, icons and status controls.
- Reduced-motion behavior for loading and transitions.
- Error messages adjacent to fields and announced to assistive technology.

## 10. States

Every data-driven screen must specify:

- Loading skeleton that preserves layout.
- Empty state with a useful next action.
- Partial-data state with source limitations.
- Retryable provider/API failure.
- Non-retryable validation or entitlement error.
- Success confirmation that does not interrupt the workflow.
