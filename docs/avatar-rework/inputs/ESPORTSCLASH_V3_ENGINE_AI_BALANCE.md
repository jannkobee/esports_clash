# EsportsClash V3 — Combat, AI, Balance and Acceptance Specification

**Companion to:** `ESPORTSCLASH_ORIGINAL_45_HERO_REDESIGN_V3.md`. **Design status:** proposed, not implemented. **Intended environment:** existing EsportsClash MOBA simulation, authoritative game-state logic, React frontend where applicable. Inspect repository and adapt—do not assume names or folders for implementations except the source catalog's `EsportsClash.Web/src/mockData.ts`, `additionalChampions.ts`, and `avatarIdentity.ts`, which are references to audit, not guarantees of current directory layout.

## 1. Hard engineering constraints

1. No silent replacements of game IDs. Add a `legacyId -> canonicalId` alias layer. Choose one stable internal key for each existing character and expose renamed identity data separately; do not change primary keys in persisted match outcomes/player-card inventory unless there is a tested migration.
2. Keep old ability catalog as **read-only migration fixture**, not runtime ability definition. New V3 spells must execute from **authoritative** data; text-only updates are insufficient.
3. All gameplay effects must work at simulation speed x1 and x4 with identical outcomes for the same seed/input event stream (fixed timestep). Wall-clock timers, animation callbacks, and random rendering cannot alter authority.
4. All human and AI actors use the same public observation projection. Bots cannot inspect enemy cooldowns / future RNG if hidden from players.
5. To honor one-lane map constraints, all route/vault/cover/ferry mechanics have world collision checks. No crossing hard walls; no team-specific noclip.
6. No league/dota signature mechanics shall be reinstated from older code during migration. Explicitly check Lulla, Mirelle, Mora, Garruk, Sevrin, Pippa, Koro, Ivera, Nyxara, Vesper.
7. No blanket invulnerability, mass indefinite CC, infinite summons, permanently blocked passage, forced ally movement without consent, or retaliation loops.
8. No runtime code mutation by machine-learning agents. Balance parameters and behavior policies are versioned and gated by holdout baselines; code changes are human-reviewed repository commits with tests.

## 2. Proposed normalized data model

```ts
interface HeroIdentity {
  legacyId: string;             // e.g. 'Fizzlewing'
  canonicalId: string;          // stable ASCII slug, e.g. 'lulla-faespring'
  displayName: string;          // 'Lulla Faespring'
  title: string;                // 'The Keeper of Unfinished Dreams'
  role: string;
  silhouetteKey: string;
  vfxTheme: string;
  assetIds: { portrait?: string; rig?: string; iconPrefix?: string };
}

type EffectClass =
  | 'damage' | 'heal' | 'shield' | 'move_speed' | 'slow' | 'root'
  | 'stagger' | 'disarm' | 'cast_recovery' | 'attack_recovery'
  | 'projectile_intercept' | 'projectile_deflect' | 'directional_guard'
  | 'deployable' | 'timed_zone' | 'movement_vector' | 'voluntary_transport'
  | 'reveal' | 'line_of_sight_mod' | 'terrain_cover' | 'postcast_tax'
  | 'damage_redirection' | 'resource_debt' | 'conditional_trigger';

interface AbilityDefinition {
  id: string;
  heroId: string;
  slot: 'passive' | 's1' | 's2' | 'r' | 'r_page';
  name: string;
  cooldownSec: number;
  castWindupSec: number;
  castRecoverySec: number;
  targeting: 'self'|'unit'|'point'|'direction'|'path'|'object'|'palette';
  rangeGU?: number;
  radiusGU?: number;
  durationSec?: number;
  resourceCost?: number;
  statusTags: EffectClass[];
  telegraph: { form: string; warningSec: number; visibleToEnemies: boolean };
  aiSignals: string[];
  cancelRules: string[];
  counterplayTags: string[];
  effectSpec: Record<string, unknown>; // replace with typed discriminated union in implementation
}

interface WorldConstruct {
  id: string;
  ownerId: string;
  teamId: string;
  kind: 'pin'|'panel'|'fork'|'pole'|'post'|'ferry'|'rail'|'mirror'|'chime'|'node'|'canvas'|'gate'|'planter'|'other';
  position: { x: number; y: number };
  orientationRad: number;
  hp?: number;
  createdTick: number;
  expireTick: number;
  occupancyPolicy: 'blocking'|'traversable'|'voluntary_transport'|'no_collision';
  visibilityPolicy: 'public'|'team'|'fog_sensitive';
  charges?: number;
}
```

