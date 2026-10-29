# MOBA intelligence engineering record — 2026-10-23

Latest continuation: [durable intelligence jobs, macro PPO and isolated source proposals](ml-autonomy-v3.md), with [new verification evidence](ml-autonomy-v3-verification-20261023.json). Earlier phase status below describes the preceding increment and is retained as history. Competitive improvement remains unproven.

Owner request: audit the actual learning failures, repair regression measurement, then implement parameter evolution before relying on it for MARL, source evolution and autonomous operations. This record distinguishes working software, collected evidence and missing qualification. No gameplay improvement or completed end-state system is claimed.

## Ownership and preserved boundaries

This change owns learned observations, optional farm/push strategy configuration, the isolated live evaluator, worker evidence/diagnostics and the existing Laravel learning-report view. It does not own character assets, deployed worker images, production configuration or existing frozen experiments. Existing unrelated working-tree changes are preserved.

Real damage, cooldowns, resources, movement/collision, targeting legality, visibility rules, towers/well/Nexus rules, normal retreat, safe perimeter/bush selection, ten-second kill attribution, champion-first objective contests, facing/commitment hysteresis and Cardrel/parody aliases remain authoritative. Historical forced dive abort/evacuation stays superseded. Configurations cannot alter these systems or personality/IQ stats. No Vercel or production deployment occurs.

## Architecture audit

| Concern | Actual implementation and boundary |
| --- | --- |
| Live simulation | `EsportsClash.Web/src/components/AramMatchView.tsx`: `updateAramSimulation` combines simulation and React lifetime. `evaluationStartPaused` fixes tick scheduling; `evaluationRenderless` removes drawing. The existing private `__esportsTrusted` bridge executes those same ticks and snapshots. There is no new standalone authoritative engine extraction. |
| Simplified simulator | `matchSimulationEngine.ts` shares several mechanical modules but has its own simulation loop and omits full live execution. Its passing tests and win rates do not qualify policies for live play. |
| Mechanical authority | `arenaRules.ts`, `abilityRules.ts`, `skillRangeRules.ts`, `objectiveRules.ts`, `towerDiveRules.ts`, `baseSafetyRules.ts`, collision, economy and respawn helpers, plus substantial inline live code. Strategy proposals cannot edit these through the new parameter interface. |
| Combat and macro strategy | `combatDecision.ts`, `decisionCommitment.ts`, `teamIntentDecision.ts`, `tacticalOutlook.ts`, `spatialInfluence.ts`, `postFightConversion.ts`, `residualPushRules.ts` and inline jungle/objective/recall gates. Most target, ability, movement and macro eligibility decisions remain heuristics. |
| Arbitration | `utilityDecision.ts` uses normalized factors, fixed priority tiers and commitments. `macroActionDecision.ts` consumes already validated actions. Priority and commitment are constraints; farm/push scoring constants are strategic preferences. |
| Ordinary adaptive learner | `adaptivePolicy.ts`: bounded, card/role/personality-conditioned linear preferences for fight/wave/regroup/farm/push. Live utility weight remains **0.04**. Local browser storage is updated after matches, separately from the Lab. This is neither a shared champion registry nor PPO/MAPPO. |
| Offline contextual learner | `taskContextPolicy.ts`: action-specific farm/push observations and regularized outcome-contrast fitting. `taskConfidencePolicy.ts` independently calibrates a one-sided 90% error buffer, with a fixed 0.02 advantage margin. |
| Learned execution | `rewardMacroDecision.ts` can replace one eligible farm/push decision in an explicit replay checkpoint. `safeMacroExperiment.ts` retains health, danger, tower, defense, priority, commitment, proximity and utility-gap gates. The model does not control all later decisions. |
| Labels | `aiDecisionTelemetry.ts` shapes short individual outcomes; `teamTaskOutcome.ts` adds team deaths, structures, economy, health and objectives over up to 30 seconds. Terminal Nexus outcomes override that proxy, but most task windows never reach a terminal state. |
| Live counterfactual evidence | `paired-live-rollout.mjs`, `broad-study-evidence.mjs`, outcome/behavior validators and `infrastructure/evolution/evidence.mjs` check repeated baselines, actual assignment/execution, recomputed labels and same-action learned replay fingerprints. |
| Training and storage | Laravel `EvolutionService`, `EvolutionRun`, `PollEvolutionRun`, PostgreSQL plans/results/audits and persistent worker artifacts. `runner/{server,pipeline,training,train_stage,operations}.py` implement bounded collection, CPU PyTorch fitting, calibration, fitting-only replay and retention. A saved optimizer/checkpoint is not general PPO optimizer continuation. |
| Operational UI | The actual Evolution Lab is authenticated **Laravel Blade**, separate from the React game. `components/EvolutionsView.tsx` is not its active administration surface. This change extends the real Blade report, rather than adding a competing dashboard. |

