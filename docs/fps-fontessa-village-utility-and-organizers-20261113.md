# Fontessa village, utility and Hexapedia organizers — 13 November 2026

Owner: `/root`. No delegates, asset-generation jobs, browser automation, database commands, deployment or publication were performed. The owner explicitly requested **skip checks or tests**. No tests, builds, lint/type checks, PHP syntax checks, visual/runtime checks or benchmarks were run for this pass. Earlier verification records do not qualify these changes.

## Request and direction

The owner clarified that broadcast organizers must belong to Hexapedia and its generated world. Requested distinguishable grenades, detailed playable trees, connections to the surrounding village, plausible middle houses and a recognizable town hall, bins/litter, removal of gunshot-driven smoke wiggle, elevated approaches and a residential connection from the T-side arrival area toward the fountain. Also requested public enemy-count awareness, improved executes and reasonable equipment handling. The earlier selection of **Town-hall courtyard** for A remains active.

## Shared organizer identity

- `OrganizerBroadcastIdentity.php` supplies stable organizer-owned layout, palette, package and round/introduction copy. Existing verified organizers receive a deterministic profile through the Hexapedia directory; saved branding may override the bounded presentation fields.
- `IndependentOrganizers.php` registers Harbor Stage, Meridian Relay and Patchline Studio with broadcast branding on the normal world-organizer tick, before considering an event window. This avoids requiring a newly published tournament merely to publish an organizer identity. Existing records and human-owned slugs are not overwritten. The tick was **not invoked** in this session.
- `AvatarpediaService.php` includes the same profile in organizer directory/article records, including the canonical Signal Circuit entry. The frontend fetches all directory pages for its selector and links the selected organizer's Hexapedia article. An offline exhibition retains canonical Signal Circuit.
- Removed the separate PGL/ESL/StarLadder presentation registry. HUD compositions now use organizer-provided `arena`, `competition` or `spotlight` layouts and accent colors. Hexapedia organizer articles display their package and presentation identity.
- These are repository changes. New database identities appear when the updated backend runs its normal world-organizer tick; no live database backfill or deployment is claimed.

## Village geometry and presentation

- Map becomes `fontessa-village-v2`. Broader, lower middle homes replace narrow tall strips. Removed the freestanding gateway arches and their piers, leaving open connecting alleys.
- A now fronts a deep two-storey hall and attached clerks wing, with a pediment, four-column portico, double doors, flags, civic seal and shared three-step approach. Updated obstructed tactical hold/post-plant positions. The previous distant town-hall portico is removed.
- A 1.8 m filled residential terrace/gallery connects the arrival approach toward the market apartments. South stairs and a separate market-side return staircase share rendered, navigation, movement, sight and ballistic terrain. Parapets leave deliberate openings. The adjoining residential wing extends outside the playable boundary with a plausible ten-metre depth; its upper rooms are scenery, not an implemented indoor route. The terrace is filled masonry, not an implied walk-under catwalk.
- Four playable shade trees have admitted trunk footprints and modeled bark ridges, branches, clustered crowns and small leaf sprays. Trunks provide collision; foliage remains visual. Added admitted cylindrical litter bins, nearby paper scraps, drains, notice boards and a terrace herb planter. Small litter is flush decoration, not cover. The former west courtyard barrier is now a roofed service shed.
- Low garden boundaries, open street entrances, connected road surfaces and repositioned outside housing reduce the enclosing-wall silhouette. Explicit actor bounds remain unchanged. Outside streets and homes are visual context. Overhead framing includes the widened village edge.
- Roof tiling uses scaled UVs; widened apartments receive complete roofs. Festoon endpoints now fasten to the residential facade. Market-side stair nosings follow the relocated stair footprint.

## Grenades, smoke and equipment