**Do not implement the `effectSpec: Record<string, unknown>` escape hatch permanently.** It is a sketch. Use discriminated unions or validated effect handlers for persistence, telemetry and preview parity.

## 3. Authoritative effect kernel

- `spawnConstruct`, `damageConstruct`, `rotateConstruct`, `despawnConstruct`, with ownership and tick-based lifetime; all emits are event logged.
- `resolveCast` with target validation, line of sight, cooldown, resource, cast start/commit/recovery, cancel and refund; no client-authority over hit tests.
- `projectileCollision` distinguishing hard world walls, temporary cover, low cover, roof-vs-lob, interception charges, reflection budget (max 1 bounce), friendly/enemy polarity, ally hit rules.
- `movementResolution` with stable collision (including slide current, friction disks, angle bias, voluntary ferry, pole vault), closest-valid-position solver, max forced distance per tick, and stuck-prevention timeout.
- `zoneLifecycle` maintains declared geometries (segments, wedges, disks, triangles, 2x2 grids) and server canonical hit tests. Avoid doing game-hit resolution from Canvas/WebGL pixel positions.
- `debuffRegistry` handles per-target lockouts, cap/hysteresis, dispel tier, status immunity policies, and no recursive triggered effects. All post-cast taxes add recovery *after* effect commit; they never retroactively cancel the spell.
- `allyVoluntaryMove` requires explicit player command or AI accepted route; allies cannot be automatically kidnapped by Koro poles, Mora ferry, Aurelio partner trade, or Bryx currents.
- `combatEventLog`: `ability_started`, `ability_committed`, `ability_failed`, `cast_recovery_added`, `construct_placed`, `construct_destroyed`, `projectile_redirected`, `movement_modified`, `route_boarded`, `route_cancelled`, `heal_applied`, `blocked_damage`, `ai_choice_explained`, `status_expired`.

## 4. Effect-specific invariants

- **Lulla:** Drowse only on completed enemy abilities near a chime; never on basic attacks. Borrowed Yawn queues +0.35 s exactly once on NEXT completed enemy cast (expires after 3 s). Theater only taxes completions in marked windows; no silence, orb jump, invulnerability, or leash. Destroying center chime ends future windows. At 4× speed all event windows scale in simulation ticks, not real seconds.
- **Mirelle:** at most 3 active pins, each 2 HP and 6 s TTL; S2 edits exactly one existing pin. Pattern palette is selection state. Each page has independent cooldown plus a 7 s global R weave lockout; Page 10 Grand Atelier has a 90 s personal cooldown; pin count/geometry checked at commit; pins consumed on success only. Page 04 (Ladder Stitch) crosses only temporary ground hazards, not world walls; Page 07 (Wrong-Side Hem) provides voluntary speed along its seam. Page 3 defers exactly one FRIENDLY projectile with unchanged heading (check pierce and ownership).
- **Mora:** both endpoints anchored to existing posts; ferry length obeys path collision; boarding cannot occur during hard CC; carrying ally requires consent; enemy may board; valid exit fallback if post destroyed mid-trip.
- **Vesper Nullcode:** no inward gravity pull; direction bias has angle cap, movement speed cap and safe collision resolution. Standing still yields zero forced movement.
- **Sevrin:** category taxes apply only to valid enemy ability completions within a court; cannot prevent a cast from resolving. Category comes from server ability definition, not name-string heuristics.
- **Ivera:** frost line requires two valid forks; triangle R uses Ivera's cast position as third vertex; remove fork => line stops on next tick. Forks destructible.
- **Joruun:** no overlapping slabs forming an unescapable sealed loop; at least one accessible exit of >=2 hero radii. Gates cannot overlap towers or block spawn.
- **Garruk:** jaws have single trigger and per-target lockout; no chain root loop or snap without warning.
- **Pippa / Ravelle:** every delayed strike has telegraph and at least one viable non-hit location, even in narrow maps.
- **Solenne / Prismelle / Serrin:** projectile handling is composable in deterministic order: world wall -> shield intercept -> redirect/deflect -> damage. Max one redirected flight path per projectile; no ping-pong.
- **Droven / Murdle / Thimble / Bram:** all cover is breakable/expire; avoid infinite denial of the only lane.

