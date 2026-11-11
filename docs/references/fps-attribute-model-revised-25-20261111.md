# FPS Player Ability Model — Revised Architecture Proposal (25 Attributes)

**Status:** Planning proposal only. No schema, player ratings, gameplay, training, UI, production rules, or deployment has been changed by this document.

**Purpose:** Define believable, varied, scoutable FPS competitors for an esports management simulation. Abilities should influence the *process* of perception, decision-making, execution, communication, and recovery. They should not directly choose winners, guarantee headshots, or grant hidden information.

**Source context:** This revision builds on the supplied November 10, 2026, 26-ability proposal and its cited `fps-professional-skill-reference.md`, `fps-crosshair-reference-20261110.md`, and `fps-information-play-20261110.md`. The code observations below are carried from that proposal, **not independently re-audited against the repository**. Existing role, personality, specialty, individual DNA, coach/system fit, and official-engine boundaries remain in force.

## 1. Review decisions

| Change | Decision | Rationale |
| --- | --- | --- |
| Remove `weaponHandling` from the global attribute model | **Remove** | Reload/switch choices belong primarily to decision-making and weapon familiarity; mandatory weapon durations belong to weapon mechanics. A separate rating would be hard to observe without invented mistakes or duplicate penalties. Revisit only if the engine gains a demonstrably independent handling mechanic. |
| `economyJudgment` | **Keep but gate** | Legitimate for a player who can recommend or choose purchases. If buys are fully coach/IGL controlled, expose no individual effect until player agency exists. |
| `consistency` | **Keep, carefully bounded** | Produces stable versus volatile players. It controls contextual variance rather than increasing their mean ability; do not use it as a hidden match-winner modifier. |
| Add more universal skills | **Do not add for now** | Anticipation, opponent reading, noise discipline, utility selection, and retake knowledge can emerge from existing skills plus contextual knowledge. Prove a distinct causal consumer before inventing another rating. |
| Opponent learning, human-like behavior, coach fit, and training | **Add as systems** | These are needed for expressive differences and cannot be repaired by simply adding more numeric ratings. |
| User interface | **Retain seven compact summaries** | The 25 detailed attributes are the authoritative FPS profile once migrated; compact legacy-style labels become display summaries only. |

**Target: 25 ratings — 9 execution + 7 tactical/information + 4 team execution + 5 mental/endurance.** Ratings are displayed on **1–10**, with bounded finer precision internally. A 10 represents exceptional ability, not certainty. Generation can use correlated skill clusters, but *simulation effects must remain separable and attributable*.

## 2. Reported current-code findings and boundaries

The supplied proposal reports that `PlayerAttributes` in `EsportsClash.Web/src/types.ts` stores legacy `lan`, `tf`, `iq`, `ldr`, `clu`, `sta`, and `flx` values. `fpsLiveAttributes.ts` maps them into mechanics, teamwork, game sense, leadership, clutch, stamina, and flexibility. The live laboratory reportedly edits seven fields on a 1–20 display while cards are described as 1–10.

Reported coupling risks in the current bridge:

- **Mechanics** simultaneously affects reaction timing, aim, burst/headshot behavior, and braking.
- **Game sense** affects perception, interpretation, decisions, audio understanding, and position assessment.
- **Teamwork** affects reporting, spacing, contact support, and flash safety.
- **Clutch/stamina/flexibility/leadership** cover broad states or duties without independent scouted skills.

Files referenced by the supplied proposal: `src/fps/fpsLiveAttributes.ts`, `fpsLiveSimulation.ts`, `fpsLiveAim.ts`, `fpsLiveMovement.ts`, `fpsLiveIntel.ts`, `fpsRoleFit.ts`, `src/components/FpsSimulationLab.tsx`, backend `FpsIdentityProfiles`, and `FpsIdentityEngine`. Resolve actual paths and implementations in the repository before editing. **Official contextual v3 is a separate, version-pinned engine and requires an explicit later adapter.** Preserve historical official v2/v3 and MOBA behavior.

