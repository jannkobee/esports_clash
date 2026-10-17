# Same-state learning diagnostic (2026-10-14)

After the initial live A/B comparison found no directly aligned changed actions and substantial empty-policy run variation, the residual macro selector gained diagnostic-only counterfactual and short-horizon telemetry. At each sampled decision, it evaluates the same legal candidate set and existing commitment with the learned factor set to zero, without executing that counterfactual action. When the actor's next sampled decision arrives within six simulation seconds, it records health, gold, CS, kills, deaths, and damage deltas plus a bounded descriptive progress proxy. This proxy is not used to train the policy and does not establish the chosen action caused the outcome.

`EsportsClash.Web/scripts/compare-adaptive-live.mjs --diagnostic` mounted the real browser arena with the policy trained on seed 47, then ran seed 53 at 4x. The full-match aggregates are in `ml-live-diagnostic.json`:

| Measure | Result |
| --- | ---: |
| Match duration | 13:32 simulation time |
| Winner, kills | Blue, 37–23 |
| Sampled residual macro decisions | 7,439 |
| Same-state zero-policy comparisons | 7,439 |
| Selections changed by the learned factor | 2 |
| Short-horizon outcome samples | 7,264 |
| Mean descriptive progress proxy | 0.0337 |

The policy can affect a legal live choice, but only rarely in this sample. The two changed actions were not proven beneficial. Match-outcome training remains unchanged; the new local signal is observational until it can be assessed for bias and safety. Headless Chrome used the canvas fallback after WebGL context creation failed. More held-out seeds, side swaps, and action-level review are needed before changing the reward or learned utility weight.
