# Local FPS combat learning, friendly fire and timed utility setup

The owner asked whether learning should affect more than routes, with movement and combat reports kept separate, then requested reduced friendly fire and equip/setup timing for grenades. This work applies only to the browser-local live exhibition.

## Combat learning and separate reports

`fpsLiveMechanicsLearning.ts` adds a bounded rifle cadence learner. On an engagement's first rifle shot it chooses between a two-shot burst and sustained fire. Its eight contexts use observed near/far range, steady/moving speed and loaded/low magazine state. The behavior stays inside the existing rifle damage, recoil and accuracy rules. No learned value changes player abilities or weapon stats.

Completed-round samples use actual rifle damage dealt/taken, enemy kills and the round winner. Model updates are bounded, deduplicated by episode, and only committed on completed rounds. Exploration uses an isolated seeded random stream. A running simulation pins its starting model.

Combat state is persisted under `FPS_MECHANICS_STORAGE_KEY`, independently from the route learner's key/checkpoint. The lab exposes separate movement and combat counts and reset buttons. Exported diagnostics include separate `reports.movementRoutes` and `reports.combatMechanics` summaries and separate checkpoints. This is local adaptive behavior; it does not show that cadence choices improve match win rate.

As with route learning, browser storage is optional. If storage is blocked or unavailable, the running match still learns in memory but the checkpoint cannot be reused next time.

## Team damage

Rifle bullets can hit teammates and apply 35% of normal damage before armor. HE and incendiary fire affect both teams at 35% friendly damage; HE/fire damage to the thrower is 50%. Damage is real and can eliminate an ally. It does not add enemy hit/damage impact credit, award an enemy kill or cash, or create an enemy trade. Teamkills and self-damage are named in the kill feed. C4 damage remains unchanged.

## Grenade equip and setup

An accepted utility action equips the grenade for 0.55 seconds, then uses the existing 0.20-second visual/release wind-up. During equip the thrower brakes to a stop and cannot shoot. Setup is refused or cancelled if an opponent is visible within 22 m, the actor has been damaged within 1.35 seconds, or the actor is still committed to a nearby visible target. The thrower rechecks the forecast before release. HE and incendiary throws are held if the forecast overlaps the thrower or a teammate; allies are scheduled to turn before friendly flashes and can swing on the pop.

The damage and forecast checks do not reserve space around a grenade after it leaves the hand: a player can walk into a live HE/fire zone and be injured. AI decisions still use only personally seen or reported information.

## Affected files

- `EsportsClash.Web/src/fps/fpsLiveSimulation.ts`
- `EsportsClash.Web/src/fps/fpsLiveGrenades.ts`
- `EsportsClash.Web/src/fps/fpsLiveMechanicsLearning.ts`
- `EsportsClash.Web/src/fps/fpsLiveMechanicsLearningStorage.ts`
- `EsportsClash.Web/src/components/FpsLiveBroadcast.tsx`
- `EsportsClash.Web/src/components/FpsSimulationLab.tsx`
- `EsportsClash.Web/src/fpsLiveMechanicsLearning.test.mjs`
- `EsportsClash.Web/src/fpsLiveTactics.test.mjs`
- `EsportsClash.Web/src/fpsSkillProfile.test.mjs`
- `docs/agent-handoff.md`, `docs/arena-mechanics.md`

## Verification

The live snapshot schema advances to v9 and exported diagnostics to v3. Focused new regressions passed: 2/2 combat-learning tests and 2/2 new friendly-fire/setup tests; the existing timed utility and detailed throw regressions also passed.

`npm run check:game` passes: 801 tests passed, 22 skipped, zero failed; all three match simulations and TypeScript pass. `npm run build` passes in 8.68 seconds. Vite reports the existing large-chunk warning and plugin timing advisory. `git diff --check` reports no whitespace errors. Focused tests for the v9 snapshot and grenade timing also pass.

No browser-rendered visual review or competitive/balance qualification was performed. This remains a local exhibition mechanic; no official/historical match or MOBA behavior is changed.

Preserve the independent route-learning checkpoint, official/historical and MOBA paths, privacy, aliases, careers and Colab-only asset processing.
