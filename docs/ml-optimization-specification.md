# ESPORTS CLASH — ML TRAINING OPTIMIZATION, FAST SIMULATION, AND AUTOMATIC STORAGE MANAGEMENT

You are acting as a Principal Machine Learning Engineer, Reinforcement Learning Researcher, Simulation Performance Engineer, Laravel Backend Engineer, and Docker Infrastructure Engineer.

Your task is to improve the existing Esports Clash Evolution Lab.

*The primary goal is to make machine learning significantly faster, more useful, sustainable for continuous operation, and capable of retaining learned knowledge without accumulating unlimited files.*

Do not rebuild the existing ML infrastructure from scratch.

Inspect and extend the existing implementation.

## 1. Inspect the current system

Begin by inspecting:

- compose.evolution.yaml
- infrastructure/evolution/
- docs/evolution-system.md
- EvolutionDashboard.tsx
- paired-live-rollout.mjs
- Existing match simulation and replay logic
- Existing PyTorch training workers
- Laravel learning-cycle jobs and scheduler
- Model registry and checkpoint persistence
- Current dataset collection, calibration, and evaluation process
- Existing 4× simulation-speed implementation

Locate the actual source files if any paths have changed.

The existing system already supports scheduled training cycles, checkpoint storage, study plans, and experimental learning.

Preserve those capabilities.

The dashboard currently reports an 80-world study plan, with earlier evaluation results showing 24 valid evaluation cases, zero changed decisions, and an exploratory gate that did not pass.

Investigate why learning has not demonstrated useful decision changes.

Do not automatically conclude that running more worlds will fix the problem.

---

# 2. FAST ML SIMULATION

## 2.1 Reuse the existing 4× speed

My MOBA already supports 4× simulation speed.

Determine how that feature works.

Identify whether it accelerates:

- The actual simulation clock.
- Fixed simulation ticks.
- Rendering and playback.
- Animation scheduling.
- Batch execution.

Where appropriate, reuse its functionality for automated ML simulation.

Do not simply trigger the frontend speed button and assume that training is accelerated.

Implement actual acceleration in the training pipeline.

## 2.2 Support simulation speed modes

Provide configurable modes:

- Normal: 1×
- Accelerated: 2×
- Fast: 4×
- Experimental: 8× or higher, where verified
- Headless: execute fixed simulation ticks as quickly as practical without real-time presentation

Use 4× as the initial accelerated mode.

Headless fixed-step simulation should be preferred for large training workloads when parity with actual game rules is established.

The speed setting must not change gameplay mechanics.

## 2.3 Preserve simulation correctness

The simulation must continue respecting:

- The existing fixed 30 Hz simulation timestep.
- Movement and attack rates.
- Cooldowns.
- Ability execution.
- Decision frequency.
- Game-time progression.
- Jungle and objective behavior.
- Tower/Nexus mechanics.
- Game RNG.
- Player Card attributes and personalities.
- Actual match termination rules.

Do not multiply combat damage, cooldown progression, or movement speed incorrectly.

Four times faster means executing more simulated time per unit of wall-clock time, not changing the in-game physics.

## 2.4 Deterministic equivalence tests

Compare normal-speed and accelerated simulations using identical:

- Seeds.
- Drafts.
- Player Cards.
- Policy versions.
- Balance patches.
- Starting states.

Verify equivalent final states, events, RNG progression, and match outcomes.

Run comparisons at representative simulation times and complete matches.

If acceleration changes authoritative gameplay results, do not use that mode for production training or evaluation until corrected.

If a faster training environment differs from the real match environment, explicitly label it experimental.

Preserve the trusted runner for independent evaluation.

---

# 3. REMOVE UNNECESSARY TRAINING OVERHEAD

Inspect where runtime is spent.

Measure:

- Simulation execution.
- Rendering.
- React updates.
- Browser automation.
- State serialization.
- Disk writes.
- Network overhead.
- Model inference.
- Python training.
- Docker communication.

Implement targeted optimizations.

Possible improvements:

- Execute simulation ticks without rendering.
- Remove unnecessary animation and particle processing in training-only execution.
- Batch observations and actions.
- Avoid repeated React state publication.
- Avoid unnecessary browser reloads.
- Reuse simulation workers.
- Cache immutable gameplay configuration.
- Reduce excessive JSON serialization.
- Use efficient trajectory storage.
- Batch model inference.
- Run independent simulations concurrently.

Do not remove actual gameplay mechanics from the training environment.

