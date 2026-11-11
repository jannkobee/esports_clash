# Live FPS presentation, utility, and round pacing (11 November 2026)

The owner requested responsive play, better CT/T character animation, spreading smoke and incendiary grenades, lethal bomb detonation, weapon-specific HUD silhouettes, a real buy period, post-round movement, a clearer third-person camera, and simpler controls.

## Changes

- **Frame recovery:** `FpsLiveBroadcast.tsx` now runs at most eight fixed simulation steps per animation frame and captures at most two full snapshots for interpolation. It retains the simulation backlog rather than running a long catch-up loop on the main thread. The Babylon renderer targets near CSS-pixel resolution on high-DPI displays, reduces the shadow map from 1024 to 512, and leaves the secondary bomb camera off by default.
- **CT/T movement presentation:** `fpsLiveViewer.ts` now uses shoulder, head, arm, hip, and leg pivots. Crouch transitions bend and lower the operative smoothly without compressing the leg geometry. Walking phase follows actual travel, including backward movement and strafing. Reloads animate the third-person support arm, gun angle, and a moving magazine; first-person reloads animate the viewmodel hand and magazine. CT tactical armor/helmet and T jacket/harness/mask silhouettes remain distinct proxy designs.
- **Grenades:** Smoke grows to a 4.8 m radius over 1.8 seconds and lasts 18 seconds. Support players can buy smoke and one incendiary item. T incendiaries are labeled Molotov; CT items are labeled incendiary. The fire zone spreads to a 4.2 m radius over 1.25 seconds, lasts seven seconds, and deals 38 damage per second to opponents in its current area. Smoke/fire radius is shared by the simulation, minimap, and renderer.
- **Bomb:** At detonation, living players within 16 m receive linear distance falloff from up to 500 damage, with reduced damage through walls and armor. Victim elimination appears in the killfeed with a C4 silhouette; the 3D viewer shows an expanding flash and ground ring.
- **Buying and intermission:** Team buys are planned together, then each player's weapon and equipment are applied at staggered points during the 15-second freeze phase. The HUD labels this period. After a round, surviving players continue moving around the map and can recover a better dropped primary weapon during the seven-second break.
- **Camera and controls:** Third-person framing is closer to the shoulder and aims nearer the operative so the player and carried weapon remain in view. Camera shortcuts remain in the focus card. The toolbar keeps pause, new match, more, and exit; PIP, pop-out video, diagnostics, and fullscreen are grouped under “More.”

## Limits and verification

The actors remain collision-volume proxy meshes, not production character models. The procedural pivots improve this local viewer only; model generation, rigging, and animation processing remain subject to the existing Colab-only asset workflow. No per-device FPS profile or visual qualification was performed. Bounded recovery prevents large catch-up batches from monopolizing a frame, but a device that cannot sustain the simulation workload can still accumulate clock backlog. Automated tests were not run. `npm run build` passed (`tsc -b` and Vite); Vite reported the existing large-chunk warning.

Affected code: `EsportsClash.Web/src/components/FpsLiveBroadcast.tsx`, `src/components/fps-live-broadcast.css`, `src/fps/fpsLiveSimulation.ts`, `src/fps/fpsLiveViewer.ts`, `src/fps/fpsLiveWeapons.ts`, `src/fps/fpsLiveEconomy.ts`, `src/fps/fpsLiveGrenades.ts`, and `src/fps/fpsBroadcastDirector.ts`.

Preserve official and historical paths, private DNA, aliases, careers, MOBA, the Colab asset gate, collision-authoritative gameplay, and the current map/tactical planning work.
## Local FPS audio and animation correction (11 November 2026)

The live exhibition now generates weapon-family gunshots and walk/run/crouch footsteps with a separate WebAudio engine. Sounds pan and attenuate from the currently followed operative; the sound toggle is available in More and in the floating PIP, and its preference is stored locally. These are synthesized effects rather than recorded samples. Shot/step cues are emitted from the simulation without changing its seeded decisions or AI hearing.

Grenade wind-up now lasts 0.20 seconds before its existing ballistic arc begins, aligned with the visible throw release. CT/T proxy legs now have separate upper/lower segments and flexing knee pivots; the gait follows travel distance and side-step speed. Arm strafe values are assigned each render rather than accumulated, eliminating progressive arm twist. This changes presentation only.

Affected files: `src/fps/fpsBroadcastAudio.ts`, `src/fps/fpsLiveSimulation.ts`, `src/fps/fpsLiveGrenades.ts`, `src/fps/fpsLiveViewer.ts`, `src/components/FpsLiveBroadcast.tsx`, `src/components/fps-live-broadcast.css`, and `src/components/FpsSimulationLab.tsx`. `npm run build` passed (`tsc -b && vite build`, 3.22s) with the existing large-chunk warning. Tests and in-browser listening/pose review were not run; the synthesized cues and proxy rigs are not qualified production assets.

