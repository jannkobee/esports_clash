# Professional FPS skills: Hexatrick design reference

Latest live information work: [exhibition v5 memory, communication and evidence-based calling](fps-information-play-20261110.md). This supplies bounded multi-contact source/confidence memory; richer learned opponent models remain future work.

Additional owner-supplied reference: [pro-match analysis and stable crosshair correction](fps-crosshair-reference-20261110.md), with exact source/hash, adopted principles, implemented scope and remaining gaps.

Owner supplied this reference on 10 November 2026 and requested its use for Hexatrick. The exact supplied text is retained in [the source file](references/fps-professional-skills-20261110.txt), SHA-256 `db802ed0e420803da954489dfea67aa23f89b27688a551207bf2d748dacdb102`.

This is an owner-provided analytical reference, not verified Valve documentation. Its unnamed external citations and patch-specific CS2 claims have not been independently verified. It guides our original game's skills and decisions; it does not silently import another game's maps, equipment rules or rating system.

## Design decisions adopted

- Micro, macro, team and mental performance interact. Mechanics determine execution quality, while available information, resources, timing and positioning determine which attempts make sense.
- The 205 listed items are a behavior and opportunity checklist, not 205 independent ratings. The suggested 26 core abilities are a target schema for future detailed player development, not existing independently measured values.
- Preserve the five-layer identity design: role, personality, situational specialty, individual traits and dynamic system fit. Personality changes preferences; it cannot manufacture information, remove legal constraints or grant raw aim/damage. Confidence is not aggression. Patience is not automatic tactical correctness.
- Primary roles remain the seven approved roles. Rotating, secondary sniping, closing, aggressive playmaking and flexible coverage can be responsibilities within those roles, with side-specific assignments. Caller can accompany a combat role.
- Measure contributions with opportunity/sample context. Support utility, traded deaths and objective work can matter more than personal kills. Do not produce a universal strongest identity combination or a kill-only overall impact rating.

## Core-ability target and existing bridge

| Target group | Proposed underlying abilities | Current live bridge |
| --- | --- | --- |
| Mechanical, 8 | Raw aim, precision, reflexes, recoil control, movement, peeking, weapon handling, utility execution | Mechanics plus geometry, weapon state and situational execution |
| Tactical, 8 | Game sense, positioning, timing, awareness, decision-making, adaptability, map knowledge, economy understanding | Game sense and flexibility; known map, observed contacts, timer and resources |
| Team, 5 | Communication, coordination, leadership, role understanding, tactical discipline | Teamwork and leadership, role assignment and persisted identity/system fit |
| Mental, 5 | Composure, concentration, consistency, resilience, learning capacity | Clutch/stamina, match pressure and exertion; identity tendencies remain distinct |

The live seven-attribute bridge remains the implemented player model. Do not claim its weighted interpretations are 26 independently scouted abilities, invent a detailed profile from a personality badge, or reroll persistent DNA. Introducing the full model requires explicit profile provenance, versioned persistence/migration, scouting confidence, training behavior and compatibility with existing players. Learned tactical discipline describes execution of a protocol; a DNA tendency describes willingness to follow it. They must not become duplicate blanket bonuses.

## Implementation map and priorities

| Reference area | Current spatial implementation | Next substantive gap |
| --- | --- | --- |
| Aim and weapon handling | Geometric body hits, acquisition delay, tracking turn rate, bounded spread, burst recovery, ammunition and cover-aware reloads | Separate movement velocity/stop accuracy, weapon-specific recoil state, head-height aiming and head hit volumes |
| Movement and peeking | Swept collision, velocity/braking, quiet walking and running perception, physical jiggle peeks, sequential angle checks and exposure-weighted paths | More peek choices; crouch, jumps and elevation |
| Perception and information | Own-vision acquisition, smoke occlusion, delayed team reports, uncertain shot sound and bounded contact memory | Per-contact confidence/source, multiple remembered opponents and timing-aware belief updates |
| Utility | Ballistic flash/smoke with collision/fuses, coordinated utility-to-entry window, friendly flash assessment, three situational shot-specialty hooks | Throw-error skill detail, explosives/fire, utility denial and remaining specialty opportunities |
| Defaults and executes | Shared default/contact/split/rush protocols, Mid splits, ordered entry/trade/carrier movement, tempo and caller changes after known setbacks | Richer information-driven defaults, credible fakes and counter-utility |
| Defense and objectives | Anchoring posts, reported-contact support, one recoverer/defuser, covering posts, clock-aware save and channels | Crossfire/angle exposure scoring, evidence-sensitive rotations, coordinated retake timings and defuse deception |
| Economy | Cash, survival equipment, shared buy/eco/half/force plans and paid weapon handoffs | Opponent-economy estimates, tactical weapon recovery and more detailed resource planning |
| Mental and development | Pressure and exertion affect attempts; official v3 has event-derived persistent development | Match-level composure/recovery and detailed ability learning with clear coaching/training provenance |
| Match/series strategy | Seeded individual exhibition and official tactical match paths | Observed opponent tendencies, prepared map/side plans and series-level adaptations |

Implement the next micro/macro gaps from observed state and actual executable actions. A decorative decision label, arbitrary animation or unconditional stat modifier does not implement counter-strafing, a fake, a crossfire or a specialty.

## First applied change: measured live impact

`fpsLiveImpact.ts`, `fpsLiveSimulation.ts` and `FpsLiveBroadcast.tsx` now collect and present a **Player impact beyond kills** table. This is read-only accounting and does not affect match RNG, decisions, combat or official career settlement.

| Measure | Exact current definition |
| --- | --- |
| Damage | Enemy health actually removed by geometric hits; excludes armor absorption and overkill |
| Opening attempts / wins | A player fires before the round's first elimination / scores that first elimination. Each player's attempt counts once per round; simultaneous openings elsewhere can create several attempts |
| Trade kills | A killer is eliminated within 1.5 seconds of killing a teammate; one trade kill per responding elimination |
| Traded deaths | Each qualifying teammate death answered in that window, counted once even if several deaths are answered by the same elimination |
| Flash assists | A teammate's flash is still actively blinding the eliminated opponent; shooter cannot assist themself |
| First-shot hits | Enemy hits on the first shot after target acquisition, with explicit sample denominator. This is not a headshot metric |
| Time to damage | Time from acquisition to first damage of that acquired target, averaged over successful sampled engagements. Miss-only engagements have no damage-time sample |
| Unused utility on death | Unspent flash and smoke inventory at elimination; a count, not a claim that using every grenade would have been correct |
| Survival | Survived completed rounds / completed rounds; incomplete rounds are excluded |
| Objective work | Completed plants and completed defuses |

No headshot percentage, utility damage, map-control success, KAST or role-adjusted aggregate is shown without the corresponding implemented mechanics and attribution. These metrics are interpretation aids; role, equipment, opponents, opportunity count and round context remain essential. Detailed evidence remains local to the exhibition.

Hexatrick currently conserves reserve ammunition during reloads. The source's claimed CS2 patch rules are not adopted by this reference decision.

## Verification and scope

TypeScript passed (`.local-tools/fps-live-reference-types.log`). The focused `.local-tools/fps-live-impact-smoke.mjs` uses controlled geometric encounters to verify opening attribution, overkill exclusion, traded-death attribution, active allied flash assists, acquisition-to-damage samples, completed-round survival and immutable public accounting snapshots. No full suite, production build or new browser review was run for this reference/measurement change. The metrics do not claim that the unimplemented mechanics in the mapping are now available.