Separate authoritative simulation state from rendering state wherever practical.

Benchmark before and after optimization.

---

# 4. MAKE ML TRAINING ACTUALLY USEFUL

My current ML evaluations have produced zero changed decisions in some completed runs.

I want this investigated.

## 4.1 Diagnose the existing learner

Determine why a trained model may not influence action selection.

Investigate:

- Insufficient training examples.
- Sparse or uninformative rewards.
- Inappropriate observation features.
- Excessively narrow action candidates.
- Policy predictions too close to baseline.
- Uncertainty calibration failures.
- Confidence-based abstention.
- Existing decision priority constraints.
- Candidate actions being unavailable.
- Poor coverage across Player Cards.
- Overfitting to specific simulated worlds.
- Mismatch between predicted and executed actions.

Produce measurements identifying the actual causes.

Do not simply increase learned policy weights or reduce confidence thresholds to force changes.

## 4.2 Improve training data efficiency

I want faster learning, not merely faster execution.

Investigate collecting more useful training experiences.

Prioritize meaningful situations such as:

- Important teamfights.
- Objective contests.
- Successful and unsuccessful tower dives.
- Risky retreat decisions.
- Ganking opportunities.
- Lane pressure.
- Farming versus regrouping.
- Game-ending opportunities.
- Different Player Card and avatar combinations.

Avoid spending excessive resources repeatedly analyzing situations that provide little learning information.

However, do not artificially discard inconvenient or unsuccessful evaluation cases.

For fitting data, consider defensible sampling strategies that increase informative examples while maintaining adequate coverage.

Keep independent validation and evaluation distributions representative.

## 4.3 Separate training from validation

Maintain distinct datasets for:

- Training.
- Calibration.
- Independent evaluation.

Prevent seed leakage, duplicate-state contamination, and reuse of evaluation examples for fitting.

Keep existing evidence integrity and model promotion gates.

A failed study must remain recorded as failed.

Do not lower existing statistical requirements merely to achieve a passing result.

## 4.4 Improve learning progressively

Consider improvements such as:

- Better normalized observation features.
- More informative team-based rewards.
- Balanced training examples.
- Improved card-conditioned behavior.
- Better challenger evaluation.
- Historical opponent diversity.
- Better uncertainty estimation.
- Useful action contrast learning.
- Eventually full-match reinforcement learning.

Select improvements based on actual diagnostic evidence.

Do not implement unrelated machine learning architectures without justification.

Start by fixing the existing learner's demonstrated shortcomings.

## 4.5 Evaluate actual benefits

Show whether a candidate produces:

- More meaningful decisions.
- Higher-quality decisions.
- Fewer harmful engagements.
- Better objective outcomes.
- Better team survival.
- Improved full-match results.
- Consistent performance on unseen scenarios.

Zero changed decisions cannot be considered evidence of gameplay improvement.

A policy must pass the existing independent evaluation before any production promotion.

---

# 5. OPTIMIZE PLANNED WORLDS

The Evolution Lab currently displays progress such as:

52 / 80 planned worlds

Improve reporting and experiment management.

## 5.1 Clarify what a world means

Document the exact unit of a planned world in this repository.

Show the relationship between:

- One planned scenario.
- Simulation seeds.
- Draft selection.
- Evaluation checkpoint.
- Paired action branches.
- Simulator continuations.
- Valid training examples.
- Full matches.

Do not imply that 80 worlds are equivalent to 80 completed MOBA matches.

## 5.2 Configurable training budgets

Allow configuration of:

- Planned training worlds.
- Calibration worlds.
- Evaluation worlds.
- Maximum simulation time.
- Maximum wall-clock training duration.
- Number of concurrent workers.
- Simulation speed.
- Evaluation frequency.

Preserve minimum statistical and coverage requirements.

If the number of worlds is insufficient to meet existing evaluation criteria, reject the configuration with a clear explanation.

Do not allow a smaller sample count to masquerade as an equally reliable evaluation.

## 5.3 Early stopping

Implement statistically defensible early stopping where appropriate.

Examples:

- Stop clearly unproductive training runs.
- Stop when a fixed compute budget is exhausted.
- Pause for insufficient storage.
- Pause for memory/resource limits.
- Stop divergent or corrupted training.
- Stop when a predefined training objective has converged.

Do not use evaluation outcomes to repeatedly tune the same candidate.

Do not silently replace missing, failed, or uninformative planned worlds with easier scenarios.

