# Shared FPS tactics, decisions and map planning review (11 November 2026)

The owner requested reviewing and improving shared tactical architecture, the decision engine and map-aware planning. This pass changes the browser-local live FPS exhibition. Official contextual simulations, historical replays and MOBA remain on their existing paths. `/root` owns this pass; no agents or asset processing were used.

## Findings and corrections

| Finding | Resulting behavior |
| --- | --- |
| Approach scoring, recoverer election and defuser election used straight-line distance through walls. | Shared route estimates measure collision-safe paths. Approaches consider travel time, exposure along the route, teammate occupancy and intended destinations. Objective roles use reachable travel time, kits and real channel progress, with deterministic ties. |
| An individual defender could call a save while a teammate with a kit could still defuse. The actual channel independently selected whoever arrived first. | Retake viability is checked across living teammates. Cover players continue supporting a viable defuser, and actual channel admission uses the same election as tactical planning. A feasible active channel retains priority; an impossible channel can yield to a viable kit. |
| Reinforcement/rotation destinations could continue after their order expired. | Shared order activation checks enforce both acknowledgment time and expiry. Expired calls release responders, stop influencing boost decisions and allow new quiet information probes. Caller-death handling and the opposite-site guard remain. |
| New evidence could leave an actor following the same exposed path indefinitely. | Quantized personal-evidence changes invalidate cautious paths at a bounded cadence of at least 0.8 seconds. Quiet decisions retain their paths. Fresh route exposure can interrupt an approach commitment even when its destination is quiet. |
| Defuse urgency and movement urgency used different fixed clocks. | Route-aware urgency releases retreat, peek, clearing and slow crouched travel when the available defuse margin is small. Weapon/combat timing, collision and actual channel duration remain authoritative. |
| Navigation accepted destinations outside the existing movement clamps and included grid rows at z = ±44. | Walkable destinations and graph nodes respect x = ±34 and z = ±43. Outlying destinations are projected into legal space. |
| An actor could be physically legal but inside navigation's additional 0.08 m clearance margin, making every route appear unreachable. | Departure connections may use the real 0.35 m actor radius; later graph edges retain the extra navigation margin. Truly unavailable approaches return no selection and safely reassess rather than throwing. The longer simulation exposed this failure before the final correction. |
| Device recovery and defusing checked distance without checking the wall between actor and device. | Both require a clear geometric interaction segment, including across the thin A loggia wall. |

## Architecture

- `fpsLivePlanning.ts` owns reusable route measurements, decision-local route caching, objective election and evidence signatures. It accepts static map geometry, allied state and the deciding actor's bounded beliefs. It never receives world opponents, secret orders or future outcomes.
- `fpsLiveBrain.ts` retains role/clock/knowledge scoring and bounded close-call randomness. Map-route data is optional for isolated policy callers, and the live engine supplies it. Unreachable routes cannot retain a commitment; clock-feasible options take priority when available. Execute calls retain a valid short commitment rather than forcing a fresh random choice every decision.
- `fpsLiveTactics.ts` owns the shared information-order contract and activation rule. `fpsLiveSimulation.ts` composes those policies with perception, identity, actual movement and objective mechanics.
- Allied intended goals provide a soft destination reservation. They do not reserve physical space, override collisions, or reveal hidden enemies. Defender probes and reinforcements rank responders using map routes while preserving site guards.

## Verification

- Final required `npm run check:game` passes: design-invariant checks, all 162 test files, the separately repeated match-simulation suite (three cases, including the ten-seed batch), and TypeScript. This environment's parent test runner reports file totals rather than aggregating child subtest totals.
- Focused brain/intel/tactics/profile coverage: 100 tests pass (28 brain, 13 intel, 34 tactics and 25 profile). Twelve new brain regressions were added. Initial broad checks exposed the navigation-margin crash and an overly broad crouch release; both were corrected, and the final tactical/profile files pass.
- `npm run build` passes (Vite 13.51 seconds). The existing warning about chunks over 500 kB remains. `git diff --check` passes.
- Final fixed-step live soaks: 9,000 steps / 300 simulated seconds each. Living actors were checked once per simulated second for finite coordinates, bounds and exclusion from physical walls; elevated boost holds were excluded from the ground-contact assertion. Both reached round four with active combat and plants, and no sampled physical violation.

| Seed | Skill path | Score (blue–red) | Shots | Kills | Plants |
| --- | --- | --- | --- | --- | --- |
| 421 | Legacy adapter | 0–3 | 159 | 20 | 3 |
| 99017 | Detailed profiles | 1–2 | 216 | 24 | 4 |

Artifacts: `.local-tools/fps-planning-soak.mjs`, `fps-planning-soak.json`, `fps-planning-soak.log`, `fps-planning-brain.log`, `fps-planning-profiles.log`, `fps-planning-build.log` and `fps-planning-game.log`. These are local diagnostic artifacts, not published player evaluations.

Regression coverage includes the real A-loggia route detour; unreachable routes; teammate destination spreading; fresh path exposure; active channel/kit feasibility; covering a viable teammate; shared actual-channel election; early route urgency; order expiry; unchanged-goal path invalidation; navigation bounds; the exact wall-margin position observed in the soak; and wall-blocked objective interactions.

## Limits and preserved boundaries

Travel time uses nominal run speed and the authored navigation grid. It is an estimate, not a promise that future congestion, recoil settling, blindness or combat will allow an objective to finish. Route exposure samples remembered threat positions and uncertainty; it does not predict unseen enemy motion. The planner remains heuristic and does not establish professional-strength play or balance. No browser/visual acceptance, official activation, deployment or production-asset qualification is claimed.

Preserve personal vision and sampled acquisition, delayed deduplicated reports, stable world-space aim, private DNA, pinned skill provenance, inert Economy Judgment, parody aliases, careers and historical results, MOBA availability and owner-started Colab-only asset gates. Unrelated dirty broadcast, theme and API work is retained.
