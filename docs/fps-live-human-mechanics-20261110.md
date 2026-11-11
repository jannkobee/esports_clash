# Live exhibition v4: human handling, knives and A-site collision

On 10 November 2026 the owner requested more human-like mechanics, additional map detail, knives and bug fixes, with https://www.youtube.com/watch?v=MFenWTrbNWA as reference. The owner then identified the red/orange A-site wall allowing shots through it. `/root` owns this implementation and verification; no agents or avatar asset-processing stages were dispatched.

New browser-local exhibitions identify as `hexatrick-live-exhibition-v4` on `breakwater-live-v4`. Official contextual FPS v3, historical workers/replays, private DNA, idempotent careers and preserved owner-disabled MOBA remain unchanged. No deployment or asset qualification is implied.

## Mechanics

- Aim follows a position sampled by the actor's own vision sensor, rather than reading perfect opponent coordinates for tracking every physics tick. Acquisition reaction varies deterministically from 0.85 to 1.20 times the skill/pressure/exertion baseline. Nearby opponents behind the actor no longer bypass the forward vision cone. Hearing and team reports still provide uncertain awareness rather than direct target acquisition.
- Each actor retains its purchased gun and exact ammunition while equipping a permanent Dock knife. Known quiet long route segments away from sites can prompt knife travel at 4.65 m/s. Contacts, recent damage, angle checks and approach geometry prompt the gun; there is no query for unseen opponent proximity. Draw times are 0.30 seconds for knife, 0.45 for pistol/SMG, 0.65 for rifle and 0.85 for sniper. Switching cancels reload/swing and costs real firing readiness; equipment commitment prevents frame-by-frame switching.
- A nearby visible enemy can prompt last-resort knife use when gun ammunition and reserve are exhausted. A swing has 0.16-second windup, 0.80-second cooldown and 1.35-metre blade reach measured to the nearest body intersection. Impact uses current facing and geometry; a target can leave during windup. Walls and allies block the blade. Front/rear raw damage is 45/90 with the existing armor rule. No long-range knife charge or knife headshot roll exists. Knife damage and kills use existing damage/trade/flash-assist/device-drop accounting without inflating bullet accuracy samples.
- Braking/holding no longer injects teammate separation velocity into stationary actors. This prevents unnecessary drift while aiming or channeling. Existing moving queues and collision exclusion remain.
- Dropped guns preserve their exact magazine and reserve, including an empty magazine. Pickups require a clear line through the map, useful remaining ammunition and a draw delay. The old empty-magazine refill/reserve minting and pickup-through-wall paths are removed.
- The final bullet of a burst retains its accumulated spread/headshot damping before the burst counter resets for recovery.

## Map and presentation

The A-site terracotta loggia wall and three columns now belong to `LIVE_FPS_MAP.solids`. Babylon renders these same volumes; pathfinding, movement, bullet rays, knife hits and flash occlusion share them. The old duplicate scenery wall/column boxes were removed. The surrounding route remains traversable.

Long building side elevations gain shutters, window frames, sills, downpipes, plaster patches and stone bases. Flush drain grates add floor detail without movement obstacles. Floating directional signs are mounted to actual walls. Planters move to building facades, the blue tarp sits on existing cargo cover, and stray ground pallet dressing moves inside existing solid footprints. This is not a blanket audit of every older decorative arch, awning, balcony or fountain against three-dimensional projectile geometry; overhead prop collision and flat-plane combat limitations remain.

First- and third-person presentation now show the equipped knife, with snapshot-timed swing/draw/reload poses. Knife swings do not emit a gun muzzle flash or bullet tracer. The observer HUD and killfeed show Dock knife / MELEE. The first-person basis now places the weapon on the right and uses the current camera transform, correcting the previous-frame lag during turns/cuts. These are runtime equipment proxies, not generated characters, rigging or animation assets.

Files: `fpsLiveWeapons.ts`, `fpsLiveSimulation.ts`, `fpsLiveMap.ts`, `fpsLiveScenery.ts`, `fpsLiveViewer.ts`, `FpsLiveBroadcast.tsx` and `fpsLiveTactics.test.mjs` under `EsportsClash.Web/src`.

## Verification and limits

The original eight live tactic tests passed before editing. Fifteen focused tests now cover the original tactical checks plus loggia sight/bullets/blades/flash/movement and route-around behavior; stationary teammate drift; sampled aim/rear vision; knife/gun conservation and draw delay; knife windup/misses/kill accounting; reach/rear damage/ally blocking; and exact pickup ammo/wall exclusion. Paired 9,000-step seeded simulations retain determinism, wall exclusion and public DNA exclusion.

Required `npm run check:game` passed: 677 passed, 22 skipped, zero failures, followed by three simulation tests and TypeScript. Production build passed with a large-chunk warning. Final focused tests and production build were repeated after the last handling/accounting adjustments. Logs: `.local-tools/fps-live-human-check-game.log` and `.local-tools/fps-live-human-build.log`.

The older `.local-tools/fps-live-impact-smoke.mjs` failed because its helper was on the current Apartments collider at (-15, -6), preventing the intended utility throw. The original diagnostic is preserved. The derived `.local-tools/fps-live-human-impact-smoke.mjs` places the helper at (-18, -6), asserts all fixture positions are walkable, and passes opening/overkill/trade/flash/sample/survival/snapshot checks. Shared damage accounting retains the explicitly fired-at target for time-to-damage samples.

Native Chrome inspection observed the local first-person scene and a clock advancing from buy phase to live play. Browser-extension access was unavailable. The later attempt to select the supplied video tab was stopped by Computer Use because it could not verify the browser URL confidently; UI automation stopped. Only the video's title/page metadata was retrieved; no footage-derived timing or frame-by-frame fidelity claim is made. Full camera/knife/A-site visual acceptance, mobile acceptance, competitive balance, sound, physical head hit volumes, crouch/jump/elevation and production character assets remain unfinished or unqualified. No official deployment occurred.
