# CODEX MASTER IMPLEMENTATION PROMPT — ESPORTSCLASH ORIGINAL 45-HERO OVERHAUL V3

You are the lead gameplay engineer, simulation architect, AI programmer, technical animator, data migration engineer, and QA lead for **EsportsClash**, a web-based, one-lane MOBA simulation with autonomous AI combat and an ML-driven balancing workflow.

**This is an implementation request, not a brainstorming exercise.** Implement the attached V3 design across the existing project. Do not stop after editing `mockData.ts`, tooltips, character names, or cosmetic visuals. The fundamental game mechanics must execute from the authoritative simulation and materially change teamfight behavior. Work in reviewable phases, deliver runnable tested increments, and explicitly report any unimplemented elements instead of presenting them as complete.

## Read these inputs before editing anything

Read the following files in this exact priority order (copy them into the repository or use the full paths supplied by your environment):

1. `ESPORTSCLASH_ORIGINAL_45_HERO_REDESIGN_V3.md` — **creative/mechanical source of truth**, 45 canonical characters, P/S1/S2/R, original 10-page Mirelle spellbook, counterplay, AI cues, originality audit.
2. `ESPORTSCLASH_V3_ENGINE_AI_BALANCE.md` — **technical invariants, simulation authority, tests, AI utility, build order, regression criteria**.
3. `ESPORTSCLASH_V3_CHARACTER_ART_BIBLE.md` — **45 visual identities**, silhouettes, palette/props, rig and VFX animation directions. Treat these as specifications, NOT existing 3D assets.
4. `ESPORTSCLASH_V3_IDENTITY_MANIFEST.json` — **exact 45 legacyId ↔ canonicalId/name/title mapping**.
5. `ESPORTSCLASH_V3_ABILITY_DESIGN_MANIFEST.json` — **machine-readable editorial ability contracts** (design-only, not runtime data).
6. Legacy `avatar-ability-catalog-20261023.md` — **legacy inspection/migration fixture ONLY**. Do not recreate or preserve the mechanics that V3 replaces.

If any design text and manifest disagree, use the full V3 roster document for ability behavior; use the V3 identity manifest for canonical spelling. Report any ambiguity as a tracked implementation decision with tests. Never silently copy the old ability behavior as a shortcut.

## Product principles and nonnegotiable constraints

- The roster is exactly **45 original characters**. Every old ID continues to resolve to its designated hero without breaking old player-card ownership, packs, equipment, collections, match history, statistics, or API references. Use versioned aliases and data migrations, not destructive renames of existing primary keys.
- Every hero has an actual passive, S1, S2 and R, with explicit cast targeting, authoritative effects, windup/recovery, cooldown, resource cost, visuals and bot usage. Mirelle's R contains **ten selectable fabric-pattern pages** with independent cooldowns and a short shared weave lockout; **no elemental orb recipe system**.
- The new 45 kits must replace—not merely overlay—the derivative old combos listed in the V3 originality audit. In particular: no Lulla orb teleport/phase immunity/AoE silence/dream tether, no old Invoker-style Arsenaldo recipes, no Mora hook/lantern/box, no Garruk hook/rot/suppression, no Pippa Jinx weapon swap/zap/global execute, no Sevrin global silence, no Koro clone/spin-staff.
- A teamfight ultimate should change geometry, safety, timing, positioning or tactics, not merely show large damage numbers.
- Respect the existing one-lane MOBA arena, bosses, towers, lanes, teamfights, pathfinding, game speed controls and player-card systems. Do not introduce side-lane assumptions or require a jungle.
- No unavoidable/uncounterable chain of hard control, indefinite shelter, infinite deployment, obstructed only-lane paths, forced ally travel without consent, or wall clips.
- This is a **deterministic simulation**: same seed + initial state + input event stream must produce identical authoritative results at 1× and 4× simulation presentation speeds. No gameplay based on `Date.now()`, raw wall clocks, render frame durations, visual animation callbacks, nondeterministic collection iteration, or client-side collision.
- ML may propose **balance configuration** changes with holdout tests, versioning and rollback. Do not let runtime ML write or execute arbitrary code. Do not allow newly renamed heroes to silently reuse stale models trained on incompatible ability semantics.

## Phase 0 — Repository discovery and baseline (do this first)

