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

## Residual macro selection migration (2026-10-14)

`macroActionDecision.ts` now adapts prevalidated live candidates to the shared utility selector. It adds a context-bound 0.65-second commitment and covers the residual choices reached after the existing Nexus, urgent-defense, objective, retreat, recall, and relic branches: fight, dedicated wave clear, regroup, farm, and lane push. A higher-priority valid emergency can interrupt the residual commitment.

`AramMatchView.tsx` gates farm, fight, wave-clear, and regroup execution with that selected action. Existing candidate providers still own all hard conditions, including visibility, lane safety, terrain, targetability, resources, action recovery, turret risk, and objective rules. Objective starts, safe recall/relic routing, Nexus finishing, and base defense remain earlier policy/execution paths and are not falsely described as migrated.

Focused macro tests cover priority, failure gates, determinism, and interruption. `npm.cmd run check:game` passed 300 game tests and three deterministic simulation tests; TypeScript passed. Production build passed with the existing chunk-size warning. The controlled live 5v5 fixture passed: all ten actors committed, two deaths occurred during the sample, and no legacy abort state appeared.

## Recovery and objective-start migration (2026-10-14)

`macroActionDecision.ts` now includes prevalidated `relic` work. In the live loop, recall/retreat and relic candidates are selected only after their owning policies validate safety. Emergency danger or defense recall outranks a tactical relic; a rejected recall leaves a legal relic selectable. The recovery commitment is context-bound for 0.45 seconds.

Dragon and Gravemarch start/finish candidates now cross the same selector after the existing objective evaluators validate wave priority, vision, health, contest, combat, defense, and Nexus conditions. The migration retains objective finish priority, normal-start tactical priority, and the existing champion-first contest behavior above 32% boss health. It does not provide live/headless parity, a shared team intent system, influence maps, prediction, memory, or learning.

Added macro regression coverage for recovery recall/relic priority. `npm.cmd run check:game` passed 301 game tests, three deterministic simulation tests, and TypeScript; `npm.cmd run build` passed. The controlled browser fixture passed at five viewport sizes; its proactive 5v5 sample recorded all ten actors fighting, two deaths, and no legacy abort state. The existing production chunk-size warning remains.

## Shared team-intent migration (2026-10-14)

`teamIntentDecision.ts` adds a bounded shared-team preference, using the same deterministic utility tiers as macro selection. It accepts only prevalidated defend, fight, objective-finish, regroup, push, and hold calls and retains a legal context for 0.65 seconds. Live state stores one call per team. The call only contributes to legal local residual-macro scores: it cannot manufacture a global target or bypass any execution owner. Supports map a fight call to legal regroup/peel preference, while other roles map it to legal fight preference.

Focused tests cover emergency/finish priority, release on invalidation, and role mapping. `npm.cmd run check:game` passed 304 game tests, three deterministic simulation tests, and TypeScript; `npm.cmd run build` passed with the existing production chunk-size warning. The controlled browser fixture passed at five viewport sizes with all ten actors fighting, two deaths, and no legacy abort state. This does not establish coordinated live/headless parity or deliver influence maps, prediction, generalized memory, or learning.

## Spatial influence migration (2026-10-14)

`spatialInfluence.ts` provides bounded, deterministic threat and cover reads from live local champions and structures. The live caller supplies the read only as a post-gate score contribution to retreat ranking and existing objective, fight, regroup, and push candidates. No hard gate, range, target, route, movement, resource, damage, or tower/objective rule moved into the field. It is not a generalized pathfinder, prediction system, or memory system.

Per the user's explicit deferred-validation direction, no test, build, browser, benchmark, or verification command has run after this phase. The remaining acceptance criteria are still incomplete.

## Tactical outlook migration (2026-10-14)

`tacticalOutlook.ts` derives bounded travel, survival, support, and pressure signals from current local state and the read-only spatial approach. Existing legal fight, Dragon, Gravemarch, and push candidates consume those values as score inputs only. It has no combat simulation, fog inference, cooldown prediction, RNG, target creation, or execution authority.

Per the user's explicit deferred-validation direction, no test, build, browser, benchmark, or verification command has run after this phase. The remaining acceptance criteria are still incomplete.

## Visible opponent tactical-memory migration (2026-10-14)

`opponentTacticalMemory.ts` keeps only short-lived per-viewer observations: visible homeward movement and observed damage focus. The live loop resets it per match and uses it solely as bounded fight/regroup score input after existing legal candidate gates. It introduces no fog inference, hidden cooldown data, speculative target selection, or mechanics authority.

Per the user's explicit deferred-validation direction, no test, build, browser, benchmark, or verification command has run after this phase. The remaining acceptance criteria are still incomplete.

## Post-fight conversion migration (2026-10-14)

`postFightConversion.ts` ranks only prevalidated post-win push, objective, reset, farm, and regroup options. The live loop uses the selected conversion as a bounded residual-macro score contribution. No hard gate or executor moved into this module.

Per the user's explicit deferred-validation direction, no test, build, browser, benchmark, or verification command has run after this phase. The remaining acceptance criteria are still incomplete.

## Bounded decision telemetry migration (2026-10-14)

`aiDecisionTelemetry.ts` keeps at most 240 residual macro diagnostic records in memory for final review. Records include time, actor/team, selected context, and candidate availability/reason. They are strictly observational and cannot alter simulation behavior.

Per the user's explicit deferred-validation direction, no test, build, browser, benchmark, or verification command has run after this phase. The remaining acceptance criteria are still incomplete.

## Deferred final verification (2026-10-14)

`npm.cmd run check:game` passed 304 game tests, 3 deterministic simulations, and TypeScript. `npm.cmd run build` passed with the existing chunk-size warning. The controlled browser fixture passed across five viewports with ten fighters, two deaths, and no legacy abort state. Full live/headless parity, learning, and the broader requested scenario matrix remain unproven.

## Scenario-matrix evidence (2026-10-14)

Phase 6 live fixtures passed Valkira/Astra windup and one-hit timing at 1x/4x and Hweilin wave collision/resource behavior. Phase 7 passed Kindra hunt/smoke/respite values. A fresh normal fixture passed proactive 5v5 engagement, 30-second survival sample, spectator controls, and legacy-abort absence. The combined run's combat check correctly failed after deliberate Phase 6 mutations; the required fresh-fixture rerun passed. New score-layer quality, full scenario coverage, and live/headless parity remain unproven.

## New decision-layer scenarios (2026-10-14)

Five focused Node scenarios passed: spatial threat/cover reads, supported versus exposed outlook ranking, visible-memory expiry and unseen-attacker exclusion, and legal post-fight push selection without invented conversion. These verify isolated contracts, not full live quality or parity.

## Live/headless parity audit (2026-10-14)

`liveHeadlessParity.ts` records a source-backed scope inventory. Authored core combat/structure/objective/attribution rules are shared but execute in separate live/headless loops. Residual macro, team intent, spatial/outlook/memory/conversion scoring and browser/choreography are live-only; headless strategic reads are simplified. Headless reports are explicitly limited to their own deterministic executor and must not be used as live-AI parity evidence.

## ML preparation: telemetry export (2026-10-14)

Live match exports now carry bounded residual-macro telemetry. `decisionCalibration.ts` produces descriptive offered/selected counts for offline human review. This is not a trainer, optimizer, model runtime, or live policy input; it is preparatory evidence collection only.

Verification after export integration: `npm.cmd run check:game` passed 309 game tests, 3 deterministic simulations, and TypeScript; `npm.cmd run build` passed with the existing chunk-size warning. No local live export was available for calibration review because the browser-debug session was not running.
