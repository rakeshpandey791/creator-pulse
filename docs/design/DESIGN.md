# Design System: CreatorPulse

**Status:** Frozen for implementation planning — rural-first new-script pipeline

Generation waiting states use the existing white workspace and warm Saffron palette. Show three gently pulsing bars, the actual server phase, and elapsed seconds; respect reduced-motion preferences. Do not imply progress after failure or show a retry action during an active operation. Status checks are sequential, slowing from three to six seconds, and stop on terminal states. Errors explain that the writing service failed without blaming the creator’s connection.

## 1. Visual Theme & Atmosphere

CreatorPulse is a warm, editorial creator studio: calm enough for daily use, expressive enough to feel made for people who publish. The interface should feel like an intelligent notebook crossed with a well-curated magazine—not a generic AI dashboard, analytics cockpit, or neon productivity app.

Atmosphere: Daily App Balanced density (5/10), Offset Asymmetric variance (6/10), Fluid CSS motion (5/10). Use generous negative space, strong editorial headlines, purposeful source notes, and one clear action per view. Let idea cards breathe; let score explanations feel like annotations from a thoughtful editor.

The product is light-mode first. Use subtle paper-like warmth in the canvas and crisp white surfaces for active work. The only saturated brand accent is Saffron; semantic states use restrained text, icons and labels rather than a rainbow of status colors.

## 2. Color Palette & Roles

- **Paper Canvas** (`#F7F5F0`) — primary app background; warm but nearly neutral.
- **Pure Surface** (`#FFFFFF`) — active cards, forms and editor surfaces.
- **Charcoal Ink** (`#20201E`) — primary text and high-contrast headings; never pure black.
- **Graphite Muted** (`#6F6C66`) — descriptions, metadata and secondary labels.
- **Whisper Border** (`#E5E1D8`) — structural dividers and low-contrast control borders.
- **Saffron Signal** (`#C97822`) — the single brand accent for primary actions, active navigation, focus rings and opportunity emphasis.
- **Success Ink** (`#2F6B4F`) — confirmed/success messaging with icon and text.
- **Warning Ink** (`#8A5A20`) — uncertainty or stale-signal messaging with icon and text.
- **Danger Ink** (`#9A4138`) — errors and unsafe-content messaging with icon and text.

Do not use gradients, neon glow, purple AI accents, or multiple competing brand accents. State colors must never be the sole carrier of meaning.

## 3. Typography Rules

- **Display/headlines:** Geist — track-tight, controlled, confident; use weight and spacing rather than oversized scale.
- **Body:** Geist — relaxed leading, 65ch maximum for explanations, clear rendering across Latin and Indian scripts.
- **Numerical/meta:** Geist Mono — score values, credit counts, timestamps and compact evidence metadata.
- **Regional scripts:** use reliable system fallbacks for Devanagari, Gurmukhi, Telugu and Kannada; preserve native glyph readability over decorative styling.
- **Scale:** 12, 14, 16, 18, 24, 32, 44px; use `clamp()` for display sizes.
- **Banned:** Inter, generic serif fonts, all-caps marketing slogans, oversized gradient text and fake metric precision.

## 4. Component Stylings

### Buttons

Primary buttons are flat Saffron fills with Charcoal Ink or white text as contrast requires, 10px radius, 44px minimum height and tactile `transform: translateY(-1px)` active feedback. Secondary buttons use white surfaces and Whisper Border. No outer glow.

### Idea cards

Use cards only to communicate hierarchy. The primary card has a generous 20px radius, thin border and almost imperceptible warm shadow. Cards use an editorial left rail for the opportunity label, a strong title, one-sentence rationale and compact context chips. Avoid three equal cards in a row; use an asymmetric featured card followed by a staggered list.

### Opportunity score

Show a simple label first—“Strong opportunity”, “Emerging opportunity” or “Limited signal”—then the number and four dimensions. Use a single Saffron meter with text explanations. Never show a naked score without evidence or coverage context.

### Inputs and filters

Labels sit above controls. Use 12px radius, 1px border and a visible Saffron focus ring. Filters are compact chips on desktop and a bottom sheet on mobile. No floating labels.

### Loading

Use skeletons that match final geometry with a quiet shimmer. Never use a generic circular spinner as the only feedback for feed, research or generation.

### Empty and error states

Use a composed editorial empty state: a short headline, one useful explanation, one next action and a small line illustration or typographic mark. Errors are inline and specific: explain what failed, whether retrying is safe, and what the creator can do next.

### Script workspace

The script editor is the most focused surface: wide white canvas, hook tabs across the top, script text with generous line-height, CTA block beneath, and a persistent context rail for language, platform, duration and credit cost. Preserve edits during regeneration.

### Tomorrow-script journey

The primary creator promise is preparing the next post. The sidebar entry reads “Create script” with a fixed-size plus icon and single-line label, centered together with an 8px gap and balanced horizontal padding. Keep the tomorrow-specific explanation inside the creation journey, where it has enough room. The sidebar keeps the existing Saffron fill and rounded corners.

