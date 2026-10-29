# Trial verification — 2026-10-24

Owner/stage: `/root`, separate painted-sprite art trial. Inputs: current original identity/design JSON; exact source hashes in `roster-reference.md`. Outputs: new PNGs and hashes in `assets.json`, exact built-in imagegen prompts in `prompts.json`. No historical binaries consumed. No 3D rig/model/provider qualification or release changes.

- `npm.cmd run check:game`: passed design validation, unit tests, three simulation tests and TypeScript. See `check-game.log`; legacy deleted-asset skips retain their prior meaning.
- `npm.cmd run build`: passed, existing large-chunk warning remains; `build.log`.
- `npx.cmd vite build --config vite.arena2d.config.ts`: passed; `trial-build.log`. Rebuilt after corrected texture Y orientation.
- Actual Chrome / Babylon preview at `http://127.0.0.1:5186/arena-2d.html`: all four state controls, pause, frame step, 45 reference entries and 390px layout pass, no uncaught exceptions. `browser.json`, `browser-desktop.png`, `browser-mobile.png`. Desktop/mobile screenshots visually inspected; initial inverted texture was found and corrected before these final captures.
- PNG header inspection: Mirelle atlas 1402×1122, 32-bit ARGB. Transparency is visible in the actual composite. Four equal normalized cells per axis currently produce fractional pixel boundaries. Detailed per-cell bleed/pivot measurements remain pending.

Inspected draft has a clear adult tailoring-mage silhouette, oxblood/ivory/ink palette and a collapsed Death endpoint. Generated run poses have insufficient alternating stride; costume details, bobbin shape, foot anchors and third Cast-frame extent need refinement. Only one direction/four frames per state exists. No claim of seamless animation, all-frame visual qualification, eight-direction support, live ability parity, all-roster art, replay/context recovery or ten-actor performance. The canopy/seam controls show static geometry vocabulary, not live mechanics. Mobile fits without horizontal overflow but uses letterboxing and small character scale.

Review script: `EsportsClash.Web/scripts/verify-arena2d.mjs` (expects Vite port 5186 and isolated Chrome CDP 9246). Reference generator: `scripts/build-arena2d-reference.mjs`, run from `EsportsClash.Web`. Read `README.md` for next gates and stage coordination. Assets remain unqualified and unpublished.
