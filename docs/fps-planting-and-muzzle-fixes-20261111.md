# Local FPS planting decisions and weapon muzzle correction (11 November 2026)

The owner reported that Ts did not plant, then reported bullets appearing away from the gun. This pass fixes the browser-local live exhibition. `/root` handled the work without agents or asset processing.

## Bomb ownership regression

The deferred buy change queued `buyLiveTeam` results produced by spreading entire runtime actors. Those results retained `bomb: false` from before the carrier was selected. Completing a purchase then used `Object.assign(actor, buy)`, silently clearing the carrier while the shared objective still said `carried`. Three 360-second baseline runs (1337, 2026 and 73, detailed profiles) all recorded zero plants and zero plant progress.

`fpsLiveEconomy.ts` now copies only its declared economy fields. `fpsLiveSimulation.ts` applies only purchased cash/equipment/armor/utility fields. Bomb ownership, channels, movement, perception and decision state cannot be restored from queued purchases. The original buy-phase timing and paid team allocation remain.

## Planting decisions

- `fpsLivePlanning.ts` shares the unchanged 3.5 m plant radius and 3.2 s channel duration. It chooses reachable ground within the site, including positions around B's solid fountain, and retains a valid chosen destination. Plant travel plus the full channel contributes to objective urgency.
- `fpsLiveBrain.ts` distinguishes close personal threats and recent incoming damage from distant sightings. A protected, unpressured plant can continue while a distant defender is visible; nearby threats can interrupt it for self-defense. The policy consumes personal sightings, allied support, known concealment, channel progress and clock, without hidden opponent coordinates.
- A low-HP carrier can resume cautious progress after a short recovery without repeatedly extending retreat from old reports. Teammates take covering positions while the carrier channels. Actual movement/braking, grounded planting and the full plant duration still apply.
- Plant concealment radio is emitted only when its smoke throw succeeds.

## Weapon muzzle correction

Tracers previously started at the actor's centre with a fixed 1.45 m height. First-person muzzle flashes used three rough category offsets, ignoring the actual bore height, suppressor length and weapon pose.

`fpsLiveViewer.ts` now creates a muzzle socket from the forward barrel/suppressor/brake geometry of each firearm. First-person and world flashes inherit the socket transform. Live shot presentation records the shooter, equipped gun and visual endpoint heights. Both tracer variants resolve their origins after weapon/camera/recoil poses; the main first-person camera and secondary PIP enable the appropriate variant independently. Short tracer visibility avoids leaving a long beam attached after a shot. Existing authoritative hit/damage resolution is unchanged; its flat-plane limitations remain.

## Verification

Ten planting/provenance regressions and three Babylon NullEngine muzzle regressions pass. These cover carrier survival through staggered buys (pistol, normal, side swap and overtime), real full-step plants at both sites, dropped-bomb recovery, threat-driven interruption/continuation, route-aware urgency, stale-report retreat, covering teammates, equipped-sidearm shot metadata, all fifteen weapon sockets, nested viewmodel transforms and camera-specific tracers. The director's six tests pass after replacing its stale >5 m look-ahead assertion with the currently authored 3.4 m camera setting; camera behavior was unchanged by that test correction.

Three final detailed-profile runs each cover 10,800 ticks / 360 simulated seconds. Carrier ownership and objective coordinates are checked every tick while carried; finite positions, bounds and physical collision exclusion are sampled once per second, excluding elevated boost holds.

| Seed | Plants before | Plants after purchase fix | Plants after polish | Final sites | Physical samples |
| --- | --- | --- | --- | --- | --- |
| 1337 | 0 | 2 | 4 | A, A, B, B | 2,784 |
| 2026 | 0 | 3 | 4 | B, A, B, A | 2,844 |
| 73 | 0 | 3 | 4 | A, B, A, B | 2,824 |

All final runs reached round four without a missing carrier or sampled physical violation. This is a regression result, not a balance or professional-strength assessment. Browser-rendered visual acceptance remains unperformed.

Required `npm run check:game` passes: design checks, all 164 main test files, the separate three-case match simulation suite (including its ten-seed batch) and TypeScript. The parent runner reports test files, so direct runs also establish the ten planting and three muzzle subtest counts above. `npm run build` passes (Vite 7.94 seconds) with the existing >500 kB chunk warning. `git diff --check` passes.

Local artifacts: `.local-tools/fps-planting-audit.mjs`, `fps-planting-before.jsonl`, `fps-planting-economy-fix.jsonl`, `fps-planting-final.jsonl`, `fps-planting-focused.log`, `fps-muzzle-focused.log`, `fps-plant-muzzle-game.log` and `fps-plant-muzzle-build.log`. These are diagnostic artifacts, not published player evaluations.

Affected code: `fpsLiveEconomy.ts`, `fpsLivePlanning.ts`, `fpsLiveBrain.ts`, `fpsLiveSimulation.ts`, `fpsLiveViewer.ts`, `fpsLivePlanting.test.mjs`, `fpsLiveMuzzle.test.mjs` and `fpsBroadcastDirector.test.mjs`.

Official/historical matches, career writes, private DNA, aliases, detailed profile provenance, inert Economy Judgment, `/evolution/game-modes` and owner-started Colab asset gates remain preserved. Unrelated dirty workspace changes are retained.
