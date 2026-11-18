# Spillway Battlefield, Lawful Death-Callout Trading, Broadcast Lag Reduction, and Hexapedia / Manager FE Sync (2026-11-16)

## 1. Spillway Battlefield & 240-Round Headless Balance Benchmark

- **Files**: `EsportsClash.Web/src/fps/fpsSpillwayMap.ts`, `EsportsClash.Web/src/fps/fpsSpillwayScenery.ts`, `EsportsClash.Web/src/fps/fpsSpillwayTerrain.ts`, `EsportsClash.Web/src/fps/fpsLiveMapRegistry.ts`, `EsportsClash.Web/src/fps/fpsLiveSimulation.ts`.
- **Architecture**: Added an Overpass-inspired asymmetric 3-level map (`spillway`) in the live map registry while preserving `fontessa` as the default `getLiveMapRuntime()` return value.
  - **Level 0 (~0.0m)**: Drainage canal, Main Tunnel, Short drainage passage, Pumping Station / Bombsite B, bridge supports, and Lower Connector.
  - **Level 1 (~3.5m)**: Attacker Spawn, Plaza, Underground/Service Connector, stairs, and transitional ramps.
  - **Level 2 (~7.0m)**: Riverside Park, Gardens, Administrative Headquarters / Bombsite A, CT Spawn, Promenade / Long, and Control Deck overpass overlooking B.
- **Control Deck Sightlines & B Defense Balance**:
  - Lowered solid `control-deck-front-rail` and `control-deck-east-rail` collision curbs to `3.82m` (`baseY: 3.6`) with open horizontal safety rails (`sw-deck-rail-s-top/mid`, `sw-deck-rail-e-top/mid`) so Control Deck Heaven (`{ x: 24, z: 27.1, level: 'upper' }`, `groundHeight = 3.60m`) has direct overlooking sightlines onto Bombsite B (`30, 21`) and Short (`23.5, 22`).
  - Widened `ct-b-service-stair` (`32.9..39.6`) and updated `defenseHome` / `openingDefenseAssignment` on `spillway` standard setups so `CT_ROTATOR` reinforces Control Deck Heaven while `CT_ANCHOR_B` opens at Pumping Station (`2-1-2` spread).
- **240-Round Headless Benchmark (`node --experimental-strip-types scripts/benchmark-spillway.mjs --rounds=240`)** (executed after all map/tactic edits and prior to the `LivePlayer.radioAt` PTT animation field & test-assertion cleanup):
  - **Rounds completed**: `240` across `12` matches (`688,392` simulation ticks)
  - **Side win rate**: `CT 42.08% (101)` vs `T 57.92% (139)`
  - **Bomb plants**: `175` (`72.9%` of rounds) — **Site A (HQ)**: `52.57% (92)` | **Site B (Pump)**: `47.43% (83)`
  - **Round outcomes**: `Elim 127 | Detonated 53 | Defused 45 | Time 15`
  - **Control Deck usage**: `44,294` samples recorded on the overlapping upper deck
  - **Integrity**: `NaN=0 | OOB=0 | LocomotionStalls=0 (0.000%)`

## 2. Lawful Death / Duel Last-Location Comms for Trading

- **Files**: `EsportsClash.Web/src/fps/fpsLiveSimulation.ts`, `EsportsClash.Web/src/fps/fpsLiveViewer.ts`.
- **Cover Descriptor (`describeNearbyDeathCover`)**: Inspects non-roof, non-outer structural props within `5.5m` matching tactical cover patterns (`car`, `truck`, `van`, `tree`, `fountain`, `sandbags`, `pillar`, `pump`, `crates`, `box`, `kiosk`, `booth`, `barrier`).
- **Strict Lawful Gate**: On non-friendly death, killer location/cover (`"{reaction} 1 {cover}, {area} — trade him!"`) is only relayed if `victim` legally had `visible(victim, killer)`, a recent `sight` intel contact (`< 3.0s`), or active `target === killer.id && time - seenAt < 2.2` `aimPoint`.
  - Schedules a communication-scaled `reports` contact entry (`0.10..0.44s`), stamps `0.95` danger onto `victim.team`'s Influence Map, accelerates `nextThink` on allies within `24m`, and assigns `tradeAlly.watchPoint` without prematurely mutating `tradeAlly.contact`.
  - Kills with no observed sight history (`!lawfulPos && weaponId !== 'bomb'`) emit only `"Dropped unseen around {area} — check flank!"` without leaking killer coordinates.
- **PTT Radio Animation Lifecycle (`radioAt`)**: Added optional `radioAt` to `LivePlayer` so `applyOperativeAnimation` only raises the left arm to chest PTT for `0 <= currentTime - radioAt < 1.15` while moving (`stance === 'run' || stance === 'walk'`), keeping both hands seated on rifles while holding angles, peeking, or past 1.15s.