Use an asymmetric two-path planner:

- **Recommended idea** is the dominant path and carries the creator from the featured Today recommendation into a short confirmation step.
- **My own topic** is the secondary path and opens a compact brief with one topic field plus optional angle, audience, language, platform and duration controls.

Before any credit-consuming action, show one calm confirmation panel containing the idea/brief, audience, language, platform, duration, credit cost and exactly what will be produced: three hooks, one spoken script and one CTA. Use one primary action: “Create tomorrow’s draft.”

The script workspace uses a visible three-step rhythm: **1 Choose your hook → 2 Make it sound like you → 3 Ready for tomorrow.** The context rail remains persistent. Generation progress is written as meaningful phases—“Reviewing your audience,” “Writing your script,” “Checking language”—with a skeletal preview matching the final layout. Completion uses a clear status transition and primary action: “Mark ready for tomorrow.”

Copy must be specific to the creator’s niche, audience, platform and selected language. Do not use generic AI language such as “unlock,” “elevate,” “content magic,” or “your AI assistant.” Explain uncertainty and safety review inline, without interrupting the editing flow.

### Local pulse and grounded generation

The product may use a creator’s local context, but it must never imply that the app knows an exact location without consent. The preferred context setup is an explicit, editable choice during onboarding or Settings:

- **Country** is required for regional relevance.
- **State/region and city** are optional and should be stored at coarse granularity only.
- **Use my approximate location** is an optional action, never an automatic browser permission request. If declined or unavailable, fall back to the manually selected country/region or a clearly labelled national signal.
- Show the active context as “Trends for Pune, Maharashtra” or “Trends for India” with a visible Change link. Never display coordinates, IP-derived location or hidden location inference.

The Today screen introduces a single **Local pulse** block above recommendations. It contains the location, “updated” time, source count and a short plain-language explanation of why an idea is relevant locally. Every trend idea shows a compact source disclosure and freshness state. If local evidence is weak, say “Not enough local evidence yet” and offer broader regional signals instead of inventing certainty.

Gemini is used in two grounded stages:

1. **Trend interpretation:** permitted fresh source signals are collected first, then Gemini ranks and explains candidate ideas using only the bounded source bundle. The UI labels the result “Suggested from available signals,” shows source links/date, and distinguishes observed facts from Gemini’s interpretation.
2. **Script expansion:** after the creator selects an idea and enters a short brief—“what I want to say”—Gemini receives the selected idea, source evidence, creator audience/style, language, platform, duration and brief. It returns three hooks, one complete spoken script and a CTA. The UI must never present unsupported trend claims as facts.

The design must show these stages separately. A single vague “AI is thinking” state is not allowed. Use “Finding local signals,” “Choosing an angle,” “Writing your script” and “Checking language.”

The creator brief is intentionally small: one required text area labelled “What do you want to say?” with optional angle chips. Do not make creators write a full prompt. The generated script should be organized as hook, spoken body, optional visual cue, CTA and review notes, with the selected duration visible.

### Rural-first script pipeline

The underlying pipeline may collect signals, rank opportunities, ground a response and run safety checks, but the creator should experience it as a short, familiar sequence:

1. **Choose an idea.** Show one recommended idea first, with a plain-language reason such as “People near you are talking about this.” Let the creator choose “Use this idea” or “I have my own topic.”
2. **Say what you want to tell people.** Ask one question: “What do you want to say?” Accept a short typed note and keep an optional microphone affordance for a future voice-to-text path. Do not expose a prompt-writing task.
3. **Confirm the format.** Pre-fill language, platform and duration from onboarding. Show only the most important choice, with large options such as “Short — 30 sec”, “Normal — 60 sec” and “Long — 90 sec”. Put advanced controls behind “Change”.
4. **Create the script.** Explain the output before starting: “We’ll make 3 opening lines, your full script and what to say at the end.” Show “Finding the angle”, “Writing your words” and “Checking the script”.
5. **Listen, edit and save.** Present the script in short sections, with a clear read-aloud-friendly layout. The primary action is “Save for tomorrow”; secondary actions are “Try another opening” and “Edit”.

The first screen should never ask the creator to understand trend research, evidence retrieval, model selection or prompt structure. Those are pipeline concerns. The creator sees the current idea, their own message, a sensible format and the finished script. Every state has a direct next action, and every error explains what the creator can do next in plain language.

For creators with limited bandwidth or lower comfort with long forms, preserve the last successfully loaded idea locally, load text before decorative media, avoid blocking the flow on an unavailable local source, and provide a single retry action. Language labels should use the creator’s selected language first, with English only as a secondary label where useful. The experience must not assume that a creator is comfortable reading long English explanations or typing a polished brief.

## 5. Layout Principles

### Free-first video pilot

Extend the current script workspace with three stages: **Add your voice → Preview & edit → Download**. Create desktop and mobile review screens in the existing CreatorPulse Stitch project; these remain design drafts until product review. Follow `../product/VIDEO_PILOT.md` and VID-01, not a new visual identity.

