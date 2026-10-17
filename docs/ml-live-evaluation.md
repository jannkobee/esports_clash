# Card-aware adaptive policy: controlled live comparison (2026-10-14)

The real `AramMatchView` was mounted in disposable headless Chrome at 4x playback with one fixed ten-card lineup. Seed 47 trained the version-2 contextual policy from an empty state. Held-out seed 51 then ran once with empty weights and once with those trained weights. A second empty-weight seed-51 run checked how much the live browser can vary on its own. The repeatable CDP runner is `EsportsClash.Web/scripts/compare-adaptive-live.mjs`; full aggregate counts and trained weights are in `ml-live-evaluation.json`, with the empty-weight repeat in `ml-live-baseline-repeat.json`.

| Run | Policy | Duration (simulation) | Winner | Kills (blue-red) | Sampled decisions |
| --- | --- | ---: | --- | ---: | ---: |
| Seed 47 training | Empty, then update on finish | 19:05 | Blue | 63-35 | 9,011 |
| Seed 51 baseline | Empty | 6:34 | Blue | 13-3 | 3,871 |
| Seed 51 learned | Trained on seed 47 | 9:08 | Blue | 20-5 | 5,661 |
| Seed 51 baseline repeat | Empty | 8:39 | Blue | 17-4 | 5,328 |

The training match produced nonzero per-card and shared feature weights. Among 236 held-out decision samples aligned by actor, two-second time bucket, context, and available actions, **zero selected actions changed**. Only about 6–7% of sampled held-out decisions had an available same-priority alternative, which limits where this learned factor can matter. The same zero-policy seed also varied by more than two simulation minutes between runs. The learned run's duration and kill difference therefore cannot be credited to learning; this experiment found no demonstrated decision benefit.

Limits: headless Chrome could not create a WebGL context and used the arena's canvas fallback. Browser frame timing and live simulation did not reproduce identical outcomes from the same seed; matched-context samples cover only a small subset after trajectories diverge. The record ring in match exports holds only 240 samples, so the runner periodically collected it during play. The model still uses final match winner as a weak reward proxy. Before tuning its weight or claiming improvement, the next experiment needs same-state counterfactual scoring and a local action-outcome signal (such as progress and survival over a short horizon), then multiple held-out seeds with side swaps.
