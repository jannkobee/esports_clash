# Mid window civic side passage (14 November 2026)

Owner disliked the window room's single steep-feeling rear entrance and requested connecting it to another route. `/root` owns terrain, map, side-passage scenery, focused regression and this handoff; no delegates. Preserve the prior canal/port, site asymmetry, window firing angle and physical smoke lineups.

Fontessa v10 retains snapshot v19. The window now has a second doorway in its west wall, opening onto a covered annex passage and a broad flight to the civic/CT connector. Rear access remains available.

- West doorway at (-3,23.1); covered landing around (-5.8,23.7), floor Y1.8. Shared masonry, lintels and roof replace the former solid west wall at the actual doorway. Interior trim no longer crosses the opening.
- The new 2.4 m-wide flight runs west toward (-16,23.7), with nine 0.2 m rises and **0.9 m treads**, twice the run of the original rear flight. Shared cheeks, coping and nosings follow the physical steps. Stair recognition also covers side-facing treads, preventing automatic route hops.
- The passage joins the civic connector and keeps the street rotation immediately north of the annex clear. An initial north-facing flight obstructed rotation and was rejected; the final west-facing route restores the existing 10–15 second rotation requirement. No timing assertion was weakened.
- Navigation includes fine doorway/landing/stair connectors. Real actor regression walks from the civic approach into the landing/window and back via the same second route without jumping or falling. The rear entry, front firing aperture and intact wall segments retain their own regressions.

Verification: all **296/296 game tests**, design checks and TypeScript pass; production build passes with the existing large-bundle warning. Logs: `tmp/mid-passage-accepted-check.log`, `tmp/mid-passage-build.log`; initial failed layout evidence remains in `tmp/mid-passage-initial.log`. No new browser/GPU review, long-run benchmark, deployment, asset generation or Colab processing. Prior v9 performance receipts do not qualify this new geometry.

Changed files: `fpsLiveTerrain.ts`, `fpsLiveMap.ts`, `fpsVillageDesign.ts`, `fpsMidWindowScenery.ts`, `fpsMidWindow.test.mjs` and this handoff. Preserve other pending edits, aliases, private DNA, official/historical paths, careers, frozen artifacts and owner-started Colab gates.