## 5. Cast and combat AI

Implement skill-specific utility scorers, not `if enemy in range then cast`. Each score uses observable predicted information and includes opportunity cost. Suggested formula (relative weights should be calibrated):

```text
U(ability, target, location, time) =
    2.0 * expected_ally_survival_gain
  + 1.7 * predicted_objective_control
  + 1.5 * enemy_decision_cost
  + 1.2 * expected_damage_delta
  + 1.0 * ally_combo_followup_probability
  + 0.8 * positioning_advantage
  - 1.6 * self_exposure_risk
  - 1.3 * cooldown_opportunity_cost
  - 1.1 * collision_failure_risk
  - 0.9 * counterplay_easy_escape_probability
```

- Compute at 3–5 candidates per ability rather than every world point; don't explode x4 simulation CPU.
- Predict 0.5, 1.5 and 3.0 s windows; include path obstruction, ally health/death estimates, objective secure race, nearby anti-dive threats and visible enemy willingness to leave the zone.
- Mandatory bot ability actions: `prepare` (placement), `read` (enemy commitment), `commit` (cast or accept route), `reposition`, `hold` (save cooldown), `cancel` (danger or invalid targets), `followup`, `disengage`.
- Formation AIs evaluate area effects based on enemy spread and expected safe-gap escape. Artillery aim uses probabilities, never hidden final player locations.
- Rescues choose a real threatened ally, route legal status, escape destination, and attack-bait cost. No autopulling allies without their virtual consent decision.
- Rhythm/reaction heroes (Odo, Nemea, Toma, Lulla) must forecast *windup completion* at current tick rather than targeting based on raw range.
- Devices get an explicit `enemy_may_destroy` probability based on nearby threats and time to arm; don't treat them as guaranteed to survive.
- Add a blackboard `teamfightPlan` with intent (`engage`, `counter_engage`, `peel`, `split`, `objective`, `escape`), expected ally actions and risk; individual heroes may reject unsafe plans.
- Produce debug trace for every major action: candidate utilities, prediction horizon, visibility inputs, selected action, actual outcome and failure reason.

### Ten concrete teamfight test interactions

1. **Solenne + Maris:** oriented panel protects the first lantern crossing, but exposed side lets enemies flank.
2. **Ivera + Teslan:** tuned ice fork corridor plus rod circuit create a contested choke, both destructible.
3. **Brohm + Dolm:** foam current and tilted ground encourage different routes, but clipping must never strand units.
4. **Mora + Koro:** ferry an ally to a vault pole, accepting two independent explicit movement decisions; collision must remain valid.
5. **Lulla + Sevrin:** post-cast recovery window and repeat-category tax should combine only up to a global recovery cap (suggest 0.7 s extra per cast), not create de facto infinite silence.
6. **Mirelle + Garruk:** Ladder Stitch provides a temporary route over *ground jaw hazards*, but not impassable world walls.
7. **Pippa + Ravelle:** delayed fireworks and airstrike grid should retain at least one navigable safe corridor at all active ticks; if not, prevent joint strike geometry via shared danger-budget resolver.
8. **Thimble + Droven:** moving planter and tortoise shell create layered cover without permanently sealing lane; allied NPCs can path around it.
9. **Ashkar + Vesper Loom:** support redirection can keep an ally alive but must not endlessly generate Ashkar's retaliation marks on redirected self-damage.
10. **Toma + Odo:** predicting an enemy cast around a beat creates a meaningful counter-parry, not hard-coded perfect timing.

## 6. Balance baseline and regression gates

**Do not invent a polished balance sheet before engine timing is known.** First capture current fight metrics and arena movement conversion. Suggested gates (adjust based on confidence bands across 500+ seeded paired matchups):

