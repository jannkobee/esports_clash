# CODEX IMPLEMENTATION TASK: Complete Tactical FPS Player Architecture Replacement

## Your Role

You are a senior game simulation architect, tactical FPS AI engineer, and full-stack developer working on an existing Counter-Strike-inspired esports management simulation.

Your task is to **completely replace the existing player personality, specialty, archetype, and behavioral decision-making systems** with the architecture defined below.

This is a full implementation request, not a design proposal.

You have access to the existing codebase. Investigate its architecture, database models, match simulation engine, player generation, roster management, AI teams, scouting, coaching, training, and frontend before making changes.

**Do not preserve outdated mechanics simply for backward compatibility. Do not build a second competing system alongside the existing one.**

Migrate existing data safely, replace obsolete implementations, and remove deprecated code once the new system is functioning.

Do not remove unrelated features or destroy existing player records.

---

# 1. Core Philosophy

Our previous system relied too heavily on attribute numbers and specialized traits to determine player identities.

We are replacing that design.

The new system must follow these principles:

**Personality determines how a player naturally behaves.**

**Position determines their tactical responsibilities.**

**Attributes determine how effectively they execute decisions.**

**Coaching and gameplans influence which decisions they make.**

**Adaptability allows every player to adjust during matches.**

**Player identity emerges from personality, responsibilities, and observed behavior—not from numerical attribute thresholds.**

### Critical example

Consider an IGL with:

- Rifling: 4
- Shotcalling: 8
- Aggressive playstyle
- Individualist mindset
- Instinctive decision style

This player can be a **Fragging IGL**.

They actively seek duels, participate in engagements, and try to create individual impact while leading the team.

Their Rifling of 4 means they may lose more duels against mechanically superior opponents.

However, they must not lose their Fragging IGL identity merely because they have low Rifling.

Likewise, an IGL with Rifling 9 can be a Tactical IGL who prioritizes coordination and rarely seeks unnecessary fights.

**Never confuse behavioral identity with mechanical proficiency or statistical performance.**

---

# 2. Preserve the Six Core Attributes

Use exactly these six player-facing attributes:

| Attribute | Purpose |
|---|---|
| Rifling | Rifle, pistol and SMG gunfight execution |
| Sniping | Sniper rifle execution, including AWP and Scout engagements |
| Entry | Breaking choke points, first-contact execution and creating space |
| Utility | Grenade effectiveness, timing and deployment |
| Positioning | Map awareness, positioning, rotations, angles and survival decisions |
| Shotcalling | Tactical planning, economy decisions, mid-round calls and counter-strategies |

Preserve the existing attribute scaling where applicable:

- Player-facing rating: 1–10
- Internal precision: 1–99

Do not introduce additional player-facing core attributes.

Do not use attribute thresholds to assign behavioral personalities or archetypes.

Attributes should influence the success and quality of an action after the player decides to attempt it.

A player with poor Rifling can still take many rifle duels. They will simply be less effective at executing them.

---

# 3. Replace the Personality System

Implement exactly four broad personality dimensions.

## 3.1 Temperament

Values:

- `VOLATILE`
- `STEADY`
- `ICE_COLD`

### Volatile

More susceptible to emotional changes, pressure, momentum, frustration and confidence swings.

Volatile players are not automatically inferior. Momentum can benefit them, but setbacks can destabilize their decisions.

### Steady

Maintains relatively consistent behavior across ordinary match conditions.

Neither unusually affected by momentum nor exceptionally resistant to pressure.

### Ice-Cold

Maintains composure and decision stability in high-pressure situations.

Does not automatically receive clutch bonuses, aim bonuses or guaranteed successful plays.

## 3.2 Playstyle

Values:

- `PASSIVE`
- `BALANCED`
- `AGGRESSIVE`

### Passive

Naturally prefers information, favorable engagements, patience and controlled risks.

Can still execute aggressive actions when required.

### Balanced

Adjusts the level of initiative according to team instructions and match conditions.

Does not mean mechanically average or tactically superior.

