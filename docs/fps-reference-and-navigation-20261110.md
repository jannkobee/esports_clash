# FPS reference, specialties and watchable simulation (10 November 2026)

## Owner request and scope

The owner supplied FPS role/stat examples and a draft five-category personality taxonomy, asked for current FPS Hexapedia content, a Settings simulation launcher, and fixes for blank Settings/Hexapedia pages. `/root` owns the reference, scouting presentation, routing and API-list projection changes in this pass. No adjacent asset stage is active. MOBA remains preserved and owner-disabled; previous reports and frozen assets/ML evidence remain immutable.

## Implemented behavior

- Seven scouting specialties use familiar FPS jobs: Entry Fragger, Shotcaller, Sniper, Utility Support, Lurker, Site Anchor and Trade Fragger. Player rows show primary and secondary fits from the seven existing stored skills. `fpsRoleFit.ts` publishes the weights and descriptions. These are scouting fits; the whole lineup still determines legal round assignments and the caller remains a separate responsibility. Lurker is explicitly a scouting specialty pending a full independent controller.
- All 30 existing personality IDs receive FPS display names and one of Leadership & teamplay, Aggression & openings, Tactics & preparation, Mentality & momentum, or Economy & round decisions. The draft's names inspire the presentation, but unimplemented triggers/stat bonuses are not claimed. Preference values, mood formulas and decision mechanics remain unchanged. Historical MOBA definitions stay available.
- Native Hexapedia pages at `#hexapedia/fps`, `/roles`, `/personalities`, `/weapons`, `/equipment`, `/maps`, `/attributes` and `/rules` include search, category filters, detail links and missing-entry recovery. Content reads the actual FPS registries: seven roles, 30 traits, 12 weapons/equipment items, five maps, seven stored attributes and four rule entries. Global search includes these entries even when the world API is unavailable.
- The first Settings card links to `#fps-simulation`, reference pages and owner Game-mode settings. The public simulation room requires no account: choose a map and seed, launch a deterministic local match, watch automatic 4x playback, pause/scrub/choose rounds through 16x, or download the JSON report. It reuses the actual engine/replay and existing fictional equalized rosters; it does not settle fixtures, alter club funds or write careers. Laravel's Game modes page also links to the viewer/reference.

## Blank-page diagnosis and fixes

A settled-data browser run reproduced `(world.decisions ?? []).slice is not a function`. A keyed Laravel collection was reaching a client that expected an array. The earlier fast navigation check missed the crash because it moved on before World Desk loaded.

`WorldSimulation.php` now projects decisions and upcoming fixtures through `values()->all()`. `apiCollections.ts` normalizes arrays and keyed record collections at World Desk, world activity and Hexapedia list boundaries. `displayMetrics.ts` converts nested operational metrics to readable scalar values rather than passing objects to React. Settings uses a compact, separately bounded World Desk, below the visible simulation launcher.

Leaving a match clears the arena layout state when navigating to Settings or Hexapedia. `RouteErrorBoundary` supplies an error message, retry and working navigation if another rendering failure occurs, and resets on hash navigation. The root route and optional World Desk have separate recovery boundaries. This does not claim every possible malformed backend record has been schema-validated.

## Files

Web: `src/fps/fpsRoleFit.ts`, `fpsPersonality.ts`, `fpsReference.ts`, `src/hexapedia.ts`, `apiCollections.ts`, `displayMetrics.ts`, `authNavigation.ts`, `App.tsx`, `AppRouter.tsx`, `components/FpsHexapediaPage.tsx`, `FpsSimulationLab.tsx`, `FpsPlayerRole.tsx`, `FpsMatchView.tsx`, `RouteErrorBoundary.tsx`, `Hexapedia.tsx`, `WorldDesk.tsx`, `WorldActivity.tsx` and associated CSS/tests.

Laravel: `app/Services/WorldSimulation.php` and `resources/views/evolution/game-modes.blade.php`. These are read/presentation changes; no migration, data reset, mode toggle or worker rebuild/restart was required. Development source mounts serve the changes.

## Verification

- `npm run check:game`: 655 passed, 22 skipped; all three additional simulation checks passed.
- `npm run build` and TypeScript project build passed.
- Six reference/role/routing/collection regressions passed. The full suite includes the existing personality, engine, replay and worker tests.
- `php artisan test --compact --filter='GameModesTest|WorldVoicesTest|LivingWorldEngineTest'`: 40 passed, 1,311 assertions. Changed PHP service passed syntax validation.
- `infrastructure/online/verify-fps-reference-browser.mjs` uses a fresh isolated Chromium profile and a mocked private identity, blocks private/mutation requests and reads actual public data. It waits for settled Settings data, clicks the actual Hexapedia/Settings sidebar buttons, checks all eight native FPS routes and a personality detail, launches autoplay from Settings, and checks 390px mobile layout. No app render exceptions or horizontal mobile overflow occurred. Screenshots/results are retained in `.local-tools/fps-reference-review-20261110/`. A container-only Vite HMR websocket limitation is recorded separately from app errors.

## Remaining limits

This delivers current tactical FPS reference and a working local spectator entry point. It does not qualify first-person 3D rendering, an independent lurk controller, physical recoil/reload, FPS-trained ML, competitive map balance or production-scale simulation. The seven real stored skills are retained; utility/positioning are described through their actual contributing skills rather than invented trained ratings. Existing simulation v2 deployment evidence is in [the previous report](fps-tactical-v2-20261110.md). All Colab-only visual processing and historical MOBA gameplay constraints remain protected.
