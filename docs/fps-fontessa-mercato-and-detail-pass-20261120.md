# Fontessa visual pass: Mercato di Fontessa, "glowing" floors, unfinished details and the floating smoke (20 November 2026)

## Request

The owner reported that the Mercato di Fontessa passage (the B sottoportego over the canal stair) "feels so wrong" and looked like it was glowing. They asked for the map's incomplete details to be finished and more detail added, and for the smoke bug to be fixed (a small smoke puff floating at chest height). Other agents had uncommitted simulation and pathfinding work in `src/fps/`, so this pass avoided their files except where noted below.

## What was actually wrong

1. **Box texture mapping was rotated and stretched on four of six faces.** Babylon's default box layout runs U along the height on the ±x faces and along the depth on the top and bottom faces. `liveBoxSurfaceUV` assumed width/height/depth throughout. Every stair tread, deck and slab top therefore showed long "planks". Every east- or west-facing wall had its stone courses standing on end, or diagonal plaster streaks. The canal towpath ground had default 0–1 UVs stretched over 51 m.
2. **Floors glowed.** On Fontessa the sky term lit horizontal surfaces about 1.5 times as much as facades, and the pale paving albedo clipped to near white in sunlight.
3. **The sun shadow map was stretched.** Every caster was fitted, including the 230 m seawall, the far canal palazzi and port markers. So one 1024 px map covered about 230 m (about 0.2 m per texel), and the passage's 6–8 cm rafters aliased into the hatched patches on the floor.
4. **Mercato defects.**
   - A bare flat slab top with festoons floating over it.
   - An arch ring hung under a thin lintel, with pilasters standing 0.4 m above the stair treads.
   - Open slots beside the canal stair that showed the void under the street.
   - A rolling shutter split by the north pier.
   - A pink awning hanging 36 cm off its wall.
   - Fully emissive daylight bulbs.
5. **Smoke.** A smoke is created 1.35 m above its grenade with radius 0.05. Its radius grows linearly to 4.8 m over 1.8 s, shrinks over its last 1.5 s, and HE can cut it to 28 %. Every lobe was offset from that fixed centre in proportion to the radius. A blooming, dissipating or HE-cut cloud was therefore a small ball hanging at chest height.

## Changes

- **Surfaces.**
  - `LIVE_SURFACE_BOX_WRAP` (`fpsLiveGraphics.ts`) is passed at every surface box, in both viewer solid loops and the Fontessa and Spillway scenery helpers.
  - Courts, streets and the towpath have metre-scaled UVs.
  - Paving is a little darker, with per-sett tone variation and some worn stones; stone has slight per-block tone.
  - `LiveSurfaceLibrary.material` accepts a polygon offset for overlay floors.
- **Light and shadows (Fontessa only).**
  - Sky term 0.72 to 0.62 with more warm ground bounce; sun 1.08 to 1.04. Walls stay about as bright and floors drop about 15 %.
  - Scenery meshes outside x ±40 / z ±48, and rods thinner than about 11 cm in two axes, no longer cast shadows; map posts 11 cm or less wide do the same.
  - The canal stair treads use a dressed-stone colour.
- **Mercato gate** (`fpsVillageMercato.ts`, built from `fpsCanalWaterfront.ts`).
  - The stone gateway has piers that reach their footing, including down onto the stair treads. A closed segmental arch with spandrels and soffit carries voussoirs and a keystone; the frieze keeps the `b-passage-lintel-7.87` name.
  - Above it: an astragal, a cornice and the inscriptions "MERCATO DI FONTESSA" (canal side) and "SOTTOPORTICO DEL MERCATO" (market side).
  - Roof terrace: cotto floor, balustrades with geraniums, two lemon trees, a bistro set, and a glazed terrace door on the house wall between its window bays.
  - Inside: timber beams on corbels, joists and planks, a hanging lantern (base 2.39 m), an edicola votiva and soft ambient occlusion on the covered floor and treads. The occlusion's UVs match the street and tread textures, so the setts line up.
  - Retaining cheeks, kerbs and tread nosings for all three canal access stairwells (`LIVE_CANAL_STAIRWELLS`).
  - The striped awning is fixed to its wall under the sills and sized to the shop, with folding arms.
  - The market house's side shop moved north of the gate.
  - The festoon over the gate is lifted (y 4.85, sag 0.36) and the daytime bulbs dimmed.
