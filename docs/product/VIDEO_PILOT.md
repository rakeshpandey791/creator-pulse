# Script-to-video pilot

**Decision date:** 2026-11-13  
**Status:** Product direction approved; planning only, implementation not started.  
**Task IDs:** VID-01 through VID-07 in `../project/ENGINEERING_TASKS.md`.

## Approved scope

Convert an approved creator script into a 30–60 second vertical explainer with animated diagrams, the creator’s recorded/uploaded narration, editable synchronized captions, preview and MP4 download. Start with one visual style and reusable opening, numbered-step, comparison, timeline and closing templates. Do not invent quantitative chart values or new factual claims to fill a diagram.

The tools must support an initially free workflow. No paid video-generation, caption, voice or AI API is required. Free software does not mean free hosting: local rendering/transcription consume CPU, memory, disk and electricity. Public hosting capacity must be measured and funded separately. This pilot is an additive release, not evidence that existing MVP launch gates are complete.

## Creator journey

1. From a completed script, choose **Create video**. Use the current saved script revision, language and duration.
2. Record narration while reading the script, or upload an audio file. Explain microphone permission and offer upload if permission is denied. Keep recording local until the creator confirms upload. Re-recording must be possible.
3. Preview the planned video and captions. Allow caption corrections, scene-label edits and selection of supported diagrams. No general-purpose timeline editor in the pilot.
4. Choose **Export video**. Show actual queued/rendering/completed/failed states, progress where measurable, and a clear explanation while transcription is running. Allow leaving and reopening the project.
5. Download the vertical MP4 from the project or Library. Re-downloading an unchanged export does not start another render.

If narration falls outside 30–60 seconds or does not fit the chosen script duration, ask the creator to re-record, shorten the script or choose a permitted duration. Never silently truncate speech or infer duration from text alone.

## Technology decisions

| Capability                   | Initial tool                                         | Constraint                                                                      |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| UI and API                   | Existing Next.js/React and NestJS                    | Extend current ownership/authentication boundaries                              |
| Scene plan                   | Deterministic script segmentation and template rules | Works without Gemini, including during quota exhaustion                         |
| Diagrams                     | React/SVG and versioned template registry            | Validated data only; no AI-generated executable code                            |
| Preview/rendering            | Remotion, conditional on Free License eligibility    | Confirm organization eligibility in VID-01 before dependency adoption           |
| Encoding/audio normalization | FFmpeg                                               | Record build/license configuration and codec decisions                          |
| Narration                    | Browser recording or audio upload                    | No paid or unofficial speech service dependency                                 |
| Captions                     | Self-hosted Whisper                                  | No hosted transcription API; actual regional-language quality must be evaluated |
| Queue                        | Existing BullMQ and Redis-compatible infrastructure  | Dedicated bounded render queue; protect existing script jobs                    |
| Metadata                     | Existing MongoDB                                     | Versioned projects, media metadata and export jobs                              |
| Files                        | Local filesystem in development/private pilot        | Portable storage interface; never store MP4/audio bytes in MongoDB              |

Remotion is source-available, not unconditionally free for every organization. Its published free license currently covers individuals/companies of up to three people. Confirm eligibility rather than assuming it. If ineligible, record an FFmpeg/SVG renderer alternative before implementation; do not introduce a paid dependency silently.

Whisper software is MIT licensed; inference still needs local compute. Prefer phrase-level captions initially. Hindi/Hinglish must be evaluated with real recordings; Bhojpuri and other regional languages are not promised accurate transcription without native-speaker evidence. Provide editable captions and a manual phrase-timing path if transcription is unsuitable. Bundle appropriately licensed fonts supporting the target scripts.

## Pipeline and interfaces

Approved script revision → validated scene plan → confirmed narration upload → audio validation/normalization → caption transcription/timing → preview edits → immutable export manifest → queued render → file inspection → downloadable MP4.

Define replaceable ports for `ScenePlanner`, `Transcriber`, `VideoRenderer` and `MediaStorage`. Store source-script revision, template version, caption revision, narration hash and render settings in the export manifest. Cache by these inputs; edits invalidate affected assets only. Caption-only edits reuse narration and transcription. Gemini can be an optional future planner, never a prerequisite for export.

Proposed metadata collections (final validators/indexes belong to VID-02):

- `video_projects`: creator, idea/script reference and snapshot, duration, language, scene/caption revisions and state.
- `video_media`: creator/project ownership, storage key, media type, hash, measured duration, size and expiry.
- `video_exports`: creator/project/revision, idempotency key, queue phase, output reference, progress, safe error and allowance reservation.

Use authenticated project creation/read/update, narration upload, export creation/status and download endpoints. Route names and typed DTOs are finalized in VID-02. Every media and export lookup must enforce creator ownership; server-side media tools receive validated local files, not arbitrary URLs or shell fragments.

## Limits and operating policy

Proposed pilot defaults, configurable before release: three successful exports per creator per month, 30–60 seconds, vertical 720×1280 MP4, one active export per creator, one render worker initially, and seven-day generated-media retention. These are application limits, not provider quotas or a promise of unlimited free hosting. Expiry must be visible; retain text project metadata separately under the existing account-retention policy.

Reserve an allowance atomically when export starts; settle once on success and release once on failure/cancellation. Duplicate clicks and queue redelivery cannot double count. Define stale-job recovery and reconciliation before launch. Keep this video allowance separate from existing three-credit script generation; no silent changes to script balances.

VID-05 must establish explicit upload byte limits, decode/transcription/render timeouts, disk and queue limits, concurrency and a global pilot cap from measurements. Refuse new work with an actionable message when capacity is exhausted. Retry only transient failures with bounded attempts; quota/validation errors must not cause retry loops. Delete expired originals, intermediate audio, thumbnails and exports through a tested retention job; account deletion includes video assets.

No AI-generated cinematic clips, AI voice/cloning, paid storage subscription, stock-media subscription, direct social publishing, music catalogue, arbitrary video editing or public cloud scale commitment in this pilot. Future paid adapters may add AI narration, generated clips, higher resolution and hosted workers after separate approval and cost measurement.

## Delivery and evidence

1. VID-01: Stitch desktop/mobile design, tool/license check, local capability benchmark.
2. VID-02: ownership-scoped contracts, metadata, media storage and revisions.
3. VID-03 and VID-04: template renderer and voice/caption processing in parallel after contracts.
4. VID-05: durable export orchestration, usage limits and recovery.
5. VID-06: integrate recording, preview/editing, progress and Library/download UI against approved Stitch screens.
6. VID-07: output quality, regional-language review, resilience, cost and pilot release evidence.

Acceptance requires an actual 30- and 60-second media export, inspected dimensions/audio/caption timing, restart recovery, ownership tests, quota/double-settlement tests, and a full run with Gemini and all paid providers disabled. Benchmark CPU/memory, wall time and output size on named hardware; do not promise render latency before this evidence. Browser/component/accessibility/visual evidence is required for release, but browser testing remains deferred in this chat per user instruction. Document outstanding evidence rather than marking it passed.

## Reference sources

Checked during planning on 2026-11-13; recheck eligibility before adoption:

- [Remotion license and pricing](https://www.remotion.dev/docs/license/pricing)
- [FFmpeg licensing/build considerations](https://www.ffmpeg.org/legal.html)
- [Whisper MIT license](https://github.com/openai/whisper/blob/main/LICENSE)
- [Remotion caption tooling](https://www.remotion.dev/docs/captions)

Cloud storage, AI voice and hosted rendering are future options, not free-pilot dependencies. No payment account or external service is created by this plan.
