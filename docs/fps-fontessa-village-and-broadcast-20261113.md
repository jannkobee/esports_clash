# Fontessa village, gunplay, smoke and broadcast presentation (13 November 2026)

Owner requested a coherent village map, a public fountain market, a distinct A site, removal of random stone barriers/boxes/location labels/BLAST branding, better spawns and overhead framing, improved recoil/smoke and more detailed guns. Owner explicitly selected **Town-hall courtyard** for A. `/root` owns the village design catalog/architecture, live map/scenery/viewer, gunplay/smoke changes, organizer presentation, tests and this record. No delegates or asset jobs.

## Map identity and asset purpose

The local map is now **Fontessa**, ID `fontessa-village-v1`. The main movement network and apartment stairs remain. `fpsVillageDesign.ts` gives every admitted collision solid an explicit village purpose and surface rather than letting its legacy ID choose generic crate/container dressing. Legacy IDs stay stable: `a-crates` is now the municipal clock tower, for example. No official/historical match path was migrated.

- B is the public market: a compact tiled fountain apron, flower seller, bakery/grocer kiosks, shopfront goods, and the apartment gallery. Closed kiosks use the existing opaque footprints; goods sit on attached shallow shelves rather than loose crates in lanes.
- A is the civic courtyard: a 6.4 m clock tower, town-hall colonnade and seal, formal paving inlay, civic notice/maintenance buildings, with the larger town hall as its northern skyline landmark.
- The two spawn courts use village-inn arrival and civic-guard surroundings, different architectural context, paving and admitted storage benches. The existing fanned/staggered actor departures are retained.
- Complete tiled roofs, solid triangular gable ends, timber doors, shuttered windows, rain pipes, and connected gateway arches replace industrial shutters and oversized floating lintel bars. Village streets, perimeter homes, outside roads and olive orchards replace harbor water/cranes and empty skyline blocks. Exterior detail is merged separately from interior shadow casters so it does not inflate the main shadow frustum.
- Removed the sandbag collision block that was wholly inside the east shop-row volume, ungrounded boost shortcuts, the inaccessible decorative balcony, loose crate/pallet filler, floating decorations and obsolete industrial signs. Real apartment elevation still uses the shared terrain/physics path. Existing wall-attached courtyard/perimeter boundaries remain actual architecture.

`computeOverviewCameraPose` now frames the entire map with near-vertical, aspect-aware projection. Tests project all map corners and rooftop height on landscape/portrait canvases. No moving actor or cover is invented by this camera change.

Location-name paint, signs, minimap callout names and the focus-card location tag are removed. Broadcast narration also substitutes neutral area descriptions for old named locations, while the internal AI callout/intelligence state stays intact. A/B objective badges remain.

## Recoil and weapon presentation

`liveWeaponRecoilKick` now returns successive offsets from a continuous rising/lateral spray pattern, with distinct fixed weapon-family scales. It no longer applies the previous alternating impulse sequence. The fixed settling response starts after trigger release; active compensation still consumes each actor's own Recoil Control ability. Residual yaw/pitch have common hard limits. Shot rays use the same physical recoil state exported to the observer. No idle yaw scan or lateral viewmodel sway was restored.

The first-person view follows physical recoil, actual aim pitch, a brief decaying shot kick and the existing reload/draw motion. Gun models add ejection ports, bolts, sights, rail teeth, handguard vents, selectors, receiver pins, trigger guards, muzzle bores and segmented curved AK magazines. Small detail merges by material; muzzle sockets remain tied to the original barrel tips and pass their regressions. Viewmodel sleeves now track the current attacker/defender side across halftime. Existing force proxies also receive a collar connection to close the visible neck gap.

The local snapshot advances to v13 with public recoil residuals; the three version assertions are updated accordingly. The 25-ability schema, official/historical paths and private DNA remain unchanged.

## Smoke

The shared 15 ellipsoids form a broad overlapping cloud rather than the old undersized separated bubbles. `liveSmokeDepth` measures the maximum clipped optical path through those ellipsoids, handles fade/expiry, and rejects mere tangencies. Vision requires a meaningful path length. Smoke remains permeable to movement, bullets and sound.

`fpsSmokeRendering.ts` renders one analytic volume box per supported cloud, reconstructing exactly those ellipsoid intersections in its fragment shader. Entry depth tests it against world geometry, optical depth drives dense opacity/soft fringes, and slow spatial noise/height shading adds billowing without separate transparent sphere surfaces. No full fluid simulation or CS2 engine parity is claimed. The AI's blocking threshold corresponds to roughly 92% shader opacity. Expansion/disturbance still come from the existing simulation smoke state.

