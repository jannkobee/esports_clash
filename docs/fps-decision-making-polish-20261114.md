# Simulation decision-making polish — 14 November 2026

Owner requested a broad simulation polish including weapon/loadout choices, lineups, IGL decisions and shooting through smoke. This pass improves the browser-local live exhibition. Official recordings, manager-selected frozen T/CT responsibilities, the six attributes, personality dimensions, private DNA, aliases, careers, historical paths and owner-started Colab boundaries remain preserved. Map Fontessa v12 and live snapshot v19 are retained.

## Ownership

`/root` owns integration, weapon handling, speculative fire, lineup coordination, grenade-query indexing, final checks and this handoff. `economy_choices` owns economy planning, its new regressions and the full-scan/indexed grenade comparison. `igl_decisions` owns only `callFromInformation`, caller regressions and the later renderer-flag diagnosis. `utility_decisions` owns the information/post-plant utility consumers, utility regressions and the new pure lineup-decision helpers/tests. Simulation edits were serialized after concurrent patch application lost separate method changes; the final integrated checks and source receipts apply to the combined source. No asset processing, deployment, migrations or live-session mutations were performed.

## Buying and weapons

- Force buys retain armor money when an armored SMG kit is affordable. Objective kit funding comes before optional grenades. Pistol purchases cannot pay to downgrade a conserved stronger sidearm.
- Purchasing receives the team's own authored opening lane context. Stationary anchor/window/gallery holds measure visible entry/rally distances at actual floor/eye heights. Close holds can favor shotguns; appropriate medium choke holds can favor a heavy gun. Long gallery/window approaches retain range-appropriate choices. Mobile opening pairs do not become stationary choke holders. Flex sniper preference continues to come from the six attributes.
- Wealthy survivors can replace weaker primaries after team equipment is funded. Captured rifles and suitable specialist guns remain valuable. Only original retained primaries can enter this upgrade pass; new gifts/purchases cannot be silently replaced. Cancel the provisional ammunition-restock charge when replacing the old weapon. Donor cash, armor reserves and purchase metadata remain conserved.
- Actual current magazine/reserve values prevent charging unnecessary ammunition restocks.
- Drawn sidearms no longer inherit a primary sniper's bolt timer. Each holstered weapon retains its own next-shot deadline; restoring it cannot bypass that deadline. Switching clears obsolete scope state, respects draw time and conserves reload reservations.
- Snipers can defend with a loaded pistol during a close bolt cycle; shotguns can use a loaded sidearm for a distant duel. A loaded primary immediately replaces an empty backup when mechanically available. A short preference hold prevents repeated range-based swaps. An empty backup cannot displace a loaded primary.

## IGL and team calls

- An entry loss prompts reassessment rather than assuming the opposite site is empty. Redirects compare reported pressure and require the actual carrier plus reachable carrier/regroup travel, plant and setup time.
- Fresh legal C4 evidence can override stale-call strength hysteresis. Unknown opposite-site approaches keep an anchor; a collapse becomes available when every remaining opponent has been freshly located through legal sight reports.
- Repeated reports do not restart an otherwise unchanged command's issued/ready timing. Hidden opponent positions are absent from the call inputs.

## Utility and lineups

- Mid contacts now reach HE/incendiary decisions rather than returning after a failed smoke-lineup attempt. Damaging throws require sufficiently recent, precise evidence. Preparations and released teammate grenades reserve their intended targets to avoid duplicate spending.
- Incendiaries avoid observed or allied pending smoke; smoke does not casually replace existing useful fire. HE smoke clearance requires a ready teammate able to use the gap. Entry-support flashes require progress or a fresh cue instead of a stationary teammate alone.
- The elected defuser preserves the remaining route/channel budget. Post-plant grenades consider setup and flight against the explosion; decisions inspect observed or team-known hazards. Immediate acquired fights retain the weapon rather than pulling utility.
- Opening lineup selection includes route metres, braking, draw/pin, release, flight, bloom and the useful opening deadline. A forward support cannot return to spawn for a smoke that will bloom too late; another eligible nearby teammate can perform the setup.
- Execute lineups rank credible reported crossings, especially sniper angles, against reachable origin costs. Unusable launch routes cannot displace feasible setups. The chosen order remains stable during the utility phase.
- Processed/skipped lineups are tracked separately from `smokesSent`. Cancellation, missing inventory and an already observed cloud cannot invent a paid release. Existing physical release, real hand origins, inventory consumption and smoke-bloom coordination remain authoritative. No equip/pin/ready trajectory previews return.
- Smoke pooling uses the remaining uncovered techniques. Finished/skipped execute plans and expired opening windows cannot keep drawing teammates' spare smokes out of their pockets.

## Smoke fire and prefires

Recent sight/damage/credible gunfire evidence can authorize a bounded probe at its remembered point. The chosen evidence supplies the aim and floor height; a conflicting generic contact pointer or a hidden moving enemy cannot redirect it. Stale, vague and footsteps-only clues do not authorize exact fire.

