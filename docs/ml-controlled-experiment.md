# Evaluation-only randomized macro choices (2026-10-15)

The real browser arena ran four matches: seeds 71 and 72 with original and swapped team assignments. The disposable fixture enabled `esports-clash-macro-experiment` in its own session storage; normal matches leave it off. `EsportsClash.Web/src/safeMacroExperiment.ts` assigned 50/50 between the incumbent residual macro choice and the best other already-legal action in the same priority tier, only when their utility gap was at most 0.10. Assignments were at least four simulation seconds apart per actor. No action was made legal by the experiment.

The gate required at least 70% health, no existing dangerous-fight assessment, no enemy-tower exposure, no objective fight or base defense, and no active macro commitment. It also required bounded local influence threat; a pair involving fight required the existing outlook's survival score, while other pairs required distance from enemy champions. `AramMatchView.tsx` recorded the assigned arm, alternative, known 0.5 propensity, and subsequent actor outcome in `aiDecisionTelemetry.ts`. It did not use the match RNG. Earlier, narrower pair-specific probes yielded zero or one assignment and were replaced before this four-match collection; `ml-controlled-probe.json` retains the last probe.

| Run | Assignments | Valid 2–6 s outcomes | Incumbent arm | Alternate arm |
| --- | ---: | ---: | ---: | ---: |
| Seed 71, original | 4 | 3 | 1 | 3 |
| Seed 71, swapped | 4 | 4 | 3 | 1 |
| Seed 72, original | 3 | 3 | 1 | 2 |
| Seed 72, swapped | 5 | 4 | 2 | 3 |
| **Total** | **16** | **14** | **7** | **9** |

`src/randomizedMacroLearning.ts` compared valid progress per second within each action pair and incumbent choice, then fitted a separate, strongly shrunk **offline-only** candidate where both arms had at least three valid outcomes. Only the regroup-incumbent/fight-alternate stratum met that threshold: four valid outcomes per arm. Its alternate-minus-incumbent mean was +0.00226 progress per second, with a descriptive 95% half-width of 0.02747. The interval is broad, includes zero, and does not account for actor or match interference. Other strata had one or zero outcomes per arm. The candidate adjusted fight and regroup bias by about ±0.00038; all existing card-aware weights, combat stats, legality gates, and the live 0.04 learned utility multiplier stayed as they were. Data and exact summaries are in `ml-controlled-experiment.json` and `ml-controlled-experiment-analysis.json`.

On held-out seed 73, original and swapped sides, the candidate was executed while the incumbent was scored on the exact same legal candidates and commitment without being executed. Across **13,762 same-state comparisons**, there were **zero candidate-versus-incumbent choice changes** and zero suppressed-state changes. The candidate therefore showed no behavioral or performance improvement and was **not promoted**. See `ml-controlled-heldout.json`. The local outcome is an intent-to-treat proxy for assigned choices, not a match-win or card-specific causal effect; 16 assignments are insufficient to infer a reliable advantage. Headless Chrome used the arena's canvas fallback.

Verification: `npm.cmd run check:game` passed 323 game tests, 3 deterministic simulations, and TypeScript; `npm.cmd run build` passed with the existing large-chunk warning.
