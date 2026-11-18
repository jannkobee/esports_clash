# Live FPS corrections: duels, calculated smokes, handoffs, post-round, rotations, map, director, model (2026-11-17)

These are the owner's reports, with screenshots, after the evolving-meta pass. Nothing is committed. Two parts were done by forks at the owner's request: aimless circling, and the operative model. All other parts were done inline.

## Baseline: how the bots play

This is the reference for "is it right?" Every point is decision-side only; none changes aim, spread or damage.

- **Duels.** A healthy, loaded player who sees an enemy takes the fight. An older retreat order is cancelled when a new duel starts. Cover or outnumbered repositioning comes after a trade (shots fired or damage taken), not before. A wide peek returns to cover once it has done its job (traded, hurt, or no shot after reaction + counter-strafe + flick).
- **Smokes.** Smokes are worked out each round from sightlines, not read from a stored table:
  - T executes block defender holds, anchors and rotation entrances against the site entries and plant spots.
  - T openings cover the approach to staging.
  - CT openings delay the T approach at the choke.
  - Both sides plan a Mid control smoke.
  - During an execute, a defender seen near the site adds smoke options on that sightline, and the existing evidence ranking picks the order.
- **Utility purpose.** Every throw has an objective, a primary purpose and secondary purposes, and is judged afterwards (see [fps-utility-purposes-20261117.md](fps-utility-purposes-20261117.md)).
- **Sharing.** The donor stops, turns to the teammate or throw spot, then drops or tosses the item, which flies for its real duration.
- **Defence.** When a site's defenders have died there, the living CTs rotate together. One guard stays only if the other site also shows pressure.
- **After the round.** Fighting continues: winners hunt last-known positions for exit frags, losers break line of sight to save, and anyone with an enemy in view fights. Drops are collected only when no fight is on.
- **Purposeful movement** (fork): routes, call responses, trade partners and CT holds are committed instead of re-rolled every think. The execute is also called on a numbers advantage, or once the information window is spent.

## Changes

- **"Stare then back off"** (`fpsLiveSimulation.ts`): `firstContactCommit`, `peekShouldReturn`, retreat cancel on acquisition, and an outnumbered rule that needs a trade first.
  - Counter-strafe braking is faster in duels only (`advanceLiveVelocity(..., counterStrafe)`); normal braking is kept so doorway traffic still resolves. Settle time is 0.12 s standing / 0.08 s crouched.
  - Visual reaction is 0.13–0.55 s (`detailedReactionDelay`).
  - Stare episodes (enemy visible 0.9 s or more, no shot), from `scripts/diagnose-live-fps.mjs`: Fontessa seed 11 went from 24 of 105 sightings to 9 of 114 (seeds 11/22). Spillway is 6 of 81 (seed 11). The rest are mostly flash preparation, weapon draw or a teammate blocking the shot.
- **Snipers.** A shot needs 0.10–0.22 s looking through the optic (`scopedAt`). Before this, they fired on the tick the scope finished raising, so the overlay never showed. The broadcast and viewer keep the scope and zoom through the shot frame.
- **Grenades in pouches** (model fork): the always-visible chest canisters are replaced by `utilityCarry` meshes shown only for grenades actually carried, and not for the one in hand.
- **Calculated smokes** (`fpsSmokePlanner.ts`): the simulation reads `roundSmokes`, never `authoredSmokeLineups`. Comms are generated from callouts.
  - The utility trainer practises the planned smokes.
  - `scripts/check-smoke-planner.mjs` found 22 smokes on the two maps, all throwable (4 after stepping to a nearby spot).
  - The authored table remains only as a fixed plan for coordination tests.
- **Handoffs.** `beginHandoff` / `stepHandoff` cover funnel smokes, mid-round utility, AWP/rifle and sidearm drops, and freeze-time funnel drops.
  - The viewer flight uses each item's `at`/`airUntil` (`liveDropFlightProgress`) with a distance-scaled lob. Before this, a hard-coded 0.7 s made items jump or appear mid-air.
