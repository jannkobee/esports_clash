# Proposed detailed FPS attribute model

Later owner revision: [the adopted 25-ability local rollout](fps-attributes-25-20261111.md) supersedes this 26-field proposal. This original proposal remains historical.

Status: planning only. The owner asked on 10 November 2026 what FPS attributes should be added and explicitly requested a plan before implementation. No schema, player ratings, gameplay, training, UI or deployment is changed by this proposal. `/root` owns this planning pass; no agents or asset jobs were dispatched.

This refines the earlier proposed 26-ability target in [the professional skill mapping](fps-professional-skill-reference.md). The 26 below are a recommended future schema, not 26 existing independent ratings. It applies the supplied [pro-match reference](fps-crosshair-reference-20261110.md) and the implemented [information-play boundary](fps-information-play-20261110.md). Existing role/personality/specialty/individual-DNA/system-fit distinctions remain.

## Findings in the current code

`PlayerAttributes` in `EsportsClash.Web/src/types.ts` stores the legacy `lan`, `tf`, `iq`, `ldr`, `clu`, `sta` and `flx` values. `fpsLiveAttributes.ts` translates them into mechanics, teamwork, game sense, leadership, clutch, stamina and flexibility. These are broad bridges rather than separately scouted FPS skills.

- Mechanics currently contributes to reaction delay, turn speed/correction, aim spread, burst length/headshot probability and braking execution.
- Game sense contributes to perception cadence, reaction, decisions, sound localization, cover/path assessment and interpreting pressure. Better perception and better interpretation cannot currently be represented independently.
- Teamwork contributes to report latency/quality, spacing, release timing and flash-risk assessment. Communication and trading cannot vary independently.
- Clutch/stamina/flexibility/leadership bridge pressure, exertion, replanning and calling, but do not provide a complete mental/skill profile.
- Card data is described as fine-grained internal values with a 1–10 UI, while the live laboratory currently edits seven attributes on a 1–20 display. The proposed FPS profile should use a consistent 1–10 presentation with fine internal precision.

Relevant implementation: `src/fps/fpsLiveAttributes.ts`, `fpsLiveSimulation.ts`, `fpsLiveAim.ts`, `fpsLiveMovement.ts`, `fpsLiveIntel.ts`, `fpsRoleFit.ts`, `src/components/FpsSimulationLab.tsx`, and backend `FpsIdentityProfiles` / `FpsIdentityEngine`. Official contextual v3 is a separate engine and must have its own explicitly versioned integration later.

## Recommended core: 26 attributes

Every displayed rating ranges from 1 to 10. Higher means greater competence/reliability in the named task, not a more aggressive personality. Preserve finer internal precision so training progress is not limited to nine visible jumps. A rating of 10 remains bounded by visibility, resources, physics and uncertainty.

### Execution: 10

| Attribute / proposed key | Primary simulation responsibility | Boundary |
| --- | --- | --- |
| Reactions / `reactions` | Delay from noticing a relevant cue to starting the selected response. | Does not improve crosshair position, information certainty or turn speed. |
| Crosshair Placement / `crosshairPlacement` | Quality of initial pre-aim: selecting the likely angle, clearance and expected target height before exposure. | Uses known geometry and beliefs. Low ratings create poorer preparation, not constant idle swaying; high ratings do not locate unseen enemies. |
| Flicking / `flicking` | Execution of a large correction after a newly acquired target appears. | Controls large-angle acquisition, distinct from first noticing the target and fine correction. |
| Tracking / `tracking` | Following a moving target using the actor's own sampled observations. | Can estimate motion from observed history; cannot sample hidden live coordinates. |
| Precision / `precision` | Small final aim corrections and residual stationary aiming error. | Remains subject to weapon dispersion and actual geometric intersections. |
| Recoil Control / `recoilControl` | Compensation quality and recovery during bursts/sprays. | Requires explicit recoil state before activation; does not modify weapon damage or grant automatic headshots. |
| Movement Control / `movementControl` | Stop/input timing, counter-strafe execution and movement-to-shot synchronization. | No extra base movement speed, altered collision size or illegal movement. |
| Peeking / `peeking` | Executing a selected exposure width, timing and return to cover. | Tactical decisions choose the attempt; movement control executes the physical input. New peek types require real supporting mechanics. |
| Weapon Handling / `weaponHandling` | Reload/switch sequencing, ammunition management and avoiding handling mistakes. | Weapon-specific mandatory draw/reload times remain weapon rules; skill affects decisions/avoidable hesitation. |
| Utility Execution / `utilityExecution` | Throw placement, release timing and lineup execution error. | Utility purpose/selection comes from tactical judgment. Inventory, collision, fuse and friendly effects remain real. |