Use creator-recorded/uploaded narration only in the pilot. Stage one pairs a readable script with recording, listen/re-record and upload controls. Explain microphone denial and offer upload; no automatic permission request. State that recording stays local until confirmed. Reject durations outside 30–60 seconds with a helpful next action.

Stage two pairs a vertical 9:16 video preview with editable phrase captions and scene labels, using clear diagrams such as phone → focus timer → notebook. Keep large Hindi captions inside safe margins and use native-script fonts. Desktop uses an asymmetric preview/editor grid; mobile stacks preview above caption/scene tabs. No professional timeline, paid voice selector or internal AI terminology. Show format and export allowance before Export video.

Stage three distinguishes active rendering, success and failure. Active states show actual phases and measured progress when available; illustrative Stitch progress values are not implementation promises. Allow reopening via Library, prohibit duplicate export/retry while active, and keep errors actionable without losing edits or consuming a successful-export allowance. Success has one Download video action, format details and visible seven-day availability. Re-download uses the existing file. Mobile sticky actions must not cover captions or content.

Retain Paper Canvas, white surfaces, Saffron accent, Geist/Geist Mono, 20px panels, 10px buttons and 44px targets. No stock-photo hero, cinematic AI controls, gradients, neon or oversized headings. State specimens in design screens are references, not simultaneously visible production states.

- Use CSS Grid and a max-width of 1400px; avoid percentage hacks and uncontrolled full-width content.
- Desktop uses a compact left navigation rail and an asymmetric content grid.
- The Today screen gives the featured recommendation the visual majority; supporting ideas use a staggered two-column rhythm.
- Idea detail uses a wide evidence/content column and a narrower score/action column; collapse to one column below 768px.
- Mobile below 768px is always a single-column layout with no horizontal scroll.
- Minimum interactive target is 44px.
- No overlapping content or absolute-positioned text stacks.
- Use `min-height: 100dvh` for full-height shells, never fixed viewport height.
- Keep the primary action within thumb reach on mobile through a sticky bottom action bar where appropriate.
- The tomorrow-script planner collapses to one column below 768px; keep the selected context and credit cost immediately above the sticky primary action.
- The script workspace must not require horizontal scrolling; hook options become a horizontally scrollable, keyboard-accessible tab row with visible active state.

## 6. Motion & Interaction

- Default spring feel: stiffness 100, damping 20.
- Animate only `transform` and `opacity`; do not animate layout dimensions.
- Stagger idea-list reveals subtly so the feed feels curated, not dumped onto the screen.
- Use a low-amplitude shimmer for active research and a gentle pulse for the live credit meter after a credit change.
- Respect `prefers-reduced-motion`; remove perpetual loops and use instant state changes.
- Save/dismiss feedback should be immediate, reversible and quiet.
- Generation progress should show phases—“Researching context”, “Drafting script”, “Checking language”—rather than an indeterminate spinner.

## 7. Responsive Rules

- Mobile-first collapse below 768px; all multi-column compositions become one column.
- Desktop navigation becomes a compact menu/bottom navigation on mobile.
- Filter chips become a filter sheet; evidence and score move into collapsible sections.
- Headlines use `clamp()` and never force truncation of regional-language text.
- Script editor controls remain reachable without horizontal scrolling.
- Preserve the same primary action and hierarchy across mobile and desktop.

## 8. Anti-Patterns (Banned)

- No emojis in the interface.
- No Inter font.
- No pure black.
- No neon gradients, glow effects or purple/blue “AI” cliché styling.
- No generic three-equal-card dashboard rows.
- No centered hero layouts for high-variance surfaces.
- No floating blobs, decorative sparkle icons or meaningless AI brain imagery.
- No overlapping elements or text on top of busy imagery.
- No fake round metrics such as “99.99% relevant”.
- No clichés such as “Elevate”, “Unleash”, “Seamless” or “Next-Gen”.
- No filler copy such as “Scroll to explore”.
- No generic placeholder names such as John Doe or Acme.
- No unlabelled AI output, unsupported score certainty or hidden credit costs.

## 9. FE-05 Billing Surfaces

The usage screen is an editorial ledger, not an analytics dashboard: lead with one warm Saffron-tinted balance panel, pair it with a quiet entitlement detail panel, then show a simple border-separated credit movement list. The billing screen uses an asymmetric two-column plan comparison with the paid Creator plan visually featured in the warm surface. Keep checkout states inline and plain-language: “Complete now”, “Waiting for confirmation”, and “Payment did not go through.” Explicitly label mock/manual checkout until a real provider is connected.

Use the existing `#F7F5F0` canvas, `#FFFFFF` surfaces, `#FFF9EE` warm surface, `#20201E` ink, `#6F6C66` muted text, `#E5E1D8` borders and `#C97822` Saffron accent. Credit values and dates use Geist Mono. Below 700px, collapse all panels into one column, retain 44px touch targets, and keep failure or pending payment copy directly beside the affected action.
