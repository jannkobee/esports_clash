# Team-outcome learning and complete terrain checkpoints

The preceding action-context candidate changed six valid fresh decisions but failed its exploratory gate. Its actor-only target missed team consequences, and seed 128 failed exact-state restore. This phase fixes the reproduced checkpoint defect and evaluates a separately versioned team-outcome model. It does not promote an experimental policy into normal games.

## Reproduced checkpoint defect

An opt-in `--checkpoint-state` dump captured the scout and failed first replay for seed 128, draft 1, swapped. Exactly two values differed: jungle camp 7's X/Y position. Scout position was `(1859.4780692336833, 520.7970395970993)`; replay position was `(1860.5437212785323, 522.499095117462)`. The terrain router keeps a WeakMap keyed by actor identity, retaining a route goal, waypoint cursor, best distance and stall hysteresis. Cloning actors without rebinding those caches made a chasing monster take a different step.

`terrainRouting.ts` now captures and restores independent route copies by stable actor ID. `arenaRules.ts` exposes these operations. `AramMatchView.tsx` includes every champion and jungle monster's cache in its tick-start checkpoint, rebinds it to the restored actor objects, and fingerprints it at predecision and followup. Static terrain graphs remain deterministic shared geometry; ordinary movement, path selection and speeds are unchanged.

The corrected seed-128 fixture passes all three thirty-second replay arms. All predecision fingerprints and task contexts match. Comparing its scouted world with the diagnostic-before scout, excluding the newly observed cache field, gives identical state/RNG. A unit regression exercises a moving goal inside retained-goal hysteresis, a cloned actor with a different cold route, restoration, 100 identical continuation steps, independent cache copies and explicit clearing. The old study's invalid seed remains invalid historical evidence; this known case is excluded from new training/evaluation.

Diagnostic artifacts: `ml-team-checkpoint-before-128.json`, `ml-team-checkpoint-diff-128.json`, `ml-team-checkpoint-after-128.json`. `serializePairedState` and the runner's explicit state-dump option support future field-level diagnosis without enabling per-tick traces.

## Fixed team reward target

`teamTaskOutcome.ts` records predecision and endpoint team snapshots separately from model features. These outcome labels may inspect all champions; no hidden opponent or future information is added to decision inputs. Snapshots record cumulative deaths on both teams (including deaths followed by respawn), total remaining structure HP, champion economic assets (gold plus full item/boots cost), summed living health fractions, Dragon Aspect ownership, living siege golems and Nexus survival.

The versioned `team-v1` proxy is fixed before collection:

| Component | Weight | Normalization |
| --- | --- | --- |
| Enemy deaths minus allied deaths during window | 0.55 | Clamped to [-1, 1] |
| Change in own minus enemy structure HP | 0.15 | 1,000 HP |
| Change in own minus enemy economic assets | 0.10 | 750 gold |
| Change in own minus enemy living health fractions | 0.05 | Two full health bars |
| Change in relative Dragon ownership | 0.025 | Clamped to [-1, 1] |
| Change in living siege-golem balance | 0.025 | Two units |
| Existing actor task reward | 0.10 | Original bounded task proxy |

Each normalized component is bounded; total reward is clamped to [-1, 1]. A terminal enemy Nexus loss wins +1, and a terminal allied Nexus loss yields -1. Net death margin outweighs all other nonterminal components combined. Purchases preserve economic asset value; equal passive income cancels from the relative economic margin. These are authored evaluation rewards, not champion stat bonuses, scripted outcomes, mechanical restrictions or proof of match-win value.

The existing actor task observer remains intact. Team snapshots are outside simulation state and cannot authorize an action, alter RNG, retain an expired commitment or stop ordinary retreat/replanning. The new model uses `task-context` version 2 with mandatory `objective: team-v1`; version-1 actor models keep their old semantics. Loading validates the objective/schema and weights. The shared ridge fit retains fixed shrinkage, bounded coefficients, independent-world/card/draft requirements and held-out exclusion; only explicitly validated team labels may train the new objective.

## New independent study

`scripts/team-task-study.mjs` exclusively locks `ml-team-plan.json`, relevant source hashes, reward coefficients, fitting parameters, 0.02 switching margin and acceptance rules before collecting labels. Seeds 137–168 train; seeds 169–184 evaluate. Drafts and sides are balanced in both splits; all worlds are disjoint from preceding task/context/reward studies. Each world contributes its first naturally eligible safe farm/push pair after 120 seconds, with a 240-second scout cap. No missing/invalid case may be silently replaced.

Training compares incumbent, duplicate incumbent and alternate in the same state over thirty seconds. The frozen model is saved before any evaluation outcome. Evaluation adds an actual model-chosen fourth arm; it must reach the executor and match the full same-action continuation. The analyzer checks exact predecision/full-state controls (now including terrain caches), scout/replay contexts and starting team snapshots, task-event credit, recomputed team components, frozen hashes and unchanged policy choices. `collect-team-shard.mjs` only schedules disjoint ranges on separate disposable browsers with the same locked runner.

The exploratory gate requires at least twelve valid evaluation worlds, three changed choices, positive total team reward, more team improvements than regressions (0.02 threshold), no case with extra actor or allied-team deaths, and no changed case rated worse by the broader rubric. Passing this gate would still require full-match evidence before promotion.