### Aggressive

Naturally seeks initiative, engagement opportunities, map control and proactive actions.

Can still hold positions, save equipment, delay engagements and follow slow strategies.

## 3.3 Mindset

Values:

- `INDIVIDUALIST`
- `TEAM_FIRST`

### Individualist

Places greater priority on personal opportunities, independent decisions and individually favorable positions.

Not necessarily selfish, uncooperative or toxic.

### Team-First

Places greater priority on coordination, spacing, trades, utility support and team objectives.

Not necessarily passive or mechanically weak.

## 3.4 Decision Style

Values:

- `INSTINCTIVE`
- `METHODICAL`
- `ADAPTIVE`

### Instinctive

Relies on intuition, rapid judgment and improvisation.

Can react quickly to unusual situations but may act with incomplete information.

### Methodical

Prefers deliberate reasoning, structured plans and established tactical patterns.

Adapts using accumulated evidence and systematic adjustments.

### Adaptive

Frequently reassesses changing situations and willingly modifies approaches.

Can be flexible, but excessive adjustment may disrupt coordination.

**Important:** All three decision styles must be able to adapt. `ADAPTIVE` is a behavioral preference, not exclusive access to adaptation mechanics.

---

# 4. Remove the Old Specialty System

Completely retire the previous specialty mechanics, including any old equivalents of:

- Unpredictable
- Quick
- Technical
- Clutch
- Resilient
- Opportunist
- Igniter
- Phantom
- Reader
- Conductor
- Warden
- Saboteur
- Reclaimer
- Closer

Inspect the repository for additional specialties, trigger cards, specialty bonuses and conditional buffs.

Replace these mechanisms with general player decision-making.

### Examples

Every player should be capable of:

- Clutching
- Recovering failed rounds
- Adapting to opponent strategies
- Creating unexpected plays
- Coordinating utility
- Exploiting positioning mistakes
- Performing tactical fakes
- Initiating attacks
- Leading retakes when appropriate
- Identifying and exploiting timing windows

These behaviors must not require possession of a special trait.

Remove specialty-based attribute bonuses, arbitrary activation probabilities, cooldowns and guaranteed special events.

If existing database records contain specialties, migrate them safely and remove obsolete fields only after verifying the migration.

Do not introduce a renamed specialty system.

---

# 5. Implement Five Locked Positions Per Side

A team fields exactly five players.

Each player receives one T-side assignment and one CT-side assignment for the relevant map or match lineup.

## T-Side Positions

1. `T_IGL` — In-Game Leader
2. `T_ENTRY` — Entry Rifler
3. `T_SUPPORT` — Support Rifler
4. `T_LURKER` — Lurker
5. `T_FLEX` — Flex Rifler / AWPer

## CT-Side Positions

1. `CT_IGL` — In-Game Leader
2. `CT_ROTATOR` — Rotator
3. `CT_ANCHOR_A` — Site A Anchor
4. `CT_ANCHOR_B` — Site B Anchor
5. `CT_FLEX` — Flex Rifler / AWPer

The Rotator may be aggressive or passive depending on personality. Its slot name must not force aggressive behavior.

The Flex player does not have to use an AWP. Rifles and sniper rifles remain legitimate options.

### Lineup constraints

- Exactly five active players per team.
- Every required position must be assigned.
- No duplicate position assignments on a side.
- The same player cannot occupy multiple simultaneous positions.
- T and CT assignments can differ.
- Assignment changes are permitted through lineup management.
- Assignments are locked for the match according to existing substitution and lineup rules.
- In-round movement is unrestricted by position labels.

A Site Anchor may rotate or join a retake.

A Lurker may join a coordinated execute.

A Support may take the first engagement.

A Flex may switch weapons according to economy and tactics.

**Positions represent responsibilities, not fixed movement scripts.**

---

# 6. Implement All 54 Personality Combinations

Four personality dimensions produce:

3 Temperaments × 3 Playstyles × 2 Mindsets × 3 Decision Styles = **54 combinations**.

