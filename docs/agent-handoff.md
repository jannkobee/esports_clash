# Conversation handoff for the next agent

This records decisions in the order the user raised them. It is a handoff, not a promise that every match will have the same outcome. Read [arena-mechanics.md](arena-mechanics.md) for exact rules and regression checks.

## What the user wants from this game

**User:** Make the auto battler satisfying to watch. Player IQ, teamfight skill, farming, coach, and draft should affect decisions. Skillshots should be dodgeable. Neutral monsters should stay passive until attacked, then chase and fight. Matches should be able to end early.

**Implementation:** The playable web arena is `EsportsClash.Web/src/components/AramMatchView.tsx`. Its decisions live partly in `combatDecision.ts`, `objectiveRules.ts`, `waveClearRules.ts`, and `draftRules.ts`. The map has three turrets and three class barracks per side, an upper dragon called Embermaw, a lower Gravemarch golem, buff camps, bushes, wards, and home-only shops. The nexus needs its turret and one barracks destroyed before it can take damage. Blue and red use the same simulation rules.

**User:** Four minutes should be mid game; eight minutes should be late game. Fifteen minutes feels too long.

**Implementation:** `economyRules.ts` labels the phases; `arenaRules.ts` tapers turret plating by minute eight. Structure health was reduced symmetrically and the nexus now fires five rapid shots followed by a reload. A 25-match sample using one balanced draft averaged 421 game seconds, with 18 games ending before minute eight. There is no forced time limit. Match length depends on draft, seed, wave control, and player performance.

**User:** Lower player cards win too easily with a good draft. Do card ratings matter?

**Finding and implementation:** Previously OVR was shown in reports but did not scale starting combat stats in the playable arena. `playerCardPower.ts` now scales health, attack, defenses, attack speed, and skill damage from OVR and card attributes, with smaller preferred-role and signature bonuses. The avatar kit is copied, so one card never changes another's source kit. Side-swapped 25-match checks with comparable role drafts: about 94 OVR won 24/25 versus 66 OVR and 18/25 versus 80 OVR. Upsets remain possible; these are two samples, not global win rates.

## Current polish request

**User:** Animate jungle camps; make tower dives punishable; add a filter for club reserves; remove `Based on:` from player cards; give close aliases such as Micke, d0nk, r0pz, Critz, Sneykingg, and Nishah more creative names; improve the design.

**User follow-up on aliases:** Restore gamer parody handles (e.g., Zypoo for ZywOo, d4nk for donk, p1mple for s1mple, M0cke for miCKe, flopz for ropz, Spl1t for Cr1t-, SneakBro for Sneyking, Fisha for Nisha) instead of generic RPG/fantasy titles. Keep `Cardrel` for Caedrel as mandated by `AGENTS.md`.

**Implementation:** `campAnimation.ts` and the arena canvas render idle, pursuit, warning, strike, return, and hit cues only when a camp is scouted. Turrets select an in-range attacker who damages a defender, even if creeps are present. Their champion shots gain 60% damage while creep damage keeps its prior value so waves can still push. `reserveFilters.ts`, `SquadView.tsx`, and `CardComponent.tsx` provide name search, role/game/tier filters, sorting, pagination, a responsive card grid, and cleaner cards without `Based on:`. `rosterResearch.ts` and `mockData.ts` use creative gamer parody aliases (e.g. `Zypoo`, `d4nk`, `p1mple`, `TheSpicy`, `Flaker`, `Daft`, `BigTail`, `Craps`, `Ouzi`, `NeKo`, `Mirecle`, `Godson`, `DNS`, `PenZ`, `Toaster`, `Anchovy`, `Protractor`, `Totoro`, `Dustbin`, `OFF`, `M0cke`, `flopz`, `Spl1t`, `SneakBro`, `Fisha`); `Cardrel` stays because the user explicitly requested it.

## Lore, Level 18 Skill Cap, Ban/Pick Phase, Item Renaming & Enlarged HP/Level Bars

**User:**
- Scrap the Gaming House.
- Update Champions and Lore with rich narrative lore dossiers and progression details.
- Add details for the ban/pick phase using actual artwork and dossier info from Champions and Lore.
- Make HP bars and level bar larger.
- Add levels in the skills so level 18 will be the cap: 7 levels for the 2 basic skills and 4 for the ultimate skill (7 + 7 + 4 = 18), with innate trait always available.
- Rename items to original in-universe Esports Clash names.

