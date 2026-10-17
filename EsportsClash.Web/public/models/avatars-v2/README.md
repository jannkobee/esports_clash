# Esports Clash avatar models, surface pass v2

45 self-contained glTF 2.0 binary (`.glb`) character assets, authored from the project's original avatar designs. No external character meshes or Riot game assets are included.

Import an individual GLB as glTF 2.0 in a compatible 3D editor. The files contain geometry, UV coordinates, color-based metallic/roughness materials, skin weights, a common 17-joint hierarchy, and four native animation clips: Idle, Walk, Attack, Cast. Root scale converts the game's modeling units to meters (0.025 meters per modeling unit). The game converts back at 40 units per meter. Coordinates are Y up, with the character facing +Z.

This pass uses parametric surface modeling: lofted cross-sections, shaped facial surfaces, tapered curves, beveled panels and draped cloth. Humanoid arms and legs use joint weights. Creature bodies have basic root-bound skin and moving appendage controls; the common humanoid joint schema is not a finished species-specific creature rig. Head ornaments, some armor accessories and finger topology still need final attachment/weight/rig cleanup beyond the supplied clips. Alternate Ironclaw and Gunship parts are included at zero scale by default and are switched by the game's visual binding.

Materials use PBR color, roughness, metallic and emissive values. Painted base-color/normal/roughness image maps are not included. UV layouts are generated surface coordinates and may need repacking for a production texture atlas. These are editable modeling assets, not finished cinematic or Wild Rift-quality production characters. Facial controls, finger controls, animation polish, LODs, texture painting and device profiling remain later work.

`manifest.json` lists stable avatar IDs, public aliases, file hashes, sizes, triangle/skin/joint counts and animation metadata. The source authoring pipeline is in `EsportsClash.Web/src/avatarSurfaceGeometry.ts`, `avatarSculptBody.ts` and `threeAvatarModels.ts`. Rebuild from `EsportsClash.Web` with:

```
node --experimental-strip-types scripts/export-avatar-models.mjs
```

The game loads these files in its arena and Avatars & Lore studio. Each avatar's studio has a Download GLB link. Model animation and asset loading do not control gameplay, damage, movement, AI or match RNG.

## Arsenaldo art revision 3 (2026-10-17)

`c_invoker.glb` now uses a separately authored face, hair, fitted costume, layered shoulders, split coat, asymmetric mantle and elemental trails. It includes calculated vertex colors in addition to PBR color materials; painted image maps are still absent. Head/accessory surfaces in this hero bind to the relevant existing joints. The other 44 files remain the prior surface pass. This is an art revision within the same asset format/folder, not a finished production roster. The historical v2 ZIP in docs predates this hero revision. Rebuild just this hero with `node --experimental-strip-types scripts/export-avatar-models.mjs --only=c_invoker`. See `docs/arsenaldo-art-revision.md` in the repository for current images, verification and limits.
