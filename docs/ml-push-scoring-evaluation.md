# Push scoring and safe ML comparisons (2026-10-16)

The next requested step was to investigate the farm/push utility gaps found by the gate audit. A concrete scoring/execution mismatch was confirmed and corrected; this is not a learned-policy promotion.

## Confirmed mismatch

Evaluation-only examples now include raw utility factors, weighted contributions, actor/camp coordinates, local threat and the candidate structure's distance/outlook. The diagnostic-only seed-81 run matched the prior 180-second state fingerprint and RNG exactly, so this instrumentation did not change its trajectory. Source: [ml-scoring-before-81-original.json](ml-scoring-before-81-original.json).

At 45.03 seconds, BigTail had no local influence threat and was walking the lane. The push candidate nevertheless estimated attacking a full-health turret 921 pixels away, assigning a -0.174 danger contribution and creating a 0.265 farm/push gap. The bounded lane destination stopped before that turret. Craps, NeKo and Daft showed the same mismatch, with the scored turret 1,083–1,186 pixels away and approximately -0.198 to -0.201 danger contributions. These are first examples per card/pair, not an unbiased distribution of every decision.

## Implementation

`EsportsClash.Web/src/residualPushRules.ts` describes the existing fallback executor in its original order: an already-legal structure attack, an in-range minion attack, an enclosing-camp exit, or bounded lane advancement. The live controller uses the same planned movement destination for scoring and execution. The plan's kind and target identify its macro commitment context; the existing 0.65-second deadline still expires normally.

Actual structure/minion attacks use the existing tactical outlook at their real target. Walking instead uses threat at the actor and along the actual route, without treating a distant building's health or travel-to-attack penalty as current survival risk. Nearby enemies and route threats still contribute danger. Strategic/personality/coordination/learned weights, farm gates, priority tiers, attack legality, tower risk, normal retreat, Nexus/well rules and all experiment thresholds remain unchanged. Farm travel still uses its existing approximate distance score; this pass does not claim exact route timing or simulate future combat.

Evaluation-only execution counts compare the scored push plan's kind and target with the completed intent. `scripts/paired-live-rollout.mjs --audit-only --fixed-scout` measures all legal opportunities through the requested horizon without assigning an alternate. This allows full-window coverage independently of the first checkpoint opportunity. `scripts/analyze-push-scoring.mjs` validates the baseline, coverage and paired outcomes and writes [ml-push-scoring-analysis.json](ml-push-scoring-analysis.json).

## Natural coverage and regression checks

| Fresh natural 180-second window | Before: eligible ticks | After: eligible ticks | After: inspected ticks | Scored push plans checked |
| --- | ---: | ---: | ---: | ---: |
| Seed 81 original | 0 | 132 | 36,353 | 15,120 |
| Seed 82 swapped | 0 | 11 | 37,124 | 14,903 |

The corrected version supplied 143 eligible ticks with the existing 0.1 utility-gap and safety limits. All 30,023 checked push plans matched their executed intent/target. Adjacent eligible ticks are correlated and are not 143 independent experiments. The before/after match trajectories differ after the score change, so this table describes opportunity coverage rather than a causal gameplay outcome. Corrected sources: [81 coverage](ml-scoring-coverage-81-original.json), [82 coverage](ml-scoring-coverage-82-swapped.json); previous sources: `ml-gate-audit-81-original.json` and `ml-gate-audit-82-swapped.json`.

`npm.cmd run check:game` passed 343 game tests, three deterministic simulation tests and TypeScript. `npm.cmd run build` passed with the existing bundle-size warning. The two new focused regressions cover mirrored bounded lane scoring, nearby threats, real attack pressure/survival and fallback precedence. All ten live well/Nexus fixtures passed again; the deliberately trapped sealed-Nexus group still dies while choosing normal retreat, as documented previously. Script syntax, analysis validation and `git diff --check` also passed. Influence remains a coarse spatial estimate, not an exact forecast of path hazards or combat.

## Exact-state comparisons

Two first eligible farm/push cases were scouted after the fix, with the existing draft/policy and unchanged safety thresholds. Each was replayed as two incumbent controls plus an alternate, accepting only exact predecision matches and identical incumbent three/eight-second outcomes and full captured-state fingerprints.

| Seed/side | Card | Decision second | Maximum route separation during commitment | Eight-second rubric |
| --- | --- | ---: | ---: | --- |
| 81 original | BigTail / Buck | 128.23 | 64.77 px | No material difference |
| 82 swapped | NeKo / Kazemaru | 149.83 | 76.79 px | No material difference |

Both assigned choices reached their intended executors and both duplicate controls matched. The alternate changed the route immediately, rather than merely changing a decision label. At eight seconds, both cases had identical actor health, survival, economy, champion damage and team structure/objective state. NeKo's alternate had a small favorable three-second health/progress difference that disappeared by eight seconds; it is not a durable improvement. Sources: [81 original](ml-scoring-after-81-original.json), [82 swapped](ml-scoring-after-82-swapped.json).

The two cases cover one action pair and two cards. They are exploratory selected contexts, not independent evidence of a global win-rate improvement or a card-specific effect. The existing learner remains active at factor 0.04, and offline candidates remain undeployed. Future collection should seek independent contexts and meaningful delayed outcomes before updating learning from these comparisons.

Reproduce from `EsportsClash.Web`, with disposable Vite on 5174 and CDP on 9223:

```powershell
$env:VITE_PORT = '5174'
node scripts/paired-live-rollout.mjs --checkpoint --fixed-scout --audit-only --scout-seconds=180 --seed=81 --original --output=../docs/ml-scoring-coverage-81-original.json
node scripts/paired-live-rollout.mjs --checkpoint --fixed-scout --audit-only --scout-seconds=180 --seed=82 --output=../docs/ml-scoring-coverage-82-swapped.json
node scripts/paired-live-rollout.mjs --checkpoint --fixed-scout --scout-seconds=180 --seed=81 --original --pair=farm-push --trace --horizon=8 --output=../docs/ml-scoring-after-81-original.json
node scripts/paired-live-rollout.mjs --checkpoint --fixed-scout --scout-seconds=180 --seed=82 --pair=farm-push --trace --horizon=8 --output=../docs/ml-scoring-after-82-swapped.json
node scripts/analyze-push-scoring.mjs
```
