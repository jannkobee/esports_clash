# Local autonomous evolution foundation

**Latest visual update (2026-10-18):** owner paused TRELLIS.2 and selected a [supplied static Arsenaldo GLB](arsenaldo-supplied-model.md). Visual generation is paused; ML is unchanged. Avatar/VFX publishing had moved to [problem-driven automation](autonomous-art-evolution.md), which published versions before this pause. Manual-review/no-publication statements below are historical; gameplay balance retains owner approval.

ML reports: **http://localhost:8089/evolution/ml/reports**. Avatar model reports: **http://localhost:8089/evolution/avatars/reports**. Both use the owner login and independent evidence. Docker development hot reload is enabled; see [docker-development.md](docker-development.md) for start/stop and source/worker boundaries.

The owner has prioritized the separate **Avatar Evolution Engine** and deferred remaining ML validation. Its first Arsenaldo five-candidate Docker cycle is complete and waiting for owner review at **http://localhost:8089/evolution/avatars**. Laravel schedules generation independently; approval/publishing and rollback remain owner controls. See [avatar-evolution.md](avatar-evolution.md) for implementation, measured evidence and limits. No avatar candidate has been published and no failed ML model has been promoted.

Latest operations update: the prioritized memory/learning/storage milestone is deployed locally and completing independent cycle validation. See [ml-operations.md](ml-operations.md) for the resource controls, protected artifact registry, compatible fitting replay, actual measurements and current limits. The owner has deferred further speed tuning. Current schedule: 120 minutes; review window: 48 hours. Historical deployment/study snapshots below remain historical.

The expanded online product, Player Card, ranked and commercial-pack requirements are combined in [global-evolution-roadmap.md](global-evolution-roadmap.md). The trusted Normal milestone is implemented separately. ML administration now lives in the Laravel Blade frontend at **http://localhost:8089/evolution**, outside the game frontend.

Approved 2026-10-18: use the existing Laravel backend, deploy locally in Docker, run continuous scheduled ML, and review balance proposals before a configurable substitute deadline. **Do not deploy to Vercel.** The user subsequently authorized backend tests, game checks/builds and simulation/training validation, superseding the earlier testing deferral for this work.

## What this increment does

Laravel 13 persists immutable training plans, progress, results, review batches, alternatives, deadlines, decisions and audits. Only designated evolution owners can access the administrative API. Existing Sanctum account authentication is reused; public registration never grants evolution ownership. Initial Docker credentials are generated locally, never committed or printed by bootstrap.

One bounded Python/PyTorch worker collects fresh independent observations and rewards using the existing **live browser executor** and `scripts/paired-live-rollout.mjs`, rather than claiming that the simplified Node simulation is equivalent to live gameplay. The original `validateBroadCase`, actual task/team reward recomputation, repeated-control state checks, executor checks and same-action learned replay checks remain authoritative. A development-only `evaluationRenderless` prop skips Three creation and spectator drawing; `evaluationStartPaused` prevents animation frames from stepping before the fixed-step fixture begins. Normal production games ignore both flags. This is the same live simulation inside headless Chromium; extraction into a standalone Node engine remains future work.

The fixed first study has 32 proper-fit, 24 calibration and 24 evaluation worlds, eight existing drafts, both sides, independent seed allocations starting at 20001, a 120-second scouting start and equal 30-second outcome windows. It only explores the existing legal, close farm/push choices. Observations retain the existing visibility restrictions. No new fight/cast/movement authority, combat stats, reward weights or experiment margins are introduced.

Before collection, an execution plan freezes source hashes, drafts, case allocations, model hyperparameters and exploratory acceptance criteria. PyTorch trains a bounded regularized linear outcome-contrast predictor for 400 Adam epochs using proper-fit data only. A `.pt` checkpoint and portable JSON weights are saved. Calibration freezes a separate one-sided 90% empirical error buffer. A candidate hash witness precedes any held-out outcomes. Existing TypeScript inference executes the exported candidate in actual live checkpoint replays. Missing/invalid/incomplete/no-target cases remain in the planned denominator, with their raw attempts, rather than being replaced. Historical study files and failed candidates are untouched.

The exploratory gate requires at least eighteen valid and supported cases, four actual changed choices, positive aggregate team reward, more gains than losses, no extra actor/team death cases, no broader worse changes, at least 90% observed lower-bound coverage and prediction MSE below zero contrast. **Passing this local gate still does not authorize production promotion or establish full-match benefit.** Failed or insufficient studies remain offline. Model histories live in per-run artifacts; a competitive historical-opponent league is not implemented yet.

## Scheduling, recovery and resource limits

Docker restarts the API, queue worker, scheduler and runner. Laravel's minute tick recovers stale polls, resolves expired reviews and starts a new training cycle every six hours when no other cycle is active. Pause automatic cycles separately from stopping the current cycle. There is one simulation/training worker, a ninety-minute total run budget, two CPU cores and a 3 GiB runner memory cap. Torch uses one thread. PostgreSQL and runner artifacts use persistent named volumes. A 2 GiB aggregate artifact budget stops collection instead of silently deleting evidence; archive old runs before additional collection. The host and Docker engine must remain running.

