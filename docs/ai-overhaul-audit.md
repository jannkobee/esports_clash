# AI overhaul audit — 2026-10-14

## Baseline before decision migration

The working tree already contained the recent tower-risk, Nexus, ability-ratio and Conflux changes. They have not been reverted. The user confirmed that the latest risk-based tower rules supersede the historical standalone Abort Dive requirements.

Initial `npm.cmd run check:game`: 274 passed, seven failed (281 reported tests; two files could not load). Initial build: three TypeScript errors. Original output is in `ai-baseline-check.log` and `ai-baseline-build.log`.

| Classification | Evidence | Resolution |
| --- | --- | --- |
| Recent unverified integration | Ability catalog and Nexus test modules could not resolve extensionless runtime imports in Node | Explicit `.ts` runtime imports, including presentation dependencies |
| Recent planner regression | Conflux assigned `indexOf=-1` higher priority than preferred plans; comparator was not antisymmetric | Rank unlisted plans last; urgent defense precedes optional personality preference; symmetric tie-break |
| Existing fixture errors | IQ comparison reused mutated target focus | Clear prior focus for independent IQ comparison; retain live stickiness |
| Stale fixture | Roster asserted 63 despite kovi addition | Verify complete source roster and exactly one kovi |
| Stale fixture | Ten Conflux cooldowns required to be distinct | Validate positive finite cooldowns; preserve unique recipe/ID checks |
| Newly exposed stale fixture | Movement audit omitted Raijin's authored dash | Add Raijin to expected dash list |
| Recent type errors | Extra turret-hold argument, impossible personality action, overly broad predicate | Match current APIs; composed recovery uses existing regroup action |
| Architecture | Sequential macro branches, repeated target selection, unconditional reachable candidate flags | Requires incremental migration; not fixed by passing tests |
| Rendering | No rendering defect established | Live spectator smoke passed at five viewport sizes |
| Balance | No balance defect established | No combat-stat tuning performed |

After corrections: all 285 tests passed. Build completed, with existing large-bundle warning. Live browser fixture passed viewport geometry, renderer fallback/restoration, playback, tabs, item inspection, insights, exit, and all ten Conflux spellbook entries. The timed live Conflux sample recorded invoked casts. These are smoke checks, not proof of every movement collision or full-match AI quality.

## Measured headless sample

`node --experimental-strip-types scripts/ai-baseline.mjs` records five seeds (101–105), each with both draft side assignments, at the existing fixed timestep. Ten of ten matches completed naturally within the 1,200-second observation cap: six Blue wins and four Red wins; mean duration 513.6467 seconds. Mean observed tick cost including metric collection was 0.08364 ms on this machine while other verification was running. This small sample is not a balance conclusion or an isolated performance benchmark.

Full per-match damage, deaths, dive counters, structure-range deaths, recalls and timing are in `docs/ai-baseline.json`. Action/animation transitions and recall interruptions are explicitly labeled proxies. Headless teamfight durations, contest/conversion opportunities, Nexus opportunity counts, engagement cancellations, path failures and unnecessary farming are currently uninstrumented, not zero. The runner does not fabricate a gold-lead winner at its time cap.

## Responsibility and conflict map

| Owner | Current responsibility and boundary |
| --- | --- |
| `decisionPerception.ts`, `cooldownKnowledge.ts` | Actor-visible champions and witnessed cooldown history; no hidden-position inputs should escape this boundary |
| `AramMatchView.tsx` | Live fixed tick, macro branch ordering, actual casts/dashes/projectiles/CC/summons/items/structures; mixes candidate generation with execution |
| `combatDecision.ts`, `avatarCombatRoles.ts`, `avatarCombos.ts` | Target scoring, opening control, ability eligibility, combo practice; target selection mutates sticky focus |
| `decisionCommitment.ts` | Fight/retreat hysteresis and emergency reconsideration |
| `decisionActionRecovery.ts` | Per-kind target commitment, bounded retry history, action progress; does not arbitrate across action kinds |
| `actionDecisionRules.ts`, `teamTempoRules.ts` | Recall continuity, real fighting allies, proactive engage, follow-up, relic/wave/staging preferences |
| `towerDiveRules.ts` | Risk-based tower engagement and safe perimeter/bush helpers; no separate abort controller |
| `nexusFinishRules.ts`, `structureSiegeRules.ts` | Bounded legal finish prediction and authored basic structure damage |
| `baseDefenseRules.ts` | Threatened-structure selection, rally/leash, recall routing; emergency defense must preempt optional work |
| `objectiveRules.ts` | Vision/start/contest/execute/post-objective policy; champion-first above 32% remains authoritative |
| `macroFarmRules.ts`, `waveClearRules.ts` | Known camps, rewards, conversion/wave preferences; cannot override a selected finish |
| `retreatRouting.ts`, `terrainRouting.ts` | Safe retreat destinations, cached static geometry, route progress; not a competing strategic controller |
| `playerPersonality.ts`, `engagementOutcomeRules.ts` | Bounded decision preferences and proven social outcomes; no stat changes |
| `kaelenAbilities.ts`, `kaelenSpellRuntime.ts` | Adaptive Conflux planning, FIFO invocation, authored timed effects; preserve separate spell planner |
| `matchSimulationEngine.ts` | Simplified headless combat; shares some rules but not the full live executor |
| `simulationPresentation.ts` | Presentation cadence and tick slicing; no gameplay policy |

