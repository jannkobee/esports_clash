# Fontessa pass: manual aim, CS-style recoil, signs, outskirts and HUD (2026-11-16)

Owner request (Fontessa first, Spillway deferred): fill bare map spots, better HUD, fix upside-down/mirrored signs and add detail, and make gunplay CS-like: no head tracking, attribute-driven manual aim, crisp recoil with consistent AK and Deagle spray behaviour.

## Gunplay (`src/fps/fpsLiveGunplay.ts`)

- **Manual aim.** The view no longer eases continuously onto the head. `stepLiveManualAim` moves a crosshair in submovements. A ballistic flick (gain around 1, so overshoot and undershoot happen) is followed by corrections every 60–150 ms, gated by reactions. Each movement's endpoint noise grows with its size and shrinks with flicking/precision; pressure adds shake by composure. Moving targets are followed only partly (tracking), so the crosshair lags. The first movement waits for part of the reaction time. The intended point stays head or chest by existing skill rules, and the trigger is pulled when the crosshair is within the target's angular size × a precision-based tolerance (impatient shooters fire off-target).
- **Recoil.** Fixed cumulative spray patterns (`liveSprayOffset`). The AK climbs about nine shots straight up, then swings left, then right; M4, budget rifles, SMGs and the Negev use scaled versions. Pistols have per-shot kicks; the Deagle has one heavy punch, slow recovery and a spam inaccuracy penalty (`liveSpamInaccuracy`). The bullet receives the pattern minus the shooter's learned pull-down (`liveRecoilResidual`: 12–92% by recoil control, varied by consistency). The pattern resets after the trigger is released (`recoverLiveSpray`). The old continuous auto-compensation is no longer used by the live simulation (`fpsLiveWeapons.ts` helpers remain for existing tests).
- **Measured** (seed 777, 9,000 ticks): Rifling 90 vs 35 → 15 kills to 1, 52% vs 25% hit rate; 42–50% of skilled hits are headshots versus 9–13% for weak aim.

## Map and signs

- `paintedSign` (`fpsLiveScenery.ts`) mapped the text texture onto every face of a box, so it showed mirrored on the back and sideways/upside down on edges (the reversed JADE LANTERN). Signs now have a plain backing board plus separate, correctly oriented front and back lettering planes. The canvas uses the sign's real proportions (no stretching), with inset borders, a shadowed fitted font and light weathering. Each sign has its own backing material, so batching does not merge it.
- The outer village houses (`fpsVillageArchitecture.ts`) were plain boxes with one row of flat windows. The faces seen from the map now get the village facade: shuttered windows, door surrounds, quoins, stringcourse, eave cornice, footing and rain pipe. Far faces stay plain to bound geometry. The open ground uses tiled grass and the outer roads tiled paving instead of flat colours.
- The `banana-north` festoon (market arch) ended 20 cm off the `east-container` corner, so its anchor floated. It now runs at z = 7.65; all festoon anchors are within 4 cm of a wall.

## HUD (`FpsLiveBroadcast.tsx`, `fps-live-broadcast.css`)

- The free-cam hint moves below the pause banner while paused (they overlapped).
- The observer card no longer overflows its 88 px height. The name line holds a compact role badge (identity text is in the tooltip). One context row shows live comms, or otherwise the IGL style and call response. Numeric tendency chips are removed from the broadcast (still in the tooltip). Name, weapon and action lines truncate with ellipses.

## Verification and limits

New `src/fpsLiveGunplay.test.mjs` (5 tests). Pro regression 16/16, and 132/132 across combat, village, tactics, autonomy, brain, muzzle, mechanics-learning, decision-polish and performance suites. TypeScript and production build pass. No browser or GPU review was possible here: sign readability, facade look and HUD layout need checking in the live view. Spillway was not changed in this pass.
