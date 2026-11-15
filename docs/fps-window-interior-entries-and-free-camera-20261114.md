# Window house interior entries and free camera (14 November 2026)

Owner requested a longer/wider window house, natural entrances, a lower T-side entry and a free camera. While work continued, they explicitly rejected all exterior window-house stairs: **stairs must be inside; T/CT entries must be doors**. That steering supersedes both earlier exterior-flight designs. `/root` owns this pass; no delegates.

Fontessa v11 retains snapshot v19. The main house is 9 m wide and 9.5 m deep (`x = -4.5..4.5, z = 17..26.5`), with a covered civic west wing and a natural ground-level open T-side doorway on the south front wall (`z = 17`). All former exterior window stair cheeks, coping, open flights, and the protruding `z = 8..17` south T-wing extension are removed.

- T enters a natural ground-level open doorway at `(-3.1, 17)` (`y = 0..2.6`) framed with stone jambs, plinths, cornice, an inward-swung open timber door leaf over a flat vestibule (`z = 17..18`), and a shuttered upper window above. Inside the west bay (`x = -4.4..-1.8`), twelve internal `0.15 m` steps (`z = 18.0..22.4`) rise beside an interior stair parapet (`x = -1.68`) to the upper gallery (`y = 1.8`).
- CT has a ground-level rear doorway on the east rear bay (`x = 1.2..4.5, z = 26.5`). An internal rear flight (`z = 20.5..26.5`) leads up to the window loft beside an interior gallery rail (`x = 1.12`).
- The civic/CT side entry is a ground-level door near `(-15.5, 24.3)`. Its stair flight is entirely inside the extended west wing, with `3.6 m`-wide treads and roof/walls around it. No entrance requires jumping or a ladder.
- Broadcast grenade lineup trajectory arcs return across all 3D cameras (`1P`, `3P`, `AUTO`, `WIDE`, `FILM`, `FREE`, `PIP`) and the 2D `broadcast-radar` minimap: `LiveSnapshot` now exports optional `utilityPrep` target/throwStyle/flightTime/lineupId metadata, and `FpsLiveViewer` renders cached glowing team-tinted trajectory tubes + crisp bright core lines + target landing rings during both utility setup and flight (fading 1.5 s after detonation, cleared on round reset).
- Moved the nearby civic clerks wing slightly north and added fine navigation connectors through all doorway/stair bays. Existing setup and 10–15 s rotation assertions remain unchanged and passing.

## Free camera

Use **Free cam** in the top controls or **FREE** in the camera dock. Click the map to focus it, use **WASD** to move, **Q/E** down/up, **drag** to look, and **Shift** for faster movement. **Space** still pauses/resumes the match, and free flight continues while paused. Click Free cam again or cycle C to return to broadcast cameras.

The manual view stays independent of player following and round camera cuts, suppresses plant PIP while exploring, shows all operatives normally and uses no first-person weapon overlay. It flies through geometry for inspection while remaining inside the map's horizontal bounds and a bounded vertical range. Input ignores unfocused/inactive controls; blur, mode exit and disposal clear held movement/listeners. No pointer lock is required.

## Verification

- `npm.cmd run check:game`: **301/301 tests pass** (`fpsMidWindow.test.mjs`, `fpsLiveLineups.test.mjs`, `fpsBroadcastDirector.test.mjs`, and full `src/*.test.mjs` suite), design/cleanup/privacy checks and `tsc -b` included.
- `npm.cmd run build`: **passes**, Vite `4.70s`; existing chunk-size bundle warning remains.
- Physical tests verify open T-door (`z = 17`), CT rear door (`x = 2.8, z = 27.5`), and civic entry/return without jumping; street thresholds are flat, former protruding south T-wing (`z = 8..17`) and exterior parapet IDs are absent, `computeLiveGrenadeTrajectoryPoints` and `LiveSnapshot` `utilityPrep` target exports pass, and timing limits remain enforced.
- Free-flight tests verify movement, diagonal normalization, height/speed controls, bounds, inactive/unfocused input and blur/disposal cleanup. No browser/GPU WebGL rendering check was executed after these edits.
- The detailed deterministic seed legitimately defused its first bomb around 149 seconds and was still in its seven-second break at the old 150-second test cutoff. `tmp/house-round-proof.mjs` confirms round two subsequently starts with real shots. Extended that fixture to 180 simulated seconds to cover a complete legal late-plant/defuse/break sequence; collision, determinism, round progress and privacy assertions remain intact.

No deployment, new long-run performance qualification, asset generation, rigging/animation compute or Colab dispatch. Preserve unrelated pending work, aliases, private DNA, official/historical paths, careers, frozen artifacts and Colab gates.

Owned changes: map/terrain and window scenery, village material purpose mapping, viewer/director camera-mode integration, broadcast controls, new `fpsFreeCamera.ts` / `fpsFreeCamera.test.mjs`, window traversal and deterministic fixture checks, and this handoff.