## Verification and current result

`npm.cmd run check:game` passed 359 game tests, three deterministic simulations and TypeScript. Production build passed with the existing chunk-size warning. Tests cover restored route hysteresis/independent caches, team losses with identical personal credit, death-after-respawn, passive-income/purchase neutrality, terminal Nexus priority, invalid metrics/horizons/counters, team-label fitting and versioned replay metadata.

A known seed-127 four-arm fixture validates the observer and old model compatibility. It preserves the preceding actor-task outcomes and matches all team starting snapshots and recomputed labels. This known integration fixture is excluded from fresh evidence; it does not evaluate the new model. Evidence: `ml-team-observer-smoke-127.json`.

All 32 training worlds passed strict controls and recomputed labels, covering twelve cards with 21 informative contrasts. Training contrast MSE is 0.064178 versus 0.152004 for a zero-contrast predictor. Maximum absolute coefficient is 0.317889. These are fitting diagnostics, not evidence of better gameplay.

The team-v1 candidate was exclusively frozen before any evaluation outcome. `ml-team-freeze.json` records model SHA256 `34ad3ebdc427ba3165ac7f27acb4897dd7ef4b8d9384bf8a367e5e04f55d6577`, training hash `3b4cf683d31ef6030796b7f19976ad455717fa8bfee9f8f33da06d7a19e5df4f` and source/plan hashes. The candidate is `ml-team-candidate.json`. Its frozen bytes were verified against the witness after collection. Sources, reward coefficients, fitting parameters and the switching threshold did not change during evaluation.

All sixteen planned evaluation cases passed strict controls, label recomputation and learned-arm executor/same-action full-state validation. No case was missing, invalid, dropped or replaced. Together with training, all 48 new worlds pass the cache-inclusive replay checks; the reproduced older seed-128 defect is repaired in this sample.

| Measure | Result |
| --- | --- |
| Planned / valid evaluation worlds | 16 / 16 |
| Changed choices | 11 |
| Material team reward improvements / regressions | 2 / 2 |
| Total team reward change | +0.372248 |
| Actor death change / cases adding actor deaths | -1 / 0 |
| Allied-team death change / cases adding allied-team deaths | 0 / 1 |
| Other-teammate death change, excluding actor | +1 |
| Broader worse changed cases | 1 |
| Prediction MSE / zero-contrast MSE | 0.231835 / 0.122077 |
| Locked exploratory gate | **Failed** |

The material team-reward contrasts were:

| Seed | Team reward change | Actor deaths | Allied-team deaths | Important tradeoff |
| --- | --- | --- | --- | --- |
| 174 | -0.563680 | 0 | +1 | Actor earns 28 extra wave gold while a teammate dies; the new target penalizes this instead of treating personal farm as a gain |
| 179 | +0.401899 | 0 | -1 | Fewer team deaths, but actor health -0.6583, team structure margin -887 and actor assets -189; broader rubric is worse |
| 182 | +0.605941 | 0 | 0 | One additional enemy death, team structure margin +230 and actor assets +150, but actor health -0.4924; broader rubric is mixed |
| 183 | -0.031728 | -1 | 0 | Actor avoids a death that occurred in control (control had respawned by endpoint); another teammate dies instead, and team structure margin is -999; personal task gain +1 is no longer rewarded as a team win |

The other seven switches have team-reward differences smaller than 0.02; five decisions retain the incumbent. Seeds 173 and 180 are better under the broader actor/structure rubric yet slightly negative under the team proxy, illustrating differing tradeoffs and reward clipping rather than an objective ground truth about match wins.

**Do not promote this candidate.** Aggregate reward is positive, but gains do not outnumber regressions, one case adds an allied-team death and another violates the broader outcome gate. Prediction error is substantially worse than predicting no action difference. The model frequently predicts benefits that do not materialize. The new labels expose selfish-farm/death-transfer failures, but the fitted policy does not reliably avoid them.

Future work should calibrate confidence and abstention using training-only validation and improve coverage before another independently frozen trial. This study does not establish that a specific remedy will work. Seeds 169–184 are now seen diagnostic evidence and cannot serve as untouched validation after any refit. Full-match evaluation remains necessary before enabling a learned policy.

Final evidence: `ml-team-plan.json`, `ml-team-train-collection.json`, `ml-team-candidate.json`, `ml-team-freeze.json`, `ml-team-heldout-collection.json`, all 48 case JSONs and `ml-team-analysis.json`. With the recorded locked source, analysis is reproduced from `EsportsClash.Web` using `node --experimental-strip-types scripts/team-task-study.mjs analyze`. Required checks, script syntax, source/plan/raw-data/model assertions, reward recomputation and `git diff --check` passed.

## Limits

This remains a thirty-second first-choice study over two fixed drafts and a bounded farm/push pair. Team snapshots include background combat; same-state contrasts compare its consequences, but sparse labels and clipped authored rewards can miss timing, multi-death magnitude and later value. Inputs retain approximate travel/clear time and coarse influence, and do not model Kaelen's custom spellbook readiness. Match completion before the fixed horizon can invalidate a case. Terminal reward semantics have focused tests but are not evidence of full-match model performance. Headless/live parity and broad competitive safety are not established.