Generate these systematically rather than manually maintaining 54 unrelated logic implementations.

Each combination must produce distinct behavioral preferences through the interaction of its dimensions.

## 18 Base Behavioral Profiles

Each base profile has three temperament variations.

| ID | Playstyle | Mindset | Decision Style | Behavioral Profile |
|---|---|---|---|---|
| 1 | Passive | Individualist | Instinctive | Patient Opportunist |
| 2 | Passive | Individualist | Methodical | Calculated Duelist |
| 3 | Passive | Individualist | Adaptive | Selective Playmaker |
| 4 | Passive | Team-First | Instinctive | Reactive Teammate |
| 5 | Passive | Team-First | Methodical | Disciplined Operator |
| 6 | Passive | Team-First | Adaptive | Flexible Stabilizer |
| 7 | Balanced | Individualist | Instinctive | Independent Playmaker |
| 8 | Balanced | Individualist | Methodical | Calculated Playmaker |
| 9 | Balanced | Individualist | Adaptive | Dynamic Opportunist |
| 10 | Balanced | Team-First | Instinctive | Responsive Team Player |
| 11 | Balanced | Team-First | Methodical | Structured Team Player |
| 12 | Balanced | Team-First | Adaptive | Versatile Coordinator |
| 13 | Aggressive | Individualist | Instinctive | Fearless Duelist |
| 14 | Aggressive | Individualist | Methodical | Assertive Duelist |
| 15 | Aggressive | Individualist | Adaptive | Hunting Playmaker |
| 16 | Aggressive | Team-First | Instinctive | Frontline Initiator |
| 17 | Aggressive | Team-First | Methodical | System Aggressor |
| 18 | Aggressive | Team-First | Adaptive | Proactive Playmaker |

### Required behavior for these profiles

1. Patiently exploits openings but can react prematurely.
2. Seeks carefully selected personal duels but can miss timing windows.
3. Adjusts routes to find favorable personal opportunities but can surrender initiative.
4. Reacts rapidly to teammates' needs but may rely on others for initiative.
5. Follows deliberate team plans but can become predictable.
6. Maintains team structure while adjusting responsibilities but can be overly cautious.
7. Makes spontaneous independent plays but can disrupt coordination.
8. Plans individual plays carefully but can overprepare.
9. Changes approach to find personal impact but can disrupt team timing.
10. Responds quickly to team-created opportunities but can commit prematurely.
11. Executes structured team decisions but can hesitate to improvise.
12. Adjusts responsibilities to help the team but can over-adjust.
13. Frequently seeks direct combat but risks overextension.
14. Engineers planned aggressive engagements but can become predictable.
15. Hunts engagements dynamically but can lose focus on team objectives.
16. Creates space for teammates but risks advancing beyond support.
17. Executes coordinated aggressive plans but can overcommit.
18. Creates proactive pressure while adapting dynamically but can disrupt synchronization.

Treat these as behavioral tendencies, not deterministic actions.

---

# 7. Complete T-Side Identity Mapping

Use the base behavioral profile ID to derive an initial role-specific identity.

Each identity must be independent of numerical skill ratings.

