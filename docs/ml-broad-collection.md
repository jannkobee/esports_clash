# Broader card-aware ML collection — 2026-10-17

The previous confidence trial abstained everywhere and missed its lower-bound coverage gate. This phase expands independent data coverage before considering another model promotion. The card redesign runs alongside this work by the user's explicit request.

## Implementation and locked protocol

`src/pairedStudyDraft.ts` preserves historical drafts 0/1, and adds eight evaluation-only role-aware drafts 2–9. Their lineups include all 64 roster identities, with ten distinct players and ten distinct avatars per match. Authored card values and champion kits are passed through unchanged. Fixture selection is deterministic and consumes no gameplay RNG. Actual observed actor-card coverage is reported separately; including a card in a lineup does not mean that card supplied an eligible training decision.

`scripts/paired-live-rollout.mjs` accepts drafts 0–9 and `--after=120|360|600` (bounded 120–900 generally). `AramMatchView.tsx` reads a separate evaluation-only scout boundary; it captures no candidate checkpoint before that requested time. Later windows therefore follow ordinary AI play until the first naturally eligible pair. The existing 120-second boundary remains the default. Output records the requested boundary and ordered player/avatar IDs for independent validation.

`ml-broad-plan.json` predeclares **96 independent seeds 1001–1096**:

| Split | Worlds | Coverage |
| --- | --- | --- |
| Proper fitting | 48 | 8 drafts × 3 scout starts × both sides |
| Calibration | 24 | 8 drafts × 3 starts; sides balanced |
| Fresh evaluation | 24 | 8 drafts × 3 starts; mirrored calibration sides, independent seeds |

Scouting starts at 120, 360 or 600 simulated seconds, with a 120-second search window and thirty-second continuation. No opportunity, ended match and invalid controls remain recorded; no replacement seeds or gate relaxation. These requested windows do not guarantee that a legal pair exists or that the match survives that long.

The separate `broad-task-study.mjs`, `collect-broad-shard.mjs` and `broad-study-evidence.mjs` implement preparation, resumable/disjoint collection, coverage reporting, proper-weight freezing before calibration, confidence freezing before any evaluation file, and actual confidence-arm evaluation. They lock source/runtime/CSS/portrait/runner inputs, reward, fitter, confidence level, splits, raw evidence and model bytes. Old confidence/team studies remain historical and their artifacts are not overwritten.

The model still uses the existing bounded card/task ridge fit and fixed 90% one-sided calibration. Prediction loss must beat zero contrast on fresh supported contexts, alongside at least eighteen valid cases, four useful overrides, positive aggregate team reward, more material gains than losses, zero extra actor/team death cases, zero broader worse changed cases and at least 90% observed lower-bound coverage. Passing is exploratory and still requires full-match evidence before normal enablement. All-abstaining or unsupported choices cannot pass on zero harm alone.

## Reproduction

Run from `EsportsClash.Web`, with an isolated CDP browser and local Vite available via `CDP_PORT` / `VITE_PORT`:

```powershell
# prepare is exclusive; the current plan is already locked
node --experimental-strip-types scripts/broad-task-study.mjs prepare
node --experimental-strip-types scripts/collect-broad-shard.mjs --split=fit --from=1001 --to=1048
node --experimental-strip-types scripts/broad-task-study.mjs fit
node --experimental-strip-types scripts/collect-broad-shard.mjs --split=calibration --from=1049 --to=1072
node --experimental-strip-types scripts/broad-task-study.mjs freeze
node --experimental-strip-types scripts/collect-broad-shard.mjs --split=heldout --from=1073 --to=1096
node --experimental-strip-types scripts/broad-task-study.mjs analyze
node --experimental-strip-types scripts/broad-task-study.mjs status
```