- **Smoke.**
  - `liveSmokeSettle(radius)` in `fpsLiveBrain.ts` lowers the whole cloud body for radii under about 3 m so it rests on its floor. It is zero at full size.
  - The bounding-sphere reject in `liveSmokeDepth` uses the settled centre.
  - The shader takes the floor clip as a separate `floorLevel` uniform and shades from the settled body (`fpsSmokeRendering.ts`).
  - Bots and the renderer still read the same lobes.
- **Landmarks and buildings** (`fpsVillageArchitecture.ts`).
  - Quoins are bonded courses only 3 cm proud, instead of floating teeth.
  - Campanile: the clock rims now stand in the wall plane (they lay flat as a floating ring). Hour marks, hands and a boss are on four dials. The belfry boxes that cut into each dial are replaced by an open arched belfry stage with its bell, a lifted roof, a spire and a weather vane.
  - Palazzo: raking and base cornices, a recessed tympanum with the comune's arms, acroteria, portico tiles behind the pediment, a piano-nobile stringcourse and flag finials.
  - Courtyard: an inner ring and a 16-point compass rose replace twelve loose inlay sticks.
  - Inn wings and guardhouse: ground-floor windows, with closed louvres or grilles, never swinging into a lane.
  - Stores: a planked door, a barred window, and the meter beside the door (it was drawn over the vent).
  - Pitched clay roofs over the flat cutaway slabs (Mid lookout, its annex, the Jade Lantern), a lean-to over the B-apartments gallery, and a cotto trattoria floor. All roofs are tagged `cutawayRoof`, batched separately, and hidden with the roof cutaway in `fpsLiveViewer.ts`. The flat caps in `fpsMidWindowScenery.ts` were removed, and the Mid belt course now spans the facade.
- **Dressing** (`fpsVillageDetails.ts` and `fpsLiveScenery.ts`).
  - Washing lines over three lanes (`LIVE_LAUNDRY_LINES`).
  - Trattoria interior: wainscot and plaster, a back bar, an espresso machine, hams, pictures and a chalkboard.
  - Arrival kiosk: posters and a painted village map.
  - Barred windows in the palazzo's blank portico bays.
  - Guardhouse: a lantern, a banner and "GUARDIA CIVICA" plaques.
  - Nizioleti street-name boards, inn and osteria names, and "UFFICIO DOGANALE" on the Mid lookout.
  - Fountain: jets, splash rings and overflow streams.
  - Bread stall: loaves, baguettes and a basket.
  - Two pre-existing poke-throughs fixed: the Jade Lantern eave tiles and the drawn awning reached into the dining room.
- **Draw cost.** New props bake their colour into vertex colours over one shared material per surface kind (`fpsVillageTint.ts`). Village scenery batches fell from 551 to 467 while all of the above was added; the whole-world batch ratio is 0.841 (guard < 0.85).

## Preserved (visual part)

- The visual part changed no collision, navigation, terrain or gameplay data, and did not edit `fpsLiveMap.ts`, `fpsLiveTerrain.ts` or `fpsLiveSimulation.ts`. The collision pass below changes collision on purpose; its exact edits to `fpsLiveMap.ts` are listed there.
- Visual pieces sit inside admitted solids, below street level, above 2.2 m, on unreachable roofs, or within the 0.35 m actor radius of a wall. A test enforces this for the gate.
- One intended gameplay-visible effect is in smoke. While a cloud is under about 3 m radius (roughly the first 1.1 s of bloom, the last second of dissipation, or an HE cut), it blocks low lines near its floor instead of chest-height lines above it. Full-size smokes are unchanged.

## Verification

