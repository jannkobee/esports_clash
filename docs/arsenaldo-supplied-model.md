# Arsenaldo supplied model — 2026-10-18

The owner paused TRELLIS.2 implementation and requested using `2a3c086c64c7c2e7fc2c60c576ba4baf.glb` from Downloads as Arsenaldo's temporary appearance.

Open <http://localhost:8088>, choose **Avatars & Lore → Arsenaldo**, and select **Latest supplied model**. This is the initial selection for the new preference generation and applies to the next 3D arena scene. **Claude animation** and **Current original** remain available. An existing scene keeps its captured selection.

## Imported asset

- Versioned runtime copy: `EsportsClash.Web/public/models/imports/arsenaldo-submitted-20261018.glb`.
- Original Downloads file is preserved. Runtime copy is byte-identical: SHA-256 `29661d603b85a3c9227331a5d3b1b930ce23ed241e01f866e1563581c613a4d4`, 33,281,216 bytes.
- One mesh, 35,749 vertices, **49,986 triangles**, one PBR material, three embedded **4096×4096** PNG images (albedo, normal, metallic/roughness). All resources are self-contained.
- No skeleton, skin weights or animation clips are supplied. It is a **static imported mesh**. Walking moves the character through the world; it does not articulate limbs. Prior skeletal walk/attack/cast clips cannot animate this asset. The selector explains this limitation.
- Runtime normalization honors the imported node rotation, centers the model on the ground and fits the existing **74-unit** visual height. It leaves the asset binary intact. Gameplay collision radii, targeting, damage and hit timing remain independent of visual bounds.
- Existing ice/wind/fire orbitals are added as separate presentation objects and read the current spell-orb state. Existing game ability effects and authoritative combat events continue unchanged.
- Failed loading falls back to the original and reports the actual loaded variant. It does not label fallback geometry as the supplied model.
- The 4K maps and 31.74 MiB download are heavier than the earlier model. The source is retained at full resolution; no mobile performance guarantee is inferred from desktop checks.

## Pause and preserved work

The TRELLIS.2 CUDA image build was stopped at the owner's request. `infrastructure/trellis2` contains **unfinished, undeployed scaffolding** and a newly prepared concept reference. It has not demonstrated generation, and it is not a working inference provider. Required official DINOv3 access returned HTTP 401 `GatedRepo`; the owner still needs to request access. No mirrored gated checkpoint, fabricated generated GLB or paid provider was used.

The existing Arsenaldo visual-generation schedule is paused in Laravel with an audit record so it does not continue processing the older Claude source while the temporary appearance is selected. Historical runs, release hashes and assets remain intact. The gameplay ML schedule and its container remain independent. Resume visual automation only after selecting and qualifying the intended source/profile.

## Verification

`arsenaldo-submitted-20261018-inspection.json` records the actual asset structure. Official Khronos glTF validation reports **zero errors / one warning**: tangent space is generated at runtime because the mesh has no explicit tangent attribute. See `arsenaldo-supplied-gltf-validation.json`.

Focused tests parse the actual geometry, check grounding/height, static support, stable paused orbitals, elemental colors, source integrity, fallback identity, earlier native clips and release snapshots. All ten focused checks pass. Required `npm run check:game` passes **450 tests plus three additional deterministic simulations and TypeScript**; `npm run build` also passes. Existing bundle-size advisories remain. Laravel passes **45 tests / 340 assertions**, including match-pinned visual versions; tests use an isolated in-memory database.

Actual native Chrome loads the complete PBR maps, renders the model with zero shader/runtime errors, switches to the earlier animated variant and back, and downloads the exact original hash. Desktop and 390px phone layouts pass. Evidence: `arsenaldo-supplied-browser-verification.json`, `arsenaldo-supplied-studio.png`, `arsenaldo-supplied-mobile.png`.

The real GLB-required arena check passes 30/60/90-second full game-state/RNG equality against the 2D renderer, desktop/phone viewport alignment, mouse/touch/minimap controls, WebGL context loss/restoration and disposal. Evidence: `collision-arena-verification.json` and its desktop/mobile screenshots. This is controlled fixture evidence, not a physical mobile-device or full-match performance guarantee.

Large-model delivery in Docker dev now uses a read-only public-model mount and nginx static handling in `compose.evolution.dev.yaml` / `infrastructure/evolution/nginx.dev.conf`. This fixes stalled concurrent GLB streams through Vite. The full supplied GLB was retrieved with its correct hash in about 3.65 seconds after the change. A separate three-file concurrent transfer also verifies complete GLB lengths and hashes (`arsenaldo-supplied-dev-delivery.json`). React/Laravel hot reload remains enabled. The Laravel model dashboard displays the paused state and static-model limitation; Blade compilation passes. Game/API/idle online-worker images were refreshed and the guarded source manifest installed with zero active matches. Catalog/card data and historical results are preserved. The ML runner retains its original container and image.
