# Continuous FPS learning

The isolated Node worker runs the live spatial engine at its fixed 30 Hz step without rendering. It trains navigation, rifle cadence and a separate movement-choice model on synthetic profiles. Movement choices select among existing duel tactics (strafe, hold, crouch-strafe) and peek styles (shoulder, crouch-swing, ferrari, double-pump, bait, fake). Existing movement and weapon rules remain authoritative: profile attributes still control their established execution, including braking input, peek endpoint error, aim, recoil and weapon handling. The learner cannot change attributes, weapon rules, collision or information access. Official allocations, careers, player abilities and asset processing are unaffected.

## Files and operation

Tracked configuration is in `config/default.json`. `models/active.json` selects the reviewed bundle; null selects built-in defaults. `reports/` receives daily exports. Raw experience lives in ignored `storage/app/automatic-learning`, never in Git.

From repository root, using Node 24:

```
node infrastructure/automatic-learning/coordinator.mjs
```

SQLite WAL commits model changes and permanent ingestion digests together. Completed-round experience survives incomplete matches. Interrupted matches are recorded as aborted rather than silently replayed. Frozen team policies never explore or update. Hourly UTC JSONL gzip archives contain samples, round outcomes, starts and match results; checksummed summaries survive 30-day raw retention. The ledger is intentionally retained after raw deletion. Back up the volume, including SQLite through its backup API or with the service stopped.

On upgrade from a v1 learning database, validated navigation and combat checkpoints are preserved and the new movement checkpoint starts from its built-in prior. An in-progress job or candidate cycle is migrated the same way; a checkpoint that fails its learner validator stops startup for review.

Create a `PAUSE` file in the data directory to pause new matches; remove it to resume after five healthy minutes. `heartbeat.json` reports state. SIGTERM stops the active match gracefully. Learned state is never reset: a checkpoint whose learner no longer validates is archived exactly (immutable `model_versions` row plus a content-addressed file in `versions/`), then only that learner forks from its prior. Editing simulation code no longer invalidates bundles (`engine` is provenance only; compatibility is per learner).

Each 100 completed training matches freezes a candidate. Evaluation uses 200 seed pairs against each of incumbent and original baseline, with swapped teams (800 matches). The evaluation seed range is disjoint from training. Results include paired normal-approximation confidence intervals, profile groups and attacking/defending results. Timeouts invalidate the candidate. Passing screening requires positive incumbent lower bound and a baseline interval that does not establish regression.

Passing screening schedules 200 swapped seed pairs each for route-only, combat-only, movement-only and playbook-only comparisons against the incumbent; each pins every other learned part (including playbooks) to the incumbent. A candidate that passes is then played against up to three earlier promoted versions (`leaguePairs`, `leagueSize`); it must not be significantly worse than any of them (guards against forgetting and tactic cycling). With `autoPromote: true` (default) the candidate is then **promoted automatically**: its exact bytes are stored as `models/<sha256>.json` in the data directory and a `promote` event (with an Elo-style performance rating) is appended to `models/registry.json`. A post-promotion monitor (`monitorPairs`) plays the promoted bundle against the version it replaced and appends an automatic `rollback` event on a significant regression. Nothing is replaced or deleted; every promoted version stays available. Each cycle also writes `reports/meta-<cycle>.json` (per lineage and map: popular plays, best plays, learned variants, innovations, promotions, opponent reads). No measured improvement or throughput claim is made.

## Lightsail Ubuntu-1

Target: `Ubuntu-1`, region `ap-southeast-1`, availability zone `ap-southeast-1a`.

1. Restore valid AWS CLI credentials privately, then inspect the instance CPU/RAM, disk and existing services. Credentials must never be placed in this folder.
2. Inspect live application resource use before choosing installation location. Copy the reviewed repository to the server and create the data directory owned by UID 1000.
3. Create a dedicated IAM principal with only `lightsail:GetInstanceMetricData` permission (Lightsail metrics does not offer resource-level scoping for this call). Configure its credentials directly on the server under profile `lightsail-monitor`; never copy credentials into this repo or chat. AWS login tokens are temporary and are unsuitable for a long-running unattended timer unless their renewal is managed.
4. Install Node.js, AWS CLI, Docker, and Compose. Install `fps-learning-health.service` and `fps-learning-telemetry.service` plus its timer from `infrastructure/automatic-learning/`. The loopback health endpoint checks the training container heartbeat and host memory/disk; telemetry also reads this instance's Lightsail burst metric. Missing or stale telemetry pauses training.
5. Run `docker compose -f compose.automatic-learning.yaml up -d --build`. Initial limits: one worker, 0.5 vCPU, 512 MiB. No public ports. The container remains paused until the first healthy telemetry window.
6. Benchmark one hour, then soak 24 hours. Inspect hourly completed/aborted counts, wall/simulated seconds, CPU credits, memory and disk. Resource limits must protect the host; 200 games/hour is a target, not a guarantee.

The container pauses when available memory is below 20%, disk below 15%, CPU burst capacity below 20%, or host telemetry/application health fails (`healthFailureLimit: 3` consecutive telemetry failures once running; immediate pause on manual/memory/disk). Resume requires five healthy minutes (`LEARNING_HEALTHY_RESUME_SECONDS` / `LEARNING_MIN_BURST_PERCENT` can override defaults if needed). Local runs without `LEARNING_REQUIRE_TELEMETRY=true` check local memory/disk only.