## 3. The 25 core attributes

Each rating needs (a) a specific gameplay consumer, (b) a scenario that reveals it, (c) telemetry that measures its direct effect, and (d) a non-overlapping boundary. **No generic averaging into an accuracy, win-chance, or IQ roll.**

### A. Execution — 9

| Attribute / key | Owns | Must not do |
| --- | --- | --- |
| **Reactions** / `reactions` | Time from *noticed* actionable stimulus to initiating a selected motor response. | Change whether a cue was noticed, predict hidden targets, increase turning speed, or bypass weapon lockouts. |
| **Crosshair Placement** / `crosshairPlacement` | Prepared angle and initial angular/height alignment using the actor's beliefs and known geometry. | Reveal unseen opponents, oscillate aim while idle, or move the UI's screen-center reticle. |
| **Flicking** / `flicking` | Execution of substantial initial angular corrections to an acquired target. | Reduce cue latency or replace fine correction/tracking. |
| **Tracking** / `tracking` | Sustained following of moving targets using only actor-observed samples and motion estimates. | Access the target's hidden current coordinates or guarantee hits through obscuration. |
| **Precision** / `precision` | Fine terminal correction and residual aim-input error. | Remove weapon spread, change damage, or award direct headshot percentages. |
| **Recoil Control** / `recoilControl` | Input compensation and reset quality while *real recoil state* exists. | Invent recoil, change the weapon's recoil specification, or force a hit. |
| **Movement Control** / `movementControl` | Input/braking synchronization, counter-strafe, traversal fidelity, and timing of a shot after stopping. | Raise base movement speed, shrink collision, or allow impossible locomotion. |
| **Peeking** / `peeking` | Fidelity in executing a *chosen* jiggle, shoulder, wide, or re-peek exposure and return. | Select the tactical reason to peek or grant immunity while exposed. Requires real exposure mechanics. |
| **Utility Execution** / `utilityExecution` | Release timing, trajectory/placement error, and execution reliability for a chosen legal throw. | Select the utility's purpose, create equipment, ignore collision/fuse, or suppress friendly effects. |

**Removal:** There is no `weaponHandling` rating in the target profile. Avoidable reload/switch *choices* come from decision-making, team orders, and context; practiced handling knowledge comes from weapon familiarity. Weapon animations, lockouts, and exact reload times remain equipment rules. If later design work proves an independent measurable motor-handling mechanic, propose it as a separately versioned change rather than silently restoring this field.

### B. Tactical and information — 7

| Attribute / key | Owns | Must not do |
| --- | --- | --- |
| **Awareness** / `awareness` | Allocation of attention to available visual, auditory, and reported cues. | Expand legal visibility/hearing range or identify an anonymous sound with certainty. |
| **Information Reading** / `informationReading` | Quality of inference from cue source, recency, confidence, contradictions, fake pressure, and observed opponent patterns. | Transform unknown space into known empty space, or access actual enemy intent. |
| **Positioning** / `positioning` | Choice of cover, angle, escape route, crossfire geometry, and positional advantage. | Add an abstract armor/damage buff; advantage must emerge from the world geometry. |
| **Timing** / `timing` | Strategic choice of *when* to peek, rotate, stall, split, contest, or reveal position. | Duplicate cue-to-response Reactions or raw movement speed. |
| **Decision Making** / `decisionMaking` | Comparing legal tactical options, likely outcomes, resources, objective priority, and uncertainty. | Guarantee the right answer when evidence is incomplete; override personality/coach decisions by fiat. |
| **Adaptability** / `adaptability` | Detecting when a plan is no longer viable and constructing a coherent replacement. | Create an intrinsic desire to improvise (personality/DNA owns willingness), or instantly abandon a committed action. |
| **Economy Judgment** / `economyJudgment` | Quality of player-level buy/save/force assessment *when the player has buy influence*. | Add money, discount items, override real team budget, or act when purchasing is completely controlled elsewhere. |

### C. Team execution — 4

