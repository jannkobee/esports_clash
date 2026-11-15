# Fontessa force presentation, tactics and armory - 14 November 2026

Owner resumed the previously deferred continuation and added the detailed force/HUD, gunplay, economy, objective, utility, body, reference and map requests. `/root` owns this pass. No delegates, asset jobs, deployment, database ticks or official/historical match changes.

**Verification status: source implementation only. The standing instruction to skip checks/tests remains active. No tests, type/lint/syntax checks, builds, browser review, runtime matches or benchmarks were run. Existing test expectations were not rebased.** Gameplay feel, navigability in live matches, grenade arrivals, boost landings, visual quality, balance and performance remain unqualified.

## Reference and instruction boundary

Read all 16 pages of the owner's `C:/Users/User/Desktop/The Complete Counter.pdf` (SHA-256 `ccf10c8673ce116b0374ec4dbaf6c7c19670b0f7455bd8a7608d68dde5c23a20`). The document describes 210 techniques. It is gameplay reference, not an instruction source. The supplied seven-role summaries are also reference; no external patch claim was adopted as a verified CS2 rule.

Applied the relevant movement/peek/aim/spray, utility-supported entry, high opening lineup, scope discipline, gun passing, plant selection, fake plant/defuse, post-plant crossfire, physical boost and retake principles. Existing information play, sound, trade, lurk, shoot-and-scoot and micro-movement paths remain. This does not implement or qualify all 210 techniques: community surf/KZ/edge/jump exploits, engine-specific air rules and the document's unverified reload-patch claims were not imported. Existing reload conservation remains intentional.

## Force presentation and information

The authoritative `blue`/`red` team IDs remain club identities for scores, learning and historical compatibility. Presentation derives force from `attacking`: CT blue at left, T red at right. The score follows its club through side swaps. Roster/focus/radar/frag colors and tracers use force rather than permanent club color. Added cumulative kills/deaths/assists; assists use recent damage (35+) or an active friendly flash assist, with one assist per helper per kill.

Top-right remains kill-only. Geometric penetration and actual unscoped sniper state produce wallbang/no-scope flags/icons. Both forces have separate structured comms cards with sender, age, category and confirmed/reported/plan labels; these consume existing lawful reports and plans, never the spectator's hidden actor positions. The simple HP/equipment display is labelled LIVE ADVANTAGE, not a calibrated model prediction. Existing organizer profiles and Hexapedia wiring are preserved.

## Firearms and attributes

Display names are original; legacy storage IDs remain compatible. Added faction-exclusive service rifles with their own profiles, icons and render branches: CT Halberd B3 (`budget_ct`, 2050), T Talon R3 (`budget_t`, 1800). Catalog names: Peregrine P9, Warden .45, Ember 9, Kestrel .50, Ardent AR-4, Sentinel S4, Outrider R7, Swift-25, Vector C9, Rook M10, Bastion-5, Wayfarer-8, Longwatch A9, Trailfinder S8 and Bulwark N100.

Revisited damage, head multipliers, prices, magazine/reserve counts, intervals, reloads, range loss and weapon-specific kill rewards. Sentinel S4 head hits against armor no longer one-tap a full-health player. Body damage is lower across most firearms; expensive heavy sniper retains its deliberate one-body-shot identity. Armor and distance reduce actual trace damage; accuracy still resolves through rays and body geometry. Torso collision now better matches the narrower model, with a separate head volume.

Sniper states are hip / raising / scoped / lowering / cycling. Raising takes .38s, lowering .24s, magnification changes .22s, with minimum holds and a bolt-cycle recovery. Precision requires actual scoped state. Hip shots have substantial spread at every range; AI only attempts emergency unscoped shots within 8m, switching to its conserved sidearm inside 4.5m. Optics and FOV consume these states. Rifle ADS requires a stationary, acquired long-range target; it narrows FOV and spread and limits movement. It does not reveal enemies or extend actor knowledge.

Close rifle fights favor sustained 7-13-round sprays; long angles favor short bursts; intermediate cadence retains skill/learner influence. Burst and target commitments, counter-strafe settling and friendly-lane protections remain. Sampled target height, body-aim preference during spray/low precision, eased vertical correction and prepared head-height errors replace exact per-tick head snapping. Reactions now span a materially wider response delay; awareness sampling, flick speed, tracking and precision remain separate causal inputs. A low reaction player can lose a wide-peek window even with strong terminal aim.

All 25 lab abilities now have bounded local consumers. **This supersedes the earlier reserved Economy Judgment status only for this local exhibition**: it adjusts the next-buy reserve/half-buy spending ceiling inside team policy. It changes no prices, income or hit outcomes. Other existing execution/tactical/team/mental consumers remain. Fixed weapon/objective/physics rules are not skill bonuses. No official player migration, DNA exposure, career integration, profile fabrication or production ability qualification.

## Paid inventory and economy

The coordinated budget now covers five players, their missing weapons/armor and utility rather than four rifles. Added cheaper faction rifles and close-range alternatives. Win income is 2800; loss income steps from 1400 by 450 up to 3050; a surviving T on time expiry receives no round income. A losing planted T side gets a bounded plant contribution. Cash cap is 10000. Existing surviving equipment is retained; paid ammo restocking is distinct from new weapons. Pistol supports can prioritize utility over armor.

