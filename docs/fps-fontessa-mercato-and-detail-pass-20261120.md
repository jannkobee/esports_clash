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

## Preserved

- No collision, navigation, terrain or gameplay data changed. `LIVE_FPS_MAP` is byte-identical (an existing test asserts it), and `fpsLiveMap.ts`, `fpsLiveTerrain.ts` and `fpsLiveSimulation.ts` were not edited.
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

## Open

- **Visual pieces above collision:** the terrace, belfry, lean-to and new roofs. Like the existing village roofs, a grenade can pass through them visually.
- **Actor contact with gate and wall dressing:** a body hugging a passage wall can brush a pier or the shrine (within the actor-radius band).
- **Light-theme or night lighting:** not reviewed.