| Attribute / key | Owns | Must not do |
| --- | --- | --- |
| **Communication** / `communication` | Clarity, speed, calibration, and brevity of reports derived from personal observations. | Turn a teammate's stale report into fresh direct vision or replace team chemistry. |
| **Trading** / `trading` | Maintaining a follow-up lane and distance, recognizing contact, and attempting timely support. | Improve aim/damage directly or award credit outside real encounter timing. |
| **Coordination** / `coordination` | Synchronizing agreed utility, entries, coverage, defuses, plants, and retakes. | Apply blanket buffs on top of role familiarity, team chemistry, or personality discipline. |
| **Calling** / `calling` | Composing, prioritizing, and revising coherent team plans from the caller's known evidence. | See enemy plans, force universal obedience, or replace the coach's system identity. |

### D. Mental and endurance — 5

| Attribute / key | Owns | Must not do |
| --- | --- | --- |
| **Composure** / `composure` | Resistance to immediate pressure-induced degradation during execution/decision-making. | Raise baseline ability or award automatic clutches. |
| **Concentration** / `concentration` | Sustaining attention through inactivity, repeated demands, and cognitive load. | Duplicate underlying Awareness or general fatigue resistance. |
| **Consistency** / `consistency` | Conditional trial-to-trial performance variation when skill/context are held constant. | Change expected mean skill or select favorable match outcomes; handle bounded noise without systematic clipping bias. |
| **Resilience** / `resilience` | Speed and stability of recovering from an actual setback-induced temporary loss of focus/confidence. | Equal initial pressure resistance or personality's preferred emotional response. |
| **Stamina** / `stamina` | Resistance to sustained cognitive/physical exertion and recovery between demanding segments/maps. | Give HP, player speed, generic clutch bonuses, or unrealistic fatigue after every short movement action. |

**Independence means distinct causal roles, not zero correlation.** High Precision and Flicking may often co-occur in player generation. They should still drive different parts of the simulation and allow plausible exceptions.

## 4. Important systems to add without adding attributes

### 4.1 Legal knowledge, sensory delay, and uncertain beliefs

An actor's decisions must use an **actor-local knowledge snapshot**, not the omniscient world state. Every observation/report should be representable by its source, observation time, receipt time, approximate location/identity if known, reliability, and expiry or decay. An old spotted opponent is not permanently locked to that spot. Footsteps may suggest an area/direction without identifying who made them. Fake utility or decoy pressure can mislead.

Suggested stages: `world event -> physically available cue -> noticed cue -> interpreted belief -> decision -> committed action -> physical result`. Include teammate reporting and transmission delay without making reports telepathic.

### 4.2 Decision commitment and anti-jitter behavior

Human-like players do not reconsider every option on every 30 Hz simulation tick. Model an action lifecycle such as **prepare -> commit -> execute -> recover -> reassess**, with meaningful interrupt conditions (new threat, blocked route, fatal exposure, plan invalidation). Evaluate routine tactical choices on events or a slower cadence; process motor execution on engine ticks. Use hysteresis/commitment to prevent endless left/right indecision, premature repeated reloads, constant weapon switches, and rotate-cancel loops.

Commitment must not make AI unresponsive to genuinely urgent threats. Adaptability changes *quality of justified replanning*, while personality influences *willingness and threshold* to deviate. The exact cadence and time constants require measurement in the current engine.

### 4.3 Opponent adaptation and believable anticipation

Track **evidence-based opponent tendencies** during the current match/series: repeated angle holds, recurring early aggression, utility habits, lurk timings, and site preferences. Update beliefs only from observed or reported events; preserve sample size and uncertainty. Information Reading interprets patterns, Decision Making weighs counterplays, Crosshair Placement prepares an angle, and Timing chooses a response. No extra global `anticipation` attribute is necessary.

Opponent models should be erasable/reset according to match and scouting rules. Private current-round information must never leak from the opponent's simulated decision state.

### 4.4 Human-like aim, movement, and combat situations

