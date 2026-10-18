# Avatar art sources — revision 4

**Autonomous review pipeline (2026-10-18):** a separate capped Docker/Blender/Three.js service now generates constrained geometry/animation variants from the exact selected runtime asset. The first five Arsenaldo candidates are available in the Laravel owner panel at `http://localhost:8089/evolution/avatars`. They include separate packed editable Blender copies, standardized images and technical measurements. No candidate is published yet. Explicit approval creates a versioned runtime override; originals and earlier approved assets remain for fallback/rollback. No source GLB or existing Blender scene was overwritten. Arsenaldo's selected Claude import has no supplied `.blend`; its new scenes are imported copies of that exact GLB. See `docs/avatar-evolution.md` for provenance, verification and limits. This is constrained procedural optimization, not a trained creative model or proof of artistic improvement.

**Latest Arsenaldo exception (2026-10-17):** the user supplied `Arsenaldo_animated.glb`, attributed to Claude. The exact imported GLB is preserved at `EsportsClash.Web/public/models/imports/arsenaldo-claude.glb`; Arsenaldo's studio selects **Claude animation** or **Current original**, persists the choice and applies it to the next arena scene. Default is the imported animation. It retains the v9 geometry/textures/rig with revised native animation samples; its source `.blend` was not supplied. The v9 baseline and Blender files remain intact and are still used by other avatars. Provenance, comparison video, integration and limits: `docs/arsenaldo-claude-review.md`.

**Current revision (v9):** all 45 runtime/studio/download assets use `public/models/avatars-v9/`. Model cleanup corrects blade direction, the heavy totem/hoop holds, obscuring headgear, shoulder/neck joins and the blocked launcher bore. Bow snap/held-arrow visibility and gun kick refine the existing native clips. All 45 exact packed scenes/actions/textures and 68 Grip shapes are in `art/avatars-v9/`. Repo-authored geometry/curves are baked into standard editable tracks and reuse the Blender-refined Quaternius CC0 parts; no claim of hand animation, new bespoke faces or production-quality art. Reproduction, verification and remaining limits: `docs/avatar-model-polish.md`. All revision sections below are historical.

**Mesh revision (v8):** all 45 assets are preserved in `public/models/avatars-v8/`. Refined equipment, shoulder connections, individual surface proportions and creature details accompany the existing rigs/contact animation. Blender refines 34 licensed anatomy sets and replaces faulty arm sections on 14 scout outfits. All 45 packed editable scenes in `art/avatars-v8/` retain ten actual actions and 68 Grip shapes. Reproduction/evidence/limits: `docs/avatar-mesh-refinement.md`.

**Current contact/footwork revision:** all 45 runtime/download models use `public/models/avatars-v7/`. All 45 packed Blender scenes in `art/avatars-v7/` retain the ten native actions, textures and 68 editable `Grip` shape keys. Source curves/contact IK are authored in code, baked to standard transforms, merged with the existing Quaternius CC0 anatomy, then imported into Blender; no claim of manual animation or mocap. Current reproduction, exact validation and limits: `docs/avatar-contact-polish.md`. The v6/v5/v4 statements below are historical descriptions, superseded for runtime selection by v7.

**Current combat-motion revision:** all 45 runtime/download models use `public/models/avatars-v6/`, with ten native motion clips each and explicit fighting-style direction. All 45 packed editable Blender scenes/actions are in `art/avatars-v6/`, with hashes and action names in its manifest. Current rebuild and validation: `docs/avatar-combat-motion.md`. Earlier v4/v5 sections below record historical art passes; their geometry/maps are reused. Motion curves are authored in code and baked into standard editable keyframes, not manually animated or motion-captured.

**Latest standing-pose revision:** current runtime/downloads use all 45 GLBs in `public/models/avatars-v5/`, with arched/relaxed posture on the 36 standing rigs. Updated packed Blender examples are in `art/avatars-v5/`. The v4 assets/scenes and details below describe the earlier anatomy pass. Use the current commands in `docs/avatar-stance.md` to rebuild v5; they reuse the same licensed sources and retain v2/v4 as historical artifacts. V5 clips intentionally replace the old straight stance.

