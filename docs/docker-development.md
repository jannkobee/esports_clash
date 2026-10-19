# Docker development and report separation

**Current visual state (2026-10-18):** the [supplied Arsenaldo model](arsenaldo-supplied-model.md) is served through the existing frontend bind mount/HMR. TRELLIS scaffolding is paused and has no deployed service. Art now has private Redis (`avatar-redis`, `avatar-queue-worker`, `avatars` queue); ML retains its database queue and pinned runner. Visual generation is currently paused by the owner. Worker/reviewer changes require deliberate image rebuilds between runs; game and Laravel sources support development reload.

Large GLBs under `/models/` are served directly by nginx from a separate read-only public-model mount. Source changes still appear in development, while Vite handles application modules/HMR. This avoids stalled concurrent Node streams for the new 31.74 MiB model. No secret or private artifact directories are exposed through that mount.

The local dashboard has separate owner-only archives:

- ML reports: <http://localhost:8089/evolution/ml/reports> — simulation/training progress, evaluation gates, checkpoint evidence and learning JSON.
- Model reports: <http://localhost:8089/evolution/avatars/reports> — avatar geometry/animation candidates, technical validation, design review and model JSON.
- ML controls remain at `/evolution`; model controls remain at `/evolution/avatars`. Existing report URLs still work. The shared navigation marks the current section. Report lists paginate independently and query separate tables; downloads cannot resolve a run from the other engine.

Model JSON includes frozen plans, reports, manifest hashes and recorded decisions. Downloads do not themselves publish a version. Avatar/VFX publication uses technical gates and trusted rollback, with read-only candidate decisions; balance proposals retain owner approval. Candidate comparison files remain owner-only, while runtime releases use versioned hashed URLs. Historical decisions/assets remain retained.

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

## Preparation and cancellation controls (2026-10-19)

The dev avatar worker mounts preparation/control scripts read-only and receives TRELLIS outputs read-only at /trellis-sources. Existing artifact/Redis/database volumes remain. PHP/Blade/CSS/JS hot reload is unchanged. Restart CPU workers between runs after worker-code changes; frozen preparation fingerprints reject changed engines. The TRELLIS overlay launches read-only control.py around the existing inference image, preserving native source/checkpoint hashes and reporting a separate control fingerprint. A full GPU image rebuild still requires matching diagnostics. Do not replace the original ML runner. Dashboard: localhost:8089/evolution/avatars/preparation. Read avatar-asset-preparation.md before qualification/publication.

## UniRig and manual visual admission (2026-10-19)

The optional compose.unirig.yaml overlay adds the isolated native rigging worker. Set UNIRIG_IMAGE_ID from the actual built image (alongside TRELLIS_IMAGE_ID) before recreating these services; native readiness is bound to image/source identity. Run only the documented native import check after building. Starting containers does not submit an avatar. Generation, preparation and enhancements are owner-started; visual schedule admission has been removed while ML remains unchanged. Read infrastructure/unirig/README.md and docs/unirig-manual-visual-workflows.md for exact commands, deletion scope and the deferred outcome-qualification boundary.


## 2026-10-19: Deletion dependency and reference-upload corrections

Owner reported false source-in-use and upload errors. Deleted inactive preparation reports (paused, review/validation/retarget waiting, ready, complete) now cease blocking generated-source removal, while visible unfinished preparations, truly active deleted jobs, and any retained/published release still protect sources. No reports restored and no owner artifacts removed. Tests cover deleted inactive eligibility, active-job rejection and retained-release protection.

Root cause of upload failure: artisan serve spawns PHP without inheriting parent -d limits, reverting HTTP uploads to 2 MiB. Added shared uploads.ini (12 MiB file /16 MiB request) to the API image and dev PHP config mount, removed ineffective parent flags, and set both nginx configs to16 MiB. API recreated and proxy reloaded. Authenticated browser multipart proof: 3 MiB PNG reaches controller validation; 13 MiB yields explicit 12 MiB error; no reference/job changed. Evidence: reference-upload-limit-verification.json. Gameplay/ML/manual admission unchanged.
