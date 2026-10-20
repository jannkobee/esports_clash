# Avatar studio and preparation report refinement (2026-10-21)

The owner requested removal of the redundant roster inspection link, filters and sorting with name as the default, optional equipment classification, clearer reports and oldest-to-newest reading order.

There is now one avatar studio entry on roster cards. The studio embeds its actual generated GLB, model versions, original frozen reference, assets, generation controls and job history. Existing preview URLs redirect to that studio with a scoped model selection; the duplicated standalone generation-preview template was replaced by a model-review partial. Hidden reports remain hidden, while their retained models remain selectable. Model selection validates avatar ownership.

Roster order defaults to name A-Z on both the server and client. Search combines with role, custom/default equipment and existing status filters. Sorting supports A-Z, Z-A and role/name; reset restores A-Z. Generation and preparation job histories show the latest 100 visible reports in oldest-first order, with optional newest-first/name ordering and job search. Live updates preserve these controls. Active roster counts are queried independently from the bounded history.

Equipment files no longer require a manually chosen type or socket. Hand slots determine sockets; metadata uses the saved/avatar default, with a generic equipment label when none exists. Type overrides remain in optional settings for metadata and prompt suggestions. No image or mesh classifier was added.

Preparation now shows source selection and useful worker/job summaries, with singleton profile and advanced rigging options out of the main flow. Job cards lead with human-readable status, actual stage and a next step. Activity is sorted chronologically by observation time; resource samples, workflow details, evidence, downloads and advanced controls are expandable. There is one pause control rather than two. Report management is collapsed instead of a dominant red block. Bulk selection only includes shown eligible rows and clears selections hidden by a filter.

Reports open as readable owner-only pages, scoped to one live job. JSON remains available through format=json or an application/json Accept header with an attachment filename. Linked-attempt navigation works from standalone reports. A geometry pass alone cannot label an unqualified job ready; summary/filter states follow actual job status. Stage indicators remain workflow checkpoints rather than fabricated inference percentages or ETAs. Resource samples remain labelled with their observed time.

Files: TrellisGenerationController, AvatarPreparationController, AvatarAssetPromptService; trellis, generation-status, model-review, generation-controls, asset-editor, report-toolbar, generation-runs, preparation, preparation-runs, preparation-progress, preparation-controls and new preparation-report Blade views; evolution.js/evolution.css, avatar-assets.js, preparation-controls.js; focused generation/progress tests and infrastructure/evolution/verify-avatar-studio.mjs.

Verification:

- 108 backend tests / 1,122 assertions passed, including chronology, scoped reports/JSON, optional equipment metadata, canonical model inspection and readiness regressions.
- npm run check:game passed 485 unit tests, three simulations, design checks and TypeScript.
- npm run build passed with the existing bundle-size advisory.
- PHP/JS syntax, Blade cache and scoped diff whitespace checks passed.
- Authenticated Chrome checks: 25 layout combinations covering roster, two studios, embedded GLB, preparation and full report at 320-1440px; no horizontal overflow or uncaught errors. Name sorting, combined filters/reset, chronological events/jobs, report JSON, filtered bulk selection and live preservation of sort/closed timeline passed. Browser fixtures changed only the DOM; no jobs, uploads, deletions or settings were submitted.

Evidence: avatar-ui-refinement-verification.json, avatar-ui-refinement-roster.png, avatar-ui-refinement-report.png and avatar-ui-refinement-preparation.png.

Limits: histories show the latest 100 retained records/transitions, in chronological order. Polling is not log streaming or an ETA. Equipment defaults are metadata, not visual recognition. No gameplay, worker admission thresholds, pause/retry mechanics, qualification/publication gates or live asset changed. The approved risk-based tower rules, attribution, objective contesting, anti-oscillation and parody aliases are preserved.