### Answers to the ten audit questions

1. Damage/legality are deterministic rules. Target and ability preferences, lane/jungle selection, tactical risk assessment, coordination and most action eligibility are currently hardcoded strategy. Existing survival and anti-oscillation protections remain required.
2. Ordinary ML adds a small same-tier score term; offline task models can change one safe replay decision. It cannot currently learn complete matches, low-level combat execution or a competitive historical opponent league.
3. Protected mechanics include actual damage/range/resource/vision legality, terrain validity, reproducible RNG, attribution and legal Nexus finishing. Current repository rules also protect ordinary retreat, objective contest priorities, commitments and identity boundaries.
4. Farm strategic/tactical scores and ordinary/tempo push priority are authored preferences. Their actual constants, rather than the illustrative prompt interface, are extracted into `aiStrategyConfig.ts`.
5. The initial optimization domain is those five bounded optional farm/push factors. Actions remain available only through their existing gates. All other domains remain ineligible for this optimizer.
6. Historical learned execution is demonstrated. Robust independent gameplay improvement is **not** demonstrated. None of the eighteen completed stored studies passed its historical gate.
7. Failure mechanisms include reward-versus-utility score units, limited action authority, card-heavy/partial observations, large calibration buffers, prediction/generalization error, short outcome windows, inconsistent training versus scored contrast representations, and the separation between ordinary browser learning and the offline Lab. These are supported diagnoses/hypotheses, not proof that a larger network fixes them.
8. Individual gold, CS and combo rewards can favor personal progress; the team proxy improves attribution but retains authored, uncalibrated weights. Terminal strategic outcomes are rarely observed in a 30-second window. No reward coefficients were retuned against held-out results here.
9. Existing live replays and the trusted server bridge share the actual live loop. The simplified Node engine does not. New compatibility evidence is specific to the recorded seed/draft/checkpoints and is not universal parity proof.
10. Browser adaptive weights and card memory persist separately from offline candidates; evolving global policies do not govern those updates. Evaluation must reset that memory. A future production champion system must explicitly version both, rather than treating the isolated research registry as production activation.

## Historical regression reproduction

Separate, read-only reanalysis: [historical inventory](ml-intelligence-historical-audit-20261023.json). Snapshot includes **37** studies: **18 completed, 15 failed, three cancelled and one recorded running**. Recorded running is a stored state, not proof of process health. Seventeen completed studies report zero changed decisions. One completed study changes a decision and loses team reward. No completed study passed the original exploratory gate.

Seventeen completed runs pass the new hash/allocation screening. One completed run (`42845feb-0994-4ce6-b0eb-3af1799f856e`) has both raw JSON and compressed JSON for seed 32027; the reader rejects ambiguous evidence. Three startup-failed runs lack execution allocation data. These cases are explicitly reported, not silently included or deleted. The audit verifies stored raw hashes (including explicitly identified legacy decompressed hashes), fitting/calibration/candidate witnesses, seed splits, recorded repeated controls and learned metrics. It does not rerun historical source versions or claim cryptographic hashes establish simulator equivalence.

The previously unfinished validation run `1ebdb836-6803-42bd-9fdd-ad92f2aeeb5b` actually completed: 24 valid held-out worlds, **zero** changed decisions, MSE **0.2401008743** versus zero-contrast **0.2404896700**, and failed gate. Slight prediction improvement did not produce useful behavior.

Run `b55a1017-870c-45a7-8653-43757303d892` reports 22 valid held-out worlds, one changed decision, team reward difference **−0.1035547071**, zero improved cases and one worse case. Its prediction MSE **0.0981524102** beats zero contrast **0.1098173361**, yet gameplay regresses. Coverage is only **0.5909**. Prediction accuracy and strategic benefit are separate metrics.

