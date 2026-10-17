# Action-context task learning

The preceding card-only reward model failed its fresh action trial. This study tests a separate contextual model; the old candidate and ordinary live preference learner are unchanged. No contextual model is installed into normal matches.

## Inputs and authority

`taskActionContext.ts` captures separate farm and push observations at the exact predecision checkpoint. Both retain card identity, attributes, role fit, personality and resources. Task observations include approximate travel and terrain detour, approach threat/cover, perceived opponents and allies, nearby waves, tower exposure, attack readiness, affordable ready standard abilities, and basic-attack DPS. Farming adds camp reward, observed remaining health, basic-attack clear-time estimate, existing contributor count, aggression, displacement from home and map side. Pushing identifies the executor's structure/minion/camp-exit/advance plan, target health, wave crash and structure distance.

Camp home and authored rewards are known map information. Dynamic camp health, aggression, displacement and contributor information are masked without the existing team-vision predicate. Opponents come from the existing perception result; no hidden enemy cooldowns or future results are supplied. Kaelen is marked as a custom caster and his standard slots are not falsely reported ready. His custom spellbook readiness is not modeled in this first schema.

The context observer runs only in explicit paired evaluation. It does not enter the world checkpoint, advance RNG, change stats, grant vision, authorize an action, retain commitments or alter retreat. Every existing safe-pair and canonical-priority gate remains authoritative. The switching margin remains 0.02 predicted task reward.

## Frozen method

`taskContextPolicy.ts` uses an independent `task-context` version-1 schema. It fits action reward contrasts by deterministic ridge regression, with stronger shrinkage for card/resource features than task observations. The regularization, minimum independent episodes/informative contrasts, bounded weights and prediction threshold were fixed before collecting training labels. No existing model weights initialize this fit.

`scripts/task-context-study.mjs` exclusively writes `ml-context-v2-plan.json`, records relevant source hashes, and collects seeds 101–124 for training, followed by seeds 125–136 for evaluation. Both fixed drafts and both sides are balanced within each split. These worlds are disjoint from the preceding task/reward studies. Each world contributes its first naturally eligible farm/push pair after 120 seconds. Missing targets and invalid controls stay in the planned denominator. The model is frozen exclusively from training outcomes before evaluation collection starts; later analysis verifies source, plan, raw training and model hashes. `collect-context-shard.mjs` only schedules disjoint ranges on separate disposable browsers using the same locked runner and settings.

Each case compares incumbent, repeated incumbent and alternate for the same thirty-second horizon. Evaluation adds a fourth arm that actually executes the learned decision. Duplicate controls must agree on full captured world state, short telemetry, task context, task events and followup; the learned arm must reach its executor and match the full same-action reference continuation. Context must agree across scout and all arms. Rewards are recomputed from actual camp shares, minion last hits, capped structure damage and deaths, excluding passive income and travel.

The locked exploratory gate requires at least eight valid evaluation cases, two changed decisions, positive total task reward, more improvements than regressions, no case with extra deaths, and no changed case classified worse by the wider outcome rubric. Passing this small local gate would still require full-match evidence before deployment.

## Verification and results

Implementation checks passed: 354 game tests, three deterministic simulations, TypeScript and production build (existing chunk-size warning). Focused tests cover same-card opposite-context learning, unseen camp masking, independent-world and held-out exclusions, schema validation, explicit replay metadata and protected gates.

A corrected known seed-81 observer integration fixture passed duplicate controls, retained the prior exact predecision fingerprint `72487:a5ab847f:aa371bc3`, preserved the full captured state/RNG through all three thirty-second continuations, and produced identical context across scout and all arms. This known fixture is software validation only and excluded from training and fresh evaluation. Evidence: `ml-context-v2-observer-smoke.json`, compared with `ml-task-train-81-d0-original.json`.

The initial collection was rejected before any candidate fit or evaluation. Seed 109's predecision context equality caught an observer query using the live actor as the terrain router's cache key. That query could disturb cached routing even when the captured world fingerprint matched. It now uses a fresh coordinate object, isolating its route cache. The corrected seed-109 fixture passes context equality across scout and all arms. `ml-context-initial-rejection.json` records that all original cases are excluded; the version-2 study recollects the complete original training split, preserving all original fit/reward/gate parameters and the untouched evaluation split. Earlier optional-empty-event analyzer handling was also corrected before fitting, with an explicit source amendment for the rejected initial study.