| ID | IGL | Entry | Support | Lurker | Flex |
|---|---|---|---|---|---|
| 1 | Reactive IGL | Counterpunch Entry | Reactive Support | Patient Opportunist Lurker | Reactive Flex |
| 2 | Calculated IGL | Precision Entry | Calculated Support | Calculated Lurker | Disciplined Marksman |
| 3 | Opportunistic IGL | Selective Entry | Situational Support | Selective Lurker | Selective Flex |
| 4 | Reactive Coordinator | Trade-Ready Entry | Covering Support | Reactive Pressure Lurker | Responsive Flex |
| 5 | Tactical IGL | System Entry | Tactical Support | Disciplined Lurker | System Flex |
| 6 | Adaptive IGL | Adaptive Entry | Adaptive Support | Adaptive Lurker | Adaptive Flex |
| 7 | Initiative IGL | Solo-Tempo Entry | Combat Support | Independent Playmaking Lurker | Independent Marksman |
| 8 | Duel-Oriented IGL | Methodical Duelist Entry | Calculated Combat Support | Calculated Closer | Calculated Marksman |
| 9 | Adaptive Fragging IGL | Opportunistic Entry | Improvising Combat Support | Opportunistic Lurker | Dynamic Playmaker |
| 10 | Responsive IGL | Trade Entry | Trade Support | Team-Pressure Lurker | Team Flex |
| 11 | Systems IGL | Structured Entry | Structured Support | System Lurker | Structured Flex |
| 12 | Adaptive Tactical IGL | Adaptive Team Entry | Versatile Support | Coordinated Lurker | Versatile Flex |
| 13 | Fragging IGL | Explosive Entry | Fragging Support | Aggressive Lurker | Aggressive Duelist |
| 14 | Calculated Fragging IGL | Calculated Aggressive Entry | Assertive Combat Support | Pressure Lurker | Assertive Marksman |
| 15 | Playmaking IGL | Hunting Entry | Playmaking Support | Hunting Lurker | Playmaking Marksman |
| 16 | Leading-From-Front IGL | Selfless Entry | Aggressive Trade Support | Distraction Lurker | Initiating Flex |
| 17 | Execute-Driven IGL | Coordinated Entry | Execute Support | Pressure-Control Lurker | Structured Attacker |
| 18 | Proactive IGL | Playmaking Entry | Adaptive Playmaking Support | Active Lurker | Playmaking Flex |

These names are descriptive outputs, not independent classes or gameplay modifiers.

---

# 8. Complete CT-Side Identity Mapping

Site A and Site B Anchors use the same identity catalog, but their contextual decisions depend on their assigned site.

| ID | IGL | Rotator | Anchor | Flex |
|---|---|---|---|---|
| 1 | Reactive Defensive IGL | Ambush Rotator | Ambush Anchor | Angle Opportunist |
| 2 | Calculated Defensive IGL | Measured Rotator | Methodical Anchor | Disciplined Marksman |
| 3 | Opportunistic Defensive IGL | Selective Rotator | Selective Anchor | Adaptive Defensive Flex |
| 4 | Reactive Defensive Coordinator | Backup Rotator | Responsive Anchor | Responsive Flex |
| 5 | Defensive Strategist | Disciplined Rotator | Hard Site Anchor | Defensive Marksman |
| 6 | Adaptive Defensive IGL | Adaptive Rotator | Adaptive Anchor | Adaptive Marksman |
| 7 | Initiative Defender IGL | Free-Roam Rotator | Playmaking Anchor | Independent Marksman |
| 8 | Duel-Oriented Defensive IGL | Measured Duel Rotator | Calculated Fighting Anchor | Calculated Sniper |
| 9 | Adaptive Fragging CT IGL | Playmaking Rotator | Opportunistic Anchor | Adaptive Playmaker |
| 10 | Responsive Defensive IGL | Trade Rotator | Team Anchor | Team Marksman |
| 11 | Structure-First IGL | System Rotator | Structured Anchor | Structure Marksman |
| 12 | Adaptive Tactical Defender | Flexible Rotator | Versatile Anchor | Versatile Marksman |
| 13 | Fragging CT IGL | Aggressive Rotator | Fragging Anchor | Aggressive Marksman |
| 14 | Calculated Fragging CT IGL | Planned Contest Rotator | Proactive Anchor | Calculated Aggressive Marksman |
| 15 | Playmaking CT IGL | Hunting Rotator | Hunting Anchor | Hunting Marksman |
| 16 | Proactive Commander | Proactive Rotator | Contesting Anchor | Proactive Marksman |
| 17 | Proactive Tactical IGL | Planned Pressure Rotator | Utility-Pressure Anchor | Structured Aggressive Marksman |
| 18 | Adaptive Aggressive IGL | Adaptive Aggressive Rotator | Adaptive Fighting Anchor | Adaptive Playmaking Marksman |

Each role identity can be qualified by Temperament.

