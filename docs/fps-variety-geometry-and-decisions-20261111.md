# FPS variety, shared geometry and objective decisions (11 November 2026)

Owner requested an explanation for repetitive plays, additional map detail, floating-object and see-through-wall fixes, and smarter/stronger AI. `/root` owned this local pass; no agents, asset processing, deployment or browser automation were used. Existing unrelated changes were preserved.

## Causes and changes

- `FpsSimulationLab.tsx` previously initialized every new lab to seed 1337. It now chooses a fresh displayed seed on mounting. Manually selected seeds and the New seed control remain; identical seeds/inputs are still reproducible, and restarting an existing match retains its seed.
- `fpsLiveTactics.ts` selects all seven calls with bounded weights. Recent repetitions and especially losses reduce a call's weight without banning it. Pistol rounds can use all seven calls with a rush preference. Completed history is scoped to the attacking team, including after side changes.
- `fpsLiveSimulation.ts` gives Mid control a reached-position/20-second release, limits the A feint to 24 seconds, and releases quiet lurks after 32 seconds. Low remaining time releases feints/lurks sooner. Split groups establish Mid/Second Mid before their second approach rather than pathing straight to a final destination. These are bounded heuristics, not learned pro-level strategy.
- Low-HP retreat commitments yield to urgent plant/defuse/device-contest windows. Defuse alerts are limited to hearing range with existing wall attenuation. Defensive stacking uses confirmed historical planted sites, never the opponents' unexecuted calls, and resets across attacking-team changes. Personal vision, uncertainty, delayed reports and skill-profile mechanical limits remain.
- `fpsLiveMap.ts` now owns all eight architectural arch piers/jambs. The viewer renders those exact solids, so navigation, shots and sight no longer ignore the scenery pillars. Openings remain traversable. Three-dimensional slab intersection replaces wall-centre height sampling, preventing elevated sightlines from clipping through a near wall edge.
- `fpsLiveScenery.ts` removes duplicate decorative piers, grounds the stair risers, supports pallet slats and window planters, connects balcony corbels to the building, and corrects the stacked barrel support layout. Added wall mortar courses and bolted utility plates remain against existing cover and are merged by material.
- `fpsLiveViewer.ts` clamps first-person eye-height interpolation so camera cuts cannot overshoot the target height.

## Verification and limits

- `npm.cmd run check:game`: successful, 755 main tests / 733 passed / 22 existing skips / zero failures, plus all three batch simulation checks and TypeScript. The main suite ran before four additional focused regressions were appended; it is not claimed to include those additions.
- Final focused tactics/strategy run: 36/36 passed. Covers architectural blockage/opening connectivity, sloping rays in both directions, tactic availability and failure weighting, feint/Mid release, split progression, remote defuse isolation, urgent objective commitment and confirmed-site/side-change defensive history.
- `npm.cmd run build`: successful TypeScript and Vite build; existing large-chunk warning remains.
- Logs: `.local-tools/fps-polish-game.log`, `.local-tools/fps-polish-focused.log`, `.local-tools/fps-polish-build.log`.
- No rendered visual acceptance was performed. Geometry fixes are source/test verified, not a claim that every floating decoration or all camera angles have been visually qualified. No competitive-strength or long-run balance benchmark was performed. This pass does not alter server or historical telemetry.
- Local exhibition only. Official/historical FPS, private DNA, parody aliases, careers, `/evolution/game-modes`, frozen ML evidence and owner-started Colab asset gates remain intact.