- `src/fpsFontessaVisual20261120.test.mjs` adds five tests:
  - metre-scale UVs on all six box faces;
  - small smokes rest on their floor, with matching sight tests;
  - Mercato dressing never stands where an actor centre can be;
  - every stairwell drop has a cheek or a building wall;
  - scenery shadow casters stay inside the play area, and laundry hangs above head height.
- Scenery, canal, village, Mid window, graphics and render-performance suites pass; the full `npm run check:game` result is recorded in the handoff entry.
- Rendered in headless Chrome (SwiftShader) through a scratch harness served by DevTools request interception, with nothing added to the repository: the owner's three Mercato angles, the A site and Mid angles from their later screenshots, the B site, the trattoria, both spawns, lanes and the overview. GPU frame rate was not measured.

## Collision pass: what looks solid collides, and nothing else does

### Request

The owner asked for the places where bullets pass through solid-looking scenery to be fixed, and for the open items of the visual part to be closed:

- (a) grenades flew through drawn pieces above the collision boxes (roofs, campanile belfry, Mercato terrace, lean-to);
- (b) bodies passed through the Mercato gate piers and the shrine;
- (c) light-theme or night lighting had not been reviewed.

### Method

- **Audit.** `fpsVisualCollisionAudit.ts`, run by `scripts/diagnose-visual-collision.mjs`, builds the scenery unbatched in a CPU scene. It casts seeded lines between walkable stations: lines of fire to targets 0.9 to 1.72 m up, and lob lines from eye height to points 2 to 14 m up, which reach roofs, arches and the belfry.
  - A *shoot-through* is a line that solid drawn geometry blocks but no opaque collider does. Drawn dressing within 5 cm of a collider counts as that collider's surface.
  - A *phantom* is a line whose first opaque hit is a `visual-*` collider while no solid drawn surface lies within 5 cm of the hit point in any direction. Probes run along the axes and diagonals.
  - `--strict` also counts a drawn piece that the line passes before a collider further along stops it.
  - Triangle tests are exact (`Ray` epsilon 0). Babylon's default barycentric tolerance (0.001) had widened an 18 m roof face by about 2 cm.
- **What counts as solid** is now matched on whole name words. The old substring list hid a lot from every earlier audit:
  - every mesh with "market" in its name, through "mark" (all B market buildings, roofs, stalls and the market tree);
  - stone gateposts ("street"), canal palazzo footings ("water") and the Jade Lantern roof ("lantern");
  - chimneys, stringcourses ("ring"), the belfry sills and mullion piers;
  - the palazzo voussoirs, which are named "arch-ring".
- **Shared dimensions** live in `fpsVillageLayout.ts` and are used by both the drawing and the colliders:
  - roof shape (with `verge` and `gableOut`), plus the chimney rule and chimney positions;
  - palazzo portico: columns, capitals, eave and voussoirs;
  - Mercato arch, belfry, pediment and stairwells.

### Results

| | Before (new audit on the earlier colliders, seed 1, 20k + 20k lines) | After (seeds 1 to 10, 30k + 30k lines each) |
| --- | --- | --- |
| Shoot-through | 65 | 0 |
| Phantom | 284 | 0 |

Strict mode, over three seeds of 30k + 30k lines:
- 3,288 lines pass a drawn piece before a collider stops them.
- The drawn hit is a median 9 cm from a collider, and 96 % are within 15 cm, closer to a wall than an actor can stand (radius 0.35 m).
- The few larger cases are listed under remaining limits.

### Colliders

There are 894 `visual-*` colliders (254 before). Fontessa now has 1,233 collision solids.