Runner starts are idempotent by UUID and immutable plan. Resuming an interrupted container reuses checkpoints and validates source/data/model hashes. An attempted incomplete world is not replayed for replacement evidence. Cancellations are persisted before signalling the process group. Queues recover across restarts; existing deadline decisions are database-backed, not browser timers. Worker services are internal; only the web port 8088 and diagnostic API port 8089 bind to loopback. The stack does not mount a Docker socket or generate shell commands from model output.

## Balance review semantics

- The default review period is 48 hours, configurable from 1 to 336 hours. Settings changes affect future batches. Extending an existing review explicitly assigns a new deadline.
- A review supports multiple proposal rows. The owner can select one, reject one, decline the batch or extend the review. All decisions lock the review and its options in a PostgreSQL transaction.
- Selection closes pending alternatives. Rejected options stay rejected. A declined or selected batch cannot be reopened by a substitute or late duplicate request.
- The deadline substitute is an **explicit conservative rule-based delegate**, not a model claiming to reproduce the owner's preferences. It selects an intact eligible keep-current option, or declines if none is eligible, and audits its reasoning. It runs automatically only after the recorded deadline. More sophisticated preference ranking awaits tested mechanical candidates.
- Proposal content has a SHA-256 manifest check. Selecting a proposal is distinct from releasing a patch. This increment has no mechanical patch release path.
- Completed learning studies generate a real keep-current review explaining that macro-learning data does not establish avatar/item imbalance. **They do not manufacture buff/nerf alternatives.** The data model and review UI support multiple options; statistical candidate generation and isolated patch evaluation are outstanding work.

## Run locally