---

# 6. CONTINUOUS ML SCHEDULING

Preserve the existing Laravel scheduler.

The dashboard currently supports automatic learning every 360 minutes.

Make this interval configurable.

Each training cycle should:

1. Verify resource availability.
2. Acquire a distributed training lock.
3. Load the correct checkpoint.
4. Execute simulation collection.
5. Train a challenger model.
6. Save checkpoints.
7. Run independent evaluation.
8. Record results.
9. Determine promotion eligibility.
10. Schedule the next cycle.
11. Trigger safe storage cleanup.

Prevent overlapping training cycles unless explicitly designed for concurrent experiments.

Support restart recovery and cancellation.

Do not reset learning after every cycle.

Keep the training service operating autonomously without requiring Codex or paid AI API credits.

---

# 7. AUTOMATIC ML STORAGE CLEANUP

Implement a production-safe ML storage management service using Laravel and Docker.

Continuous training must not fill the disk indefinitely.

## 7.1 Configurable retention policy

Suggested initial defaults:

- Maximum managed ML storage: 20 GB.
- Training checkpoints: latest 3 recoverable checkpoints per active training run.
- Failed experimental models: 7 days after no longer referenced.
- Raw trajectories: 14 days after confirmed processing, if not retained for reproducibility or evaluation.
- Temporary simulation outputs: delete after successful processing.
- Detailed worker logs: 30 days.
- Production models: always protect the currently deployed model.
- Rollback models: retain at least the latest 3 eligible historical releases.
- Evaluation datasets: preserve active and required reproducibility evidence.
- Patch and economic audit records: manage under a separate durable retention policy.

Make the limits configurable.

## 7.2 Protected files

Never automatically delete:

- Current production models.
- Models assigned to running matches.
- Checkpoints required by active training.
- Models currently undergoing evaluation.
- Explicitly pinned model versions.
- Required rollback checkpoints.
- Referenced datasets.
- Evidence needed for an active study.
- Immutable patch manifests.
- Required audit records.

Use the model registry to determine actual references rather than relying solely on filename patterns.

## 7.3 Safe cleanup implementation

Implement Laravel jobs such as:

- CleanupExpiredMLArtifactsJob
- CheckMLStorageBudgetJob
- ReconcileModelArtifactReferencesJob

Names may change to fit existing naming conventions.

Cleanup should:

1. Discover registered artifacts.
2. Calculate storage consumption.
3. Identify protected references.
4. Find expired and unreferenced candidates.
5. Support dry-run previews.
6. Mark candidates for deletion.
7. Recheck references under appropriate locking.
8. Delete only validated artifacts under managed storage directories.
9. Record deletion results.
10. Reconcile registry metadata.

Never allow unsafe directory traversal or arbitrary file deletion.

Consider a short quarantine period or delayed deletion for recoverability.

Ensure concurrent trainers cannot lose files they are actively using.

## 7.4 Storage pressure

If ML storage reaches its configured limit:

- Clean expired unreferenced files first.
- Stop creating unnecessary temporary outputs.
- Alert the owner.
- Pause new training if insufficient space remains.
- Resume after safe capacity is restored.

Do not delete protected models to force training to continue.

## 7.5 Docker persistence

Use persistent volumes or configured object storage.

Ensure checkpoints remain available after container recreation.

Verify that cleanup works with container-mounted storage paths.

Do not use Docker volume pruning as a general ML cleanup mechanism.

---

# 8. IMPROVE THE EVOLUTION LAB DASHBOARD

Extend the current Evolution Dashboard.

## 8.1 Training overview

Display:

- Current stage.
- Learning-cycle status.
- Planned worlds.
- Completed worlds.
- Valid worlds.
- No-target worlds.
- Failed or invalid worlds.
- Informative action contrasts.
- Actual learned action changes.
- Estimated remaining time.
- Simulation speed.
- Simulation throughput.
- Current model version.
- Training checkpoint version.

## 8.2 Performance metrics

Display:

- Simulated seconds per wall-clock second.
- Worlds completed per minute.
- Average time per world.
- Training CPU utilization.
- Training GPU utilization where available.
- Memory usage.
- Total ML storage.
- Storage budget.
- Number of retained checkpoints.

Display actual measurements only.

## 8.3 Learning quality

Clearly distinguish:

- Training completed.
- Evaluation passed.
- Model improved.
- Model promoted.
- Model rejected.

A model that completes training but fails evaluation should not appear successful.

