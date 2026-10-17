# Delayed task outcomes and offline learning (2026-10-16)

The user authorized completed-work rewards, independent comparisons across cards/drafts/sides, and a candidate checked against unseen contexts before any deployment. This pass adds an evaluation-only thirty-second outcome observer and a separate offline card-aware learner. Normal matches retain their current learning and gameplay rules.

## Protocol fixed before collection

[ml-task-outcome-plan.json](ml-task-outcome-plan.json) specifies eight training seeds and four disjoint held-out seeds, two drafts/card sets, both side assignments, first eligible farm/push checkpoints after the existing 120-second replay boundary, a 240-second scouting cap and equal thirty-second continuations. Every case is retained, including unavailable targets, incomplete windows and divergent duplicate controls. Collection does not repeatedly sample adjacent decision ticks as independent episodes.

The original macro choice is replayed twice from the same tick-start checkpoint and the already-legal alternate once. Predecision state, original assignment, original three-second outcome, task events, thirty-second outcome and full captured-state fingerprint must match between controls. Both arms continue naturally to the same fixed horizon: emergency retreat, target changes and the existing expiring commitments remain active. Completing a task does not stop one arm earlier or force the champion to keep executing it.

Actual camp reward shares, minion last-hit gold and applied actor structure damage are recorded at their existing authoritative reward/damage functions in `AramMatchView.tsx`. Structure credit is capped to remaining HP and sealed Nexus hits earn zero. Passive income, walking, hypothetical damage and teammates' structure damage earn no task credit. Camp clears mean contributor reward shares, minion kills mean last hits, and `firstCompletionSeconds` is time to first useful work; a structure hit is useful work, not necessarily destruction of the building.

`src/taskOutcome.ts` defines the authored evaluation proxy: up to 0.6 for 250 gold of actual camp/wave rewards and up to 0.4 for 600 actor structure damage. Any death yields -1, including death followed by respawn. Health, economic value and team structures/objectives remain separately visible in the existing paired rubric. These coefficients are a bounded experimental proxy, not measured match-win values. The original three-second telemetry remains available as a secondary diagnostic.

The paired runner accepts horizons up to thirty seconds and a second fixed draft (`CHAMPIONS.slice(10, 20)` with cards 10–19). Opt-in paused stepping is bounded at 960 ticks. A pinned assignment record retains the original three-second outcome if normal decision-ring sampling evicts it during the longer continuation. None of these evaluation controls exist in ordinary matches.

## Offline candidate and held-out boundary

`src/pairedTaskLearning.ts` fits a separate policy from validated paired reward contrasts. It requires four independent training seeds, two drafts, two cards and at least two reward differences of 0.02 or more. Invalid controls, shorter/unequal horizons, repeated worlds and held-out seeds are excluded. Insufficient evidence leaves the incumbent unchanged. Context includes the same card identity, attributes, role fit and personalities already used by the live learner.

The learner performs deterministic bounded reward regression with changes capped at 0.08 per feature weight. The live learned factor stays 0.04. `scripts/analyze-task-outcomes.mjs --freeze --wait-training` writes the candidate using training files only; training data and plan hashes are checked again during held-out analysis. Held-out rewards never enter training.

Held-out evaluation reuses the captured legal candidates at each unseen seed's exact checkpoint. It compares the candidate's selection with the incumbent and consults the validated paired continuation only if that action was captured. Unsupported choices are reported rather than given fabricated outcomes. This checks selection and local consequences on unseen match contexts; it is not a full-match candidate-policy trial. No automatic promotion is authorized by this plan.

## Training evidence

All eight planned training cases passed exact-state and duplicate-control validation, covering six cards, two drafts and both side assignments. The observer preserved the seed-81 predecision fingerprint from the prior eight-second evaluation. In that case the first useful structure damage occurred after 8.23/8.87 seconds, beyond the old cutoff.

| Seed / draft / side | Card ID | Original choice's thirty-second task | Alternate push's task | Alternate reward minus original |
| --- | --- | --- | --- | ---: |
| 81 / 0 / original | `p_bigtail` | 308 structure damage | 308 structure damage | 0 |
| 82 / 0 / swapped | `p_neko` | 100 camp gold and 14 minion gold | No credited work | -0.2736 |
| 83 / 1 / original | `p_toaster` | No credited work | No credited work | 0 |
| 84 / 1 / swapped | `p_dns` | No credited work | No credited work | 0 |
| 85 / 0 / original | `p_bigtail` | 50 camp gold and one death | 50 camp gold, no death | +1.12 |
| 86 / 0 / swapped | `p_woozy` | No credited work, no death | 21 minion gold and one death | -1 |
| 91 / 1 / original | `p_turbogamer` | No credited work | No credited work | 0 |
| 92 / 1 / swapped | `p_toaster` | 260 gold from three camp shares | Same camp shares | 0 |

