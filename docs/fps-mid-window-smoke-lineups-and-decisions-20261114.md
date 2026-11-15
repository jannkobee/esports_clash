# CT Mid window, physical smoke lineups and AI decisions (14 November 2026)

Owner reported nonexistent smoke lineups, requested a CT-side Mid window inspired by their Mirage screenshots, and asked to polish AI decisions. Preserve the current Venetian canal/port, tight B and open A. The references guide an original Fontessa customs lookout; no external game rules are inferred.

## Ownership and integration

`/root` owns simulation integration, final verification and this record. Delegated stages: `ct_mid_window` owns shared geometry/scenery and window/camera regressions; `smoke_lineups` owns grenade solver/definitions and physical/integration regressions; `ai_review` owns decision regressions and read-only decision review. Artifacts and failures were shared through agent messages. Existing pending frontend/API work, official/historical matches, private DNA, parody aliases, careers and frozen artifacts remain preserved. No asset generation, rigging/animation compute, Colab dispatch or deployment.

Map is **Fontessa v9**; live snapshot schema stays v19. `LIVE_MID.window` / `LIVE_MID_WINDOW` expose the same geometry used by movement, rendering, rays and tactical assignments.

## Playable customs window

- Replaced the solid Mid kiosk with an actual room at X ±3.12, Z 17..24, floor Y 1.8. The south-facing aperture spans X ±2.1, Y 2.82..4.65. Shared sill, lintel, side/rear walls and roof prevent shooting or walking through the surrounding facade.
- A rear doorway and nine 0.2 m steps at Z 24..28.5 connect to the Z 29 landing. Shared stair cheeks prevent side shortcuts. Fine navigation connectors preserve real ascent/descent without jumping or teleporting; the north guardhouse still breaks the spawn sightline.
- Rose plaster, exposed masonry, stone/timber reveals, interior depth, shutter, rainpipe and roof fit the Venetian setting. No loose furniture blocks the room or stairs.
- Standard/retake CT flex at slot 2 uses the window and watches Mid, with anchors retaining site duties. Evidence-led orders override this assignment; generic quiet HOLD/recheck orders no longer accidentally suppress opening role assignments. The apartment crossfire remains assigned separately.

## Why lineups were missing

The opening timer allowed only eight seconds. Execute utility threw from arbitrary current positions rather than reaching named launch points. No alternate physical arc was searched when an overhead throw collided. One B origin was inside the taller shop, another B smoke burst above the covered entrance, and the B low-passage throw bounced back off its roof. Spare utility pickups and later movement choices could also displace the setup.

The corrected planner assigns a named, reachable origin, keeps a bounded commitment, walks there, brakes and aligns, equips/pulls the pin, then releases a real paid grenade. Completion/reporting occurs on release. Immediate danger cancels safely without consuming the item. Opening selection allows 18 seconds to begin and a 12-second bounded assignment. Skill execution error is applied once; no hidden opponent positions enter authored setup selection or physical solving.

`fpsSmokeLineupDefinitions.ts` is independent map knowledge. `fpsLiveLineups.ts` searches at most 24 bounded arcs and caches exact static-coordinate solutions. It validates authoritative collisions, launch speed (≤32 m/s), XZ error (≤0.6 m) and detonation near the intended floor rather than on a roof. `launchLiveGrenade` accepts the verified flight time while actual position/velocity, fuse, bounces, inventory and cloud creation remain normal physics. Preview and release use the same hand origin and height. Old map lineup exports alias the same definitions.

| Purpose | Authored launch → intended destination |
| --- | --- |
| T opening A/B | Jade Lantern → civic entry / covered market entry |
| CT opening A/B | Customs quay → civic entry / north market exit |
| A execute | A main → civic arch; A outer → rear civic passage |
| B execute | Low market passage → flower crossing; forecourt → east return |
| Mid control | T Mid → customs window; CT customs return → bridge exit |

Execute utility respects the assigned origins, paid availability and actual releases; existing observed smoke/own in-flight grenades prevent duplicate spending. Smoke cloud growth is given 1.2 seconds before a coordinated breach; flashes retain their shorter release window.

## Bounded decision corrections

