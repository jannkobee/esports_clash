# Playable painted valley — 2026-10-24

Owner first asked to fill the empty background, then steered the active task: **actually enlarge the playable map using that art, put jungle camps there and make the middle lane bigger**. `/root` owns the complete map/layout/presentation integration; no delegation. This supersedes background-only staging.

## Layout and authority

| Property | Former strip | Current valley |
| --- | --- | --- |
| World width | 2600 | 2600 |
| World height | 760 | 1440 |
| Lane center Y | 380 | 720 |
| Main lane width | ~220 | ~400 |
| Champion/ability/router legal Y | 80–620 | 40–1400 |
| Default action zoom | 2.8 | 1.65 |

The world has about 1.89 times its former area. `arenaLayout.ts` owns height, center, version and bounds, plus the explicit migration of former authored Y coordinates. `CAMP_ROCK_RINGS` provides authoritative camp/boss locations and obstacles; both live and simplified executor spawns now resolve those centers. North sites lie around Y246–322, south sites Y1089–1156. The southern jungle is genuinely outside the old map. Brush centers, side barracks, wells, initial/respawn formations and healing relics follow the taller layout. Existing camp IDs, stats, rewards, leash and respawn rules remain.

`terrainRouting.ts`, `arenaRules.ts`, `arenaUnitCollision.ts`, `v3Arena.ts`, `v3Roster.ts`, `arenaLearning.ts` and live movement/recovery clamps admit the expanded terrain. Artillery safe-strip candidates now follow the lane and world bounds. No strategic veto or per-avatar strategy teacher was introduced. The existing policy observation shape, historical feature scaling, model weights and outcome rewards remain; expanded-map competitive skill is unproven. Frozen studies/models/runners were not changed.

## Art and rendering

New built-in imagegen artifact: `EsportsClash.Web/public/art/arena-2d/valley-surround-v1.png`, SHA-256 `5223fc83ff216988816915e12aa47e79b1cd15e1a3d61e416c84303e5b890108`. Exact prompt: [valley-prompt.json](valley-prompt.json). The painting supplies river branches, forest, old observatory/arch ruins, terraces and cascades. It is now used on the actual playable ground and cached minimap, with a low-contrast widened stone lane, translucent base paving, softened camp clearing masks and existing ground geometry. `PaintedBackdrop.ts` supplies a larger decorative continuation below it, and `PaintedScenery.ts` adds an irregular exterior fringe.

The picture does not generate hidden walls. Illustrated water and vegetation are traversable floor unless a real `ROCK_TERRAIN` obstacle is present. Live rock/brush footprints remain the mechanical reference. This is a deliberately readable first map pass, with more painted environmental detail than geometric topology; detailed water/cliff traversal classification and stronger blending of lane/ramp seams remain art/design work.

The broadcast stage stays full-viewport. Camera, minimap aspect, minimap click/touch coordinates, online observer framing and replay height use the new dimensions. Zoom 1 fits the larger map; default 1.65 shows the lane and adjacent jungle. Existing original sprite/3D qualification limitations remain as previously documented.

## Verification and cutover

- All 28 focused geometry tests pass: camp entrances, lane-to-pit routes, every camp-to-camp rotation, wells/ramp flanks to every camp and back, large neutral return, collision repair and broad-base/minion behavior. Fixtures were moved to new coordinates; travel budgets increase to account for longer distances. No geometry assertion was removed. The unused Three scenery instance allowance increases from 5000 to 6000 for the taller shared layout (observed 5336).
- `npm.cmd run check:game` and `npm.cmd run build` pass. Existing deleted-asset skips and bundle-size warnings retain their meaning. Logs: `valley-geometry.log`, `valley-check.log`, `valley-build.log`.
- Actual localhost:8088 live component under StrictMode: every camp/boss spawn matches its shared ring; Mirelle remains at Y>760 and successfully creates an authoritative Pin there. Four responsive dimensions, two Mirelle sprites, context loss/recovery, HUD focus/toggle and five seconds of presentation replay pass with zero uncaught exceptions. [Report](valley-browser.json), [fit view](valley-fit.png), [1920 view](valley-1920x1080.png). Screenshots visually inspected. The privileged map fixture exists only on the existing trusted DEV/evaluation surface.
- Rules-only catalog export preserved all 64 card/45 avatar definitions and catalog hash `41d18be3d22349e5bc622c37f6446dbccb8de978f3774b302e091492b1c6177f`. No active ordinary matches existed at cutover. Installed source rules `f3beade210485b091bde9bcf8f3645a0e513480750103091dd028d87a9939416`; rebuilt/recreated only `match-worker` as `teamfight-online-worker:painted-valley-v2`. Worker health succeeds and all 261 manifest source hashes match. Build log: `valley-worker-build.log`.

Historical catalogs and source-pinned records remain intact; exact old-strip replay/simulation requires its original map/source environment. The current renderer is the new valley, so do not call an old recording rendered against it exact historical geography. No full new online match, full-match balance, long-run performance, all-kit traversal or policy mastery qualification is claimed. Current tests prove route connectivity, mechanical placement in the expansion and short integration behavior. Natural-match jungle pacing needs playtesting.

Next agent: refine the painted lane/bank transitions and real terrain silhouettes; evaluate natural jungle rotations, objective contest timing, side-barracks reach and complete matches at multiple speeds. Keep protected tower/structure/alias/ML rules and the new map's shared coordinate source intact.
