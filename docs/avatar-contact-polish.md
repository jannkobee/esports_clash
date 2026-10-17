# Full-roster grip and footwork polish ? v7

The user approved the next pass after the roster fighting poses. All 45 runtime, studio and downloadable avatars now use v7. This pass makes modeled handles meet palms, supports two-handed holds, and compensates planted feet for actual movement. Motion remains authored in code and baked into editable native clips.

[Motion video](avatar-contact-preview.webm) ? [Ready poses](avatar-contact-motion-sheet.png) ? [Attack poses](avatar-contact-attack-sheet.png) ? [Cast poses](avatar-contact-cast-sheet.png) ? [45-model roster](avatar-contact-roster.png)

## Implementation

- `avatarContactProfiles.ts` defines fittings for all 45 IDs. `avatarContactRig.ts` solves arms with elbow poles and explicit wrist orientation. Both bows and ten gun/staff/totem/keg users maintain a second hand on the actual weapon. Physical totem/keg/lantern handles and the hoop grip are modeled in `threeAvatarModels.ts`. Bowstrings are two moving segments; native exports include their scale channels. Two-handed attack handle motion blends across poses while retaining the previous style curves.
- `scripts/avatar-grip-morph.mjs` appends closed-finger position/normal deltas to the existing licensed hands. Original base positions/normals, maps and bind data remain intact. There are 68 editable `Grip` shapes; 51 have a nonzero default. The remaining hands stay open by their avatar profile. Procedural fallback fingers also curl. Thumb/finger closure is approximate, without a new finger skeleton or individually animated fingers.
- `avatarMotionTimeline.ts` advances stride from actual traveled distance. `threeArenaScene.ts` supplies canonical avatar scale, velocity and movement state, including the loaded model's meter conversion. The contact rig bends knees, lifts swing feet and rolls toes while stance feet hold world X/Z. All 37 grounded rigs use these contacts. Inai retains hovering footwork; seven other non-grounded silhouettes retain their body motion. Rewinds, state changes and teleports reset anchors; dashes/knock-ups do not lock feet. The floor is the avatar's own horizontal plane, not queried terrain.
- `avatarStance.ts` and `threeAvatarModels.ts` give generic capes a chest hinge, lag motion and extra hem clearance. `avatarSculptBody.ts` and `arsenaldoModel.ts` partially weight lower coat panels to the thighs. Quakewell's old large hair/head sphere is omitted when licensed anatomy is present. These reduce some intersections without introducing a cloth simulation.
- The 45 GLBs total **147,978,524 bytes**; the 45 packed Blender files total **114,648,979 bytes**. All 45 GLBs retain the same 17-joint sets and ten clips: Idle, Walk, Run, Strafe, Attack, Cast, Hit, Death, TurnLeft, TurnRight. Geometry/maps reuse the prior Quaternius CC0 adaptation and original equipment. License notices are unchanged under `art/licenses/`. All 45 packed `.blend` files retain the actual ten actions, textures and grip shapes, with hashes in `art/avatars-v7/manifest.json`. Code-authored/baked motion is not manual animation or mocap.

## Verification

393 game tests, three deterministic simulations, TypeScript and production build pass. The build retains its existing chunk advisory. Source tests cover every profile, two-bone reach/poles/orientation/clamping, actual two-hand contacts across five states, closed loops/blend endpoints, repeatability, paused/rewound clocks, loaded-wrapper scale, and all grounded gait trajectories. Saved-file tests verify unchanged original hand geometry, finite morph deltas/defaults, all Blender hashes/actions/shapes, and loaded v5/v6/v7 rigs/clips.

Chrome decodes all maps and samples 450 native clips at five points each (2,250 frames). It additionally exercises the actual imported GLBs: 68 grip defaults and 37 grounded rigs through three planar gait cycles. 11,692 consecutive stance comparisons have maximum horizontal drift **2.8643e-14 world units**. This measures controlled planar trajectories, not all combat/terrain conditions or exact sole collision. The studio passes 45 selections, ten motion controls, downloads, keyboard/reduced-motion/mobile layout, context recovery and disposal. GLB-required live 3D/2D world, RNG, execution and opportunity audits match at 30/60/90 seconds; viewports/controls/context recovery/disposal pass.

The 1500?1080 WebM shows six actual runtime-bound GLBs through nine states and passes decode/play/seek checks. It renders motion in place; world movement/planting is covered separately by the numeric loaded-rig trajectories and arena audit. Inspected ready/attack/cast sheets, three extracted video frames, the roster and five frontal/profile/back/topology plates are preserved under `docs/avatar-contact-*`. These are rendered game assets, not concept illustrations. Exact results: `avatar-contact-final-verification.json`, native/studio/arena/video verification JSON and game/build logs.

## Rebuild

From `EsportsClash.Web`, with the existing licensed anatomy staging parts under `.local-tools/artist-prep/parts/` (source preparation/provenance is recorded in `art/README.md` and `docs/avatar-stance.md`):

```powershell
node --experimental-strip-types scripts/prepare-authored-avatars.mjs --contact
node --experimental-strip-types scripts/merge-authored-avatars.mjs --contact
$env:BLENDER_USER_RESOURCES = Join-Path (Split-Path (Get-Location)) '.local-tools/blender-user'
& '../.local-tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/save-avatar-blend-sources.py -- --contact
npm.cmd run check:game
npm.cmd run build
```

Use `--contact` for this revision. Historical v2/v4/v5/v6 directories and evidence stay intact. Browser scripts accept `CDP_PORT`, `VITE_PORT`, `MODEL_FOLDER=avatars-v7` and `OUTPUT_PREFIX=avatar-contact`; the studio check also uses `USE_GLB=1`, and the arena check uses `REQUIRE_GLB=1` with its own output prefix. Review processes are local and owned; they close after verification.

## Remaining art work

These are shared rigs/style curves with modest per-avatar direction. Creature anatomy, large simple weapons, some sleeve/coat intersections, precise thumb grips and individual attack/ability choreography still need refinement. There is no terrain-height foot solver, full cloth/ragdoll simulation, new facial rig or measured device frame-time evidence. Assets remain uncompressed, loaded on demand. This is a contact/footwork pass, not Wild Rift production-quality art.

Presentation only: no ML promotion, decision/training changes, combat stats/speeds/timing, tower/well/Nexus risk-rule changes, forced retreat behavior, attribution, objective contest, anti-spin or identity changes.
