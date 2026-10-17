# Offline local-outcome candidate evaluation (2026-10-14)

The live browser arena ran four training matches (seeds 61 and 62, original and swapped sides) with the existing seed-47-trained card-aware policy. `EsportsClash.Web/src/offlineOutcomePolicy.ts` fit a **separate, undeployed** candidate from observed 2–6-second actor outcomes. It considered only legal same-tier residual macro alternatives, excluded low-health/danger-suppressed decisions, kept at most one four-second window per actor, and required at least three observations of each of two actions in the same actor/legal-set/priority/health-band group. Its bounded update is an association from observed play, not a causal reward or a change to game mechanics. Exact aggregates and policies are in `ml-offline-outcome-evaluation.json`.

| Training run | Sampled decisions | Valid local outcomes | Winner |
| --- | ---: | ---: | --- |
| Seed 61, original | 5,290 | 4,871 | Blue |
| Seed 61, swapped | 8,177 | 7,465 | Red |
| Seed 62, original | 6,875 | 6,248 | Blue |
| Seed 62, swapped | 4,787 | 4,444 | Red |
| **Total** | **25,129** | **23,028** | — |

Only 2,321 records had a valid outcome and a safe, legal same-tier alternative. De-overlap retained 804. Just 517 observations formed 28 groups with enough action contrast for fitting. The largest single learned-weight change was about 0.0054; `wave` received no supported update. The candidate retained the existing 0.04 live utility multiplier and all legality/survival gates.

Seed 63 then ran with both policies and both side assignments. Blue won both original-side matches; Red won both swapped-side matches. The incumbent matches lasted 363 and 453 simulated seconds, while candidate matches lasted 479 and 773 seconds. A fixed-seed replay of the swapped incumbent had previously reached 1,270 simulated seconds before the fixture's original six-minute wall-time limit, so those match-duration differences cannot be attributed to the candidate. The runner was made resumable and its per-match limit raised to ten minutes for the remaining evaluation.

The decisive diagnostic replay ran the candidate with an observational incumbent selection on the **same legal candidates and commitment** at every sampled decision. It did not execute the incumbent action.

| Candidate reference run | Same-state comparisons | Candidate choices different from incumbent | Suppressed choices changed |
| --- | ---: | ---: | ---: |
| Seed 63, original | 8,538 | 0 | 0 |
| Seed 63, swapped | 4,485 | 1 | 0 |
| **Total** | **13,023** | **1** | **0** |

The one change was `red_p_daft` at full health choosing fight where the incumbent chose regroup. In the following 2.33 seconds, the actor gained one CS and about 49 gold, with no damage or kill. That observational trace cannot show whether fight caused the gain or outperformed regroup. The result does not establish useful learning, so the candidate was **not promoted** and the existing match-winner-trained live policy remains in place. Future work needs safer controlled action variation and more held-out same-state comparisons before changing the reward or learned weight. Headless Chrome used the arena's canvas fallback.

Verification: `npm.cmd run check:game` passed 318 game tests, 3 deterministic simulations, and TypeScript; `npm.cmd run build` passed with the existing large-chunk warning.