Use deliberate angular preparation, finite correction and turn rates, actual exposure, travel/acceleration/braking, cover geometry, recoil, and shot-ray intersections. Separate target detection, initial acquisition, fine correction, sustained tracking, and shot timing. A high-rated player should make *better use of a legitimate window*, not bend physics. Avoid aim snapping to unknown world coordinates and cosmetic idle reticle swaying as a substitute for skill differences.

Represent tactical situations as real encounter conditions: pre-aimed hold, unexpected wide swing, anti-eco spacing, contested trade, synchronized entry, delayed retake, post-plant crossfire, fake pressure, low-information rotate, and outnumbered save/clutch. **Do not add one permanent attribute for each situation.**

### 4.5 Utility, sound discipline, and economic agency

Utility knowledge and lineups are **map/utility familiarity**. Utility selection is a **tactical decision**; throwing precision is **Utility Execution**. Sound discipline (walking, running, landing, reloading, noisy rotations) should arise from legal mechanics, team plans, Timing, Decision Making, and beliefs—not a silent stealth bonus.

Player Economy Judgment is meaningful only if players can influence buy decisions, including disagreements with coach/IGL guidance. If the economy is entirely automated by team policy, keep this attribute inert and mark it as **not yet behaviorally supported** rather than pretending it matters.

### 4.6 Coach philosophy, team identity, and player fit

The coach/gameplan establishes priorities, preferred structures, protocols, and acceptable risks; the caller assigns/revises tasks; personality/DNA biases choices and response style; role familiarity affects known duties; detailed abilities affect how well legal tasks are performed. Team chemistry influences trust and coordination without acting as another free universal stat multiplier.

A good player can be a poor fit for a specific system. A less mechanically gifted player can become valuable through trading, support timing, calling, or utility. Evaluate **five-player complementarity and role coverage**, not only individual weighted scores. Preserve room for unusual roles, substitutes, role transitions, and counter-strategy adjustments.

## 5. Personality, specialty, contextual skill, and temporary state boundaries

| Layer | Example | Scope / ownership |
| --- | --- | --- |
| **Core skills** | Reactions, Information Reading, Trading | Persistent competence at narrowly defined tasks. |
| **Personality / private DNA** | Risk appetite, patience, initiative, emotional style, obedience to a plan | Decision policy and reactions/preferences, not free aim competence. Do not reveal raw private DNA through scouting. |
| **Situational specialties** | Excellent entries in rehearsed executes, strong late-round utility role | Only a verified narrow opportunity; not always-on stacking with the same core skill. |
| **Contextual familiarity** | Map, weapon family, role, team system, practiced lineup, opponent scouting | Evidence/experience-dependent application of skills, not a second universal rating. |
| **Temporary state** | Confidence, acute pressure, exertion, frustration, focus | Event-caused and recoverable; avoid rerolling state arbitrarily per encounter. |
| **Coach/team context** | Gameplan, trade protocols, language/chemistry, assigned authority | Team-level and contextual constraints; no omniscient coordination. |
| **Scouting view** | Estimate, range, confidence, observed sample | A manager's fallible knowledge, not the private authoritative skill. |

Separate **behavioral randomness** (which action a personality chooses among plausible options), **execution randomness** (bounded variation in a task), **knowledge uncertainty** (beliefs may be wrong), and **environmental randomness** (opponent actions, timing, recoil/spread, legal simulation events). Do not collapse all four into a generic luck multiplier.

## 6. Ability-to-play pipeline and time model

1. World/physics engine emits lawful visual, sound, objective, and teammate-report opportunities.
2. Awareness and current Concentration determine whether/when the actor attends to available cues.
3. Information Reading constructs or updates an actor-local belief, with provenance, freshness, and uncertainty.
4. The coach plan, current role, objective and time/economy constraints define feasible actions; Decision Making, Positioning, Timing, Calling, and personality choose among them.
5. The actor commits to an action, with interrupts and coherent replanning through Adaptability.
6. Crosshair Placement prepares exposure; Reactions starts the response *after noticing*; Flicking, Tracking, and Precision separately govern aim correction.
7. Movement Control, Peeking, Recoil Control, and Utility Execution govern the corresponding physical input quality, but only when a real supporting mechanic exists.
8. Physics resolves legal movement, collisions, sight, shots, damage, objectives, and utility. Actual outcomes become telemetry and, where appropriate, temporary emotional/exertion state.