1. Inspect project layout, read `README`/agent handoff, package scripts, test runner, simulation engine, champion identity files and ability resolvers. Search for references to `EsportsClash.Web/src/mockData.ts`, `additionalChampions.ts`, `avatarIdentity.ts`, current champion arrays and combat decision logic. Paths in previous chat may have changed.
2. Identify the authoritative source of truth for match simulation, ability registration, movement/collision, targeting, health/shield/damage resolution, status effects, animation events, rendering, localization, cards, databases, AI and ML. Draw a concise actual architecture map in `docs/avatar-rework/IMPLEMENTATION_LOG.md`.
3. Snapshot current game as a baseline: commit or create a change set in a dedicated branch; store existing ability definitions as versioned fixtures. Capture reproducible seeded reference games for tactical metrics and errors.
4. Verify the V3 manifests: 45 unique legacy IDs, 45 unique canonical IDs, 180 base slots (P/S1/S2/R), and **10 Mirelle pages**. Fail CI if any are missing or duplicated.
5. Establish runtime unit conversion from the V3 **GU** examples to actual world positions/speed and log the chosen scale. The design's GU values and cooldowns are initial hypotheses, not universal game constants.

## Phase 1 — Canonical identity and data migrations

- Implement a `HeroIdentityRegistry` or idiomatic equivalent containing `canonicalId`, exact display name, exact title, legacy aliases, class/role, abilityIDs and animation/asset keys.
- Preserve persisted existing hero keys with **nonbreaking resolver aliases** for legacy routes and match histories; use canonical names in new UI, APIs and dashboards where safe. Add tests for cross-version card ownership and old saves.
- Build a safe migration/backfill process. Do not destructively overwrite existing match history or card IDs.
- Update hero selection, in-match HUD, loading screens, hero detail pages, gacha/player-card previews, leaderboards and AI debug labels to show **name + title**. Maintain machine-readable `legacyId` for analytics compatibility.
- Replace old ability descriptions with V3 abilities only when real effect handlers exist; otherwise show feature-flagged WIP status rather than claiming a cosmetic change is implemented gameplay.

## Phase 2 — Generalized authoritative effect engine

Design reusable typed primitives; do **not** create 45 unrelated hardcoded special cases with inconsistent collision or status logic. Build/test:

- `tickScheduler` for start/commit/recovery/expire; scheduled ticks and seeded RNG only.
- `worldConstructs` and `zoneLifecycle`: spawn, damage, consume, reposition, expire, owner/team, HP, LOS, real collision, targetable geometry, charges, public telegraph and deterministic cleanup.
- `geometry`: oriented segment, directed rectangle, wedge, disk, triangle, 2×2 strike grid, projected path, incoming projectile vector, closest legal position, path connectivity, open-exit check.
- `projectileResolver` deterministic precedence: **world wall → one-hit shield intercept → authorized single deflection/reflection → damage**. Prevent recursive bounces and reflected-shot multiplication.
- `movementResolver`: bounded vector fields, foam currents, friction, turning bias, roof cover, moving cover, short slides, rails, skiffs, voluntary ferry boarding, optional vault routes and nearest-valid-landing fallback. Never clip hard walls.
- `statuses`: heal/shield with global caps, partial damage redirection, cast recovery tax **after** spell completion, categorical repetition penalties, directional mitigation, spell windup/recovery, timed hazards, per-target trigger lockouts, no recursive event chains.
- `visibilityAndTelegraph`: all visible warning arcs, HP on constructs, legal destination previews, fog rules and available counterplay; bots observe the same projection as users.
- `inputCommit`: selection versus cast state (especially Mirelle's R page palette), valid targets, mana, cancellation, refund and authoritative events. Invalid or blocked casts must have a consistent refusal and cost policy.
- debug structured logs/replay: `ability_started`, `ability_committed`, `ability_failed`, `construct_placed`, `construct_destroyed`, `cast_recovery_added`, `movement_modified`, `projectile_intercepted`, `ferry_boarded`, `ferry_cancelled`, `ai_choice_explained` and expiration.

Use typed or runtime-validated effect definitions; do not ship a permanent `Record<string, any>` effect engine. Ensure unit/world effects are calculated server-side or in the project's authoritative state loop, never inferred from VFX meshes.

## Phase 3 — Vertical slices before mass migration

Implement these **five full heroes first** with gameplay, bots, readable VFX and tests:

1. **Lulla Faespring**: completed-cast Drowse notes and post-cast recovery taxes; three public theater beats; spells still resolve normally; no ability silence or escape teleport.
2. **Mirelle Vane**: adult mage-girl Atelier design, pin deploy/move/destroy, 10 fabric spell pages, conditional geometry, resource/cooldown feedback. Make sure Page 04 bridges only **temporary ground hazards**, not world walls; Page 03 may hold one **consenting allied non-ultimate projectile** with unchanged trajectory; Page 10 canopy is counterable.
3. **Mora Fenhook**: collision-legal, opt-in ferry route, boarding/disembark, source/destination destruction, enemy interception; do not hook anyone.
4. **Vesper Nullcode**: smoothly biased walking heading under explicit angle caps and safe collision, no black-hole pull; stationary actors remain stationary.
5. **Teslan Veyr**: rod geometry, polarity control, crossing resolution and enemy counterplay, no lightning remnant/pull/ball travel.

For **each** vertical slice deliver: hero registry binding; authoritative passive/S1/S2/R; enemy-targeted tests; a 5v5 tactical scenario; AI decision scorer; effect visibility; documentation of exact limitations; x1/x4 deterministic replay parity.

Stop and fix foundation errors before expanding to the other 40.

## Phase 4 — Implement the other 40 distinct kits

Use the V3 roster document as literal mechanical requirements. Work in groups small enough to test:

- **Group A (team-facing geometry):** Solenne, Ivera, Mireth, Bramm, Kael, Nyxara, Serrin, Orin & Fen, Quillene, Aurelio.
- **Group B (cover, rescue and hazard ecology):** Droven, Thalara, Vesper Loom, Rux, Joruun, Astrax, Prismelle, Ashkar, Maris, Odo.
- **Group C (terrain and interception):** Mourn, Dolm, Garruk, Coiljack, Talan, Calixa, Brohm, Maelis, Axiom, Brakka.
- **Group D (timing, skies and movement):** Pippa, Bryx, Murdle, Nemea, Thimble, Sevrin, Koro, Bram, Toma, Ravelle.

Each group must have actual runtime handlers and tests. Never copy the legacy skill effects because they superficially match the new role. Give each skill a consistent declared signature; share generic typed primitives, not character-specific behavior. Character passives must trigger in real matches. Handle unit collision, targets outside range, destruction and expired construct references, status application order, deaths during channel, despawn during projectiles, save/load and replay.

## Phase 5 — AI integration and genuine teamfight intelligence

The teamfight simulation is autonomous. **Every new ability must have usable AI**, not a placeholder `castNearestEnemy()`:

- Derive legal candidate actions (targets/positions/orientations) from the agent's **public observation** only; evaluate nearby allies, formation, visible enemies, threats, safe passages, objective timelines, expected counters and whether required constructs are likely to survive.
- Implement utility scoring as a tunable function of ally survival delta, objective control, enemy decision cost, damage delta, ally follow-up probability, positioning, exposure risk, cooldown cost and predicted escape chance; use the referenced AI/balance spec as a starting design.
- All AI actors choose between `prepare`, `read`, `commit`, `hold`, `followup`, `reposition`, `escape` and `cancel` with real reason codes. A good agent should sometimes **not** use a ready ultimate.
- Explicit consent decisions for allied ferries, position swaps, vault poles and optional air routes. Bots must decline suicidal or illegal routes.
- Fix cross-hero combos using realistic coordination, not hidden future events. Script and test at least the ten interactions in the companion engine spec (Lulla/Sevrin timing, Pippa/Ravelle safe grids, Mirelle/Garruk hazard bridges, Koro/Mora consent, etc.).
- Add tactical metrics: blocked incoming damage, prevented ally deaths, successful escort, target separation, enemy route denial, forced cooldown usage, objective value, construct survival, offensive damage, utility despite zero damage and counterplay used.
- Keep prediction budget bounded so 4× simulation runs within project-approved CPU/RAM limits. Memoize geometry and limit candidates; retain deterministic ordering/tiebreakers.

## Phase 6 — In-game art direction, animations and VFX

- Use the full 45-hero art bible for silhouette, costume and VFX language. Update UI placeholders, consistent icons, targeting previews, projectile meshes and animation-state metadata to match V3. Avoid copyrighted resemblance or direct copying of League/Dota assets/animations.
- **Do not fabricate the existence of 45 finished 3D models, rigs or animations.** Use clearly labeled bespoke procedural placeholders where assets are absent, with a stable asset manifest and TODO status for individual files.
- Create asset intake contracts for original T/A-pose RGBA reference, separate equipment, grip/origin/socket, model topology, rig, deformations, timing and glTF/GLB animation export. Integrate actual original production assets **only when supplied/generated and quality-validated**.
- Important for simulated fights: use anticipation, cast commit, hold, travel, impact, follow-through, interrupt and recovery animation states. Signals must precede the actual authoritative action where appropriate, not retrospectively appear after damage. Keep world danger and safe exits legible at top-down gameplay camera height.
- Render countdowns, breakable HP, direction arrows, consent affordances and delayed strike cells, including color-blind-safe alternatives. Visual effects should reflect authoritative state via event IDs and not simulate unverified additional hits.

## Phase 7 — Test, optimize, balance and regression

Create automated validations and execute them. At minimum:

1. Identity and save-game backward compatibility; all 45 hero aliases, 180 base ability slots and exactly ten working Mirelle pages.
2. For each hero: passive, S1, S2 and R produce actual inspectable authoritative combat outcomes; zero silent fallbacks to old runtime.
3. At least one counterplay action is executable by a scripted enemy for every R.
4. Geometry collision, LOS, projectile deflection one-bounce cap, destroyable constructs, expire/remove, visible windups, invalid casts not accidentally consuming resources.
5. x1/x4 deterministic replay equivalence for identical seed/input stream; include multiple completed teamfights and boss contests.
6. 1000+ tick soak across random legal team compositions: no NaN, negative time/health, orphaned projectiles, infinite shelters or statuses, forced wall clips, stuck passengers or navmesh no-exit states.
7. Specific anti-clone assertions: **Lulla** never teleports to an orb/enters phase invulnerability/silences a region/snaps a tether; **Mirelle** has no elemental recipes; **Mora** has no target hook or ring prison; **Pippa** no switchable minigun/rocket/global execute; **Sevrin** cannot suppress enemy cast resolution globally.
8. Battle-usefulness checks: one scripted 5v5 for every hero, recording at least one contribution independent of plain damage (or explicit class-appropriate win condition).
9. Run baseline-seeded simulations and compare win rate/confidence interval, median teamfight length, stalemate rate, status-chain cap, objective contest outcomes, damage/shield/control distribution and average compute time. Mark regressions with causes; do not silently declare balanced.
10. Protect ML balance patching behind a feature flag/config version with holdout gates and rollback. Existing learned policies must be retrained or retriggered for V3 where necessary; never immediately deploy a regression-prone self-editing code agent.

## Implementation process and communication

1. First provide a short actual-repo architecture audit and an ordered execution plan. **Then make code changes; do not stop at the plan.**
2. Complete the work across as many coherent changesets as the environment permits. At the end of each batch, report which character kits are functionally implemented, which primitive systems changed, tests executed, evidence, and blockers.
3. Maintain `docs/avatar-rework/IMPLEMENTATION_LOG.md` with a table of all 45 characters and status for identity, passive, S1, S2, R, AI, VFX and tests; use `implemented`, `partial`, `blocked` or `not started`, not vague percentages.
4. If tooling/context is limited, implement as much verified work as possible; do not claim the entire roster ships because definitions exist. The end state is **all 45 fully executable in actual matches**, fully integrated into AI and UI, with high-priority regression tests passing.
5. Preserve working systems in unrelated parts of the game. Prefer compatibility layers, feature flags, small typed helpers and testable deterministic primitives to widespread untested rewrites.
6. Describe every discretionary balance choice not specified by the docs. Use existing project's math and scaling conventions first, then data-driven provisional values. Do not invent copyrighted asset files.

## Definition of done

I can select any of the 45 avatars by canonical name, enter a real EsportsClash match, visibly use their true V3 kit in combat, witness AI opponents and teammates respond tactically, reproduce the same combat at 1×/4×, and view correct original name+title everywhere, **without breaking legacy card ownership or any old match reference**. Mirelle, Lulla, Mora, Pippa and the rest must play differently from their old recognizable analogues. All remaining missing original character art is explicitly tracked, and the gameplay does not pretend a placeholder is a production rig.

**Begin now with repository discovery, then implement the full V3 roadmap.**