Rifles/SMGs use short bursts with pauses and a six-round allowance per three-second episode; heavy guns allow nine, pistols/close shotguns two. Refreshed reports cannot reset the current allowance. Low magazines preserve ammunition, precision snipers keep their rounds, and weapon range/accuracy constraints still apply. Objective urgency, flash safety, reloads, draws, opaque geometry and allies along the full continuing firing ray can veto the shot. Invented speculative/decoy target IDs do not enter target-specific mechanics-learning selection. The real ballistic trace still determines any hit or miss.

## Verification

The initial full frontend run reached 381/382 tests; its only failure was an existing scenery shadow/pickability invariant. Reproduction found 75 of 365 returned casters had Babylon's default `receiveShadows=false`; non-pickability was already correct. Two flag additions in `fpsLiveScenery.ts` fix the detail-mesh default and gallery floor, preserving geometry, materials, transparency and the existing global material batching. No assertion was weakened. All 14 focused graphics/render checks passed.

- Final `npm.cmd run check:game`: **386/386 tests pass**, plus architecture synchronization, design/privacy checks and TypeScript. This includes **53 new decision regressions** across five files and **three new physics/index regressions**. The final test-only tightening of the collision fixtures also passed its dedicated 3/3 rerun after the full check; gameplay sources did not change. Log: `tmp/fps-decision-check-game-final.log`.
- Final `npm.cmd run build`: **passes**, Vite 3.53 seconds; the existing large-viewer-bundle warning remains. Log: `tmp/fps-decision-build-final.log`.
- Focused actual live-loop/physical-lineup tests verify real release, inventory/bloom timing, cancellation, target-independent speculative aim, per-gun cooldowns, and unchanged legal opening throws. Existing routing, elevation, animation/resource reuse and AUTO WIDE regressions are included in the full check.

The first three-seed audit passed all invariants over 54,000 ticks, but recorded a 122.43 ms tick in seed 1337. A replay reproduced 104.25 ms; method timing localized about 119 ms to `useInformationUtility` forecasting an attempted smoke near B. Those forecasts still scanned every static solid on each physics step. Extended the existing immutable geometry index to grenade-step and grenade-sight candidates, preserving source order, radius and all exact slab/bounce/floor checks. The solver search and real flight are unchanged. Clarified the old solver comment: its 24 flight candidates apply **per style**, not to the entire style search.

Differential coverage compares **66 trajectories / 10,201 physics steps** and **488 sightline rays** against the frozen original full scan, with exact whole-grenade equality every tick. It explicitly exercises wall reversal, roof underside bounce, roof landing and the lower canal floor. No collision simplification, moved detonation point, reduced fixed-step backlog or renderer work-budget change was used. Initial audit and diagnostic evidence remain in `tmp/fps-decision-audit*`, `tmp/fps-decision-spike-diagnostic*` and `tmp/fps-decision-method-profile*`.

The final isolated indexed run passes **3/3 audits, 54,000 fixed ticks / 30 simulated minutes total**, seeds 17/42/1337, reaching rounds 6/7/8. Every tick audits finite/bounded positions, living collision, cash, magazine/reserve and grenade capacity. These are partial long-match runs, not three completed matches.

| Seed | Live CPU p99 | Maximum tick | Final round | Shots |
| --- | ---: | ---: | ---: | ---: |
| 17 | 9.91 ms | 33.11 ms | 6 | 433 |
| 42 | 10.28 ms | 29.91 ms | 7 | 558 |
| 1337 | 7.72 ms | 38.80 ms | 8 | 396 |

Round, score, event and shot totals match all three pre-index runs. Seven relevant source hashes match before/after the final run. Receipt: `tmp/fps-decision-final-audit-receipt.json`; detailed results/log: `tmp/fps-decision-index-audit.json` / `.log`. The old expensive utility-forecast sequence no longer appears among that replay's slowest ticks. Occasional CPU spikes remain, and these samples do not establish a universal speed-up, GPU FPS or all-device smoothness.

Final simulation SHA-256: `d731caeb9fe6b69e4bbe3bf91d2414ca3789e8351765e1a57e97bcb4baa95e06`; grenade physics/query SHA-256: `f0e66bd7f1b2c1f68b757e84b11e7db8a1f5299f7170316b20c551cf35195224`. The receipt retains all seven source hashes.

Changed gameplay sources: `fpsLiveSimulation.ts`, `fpsLiveEconomy.ts`, `fpsLiveTactics.ts`, new `fpsLiveLineupDecisions.ts`, `fpsLiveGrenades.ts`; `fpsLiveLineups.ts` has a comment clarification. Two scenery flag additions are in `fpsLiveScenery.ts`. New regression files: `fpsLiveCombatDecisions.test.mjs`, `fpsLiveCallerDecisions.test.mjs`, `fpsLiveEconomyDecisions.test.mjs`, `fpsLiveUtilityDecisions.test.mjs`, `fpsLiveLineupDecisions.test.mjs`, `fpsLiveGrenadeIndex.test.mjs`. Unrelated pending work remains preserved.

These are bounded decision heuristics and structural/CPU checks. They do not establish professional competitive intelligence, balance, rendered GPU FPS, visual acceptance or universal elimination of stalls. A fresh exhibition is required to load the new in-memory simulation.
