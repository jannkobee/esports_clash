# Fontessa bridge, lower riverbank, restaurant and aiming correction (14 November 2026)

## Scope and ownership

The owner stopped the lag/testing continuation and requested the reference-inspired masonry bridge, a walk-under riverbank route with apartment stairs, a styled/named restaurant with outdoor furniture, removal of artificial boost boxes and their repeated hopping, stable stair/high-ground crosshair placement, removal of rifle ADS, and skipping tests. This pass supersedes the earlier ADS/boost direction. `/root` owns the map, navigation, simulation, scenery, viewer, matching HUD and this record; no delegation, external asset processing or publication.

## Source changes

Fontessa is `fontessa-village-v5`; local live snapshots are `hexatrick-live-exhibition-v17`.

- The central bridge has shared segmented masonry vaults, springing blocks, stone arch rings, parapets/coping, lanterns, civic banners and ivy. Its east bank parapet leaves the B catwalk junction open. The river water sits below the lower paving.
- A lower bank at X -20.5..30.4 / Z 2.9..5.6 / Y -1.2 runs under the bridge and existing market catwalk. Six 0.2 m treads on the west join street grade; six more extend the existing apartment stairs down to the lower bank. The existing upper apartment flight and gallery remain. The east shop row moves south to clear this route.
- Static navigation now distinguishes optional street/canal levels, with explicit same-floor stair connectors, level-aware bounded route/endpoint caches, the existing reverse-distance heuristic, preserved connector waypoints and normal walking step limits. Actors can fall into the lower bank without snapping up through a deck. No teleport boost is used. The optional point field is inert in existing official/historical callers.
- Main paving, decorative lane paving and the outside landscape are cut around the depression and stair mouths. Shared vault collision permits lower sightlines and blocks masonry for bullets, grenades and camera geometry. Physical effects select a floor below their actual height; observed contacts, route decisions, drops, smoke/fire and bodies retain the relevant floor. Sight-derived elevation remains observed information, not a new hidden-enemy feed.
- The original **Jade Lantern / Noodle House** frontage has jade-colored tiled eaves, gold lettering, brick piers, display shelves/bowls, hanging red lanterns, an outdoor menu and two street dining tables/benches. Existing centre/side exits stay open. Opening smoke setups move beyond the new awning.
- Removed both artificial maintenance/delivery crate perches, their terrain and decorative parts, automatic ledge-hopping and teammate boost duties/destinations. Legacy exported perch/boost lists are empty. Deliberate jump peeks remain; stair treads suppress incidental travel jumps.
- Pre-aim looks 12 m along the route, keeps a world-space focus height, avoids pitching into short stair waypoints, bounds/eases route pitch and retains a stable vertical preparation error. Holding sight checks use the destination's real floor height. Visible-target aim still uses sampled target height. The POV camera smooths local crouch height and directly follows interpolated elevation, avoiding a separate stair lag behind the aim ray.
- Removed rifle ADS state, accuracy bonus, movement penalty, camera zoom/centering and HUD treatment. Sniper scopes, their timing and magnification remain.

Primary files: `fpsLiveTerrain.ts`, `fpsLiveMap.ts`, `fpsSpatialWorld.ts`, `fpsLiveSimulation.ts`, `fpsLiveAim.ts`, `fpsLivePlanning.ts`, `fpsLiveIntel.ts`, `fpsLiveAnticipation.ts`, `fpsLiveGrenades.ts`, `fpsLiveRagdoll.ts`, `fpsLiveScenery.ts`, `fpsVillageArchitecture.ts`, `fpsVillageDesign.ts`, `fpsLiveViewer.ts`, `FpsLiveBroadcast.tsx` and its CSS.

## Verification boundary

**No tests, builds, type/lint/syntax checks, benchmarks or browser checks were run for this pass**, per the latest instruction. Only implementation/source reads were performed. Existing v16/boost/ADS and geometry test baselines need a later authorized update/review; they are not claimed to pass on v17. Shared collision/navigation are source implementation, not proof of traversability, gameplay feel or visual acceptance. No deployment, database tick, generated human asset, Colab dispatch or production qualification. Preserve parody aliases, private DNA, careers and frozen artifacts.

## Earlier lag work retained, with its separate checkpoint

Before the stop instruction, the v16 lag continuation replaced expensive full-grid endpoint searches with grid-ring lookups, cached static paths/endpoints, indexed terrain and exact transition checks, reduced slab-intersection allocations, staggered initial planning and reused live operative rigs as corpses. Height-aware movement fixed restaurant roof obstruction; the batch collision invariant follows actor height. Windows durable learning-store writes use an `r+` fsync handle with guaranteed close. These edits and their meaningful regression coverage are retained.

The earlier checkpoint passed `npm run check:game` (248/248 tests plus design/TypeScript checks) and the production build (Vite 6.71 s; existing bundle-size warning), recorded in `tmp/fps-lag/check-game-final.log` and `build-final.log`. A later reverse-goal-distance heuristic, impossible-origin early rejection and one extra regression were added after that checkpoint. That extra test was not rerun before the stop instruction.

The final pre-stop CPU benchmark (not GPU FPS) used 1,800 fixed ticks per seed. Seed 1337 took 1,905 ms overall, live p99 8.43 ms; seed 9127 took 2,731 ms, live p99 16.55 ms. Same-host baselines were 76,105 ms / 141,557 ms overall, live p99 about 790 / 1,461 ms. See `tmp/fps-lag/baseline.json` and `final-release.json`; runner is `EsportsClash.Web/scripts/benchmark-live-fps.mjs`. These historical measurements do not qualify this new map/aiming pass. A prior UI glimpse showed a running match, but the browser review ended after a user tab change; no GPU FPS or full visual acceptance was obtained. Do not resume controlling that browser without a new task requiring it.
