# Continuous FPS learning

The isolated Node worker runs the live spatial engine at its fixed 30 Hz step without rendering. It trains navigation and rifle cadence on synthetic profiles. Official allocations, careers, player abilities and asset processing are unaffected.

## Files and operation

Tracked configuration is in `config/default.json`. `models/active.json` selects the reviewed bundle; null selects built-in defaults. `reports/` receives daily exports. Raw experience lives in ignored `storage/app/automatic-learning`, never in Git.

From repository root, using Node 24:

```
node infrastructure/automatic-learning/coordinator.mjs
```

SQLite WAL commits model changes and permanent ingestion digests together. Completed-round experience survives incomplete matches. Interrupted matches are recorded as aborted rather than silently replayed. Frozen team policies never explore or update. Hourly UTC JSONL gzip archives contain samples, round outcomes, starts and match results; checksummed summaries survive 30-day raw retention. The ledger is intentionally retained after raw deletion. Back up the volume, including SQLite through its backup API or with the service stopped.

Create a `PAUSE` file in the data directory to pause new matches; remove it to resume after five healthy minutes. `heartbeat.json` reports state. SIGTERM stops the active match gracefully. Model incompatibility stops the worker for explicit review; never silently reuse incompatible training history.

Each 100 completed training matches freezes a candidate. Evaluation uses 200 seed pairs against each of incumbent and original baseline, with swapped teams (800 matches). The evaluation seed range is disjoint from training. Results include paired normal-approximation confidence intervals, profile groups and attacking/defending results. Timeouts invalidate the candidate. Passing screening requires positive incumbent lower bound and a baseline interval that does not establish regression.

Passing screening schedules 200 swapped seed pairs each for route-only and combat-only comparisons against the incumbent. Reports retain separate ablation intervals and require both comparisons to complete before review. No measured improvement or throughput claim is made.

## Lightsail Ubuntu-1

Target: `Ubuntu-1`, region `ap-southeast-1`, availability zone `ap-southeast-1a`.

1. Restore valid AWS CLI credentials privately, then inspect the instance CPU/RAM, disk and existing services. Credentials must never be placed in this folder.
2. Inspect live application resource use before choosing installation location. Copy the reviewed repository to the server and create the data directory owned by UID 1000.
3. Create a dedicated IAM principal with only `lightsail:GetInstanceMetricData` permission (Lightsail metrics does not offer resource-level scoping for this call). Configure its credentials directly on the server under profile `lightsail-monitor`; never copy credentials into this repo or chat. AWS login tokens are temporary and are unsuitable for a long-running unattended timer unless their renewal is managed.
4. Install Node.js, AWS CLI, Docker, and Compose. Install `fps-learning-health.service` and `fps-learning-telemetry.service` plus its timer from `infrastructure/automatic-learning/`. The loopback health endpoint checks the training container heartbeat and host memory/disk; telemetry also reads this instance's Lightsail burst metric. Missing or stale telemetry pauses training.
5. Run `docker compose -f compose.automatic-learning.yaml up -d --build`. Initial limits: one worker, 0.5 vCPU, 512 MiB. No public ports. The container remains paused until the first healthy telemetry window.
6. Benchmark one hour, then soak 24 hours. Inspect hourly completed/aborted counts, wall/simulated seconds, CPU credits, memory and disk. Resource limits must protect the host; 200 games/hour is a target, not a guarantee.

The container pauses when available memory is below 20%, disk below 15%, CPU burst capacity below 20%, or host telemetry/application health fails. Resume requires five healthy minutes. Local runs without `LEARNING_REQUIRE_TELEMETRY=true` check local memory/disk only. The telemetry application-health check currently pauses immediately on a failure, which is stricter than the planned three-failure threshold.

## Git exports and approval

Run `node infrastructure/automatic-learning/export.mjs` manually, or set `LEARNING_GIT_EXPORT=true` for coordinator daily exports. Provide a repository-scoped credential using the server's Git credential helper; never embed tokens in remote URLs. The image does not contain Git: run exports on the host via a daily timer, or install Git in a separately reviewed exporter image. Leave coordinator export disabled with the default image.

Reports push to `automatic-learning/data` from an isolated checkout. Candidate review branches carry screening results and the ablation requirement. Export failures leave durable files for retry. Ensure deployment automation runs only for explicitly approved application branches; data/review branches must not trigger deployment.

After ablations and owner review, save a compatible bundle in `models/<sha256>.json`, where the hash covers exact file bytes. Update active.json's bundle and sha256 through normal review/deployment. The API serves only that file. Rollback restores the previous manifest. New exhibitions fetch once and pin the bundle; network failures use the separate compatible approved cache, then built-in defaults. Browser experiment storage remains separate.

## Verification and pending deployment

Focused storage/frozen-mode/headless tests are in `EsportsClash.Web/src/fpsAutomaticLearning.test.mjs`. Run `npm run check:game` and `npm run build` from the root.

Cloud discovery attempted on 13 November 2026 failed with `UnrecognizedClientException` (invalid AWS security token). No remote deployment, one-hour benchmark, 24-hour soak or model activation has been performed. PHP controller integration testing requires Composer dependencies, absent in this workspace at implementation time.