**30 Hz note:** One tick is about 33.3 ms. Preserve the difference between cue availability, noticing, response initiation, correction, and firing. Illustrative *unapproved* Reactions endpoints from the source plan were 1 ≈ 450 ms, 5 ≈ 300 ms, 10 ≈ 180 ms *after noticed cues*; these are candidate gameplay numbers, not empirical human claims. Validate rounding/quantization and bounded seeded variability on engine ticks. Do not stack the same delay into three independent formulas.

Mental states modify only identified stages: for example, acute pressure may raise execution noise and decision hesitation within bounded limits; fatigue may impair sustained attention/recovery; a setback may create a temporary penalty that Resilience shortens. **No multiplicative generic mental penalty attached to every shot, path, and decision.**

## 7. Diagnostic player examples (not fixed archetype classes)

These are consequences to verify, not hard-coded character templates:

| Mixed profile | Expected observable behavior |
| --- | --- |
| High Reactions, low Crosshair Placement | Responds quickly after noticing, but often requires larger corrections because the initial angle was prepared poorly. |
| High Crosshair Placement, moderate Reactions | Frequently starts close to the right angle but can still lose when genuinely surprised. |
| High Precision, low Awareness | Dangerous in noticed 1v1s but vulnerable to legitimately unseen threats. |
| High Awareness, low Information Reading | Notices useful sounds/reports but is likelier to misinterpret their implications. |
| High Utility Execution, low Decision Making | Throws accurately but may waste a smoke/flash on a poor tactical choice. |
| High Trading, low Flicking | Maintains valuable support positions yet struggles to execute a difficult follow-up shot. |
| High Calling, low Communication | Can design sound rotations/executes, but first-hand emergency reports may be late or unclear. |
| High Composure, low Resilience | Handles immediate clutch pressure but takes longer to recover after a damaging setback. |
| High Stamina, low Consistency | Sustains a long series without much fatigue while remaining naturally variable encounter to encounter. |
| Strong mechanics, poor coach fit | May shine in improvisational opportunities yet underperform in a highly structured coordinated system. |

Allow *continuous distributions and mixed skill profiles*. These examples must never become mandatory archetype labels, forced behavior scripts, or fixed winners.

## 8. Manager UI, summaries, and scouting

Retain seven **compact FPS summaries**, displayed at 1–10, with an expandable profile grouped by the four skill families. Keep source provenance and scouting quality visible. Summaries are **derived displays**, not additional authoritative skills or extra modifiers.

| Legacy shorthand | New compact presentation | Important migration caveat |
| --- | --- | --- |
| `LAN` | Mechanics (execution profile) | Derived from detailed execution consumers; do not overwrite historic `lan`. |
| `TF` | Teamplay (communication, trading, coordination) | Context/team chemistry remains separate. |
| `IQ` | Tactics and information | Not literal intelligence; estimates may be uncertain. |
| `LDR` | Calling | Historic leadership semantics may be broader; use a versioned new display mapping. |
| `CLU` | Composure / pressure handling | Historic `clu` stood for clutch; **do not silently equate old clutch values with the new Composure rating**. |
| `STA` | Stamina | Do not double-count fatigue effects. |
| `FLX` | Adaptability | Separate skill at replanning from a personality preference for change. |

Do not reverse-engineer 25 truths from seven displays. In the lab, show authoritative editable attributes with clearly marked test status. In management/scouting, show estimated scores or ranges and a signal such as **Unscouted / Limited evidence / Reasonable confidence / Well observed**. Evidence should come from relevant opportunities, not kills alone: e.g. a pure sniper with two flash throws is weak evidence for Utility Execution.

