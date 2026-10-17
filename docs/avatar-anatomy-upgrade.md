# Blender anatomy and clothing upgrade — 2026-10-17

The user requested more detailed avatars, authorized third-party apps, and said to continue after the Blender explanation. Blender 4.5.3 LTS now fits Quaternius CC0 artist geometry/maps to the actual runtime assets.

**34 humanoids** have modeled faces, eyes, brows, selected hair, separated fingers, albedo/normal/roughness maps. **14 scouts** also have fitted Ranger fabric, straps, buckles, bracers and boots. Faces and garments use shared source bases with character colors. Individual equipment/capes, other costumes and 11 creature/vehicle models retain earlier geometry. These are not 34 unique face sculpts or finished Wild Rift production art.

`public/models/avatars-v4/` contains 34 self-contained GLBs, a hash/source manifest and README, totaling 125,542,076 bytes. `art/avatars/` has packed editable Aiselle, Vixelle and Arsenaldo `.blend` scenes made from exact shipped GLBs. `art/README.md` records licenses, sources, pinned hashes, tool version and rebuild commands. Blender/raw inputs remain ignored under `.local-tools/`.

`avatarModelUrl.ts` selects v4 for `avatarArt.ts` IDs, consistently for studio/download and live actors; other designs keep v2. The preparation options in `avatarSculptBody.ts`, `arsenaldoModel.ts` and `threeAvatarModels.ts` remove superseded surfaces. The normal procedural model remains the loading/failure fallback. Authored exports omit Aiselle's oversized crown/bead hair, Hwei's flat hair block and Jinx's old bead braids.

`prepare-authored-avatars.mjs`, Blender `build-authored-anatomy.py` and `merge-authored-avatars.mjs` preserve the original 17 joints and four native animation channels byte for byte. Clothing is fitted from T-pose and its weights remapped onto those bones. Existing multiple skin entries share the same joints. Runtime clips do not round-trip through Blender; heads/hands follow existing bones without new facial/finger controllers.

`avatarModelAssets.ts` disposes late loads after owner close. `threeAvatarPreview.ts` uses shared texture cleanup; `threeArenaTerrain.ts` also closes owned ImageBitmaps once when disposing their texture set. Cloned skeletons stay separately owned.

Verification:

- `npm.cmd run check:game`: **381 tests**, three deterministic simulations and TypeScript pass. `npm.cmd run build` passes with the existing >500 kB advisory. Logs: `avatar-anatomy-game-check.log`, `avatar-anatomy-build.log`.
- Binary regression checks cover all 34 hashes, common joints, normalized weights, embedded PNG headers/sizes/material maps, URL selection and native animation equivalence with historical v2 files.
- `check-authored-avatar-assets.mjs` decodes actual maps in Chrome for all 34, samples finite posed vertices in four native clips at three times each, and confirms outfit Walk deformation. `avatar-anatomy-native-verification.json` is a sampled skin check, not exhaustive intersection testing.
- `check-avatar-designs.mjs` passes **45 actual studio selections**, GLB downloads, keyboard rotation, poses/Animate/Reset, reduced motion, phone overflow, real WebGL loss/restoration and unmount. See `avatar-anatomy-verification.json`, roster and studio/phone PNGs.
- GLB-required `check-arena-3d.mjs` passes three layouts, view/camera controls, context restoration and disposal. Captured 3D/2D full-state/RNG/opportunity/execution audits match exactly at **30/60/90 seconds**. See `avatar-anatomy-arena-verification.json` and desktop/laptop/mobile images. The controlled desktop scene has 414 calls / 284,424 triangles; these are scene counts, not frame-time measurements.
- Inspected actual shipped GLB front/profile/back/wireframe plates for Aiselle, Arsenaldo and Vixelle, the roster, studio/phone and live images. Owned inspection services close after verification.

Previews: `avatar-anatomy-aiselle-turnaround.png`, `avatar-anatomy-arsenaldo-turnaround.png`, `avatar-anatomy-vixelle-turnaround.png`, `avatar-anatomy-roster.png`, `avatar-anatomy-studio.png`, `avatar-anatomy-studio-mobile.png`.

Remaining work: unique faces/hair/costumes, simpler legacy equipment/creatures, clothing intersections/shoulder joins, LOD/compression, specialist rigs and polished clips. Maps are 512px; files load on demand but are larger. No device FPS/thermals, exhaustive pose/ability matrix or full-match performance claim. No paid service/account/plugin was needed. ML candidates/evidence and all gameplay behavior remain unchanged, including risk-based tower/well/Nexus legality, targeting/damage/range, natural retreat, attribution, objective contests, anti-spin and aliases.