[Earlier frozen task reproduction](ml-intelligence-regression-reproduction-20261023.json) independently recomputes all eight seed-93–100 task cases using existing TS decision, reward and broader-outcome code. Exactly one choice changes; its reward difference is **−0.18**. The old source artifacts and models are not overwritten. The recorded authority example explains that a predicted +0.082617 reward advantage contributed only +0.003305 utility through the 0.04 factor against a 0.095002 heuristic gap. Enlarging that influence alone previously exposed a losing action.

## Phase 1 — implemented

- `adaptiveObservation.ts` builds learned context from own state and already-visible opponent levels. It never receives hidden opponent levels or private unspent gold. The live adaptive feature call no longer uses exact all-opponent gold/net-worth/level aggregates. Full-state outcome labels remain available to the evaluator. Existing hardcoded policies have not all been converted to a restricted observation API.
- `paired-live-rollout.mjs` clears card memory at each independent replay. The frozen adaptive reference still comes from its declared artifact. Personalities and own card attributes remain features.
- `evidence_io.py` checks compressed/uncompressed evidence, explicit legacy hash bases, missing/ambiguous raw files, duplicate seeds and allocation mismatches. Cached valid cases are independently revalidated by the original TS bridge on resume. Missing raw evidence cannot masquerade as a valid cached world.
- `training.py` explicitly rejects duplicate seeds, wrong fitting/calibration splits, invalid contrasts and malformed predecision values before fitting/calibration.
- `regression.py` records optimization, generalization, gameplay, stagnation, evaluator-control and incomplete-evidence signals. New execution plans freeze its versioned configuration; source manifests fingerprint it and the evidence reader.
- Reports show actual changed-decision rate, Wilson uncertainty, bounded seed-cluster Hoeffding reward intervals, planned/attempted/measured denominators, coverage, side summaries and explicit reasons. Missing cases are not fabricated zero outcomes. Thirty-second reports expose no invented full-match win rate. These diagnostics do not loosen the existing gate or authorize promotion.
- The actual authenticated Blade report displays stored diagnostics, escapes text and labels older studies as lacking this new measurement. No historical result is retroactively rewritten.

**Validated:** eight historical task replays; recorded raw/model evidence across retained studies; tests distinguish an intentionally degraded policy from a predictor that improves without action influence. Final test and live results are listed below.

**Unproven:** empirically calibrated reward weights, broad observation legality across every old heuristic, full extraction/parity of all simulation subsystems, or improved gameplay intelligence.

**Next:** complete an independently seeded, adequately powered parameter trial with durable shared seed reservation. Keep the incumbent until then.

## Live environment and measured failures

`live-executor.mjs` uses the existing private `__esportsTrusted.step/snapshot` bridge in headless Chromium. It executes the current React-owned live loop, with rendering optional and game RNG untouched by proposal generation. It clears browser policy/card memory before each episode. A copied source snapshot is compiled inside a disposable, network-isolated Docker layer; only new reports are written to the host. The existing deployed workers and original evidence volume are not replaced.

Two earlier known-seed baseline attempts are retained: a six-minute scout-based run exhausted its wall budget; a later 900-tick scout batch exceeded the 60-second CDP deadline. Inspection found that audit-only scouting captures a full growing checkpoint every tick after 120 seconds because no target is ever selected. Full-match evaluation now uses the existing trusted bridge and sparse checkpoints. This is an evaluator-path correction, not a gameplay speed/stat change. Ordinary paired checkpoint collection keeps its original behavior and restoration semantics.

[Trusted baseline](ml-intelligence-trusted-baseline-20261023.json) records two identical complete original-side matches, ending at **566.4** simulation seconds, plus repeated swapped-side and renderer comparisons through 120 seconds. The subsequent final baseline repeats this on the final source after a type-only generic correction. Side-swapped complete matches beyond 120 seconds are not established by this baseline fixture; future acceptance trials require actual terminal side-swapped matches and repeated controls.

