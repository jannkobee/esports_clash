# Post-guard live learning check (2026-10-14)

The real `AramMatchView` ran at 4x in disposable headless Chrome with the seed-47-trained card-aware policy. Seeds 53 and 54 each ran with the same ten card/avatar pairings in original and swapped team assignments. `EsportsClash.Web/scripts/compare-adaptive-live.mjs --post-guard` compared each sampled choice against the same legal candidates and commitment with learned preference set to zero. The runner saved each match's aggregates and any changed-choice examples in `ml-live-post-guard.json`. Headless Chrome used the arena's canvas fallback.

| Run | Same-state comparisons | Learned-choice changes | Low-health suppressed | Danger suppressed | Valid 2–6 s outcomes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Seed 53, original | 5,928 | 0 | 3 | 56 | 5,481 |
| Seed 53, swapped | 5,111 | 0 | 4 | 53 | 4,865 |
| Seed 54, original | 5,286 | 0 | 5 | 67 | 4,891 |
| Seed 54, swapped | 3,970 | 1 | 19 | 41 | 3,632 |
| **Total** | **20,295** | **1** | **31** | **217** | **18,869** |

No selection changed in any of the 248 low-health or danger-suppressed samples. Recorded outcome horizons ranged from 2.0 to 6.0 simulation seconds, with follow-up coverage for about 93% of sampled decisions. This validates the telemetry window and the observed suppression behavior in these fixtures; it is not proof of all possible states.

The sole learned-choice change was `p_bigtail` at 94% HP on seed 54 with swapped teams: legal regroup became legal fight. Without learning, regroup's utility exceeded fight's by 0.0049; the learned factor reversed that narrow ranking. Over the following 2.83 seconds, the actor dealt no damage, scored no kill, lost no health, and gained 33 gold. That trace gives no evidence that the fight choice was better. The learner still trains from final match winner, while local outcomes remain descriptive only. More varied action-level evidence is needed before replacing the reward or increasing the learned utility weight.