For example:

- Volatile Fragging IGL
- Steady Fragging IGL
- Ice-Cold Fragging IGL
- Ice-Cold Tactical IGL
- Volatile Explosive Entry
- Steady Aggressive Lurker
- Ice-Cold Hard Site Anchor

Avoid awkward repeated labels such as "Ice-Cold Ice-Cold Anchor."

The combination of 54 full personality profiles and 10 side-specific role slots must be supported, resulting in **540 valid role-personality configurations**.

Do not hardcode 540 independent AI decision scripts.

Use composable behavioral logic and declarative identity metadata.

---

# 9. Natural Identity vs Observed Identity

Implement two related but distinct concepts.

## Natural Identity

Derived from:

- Personality dimensions
- Assigned tactical role
- Natural behavioral tendencies

It describes what the player is predisposed to attempt.

## Observed Identity

Derived from actual decision-making over many matches.

It describes how the player currently behaves in practice.

Track meaningful behavioral observations, such as:

- Engagement opportunities accepted
- Engagement opportunities declined
- Willingness to take first contact
- Preference for coordinated versus independent action
- Timing of rotations
- Frequency of tactical improvisation
- Response to failed executes
- Adjustment to opponent patterns
- Willingness to make sacrifices for teammates
- Save versus retake decision tendencies
- Utility support decisions
- Lurk timing choices
- Personal risk acceptance
- Compliance with team strategy

### Important measurement rule

Use opportunity-normalized measurements.

For example, taking 8 fights out of 10 valid opportunities is more indicative of an aggressive approach than taking 10 out of 40.

Never equate kill count with aggression or behavioral identity.

Do not use kill/death ratios to determine whether someone is a Fragging IGL.

A player should retain their natural identity even if they are statistically unsuccessful.

Observed identity may gradually diverge due to coaching, team structure, experience and actual match behavior.

Do not automatically rewrite permanent personality traits based on one match.

---

# 10. Rebuild the Match Simulation Decision System

The existing match engine must integrate the new personality architecture.

Do not merely add personality fields to the player database.

Personality must have genuine consequences for tactical behavior.

## Decision pipeline

Implement the following logical process:

1. Read current match and round state.
2. Evaluate available information and uncertainty.
3. Determine tactical responsibilities.
4. Generate legal, contextually appropriate actions.
5. Evaluate team strategy and coaching instructions.
6. Apply individual personality preferences.
7. Consider learned opponent tendencies.
8. Evaluate risks, rewards and team coordination.
9. Select an action.
10. Resolve execution using attributes and simulation context.
11. Update the match state.
12. Record meaningful behavioral observations.

### Possible actions

Use and extend existing simulation actions where available:

- Hold angle
- Change angle
- Peek
- Re-peek
- Jiggle peek
- Swing
- Wide swing
- Trade
- Fall back
- Rotate
- Fake rotation
- Contest map control
- Play for information
- Initiate execute
- Delay execute
- Throw supporting utility
- Defend site
- Abandon site
- Retake
- Save
- Hunt
- Lurk
- Rejoin team
- Plant
- Defuse
- Hold post-plant
- Attempt clutch
- Reposition after contact
- Change tactical plan

Only generate actions that are physically and tactically possible in the current simulation.

Do not let personality bypass geometry, visibility, weapon restrictions, economy, utility availability or team information.

### Example: two Aggressive IGLs

IGL A:
- Rifling 4
- Aggressive
- Individualist
- Instinctive

IGL B:
- Rifling 9
- Aggressive
- Individualist
- Instinctive

Both should exhibit similar preferences toward direct engagement when placed in similar match situations.

However, IGL B should generally execute rifle-based engagements more effectively.

Do not automatically make IGL B more aggressive.

### Example: two players with Rifling 9

Player A:
- Aggressive
- Individualist
- Instinctive

Player B:
- Passive
- Team-First
- Methodical

Both are mechanically capable.

Player A naturally seeks initiative and individual duels.

Player B prefers controlled fights, trade spacing and information-backed decisions.

