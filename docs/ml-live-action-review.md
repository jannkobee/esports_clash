# Review of learned macro choices (2026-10-14)

`EsportsClash.Web/scripts/compare-adaptive-live.mjs --review` ran the real arena at 4x with the seed-47-trained card-aware policy. Seeds 53 and 54 each ran with the same ten card/avatar pairings in the original and swapped team assignments. The runner captured every same-state zero-policy comparison, and saved exact changed-choice episodes with legal alternatives, priority, baseline and learned utility, current health, and the next sampled actor outcome in `ml-live-action-review.json`. Headless Chrome used the canvas fallback.

| Held-out run | Sampled comparisons | Changed episodes | Winner |
| --- | ---: | ---: | --- |
| Seed 53, original | 3,667 | 1 | Blue |
| Seed 53, swapped | 8,699 | 0 | Red |
| Seed 54, original | 5,499 | 1 | Blue |
| Seed 54, swapped | 5,404 | 1 | Red |

Across 23,269 sampled same-state comparisons, learning changed three choices (0.013%). All three alternatives were already legal and in the same tactical priority tier. The exact cases were:

| Run / time | Card and health | Zero policy → learned | Baseline utility margin | Immediate observation |
| --- | --- | --- | --- | --- |
| 53 original / 6:04.6 | `p_bigtail`, 10.6% HP | regroup → fight | regroup ahead by 0.0060 | 1.7 s: no damage dealt, no kill, HP rose 6.8 points |
| 54 original / 7:46.7 | `p_daft`, 52.1% HP | regroup → fight | regroup ahead by 0.0029 | 0.03 s: no meaningful follow-up |
| 54 swapped / 10:36.8 | `p_mirecle`, 100% HP | regroup → wave | regroup ahead by 0.0013 | 0.43 s: one CS, no health loss |

These are observational traces, not causal evidence. The 10.6%-HP fight is especially poor material for a learned preference to tip, even though the fight candidate passed its existing legal gate. The outcome sampler also labeled immediate action switches after as little as one frame, which cannot assess short-horizon quality. After this review, `aiDecisionTelemetry.ts` now requires a 2–6-second window and can attach the first qualifying later actor sample. `adaptivePolicy.ts` / `AramMatchView.tsx` set learned macro preference to zero below 30% HP or during an explicitly dangerous fight. This only removes the learned contribution in those states; it does not change fight legality, the existing retreat policy, combat mechanics, or priority tiers. The reviewed runs predate that guard, and no benefit is claimed for the remaining changes. Training still uses match winner; local outcomes remain diagnostics pending stronger evidence.
