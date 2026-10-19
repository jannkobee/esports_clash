# Asset Preparation pause, resume and retry

Owner page: http://localhost:8089/evolution/avatars/preparation

## Controls

- **Pause preparation** is available for queued, resource/model/worker-waiting, rigging, animating and validating jobs. The job becomes `pausing`; polling and publication cannot advance it. Existing cancellation endpoints stop owned processes and persist tombstones in both UniRig and the animation worker. Only after both workers acknowledge stop does Laravel record `paused`. If either endpoint is unavailable, recovery continues requesting acknowledgement; an HTTP 404 never counts as a stop.
- **Resume preparation** is available after confirmed pause. It requests one linked attempt using the same original generated source, yaw, reviewed bone map and attachments, with the current verified workers and current live baseline frozen anew. The previous attempt remains paused, with its report, files and stop tombstones intact.
- **Retry preparation** is available for running/waiting jobs and failed, cancelled or paused attempts. It first cancels the old attempt and waits for both worker acknowledgements, then requests one linked replacement. It does not overlap old inference, reset frozen plans, clear stop tombstones, change seeds, bypass validation, correct missing bone maps or solve insufficient memory. It is an explicit owner action, not a retry scan over avatars.
- **Cancel linked-attempt request** withdraws a pending resume/retry before admission. If workers are still stopping, they continue stopping, but no replacement is queued afterward.

Pause is a safe stop, not a process frozen in RAM/VRAM or a model checkpoint. Resume/retry may repeat unfinished work, including rig prediction. No in-memory checkpoint or zero-work resume is promised. Worker images/engine fingerprints are unchanged by these backend controls.

The child attempt has a fresh UUID, `previous_preparation_id`, a fresh immutable plan and its own history. A unique predecessor constraint plus admission/row locks allow at most one direct child per attempt. Repeat requests return the existing link or remain pending; controls on that child manage future retries. Owner/cancellation races are serialized. Late old-job polls cannot reopen `pausing`/`paused`/`cancelling` records. The normal Cancel action can override a retry while the old attempt is still stopping. Terminal/published/qualified review states reject inappropriate actions. Manual bone-map repair still uses the existing source form and creates a reviewed preparation.

A restart job makes up to three bounded admission attempts. A durable recovery callback only revisits already owner-requested pending continuations; exhausted failures clear the intent and show an error requiring another owner action. A missing/deleted/changed original generation report blocks continuation. Deleting a report is blocked while stop acknowledgement or linked admission is pending; after completion, report deletion clears control details too, preserving minimal identity/link foreign keys and essential asset/rollback metadata.

## Files / deployment

Migration `2026_10_19_000010_add_preparation_controls` adds nullable JSON control state and a unique nullable self-reference. `AvatarPreparationControlService`, `RestartAvatarPreparation`, existing dual-worker cancellation/recovery, owner controller/routes, progress service and `preparation-controls.blade.php` implement the workflow. `AvatarPreparationService::start` accepts an optional predecessor ID; standard manual starts remain unchanged. No visual automation or catalog publication was enabled.

Server CLI for an explicit owner request: `php artisan avatars:preparation-control <uuid> pause|resume|retry|qualify`. It uses the same services and does not add a roster admission schedule.

## Resource continuation

The owner authorized continuing Dawnna through rigging/retargeting and qualification after these controls. The last host check found approximately 15.79 GiB total Windows memory and 1.36 GiB free, while Docker reported a roughly 7.65 GiB VM ceiling. UniRig's 7 GiB available-memory gate cannot be met alongside the other services under the existing VM cap. Merely clicking Retry does not remove this constraint.

Increasing the Docker/WSL memory ceiling requires addressing Windows memory pressure and restarting the relevant VM, which interrupts all Docker workloads, including ML and unrelated containers. That machine-wide interruption is a separate operational step; no unrelated process was terminated and no memory safety threshold was lowered to make inference start.

## Verification

Isolated feature tests exercise dual stop acknowledgement, pause/resume, linked-source/settings preservation, duplicate admission, stop-before-retry, cancellation override, pending continuation withdrawal, owner authorization/UI, publication-state guards, pending-report-deletion rejection, source loss and bounded restart recovery. These tests do not qualify a generated avatar's rigging or runtime behavior.


Proposed next operational change (not applied): increase the WSL VM memory limit to 10 GiB after freeing Windows memory, preserve existing WSL settings, and perform a controlled WSL/Docker restart with workload recovery. A reviewable configuration fragment is at `.local-tools/unirig/wslconfig.proposed`. Microsoft documents `.wslconfig` as global to WSL 2, memory defaulting to 50% of Windows RAM, and restart/shutdown requirements: https://learn.microsoft.com/en-us/windows/wsl/wsl-config . A larger maximum is not a reservation or a guarantee that this 16 GiB host can safely sustain inference alongside all applications. The owner needs to agree to the interruption and relieve current host memory pressure before this step.

Backend deployment verification: migration 10 applied without resets; **85 Docker tests / 912 assertions passed**, including six lifecycle tests. Blade compilation passed. No native worker rebuild or control/qualification request was used as a demonstration. No report was deleted.


Authenticated Chromium verification passed on the deployed page: real Dawnna row was already Paused (worker acknowledgement recorded at 13:27 Manila), Resume and Retry were present, the stop/restart explanation was visible, actual eligible-report selection and open panels survived refresh, and the 390px layout had no overflow. This verification submitted no lifecycle or delete request. Evidence: `preparation-controls-ui-verification.json`, `preparation-controls-desktop.png`, `preparation-controls-mobile.png`. The latest retained UniRig resource sample before pause showed 5,690 MiB VM memory available, below 7,168 MiB. That is not a new model outcome. The controls are complete; the VM memory/restart decision is the remaining blocker to the separately authorized Dawnna continuation.

## Superseding operational update

The owner subsequently approved the 10 GiB WSL cap and global restart and confirmed apps were closed. It was applied, original workloads restored, and the explicit Dawnna continuation resumed. The earlier pending-approval/resource-blocker paragraphs are historical. Actual inference repairs and results are recorded in `wsl-memory-dawnna-continuation.md`; the controls remain manual and no failed output becomes a live asset.
