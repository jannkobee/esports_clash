# Backoffice UI review — 2026-10-20

The owner requested a review and fixes for backoffice UI errors. The existing dark operations-console appearance is retained.

Authenticated Chrome reproduced these errors before the changes:

- Searching for Arsenaldo marked 44 cards hidden, but all 45 stayed visible because card display rules overrode the HTML `hidden` state.
- Search and status categories independently overwrote each other's visibility state.
- Entering Asset Preparation through the top navigation did not execute its page script. The bulk-delete button remained enabled with no selected reports or confirmation.
- Signing in through the shared AJAX handler left the guest header and old CSRF metadata in the document. The sign-out control was absent.
- All six initially reviewed main pages overflowed at the 390px viewport: document content measured 432px against 375px available after the scrollbar. The header account block and long report hashes were among the offenders.
- The shared theme had lost editor grids, step links, progress/history layouts, preview heights, and dialog/toast styles. The 3D viewer's host no longer had an explicit usable height. Toast dismissal depended on animation styles that no longer existed.
- The 3D repair category buttons targeted the first `.panel` on the page instead of their own analysis section. Live report refreshes replaced category controls without preserving or rebinding them.

`EsportsClash.Api/public/evolution.css` restores those layouts using the current theme variables, honors `hidden`, wraps headers/long evidence strings, contains grids within narrow screens, and gives dialogs scrollable bodies and accessible close controls. Preview hosts are 480px on desktop and 360px on narrow screens. Reduced-motion toast dismissal works without relying on animation events.

`EsportsClash.Api/public/evolution.js` combines search and category predicates, reports empty search results, preserves category state across live polls, rebinds refreshed controls, and ignores responses for detached report containers. The shared submit handler respects canceled events, captures submitter values before disabling buttons, uses HTML's default GET method, and prevents duplicate intercepted submissions. Sign-in and pages with their own editor/confirmation/viewer scripts use native document navigation/submission so scripts and browser unsaved-edit guards retain their lifecycle. Lightweight pages retain partial navigation, which now refreshes the header and CSRF metadata. Modifier-clicks, download links and explicit targets retain browser behavior. Toast messages render as text and dismiss with or without animation.

Blade changes add a scoped `analysis-cycles` target and generation search-result status. The sign-out button no longer advertises an unimplemented Escape shortcut. Files: `resources/views/evolution/avatars/index.blade.php`, `avatars/trellis.blade.php`, and `layout.blade.php`.

## Verification

- `php artisan test`: **95 passed / 982 assertions**, using the configured in-memory SQLite test database. JS syntax checks and scoped `git diff --check` pass.
- `node infrastructure/evolution/verify-backoffice-ui.mjs`: authenticated native Chrome verifies **32 layout combinations** (eight pages at 1440, 768, 390 and 320px), with no horizontal document overflow. It checks the login header/CSRF, preparation selection and confirmation after tab navigation, report category persistence across a real 10-second refresh, combined search/categories and empty results, canceled submissions, unsaved-review protection, dialogs at 320px, toast dismissal/reduced motion, and repair-filter scoping.
- The actual generated Dawnna GLB renders in the restored preview: 39,045 triangles, 478px interior desktop canvas height, working narrow-screen layout, no uncaught browser errors. This does not qualify or publish the asset.
- The browser runner is `infrastructure/evolution/backoffice-browser.mjs`; it uses a disposable Chrome/Chromium profile and reads the existing local owner credentials without printing them. Run from the repository root with the local API available at `http://localhost:8089`; `BROWSER_PATH` can override the browser executable. Reports and screenshots first go to `.local-tools/backoffice-review/`.
- Evidence: [verification data](backoffice-ui-verification.json), [before mobile](backoffice-ui-before-mobile.png), [fixed mobile editor](backoffice-ui-editor-mobile.png), [desktop editor](backoffice-ui-editor-desktop.png), [desktop preview](backoffice-ui-preview-desktop.png), [mobile preview](backoffice-ui-preview-mobile.png).

The changes are active through the existing Laravel development mounts. Browser verification submitted no live jobs, deletions, settings updates or design saves. It uses client-only fixtures for selection and repair rows. No existing report, model or pipeline setting was altered. The screenshots are desktop Chrome and viewport emulation, not physical-device or exhaustive workflow-state coverage. Gameplay was not changed; the prior game-check/build results belong to their respective gameplay tasks and were not rerun for this Laravel-only UI change.
