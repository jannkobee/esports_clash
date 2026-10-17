# Well/Nexus decisions and ML gate audit (2026-10-16)

The user requested a fix for five-player throws inside the enemy well and Nexus while continuing the ML investigation. Current risk-based combat and normal retreat remain authoritative.

## Gameplay changes

- `src/baseSafetyRules.ts` shares the existing healing rectangle and lethal well stripe with live mechanics and AI. Target selection, retained champion targets, dive risk, optional teamfight approaches and support following avoid well chases. Safe ranged poke at the healing fringe remains possible; target healing is included in the dive estimate. Actual healing, damage, attack legality and movement speed are unchanged.
- `src/teamTempoRules.ts` bounds fallback lane advancement at the front attack position of the opposing Nexus. An exposed Nexus or distant wave cannot send the lane destination past it into the well. An unsafe Nexus approach holds at the ordinary structure perimeter, including when a wave is ahead.
- `src/nexusFinishRules.ts` forecasts the authored five-pulse/reload schedule before entry, including an idle Nexus holding its shots until someone enters range. It counts discrete basic attacks after arrival/readiness and before predicted death. Dead, recalling, stunned, obstructed or late contributors cannot supply fictitious immediate damage. The live adapter passes actual structure damage multipliers and incoming Nexus projectiles. Nexus damage is not divided across five champions or a minion wave.
- `AramMatchView.tsx` keeps a live sealed Nexus in threat reads while excluding it from attackable structures. Low Nexus health alone no longer bypasses the finish assessment. Actual well exposure or imminent lethal Nexus fire can interrupt a held fight through `decisionCommitment.ts` and ordinary terrain-aware retreat. There is no dive-abort state, elapsed dive timeout, rescue sprint, forced displacement or blanket attack suppression.

## Live verification

`EsportsClash.Web/scripts/verify-base-safety-live.mjs` mounts the real arena in disposable headless Chrome, changes only fixture starting state and advances the ordinary simulation at 30Hz. It mirrors each case across both teams. Raw results: [base-safety-live-evaluation.json](base-safety-live-evaluation.json).

| Fixture | Window per side | Observed result |
| --- | --- | --- |
| Five full-health attackers near well defenders, exposed healthy Nexus | 15 seconds | No well target chase, beam entry, finish commitment or attacker death; ordinary retreat/recall remains available. |
| Five weak attackers just outside Nexus firing range | 15 seconds | No Nexus-range entry, beam entry, finish commitment or attacker death. |
| Attackers deliberately placed behind a live guard tower at a sealed Nexus | 15 seconds | All five recognize danger and choose ordinary retreat; no chase or finish commitment. All five die while escaping the already-created trap. This is not a survival guarantee. |
| Exposed one-HP Nexus with defenders in their well | 3 seconds | Nexus destroyed legally on both sides; no attacker deaths. |
| Five attackers placed just inside the well beam with held fight commitments | 1 second | All five choose normal retreat, leave the beam and survive. |

Attack skills are on cooldown and well defenders are stationary/stunned to isolate movement, basic attacks and structure fire. The sealed case is intentionally an invalid approach starting state; the game still punishes it. These fixtures do not establish results for every draft or full match. The finish forecast is conservative about incoming projectiles and shields, excludes ability/minion damage and approximates travel/attack delivery; it is a bounded decision aid, not an exact future simulation. Shared headless target selection changed, but the simplified headless executor does not establish fountain/Nexus parity with the live arena.

`npm.cmd run check:game` passed 341 game tests, three deterministic simulation tests and TypeScript. `npm.cmd run build` passed with the existing bundle-size warning. Focused regressions cover mirrored geometry, five-player target acquisition, normal commitment interruption, late/dead contributors, idle volleys, legal last hits, healthy group finishes and ranged finishes.

## ML gate coverage

Evaluation-only `inspectSafeMacroExperiment` reports the first blocking gate, all applicable gates and card/action pairs that pass everything except the utility-gap limit. It neither creates actions nor changes thresholds. The paired inspector exports these counts; `scripts/analyze-macro-gates.mjs` validates and aggregates them.

Fresh fixed-step natural scouts used the existing draft/policy for seed 81 original and seed 82 swapped, each capped at 180 simulated seconds. Both ended without an eligible close pair; the runner's no-target exit is expected and preserves evidence. Sources: [seed 81](ml-gate-audit-81-original.json), [seed 82](ml-gate-audit-82-swapped.json), [analysis](ml-gate-audit-analysis.json).

| Coverage | Decision ticks |
| --- | ---: |
| Residual decisions inspected | 74,308 |
| No available legal same-tier pair | 68,415 |
| Available legal same-tier pair | 5,893 |
| Held commitment/non-utility selection | 68,318 |
| Below the existing healthy threshold | 20,605 |
| Defense active | 19,494 |
| Pair exceeds the 0.1 utility gap | 5,891 |
| Passes everything except utility gap | 304 |
| Fully eligible | 0 |

Simultaneous gate counts overlap. Of the 304 otherwise-safe ticks, 302 are farm/push across five cards and two are fight/regroup for Flaker. Their utility gaps range from 0.198 to 0.433, above the existing 0.1 limit. Only two of all 5,893 legal-pair ticks have a close enough utility gap, and those fail other gates.

This identifies opportunity scarcity, not learning success. Repeated adjacent ticks are not independent outcomes, these are early-match samples from one draft, and no alternate was run. The card-aware learner remains active at its existing 0.04 factor; no candidate is promoted and no safety or experimental threshold is relaxed. A next investigation can inspect the farm/push utility factors and actual destinations behind these large gaps before deciding whether additional safe training contrasts are justified.

Reproduce from `EsportsClash.Web` with a disposable Vite server/CDP browser:

```powershell
node scripts/verify-base-safety-live.mjs
$env:VITE_PORT = '5174'
node scripts/paired-live-rollout.mjs --checkpoint --fixed-scout --scout-seconds=180 --seed=81 --original --horizon=8 --output=../docs/ml-gate-audit-81-original.json
node scripts/paired-live-rollout.mjs --checkpoint --fixed-scout --scout-seconds=180 --seed=82 --horizon=8 --output=../docs/ml-gate-audit-82-swapped.json
node scripts/analyze-macro-gates.mjs ../docs/ml-gate-audit-81-original.json ../docs/ml-gate-audit-82-swapped.json
```
