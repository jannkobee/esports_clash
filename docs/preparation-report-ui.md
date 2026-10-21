# Preparation reports and controls

The owner requested fixed button colors on hover, clearer checkboxes and one report that collects retries.

## Behavior

Each generated source has one visible preparation report, identified by its earliest retained execution. The latest execution supplies current status, qualification, preview and retry controls. An active execution takes priority if historical imported records overlap. Old report URLs resolve to the same report; live polling retains the stable report identity. A different generated source remains a separate report.

Each retry appends a worker execution and its recorded observations inside that report. Execution IDs, immutable frozen plans and original artifacts remain isolated so an old poll cannot overwrite a new execution, a published artifact is not reset, and original evidence remains available. Attempts from revised preparation settings also remain in this source's report. Combined activity is sorted oldest first and labels the attempt number. Historical failures stay in the timeline/archive; the attention panel describes the current execution only. JSON downloads retain the requested execution plus all report attempts.

Mapping-review, deferred-qualification and review failures now expose the normal retry control. Both workers must acknowledge a stop before retry admission. Retries reuse verified saved rigs where available and still require normal animation/geometry/runtime qualification and explicit publication sign-off. Legacy reset/resume-in-place requests use this acknowledged path. Pause retains its established stop-and-resume semantics.

Deleting a report clears every retained attempt in its source group, after checking all executions in a single transaction serialized against admission. Active/pending attempts block the entire deletion. Worker files and release metadata retain existing protections; deleting a report does not delete its source or live assets.

Buttons, filter pills, studio actions and navigation tabs keep their background, text and border colors on hover. Pressed, selected, disabled and keyboard-focus feedback remain. Checkboxes are 20px with a mint checked state, mixed-selection mark, disabled appearance and visible keyboard focus; forced-color mode uses the native checkbox.

## Affected files

- `app/Services/PreparationReportService.php`: stable grouped reports and current-execution selection.
- `app/Http/Controllers/AvatarPreparationController.php`: grouped listing/live/full reports and stable retry destination.
- `app/Services/AvatarPreparationControlService.php`, `AvatarPreparationService.php`: review-state retries, safe compatibility aliases and revision linkage.
- `app/Services/ReportDeletionService.php`: atomic whole-report deletion.
- `resources/views/evolution/avatars/preparation*.blade.php`: one report, combined timeline, attempt archive and controls.
- `public/evolution.css`: fixed hover colors and accessible checkbox styling.
- `tests/Feature/PreparationControlsTest.php`, `infrastructure/evolution/verify-preparation-reports.mjs`: history, retry, deletion, browser and style regression checks.

Paths above are relative to `EsportsClash.Api` except the browser check.

## Verification and limits

- Backend suite: 112 tests / 1,172 assertions passed. Final retry-control subset: 9 tests / 101 assertions passed.
- `npm run check:game`: 485 tests, three simulation tests, design and TypeScript checks passed.
- `npm run build`: passed; existing large-chunk warning remains.
- Local browser: one Dawnna report with all three original attempts, all old report URLs resolve to it, 21 recorded updates in chronological order, no stale current mapping warning, 110 unchanged hover comparisons, Space-key checkbox selection, no uncaught browser errors and 12 layouts at 320/390/768/1440px. [Recorded results](preparation-report-ui-verification.json).

No live inference, retry, cancellation, deletion or publication was submitted during verification. Existing published Dawnna was observed read-only. Earlier execution data is retained rather than rewritten. Reports list the latest 100 source groups; events remain bounded to 100 recorded transitions per execution. Gameplay and worker engine code are outside this change.
