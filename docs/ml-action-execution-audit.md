# Macro execution and replay audit (2026-10-16)

This pass found and fixed concrete execution and measurement bugs. It does not establish that the learned policy improves play.

## Fixes

- `addEvent` consumed the gameplay RNG inside a React `setEventFeed` updater. React can defer, eagerly invoke, or replay that callback independently of the simulation. Event creation and its one RNG draw now happen synchronously before the pure updater is queued. A TypeScript AST regression test rejects gameplay RNG calls inside React state-updater callbacks.
- The residual selector offered IGL/personality regrouping, but its executor only handled reinforcement and support tethering. The missing IGL branch now follows the same prevalidated living leader through the existing terrain approach function at normal movement speed. The residual commitment uses the actual regroup target's context.
- Fight was offered for targets beyond the combat executor's existing maximum range. Such selections could fall through into lane advance. Candidate availability now uses that same range, retaining the existing objective-fight approach branch.
- A residual push label could fall through into defense movement. Push is now unavailable while that defense branch owns the fallback; an absent residual selection does not label defensive execution as learned pushing.

The paired fixture also records completed-tick positions, intents, cooldowns and damage alongside fresh residual selections. `scripts/paired-behavior.mjs` distinguishes a selected label from a matching intent and ignores stale residual choices interrupted by another branch. An opt-in execution audit aggregates the final intent after each residual actor pass, with bounded samples. These diagnostics do not enter the learner.

## Live evidence

Two fresh seed-81 original-side runs reached exactly 180 simulation seconds with the same full captured-state fingerprint (`488402:fde66807:62b683db`), RNG state, and action-audit records. Each contained 34,859 residual passes with no unexpected selection-to-intent mapping. Before the defense-label correction, the audit had found 2,324 `push:defend` passes in this same horizon; none remain.

A full corrected match ended at 594.17 simulation seconds. Its 98,782 residual passes included 34,234 fight/champion intents, 332 fight/perimeter holds, 14,428 wave/minion intents, 11,233 farm/camp intents, and 4,569 regroup intents. Regroup covered 2,900 reinforcement ticks, **1,507 IGL regroup ticks**, and 162 support-tether ticks. There were no unexpected residual-selection/intent mappings under the documented lane-push and tower-hold adapters.

The full fresh-match repeat also matched exactly through 594.17 simulation seconds: full captured-state fingerprint `1775962:9c79ba3f:71a2a567`, RNG state `635614477`, and all action-audit counts. Raw evidence is in `ml-action-audit-repeat-a.json`, `ml-action-audit-repeat-b.json`, `ml-action-audit-complete-81-original.json`, and its repeat. `ml-action-audit-analysis.json` accounts for both repeated runs and execution mappings.

The corrected seed-81 original and seed-77 swapped scouts completed matches without finding an eligible close safe pair. These are no-target observations, not alternate-action outcome comparisons. The corrected range gate removes previously offered choices whose combat branch would not execute. No paired benefit estimate or offline-policy promotion follows from these runs. Prior model scores and replay seeds should not be compared across this RNG-consumption correction as if the simulation trajectory were unchanged.

The repeat evidence covers the tested lineup and seed, and intent agreement does not prove optimal tactics or attribute every later attack to one macro choice. The next useful learning dataset must contain executable alternatives with sufficient eligible coverage. All existing damage, range, tower risk, normal retreat, attribution, objective contest, Nexus legality, player-card combat stats, and Cardrel invariants remain authoritative.
