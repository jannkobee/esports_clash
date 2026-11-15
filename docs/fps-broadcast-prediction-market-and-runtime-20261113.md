# Broadcast, evidence-based anticipation, village life and runtime work

13 November 2026. Owner: `/root`, no delegates. The owner's standing skip-checks/tests instruction remains active. No tests, builds, type/lint/syntax checks, browser/runtime inspection, benchmarks, model processing or deployment were run. This record describes source changes and their limits, not runtime acceptance or measured frame-rate improvement.

## Scope and ownership

Owner requested unique gun icons, attribute-driven actions, a camera that catches kills, POV incoming-fire cues, less block-like CT/T models, a recognizable market, more inhabited-looking houses, cinematic idle shots instead of bird view, predictions/prefire from initial information and less lag.

Owned frontend broadcast component/styles and new weapon/incoming-fire components; director/viewer; live simulation, anticipation, skill readouts, smoke/geometry hot paths; village architecture and new market/data modules. Map is `fontessa-village-v3`; snapshots are `hexatrick-live-exhibition-v15`. Other pending work was preserved.

## Broadcast and presentation

- Added separate tightly framed SVG profiles for every firearm ID, with distinctive magazines, stocks, barrel/suppressor lengths, scopes and fittings. Pistols use a shorter view box so they fill the same HUD footprint. Utilities also have separate shapes, including a faction-aware Molotov icon.
- Replaced the accessible `overview` camera mode with `cinematic`: four authored low/medium street views of the fountain market, civic hall and arrival street, with bounded gentle drift. Automatic quiet/freeze/post periods use these shots. The old exported overview pose utility is unused compatibility code, not an accessible/rendered camera mode. The tactical minimap remains.
- The local spectator feed buffers 0.9 seconds. Only the director receives the later simulation snapshot, allowing a cut to a living shooter before an imminent recorded kill. This data is never passed to actors or their AI. Audio is queued to the displayed timeline. The buffer drains after match completion and remains still while paused.
- Director evaluation is cached per simulation/preview frame and selection. Fight locks and a minimum cut interval still prevent rapid cuts between simultaneous events; showing every simultaneous kill is not guaranteed.
- Removed the duplicate central round-win panel. A single compact organizer presentation leaves the cinematic centre clear; the match-exit control remains.

## Incoming-fire indication

- V15 snapshots may include bounded `fireCues`: player ID, time, approximate eight-sector bearing, hit/near-miss type and strength. The HUD renders red damage arcs and amber nearby-bullet arcs in the observed first-person view, relative to that player's yaw.
- Near misses come from the actual resolved shot segment and body/head proximity. Hits come from actual damage. No enemy ID or coordinate is exposed by the cue. Its sequence is separate from gameplay event/grenade IDs and makes no RNG draws.
- Cues expire quickly and are capped. They do not supply AI targets. Existing hearing and uncertain damage information remain the actor's information sources.

## Attribute-driven action and anticipation

- Preserved the 25-key schema, bounded active abilities, individual recoil control and explicit legacy estimates. Added more consumers for voluntary utility setup pace, strafe execution, tactical reload thresholds, route crowding choices, regroup patience, trading distance and trade response delay. Physical weapon cycles, recoil impulses, movement limits and objective channels remain shared rules.
- Added a leading-skill readout on the observed action. This is a readable consumer label, not a claim that each action has only one influencing ability. Legacy seven-stat values are marked as estimates in the tooltip. Economy Judgment remains reserved while team policy owns buys, as required by the standing attribute rollout boundary.
- `fpsLiveAnticipation.ts` accepts personal intel, recorded firsthand movement samples, the actor's position and bounded information-reading/timing/judgment values. It does not accept a live-enemy list.
- Consecutive firsthand sightings estimate velocity, with maximum speed, horizon and displacement caps. Sightings can also suggest a last-seen hold. Reload sounds suggest a short timing window; footsteps/gunfire suggest plausible entrances while preserving uncertainty. Existing repeated-round tendencies remain observed-history guidance.
- Pre-aim and at most two conservatively gated prefire shots may follow a fresh, confident sight-based hypothesis. The source evidence must still exist; static sight, ammunition, readiness, movement recovery and aim constraints apply. Normal physical rays resolve every shot, miss, wall and incidental hit. Anonymous sounds alone do not authorize precise blind fire. Guesses expire and public deaths invalidate their evidence.
- Prediction-only shots do not select a learned combat cadence against an invented enemy identity. Frozen learning artifacts and official/historical identity paths were not changed or activated.

## CT/T and village visuals

- Refined the existing runtime fallback, retaining its animation pivots and collision silhouette: rounded limb/boot/glove/carrier forms, articulated elbows/forearms, adjusted shoulder proportions, ears/brows/eyes/nose, a helmet/beanie that leaves a face visible and rounded equipment. Rigid accessories are batched per animated pivot/material; limbs and the reload prop stay independent.
- These are refinements of the existing fallback renderer, not a new asset-authoring pipeline or qualified human character release. No GLB/rig/animation generation or processing occurred. Finished production characters still require the existing owner-started Colab workflow and its qualification gates.
- Added three supported, striped market stalls around the fountain: produce trays, bread loaves and a fish/ice display, with baskets and trade emblems. Counters, canopies and posts share admitted collision/ballistic geometry. Lanes and plant positions still require runtime traversal review.
- House shutters open outwards. Visible window returns, curtains, interior lamp forms and herb boxes replace fully closed panels. These are visual room/window details; this pass does not add enterable house interiors or civilian NPCs.

## Source-level performance changes

- Removed every-frame grenade future-trajectory simulation and dynamic path-line rebuilding from the renderer. Live grenades still use authoritative simulation physics.
- Static collision solids are shared instead of repeatedly concatenated. Sight tests early-out without allocating/sorting a complete intersection list; bullet penetration still obtains ordered intersections. Fountain radial geometry remains special-cased, including its full spire height.
- Cover candidates score exposure once per candidate rather than repeatedly inside a sort comparator. Shared smoke lobe shapes have a bounded cache keyed by exactly the values used to generate them.
- Director work is limited to snapshot changes. Base rendering targets CSS-pixel resolution, with bounded adaptive scaling if frame intervals rise. Shadows refresh every other frame. Rigid model details batch per pivot, and unnecessary pointer-move picking is disabled.
- Simulation catch-up is capped at four fixed steps per render pass; elapsed simulation work remains queued rather than changing the fixed physics step. No throughput, FPS or lag-elimination claim is made without measurement.

## Preserved boundaries and follow-up

No official match/career writes, private DNA exposure, real-name card-face changes, frozen ML artifact edits, cloud dispatch or deployment. Parody aliases and owner-started Colab gates remain. Existing tests were not run or rebased. Camera modes/buffer/audio, POV arcs, market traversal, body poses/weapon grips, mobile layout, prediction false positives and actual performance require later runtime acceptance when the owner authorizes checks.
