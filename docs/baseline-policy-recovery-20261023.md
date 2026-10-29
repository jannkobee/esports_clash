# Gameplay baseline and learning foundation

Owner clarification, 2026-10-23: policies are the baseline, with ML evolving through
many matches. This supersedes the ordinary-match full-command cutover. ML is not
globally disabled or deleted. `/root` owns controller selection, demonstration
export, imitation fitting, diagnostics, online source compatibility and checks;
no other agents were delegated work. Character assets are outside this change.

## Evidence and audit

The actual live arena is `EsportsClash.Web/src/components/AramMatchView.tsx`,
`updateAramSimulation`, not the simplified `matchSimulationEngine.ts` used by
some tests. Before this repair its arena branch called `executeArenaController`
and returned before the surviving coordinated decision loop. The same per-team
actor-presence check also bypassed authored recall and ward policy. Thus most
policies were **disconnected from ordinary matches**, not deleted.

`git show 597d1b5:EsportsClash.Web/src/components/AramMatchView.tsx` contains the
older `chooseMacroAction`, recall, `chooseBaseDefense`, risk-based diving and
`trainAdaptivePolicy` path and lacks the arena-controller early return. History
for that component names `597d1b5`, `7460d77`, `e9f035e`, `f7d43fd`, `653ec9a`.
The concrete-command cutover is in this workspace's pre-existing uncommitted
changes; it cannot honestly be attributed to an invented historical commit.
No Git revert was used; all unrelated owner changes remain.

| Policy | Actual source and current recovery | Verification source |
| --- | --- | --- |
| Farming, route locks, useful progression | Surviving `macroFarmRules.ts`, `waveClearRules.ts`, `chooseCommittedActionTarget` and the minion/camp executors are reconnected. Danger, allied fights and urgent structures release camp intent. | `macroFarmRules.test.mjs`, `waveClearRules.test.mjs`, real live matches |
| Last hits and creep attack timing | Existing lane targeting, minion HP and `creepAttack` release validation remain. No attack-timing changes. | `creepAttackTiming.test.mjs`, lane/wave tests; aggregate live CS does not prove every last-hit edge case |
| Engagement and target selection | Existing `combatDecision.ts`, `fightSurvivalRules.ts`, `tacticalOutlook.ts` and target stickiness run again, including contextual numerical disadvantage. | Combat/survival/outlook tests |
| Unique abilities and combinations | Existing `shouldUseSkill`, `shouldUseSecondSkill`, `shouldUseUltimate`, kit-specific execution and `avatarCombos.ts` run again. | Combat/ability/kit tests; no claim of full mastery of all kits |
| Retreat and survival | Existing risk assessment, `retreatRouting.ts`, bush safety and fight commitment run again. | Retreat, survival, tower and commitment tests |
| Recall and recovery | Existing recall-intent/resource checks, interruptions, safe positioning and well defense run again. | Recovery/base defense tests and actual-match outcomes |
| Team support and grouping | `chooseNearbyFightingAlly`, availability filtering, `teamTempoRules.ts`, `teamIntentDecision.ts` and useful approach limits run again. | Team tempo/intent/perception tests |
| Objective start/contest/secure | `objectiveRules.ts` and the Dragon/Golem branches run again, including champion-first contest and existing execution thresholds. | Objective/Golem tests; no new health thresholds |
| Structures and finishing | Surviving residual push and Nexus finishing run again. `structureProtection.ts` still requires outer -> inner -> Nexus turret -> all three barracks -> Nexus. | Structure protection, residual push, Nexus tests and full matches |
| Emergency base defense | `baseDefenseRules.ts` is reconnected, including threat hysteresis, recovery interruption and return to normal priorities. | Base defense tests and full-match progression |
| Stable intentions | Existing action failure/retry handling, bounded macro commitments and fight/retreat commitments remain the sole arbitration/execution path. | Action recovery, macro/utility/commitment tests and repeat control |
| Visibility and mechanical legality | Existing perception, observed enemy cooldown memory, range, mana, CC and authoritative spell/attack validation are preserved. | Perception/cooldown/combat/ability tests |

This audit identifies an architectural bypass. Before/after match outcomes alone
do not isolate each individual policy's causal effect. Historical v4/v5 teachers,
v6 kit facts, frozen rewards, checkpoints, study images, reserved seeds, Colab,
and training histories were not edited or restarted.

## Authoritative pipeline

Ordinary local spectator and peer simulations default to `hybrid`: existing
perception -> survival/recovery/defense/tempo evaluation -> utility and commitment
selection -> existing kit-specific execution -> reassessment. The existing
bounded adaptive preference learns from completed matches; it cannot mint a
candidate, change an emergency priority or bypass mechanical validation. Supplied
macro releases must be qualified outside explicit DEV experiments. An arena
command actor cannot accidentally execute in the macro action space.

`gameplayMode="baseline"` freezes ML off for an ordinary component instance.
The private evaluator also accepts `evaluationController="baseline"` (or
per-team controllers). That path never uses adaptive scores or loaded actors and
never updates adaptive weights. `arena` and `legacy` remain explicitly selectable
historical research modes. Ordinary component callers cannot silently choose
full arena control by supplying an unqualified actor.

The existing lightweight adaptive learner is still experimental: its small
preference is **not** evidence of improved gameplay and is not the global PPO
checkpoint registry. Global neural promotion retains its existing independent
full-match gates. A failed candidate must not replace that registry's champion.
The ML-off baseline remains directly selectable for comparisons and fallback.

## Demonstrations and imitation

