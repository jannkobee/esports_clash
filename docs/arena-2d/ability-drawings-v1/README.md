# Painted roster and ability live trial

Owner request: “can you hook it up to the live match and draw also the abilities.” This explicitly authorizes the limited live illustration presentation, superseding the prior static-gallery-only note. `/root` owns avatar/ability presentation, snapshot/replay attribution, spectator portrait/icons and this evidence. No delegated agents.

## Artwork

Built-in imagegen produced **46 distinct new PNG sheets**: four cells for each of the 45 current original identities (180 P/S1/S2/R illustrations), plus Mirelle's ten named fabric patterns. `manifest.json` records every exact prompt, prompt hash, source path, source-design hash, PNG hash, dimensions, alpha and cell rectangles. Individual receipts retain original generated-image paths. PNG pixels were not modified. UV insets keep neighboring cells out of the game/HUD view. Review/download: `/art/ability-drawings-v1/index.html`.

All 45 previous character drawings retain their hashes. `avatar-drawings-v1/live-bounds.json` records alpha bounds measured read-only at threshold 96 with three pixels of padding. `paintedRosterArt.ts` supplies paths, proportions and presentation heights. Characters with companions keep their complete illustration; the companion is not a new simulation unit.

## Live behavior

`PaintedRoster.ts` loads and shares only selected-match textures/materials. It anchors the complete illustration at the ground, uses alpha/depth, preserves equipment asymmetry, and samples breathing, movement tilt, hit/cast recoil and a held death/fade from snapshot time. Death rotation stays above the floor; respawn resets the pose. No joint animation, mirrored substitute facing or authored walk cycle is claimed. All drawings have one authored direction; a team-colored ground arrow shows actual facing. The previous Mirelle atlas remains preserved, while this requested live pass uses the new roster illustration consistently.

`PaintedAbilities.ts` decorates attributed projectiles/impacts, existing constructs and committed casts with small painted tokens. `BabylonEffects.ts` retains the actual lines, circles, shapes, direction and safe-gap geometry. Tokens do not define hitboxes or expand ranges. Disabled/unarmed objects dim. The ten Mirelle pattern cells resolve from actual construct kinds. The passive cell supplies the HUD icon and a thematic owner motif for basic projectiles/constructs without a known cast slot; it does not announce a passive proc. Unattributed effects keep generic geometry. This is a token/illustration VFX pass, not 180 bespoke animated spell sequences.

`MatchViewer.ts` copies source ownership and slot tags from actual projectiles/spells and same-tick V3 commit events, plus short committed-cast cues. No nearest-caster inference is used. Delayed constructs without a matching retained commit use their owner's generic motif. Replay version 2 keeps optional art/cue fields, validates/freezes them and continues accepting older recordings. Old recordings lacking ownership tags show their existing geometry.

`SpectatorRoster.tsx` uses the new portrait illustrations and P/Q/W/R artwork with actual cooldown/lock text. Existing compact mobile HUD behavior still hides its ability row; the artwork gallery is accessible on mobile. The restored valley, combat/AI/RNG, collisions, tower rules/attribution, all-three-barracks order, player aliases, frozen ML artifacts and 3D release rows are unchanged.

## Verification

- Full `check:game`: 558 passing unit tests, 22 existing deleted-asset skips, three deterministic simulation checks, design validation and TypeScript. Production build passes with existing chunk/timing advisories. See `game-check.log` and `build.log`.
- `paintedPresentation.test.mjs`: all 45 fixed paths/UV bounds, ten pattern mappings, unknown/prototype-name handling, deterministic pause/seek/death, actual-owner/cast attribution, immutable replay and invalid future cue rejection.
- Actual Vite browser at port 8788: nine renderer batches cover every identity (ten actors / five distinct avatars per batch) and all 180 cells; Mirelle's ten additional cells also load. Frozen source snapshots remain unchanged. Death/respawn, forced context restoration and disposal pass. The real StrictMode live component loads ten sprites, 40 HUD icons and actual projectile/device art. A manually requested legal Mirelle Pin produces a correctly attributed construct and commit cue. The unchanged paused engine fingerprint survives rendering. Presentation replay opens with ten sprites and 5.5 seconds of recorded frames. Desktop/mobile screenshots were inspected; no uncaught exceptions. See `live-browser.json`, `live-match.png`, `live-mobile.png`, `renderer-fixture.png`.
- Gallery decodes all 46 PNGs / 190 cells, with no mobile overflow or exceptions: `gallery-browser.json`, `gallery.png`.

These are short engineering/visual fixtures. Full-match device performance, eight directions, articulated attacks/casts, contact transitions, per-spell choreography and final artistic qualification remain open. Sprite live authorization does not qualify the failed 3D candidate. Port 8088 did not respond during verification; no unrelated services or frozen workers were restarted. Source-mounted frontends consume the default Babylon renderer changes; no simulation worker/catalog cutover is required for renderer-only files.

Repeat from `EsportsClash.Web`: `node scripts/verify-painted-live.mjs` and `node scripts/verify-ability-art-gallery.mjs`, with `BABYLON_CHECK_URL` set to the frontend and isolated Chrome CDP on 9238. Package metadata/gallery with `python scripts/package-ability-art.py` from any directory.