Fragment-depth support and at least 40 fragment uniform vectors are required; less capable devices retain the denser sphere fallback. CPU tests exercise optical geometry, volume bounds, expiry and feature fallback. They do not compile a real GPU shader or qualify its final appearance.

## Organizer presentations

Removed visible BLAST Premier branding and renamed the old `blast-*` UI classes. **More → Broadcast presentation** selects a locally remembered package:

| Organizer | Original exhibition package | Composition |
| --- | --- | --- |
| PGL | Arena | Angular red framing, horizontal roster dock, cut-corner round card |
| ESL | Competition | Yellow/black framing, side rosters on wide screens, centered focus card and flat round card |
| StarLadder | Spotlight | Purple/radial framing, compact ten-player ribbon, offset focus card and rounded round card |

Each package has separate opening/round copy and animation treatment, with a reduced-motion alternative and responsive fallback. Pop-out stages retain the producer attribute and cloned CSS. These are original exhibition layouts, not imported official tournament graphics or event feeds. Organizer identity references were checked against [PGL](https://www.pglesports.com/), [ESL FACEIT Group](https://eslfaceitgroup.com/), and [StarLadder](https://starladder.com/en/); no third-party logos/assets were downloaded.

## Verification and limits

- Wider `npm.cmd run check:game`: **240/241 tests pass**, one pre-existing Windows archive `fsync` EPERM in `fpsAutomaticLearning.test.mjs`. Its storage implementation was not changed. Design checks pass; that failing test prevents the command's final chained TypeScript stage, so TypeScript is verified separately by the production build.
- Final graphics/village/muzzle checks: **14/14 pass**, including catalog/spawn clearance, projected overhead bounds, recoil compensation/settling, smoke optical geometry and fallback, presentation identity/text filtering, accessory parenting and unchanged firearm muzzle origins.
- Earlier focused brain/elevation/graphics/muzzle/profile run: **67/67 pass**. Old low-cover tests now use the admitted spawn bench back because the buried sandbag block and old stone bench were intentionally replaced.
- Production TypeScript/Vite build passes with the existing large-viewer-chunk warning. `git diff --check` is clean. Logs: ignored `.local-tools/fontessa-*.log`.
- Native Chrome screenshots showed the new PGL exhibition HUD, full map/roof framing, village facades, and the civic courtyard. A first overview exposed oversized near-field hill silhouettes; those hills were moved to the distant horizon, with darker exterior ground, outside streets and orchards filling the surroundings. The displayed WebGL2 console messages showed no shader-error rows, but this does not prove an in-smoke camera/render acceptance pass.
- Reliable native control was interrupted by user-input detection. The other two organizer layouts and a complete smoke-volume traversal remain visually unqualified, along with mobile acceptance, per-device frame rate, complete-match balance and production-asset qualification. No deployment or official organizer event integration is claimed.

Source SHA-256:

| Source | SHA-256 |
| --- | --- |
| fpsVillageDesign.ts | `018f73f7681ae850e0ed233f7f54ecd33058943206b10041a27c60b5fa6e945d` |
| fpsVillageArchitecture.ts | `5f16fd28a91d1fc601431dfcce18234063bb8fb3e4eb37dced24cd89f6232242` |
| fpsSmokeRendering.ts | `79732519ad66ce27216596c36133266209cebe2a14cb896939e9dfd1e86e8296` |
| fpsLiveViewer.ts | `146f6bca415047c10daee18a360dcff3cb2b1bcc45e9f0ff8312f80f9df318b1` |
| fpsLiveWeapons.ts | `95da34346f21ea530f98020a9aa62b165108c31d142331dffa7d92b7c51cb3ca` |
| fpsBroadcastPresentation.ts | `a4f7109e7c112316a78874916fa557145c9dd2963c2c6f8d3d9d269511fc42c7` |

This supersedes the earlier local environment presentation for these changed sources. Preserve earlier records/hashes as historical evidence, parody aliases (including Cardrel), private DNA, careers, frozen learning artifacts, official/historical simulation, `/evolution/game-modes` and the owner-started Colab-only character generation/rigging/animation gates. Environment/weapon/proxy detail here is runtime code-native artwork, not a qualified new character pipeline.
