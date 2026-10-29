# Visible live ability effects ? 2026-10-24

Owner request: ?make their ability effects. Right now I can't see it.? `/root` owns this stage; no delegates or adjacent active stage owners. This is a code-native animation pass using the existing all-avatar/ability PNGs. No image pixels or historical/frozen artifacts were changed. The original painted valley remains restored.

## Result

The former 10?30-unit symbols were easy to miss against the terrain. Ground-centered billboards also clipped below the floor, and V3 damage resolutions lacked dedicated hit effects. The renderer now supplies bright emissive trail cores/heads, thick beams, expanding impact rings and sparks, elevated cast starbursts, moving beads along actual construct segments, bounded field pulses and device stems/beacons. Atlas accents are larger and lifted clear of the floor; cast accents are above the characters. Twelve palettes cover the 45 current identities. This is shared animated geometry with unique existing painted accents, not 180 individually choreographed spell animations.

- [Animated VFX fixture](animated-effects.webm), [fixture screenshot](animated-effects.png).
- [Actual live match hit](live-hit.png), [focused replay of that real match snapshot](live-hit-focused.png).
- [Browser results](browser.json), [full game checks](check-game.log), [production build](build.log).

The video uses deliberately isolated effects to make trails, impacts, line motion and field pulses easy to inspect. The live evidence uses the actual StrictMode match component, normal V3 AI and damage callbacks with only the existing initial combat-position fixture. At 3.833 seconds, Mirelle's S2 resolves a real hit; it is copied into the presentation buffer and a parsed replay with identical effects. Browser context recovery, texture readiness, pause/input immutability, decoded video seeking, unchanged engine fingerprint during rendering, and cleanup are checked with zero uncaught exceptions. The original small-token-only implementation was insufficient; this pass supersedes that visibility result.

## Files and boundaries

- `src/match-viewer/abilityEffectPlan.ts`: deterministic bounded plan (up to 600 cosmetic primitives, first 160 effects/128 constructs), palettes and actual-footprint choreography. Expired devices are omitted, unarmed/disabled devices do not animate active pulses, moving beads stay on the recorded paths, rectangular safe strips remain marked.
- `src/match-viewer/AbilityWorldEffects.ts`: scene-owned reusable emissive tubes/spheres, terrain height and disposal. `BabylonEffects.ts` connects the new layer alongside exact outlines; `PaintedAbilities.ts` fixes atlas size/placement. `BabylonMatchViewer.ts` exposes world mesh counts for verification.
- `src/components/AramMatchView.tsx`: successful V3 champion/shield/battlefield damage creates a separate bounded cosmetic hit record with actual owner, slot, origin, target and match time. Its own serial does not consume RNG. This buffer is excluded from authoritative checkpoints and cleared on checkpoint restoration; old hit records are filtered by snapshot time.
- `ArenaFrame.ts`, `MatchViewer.ts`, `ViewerReplay.ts`: optional read-only owner/hit-origin metadata; finite geometry validation and immutable replay copies. Ordinary spell attribution uses `visualSourceUnitId`, preserving existing gameplay `sourceUnitId` behavior. Missing attribution stays generic.
- `src/abilityEffectPlan.test.mjs`: deterministic pause/seek, actual-segment motion, projectile heading, expiry/arming, circular bounds, safe strips, real-hit capture/replay, invalid geometry and resource budget. `scripts/verify-ability-effects.mjs` repeats browser evidence on Vite with isolated Chrome CDP port 9238; set `BABYLON_CHECK_URL=http://127.0.0.1:8788`.

## Verification and limits

`npm run check:game`: 562 passed, 22 existing deleted-asset skips, zero failures; all three simulation checks pass. Design checks and TypeScript pass. `npm run build` passes with the existing large-chunk advisory. Chrome runs show ten live illustrations, seven visible atlas accents and 29 world meshes at the sampled real hit. These counts describe that snapshot only.

No gameplay damage/legality, RNG, strategy/ML rewards, tower risk/attribution, all-three-barracks order, collision/map geography, aliases or asset publication state was changed. Existing fresh avatar/ability PNGs retain their previous hashes in the v1 manifests; failed Mirelle 3D remains unpublished and deleted avatar binaries stay deleted. The previous all-45/190-cell decode evidence remains in `../ability-drawings-v1/`; this pass adds focused motion/live-hit evidence rather than repeating full art qualification. Full natural-match visual review, low-end/mobile performance, every kit's bespoke choreography and directional/joint character animation remain unqualified. No online worker rollout or historical replay re-simulation was performed; older recordings render their existing events without inventing absent hits.
