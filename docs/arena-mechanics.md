# Arena mechanics and regression rules

This file records the intended simulation behavior. When changing the arena, update these rules and run `npm test` and `npm run build` in `EsportsClash.Web`.

## Team decisions

- The same rules govern blue and red. Player IQ affects macro choices and spell timing; LAN affects farm, wave clear, skillshot aim and dodge; TF affects target choice and coordinated fights. The card's OVR, LAN, TF, CLU, STA and FLX now also scale that player's avatar health, basic attack, defenses, attack speed and skill damage at match start. Preferred role and signature avatar give smaller bonuses; the source avatar kit is never mutated. Chemistry and coach playbook affect team objective calls. These ratings make strong play more likely without forcing a predetermined winner.
- A player should clear an enemy wave before hitting a fortified tower when allied creeps are absent. Skilled wave clear avatars can spend a ready skill on a clustered wave. Creeps then crash and increase siege damage.
- Embermaw and Gravemarch calls require a pushed wave, pit vision, at least three healthy nearby allies, few nearby enemies, and enough player/coach macro rating. Match time is an earliest availability gate, not an automatic call. The 1x/2x/4x control changes playback rate only.
- Skill one projectiles for the seven newest avatars use cast-time aiming and path collision; targets can leave the path. A learned combo only advances its projectile opener after a real hit.