All 24 corrected training worlds passed the strict controls and context checks. They cover ten cards and contain nine informative reward contrasts. Only lane-advance and camp-exit push modes occurred; the structure/minion attack mode features have no training coverage here. The model's training contrast MSE is 0.009836 versus 0.088376 for a zero-contrast predictor. Maximum absolute coefficient is 0.244025; fitting success is not evidence of better gameplay.

The candidate was exclusively frozen before the first evaluation collection. `ml-context-v2-freeze.json` records model SHA256 `4bcb7c986f386fa7cd9db935f15675504099fedf4040690f29a754247f6bbed1`, training hash `25e4e3a0a333f1e350136052ef1d95a1b374a1a60b1116d4e7975db719d5b022` and plan hash. The model is `ml-context-v2-candidate.json`; its bytes were checked against the pre-evaluation witness after collection.

All twelve planned evaluation worlds were collected. Eleven passed full replay validation. Seed 128 failed the very first incumbent's exact predecision fingerprint despite identical actor context, and is retained as `invalid-controls`, with no outcome accepted, replacement seed or selective retry. Its remaining checkpoint-state discrepancy is unresolved. All eleven valid fourth arms reached their selected executors and matched their same-action full-state reference; rewards and frozen choices were independently recomputed.

| Measure | Result |
| --- | --- |
| Planned / valid evaluation worlds | 12 / 11 |
| Changed choices | 6 |
| Task improvements / regressions | 1 / 1 |
| Total task reward change, valid worlds | +1.150267 |
| Death change / cases with extra deaths | -1 / 0 |
| Broader improved / worse changed cases | 2 / 2 |
| Prediction MSE / zero-contrast MSE | 0.239051 / 0.182319 |
| Locked exploratory gate | **Failed** |

The changed choices are:

| Seed / card | Task reward change | Broader outcome |
| --- | --- | --- |
| 127 / Toaster | +1.204000 | Survived instead of dying; gained 85 camp gold, structure margin +1,495 |
| 129 / Craps | 0 | No material difference |
| 130 / NeKo | 0 | Worse: team structure margin -454 |
| 132 / kovi | 0 | Better: economic value +250, team structure margin +119 |
| 134 / Daft | 0 | No material difference |
| 136 / Toaster | -0.053733 | Worse: health fraction -0.1563, 21 fewer wave gold and 5 fewer actor structure damage |

There is a validated local survival improvement, but the positive aggregate proxy is dominated by that single case. Improvements do not outnumber task regressions; two changed cases regress under the broader rubric; and prediction error is worse than always predicting zero contrast. **Do not promote this candidate.** This is mixed exploratory evidence, not proof of full-match or general card-level improvement.

Seed 130 also demonstrates a reward-definition gap: actor gold/damage/deaths give identical task credit while the team's structure margin worsens by 454. Seed 132 shows the opposite gap, with better team/economic outcomes and unchanged actor task credit. More task context alone cannot make that training target value those consequences. A future model needs a separately predeclared team-level outcome target, richer coverage and an untouched evaluation cohort; seeds 125–136 are now seen evidence and cannot be reused as fresh validation after a refit. Checkpoint completeness and full-match evaluation also remain requirements before deployment.

Final artifacts: `ml-context-v2-plan.json`, `ml-context-v2-train-collection.json`, `ml-context-v2-candidate.json`, `ml-context-v2-freeze.json`, `ml-context-v2-heldout-collection.json`, all 36 corrected case JSONs and `ml-context-v2-analysis.json`. With this study's original locked source, validation and analysis are reproduced with `node --experimental-strip-types scripts/task-context-study.mjs analyze` from `EsportsClash.Web`. Later implementation phases intentionally change the source hash and require their own study; this guard must not be bypassed to claim a rerun of the old simulation. No source, fitting parameter, threshold or model bytes changed during held-out collection.

## Limits

Thirty seconds can miss later payoff. The authored task reward is a proxy rather than a match-win label. Travel uses a first terrain waypoint followed by approximate remaining distance, not a timed route simulation. Camp clear time uses current basic DPS without future abilities, crits, teammate contributions or damage mitigation. Approach influence remains coarse. Vision uses the existing arena predicate. Only first eligible farm/push choices across two fixed drafts are studied; this does not cover all cards, action types or full-match policies, or establish live/headless parity.
