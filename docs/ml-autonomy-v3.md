# Intelligence continuation — 2026-10-23

This continues the earlier engineering record. It implements the remaining infrastructure and a constrained learning/code-search path; it does **not** establish competitive improvement. Historical `ml-intelligence-*` evidence is unchanged.

## Implemented

### Durable allocation and execution

`IntelligenceService`, `IntelligenceController`, the registry migration, `PollEvolutionRun`, and `runner/intelligence.py` add version3 jobs for `parameter`, `marl`, and `source`. PostgreSQL serializes admission and seed allocation using the existing settings row lock. Request UUIDs are idempotent, reservations are never reclaimed, and workers verify an HMAC receipt bound to the run, domain and whole1000-seed block. Allocation starts after the retained inventory through55000 and excludes the standalone900001–901000 planning block. Legacy jobs share the allocation counter and admission lock.

Plans, simulation/compiled-source manifests, judge/worker hashes, runtime versions, candidate selection, raw matches and their hashes are retained. OS file leases recover after process death. Budget windows reserve their full allowance before launching children; normal exits refund unused time and abrupt exits remain charged. Complete matches are cached and rechecked. Interrupted attempts remain incomplete; they are never silently replaced with favorable retries. At least15minutes10seconds must remain before starting a match. Invocation budgets are16–90minutes, total budgets are bounded, and CPU-only execution uses one simulator at a time. Resource pressure pauses work. All artifacts are registered and pinned through the existing retention manager.

The scheduler resumes budget checkpoints and can cycle parameter → MARL → source. Each new study rechecks the actual game tests/build and establishes repeated terminal controls on both sides before fitting. Failed checks terminate the study without releasing its seeds. Changes to frozen source/judge/runtime refuse resume.

### Parameter study and fixed qualification

Parameter search uses the existing bounded antithetic proposals. Fitting uses two reserved seeds and both sides. Selection freezes before held-out collection. Thirty-two additional reserved seeds begin at `seed_start+256`; each is played on both sides against the incumbent, all retained qualified historical policies and a fixed farm-biased reference. Every world has a repeated control and challenger. Nexus termination is required; a horizon or interruption is incomplete.

The unchanged acceptance contract requires32 independent seed clusters, two drafts, complete repeated controls, all planned opponents/sides, a positive95% Hoeffding lower bound on paired win difference, and no extra team-death cases or negative side means. Qualification reconstructs allocations, identities and metrics from hashed raw envelopes and recomputes the gate independently of reported training metrics. A small positive mean is insufficient. Synthetic positive tests exercise the gate and are never match evidence.

Internal promotion revalidates the worker's raw evidence and atomically updates a content-addressed research champion. New studies use that champion. Game activation is separate and requires the same independent revalidation, an unchanged incumbent, a strict policy schema and artifact hash. Existing game releases remain unchanged when trials fail or are inconclusive.

### Multi-agent reinforcement learning

`intelligencePolicy.ts`, `intelligenceTrajectory.ts`, the live component/bridge and `episode-host.mjs` collect actual decisions from the React-owned simulation. The portable20→16→5 actor uses own health/mana, position, level/gold/cooldowns, card IQ/stamina and personality conditioning, role, visible enemy summaries, threat/survival and time. It does not receive private enemy gold or hidden enemy levels. Six privileged team-state values go only to the centralized training critic and reward labels; exported actors contain no critic.

The actor chooses between the existing close, available, same-priority macro actions through the existing safe-experiment gates. Health, danger, towers, defenses, objectives, survival, commitments and the four-second intervention cooldown are retained. Lower-level movement, targeting, casting, retreat/recall, objective and combat execution remain authored. This is a constrained hierarchical macro learner, not learned low-level combat or all possible macro actions. Actual downstream intent and movement are recorded; an intent count alone does not prove every macro label executed its intended path.

`runner/marl.py` implements shared-actor PPO with a centralized value network, masked categorical actions, variable-time GAE, clipped policy ratios, entropy regularization and gradient clipping. It rejects off-policy log probabilities, illegal masks, malformed trajectories and incomplete matches. Terminal win/loss returns use fixed potential shaping with elapsed-time discounting; shaping telescopes instead of rewarding endless farming. The authored reward is versioned, not empirically calibrated. Self-play alternates learning sides against the incumbent, retained history and immutable earlier actor snapshots. Only the learning team's on-policy rows enter an update. Actor, critic, optimizer and Torch RNG restore from checkpoints; a qualified actor can initialize a later study.