### Tactical and information: 7

| Attribute / proposed key | Primary simulation responsibility | Boundary |
| --- | --- | --- |
| Awareness / `awareness` | Selecting/noticing relevant legally available visual and audible cues under competing demands. | Does not extend sight through walls, improve hearing range or identify an anonymous footstep. |
| Information Reading / `informationReading` | Interpreting source, age, uncertainty, corroboration and possible deception; maintaining plausible beliefs. | Cannot turn an unscouted area into known empty space. Awareness notices; this skill interprets. |
| Positioning / `positioning` | Choosing useful cover, exposure, escape routes and complementary angles. | No defense/armor bonus for standing in a chosen position. Geometry must produce the benefit. |
| Timing / `timing` | Choosing when to peek, rotate, contest, lurk or use an opportunity. | Reactions governs the response after a cue, not strategic timing. |
| Decision Making / `decisionMaking` | Comparing objective value, tactical risk, time/resource cost and legal alternatives. | Decisions may still fail because the available information was wrong. |
| Adaptability / `adaptability` | Recognizing that evidence invalidates a plan and competently rebuilding the action sequence. | Distinct from the DNA tendency to welcome change and from role/weapon familiarity. |
| Economy Judgment / `economyJudgment` | Assessing buy/save/recovery options and future-round equipment cost. | No extra cash, discounts, duplicated guns or guaranteed perfect buys. Team orders and real budgets still apply. |

### Team execution: 4

| Attribute / proposed key | Primary simulation responsibility | Boundary |
| --- | --- | --- |
| Communication / `communication` | Timeliness, clarity, usefulness and uncertainty calibration of first-hand callouts. | Team chemistry affects how the relationship functions; it is not another copy of this personal ability. Reports retain original observation time. |
| Trading / `trading` | Maintaining a viable follow-up lane/spacing and recognizing the opportunity to answer contact. | Does not improve aim/damage or extend the established trade-credit window. |
| Coordination / `coordination` | Executing agreed utility, entry, coverage and objective sequences with teammates. | Role familiarity is contextual experience; DNA discipline is willingness/adherence preference. Do not apply all three as blanket buffs. |
| Calling / `calling` | Forming and communicating a coherent team plan from available evidence and revising responsibilities. | Coach plan, personality and teammate acceptance remain separate influences. No privileged view of enemy plans. |

### Mental and endurance: 5

| Attribute / proposed key | Primary simulation responsibility | Boundary |
| --- | --- | --- |
| Composure / `composure` | Stability of execution and judgment under immediate pressure. | Does not raise the player's baseline aim skill. |
| Concentration / `concentration` | Sustaining attention and avoiding lapses during prolonged or divided-demand tasks. | Awareness is cue-selection competence; concentration governs maintaining it over time. |
| Consistency / `consistency` | Bounded attempt-to-attempt variability around the same underlying skill/context. | Changes variance, not the mean; no random irrational-action switch or winner selection. |
| Resilience / `resilience` | Recovery of temporary focus/confidence after mistakes, setbacks and lost rounds. | Distinct from initial pressure resistance and private personality/emotional tendencies. Requires an actual recoverable match state. |
| Stamina / `stamina` | Rate of exertion-related degradation and recovery during sustained play. | Distinct from tilt and mistake recovery; no additional HP or running speed. |