The game now loads 34 upgraded humanoid GLBs from `EsportsClash.Web/public/models/avatars-v4/`. All have fitted artist anatomy, separated fingers, eyes, brows, hair and embedded albedo/normal/roughness maps. Fourteen scout designs also use fitted Ranger clothing with fabric, straps, buckles, bracers and boots. Other costumes, weapons, capes, creatures and vehicles retain the game's earlier modeling. This is shared licensed anatomy adapted to fictional game characters, not 34 individually sculpted faces or production-quality Wild Rift art.

Editable, texture-packed Blender review scenes are in `art/avatars/`: `c_astra.blend` (Aiselle), `c_kyumi.blend` (Vixelle) and `c_invoker.blend` (Arsenaldo). Every shipped GLB can also be imported into Blender. The scenes were saved from the exact shipped files. Blender may promote transform groups into extra imported bones; use the merge pipeline below to preserve the game's original joint hierarchy and animation bytes rather than replacing runtime files with an unreviewed Blender re-export.

## Attribution and provenance

- Artist: **Quaternius**, [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and [Modular Character Outfits — Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), free Standard portions, **CC0 1.0**. Unmodified included license notices: `licenses/quaternius-base-characters.txt`, `licenses/quaternius-fantasy-outfits.txt`. Their CC0 grant applies to the imported source art, not automatically to the repository's game code or original equipment.
- Public redistributions used for data downloads: `NafisRayan/Animate-Rigged-Humanoid-No-Blender` at `5821923af517ac5fdc82505faa92a0d575fc1b1a`, and `agentkaerf/FreeModels` at `db3df04d1e4714298a09510b26fb6de6645138a2`. `character-sources.json` pins 51 source files, paths, sizes and SHA256 values. A few dependency filenames are recorded as local aliases because the redistribution's glTF references use different names. No third-party scripts were executed. The creator's original download host rate-limited the request; public CC0 copies supplied the same licensed art.
- Blender **4.5.3 LTS** portable Windows build, downloaded from [Blender's official release directory](https://download.blender.org/release/Blender4.5/). ZIP: `blender-4.5.3-windows-x64.zip`, 400,100,678 bytes, SHA256 `6b657c8bdd3a7b65b07b9e1ae17eb4be7dd4aa23121da7f3d3354fc2551330a7`. Local executable build hash `67807e1800cc`. Blender and raw source downloads stay under ignored `.local-tools/`; no global installation or PATH edit. Blender is separate software, not an extension.

## Rebuild on Windows

From `EsportsClash.Web`, with dependencies installed and the specified portable Blender extracted under `.local-tools/blender/`:

```powershell
node scripts/fetch-character-sources.mjs
node --experimental-strip-types scripts/prepare-authored-avatars.mjs
$env:BLENDER_USER_RESOURCES = Join-Path (Split-Path (Get-Location)) '.local-tools/blender-user'
$blenderExe = '../.local-tools/blender/blender-4.5.3-windows-x64/blender.exe'
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/build-authored-anatomy.py
node scripts/merge-authored-avatars.mjs
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/save-avatar-blend-sources.py
npm.cmd run check:game
npm.cmd run build
```

The full prepare command replaces the staging config with all 34 humanoids. `--only=c_astra` is a staging/prototype option; do not publish a partial manifest as the complete roster. Blender's bake/export can produce different binary hashes across machines or versions; the final manifest must be generated with the outputs and reviewed again.

`src/avatarArt.ts` selects source gender/hair by stable combat ID. The prepare step removes the superseded anatomy and scout base surfaces while retaining the original 17-joint rig and four clips. Blender cuts and fits the licensed heads/hands, bakes character-color albedo on the original UVs, recomputes fitted outfit normals, warps scout clothing from T-pose, collapses skin influences onto the common joints, and caps maps at 512px. The merger appends those meshes/maps, remaps outfit joints, attaches anatomy to the original bones, and verifies the native animation digest. Existing exported skin entries share the same 17 joints; no second runtime skeleton is introduced.

`manifest.json` records hashes, image/mesh counts, character choices, source license and animation digests. The 34 GLBs total **125,542,076 bytes**, ranging from **2,084,340 to 5,679,088 bytes** each; these are uncompressed review assets loaded on demand. Three packed `.blend` scenes total 9,176,983 bytes. LOD, KTX/geometry compression, unique face sculpting, specialist creature anatomy, costume cleanup, hand/facial rigging and better clips remain. No measured phone FPS, full-match performance or production-quality claim.

Presentation only: no ML promotion, combat/stat/AI changes or relaxation of tower/well/Nexus safety. See `docs/avatar-anatomy-upgrade.md` for verification and previews.