The objective decision reflects the importance of [lane priority, vision and coordinated objective play in Riot's patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) and [objective voting and jungle leash principles](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/). The code uses original thresholds scaled to this compact arena.

## Map and neutral units

- Each side has three turrets, three class-specific barracks, a large defensive nexus, a wide home well and a visible shop. Turret plating reduces opening siege damage and fades continuously by game minute eight, allowing a pushed wave to close a decisive game sooner. Outer, inner, and nexus turrets deal 160, 190, and 220 base damage to creeps; shots against champions deal pure unmitigated True Damage at 1.8x base damage (288 for outer, 342 for inner, 396 for nexus), completely ignoring champion armor and rendering bold white floating damage numbers. A turret switches to an in-range avatar that attacks its defender, even with creeps present, and keeps dive aggro for 3.5 game seconds. Keeping creep damage at its prior value lets waves push without undoing the faster match pace. The nexus fires five rapid turret shots per volley, then reloads for 2.2 seconds; a continuous five shots per second erased upgraded waves and stalled exposed nexuses. It stays sealed until its nexus turret and at least one barracks have fallen. AI attackers should target the barracks while the nexus is sealed. Destroying a barracks upgrades only the matching melee, ranged, or catapult creeps on later waves.
- Camps and Embermaw remain passive until hit. Aggroed camps leave their tree-ring home to chase the attacker, fight back, then return and heal when the target leaves the leash. Their home ring never moves with them. Scouted camps show idle breathing, moving footsteps, a warning before a shot, a strike lunge and a brief hit flash; shrouded camps do not reveal these combat cues.
- Four crest camps, one blue and one red on each side, give the killing team a 90-second buff: blue increases mana recovery and red adds attack damage.
- The lower Gravemarch Colossus grants its slayer's team a siege golem with each wave for 125 game seconds. The golem is a larger, tougher siege unit and the neutral boss respawns later.
- Every avatar may place a free ward in a nearby unwarded bush when its personal ward cooldown is ready. Wards last 75 seconds, reveal that bush for their team, and carve a visible hole in the fog.

## Combat and economy

- Matches end when a nexus falls. There is no required duration; a strong early push can finish sooner. Opening runs before minute 4, mid game begins at minute 4, and late game begins at minute 8. These are timing labels, not match-ending rules.
- Pacing sanity check: 25 completed matches with one balanced draft after the durability and volley changes averaged 421 game seconds; 18 ended before minute 8 and the longest took 655 seconds. This sample is a regression reference for that draft, not a fixed match duration.
- Skill progression scales up to the level cap of 18 with 18 total allocated skill points: Innate trait is active at all levels (1–18); Skill 1 has 7 ranks scaling at levels 1, 4, 7, 9, 12, 14, and 17; Skill 2 has 7 ranks scaling at levels 2, 5, 8, 10, 13, 15, and 18; and Ultimate has 4 ranks scaling at levels 6, 11, 16, and 18 ($7 + 7 + 4 = 18$). In Clash Arena, champions start at level 3 where basic skills start at rank 1 with ~40% damage and 130% cooldown; max rank 7 basic skills achieve 130% damage and 70% cooldown. Ultimate ranks scale from 55% damage / 115% CD at level 6 up to 130% damage / 70% CD at rank 4.
- High-visibility health and level indicators: Overhead canvas health bars are enlarged (66px width, 9px height, with 250 HP pip notches and shields), level badges are 16x16 with bold text, and a live purple/gold XP bar tracks level progress directly under the mana bar. In-game HUD squad cards feature 36px chibi avatars, enlarged level badges, dedicated full-width live HP bars with numeric and percentage readouts, shield overlays, and dedicated XP level bars.
- The top kill score equals recorded player kills. If a camp or Embermaw lands the final blow, the most recent opposing avatar to damage the victim in the previous ten game seconds gets the kill, gold, XP, and any multikill credit. An untagged neutral death remains an execution. Turret, creep, and well deaths keep their current attribution. Double through penta callouts require consecutive kills by the same player no more than three game seconds apart; a seven-second gap resets to a normal kill.
- Completed items cost 65% of their original arena price; starting items and components retain their costs. Income rises with LAN, so stronger farmers reach item spikes sooner. After minute 8, high-IQ players may recall safely on a smaller gold spike to convert that farm into items. Item inventory snapshots at 8, 10, 12 and 13 minutes only include games that reached those checkpoints. Component cost is credited in full on completion, and later purchases may sell a weaker item. Boots use their own slot and add movement speed; the free ward has its own slot. All shop items bear creative Esports Clash names (`Apex Edge`, `Leviathan Harpoon`, `Goliath Slayer`, etc.) while internal IDs (`item_kraken_slayer`, etc.) remain constant.
- Item purchases happen only when the avatar is inside its own home base. Recalls and respawns return avatars there; field shopping should never occur.
- Player name appears above the battlefield avatar and avatar name below it. The squad item HUD is docked. The 1x/2x/4x control has no influence on AI target or objective conditions.

The seven recent avatars and their [official basis references](avatar-animation-references.md) have original playable names, silhouettes and effects. Their hooks, bolts, casks and follow-up skills use distinct animations and outcomes.

## Replays, balance and spectator cues

- Arena combat advances at a fixed 30 game ticks per second. Playback speed changes how many ticks run per real second; it does not change tick size. Each draft receives a random seed, and all arena random choices use that seed. Stasis also expires on game time.
- **Replay** restarts the current draft with its seed. **Export** saves a completed match report with its seed, full draft, outcome, ratings, kill totals, skillshot counts and timestamped events. On the draft screen, **Replay last saved match** or **Open match report** loads that draft and seed again. Replays never award tournament rewards again.
- **Run 25** simulates 25 actual arena matches with the current draft. Consecutive matches share a seed and swap both lineups and coaches between sides; the last match uses a fresh seed. Those matches do not award tournament rewards. **Stop** cancels the remaining batch. **Export balance** saves the batch reports and summary. Completed reports accumulate locally in the browser, with aggregate game length, blue-side win rate, higher-rated side win rate, skillshot hit rate, objective timing and item counts at 8, 10, 12 and 13 minutes. A checkpoint only appears in the average when a completed match reached it. Compare several drafts before changing ratings or economy.
- Card-rating check with the same coach and comparable role drafts: in 25 side-swapped matches, a roughly 94-OVR roster beat a 66-OVR roster 24 times; against an 80-OVR roster it won 18 times. These samples show the expected direction and allow upsets, but they do not establish win rates for other drafts.
- Objective calls enter the timestamped event log when a team actually chooses to move toward Embermaw or Gravemarch. Embermaw's Inferno Slam shows a clear circular warning for 1.1 game seconds. Damage and stun resolve at impact against avatars still inside the circle. Leaving the pit cancels the windup. Kill cards and power-spike banners sit in a rail above the canvas so they cannot cover the dragon or the fight.

## Draft and online rooms

- The club reserves use a responsive card grid with player-name search, role, game and tier filters, rating/name sort, and pagination. Card faces show only fictional gamer parody names (e.g. `Zypoo`, `d4nk`, `p1mple`, `M0cke`, `flopz`, `Spl1t`, `SneakBro`, `Fisha`) and signature avatars without `Based on:`. Source inspirations remain in internal research data; Cardrel is the intentionally preserved requested parody alias.
- The arena dashboard offers **Vs AI** and **Vs Player**. The draft has one ban per side, followed by ten alternating snake-order picks. A banned or picked avatar is unavailable to every remaining slot. Each pick is assigned to an unfilled player card before lock-in.
- In Vs AI, the rival coach scores available avatars against player preferred role, signatures, frontline, wave clear, and coach style. Furthermore, the AI evaluates stored champion telemetry from `avatarSynergyData.ts`: counter picks grant $+12$ per countered enemy avatar (or $-10$ penalty if the pick is countered), while duo and wombo combo pairings (e.g. Cora + Renn, Raijin + Solana) grant $+15$ synergy score. A seeded tie break varies close fits, so a rival marksman does not always receive Astra. The coach uses its actual style, playbook rating, and scouting matrix; team composition dynamically adapts pick order. The Pro Circuit features 125 pro teams across 5 major leagues with distinct coaches and rosters available for single-player simulation and Clash Arena challenges.
- In Vs Player, two people join a six-character online room. The Node room server checks both identities, turn order, unique bans and picks, open roster slots, and revision numbers. Both clients receive the same lineups, coaches, and match seed. Match combat is AI controlled on both clients; the online interaction is drafting and watching the seeded simulation. In-memory rooms expire after two hours of inactivity and a server restart clears them. Room state is not a ranked result authority.

## Roster Combat Classes, Multi-Role Evolutions and Expanded Champion Pool

- **Tactical Roster Architecture:**
  - Player cards have eliminated lane-specific tags (Top, Jungle, Mid, Bot Carry, Support) in favor of intrinsic combat classes (`Mage`, `Marksman`, `Fighter`, `Tank`, `Assassin`, `Support`).
  - Active 5-man squad lineups align along tactical combat roles: `FRONTLINE`, `SKIRMISHER`, `CORE PLAYMAKER`, `DAMAGE CARRY`, and `TACTICAL SUPPORT`.
- **39 Total Champions:**
  - Expanded pool includes 9 newly added champions: **Kaelen** (Invoker - Mage/Support), **Hweilin** (Hwei - Mage/Support), **Jaxon** (Jayce - Fighter/Marksman), **Valerie** (Vi - Fighter/Assassin), **Jinxy** (Jinx - Marksman/Assassin), **Paxi** (Puck - Mage/Assassin), **Batrix** (Batrider - Fighter/Mage), **Quillback** (Bristleback - Tank/Fighter), and **Aetheris** (IO - Support/Mage).
  - Each champion kit is complete with vector SVG portraits, distinct animation motifs, authentic combo paths, and skillshot logic.
- **EA FC-Style Evolutions & Multi-Role Mechanics:**
  - Player cards feature `playableRoles: AvatarRole[]`. Unlocking a secondary role via the Evolutions Hub allows the card to pilot champions from multiple classes with full on-role combat scaling (+0.025 on-role power bonus) and full AI draft score incentives (+38 role fit).
  - Card evolutions grant +4 to +7 OVR boosts, attribute progression (LAN, TF, IQ, CLU, STA, FLX), tier promotions (up to GOAT), and custom selectable signature avatars.
  - Active evolutions can be fast-tracked for 250 Clash Coins.
## Kaelen Spellweave and Combat Micro Decisions

- **Kaelen Dual Weave & Spellweave Synthesis:**
  - Kaelen wields primordial duality: **Pyra** (Flame essence) and **Surge** (Storm essence).
  - Skill 1 (`Pyra Essence Bolt`, 175 Magic damage) collects Pyra essence. Skill 2 (`Surge Essence Pulse`, 130 Magic damage + haste) collects Surge essence.
  - Ultimate (`Spellweave Cataclysm`) synthesizes the two most recent essences into an invoked spell:
    - `Pyra + Pyra` -> `Sunstrike Cataclysm` (540 Magic damage + 1.2s stun)
    - `Pyra + Surge` -> `Chaos Blast Wave` (460 Magic damage + 1.2s disarm & knockback)
    - `Surge + Surge` -> `Ghost Shroud EMP` (380 Magic damage + 1.5s root & phase haste)
  - Real-time rotating elemental orbs orbit Kaelen on canvas matching active essence charges.
- **Cover-First Retreats & Recall Mechanics:**
  - When retreating at low health or wishing to recall, avatars take cover in a nearby retreat bush (`nearbyRetreatBush`) or retreat toward the fountain well (`wellTargetX`).
  - An arrival deadband (14px) snaps retreating avatars smoothly to their cover position, zeros velocity (`vx = 0, vy = 0`), sets `animState = 'idle'`, and locks facing down-lane, permanently preventing 30Hz left-right direction flip spinning.
  - Safe distance thresholds in `canUnitRecall`: safe enemy distance is 300px in brush or 450px in the open, minion distance > 270px, and enemy structure distance > 250px with recall cooldown <= 0.
  - While channeling recall, avatars are protected by anti-clumping collision physics so passing teammates cannot nudge or displace them.

- **Recall Target Separation & De-aggro:**
  - Allies do not treat recalling teammates as active combatants (`animState` is set to `'idle'` and excluded from `fightingAlly` convergence).
  - Distant recalling enemies receive heavy AI target penalties (`-5.0 * iq`), preventing units from crossing the bridge on pointless chases, while immediate threats within range (`dist <= range * 1.25`) prioritize interrupting the channel.
- **Dedicated Procedural Chibi Models (All 39 Champions):**
  - Every champion in the arena has a dedicated procedural TFT-style chibi sprite rendered via `ChampionSpriteRenderer.ts`. No unit falls back to placeholder geometry.
  - The 9 latest avatars feature custom animated sprites:
    - **Kaelen:** Royal crimson/gold high-mantle robes, blonde locks, ruby diadem, and floating scepter with spellweave aura.
    - **Hweilin:** Slate-indigo coat, turquoise scarf, ink splatters, and oversized bamboo brush with violet/cyan ink drips.
    - **Jaxon:** Piltover armor, gold pauldron with cyan conduits, hero hair, and Hextech Mercury Hammer with pulsing cyan core.
    - **Valerie:** Spiky neon-pink hair, forehead aviator goggles, 'VI' cheek mark, and dual steam-powered Atlas Gauntlets with piston recoil.
    - **Jinxy:** Floor-length electric blue braids, bullet belts, starry magenta anime eyes, and shark-mouthed rocket launcher.
    - **Paxi:** Flapping translucent faerie butterfly wings, chubby turquoise dragon body, lavender underbelly, and glowing antennae lanterns.
    - **Batrix:** Flapping midnight shadow bat mount with fangs, ridden by a green goblin with flight cap/goggles waving a flaming bottle.
    - **Quillback:** Burly hunched porcupine brawler with a fan of sharp quills bristling from his back, tusks, nose ring, and spiked war club.
    - **Aetheris:** Levitating multi-tonal plasma wisp sphere with rotating crystalline gyroscopic rings, starlight eyes, and 3 orbiting satellite sparks with electric tethers.

## Chess-Style Ranked Ladder System

- **Chess Elo Rating Mechanics:**
  - Competitive ladder rating begins at exactly **300 Rating** (Pawn tier) with a hard floor of 300 to protect beginner progression.
  - The traditional "LP" (League Points) and MOBA rank divisions (Bronze, Silver, Gold, Platinum, Diamond) are completely omitted.
  - The ladder uses pure Chess Elo calculations:
    - Expected score $E = \frac{1}{1 + 10^{(R_{opp} - R_{player}) / 400}}$
    - Dynamic K-factor ($K = 40$ below 800 Rating, $K = 32$ between 800 and 1600, $K = 24$ above 1800).
    - Consecutive win streaks grant +3 to +8 bonus rating to accelerate high-skill climbers.
  - Ranks progress through 9 authentic Chess tiers:
    - **Pawn (Novice Contender)**: 300 – 599 Rating (♟️)
    - **Knight (Tactical Striker)**: 600 – 899 Rating (♞)
    - **Bishop (Diagonal Strategist)**: 900 – 1199 Rating (♝)
    - **Rook (Fortress Commander)**: 1200 – 1499 Rating (♜)
    - **Queen (Grand Strategist)**: 1500 – 1799 Rating (♛)
    - **Candidate Master (CM)**: 1800 – 2099 Rating (🎖️)
    - **Master (M)**: 2100 – 2399 Rating (🎗️)
    - **International Master (IM)**: 2400 – 2699 Rating (⚔️)
    - **Grandmaster (GM)**: 2700+ Rating (👑)
  - Ladder standings feature a living simulation of ~40 clubs across the 300 to 2850 Elo range with matchup challenges enabled for teams within $\pm 150$ Rating.
  - **Multiplayer Mode Enforcement:**
    - Competitive Ranked matches are strictly multiplayer (Vs Player). Playing a Ranked Match opens or joins a live multiplayer room with Chess Elo rating on the line.
    - Unranked "Normal Match (Vs Player)" offers casual multiplayer competition without risking rating loss.
    - Single-player AI circuits (Pro Circuit) and unranked scrimmages do not modify Chess Elo ladder ratings or career win/loss records.

## Epic Objective Contestation & Regrouping Rules

- **Pit Scouting & Pit Vision Invariants:**
  - A team is considered to have vision of Dragon Embermaw (`DRAGON_X, 130`) or Gravemarch Colossus (`1000, 610`) if:
    1. Any alive allied champion is within 440px of the pit.
    2. Any alive allied ward is stationed within 320px of the pit.
    3. Any enemy champion in the pit is visible / revealed.
  - If a team has pit vision and the enemy team is attacking an objective, healthy teammates (`>35% HP`) cancel idle tasks and **regroup immediately** towards the pit.
  - Teams with a `Shotcaller` trigger a tactical rally aura (+25 move speed) to converge instantly.
  - Upon reaching the pit, contesting units prioritize attacking the enemy team who are taking boss damage, or timing burst executes to steal the monster if its health drops below 22%.

## Player Card Unique Combat Traits (PlayStyle Engine)

- **Aggro Diver:** When an enemy is low (<38% HP), dives them aggressively under enemy turrets. Gains +25 move speed toward wounded targets, a 16% Max HP dive shield upon entering turret range, and +18% dive damage.
- **Clutch King:** When dropped below 32% HP in combat, refuses to retreat. Triggers **Clutch Surge** (18-24% Max HP shield, +25% attack speed, +30% crit chance, and +20% outplay damage when outnumbered).
- **Baron Steal:** Sprints into epic monster pits and delivers a +50% true damage execute burst to steal Dragon or Golem when the objective is below 22% HP.
- **One-Tap God:** Targets squishy carries (Marksman/Mage) with +3.2 target priority in teamfights; deals +25% bonus critical burst against isolated targets.
- **Laning Demon:** Deals +22% damage to minions and lane structures during the early phase (<240s) and applies attack speed slows to opposing laners.
- **Unkillable Demon:** When below 35% HP, gains +35% move speed and a 35% chance to mitigate incoming damage by 65%, baiting enemy abilities into wasted cooldowns.
- **Ice in Veins:** Possesses 40% innate crowd control reduction (tenacity), shrugging off stuns and roots.
- **Vision Master:** Places wards on an accelerated 28s cooldown and proactively drops deep wards directly into Dragon and Golem pits.
- **Shotcaller:** Sounds a team-wide rally aura during objective contests and large teamfights, giving nearby allies +25 move speed.


