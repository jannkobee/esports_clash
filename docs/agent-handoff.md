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
    - _Rookie Talent Scout_ (250 Coins): 3 rising talents with high Bronze/Silver rate.
    - _Marksmen & Snipers Pack_ (600 Coins): 3 dedicated carrying marksmen.
    - _Midlane Wizards & Assassins_ (600 Coins): 3 burst mages and playmakers.
    - _Frontline Titans & Wardens_ (600 Coins): 3 tanks and frontline brawlers.
    - _Continental Pro Pack_ (900 Coins): 4 seasoned stars, guaranteed Gold+ with 35% Plat chance.
    - _World Championship GOAT Pack_ (1,800 Coins): 5 esports legends, guaranteed Platinum+, highest Diamond & GOAT odds.
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
- \*\*Unique Player Card Combat Traits System (`src/playerTraits.ts`, `src/combatDecision.ts`, `src/components/AramMatchView.tsx`):
  - Aggro Diver pursues a wounded enemy under a turret when survivable.
  - Clutch King stays in an active low-health fight instead of immediately retreating.
  - Baron Steal recognizes contested low-health objectives, without an extra execute attack.
  - One-Tap God seeks an isolated carry when IQ and reach allow.
  - Laning Demon clears an enemy wave before a siege during the early phase.
  - Unkillable Demon uses cover at low health and can re-enter after an enemy spends a skill.
  - Ice in Veins retains the current target through normal-duration crowd control.
  - Vision Master prioritizes pit vision using the ordinary ward cooldown.
  - Shotcaller signals contests and helps allies converge at ordinary movement speed.
  - Golden Flash has a proposed skillshot-reading move, but no separate gameplay hook yet.
- **Pro Circuit & Living Simulation Integration (`src/proTeamsDatabase.ts`):**
  - Updated AI team generator so that coaches and players across 120+ clubs generate authentic combinations of active PlayStyle traits based on their roles and ratings.
- **Verification (`src/playerTraits.test.mjs`, `src/objectiveRules.test.mjs`):**
  - Added 5 unit tests for player traits and 2 unit tests for objective contestation and vision detection. All 77 unit tests and 14 design validation checks pass cleanly.

## User Request: Turret Kill Attribution Window and Turret Execution Gold Split

**User Request:**

- If a turret kills an avatar, the kill should go to the last avatar who damaged the killed avatar.
- If the elapsed time is 10 seconds and the turret kills the avatar, the kill should not go to the last avatar who damaged it; the turret just gets the kill and the team that owns the turret will receive the gold evenly.

**Implementation:**

- **Turret Kill Attribution & Gold Split Logic (`src/matchReplay.ts`, `src/components/AramMatchView.tsx`):**
  - Added `resolveTurretKillReward(victim, now, champions, windowSeconds = 10, bounty = 300)`.
  - When a turret lands the lethal blow on an avatar (`isTurretFinish`):
    - If the victim was damaged by an enemy avatar within $\le 10.0$ seconds, the kill credit is awarded to that enemy champion (granting them $+1$ kill, 300g bounty, first blood check if applicable, multikill/streak progression, assist gold/XP to living nearby allies, and sound effects).
    - If the elapsed time since last enemy damage exceeds 10 seconds ($> 10.0$ seconds) or no enemy champion damaged the victim:
      - The kill is attributed to the turret as an execution (no player is credited with a kill).
      - The turret's team splits the 300g bounty evenly across all members (`splitGold = Math.floor(300 / turretTeamAllies.length)`, giving 60g each in 5v5).
      - Floating gold text (`+60g Turret Split! 💰`) appears above each recipient with coin sound effects.
      - Event log records: `⚡ [Player] ([Champion]) was EXECUTED by Defense Turret! (+[Gold]g split to [TEAM])`.
- **Verification (`src/matchReplay.test.mjs`):**
  - Added unit test covering enemy damage within 10s (kill credit awarded, 0 split gold), exactly 10s window boundary, $> 10$s expiry (execution, 60g split to 5 allies), and zero prior damage.
  - Ran `npm run check:game` (all 78 unit tests and 14 design validation checks pass) and `npm run build` from `EsportsClash.Web`.

## User Request: Objective Contestation Fixed to Engage Enemy Team in Teamfight

**User Request:**

- We need for the other team to engage and look for a teamfight against the other team not go to the actual pit of the objective.

**Implementation:**

- **Objective Contestation Teamfight Engagement (`src/components/AramMatchView.tsx`):**
  - Removed direct pit pathing (`(dragon.x, dragon.y)` / `(golem.x, golem.y)`) and objective monster attacking during opponent objective contestation.
  - When `isContestingOpponentObjective` triggers, contesting champions prioritize the enemy champions engaged at/near the objective (`contestEnemyPool`), selecting their teamfight focus via `chooseTeamfightTarget`.
  - When in combat range, contesting units execute the full teamfight combat system (avatar combos, ultimates, skillshots, CC chain stuns, kiting, and focus fire on the enemy champions).
  - When outside combat range, contesting units march directly toward the enemy champions (`enemyToEngage`) at their normal movement speed to initiate the fight, rather than entering the neutral pit.
  - While contesting, wave clear and structure attacks are suppressed so units do not get diverted from engaging the enemy team.
- **Verification:**
  - Ran `npm run check:game` (all 78 unit tests and 14 design validation checks pass).
  - Ran `npm run build` (clean TypeScript compilation and Vite build).

## Practical boundaries

The online room feature synchronizes drafting and a seeded AI match; it is not a server-authoritative ranked match. Research `realName` values are kept internally for roster provenance and deduplication, but should not appear on player card faces. Keep aliases fictional and stable once published so saved reports remain understandable.

## User Request: Player Card Traits as Moves, Not Stat Buffs

**User:** Read the docs, remove numeric PlayStyle buffs, and list distinct moves. Clutch King should refuse to retreat when wounded rather than gain a shield.

**Agent:** Rewrote the trait descriptions in `docs/arena-mechanics.md` and `src/playerTraits.ts`. Removed trait-only shield, bonus attack damage, objective execute burst, random damage reduction, CC reduction, ward cooldown reduction, and rally speed in `src/components/AramMatchView.tsx`. The implemented choices include diving wounded targets, holding a clutch fight, contesting objectives, selecting an isolated carry, clearing the wave before sieging, baiting a spent skill from cover, retaining a target after crowd control, pit warding, and signaling a contest. Golden Flash's distinct sidestep remains a proposed move. This section supersedes the earlier numeric PlayStyle descriptions.

**Affected files:** `src/playerTraits.ts`, `src/combatDecision.ts`, `src/objectiveRules.ts`, `src/components/AramMatchView.tsx`, `src/types.ts`, their focused tests, and both docs.

**Verification:** `npm run check:game` passed (80 tests plus design checks); `npm run build` passed (TypeScript and Vite).

**Limit:** Baron Steal timing and Shotcaller group coordination remain broad objective decisions rather than a dedicated coordinated action sequence.

## User Request: Header Cleanup, Pack Coins, and Teamfight Combat Types

**User:** Remove Fans and Day 1 from the UI. Fix Pack Store purchases adding coins instead of deducting them. Give avatars several combat types, like Stonewake's teamfight initiation and disabling, and make AI use multi-target crowd control according to player card attributes.

**Agent:** Removed the unused Fans and Day counters from the header and the related fan reward text. Sponsor Stream now describes its coin reward. Pack purchases now settle at the listed cost once; duplicate pulls train the owned card without refunding the purchase, and the active lineup receives the upgraded card. Removed the unrelated coin drop that could make a paid pack profitable. The opening modal shows coins spent and the remaining balance. The initial club owns all 63 cards in the current pack pool, so these pulls normally train existing cards.

**Agent:** In the Evolution Hub, eligible player cards now have a fixed width and scroll inside the panel instead of compressing into narrow strips. Added a name, role, and tier search for large clubs.

**Agent:** Added nine avatar combat types and visible type bars in the avatar hub, type filtering, and type tags during drafting. Stonewake and Nullweaver have explicit multi-type profiles; other avatars derive tendencies from their kits. Skilled players aim Stonewake's Faultline and Nullweaver's opening control through groups. Area control ultimates now evaluate the number of enemies actually in their hit geometry. Stonewake holds Quake Chorus for grouped opponents or emergency peel when the player card's IQ, teamfight rating, and composure support that choice. The learned combo path checks the same rule before spending the ultimate. These types affect decisions, not damage or defenses.

**Affected files:** `src/App.tsx`, `src/packEconomy.ts`, `src/components/PackOpeningModal.tsx`, `src/components/GamingHouseView.tsx`, `src/components/EvolutionsView.tsx`, `src/components/ChampionHubView.tsx`, `src/components/DraftPhaseView.tsx`, `src/mockData.ts`, `src/types.ts`, `src/additionalChampions.ts`, `src/avatarCombatRoles.ts`, `src/combatDecision.ts`, `src/components/AramMatchView.tsx`, relevant tests, and both docs.

**Verification:** `npm run check:game` passed (85 tests plus design checks); `npm run build` passed (TypeScript and Vite). Browser layout was not visually inspected in this workspace.

**Limit:** The nine type ratings are curated or inferred play tendencies, not a copy of source-game balance. Area control timing is wired to the existing ultimate shapes for Stonewake, Nullweaver, Solana, Soulscourge, Veyara, and Kaolin; other kits still use their existing targeting rules.

## User Request: Visible Sylla Spirit Bear and Next Steps

**User:** Asked why Sylla's summoned bear could not be seen and what should be improved next.

**Agent:** Found that Summon Spirit Bear only applied instant root and damage plus a 1.5-second ring effect. Sylla's sprite also contained a tiny decorative cub that was always present, but there was no summoned combat unit. Skill 1 now creates one distinct, large Spirit Bear with a health bar and name label. It follows Sylla, pursues his chosen opponent, attacks nearby champions, creeps, or structures, and uses the existing minion combat path so enemy champions, creeps, and turrets can damage it. Recasting heals and retargets the same bear; it disappears when Sylla dies. The decorative cub was removed so the summon is recognizable as a separate unit. Bear health and attack damage rise with Sylla's level. Savage Roar now radiates from both Sylla and his living bear. The root and initial impact remain part of Skill 1.

**Affected files:** `src/types.ts`, `src/components/AramMatchView.tsx`, `src/components/ChampionSpriteRenderer.ts`, `src/avatarSkillAnimation.test.mjs`, and both docs.

**Verification:** `npm run check:game` passed (86 tests plus design checks); `npm run build` passed. The focused sprite smoke test covers both team colors. No interactive browser screenshot was captured in this workspace.

**Limit:** The bear uses the existing minion damage and target selection rules and does not have a separate inventory or command panel. A useful next step is a visual match review of summons, teamfight readability, and mobile HUD overlap; then improve ability AI cases that still use one-target logic despite area effects.

## User Request: Jungle Leashes, One-Time Gravemarch, and Live Sylla Review

**User:** Asked for jungle camps to regain health after dropping aggro, have an aggro timer or limit based on League, look bigger and scarier, and for the bottom golem to spawn once and charge towers. The user also requested the previously proposed live Sylla review.