## Git exports and approval

Run `node infrastructure/automatic-learning/export.mjs` manually, install `fps-learning-export.service` + `fps-learning-export.timer` on the host, or set `LEARNING_GIT_EXPORT=true` for hourly/post-evaluation coordinator exports. Provide a repository-scoped credential using the server's Git credential helper or SSH deploy key; never embed tokens in remote URLs.

Reports (and passing candidate reports under `reports/candidates/`) push to `LEARNING_GIT_BRANCH` (default `main`) from an isolated checkout using the repository's `origin` remote. Set `LEARNING_GIT_REVIEW_BRANCHES=true` to also push `automatic-learning/review-<id>` branches. Export failures leave durable files for retry. Ensure deployment automation does not unnecessarily restart on report-only commits if desired.

Promotions travel as an append-only registry: the export copies `models/registry.json` and the bundles it names into `AutomaticLearning/models/`. The API serves the registry's active bundle when `registry.json` exists and otherwise the legacy `active.json` pointer, so previously approved bundles stay valid. Owner controls (append-only): `node infrastructure/automatic-learning/registry.mjs status|pause <reason>|resume <reason>|rollback <sha256|baseline> <reason>`, or a `PAUSE_PROMOTION` file in the data directory. New exhibitions fetch once and pin the bundle; network failures use the separate compatible approved cache, then built-in defaults. Browser storage is a local experiment cache only.

## Utility brain

v2 bundles may carry an optional `utility` brain (the calculated-and-learned grenade throws in `EsportsClash.Web/src/fps/fpsUtilityBrain.ts`). Bundles without it stay valid; clients and the worker then use the committed seed `fps-utility-brain.json`. Training jobs learn it and record one `utility` experience per round: the delta the round made (changed/added memories in most-recently-used order plus removals, `fpsUtilityLearningExperience.ts`), which replays to the learner's exact brain. Hourly summaries add `learningSamples.utility` (throws scored) and `utility` on-target counts. One brain serves both teams of a simulation, so a paired win comparison cannot attribute results to it: evaluation pins the incumbent's brain for every match, and candidate reports list the candidate and incumbent on-target rates separately. A bundle's brain must already be canonical, at most 400,000 JSON bytes, 800 memories and 200 spots; the API (`AutomaticLearningBundle`) refuses a malformed one with 503 and serves approved bytes verbatim.

## Team lineages, playbooks and real matches

Two worker lineages co-evolve: `worker:main` (the legacy single model) and `worker:rival` (forked from it on first start). Training jobs pit them against each other, alternate starting sides and maps, and tag every experience record with its lineage, so each team learns its own navigation, combat, movement, utility brain and playbook. Bundles may carry `playbooks` (one per map: plays with outcome statistics overall and per opponent lineage, learned variants and archived plays) and `opponents` (lawful cross-match observations of each opponent). Both are optional; older bundles stay valid.

The Laravel API keeps an append-only, trigger-enforced history per lineage (`fps_team_lineages`, `fps_model_versions`, `fps_lineage_events`; large payloads are content-addressed files). `GET /api/v1/fps/lineages/{key}/current` serves each kind's current bytes verbatim; the worker writes with `FPS_LEARNING_WRITER_TOKEN` (`POST .../versions`, `POST .../events`). A signed-in manager may submit a finished match for their own club (`POST /api/v1/fps/lineages/club:{id}/experience`): called plays, results and lawful observations only, size-bounded, deduplicated per match. With `LEARNING_API_URL` and `LEARNING_API_TOKEN` set, the worker pulls these (`GET /api/v1/fps/lineage-experience`), applies them to that club's lineage (forked from `worker:main` on first use) and publishes a new version.

## Movement model interpretation

Movement samples are attributed to the action selected in a bounded context (duel or peek, distance band, and health band). Actual enemy damage, incoming damage, kills and the round result provide feedback. Training explores only the listed existing choices. Evaluation pins both teams and the model, and its seeds are separate from training. A passing movement ablation is evidence about the movement model in this simulator, not proof of professional-level play or an individual-attribute upgrade.

## Verification and pending deployment

Focused storage/frozen-mode/headless tests are in `EsportsClash.Web/src/fpsAutomaticLearning.test.mjs`, `fpsTeamLineage.test.mjs`, `fpsLivePlaybook.test.mjs`, `fpsPromotion.test.mjs`, `fpsRealMatchExperience.test.mjs` and `fpsLearningPersistence.test.mjs`. `LEARNING_CONFIG` can point the coordinator at a smaller config for short soak runs. Run `npm run check:game` and `npm run build` from the root.

At initial implementation, AWS discovery on 13 November 2026 failed with `UnrecognizedClientException` (invalid AWS security token). A later follow-up confirmed `Ubuntu-1-2GB` is running in `ap-southeast-1`, but the Lightsail-generated SSH key was rejected with `Permission denied (publickey)`. The movement extension is pushed as commit `67c0a58`, but has not been deployed to the instance. No one-hour benchmark, 24-hour soak or model activation has been performed. PHP controller integration testing requires Composer dependencies, absent in this workspace at implementation time.
