# Asset Preparation progress and bulk report deletion

Owner page: http://localhost:8089/evolution/avatars/preparation

The live-game catalog publishing work was paused at the owner's request before implementation. Avatar and Item management still save drafts; this change concerns Asset Preparation only.

## Progress and verbose messages

Each preparation has a workflow position across ten named stages: queue/resource admission, mesh extraction, skeleton prediction, skin prediction, material merge, animation retargeting, manual qualification request, technical qualification, human identity/equipment review, publication. The bar expresses the current workflow stage, not percentage of model inference, artistic quality, completion time or an ETA. It does not establish successful rigging/animation/runtime qualification.

Laravel records actual stage/status changes reported by UniRig and the preparation worker, plus local owner requests for admission, qualification, cancellation and publication. Each transition has an observation timestamp and an explanation. Repeated polls update the last-observed timestamp without duplicating messages; at most 100 recent transitions are retained. These messages are an observation history, not raw subprocess stdout. Private worker log files remain separate. Polling can miss very short stages, and observations are not exact process start times. Existing completed jobs have no reconstructed historical timings.

UniRig resource samples show free/used GPU memory and available Docker VM memory with the time Laravel observed them; total device usage includes other applications. The displayed heartbeat is the worker-reported UniRig update timestamp. A retained UniRig sample is labeled separately from the CPU animation worker. Polling runs approximately every 20 seconds, recovery retries existing requested work, and the browser refreshes reports every 10 seconds. Network failures and cancellation preserve the last known workflow position; unknown historical positions are not invented. Waiting states explain GPU lease, checkpoints/native setup, resource budget, worker connectivity, native bone mapping, qualification request or human review.

Expanded stage/message/bone panels and selected report checkboxes survive live refreshes. Report-selection checkbox focus no longer freezes polling. Identity-review inputs retain interaction protection. The explicit Run runtime qualification and reviewed Publish controls retain their existing gates. No native worker code, checkpoint, model plan hash or frozen inference/retarget settings changes in this milestone. No new preparation is queued automatically; no generated outcome inspection is performed.

## Bulk deletion

Select individual preparation reports, or all eligible reports currently shown (up to the existing 100-row history limit). A selected count, Clear selection, explicit confirmation checkbox and a button showing the number of selected reports make the scope visible. Active/cancelling reports are disabled in the UI. They must finish or acknowledge stop before deletion. The server repeats these guards under row locks, so a selection that becomes active cannot bypass them.

The entire selection is transactional: one active, missing or unavailable record causes no selected report to be deleted. Owner login and CSRF protection apply. Requests reject duplicates, invalid IDs, missing confirmation, empty selections and more than 100 IDs. Single deletion uses the same service and retains the ML balance-review protections.

Deletion clears database state/result/error/plan, preparation progress and duplicate audit details; a preparation's v3 enhancement report mirror is redacted too. A minimal soft-deleted identity marker remains for foreign keys and recovery suppression. Model files, worker artifacts/logs, backups, essential release metadata and immutable balance decisions remain separate. Deleting a published preparation report does not unpublish its asset or remove rollback data. No existing reports were deleted automatically.

## Implementation and verification

Additive migration `2026_10_19_000009_add_preparation_progress` adds nullable JSON progress to `avatar_preparations`. Main files: `PreparationProgressService`, `ReportDeletionService`, `PollAvatarPreparation`, `AvatarPreparationService`, `AvatarJobCancellationService`, `ReportDeletionController`, preparation Blade partials, `preparation-controls.js`, and the live-refresh preservation in `evolution.js`.

Isolated feature tests cover actual polled stages/resource samples and deduplication, last-known position and bounded history, cancellation guards, owner access/confirmation, transactional mixed-status and missing-ID selections, progress redaction, publication identity/mirror retention and the progress UI. Generated GLB outcomes and actual UniRig inference remain outside this verification.


Deployed verification (2026-10-19): migration 9 applied without resetting data. Docker Laravel suite passed **79 tests / 852 assertions**; Blade compilation and PHP/JavaScript syntax checks passed. Authenticated Chromium verified the deployed tracker, disabled active-report selection, checkbox-to-form association, confirmation gating, preservation of selected IDs / open details across a real refresh, and a 390px layout without overflow. The only existing report was active, so selection persistence used a temporary browser-only checkbox fixture removed before screenshots; no database fixture was inserted and no delete/preparation/qualification/publication request was submitted. See `preparation-progress-ui-verification.json`, `preparation-progress-desktop.png` and `preparation-progress-mobile.png`. The UI observed the existing Dawnna job waiting on resources (6,017 MiB available VM memory versus the worker's 7,168 MiB admission requirement at the first check); that is a waiting condition, not an inference or quality result.
