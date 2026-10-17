# Confidence-calibrated task learning (2026-10-16–17)

This candidate measures uncertainty before allowing an ML override. It remains evaluation-only. An unchanged choice or a clean replay is not evidence that learned decisions improve gameplay.

## Locked method

- Reuse only prior **training** worlds: seeds 137–152 fit the card/task-aware team ridge model; seeds 153–168 measure its errors. Both groups have sixteen independent worlds, two drafts and both sides. The model is never refitted on calibration labels. Prior held-out seeds 169–184 are seen diagnostics and are excluded.
- Calibration uses signed overprediction: predicted push-minus-farm team reward minus the full observed contrast. Calibration labels are not clipped to the fitter's ±1 target bound. The fixed 90% finite-sample rank is `ceil((16 + 1) × 0.9) = 16`; the nonnegative largest calibration error is **0.581120299510202**.
- Allow farm→push only if predicted advantage minus that buffer exceeds the existing 0.02 margin. Reverse direction, unsupported push kinds and malformed metadata abstain. Proper fitting supports `advance` and `camp-exit`. All canonical priority, legality, survival, vision, tower, objective, commitment and close-pair gates remain authoritative.
- Collect the first naturally eligible safe farm/push pair after 120 seconds, scouting up to 240 seconds. Fresh seeds **185–200** cover two drafts and both sides. Each has two incumbent controls, the forced alternate and an actual confidence-guided arm, each followed for thirty seconds from the same checkpoint. Missing/invalid cases remain in the planned denominator.
- The predeclared diagnostic comparator applies the same proper-fit model's raw 0.02 threshold to those forced paired outcomes, without the uncertainty buffer. It is an offline counterfactual comparator, not a separately executed learned arm.
- Freeze source manifest, reward, fitter, split, threshold, confidence level, model and witness before collecting fresh cases. No tuning on fresh labels.

The exploratory gate requires at least twelve valid cases, three actual overrides, positive aggregate team reward, more material gains (≥0.02) than losses, no extra actor or allied-team death case, no broader worse changed case, and at least 90% observed lower-bound coverage on supported contexts. Passing would still require full-match evidence before normal enablement. Abstaining everywhere does not pass.

## Frozen artifacts

| Artifact | SHA-256 |
| --- | --- |
| Model | `e59ab169e4cd6ce918d97b7b5047d146915eb32316a13cd18af0ef7eccfc4ce0` |
| Plan (canonical JSON) | `a2391c3cffeeca22b836b3497d8e1c53842ab758361fe9e81cc48a525cdce88c` |
| Runtime/runner/source manifest | `f94a5ca0acbb9cc37d762e775ab2bfc7df42cfca1c5a12c0840f048fde9710f7` |
| Validated development cases | `0eb241418da9b4393f40186539389d44f41d3be4d1ff56a3afdb023402c1b560` |

The witness `ml-confidence-freeze.json` was written at `2026-10-16T15:53:48.853Z`, before any fresh evaluation. `evaluationCollected: false` describes that historical freeze moment. The plan records hashes of every reused raw case. All runtime TS/TSX modules, evaluator/collector/paired runner and the runner's existing adaptive-policy input are hashed.

Proper fitting has sixteen worlds and eleven informative contrasts. Fitting MSE is 0.027241 versus 0.193873 for zero contrast; these are fitting diagnostics, not held-out performance. The uncertainty estimate pools sixteen calibration worlds. It is not a per-card, subgroup, individual-action or full-match safety guarantee, and selected procedural contexts do not establish general exchangeability.

Proper fitting covers ten cards, eight `advance` contexts and eight `camp-exit` contexts. Calibration covers eight cards, ten `advance` and six `camp-exit` contexts. Neither covers direct structure/minion push tasks. Calibration seed 155 sets the buffer: predicted advantage +0.489568 versus observed −0.091552. Conversely, seed 163 predicts −0.378783 against an observed +0.644847, so unreliable estimates also miss useful opportunities. These development diagnostics explain the large buffer; they do not justify lowering it after seeing fresh results.

## Fresh results

All sixteen planned worlds passed duplicate controls, predecision/context equality, task/team reward recomputation, actual executor arrival and same-action full-state checks for the confidence arm. No world was missing, invalid, dropped, replaced or retried for accepted evidence. All 138 runtime/runner/input hashes and the frozen model remained unchanged. Collection and analysis finished on 2026-10-17 Asia/Manila.

