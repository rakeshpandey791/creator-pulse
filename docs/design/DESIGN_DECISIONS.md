# CreatorPulse Design Decisions

**Status:** Frozen for implementation planning

## Decisions

| ID     | Decision                                                                                                 | Rationale                                                                                               | Status   |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| UX-001 | Make Today/daily feed the primary home experience.                                                       | The core user need is deciding what to create today.                                                    | Proposed |
| UX-002 | Put AI generation inside the idea detail workflow.                                                       | Avoids a generic AI dashboard and preserves research context.                                           | Proposed |
| UX-003 | Show opportunity labels with score dimensions and explanations.                                          | Supports explainability without forcing creators to interpret raw numbers.                              | Proposed |
| UX-004 | Use a warm editorial visual language with focused accent colors.                                         | Differentiates CreatorPulse from generic dark AI dashboards.                                            | Proposed |
| UX-005 | Keep language and platform visible on every idea and script surface.                                     | Prevents accidental context mismatch for multilingual creators.                                         | Proposed |
| UX-006 | Treat evidence as a first-class but progressive-disclosure surface.                                      | Builds trust while keeping the feed scannable.                                                          | Proposed |
| UX-007 | Use optional feedback in a drawer/panel.                                                                 | Captures learning signals without interrupting the main workflow.                                       | Proposed |
| UX-008 | Include manual published status but no connected-account screens.                                        | Direct publishing is not MVP.                                                                           | Proposed |
| UX-009 | Expose credits before expensive actions.                                                                 | Supports cost transparency and the approved credit model.                                               | Proposed |
| UX-010 | Use mobile-first layouts with a richer desktop two-column detail view.                                   | Matches creator usage needs while preserving analytical depth on desktop.                               | Proposed |
| UX-011 | Use explicit coarse location context for local relevance; never infer exact location silently.           | Local trend suggestions need geographic context, while creator trust requires consent and control.      | Proposed |
| UX-012 | Separate source collection, Gemini trend interpretation and Gemini script expansion into visible stages. | Prevents unsupported trends from being presented as facts and makes generation understandable.          | Proposed |
| UX-013 | Ask for a one-sentence creator brief after idea selection.                                               | Gives Gemini the creator’s intended angle without forcing a complex prompt-writing task.                | Proposed |
| UX-014 | Fall back from city to region to country when local evidence is weak.                                    | Keeps the feed useful without inventing precision or blocking creators who decline location access.     | Proposed |
| UX-015 | Make new-script creation a five-step, one-question flow with defaults from onboarding.                   | Reduces reading, typing and decision load for creators with limited bandwidth or lower digital comfort. | Proposed |
| UX-016 | Use creator-language-first copy and everyday examples; keep English secondary.                           | Makes the product understandable for Hindi/Bhojpuri and other regional-language creators.               | Proposed |
| UX-017 | Treat voice input as an optional progressive enhancement, not a dependency.                              | Supports creators who prefer speaking without blocking the first release on transcription quality.      | Proposed |
| UX-018 | Keep the research pipeline invisible but explain its outcome in plain language.                          | Creators need confidence about what is happening, not model or retrieval terminology.                   | Proposed |

## Rejected alternatives

- A dashboard-first design centered on charts: conflicts with the idea-discovery problem.
- A standalone “AI studio” section: separates generation from evidence and idea context.
- Raw score-only cards: creates false precision and weakens trust.
- Dark-only visual theme: reduces readability for evidence-heavy workflows and may feel generic.
- Connected social accounts in MVP: not supported by approved scope.

## Unresolved design questions

1. Should the interface default to English labels with regional-language content, or should the full chrome switch to the creator’s preferred language?
2. Should the first feed show 3–5 high-confidence ideas or a larger discovery set?
3. Should creator audience input be free text only or include lightweight structured chips?
4. Which interface language should be used for realistic first-pass Stitch content?
5. Should the script workspace default to one recommended hook or show multiple hook alternatives immediately?
6. Which permitted source/provider will supply current local trend signals for the launch regions?
7. Should city/region be collected during onboarding or introduced as a lightweight first-use context step?
8. What minimum source freshness and local coverage are required before an idea can be labelled locally relevant?
9. Which Gemini grounding mode is approved for trend interpretation, and how will source citations be retained?
10. Which regional languages should receive localized labels and examples at launch, and which can use a translated fallback?
11. Should voice input be included in the first implementation or remain a later enhancement after the text flow is validated?

## Stitch project status

Google Stitch is now available through the Stitch MCP workflow.

- Project: `projects/3503066722097683519`
- Design-system asset: `assets/0b304cabea324f9d96c88372654a3d94`
- Canonical Stitch design instructions: `docs/design/DESIGN.md`
- Screen references are recorded in `SCREEN_INVENTORY.md`.
- Generated screens remain drafts until the product owner approves layout, typography, colors, components, interactions, journeys and responsive behavior.

## Recent Stitch additions

### Planned script-to-video extension (2026-11-13)

Six desktop/mobile video review drafts were generated in the existing Google Stitch project on 2026-11-13; references are recorded in `SCREEN_INVENTORY.md`. They cover voice recording/upload, preview with phrase-caption/diagram-label edits, and export/download with working/error state specimens, Library and expiry. Use the warm Saffron/Geist system, upload after microphone denial, confirmation before audio upload, readable regional fonts, reduced motion and touch targets. Keep the flow to voice → preview/edit → download; no general-purpose timeline editor or paid AI voice. These are design drafts awaiting product approval before VID-06 frontend implementation; VID-01 licensing/benchmark work is still outstanding. See `../product/VIDEO_PILOT.md`. Browser testing and pixel-level review remain deferred in this chat.

- Added mobile Authentication to cover account entry and recovery affordances.
- Added desktop Settings & Creative Context to cover editable creator preferences, languages, platforms and recommendation controls.
- Added mobile Script Drafting Workspace to cover the core idea-to-script journey on a phone.
- These additions do not change the approved MVP scope; direct publishing remains post-MVP.