| Group | Boxes | Built from |
| --- | --- | --- |
| Roofs | 404 | n = max(3, ceil(rise / 0.08)) nested bands, each within rise / 2n (at most 4 cm) of the drawn tile top. Bands run from the eave line up and end 4.9 cm past the gable walls, so the open verge under the tile overhang stays open. Eave strips sit under the overhangs. Each roof also gets its ridge, and chimney shafts and caps by the drawing's own rule (buildings at least 5.2 m tall). |
| Campanile | 153 | Piers, mullions, sills, the eight arch heads as equal-height columns (within 3.5 cm), impost course, cornice, bell (cross sections), headstock, the pyramid roof in 22 levels, spire, and the three stringcourses 8 cm proud of the shaft. |
| Palazzo | 168 | Loggia eave (its old box started 21 cm too low), capitals, the voussoir rings as profile columns within 4 cm (the old spandrel boxes filled the open arch), pediment bands, raking and base cornices, acroteria, portico tiles and roof-end triangles. The space under the portico tiles stays hollow: it is open behind wherever the pediment is wider than the facade. |
| Mercato | 120 | Pier bodies (block movement), plinths and imposts. Spandrels as equal-height columns (m = ceil(rise / 0.06) per side, one shared crown box). Frieze, astragal, cornice and drip. Balustrade plinth, rail, pedestals and every baluster (the gaps stay open). Passage beams, corbels and joists. |
| Other | 49 | Lean-to tile slab and gables (the slit under its front edge stays open), canal stair cheeks, Jade Lantern front piers and eave tiles, trattoria ceiling beams, gallery front cornice, canal balconies, coffin maker's ledge, fontanella (blocks movement) and bridge pilasters. Market stall counter tops, the produce trays and the lookout desk top share their furniture's wallbang. |

Deliberately not collided: cloth, foliage and tree branches, glass, ironwork and balcony bars, festoons, laundry, signs and menus, the 4 cm window heads and 3 cm window panels, and the bistro chairs.

### Penetration

`b-logs`, `west-container` and `b-coffins` no longer have `bulletPenetration`. They read as solid blocks, and a bullet crossed several metres of them.

### Drawing moved onto collision

- Roof tile verge: 20 to 18.5 cm past the gable walls (the shared `verge`).
- Window frames: 1.3 cm closer to the wall (they stood 6 cm proud).
- Mid window stone reveals and lintel reveal: moved back to 4 cm proud (they stood 10 cm out). The firing line through the window is unchanged.
- Mid window civic and CT street door posts and lintels: moved onto the jamb and wall ends, at most 4 cm proud (they stood 8 cm inside the openings).
- B car kiosk: the shopfront arch now stops under the eave (it rose 25 cm through the tiles).
- Earlier in the pass: bridge and footbridge copings, door frames, header and cornice, boundary pilasters, `door()` and `shopBay` offsets, and cornice widths.

### Bodies

- The Mercato pier bodies and the fontanella block movement. The fontanella's basin reached 46 cm from the kiosk wall, so actors stood in it. Nav nodes and sample paths are unchanged.
- The shrine stays inside the wall's actor-radius band, so no actor centre can reach it.
- A test checks that no bullet-only visual collider holds a reachable actor's centre line up to jump height (1.72 m plus the 0.71 m jump apex).

### Grenades, lineups and the learned brain

