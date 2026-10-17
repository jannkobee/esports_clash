# Same-state live macro-action replay (2026-10-15)

The player-card-aware ML policy has **no demonstrated gameplay benefit** from this evaluation. The offline local-outcome candidate remains undeployed; the live learned utility factor remains 0.04 and all legal-action and risk gates remain unchanged.

## Method

`EsportsClash.Web/scripts/paired-live-rollout.mjs --checkpoint` runs the real browser arena with a fixed ten-card lineup and seeded match RNG. The evaluation-only scout finds a healthy, uncommitted, already-legal close choice. It saves the simulation refs and RNG at the start of that exact tick. The same mounted arena then restores that checkpoint for incumbent A, incumbent B, and the alternate. Each arm must pass the same actor/time/action-pair/predecision-state fingerprint and safety gate. The two incumbent runs must have identical three-second telemetry and eight-second actor follow-up before the alternate is compared. An optional `--trace` captures per-tick ref fingerprints for debugging; ordinary matches never enable this mode.

Seed-only replay failed to reach the same decision reliably (`ml-paired-live-evaluation.json`), so it is not treated as paired evidence. A scout before the checkpoint window was also rejected; the scout now requires a checkpoint from its exact tick. A duplicate-incumbent mismatch rejects the entire comparison even when the alternate appears better or worse.

## Observations

| Seed / side | Card / choice | Eight-second control check | Alternate minus incumbent |
| --- | --- | --- | --- |
| 75 / swapped | `p_p1mple` Solana, fight to regroup | Pass | No health, gold, damage, kill, or death difference; position changed 0.26 px. |
| 78 / swapped | `p_p1mple` Solana, regroup to fight | Pass | Health fraction -0.00218; no gold, damage, kill, or death difference; position changed about 3.95 px. Both arms were inside enemy tower range at follow-up. |
| 77 / swapped | `p_neko` Kazemaru, fight to regroup | Fail | Controls differed in eight-second health, damage, and position; no alternate comparison. |
| 74 / original | `p_daft` Kyumi, regroup to fight | Fail | Controls differed in eight-second health and damage; no alternate comparison. |

The three-second progress proxy was identical across all arms in each run. An earlier valid three-second seed-77 pair (`ml-paired-checkpoint-evaluation.json`) also had zero proxy difference. Eight-second evidence is in `ml-paired-checkpoint-{75,77,78}-swapped-8s.json` and `ml-paired-checkpoint-74-original-8s.json`. The seed-78 trace showed identical control follow-ups even though its RNG state diverged later in the rollout; the duplicate-control outcome check remains necessary.

These are first eligible choices from a few seeds, mostly one card and fight/regroup choices. They do not estimate a population effect, prove card-specific learning, or show that the current online match-winner learner improves play. The replay checkpoint captures simulation refs, but longer runs can still diverge between identical control arms. More stable paired rollouts and diverse card/action contexts are needed before changing the live policy or its weight.

## Fixed-step batch extension (2026-10-15)

The runner now pauses at the scout checkpoint, restores and steps all three arms inside one browser call, and rejects a pair unless the duplicate controls agree on the **entire captured simulation state** at follow-up as well as the actor outcome and assigned action. This removes browser frame grouping and inter-arm React/timer work from the measured rollout. A separately stepped control pair still diverged (`ml-paired-fixedstep-74-original-8s.json`), so frame grouping alone was not the whole cause. One traced batch had identical control fingerprints at all 241 ticks. Four batch pairs passed the stricter check; this is evidence of repeatability for these checkpoints, not a guarantee for every game state.

| Seed / side | Card / choice | Eight-second alternate minus incumbent |
| --- | --- | --- |
| 74 / original | `p_thespicy` Kaelen, fight to regroup | No health, gold, damage, kill, or death difference. |
| 75 / swapped | `p_p1mple` Solana, fight to regroup | Health fraction -0.01625; damage +35; gold, kills, and deaths unchanged. |
| 78 / swapped | `p_woozy` Kindra, regroup to fight | No material actor outcome difference. |
| 77 / swapped | `p_mirecle` Cora, wave to regroup | Both arms died; alternate had +12.36 gold and +198 damage, with no kill or death difference. |

The fixed three-second progress proxy did not distinguish the arms in these four pairs. A separate fixed-step Kyumi regroup-to-wave pair gained one CS and 7 gold by eight seconds, but it used separate browser calls before the stricter full-state check and is exploratory only. Batch evidence: `ml-paired-batch-trace-74-original-8s.json`, `ml-paired-batch-75-swapped-8s.json`, `ml-paired-batch-78-swapped-8s.json`, and `ml-paired-batch-77-swapped-regroup-wave-8s.json`.

These are isolated action interventions at the first eligible state, not a test of a deployed learned policy or a card-specific treatment effect. The horizon is only eight seconds, the sample is four cards and two action pairs, and later team outcomes are unmeasured. The mixed results give no basis to promote the offline candidate or increase the live learned factor. Further work needs more repeated, stratified pairs and a predeclared outcome that values survival, objective progress, and economy together.
