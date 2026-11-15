# Local FPS environment graphics (13 November 2026)

Owner request: improve visual graphics. `/root` owns the runtime environment material library, live viewer, scenery, focused graphics checks and this handoff. No agents or cloud asset jobs were dispatched.

The local FPS exhibition now uses shared albedo/normal maps for plaster, limestone, paving, timber, corrugated metal and clay. Six pairs of 512-pixel maps are generated once per viewer and shared across tinted materials. Box faces and lane overlays use metre-scaled UVs, so the lane dressing no longer hides the floor detail under solid colors. Repeating texture addressing and anisotropic filtering also correct the previously clamped courtyard mosaic and roof tiles.

Warm sunlight, cool sky fill and restrained exposure replace the stronger, flatter lighting. A gradient sky dome with quiet cloud bands and matching distance haze adds depth. The shadow map increases from 512 to 1024 with medium PCF filtering and lower bias. Facades and merged scenery now receive shadows; scenery and operative limbs/boots also cast them. Static geometry remains merged by material. No full-scene postprocessing pipeline or new dependency was added.

Fountain and harbor water share an animated ripple normal map. Offsets depend only on simulation time, including pause and replay, rather than wall time or simulation RNG. Water uses opaque surfaces to avoid sorting artifacts among the merged fountain pieces.

The old `b-fountain` rectangular proxy was still being drawn over the detailed radial fountain. The viewer now omits that duplicate box and coping, and scenery omits its generic facade plates. The torus rim is horizontal, matching Babylon's native torus orientation. The existing round fountain artwork is now the visible shape; the conservative movement footprint, radial sight/bullet intersection rules and all other collision volumes remain unchanged.

Affected files:

- `EsportsClash.Web/src/fps/fpsLiveGraphics.ts`: cached runtime maps, UV sizing, water and sky.
- `EsportsClash.Web/src/fps/fpsLiveViewer.ts`: lighting, shadows, textured map surfaces and duplicate fountain removal.
- `EsportsClash.Web/src/fps/fpsLiveScenery.ts`: textured lanes/details, corrected fountain rim, repeating roof texture and shadow receivers.
- `EsportsClash.Web/src/fpsLiveGraphics.test.mjs`: CPU material/scene regressions using Babylon NullEngine and an explicit canvas stand-in.

Verification:

- Four graphics regressions pass: six-face UV metre scale, deterministic map data/unit normals/resource reuse, simulation-time water/noninteractive sky, and fountain geometry/map immutability.
- The focused graphics, muzzle, broadcast director and tactical regressions pass 57/57 with zero failures (`node --experimental-strip-types --test src/fpsLiveGraphics.test.mjs src/fpsLiveMuzzle.test.mjs src/fpsBroadcastDirector.test.mjs src/fpsLiveTactics.test.mjs`).
- Design/alias checks pass. TypeScript and production build pass; Vite build 4.69 seconds, with the existing large-viewer-chunk warning.
- The wider `check:game` attempt passed 222/225 tests before the four new graphics tests were added. Three failures are outside the changed graphics path: `fpsLiveIntel.test.mjs` and `fpsSkillProfile.test.mjs` expect snapshot v10 while the committed engine emits v11; `fpsAutomaticLearning.test.mjs` fails with Windows `EPERM` on `fsync`. The version mismatch is present in HEAD. Those files were not changed to conceal the failures.
- Exact logs: `.local-tools/fps-graphics-check-20261113.log`, `fps-graphics-focused-20261113.log`, and `fps-graphics-build-20261113.log`. These local logs are ignored artifacts.

Browser access inventory returned no available browser control host. The native Chrome fallback ended because the computer-use service could not verify its current URL. No further browser automation was attempted. The CPU tests do not exercise GPU shading, actual texture orientation, rendered camera traversal, readability, mobile behavior or frame rate. Browser visual acceptance and per-device performance remain pending; this is runtime proxy artwork, not production character qualification or deployment.

Source SHA-256:

| File | SHA-256 |
| --- | --- |
| fpsLiveGraphics.ts | `724fdad029cf903d01b44c903c2fb5078d5f54962f7723d74b381550293680fe` |
| fpsLiveViewer.ts | `87917e20a3207836665e801b0b72a4347d9a773a702187d18fe127fe7fcc1b75` |
| fpsLiveScenery.ts | `ae791fc264c8b266cda5df596ebe1cdb8a3e0785e50c02ada17371b95908c44c` |

Preserve official/historical simulations, private DNA, parody aliases, careers, frozen learning artifacts and the owner-started Colab-only generation/rigging/animation workflow. No character assets were generated, restored, qualified or published.