Specific conflicts to migrate: normal recall executes before objective candidates exist; optional relic routing occurs before later macro selection; several target selectors mutate focus within one decision; `actionCandidate` labels every destination reachable without consulting the router; live and headless do not execute equivalent ability mechanics. A full live-core extraction and state/RNG parity harness are prerequisites for credible policy optimization. No trained policy or reinforcement learning is authorized for deployment by this audit.

## First decision-interface migration

`utilityDecision.ts` now owns deterministic candidate validation, normalized component scoring, priority tiers, context-sensitive commitment arbitration, and bounded explanations. Every factor is bounded; costs cannot become negative bonuses; non-finite values reject the candidate. Mechanical/policy rejection precedes every score. Emergency and finish tiers outrank optional work only after the owning evaluator validates the candidate. Stable caller order resolves ties without side/ID bonuses or RNG. No candidate invents a cast or changes damage, range, mana, cooldown, or movement.

`decisionActionRecovery.ts` now delegates existing champion/minion/structure target arbitration to that selector. This is a behavior-preserving migration: current policy preference supplies the initial normalized score, the 12-candidate bound remains, and existing legality, failure-retry, target commitment and progress ownership stay intact. Optional normalized components are available for subsequent candidate-provider migrations. A live caller must explicitly provide these components; the existence of the interface is not evidence that every macro branch already uses it.

Selection explanations are available from the shared selector; its high-frequency compatibility adapter disables trace allocation. Existing live personality telemetry is unchanged. There is no new parallel persistent log, global match state, random source, controller, or ML dependency.

### Verification after migration

- `npm.cmd run check:game`: 295/295 tests, then 3/3 deterministic simulation tests, and TypeScript passed.
- `npm.cmd run build`: passed; existing bundle-size warning remains.
- `scripts/benchmark-decision.mjs`: 256 comparisons match the archived pre-migration target selection. Twelve-candidate median selector cost: old 0.0004044 ms/call, migrated 0.0017599 ms/call; estimated added selector cost for 50 calls/tick is 0.06777 ms. This measures selection only and does not establish a full live-frame budget.
- Live controlled proactive engage: ten signaled, ten fighting, ten champion intents. Thirty-simulation-second observation: Blue minimum alive four, Red three, three total deaths. No predetermined winner was asserted.
- Live ability fixtures: Valkira and Astra attacks wait for windup; Astra damage follows flight at 1x and 4x; Hweilin wave damage waits for collision, spends mana/cooldown, and occurs once. Kindra range/smoke/heal/health-floor assertions passed. These are representative fixtures, not the requested full 40-scenario matrix.
- Conflux timed live sample and all spectator checks passed. Browser fixtures no longer create the removed dive-abort property.

### Changed files in this work

- `utilityDecision.ts`, its tests, `decisionActionRecovery.ts`: shared selection interface and first live consumer.
- `kaelenAbilities.ts`, `kaelenSpellRuntime.test.mjs`: verified plan-order defect and emergency-priority regression coverage.
- `abilityCatalogAudit.ts`, `abilityPresentation.ts`, `nexusFinishRules.ts`: Node-compatible runtime imports.
- `towerDiveRules.ts`, `playerPersonality.ts`, `AramMatchView.tsx`: the three pre-existing TypeScript integration errors.
- `abilityCatalogAudit.test.mjs`, `avatarCombatRoles.test.mjs`, `cooldownKnowledge.test.mjs`, `equalizedMode.test.mjs`, `kaelenAbilities.test.mjs`: corrected stale or state-contaminated fixtures.
- `scripts/ai-baseline.mjs`, `scripts/benchmark-decision.mjs`: reproducible observation and selector equivalence/cost measurement.
- `scripts/combat-engage-browser-fixture.mjs`, `scripts/phase6-browser-fixture.mjs`: stop creating removed abort state.
- `AGENTS.md`, `.gitignore`, both gameplay documents, this report and `ai-baseline.json`: approval reconciliation, disposable-browser exclusion, audit and measurements.

The working tree also contains the user's earlier uncommitted changes listed at the start of the session; the full `git diff` is not a list of changes attributable only to this overhaul pass.

## Remaining scope — not complete

| Requested area | Actual status |
| --- | --- |
| Baseline and architecture | Recorded failures, measured limited headless sample, ran representative live fixtures; missing metrics explicitly identified |
| Unified decisions | Shared interface plus existing per-kind target arbitration migrated; full cross-action macro selection remains unfinished |
| Team coordination | Existing IGL/psychology/follow-up preserved; new shared intent and dynamic assignment coordinator not implemented |
| Spatial intelligence | Existing terrain/retreat/area-control logic preserved; general influence map not implemented |
| Tactical prediction | Existing Nexus/tower/fight estimates preserved; general candidate lookahead not implemented |
| Tactical memory | Existing witnessed cooldown history preserved; broader bounded opponent adaptation not implemented |
| Personality | Existing live preference behavior preserved; new scoring interface supports bounded components but providers are not all migrated |
| Post-fight conversion | Existing tempo/objective/Nexus policies preserved; unified conversion arbitration not implemented |
| Telemetry | Selector explanations available; full candidate/outcome telemetry and required quality metrics remain unfinished |
| Headless/live parity | Explicitly absent; headless lacks full live execution and does not use this target-commitment adapter |
| Optimization and learning | Not ready for trustworthy training; no policy tuned or deployed |

The full overhaul acceptance criteria are **not met**. The next implementation dependency is extracting candidate generation and one selected macro action from `AramMatchView` while preserving executor behavior, followed by the requested coordination/spatial/prediction/memory integrations and live scenario matrix. Passing compilation or this initial adapter does not complete those stages.