The difference must exist in the actual match engine, not just the player profile UI.

---

# 11. Universal Adaptability

Every player must possess general adaptation capabilities.

Do not restrict adaptation to players with the `ADAPTIVE` decision style.

Players should respond to:

- Opponent aggression
- Repeated enemy positioning
- Utility patterns
- Fake executes
- Rotations
- Weak defensive sites
- Repeated failed attacks
- Repeated failed defenses
- Economy
- Equipment disadvantages
- Man advantages and disadvantages
- Remaining round time
- Teammate deaths
- Opponent counter-strategies
- Team confidence and pressure

Use a contextual model that allows players to update their beliefs and actions based on information available to them.

### Decision Style differences

**Instinctive:** Adapts through fast, intuitive reactions.

**Methodical:** Adapts through evidence, preparation and deliberate reassessment.

**Adaptive:** More readily changes approaches based on emerging information.

No decision style should automatically be superior.

Players should not have perfect information or unrealistically identify enemy strategies without supporting evidence.

Coaches and IGLs can influence adaptation, but other players must retain appropriate situational autonomy.

---

# 12. Coaching and Team Identity

Integrate personality into the existing coaching and tactical systems.

A team's gameplan should influence decisions without completely overriding player identity.

Examples:

### Aggressive Entry + Methodical Coach

The Entry remains naturally aggressive but may learn to wait for coordinated utility before committing.

### Passive Lurker + Aggressive Team

The Lurker can follow fast executes while still seeking favorable timing and information.

### Individualist AWPer + Team-First IGL

The AWPer may prefer individual picks while the IGL attempts to coordinate those opportunities with team objectives.

These combinations should create realistic behavioral friction and synergy.

### Avoid hardcoded chemistry bonuses

Do not make Team-First automatically compatible with Team-First or Adaptive automatically compatible with every gameplan.

Team chemistry should emerge from:

- Tactical synchronization
- Communication and coordination
- Responsibilities
- Behavioral compatibility
- Shared match experience
- Coaching effectiveness
- Observed cooperation

Build on existing team systems where appropriate.

Avoid replacing realistic tactical interactions with simplistic personality-match multipliers.

---

# 13. AI Managers and Bot Teams

The new architecture must apply equally to:

- Human-managed clubs
- AI-managed clubs
- Generated players
- Existing players
- Youth prospects
- Professional players
- Substitutes
- National teams, if supported

AI managers should consider personalities when scouting, recruiting, assigning positions and selecting gameplans.

They should not automatically choose players with the highest attributes.

Example:

An AI manager may prefer a low-Rifling, aggressive Entry who fits their tactical system over a higher-Rifling player whose behavior conflicts with the desired approach.

This must remain a contextual choice rather than a guaranteed preference.

Preserve compatibility with existing bot-replacement and human-manager systems.

Do not make player decision-making dependent on an external LLM API. The simulation must function deterministically from its seed and inputs without requiring paid AI inference.

---

# 14. Player Generation and Development

Update player generation to assign all four personality dimensions.

Ensure:

- All 54 valid combinations are possible.
- No combination is artificially disallowed.
- Generated players have diverse identities.
- Personality is independent of numerical capability.
- Roles do not force particular personality combinations.
- Low-rated players can possess ambitious or aggressive identities.
- High-rated players can possess conservative identities.

If the project includes aging, training or player development, preserve those systems and make them compatible.

Training should improve attributes independently from personality.

Coaching and match experience may influence behavioral habits and observed identity.

Do not randomly change permanent personality dimensions every week.

If personality changes are already supported, preserve them only through meaningful long-term development mechanisms.

---

# 15. Scouting, Player Profiles and Frontend

Update the existing player UI to display:

### Core Attributes

All six numerical attributes.

### Personality

- Temperament
- Playstyle
- Mindset
- Decision Style

### Tactical Assignments

- T-side position
- CT-side position

### Player Identity

- Natural role identity
- Observed identity, where sufficient data exists

### Scouting Information

