# Continuous learning operations

The owner approved implementation of the ML milestone, then deprioritized further speed tuning: “nevermind about the speed. Continue.” The current work focuses on learning diagnosis, bounded memory, recovery, safe retention and the existing Laravel Blade dashboard. Local Docker remains the deployment target; production promotion and Vercel remain disabled.

## Access and controls

Open **http://localhost:8089/evolution** and use the existing Evolution owner login. The dashboard is served by Laravel Blade, with owner session authentication, CSRF protection and audited mutations. It is separate from the game at port 8088.

The owner can configure fitting/calibration/evaluation counts, wall-clock and scout budgets, optimizer microbatch size, compatible replay capacity, anonymous RAM and VM reserves, storage and retention. Every candidate receives independent evaluation. Only one simulation worker is operationally qualified; unsupported concurrency and 8× modes are rejected. New collection settings are frozen in the next study plan. Resource admission can pause a study without silently replacing attempted worlds.

The owner's existing interval is **120 minutes**, with a **48-hour** balance review window. Automatic starts were temporarily paused for controlled deployment/recovery validation and have now been re-enabled. The active-run lock prevents overlapping studies. A running cycle, a completed evaluation, a passed exploratory gate and an activated production model are distinct states. A completed candidate that fails evaluation is labeled “Evaluated · not qualified.”

## Why the previous candidates abstained

The read-only audit in [ml-baseline-audit.json](ml-baseline-audit.json) preserves all three historical completed studies. Each had 24 valid held-out worlds and zero changed decisions. Every decision abstained because its predicted advantage minus the independently measured overprediction buffer failed the existing benefit margin. The candidates also lost to zero-contrast prediction on held-out MSE. The seed-21001 candidate had a 0.9242085 buffer and prediction MSE 0.18327489 against 0.15186185 for zero contrast.

Those results remain failed evidence. We did not inflate weights, weaken confidence, lower acceptance minima, replace unsuccessful worlds, or activate a model. New fitting uses broader predeclared checkpoint times and chooses representation/shrinkage by leaving out drafts **within fitting data only**. Calibration and evaluation never choose hyperparameters. This is an empirical intervention to test, not proof of useful learning.

## Learning memory and checkpoints

Completed, source-compatible fitting examples can enter a bounded replay bank. Both their fitting dataset hash and raw evidence hashes must verify. Previous calibration/evaluation examples and current reserved evaluation seeds are excluded. A source change rejects incompatible replay rather than silently mixing game versions. Historical evidence remains on disk; the first study with this new execution source necessarily has no compatible prior bank.

The bounded linear outcome-contrast learner refits from the verified fitting bank plus fresh fitting worlds. It saves real weights, optimizer state, feature keys, configuration and training seeds in `checkpoint.pt`. Within a run, already validated cases and the saved fitting/candidate artifacts survive recovery. This is not PPO/MAPPO, broad combat learning, optimizer continuation across different study configurations or proof of full-match improvement.

## Memory and storage

The private fitting page compiles the actual live game component, with its evaluation hooks, and avoids starting the full spectator application and Vite for fitting. Calibration and held-out worlds still use the trusted live Vite evaluator. Thirty-Hz game ticks, actual movement/combat/legality, RNG and reward validators remain authoritative. Torch training runs in a separate process after the fitting browser exits, releasing its tensors/import memory before evaluation. Browser profiles are transient, outside the durable artifact volume. New raw evidence is gzip-compressed, and hashes identify the actual stored bytes.

The persistent SQLite registry records typed artifacts, hashes, ownership references, retention state and cleanup audit. Legacy studies are conservatively pinned. Active/evaluating studies and production, match, pin and rollback references block deletion regardless of age. Dry run, quarantine, delayed deletion, transactional reference recheck, repin restoration, path containment, symlink checks and content hashes protect cleanup. Unknown artifact kinds are retained. No Docker volume pruning occurs.

Defaults are a 20 GiB managed budget, seven days for unreferenced failed models, fourteen for unreferenced processed trajectories, thirty for logs and a 24-hour quarantine. Required reproducibility references override expiration. Existing evidence and all recoverable checkpoints remain pinned, including the three legacy checkpoints. Consequently storage pressure **pauses collection** instead of deleting required evidence. The current conservative policy does not automatically compact all old study evidence down to three releases; fine-grained release/rollback retention remains tied to the future production release system.