Three independent cases meet the predeclared informative-difference threshold. The candidate fits these different contexts rather than applying a universal farm/push rule. Its training mean squared prediction error fell from 0.241065 to 0.043782; 56 feature weights changed and the largest absolute change was 0.031032, below the 0.08 cap. These are training-fit diagnostics, not held-out gameplay gains.

The candidate file was frozen after the eighth training case and before the first held-out result completed. Held-out labels did not train it. [Frozen candidate](ml-task-candidate.json), [collection](ml-task-collection.json), [analysis](ml-task-outcome-analysis.json).

## Held-out result

All four held-out cases also passed duplicate controls. They cover both drafts/sides and three cards, including `p_research_oner`, which was absent from the training cases.

| Seed | Card ID | Original task | Alternate task | Frozen candidate chose |
| --- | --- | --- | --- | --- |
| 87 | `p_bigtail` | No credited work | 63 gold from four minion last hits | Original farm |
| 88 | `p_craps` | 294 structure damage | Same structure damage | Original farm |
| 89 | `p_research_oner` | No credited work | No credited work | Original farm |
| 90 | `p_research_oner` | 50 camp gold | 50 camp gold plus 35 minion gold | Original farm |

The frozen candidate reduced held-out reward-contrast prediction MSE from 0.109900 to 0.002689. A simple predictor of zero reward difference has MSE 0.007479 on these same four cases. This is encouraging proxy prediction evidence on a small exploratory set. The incumbent was trained on match-winner labels rather than this task proxy, so its prediction loss is not a matched-training benchmark.

The candidate changed **zero** held-out actions when applied through the current legal candidate selector and 0.04 learned factor. It therefore earned zero additional reward and caused zero additional deaths compared with the incumbent. Better proxy predictions did not overcome the existing utility margins. It remains offline: no policy promotion, learned-factor increase or safety-gate relaxation occurred. A full-match policy benefit has not been established.

All 12 planned cases were retained and valid; no missing-target or divergent-control case was discarded. This is 12 seed-level paired contexts, not 36 independent experiments: duplicate controls and alternate continuations share their starting world.

## Verification and remaining limits

`npm.cmd run check:game` passed 347 game tests, three deterministic simulation tests and TypeScript. `npm.cmd run build` passed with the existing bundle-size warning. Focused tests verify real-work credit, passive-income exclusion, death-after-respawn penalties, bounded horizons, successful card-aware fitting, weight limits, duplicate-world rejection, insufficient evidence and held-out leakage exclusion. All twelve browser pairs, analysis assertions, training/plan hash checks, script syntax and `git diff --check` passed.

Gameplay damage, rewards, targeting, ranges, stats and speeds were not changed; the observer reads existing authoritative effects. Normal retreat, well/Nexus protection, kill attribution, objective contestation, anti-oscillation and aliases remain intact. The prior seed-81 predecision state still matches exactly after adding the observer. Camp income can reflect earlier contribution rights, and later replanning is part of the measured continuation. The reward proxy omits other value such as champion-kill income; thirty seconds can miss later payoff or danger. Four held-out windows and three informative training contrasts do not justify automatic deployment or broad card-specific claims.

## Reproduction

From `EsportsClash.Web`, with a disposable Vite server on 5174 and CDP Chrome on 9223:

```powershell
$env:VITE_PORT = '5174'
node scripts/collect-task-outcomes.mjs
# Run this watcher alongside collection to freeze as soon as all training cases finish:
node --experimental-strip-types scripts/analyze-task-outcomes.mjs --freeze --wait-training
node --experimental-strip-types scripts/analyze-task-outcomes.mjs
```

The collector resumes existing planned artifacts, and rejects mismatched seed/draft/side/horizon metadata. Raw cases use `ml-task-<case-id>.json`; the collection manifest, frozen candidate and final analysis are `ml-task-collection.json`, `ml-task-candidate.json` and `ml-task-outcome-analysis.json`.

Thirty seconds can still miss a camp clear or later death. These exploratory samples cover only farm/push at two fixed drafts and cannot establish global ML benefit, broad card-specific effects or match-win improvement. The live controller and simplified headless executor are not asserted to be fully equivalent.
