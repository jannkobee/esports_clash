# Doorway traffic and furnished window interior (14 November 2026)

Owner reported a running player stuck beside a doorway, requested another routing check, and asked for objects/details inside the window house. `/root` owns movement, map/furnishing integration, scenery, focused regressions and this handoff without delegates. Existing manager-selected responsibilities, personality/attributes, legal information, collision, gunplay and Colab boundaries remain.

## Routing correction

A controlled five-player restaurant exit reproduction exposed a real traffic deadlock: teammates crossing toward opposite exits approached the same collision boundary, and the old symmetric separation could not free them. Before the correction, two players remained near (-1.11,-30.66) and (-0.22,-30.42) after 30 simulated seconds, with active routes and over 28 seconds of blocked movement. The screenshot's exact live seed/state was unavailable; this is a reproduced matching failure mode, not a claim of recovering that session.

Moving teammates now use deterministic pair priority and a brief, physically reachable yielding step when crossing traffic blocks the route. The yielding player chooses room beside the other player's travel direction, or backs away when the passage is too narrow. Candidate segments respect terrain, walls and nearby friendly bodies; nobody teleports or passes through a teammate. Stationary channels, acquired fights, airborne movement and utility preparation retain their existing handling. Nearby opponents do not supply route-choice evidence. Same-direction queues retain their spacing behavior.

Corner waypoints are retained until the next leg is capsule-clear; simply entering the old 0.3 m arrival radius no longer permits a wall-cutting turn. Sharp turns reduce approach speed. Movement repairs a displaced/stale wall-crossing leg from the actor's actual position, with a bounded retry interval. Shared occupied non-objective destinations use a trade-spacing hold instead of endless running. The action display distinguishes making room and waiting for a clear lane.

## Window interior

Fontessa v12 adds a customs clerk's writing desk at the east side of the loft, a rear archive cabinet, and a storage trunk/bench. `fpsMidWindowInterior.ts` supplies their real footprints, floor heights, materials and purposes to the map. The ordinary viewer renders these same solids, and movement, sight and bullets consume them. The existing generic outdoor woodpile/bench dressing is skipped for these indoor furnishings.

Added desk drawers and brass pulls, writing blotter, papers, stacked ledgers, radio and aerial, brass/green desk lamp, cabinet doors and handles, padded bench/latch, framed harbor chart with canal/building markings, pinned dispatch slips, rear wall lamps and a civic-wing route board. The smaller fittings are scenery; substantial furniture supplies the collision. Main stairs, T/CT/civic doors and the window firing position remain open. Snapshot v19 is unchanged. No new avatar/model generation pipeline or external assets.

## Focused verification

The routing/window/autonomy run passed 21 of 22 checks; its isolated restaurant matrix initially used a defending actor walking cautiously within an attacking exit timing budget. Corrected that fixture to use an attacker; its separate rerun passes all 80 valid start/exit combinations. All 22 targeted checks have now passed, including:

- Five crossing teammates leave the restaurant without body overlap; a shared destination becomes a hold.
- Opposing teammates pass the one-person B market gap without jumping or collision.
- A close corner is retained while the following leg crosses a wall, and a displaced actor repairs a stale wall-crossing segment.
- All three window entrances are physically walked in both directions after furnishing, with correct floor heights and no jumping.
- Furniture is grounded, solid to movement/projectiles, and leaves the main firing ray clear.
- Existing window geometry, rotation timing, adaptive route decisions and released-only grenade trail regressions remain passing.

TypeScript passed. Logs: `tmp/fps-door-window-routing.log`, `tmp/fps-restaurant-grid-final.log`. Standalone reproduction probes remain in `tmp/probe-team-routing.mjs`, `tmp/probe-routing-grid.mjs` and `tmp/probe-door-routing.mjs`.

No broad suite/build rerun, browser/GPU review, full-match soak, deployment, migration, live session modification, asset processing or competitive qualification. The already-running exhibition requires a fresh simulation after the code update; its in-memory actor state was not modified through browser tools. Preserve unrelated pending work, aliases, private DNA, careers, historical recordings and frozen artifacts.

Changed sources: `fpsLiveMap.ts`, `fpsLiveSimulation.ts`, new `fpsMidWindowInterior.ts`, `fpsMidWindowScenery.ts`, `fpsVillageArchitecture.ts`, `fpsVillageDesign.ts`; focused coverage: new `fpsLiveRouting.test.mjs`.