- Grenades now bounce off drawn roofs, arches, balustrades and the belfry.
- **`guard-market` smoke.** The best solve is a walk throw that clips the east eave of the B market house (the drawn tile corner lies within the grenade's 9 cm padding) and lands 8 cm off. A jump lands 12.5 cm off, and a requested jump still jumps.
- **`restaurant-civic` smoke.** The 0.6 m solve had bounced off the flat collision top of `apartments-south`. With that roof pitched as drawn, the best walk-jump lands 0.81 m off. Authored lineups are test fixtures; live smokes are planned and learned.
- **Committed brain, lineup integration test.** Its `guard-civic` throw now lands on the roof of `apartments-north`, 3.7 cm above the drawn tiles.
- **Committed brain replay**, one throw per practice target with no learning: 20 of 42 succeed without visual colliders, 17 with the earlier colliders and 18 now.
  - Both remaining flips are the same `B:staging0` incendiary and HE walk throw, from (20, -12) to (20, 14). At x 20.04 the grenade's centre meets the Mercato arch face level with the drawn intrados (2.581 m), so it strikes the arch.
  - `B:retake0` incendiary, lost to the coarse `b-screen` eave, is restored.
- **HE practice** masters the drill through the B passage after about 30 throws (16 before), so the practice test now uses 32.

### Performance

The extra boxes made collision queries 40 to 47 % slower. `fpsLiveMap.ts` now lets lines that stay below 2.4 m skip solids that start at or above it. Results and candidate order are identical: the same seeds give the same rounds, events, shots and scores, and the same query counts.

| Measure | Earlier colliders | This pass, before the index | Now |
| --- | --- | --- | --- |
| `sightline`, 60k random pairs | 30.9 us | 49.6 us | 22.9 us |
| `wallIntersections`, 60k random pairs | 51.0 us | 88.8 us | 39.9 us |
| Simulation, 3 seeds x 3,600 steps, mean | | 2.49 ms/step | 1.42 ms/step |
| Simulation p99 | | 24 / 14 / 18 ms | 15 / 9 / 11 ms |

### Edits to shared files

- `fpsLiveMap.ts`, three edits and no others:
  1. Imports `buildFontessaVisualColliders`. Movement solids gain the colliders that block movement, and collision solids gain all of them.
  2. `bulletPenetration` is removed from the three solids above.
  3. The `lineSolidsAt` candidate index.
- Tests changed for the drawn geometry, each with its reason in the test:
  - Pro Regression 6 (`guard-market` accepts walk, a requested jump still jumps; `restaurant-civic` solves as a walk-jump within 1 m);
  - `fpsSpatialAwareness` (the "open" entry (5, 0) grazed a bridge pilaster cap and moves to (5, -1));
  - `fpsSmokeLineupIntegration` (the resting surface includes solid tops);
  - `fpsUtilityBrain` (32 practice throws);
  - `fpsCanalLayout` (the B passage ceiling may be hit at a beam first).
- New tests in `fpsFontessaVisual20261120.test.mjs`:
  - the audit sample finds 0 shoot-throughs and 0 phantoms;
  - no bullet-only collider holds an actor's centre line;
  - the three solids above are opaque;
  - roof bands sit within 4.5 cm of the drawn tile top, picked from the actual tile meshes.

### Checks

- `npm run check:game`: 630 of 631 tests pass. The one failure, `Emergence 3` (smoke disturbance), fails the same way with no visual colliders, so it belongs to other work in progress.
- `tsc -b` and `npm run build` pass (Vite 2.3 s).
- Rendered in headless Chrome (SwiftShader) through a scratch CDP harness, with nothing added to the repository. Views: Mid window and reveals, civic and CT street doors, bridge copings, boundary wall, B car kiosk, Mercato gate, roof verges, shop fronts, palazzo portico and belfry. GPU frame rate was not measured.

## Open items from the visual part

- **(a) Grenades through roofs, belfry, terrace and lean-to: resolved.** All of them collide as drawn (see Colliders).
- **(b) Bodies through the Mercato piers and the shrine: resolved.** The pier bodies block movement. The shrine is inside the wall band where no actor centre can stand (tested).
- **(c) Light-theme or night lighting: not applicable.** The live viewer has one sun and sky setup per map and no night or alternative lighting mode. The broadcast "theme" menu only changes the organiser's HUD presentation.

## Remaining limits

- **Strict-mode residue.** Drawn dressing stands up to about 18 cm proud of collision: quoins and the Mid belt course, the Jade Lantern display panels, the civic doors and the edicola boards. A line can graze such a piece and stop a few centimetres further on. No body fits in that gap, but a grenade can bounce a little deeper than it looks.
- **Inside the Mid window house.**
  - The opened T-door leaf has no collision, so bodies and bullets pass it. Making it solid would change doorway routing.
  - The archive cabinet's door inset stands 5.5 cm proud of the cabinet's wallbang solid.
- **Stepped approximations.** Faces are within about 4 cm, so a grenade can rest up to 4 cm above a drawn roof.
- **Worker bundle.** `dist-worker/fps-engine.mjs` was not rebuilt (it holds other agents' uncommitted changes). Official matches simulated on workers pick up these colliders when it is next rebuilt with `scripts/build-worker-engine.mjs`.
- **Failures that are not this pass's.** `Emergence 3` (smoke disturbance) fails with or without visual colliders. `AutomaticLearningBundleTest` needs the Web source mounted in the API container.