Parallel collectors must use disjoint seed ranges and separate disposable CDP ports (9223/9224/9225). Existing files, including failed/no-target attempts, are retained and validated. Status reports planned/valid/missing/control failures, observed actor cards, drafts, scouting stages, task kinds and directions. It does not silently replace an incomplete study with the successful subset.

`prepare`, `fit` and `freeze` write exclusive artifacts and must be skipped after they complete. Run final `status` after all shards finish: the browser runner writes an initial checkpoint file before completing its replay, so an in-progress file is not final evidence. Never overlap or resume a still-running shard.

## Fitting results

All 48 proper-fitting worlds were attempted under unchanged sources. **27 valid, 19 no-target, two incomplete controls**; no replacement world. The valid comparisons cover twenty decision-actor cards across all eight new drafts, with fifteen two-minute, eleven six-minute and one ten-minute context. The direction is farm→push in all 27, split between fifteen `advance` and twelve `camp-exit` tasks. No direct structure/minion push task was observed. The wider lineup includes all 64 cards, but only these twenty actor cards supply supervised fitting examples.

The two incomplete cases (1015 and 1016) match their starting checkpoint and have initial three-second telemetry but lack a full thirty-second continuation. Trace lengths are 308 and 803 ticks. Post-run inspection for 1016 confirms the match ended at 392.433s, before its required 395.667s endpoint; the raw result remains invalid. This is not accepted evidence of a successful full continuation. `ml-broad-incomplete-window-diagnostic.json` records the direct post-run check.

Proper weights were exclusively written to `ml-broad-proper-fit.json` before calibration collection. There are sixteen informative fitting contrasts. Fitting MSE is 0.027290 versus zero-contrast 0.159003; these are development diagnostics, not prediction or gameplay success. Validated proper-case hash: `446211e05dd9614c9afee934ff2825210ec8daac5adee12a157b42345240a3fa`. The complete source/input manifest hash remains `4a1b08e8051e68f10800c6629b89c8f3c51822b6b789adfd5aabcf77ad6973c8`.

## Calibration and freeze

All 24 calibration worlds were attempted: **18 valid, four no-target, two incomplete controls**. Valid calibration contexts include all eight two-minute cases, seven six-minute cases and three ten-minute cases. The weights are exactly equal to the proper-fit artifact; calibration never changes them. The fixed 90% finite-sample rank is `ceil((18 + 1) × 0.9) = 18`, producing a signed-overprediction buffer of **0.8301945365375516**. A supported override therefore needs predicted benefit greater than 0.8501945365375516, preserving the original 0.02 margin.

The calibrated candidate and witness were exclusively frozen before collecting any fresh evaluation case. Witness time is `2026-10-16T17:27:40.014Z` (2026-10-17 Asia/Manila). Its `evaluationCollected: false` field describes that historical moment.

| Frozen artifact | SHA-256 |
| --- | --- |
| Candidate bytes | `63a784994876a6ce71bf4dad350df5156b6a5d24a1be1683637b43a84e9d8c34` |
| Plan canonical JSON | `c82349ae4833cbdc13e758d02c4006a36baf5da4b5eeb7146b18e3974288f1e0` |
| Calibration cases | `f7af58968681ce1d7636dd9a5859e2c2a2bcecaf0075263d558f8ab90323aa5d` |

Artifacts: `ml-broad-proper-fit.json`, `ml-broad-candidate.json`, `ml-broad-freeze.json` and all predeclared raw proper/calibration cases. Calibration is pooled empirical error measurement, not a per-card/action/subgroup or full-match safety guarantee. The larger error buffer reflects wider observed prediction uncertainty; it is not proof of improved prediction or gameplay.

## Final fresh evaluation

All **96 planned worlds** were attempted; none are missing or replaced. Sixty comparisons validate: 27 fitting, 18 calibration and 15 evaluation. Thirty worlds have no target; six have an incomplete thirty-second continuation. All six incomplete cases match their initial predecision checkpoint; no unequal-start replay was accepted. The direct match-end diagnostic described above applies to 1016; the remaining incomplete raw traces are retained without inventing missing endpoints.