Resource reports distinguish anonymous RAM, cached file pages, working set and cgroup lifetime peak. The Linux Docker VM exposes approximately 7.65 GiB; that is not a measurement of the Windows machine's physical 16 GB. The image uses CPU PyTorch, and GPU VRAM is explicitly unavailable. Container limits remain 2 CPU / 3 GiB for training, with a default 2 GiB anonymous-RAM admission threshold and 2 GiB available-VM reserve. Full-match serving stays in its separate worker.

## Measured compatibility and memory evidence

All following runs used seed 47, draft 2, empty adaptive policy and the same complete match, ending at 462.6 game seconds. Zero/30/120/terminal captured world fingerprints and RNG agree across original and compiled paths. This is compatibility evidence, excluded from training. Paced measurements use fixed ticks and wall-clock budgets; they do not benchmark the visible speed button.

| Path | Wall seconds | Mean anonymous MiB | Sampled peak anonymous MiB |
| --- | ---: | ---: | ---: |
| Original headless | 111.207 | 606.08 | 670.42 |
| Original paced 1× | 462.701 | 779.73 | 977.05 |
| Original paced 4× | 135.854 | 978.34 | 1573.54 |
| Renderless page with Vite | 114.379 | 856.99 | 1081.25 |
| Compiled fitting page | 108.851 | 283.41 | 396.69 |

The compiled path reduced sampled anonymous peak by about 41% against original headless in this fixture. This does not establish every world's memory or a host-wide memory reduction. The earlier renderless Vite variant did not improve headless timing or anonymous memory. Two isolated experimental workers were measured under the same aggregate cap, but remain disabled operationally; four workers were skipped because measured peaks plus reserve did not fit. Further speed tuning was deferred by the owner.

Sources: [original benchmark](ml-baseline-benchmark.json), [Vite experiment](ml-optimized-benchmark.json), [compiled fitting benchmark](ml-compiled-benchmark.json), [concurrency experiment](ml-concurrency-benchmark.json).

## Deployment validation

Required checks pass: 436 game tests, three deterministic simulations, TypeScript and production build; 31 Laravel tests / 225 assertions; 16 Python worker tests. Tests use an enforced in-memory SQLite database and a dedicated test encryption key. Storage tests exercise protection references, stale previews/new references, quarantine/repin/delayed deletion, tampered content, active states, invalid paths and resource pressure. Training tests verify fitting-only retained knowledge and exact checkpoint score reload using unit fixtures, never collected match evidence.

The actual owner dashboard passed login/logout, authorization, missing-CSRF rejection, live refresh, unchanged policy/schedule save, real dry-run and safe-cleanup forms, report download and desktop/phone layout checks. Both deployed cleanup operations found zero eligible historical artifacts. See [Blade operations verification](ml-operations-ui-verification.json) and [dashboard image](ml-operations-dashboard.png).

A preflight study was retained with twelve cases after a finalization hash-order correction changed its frozen source; the incompatible resume was refused (`ml-preflight-run.json`). A PostgreSQL queue-lock collision found during stop was fixed by acquiring the unique lock after the service transaction commits, with a regression check. The corrected study uses a new seed block.

The full new study and crash-recovery witnesses are recorded in [ml-validation-run.json](ml-validation-run.json) and [ml-validation-recovery.json](ml-validation-recovery.json). At this writing, complete independent evaluation and real collected-checkpoint reload are still being validated. These documents must be updated with the actual terminal result; a failed gate must remain failed.

Implementation: `infrastructure/evolution/runner/{operations,server,pipeline,training,train_stage}.py`, `infrastructure/evolution/evidence.mjs`, private Web fitting entries/configuration, `MaintainEvolutionArtifacts`, `PollEvolutionRun`, `EvolutionService`, and the Blade operations/resources/report views. Protected risk-based tower/well/Nexus rules, normal retreat, attribution, objectives, anti-oscillation, aliases and IQ/personality boundaries are unchanged.
