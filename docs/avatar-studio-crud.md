# Avatar asset studio and CRUD improvements (2026-10-21)

The owner requested clearer avatar selection, asset CRUD, prompts and generation UI based on screenshots of the roster and Aiselle status page.

The roster now opens one avatar studio. The studio presents source assets, generation, then models/history. Status and model review share the body/right-hand/left-hand editor. Equipment files support upload, replacement, download, settings updates without another upload, and independent removal. Removing the active body preserves immutable inputs used by past jobs and blocks new generation until replacement.

The prompt studio supplies avatar-specific body and equipment briefs with editable persistent text, keyboard-accessible tabs, copy with clipboard-denial fallback, reset and unsaved-edit feedback. Saved appearance briefs from content management can be imported into the matching avatar without duplicating context after saving. Editing prompts does not generate images or queue work.

Known historical concepts whose metadata explicitly requested relaxed A stances/attached equipment are labelled legacy and excluded from generation readiness. This is not an image pose classifier; anatomical quality remains an owner review responsibility. Weapon PNGs are design references; GLB/self-contained glTF files are 3D assets. Uploading a PNG does not produce or mount a weapon mesh.

Generation synchronizes locally saved references before freezing a job. Inspection shows its original recorded input after body replacement. Retained models remain inspectable/downloadable after report hiding. Model links use IDs rather than list-dependent numbering. History recognizes all active states and separates failed, cancelled and model-deleted outcomes.

File handling validates PNG signatures, GLB headers and self-contained glTF resources, binds equipment to its matching hand, removes obsolete formats after replacement, and serializes weapon metadata mutations across both hands. PHP allows 20 MiB files with 24 MiB request/proxy ceilings; body uploads retain their application-level 12 MiB limit. The local API was restarted and nginx reloaded; PHP settings report 20M/24M. Generation and animation workers were not restarted.

Affected files: TrellisGenerationController/Service, new AvatarAssetPromptService, routes/web.php; avatar trellis, generation-status, generation-preview, generation-runs and new asset-editor/generation-controls Blade views; public/avatar-assets.js, generation-scoped evolution.css, and evolution.js hash/popstate recursion repair; infrastructure/evolution/uploads.ini and both nginx configurations.

Verification:

- Full Laravel suite: 104 tests, 1,085 assertions passed, including 27 generation tests for CRUD, authorization/confirmation, stale references, historical inputs, legacy concepts, malformed files and design imports.
- npm run check:game: 485 unit tests, three additional simulations, design checks and TypeScript passed.
- npm run build passed with the existing chunk-size advisory.
- PHP/JS syntax, Blade cache and nginx configuration checks passed.
- infrastructure/evolution/verify-avatar-studio.mjs: authenticated read-only Chrome review of the roster and two avatar studios at 1440/1000/768/390/320px, plus the actual generated GLB at 1440/390/320px. No horizontal overflow or uncaught errors. Search/counts, prompt tabs/edit/reset/clipboard fallback, temporary previews, size validation and cancelled removal passed. No live uploads, prompt saves, jobs or deletions were submitted.
- Screenshots/evidence: avatar-studio-desktop.png, avatar-studio-mobile.png, avatar-studio-verification.json.

The existing upload test initially wrote its tiny fixture into Dawnna's persistent active reference. Its original content-addressed file was preserved, verified against the live worker digest and restored. Generation tests now use unique disposable storage directories alongside the existing in-memory database isolation.

Limits: body removal clears the active selection rather than purging historical files. Weapon checks validate containers/resources, not mesh quality or rig qualification. No new live generation, rigging, publication, gameplay or AI tuning was performed. Existing manual qualification, risk-based tower rules, attribution, objective contests, anti-oscillation and parody aliases remain governed by prior approvals.
