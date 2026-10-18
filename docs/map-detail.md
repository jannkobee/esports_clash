# Map detail and ambient particles

The user prioritized the map before further avatar reworks: make it more detailed, with particles inspired by Dota's atmosphere. This implementation adds original procedural scenery and effects to the existing 3D arena. It preserves the single-lane layout and gameplay terrain.

## Visible changes

- Weathered staggered paving, individual slab variation, fine cracks, moss, dirt trails and quieter grass grain. The former dark central disc becomes subdued worn stone.
- Animated river glints and bank foam, plus reeds and small bank stones.
- A grounded forest border with 140 branched trees in two staggered rows, varied crowns and warmer colors toward the red side. Tall trees and canopies remain outside the playable rectangle.
- Moss shelves, loose chips and contact shadows on the actual collision rocks; layered leaves/stems in the actual nine brush footprints. Low grass scatter is visually distinct from concealment brush.
- Broken camp-floor stones, wall inscriptions and braziers on the two existing entrance-edge rocks for every camp. Gate ornaments stay within those rock footprints and leave entrances open.
- Fountain trim, energy spouts/crystals and rising motes. Towers/Nexus/barracks get extra buttresses and trim; towers and Nexuses have animated team pennants. Destruction scaling applies to the ornaments with the original structure body.
- Six bounded particle batches: rising embers, soft smoke, firefly pulses near brush, wind-drifting leaves, brazier flames and fountain motes. Ambient decoration does not signal damage, boss availability, targeting, vision or a new obstacle.

## Implementation and invariants

`EsportsClash.Web/src/threeArenaScenery.ts` builds deterministic scenery from the existing `ROCK_TERRAIN`, `CAMP_ROCK_RINGS`, `ARAM_BUSHES` and `WELL_X` coordinates. It uses shared geometry/materials, **4,184 static instances in 48 batches**, and **578 particles in six point draws**. Structure ornaments use three instance batches per tower/Nexus and two per barracks. Repeated clock updates do not append geometry or spawn CPU particle objects.

Particles, cloth and water sample the existing match second. They freeze on pause and reproduce the same picture on rewind; there is no independent animation timer or gameplay RNG consumption. `threeArenaScene.ts` owns the scenery and sets the cloned ground material's time uniform. It also releases removed/replaced structure instance buffers while retaining shared scenery resources. `threeArenaTerrain.ts` adds the procedural ground/water shading. Existing disposal traverses the scenery/resource owner, shared materials, particle geometry and shader uniforms.

All simulation coordinates, camp and boss centers, rock collision/entrances, bush concealment footprints, ranges, damage, attack clocks, skills, towers/well/Nexus, normal terrain-aware retreat, attribution, objectives, anti-spin, AI, ML, aliases and audio defaults remain unchanged. The imported Claude Arsenaldo option is retained. New scenery never changes navigation or combat legality. The 2D tactical fallback retains its Canvas map; detailed 3D props and ambient particles belong to the 3D view.

## Review and verification

Run from `EsportsClash.Web`:

```powershell
node --experimental-strip-types --test src/threeArenaScenery.test.mjs
npm.cmd run check:game
npm.cmd run build
```

`threeArenaScenery.test.mjs` covers deterministic placements, tall-tree/torch footprint legality, immutable layout inputs, bounded batches/particles, synchronized pause/rewind clocks without buffer growth, exact shared-resource disposal, scene water-clock isolation and release of removed structure instance buffers. Existing frozen-world/rendering tests remain.

`scripts/review-map-detail.mjs --before` captured the old map. Running it after the changes with `--video` records four current map views and a native rendered video. The beauty fixture deliberately populates all camp/boss locations for visual review; its occupied pits do not represent the actual match spawn schedule. It checks immutable game inputs, shader compilation, paused pixel equality, pixel changes during playback and exact environment-pixel equality after rewind. Reports: `map-detail-before-verification.json`, `map-detail-after-verification.json`.

- [River / lane before](map-detail-before-river.png) and [after](map-detail-after-river.png).
- [Full map after](map-detail-after-overview.png).
- [Dragon pit after](map-detail-after-dragon-pit.png).
- [Blue base after](map-detail-after-blue-base.png).
- [Ambient particle video](map-detail-preview.webm), with saved-byte browser playback/seek/decode and three extracted frames in `map-detail-video-verification.json`.
- `map-detail-arena-verification.json`: real GLB-required live-match 3D/2D full-state/RNG/execution/opportunity comparisons at 30/60/90 seconds, viewport alignment/mobile fit, camera controls, context recovery and disposal. This remains regression verification; it does not complete the deferred 5v5 combat-effect polish.
- Required game/build results: `map-detail-game-check.log`, `map-detail-build.log`, summarized in the latest repository handoff. Temporary owned services: `map-detail-owned-processes.json`.

These are stylized procedural meshes, shaders and soft point effects. No Valve assets or exact Dota map are used. Remaining art limits include simple camp creatures/structure cores, repeated foliage shapes, basic lighting and a flat traversable surface. Smoke uses soft particles; there is no volumetric fog, physical fluid/cloth, terrain-height navigation or measured device FPS claim. Detail adds rendering cost: the six-hero overview fixture rises from about 180k to 330k triangles and 395 to 464 draws; this is a controlled fixture comparison, not a performance benchmark. Current map review takes priority over the previously proposed Dawnna pass.
