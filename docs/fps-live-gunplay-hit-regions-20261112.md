# Local FPS gunplay ray and hitbox alignment — 12 November 2026

## Change

The local live exhibition had three different definitions of a shot: vision used a height-aware 3D segment, bullets used a horizontal 2D ray against rectangular walls, and a body-cylinder hit received a random headshot roll. That allowed visible targets to be blocked by geometry that was not on their rendered line, and meant the tracer did not represent the damage calculation.

`fpsLiveBallistics.ts` now builds a yaw/pitch ray and intersects it with separate actor head and torso volumes based on the proxy model's standing, crouched and jumping heights. The first model region intersected decides head versus body damage. Weapon spread and aim error still affect the shot direction, while headshot classification is no longer randomized after a body hit. In the combat view, AI pitch points at the observed head and the first-person camera follows that pitch.

`fpsLiveMap.ts` now traces the same 3D wall segment for sight checks and firearm collision. Standard solids respect their actual height. B fountain's square box is replaced for sight/projectiles by its round stone base, annular shell/rim, and tiered solid centre. This lets head-level shots clear the rendered basin lip, keeps shots from passing through the visible central stonework, and removes false blocks at the square corners. Actor movement retains its existing conservative rectangular footprint.

`LiveShot` records its resolved impact endpoint, target and hit region. `fpsLiveViewer.ts` renders both first-person and world tracers from this exact shot record, ending at the hit region or first opaque obstruction. Friendly fire and the separate learned rifle cadence remain unchanged.

## Verification

- Focused tactics and tracer tests: **44 passed, 0 failed**. Coverage includes low-cover height, fountain rim/corner/centre intersections, head versus torso hits, direct headshot damage and the exact resolved tracer path.
- `npm run check:game`: **806 passed, 22 skipped, 0 failed**; all three batch match simulations and TypeScript passed.
- `npm run build`: passed (`tsc -b && vite build`, Vite build 3.12s). The repository's existing warning for chunks above 500 kB remains.
- `git diff --check`: passed. Git reported existing CRLF conversion notices for unrelated working files.

## Scope and limits

This changes only the browser-local FPS exhibition; official/historical matches, MOBA, player identity, career progression, learning storage and Colab asset processing are untouched. It improves agreement among AI sight, shot collision, headshot classification and tracer endpoints, but it is not Counter-Strike 2 engine parity. The avatar proxies and fountain remain game-specific scene geometry. Browser-rendered visual acceptance and competitive balance qualification were not performed.
