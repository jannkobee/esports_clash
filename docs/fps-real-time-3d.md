# Hexatrick real-time FPS direction

Latest local rules: [exhibition v6 and the revised 25-ability profile](fps-attributes-25-20261111.md). Omitting test profiles retains the local v5 adapter; official contextual v3 remains separate.

Latest local pass: [exhibition v5 information-driven play](fps-information-play-20261110.md), with bounded beliefs, evidence-based calls and source-aware observer explanations.

Latest v4 correction: [stable crosshair placement and adopted pro-match reference](fps-crosshair-reference-20261110.md).

Latest local pass: [v4 human handling, knives and A-site wall collision](fps-live-human-mechanics-20261110.md). This supersedes the local version and affected behavior below; official contextual v3 remains separate.

Latest owner-authorized pass: [three-lane map, movement, coordinated executes and shared economy](fps-three-lane-tactics-20261110.md). Current local rules are `hexatrick-live-exhibition-v3`, map `breakwater-live-v3`; that record supersedes the older v2 movement/economy/instant-utility descriptions below. Official contextual simulation v3 is a separate preserved engine path.

On 10 November 2026 the owner chose an original FPS inside Hexatrick, with full-length real-time rounds and a continuous spectator broadcast using first-person, third-person and observer views. The supplied esports broadcasts are visual references. The player manages the team; the broadcast follows the simulated players. This direction does not authorize copying Counter-Strike assets or replacing historical matches.

## Attribute, map and presentation improvement pass (2026-11-10)

Later owner reference: use [the professional FPS skill mapping](fps-professional-skill-reference.md) as the micro/macro/team/mental design reference. The live broadcast now includes a collapsible event-derived impact table; its exact definitions and the distinction between the proposed 26-ability model and current seven-attribute bridge are recorded there.

Owner requested continued work on attribute-dependent decisions, map design and visual quality. `/root` owns this pass without agents. Current local rules are `hexatrick-live-exhibition-v2`, using `breakwater-live-v2`; official v2/v3 allocations, settlement and historical replay remain on their existing paths.

The live room now defaults to varied fictional demonstration attributes with comparable team averages. Seven attributes can be edited on a 1–20 display; an equal-attribute option remains available for identity comparisons. These profiles do not claim to be real player evaluations or overwrite club cards. Recorded tactical exhibitions retain their prior equalized roster.

`fpsLiveAttributes.ts` maps mechanics to tracking, reaction and burst/spread control; game sense to perception cadence, target priority, threat-aware paths, cover and reload assessment; teamwork to report latency, flash-risk evaluation and trade spacing; clutch to pressure-related reaction/spread penalties; stamina to exertion-related execution penalties; flexibility to replanning cadence; and leadership to changing a stalled attack. Personality and system fit continue through the existing probabilistic action scorer. No personality adds a universal combat-stat buff.

`fpsLiveSimulation.ts` now uses delayed teammate reports, uncertain heard-shot locations and bounded contact memory. Target acquisition requires the actor's own sightline; information updates do not track unseen enemy movement. Target preference has commitment, and a firing lane blocked by an ally prompts a sidestep. Repositioning and reloading can happen behind cover. Rifle bursts recover between strings. A failed attack can provoke a caller-led site change from known teammate losses. Device recovery chooses one recoverer; retakes choose a defuser by reach/kit/channel progress and give the other players covering posts. Impossible defuse timing can trigger equipment preservation. Objective channel urgency can resist distant combat distractions while recent damage remains relevant. The public HUD shows a callout and qualitative current intent, not private DNA.

`fpsLiveMap.ts` splits the central warehouse into two blocks with a service connector, adds staggered staging/retake cover and asymmetric site obstacles, and defines distinct staging, entry, hold and post-plant positions. A* can weight exposure to remembered contacts; it never consults hidden enemy positions for route costs. Invalid tactical destinations are projected into traversable space. Shared geometry continues to determine rendering, movement and shot blocking.

`fpsLiveScenery.ts` adds static industrial facade/shutter/window detail, container ribs, roof hardware, signs and exterior harbor scenery. Decorative facade pieces are merged by material. Exterior scenery is outside playable bounds; plates hug existing wall colliders. No new character meshes, rigs or animation-processing pipeline was authored. `fpsLiveViewer.ts` adds sunlight shadows, paving detail, camera damping and a director with interest scoring and minimum cut intervals. Follow-camera smoothing still checks walls. The HUD uses the effective camera mode for flash/crosshair presentation, including director-selected first person.

Focused verification, without the full game suite or production build:

- TypeScript check passed (`.local-tools/fps-live-improvement-types.log`).
- `.local-tools/fps-live-improvement-smoke.mjs`: 9,000 fixed steps on two identical seeds; exact snapshot agreement, valid/reachable tactical positions, wall exclusion, differentiated attribute formulas and private-DNA exclusion. The sample reached round 5 at 2–2 with 36 kills. This is not balance or pro-AI qualification.
- `.local-tools/fps-live-browser-smoke.mjs`: isolated headless Chromium opened the real local page and 3D renderer, clock advanced from 0:15 to 0:13, zero application exceptions. Overview screenshot was inspected at `.local-tools/fps-live-improvement-browser/overview.png`; result is alongside it. The initial browser harness needed sandbox-compatible launch flags and corrected CDP close handling; these are test-harness changes only.

Player models remain collision proxies. Navigation/combat remain on a flat plane with body hitscan and simplified utility deployments; only the previously documented three specialty shot hooks are spatially integrated. Full-match browser behavior, mobile presentation of this pass, long-term balance, sound, production assets and shared online broadcasting remain unqualified or unfinished.

## Current implementation boundary

The original live FPS exhibition is connected to `#fps-simulation` through **Watch live 3D match**, also linked from Settings. `/root` owns the simulation, renderer and UI integration; no agents or asset jobs were dispatched. Initial integration skipped checks at the owner's request; the improvement pass above records the later focused verification. No production deployment verification is claimed.

Official FPS v3 matches still use the existing zone-level worker and completed-report replay. The new mode is browser-local and cannot settle official results or write career progression. Exiting/reloading ends the local exhibition. A shared server-authoritative online broadcast is still pending.

Implemented files:

- `src/fps/fpsLiveMap.ts`: original Breakwater Yard map, metre-scale shared colliders/render dimensions, grid navigation and collision-safe path smoothing.
- `src/fps/fpsLiveSimulation.ts`: seeded 30 Hz simulation, ten roster-based AI players, skill-based role assignment, observed-context identity decisions, preparation/rotation, wall and actor movement collision, limited forward vision, smoke occlusion and team contact reports. Body hitscan uses geometric intersections, skill-dependent aim spread, nearest blocker, ammunition, reloads and armor. Teammates block shots without taking friendly damage.
- Economy and objectives: 15-second buys, 115-second live clock, 3.2-second plant, 40-second device, 5/10-second defuse, interruption, dropped-device recovery, eliminations, seven-second round intermission, preserved survivor equipment, purchases and capped earnings. MR15 regulation switches sides at 16; tied matches use repeated six-round overtime blocks and three-round side changes.
- Identity adapter: uses the existing validated exhibition identities, coaches, gameplans, chemistry and probabilistic action scorer. Prepared long angle, allied flash and immediate trade are the three spatial specialty hooks currently implemented. The remaining specialties retain their official v3 implementation but do not yet have live spatial effects. No raw identity state is included in public live snapshots.
- `src/fps/fpsLiveViewer.ts`: Babylon scene consuming snapshots, interpolation, map geometry, collision-volume player proxies, shot traces, smoke, device, first-person follow, collision-clipped third-person follow, overview and automatic director. The renderer cannot create damage or change results.
- `src/components/FpsLiveBroadcast.tsx` and `fps-live-broadcast.css`: score/time, observer minimap, roster selection, recent events, observed-player panel, fullscreen, pause, camera selector and scoped keyboard controls. Hidden tabs pause the local exhibition; it does not silently fast-forward. Graphics errors expose a restart rather than claiming a running broadcast.
- `src/components/FpsSimulationLab.tsx` and `src/App.tsx`: launch path, existing exhibition input reuse, separate recorded tactical matches and Settings entry.

Rendering uses runtime collision markers only, not generated character meshes, skins, rigs or animation assets. No retired or failed avatar binaries were restored. Realistic character/weapon art remains subject to the existing owner-started Colab pipeline.

## Work remaining

1. Extend verification beyond the focused checks above: full production build, objective timing and interruption, side changes/overtime, camera lifecycle, complete desktop/mobile matches and performance.
2. Expand the spatial game beyond the current flat movement plane and body hitscan: elevation, stance, richer weapon handling, utility trajectories, sound, seven-role coordination and full contextual specialty parity. Current flashes/smokes are simplified immediate deployments and behavior is a prototype rather than pro-level FPS AI.
3. Improve and qualify the map and broadcast presentation against the owner's references. Collision capsules are not finished player models; no Counter-Strike-level fidelity is claimed.
4. Integrate a separately versioned official worker, persistent live delivery, recovery and spectator synchronization; preserve existing v2/v3 allocations and replay. Verify settlement, security, reproducibility, performance and migration before activation.
5. Obtain and qualify original character assets through the existing owner-started Colab-only generation, rigging and animation workflow. Current avatar candidates are unqualified; no local generation, rigging, animation processing or asset publication is authorized.

The existing browser title already uses Hexatrick. User-facing branding should use that name; internal identifiers, storage keys, deployment names and historical artifacts must not be blindly renamed, since they may be compatibility boundaries. MOBA remains preserved and disabled through Laravel.