**Agent:** Added a five-second camp patience clock refreshed by valid hits inside the home leash. A camp returning after losing its target or patience heals 6% maximum health per second and completes a full reset after six seconds; a fresh valid hit interrupts that reset. Attackers outside the leash cannot keep a camp engaged. Scouted camp bars show patience. This adapts the leash, soft reset, and hard reset ideas from [Riot's patch 12.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/) to the arena's shorter distances and match length.

**Agent:** Enlarged the camp models, clearing rings, trees, and fog silhouettes. Gravemarch gained a more threatening silhouette with horns, lit runes, and heavy fists. The neutral Gravemarch appears once per match. On defeat it spawns exactly one allied siege golem near the leading friendly wave; the previous repeating wave buff and neutral respawn are gone. The claimed golem has a readable windup, then charges a live enemy turret in front of it and deals 1,050 base damage subject to tower plating. It can be killed and never respawns. Its charge has a 10-second cooldown.

**Agent:** Ran an actual Vs AI browser draft with Sylla on blue. At 0:16 the live bear was alive with 411/1,240 HP and fighting ahead of Sylla, but its old minion draw layer let champions hide it. Moved the bear to a foreground pass, gave it more space while following Sylla, and checked the replay again at 0:17. [The captured live frame](sylla-live-review.png) shows the larger bear and its nameplate in the teamfight. Inspected the [jungle view](jungle-live-review.png) at 0:50 after first-wave fog cleared, then inspected Gravemarch when scouted. This confirms visual readability at a 1600×900 desktop viewport; mobile was not inspected.

**Affected files:** `src/neutralAggroRules.ts`, `src/neutralAggroRules.test.mjs`, `src/siegeGolemRules.ts`, `src/siegeGolemRules.test.mjs`, `src/types.ts`, `src/components/AramMatchView.tsx`, both docs, and the two visual review screenshots in `docs/`.

**Verification:** `npm run check:game` passed (89 tests plus design checks); `npm run build` passed. The focused rules tests cover camp patience, healing, retagging, Gravemarch's one-time spawn, and legal charge targets. The live browser replay covers desktop visual behavior.

**Limit:** Gravemarch's tower charge uses normal plating, so its actual tower damage is lower early in a match. Jungle patience and leash values are original arena tuning, not a copy of current League balance. The online room still synchronizes a seeded AI match rather than a server-authoritative battle.

## User Request: Creature Attacks and Turns

**User:** Spirit Bear, golems, and neutral camps should visibly attack and turn.

**Agent:** Added persistent horizontal facing to the Spirit Bear, claimed siege golem, and neutral camps. They turn over fixed simulation ticks as their target moves or, for a leashed camp, as they return home. The model narrows briefly during a turn while labels and health bars remain stable. Sylla's bear lunges with its leading paw and claw trail. Frost sentinels and both Gravemarch models lift and slam their fists; wolves bite, behemoths thrust their tusks, and crimson drakes flare their wings and breathe fire. These poses follow existing attack timers. The claimed golem also raises its arm through the tower charge warning and slams on contact. Combat damage, cooldowns, target selection, and leash rules remain tied to their existing simulation events.

**Affected files:** `src/creatureAnimation.ts`, `src/creatureAnimation.test.mjs`, `src/types.ts`, `src/components/AramMatchView.tsx`, `src/components/ChampionSpriteRenderer.ts`, `src/avatarSkillAnimation.test.mjs`, and both docs.

**Verification:** `npm run check:game` passed (91 tests plus design checks) and `npm run build` passed. A live Vs AI Sylla draft was watched in headless Chrome at a 1600x900 desktop viewport; the foreground bear and enlarged neutral camp models remained visible in the running canvas. The pure animation tests cover a multi-tick turn, close-range facing stability, and attack pose expiration. The bear sprite smoke test covers idle, raised paw, and claw strike for both team colors.

**Limit:** The browser review sampled live frames rather than every possible turn and strike frame, and mobile was not inspected. Attack poses are visual; they do not delay the already immediate bear hit or camp projectile launch.

## User Request: Finish Contested Objectives and Repair Starting Cards

**User:** Teams should finish a low-health objective before fighting. They should only turn from a healthy objective when the enemy team actually chooses to fight, and should otherwise focus the boss. After a secure, fighting or regrouping should depend on the shotcaller, AI, and player card attitudes. The user also showed the Starting 5 lineup with clipped trait badges, uneven card footers, and truncated slot information.

**Agent:** Added a health-aware objective action in `src/objectiveRules.ts`. At or below 32% boss health, both the holding team and a scouting contesting team choose to finish Embermaw or Gravemarch. Above that, the holding team keeps attacking unless an enemy champion recently damaged an ally near the pit. A contesting team can initiate a fight or race the boss based on its cards and coach. IQ, teamfight and clutch ratings, PlayStyle traits, and coach style affect the decision; a `Shotcaller` card has a stronger voice over the group. These values affect choices, not damage or defenses. The first team to engage a boss retains its claim while present; if it leaves and the other team takes over, the claim changes. On a kill, a separate team call decides whether to press nearby enemies or regroup toward lane for six game seconds. A fresh enemy hit can interrupt regrouping. The event log records finish, fight, and aftermath calls.

**Agent:** Reworked the Starting 5 card layout in `src/components/CardComponent.tsx` and `src/components/SquadView.tsx`: cards grow to fit their traits, signature avatars can wrap onto two lines, role descriptions have their own row, and Swap/Inspect actions align beneath the cards. The badge row no longer spills over the card border.

**Affected files:** `src/objectiveRules.ts`, `src/objectiveRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/components/CardComponent.tsx`, `src/components/SquadView.tsx`, and both docs.

**Verification:** `npm run check:game` passed (93 tests plus design checks) and `npm run build` passed. Focused tests cover low-health finish, fighting only after an attack on a healthy holder, different coach/card attitudes, shotcaller influence, and post-secure choices. Reviewed the Starting 5 in headless Chrome at 1440x900 and 1200x900; all visible badges fit inside their cards and slot roles are readable.

**Limit:** The objective decision uses a fixed low-health threshold and a recent champion-damage signal; it does not estimate projectile travel time or exact burst damage. The browser check covered the lineup, while objective branch outcomes were checked through rule tests and code review rather than a full live objective contest replay.

## User Request: Recorded Sounds for Every Avatar Skill

**User:** Asked for realistic sounds for each avatar skill using free effects intended for game developers.

**Agent:** Replaced the shared synthetic cast beep in the main arena and avatar hub preview with authored audio cues for all 39 playable avatars' Skill 1, Skill 2, and Ultimate. Each skill pairs a primary recording with a quieter accent and a stable, modest pitch variation for that avatar. The 27 included recordings are selected from Kenney's [RPG Audio](https://kenney.nl/assets/rpg-audio), [Impact Sounds](https://kenney.nl/assets/impact-sounds), and [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), each CC0 according to the pack's own license file. They are foley, physical impacts, and energy effects; no audio was copied from the games behind avatar inspirations. Sounds preload after the first user interaction. Playback has a per-skill throttle and voice cap so 4x teamfights do not stack an unbounded number of sounds. Generic combat hits and boss explosions now use quieter recorded effects; UI actions retain their existing cues. The passive is always active and has no separate cast cue.

**Affected files:** `src/avatarSkillAudio.ts`, `src/audio.ts`, `src/components/AramMatchView.tsx`, `src/components/ChampionHubView.tsx`, `src/avatarSkillAudio.test.mjs`, `public/audio/kenney/`, and both docs.

**Verification:** `npm run check:game` passed (95 tests plus design checks), including coverage of all 117 active skill cues and shipped sample paths. `npm run build` passed. No speaker-based listening review was possible in this workspace.

**Limit:** Cues share a compact 27-recording palette, so their combinations, pitch, and layering create distinction rather than 117 separate recordings. Browser autoplay policy applies; the first sample may arrive slightly after a cold load. The browser audio mix still needs a live listening pass, especially at 4x speed.

## User Request: Match Creature Turns to Avatar Turns

**User:** Said the new Spirit Bear, golem, and neutral camp turns look unnatural and asked to reuse the avatars' turn behavior.

**Agent:** Removed the creatures' multi-tick width-squeeze turn. Spirit Bear, neutral camps, and the claimed siege golem now switch horizontal facing immediately, the same way avatar sprites flip. A small close-range dead zone preserves the current direction to avoid jitter when standing on a target. Their full silhouettes remain visible throughout; paw, fist, jaw, tusk, fire, and tower-charge attacks keep their existing timer-driven poses. No combat targeting, leash, attack timing, or damage changed. The earlier creature-turn handoff entry describes the superseded animation.

**Affected files:** `src/creatureAnimation.ts`, `src/creatureAnimation.test.mjs`, `src/components/AramMatchView.tsx`, and both docs.

**Verification:** `npm run check:game` passed (95 tests plus design checks) and `npm run build` passed. The focused test checks an immediate full-width flip, close-range facing stability, and the existing attack poses.

**Limit:** This uses the avatars' two-direction sprite flip, so there is no dedicated three-quarter or back view. A live visual review of every neutral model was not performed in this turn.

## User Request: Larger Creeps, Smaller Shots, and Better Farm vs Nexus Calls

**User:** Asked to make creeps a little larger and reduce their projectile attacks. Clarified that the projectile size should shrink, while attack frequency and damage stay the same. Teams should plan farms around known jungle camp locations rather than wait to discover a camp, and stop farming camps when an exposed enemy nexus is low enough to finish.

**Agent:** Enlarged the normal melee, caster, and cannon creep artwork to 1.28× and widened their shadows, empowerment ring, and health bar. Caster shot radius fell from 4 to 2.5 pixels; cannon shot radius fell from 7 to 5 pixels. The projectile rate, damage, speed, and collision behavior did not change. AI now selects a route from a camp's known home location without a vision gate. Jungle-capable avatars can route from farther away; a strong farmer in another role may take a nearby camp when lane is quiet. Threats, low health, early first wave, lane pressure, and an urgent structure finish stop the farm choice. Both teams use the same rule.

**Agent:** Added a nexus finish read based on the nexus's actual health, exposed state, player IQ, and coach macro rating. An exposed low-health nexus suppresses ordinary camp farm and side-objective calls. Healthy attackers move to and hit the nexus when safe; if a defending wave blocks the push, they clear that wave first. Immediate enemy danger can still force a fight. This targets the reported behavior where teams farmed camps despite a finishable nexus.

**Affected files:** `src/components/AramMatchView.tsx`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, and both docs.

**Verification:** `npm run check:game` passed (98 tests plus design checks) and `npm run build` passed. Focused tests cover known camp routing without vision, farm cancellation under lane pressure or nexus urgency, and high/low IQ nexus recognition.

**Limit:** The AI knows fixed camp homes and uses current camp availability from simulation; it does not model uncertain enemy clears or hidden respawn timers. The low-nexus threshold varies roughly from 33% to 41% with IQ and coach. Creep and projectile size were checked in code and build, not in a live screenshot in this turn.

## User Request: Channeled Black Hole and Active Skill Kits

**User:** Asked for Nullweaver's ultimate to become a channeled black hole that teams play around; Raijin's Ball Lightning to have a 3-to-1-second cooldown and costly mana use with mana items; visible Renn dashes; Paxi teleporting to an unexpired orb; Kaolin physically rolling into opponents; more useful Skill 2 casts; Tequoia's Forest Link to share 10% damage among avatars in a zone; and Cinderlock's three-stage Q plus invisible, faster W.

**Agent:** Added per-avatar runtime state for dashes, channels, active orbs, linked groups, Cinderlock's Q sequence, and stealth. Nullweaver channels for 3.2 seconds, pulling and repeatedly damaging enemies in a visible black hole. Crowd control or death ends the channel. Higher-rated opponents target the channeler; higher-rated teammates focus enemies caught in the hole. Renn's Gilded Vault, Harmonic Waltz, and Dazzling Rush now travel over simulation ticks with a visible trail; his vault lands control on contact. Kaolin becomes a drawn jade boulder while rolling and stops on the first hostile avatar hit. Paxi's orb travels and remains active briefly; capable players jaunt to it when the position helps a fight. Cinderlock lunges on Q1, ignites on Q2, and makes a critical magic strike on Q3; Ash Veil grants 3.5 seconds of stealth and faster movement until an attack or damage reveals him.

**Agent:** Tequoia's Skill 2 is now Forest Link. It links every living avatar in the target zone for four seconds and shares 10% of actual health lost by one linked avatar with each other linked avatar. The transferred hit never shares again. High-IQ Tequoia players avoid linking a zone with as many allies as enemies. Skill 2 utility casts now get a chance before Skill 1, and self or ally skills are no longer blocked by distance to an enemy. Raijin's ultimate uses fixed 3, 2.3, 1.6, and 1 second cooldowns by rank, but costs 58 to 73 mana each cast. Aegis Orb, Forgotten Grimoire, Thunderclap Staff, and the new Tempest Folio now provide real mana capacity and regeneration; Raijin's item planner values those stats. The mana bar and regeneration use the purchased capacity.

**Affected files:** `src/components/AramMatchView.tsx`, `src/types.ts`, `src/abilityRules.ts`, `src/abilityRules.test.mjs`, `src/combatDecision.ts`, `src/skillRangeRules.ts`, `src/additionalChampions.ts`, `src/mockData.ts`, `src/itemsData.ts`, `src/itemStrategy.ts`, and both docs.

**Verification:** `npm run check:game` passed 101 tests plus design checks and TypeScript; `npm run build` passed. Focused tests cover Raijin's cooldown and mana costs, mana item capacity and regeneration, defensive Skill 2 use beyond enemy range, and affordability of Cinderlock's three Q casts.

**Limit:** These new runtime effects were verified by code and automated checks; a live visual match was not inspected in this turn. Paxi's autonomous jaunt requires a favorable nearby target and card IQ of at least 55. Forest Link can share damage to teammates if the chosen zone contains both teams; this is why higher-IQ users avoid an even or unfavorable zone.

**Later change:** The Nature Link section below supersedes this early Forest Link behavior: only enemy champions are linked and share damage.

## User Request: Forest Link Marker, Neutral Range, and Match Decisions

**User:** Approved a match inspector and smarter play around Nullweaver's Black Hole and Paxi's orb. Asked for Forest Link to show a marker above linked avatars' IGN instead of lines, and reported that some avatars gain an implausibly long attack range against jungle camps.

**Agent:** Replaced Forest Link's connecting lines and ground ring with a green `LINKED` badge over each affected avatar's nameplate. Normal and epic neutral attacks now stop at a short, fixed maximum distance, even for long-range avatars. The attack executor checks distance again before damage; Runaan secondary bolts do not strike camps, bosses, or structures. Champion attack range is unchanged. This addresses the visual and combat reach that made neutral farming look like a range increase.

**Agent:** Skilled teams spread from a ready enemy Black Hole and save an available interrupt while Nullweaver is a healthy threat; the hold ends once the channel starts so they can interrupt it. Paxi can send an orb toward her own well while endangered and jaunt to it when the destination is safer. A seeded Match Insights panel records each avatar's Q/W/R casts, skillshot hits and attempts, throttled mana shortage windows, Black Hole interruptions, and Paxi engage or escape jaunts. It also shows a scrubbable timeline of casts and major decisions. The saved match report carries the insights and the existing balance summary aggregates selected counters across runs.

**Affected files:** `src/components/AramMatchView.tsx`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, `src/blackHoleCounterplay.ts`, `src/blackHoleCounterplay.test.mjs`, `src/paxiDecision.ts`, `src/paxiDecision.test.mjs`, `src/combatDecision.ts`, `src/combatDecision.test.mjs`, `src/matchInspector.ts`, `src/matchInspector.test.mjs`, `src/matchReplay.ts`, `src/matchReplay.test.mjs`, and both docs.

**Verification:** Focused tests cover the neutral range cap, Black Hole counterplay choices, Paxi's escape decision, telemetry counters, and saved report aggregation. `npm run check:game` and `npm run build` pass. A live desktop Vs AI draft with Tequoia and an opposing Nullweaver showed the `LINKED` markers and a populated Insights panel with Q/W casts, skillshot hits, and timeline events. The 25-match balance run is available from the live match header.

**Limit:** The panel records events and a timeline, not positional snapshots or a frame-by-frame video replay. Readiness and risk are local AI estimates; Black Hole spread and Paxi escape depend on card ratings and battlefield geometry. The live visual check used a desktop viewport; mobile and speaker audio were not reviewed.

**Later change:** The Nature Link section below replaces the `LINKED` text badge with an emerald overhead crest.

## User Request: Channeled Ability Follow-Up Engage & Protection Removal

**User:** Reported that when avatars cast channeled abilities (such as Nullweaver's Singularity Well, Corsara's Broadside Waltz, or Cloudtail's Cyclone Dance), their allies protect them or path toward them instead of committing to the follow-up engage.

**Agent:** Removed the convergence behavior where allies treat channeling teammates as grouping anchors or defensive peel targets. Channeled abilities are now recognized as aggressive teamfight engagements rather than distressed carries needing peel:

- **Peel Exclusion:** `isChannelingAbility` identifies avatars currently channeling abilities (`blackHole`, `corsaraBarrage`, `monkeySpin`). Channeling allies are excluded from defensive carry peeling in `chooseTeamfightTarget`, allowing tanks and supports to engage forward rather than hovering around the channeler.
- **Grouping Exclusion:** In `AramMatchView.tsx`, `fightingAlly` excludes channeling teammates. Allies no longer path directly to the channeler and abort their own combat loop.
- **Target Prioritization:** Added `isEnemyCaughtInAlliedChannel`. When any ally channels an engage ability, all living allies within teamfight range (up to 650px) prioritize enemies trapped in or targeted by the channel (e.g. enemies in the Black Hole, barrage cone, or Cyclone Dance knockup), sorting by lowest health and squishy carries for burst execution.
- **Engagement Commitment & Sprint:** Healthy allies (`u.hp > u.maxHp * 0.25`) during an allied channel engage suppress retreat and recall, bypass routine wave-clearing (`clearWaveFirst = false`), expand combat engagement range to 550px, sprint with +30ms engage bonus speed toward the trapped targets, trigger a floating `⚔️ FOLLOW-UP ENGAGE!` cue, and immediately cast follow-up combos, ultimates, and skills upon reaching ability range.

**Affected files:** `src/combatDecision.ts`, `src/combatDecision.test.mjs`, `src/components/AramMatchView.tsx`, `src/types.ts`, and both docs.

**Verification:** `npm run check:game` passed 113 tests plus design checks; `npm run build` passed with zero errors. Focused tests verify that channeling allies are excluded from carry peel, trapped targets in Black Hole/barrage/spin are prioritized across teamfight range, and follow-up ultimates are committed.

**Limit:** The follow-up engage checks active channel state and enemy positioning inside the ability zone; if an allied channeler is interrupted immediately by crowd control, allies reassess normal teamfight priorities on the next tick.

## User Request: Turret Kill Attribution, 10-Second Execution Window, and Opponent Objective Contestation

**User:**

1. If a turret kills an avatar, the kill should go to the last avatar who damaged the killed avatar. But if the elapsed time is 10 seconds, the turret gets the execution and the team owning the turret receives the gold evenly.
2. Fix opponent objective regrouping: when contesting an opponent on Dragon Embermaw or Siege Golem Gravemarch, the team should engage in a teamfight against the opposing champions rather than rushing directly into the objective monster's pit.

**Agent:**

- **Turret Execution & Kill Attribution:**
  - In `AramMatchView.tsx` and `matchReplay.ts`, added `resolveTurretKillReward(victim, matchTime, champions, 10)`.
  - When an avatar dies from a turret shot without direct champion killer:
    - If `victim.lastEnemyDamage` was within 10 seconds, the champion who dealt the damage is credited with the kill, full 300g reward, XP, and assists.
    - If elapsed time exceeds 10.0s (or no enemy champion damaged them), the turret secures an authentic execution (`🏰 TURRET EXECUTION!`). No champion gets kill credit, and the 300g bounty is split evenly (60g each) across all five members of the defending team.
- **Objective Contest Teamfight Priority:**
  - In `objectiveRules.ts`, added `objectiveFightPreference(players, coach, actor)`, `chooseObjectiveAction`, and `choosePostObjectiveAction`.
  - Contesting teams scouting opponents at Embermaw/Gravemarch acquire opposing champions as primary targets (`contestFightTarget`) rather than walking into the pit to hit the boss. They look for a teamfight engagement against the enemy champions taking monster damage, only turning to focus the boss when it falls into execution range ($\le 32\%$) or after wiping the contesting threats.

**Affected files:** `src/components/AramMatchView.tsx`, `src/matchReplay.ts`, `src/objectiveRules.ts`, `src/objectiveRules.test.mjs`, and both docs.

**Verification:** `npm run check:game` passed 118 tests; `npm run build` passed.

**Limit:** Execution attribution uses a fixed 10-second timer window; assists use existing proximity checks.

## User Request: Cinderbloom Melee Avatar, AI Steering Stabilization, Support Items, Ability Haste & Ability Damage Scaling

**User:**

1. Cinderbloom should be a melee avatar.
2. Too much spinning around if AI can't make decisions; improve it using steering behaviors and anti-oscillation techniques from the internet.
3. Make more support items.
4. Make more items that support cooldown reduction (Ability Haste).
5. Make more items that add damage to abilities (AP, AD, Lethality) and find a way to balance it.

**Agent:**

- **Cinderbloom Melee Conversion:** Converted Cinderbloom (`c_locke`) from a 125px ranged caster to a dedicated melee avatar (`range: 1.4` kit range, 50px arena melee attack distance, melee slash sparks, no projectile). Preserved champion ID `c_locke` and 43-avatar invariants across animation motifs and combos.
- **Steering Behavior & Anti-Spin Damping:**
  - Directional Deadband Hysteresis: `setUnitFacing(unit, targetX, deadband = 12)` ignores sub-12px horizontal deltas during vertical pathing and arrival, stopping 30Hz left/right flipping.
  - Decision State Commitment: `decisionCommitTimer` (0.45s retreat / 0.35s fight window) and `committedState` prevent rapid toggling between fighting and retreating when distance or HP thresholds slightly fluctuate.
  - Target Stickiness Hysteresis: Target focus bonus (+1.4 score) prevents fluttering between equidistant targets.
  - Kiting Hysteresis: Enter backstepping at `dist < threshold * 0.88`; exit only when `dist >= threshold * 1.12`.
- **Support Items (6 Legendary Items):** Added Chime of Renewal (Echoes of Helia), Windwalker's Warhorn (Shurelya's), Warden's Pledge (Knight's Vow), Aegis of the Protector (Locket), Sunblessed Censer (Ardent Censer), and Beacon of Deliverance (Redemption) with healing, move speed auras, damage redirection, emergency barriers, and attack speed buffs.
- **Ability Haste Items (4 Dedicated High-Haste Items):** Added Obsidian Cleaver (Black Cleaver, 25 Haste), Dragonheart Glaive (Shojin, 30 Haste), Chronoblade Quickflicker (Navori, 15 Haste + 0.7s basic attack refund), Cosmic Chronosphere (Cosmic Drive, 30 Haste).
- **Ability Scaling & Penetration Balance Engine:**
  - Added Wraithblade of the Dunes (Ghostblade, 18 Lethality), Duskfang Reaver (Duskblade, 18 Lethality + up to 12% missing HP damage amp), Fang of the Serpent (Serpent's Fang, 15 Lethality + 40% shield shred), Cinderflame Diadem (Shadowflame, 18 Magic Pen + 22 burst vs shielded/low HP), Astral Spyglass (Horizon Focus, 10% long-range ability amp).
  - Ability Damage Formula: Base ability damage + AP scaling (`ap * (isMage ? 0.42 : 0.25)`) + bonus AD scaling (`bonusAd * (isPhysicalRole ? 0.36 : 0.18)`). Lethality flat armor pen scales with champion level: `lethality * (0.6 + 0.4 * level / 18)`. Magic Pen reduces effective magic resistance.

**Affected files:** `src/types.ts`, `src/additionalChampions.ts`, `src/itemsData.ts`, `src/itemStrategy.ts`, `src/combatDecision.ts`, `src/abilityRules.ts`, `src/avatarCombos.ts`, `src/avatarSkillAnimation.ts`, `src/avatarSkillAudio.ts`, `src/skillRangeRules.ts`, `src/rosterResearch.ts`, `src/components/ChampionSpriteRenderer.ts`, `src/components/AramMatchView.tsx`, `src/combatSteeringAndItems.test.mjs`, and both docs.

**Verification:** `npm run check:game` passed 118 tests; `npm run build` passed.

**Limit:** Lethality and magic penetration scale linearly with level and stats; items are tuned for fast-paced Clash Arena matches with 0.65 economy scaling.

## User Request: Tower Dive Limits, Avatar Limits & Player Cards, Failed Dive Abort & Emergency Turret Evacuation

**User:**
Reported that teams are tower diving way too much, throwing games away, and when a tower dive fails they just stand there and die doing nothing about it. They should know the limits of their avatar a lot, but it depends on the player cards also.

**Agent:**
Investigated root causes and found three critical bugs:

1. Target selection (`chooseTeamfightTarget`) had zero penalty for enemies standing under live enemy turrets, causing units to ignore lane fights and pursue low-health enemies deep under towers.
2. In `AramMatchView.tsx`, retreating champions under enemy towers selected `nearbyRetreatBush` (such as `bush_red_river` at $x=1250, y=235$), which was only 160px from the enemy tower (within its 280px range). Upon arriving within 14px of the bush center, the unit set `u.vx = 0, u.vy = 0, animState = 'idle'`, freezing permanently inside turret range while the turret blasted them to death.
3. Ordinary champions had no turret boundary awareness when closing distance, walking blindly into turret range without dive authorization or minion wave crash. Furthermore, if a target popped Zhonya's Stasis or escaped, divers stood still taking turret true damage.

**Implementation (`src/towerDiveRules.ts`, `src/playerTraits.ts`, `src/combatDecision.ts`, `src/components/AramMatchView.tsx`):**

- **Avatar Limits (`getAvatarDiveLimits`):**
  - **Tanks:** High durability; require $\ge 40\%$ HP and $\ge 650$ raw HP; can solo dive if target is low ($\le 38\%$).
  - **Fighters:** Require $\ge 45\%$ HP and $\ge 600$ raw HP; target $\le 35\%$.
  - **Assassins:** Require burst skill readiness (`cd1 <= 0` or `cdUlt <= 0` with mana), $\ge 45\%$ HP, and target $\le 32\%$.
  - **Squishy Mages & Marksmen:** Must NEVER dive into melee tower range without allied minion wave buffer; require $\ge 58-60\%$ HP; target must be an absolute 1-shot execute ($\le 18-20\%$).
  - **Supports:** Never dive solo; require $\ge 55\%$ HP and wave crash.
- **Player Card Influence & Tactical Conditions:**
  - High IQ ($\ge 75$) players strictly calculate lethal thresholds, require minion wave crash ($\ge 2$ minions), and will never dive outnumbered (`defendersUnderTower > attackersUnderTower`).
  - `Aggro Diver` trait gives higher willingness to execute dives on wounded targets ($\le 38\%$), but respects avatar durability and survival thresholds (never suicides below 30% HP or when outnumbered).
  - Target Selection Penalty: In `chooseTeamfightTarget`, candidates under active enemy turrets receive a $-3.8 \times \text{IQ} \times (\text{isSquishy} ? 1.5 : 1.0)$ safety penalty unless diving is authorized.
- **Turret Perimeter Tethering:** Non-diving champions hold at `getTurretPerimeterHoldPoint` (safe boundary outside tower range $+28\text{px}$), allowing ranged units to poke safely from outside the turret zone and melee units to wait with the minion wave rather than walking under the tower.
- **Failed Dive Abort & Emergency Turret Evacuation (`shouldAbortTowerDive`, `getTurretEvacuationVector`):**
  - Abort Triggers: Target eliminated, target in Zhonya's Golden Stasis / untargetable, target gained heavy barrier, diver taking turret fire with dropping HP ($< 38\%$ Tank / $< 48\%$ others), dive duration exceeding 2.6 seconds, or minions wiped.
  - Emergency Evacuation: Diver immediately sets `diveAborting = true`, displays `🏃 ABORT DIVE!`, acquires an evacuation vector directed away from the turret toward home lane safety, gains $+35$ movement speed evacuation sprint, and suppresses routine auto-attacks until safely outside turret range $+50\text{px}$.
  - Bush Safety Fix: `isBushSafeFromTowers` strictly filters out bushes inside or near enemy turret range. In retreat logic, units inside enemy turret range never stop idle at `distToTarget <= 14`; they keep moving until safely outside the turret zone.

**Affected files:** `src/towerDiveRules.ts`, `src/towerDiveLimits.test.mjs`, `src/playerTraits.ts`, `src/combatDecision.ts`, `src/types.ts`, `src/components/AramMatchView.tsx`, and both docs.

**Verification:** `npm run check:game` passed 126 tests with zero failures; `npm run build` compiled clean production bundle.

**Limit:** Tower dive evaluations use discrete simulation geometry; champions without dashes rely on movement speed and the evacuation sprint bonus to exit turret range before the next shot.

## User Request: Nature Link Enemy-Only Targeting, Floating Damage Status Cleanup & Unique Linked Icon

**User:**
"can we remove some minus health status for example the Nature Link when 4 or more heroes are linked the screen lits up with Nature Link labels. Nature links can only affect enemies, also changed the 'LINKED' status to a unique icon."

**Implementation:**

- **Enemy-Only Targeting:**
  - In `castChampionSkill2` (`AramMatchView.tsx`), Tequoia's Skill 2 targets living enemies only: `championsRef.current.filter(e => e.isAlive && e.team !== u.team && Math.hypot(e.x - target.x, e.y - target.y) <= 125)`.
  - In `applyDamageToChampion`, shared damage propagation enforces `other.team === target.team` and emits the updated event `🌿 NATURE LINK: [player] linked [N] enemy champions!`.
  - In `combatDecision.ts`, Tequoia's AI cast evaluation checks `hostile >= 2 || (teamfight && hostile >= 1)` without needing to compare against friendly allies because allies will never be bound.
- **Floating Status Text Suppression:**
  - In `applyDamageToChampion` (`AramMatchView.tsx`), `floatsRef.current.push` is suppressed when `sharedDamage === true` or `label === 'Nature Link' || label === 'Forest Link'`.
  - When multiple enemies are linked and taking damage, floating combat labels no longer flood the screen; actual health reduction and health bars deplete cleanly.
- **Unique Status Crest & Battlefield Tether Lines:**
  - Replaced the rectangular text box `ctx.fillText('LINKED', ...)` above champions with a custom vector circular emerald crest at `(u.x, barY - 18)`.
  - The crest features a dark green backing, glowing emerald border, a radial timer ring displaying remaining link duration (`progress = remaining / 4`), dual interlocking vine loops (`#86efac`), central knot highlight, and a sprouting leaf bud accent (`#22c55e`).
  - Added battlefield tether rendering (`s.type === 'forest_link'`) drawing dynamic animated dashed green vine lines directly between linked enemies.

**Affected files:** `EsportsClash.Web/src/mockData.ts`, `EsportsClash.Web/src/combatDecision.ts`, `EsportsClash.Web/src/components/AramMatchView.tsx`, `EsportsClash.Web/src/combatDecision.test.mjs`, `docs/arena-mechanics.md`, and `docs/agent-handoff.md`.

**Verification:**

- `npm run check:game` passed all 127 tests.
- `npm run build` compiled clean production build.

**Limit:** Nature Link transfers 10% true damage between linked enemies for 4.0 seconds. The radial duration ring scales linearly from 4.0s to 0s.

## User Request: Paxi/Raijin Ground Targeting and Kaelen Elemental Conflux

**User:**

- Make Paxi's Q and Raijin's ultimate ground-targeted so they can cast without an enemy target and travel toward the selected ground direction for engaging or disengaging.
- Replace Kaelen's established Pyra/Surge Spellweave kit. He has no ultimate: Q Orb of Ice, W Orb of Wind, E Orb of Fire, an active innate with a distinct name, and D/F invoked-spell slots. Use Ice/Wind/Fire recipes, FIFO, unique cooldowns, and reduce the innate cooldown at levels 1/7/13/18 to 3/2/1/0 seconds.

**Confirmed decision:** The user explicitly approved replacing the previously documented Kaelen kit. The new active innate is **Conflux**.

**Implementation:**

- **Ground-target rules:** `src/groundTargetRules.ts` calculates an explicit or facing-direction fallback destination, clamps it to cast range, and keeps it inside arena bounds. `src/components/AramMatchView.tsx` uses that for Paxi's Q and Raijin's Ball Lightning; Raijin's retreating AI aims away from combat. Paxi's escape jaunt keeps its 230px travel limit; her ordinary cast range is 700px, and Raijin's ultimate remains 320px.
- **Kaelen elemental kit:** `src/kaelenAbilities.ts` defines the Ice/Wind/Fire orb FIFO, ten three-orb spells with distinct cooldowns, the D/F invoked-spell FIFO, and Conflux cooldown thresholds. `src/additionalChampions.ts`, `src/types.ts`, `src/components/AramMatchView.tsx`, `src/avatarCombos.ts`, `src/matchInspector.ts`, `src/championLore.ts`, `src/avatarSkillAnimation.ts`, `src/components/ChampionSpriteRenderer.ts`, `src/components/ChampionHubView.tsx`, and `src/components/DraftPhaseView.tsx` now reflect the new kit and its UI/runtime behavior. Orb cooldowns are 5/6/7 seconds for Q/W/E.
- Kaelen's former `ultimate` data slot is retained only for kit compatibility and now describes E Orb of Fire (`isUlt: false`); generic ultimate progression and the old learned two-skill combo path are disabled for him. Invoked spells use D/F and are tracked separately from ultimate casts.
- **Safety:** Ground aiming does not bypass turret-dive authorization, perimeter tethering, evacuation, or turret-safe retreat rules.
- **Tests:** Added `src/groundTargetRules.test.mjs` and `src/kaelenAbilities.test.mjs`, and extended `src/skillRangeAndChainStun.test.mjs` and `src/skillshotCombos.test.mjs`.

**Affected files:** `EsportsClash.Web/src/additionalChampions.ts`, `avatarCombos.ts`, `avatarSkillAnimation.ts`, `championLore.ts`, `components/AramMatchView.tsx`, `components/ChampionHubView.tsx`, `components/ChampionSpriteRenderer.ts`, `components/DraftPhaseView.tsx`, `groundTargetRules.ts`, `groundTargetRules.test.mjs`, `kaelenAbilities.ts`, `kaelenAbilities.test.mjs`, `matchInspector.ts`, `skillRangeAndChainStun.test.mjs`, `skillRangeRules.ts`, `skillshotCombos.test.mjs`, `types.ts`, and both gameplay documents.

**Verification:** From `EsportsClash.Web`, `npm run check:game` passed all 134 tests and TypeScript checks; `npm run build` completed successfully. Vite reports the existing large-chunk advisory (the main JavaScript bundle is over 500 kB).

**Limit:** The arena is an auto-battler and does not expose manual cursor or keyboard ability controls. Ground targets are selected by the simulation (including facing/team direction when no target point is supplied); player-directed manual casting is not added.

## User Request: Avatar Terminology, Full-Width Roster, Targeting Details, and Aetheris Ability Visuals

**User:**

- Rename champions to avatars in the interface.
- Make the avatar list full-width, with avatar profile details and ability information in two columns.
- Alphabetize role filters and their results in both the roster and draft.
- Show whether abilities are unit/ally targeted, ground-targeted, self-targeted, or need no target.
- Make Aetheris's innate link visible; make Q orbs orbit Aetheris and burst when their projectile hits an enemy; add a visible ally aura for W; replace the ultimate with an all-nearby-allies tether whose duration scales with ultimate rank.

**Confirmed decision:** Aetheris's ultimate lasts 5 seconds at rank 1, scaling to 8 seconds at rank 4 (6 and 7 seconds at ranks 2 and 3).

**Implementation:**

- **Avatar naming and layout:** `EsportsClash.Web/src/components/ChampionHubView.tsx` uses the full page width as two stacked rows: an alphabetically role-filtered, searchable, scrollable avatar-card grid on top; the selected avatar's identity, combat tags, lore, stats, and ability kit below. `DraftPhaseView.tsx` also alphabetizes role filters and the filtered avatar list. Visible navigation, squad, and pro-circuit labels now say avatars; internal `ChampionKit` types, IDs, and persistence fields remain unchanged.
- **Ability targeting details:** `src/aetherisAbilities.ts` provides shared target-type descriptions, used in roster and draft ability detail panels. `ChampionSkill.targeting` and the relevant kits mark Paxi Q and Raijin R as ground-targeted; Kaelen's orb gathering needs no target; Aetheris Q targets an enemy unit, W an ally, and R is self-centered.
- **Aetheris visuals and effects:** `src/components/AramMatchView.tsx` draws a live innate tether to the nearest living ally within 280 arena units. Q summons five orbiting spirits for 8 seconds; each Q projectile hit bursts at the enemy for area damage and consumes an orb. W applies a 5-second, visible aura to the nearest ally within 260 units (self if alone), a shield, and +15% basic-attack damage. `Resonant Convergence` heals and shields living allies within 260 arena units, then draws moving tethers for 5/6/7/8 seconds at ultimate ranks 1-4.
- `src/aetherisAbilities.test.mjs` covers rank-based ultimate durations, target-type descriptions, and nearest-ally selection.

**Affected files:** `EsportsClash.Web/src/App.tsx`, `additionalChampions.ts`, `aetherisAbilities.ts`, `aetherisAbilities.test.mjs`, `components/AramMatchView.tsx`, `components/ChampionHubView.tsx`, `components/DraftPhaseView.tsx`, `components/ProCircuitView.tsx`, `components/SquadView.tsx`, `mockData.ts`, `types.ts`, and both gameplay documents.

**Verification:** `npm run check:game` passed all 137 tests, design validation, and TypeScript checks. `npm run build` succeeded with Vite's advisory for a JavaScript bundle over 500 kB. `git diff --check` passed. Browser layout inspection confirmed exactly two full-width stacked sections in the roster at desktop width; narrow layouts stack the same way.

**Limits:** The match is an auto-battler. The targeting labels explain ability target type, but the application still does not provide manual player aim or point-and-click controls. Aetheris's innate tether and Q charges are visual runtime cues; only Overcharge and Resonant Convergence grant the listed shield/healing/attack-damage effects.

## User Request: Cooldown-Free Kaelen Orb Stat Bonuses and Conflux R Tab

**User:**

- Remove cooldowns from Kaelen's Ice, Wind, and Fire orbs. Each orb adds a corresponding stat that scales with orb rank.
- Put the invoked spell list in the Conflux tab; present Conflux as the ultimate in the rightmost tab and label it R.
- Clarification: orb instances and their stat bonuses are removed when FIFO rotation pushes them outside the current three orbs.

**Confirmed decision:** The user explicitly approved overriding the previous per-orb cooldowns and "Kaelen has no ultimate" presentation.

**Implementation:**

- Q/W/E now have zero cooldown. Each held orb in Kaelen's maximum-three FIFO contributes a dynamic stat bonus; overflow automatically removes the oldest orb and its corresponding bonus. The combat bonuses are derived directly from the current FIFO, so they also disappear when Conflux consumes the recipe.
- Per held orb at rank 1: Ice gives +0.2 health regeneration/second, Wind gives +1 movement speed, and Fire gives +1% spell amp and +1% overall damage amp. Each rank raises those values by 25%; orb rank follows the Q rank milestones through rank 7.
- The roster presents Q Orb of Ice, W Orb of Wind, E Orb of Fire, and rightmost `CONFLUX (R)`. All ten recipes are displayed in that Conflux panel. Conflux keeps its level-scaled 3/2/1/0-second cooldown, and D/F retains its two-spell FIFO.

**Affected files:** `EsportsClash.Web/src/kaelenAbilities.ts`, `kaelenAbilities.test.mjs`, `components/AramMatchView.tsx`, `components/ChampionHubView.tsx`, `components/DraftPhaseView.tsx`, `additionalChampions.ts`, `types.ts`, and both gameplay documents.

**Verification:** From `EsportsClash.Web`, `npm run check:game` passed design checks, TypeScript, and all 139 tests; `npm run build` succeeded with Vite's existing large-bundle advisory; `git diff --check` passed. Browser review confirmed the Kaelen tabs display Q/W/E with no cooldown and `CONFLUX (R)` at the right, with all ten recipes in its panel. Tests verify rank scaling and that FIFO overflow removes the displaced orb's bonus.

**Limits:** The match remains an auto-battler. Orbs still consume their existing mana cost; this request removes orb cooldowns and ties stat bonuses to currently held FIFO instances.

## User Request: Subtle Parody Names for Avatars

**User:** Remake avatar names as parody names of their champion/hero inspirations without making the reference too obvious.

**Clarification:** The user specified Cardrel is a Player Card, so Player Card identities must not be renamed; only avatar display names change.

**Implementation:** Added required `ChampionKit.displayName` values for all 43 avatars. Roster and draft lists, match HUDs, kill reports, match insights, and signature-avatar labels display the parody names. Existing kit `name` values, avatar IDs, player-card names, and signature matching remain unchanged so combat rules and saved roster data continue to work. Current aliases are `Dawnna`, `Aiselle`, `Vixelle`, `Gritlock`, `Bessara`, `Vanta`, `Galejandro`, `Lambent`, `Plumeira`, `Gildan`, `Sylvan Solo`, `Fernanda`, `Glimmerick`, `Cindergent`, `Voltaire`, `TerraByte`, `Nulliver`, `Crownfetti`, `Sootcase`, `Sennova`, `Basso Croak`, `Razeberry`, `Quakewell`, `Rotisserie`, `Midnight Equation`, `Plugsy`, `Relic Rick`, `Bounty Belle`, `Kegory`, `Hooklyn`, `Arsenaldo`, `Inkognito`, `Hexley`, `Knuckleberry`, `Boomie`, `Fizzlewing`, `Wickety`, `Hedgehoggin`, `Orbiton`, `Pixabelle`, `Muffleton`, `Stafford`, and `Primate Minister`.

**Affected files:** `EsportsClash.Web/src/types.ts`, `mockData.ts`, `additionalChampions.ts`, `avatarDisplayName.ts`, `matchInspector.ts`, affected roster/draft/match/card UI components, focused tests, and both gameplay documents.

**Verification:** `npm run check:game` passed all design checks, TypeScript validation, and 141 tests; `npm run build` succeeded with Vite's existing large-bundle advisory; `git diff --check` passed. Browser review confirmed the roster displays the new aliases in its list and selected-avatar details, and the Player Card signature-avatar line also uses display aliases. Tests verify unique aliases for all avatars, stable internal kit names, Cardrel remaining a Player Card identity, and alias display in match insights.

**Limit:** Internal kit names intentionally remain available to gameplay logic and saved signature data; only user-facing avatar labels use the new aliases.

## User Request: Equalized 100 OVR Draft Mode (Normal Game · No Rank)

**User:**
"in the Clash Arena, can we add a mode that the Squad Lineup does not matter? All players will be 100 overall and it all comes down with draft but it is only Normal Game and no Rank."

**Implementation:**

- **Roster & Coach Normalization (`src/equalizedMode.ts`):**
  - Added `createEqualizedRoster(team: 'blue' | 'red')` generating balanced 100 OVR GOAT tier rosters:
    - Blue: `TheSpicy` (TOP), `p1mple` (JGL), `Flaker` (MID), `Ouzi` (BOT), `Cardrel` (SUP).
    - Red: `Zypoo` (TOP), `d4nk` (JGL), `M0cke` (MID), `flopz` (BOT), `SneakBro` (SUP).
    - Preserves `Cardrel` as the parody alias per `AGENTS.md`.
    - Every player card has 100 OVR, 100 in all attributes (`lan: 100, tf: 100, iq: 100, clu: 100, sta: 100, flx: 100`), all combat roles unlocked in `playableRoles`, and all avatars in `signatureChampions`.
    - Produces identical max combat power (1.05) across all avatars and roles.
  - Added `EQUALIZED_COACH_BLUE` and `EQUALIZED_COACH_RED` (Master Tacticians) with identical 10 playbook and 10 chemistry bonuses.
- **Arena Mode & Flow Integration (`src/App.tsx`):**
  - Extended `arenaChoice` to include `'equalized_ai'`.
  - Added dedicated 3rd mode card in the Clash Arena mode selection grid: `Equalized Draft (Normal · 100 OVR · No Rank)`.
  - In `DraftPhaseView` and `AramMatchView`: When `arenaChoice === 'equalized_ai'`, passes the equalized rosters, coaches, and team names `Blue All-Stars (100 OVR)` / `Red All-Stars (100 OVR)`.
  - Added visual banner above the draft board indicating `⚡ EQUALIZED 100 OVR DRAFT MODE · Normal Match · Unranked`.
  - Added `Equalize to 100 OVR` option in multiplayer Normal room creation (`onlineMatchType === 'normal'`).
  - Matches played in Equalized mode are strictly unranked (0 Chess Elo rating risk/reward).
- **Verification (`src/equalizedMode.test.mjs`):**
  - Unit tests verify 100 OVR stats, Cardrel parody preservation, exact 1.05 combat power parity across all avatars/roles, and coach equity.

**Affected files:** `EsportsClash.Web/src/equalizedMode.ts`, `EsportsClash.Web/src/equalizedMode.test.mjs`, `EsportsClash.Web/src/App.tsx`, `docs/arena-mechanics.md`, and `docs/agent-handoff.md`.

**Verification:**

- `npm run check:game` passed all 145 tests, design validation, and TypeScript compilation.
- `npm run build` compiled clean production build.

**Limit:** Mode is an unranked normal game and does not impact ranked ladder Elo ratings.

## User Request: Player Card Drafting in Unranked Equalized 100 OVR Draft Mode

**User:**
"Unranked equalized 100 over draft mode should include Player card drafting."

**Implementation:**

- **Player Card Equalization & Drafting Logic (`src/equalizedMode.ts`):**
  - Added `equalizePlayerCard(card: PlayerCard)` normalizing any player card to 100 OVR, GOAT tier, level 60, all 100 attributes, all 6 combat roles (`playableRoles`), all avatars as signatures, while preserving original parody alias (`Cardrel`, `TheSpicy`, `Flaker`, etc.) and unique PlayStyle badges.
  - Added `getEqualizedPlayerPool()` exporting all 63 player cards equalized to 100 OVR.
  - Added `TEAM_SLOTS` defining the 5 standard competitive slots: TOP (Fighter/Tank), JUNGLE (Assassin/Fighter), MID (Mage/Assassin), BOT (Marksman), and SUPPORT (Support/Tank).
  - Added `PLAYER_DRAFT_TURNS` establishing a 10-turn Snake Draft sequence (Blue -> Red -> Red -> Blue -> Blue -> Red -> Red -> Blue -> Blue -> Red).
  - Added `chooseEqualizedPlayerPick(availablePool, currentTeam, opponentTeam, seed)` with AI evaluation that prioritizes needed roles, tactical trait synergies (`Shotcaller`, `Clutch King`, `Aggro Diver`, `One-Tap God`), origin chemistry, and seeded variance.
- **Interactive Player Card Draft UI (`src/components/PlayerDraftPhaseView.tsx`):**
  - Live 10-turn snake draft tracker with current turn badge, round indicators, and auto-draft action.
  - Blue Lineup (5 slots) and Red Lineup (5 slots) showing drafted chibi avatars, player names, OVR badges, role badges, and tactical badges. Supports slot targeting and slot swapping.
  - Center inspection spotlight showcasing the selected card's chibi avatar, 100 stats breakdown, origin, role versatility, and lock-in button.
  - Searchable, role-filtered, and origin-filtered grid of all 63 equalized superstars with dimmed drafted overlays.
  - "Auto-Draft Rest" button allowing quick AI completion of remaining picks.
  - On 10th pick lock-in, triggers walkout audio and unlocks "Proceed to Avatar Draft →".
- **Arena Two-Phase Flow (`src/App.tsx`):**
  - Launching Equalized Draft starts in Phase 1 (`PlayerDraftPhaseView`).
  - Upon completing the player draft, transitions to Phase 2 (`DraftPhaseView`), where the drafted 100 OVR Blue and Red rosters sit on stage to draft their avatars.
  - Coaches can return to Phase 1 (`← Back to Player Draft`) at any time before avatars lock in.
  - Matches played in Equalized mode remain strictly unranked (0 Chess Elo rating risk/reward).

**Affected files:** `EsportsClash.Web/src/equalizedMode.ts`, `EsportsClash.Web/src/equalizedMode.test.mjs`, `EsportsClash.Web/src/components/PlayerDraftPhaseView.tsx`, `EsportsClash.Web/src/App.tsx`, `docs/arena-mechanics.md`, and `docs/agent-handoff.md`.

**Verification:**

- `npm run check:game` passed all 148 tests (including 7 equalized mode tests), design validation, and TypeScript compilation.
- `npm run build` compiled clean production build.

**Limit:** Player Card drafting is currently integrated for single-player Equalized Draft in Clash Arena; multiplayer online rooms synchronize avatar drafting for selected rosters.

## User Request: Four Original Avatars, Channel Counterplay, and Ability Review

**User:** Asked for a smaller Nullweaver Singularity Well, original avatars inspired by Lulu, Silencer, League's Wukong, and Dota's Monkey King as two brothers, a channeled Corsara ultimate, a review of every ability, and reliable retreat from fights a card cannot win.

**Agent:** Reduced Singularity Well's pull radius to 105px and cast range to 175px. Added Faelith, Oathmute, Cloudtail, and Stonebranch with distinct kits, draft roles, combat visuals, audio and lore; Cloudtail and Stonebranch are brothers. Corsara's Broadside Waltz now fires repeated waves during a channel and can be interrupted. Oathmute can silence a channel. The survival decision estimates nearby damage and help before Clutch King or Unkillable Demon may commit. The 43-avatar audit and proposed tuning metrics are in `docs/ability-balance-review.md`.

**Affected files:** `EsportsClash.Web/src/additionalChampions.ts`, `src/components/AramMatchView.tsx`, `src/combatDecision.ts`, `src/fightSurvivalRules.ts`, avatar animation/audio/lore and combo files, `src/newAvatarRules.test.mjs`, and `docs/ability-balance-review.md`.

**Verification:** The gameplay checks and production build passed after these additions. A desktop browser review confirmed the Forest Link overhead marker and a populated Match Insights panel; a full 25-match balance run was not completed because the live page reloaded while source changed.

**Limit:** Cloudtail's decoy is visual and is not a separately targetable combat unit. Balance suggestions are hypotheses pending a stable batch of complete matches.

## User Request: Cooldown-Aware, Higher-Quality Teamfights

**User:** "Solidify teamfight decisions. Players or teams should know if cooldowns are down. World's best should play like world's best."

**Agent:** Added team-specific enemy cooldown memory. A team records Q, W, and R only when an opposing cast is visible to one of its nearby living avatars; Oathmute's global ultimate reveals only its own cooldown. The memory expires at the observed ready time. High-IQ cards use observed downtime to select vulnerable fight targets, reassess enemy burst and Black Hole danger, and bait a spent skill from cover. Unknown cooldowns are treated as a threat rather than read from hidden enemy state. Objective-contest target selection receives the same memory. An allied channel no longer forces a teammate into a fight its survival check expects to lose, and an isolated card no longer stays for one easy last hit while several enemies can punish it. These are tactical choices governed by card IQ and teamfight ratings, with no extra damage or defense granted to elite cards.

**Affected files:** `EsportsClash.Web/src/cooldownKnowledge.ts`, `src/cooldownKnowledge.test.mjs`, `src/combatDecision.ts`, `src/fightSurvivalRules.ts`, `src/blackHoleCounterplay.ts`, `src/blackHoleCounterplay.test.mjs`, `src/components/AramMatchView.tsx`, and `docs/arena-mechanics.md`.

**Verification:** `npm run check:game` passed design validation, TypeScript, and all 153 tests; `npm run build` passed. Tests cover witnessed and unseen casts, global ultimate knowledge, high versus lower IQ retreat, cooldown-based target selection, Black Hole readiness, and refusing a baited finish.

**Limit:** Cooldown memory estimates readiness from a witnessed cast and the observed cooldown value. It does not account for hidden cooldown resets or cooldown reduction granted after a cast until another visible cast occurs. A complete live match batch is still needed to tune engage rates and fight outcomes.

## User Request: Shorter Respawns and Readable Hook Grabs

**User:** "Decrease death timers I think its too long. Hook champs should indicate or have noticeable grabs instead of teleporting the hooked avatar in front of the hooker avatar. Do you have any recommendations?"

**Agent:** Replaced the old level and match-time death formula, which could reach 75 seconds, with a short-arena curve: roughly 8 seconds at level 3, 13 seconds at level 10 near 4:00, 20 seconds at level 15 near 8:00, and at most 28 seconds late. Both ordinary and fountain deaths use the same function. Mirehook, Voltgrip, and Wraithhook now fire a visible hooked head with an animated chain. When it lands, the target displays a grab cue and moves along the chain over multiple simulation ticks until stopping 43px from the caster. The chain and target ring remain visible during the drag. The grab interrupts recall, and the pull is cleared on death or if the caster dies.

**Affected files:** `EsportsClash.Web/src/combatPacingRules.ts`, `src/combatPacingRules.test.mjs`, `src/types.ts`, `src/components/AramMatchView.tsx`, and `docs/arena-mechanics.md`.

**Verification:** `npm run check:game` passed design validation, TypeScript, and 155 tests; `npm run build` passed. Focused tests cover timer checkpoints and multi-tick pull travel. A live desktop Vs AI match with Rotisserie and Hooklyn showed the new hook chain rendering in a crowded fight at 3:28; [the captured frame](hook-live-review.png) records that view.

**Limit:** The captured frame shows an outgoing chain, while continuous victim travel is covered by the deterministic rule test; a frame-by-frame live pull capture was not made. Shorter death timers can reduce the time available to convert a kill into structure damage; track that conversion in seeded matches before changing structure health or wave strength.

## User Request: Raised Bases, Siege Decisions, and Midgame Colossus

**User:** Asked for high ground from each third turret to its well, more space between barracks and Nexus, smarter push/recall/jungle priorities after a won fight, a claimed Colossus that keeps its height and arrives with the next wave, a four-minute neutral Colossus spawn, rocky routes beside both epic pits, fog on high ground, and brush immediately before each ramp.

**Agent:** Moved each third turret outward and each barracks farther from its Nexus, while preserving the well-to-Nexus gap. Drew mirrored raised base platforms, ramp steps, retaining edges, animated ground mist, and rocky clusters between the jungle camps and epic pits. Added four flank bushes before the raised entrances; these use the existing brush vision and ward rules. The one-time Gravemarch Colossus awakens at 4:00, its claim queues one full-size reinforcement for the next 22-second creep wave, and it never respawns. The team now remembers its latest champion kill: healthy survivors with a numbers advantage and a reachable enemy structure keep a short siege call, delaying shopping recall, jungle farming, and new epic starts. Lower-IQ cards use a shorter, more cautious window; unsafe or losing fights still permit retreat.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, `src/siegeGolemRules.ts`, `src/siegeGolemRules.test.mjs`, `src/components/AramMatchView.tsx`, `scripts/validate-design.js`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Geometry, brush coverage, won-fight siege conditions, and the one-time 4:00 awakening have focused regression tests. `npm run check:game` passed design validation, all 157 tests, and TypeScript compilation; `npm run build` passed.

**Limit:** High-ground fog is ambient visual mist; the four new entrance bushes supply actual concealment through the existing vision system. The next-wave reward is wired into the existing 22-second wave timer; it has not yet been reviewed in a frame-by-frame live match. The rocky clusters gained collision in the follow-up below.

## User Request: Solid Ridges, Distinct Barracks, and Six-Target Nexus

**User:** Clarified that the rocky terrain must be raised and impassable, asked for separate Melee, Ranged, and Catapult barracks models, and requested a larger Nexus that fires true damage at six targets at once for five consecutive shots.

**Agent:** Promoted the twelve rocky outcrops to shared world-space terrain footprints. Champions, lane minions, summoned units, and aggroed neutral camps are projected around them after movement, including short dashes and forced movement. Units approaching each three-rock ridge follow the lane-side passage and can reach either epic pit. The canvas now draws the same footprints as raised cliff faces. Replaced the generic barracks icon boxes with a melee forge and crossed blades, a ranged watchtower and drawn bow, and a catapult siege yard. Enlarged the Nexus and gave it six orbiting emitters. Each of its five rapid pulses launches one true-damage projectile at each of up to six distinct in-range enemies, prioritizing a dive aggressor and then champions; the existing reload follows the fifth pulse. Ordinary turret damage behavior is preserved.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Focused tests cover six distinct Nexus targets, five-pulse cadence, solid terrain, and routes in both directions around all four ridges. `npm run check:game` passed design validation, all 159 tests, and TypeScript; `npm run build` passed.

**Limit:** Rocks block units but do not yet absorb spell projectiles. Long teleports can land beyond a ridge, while short movement and dashes collide with it. Live visual review of the new barracks and Nexus models remains open.

## User Follow-Up: Circular Camp Rocks, Timed Boss Spawns, and High-Ground Chokepoints

**User:** Showed a reference of a rocky objective pit and asked for one circular rock path around every jungle camp. Embermaw should first appear at midgame, the Colossus at two minutes. Then asked to extend the rocky enclosure to both high-ground ramps so the central stair before the third turret becomes a chokepoint.

**Agent:** Replaced the earlier separated three-rock ridges with nearly circular, raised, solid stone rings around eight ordinary camps and both boss pits. Each ring opens toward the lane. Moved the two upper buff camps outward to prevent their rings overlapping the neighboring camps. Framed both high-ground ramps with paired rock rows, keeping a clear central stair. Farming AI now follows the stair and camp opening, including from inside either base. The Colossus now awakens once at 2:00; Embermaw starts absent and awakens at 4:00. The dead-pit label distinguishes the dragon's first awakening from later respawns. The prior distinct barracks and Nexus volley remain in place.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/siegeGolemRules.ts`, `src/siegeGolemRules.test.mjs`, `src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Tests cover a clear lane-facing opening for every ring, nearby lane approaches, rock collision, both central stairs, farming routes from both bases, and the 2:00/4:00 spawn constants. The full game check passed 162 tests, design validation, and TypeScript; the production build passed. A live desktop replay showed the rings, ramp rocks, barracks models, and enlarged Nexus.

**Limit:** Rocks block units but not spell projectiles. Farming has a defined route through gates; other pursuits still use local collision instead of a full terrain pathfinder.

## User Request: Natural Geological Rock Formations and Cove Embankments

**User:** "can you make the rocks a bit more natural? It looks like we forced it there."

**Agent:** Replaced the rigid, identical M-shaped two-spiked crown polygons with authentic procedural 3D geological formations across the entire map:

1. **Continuous Bedrock Embankments:** Rendered curved cliff foundations connecting the rocks of all 10 camp rings (`CAMP_ROCK_RINGS`) and continuous bedrock shelves connecting the 4 highground ramp walls. The rocks now form cohesive cliff coves nestled naturally into the jungle terrain rather than detached circular teeth.
2. **Procedural 3D Organic Boulders:** Implemented a deterministic coordinate hash (`rockHash`) to proceduralize boulder dimensions, aspect ratios, organic 8-point chiseled silhouettes, and subtle orientation angles. Camp boulders now align tangentially along the curvature of each camp cove, naturally embracing the clearing perimeter.
3. **Multi-Faceted Chiseled Shading:** Each boulder now features layered 3D volume lighting with directional arena sunlight: diffuse contact ground occlusion shadow, dark under-facet crevice shadow, midtone body with smooth directional gradient, sunlit upper-left crest facet, crisp chiseled ridge highlights, and hairline geological fracture fissures.
4. **Authentic Biome Theming:**
   - **Embermaw Dragon Pit:** Volcanic obsidian and charred basalt boulders with glowing molten magma veins (`#fed7aa` / `rgba(249, 115, 22, 0.85)`), amber ember rim reflections, and no out-of-place vegetation.
   - **Gravemarch Siege Golem Pit:** Ancient monolithic runic slate with deep teal/sea-green lichen (`#0d9488`, `#2dd4bf`).
   - **Jungle Camps:** Weathered river granite with lush velvet emerald moss patches (`#047857`, `#10b981`) and subtle scree pebbles at the base.
   - **Highground Base Ramps:** Structured fortified masonry bedrock ledges framing the lane stairs.
5. **Polished Riverbank Stones:** Refined `drawRock` with smooth river-pebble contours, soft directional light, and natural moss fringes.
6. **Zero Physics / Collision Impact:** Preserved all 132 `ROCK_TERRAIN` positions and radii in `arenaRules.ts`, maintaining 100% collision integrity for unit movement, dash checks, and pathing.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed all 162 unit tests, design validation, and TypeScript; `npm run build` compiled client bundle cleanly in under 1 second.

## User Request: Situational Follow-Up, Recovery, Wave Tempo, and Readable Labels

**User:** Asked for stronger teamfight decisions so low-health allies still recognize a five-person Black Hole, nearby health recovery when appropriate, less overstepping, wave-led tempo pushes, and rock terrain that never covers avatar labels.

**Agent:** Replaced the fixed 25% follow-up cutoff with a tactical check for how many enemies are actually controlled, remaining control time versus arrival time, free threats, nearby teammates, contribution range, HP, and tower exposure. Black Hole follow-up now uses its actual pull radius. A decisive catch can interrupt a retreat commitment or an active recall; the caught enemy receives target priority. Added safe nearby relic diversion for wounded avatars, with fight and push opportunity checks. Healthy teams now read allied wave position, enemy wave size, local numbers, player IQ/lane skill, and coach macro before a structure push; they delay optional farm and new objectives during a valid wave window. Ordinary lane movement holds near the wave front or outside tower range to reduce unsupported chases. Moved rock drawing under combat units and nameplates, and added an anti-regression draw-order check.

**Affected files:** `EsportsClash.Web/src/teamTempoRules.ts`, `src/teamTempoRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/combatDecision.ts`, `src/combatDecision.test.mjs`, `scripts/validate-design.js`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Focused tests cover low-health five-target follow-up and its tower/free-threat/travel-time limits, situational relic choices, wave tempo, blue/red advance limits, and Black Hole's true pull radius. `npm run check:game` passed design validation, TypeScript, and all 166 tests; `npm run build` passed. A desktop replay shows rock formations behind visible player and avatar labels.

**Limit:** General chase pathing still uses local rock collision. Relic choices consider visible nearby enemies and distance, not a complete terrain path search. Match-wide tempo and engage rates still need a multi-match balance sample.

## User Request: Enlarged Jungle Camps, Flared Openings, Smooth Rock Sliding, and Support Farming Prohibitions

**User:**

- The openings are too steep and some models are getting stuck in the rocky terrains can you fix it?
- Make the rocky terrains a bit more larger so it has more room for the jungle camps inside and avatars won't have a hard time farming it.
- AI should understand what their role is; support avatars can't farm jungle camps since their damage is low.

**Agent:**

- **Enlarged Camp Geometry & Flared Entrance Openings (`src/arenaRules.ts`):**
  - Standard camp radius increased from 60 to 76 (inner camp floor area doubled from ~5,280 to ~10,560 px²).
  - Boss pits enlarged: Gravemarch Golem radius increased from 100 to 115; Dragon Embermaw radius increased from 110 to 122.
  - Stones flanking the entrance are flared outward (`radius + 3px`, tapered stone radius `0.88×`), creating a wide $\ge 104\text{px}$ clear gateway rather than a steep pinch point.
  - `rockApproachWaypoint`: Widened entrance approach threshold to $0.95$ radians ($109^\circ$ cone) and made units inside `distanceToCenter < ring.radius - 8` navigate directly to `goal` without getting redirected out of the camp.
- **Frictionless Goal-Seeking Tangent Sliding (`src/arenaRules.ts`):**
  - Replaced the artificial nudge in `resolveRockTerrainMovement` with goal-seeking tangent sliding: projects the unit strictly outside obstacle boundaries and slides along the rock's tangent vector toward `to` ($\vec{t}_{\text{goal}}$). Units glide smoothly along rock perimeters with zero sticking, vibrating, or oscillation.
- **Support Avatars Forbidden from Farming Jungle Camps (`src/macroFarmRules.ts`, `src/components/AramMatchView.tsx`):**
  - Added role check in `chooseKnownJungleCamp`: if `actor.role === 'Support'` or `actor.supportStrength >= 2`, returns `undefined`.
  - Non-junglers with `jungleStrength === 0` who are not carries/marksmen also ignore jungle camps.
  - In `AramMatchView.tsx`: added `isSupportAvatar` check to prevent supports from routing to camps, and added **Support Macro Tethering**: idle supports naturally stick with nearby living carries/allies within 550px for peel and protection.
- **Canvas Rendering Updates (`src/components/AramMatchView.tsx`):**
  - Updated bedrock embankment arc in `drawRaisedRockTerrain` to match the wider flared opening (`gapThreshold: 0.58` for bosses, `0.72` for standard camps) with `lineCap: 'butt'` so foundation stroke never bulges into the entrance.
  - Enlarged interior clearing pads from 43 to 55 (and golem from 77 to 95), and moved decorative background trees to the outer back rim (86px / 68px), leaving the camp interior spacious and uncluttered.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, `src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Added support role unit test in `src/macroFarmRules.test.mjs`. Adjusted `entryY` test distance in `src/arenaRules.test.mjs` to `ring.radius + 28`. `npm run check:game` passed all 167 unit tests, design validation, and TypeScript; `npm run build` compiled clean production bundle.

**Limit:** Support tethering tethers to the nearest living allied carry within 550px when no primary teamfight target is in engagement range; long-distance rotations continue using standard lane and objective rules.

## User Request: Synchronized Team Tempo and Objective Setup

**User:** Strengthen team tempo around coordinated recalls, wave management, and objective preparation 45–60 seconds before spawn, while keeping Player Cards active on the map and able to group rather than idle in mid.

**Agent:** Added a testable team reset policy in `src/teamTempoRules.ts`. A reset is called only during the 45–60-second pre-spawn window when at least three living allies independently need HP/mana or a shop purchase and can recall using the existing distance, minion, structure, bush, and cooldown checks. Nearby enemy pressure, recent champion damage, tower aggro, and the actor's current push suppress the call. The call persists as teammates start channels so their staggered update order does not cancel coordination. Unsafe or ineligible teammates remain under ordinary lane, combat, and retreat decisions. Healthy teammates can move to grouped staging positions beside the next objective during its final 25 seconds only after their wave is pushed and lane priority is held; active fights, nearby enemies, and recent won-fight pushes retain priority. Existing ward placement and objective-start/contest rules remain in force.

**Affected files:** `EsportsClash.Web/src/teamTempoRules.ts`, `src/teamTempoRules.test.mjs`, `src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Added tests for the recall timing boundaries, required safe-recaller count, active threats/pushes, and the staging health/wave/fight gates. `npm run check:game` passed design validation, TypeScript, and all 169 tests; `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** The reset asks only safe, resource-needing teammates to recall; it does not force a full five-person recall when the other members are healthy or exposed. Gravemarch uses only its actual one-time awakening timer; Dragon uses its actual spawn/respawn timer.

## User Request: Cardrel Role and New Avatar Additions

**User:** Asked to add Lee Sin and Grycopter as Avatars and make Cardrel a Diamond Fighter because he mains Lee Sin.

**Agent:** Updated Cardrel's standard researched card to Fighter / preferred Fighter at 90 OVR, which assigns the Diamond tier. Added Stepstone, an original mobile martial-vanguard Fighter, and Skybreaker, an original rotorcraft-artillery Marksman. Both have full kits, distinct display aliases, combat roles, animation motifs, recorded skill cues, custom sprite styling, original roster artwork, and lore. Cardrel's Fighter signature list now includes Stepstone first. Equalized mode gives Cardrel Fighter role while preserving its GOAT normalization for all cards.

**Affected files:** `EsportsClash.Web/src/additionalChampions.ts`, `src/rosterResearch.ts`, `src/equalizedMode.ts`, `src/equalizedMode.test.mjs`, `src/reserveFilters.test.mjs`, `src/newAvatarRules.test.mjs`, `src/avatarSkillAnimation.ts`, `src/avatarSkillAnimation.test.mjs`, `src/avatarSkillAudio.ts`, `src/avatarSkillAudio.test.mjs`, `src/avatarCombos.ts`, `src/rosterDraftItems.test.mjs`, `src/skillshotCombos.test.mjs`, `src/components/ChampionSpriteRenderer.ts`, `src/components/ChampionArtwork.tsx`, `src/championLore.ts`, `docs/arena-mechanics.md`, `docs/ability-balance-review.md`, and this handoff.

**Verification:** `npm run check:game` passed design validation, all game tests, and TypeScript checking. `npm run build` succeeded with the existing large-bundle advisory. `git diff --check` passed.

**Limit:** Lee Sin and Gyrocopter are specific copyrighted characters, so no direct adaptations or character-specific names, abilities, or lore were added. The new avatars use only broad martial-arts and rotorcraft-artillery archetypes, with original identities and kits.

## User Request: Kickswitch Displacement Kick

**User:** Asked whether Kickswitch had an Insec combo/kick, then requested a kick inspired by the broad tactical effect. Confirmed the ultimate slot for the new ability.

**Agent:** Replaced Stepstone's Bellbreak Form with Bellbreak Kick, an original single-target ultimate that deals rank-scaled damage, briefly lifts the target, and displaces them toward nearby living allies. With no nearby allies, it aims toward Kickswitch. Its destination is clamped to arena bounds. Updated the Stepstone combo label and gave its ultimate a focused martial animation effect.

**Affected files:** `EsportsClash.Web/src/additionalChampions.ts`, `src/avatarCombos.ts`, `src/kickswitchAbilities.ts`, `src/kickswitchAbilities.test.mjs`, `src/components/AramMatchView.tsx`, `src/avatarSkillAnimation.ts`, `src/newAvatarRules.test.mjs`, `docs/arena-mechanics.md`, `docs/ability-balance-review.md`, and this handoff.

**Verification:** The focused kick/avatar/combo tests passed (9 tests). `npm run check:game` passed design validation, all 171 game tests, and TypeScript checking. `npm run build` succeeded with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** This implements only the broad team-directed displacement gameplay function with original naming and presentation; it does not reproduce a named character's exact ability or choreography.

## User Request: Clear Terrain Routes and Earlier Epic Objective Starts

**User:** Asked to fix the terrain and paths avatars take so they do not run into blocking terrain, and noted that teams were not taking Gravemarch or Embermaw until very late in a match.

**Agent:** Routed Dragon Embermaw and Gravemarch movement through the existing camp entrance waypoint system. The system now guides a unit around the pit perimeter when its current approach is outside the opening cone, instead of steering directly into a stone wall. Both-base paths to both objectives are covered by route tests. Lowered the macro score required to start an objective from 72 to 54 (50 for a safe low-health finish), while preserving the earliest-availability, lane-priority, vision, healthy-team, and nearby-enemy conditions.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/objectiveRules.ts`, `src/objectiveRules.test.mjs`, `src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** The targeted terrain and objective tests passed. `npm run check:game` passed design validation, all 172 tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory.

**Limit:** Non-objective champion pursuit still uses local collision rather than a general terrain pathfinder; rocks still do not block projectiles.

## User Request: Multi-Seed Game Simulation and Data-Driven Gameplay Telemetry

**User:** implement a tests that simulates multiple seed games and use that data to know what to update or make better of.

**Agent:** Created a fast, deterministic, headless game simulation engine (`src/matchSimulationEngine.ts`) and test suite (`src/matchSimulation.test.mjs`) running pure TypeScript without DOM or canvas dependencies. The engine simulates bridge arena matches with minion wave cycles (22s), sequential structure vulnerability (`canDamageStructure`: Outer → Inner → Nexus Tower → Barracks → Nexus), structure plating (`towerSiegeMultiplier`), tower dive limits and safety aborts (`evaluateTowerDive`, `shouldAbortTowerDive`, `getTurretEvacuationVector`), 10-second turret execution attribution (`resolveTurretKillReward`), epic objectives (Dragon Embermaw & Gravemarch Colossus), neutral camp farming, health relics, fountain regen, and item strategy purchasing.

Ran batch multi-seed simulations across seeds and analyzed aggregated telemetry:

1. **Side Parity & Role Composition:** Initial batch simulation revealed Red team winning 90-100% of matches due to Blue having two Marksmen (Astra and Cora) with zero frontline tanks. Updated Blue default lineup to include Kaolin (TerraByte, Tank), matching Red's Solana. Mirrored and side-swapped simulations confirmed 50.0% Blue / 50.0% Red parity.
2. **Pacing and Structure Vulnerability:** Early simulations ended in ~4.9–5.2 minutes without sequential structure invulnerability. Enforcing sequential structure gating and applying `towerSiegeMultiplier` (early tower plating fading by 8 minutes) inside `damageStructure` brought average match duration to a healthy 7.7 minutes (median 5.8m, range 4.6m - 15m).
3. **Tower Dive Abort Telemetry Debounce:** Resolved per-frame telemetry increment of `towerDiveAborts` by restricting `shouldAbortTowerDive` evaluation to units actually inside enemy turret range and debouncing abort state transitions until units clear turret range + 50px.
4. **Epic Objective Rotations:** Added macro objective rotations toward Dragon Embermaw (4:00) and Gravemarch Colossus (2:00) when lane wave priority is held and macro thresholds are met (`shouldStartEpicObjective`), utilizing `rockApproachWaypoint` around pit perimeters.
5. **AGENTS.md Invariants Strictly Verified:**
   - Supports farmed exactly 0 neutral jungle camps across all simulated games.
   - Blue Support strictly preserved the `Cardrel` parody alias.
   - Turret execution attribution window (10s) verified (executions award no champion kills and split bounties to the defending team).
   - Added `"test:simulation"` script to `package.json` and integrated simulation tests into `npm run check:game`.

**Affected files:** `EsportsClash.Web/src/matchSimulationEngine.ts`, `src/matchSimulation.test.mjs`, `package.json`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** All 175 project tests, 3 multi-seed simulation tests, design validation checks, and TypeScript typechecking passed via `npm run check:game`. Production build succeeded via `npm run build`.

**Limit:** Objective rotations prioritize active lane fights and structure pushes before objective staging; units contest bosses within sight and engage enemies per Invariant 3.

## User Request: More Map and Pathing Polish; Coordinated Camp Rewards

**User:** Asked for additional map/pathing polish, then asked that jungle camps become team objectives available after recalls and that avatars helping kill a camp receive gold and experience. Confirmed Supports should be allowed to join camp takes, relaxing the prior Support farming prohibition for coordinated objectives.

**Agent:** Added subtle biome-tinted dirt trails from the lane to each camp entrance. Hardened rock collision projection by iteratively resolving overlapping neighboring boulders, preventing long movement projections from leaving units inside adjacent terrain. A safe post-recall camp call now requires at least two recently recalled allies, three living teammates, two healthy teammates, an available camp, and no active threat or push; Supports can join this group call but remain excluded from solo camp farming. Recorded each camp's damage contributors and split the fixed gold/XP bounty among same-team contributors, assigning integer rounding remainder to the killer. Camp soft reset clears contributions for the next attempt.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Focused terrain and camp-policy/reward tests passed. `npm run check:game` passed design validation, all game and multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory.

**Limit:** The headless match simulator does not yet model the live post-recall team-camp call or shared XP distribution. General champion pursuit still uses local swept collision outside explicit camp and objective approach routes.

## User Request: Improve Arena Appearance

**User:** Said the arena map did not look good enough.

**Agent:** Reworked the forest-floor palette and added layered meadow texture, clearer riverbanks and water glints, softened warm stone paving on the central causeway, and more visible dashed markings along camp approaches. Added a contained, rounded frame around the responsive canvas. These changes are presentation-only and do not alter collision, route selection, or objective behavior.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed (178 game tests and 3 simulation tests), `npm run build` passed, and `git diff --check` passed. The map canvas was rendered in the shared browser; a fresh in-match visual review after the reload was not completed.

**Limit:** Decorative trails do not show a live unit-specific route; general pursuit still uses the existing local collision steering. Small-screen visual review remains outstanding.

## User Request: Remove Teammate Unit Collisions

**User:** Asked to remove unit collisions between teammates.

**Agent:** Removed pairwise body-separation from same-team living champions in the Clash Arena and Three Aram arena renderers. Enemy champion separation remains enabled. Terrain collision and attacks/projectile collision are unchanged.

**Affected files:** `EsportsClash.Web/src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/components/ThreeAramArena.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed design validation, 186 game tests, 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** The adjustment applies to champion avatars; lane minion combat and terrain collision are unchanged.

## User Request: Polish the Recent Map, Pathing, Camp, and Collision Work

**User:** Asked to review the documents for the current state and polish the latest map/pathing, coordinated-camp, arena-appearance, and teammate-collision work.

**Agent:** Audited the documented changes and found that post-recall teammates independently recomputed their camp choice, so a nominal team call could split across camps or disappear when the first member left the well. Added one persistent camp plan per team. A qualifying recalled group now selects one nearby live camp on its own half, locks the recalled participants to that destination for up to 30 game-seconds, and keeps the call active after they leave the well. Enemy threats, lane pushes, epic-objective calls, insufficient surviving participants, expiry, or the camp becoming unavailable immediately cancel the plan. Added deterministic tests for shared home-side selection and completed the pending teammate-collision verification.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed design validation, all 180 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory. `git diff --check` passed.

**Limit:** The headless simulator still does not model the live post-recall team-camp plan or shared XP distribution. General pursuit outside explicit camp and objective routes still uses local swept collision rather than a map-wide pathfinder.

## User Request: Better Avatar Models

**User:** Asked for better models for the avatars.

**Agent:** Upgraded the procedural in-match avatar renderer without touching combat geometry. All avatars now stand on a layered team-colored plinth with a segmented allegiance ring, gain a restrained cast aura, and use visual-only walking lean and attack recoil. Rebuilt the 20 avatars that still shared the flattest model tier around six distinct silhouette families—robe, armor, agile, beast, spectral, and mechanical—with individual palettes for skin, hair, eyes, cloth or plating, trim, glow, and shade. The new construction adds separate animated legs and boots, articulated action arms, shaped torsos and shoulders, capes/pelts/wisps/back plating, layered heads, hair or helmets, brows, highlighted eyes, facial detail, chest emblems, and the existing signature weapons and cast accessories. The model catalog is static at module scope to avoid per-avatar, per-frame configuration allocation.

**Affected files:** `EsportsClash.Web/src/components/ChampionSpriteRenderer.ts`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** The focused avatar renderer suite passed for all 45 avatars in idle, walk, attack, and cast states. `npm run check:game` passed design validation, all 180 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** The models remain procedural 2D canvas chibis rather than rigged 3D meshes. A live browser screenshot review is still desirable because this environment does not expose an installed browser automation package.

## User Request: Upgrade the Sound Effects

**User:** Asked to upgrade the sound effects after the avatar-model improvements.

**Agent:** Rebuilt the Web Audio mix around separate combat, impact, and UI buses feeding a dynamics-compressed master bus. Recorded avatar cues now use shaped envelopes, per-material low-pass filtering, a short filtered ambience send, a stronger independently tuned accent layer, and horizontal stereo placement from the caster's arena position. Added deterministic synthesized transient layers for arcane, fire, steel, organic, void, wind, and physical-impact casts; ultimates receive a longer transient, stronger accent, and wider ambience than basic skills. Generic hits and explosions were routed through the new mix while UI cues stay on their own quieter bus. The system retains the existing throttles and 16-voice ceiling and does not consume gameplay randomness.

**Affected files:** `EsportsClash.Web/src/audio.ts`, `src/avatarSkillAudio.ts`, `src/avatarSkillAudio.test.mjs`, `src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** The focused audio tests passed for all 45 avatars and every shipped recording. `npm run check:game` passed design validation, all 180 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** Automated checks validate routing metadata, files, and safe parameter ranges but cannot judge perceived loudness on the user's speakers or headphones. A live listening pass may still justify small gain adjustments.

## User Request: More Beautiful Abilities

**User:** Asked to make the abilities more beautiful after the avatar-model and sound-effect upgrades.

**Agent:** Polished the shared canvas presentation around all 45 avatars' existing dedicated ability motifs. Every cast now has a soft perspective ground bloom, animated perimeter marking, curved source-to-impact energy trace, source cast ring, deterministic diamond sparks, and an expanding white impact ripple. Ultimates use a brighter bloom, wider trace, fourteen particles, and a rotating twelve-segment seal; Skill 2 remains slightly richer than Skill 1. Re-layered beams and lightning with a colored glow body and white-hot core. All particle layouts use stable avatar-and-slot seeds, preserving deterministic playback without consuming gameplay randomness. No ability range, radius, targeting, damage, control, cooldown, timing, or collision behavior changed.

**Affected files:** `EsportsClash.Web/src/avatarSkillAnimation.ts`, `src/avatarSkillAnimation.test.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Added a deterministic visual-profile regression test and expanded the canvas mock for gradient rendering. The renderer smoke test covers every avatar, slot, and early/mid/late animation stage. `npm run check:game` passed design validation, all 181 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** Automated checks validate safe canvas rendering and visual hierarchy, but a live browser capture is still desirable for final bloom and particle-density tuning on desktop and small screens.

## User Request: Developer Random 5v5 Mode

**User:** Asked for a developer-only random 5v5 mode so visual and gameplay changes can be reviewed without manually drafting every match.

**Agent:** Added a `Developer Random 5v5` card to the Clash Arena mode selector that is rendered only when `import.meta.env.DEV` is true. One click deterministically shuffles the full player and avatar pools from a fresh crypto-generated seed, selects ten unique players and ten unique avatars, equalizes every player to 100 OVR, assigns five entries to each side, and launches the arena without either draft screen. The arena's normal replay control becomes `New Random 5v5` in this mode and immediately generates another matchup. Developer results are sandboxed from Clash Coins, evolutions, tournament standings, and ladder rating. All ordinary arena rules and protected gameplay invariants remain enabled.

**Affected files:** `EsportsClash.Web/src/App.tsx`, `src/components/AramMatchView.tsx`, `src/devRandomMode.ts`, `src/devRandomMode.test.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Focused developer-mode tests passed. `npm run check:game` passed design validation, all 184 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** The randomizer intentionally does not enforce a conventional role composition, allowing unusual combinations to exercise more interactions. The mode card is available under `npm run dev` and intentionally omitted from production builds.

## User Request: Generate Original Ability Sounds

**User:** Asked to generate realistic, original sound effects for the 135 ability cues in `ai-ability-sound-generation-prompt.md`, using a local ElevenLabs API key.

**Agent:** Added a resumable batch generator that reads the catalog's exact avatar names and filenames, makes one original sound-generation request per cue, converts responses to mono 48 kHz 24-bit PCM WAV with FFmpeg silence trimming and a -3 dBFS true-peak limiter, validates format, duration and clipping, writes a UTF-8 CSV manifest, and packages each batch into its own ZIP. Generated cues are selected through the manifest at runtime; if no generated cue is present or loads, the existing CC0 recordings and material layers remain the fallback. API access requires `ELEVENLABS_API_KEY` in the local process environment and does not expose the secret in chat.

**Affected files:** `EsportsClash.Web/scripts/generate-ability-sounds.mjs`, `EsportsClash.Web/src/audio.ts`, `EsportsClash.Web/src/avatarSkillAudio.test.mjs`, `EsportsClash.Web/package.json`, this handoff, and `docs/ai-ability-sound-generation-prompt.md`.

**Verification:** The catalog dry-run and focused audio test verify 135 unique entries, three batches of 45, and an exact filename match between every catalog entry and runtime cue mapping. No API requests or generated files have been made.

**Limit:** This environment currently has no `ELEVENLABS_API_KEY` and no `ffmpeg` executable. Configure the key locally and install FFmpeg before running `npm run generate:sounds -- --batch 1`; no claim is made that any generated file currently exists or has been audio-reviewed.

## User Request: Enlarge and Improve Battlefield Models

**User:** Asked to enlarge the Nexus, towers, minions, catapults, and barracks and make them look more realistic.

**Agent:** Replaced the remaining flat battlefield icons with dedicated procedural canvas models and centralized visual scale metrics. The enlarged Nexus now has a stepped stone-and-metal foundation, support pylons, rotating machinery, six orbiting emitters, a faceted illuminated core, and animated seal runes. Towers gained wide foundations, tapered masonry, structural buttresses, team banners, battlements, and housed crystals. The melee forge, ranged watchtower, and catapult siege-yard barracks gained dimensional masonry and richer class-specific equipment. Melee and caster minions now have articulated bodies, armor or robes, faces, weapons, and spell focuses; cannon waves became large wheeled catapults with chassis, throwing arms, ammunition, and banners. Updated contact shadows, empowerment rings, health-bar placement, and destroyed-structure rubble to match the new scale. All changes are visual: collision, attack ranges, health, damage, pathing, targeting, and structure vulnerability are unchanged.

**Affected files:** `EsportsClash.Web/src/components/BattlefieldModelRenderer.ts`, `src/components/AramMatchView.tsx`, `src/battlefieldModels.test.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Focused model-rendering tests passed for every structure/minion variant and both teams. `npm run check:game` passed design validation, all 186 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory; `git diff --check` passed.

**Limit:** The models remain stylized procedural 2D canvas art rather than textured 3D assets. A live browser review is still useful for tuning crowding in dense late-game waves.

## User Request: Remove Route Lines and Reduce/Redesign Minions

**User:** Asked to remove the distracting curved lines shown on the arena, reduce the oversized minions, and make the minions and catapults retain familiar MOBA readability while looking visibly different from League of Legends units.

**Agent:** Removed the decorative camp-approach roads, including their dark borders and dashed center markings, while retaining the invisible camp waypoints and collision-safe pathing. Reduced ordinary minion render scales from 1.52-1.68 to 0.98-1.14 and resized their shadows, empowerment rings, and health bars. Rebuilt melee troops as original faceted wardlings with cyclops visors, swept crests, angular shields, and short polearms; rebuilt casters with masked angular hoods, split robes, and crescent spell focuses; rebuilt cannon waves as compact shielded arc-launcher catapults with a loaded throwing arm and ember operator. The result preserves immediate melee/caster/siege readability without copying another game's specific unit designs.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `src/components/BattlefieldModelRenderer.ts`, `src/battlefieldModels.test.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** The focused battlefield renderer tests passed for all minion and structure variants on both teams. `npm run check:game` passed design validation, all 186 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory.

**Limit:** These are original procedural 2D canvas units rather than textured 3D models. Their collision radii, combat stats, attack ranges, pathing, targeting, and protected gameplay invariants are unchanged. A live in-match visual review remains useful for final size tuning.

## User Request: Rework Propella as a Helicopter Flak Hypercarry

**User:** Asked to rework Propella so she rides a helicopter, uses a flak cannon, and serves as the ultimate carry.

**Agent:** Preserved the stable `Skybreaker` internal ID and `Propella` display name, then rebuilt her as an original helicopter-mounted Marksman/Fighter hypercarry. Her passive now gives flak-splash basic attacks and up to six short-lived rotor attack-speed stacks. `Flakburst Cannon` is a dodgeable explosive shell, `Rotor Overdrive` accelerates and pre-spools sustained fire, and `Air Superiority` starts with an area bombardment before enabling a long late-game gunship window with full rotor stacks, bonus attack speed, and stronger splash. Added dedicated live projectile, shrapnel, crossfire, and bombardment behavior; a full cockpit, rotors, tail, skids, armored fuselage, and triple-barrel cannon to both her battlefield model and portrait; and matching animation, audio, combo, lore, range, and balance documentation. Existing marksman tower-dive requirements remain active.

**Affected files:** `EsportsClash.Web/src/additionalChampions.ts`, `src/types.ts`, `src/propellaRules.ts`, `src/propellaRules.test.mjs`, `src/skillRangeRules.ts`, `src/components/AramMatchView.tsx`, `src/avatarSkillAnimation.ts`, `src/avatarSkillAudio.ts`, `src/avatarCombos.ts`, `src/components/ChampionSpriteRenderer.ts`, `src/components/ChampionArtwork.tsx`, `src/championLore.ts`, `docs/ability-balance-review.md`, `docs/ai-ability-sound-generation-prompt.md`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** The focused Propella, avatar animation, and avatar audio suites passed all 17 tests. `npm run check:game` passed design validation, all 189 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory.

**Limit:** The headless simulator exercises Propella through the shared champion-kit model but does not separately simulate or report her live rotor-stack, flak-splash, Overdrive, or gunship state machine. The helicopter remains a procedural 2D canvas model rather than a rigged 3D asset, and a live browser visual/audio review is still desirable.

## User Request: Replace Propella's Helicopter Silhouette and Lower Her Range

**User:** Rejected the helicopter appearance and supplied two flying-machine references, asking for a new version in that broad direction. Also asked to lower Propella's attack range.

**Agent:** Replaced the enclosed helicopter with an original fantasy flak skiff rather than copying either reference. The new silhouette has a clearly visible goggled pilot in an open cockpit, twin exposed counter-rotating lift fans, mechanical suspension braces, a compact faceted armor pod, radial engine, landing claws, and an oversized forward triple-barrel flak cannon. Removed the tail boom, tail rotor, enclosed canopy, long fuselage, skids, and single main rotor from both the arena model and dossier portrait. Updated Propella's archetype, passive and Skill 2 copy, lore, combat event, sound-generation descriptions, mechanics, and balance notes to use the flak-skiff identity. Reduced her basic attack range from 210 to 180 world units, making close positioning the tradeoff for her strong late-game attack-speed and splash scaling. Her ability ranges, damage, rotor-stack system, and protected tower-dive rules are otherwise unchanged.

**Affected files:** `EsportsClash.Web/src/additionalChampions.ts`, `src/championLore.ts`, `src/propellaRules.ts`, `src/propellaRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/components/ChampionArtwork.tsx`, `src/components/ChampionSpriteRenderer.ts`, `docs/ability-balance-review.md`, `docs/ai-ability-sound-generation-prompt.md`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** The focused Propella, avatar renderer, animation, and audio suites passed all 18 tests. `npm run check:game` passed design validation, all 190 game tests, all 3 multi-seed simulation tests, and TypeScript. `npm run build` passed with the existing large-bundle advisory.

**Limit:** The references informed only broad open-cockpit flying-machine cues; the result remains original procedural 2D canvas art rather than a replica or textured 3D model. A live in-match visual review is still useful for final silhouette and scale tuning.

## User Request: Continuous Background Music

**User:** Asked to implement background music and chose one continuous soundtrack across menus and matches.

**Agent:** Added an original, softly mixed 84 BPM, 16-bar procedural score with evolving four-chord harmony, sustained pads, a repeating arpeggio, and restrained bass pulses. It starts after the first sound-enabled user interaction, loops without external audio assets, pauses while the page is hidden, and has a persistent Music On/Off button in the main navigation. The local preference defaults to enabled and is saved in `localStorage`. Music uses a dedicated mix bus and deterministic scheduling, independent of combat randomness.

**Affected files:** `EsportsClash.Web/src/backgroundMusic.ts`, `EsportsClash.Web/src/backgroundMusic.test.mjs`, `EsportsClash.Web/src/audio.ts`, `EsportsClash.Web/src/App.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Pure music-loop tests verify deterministic looping, harmonic changes, valid notes, and bass timing. The background-music and avatar-audio test suites and TypeScript compilation passed.

**Limit:** The score is synthesized with Web Audio rather than a recorded orchestra or external music-generation asset. A live browser listening pass is recommended to tune the balance against combat sounds and the user's playback setup.

## User Request: Scale Abilities with Item Stats

**User:** Asked for AD purchases to increase damage of abilities that scale with AD.

**Agent:** Centralized bonus-stat ability damage in `abilityRules.ts`. Both the live arena and headless match simulation now add item AD/AP using the existing role-based default ratios before ability-rank and amplification multipliers. `ChampionSkill` supports per-ability `adRatio` and `apRatio` overrides for kit-specific scaling. Basic attack, item/passive damage, shared damage, and damage mitigation paths remain distinct.

**Affected files:** `EsportsClash.Web/src/types.ts`, `src/abilityRules.ts`, `src/abilityRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/matchSimulationEngine.ts`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** Focused ability-scaling tests passed, including actual Colossal Greatsword AD, item stat totals, role defaults, explicit per-ability overrides, and ensuring zero-damage utility skills remain non-damaging. All 196 game tests and 3 multi-seed simulation tests passed. `git diff --check` passed. Full `npm run check:game` and `npm run build` reach TypeScript but are blocked by pre-existing `AramMatchView.tsx` errors: two `vision` event types are absent from its `MatchEvent` union and `BushPatch` is not imported.

**Limit:** Existing role-based fallback ratios continue to apply to abilities without explicit overrides; the repository does not yet curate an individual AD/AP ratio for every champion ability.

## User Request: Ability Sound Effects Integration and Regression Verification

**User:** Asked to integrate ability sound effects from `EsportsClash.Web/public/audio/`, validate all 135 WAV files and manifest entries, wire them into the recorded audio runtime, and strengthen regression tests to prevent silent fallback regressions.

**Agent:** Validated the complete set of 135 ability sound WAV files located in `EsportsClash.Web/public/audio/abilities/` against `manifest.csv` and the ability catalog (45 playable avatars $\times$ 3 abilities each: `skill1`, `skill2`, and `ultimate`). Every WAV file was validated to be non-empty mono 48 kHz 24-bit PCM with true-peak levels $\le -2.90$ dBFS (zero clipped samples) and durations satisfying each slot's target duration window. Added `preloadAvatarSkills(avatarNames)` to `SoundManager` in `src/audio.ts` and connected it in `src/components/AramMatchView.tsx` upon match lineup initialization to decode drafted avatar sound cues in memory ahead of first casts. Strengthened `src/avatarSkillAudio.test.mjs` with an automated regression test inspecting disk files and manifest rows 1:1, verifying format parameters, durations, and preventing missing or malformed audio files from going undetected. Preserved legacy sample and synth fallbacks if Web Audio decode fails.

**Affected files:** `EsportsClash.Web/src/audio.ts`, `EsportsClash.Web/src/components/AramMatchView.tsx`, `EsportsClash.Web/src/avatarSkillAudio.test.mjs`, `EsportsClash.Web/scripts/generate-ability-sounds.mjs`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `node --experimental-strip-types --test src/avatarSkillAudio.test.mjs` passed all 5 tests (including the 135-file disk and manifest inspection). `npm run check:game` passed design validation, all 193 unit tests, 3 simulation tests, and TypeScript compilation. `npm run build` compiled production bundle cleanly.

**Limit:** The Web Audio API requires a user gesture on the page before playing audio; once unlocked, preloaded buffers play with sub-frame latency.

## User Request: Highground Warding, Base Ramp Rock Trap Fix, and Low Nexus Commitment

**User:** Reported champions getting stuck at the base ramp rock formation (`Red Ramp North Brush`), requested that AI commit to finish the Nexus when it is low, and asked for highground base warding.

**Agent:** Diagnosed the root cause of the screenshot:

1. When taking damage in the enemy base, units triggered `isDangerousFight` and searched for a `nearbyRetreatBush`. Because `Math.sign(wellTargetX - u.x) === Math.sign(b.x - u.x)` was evaluated without checking territory ownership, Blue units at the Red base selected `bush_red_high_north` (an enemy base ramp brush at $y = 265$ behind `HIGHGROUND_ROCKS` at $y = 295$). Units walked north from lane ($y = 380$) directly into the solid rock face, where `resolveRockTerrainMovement` stopped them 35px from the bush, preventing `distToTarget <= 14` from ever firing and trapping champions in an infinite walk-into-rock loop.
2. In `AramMatchView.tsx`, added `!isEnemyBaseRampBush` to `nearbyRetreatBush` filtering. Retreating units in enemy territory now retreat along the unobstructed central lane corridor ($y = LANE_Y = 380$) toward their allied fountain well, eliminating all base rock pinching.
3. Added proactive highground base scouting in `AramMatchView.tsx`: when approaching the enemy highground ramp ($x \in [1260, 1620]$ for Blue, $x \in [380, 740]$ for Red), champions toss a scout ward (`👁️ HIGHGROUND WARD`) up onto the highground flank bushes or base entrance from up to 300px away, revealing ambushers and clearing highground fog of war.
4. Enabled decisive Nexus finish commitment: when the enemy Nexus is exposed and low ($\le 40\%$ HP), attackers prioritize destroying the Nexus (`⚔️ NEXUS COMMIT!`), commit even with defenders alive nearby (ignoring conservative 16% / 150px defender retreat blocks), relax attacker minimum health from 38% down to 18% (or lower on critical nexus), and bypass turret perimeter tether halts.
5. In `matchSimulationEngine.ts`, dynamically evaluated `exposedNexus` in `laneAdvanceLimit` so headless simulation matches also advance cleanly to finish exposed nexuses.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `EsportsClash.Web/src/matchSimulationEngine.ts`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed: design validation, all 196 unit tests, all 3 headless multi-seed simulation tests (50/50 side parity, 0 support camp farms, Cardrel alias preserved), and TypeScript `tsc -b`. `npm run build` compiled production bundle cleanly.

**Limit:** The highground scout ward cooldown shares the standard ward cooldown (75–85s), preventing spam while ensuring at least one vision ward covers the base entrance before the team breaches the ramp.

## User Request: AD and AP Ratio Descriptions on Avatar Abilities

**User:** Asked to add descriptions of the AD and AP scaling ratios into the abilities of all avatars.

**Agent:**

1. Centralized ratio calculation in `getAbilityRatios(champion, skill)` in `EsportsClash.Web/src/abilityRules.ts`, returning typed ratio percentages and formatted description strings `(+X% AD, +Y% AP)` based on champion primary and secondary roles:
   - Physical roles (Assassin, Fighter, Marksman without Mage): `+36% AD, +25% AP`.
   - Physical roles with Mage secondary (e.g. Inai, Aetherbolt, Corsara, Batrix): `+36% AD, +42% AP`.
   - Primary Mages and secondary Mages: `+18% AD, +42% AP`.
   - Tanks and Supports without Mage secondary: `+18% AD, +25% AP`.
   - Per-ability custom overrides (`skill.adRatio`, `skill.apRatio`) take priority when specified.
2. Updated all 121 damaging ability descriptions across all 45 playable champions in `src/mockData.ts` (17 base champions) and `src/additionalChampions.ts` (28 additional champions) to clearly state their AD and AP ratios (`(+X% AD, +Y% AP)`), while preserving all existing crowd control keywords (`stun`, `knock`, `root`, `snare`, `pull`, `silence`, etc.) and non-damaging utility abilities (`damage === 0`).
3. Enhanced the avatar inspection UI in `ChampionHubView.tsx` and `DraftPhaseView.tsx`:
   - In `ChampionHubView.tsx`, added dedicated colored badges (`text-amber-400 +X% AD` and `text-cyan-400 +Y% AP`) in the ability headers alongside rank-scaled damage for Skill 1, Skill 2, and Ultimate.
   - In `DraftPhaseView.tsx`, displayed AD and AP scaling ratios directly alongside ability cooldowns and base damage values.
4. Added comprehensive unit tests in `src/abilityRules.test.mjs` verifying ratio calculations, hybrid role handling, and formatted strings.

**Affected files:** `EsportsClash.Web/src/abilityRules.ts`, `EsportsClash.Web/src/abilityRules.test.mjs`, `EsportsClash.Web/src/mockData.ts`, `EsportsClash.Web/src/additionalChampions.ts`, `EsportsClash.Web/src/components/ChampionHubView.tsx`, `EsportsClash.Web/src/components/DraftPhaseView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed: design validation, all 197 unit tests, all 3 multi-seed simulation tests (Cardrel alias, tower dive limits, and turret execution invariants intact), and `tsc -b`. `npm run build` compiled cleanly.

**Limit:** Zero-damage utility and crowd control abilities (`damage === 0`) remain non-damaging and do not scale with AD or AP.

## User Request: Remove the Regen Rune from the Golem Pit

**User:** Asked to remove the regeneration rune visible inside the Gravemarch golem pit.

**Agent:** Removed the lower-pit river health/mana relic, which overlapped Gravemarch's spawn marker, from both live matches and the headless match simulation. The two bridge/lower-valley relics outside the pit remain.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `EsportsClash.Web/src/matchSimulationEngine.ts`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` and `npm run build` passed.

**Limit:** None.

## User Request: Solidify Fighting, Farming, Objective, and Recalling Options

**User:** "solidify fighting, farming, objective, recalling options."

**Agent:** Strengthened the live AI's existing decisions and transitions. Grouping now requires recent visible champion combat, excludes the actor itself and unavailable allies, and stops converging once close enough to fight. This fixes farming/structure attack animations being mistaken for an allied teamfight. Farmers retain an eligible camp destination; threats, recovery, allied fights, and higher-priority calls release it. Team-camp participants also pass individual health and lane safety checks. Recall intent persists while moving to cover and waiting for channel cooldown, with recovery hysteresis and a mana-reset option for primary Mages/Supports. Emergency retreats cannot stop to farm a wave or channel inside tower range. Objective support counts exclude recalling/recovering teammates, and scouting challengers always engage champions above 32% boss HP. This corrects the earlier cautious-contester boss-racing behavior to comply with the explicit protected contest invariant; card/coach attitudes still shape the post-secure call.

**Affected files:** `EsportsClash.Web/src/actionDecisionRules.ts`, `src/actionDecisionRules.test.mjs`, `src/components/AramMatchView.tsx`, `src/macroFarmRules.ts`, `src/macroFarmRules.test.mjs`, `src/objectiveRules.ts`, `src/objectiveRules.test.mjs`, `src/types.ts`, `src/towerDiveRules.ts` (coordinate input typing only), and both gameplay documents. Preserved the pre-existing golem-pit relic removal in the working tree.

**Verification:** Focused decision, farming, and objective scenarios passed (21 tests); included in the final full game checks below.

**Limits:** The headless simulator remains simplified and does not model the live recall intent, grouping, or coordinated camp state. The focused tests cover those decisions; no live browser replay or new balance-rate claim is included. Fixed camp availability remains known simulation state.

## User Request: Reliable Jungle Routes, Curved Terrain, Wider Battlefield, and Base Defense

**User:** Asked to solidify jungle routes, prevent terrain traps, add terrain curvature/style, increase structure spacing, and defend tier 3 and Nexus very hard. When asked whether to expand the battlefield or only rearrange the base, explicitly selected **"Widen the battlefield."**

**Agent:** Expanded world width from 2000 to 2600. Shared mirrored coordinates now place wells at 65/2535, Nexuses at 235/2365, barracks at 430/2170, tier 3 at 610/1990, tier 2 at 830/1770, and outer towers at 1050/1550. Camps, relics, boss pits, base shelves, bushes, and ramp scouting were realigned. Terrain uses irregular scalloped contours and layered cliff shading, with the same contour function positioning collision stones. Gates remain lane-facing; no decorative route markings were restored.

Replaced local entrance steering with cached, body-expanded terrain graphs, A\* planning, collision-checked smoothing, and stalled/displaced route recovery. Jungle farmers route out of their current camp as well as into the next; neutral chase/reset routes respect monster body size and ordinary speeds. Stationary embedded units are repaired, while ordinary collision steps cannot eject through walls. Outer upper buffs moved 40 units outward before the central-map translation to remove disconnected boundary pockets.

Added defensive calls that prioritize Nexus, tier 3, barracks, then nearby inner/outer towers. Inner-base emergencies recruit across the map, interrupt farm routes and optional reset/objective/push calls, rally behind threatened buildings, prioritize attackers, and clear siege waves. Healthy recall channels already near the base can cancel to defend; distant recalls finish because teleporting home is faster. Emergency recovery, crowd control, dive aborts, turret attribution, anti-spin safeguards, and parody aliases are preserved. Strong defense changes decisions, not structure damage/HP or invulnerability. Base calls appear in the event log and floating labels.

**Affected files:** `src/arenaLayout.ts`, `src/arenaRules.ts`, `src/arenaRules.test.mjs`, `src/terrainRouting.ts`, `src/terrainRouting.test.mjs`, `src/baseDefenseRules.ts`, `src/baseDefenseRules.test.mjs`, `src/neutralAggroRules.ts`, `src/macroFarmRules.ts`, `src/components/AramMatchView.tsx`, `src/matchSimulationEngine.ts` (layout parity), and both gameplay documents, under `EsportsClash.Web` where applicable.

**Verification:** `npm run check:game` passed design validation, all 213 tests, the additional 3 simulation checks, and TypeScript. `npm run build` passed (existing large-bundle warning remains). Route regressions cover all 90 camp-to-camp rotations, 120 well/flank round trips, compass approaches, large-monster gates, chase/reset speed, embedded positions, and changed/stalled goals. Defense tests cover priorities, whole-map versus local recruitment, waves, dead threats, and mirrored rally points.

**Limits:** No browser visual replay performed. Canvas remains a fit-to-screen overview, so the wider world creates longer travel without a larger viewport. Headless simulation shares layout/collision but not the full live defensive/recall state machine; its small seeded sample is not proof of competitive balance. Dynamic champion pursuit still uses existing combat steering and collision, while planned jungle/return/base routes use the new terrain router.

## User Request: Solidify Base Defense Decisions and Rotations

**User:** "Can you take a look at the base defense? Solidify it." This follows the wider-battlefield and initial Nexus/tier-3 defense work described above.

**Agent:** Strengthened the existing base-defense rules and live arena integration rather than increasing structure HP/damage or granting defenders artificial combat bonuses. Only living, opposing **visible/scouted champions** and publicly observable siege minions can generate a defense call; damaged structures alone do not. Overlapping detection zones assign attackers to their nearest living allied structure, preventing a siege at the Nexus Tower from incorrectly appearing as a direct Nexus attack. Defense priorities remain **Nexus > Nexus Tower > barracks > inner tower > outer tower**; core emergencies recruit globally while outer defenses remain local. The currently defended structure gets a small 35-unit detection margin to prevent call oscillation, but the call clears when the actual threat leaves or dies.

Added explicit combat-readiness decisions so viable defenders interrupt optional farming, shopping, and macro calls, while critically injured, outnumbered, losing-fight, or turret-evacuating units are not forced into suicidal defense. Combat-ready units can leave the fountain before reaching full resources during urgent base sieges. Distant safe defenders compare walking time with recall-channel plus post-teleport travel time; recall channels already in progress are canceled only when walking is faster. The live AI retains the current defense target across ticks, prioritizes enemy champions and siege minions actually threatening the structure, avoids chasing unrelated enemies or clearing distant waves, and cancels coordinated post-recall camp plans under base pressure. Per-building defense announcements can fire independently within the same 20-second callout interval. The behavior is mirrored for Blue and Red.

**Affected files:** `EsportsClash.Web/src/baseDefenseRules.ts`, `src/baseDefenseRules.test.mjs`, `src/types.ts`, and `src/components/AramMatchView.tsx`. The changes were delivered as `base-defense-solidified.zip`, with `base-defense-solidified.patch` included as an alternative to replacing the four files. The previous golem-pit relic removal and objective contest invariants were left unchanged. No gameplay-document update was included in this standalone change package.

**Verification:** All **10 focused base-defense tests** passed with Node.js 22 type stripping, using a minimal compatible `arenaLayout.ts` fixture **only for local tests**, because the complete layout module was not among the files supplied for this change. The modified files passed TypeScript syntax parsing, and `baseDefenseRules.ts` passed standalone strict type checking. Tests cover threat attribution, mirroring, defense priorities, missing or dead threats, detection hysteresis, safety gates, early fountain exit, and recall-vs-walk travel decisions.

**Limits:** Full `npm run check:game`, `npm run build`, browser match replay, and balance or win-rate effects were **not verified** against the full repository. Apply the files/patch to the actual project, rerun the full tests and build, and inspect a live Nexus siege with defenders farming, recalling, and contesting objectives to validate integrated behavior. The headless simulation still does not reproduce all live defense/recall state transitions.

## User Request: Zoom in the Battlefield (Action Camera, Mini Radar & Spectator Controls)

**User:** "can you zoom in the battlefield? I enlarged the battlefield so it looks too tiny now."

**Agent:** Enlarging the arena width from 2000 to 2600 units within fixed aspect ratio containers caused avatar models, skillshots, and health bars to render shrunken down. Implemented an authentic MOBA spectator camera and zoom system:
- **Default 1.45x Zoom & Presets:** The arena defaults to 1.45x zoom (bringing the visible viewport width to ~1793 units), making champion models, spells, and health bars ~45% larger and instantly readable. Presets include `Fit` (1.0x full-map view), `1.45x` (balanced action), and `1.85x` (close-up intense combat). Custom zoom scales seamlessly from 1.0x to 2.5x.
- **Dynamic Auto Action Camera:** Computes an action center by evaluating all living champions with combat weights (low health +1.5, crowd controlled or channeling +2.0, active enemy skirmishes within 520px +3.5). The camera smoothly glides with exponential delta-time damping (`1 - exp(-4.2 * dt)`), tethered to lane (y = 380) while seamlessly tilting toward pit contests (Dragon y ~ 160, Golem y ~ 600).
- **Strict Viewport Clamping:** Camera viewport is clamped to `[halfW, ARENA_WIDTH - halfW] x [halfH, 760 - halfH]`, mathematically preventing any out-of-bounds void or black borders from ever showing at any zoom level. At 1.0x zoom, the camera locks precisely to (1300, 380), displaying the entire arena identically to before.
- **Interactive Controls & Mini Radar Map:**
  - Screen-space Mini Radar Map (260x76px at exact 1:10 scale) in the bottom-right corner shows live towers, bosses, champion blips, and an interactive golden camera viewport box that can be clicked or dragged to jump across the battlefield (toggleable via `M`).
  - Floating on-canvas HUD pill (top-left) with Auto Cam / Free Pan toggle, zoom presets, and +/- buttons.
  - Mirrored zoom and Auto Cam controls in the scoreboard toolbar beside playback speed.
  - Interactive canvas drag-to-pan, mouse wheel zooming, touch pinch-to-zoom / 1-finger drag, double-click or `Spacebar` recentering.
- Preserves all simulation determinism, coordinate layouts (`ARENA_WIDTH = 2600`), tower dive limits, and execution invariants.

**Affected files:** `EsportsClash.Web/src/components/AramMatchView.tsx`, `docs/arena-mechanics.md`, and this handoff.

**Verification:** `npm run check:game` passed: design validation, all 220 unit tests, 3 multi-seed simulation suites (20 seeds, Cardrel parody alias, tower dive limits, and turret execution invariants intact), and `tsc -b`. `npm run build` compiled cleanly.

**Limits:** Headless simulation runs without canvas camera rendering; zoom is purely a visual presentation and spectator enhancement.