The distribution is 10 execution + 7 tactical + 4 team + 5 mental = 26. This intentionally separates reactions and crosshair placement, while reducing overlap in the earlier raw-aim/precision/reflex taxonomy.

## Context that should stay outside the 26

- Map familiarity: per-map experience with angles, route timings, common positions and lineups. A player can know Breakwater well and be unfamiliar with a future map. It is not a global intelligence rating.
- Weapon familiarity: per weapon/family, with explicit experience. This changes how fully the player applies a relevant skill, not weapon specifications.
- Role and system familiarity: preserve existing contextual development and assignments, not new duplicate universal attributes.
- Personality/DNA: preserve preferences such as risk tolerance, patience, willingness to improvise and emotional tendencies. They must not supply free mechanical competence or be exposed in scouting.
- Situational specialty: preserve its narrow verified opportunity and existing effect boundaries, not an always-on bonus stacked over a matching core attribute.
- Form, confidence, exertion and pressure: temporary states with recorded causes and recovery, not values rerolled into permanent ratings every match.
- Coachability, potential and learning rate: development/scouting concepts outside the match-execution core. Do not infer them from reaction speed or kills.

## How the values should drive play

Use a staged attempt model:

1. Legal world cues become available through sight, sound, teammate communication and objective rules.
2. Awareness and current concentration govern noticing/attention; information reading governs interpretation.
3. Decision making, positioning, timing, calling and current team orders select an attempt using the player's beliefs and identity preferences.
4. Crosshair placement determines preparation before exposure. Reactions governs response latency after noticing; flicking/tracking/precision govern distinct correction phases.
5. Movement, peeking, handling, recoil and utility skills govern execution errors/timing of the chosen action.
6. Physical simulation resolves movement, occlusion, shots, damage, utility and objectives. Outcomes feed actual telemetry and temporary mental state.

Do not add a single average of 26 ratings to a generic win/accuracy roll. Each primary effect belongs to a specific stage. Interaction terms must not apply the same cause twice. For example, a low Reactions rating should not independently slow sensory detection, turn speed and bullet release in three unrelated formulas.

Illustrative Reactions tuning candidates: 1 ≈ 450 ms, 5 ≈ 300 ms, 10 ≈ 180 ms of noticed-cue-to-response delay, before temporary state and seeded bounded variation. These are proposed game parameters, not measured human/player claims or approved balance. The 30 Hz engine quantizes observable timing; final curves must be monotonic, bounded and tested on actual ticks. Weapon lockouts and reaction-to-one-stimulus timing remain separate.

Crosshair Placement must alter initial prepared-angle error/quality. A lower value may prepare the wrong nearby plausible angle or have a larger initial offset, with stable commitment. A higher value reduces unnecessary correction when the inferred threat appears. Neither value can move the screen reticle away from centre or reintroduce idle left/right scanning. Height-sensitive quality needs real vertical aiming/hit geometry before being claimed.

## Seven compact summaries and manager UI

Retain a compact card, with an expandable full FPS profile using full names grouped into four sections. Standardize the new FPS UI at 1–10; keep finer values internally. Show scouting confidence/provenance, roles and contextual familiarity separately. Use side-by-side comparison rather than 26 tiny abbreviations.

| Existing FPS card field | Proposed compact summary |
| --- | --- |
| LAN | Mechanics — execution profile summary |
| TF | Teamplay — communication, trading and coordination |
| IQ | Tactics — tactical/information profile summary |
| LDR | Calling |
| CLU | Composure |
| STA | Stamina |
| FLX | Adaptability |

Once the new profile is authoritative, summaries are derived for display/role fit and do not get applied again as simulation modifiers. Their exact weights need calibration and UI review. Existing MOBA meanings, stored fields, historical cards/results and pinned official profiles remain intact. No summary or new attribute is a universal best-player score. Role fit must use the relevant detailed abilities: for example, an entry values preparation/reaction/peeking/movement, a trader values spacing/awareness/follow-up aim, a support values utility/communication/coordination, and a caller values information/decisions/calling.

## Data, migration and scouting plan

