# Roster mesh refinement - revision 8

The user approved a model-quality pass across all 45 avatars: body silhouettes/proportions, equipment, shoulder and clothing cleanup, then attack direction suited to the revised models. All runtime/studio/download URLs now use v8. These are actual updated game meshes and editable Blender scenes.

[Six before/after pairs](avatar-mesh-comparison.png) | [45-model roster](avatar-mesh-roster.png) | [Animation video](avatar-mesh-preview.webm) | [Ready](avatar-mesh-motion-sheet.png) | [Attack](avatar-mesh-attack-sheet.png) | [Cast](avatar-mesh-cast-sheet.png)

## Changes

`avatarMeshProfiles.ts` explicitly directs all 45 IDs with modest chest/waist/limb/face/depth proportions and equipment-specific attack direction. `avatarSculptBody.ts` shapes bind-frame surfaces around unchanged joints, adds 70 closed skinned shoulder bridges with chest/upper-arm blending, fitted sleeves/cuffs/necklines, seams and layered shoulder caps. `arsenaldoModel.ts` refines its existing waistcoat and coat proportions. These are surface adjustments to shared anatomy, not 45 newly sculpted faces or new joint layouts.

Blender 4.5.3 LTS edits all 34 licensed anatomy sets using `refine-avatar-mesh-parts.py`. It varies head/torso contours, recomputes edited normals, and removes faulty Ranger arm sections on 14 scout outfits (142,597 triangles). Repo-authored sleeves and closed shoulder gussets replace the projecting elbow fins. Retained torso/pants/boot surfaces keep their original maps; boots retain their sole height. Head/hand maps, hair and original licensed staging sources stay intact. The 68 editable Grip morph shapes and 51 closed defaults remain. Detailed per-set operations are recorded in `avatar-mesh-blender-refinement.json`.

`avatarEquipment.ts` creates shaped receivers, open muzzle rims/recessed bores, sights/triggers/rivets, ridged blades/fullers/crossguards/wrapped handles, tapered carved staffs and continuous recurve bows. Segmented gauntlets have modeled fingers/thumbs, cuff rings and pistons. Quakewell gets a smaller tapered carved totem with physical side grip; Brewmaw gets a bulged cask with staves and hoops. Hammer heads, weapon ornaments and staff caps are reduced. Existing palm fittings remain authoritative. The totem's raised guard can still partly obscure its carrier in some views.

`avatarCreatureMeshes.ts` replaces flat wing leaves with mirrored scalloped/curved membranes and adds dragon tails/scales, frog eyelids/toes/mouth, curved demon horns/ribs/talons, machine pipes/rivets/vents, rider harness, quill plates/tusks, pod rails/windscreen and energy filaments. All nine creature/vehicle/light identities receive detail; their basic hulls remain simplified.

`avatarCombatMotion.ts` adds per-avatar weight-transfer and cast accents for nine attack directions: cut, thrust, draw, shot, crush, punch, weave, sweep and pulse. It samples these before wrist aim/contact solving, preserving grip/foot IK, shared style timing, blending, release and recovery. These are code-authored/baked accents, not 45 bespoke hand-animated/mocap sets or a full new ability choreography matrix. Gameplay attack timing, damage and movement do not change.

The merger detaches a part from its imported source-armature parent before attaching it to the runtime bone. It validates a single-parent glTF node tree, in addition to existing joint remapping and body animation byte-digest checks. This keeps Blender and other strict importers compatible.

## Artifacts and validation

45 self-contained GLBs total **145,622,804 bytes**. They retain the original 17-joint sets and ten native clips each: Idle, Walk, Run, Strafe, Attack, Cast, Hit, Death, TurnLeft, TurnRight. All 45 packed editable Blender scenes total **105,588,696 bytes**, retain actual actions, maps and Grip shapes, and have hashes in `art/avatars-v8/manifest.json`. Source/code-authored surfaces are combined with Blender-edited licensed parts and imported into the review scenes. Existing licenses/provenance under `art/` remain authoritative; earlier versions/evidence are historical.

**399 game tests**, three deterministic simulations, TypeScript and production build pass, with the existing build advisory. New tests cover the full profile registry/bounds, shoulder skin blending/unit normals, mirrored membrane geometry/winding/UVs, open muzzle and weapon extents, strict single-parent GLB trees, common joint sets and all saved Blender hashes/actions/shapes. Existing tests also reload v5/v6/v7/v8 clips, verify source/live grip contacts, locomotion loops, state blending, pause/rewind and renderer independence.

Chrome loads all 45 models, decodes their embedded maps and samples 450 native clips at five times each (2,250 frames). The loaded grip defaults and all 37 grounded rigs retain planar stance contacts through walk/run/strafe: 11,692 consecutive comparisons, maximum horizontal drift 2.8643e-14 world units. These controlled trajectories do not establish arbitrary terrain/sole collision. All 45 studio selections, ten pose controls, download, keyboard/reduced-motion/mobile layout, context recovery and disposal pass. GLB-required live 3D/2D world, RNG, execution and opportunity audits match at 30/60/90 seconds; three layouts/controls/context recovery/disposal pass.

The before/after sheet renders six exact v7/v8 file pairs with the same camera, lighting and idle time. The motion video shows six runtime-bound updated models through nine states; video decoding, playback and seeking pass. Six front/profile/back/topology plates, ready/attack/cast sheets, the roster, studio/live layouts and three video review frames are saved under `docs/avatar-mesh-*`. Video motion is shown in place; world foot locking has separate loaded-rig numeric evidence. Exact records: `avatar-mesh-final-verification.json`, native/studio/arena/video verification JSON, game/build logs and the two asset manifests.

## Rebuild

From `EsportsClash.Web`, with the existing original licensed anatomy staging parts in `.local-tools/artist-prep/parts/` (source preparation and licenses are documented in `art/README.md` and `docs/avatar-stance.md`):

```powershell
node --experimental-strip-types scripts/prepare-authored-avatars.mjs --mesh
$env:BLENDER_USER_RESOURCES = Join-Path (Split-Path (Get-Location)) '.local-tools/blender-user'
$blenderExe = '../.local-tools/blender/blender-4.5.3-windows-x64/blender.exe'
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/refine-avatar-mesh-parts.py
node --experimental-strip-types scripts/merge-authored-avatars.mjs --mesh
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/save-avatar-blend-sources.py -- --mesh
npm.cmd run check:game
npm.cmd run build
```

`--mesh` isolates staging and outputs in mesh-prep/avatars-v8. Do not use an earlier revision flag to rebuild this pass. Browser checks accept CDP_PORT/VITE_PORT/MODEL_FOLDER=avatars-v8/OUTPUT_PREFIX=avatar-mesh; the studio uses USE_GLB=1 and the live arena uses REQUIRE_GLB=1 with a separate output prefix. Local owned inspection services close after validation.

## Remaining limits

Shared base anatomy/UVs, style families and simple creature hulls remain. Face edits are modest proportions, finger closure is approximate, and some clothing/weapon intersections persist. Precise finger rigs, individual sculpting, fully bespoke attacks/abilities, cloth/ragdoll physics, terrain-height foot solving, compression/LOD and device frame-time profiling remain further work. Files are uncompressed review assets loaded on demand; this is not a Wild Rift production-quality claim.

Presentation only: no ML promotion/study rewrite, gameplay/stat/speed/timing changes, tower/well/Nexus risk-rule changes, forced retreat, attribution/objective/anti-spin changes or parody identity edits.