**Role fit** should reference actual needed actions, not a generic highest-total player. Entry: preparation, reactions, peeking, movement and follow-through. Trader: spacing, awareness, trade timing and follow-up execution. Support: tactical utility selection plus throw execution, communication and coordination. IGL/caller: information, judgment, calling and team acceptance. Evaluate complementary five-player coverage and gameplan compatibility.

## 9. Generation, development, and scouting progression

- **Generation:** Sample persistent varied profiles using documented seed/provenance and moderate *correlations* among related skills; deliberately allow plausible outliers and uneven strengths. Avoid cloning one rating across an entire category, strict archetype lock-in, or rerolling on refresh/match/transfer.
- **Career growth:** Track training focus, practice opportunity, coach/facility support, aptitude, experience, diminishing returns, and skill-specific growth curves. Retain natural development variance. No guaranteed climb to ten; do not use one global potential value as a direct in-match buff.
- **Contextual learning:** Map/weapon/role/system familiarity improves through relevant exposure and practice; a newly introduced map may disadvantage a veteran without deleting permanent skill.
- **Recovery/regression:** Handle activity, breaks, form, temporary confidence, fatigue and potential age-related changes as separate causes; do not arbitrarily reroll permanent ratings after each match.
- **Scouting:** Update *beliefs* about skill from observable task-specific samples with uncertainty; distinguish the true skill, performance under context, and noisy measurement. Reporting a precise 9/10 from one highlight is prohibited.
- **Idempotency:** Training, career events, match settlement, and scouting aggregation must not double-award progress on retry or replay.

## 10. Versioning, legacy migration, and technical implementation guardrails

1. Add a **separate versioned FPS skill profile**, not a destructive expansion of shared `PlayerAttributes`. Metadata should cover player ID, schema version, generation/backfill source and version, skill values, revision, and timestamps. Keep scouting estimates/evidence in a separate manager-facing structure where privacy boundaries require it.
2. Keep legacy official allocations and histories **pinned** to their historical rules. An FPS profile revision and the engine/config versions used in a new match must be immutable within that match allocation/replay.
3. Seven legacy ratings do **not identify** 25 independent abilities. Preferred safe path: keep existing players on the legacy official adapter until a deliberately tested migration exists. Any shadow-only backfill is a **model-imputed estimate**, with deterministic provenance such as `legacy_estimate_v1`; it is not observed ground truth. Validate population and tier calibration before use in official matches.
4. Provide independent, documented generators for new-player profiles, with persistent seeds, credible ranges, career constraints, and longitudinal consistency. Do not derive attributes from personality badges or leak raw private DNA.
5. Where possible use separated deterministic random streams for distinct mechanics (observation, action selection, physical execution, environment) so controlled experiments do not accidentally change unrelated randomness.
6. Keep an explicit **behaviorally supported / reserved** registry for each skill. Do not show an attribute as active when no real consumer exists; especially gate Recoil Control, Utility Execution, Peeking, and Economy Judgment behind their required world mechanics.
7. All additions should be protected by feature flags and run first through local exhibition/shadow mode. Avoid unannounced production activation, hidden profile changes, or interference with transfer/economy/career systems.
8. Keep backward-compatible read/render paths for old card values, historical results, official v2/v3 replays, and MOBA profiles. A new `CLU`/`LDR` summary meaning must not rewrite stored legacy meaning.

## 11. Delivery sequence after approval

### Phase 0 — Repository audit and behavior contract

Confirm the reported code paths, actual engine tick scheduling, aim/vision/sound/recoil/utility/economy support, official v2/v3 version boundaries, player generation, UI scales, and settlement data. Create a skill-to-consumer matrix identifying direct effect, current support, telemetry, tests, and any legacy dependencies. **Do not fabricate mechanics just to justify a rating.**

### Phase 1 — Schema and 12 independently observable skills (local exhibition only)

**Reactions, Crosshair Placement, Flicking, Tracking, Precision, Movement Control, Awareness, Information Reading, Decision Making, Communication, Composure, Stamina.**

