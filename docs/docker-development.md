# Docker development and report separation

The local dashboard has separate owner-only archives:

- ML reports: <http://localhost:8089/evolution/ml/reports> — simulation/training progress, evaluation gates, checkpoint evidence and learning JSON.
- Model reports: <http://localhost:8089/evolution/avatars/reports> — avatar geometry/animation candidates, technical validation, design review and model JSON.
- ML controls remain at `/evolution`; model controls remain at `/evolution/avatars`. Existing report URLs still work. The shared navigation marks the current section. Report lists paginate independently and query separate tables; downloads cannot resolve a run from the other engine.

Model JSON includes the frozen plan, recorded report, manifest hash and owner decisions. It does not publish a visual version. Candidate assets and previews retain their owner-only access, and existing approval/rollback controls remain in each model comparison.

## Start development mode

For the existing initialized local stack, run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/evolution/dev.ps1
```

This builds the small Node development image and enables `compose.evolution.dev.yaml` alongside the base Compose file. Game access stays at <http://localhost:8088>; Laravel stays at <http://localhost:8089>. Docker must be running. Existing local credentials, sessions, PostgreSQL and artifact volumes are retained.

React/TypeScript/CSS edits in `EsportsClash.Web/src` use Vite hot module replacement through nginx, including its WebSocket connection. Laravel `app`, `bootstrap/app.php`, `config`, `routes`, Blade views and public CSS/JS are mounted read-only into the PHP services. PHP changes load on subsequent requests, Blade recompiles normally, and Vite sends a browser reload when those dashboard sources change. Polling supports Windows Docker Desktop bind mounts. The Vite client is injected only in local mode with `DEV_VITE_URL` set. `APP_DEBUG` remains false.

The database queue uses `queue:listen` in development so each job starts with current PHP code. The scheduler loads fresh code on subsequent scheduled executions. Running jobs are not mutated halfway through their execution. Vendor dependencies, compiled views, logs, sessions and database files stay inside their existing containers/volumes; the host `vendor` directory does not hide the image's dependencies.

The private avatar reviewer and the ML, avatar-generation and authoritative match executors retain their pinned images. Browser edits do not change an active worker's source fingerprints or reproducibility evidence. Rebuild and qualify those executors deliberately between runs. No automatic catalog activation, model approval or source-driven training restart is introduced.

Changes to dependencies, Dockerfiles, environment variables or the mounted-file list require rebuilding/restarting the relevant service. With a changed `package-lock.json`, rebuild `frontend-dev`; Composer changes require rebuilding the API image. Runtime source edits in the mounted folders need no rebuild. Do not run the base `up` command to enable development: include both Compose files or use the script above.

## Return to built services

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/evolution/dev.ps1 -Stop
```

This stops the development frontend and returns API/queue/scheduler/web to their last built images. To include new source in those built images, build `api web` with the base Compose configuration first. It never runs `down -v`, resets credentials, prunes artifacts or recreates the three execution workers.

## Verification

Backend report-isolation tests cover owner access, pagination, escaped model content, distinct downloads, and cross-engine run IDs returning 404. Game checks and the production build cover the Vite configuration's non-development behavior. `node infrastructure/evolution/verify-dev.mjs` checks the real owner browser and temporarily edits/restores a Blade view, CSS, PHP controller and React module to exercise actual reloads. It writes `evolution-reports-dev-verification.json` and a mobile report screenshot; it does not approve candidates or change automation settings.

Verified 2026-10-18: 41 backend tests / 320 assertions, 439 game tests and three deterministic simulation checks pass. Actual Chromium verifies the two report sections, the five-candidate JSON download, 390px mobile layout, Blade/CSS/PHP reloads and React HMR without a full page reload. All temporary source markers were restored. See [evolution-reports-dev-verification.json](evolution-reports-dev-verification.json).