Where supported, display:

- Behavioral tendencies
- Preferred approach
- Tactical strengths
- Potential weaknesses
- Compatibility with the current gameplan
- Relevant match observations

For example:

**Natural Identity:** Fragging IGL

**Personality:** Ice-Cold / Aggressive / Individualist / Instinctive

**Attributes:** Rifling 4, Shotcalling 8

**Scouting description:** "An aggressive leader who frequently participates in engagements and looks to create personal impact. Maintains composure under pressure but may struggle to convert rifle duels against mechanically stronger opponents."

Avoid showing fabricated scouting conclusions before enough match observations exist.

If the existing scouting system includes uncertainty, fog of war or imperfect information, preserve it.

Do not expose hidden behavioral knowledge to managers who have not scouted the player.

Remove obsolete specialty UI, filters, tooltips, API fields and player badges.

---

# 16. Data Architecture and Integration

Use the project's existing technology stack and conventions.

Inspect the repository before deciding how to structure the implementation.

Prefer a composable architecture with clear separation between:

- Player attributes
- Personality definitions
- Tactical position assignments
- Natural identity derivation
- Observed identity analysis
- AI action selection
- Action execution
- Tactical adaptation
- Scouting and reporting

Do not create 540 subclasses or individual scripts.

Use strongly typed definitions where the codebase supports TypeScript.

Persist stable personality values and assignment records.

Derive descriptive labels using versioned, testable mappings where appropriate.

Match snapshots and simulation replays must remain consistent with the personality and role assignments active at the time.

### Migration requirements

1. Audit existing schema and dependencies.
2. Identify all obsolete identity and specialty fields.
3. Define a documented migration policy for legacy records.
4. Preserve existing players, attributes and match history.
5. Assign valid new personality values to existing players.
6. Use historical behavioral evidence where it is reliable; otherwise use a documented, deterministic fallback.
7. Make migrations idempotent or otherwise safe under the project's migration conventions.
8. Remove obsolete code after all consumers are migrated.
9. Update seeders, factories, serializers, APIs and validations.
10. Ensure no active subsystem still depends on removed specialties.

Avoid assigning all existing players the same default personality.

Do not silently reinterpret legacy personality values as unrelated new values.

---

# 17. Simulation Performance and Determinism

This game must be able to simulate large numbers of clubs, players and matches.

Avoid expensive per-decision database queries.

Do not perform complex identity derivation repeatedly when cached or precomputed metadata is sufficient.

Personality should influence decision probabilities or utility evaluations without requiring large rule trees for every profile.

Use seeded randomness and reproducible simulation inputs.

Given identical inputs, configuration and seed, the simulation should produce identical outcomes.

Support efficient simulation of multiple concurrent matches.

Avoid external AI API dependencies for core player decision-making.

---

# 18. Tests and Required Validation

Implement automated tests.

At minimum, cover:

### Personality coverage

- Exactly 54 valid complete personality combinations.
- Exactly 18 base behavioral profiles.
- All ten side-specific positions.
- All 540 role-personality configurations.
- Every combination can be generated, persisted and loaded.
- Every combination can participate in a match.

### Behavioral identity

- An IGL with Rifling 4 can be a Fragging IGL.
- Increasing Rifling does not automatically change the identity.
- Two players with identical attributes but different personalities exhibit different action-selection tendencies.
- Players with identical personalities but different attributes can have similar intentions and different execution effectiveness.
- Temperament affects pressure responses without directly increasing aim.
- All Decision Styles can adapt.
- Personality never blocks tactically required actions.

### Lineup validity

- Exactly five players per side.
- No duplicate positions.
- Valid T-side and CT-side assignments.
- No forced AWP requirement.
- A player can have different roles on T and CT.
- In-round movement does not invalidate a tactical assignment.

### Match simulation

- Decisions respect actual game state.
- Players do not gain information they have not legitimately obtained.
- Actions resolve through existing mechanics.
- Tactical decisions respond to changing opponent behavior.
- Personality has statistically observable behavioral consequences.
- Identity is not calculated from kills or K/D.
- Match execution is reproducible using the same seed.

