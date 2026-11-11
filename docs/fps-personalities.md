# FPS personality rules (10 November 2026)

Later same-day presentation update: the owner's sample informed five categories and revised FPS names (including Flank Watcher for `bush_stalker`). All current names and definitions are available in native `#hexapedia/personalities`; no preference or mood weight changed. Settled desktop/mobile browser acceptance and Settings-to-replay access now pass. See [the later implementation record](fps-reference-and-navigation-20261110.md) and [deployed simulation v2](fps-tactical-v2-20261110.md) for the current status; the implementation-time limits and verification below remain historical evidence.

The owner requested continued development of the Counter-Strike-style transition, including personalities. `/root` owns this implementation in the FPS simulation, player management presentation and documentation. This is ordinary match simulation, with no asset generation, rigging, animation processing or publication.

## Identity and skill boundary

`EsportsClash.Web/src/fps/fpsPersonality.ts` interprets all 30 existing personality IDs for FPS play. Both traits contribute equally; duplicate IDs count once. Internal IDs, player identities, aliases, historical attributes and `playerPersonality.ts`'s MOBA definitions remain intact. Examples of current display translations are `wave_architect` → Execute Architect, `objective_zealot` → Device Specialist, `bush_stalker` → Angle Stalker and `steal_gambler` → Retake Gambler.

The six preference axes are aggression, coordination, patience, utility, conservation and leadership, each bounded to [-1, 1]. Role scores use actual skills with a personality contribution of at most six points in either direction. Equal scores resolve by stable player ID. Personality does not add aim, damage, health or money; a different equipment choice can have its normal mechanical effects.

The seven stored attribute keys stay unchanged. Current management labels describe aim/mechanics (`lan`), trading/coordination (`tf`), game sense (`iq`), shotcalling (`ldr`), clutch (`clu`), stamina (`sta`) and weapon flexibility (`flx`). These labels are interpretations, not a claim that every attribute has a complete physical weapon simulation.

## Round decisions and feedback

- At round start, attackers receive one entry, two trade assignments and two utility supports. Defenders receive an anchor, two trade assignments and two supports. The caller is selected separately and may hold any role. A support carries the device; slot order and historical avatar roles do not determine that assignment.
- Entry and trade selections feed the actual execute. Defender anchor preference feeds selection of the available site defender. Team preferences and available smoke/flash resources influence tactical call selection. A prepared team lacking enough utility may select a default probe instead of a rush.
- Conservation shifts only the marginal force-buy threshold from $2,600 by at most $200. Pistol rounds, the existing match-point force-buy rule, the $4,200 full-buy threshold, catalog costs and the $16,000 bank cap remain authoritative.
- Patience and actual aim/clutch skill inform affordable sniper purchases; the historical Marksman/Assassin preference no longer selects an FPS sniper. Entry players avoid buying a sniper. Utility preferences also affect kit purchases and aggressive flash priority.
- A defender save requires one or two living defenders, at least two more living attackers than defenders, at least one primary weapon to preserve, and average conservation of at least 0.25. Otherwise the existing retake is attempted. Saving records `save_equipment`, retains surviving equipment and allows the planted device to resolve as an attacker win. It does not grant a defuse or extra cash.
- Each player starts a fresh match with confidence 50, composure 70 and frustration 10. Completed round feedback changes these within [0, 100], tracks capped streaks and is idempotent for a round. Stable traits react less; volatile traits react more. Stamina and a teammate Captain/Glue Guy aid recovery. Frustration and streaks influence bounded preferences rather than shot calculations. Conditional pairs cover Bodyguard/Loyalist, IGL/Untiltable and Overconfident/Survivalist.

## Recording and presentation

New reports include `personalityVersion: 1`. Each round-start snapshot optionally records `tactics`: assigned role, caller flag, trait IDs, that round's mood, bounded preferences and a short explanation. Snapshots are copied so later results cannot alter earlier round mindset. Replay reconstructs this recorded state; it never recalculates a historical player's personality from today's roster. Older reports without these optional fields still replay without invented mindset data.

The replay exposes expandable round mindset for each player. Squad, player profile, Hexapedia, training/development, transfer filters and the guide use FPS descriptions. Squad/profile historical role preferences remain explicitly identified where updated; this is not a global migration of all management role fields. No database personality or career migration was performed.

## Verification and remaining work

Automated coverage includes every trait ID, equal trait contributions, bounded role selection, stable-ID ties, stable/volatile/captain reactions, pair effects, unchanged shot damage, legal purchases, marginal buys, save preconditions and execution, historical replay compatibility, immutable snapshots, deterministic matches and the authoritative Node worker path. Required full game checks and production build results are recorded in the latest handoff.

Browser review was attempted, but the browser access host and native computer-use pipe were unavailable. No rendered desktop/mobile acceptance is claimed. No worker deployment, live scheduled settlement, competitive personality/map balance, first-person rendering or 3D asset qualification was performed.

The existing simulator still abstracts site contact, utility, retakes and movement. A default/fake call is not proof of fully routed probing or deception, and the defender anchor assignment is not a continuous angle-holding system. Confidence/composure are recorded feedback; only frustration/streak conditions currently alter the decision preferences. Full independent lurking, per-opponent grudges, physical recoil, continuous movement and complete fatigue/weapon mastery are future work. Historical ML artifacts are not an FPS-trained policy. Continue the deployment checks and approved Colab/Babylon presentation seam under the transition plan; preserve legacy MOBA recordings until Phase 5.
