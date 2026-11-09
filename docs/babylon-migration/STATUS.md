# Babylon match cutover ? integration implemented, qualification incomplete

The owner requested removing the old 3D arena and completing the viewer integration. Babylon is now the match's default and sole 3D backend. The legacy match renderer selector is removed; query `viewer=legacy` no longer changes the backend. The tactical map and Canvas graphics-failure fallback remain. Existing studio/review tools may still use historical Three source.

## Implemented

- React owns one imperative Babylon canvas through a lifecycle-safe adapter. The actual `AramMatchView` 30 Hz simulation and its AI remain authoritative. Graphics and animation never issue combat commands, draw gameplay random numbers or confirm hits.
- A renderer-independent `ArenaFrame` contract and immutable copied snapshots contain model IDs, positions, health, status, motion/cast timing, projectiles, impacts and V3 construct geometry/lifetime. No runtime Three import is needed by those contracts or replay data.
- Existing GLBs resolve by all 45 stable IDs. Scene-owned caching, two concurrent loads, independent cloned skeleton/animation instances for both teams, normalized model bounds, existing release/preference resolution, visible failures and diagnostics are integrated. V3 previews use current/bundled rigged art; ordinary matches preserve the selected submitted model. Submitted uploads without animation stay visibly static, with missing-clip diagnostics. No auto-rigging or retargeting is silently applied.
- Imported clips are paused and sampled from simulation time. Cast phases follow kernel start/commit/recovery timestamps; recorded motion times survive seeking. Short clip transitions, death, locomotion, attack release and hit responses are connected. Generic clips do not establish bespoke per-ability timing/deformation quality.
- Ground painting and height/normals use existing map facts. Rocks and brush follow actual terrain positions. Instanced forest, base rings, tower/barracks/Nexus silhouettes, minions, wards and neutral shapes replace the empty plane and cylinders.
- Babylon renders line/radius/polygon geometry from actual V3 constructs, including artillery cells and safe strips, disabled/breakable state, projectiles, zones, impacts, shields and recall/control. Existing live overlay supplies HUD names, health, resource labels and public countdowns. These primitives are not finished bespoke ability VFX.
- Recording samples every fixed tick. Version 2 retains immutable construct geometry and animation facts, and accepts older version 1 imports. Recorded playback has independent pause/seek/1x/2x/4x controls. It does not resimulate decisions or prove combat parity. Last 18,000 snapshots are retained; import has a 64 MB file cap. Long-term/compressed archival and full authoritative event/action replay remain unfinished.
- WebGL is the default backend. `?graphics=webgpu` explicitly requests WebGPU, with asynchronous initialization and WebGL fallback. WebGPU is not performance-qualified. Resolution is capped, static scenery uses instances, GLBs/materials are reused, and active effect resources are reused/pruned. Further optimization should follow measurements.

## Verification performed

Production build including TypeScript passed; Vite reports large chunks. Seven focused tests pass for copied-state isolation, geometry serialization/validation, clock-driven animation and import-order startup. Asset inventory finds all 45 bundled GLB files, skeletons and required clip names; that is not a rest-pose, skin-weight, socket or art quality gate.

The actual Docker-served localhost:8088 browser check:

- Loaded ten GLB instances across humanoid/creature silhouettes and sampled walk/cast/attack/death/spawn states.
- Recovered forced WebGL context loss and disposed the scene.
- Mounted the real V3 match inside React StrictMode: one Babylon canvas, ten models, four live constructs after 120 fixed ticks, and no legacy selector.
- Opened the recorded four-second match in the independent replay panel.
- Recorded zero uncaught browser errors.

Evidence: [browser report](viewer-check.json), [live scene](live-viewer.png), [standalone scene](integrated-viewer.png), [asset IDs/hashes](asset-inventory.json), [build output](build.log). This is a renderer integration check, not a natural-match/balance result, an exhaustive animation review, or an all-45 GPU runtime test.

Reproduce from `EsportsClash.Web` with `node scripts/audit-babylon-assets.mjs`, `node --experimental-strip-types --test src/babylonViewer.test.mjs src/v3Startup.test.mjs`, and `npm run build`. `scripts/verify-babylon-viewer.mjs` uses an explicitly isolated browser CDP endpoint (default 9238) and localhost:8088. Full gameplay/balance tests remain separate.

## Remaining requirements

- Original V3 character assets, clean-base-first rig/appearance qualification and the required three-body-plan visual approval. Existing 45 assets remain legacy artwork; missing socket and static upload diagnostics are retained.
- Bespoke clips/VFX, complete category/counterplay readability and full replay coverage. Primitive geometry and clip-name availability do not qualify all 180 ability slots or ten Mirelle pages.
- Full seeded 1x/4x match parity and render-rate independence, all-hero ability/AI/balance regression matrix, complete saved action replay and long recordings.
- Same-machine WebGL/WebGPU heavy-teamfight benchmarks, selected device budgets, measured LOD/compression/pooling improvements and production acceptance. No desktop FPS target or performance superiority is claimed.
- The separately supplied canonical identity manifest was still absent in the V3 intake; stable existing IDs and derived aliases remain preserved.

## Docker dependency updates

The development image owns package files/node_modules; source is mounted read-only. Host npm install does not update those dependencies. The current pinned 9.32.0 packages were already rebuilt into frontend-dev. For future dependency changes, rebuild only this service:

```powershell
docker compose --env-file .env.evolution.local -p teamfight-evolution -f compose.evolution.yaml -f compose.evolution.dev.yaml up -d --no-deps --build frontend-dev
```

No frozen ML, online execution, asset-generation worker or production deployment was modified.