- **Post-round** (`stepPostRoundCombat`): learners are not fed post-round damage, kills or choices. Seeds 11/22: 8–9 post-round kills in about 11 post-rounds (before: 0).
- **CT rotations** (`fallenDefenseSite`, `callFallenSiteRotation`): a lawful site-fall call ("Lost N on A — rotate together").
- **Map.**
  - The Mid building's T door is now a normal street door (1.3 m × 2.25 m, `LIVE_MID_WINDOW.doorMinX/doorMaxX/doorTopY`). The window is 2.6 m × 1.5 m on the same centre line, so the hold's firing line is kept.
  - On the right of the bridge's south stairs (T view), the dead strip is closed: the `customs-warehouse-east` west face moved from x 3.0 to 2.0, matching the houses opposite.
  - Both changes were checked in headless Chrome renders.
  - The authored "smoke into the window room" example no longer fits through the window. Tests now use other fixtures; the bots smoke the bridge exit in front of the window instead.
- **Director** (`fpsBroadcastDirector.ts`): clutch-player bonus, view-clearance penalty for quiet subjects facing a wall or tree, bomb-finale third-person shot, first-person for post-round fights, and a 2.2 s minimum for routine re-ranking (kill and fight cuts stay fast).
  - Results from `scripts/diagnose-director.mjs`, Fontessa seed 11, committed version → now:

    | | Committed | Now |
    |---|---|---|
    | Wall-facing quiet frames | 1.9% | 1.3% |
    | Clutch time on the clutch player | 45% | 66% |
    | Kills on camera | 12/15 | 12/15 |
    | Live cuts per minute | about 29 | 23 |

- **Circling** (fork, `scripts/diagnose-live-purpose.mjs`): T goal jumps per player per 10 s on Fontessa went from 2.58 to 1.73. Walked distance ÷ net distance went from 1.9 to 1.7. The average execute call moved from 29.5 s to 16.8 s into the round on Fontessa. On Spillway it went from 28.7 s to 34.2 s (10 rounds; unexplained).
- **Operative model** (fork, `fpsOperativeGeometry.ts`):
  - Rounded kit and joints, shaped head and neck, sloped shoulders, and hands with fingers.
  - 10 operatives (NullEngine): meshes 555 → 580, triangles 116k → 192k. GPU frame rate is not measured.
  - Viewed only on a plain ground plane in headless Chrome.

## Verification

- `npm run check:game` (from `EsportsClash.Web`): 521/521 pass, plus `tsc -b`.
- New tests are in `src/fpsLiveCorrections20261117.test.mjs`.
- Updated tests:
  - Lineup coordination tests inject the authored fixture plan.
  - Pro regression tests advance handoffs.
  - The mid-window fixture is replaced by `guard-market`.
  - The comms test uses calculated comms.
- `node scripts/benchmark-live-fps.mjs --seeds=1337,9127`, same machine, other work idle:

  | Map, seed | p99 tick | Max tick | Ticks over 33 ms |
  |---|---|---|---|
  | Fontessa 1337 | 12.2 ms | 53.7 ms | 1 |
  | Fontessa 9127 | 13.6 ms | 52.6 ms | 2 |
  | Spillway 1337 | 10.2 ms | 61.3 ms | 2 |
  | Spillway 9127 | 9.8 ms | 71.7 ms | 1 |

  - p99 is in line with the previous record. Single spikes are higher than its 25–37 ms maximum.
  - Profiling puts the slow ticks inside `decide()` route planning (`findPath`, `routeGoalPath`, `chooseLiveApproach`), not in the new smoke, handoff or purpose code. The cause is not found.
  - Round-start smoke planning (25–30 ms) is cached after the first round.

## Not done / open

- The isolated 50–70 ms `decide()` spikes (above).
- Flash effectiveness is low by purpose (execute 0/3, retreat 0/5, retake 1/5 blinded anyone); not tuned.
- CT man-advantage aggression (pushing when up players) is not addressed.
- The fork changed only the T caller.
- Broadcast HUD changes (scope through the shot) and the director are not reviewed in a live browser session. GPU frame rates are unmeasured.
- The T-side bias was not re-measured after these changes.
