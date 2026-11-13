# CreatorPulse Screen Inventory

**Status:** Design specification draft — screens not approved  
**Release:** MVP unless marked future; video pilot is a separate P1 extension
**Design tool:** Google Stitch via Stitch MCP  
**Stitch project:** `CreatorPulse — MVP UI/UX` (`projects/3503066722097683519`)

## 1. MVP screen inventory

| ID      | Screen                              | Route/concept            | Priority | Primary purpose                                                              |
| ------- | ----------------------------------- | ------------------------ | -------- | ---------------------------------------------------------------------------- |
| AUTH-01 | Sign up                             | `/signup`                | P0       | Create creator account                                                       |
| AUTH-02 | Log in                              | `/login`                 | P0       | Return to the product                                                        |
| AUTH-03 | Forgot password                     | `/forgot-password`       | P0       | Start password recovery                                                      |
| AUTH-04 | Reset password                      | `/reset-password`        | P0       | Complete password recovery                                                   |
| ONB-01  | Welcome/profile setup               | `/onboarding/profile`    | P0       | Establish creator context                                                    |
| ONB-02  | Niche selection                     | `/onboarding/niches`     | P0       | Select one or more niches                                                    |
| ONB-03  | Platform selection                  | `/onboarding/platforms`  | P0       | Select Instagram, YouTube and/or Facebook                                    |
| ONB-04  | Language preferences                | `/onboarding/languages`  | P0       | Select Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and/or Kannada   |
| ONB-05  | Audience and style                  | `/onboarding/audience`   | P0       | Describe audience, style and creator goal                                    |
| ONB-06  | Onboarding completion               | `/onboarding/complete`   | P0       | Confirm preferences and enter feed                                           |
| APP-01  | Daily dashboard/feed                | `/app`                   | P0       | Answer “what should I create today?”                                         |
| APP-02  | Search results                      | `/app/search`            | P0       | Search topics and ideas                                                      |
| APP-03  | Idea detail                         | `/app/ideas/:id`         | P0       | Inspect idea, evidence and score                                             |
| APP-04  | Score explanation                   | Idea-detail panel/modal  | P0       | Explain relevance, momentum, freshness and competition                       |
| APP-05  | Script workspace                    | `/app/ideas/:id/script`  | P0       | Choose a hook, edit a useful script and CTA, then mark it ready for tomorrow |
| APP-06  | Generation progress/error           | Script workspace state   | P0       | Show meaningful generation phases, cost, safety review and recovery          |
| APP-07  | Saved ideas/library                 | `/app/library`           | P0       | Retrieve and manage saved ideas                                              |
| APP-08  | Idea status view                    | Library filter/state     | P0       | Track saved, planned, scripted, published and dismissed                      |
| APP-09  | Feedback capture                    | Idea/card/detail panel   | P0       | Submit optional rating/reasons/comment                                       |
| APP-10  | Credits and usage                   | `/app/usage`             | P0       | Show monthly credits and operation costs                                     |
| APP-11  | Subscription plans                  | `/app/billing`           | P0       | Compare plans and entitlement status                                         |
| APP-12  | Account/profile settings            | `/app/settings/profile`  | P0       | Edit creator preferences                                                     |
| APP-13  | Language/platform quick preferences | Settings subpanel        | P0       | Change context without repeating onboarding                                  |
| APP-14  | Global error/empty/loading states   | Cross-screen             | P0       | Make failure and unavailable data actionable                                 |
| APP-15  | Tomorrow script planner             | `/app/explore?compose=1` | P0       | Choose a recommendation or start from an own-topic brief                     |
| APP-16  | Generation brief confirmation       | Planner/script state     | P0       | Confirm audience, context, output bundle, duration and credit cost           |
| APP-17  | Local context setup                 | Onboarding/Settings      | P0       | Choose coarse location, consent preference and fallback scope                |
| APP-18  | Local pulse                         | `/app`                   | P0       | Show fresh local signals, source disclosure, freshness and coverage limits   |
| APP-19  | Creator script brief                | Idea detail/script state | P0       | Capture one sentence describing what the creator wants to say                |

## 1.1 Generated Stitch screen references