The existing CPU PyTorch dependency was retained after checking the [official multi-agent PPO tutorial](https://docs.pytorch.org/rl/stable/tutorials/multiagent_ppo.html) and [MAPPO paper](https://arxiv.org/abs/2103.01955). A distributed framework would not remove the measured single-browser collection cost. No paid API or GPU/cloud allocation was introduced.

### Constrained source evolution

The source domain generates deterministic, bounded hypotheses for optional macro preferences, writes a single isolated `macroCandidate.ts`, compiles it with the repository's TypeScript compiler, and compares its scores with the validated runtime on65 fixtures. The exact source, hypothesis, diff, hashes and test evidence are retained before fitting. Neither candidate input nor generated source can select shell commands, edit judge/reward code or modify protected game files. After evaluation, the portable equivalent can use the same policy registry and rollback path.

This first source domain is limited to affine visible-context scoring, with bounded mutations around a retained program. It is a real generated/compiled source artifact and isolated evaluation path, but **not** arbitrary algorithm synthesis, LLM-authored repository patches, learned ability execution or broad strategic-program discovery. Those capabilities are not claimed.

### Versioned inference and controls

Normal games fetch a validated release and capture it when the match mounts. A source hash embedded by Vite must match the release's evaluated source; incompatible versions fall back to the existing policy. A running match does not change versions. Browser end-of-match adaptive training cannot mutate the released actor. Paused DEV fixtures also accept per-team policies and stochastic collection using a separate RNG that never advances game RNG.

The existing Blade dashboard now provides domain/budget selection, continuous scheduling, active stages, pause/resume/cancel, full-match outcomes/confidence, stored training/source evidence, game activation and qualified-version rollback. Missing measurements stay missing. A scheduled integrity monitor quarantines corrupted/unverifiable active artifacts and restores a retained version or the existing policy; connection outages alone do not establish corruption. This is integrity rollback, not a claim of a calibrated post-release performance alarm.

## Validated

- `npm run check:game`:498game tests, three separate simulation tests and TypeScript. `npm run build`:passes with existing build advisories.
- Laravel ML tests:39tests/325assertions in enforced in-memory SQLite, covering owner access, signed shared allocations, idempotency, pause/resume/cancel, internal/game release separation, activation rejection, immutable releases, rollback/integrity fallback and actual v3 report rendering.
- Worker tests:37pass in isolated CPU containers, including reserved budgets on abrupt recovery, complete/held-out/raw-evidence gates, off-policy rejection and exact actor/critic/optimizer/RNG checkpoint continuation. Four separate parameter/registry tests pass.
- Known-seed live integration:four terminal matches on seed47/draft2, repeated on both sides, reproduce world fingerprints/RNG/results. Original-side matches end at679.4667s under the approved soft collision source.
- A separate real ten-avatar self-play match produces29eligible transitions, changes20macro selections and diverges from the control world. All29have downstream intent evidence. PPO performs a real update on those29transitions; the resulting checkpoint restores exactly. Its loss/entropy values are diagnostic, not competitive evidence.
- The saved **trained** actor also changes one of one eligible greedy decisions and the actual world in a separate120second paired fixture, starting from the same state. This censored known-seed check proves post-update inference influence and is excluded from fresh win-rate evidence.
- One generated source candidate type-checks and matches its portable interpreter on65fixtures. TypeScript6required `--ignoreConfig` for the isolated-file compiler invocation; this was fixed and rerun.
- Evidence: [verification index](ml-autonomy-v3-verification-20261023.json), [immutable raw integration artifacts](ml-autonomy-v3-evidence-20261023/verification.json), including source/compiled manifests, raw self-play, actors, repeated baselines and source diff/proof.

## Operational record and limits

Only the additive registry migration was applied to the local development API. The frozen legacy experiment `47abd76f-cf48-4df7-a384-16a11eeec7f7` was cancelled through its normal durable stop path before the development runner cutover; retained artifacts and old image tags remain. The new development image uses CPU PyTorch2.6 and one live browser. Production Compose configuration and production/Vercel deployment were not changed.

The first v3 study `7fd92980-1df9-473b-b334-2bdba2084be8` reserved56001–57000 and failed preflight because the original runner image lacked public asset fixtures used by game tests. No fitting or held-out match was collected by that failed study. Its evidence and reservation remain. The image now includes the existing fixtures; tests were not skipped. Subsequent study IDs and stages are recorded in the current handoff.

The next attempt `6d7248de-31df-43c1-82dc-c9afaa3dde24` reserved57001–58000 and also stopped in preflight because the test suite additionally reads historical Blender sources outside `public`. Required v7/v8/v9 source fixtures and the sound-generation prompt are now explicitly packaged; all other art stays excluded from the build context. Those asset bytes were copied unchanged. Neither failed attempt reached fitting/held-out collection, and both remain immutable failed evidence.

Known-seed fixtures are excluded from fresh benefit measurements. No parameter, MARL or generated-source challenger has yet completed independent qualification. No learned policy is activated in the game, and **improved gameplay intelligence remains unproven**. The next dependency is enough complete reserved full matches under the fixed acceptance gate; long trials can span budget windows. The local schedule is configured to cycle the three domains, retain failed/inconclusive results and keep the incumbent unless qualification passes.

Current risk-based tower/well/Nexus rules, normal terrain retreat, attribution, objective contests, anti-oscillation commitments, parody identities, hitboxes and approved soft collisions remain authoritative. No character asset, stat, ability timing or protected mechanical rule was edited by this continuation.
