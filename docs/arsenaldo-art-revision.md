# Arsenaldo art revision — 2026-10-17

The user rejected the first exported roster as visually primitive. This revision concentrates on one actual 3D avatar, Arsenaldo (`c_invoker`), rather than treating a larger export count as improved art quality. It is still a work in progress and does not reach Wild Rift's production character quality.

[Actual GLB turnaround](arsenaldo-art-arsenaldo-turnaround.png) · [Desktop studio](arsenaldo-art-studio.png) · [Phone studio](arsenaldo-art-studio-mobile.png) · [Current GLB](../EsportsClash.Web/public/models/avatars-v2/c_invoker.glb)

## Changes

- `src/arsenaldoModel.ts` authors a separate character surface set: denser facial forms, inset almond eyes and lids, nose/cheek/jaw shaping, swept hair clumps, fitted waistcoat and sleeves, overlapping brass pauldrons, gloves with fingers/knuckle studs, fitted boots, split curved coat panels with burgundy lining, an asymmetric mantle, piping, chains and geometric brocade ornament.
- Vertex colors supply deterministic broad surface values, alongside metallic/roughness/emissive color materials. These are calculated vertex values, not painted texture images. Existing resource ownership caches geometry/materials. Surfaces sharing a material merge into indexed skinned geometry, preserving the existing seventeen-joint schema.
- Head/face/hair details are weighted to Head; arm, glove, boot, cloth and body surfaces use the relevant existing joints. This does not add facial or finger controls or cloth simulation. The four portable clips remain presentation animations.
- The elemental objects use faceted cores, curved trails and small shards. Every effect mesh follows the real unit's current orb color; motion uses the borrowed simulation time, without changing spells, element selection, stats, RNG or AI.
- `avatarSculptBody.ts` and `threeAvatarModels.ts` select this body and retain the common animation binding. Arsenaldo's idle/cast arms gain outward poses. `threeAvatarPreview.ts` frames this avatar more closely. `avatarDesigns.ts` describes the current costume.
- The saved GLB replaces only `public/models/avatars-v2/c_invoker.glb`. `manifest.json` records its current hash. Its size is 3,619,068 bytes and it contains 70,380 triangles, 26 skinned material batches, seventeen joints and four clips. Other roster binaries remain from the preceding pass. The historical `docs/esports-clash-avatars-v2.zip` remains the preceding roster archive and does **not** contain this revision; use the current GLB link above or the studio download.
- `avatarModelUrl.ts` shares the current URL between studio download and lazy loader without pulling Three into the main UI bundle. The Arsenaldo URL uses an art revision query to refresh older cached bytes. `scripts/export-avatar-models.mjs --only=c_invoker` rebuilds just this file and updates its manifest row. `render-avatar-model-plates.mjs` accepts avatar/output selection; the comparison plate casts floor shadows but disables character self-shadow reception to avoid cloth shadow acne.

## Verification and limits

`npm run check:game` passes: 370 game tests, three deterministic simulation checks and TypeScript. `npm run build` passes with the existing large-chunk advisory. Existing saved-asset checks validate the new binary's UVs, normalized skin weights, common joint hierarchy, native clip playback, file hash, meter scale, clone isolation and floor clearance. Existing model checks cover frozen input, deterministic presentation and cache reuse.

The actual browser studio loads all 45 GLBs and passes keyboard rotation, pose selection, animation/reset, default still motion, download bytes, phone overflow, context recovery and unmount checks. Arsenaldo's turnaround and desktop/phone studio screenshots were inspected. See `arsenaldo-art-verification.json`, `arsenaldo-art-game-check.log` and `arsenaldo-art-build.log`. The live arena uses the same lazy asset URL, but a new full match/performance study was not run for this art revision. Prior paired gameplay results remain historical evidence.

The result remains code-authored parametric art. Stronger anatomical sculpting, purposeful expression, painted material maps and packed UVs, rig/animation polish, cloth behavior and optimized LOD/compression remain. The larger hero file is an art-review asset; this work establishes no physical-device FPS or bandwidth guarantee. No Blender session, manual sculpting, AI-generated image or production-ready art is claimed. The other 44 avatars still need art work.
