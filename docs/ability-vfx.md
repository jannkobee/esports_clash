# 3D ability animations — 2026-10-17

**User request:** "please make a better ability animations right now it only has circles on the ground."

The live 3D scene now uses spell metadata to render moving effects above its ground footprints. Previously it reduced every spell to a disc/ring or flat box, and every projectile to a stretched sphere. This revision changes presentation only.

[Four-second WebGL animation preview](ability-vfx-preview.webm) · [Representative effect sheet](ability-vfx-preview.png) · [Live desktop arena](ability-vfx-arena-desktop.png) · [Live phone arena](ability-vfx-arena-mobile.png)

## Rendering

`EsportsClash.Web/src/threeAbilityEffects.ts` implements pooled geometry effects with thirteen visual families plus a generic impact fallback: slashes, lightning, fire, frost, wind, earth, roots, healing, gravity, beams, smoke, musical waves and barriers. Existing `AVATAR_ANIMATION_MOTIFS` supplies all 45 heroes' general vocabulary; explicit spell-event types take priority. These are shared families with event-specific behavior, not 135 individually authored spell animations.

- Melee crescents sweep and fade; fragments scatter upward/outward. Lightning flickers deterministically along segmented paths. Beams have colored envelopes and narrow bright cores.
- Fire tongues wobble, frost/earth shards erupt, curved roots grow with leaves, healing crosses rise, smoke drifts, musical waves expand, and vortex arcs revolve around a dark core. Existing warning events draw range and progress outlines before impact effects.
- Arrows/darts/feathers have directional shafts/tips and afterimages. Energy bolts trail, shuriken spin, boulders rotate, hook tethers connect to their caster, tornadoes spiral, nature bolts carry leaf shapes, flak shells travel, and boss breath streams flames. Positions/directions come from real projectile inputs; visual trails do not add collision or lifetime.
- Arsenaldo's ten invoked spells read the actual `kaelenCast`, kit delay and `kaelenCastPosition`. The growing snowball follows the real growing collision radius; advancing spells follow their actual travel. Solar Meteor descends during its actual warning delay and erupts after that delay; zone and support visuals use the existing lifetime. No second spell simulation or inferred damage event is added.
- Channels check current live caster state: Black Hole, Broadside Waltz, Cyclone Dance and Court of Branches stop on expiration/interruption/death. Spins follow current caster position, and named tethers follow live endpoints. Broadside's forward boundary uses the existing 260-unit reach and `forward * .55 + 24` lateral rule. This only draws the rule; it does not resolve hits.
- Circular and rectangular footprints remain thin outlines of the supplied dimensions. Decorative particles do not define targeting, range, timing or damage. The redundant older Black Hole status disc is removed in favor of its channel-bound effect.

`threeArenaScene.ts` passes borrowed projectiles, spells, simulation time and unit references to this renderer. `ArenaSceneFrame` now declares the metadata already supplied by the live arena. `AramMatchView.tsx` and all gameplay producers are unchanged. The existing 2D renderer/fallback retains its own effects.

Animation is a function of simulation time, remaining spell duration and current unit state. Pausing freezes it and replaying identical input reproduces it. No match RNG, damage, AI, stats, movement, collision or fixed-step updates are written by this module. No live world references are retained after the frame.

Geometry/material resources and effect nodes are cached. Glow is instanced by shared geometry, with per-instance color/fade; normal smoke, roots and rocks retain ordinary alpha rendering. Instance buffers grow to a power-of-two capacity only when needed, dispose replaced buffers, and reuse them afterward. Hidden pool resources remain reachable by the existing renderer's disposal traversal. An empty frame hides pooled effects and clears active instance counts.

## Verification

`npm run check:game` passes 375 game tests, three deterministic simulation tests and TypeScript. `npm run build` passes with the existing large-chunk advisory. `threeAbilityEffects.test.mjs` covers all 45 motif mappings, explicit event precedence, frozen-input reads, deterministic repeated frames, resource reuse/expiry, glow batching, the ten invoked spells' precise runtime footprint, warnings without premature impacts, channel cancellation/death and moving spin placement. `threeArenaScene.test.mjs` checks the integrated pool/lifecycle.

`scripts/check-ability-vfx.mjs` renders twelve representative fixtures using the actual effect module and a real GLB as a scale reference, recording the PNG and four-second WebM above. It is a controlled review fixture, not twelve simulated fights or a performance benchmark. `ability-vfx-fixtures.json` records its counts.

`scripts/check-arena-3d.mjs` requires all ten live actors to load their GLBs and compares 3D/2D captured full state, RNG and execution/opportunity audits at 30/60/90 seconds. All match. View switching, paused-state preservation, mouse/touch pan, minimap, desktop/laptop/phone layouts, real WebGL context recovery and disposal pass with no runtime exceptions. See `ability-vfx-arena-verification.json`, the arena screenshots, game/build logs and `ability-vfx-final-verification.json`.

Effects are geometry-based, without painted particle flipbooks, postprocess bloom or individually polished skeletal casting clips. Not every special ability has a bespoke 3D effect, and the full 45-avatar ability matrix/full-match/device frame times remain unmeasured. All current tower/well/Nexus risk and legality, normal retreat, attribution, objective rules, anti-oscillation, aliases and failed/offline ML gates remain intact; prior frozen evidence is preserved.