Sampled macro records now contain the zero-policy baseline choice, actual choice,
ML proposal, candidate availability/priority/utilities, visible-state 20-input
macro observation, context/commitment and subsequent own measurable outcomes.
They are diagnostics, not fictitious counterfactual outcome labels. Private
`baselineLearning()` exports up to the existing 10,000-record training ring;
this is bounded collection, not an unlimited match dataset. Older records can be
evicted. The public viewer receives no private execution hook.

`scripts/train-baseline-imitation.mjs INPUT NEW_CHECKPOINT HELDOUT_SEED` fits a
deterministic 20/16/5 `macro-actor` from winning baseline demonstrations with at
least two available same-priority actions. Duplicate worlds and censored games
are excluded. Held-out seeds cannot fit the model. This is a deliberately small
macro curriculum, not a new per-avatar teacher or full concrete-command clone.
The checkpoint's `policy` uses the existing `marl.py` `initialize_actor` format,
so a separately admitted fresh macro PPO study can continue with actual on-policy
matches. The CLI does not publish or overwrite a foundation/active model.

Imitation accuracy is teacher agreement, not competitive improvement. More
independent drafts/maps/opponents, dataset coverage, actual PPO training and
fresh complete seeded comparisons are required before promoting that actor.
The existing v6 arena study is retained unchanged; it does not silently switch
action spaces or train off baseline demonstrations as if they were on-policy PPO.

## Observability and online compatibility

`GameplayEvidence` observes own execution at the existing half-second sampling
boundary. Reports contain intent/target transitions, recall starts, stationary
no-progress actor-seconds and retreat-exit survival diagnostics. Passive gold
alone does not disguise inactivity. Recovery/channels are excluded from stationary
stall counts. These are descriptive counters: a retreat exit is not proof of
lasting safety, and a stationary interval can be intentional. Last 500 events
are retained. No telemetry draws game RNG or writes game state.

New online catalog exports identify `baseline-hybrid-v1`; allocation/worker code
pins `hybrid` and refuses an inconsistent controller. Existing installed
`arena-command-v1` allocations keep their historical controller. This source
change does not hot-swap ongoing matches, rewrite installed catalogs or restart
services/frozen learning workers. Local deployment requires a newly source-pinned
online catalog/worker installation; it is not claimed by compilation.

## Verification and limits

Executed checks and real-engine evidence are recorded alongside this guide.
`scripts/verify-baseline-live.mjs` uses the private compiled real arena at exactly
1/30 second per step, not the simplified simulator or a faster gameplay timestep.
The output is known-seed engineering evidence, never independent promotion data.
The repeat checks full world fingerprints and game RNG checkpoints. It records
natural terminal/censored status, kills/deaths, CS, gold, damage, structures,
intent evidence and macro comparisons. No fabricated terminal fixture is used.

First-source runs: baseline seed 71001 naturally finishes at 725.9667 seconds;
its repeat finishes at the same time. Seed 71002/draft 1/swapped naturally finishes
at 878.3667 seconds. Empty-preference hybrid seed 71001 finishes at 725.9667
seconds. The final instrumented source reproduces all four baseline/repeat/hybrid
endings exactly, with zero browser exceptions and exact repeated full-world/RNG
checkpoints. Source hash and compact results are in
[verification](baseline-recovery-verification-20261023.json); exact full records
are losslessly compressed in `baseline-final-live-20261023.json.gz` (decompressed
SHA-256 `aa15aad3f2eed962722476791e7313f735d2d1a9ff7ba5e6de5533368aaeb18b`).
The compressed evidence reader and trainer preserve the original byte hash.

Executed final checks: 534 game tests, three additional simulation tests, design
validation, TypeScript and production build pass. The existing large-bundle and
build-timing advisories remain. Online/intelligence API tests pass 21/159
assertions; the strengthened qualification-manifest test separately passes
1/16 assertions. All five independent-promotion/registry tests pass, including
degraded/unstable/leaked/tampered evidence rejection. Worker JS and PHP syntax
checks pass. No Docker access or service restart was required for these checks.

| Final world | Time | Kills (both teams) | Last hits | Destroyed structures |
| --- | ---: | ---: | ---: | ---: |
| ML off, 71001/draft 0 | 725.9667s | 68 | 233 | 9 |
| Exact repeat | 725.9667s | 68 | 233 | 9 |
| ML off, 71002/draft 1/swapped | 878.3667s | 78 | 273 | 9 |
| Hybrid, initially empty preferences | 725.9667s | 68 | 233 | 9 |

The hybrid records one completed lightweight adaptive update. Same-state macro
comparisons have zero differences with initially empty weights, as expected.
There are zero sampled illegal **selected** residual macro actions. Separately,
342/337 samples have no residual macro choice; that field does not measure
earlier survival/defense execution or fallback movement. Do not count absence of
a choice as an attempted illegal command. Stationary no-progress diagnostics
total 659.37/921.30 actor-seconds across the two worlds; some stationary time is
legitimate. Intent changes total 3,434/3,725. These diagnostics warrant contextual
review and do not establish that all oscillation/stalls are solved.

The offline imitation command actually ran: 420 independent-world training
examples and 525 held-out-seed examples; training agreement 86.90%, held-out
agreement 82.48%, held-out cross-entropy 0.4580. The new
`baseline-imitation-checkpoint-20261023.json` validates as the existing live/PPO
macro-actor format, remains `qualified: false`, and was not activated. The
synthetic fitter test also verifies reproducibility and contextual action
learning. No new PPO campaign was launched from this checkpoint. Two independent
baseline worlds are insufficient for promotion or a competitive win-rate claim.

No professional competence, improved win rate, automatic new-kit mastery, or
completed long-run learning campaign is claimed. Further games must measure
those outcomes rather than infer them from loss or update counts.