Report whether it actually changed decisions and whether those changes improved results.

## 8.4 Storage controls

Provide owner-only controls for:

- Storage limit.
- Retention periods.
- Automatic cleanup toggle.
- Manual dry-run.
- Safe cleanup execution.
- Protected model list.

Show estimated recoverable storage before deletion.

Prevent removal of in-use artifacts.

---

# 9. BENCHMARK REQUIREMENTS

Run representative benchmarks against the current implementation.

Compare:

1. Existing normal simulation.
2. Existing 4× speed.
3. Optimized 4× training mode.
4. Headless fixed-step simulation, if implemented.

Measure wall-clock performance and gameplay parity using identical seeds and configurations.

Provide a table containing:

- Simulation mode.
- Simulated game seconds.
- Actual execution seconds.
- Effective speed multiplier.
- Memory usage.
- CPU usage.
- Final-state parity.
- Training eligibility.

Do not invent results.

Report any significant differences or inability to establish parity.

---

# 10. REQUIRED TESTS

Add focused tests covering:

- Deterministic simulation equivalence.
- Correct time progression at accelerated speed.
- Gameplay rules remaining unchanged.
- Model checkpoint save and reload.
- Interrupted training recovery.
- Training-job deduplication.
- Scheduler restart recovery.
- Model artifact protection.
- Safe cleanup.
- Storage limit enforcement.
- Held-out dataset isolation.
- Accurate dashboard progress counts.
- Proper handling of invalid and no-target worlds.
- Actual policy decision influence.
- Independent model evaluation.

Run existing game, backend, and ML regression tests.

Do not change established safety gates or relax previously failing assertions.

---

# 11. IMPLEMENTATION PRIORITY

Implement in this order:

*Phase 1: Audit and benchmark*

Identify actual speed bottlenecks and why learned decisions are not changing.

*Phase 2: Accelerated simulation*

Reuse 4× execution where appropriate and introduce a verified faster headless path.

*Phase 3: Learning-quality improvements*

Increase informative training experiences and fix proven learner shortcomings without weakening evaluation.

*Phase 4: Automatic storage management*

Introduce registry-aware retention, disk budgets, scheduled cleanup, and safe training pauses.

*Phase 5: Dashboard integration*

Expose simulation throughput, ML effectiveness, storage health, and operational controls.

*Phase 6: End-to-end validation*

Run one complete accelerated learning cycle with real saved checkpoints, independent evaluation, and cleanup verification.

Use the existing local Docker environment.

Do not deploy to Vercel or activate production model changes.

Preserve existing protected game mechanics and previous ML evaluation evidence.

---

# FINAL OBJECTIVE

I want Esports Clash to continuously learn while minimizing wasted time and storage.

The AI should simulate games as quickly as the hardware safely allows, ideally faster than the existing 4× playback.

Training should focus on meaningful gameplay decisions and avoid wasting resources on unnecessary rendering or repeated low-information work.

The system must preserve important learned models while automatically cleaning obsolete files.

Most importantly, I want genuine measurable improvement in gameplay decision-making rather than simply completing more training cycles.

*Optimize learning quality, simulation throughput, checkpoint persistence, and storage efficiency together.*

Begin by inspecting the existing system, provide actual benchmark findings, and implement improvements incrementally with verification.

# ADDITIONAL REQUIREMENT — ML RAM AND VRAM OPTIMIZATION

The current machine learning infrastructure consumes significant RAM during training. I want memory usage investigated, measured, and optimized as a high-priority requirement.

My goal is to run continuous ML training without exhausting system memory, freezing the computer, crashing Docker containers, or disrupting the game.

## 1. Memory Usage Investigation

Profile the memory consumption of:

- Python/PyTorch training processes.
- Headless MOBA simulation workers.
- Browser-based simulation runners.
- Laravel API, queue workers, and scheduler.
- PostgreSQL and Redis.
- Training datasets and replay buffers.
- Model inference and checkpoints.
- Docker and WSL2 overhead, where applicable.

Measure actual RAM usage rather than estimating or assuming the source of memory consumption.

Record current, average, and peak memory usage for each process or container.

Identify memory leaks, unnecessary retained references, excessive allocations, and unbounded data structures.

## 2. Memory-Efficient ML Training

Optimize the learning pipeline using appropriate techniques:

