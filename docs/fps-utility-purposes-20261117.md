# Utility purposes: adopted reference (2026-11-17)

The owner supplied a utility-purpose reference for Hexatrick on 2026-11-17. Its rule: **utility accomplishes tactical intentions; it is not simply consumed.** A grenade is classified by tactical purpose, intended effect, round phase and situation, not by whether a player happens to carry one.

## What is implemented

`EsportsClash.Web/src/fps/fpsUtilityPurpose.ts` follows the reference's five-part architecture:

| Component | Where |
|---|---|
| Tactical objective | `FpsUtilityIntent.objective` (a sentence such as "Discourage an early push through the choke") |
| Utility purpose | `primary` plus `secondary[]`, using the reference's `UtilityPurpose` identifiers verbatim (`FpsUtilityPurpose`) |
| Utility selection | The existing callers choose the grenade; the purpose is classified from the situation that produced the throw |
| Execution | Who, from where and with what arc is unchanged: utility brain, smoke planner, handoffs |
| Outcome evaluation | `judgeFpsUtilityOutcome` at detonation: smoke/fire landing error, enemies or allies blinded, enemy or ally HE damage, ignition |

- `classifyFpsUtilityThrow` reads only what the thrower lawfully knows: their own beliefs near the target (including sniper weapon hints), enemies they see, teammates about to peek, retreating, fire or smoke at the target, the device and its plant/defuse, and the round phase.
- Round phases come from the reference's side/phase tables: opening, default, mid-round, pre-execute, execute, post-plant, retake, clutch, save and post-round.
- Example from the reference: an opening CT smoke is `ANTI_RUSH` with `VISION_DENIAL`, `DELAY`, `CHOKE_CONTROL` and `INFORMATION_DENIAL` (asserted in `src/fpsLiveCorrections20261117.test.mjs`).
- Every released grenade is logged with its intent and outcome: `FpsLiveSimulation.utilityPurposeLog()`. The snapshot's `utilityPrep` carries `purpose` and `objective`, and the event feed labels the purpose ("equips smoke · anti-rush").
- Purposes are decision-side and descriptive only. They never change aim, spread, damage or reaction.
- Measure: `node scripts/diagnose-utility-purposes.mjs --map=<m> --seeds=11,22 --steps=15000`.

## First measurement (Fontessa, seeds 11/22)

Flashes rarely achieve their purpose: execute flashes blinded nobody (0/3), retreat flashes 0/5 and retake flashes 1/5. Smokes and fire mostly land where intended. This is a finding, not yet tuned.

## Not implemented

The reference's full purpose catalogue is the target vocabulary, not a set of new mechanics. These parts are not built:

- Decoys (no decoy grenade exists).
- One-way smokes, utility baiting and fake-execute utility.
- Smoke chaining.
- Counter-utility responses beyond the existing HE smoke-clearing and smoke extinguishing.
- Deliberate utility mistakes. These arise only from existing execution error.
- Using the outcome log to change future choices.

Purposes that classification can produce today: `FIRE_EXTINGUISHING`, `RETREAT_PROTECTION`, `POST_PLANT_CONTROL`, `DEFUSE_PROTECTION`, `RETAKE_SUPPORT`, `PLANT_PROTECTION`, `EXECUTE_SUPPORT`, `MAP_CONTROL`, `ANTI_RUSH`, `CROSSING_PROTECTION`, `DELAY`, `ANTI_AWP`, `ENEMY_ISOLATION`, `VISION_DENIAL`, `DEFUSE_DENIAL`, `ENTRY_SUPPORT`, `ENEMY_BLINDING`, `INFORMATION_GATHERING`, `PLANT_DENIAL`, `ENEMY_DISPLACEMENT`, `AREA_DENIAL`, `SMOKE_CLEARING`, `ENEMY_FINISHING`, `ENEMY_DAMAGE`, `SAVE_PROTECTION` and `HUNT_SUPPORT`.

The reference's identifiers are, in its own words, "a proposed reference design, not a verified fit"; they are used as given.