1. Add a separate versioned FPS skill profile; do not expand/repurpose the shared legacy `PlayerAttributes` in place. Proposed metadata includes schema version, player ID, attribute values, source/initialization version, revision, timestamps and per-attribute scouting confidence/evidence.
2. Distinguish authoritative simulated ability from the manager's scouting estimate. A generated profile is generated, not measured. Scouting should expose estimates/ranges when evidence is weak and narrow them from relevant samples.
3. Existing seven values cannot establish 26 independent truths. Preserve them and support an explicit legacy profile path. Proposed backfill, if later approved, uses stable, bounded, aggregate-preserving estimates labeled `legacy_estimate_v1`; never silently invent precise reactions from kills or duplicate LAN into every mechanical subrating. Do not use personality badges as skill evidence or reroll private DNA.
4. New generated players receive persistent varied skill distributions with documented generation provenance and strengths/weaknesses. No reroll on page refresh, transfer or match start. Preserve stable IDs, tiers and age/development constraints.
5. Snapshot profile version/revision into newly versioned match allocations only when the engine supports it. Historical official v2/v3 and existing replay/settlement paths continue with their pinned rules. Start in the local exhibition/shadow comparison path; official migration/activation is a later explicit step.
6. Reuse idempotent development/settlement. Training targets a named ability; experience improves only supported skills with opportunity/sample limits. Damage, K/D, first-hit time or one clutch cannot directly reveal or award all contributing abilities. Protect economy, transfer and career consequences from uncalibrated profile inflation.

## Delivery order after approval

**Phase 1 — schema and 12 high-value behavior controls:** Reactions, Crosshair Placement, Flicking, Tracking, Precision, Movement Control, Awareness, Information Reading, Decision Making, Communication, Composure and Stamina. Implement their independent consumers in the local exhibition with editable test profiles and profile provenance before publishing ratings as active features.

**Phase 2 — richer actions and team play:** Recoil Control, Peeking, Weapon Handling, Utility Execution, Positioning, Timing, Adaptability, Economy Judgment, Trading, Coordination and Calling. Add necessary mechanics first, then connect these 11 ratings. In particular, explicit recoil, measured utility execution error, exposure-aware positioning and economy evaluation must exist before those labels claim independent simulation effects.

**Phase 3 — sustained performance:** Concentration, Consistency and Resilience, backed by bounded temporary match state, recovery rules and telemetry. Avoid multiplying several generic mental penalties into the same shot.

**Phase 4 — careers and official activation:** calibrated profile generation/backfill, scouting and training UI, role-fit updates, immutable allocation versioning, official adapter integration, historical/replay/idempotency checks and explicit activation. No automatic production rollout is part of this plan.

## Acceptance criteria

- Controlled one-attribute interventions, with paired seeds and fixed geometry/equipment/information, change the intended behavior and do not grant unrelated abilities.
- Reactions changes noticed-cue-to-response timing; Crosshair Placement changes pre-contact angular error/correction demand. Neither creates perception through cover or idle aim oscillation.
- Flicking, tracking and precision have separate test situations/telemetry. Explicit head geometry/recoil behavior must pass before related claims are made.
- Awareness and information reading change lawful cue processing and inference, while report age, anonymity and uncertainty remain preserved.
- High skills remain fallible; different low/high combinations yield distinguishable strengths and tradeoffs. A player can be fast but poorly prepared, or well positioned but slower to react.
- Role fit and outcomes are evaluated over multiple contexts, not raw kill-only ranking. No identity/personality combination is a universal strongest class.
- Attribute averages do not accidentally apply twice through summaries, role fits, specialties or legacy adapters.
- Public scouting never reveals raw DNA; generation is stable, development idempotent, and historical official/MOBA paths retain exact behavior.
- Run targeted diagnostics plus repository-required game checks/build during implementation; planning-only documentation does not require executing gameplay tests.

Recommendation for approval: adopt the 26-attribute target and consistent 1–10 FPS presentation, preserve seven compact summaries, and implement the 12 Phase-1 consumers in the local exhibition before any official profile migration.