From the repository root in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File infrastructure/evolution/setup.ps1
docker compose --env-file .env.evolution.local -f compose.evolution.yaml up -d --build
```

Open **http://localhost:8089/evolution** (or the Laravel root at http://localhost:8089) and sign in using `EVOLUTION_OWNER_EMAIL` and `EVOLUTION_OWNER_PASSWORD` from the ignored `.env.evolution.local`. This is native Laravel Blade with session authentication, HttpOnly cookies and CSRF-protected forms. Bootstrap does not reset an existing owner's password. The game remains at localhost:8088; its Evolution Lab tab/component has been removed. No Vercel command or configuration is used.

The Blade control panel shows live collection progress (ten-second partial refresh), run history, actual evaluation metrics, candidate hashes, frozen plans, downloadable report JSON, schedule controls, proposals and decision audits. Links to full reports are owner-only. It reuses the existing training/review services and PostgreSQL records, rather than embedding the React dashboard or duplicating business rules. Data is escaped and authenticated responses use `no-store` caching. Public registration does not grant dashboard access.

The first seed-21001 study has now completed all 80 planned worlds: 24 valid held-out cases, zero changed decisions, prediction MSE 0.18327489 versus zero-contrast MSE 0.15186185. Its exploratory gate **failed**, and the model remains offline. The scheduled six-hour cycle remains enabled. This later completion observation does not rewrite the original in-progress verification/history below or establish learned benefit.

Blade relocation verification: 25 backend tests / 196 assertions, 436 game tests, three deterministic simulations, TypeScript and build pass (existing bundle-size advisory). Actual browser checks cover native owner login/logout, missing CSRF rejection, live partial refresh, unchanged schedule submission, report download, removal from the game, desktop and phone fit. Evidence is saved separately in `evolution-blade-verification.json` and the visually reviewed `evolution-blade-dashboard.png`; historical React deployment evidence is preserved.

```powershell
docker compose --env-file .env.evolution.local -f compose.evolution.yaml ps
docker compose --env-file .env.evolution.local -f compose.evolution.yaml exec api php artisan evolution:tick
docker compose --env-file .env.evolution.local -f compose.evolution.yaml logs --tail 60 worker scheduler runner
docker compose --env-file .env.evolution.local -f compose.evolution.yaml stop
```

Stopping services preserves volumes. Do not use `down -v` if you want to retain training/review history. Rebuild containers after source changes; an interrupted run with changed source is refused rather than mixing incompatible datasets. The built-in PHP server is for this local deployment; public hosting requires an appropriate production web/runtime configuration.

## Verification commands

```powershell
cd EsportsClash.Api
php artisan test --compact
cd ../EsportsClash.Web
npm run check:game
npm run build
cd ..
docker compose --env-file .env.evolution.local -f compose.evolution.yaml exec runner python -m unittest discover -s /runner -p test_runner.py
```

The backend tests cover access control, independent seed allocation, overlapping-run rejection, pause behavior, persistent deadlines, deadline substitution, explicit rejection/decline precedence, multiple-choice exclusivity, foreign/tampered proposal rejection, mechanical-release blocking, deferral and idempotent review creation. Runner tests exercise authentication, immutable/idempotent plans, cancellation-before-start and real optimizer/checkpoint/calibration isolation.

## Deployment verification and first study

- All six long-running services are deployed locally: web on loopback port 8088, API on loopback port 8089, plus internal PostgreSQL, queue worker, scheduler and training runner. Init migrated the schema and created the designated owner. No Vercel operation was performed.
- Final game verification: **434 tests, three deterministic simulation checks, TypeScript and build pass**. Build retains the existing large-chunk advisory. `index.css` explicitly scopes Tailwind class discovery to `src`, avoiding the large exported-asset tree in the Docker development server. The web proxy refreshes API addresses through Docker DNS across API container replacement; Laravel's local server uses `--no-reload` to preserve container environment variables.
- **12 backend tests / 63 assertions** and **five worker tests** pass in Docker. An initial container-test mistake inherited the new deployment database and reset its bootstrap data. No existing external deployment was targeted. The generated owner was restored and all available run plans/statuses were recovered from the artifact volume. `tests/TestCase.php` now overrides all PHP environment adapters **before application bootstrap/RefreshDatabase** and refuses persistent database configurations; `phpunit.xml` also forces test values. PostgreSQL owner/run row counts were verified unchanged before and after the corrected suite. This incident is not hidden as a clean first deployment.
- Actual owner API access succeeds and unauthenticated access is rejected. The actual dashboard loads learning, balance, history and scheduling controls with no alert errors at 1280x900 and 390x844; the phone page has no horizontal overflow. See `evolution-deployment-verification.json`.
- Known seed 47 reproduces **identical complete captured state fingerprints, RNG and execution/opportunity audits at zero, thirty and sixty simulation seconds**, with spectator rendering enabled versus disabled. This is compatibility evidence, excluded from new learning. See `evolution-renderless-verification.json`. It does not establish full-match balance, new device performance or general learned improvement.
- Initial setup attempts in the 20001 block remain explicitly failed/cancelled and are not accepted as fresh learning. The first final-source study is `6e1523e6-15dc-4924-9d51-4c1a74ac794c`, beginning at seed 21001. It is **still collecting its predeclared eighty worlds**, not a completed successful ML experiment. Its completed evidence and immutable plan survived an actual runner restart unchanged; Laravel resumed the same run. Interrupted attempts remain in its denominator. A source-hash/progress/case-status/restart witness snapshot is in `evolution-study-verification.json`; live status continues to advance in the dashboard.
- Automatic cycles are enabled at six-hour intervals, and new reviews use forty-eight hours. No model has been promoted and no mechanical patch or cosmetic asset has been released. Do not claim that the first cycle has finished, that its eventual gate passed, or that this foundation completes the end-state system.

Operational helpers, from the repository root:

```powershell
node infrastructure/evolution/control.mjs status
node infrastructure/evolution/control.mjs start
node infrastructure/evolution/control.mjs stop
node infrastructure/evolution/control.mjs pause
node infrastructure/evolution/control.mjs resume
node infrastructure/evolution/verify-deployment.mjs
docker compose --env-file .env.evolution.local -f compose.evolution.yaml exec api php artisan evolution:recover
```

The control/verification scripts read ignored local credentials without printing them and revoke their temporary login tokens. `evolution:recover` restores missing run records and preserves seed allocations from trusted worker artifacts; it is not a replacement for database backups of owner decisions.

## Outstanding end-state work

The separately approved first online milestone is now implemented as a local trusted Normal preview: Laravel-owned starter cards/clubs and allocations, an independent private live-rule worker, authorized shared snapshots, reconnect and immutable completion/replay. See [online-normal.md](online-normal.md) and its recorded acceptance evidence. This is the renderless live executor reused as an intermediate server, not the standalone engine extraction below. Its baseline policy has empty adaptive memory; no failed or unqualified learned model was promoted. The original training image/study/evidence remain frozen and separate. Wallet/packs and Ranked are still later work in [global-evolution-roadmap.md](global-evolution-roadmap.md).

Extract one reusable live simulation engine from React with replay parity; expand observations/actions and terminal/full-match evaluation; stronger train-only representation selection; self-play with historical policy populations and eventual PPO/MAPPO where compute supports it; trusted full-match meta analytics; statistical balance alternatives with confounder handling; actual candidate patch simulations, immutable releases, per-match version pinning and rollback; constrained items; cosmetic geometry/animation generation, validation and human previews. Current frontend matches are not governed by a new patch/model release registry. None of these are claimed complete by this foundation.

Protected real tower/well/Nexus risk and legality, ordinary terrain-aware retreat, attribution, champion-first contests, anti-spin commitments, IQ/personality boundaries, fictional aliases and presentation-only hitbox independence remain unchanged. The only incidental existing game-art repair reduces outer-tree branch clusters from four to three, preserving the prior 5000-instance scenery budget after the previously deferred art additions (5334 before, 4914 after).