| Screen                                           | Stitch screen ID                   | Device  | Status                           |
| ------------------------------------------------ | ---------------------------------- | ------- | -------------------------------- |
| Today Dashboard                                  | `87c7e442dc244c01bdc72bd74f484561` | Desktop | Generated draft — review pending |
| Today Dashboard                                  | `7dae4b1aece44ece954277e99c2474e8` | Mobile  | Generated draft — review pending |
| Idea Detail — 3 Breakfast Mistakes               | `30408e78998f402f94aa8d1ebf92dd45` | Desktop | Generated draft — review pending |
| Idea Detail — 3 Breakfast Mistakes               | `6ff3c0f9b2ab40c8a741905f0a98eb09` | Mobile  | Generated draft — review pending |
| Script Drafting Workspace — 3 Breakfast Mistakes | `abf52b582a2b47e5ab4a98bf71174ae1` | Desktop | Generated draft — review pending |
| Onboarding: Choose Context                       | `6f90d00378f64930978b63969c92a86d` | Mobile  | Generated draft — review pending |
| Library & Usage                                  | `f2a1a370b7d340efba63ed41b97e315f` | Desktop | Generated draft — review pending |
| Explore & Search                                 | `2eb602fc664f48eea25a3dcec79a29e1` | Desktop | Generated draft — review pending |
| Authentication                                   | `86d5843aa74840eaa400171e05c2bdce` | Mobile  | Generated draft — review pending |
| Settings & Creative Context                      | `d1016a8c0806444fbae4835c8c1dc34f` | Desktop | Generated draft — review pending |
| Script Drafting Workspace                        | `76f4168d4a604a80b017bfe0988ef21e` | Mobile  | Generated draft — review pending |

Canonical resource prefix: `projects/3503066722097683519/screens/{screenId}`.

## 2. Deliberately excluded from MVP

- Connected social-account management: direct publishing is P1/V2.
- Trend-alert configuration: P1.
- Content calendar/planner: P1.
- Competitor profile tracking: P2.
- Published-content analytics: P2.
- Direct publishing confirmation/scheduling: P1/V2.
- General-purpose video editing, thumbnails and cinematic generation remain excluded. The bounded P1 diagram-video pilot below is separately planned.

## 2.1 Video pilot — generated review drafts

Scope: `../product/VIDEO_PILOT.md`; VID-01 design deliverable only. Generated in the existing Stitch project on 2026-11-13 with design system `assets/0b304cabea324f9d96c88372654a3d94`. Product approval, implementation and browser QA are not implied. Routes remain conceptual until VID-02.

| Concept                                                           | Desktop screen ID                  | Mobile screen ID                   | Review  |
| ----------------------------------------------------------------- | ---------------------------------- | ---------------------------------- | ------- |
| Add your voice — script, record/upload and permission alternative | `1c2c438fa977427c9c77fe4a9cc2ea69` | `5979fa34373c478b9bda2af3df0e0281` | Pending |
| Preview & edit — vertical diagram preview and phrase captions     | `f2c649959b9a4698a617d4f736207f44` | `f0105f7379ae40bfb7d94d025e2d5a12` | Pending |
| Export & download — success plus labelled working/error specimens | `bcc7022e344546af863a4dc97fcabe14` | `be72f644a4ef41bd8fc1dbbf48478b82` | Pending |

Example: 45-second Hindi study-tip explainer, creator’s voice and phone/timer/notebook diagrams. No AI-voice or paid-service control. Export progress specimens illustrate states, not guaranteed runtime. The seven-day download window and video-export allowance are visible. Canonical resource prefix is the same as above. Screenshot/HTML assets are retained by Stitch; direct unauthenticated screenshot downloads returned HTTP 401 in this session, so pixel-level review is pending in Stitch, with no browser testing performed here.

The existing desktop (`abf52b582a2b47e5ab4a98bf71174ae1`) and mobile (`76f4168d4a604a80b017bfe0988ef21e`) Script Drafting Workspace screens were also updated with a secondary Create video action, helper text and a saved-script availability rule. This is a design entry-point annotation, not verified interactive prototype navigation. A follow-up editorial pass corrected sidebar Create script wording, removed invented render-time/file-size/productivity claims, used consistent Hindi beats and distinguished alternative state specimens from simultaneously active states. Historical script-credit labels in the existing source screens remain subject to their original design review; the video-pilot allowance is separate.

## 3. Responsive design coverage

Every P0 screen requires a mobile layout at approximately 360–430px and a desktop layout at 1280px or wider. Tablet behavior should use the desktop information hierarchy with a collapsed navigation rail where necessary.

## 4. Review status

No screen is approved by inventory inclusion. The local-pulse proposal additionally requires review of consent, coarse-location display, weak-evidence fallback, source disclosure, Gemini stage separation, creator brief capture, layout, type, color, components, interactions, responsive behavior and the connected user journey.