Implement versioned local/test profiles, editable lab controls, lawful perception/beliefs, independent consumers, deterministic tests, provenance, and diagnostic comparisons. If any skill lacks a genuine supporting mechanic, identify the blocker and leave that field reserved rather than applying a generic surrogate modifier.

### Phase 2 — Supported tactics, movement, and team play (10 skills)

**Recoil Control, Peeking, Utility Execution, Positioning, Timing, Adaptability, Economy Judgment, Trading, Coordination, Calling.**

First implement required mechanics and evidence: recoil state, exposure types, legal throw trajectories, path/cover geometry, team coordination, buys, and plan authority. Add opponent-pattern learning, decision commitment, and coach/gameplan fit as cross-cutting systems. Gate Economy Judgment when player-buy agency is unavailable.

### Phase 3 — Longitudinal match behavior (3 skills)

**Concentration, Consistency, Resilience.**

Implement bounded attention lapses, sample-to-sample variation with unchanged expected mean, and event-driven recovery state. Validate long series, adverse setbacks, and no duplicate pressure/fatigue penalty stacking.

### Phase 4 — Careers, public scouting, and official integration

Calibrate generation/backfill and tier distributions. Add scouting estimates, specific training, role/team fit, career progression, and historical compatibility. Add the official engine adapter **only under explicit versioned activation** after deterministic replay/settlement, economy/transfer, and historical regression checks. No automatic production rollout is authorized by this plan.

## 12. Acceptance tests and telemetry

**Test harness:** Compare profiles with exactly one modified attribute using paired seeds and fixed map, equipment, opponent behavior, cue information, and role. Repeat across many scenarios, not one highlight. Log enough intermediate steps to establish why behavior changed.

| Diagnostic | Primary measure and expectation |
| --- | --- |
| Cue/reaction | Cue available -> noticed -> response started; only the intended stage changes. |
| Crosshair preparation | Pre-exposure angular error and required correction; no vision leak or idle oscillation. |
| Aim phases | Large-angle acquisition, moving-target tracking error, final correction, real line-of-fire hit/miss; no free headshots. |
| Movement/peek | Stop-to-accurate-shot timing, exposure width/time, collision compliance, cover recovery; no illegal movement. |
| Information play | Cue provenance, age, confidence, mistaken but plausible inference, correction from later evidence. |
| Opponent adaptation | Gradual counterplay after observed repeated habits; no knowledge before samples. |
| Tactical choices | Feasible option selection, objectives/resources/time respected, reduced contradictory rotate-cancel loops. |
| Teamwork | Report transmission delay and quality, trade opportunities created/conversion, coordinated entry/utility sequencing. |
| Mental model | Acute-pressure loss versus recovery-after-setback versus exertion versus outcome variance are distinct. |
| Economy | Purchases respect budget/availability and team authority; no effect if player cannot influence buys. |
| Coach/role fit | Different valid plans reward different skill mixes; no universal best personality or team composition. |
| Longitudinal | Stable generation, opportunity-grounded training, uncertain scouting, idempotent progression/settlement. |
| Version compatibility | Legacy official/MOBA/replay paths produce unchanged results under their pinned versions. |

**Failure conditions:** An attribute increases K/D by multiplying a generic win chance; any omniscient or through-wall knowledge appears; attribute summaries are applied twice; inactive attributes appear functional; a 10 never fails; archetypes become forced classes; decision policies jitter every tick; backfill purports to recover 25 true ratings from seven aggregates; replays or historical game modes change without version activation.

## 13. Final recommendation

**Approve the 25-attribute target as the future FPS skills taxonomy, not as 25 instantly active ratings.** Remove `weaponHandling` unless the repo audit finds a genuine independent consumer. Keep conditional `economyJudgment`. Prioritize real knowledge constraints, action commitment, opponent adaptation, team/system fit, telemetry, and seeded tests because these systems will generate more believable player differences than adding further attributes.

Implement through the local exhibition first; publish detailed ratings as gameplay-effective only when their distinct mechanic is demonstrably supported. Preserve all historical official and MOBA paths until deliberately versioned migration and validation.