- Limit concurrent simulation workers.
- Reuse simulation processes when safe.
- Batch observations efficiently.
- Avoid loading entire training datasets into RAM.
- Stream training data from disk where appropriate.
- Use bounded replay buffers.
- Release unused tensors and computation graphs.
- Disable gradient tracking during inference.
- Avoid duplicate neural network copies in memory.
- Use efficient tensor types and mixed precision where supported.
- Apply gradient accumulation when smaller batches are necessary.
- Avoid retaining unnecessary full-match snapshots.
- Compress or serialize completed trajectories efficiently.

Preserve training correctness and model quality.

Do not sacrifice evaluation reliability just to reduce memory consumption.

## 3. Configurable Memory Limits

Implement configurable settings for:

- Maximum ML RAM usage.
- Maximum GPU VRAM usage.
- Maximum simulation workers.
- Maximum training batch size.
- Replay-buffer capacity.
- Maximum concurrent training jobs.
- Minimum available system RAM before training starts.
- Reserved RAM for Laravel, database services, and the operating system.

Detect available hardware resources and choose conservative defaults.

For a 16 GB RAM development machine, start with one training worker and conservative memory limits, then adjust based on measured usage.

Avoid assuming that all 16 GB are available to Docker or ML.

## 4. Automatic Resource Management

Develop a Resource Manager that periodically monitors memory consumption.

If RAM usage approaches configured thresholds:

1. Stop scheduling new simulation workers.
2. Reduce concurrency when safe.
3. Flush completed training data to persistent storage.
4. Finish or checkpoint active training operations.
5. Pause new training cycles if necessary.
6. Notify the Evolution Dashboard.
7. Resume training when sufficient memory becomes available.

Handle out-of-memory failures with bounded retries and safe checkpoint recovery.

Do not repeatedly restart a failing process without investigating the memory requirement.

## 5. Fast Simulation Without Excessive RAM Usage

The training system should prioritize useful simulations per unit of RAM and processing time.

Optimize the existing 4× simulation mode and implement headless fixed-step execution where possible.

Do not assume that running more workers always improves throughput.

Benchmark different worker counts and identify the point where memory pressure reduces overall performance.

Prefer a smaller number of efficient simulation workers over many memory-heavy browser instances.

## 6. Docker Resource Optimization

Configure memory limits and reservations for relevant Docker services.

Separate ML training from production API and match-serving processes.

Ensure Laravel, Redis, PostgreSQL, and game-serving services retain enough resources to operate reliably while ML training is active.

Support appropriate Docker and WSL2 memory configuration for Windows development environments.

Persist checkpoints so container restarts do not erase learned progress.

## 7. Evolution Lab Memory Monitoring

Add a Resource Monitoring section displaying:

- Total system RAM.
- Available RAM.
- ML RAM usage.
- GPU VRAM usage.
- Memory usage per training worker.
- Peak memory usage.
- Active simulation workers.
- Current batch size.
- Memory limits.
- Recent out-of-memory events.
- Training pause/resume status.

Display real measurements and historical usage.

## 8. Performance Benchmarks

Compare memory consumption and execution time under:

- Existing training mode.
- Optimized 4× simulation.
- Headless simulation.
- One simulation worker.
- Two simulation workers.
- Four simulation workers, only when resource limits permit.

Measure:

- Peak RAM consumption.
- Average RAM consumption.
- GPU VRAM consumption.
- Simulation throughput.
- Training duration.
- Model evaluation validity.

Choose resource settings based on actual benchmarks.

# FINAL REQUIREMENT

I want continuous machine learning to be fast, memory-efficient, and stable.

Prioritize reducing RAM usage without weakening actual learning, gameplay fidelity, or evaluation quality.

The system must automatically adapt to available resources, preserve checkpoints, and avoid exhausting memory.

*Do not just increase Docker memory limits. Identify and optimize the actual causes of excessive RAM consumption.*

One important distinction for your setup:
- RAM (16 GB): Used by Docker, Laravel, simulations, training datasets, and model processing.
- VRAM (RTX 3060): Used primarily for GPU-accelerated model operations, if configured to use CUDA.
- CPU (i5-12400): Responsible for much of the game simulation work and orchestration.
Your 4× speed option doesn't necessarily consume four times as much RAM. The bigger issue is how many simulations run concurrently and how much state each worker retains.
I recommend starting with one headless simulation worker, bounded training batches, and automatic memory monitoring. Then benchmark whether adding workers actually increases completed useful simulations per minute.
That should give Codex a clear goal: make ML faster while using less memory, rather than simply throwing more RAM at the problem.