**Implementation:**
- **Scrapped Gaming House:** Removed `GamingHouseView` from `App.tsx`, purged navigation tab buttons, state values, and render blocks.
- **Lore & Champion Dossiers:** Created `championLore.ts` with deep narrative dossiers for all 30 champions. Upgraded `ChampionHubView.tsx` with role filter pills, search bar, narrative excerpts, signature athlete synergy badges, base stats grid, and level 1-18 skill rank progression explorer.
- **Enhanced Ban/Pick Phase:** Rewrote `DraftPhaseView.tsx` to feature authentic `ChampionArtwork`, role filters, search bar, signature pairing badges, and an inspection dossier containing base stats, narrative lore, and complete ability kit (Innate, Skill 1, Skill 2, Ultimate) with dynamic rank scaling.
- **Level 18 Skill Cap ($7 + 7 + 4 = 18$):** Updated `skillProgression.ts` with `LEVEL_CAP = 18`. Innate trait is active at all levels. Skill 1 ranks up across 7 milestones (`[1, 4, 7, 9, 12, 14, 17]`), Skill 2 across 7 milestones (`[2, 5, 8, 10, 13, 15, 18]`), and Ultimate across 4 ranks (`[6, 11, 16, 18]`). Damage and cooldown multiplier tables scale gracefully up to level 18.
- **Renamed Items:** Renamed all shop items in `itemsData.ts` to unique, in-universe names (`Apex Edge`, `Leviathan Harpoon`, `Goliath Slayer`, `Sovereign's Ruin`, `Fatal Verdict`, `Ghoststep Rapier`, `Tempest Galebow`, `Archmage's Diadem`, `Sunfire Bulwark`, `Titan's Heart`, `Thorned Cuirass`, etc.) while preserving internal item IDs (`item_kraken_slayer`, `item_ldr`, `item_bork`) to ensure 100% stability of gameplay logic and tests.
- **Enlarged HP & Level Bars:**
  - Overhead Canvas: Enlarged health bar width to 66px, height to 9px, level badge to 16x16 with bold 10px typography, and added an XP level progress bar directly beneath the mana bar in `AramMatchView.tsx` and `TeamfightArenaView.tsx`.
  - In-Game HUD Squad Cards: Upgraded Blue and Red squad cards with 36px avatar icons, enlarged level badges, dedicated full-width live HP bars with exact numbers and percentage, shield overlays, and dedicated XP level progress bars.

## Turret True Damage, Clash Arena Rebrand, Card Packs Store, Duplicate Recycling & 30 Champion Artworks

**User:**
- Buff turrets and deal true damage to punish tower dives.
- Scrap "ARAM" (it literally means All Random All Mid; rename to authentic arena title).
- Deal with duplicate cards and allow recycling / upgrading.
- Add virtual money that can be used to purchase card packs with reasonable prices.
- Card packs should have distinct names unlocking specific types of cards.
- Replace placeholder avatar where other avatars used Valkira; add unique artwork for each avatar.

**Implementation:**
- **Turret True Damage & Scaling:** Updated `turretShotDamage(baseDamage, isChampion, isNexus)` in `arenaRules.ts` so champion shots deal $1.8\times$ base damage (288 for outer, 342 for inner, 396 for nexus) and flag `isTrueDamage = true` in `AramMatchView.tsx`. Turret shots bypass all champion armor and render bold white true damage floaters to heavily punish dives.
- **Clash Arena Rebrand:** Rebranded all user-facing instances of "ARAM" to "Clash Arena" / "Bridge of Champions" in `App.tsx`, `SquadView.tsx`, and `mockData.ts` to reflect the strategic drafting nature of the mode.
- **Card Pack Store & Virtual Economy:**
  - Added Clash Coins (🪙) economy with rewards from matches, daily supply drops, and duplicate recycling.
  - Implemented 6 distinct, reasonably priced packs:
    - *Rookie Talent Scout* (250 Coins): 3 rising talents with high Bronze/Silver rate.
    - *Marksmen & Snipers Pack* (600 Coins): 3 dedicated carrying marksmen.
    - *Midlane Wizards & Assassins* (600 Coins): 3 burst mages and playmakers.
    - *Frontline Titans & Wardens* (600 Coins): 3 tanks and frontline brawlers.
    - *Continental Pro Pack* (900 Coins): 4 seasoned stars, guaranteed Gold+ with 35% Plat chance.
    - *World Championship GOAT Pack* (1,800 Coins): 5 esports legends, guaranteed Platinum+, highest Diamond & GOAT odds.
- **Duplicate Card Management & Recycling:**
  - When opening packs, pulling an existing roster player automatically converts the duplicate into Coins (GOAT: 2,500, Diamond: 1,200, Platinum: 600, Gold: 300, Silver: 120, Bronze: 60) and grants $+1$ Level, $+1$ OVR, and $+1$ to all attributes to train the existing roster member.
  - Added a "Recycle Duplicates" button in Club Reserves (`SquadView.tsx`) that detects all excess duplicates across the roster and recycles them into Clash Coins in a single click.
- **30 Unique Vector Artworks:**
  - Completely updated `ChampionArtwork.tsx` to include handcrafted vector portraits for all 30 playable champions (`c_solana`, `c_astra`, `c_kyumi`, `c_buck`, `c_valkira`, `c_kage`, `c_kazemaru`, `c_kindra`, `c_cora`, `c_renn`, `c_sylla`, `c_tequoia`, `c_zal`, `c_xin`, `c_raijin`, `c_kaolin`, `c_inai`, `c_qiyana`, `c_locke`, `c_senna`, `c_largo`, `c_shadowfiend`, `c_earthshaker`, `c_mirehook`, `c_nullweaver`, `c_voltgrip`, `c_aetherbolt`, `c_corsara`, `c_brewmaw`, `c_wraithhook`). No champion falls back to Valkira.