All fifteen valid fresh confidence arms pass actual executor, recomputed reward and same-action full-state checks. The frozen candidate, proper weights, raw development hashes and all **146 source/input hashes** remain unchanged. `ml-broad-final-verification.json` records these checks and all incomplete-case diagnostics.

| Fresh metric | Result |
| --- | --- |
| Planned / valid evaluation cases | 24 / 15 |
| No-target / incomplete cases | 7 / 2 |
| Distinct evaluation actor cards | 13 |
| Actual overrides | **0** |
| Team reward change / added actor/team death cases | 0 / 0 / 0 |
| Supported lower bounds covered | 14 / 15 = **93.33%** |
| Full-contrast prediction MSE | **0.327278** |
| Zero-contrast baseline MSE | **0.168534** |
| Locked exploratory gate | **Failed** |

The confidence arm preserves the incumbent in every valid case. Its observed lower-bound coverage clears this sample's 90% gate, but prediction loss is almost twice the zero-contrast baseline, there are no useful overrides, and only fifteen cases validate against the planned minimum of eighteen. No positive gameplay effect or real-browser cleared-confidence switch is demonstrated. Zero harm from abstaining everywhere is not successful gameplay learning. **Keep this model offline; do not claim ML complete or relax thresholds to manufacture changes.**

Coverage remains uneven even with the wider plan:

| Requested scout start | Valid fitting | Valid calibration | Valid evaluation | Valid / planned total |
| --- | --- | --- | --- | --- |
| 2 minutes | 15 | 8 | 8 | 31 / 32 |
| 6 minutes | 11 | 7 | 5 | 23 / 32 |
| 10 minutes | 1 | 3 | 2 | 6 / 32 |

The completed comparisons cover 24 actor cards across all splits, with twenty supplying fitting examples and thirteen each in calibration/evaluation. These counts are not 64-card learned coverage. All sixty valid decisions are farm→push: 37 `advance`, 23 `camp-exit`, zero direct minion/structure push tasks. A larger case plan has not solved the predictor's limited inputs or scarcity of later safe task opportunities.

Next research requirements are stronger decision/outcome representations, training-only model selection, and a predeclared sampling/terminal-outcome protocol that yields valid later-game observations. Match phases and terminal outcomes need deliberate handling; do not retroactively pad or replace these incomplete windows and call them successful old-study cases. A new study must preserve current failures and use new evaluation worlds. Seeds 1073–1096 are now seen. Full-match evaluation remains necessary after useful nonregressing overrides are demonstrated.

Final evidence: `ml-broad-plan.json`, proper fit/candidate/freeze, `ml-broad-collection.json`, all 96 raw cases, `ml-broad-analysis.json` and `ml-broad-final-verification.json`. With the recorded sources, `analyze` and `status` reproduce the final reports. `npm.cmd run check:game` passed 364 game tests, three deterministic simulations and TypeScript; `npm.cmd run build` passed with the existing chunk warning. Two additional evidence-corruption tests, script syntax checks, legacy four-arm compatibility, actual UI/browser fixtures and final hash/whitespace checks pass. Owned evaluation browsers and Vite were closed after collection.

## Boundaries

This expands lineups and game stages within the existing safe close farm/push pair. It does not authorize combat exploration or train fight/regroup decisions, and direct structure/minion contexts are only supported if they actually occur in proper fitting. Requested ten-minute windows and all 64 lineup cards must not be presented as observed task evidence without the coverage report.

All normal live adaptive storage, the 0.04 factor, priority/survival/vision/tower/objective/commitment checks, risk-based tower behavior, natural retreat, well/Nexus safeguards, attribution, combat stats/speeds and Cardrel remain unchanged. The preceding candidates are still offline. Broader data alone is not a demonstrated prediction or gameplay improvement.
