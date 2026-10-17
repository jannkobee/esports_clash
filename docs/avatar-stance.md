# Natural standing pose — 2026-10-17

User feedback: "all models have straight bodies ... make an arch ... unnatural the way they stand." The new pose introduces a lumbar curve, shifted pelvis, counterbalanced upper torso/head, unequal knee bend and relaxed shoulders/elbows/wrists. The curve is softer during walking/attacking/casting and varies by body class. Small breathing motion uses simulation/presentation time only.

`src/avatarStance.ts`, called by `bindAvatarModel` in `threeAvatarModels.ts`, applies absolute joint transforms without accumulating rotations. The leg pivots compensate for lost vertical reach and the ankles counter-rotate, keeping idle/combat feet level at the original foot height. Both arms follow the chest. During source construction, rigid costume details attach to hips/spine/chest/head before material batching; capes follow the chest and fox tails follow the hips. Static armor no longer remains upright while the body curves. This is a skeletal presentation pose, not a mesh remodel or cloth/IK simulation.

The change covers **36 standing human/monkey rigs**. Nine creature/vehicle rigs retain their existing appropriate anatomy and movement. `avatarModelAnimations.ts` now exports constant articulated transforms explicitly as well as varying ones: a walk hip offset must not accidentally retain the preceding idle offset in another glTF player.

New `public/models/avatars-v5/` files contain **all 45 models**, 134,993,336 bytes total, with the original 17-joint sets, revised arm parenting and newly baked Idle/Walk/Attack/Cast clips. Source anatomy/material maps are reused from revision 4; this pass does not redownload art. `avatarModelUrl.ts` selects v5 consistently for the studio, download and arena, with an art=5 cache revision. Historical v2/v4 binaries and their checks remain unchanged. Native animation bytes intentionally change in v5 in response to this request.

`art/avatars-v5/{c_astra,c_kyumi,c_invoker}.blend` are packed editable Blender scenes imported from the exact new GLBs. Earlier `art/avatars/` scenes remain historical. The latest Blender-save script supports `-- --stance`.

Rebuild from `EsportsClash.Web` with the portable Blender described in `art/README.md`:

```powershell
# On a fresh checkout, create licensed anatomy parts first; skip these three steps if already present.
node scripts/fetch-character-sources.mjs
node --experimental-strip-types scripts/prepare-authored-avatars.mjs
$env:BLENDER_USER_RESOURCES = Join-Path (Split-Path (Get-Location)) '.local-tools/blender-user'
$blenderExe = '../.local-tools/blender/blender-4.5.3-windows-x64/blender.exe'
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/build-authored-anatomy.py
# Generate current posed assets; do not overwrite historical v2/v4 outputs.
node --experimental-strip-types scripts/prepare-authored-avatars.mjs --stance
node scripts/merge-authored-avatars.mjs --stance
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/save-avatar-blend-sources.py -- --stance
```

Verification: **383 game tests**, three deterministic simulations, TypeScript and production build pass (existing chunk-size advisory). The 36 source rigs pass lumbar curvature, fixed foot height, level ankles, chest-following arms, frozen input and idle→walk→attack→cast→idle repeatability checks. All 45 saved files validate hashes/joints/clips and reload into a geometry-only Node test, exercising real GLTFLoader name sanitization; runtime metadata handles colon-containing leg names. Actual Chrome decodes maps, samples four native clips at three times per file and confirms scout outfit deformation. All 45 studio/download/keyboard/pose/motion/mobile/context/disposal checks pass. GLB-required live 3D/2D full-state/RNG/execution audits agree at 30/60/90 seconds; three layouts and camera/context/disposal checks pass.

Review evidence: `avatar-stance-comparison.png` renders actual v4/v5 native Idle clips under identical camera and light, with no runtime pose override. `avatar-stance-{aiselle,arsenaldo,vixelle}-turnaround.png` shows the live binding. Studio/contact sheet/native checks are in `avatar-stance-verification.json`, `avatar-stance-native-verification.json` and associated images. Mandatory game/build and GLB-required 90-second arena results are recorded in `avatar-stance-final-verification.json` and logs.

Limits: shared pose profiles and basic existing clips, no full IK/foot-planting solver on terrain, no cloth simulation, some legacy costume intersections. This does not establish bespoke animation, full-match/device performance or final production quality. All gameplay/ML/AI, targeting, stats, collision, movement, RNG, tower/well/Nexus risk/legality, retreat, attribution, objectives, anti-spin and aliases remain unchanged. Owned inspection services close after verification.
