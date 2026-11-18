# Lag spikes, broken smokes and the utility brain (2026-11-16)

## Lag: cause and fix

Profiling seeded headless runs (`benchmark-live-fps.mjs`, 3,600 ticks, both maps) showed median ticks of ~1 ms. The hitches were single ticks of 100 ms to 1.56 s, nearly all from smoke lineups:

- `aimSmokeLineup` re-ran the exhaustive arc solver (`solveLiveSmokeThrow`) every tick while a player lined up. Its cache key used exact float coordinates, so any drift missed the cache. On Spillway this took 5.5 s of 10.1 s total simulation time.
- Four Spillway lineups had no valid solution, so every attempt searched the full space (0.9–1.3 s) and retried each second.
- `designatedDefuserId` routed every defender with A* and was called several times per actor per tick after a plant. It is now cached per tick and team.

The solver cache key is also quantized to 1 cm (it remains in use for flashes and HE). Smokes no longer use the solver at all (below).

Measured after the fixes (seeds 1337 and 9127): worst live tick fell from 136–1,561 ms to 41–63 ms; ticks over 33 ms fell from 21–22 to 2–12 per 3,600 ticks. CPU only: browser GPU frame rates are not measured.

## Smoke bugs fixed

- `sw-t-party-long` and `sw-a-truck-back` launched from non-walkable points; `sw-t-mid-screen` and `sw-b-control-deck` had no valid arc. Their suggested positions moved 1–4 m (targets unchanged).
- The pre-release veto that cancelled a smoke unless a perfect forecast landed within 1.5 m is removed for smokes. It let bots see the future, and made unreachable lineups cancel forever.
- A lineup that yields no throw is abandoned for the round (`unthrowableSmokeLineups`), kept separate from real releases.
- Viewer: site pads now sit on the site's ground (Spillway A is on the 5.6 m deck; its pad was drawn underneath it).

## Utility brain: calculated, learned smokes (owner request)

Lineups are no longer pre-solved. `src/fps/fpsUtilityBrain.ts`:

- **Calculation** (`calculateLiveThrow`): distance picks the throw type (underhand < 8 m, medium < 13 m, normal ≤ 24 m, walk/lob ≤ 30 m, jump ≤ 36 m, walk-/run-jump beyond). Static map solids between thrower and target become bands of forbidden arc heights; floors the thrower stands on are ignored. The flight time is the one nearest a natural throw that clears every band within the arm's speed limit. No forward simulation, so bounces and rolls are unknown and throws can miss.
- **Learning** (`learnFpsThrowOutcome`): when a smoke pops, its landing is compared with the intended spot. The brain keeps the best aim so far and searches outward from it, with an adaptive step. A throw that worked is repeated exactly. Wrong-floor landings flatten or raise the arc; repeated failures try another throw type, then a different spot (`findFpsThrowSpot`, ≤ 8 m). Working spots are remembered per smoke assignment (`spots`).
- **Execution error** is applied as hand jitter on release; learning is scored against the intended spot.
- **Practice** (`practiceFpsSmokeTargets`): drills each smoke target with the game's own grenade physics as feedback.
- **Storage**: committed seed `src/fps/fps-utility-brain.json` (trained by `scripts/train-utility-brain.mjs`), browser copy in `localStorage` (`fpsUtilityBrainStorage.ts`). Approved bundles may carry an optional `utility` brain.
- **Hookup**: the Simulation Lab now learns by default (navigation, combat, movement and utility); unticking uses approved frozen models. The lab shows utility-brain stats and a reset. Frozen mode plans from memory but never changes it. The automatic-learning server report schema is unchanged; utility learning is browser-local plus the committed seed.

Training from an empty brain (24 practice throws per target, then 2 matches per map): practice mastered 7/10 Fontessa and 15/18 Spillway targets; in-match on-target rate rose from 11% to 35% (Fontessa) across matches. The committed seed holds 96 remembered throws. Hard targets under canopies or overpasses still often miss.

Tests: `src/fpsUtilityBrain.test.mjs` (7). Lineup tests now accept a learned launch spot within 8.5 m and calculated misses, while still requiring real inventory, settled throws, release accounting and a smoke resting on a surface. Pro regression 5 tests the bot's own calculation with an empty brain.
