# Live painted arena and Mirelle — 2026-10-24

Owner explicitly requested: **make it live; first the arena and then Mirelle**. This follows approval of a separate sprite workflow and supersedes preview-only staging for this limited live presentation. `/root` owns this stage; no delegated agents. The failed Mirelle 3D candidate remains unqualified/unpublished. No historical binaries were restored and no 3D release rows were changed.

## What is live

Refresh the normal app at `http://localhost:8088` and open a match. The default Babylon renderer uses the new surfaces/scenery; Mirelle (`c_invoker`) uses the new sprites on both teams. No query flag or separate art page is required. The source-mounted development frontend already serves the changes; no container rebuild, dependency change, worker deployment or frozen ML operation was needed. The standalone original art laboratory remains available for inspection.

Arena was integrated and browser-inspected first. Its two-tile surface atlas is clipped to existing stone lane/base and forest regions, with existing ramp mouths, clearings and bush footprints. Painted scenery replaces the already placed rocks, tree trunks and bushes; nearby foliage fades for champion readability. The perspective ruins concept is retained as concept art, not stretched over the live collision map. Towers, minions and neutral units retain their current geometry.

Mirelle followed with a newly drawn left-facing atlas and the original right-facing atlas. Both use the fixed Babylon camera and terrain-aware anchor; team rings and HUD projection remain separate. Snapshot time controls Idle, Walk/Run, shared needle Attack/Cast and terminal Death. Cast release/recovery uses the existing animation sampler; no animation applies damage. Atlas cells use integer pixel boundaries and a one-pixel inset; texture mipmaps reduce distance shimmer. Asset failures retain current ground/proxy fallbacks. Instances and textures dispose on actor removal/unmount.

## Source/artifact handoff

- `PaintedArena.ts`, `PaintedScenery.ts`, `BabylonBattlefield.ts`: painted terrain and scenery stage.
- `PaintedMirelle.ts`, `paintedSpriteMotion.ts`, `BabylonMatchViewer.ts`: sprite stage, lifecycle, diagnostics and snapshot binding.
- `AramMatchView.tsx`: replaces the obsolete retained-artwork banner with the current live-trial status.
- `paintedSpriteMotion.test.mjs`: death hold/backward seek, cast release, facing and clock checks.
- [Live artifact hashes](live-assets.json), [exact generation prompts](live-prompts.json). Provider: built-in imagegen. Files are under `EsportsClash.Web/public/art/arena-2d/`. Original trial source/identity hashes remain in the roster reference. Scenery cutout corner/center alpha inspected as zero; actual browser composites inspected over terrain.

## Verification

- `npm.cmd run check:game`: 555 unit tests passed, 22 existing deleted-asset fixture skips, three simulation checks passed, design/TypeScript checks passed. See `live-check-game.log`.
- `npm.cmd run build`: production bundle verification in `live-build.log`; existing large-bundle warning remains.
- `scripts/verify-painted-live.mjs`, run against **localhost:8088**: painted surface ready, two Mirelle instances with opposite facings, movement/cast/death/rewind samples, WebGL context loss/restoration, disposal and zero uncaught errors. See [browser report](live-browser.json).
- Actual `AramMatchView` under React StrictMode with ten champions and Mirelle on each team: one Babylon canvas, two loaded sprites, painted ground, 120 simulation ticks. Record/replay opens with both sprites and four seconds of snapshots. This is a controlled first-five fixture, not a full-match/balance test. [Live match screenshot](live-match.png), [renderer screenshot](live-mirelle.png). Both inspected.

## Remaining quality limits

This is the owner-authorized live **trial**, not full sprite qualification. Four frames per motion, two lateral facings rather than eight, shared attack/cast gesture, no dedicated Hit/Spawn animation, residual stride/cloth/bobbin inconsistency and approximate common foot pivot remain. North/south travel retains lateral facing; there is no camera orbit. All ten Mirelle pattern mechanics/telegraphs still use the existing authoritative presentation; this change does not provide ten bespoke character clips or redesign her kit.

Painted scenery is repeated, fixed-camera cutout art; lane tiling/ramp seams need further aesthetic polish. Remaining units/structures are still proxies. Actual alpha/depth, bush/camp visibility and HUD were inspected in the controlled fixture, but exhaustive terrain-edge occlusion, long-run memory/performance and mobile live combat are not qualified. The brief context recovery and replay checks are not full replay parity certification.

Next agent should refine pivots, directional continuity, authored stride and slot-specific motion, then review at normal and zoomed match scale with ten simultaneous actors. Preserve the asset hashes and current failure notes rather than calling these drafts final. All gameplay, collision, tower attribution/order, IDs, learned decisions and frozen studies remain untouched.