### 2026-10-10: Starting 5 Overhaul, Basis Ability Renames, Avatar Synergy/Counter Matrix, AI Drafting Intelligence, & 125 Pro Teams Database

**User request:**
- Make Starting 5 look better and fix card overlap where cards crowded and overlapped horizontally.
- Change the ability names of avatars that copied real ability names from their basis (Cora, Renn, Kindra, Kage, Kazemaru, Tequoia, Zal, Xin).
- Add AI that thinks, counters players, and understands avatar synergies using stored data; make this data accessible in a tab after Tournament Split.
- Add 100+ pro teams with different head coaches and rosters to create a living simulation for single-player play and Vs AI.

**Implementation:**
- **Starting 5 Layout & Overlap Resolution:**
  - Modified `src/components/CardComponent.tsx`: Replaced fixed `w-64` (256px) with responsive `w-full max-w-[230px] min-w-0 h-[385px]`, reduced chibi avatar to 76px, and tightened typography so cards fit cleanly in grid columns without overlapping.
  - Overhauled `src/components/SquadView.tsx`: Redesigned Starting 5 with `FORMATION_SLOTS` containing tactical lane badges (`TOP LANE 🛡️`, `JUNGLE ⚔️`, `MID LANE 🔮`, `BOT CARRY 🏹`, `SUPPORT 💚`), role descriptions, lane synergy link banners (Top-Jgl Roam, Mid-Jgl Gank Axis, Core Carry Focus, Bot Duo Peel Bond), team average OVR badge, and dedicated Swap/Inspect buttons with `max-w-7xl` spacing.