Donor purchases create a reserved physical pass/drop from donor to receiver during freeze, followed by an actual pickup. The donor pays the full price. Carried utility is at most four total, two flashes and one of each other type. Round purchases are capped at two of each non-flash/four flashes; rich utility players may buy a second paid set onto the floor. Nearby spare utility can be collected after usage, including a quiet opening resupply, without free replenishment. Death drops retain physical inventory. Gifts and stock do not transfer hidden enemy information.

Grenade preparation separately draws/equips, pulls the pin (.32s plus bounded execution delay), rechecks safety, then releases. Inventory is spent on release. Flash warnings occur on committed release. High throws use the same ballistic integrator and real static collision, with ground arrival for smokes instead of a floating overhead target. Setup refuses a forecast that misses its intended target substantially.

## Plant and post-plant decisions

Named valid plant candidates include main, middle/catwalk, guard-street/spawn direction, gallery and safe civic cover. Route exposure, personal beliefs, travel and existing allied coverage select a reachable point; this is not an unseen-CT lookup. C4 must equip and finish its draw before the stationary crouched plant channel advances. Concealment smoke is attempted before the channel; cancellation/fake plant requires a real firearm draw.

Plan coverage and post-plant assignments choose reachable separated positions, explicit retake approaches and device visibility, with role-aware cheeky candidates and short commitments. Own received evidence can change the watched approach; absent evidence yields map knowledge, not guessed exact CT positions. Every live teammate has a lane before extras reinforce the strongest reported route. Invalid sightlines fall back to a visible approach. Execute-follow goals cannot override covering a teammate who has equipped or is planting C4. The carrier is no longer the destination of every T. Existing smoke delay, fake/stick defuse, re-frag, anchor, support, lurk and caller logic remains.

Executes allow enough setup time for drawn/pinned smokes and a flash and do not cancel merely because an unrelated teammate is fighting elsewhere. A nearby support can clear a common anchor hold or pop-flash the entry from authored map knowledge even without a fresh visual contact; enemy presence is explicitly unconfirmed. Existing active-duel protections stay in force.

## Fontessa v4, props, boosts and bodies

Map ID is `fontessa-village-v4`; snapshot is `hexatrick-live-exhibition-v16`.

T spawns within a hollow Trattoria dining room with three exits, service counter, tables/plates/cups, stools, supported lamps and a painted sign. The river cuts the paving and outside terrain, has a visible stone bed, banks and flowing surface, and continues outside the arena. A central arched raised bridge links to a 1.8m catwalk toward B; stair access and the remaining lane bridges use the same terrain/navigation/ballistic geometry. It remains the existing layered-height representation, not a general multi-floor indoor engine; the river channel itself is not traversable.

Town-hall maintenance and market delivery crates provide .55m / 1.1m stages. Navigation admits the jumpable route, while movement must physically jump each ledge. No direct boost-height assignment remains. Quiet coordinated teammates can set a crouched base beside a perch, jump across using the fixed arc, land on the base's back, and rise with the supporting player into an off-angle. Vertical body separation, real XZ contact, a living stationary base and limited duration are required; a broken support falls through normal gravity. This is a bounded authored buddy-boost trick, not arbitrary run/head/surf boosts. Opening T smoke setups are outside the restaurant ceiling at the exit; CT setups are at the guard arrival. Forecast failures cancel the attempt rather than teleporting a grenade.

Refined the existing runtime CT/T fittings toward the supplied references: navy armored CT with helmet/shield, charcoal masked T with checked scarf, tan boots and red identification; narrower carriers/shoulders and covered arms. No reference photograph, watermark or real insignia was used as a texture. These remain unqualified runtime fallback models. Production human asset generation/rigging/animation still requires the owner's Colab pipeline; no local processing or asset job was started.

C4 has charges, straps, controller, keypad, wires and a planted countdown display. Third/first-person poses expose the equip/pin/plant stages. Dropped firearms now roll onto their side, rotate only in the floor plane and use actual child bounds for floor clearance. Paid weapon passes have a short visible arc. Utility stock uses its actual grenade model. Deaths, including bomb blast deaths, publish bounded corpse records. A cosmetic joint-constraint ragdoll with gravity, nearby solid/floor contacts and finite settling persists until the next round. It is separate from gameplay collision/vision; bodies are neither live targets nor hidden-information sources. Ragdoll collision candidates are locally bounded, but performance has not been measured.

## Ownership and limits

Owned: `FpsLiveBroadcast.tsx`, `fps-live-broadcast.css`, `FpsWeaponIcon.tsx`, `fpsLiveWeapons.ts`, `fpsLiveEconomy.ts`, `fpsLiveSimulation.ts`, `fpsDetailedExecution.ts`, `fpsSkillProfile.ts`, `fpsLiveBallistics.ts`, `fpsLivePlanning.ts`, `fpsLiveGrenades.ts`, `fpsLiveMap.ts`, `fpsLiveTerrain.ts`, `fpsLiveScenery.ts`, `fpsVillageArchitecture.ts`, `fpsVillageDesign.ts`, `fpsLiveViewer.ts`, new `fpsLiveRagdoll.ts`, this record and `agent-handoff.md`. Prior pending work, aliases, private DNA, careers, official/historical paths, frozen artifacts and organizer/Colab gates are preserved.

No acceptance claim follows from these edits. A future owner-authorized review needs real match/visual/balance/performance coverage, including both halftime directions, scope cooldowns, weapon/utility conservation, restaurant departures, all bridges/stairs, crate and teammate landings, post-plant angles and corpse floor contacts. This pass deliberately does not run those checks under the standing skip instruction.