- Equipped and flying utility use the same distinct geometry: ribbed silver flash, broad banded smoke canister, segmented oval HE, CT red incendiary canister and T bottle/cloth Molotov. Forecast trail colors distinguish utility types. Released grenades stop rendering in the operative's hand; the flying model appears at actual release.
- Removed gunshot-triggered smoke disturbance. Existing HE disturbance, expiration and slow natural volume motion remain.
- Utility preparation now actually waits for `readyAt`, checks danger/friendly safety again, releases after windup, then restores the firearm through its real draw delay. Cancelling utility no longer clears that delay. Utility cannot interrupt an objective channel/reload/draw. Generic utility decisions do not compete with the coordinated execute setup.
- Visible-target fire and prefire require an equipped, ready firearm. Pickups cannot interrupt utility, draws or reloads. Reloading from knife transit draws the weapon first.
- Sniper sidearm fallback now changes the actual firing weapon and conserves separate primary/sidearm ammunition. Returning to the primary restores its magazine. Sidearm use cannot scavenge a duplicate primary; a death drops the stored primary. Knife transit is restricted to long, quiet routes away from sites, recent reports and active executes.

## Public information and coordination

- Remaining opponents are counted from the starting roster minus publicly confirmed deaths, including friendly/self casualties. This does not query hidden survivors or disclose hidden positions. Counts feed pressure, personality context, clutch movement/reloading, caller decisions, radio and the observed-player HUD. Snapshots are `hexatrick-live-exhibition-v14`, with optional player `enemyRemaining` and team `forces` fields.
- Execute orders progress through regroup, utility and breach. Teams gather at entry approaches, assign available smoke throwers, layer a flash and release around utility timing. Time/contact deadlines prevent indefinite setup. Entry/trade/support movement follows the call while personal combat, objective urgency and safe plant handling retain priority.
- Quiet CT probing avoids unnecessary aggression with a large numerical advantage against one or two opponents. Defusers may briefly wait for retake crossfire while the clock allows it.
- Trade reflex now uses personal sight or a recent sampled contact. A nearby teammate's death does not grant exact killer coordinates through a wall.

## Ownership and limits

Owned files: API organizer service/generator/Hexapedia service; frontend Hexapedia types/article, broadcast presentation/component/styles, live map/terrain/scenery/architecture/furnishings/viewer/director, and local simulation/tactics. Earlier dirty graphics and village changes were preserved. No official/historical match identity, private DNA, careers, parody aliases, frozen learning artifacts or owner-started Colab gates were changed.

No production character qualification or new avatar pipeline is implied. This pass uses the existing runtime environment/weapon renderer. No GLB, rig, animation or appearance candidate was generated. Existing tests were not executed or rebased; old snapshot, geometry and producer-list expectations may need updates when verification is authorized. Route traversal, execute timing, GPU appearance, backend HTTP behavior, draw/ammunition transitions and frame-rate acceptance remain unverified for this pass.


## Owner-requested fight-taking rollback ? 13 November 2026

The owner reported that the latest fight-taking changes made fights look worse and requested undoing them. `/root` reverted the tactical portion of this pass in `fpsLiveSimulation.ts` and removed its execute-phase fields from `fpsLiveTactics.ts`.

Restored the previous seven-second execute call and eligibility, independent approach/trade spacing, automatic smoke-lineup behavior, local seen/reported-enemy pressure and personality context, CT probing eligibility, immediate trade-fragger response and direct defuser approach. Removed the added regroup/utility/breach coordinator, its forced movement override, the extra defuser wait and the general immediate rethink on a public casualty. This supersedes the fight-taking/coordination changes described above; it is an intentional rollback, not a newly qualified AI improvement.

Kept the Fontessa map/scenery/terrain, graphics, organizer identities/HUDs, grenade shapes, stable smoke under gunfire, draw/throw timing, ammunition/equipment fixes and public remaining-enemy count/display. Snapshots remain v14 because those public fields still exist. No wholesale Git restoration was used; other pending changes were preserved.

The owner's skip-checks/tests instruction remains in force. No tests, checks, builds, browser/runtime review or benchmarks were run for this rollback.