## 3. Player Cam-Switch & Render/HUD Lag Reduction + PiP 3D Clearance

- **Files**: `EsportsClash.Web/src/fps/fpsLiveRenderOptimization.ts`, `EsportsClash.Web/src/fps/fpsLiveViewer.ts`, `EsportsClash.Web/src/components/FpsLiveBroadcast.tsx`, `EsportsClash.Web/src/fps/fpsBroadcastDirector.ts`.
- **Viewmodel Prewarming & Cache**: Added `LiveRenderCache.has`, expanded `fpWeaponViews` capacity from `6` to `48`, incrementally prewarmed up to 1 uncached viewmodel per frame disabled upfront (`prewarmNextViewmodel`), and cleared `prewarmedSig` on `setMap`.
- **Allocation & Shadow Work Trim**: Replaced per-frame camera/PIP `Vector3` allocations and `[...solids, ...terrainSolids]` array spreads with `scratchVecA/B/C`; disabled `sunLight.autoCalcShadowZBounds` with fixed `shadowMinZ = 10`, `shadowMaxZ = 220`, `shadowOrthoScale = 0.04`, `1024` PCF `QUALITY_LOW`.
- **Synchronous POV Switch & Memoized Radar**: Made `observe(p)` synchronously update camera refs, selected/followed state, and schedule an immediate frame; guarded `setFollowed`/`setEffectiveCamera`/`setPlantPip` React setters; memoized static SVG radar layers (`radarStaticLayers`) cleanly by `[activeMapId, mapRuntime, hudOptions.cutawayRoofs]`.
- **PiP 3D Sightline Fix**: Updated `computeBombPlantPipPose` to require `runtime.sightline(spot, camPt, targetY, camY)` plus `[targetY, camY]` obstacle clearance so PiP cameras never frame through chest-high cover such as Fontessa's B Fountain basin.
- **Verification Scope**: Structural, unit, NullEngine Babylon, and headless CPU simulation checks ran cleanly. Interactive GPU FPS / browser frame-time profiling was not executed in this session.

## 4. Hexapedia & Manager Frontend Alignment

- **Hexapedia (`EsportsClash.Web/src/fps/fpsReference.ts`, `FpsHexapediaPage.tsx`, `GameGuide.tsx`, `fpsReference.test.mjs`)**:
  - Added `'liveSimulation': 'Live 3D & AI'` section covering Influence Maps & EQS, Team Blackboards & Behavior Trees, Lawful Perception & Death-Callout Trading, 4-Slot Loadouts/Vault Drops/Boosts, and BLAST Broadcast Cameras/Auto Wide.
  - Populated `maps` with `listLiveMaps()` (`Fontessa`, `Spillway`) alongside all 5 recorded `FPS_MAPS`, and `weapons`/`equipment` with purchasable `LIVE_WEAPONS`, `LIVE_KNIFE`, live utilities (`live_smoke`, `live_flash`, `live_incendiary`, `live_he`), and `live_c4` alongside recorded `FPS_WEAPONS`.
- **Manager Frontend (`EsportsClash.Web/src/App.tsx`, `FpsSimulationLab.tsx`, `ClubHome.tsx`, `OnlineNormalView.tsx`)**:
  - Added a direct **Live 3D Practice Broadcast** launcher in Match Centre (`Practice & 3D Sim` tab) that runs `<FpsLiveBroadcast>` with the manager's `startingFive` on `Fontessa` or `Spillway` while enforcing manager-chosen unique T/CT role validation (`createFpsIdentityContext`) and preserving the 2D recorded exhibition (`FpsMatchView`).
  - Added sidebar `3D Broadcast Lab` (`#fps-simulation`) link, `ClubHome` (`Live 3D Broadcast` portal & empty-calendar CTA), `OnlineNormalView` practice link, `Settings` card copy, and updated `FpsSimulationLab` summary/help navigation.

## 5. Limitations & Verification State

- Headless Node unit tests, NullEngine scene checks, design integrity checks, and Vite/TypeScript production builds verify logic, geometry, contracts, and types; GPU frame rates and manual playtest capture remain unverified in a live WebGL browser window.
- In `test:fps-baseline` on Windows, `src/fpsAutomaticLearning.test.mjs` lines 44 (`SQLite EBUSY` on thrown `Store` construction) and 57 (`\r\n` vs `\n` git CRLF normalization) fail due to pre-existing Windows test-environment behavior; `src/fpsTacticalEmergence.test.mjs` passes standalone (`7/7`, `2.627ms/tick`) when not contending with parallel 8-thread benchmarks.

## 6. Overpass Level Design Reference Pass (`spillway-v2`)