The [final baseline](ml-intelligence-final-baseline-20261023.json) passes all five planned episodes. Both original-side terminal runs have identical world fingerprints, RNG and final statistics, end at566.4s with Blue winning, and take180.756/128.796wall seconds under the one-CPU cap. Repeated swapped-side and original renderer controls match at0/30/120s. Final source hash: `9b63e76f06a9f9679eb0b2b2f351964f4f4a6ce10d2c93d578284b18df8ed3b4`. These are compatibility measurements, not independent win-rate samples.

Failed plans/results remain in `ml-intelligence-live-baseline-20261023.json.plan.json` and `ml-intelligence-strategy-baseline-20261023.json{,.plan.json}`. No censored match is given a manufactured winner or counted as a successful full-match evaluation.

## Phase 2 — implemented, qualification incomplete

`aiStrategyConfig.ts` has a strict, versioned schema, numeric bounds and semantic relationships for five discovered preferences:

| Parameter | Existing default | Bounds |
| --- | ---: | ---: |
| Farm strategic factor | 0.42 | 0.32–0.52 |
| Farm tactical factor | 0.36 | 0.26–0.46 |
| Post-fight farm tactical factor | 0.65 | 0.55–0.75 |
| Ordinary push strategic factor | 0.18 | 0.08–0.28 |
| Tempo push strategic factor | 0.62 | 0.52–0.72 |

The adapter adjusts available **optional** actions only; it preserves legal flags, priority tiers, all danger/travel/personality/learned terms and commitments. Ordinary games use the existing default values. External per-team configurations require an explicitly paused development fixture. Invalid schemas fail rather than accepting mechanical knobs.

`strategy-evolution.mjs` proposes deterministic antithetic offspring around the incumbent, bounds and validates every configuration, computes paired seed-cluster uncertainty and supports promote/reject/inconclusive research outcomes. Its registry retains content-addressed policies, serialized transitions and rollback events. Raw artifact hashes and derived metrics are rechecked before any internal promotion. The game does **not** consume this research registry.

`strategy-study.mjs` implements fitting-world candidate selection, frozen selection before held-out attempts, current/historical registry opponents and a fixed farm-biased reference, side-swapped full matches, duplicate baseline controls, durable raw attempts and a 90-minute wall budget. Incomplete attempts remain in the denominator. Source/judge hashes, bounds and acceptance thresholds are frozen. Interrupted attempts are not silently retried. A budget-exhausted invocation produces an inconclusive result; automatic continuation across new budget windows and distributed job leasing are not implemented for this new study type.

The predeclared internal gate requires 32 independent evaluation seeds, two drafts, terminal matches, reproducible controls, positive 95% bounded paired improvement and no extra team-death cases. It also requires verified seed reservation. The supplied seed exporter inventories retained allocations and historical docs but is **not** an atomic PostgreSQL reservation, so the standalone study records `seedReservationVerified: false` and cannot qualify a promotion. The CLI can collect diagnostic evidence; shared Laravel allocation must be connected before accepting it as independent evidence. A complete trial may exceed one local 90-minute invocation; do not lower the gate to fit the budget.

**Validated:** strict schemas, default-equivalent scores, legal optional action changes, deterministic populations, intentionally degraded-policy rejection, uncertainty/side/control/missing-data gates, immutable judge thresholds, raw-evidence validation, retained champion, rollback and corruption rejection. Positive synthetic fixtures test gate code only; they are not gameplay wins.

The [known-seed integration fixture](ml-intelligence-strategy-influence-20261023.json) applies an authored boundary configuration to Blue and defaults to Red. Initial world/RNG match the frozen baseline;30s matches,120s diverges, and the actual match ends at442.4333s with Blue winning in both baseline and challenger. This establishes live parameter influence, not a decision-change rate, generalization, a learned improvement or statistical superiority. It is excluded from the fresh evaluation denominator and was not promoted.

[Planning integration](ml-intelligence-parameter-plan-smoke-20261023.json) successfully creates two valid challengers and128evaluation worlds (32seeds, two sides and two opponent configurations) against the verified final baseline. The temporary registry is isolated from the game. No study collection was started and seed reservation remains explicitly unverified. The [observed ledger](ml-intelligence-seed-ledger-20261023.json) contains35,232exposed/reserved seed values at export; its snapshot is not an atomic global reservation.