- **Basis Ability Renaming:**
  - Updated `src/mockData.ts` and `src/components/AramMatchView.tsx`:
    - **Cora** (Xayah): `Quill Ricochet` (Passive), `Twin Plumage` (Skill 1), `Feather Recall` (Skill 2), `Skyward Plumes` (Ult).
    - **Renn** (Rakan): `Gilded Cloak` (Passive), `Gilded Vault` (Skill 1), `Harmonic Waltz` (Skill 2), `Dazzling Rush` (Ult).
    - **Kindra** (Kindred): `Spirit Mark` (Passive), `Ghoststep Volley` (Skill 1), `Shadow Pounce` (Skill 2), `Sanctuary of Eternity` (Ult).
    - **Kage** (Zed): `Dusk Execution` (Passive), `Shadow Shuriken` (Skill 1), `Shadow Projection` (Skill 2), `Eclipse Mark` (Ult).
    - **Kazemaru** (Yasuo): `Gale Walker` (Passive), `Tempest Thrust & Gale` (Skill 1), `Zephyr Barrier` (Skill 2), `Airborne Sever` (Ult).
    - **Tequoia** (Nature's Prophet): `Verdant Cage` (Skill 1), `Awaken Treants` (Skill 2), `Nature's Wrath` (Ult).
    - **Zal** (Dazzle): `Venom Hex` (Skill 1), `Shadow Surge` (Skill 2), `Soul Sanctuary` (Ult).
    - **Xin** (Ember Spirit): `Blazing Bolas` (Skill 1), `Flash Flurry` (Skill 2), `Flame Remnant Charge` (Ult).
- **Avatar Synergy & Counter Data Matrix:**
  - Created `src/avatarSynergyData.ts`:
    - `CHAMPION_COUNTERS`: 18 detailed counter matchups with win rate deltas (+8% to +14%) and tactical rationales.
    - `CHAMPION_SYNERGIES`: S+ and S-tier wombo combo pairings (e.g., Featherbound Lovers, Thunderous Cataclysm, Acrobatic Tempest, Requiem Fissure, Solar Frost Lock, Eternal Life Ward).
    - `CHAMPION_META_STATS`: Telemetry ratings (S+, S, A, B), win rates, pick rates, ban rates, best partners, and worst counters for all 30 avatars.
    - Exported scoring algorithms `calculateCounterBonus` and `calculateSynergyBonus`.
- **AI Drafting Intelligence:**
  - Updated `src/draftRules.ts`: `draftScore`, `chooseCoachPick`, and `chooseCoachTeamPick` now evaluate opponent picks for counter-pick advantages (+12 per countered enemy, -10 if countered) and allied picks for synergy bonuses (+15 per combo).
  - Updated `src/components/DraftPhaseView.tsx`: Red AI coach dynamically inspects blue picks to select counter and synergy picks.
- **125 Pro Teams Database:**
  - Created `src/proTeamsDatabase.ts`: Generates 125 pro teams across 5 major leagues (LCK, LPL, LEC, LCS, Challengers Circuit) with unique head coaches, tactical archetypes (Early Snowball, Dive Assassin, Objective Control, Scaling Hypercarry, Protect the Carry), 5 starters + 2 substitutes, parody aliases, stats, records, and threat levels.
- **Pro Circuit & Scouting Hub UI:**
  - Created `src/components/ProCircuitView.tsx`: Features 3 sub-tabs: World Pro Teams Directory (filters, search, roster scouting, "Challenge in Clash Arena" action), Counter & Synergy Matrix, and Circuit Standings.
  - Updated `src/App.tsx`: Added `<Globe /> Pro Circuit & Scouting` navigation button after "Tournament Split", `selectedOpponentTeam` state, Arena opponent preview card, and hooked selected team into `DraftPhaseView` and `AramMatchView`.

## Where to verify

- Run `npm run check:game` and `npm run build` in `EsportsClash.Web`.
- `draftOnlineProgression.test.mjs` verifies the 18-level progression curves, rank milestones, and damage multipliers.
- `marksmanItemsAndSylla.test.mjs` verifies items and formulas with renamed items and stable item IDs.
- `arenaRules.test.mjs` checks turret target selection and damage (including the 288 outer turret true damage assertion). `campAnimation.test.mjs` checks animation states. `reserveFilters.test.mjs` checks combined filters. `rosterDraftItems.test.mjs` checks aliases and the required `Cardrel` entry.
- `avatarSkillAnimation.test.mjs` and `skillshotCombos.test.mjs` verify all 39 champion animations and combo recipes.
- `playerCardPower.test.mjs` checks multi-role combat bonuses from `playableRoles` and EA FC evolution stat boosts.
- For pacing, use the in-game **Run 25** batch with a known draft; it swaps sides between seed pairs. Compare its duration and win distribution rather than relying on one replay.
- Browser review at desktop and mobile widths is useful for the reserve panel. The web app is served by `npm run dev` in `EsportsClash.Web`.

## User Request: 9 New Champions, Combat Class Roles, Multi-Role Card Evolutions & EA FC Evolution System

**User Request:**
1. Integrate 9 new champions: Invoker, Hwei, Jayce, Vi, Jinx, Puck, Batrider, Bristleback, IO.
2. Remove Top, Jungle, Mid Lane, Bot Carry and Support as Player Card roles. Player cards represent combat classes (`Mage`, `Marksman`, `Fighter`, `Tank`, `Assassin`, `Support`) and tactical Starting 5 positions (`FRONTLINE`, `SKIRMISHER`, `CORE PLAYMAKER`, `DAMAGE CARRY`, `TACTICAL SUPPORT`).
3. Multi-role player card evolutions: enable cards to evolve into playing multiple roles (e.g. Flaker starting with Mage can evolve into Support, enabling him to play both). Cards gain new Signature Avatars in that role.
4. Research player evolutions in EA FC and integrate how it adds player ratings (OVR boosts, key stat boosts, card tier upgrades, cosmetic holographic styling, fast-track objectives, player pack drops).

**Implementation:**
- **9 New Champions (Pool Expanded from 30 to 39):**
  - `src/additionalChampions.ts`: Added **Kaelen** (Invoker - Mage/Support), **Hweilin** (Hwei - Mage/Support), **Jaxon** (Jayce - Fighter/Marksman), **Valerie** (Vi - Fighter/Assassin), **Jinxy** (Jinx - Marksman/Assassin), **Paxi** (Puck - Mage/Assassin), **Batrix** (Batrider - Fighter/Mage), **Quillback** (Bristleback - Tank/Fighter), **Aetheris** (IO - Support/Mage). All have unique kits, passives, and original parody names.
  - `src/components/ChampionArtwork.tsx`: Added handcrafted vector SVG artworks for all 9 new champions.
  - `src/championLore.ts`: Added narrative lore and strategic gameplay dossiers for all 9 champions.
  - `src/avatarCombos.ts`: Added combo sequences for all 9 avatars (total 39 combos).
  - `src/avatarSkillAnimation.ts`: Added 9 skill animation motifs (`arsenal`, `paint`, `hammer`, `fist`, `rocket`, `faerie`, `lasso`, `quill`, `wisp`) with canvas renderers.
  - `src/avatarSynergyData.ts`: Added counter matchups, S+/S wombo combos, and meta telemetry stats for all 9 champions.
  - `src/components/AramMatchView.tsx`: Integrated projectile skillshot logic, melee gap closes, skill casts, and crowd control.
- **Combat Classes & Squad Lineup Positions:**
  - Removed lane designations (Top, Jungle, Mid, Bot Carry, Support) from player card roles. Player cards now belong to combat classes (`Mage`, `Marksman`, `Fighter`, `Tank`, `Assassin`, `Support`).
  - `src/components/SquadView.tsx`: Starting 5 lineup organized by tactical slots: `FRONTLINE`, `SKIRMISHER`, `CORE PLAYMAKER`, `DAMAGE CARRY`, and `TACTICAL SUPPORT`.
- **Multi-Role Player Card Evolutions:**
  - `src/types.ts`: `PlayerCard` supports `playableRoles?: AvatarRole[]`, `isEvo?: boolean`, `evolutionLevel?: number`, and `evolutionHistory?: string[]`.
  - `src/playerCardPower.ts`: `playerCardCombatPower` checks `playableRoles` so cards receive full on-role combat effectiveness (+0.025) across all unlocked classes.
  - `src/draftRules.ts`: `draftScore` awards +38 role fit if a champion matches any role in `playableRoles`.
  - `src/reserveFilters.ts`: Filter matching checks against all unlocked `playableRoles`.
- **EA FC-Style Evolution System & Rating Mechanics:**
  - `src/mockData.ts`: Overhauled `INITIAL_EVOLUTIONS` with EA FC Role Versatility paths (Marksman, Support, Mage, Tank, Assassin, Fighter) and Tier Ascendance paths (Golden Glow-Up, Centurions Upgrade, Immortality Path). Each plan grants +4 to +7 OVR, key stat upgrades (LAN, TF, IQ, CLU, STA, FLX), target tier promotions, and optional secondary role unlocks.
  - `src/components/CardComponent.tsx`: Renders EA FC emerald/gold holographic borders, radiant drop-shadows, `✦ EVO [level]` badges, and multi-role displays (`playableRoles.join(' · ')`).
  - `src/components/EvolutionsView.tsx`: Displays role unlocks, stat boost breakdowns, signature avatar selector (`selectableSignatures`), and Fast-Track button (250 Coins).
  - `src/App.tsx`: Added `handleFastTrackEvolution` and updated `handleClaimEvolution` to assign unlocked roles, chosen signatures, and rating boosts to both roster and active lineup. Pack openings have a 45% chance to drop bonus Evolution Role Kits (+350 Coins).
  - `src/components/PackOpeningModal.tsx`: Displays bonus Evolution Kit drop badges in summary screen.

## User Request: Kaelen Spellweave, Recall Grouping Bug Fix, Tower Cover Retreats, Wise Open Recalls & Avatar Dossier Sorting

**User Request:**
1. Kaelen multi-skill spellweaving: mimic Quas/Wex/Exort and Invoke from Invoker, but make it original using two essences and invoke (Pyra and Surge, invoked via Spellweave).
2. Fix bug where avatars go toward avatars that are recalling.
3. Low-health players should use towers as cover instead of always running to bushes when towers are closer.
4. Players should recall openly when wise/safe.
5. All retreat, cover, and open recall decisions must depend on player card IQ.
6. Add "Filter by" in Avatar Roster Dossier, filtered by Name (A–Z) by default.

**Implementation:**
- **Kaelen Original Spellweave Kit:**
  - `src/types.ts`: Added `kaelenEssences?: ('pyra' | 'surge')[]` and `invokedSpell?: string` to `AramChampionUnit`.
  - `src/additionalChampions.ts`: Kaelen kit redesigned around elemental duality:
    - Passive: `Dual Weave (Pyra & Surge)`
    - Skill 1: `Pyra Essence Bolt` (175 Magic damage + gathers Pyra essence)
    - Skill 2: `Surge Essence Pulse` (130 Magic damage + speed boost + gathers Surge essence)
    - Ultimate: `Spellweave Cataclysm` (Synthesizes active essences into invoked spells):
      - `Pyra + Pyra` -> `Sunstrike Cataclysm` (540 Magic damage + 1.2s stun)
      - `Pyra + Surge` -> `Chaos Blast Wave` (460 Magic damage + 1.2s disarm & knockback)
      - `Surge + Surge` -> `Ghost Shroud EMP` (380 Magic damage + 1.5s root & phase haste)
  - `src/championLore.ts`: Updated Kaelen's dossier and lore to detail the duality of Pyra and Surge and the Spellweave technique.
  - `src/avatarCombos.ts`: Updated combo recipe to `'Spellweave Resonance'`.
  - `src/avatarSkillAnimation.ts`: Updated `'arsenal'` motif in `drawAvatarSkillAnimation` to render dual rotating Pyra and Surge elemental orbs and vertical cataclysm light columns.
  - `src/components/AramMatchView.tsx`: Canvas renderer draws orbiting Pyra (amber) and Surge (cyan) essence spheres around Kaelen in real time; casting skills floats essence gather text; ultimate triggers specific invoked spell effects.
- **Recall Target & Grouping Bug Fix:**
  - In `src/components/AramMatchView.tsx`, recall channeling previously set `animState` to `'cast'`, which tricked `fightingAlly` checks into thinking the recalling unit was in active combat, causing teammates to path toward them. Changed recall channeling `animState` to `'idle'` and added `!a.isRecalling` to `fightingAlly` search.
  - In `src/combatDecision.ts`, `chooseTeamfightTarget` now heavily penalizes targeting distant recalling enemies (`-5.0 * iq`), stopping enemies from uselessly walking across the bridge to chase a finishing recall. If within immediate range (`dist <= range * 1.25`), high IQ champions prioritize interrupting it.
- **Tower Cover & Low-Health Retreat Prioritization:**
  - In `src/components/AramMatchView.tsx`, retreating champions evaluate distances to nearest living allied towers vs bushes. High IQ champions prioritize allied towers (`towerDist <= bushDist + 100` or `towerDist < 260`) rather than running across the bridge into bushes.
- **Wise Open Lane Recalls:**
  - In `src/arenaRules.ts`, `canUnitRecall` now accepts `isUnderAlliedTower` and `iq`. Safe enemy distance thresholds scale dynamically: under allied tower (270–340px), in bush (240–300px), or open lane (380–450px).
  - Open recalls are permitted in open lane when the wave is pushed, enemies are far/dead, and health/mana are low.
  - Floating cues clearly distinguish recall type: `🛡️ TOWER COVER RECALL...`, `🌿 BUSH STEALTH RECALL...`, and `💧 OPEN LANE RECALL...`.
- **Avatar Roster Dossier "Filter by":**
  - In `src/components/ChampionHubView.tsx`, added `filterBy` state defaulting to `'Name'`.
  - Added "Filter by:" dropdown selector in toolbar supporting `Name (A–Z) [Default]`, `Combat Role`, `Archetype`, `Base HP`, `Attack Damage`, and `Range`.
  - Dossier list sorts alphabetically by default.

## User Request: Procedural Models for 9 New Avatars

**User Request:**
- New avatars (Kaelen, Hweilin, Jaxon, Valerie, Jinxy, Paxi, Batrix, Quillback, Aetheris) had no battlefield chibi models (falling back to plain team color circles). Add dedicated models for all of them.

**Implementation:**
- `src/components/ChampionSpriteRenderer.ts`:
  - Added dedicated switch branches for all 9 champions (and their IDs) in `drawChampionSprite`.
  - Implemented 9 handcrafted procedural TFT-style chibi sprite rendering functions:
    1. **Kaelen (Invoker):** Royal crimson and gold robes, upturned mantle collar, platinum blonde hair, golden diadem with ruby, noble anime eyes, and golden scepter catalyst with floating elemental aura.
    2. **Hweilin (Hwei):** Slate/indigo artist coat, flowing turquoise scarf, ink-stained apron, contemplative teal eyes, and oversized bamboo calligraphy brush dripping with glowing violet/cyan ink droplets.
    3. **Jaxon (Jayce):** Polished ivory and navy Piltover cuirass, gold pauldron with cyan conduit lines, slick chestnut hair, hero smirk, and massive Hextech Mercury Hammer with glowing cyan crystal core.
    4. **Valerie (Vi):** Spiky hot-pink undercut hair, brass aviator goggles on forehead, cheek 'VI' tattoo, crimson brawler vest, and dual massive steam-powered Atlas Gauntlets with piston knuckles and steam bursts.
    5. **Jinxy (Jinx):** Knee-length electric-blue twin braided pigtails, bullet bandolier, wild magenta star-sparkle anime eyes, manic toothy grin, and oversized "Fishbones" Shark Rocket Launcher with smoke puffs.
    6. **Paxi (Puck):** Levitating chubby cyan faerie dragon, lavender belly, flapping translucent butterfly wings, curling tail, cute dragon snout, and curved antennae with glowing yellow faerie lanterns.
    7. **Batrix (Batrider):** Giant flapping shadow bat mount with leathery wings and fangs, carrying a crazed green goblin rider in leather flight cap and brass goggles, waving a blazing flaming cocktail with licking embers.
    8. **Quillback (Bristleback):** Hunched spiny brawler with a fan of lethal sharp quills across his back and shoulders, tusks, brass septum ring, fierce squinting eyes, and iron spiked war club.
    9. **Aetheris (IO):** Transcendent glowing celestial wisp sphere, multi-tonal white/azure plasma core, dual rotating crystalline gyroscopic rings, starlight optic points, and 3 orbiting satellite spirit sparks connected by electric tethers.
- Added comprehensive unit test in `src/avatarSkillAnimation.test.mjs` verifying all 39 champions render through idle, walk, attack, and cast states without exceptions.

## User Request: Tower Recall Fixes, Elimination of Avatar Spinning & Idle Standing

**User Request:**
- Fix recall under the tower; avatars spin before recalls and are just standing there sometimes.
- User follow-up: "just remove the under the twoer recall just cover before recalling. Undo the implementation huge the old one."

**Implementation:**
- **Removal of Under-Tower Recall & Reversion to Cover-First:**
  - In `src/arenaRules.ts`, removed all tower-specific recall overrides and reverted `canUnitRecall` signature back to `(nearestEnemyDist, nearestMinionDist, nearestStructureDist, recallCooldown, isInBush)`.
  - Re-established strict safe enemy distance: `isInBush ? 300 : 450`, minion distance > 270, and structure distance > 250.
  - In `src/components/AramMatchView.tsx`, removed all `isUnderAlliedTower` and tower cover recall checks. When `wantsRecall` is true, champions take cover in a nearby retreat bush (`nearbyRetreatBush`) or retreat toward the fountain well (`wellTargetX`).
- **Elimination of Avatar Spinning (Arrival Deadband):**
  - When moving towards cover (`targetX, targetY`), avatars previously crossed `targetX` with continuous movement steps without an arrival deadband, causing 1-2px overshoots and 30Hz left/right facing flips.
  - Added an arrival deadband (`distToTarget <= 14`): on arrival at cover, avatars snap cleanly to `(targetX, targetY)`, zero velocity (`vx = 0, vy = 0`), set `animState = 'idle'`, and lock facing toward the lane.
  - Preserved anti-clumping physics protection for channeling units so walking teammates do not nudge or displace them.

## User Request: Chess-Style Ranked Ladder System (Starts at 300, No LP, No Bronze/Silver/Gold)

**User Request:**
- Integrate a ladder system.
- Replace LP (League Points) with a new rating metric.
- Do not use Bronze, Silver, Gold; instead use Chess-style ranks starting at 300.

**Implementation:**
- **Chess-Style Rating & Hierarchy (`src/ladderRating.ts`):**
  - Rating begins at exactly **300 Rating** (Pawn tier) with a protected 300 rating floor.
  - No LP or League Points anywhere in the codebase. Metric is labeled as **Rating** (Chess Elo).
  - Replaced Bronze, Silver, Gold with 9 authentic Chess ranks:
    - **Pawn (Novice Contender)**: `300 – 599` (Icon: ♟️)
    - **Knight (Tactical Striker)**: `600 – 899` (Icon: ♞)
    - **Bishop (Diagonal Strategist)**: `900 – 1199` (Icon: ♝)
    - **Rook (Fortress Commander)**: `1200 – 1499` (Icon: ♜)
    - **Queen (Grand Strategist)**: `1500 – 1799` (Icon: ♛)
    - **Candidate Master (CM)**: `1800 – 2099` (Icon: 🎖️)
    - **Master (M)**: `2100 – 2399` (Icon: 🎗️)
    - **International Master (IM)**: `2400 – 2699` (Icon: ⚔️)
    - **Grandmaster (GM)**: `2700+` (Icon: 👑)
  - Pure Elo expected score formula: $E = \frac{1}{1 + 10^{(R_{opp} - R_{player}) / 400}}$ with dynamic K-factors (40 for beginners, 32 for intermediate, 24 for masters) and win-streak rating bonuses (+3 to +8).
  - Profile state (`rating`, `peakRating`, `wins`, `losses`, `streak`, `recentMatches`) persisted via `localStorage` (`esports-clash-ladder-profile`).
- **Interactive Ranked Ladder Interface (`src/components/RankedLadderView.tsx`):**
  - Hero player status card showing Chess rank icon, current Rating, global rank, progress bar to the next rank tier, and career stats.
  - Sub-views for Global Standings, Match History, and the Chess Tier Codex.
  - Full living leaderboard of ~40 rival clubs across the 300 to 2850 Elo range with active "⚔️ Challenge" buttons for teams within matchable range ($\pm 150$ Rating).
  - Quick Match queue button that automatically matches a balanced rival within queue range.
- **In-Game Flow & Post-Match Dialog (`src/App.tsx`):**
  - Added "Ranked Ladder" primary navigation tab and rating indicator pill in the sticky top header bar.
  - Added Chess Ranked Ladder launcher card in the Clash Arena mode select screen.
  - Converted match completion to compute Elo deltas against the matched opponent, update the ladder profile, and trigger a dedicated post-match summary modal displaying rating changes, promotion alerts, and tier badges.
- **Verification (`src/ladderRating.test.mjs`):**
  - Added 7 unit tests verifying 300 starting rating, complete absence of LP / Bronze / Silver / Gold, Elo progression, 300 rating floor protection, win streak multipliers, and leaderboard sorting.

## User Request: Console App Removal, Multiplayer-Only Ranked Ladder, and Normal (Unranked) Mode

**User Request:**
- Remove the console type `EsportsClash` and update the `README.md` in the root folder.
- Ladder is for multiplayer only, so Vs Player and Ladder Ranked match should be the same.
- Integrate normal (not ranked) Vs Player.

**Implementation:**
- **Console App Removal & Root Documentation (`README.md`, `EsportsClash.sln`):**
  - Deleted the legacy `EsportsClash.ConsoleApp/` directory containing the console prototypes.
  - Cleaned `EsportsClash.sln` by removing `EsportsClash.ConsoleApp.csproj` project declarations and configuration mappings.
  - Overwrote root `README.md` to document the flagship web application (`EsportsClash.Web`), its architecture, 39 procedural chibi champions, Chess Ranked Ladder (starting at 300 Elo), EA FC-inspired player card evolutions, multiplayer room server, and full test/build verification commands.
- **Ranked vs Normal Multiplayer Protocol (`server.mjs`, `src/onlineRooms.ts`):**
  - Extended room creation and join payloads to support `matchType: 'ranked' | 'normal'` and track participant `rating` and `rankTier`.
  - Stored `matchType` on `PublicRoomInfo` and `OnlineSession` to enforce mode separation across the network.
- **Multiplayer Mode Unification in UI (`src/App.tsx`, `src/components/RankedLadderView.tsx`):**
  - Unified the Ranked Ladder with multiplayer matchmaking: entering Ranked Ladder match queues opens or joins live multiplayer rooms flagged as `'ranked'`, placing Chess Elo rating on the line against other human coaches.
  - Added "Normal Match (Vs Player)" in the Arena mode select screen and multiplayer room lobby, enabling unranked friendly exhibitions with 0 rating risk.
  - Modified `handleMatchComplete` in `App.tsx` so that Chess Elo rating changes and post-match ladder dialogs trigger strictly for multiplayer ranked games (`isRankedMultiplayer = isOnline && (onlineRoom?.matchType === 'ranked' || onlineSession?.matchType === 'ranked')`). Single-player AI circuits and unranked normal matches do not affect ladder rating.

## User Request: Objective Contestation Regrouping & Unique Player Card PlayStyle Traits

**User Request:**
- If the other team knows the opponent is doing objectives like Dragon and Golem, they should regroup immediately and try to contest the objective.
- Make use of unique player card traits/badges like Clutch King and Aggro Diver so that players do things that other players won't do instead of all matches having the same winning process.

**Implementation:**
- **Epic Objective Contestation & Pit Scouting (`src/objectiveRules.ts`, `src/components/AramMatchView.tsx`):**
  - Added `hasObjectiveVision` evaluating vision of Dragon and Golem pits via nearby allied champions (within 440px), allied wards (within 320px), or visible spotted enemies in the pit.
  - Added `shouldContestOpponentObjective` assessing contest timing when opponents attack Embermaw or Gravemarch Colossus, taking into account healthy teammates, macro IQ, teamfight rating, chemistry, and `Shotcaller` / `Baron Steal` presence.
  - In `AramMatchView.tsx`, when an opponent team is detected doing an objective, the scouting team sounds a contest alert (`⚔️ CONTEST: [TEAM] spotted opponents on Embermaw/Gravemarch! Regrouping immediately!`), triggers `📢 SHOTCALL RALLY!`, and healthy teammates break off minor tasks to march in formation to the pit, initiating on the vulnerable enemies trapped inside or timing smite burst executes.
- **Unique Player Card Combat Traits System (`src/playerTraits.ts`, `src/combatDecision.ts`, `src/components/AramMatchView.tsx`):**
  - **Aggro Diver**: Fearlessly executes low-HP targets (<38% HP) even under enemy turrets. Gains +25 move speed on low-HP targets, a 16% Max HP Dive Shield upon entering turret range, and +18% bonus dive execution damage.
  - **Clutch King**: Refuses to retreat or cower when dropped below 32% HP in combat. Triggers **Clutch Surge** (+18-24% Max HP shield, +25% attack speed, +30% crit chance, and +20% outplay damage when outnumbered).
  - **Baron Steal**: Prioritizes sprinting to low-HP epic objectives (<30% HP) and delivers a massive +50% true damage execute burst on monsters below 22% HP to snipe the objective.
  - **One-Tap God**: Bypasses frontline tanks in target selection to lock onto enemy squishy carries (Marksman/Mage). Deals +25% bonus critical burst against isolated targets.
  - **Laning Demon**: Dominates the wave early game (<240s) with +22% damage to minions and structures, and applies attack speed slows to opposing laners.
  - **Unkillable Demon**: When below 35% HP, gains +35% move speed and 35% chance to mitigate incoming damage by 65%, successfully baiting enemy abilities.
  - **Ice in Veins**: Possesses 40% innate crowd control reduction (tenacity), shrugging off stuns, knockups, and roots.
  - **Vision Master**: Wards on a reduced 28s cooldown and proactively places deep vision wards directly inside Dragon and Golem pits.
  - **Shotcaller**: Sounds a tactical rally aura during objective contests, granting nearby allies +25 move speed and rapid convergence.
- **Pro Circuit & Living Simulation Integration (`src/proTeamsDatabase.ts`):**
  - Updated AI team generator so that coaches and players across 120+ clubs generate authentic combinations of active PlayStyle traits based on their roles and ratings.
- **Verification (`src/playerTraits.test.mjs`, `src/objectiveRules.test.mjs`):**
  - Added 5 unit tests for player traits and 2 unit tests for objective contestation and vision detection. All 77 unit tests and 14 design validation checks pass cleanly.

## Practical boundaries

The online room feature synchronizes drafting and a seeded AI match; it is not a server-authoritative ranked match. Research `realName` values are kept internally for roster provenance and deduplication, but should not appear on player card faces. Keep aliases fictional and stable once published so saved reports remain understandable.

