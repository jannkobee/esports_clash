# Fontessa central bridge, river, buy coordination and regression pass (14 November 2026)

## Final owner direction and ownership

Owner requested matching bridge walls/more canal detail, bomb escapes, freely turning toward teammates during buy-phase item passes, and regression tests. They then explicitly removed the raised right-hand bridge branch, retaining the central bridge, and requested a lower central span, natural stairs and a wider river extending outside the arena. This supersedes the v6 elevated bridge-to-apartment connection. The lower canal walkway and apartment stairs remain connected. `/root` owns this pass; no delegates. Testing is resumed by explicit owner request, superseding the previous skip-checks direction.

## Resulting map

Map is `fontessa-village-v7`; local snapshots are `hexatrick-live-exhibition-v19`.

- Removed the entire raised market/right-hand branch: deck, rails, beams, posts and upper paving. Closed the central bridge's east parapet and the apartment edge opening. The separate lower walkway/apartment stair connection remains. Existing ground-level village street crossings are retained for lane access.
- Central deck is now **1.0 m**, with matching masonry parapets at 1.85 m, lighter dressed-stone coping/arch rings, supported lamp pilasters, civic banners, ivy and stone stair cheeks. Each approach uses five 0.2 m risers with 0.8 m treads and nosings; both flights can actually be walked without jumping. South flight is Z -10.2..-6.2; north flight is Z 5.6..9.6.
- River is **9 m wide**, Z -6.2..2.8, water Y -1.6 / bed Y -2.5, and the visible water/bed extend 230 m across X, beyond the playable bounds. Both side garden boundaries and the outside roads/landscape are cut at the river. Waterfront building foundations prevent floating houses, and nearby outside houses move clear of the water.
- Lower paving stays at Y -1.2, above the water. Added actual street landing/side-facing flights, market north-bank stairs, wall drains/grilles, sills/sconces, waterline staining, moss joints and bed stones. Details stay against admitted edges rather than blocking the playable path with loose filler.
- Repositioned full-depth north-bank shops and the southern kiosk to preserve meaningful A/B chokes. Moved the market bin to street grade outside the shop. T gathers inside the restaurant near its entrance (0,-30.5); measured attacker setup leads remain within the existing 2-6 s target: A 5.73 s, B 5.15 s.
- Local one-metre canal nodes route around stair landings; a few fine service-lane/south-landing connectors prevent valid narrow passages becoming graph islands. Main navigation remains coarse, with bounded static/endpoint caches and reverse-goal distances. Layer connectors remain same-floor transitions; actors do not teleport onto decks.

## Gameplay corrections

**Bomb:** both forces use the same damage model, cover and actual height. T now computes reachable positions beyond the blast radius and leaves based on route duration plus a bounded decision margin. It keeps normal post-plant coverage while there is time; committed escapes run rather than re-entering cover/reload/utility holds. CT retains a reachable defuse, and saves when no teammate can finish in time. Close self-defense still uses normal acquired targets, reaction time and ballistics. There is no hidden-enemy input or T blast immunity.

**Buy phase:** feet remain frozen while CT/T yaw can turn through the full circle toward actual team recipients. Paid gun passes are visible from hand height and collected only after flight. Paid utility reserves can be passed to under-equipped teammates, with in-flight carry capacity reserved to prevent surplus grenades becoming stuck on one recipient. Excess stock remains recoverable on the floor. Replaced primary guns are dropped rather than silently discarded; pass origins are defensively copied in snapshots. No free purchases or utility allowance changes.

**Regression fixes:** descending capsules now land on real low-wall/cover tops before entering their sides; moving off support falls normally. Upward motion stops at a vault/deck underside rather than jumping through the lowered bridge. Actual support height is published. Death/pistol-round loadout resets immediately reset the held gun, magazine and reserve, fixing an old primary magazine briefly being displayed/used with a respawned pistol before staggered purchases.

The preceding compact HUD/hotkeys, CT-blue-left/T-red-right, hit-driven cosmetic ragdolls, sampled information rules, gun/scoping rules, aliases, careers and private DNA remain. No model/rig/animation generation, Colab job, database tick or deployment.

## Regression verification

- `npm run check:game`: **269/269 tests passed**, including design/cleanup/privacy/alias checks and TypeScript.
- `npm run build`: **passed**, Vite 4.22 s; existing large-bundle warning remains.
- Twenty focused new scenarios cover branch removal, river out-of-bounds cuts, bridge sight/solid separation, real stair/lower-walkway traversal, route connectivity, actual T bomb survival at both sites, successful CT defuse versus saving, equal bomb lethality, both-force buy turning, timed paid gun/utility passes, in-flight carry limits, hit-led ragdolls, low-wall descent, loadout reset and vault headroom.
- Updated genuinely obsolete removed-boost/snapshot expectations. Spatial fixtures now use the relocated cover and legal sightlines. Learned-route collision checks sample actual body heights/layers instead of treating overhead and lower walls as solid at every height. Determinism, privacy, collision and setup timing assertions were preserved.
- Long-run audit: **3/3 seeded runs passed**, seeds 17, 42 and 1337, 18,000 ticks each (10 simulated minutes per seed, 54,000 ticks total). All reached round 6. Every tick checked finite/in-bounds positions, living-actor collision including airborne bodies, grenade carry limits, cash and magazine/reserve validity. Current-source artifacts: `accepted-soak.json` / `accepted-soak.log`. Live CPU p99 was 11.51 / 9.14 / 7.74 ms respectively, with maxima 48.06 / 35.80 / 24.53 ms; isolated stalls remain, and these are not GPU frame measurements.
- Tracked diff whitespace check passed. No browser/GPU visual review or production visual/balance qualification is claimed.

Logs/artifacts are in `tmp/fps-regression-20261114/`: `baseline-tests.log` retains the initial 241/249 checkpoint, `accepted-check.log` and `accepted-build.log` are the final checks. The audit runner is `EsportsClash.Web/scripts/benchmark-live-fps.mjs` with `--audit=true`; its measurements cover simulation plus snapshot CPU time, exclude the audit assertions, and do not measure render FPS. Earlier diagnostics and failed checkpoints are retained.

Owned source: `fpsLiveMap.ts`, `fpsLiveTerrain.ts`, `fpsVillageDesign.ts`, `fpsVillageArchitecture.ts`, `fpsLiveScenery.ts`, `fpsLiveSimulation.ts`, `fpsLivePlanning.ts`, new `fpsLiveBomb.ts`, `fpsLiveViewer.ts`, focused regression fixtures/new `fpsBridgeBombAndBuy.test.mjs`, the benchmark runner and this handoff. Other pending frontend/API work was preserved.