| Measure | Confidence arm | Unbuffered diagnostic |
| --- | --- | --- |
| Planned / valid worlds | 16 / 16 | Same paired worlds |
| Changed choices | **0** | 10 |
| Material team gains / losses | 0 / 0 | 4 / 3 |
| Aggregate team reward difference | 0 | +1.391688 |
| Actor death difference / cases adding actor deaths | 0 / 0 | −1 / 0 |
| Allied-team death difference / cases adding team deaths | 0 / 0 | 0 / **3** |
| Broader worse changed cases | 0 | 3 |

Every confidence decision abstained with `uncertain-task-advantage`; all fresh predicted contrasts were below the 0.601120 threshold. Observed lower-bound coverage was **13/16 = 81.25%**, below the predeclared 90% gate. Prediction MSE was **0.359732**, worse than the zero-contrast MSE **0.309100**, using full observed contrasts for both. A small pooled calibration set does not establish reliable estimates, even when it prevents all current overrides.

The three coverage misses also expose unsafe raw rankings:

| Seed | Predicted benefit | Lower bound | Actual forced contrast | Extra allied-team deaths under raw selection |
| --- | --- | --- | --- | --- |
| 187 | +0.492199 | −0.088921 | −0.672104 | +1 |
| 193 | +0.026735 | −0.554385 | −0.560800 | +1 |
| 197 | +0.505700 | −0.075421 | −0.716794 | +1 |

The veto blocks those harmful choices, but also blocks four material gains (189, 191, 194, 200); seed 194 additionally fails the broader rubric despite positive team reward. Net raw team deaths of zero masks three cases adding deaths and three saving deaths. Positive aggregate raw reward does not meet the protected team/regression gate.

**The locked exploratory gate failed. Do not promote this candidate or call ML complete.** Its abstention path is implemented and empirically verified; it does not improve gameplay in this trial, and no real-browser high-confidence override was observed. Allowed override behavior is covered by focused synthetic tests only. Do not lower the buffer, alter reward or fit on these outcomes to turn this failed trial into success. Seeds 185–200 are now seen and cannot be fresh validation after any change.

Further work needs a stronger predictor and broader independent fitting/calibration coverage before another frozen fresh-world study. More cards, lineups and task/game phases are coverage requirements to investigate, not a proven remedy. Full-match evaluation remains necessary after useful, nonregressing overrides are demonstrated; an all-abstaining full-match trial would add no learned-policy benefit evidence.

Final evidence: `ml-confidence-plan.json`, candidate/freeze, `ml-confidence-heldout-collection.json`, sixteen `ml-confidence-heldout-*.json` raw cases and `ml-confidence-analysis.json`. With the locked sources, reproduce analysis from `EsportsClash.Web` using `node --experimental-strip-types scripts/confidence-task-study.mjs analyze`. Model, source, plan and raw development assertions pass after collection.

## Verification

- `npm.cmd run check:game`: 362 game tests, three deterministic simulations and TypeScript pass.
- `npm.cmd run build`: passes with the existing large-chunk warning.
- Focused regressions prove that positive predictions can be vetoed, a sufficiently high lower bound can reach the legal alternate, every existing safety gate retains authority, malformed/overlapping metadata is rejected, and calibration-label changes cannot change fitted weights.
- The known seed-137 smoke is excluded from fresh results. Its scout/context, both incumbent arms and forced alternate exactly reproduce the previous study's world/outcomes. The confidence arm abstains and reproduces the incumbent's full state. Raw artifacts: `ml-confidence-smoke-137.json` and `ml-confidence-smoke-validation.json`.

## Limits and affected code

`src/taskConfidencePolicy.ts` owns strict confidence-model loading, independent fitting/calibration and lower-bound selection. `src/rewardMacroDecision.ts`, `src/pairedMacroReplay.ts`, `src/components/AramMatchView.tsx` and `scripts/paired-live-rollout.mjs` carry the explicit evaluation model. `scripts/confidence-task-study.mjs` and `scripts/collect-confidence-shard.mjs` lock and validate this study. `src/taskConfidencePolicy.test.mjs` covers the new behavior.

Normal matches keep their existing adaptive-policy storage and 0.04 learned factor. This candidate does not change combat stats, movement speeds, mechanical legality, risk-based tower combat, natural retreat, well/Nexus safeguards, attribution, objective contests, anti-oscillation or aliases. Task travel and basic-attack clear time remain approximate; Kaelen's custom spellbook readiness remains unmodeled. Avatar redesign remains queued after useful ML evidence.
