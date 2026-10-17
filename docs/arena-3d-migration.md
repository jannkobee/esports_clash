# Live 3D arena foundation — 2026-10-17

The requested Wild Rift-inspired direction now has a live Three.js view. It is an original procedural prototype, not a finished character-art conversion or a new combat engine. The existing fixed-step match remains authoritative on its 2600×760 ground plane; elevation is presentation only.

## Implemented

- The default spectator view uses a tilted orthographic camera, lit mesh champions, minions/summons, neutral monsters, dragon, towers, barracks, Nexus, wells, rocks, brush, trees and wards. Role, authored avatar colors and stable ID variations determine champion silhouettes. Models share cached geometry/materials; static props use instancing.
- Rocks and brush use the real gameplay layout. Decorative trees sit outside playable ground. No visual mesh introduces collision, alters range or provides vision.
- Attack/cast poses, walking bob, knockup elevation, recall rings, shield/stasis rings, control markers, generic projectile meshes, circular/rectangular spell footprints and black-hole discs read current simulation state. Simulation time controls animation, so pausing freezes it.
- Canvas draws projected HP/mana bars, fictional player aliases, camp labels, floating combat text and a responsive minimap. Existing DOM roster, insights, items, event feed and playback controls remain available.
- Drag, touch, wheel/pinch zoom, automatic action follow, portrait focus and minimap navigation operate on the tilted ground plane. Default action zoom is 2×. Portrait screens retain vertical camera scale and crop horizontally so actors remain readable.
- The **3D arena / 2D tactical** button switches presentation during a match. The full existing Canvas renderer remains available, with the original flat Three underlay while healthy. Missing WebGL, context loss or render failure selects Canvas fallback; context restoration recovers 3D.
- One lazy-loaded WebGL renderer, the existing RAF, a 2× DPR cap and ResizeObserver remain in use. Cached/pooled and instanced resources, event listeners, observer and context are released on unmount.

## Verification

`scripts/check-arena-3d.mjs` mounts the actual live arena in an isolated browser with seed 47 and identical card/avatar lineups. It holds fixture RAF only until the real Pause control commits, then advances the existing opt-in evaluation stepper. It does not add a production debug prop or substitute a second simulator.

- 3D and 2D captured-world fingerprints, RNG and execution/opportunity audits match at exactly 900, 1800 and 2700 ticks (30/60/90 seconds).
- View switching and camera controls preserve paused simulation state. Desktop, laptop and portrait layouts align WebGL and HUD surfaces without horizontal overflow. Real `WEBGL_lose_context` loss/restoration selects fallback and recovers. Unmount removes the surface and disposes resources.
- Focused tests exercise camera projection/pan correspondence at desktop/portrait aspects and supported zooms, clamping, frozen-input reads, effect reuse, actor removal and instanced/shared resource disposal.
- Evidence: [browser results](arena-3d-verification.json), [desktop](arena-3d-desktop.png), [laptop](arena-3d-laptop.png), [phone](arena-3d-mobile.png). These are controlled fixture checks, not full-match or physical mobile-device performance measurements. Draw calls/triangles are snapshots, not FPS claims.

## Remaining work

The view uses simple procedural models and generic spell footprints. It does not yet reproduce every avatar's unique anatomy, transformation, animation, shield, channel, projectile trail or authored spell telegraph. Canvas retains the richer per-avatar effects and its atmospheric spectator fog; that fog treatment has not been ported to 3D. Actual targeting/vision, damage, buffs and ability timing still come exclusively from the same simulation. The 2D switch is available for detailed tactical inspection.

Wild Rift-level polish needs original authored models, textures, rigs, animation clips and effects, plus asset loading/LOD and measurements on real devices. No Riot assets were copied. Full-match rendering/performance and all 45 avatar/ability combinations remain to be checked.

The ML candidate remains offline after its failed benefit gate. This rendering change is not ML progress or a training change. The previous broad study's source freeze describes its historical collection and must not be rewritten to cover these later renderer edits.
