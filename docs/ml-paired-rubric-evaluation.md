# Predeclared paired macro-outcome pilot (2026-10-15)

The six cases and outcome rule were written to `ml-paired-rubric-plan.json` before collection. This pilot found **no material outcome difference** in its three valid paired comparisons. It does not support promoting the offline ML candidate or changing the live learned weight.

## Endpoint and acceptance

The opt-in browser fixture captured the actor's eight-second survival, health, cash plus item value, and damage, together with both teams' remaining structure HP, Dragon Aspect control, and living Siege Golem units. The primary classification prioritizes survival. If both arms die, it labels the case `both-dead`; if both live, it compares health at a 5-point fraction threshold, structure margin at 100 HP, Dragon Aspect, living Siege Golem units, and economic value at 50 gold. A favorable result needs at least one meaningful gain without a meaningful loss; mixed changes are reported as mixed. Damage and the older three-second proxy are descriptive only. Cash plus item prices is an approximate economic asset value, not exact lifetime gold earned.

Each case still requires the exact actor, simulation time, legal action pair, predecision fingerprint, assigned action, and duplicate-incumbent agreement on the three-second outcome, eight-second actor outcome, and full captured-state fingerprint. A missing eligible decision and a failed duplicate control are distinct rejected observations.

| Planned case | Result | Card | Primary classification |
| --- | --- | --- | --- |
| Seed 80, original, fight/regroup | Accepted | `p_bigtail` | No material difference |
| Seed 80, swapped, regroup/wave | No eligible target in 180 seconds | — | Not assessed |
| Seed 81, original, fight/regroup | Duplicate controls diverged | `p_flaker` | Not assessed |
| Seed 81, swapped, regroup/wave | Accepted | `p_woozy` | No material difference |
| Seed 82, original, fight/regroup | Accepted | `p_woozy` | No material difference |
| Seed 82, swapped, regroup/wave | No eligible target in 180 seconds | — | Not assessed |

Accepted comparisons were 2/3 planned fight/regroup cases and 1/3 planned regroup/wave cases. Their measured survival, health, structure margin, objective control, and economic value differences were zero at the eight-second follow-up; damage also did not differ. This is too little coverage for a card-specific or action-specific estimate. The unscored Astra case illustrates why duplicate controls remain mandatory: identical assigned actions led to materially different later health, gold, and damage.

Raw cases are `ml-paired-rubric-{80,81,82}-{original,swapped}-*.json`; the fixed-plan accounting is `ml-paired-rubric-analysis.json`. This tests isolated safe macro-action alternatives, not the deployed learner's match-level performance. The next measurement dependency is a larger, repeatable set of eligible comparisons, especially wave choices, and longer team outcomes. No live-policy promotion was made.
