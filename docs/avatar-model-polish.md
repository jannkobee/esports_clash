# Model cleanup and weapon effects - v9

The full roster was inspected in guard and attack poses before and after this pass. Before/after sheets are `avatar-polish-before-{idle,attack}-{1,2,3}.png` and `avatar-polish-after-{idle,attack}-{1,2,3}.png`; each covers 15 actual textured models. Review JSONs identify every model and state.

Five sword users now hold their blades beyond the forearm; Quakewell holds its totem upright/outward with both palms fitted to its handle. The elemental hoop is smaller and held to the side. Smaller/repositioned headgear exposes existing heads, shoulder/neck surfaces overlap more fully, and the launcher's muzzle cap is removed. Bowstrings snap/recover at the established visual release, held arrows disappear after firing, firearms kick and recover, and blade wrists follow through. These refine the completed native animation system.

Weapon effects use 15 explicitly assigned finish families across 45 IDs. Powder embers and small smoke puffs, frost/spirit shards, leaf/ink particles, electric filaments and tinted trails complement the existing weapon mounts. Short impact chips use metadata attached to existing melee-hit/spark cues, including fixed impact coordinates. They do not infer a hit when a projectile disappears. No additional gameplay RNG draws, attacks, damage, hitboxes or simulation clocks.

## Rebuild

From `EsportsClash.Web`, reuse the existing v8 Blender-refined licensed staging in `.local-tools/mesh-prep/parts/`. If staging is absent, reproduce the v8 preparation/refinement documented in `avatar-mesh-refinement.md` first.

```powershell
node --experimental-strip-types scripts/prepare-authored-avatars.mjs --polish
node --experimental-strip-types scripts/merge-authored-avatars.mjs --polish
$env:BLENDER_USER_RESOURCES = Join-Path (Split-Path (Get-Location)) '.local-tools/blender-user'
& '../.local-tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/save-avatar-blend-sources.py -- --polish
```

All 45 v9 GLBs total 145,634,328 bytes; packed Blender scenes total 106,283,045 bytes. Each preserves ten actual actions, the 17-joint runtime set and the existing licensed textures. There are 68 editable Grip shapes. Older files remain untouched. Source meshes/curves are authored in code and baked, with already Blender-edited licensed anatomy reused; this is not a new hand-sculpted or mocap roster.

## Verification and limits

`npm run check:game` and `npm run build` pass: 414 game tests, three deterministic simulations and TypeScript, with existing build advisories. New tests protect release recovery, blade direction, held arrows, explicit impact cues, pause/expiry and all v9 binary/Blender hashes, actions, grip shapes and single-parent trees. The existing full-roster visibility and contact regressions remain. A dense 2,940-pose supporting-palm probe across the 12 bow/two-handed avatars has maximum error 3.60e-14 world units.

Browser evidence covers all 45 textured GLBs, 450 native clips/2,250 sampled poses, grip shapes and grounded contacts (`avatar-polish-native-verification.json`), 225 socket poses (`avatar-polish-effects-verification.json`), all studio controls/mobile/context/disposal (`avatar-polish-verification.json`), and exact live 3D/2D state/RNG/execution/opportunity comparisons at 30/60/90 seconds (`avatar-polish-arena-verification.json`). Six release/flight/impact sheets and `avatar-polish-effects-preview.webm` show actual native-clip models with the effects; impact fixture cues in that review are explicitly authored examples, not recorded match damage. Game/build/Blender logs use the `avatar-polish-` prefix.

Shared base anatomy and particle/animation families, some costume/equipment intersections, approximate fingers and basic creature hulls remain. This pass reduces observed problems; it is not an exhaustive cloth/collision solution, full alternate-weapon/ability socket matrix, ragdoll or device performance measurement. Existing planar feet and projectile convergence remain. Tower/well/Nexus risk rules, natural retreat, attribution, objectives, anti-spin, parody aliases and ML status/evidence are unchanged.