- Relative win rates near 50% in broad randomized tests; flag >57% or <43% over adequately sampled fair matchups for follow-up, not automatic nerf.
- Median teamfight time and first-blood timing should remain inside a project-approved band compared with baseline. Explicitly evaluate stalemates caused by defensive constructs.
- Meaningful contributions: mitigation, rescue completions, successful disruption of enemy formation, objective-secure difference, damage, ally time alive, counterplay exploitation.
- CC/recovery chains: for any target in a 5 s window, extra added **post-cast recovery** <=0.7 s per individual cast, no more than 1.4 s aggregate from controllers unless counterplay escaped; root and displacement durations separately capped.
- Construct limit per team: start with 16 active total devices (hero-specific smaller limits apply) and a 25% lane width safety threshold, configurable after testing. Ensure actual legal path through critical objectives.
- Track ability presses that produce no observable world interaction, unreachable AI-controlled constructs, device spam, pathfinding oscillation, infinite attack-buff loops and ML regression.
- Machine learning can propose numerical patches only; holdout comparison and champion-level variance analysis are mandatory. Ship a revertible config snapshot, not a direct unreviewed code rewrite.

## 7. Production checklist and build order

**Stage A — Freeze and identity migration:** snapshot original IDs, public champion descriptions, player cards, match records; introduce a stable display mapping and compatibility aliases. No combat behavior changes in this stage. Tests for persisted IDs and JSON schemas.

**Stage B — Foundational engine:** tick-based deployables, obstacle/cover, collision/projectile interaction, cast recovery, voluntary travel paths, telegraphs and AI observation guards. Test one example of each.

**Stage C — Mechanic vertical slices:** implement Lulla (post-cast timing), Mirelle (palette, pins), Mora (opt-in ferry), Vesper Nullcode (vector field), Teslan (circuit). Verify all five in seeded matches and debug replays. These five expose most required infrastructure.

**Stage D — Remaining 40 heroes:** integrate in 5–8-hero batches. Must pass data validation, no legacy fallback, counterplay scenario, AI scorer, visual state and replay parity before next batch.

**Stage E — Full roster and frontend:** complete hero cards / tooltip translations / status panels / art placeholders / ability geometry previews. Replace misleading legacy icons or leave clearly tagged placeholders instead of copied artwork. Ensure hero choices use proper name + title and oldId internal redirects.

**Stage F — Tournament regression:** seeded 1× vs 4× determinism, multi-roster fight patterns, 1000+ evaluation matches (sample size configurable based on compute), per-hero tactical contribution, critical bugs and automatic rollback of numerical experiments. Document remaining limitations.

### Required automated acceptance tests

- 45 legacy IDs map to 45 unique canonical IDs, each with P/S1/S2/R, valid title, silhouette, counterplay and AI plan.
- No old Fizzlewing `Illusory Orb Jaunt`, `Waning Rift Silence`, `Dream Coil Tether`; no Arsenaldo `Orb of Ice/Wind/Fire`, `Conflux`, `Quas/Wex/Exort` behavior; no Hooklyn harpoon-grab/lantern/box behavior survives on renamed hero.
- Lulla taxes completion only, ignores attacks, allows spells to resolve; x4 replays equal x1 seeded simulation.
- Mirelle can select all 10 pages in tests, rejects invalid pin layouts, respects cooldowns/costs, and cleans up expired objects.
- In any 1000-tick bot run: no NaN, negative cooldown, stuck unit, invisible cover, orphaned ferry passenger, forever queued spell tax, or infinite status loop.
- Every R has at least one explicit and practically achievable counteraction tested by one scripted enemy agent.
- Every hero participates meaningfully in at least one 5v5 scripted engagement and has a measurable utility outcome beyond just raw damage.

## 8. Authoring / content files

- V3 canon roster source should exist in machine-readable format (TS or JSON) alongside its developer-owned runtime model. This document remains creative ground truth but runtime needs validated enums and executable handlers.
- Export `hero_identity_map.json` with old/new mapping including names/title/roles. UI must render both proper name and title; old keys remain for persisted data migration.
- Export `ability_specs.json` or TS authored table including slots, effect shapes, conditions, visual warnings, counters and AI signals.
- Include a changelog indicating intentional departures from old familiar kits and never silently mix old ability data into V3.