- Regroup readiness requires an actual nearby entry group and a carrier near the intended entries. A distant lurker's fight does not release the whole team. An incomplete regroup times out into rechecking/taking space instead of announcing a fictitious coordinated breach.
- Spare utility is opportunistic: it cannot displace committed lineups, executes, retreats or fresh threat responses. Utility setup/duel and objective priorities remain protected.
- Smoke-edge tests use real eye and destination-floor heights. Smoke below a gallery/window no longer blocks an elevated actor incorrectly. An isolated actor still waits; a ready, healthy traded pair may cross briefly during a called breach. Reloading, empty, blinded, unsupported or stale breaches do not gain that exception.
- Utility safety retains an already acquired target but checks new visual danger inside the actual FOV rather than using a rear 360-degree scan. No hidden-enemy information is granted.

## Verification

- Final `npm.cmd run check:game`: **295/295 tests pass**, including design/privacy/cleanup checks and TypeScript. Log: `tmp/window-lineups-accepted-check.log`. The earlier integration checkpoint passed 293 before the last execute/bloom regression cases were added.
- `npm.cmd run build`: **passes**, Vite 3.37 s. The existing large-bundle warning remains. Log: `tmp/window-lineups-build.log`. Tracked whitespace check passes.
- All ten authored throws replay from their actual hand origins with fixed-step physics, low intended-floor arrivals, bounded speeds and independent cache copies. End-to-end scenarios cover paid full buys and autonomous T/CT opening A/B movement, braking/alignment, equip/pin, release/inventory accounting, actual cloud position/floor and damage cancellation. A/B execute regressions verify actual origin assignment, release counters and waiting for smoke bloom.
- Four window tests cover real actor ascent/descent and shared aperture/wall/roof collision; camera regressions cover standing/crouched room poses across four headings in padded 3D collision. Existing A/B reachability, 2–6 s setup lead and 10–15 s rotation checks remain passing. The old camera fixture that stood at ground height inside the new elevated room was replaced with a legal grounded wall-clearance position; the new raised-room coverage preserves its original safety purpose.
- **3/3 isolated long audited matches pass**, seeds 17/42/1337, 18,000 ticks each: **54,000 ticks / 30 simulated minutes**, reaching rounds 6/5/7. Every tick audits finite/bounded positions, living collision, cash, magazine/reserve and grenade capacity. Live CPU p99 was **9.28 / 8.73 / 11.06 ms**; isolated maxima **55.32 / 33.53 / 49.54 ms** remain. This is simulation/snapshot CPU measurement, not GPU FPS or balance qualification.
- An earlier soak overlapped source edits and other validation and recorded repeated 100–140 ms spikes in one seed. Targeted profiling and the final isolated audit did not reproduce that sequence, so no speculative performance tuning was applied. Failed/initial checkpoints are retained. The final audit's pre/post SHA256 checks verify seven relevant source files stayed unchanged, exit 0: `tmp/window-lineups-final-soak-receipt.json`. Results: `tmp/window-lineups-final-soak.json` / `.log`. Diagnostic wrappers/receipts: `tmp/profile-smoke-hotpath.*`.
- Final simulation SHA256: `52b755e9b93e084a8528ff7fceb2430fda8ae7d344129ad75099649e06037801`; grenade physics: `d7fedcb5deef633cd3da621219af33735a52ffa12446c0f37cb6e58a23c7cd15`; solver: `c0f405313116da69fb77814aaa90d8865645770f31e037b9a0b9b99a7a5f42dc`. Full geometry/definition hashes are in the receipt.

GPU/browser appearance and competitive balance remain unqualified. No new UI automation was attempted in this pass; the preceding visual review was stopped by the unavailable browser host/current-URL safeguard. No deployment or production asset qualification is claimed.

Changed sources: `fpsLiveSimulation.ts`, `fpsLiveGrenades.ts`, `fpsLiveMap.ts`, `fpsLiveTerrain.ts`, `fpsVillageDesign.ts`, `fpsLiveScenery.ts`, new `fpsSmokeLineupDefinitions.ts`, `fpsLiveLineups.ts` and `fpsMidWindowScenery.ts`. Regression additions: `fpsLiveLineups.test.mjs`, `fpsSmokeLineupIntegration.test.mjs`, `fpsLiveDecisionPolish.test.mjs`, `fpsMidWindow.test.mjs`, and the affected broadcast-camera fixture. Other existing work remains preserved.
