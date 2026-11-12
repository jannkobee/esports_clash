# Experience-based local FPS navigation learning (11 November 2026)

The owner requested a high-value function that lets the FPS bots actually learn from experience. `/root` integrated an episodic action-value learner into the browser-local exhibition. No agents, asset generation or official match activation were used.

## What learns

`fpsLiveLearning.ts` implements a small linear action-value function, `Q(context, features) = weights · features`. Four contexts distinguish attacking/defending around A/B, each with 76 bounded inputs. The inputs describe route progress/detour, personally reported exposure, allied congestion/support, own health/ammo/reload, clock, role interactions, objective state and map cells. No player IDs, card names, private DNA or ability ratings are learned parameters.

The policy starts with mutable geometric priors favouring progress and lower exposure. Every coefficient can change, including initially zero map/role coefficients. It considers the existing route and up to four nearby alternatives through directly reachable ground, then rejoins a legal route to the current goal. These spatial alternatives are generated from geometry rather than the seven round-archetype labels. Seeded epsilon-greedy exploration starts at 10% and gradually falls to a 3% floor. Frozen evaluation forces zero exploration and never updates weights.

This first learner controls navigation approaches. Objective selection, combat/aim, radio and grenade decisions retain their existing authored consumers. Collision, movement, weapon rules and actual plant/defuse channels remain authoritative. Close combat, channels, boosts, peeks, short final approaches and urgent objective travel release the optional learned navigation layer.

## Experience and value update

An approach normally commits for up to four seconds, with goal/evidence changes and combat interrupting it. A transient actor-local trajectory records what happened:

- Progress is measured as the change in the physical route distance to that approach's goal, divided by 12 and clamped to ±1. Threat-dependent route scoring is excluded from this measurement, so a stationary bot cannot obtain artificial progress by changing threat information.
- Local reward is `0.08 × progress + 0.20 × HP change / 100 − 0.001 × elapsed seconds`, with the HP change bounded and the time charge capped at eight seconds per segment.
- The terminal team result supplies +1 for a win or −1 for a loss. Monte Carlo returns discount by `0.995 ^ elapsedSeconds` and are bounded to ±2. The local shaping is an explicit navigation preference; it is not a proven optimal reward design.
- `learnFpsActionValue` fits the measured return with a normalized gradient step: rate `0.18 / sqrt(1 + updates/3000)`, squared-feature normalization, bounded error and coefficient limits of ±4. There is no authored correct-action label.

Only completed rounds update the function. Up to 40 segments per actor / 400 per round bound memory and work. Abandoning or restarting a round discards its pending trajectory. Death settles the active approach but does not invent a terminal result; the actual completed round supplies that later. Learning changes decision values rather than combat stats or player abilities.

## Integration, persistence and reproducibility

- `fpsLiveSimulation.ts` integrates selection, interruption, actual outcome measurement and completed-round training. A separate seeded random stream isolates exploration from the existing observation, execution and hit streams. At most one fresh learned route evaluation is admitted per fixed tick; existing commitments are retained while another evaluation waits.
- `fpsLiveLearningStorage.ts` validates compatible bounded checkpoints and saves anonymous numerical parameters in browser-local storage. Compatibility binds the feature version, physical map geometry, spawns/sites and mechanical weapon/objective facts. Round batches merge onto the latest saved model and recent episode IDs deduplicate commits. Cross-tab writes are not transactionally serialized; the normal broadcast and its Document PIP share one owner.
- A running exhibition pins a cloned starting checkpoint. Other local writes do not change it mid-round. The same seed, identities, profiles, settings and starting checkpoint reproduce choices and updates. Bare simulation constructors remain unchanged unless their learning option is supplied; `mode: 'frozen'` enables explicit evaluation without training.
- `FpsSimulationLab.tsx` enables local learning by default, offers a checkbox and reset inside one collapsed Local bot learning panel, and reloads saved parameters for a new exhibition. `FpsLiveBroadcast.tsx` shows completed learning rounds, updates and experiments under More. Diagnostics v2 exports the initial/current checkpoint and learning settings along with the existing seed/profile data.
- Storage failure leaves the running in-memory learner operational; durable cross-device/cloud learning is not implemented. Official/contextual/historical matches and the separate frozen ML controller do not use this model.

## Verification

Thirteen focused regressions pass: checkpoint validation, outcome-driven preference changes and reversal, atomic batch validation, duplicate suppression, legal routes, incomplete-episode discard, evaluation-budget deferral, stationary-progress protection, CT/T updates, frozen evaluation, persistence/failure handling, hidden-opponent independence, seeded action/update reproducibility, a real planted-objective round and reloading its checkpoint, and urgent carrier travel. Several related contracts are covered together in individual tests.

Three sequential headless exhibitions train and pass their checkpoint into the next constructor. Each runs 7,200 ticks / 240 simulated seconds with detailed profiles. Carrier ownership is checked every tick while carried; finite positions, bounds and physical collision exclusion are sampled once per second, excluding elevated boosts.

| Seed | Completed training rounds, cumulative | Learned updates, cumulative | Plants | Blue–red score at cap | Physical samples |
| --- | --- | --- | --- | --- | --- |
| 421 | 3 | 332 | 3 | 2–1 | 2,081 |
| 99017 | 6 | 686 | 3 | 1–2 | 1,821 |
| 2030 | 8 | 954 | 2 | 0–2 | 1,955 |

There were no missing carriers or sampled physical violations. The saved function changed its greedy choice in 47 of 110 additional navigation contexts. This establishes that learned parameters affect actual selections; it does not establish that each changed choice is better.

A separate synthetic two-route feedback task trains on sampled outcomes with route success probabilities 15% and 85%. On 1,000 held-out trials using paired random draws and perturbed inputs, wins rise from 140 with the initial preference to 867 after training. The reversal regression also switches preference when the outcome probabilities reverse. This is a functional learning test, **not an FPS win-rate benchmark**.

The fresh and trained functions were also frozen on held-out FPS seed 441 for 240 seconds. Neither checkpoint changed. Their partial scores were 1–1 and 0–1, with three and one plants respectively. Different round durations and the small, incomplete sample prevent a match-strength conclusion. Broader complete-match evaluation against multiple fixed opponents is still needed.

Headless training-run step timings were approximately 0.23–0.28 ms at the median, 11.7–15.3 ms at the 95th percentile, and 32.5–38.1 ms at the 99th percentile on this host. These include the existing simulation and route searches; they do not qualify browser frame pacing or prove that all hitches are eliminated. The learner's numerical fit is bounded, but navigation remains a material CPU consumer.

Required `npm run check:game` passes: design invariants, all 165 main test files, the separate three-case match simulation suite (including its ten-seed batch) and TypeScript. Direct execution establishes the 13 learning subtests above because the parent runner reports file totals. `npm run build` passes (Vite 8.89 seconds) with its existing >500 kB chunk warning, and `git diff --check` passes. Browser-rendered acceptance, broad match-strength gains, automatic discovery of all FPS tricks, official activation and deployment are not claimed.

Local evidence: `.local-tools/fps-learning-evaluation.mjs`, `fps-learning-evaluation.jsonl`, `fps-learning-contract.log`, `fps-learning-game.log` and `fps-learning-build.log`. These are local diagnostics, not published player evaluations or frozen ML training artifacts.

Preserve private DNA, parody aliases, stable detailed abilities, inert Economy Judgment, careers, official/historical results, `/evolution/game-modes` availability and owner-started Colab-only character asset processing. Unrelated dirty workspace work is retained.