- **Files**: `EsportsClash.Web/src/fps/fpsSpillwayMap.ts`, `EsportsClash.Web/src/fps/fpsSpillwayTerrain.ts`, `EsportsClash.Web/src/fps/fpsSpillwayScenery.ts`, `EsportsClash.Web/src/fps/fpsSpillwayDesign.ts`, `EsportsClash.Web/src/fps/fpsLiveViewer.ts`, `EsportsClash.Web/src/fps/fpsLiveSimulation.ts`, `EsportsClash.Web/src/fps/fpsReference.ts`, `EsportsClash.Web/src/fpsSpillway.test.mjs`.
- **Upper / Lower Tunnel & Squeaky Service Loop**: Carved `upper-tunnel-floor` (`x=4.5..11.0, z=-35..-21, y=2.8m`), `lower-tunnel-stair` (`0.0m -> 2.8m`), `squeaky-service-stair` (`2.8m -> 5.6m`), and `squeaky-corridor-floor` (`y=5.6m`) with `mid-east-frame-s1`/`s2` doorways into Mid Courtyard (`z=-6` Squeaky door and `z=0` Connector mouth) and overhead `cutawayGroup: 'ceiling'` roofs.
- **Playground, Party Terrace, Traversable Parkhouse (Toilets) & Promenade Long Landmarks**:
  - Raised `gardens-playground-deck` (`3.2m`) with climbing fort scenery (`gardens-playground-frame`) and `party-plaza-planter` / `party-table-west` / `party-arch-pillar` with floating balloons.
  - Replaced solid `parkhouse-north` with a 4-doorway hollow `Parkhouse (Toilets)` interior (`parkhouse-west-s/n`, `parkhouse-east-s/n`, `parkhouse-south-w/e`, `parkhouse-north-w/e`, `parkhouse-sink-divider`, cutaway `parkhouse-roof`).
  - Added `long-boulder-rock`, `long-picnic-table`, `long-boost-crate`, `a-headshot-planter`, and `a-flowers-sign`.
- **Hydrology Bank, Bins & A Under Stairs**:
  - Opened `a-north-hq-wall` (`a-hq-wall-west`/`east`) into an enclosed `Hydrology Bank` (`a-bank-plaza-floor`, `a-bank-west/north/east-wall-n`, `a-bank-counter`, `a-bank-roof`, `a-bank-van`) and placed `a-bins-dumpster` along the CT-to-A roadway.
  - Added `'upper'` layer `a-under-stair` + `a-under-deck-landing` (`5.6m -> 3.6m`) linking CT/A roadway directly onto `control-deck-balcony`.
- **B Storm Pipe, Elevated Canal Bridge, Barrels & Jail**:
  - Carved `Storm Pipe` (`x=25.6..30.0, z=1.5..15.5`, `b-pipe-roof` ceiling + Short Canal elbow exit at `z=12..15.5`) through `b-divider-west`/`east`, added overhead `b-site-bridge-beam` (`cutawayGroup: 'overpass'`), upgraded `canal-grate-catwalk` to an elevated `1.4m` `Canal Bridge` (`b-canal-bridge-deck` + west/east ramps), and added `b-barrels-cluster` and `b-jail-*` pockets.
- **Terrain finish**: Added slim, non-pickable yellow tread bands to authored stairs; the marks are generated from `GroundPatch.stair`, batched with static scenery, and do not alter traversal or collision.
- **Comms, Lineups & Death-Callout Rules**: Expanded `SPILLWAY_SMOKE_LINEUPS` (`18` lineups), `SMOKE_LINEUP_COMMS`, `COVER_DESCRIPTOR_RULES` (`behind rock`, `behind barrels`, `by bins`, `by sign`, `by bank`, `in jail`), `tactical.callouts`, `chokes`, `assaultExtras`, and `fpsSpillway.test.mjs`.
- **Verification (post-edit)**:
  - `node --experimental-strip-types --test src/fpsSpillway.test.mjs src/fpsReference.test.mjs`: `14/14` passed.
  - `node scripts/validate-design.js`: passed.
  - `npm run test:pro-regression`: `16/16` passed.
  - `npm run build` (`tsc -b && vite build`): passed (`21.61s`).
  - `node --experimental-strip-types scripts/benchmark-spillway.mjs --rounds=240`: `240` rounds (`14` matches, `671,698` ticks) — **CT `45.42% (109)` vs T `54.58% (131)`**, **163 plants (`67.9%`)** (`Site A 52.76%` | `Site B 47.24%`), **Elim `147` | Detonated `44` | Defused `34` | Time `15`**, `Control Deck upper: 36,773 samples`, **`NaN=0 | OOB=0 | LocomotionStalls=0 (0.000%)`**. Interactive browser GPU FPS remains unverified.