### Integration

- Player generation.
- Existing player migration.
- AI recruitment.
- Coaching.
- Scouting.
- Player profiles.
- Match reports.
- Match replay or event logs.
- Persistence.
- Serialization.
- Any existing training and progression dependencies.

Include statistical simulation tests over multiple seeds to verify intended behavioral distributions without requiring every individual match to follow a predetermined script.

---

# 19. Remove Obsolete Implementations

Search the entire repository for references to the previous systems.

Inspect:

- Database models
- Migrations
- Services
- Controllers
- API schemas
- TypeScript interfaces
- Simulation engine
- AI decision logic
- Player generation
- Training
- Coaching
- Player scouting
- Team chemistry
- Match reports
- Frontend components
- Tests
- Configuration
- Seeders
- Documentation

Remove old specialty triggers and rating-based archetype classifications.

Do not keep deprecated implementations as fallbacks.

Do not leave unreachable or unused legacy code.

Preserve unrelated gameplay features.

Avoid maintaining multiple sources of truth for player personalities.

---

# 20. Implementation Execution Requirements

This task must be completed end-to-end.

Follow this workflow:

1. Inspect the complete relevant codebase.
2. Identify current systems and their dependencies.
3. Establish the replacement architecture.
4. Implement the new personality data model.
5. Implement all role-specific identity mappings.
6. Integrate personalities into actual match decisions.
7. Integrate universal adaptation.
8. Update lineup management.
9. Integrate coaching, scouting and AI managers.
10. Update the frontend and API.
11. Migrate existing data.
12. Remove obsolete systems.
13. Update fixtures, factories and seeders.
14. Add and execute comprehensive tests.
15. Run build, lint and type checks.
16. Resolve identified integration issues.
17. Update relevant technical documentation.

Do not stop after defining interfaces, database tables, or UI components.

**The new system must actually influence simulated player behavior.**

Do not ask for confirmation between implementation steps. Inspect the repository, make informed decisions consistent with existing architecture, and complete the integration.

If a subsystem is missing, integrate with existing equivalents rather than inventing a disconnected parallel application.

Do not claim tests pass unless they were executed successfully.

---

# 21. Final Acceptance Criteria

The implementation is successful only when:

- The previous specialty-based system is no longer active.
- The previous attribute-threshold identity system is no longer active.
- Exactly six core attributes are retained.
- Four personality dimensions are implemented.
- All 54 personality combinations are supported.
- All 540 role-personality configurations are valid.
- Each team has five locked T positions and five locked CT positions.
- Personality affects real match decision-making.
- Attributes determine execution effectiveness without prescribing personality.
- Every player can adapt to changing match situations.
- Natural identity and observed identity are separate.
- Gameplans and coaching affect behavior without erasing personality.
- Human and AI teams use the same underlying simulation rules.
- Database, backend, frontend, scouting and match simulation agree.
- Obsolete specialties and their dependencies are removed.
- Automated validation covers the architecture and major integrations.

## Expected Final Report

Once implementation is complete, provide:

1. Summary of the architecture implemented.
2. Major files and systems modified.
3. Old systems removed.
4. Database migrations performed.
5. How all 54 personality combinations are represented.
6. How identities are derived for the ten tactical positions.
7. How personality affects match simulation decisions.
8. How coaching and adaptation interact with personality.
9. Tests executed and their results.
10. Remaining limitations, if any.

## Final Design Principle

**A player is not a Fragging IGL because they have high Rifling. They are a Fragging IGL because they naturally approach the game as a combat-oriented leader.**

**A player is not an Ice-Cold Lurker because they have high Positioning. They are an Ice-Cold Lurker because they exhibit composed, patient or calculated behavior in their lurking responsibilities.**

Attributes determine whether those players are effective.

Personality determines what makes them unique.

The simulation determines what actually happens.

**Implement the complete replacement architecture. Do not deliver a partial prototype or a proposal.**