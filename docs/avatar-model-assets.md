# Editable avatar model files — 2026-10-17

**User request:** "pretend to be a 3d artist and make an actual 3d models for it."

Created 45 self-contained `.glb` assets at `EsportsClash.Web/public/models/avatars-v2/`, replacing the previous body assembly with custom surface modeling and preserving the distinct avatar equipment/design registry. The models are used by the arena and model studio. This work was authored with geometry code and standard glTF tools; it was not sculpted by hand in Blender or generated from a painted mockup.

[All model files, ZIP](esports-clash-avatars-v2.zip) · [Imported model roster](avatar-models-roster.png) · [Arsenaldo turnaround](avatar-models-arsenaldo-turnaround.png) · [Vixelle turnaround](avatar-models-vixelle-turnaround.png) · [Propella turnaround](avatar-models-propella-turnaround.png)

## What the files contain

- Custom lofted body/limb/head surfaces, jaw/cheek/nose forms, separate eyes/brows/ears/lips, tapered hair strands, hands with fingers, shaped boots, fitted breastplates, pleated clothing, draped capes, beveled hard surfaces and the existing unique equipment. Arsenaldo has ivory coat panels, raised collar, gemmed shoulders and piping; Vixelle has nine curved tails. Grounded creature feet/arms and equipment grip/floor placement are corrected.
- UV coordinates, indexed or batched triangle geometry and glTF metallic/roughness color materials. Metal and cloth use different material values. There are no painted image maps or copied character assets.
- A common 17-joint hierarchy with skin weights, plus four actual glTF animation clips. Humanoids use multiple joint influences for limbs and torso. Creature bodies use basic root-bound skin plus animated appendage groups; species-specific rigs and final accessory weights are incomplete.
- Meter-scale roots (0.025 meters per authoring unit) with Y up and +Z forward. The game uses an outer 40× scale to preserve its existing logical ground plane and actor coordinates. The manifest records per-file hashes and geometry/animation data.

## Runtime and authoring

`avatarSurfaceGeometry.ts` creates UV-bearing lofts, facial forms, beveled panels, tapered curves and cloth grids. `avatarSculptBody.ts` builds the shaped body and weighted skin. `threeAvatarModels.ts` combines it with each avatar's equipment and binds live visual state. `avatarModelAnimations.ts` bakes presentation movement into standard animation channels; `scripts/export-avatar-models.mjs` writes and reloads every file through GLTFLoader.

`avatarModelAssets.ts` owns lazy GLB loading and skeleton-safe clones separately for each renderer. `threeArenaScene.ts` and `threeAvatarPreview.ts` use the imported files once ready, with the same surface authoring geometry available during loading/failure. Loading never consumes match RNG or advances simulation. Live True Form, elemental-orb, Gunship and Overdrive visuals retain their existing state bindings. Per-actor skeleton textures, cached geometry/materials and late-completing loads are disposed without affecting another renderer. `AvatarModelPreview.tsx` adds Download GLB.

The binary model format is round-trip verified with Three's GLTFLoader. No Blender executable is installed in this environment; no claim of Blender import testing or a `.blend` source project is made. The authoring code and GLBs are included for further editing.

## Verification and limits

- All 45 saved files pass header/hash, UV, normalized-weight/index, common-root/17-joint, meter-scale/floor-bounds and four-clip checks. Loaded native animation changes actual skinned vertex/world positions. Skeleton clones and live visual state remain isolated.
- Browser checks select all 45 GLB-loaded studio models, verify the download's binary magic, keyboard rotation, poses, opt-in animation/reset, phone layout, actual context loss/recovery and unmount. The roster and turnaround plates render the imported files, not fallback geometry or concept paintings. Reviewed model sheets and studio screenshots.
- Required game check: 370 tests, three deterministic simulations and TypeScript pass. Production build passes with the existing chunk-size advisory. The live seed-47 3D/2D comparison preserves captured world/RNG and execution/opportunity audits at 30/60/90 seconds. Camera controls, responsive surfaces and context/disposal checks pass.
- This is a surface modeling pass. Shared facial bases, some legacy equipment shapes, accessory/finger weighting, creature-specific rigs, painted texture maps, UV atlas packing, facial animation, polished clips, LOD/compression and physical-device performance remain unfinished. The complete roster is about 34 MB uncompressed; only requested models load, but no bandwidth/frame-time or thermal-performance claim is made. The supplied clips are basic presentation animation and never resolve combat.
- Gameplay stats, AI/ML policies, tower/well/Nexus risk and legality, ordinary retreat, attribution, objective contests, anti-spin and aliases remain protected. Prior ML source/model/data freezes remain historical and are not rewritten or promoted by this art work.

Evidence: `avatar-models-verification.json`, `avatar-models-arena-verification.json`, model `manifest.json`, final verification record and screenshots/turnarounds. The asset-folder README explains import coordinates and current rig/material limits.