**Unproven:** a completed independently reserved optimization study, measured improvement, long-running registry recovery after abrupt lock-holder death, scheduler integration of this new study type, and production champion activation. Lock contention fails closed; automatic stale-lock recovery is not implemented.

**Next:** integrate allocation/jobs with the existing Laravel worker contract, accumulate complete fresh evaluation cohorts under fixed thresholds and qualify parameter evolution. Do not use the research registry as a deployed provider.

## Phases 3–5 — not implemented by this increment

No genuine MARL training environment, PPO/MAPPO learner, historical self-play league, automated source-patch generation/worktree evaluator or production model release/rollback integration is claimed. Existing short-window supervised fitting must not be relabeled MARL. No source candidate can edit the new evaluator because this increment only admits configuration payloads; an enforced source-file allowlist/worktree workflow still has to be built before code evolution is enabled.

Framework research used primary documentation: [PyTorch/TorchRL multi-agent PPO](https://docs.pytorch.org/rl/stable/tutorials/multiagent_ppo.html), [RLlib multi-agent environments](https://docs.ray.io/en/latest/rllib/multi-agent-envs.html), [PettingZoo parallel interface](https://github.com/Farama-Foundation/PettingZoo/blob/main/docs/api/parallel.md). The existing CPU PyTorch worker plus a validated live observation/action bridge is the integration starting point. Choosing/installing a distributed stack before measuring the collection bottleneck would not establish better learning. No new framework dependency, paid compute service, cloud runtime or credential exposure was introduced.

The original Laravel queue/recovery/resource/retention controls remain available for the existing task learner. New worker modules are prepared in source but have **not** replaced the running frozen ML image. A normal reviewed image rebuild is needed to run those modules in future new-source studies; incompatible historical studies must not resume under new source. Existing Blade hot-reload behavior can display the new report view while old reports honestly show missing diagnostics.

## Verification and artifacts

- `npm run check:game`: **491 game tests, three separate simulation tests and TypeScript pass** after the final source correction.
- `npm run build`: **passes**; the existing large-chunk advisory remains.
- Relevant Laravel ML tests: **34 tests / 284 assertions** pass with enforced in-memory SQLite, including old-report fallback and escaped diagnostics.
- Python worker tests: **31** pass in a disposable CPU runner with temporary storage; PyTorch emits its existing missing-NumPy warning.
- Existing independent TS evidence/behavior/rubric script tests: **six** pass. Parameter-evolution/registry tests: **four** pass. These are software checks, not empirical improvement.
- [Historical reanalysis](ml-intelligence-historical-audit-20261023.json), [frozen task reproduction](ml-intelligence-regression-reproduction-20261023.json), [seed inventory](ml-intelligence-seed-ledger-20261023.json), [trusted baseline](ml-intelligence-trusted-baseline-20261023.json), [final-source baseline](ml-intelligence-final-baseline-20261023.json), [known configuration influence](ml-intelligence-strategy-influence-20261023.json). Plans record source/config/judge hashes and exact seed boundaries.

Reproduce software checks from the repository root (PowerShell):

```powershell
node --experimental-strip-types --test infrastructure/evolution/strategy-evolution.test.mjs
python -m unittest discover -s infrastructure/evolution/runner -p test_regression.py
cd EsportsClash.Web
node --experimental-strip-types --test scripts/broad-study-evidence.test.mjs scripts/paired-behavior.test.mjs scripts/paired-outcome-rubric.test.mjs
npm.cmd run check:game
npm.cmd run build
cd ../EsportsClash.Api
php artisan test --compact --filter='EvolutionTest|EvolutionOperationsTest|EvolutionDashboardTest|EvolutionReportSeparationTest'
```

`verify-strategy-local.py` is an explicit disposable-container entry point: read-only repository `/input`, new evidence `/output`, existing runner image, no database/service start and no durable training-volume write. Evidence outputs use exclusive creation. Mount a new evidence output directory for another attempt; retain the original plans/results. Full parameter-study and registry deployment are deliberately not represented as completed operations.
# Continuation: durable intelligence jobs and macro PPO

The earlier-increment phase status below is retained as history. See [the v3 continuation](ml-autonomy-v3.md) for the new implementation, local operation, measured29-transition/20-changed live self-play check, source isolation, tests and remaining empirical limits. No independent competitive improvement or game activation is claimed.

