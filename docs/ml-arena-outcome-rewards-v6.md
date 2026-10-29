# Outcome-focused learning rewards

The owner observed repeated enemy-base movement, then asked to adjust rewards and punishment so learning benefits correct play. This revision changes shared learning feedback, not movement legality or the model's starting weights. It does not restore handwritten per-avatar strategies, tower-dive vetoes or forced retreat.

## What changed

The actual terminal Nexus result changes from +1/-1 to +5/-5. The per-second discount changes from 0.999 to 0.9998: at 1,200 seconds the discounted terminal value retains approximately 79%, instead of 30%. The advantage trace changes from 0.95 to 0.98 per second. These are frozen training choices, not a claim that the finite learner will discover optimal play.

The bounded shared state potential has seven components:

| Component | Weight | Positive and negative feedback |
| --- | ---: | --- |
| Structures | 50% | Actual fractional progress through enemy structures; own structure losses count against the team. |
| Economy | 15% | Net-worth advantage, including purchased items as well as held gold. |
| Team trades | 15% | Enemy deaths relative to own deaths; kills do not replace winning. |
| Living health | 10% | Team health advantage; wasteful damage taken reduces it. |
| Dragon captures | 4% | Actual team capture count advantage, capped in the potential. |
| Siege Golem captures | 4% | Actual captures remain counted after the claimed unit is consumed. |
| Mana readiness | 2% | Living team mana advantage; empty casts spend a real resource. |

Percentages are shaping weights, not win probabilities. Structure damage is capped by real remaining HP and normalized over the complete roster with layer weights; it no longer saturates at an arbitrary raw 10,000-HP lead. Protected-target commands, overkill, walking distance, cast counts and raw damage counters give no direct bonus. All avatars use the same team formula, including new avatars; there is no personal damage quota for tanks/supports.

The transition feedback is `terminal outcome + discount * next potential - previous potential`, with next potential set to zero at a real ending. A repeated state cycle cannot add a separate cumulative bonus to the discounted return. A constant nonzero potential can still have small discount drift; an individual signed transition is not an independent judgment that an action was correct. Terminal reward dominates the bounded potential. Full-cap censored unrolls bootstrap and receive no invented win or loss; interrupted episodes cannot train.

This is the standard potential-difference construction, adapted here as a bounded training aid. Policy invariance results do not guarantee convergence or good performance for this approximate multi-agent implementation. Reference: [Ng, Harada and Russell, 1999](https://people.eecs.berkeley.edu/~russell/papers/icml99-shaping.pdf).

## Implementation and reporting

`arenaOutcomeReward.ts` and `data/arenaOutcomeRewardV2.json` define the versioned formula. The live engine supplies real full-world outcome snapshots only to reward/critic collection. Seven centralized critic inputs carry the same outcomes; the 224-input factual actor observation is unchanged. Boss capture counts update at actual boss deaths. No damage, range, mana cost, cooldown, hit detection, terrain, visibility, crowd control, soft collision, attribution, structure protection or card identity changes.

`arena_marl.py` independently recomputes each new reward from its seven state features, validates per-component sums, discounts, version and real terminal winner, then verifies on-policy probabilities before optimization. Checkpoints bind the new reward/critic/discount settings. Old learner configurations and explicit historical actor formats remain readable under their old frozen images; historical studies cannot resume under the new source.

The version-6 factual reference records the actual reward rules in readable language. Reports show signed sums for each recorded training component, clearly distinguished from win rates and independent improvement. The starting foundation bytes match version 5 exactly. **The previously diagnosed forward/structure bias is not instantly removed by changing rewards.** New checkpoints must learn from experience and pass independent comparisons before stronger play can be claimed.

## Full-match trajectory storage failure and correction

The prior factual study `df636984-d7f1-412f-b60c-4e8308e4fb46` completed three PPO updates, then failed at seed 63004 while exporting its fourth full training match. Its retained worker log shows `RangeError: Invalid string length` at the single `JSON.stringify({item,episode,rows})` call. This was a storage failure, not a reward result; the original study, failed attempt, request and three checkpoints remain preserved.

The collector now journals rows as they arrive and streams the final JSON envelope. It does not accumulate every row or form one giant JSON string. Float32 candidate matrices are losslessly zlib-compressed per row; the Python decoder limits expansion to the exact candidate dimensions and checks the same on-policy probabilities. Existing uncompressed evidence stays readable. Interrupted journals remain partial and do not receive a completed-evidence witness. The codec and its tests are part of the frozen judge manifest, and the new study's preflight runs those tests.

An isolated synthetic stress check covers a JSON file larger than V8's former single-string limit with a bounded JavaScript heap. A separate replay of the exact retained seed-63004 request checks full-match serialization, reading, PPO update and checkpoint restoration under the final source. Both are engineering evidence excluded from fresh qualification; final measurements are recorded in the dated verification JSON.

## Verification and local operation

The accompanying dated JSON records final source/image hashes, checks, real engine/PPO/terminal fixtures and local study status. Known-seed engineering checks establish collection/update consistency only, not competitive benefit. Earlier v5 studies, seed reservations and all historical models/evidence remain preserved. Local services use matching source-pinned versions; no production, paid/GPU/cloud work or character asset changes are part of this revision.
