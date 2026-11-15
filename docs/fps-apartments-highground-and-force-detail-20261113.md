# Fountain apartments, usable elevation and faction detail (13 November 2026)

Owner asked to finish hanging lights, add stairs/high ground, dress the fountain side with apartments using the supplied map images as references, detail the T/CT models, and make faction-exclusive guns. `/root` owns this local exhibition pass: terrain, shared map geometry, movement/utility/camera integration, scenery, proxy equipment, live buys, minimap, regressions and documentation. No delegates, cloud jobs, external assets or new dependencies.

## Playable fountain-side apartment gallery

`fpsLiveTerrain.ts` defines ten 0.18 m treads over a 6 m stair run, leading to a 1.8 m high gallery east of the B fountain. `LIVE_B_APARTMENTS` is the shared height/footprint source. The gallery is a filled raised structure; it does not add an underneath passage or a general multi-floor navigation system. The existing three lanes and strict map bounds remain. The local map ID is now `breakwater-live-v5`.

The apartment has a solid back wall, low stone parapets, columns and a roof with a 4.35 m underside. Its closed shutters, arched window trim, tiled gallery, exposed beams, cornice, upper windows and terracotta eaves create an original apartment frontage. References guide the composition; no Counter-Strike assets were imported.

Navigation samples changes in terrain height, routes to the stair entrance and rejects climbs up the sheer sides. A flat-map bounding-box rejection keeps distant route queries from sampling the new elevation unnecessarily. Actors step onto the treads, remain grounded on the deck, and fall when leaving an open edge. Gravity continues through round intermissions. `jumpY` remains absolute foot elevation, preserving existing eye/hitbox/viewmodel consumers; `jump` denotes being airborne. The public snapshot adds `groundY` and advances to local v12. The old v10 version assertions are updated to v12 as part of that schema change.

Floor/tread/roof geometry participates in the same sight and bullet intersections as map walls. Raised wall pieces have an explicit `baseY`, so the parapet and roof do not masquerade as walls stretching down to zero. Grenades land on the deck and bounce off the roof from above or below; crouched throws retain their raised release height. World guns, dropped equipment, blood, fire, device placement and cameras use the surface height. Grounded high-ground actors retain stationary accuracy and grounded leg poses.

The standard/stack-B CT opening includes a gallery hold, and attackers can select it as an approach/one post-plant holding position. These are known map positions, not hidden enemy reads. The minimap displays the staircase and elevated gallery.

## Finished festoon fixtures and proxy kits

Four light spans now end on actual building/boundary walls or the apartment column. Each has a sampled sagging cable, anchor brackets, eight pendant drops, sockets and warm bulb meshes. Bulb height follows its cable. Static detail remains merged by material; no per-bulb light or full-scene bloom pass was added.

The existing CT/T collision proxies gain rounded torsos and smoother heads, plus belts, buckles, shoulder straps, magazine pouches, backpack webbing, elbow details and glove knuckles. CTs have helmet rails, a mount, headset/chin straps and a vented face mask. Ts have a folded scarf, beanie trim and rolled cuffs. Accessories merge by existing animated pivot/material; crouching and elevation transform them once. These remain proxy models. No production character mesh, rig, animation authoring/processing, qualification or publication was performed; those stages retain the owner-started Colab-only workflow.

Live browser inspection also exposed the previous sky material adding white emission to its textured sky. Babylon's StandardMaterial adds those values, clipping the entire sky to white. `fpsLiveGraphics.ts` now uses black additive emission with the emissive texture, and the regression asserts that setting. The subsequent desktop screenshot showed the blue gradient sky and textured sunlit/shadowed facades.

## Faction-exclusive purchases

| Side | Starter | Rifle | SMG | Shotgun |
| --- | --- | --- | --- | --- |
| CT | USP-S | M4A1-S | MP9 | MAG-7 |
| T | Glock-18 | AK-47 | MAC-10 | Nova |

`LIVE_SIDE_LOADOUTS` and `canBuyLiveWeapon` define the live purchase boundary. Paid team gifts also use the recipient's side. Rifle/SMG fallback purchases no longer select generic legacy IDs, which remain available for compatibility/recovered equipment. Team budget thresholds and donor reserves use the actual faction weapon prices. Shared Deagle, SR-7, Scout and Negev retain their existing catalog rules. Recovered enemy guns remain usable.

The first-round initializer formerly retained the generic P9 because its reset only covered halftime/overtime. It now supplies the correct faction pistol from round one as well as at the side switch. Regression assertions cover both. No official/historical worker, identities, abilities, career accounting, private DNA or frozen learning artifacts were changed.

## Verification and limits

New terrain/faction and graphics regressions cover stair routing, movement, grounded holds, edge/intermission falls, elevated head/body hits, parapet/floor/roof sight parity, grenade floor/ceiling bounces, crouched release height, budget conservation, faction buys/gifts, initial/halftime pistols, retained captured weapons, cable geometry and merged accessory parenting/mesh count. The graphics tests use Babylon NullEngine and an explicit CPU canvas stand-in; they do not qualify GPU output.

The final wider game attempt passes 235/236 tests, with zero cancelled/skipped tests. The unrelated Windows automatic-learning archive test reports `EPERM` on `fsync`; its storage implementation was not altered by this task. All 11 elevation/graphics regressions also pass separately after the finishing material/trim edits. Design checks, TypeScript/production build and `git diff --check` pass. Vite retains the existing large-viewer-chunk warning. Local logs are under ignored `.local-tools/fps-apartments-*.log`, including `game-check-final`, `new-tests-final` and `build-final`.

Browser access was available through the existing native Chrome game window this turn. Read-only screenshots verified the corrected sky and current facade/paving rendering. Native control attempts encountered unavailable input geometry/user-input state and did not establish a reliable gallery close-up or model turntable review. No complete camera traversal, mobile visual acceptance, per-device frame-rate benchmark, production-asset qualification or deployment is claimed.

Source SHA-256:

| File | SHA-256 |
| --- | --- |
| fpsLiveTerrain.ts | `7030a0ec7c64ee46e6f032a5220aa70938ac52c2b144e7d73ca0e285d0958aa8` |
| fpsLiveScenery.ts | `5b712a3737e21c1faae64ea18f001305d53ba67d42910ff49515c32597e15cc2` |
| fpsLiveViewer.ts | `7800ec3bb14ca529f6f131f5754a4893d8bd665ed931d67c1b64ad65ff509218` |
| fpsLiveEconomy.ts | `2eaf67846d2ed97285e2ba91082a4706ebefdb5bf20878a2e6a5e4cf4c37daec` |
| fpsLiveGraphics.ts | `7ac23c4eed8dd5411c2213756b35cc153c6acbf4e7295abb8d53297022f458a6` |

Preserve parody aliases, private DNA, careers, official/historical paths, frozen learning artifacts, `/evolution/game-modes`, and the Colab/manual-admission boundaries. Earlier graphics hashes and verification records remain historical evidence, superseded for these changed sources by this record.
