# Arena mechanics and regression rules

This file records the intended simulation behavior. When changing the arena, update these rules and run `npm test` and `npm run build` in `EsportsClash.Web`.

## Team decisions

- The same rules govern blue and red. Player IQ affects macro choices and spell timing; LAN affects farm, wave clear, skillshot aim and dodge; TF affects target choice and coordinated fights. The card's OVR, LAN, TF, CLU, STA and FLX now also scale that player's avatar health, basic attack, defenses, attack speed and skill damage at match start. Preferred role and signature avatar give smaller bonuses; the source avatar kit is never mutated. Chemistry and coach playbook affect team objective calls. These ratings make strong play more likely without forcing a predetermined winner.
- A player should clear an enemy wave before hitting a fortified tower when allied creeps are absent. Skilled wave clear avatars can spend a ready skill on a clustered wave. Creeps then crash and increase siege damage.
- Teams know the fixed home locations of ordinary jungle camps. A healthy avatar may route to a live camp after the first wave when lane is quiet, even before the camp is visible; a stronger Jungler tendency permits a longer route. Local enemies, a nearby lane wave, poor health, and an exposed low-health nexus cancel camp farming. Camp vision still governs what is rendered, not whether the team knows the map location.
- An exposed enemy nexus becomes an urgent finish target when its HP falls below a threshold informed by the card's IQ and coach macro rating (about 33–41%). A healthy attacker pushes or attacks it before ordinary camp farm and side objectives if no immediate enemy threat demands a fight. A nearby defending wave can be cleared first to escort allied minions into the base. Nexus shield rules still apply.
- Embermaw and Gravemarch calls require a pushed wave, pit vision, at least three healthy nearby allies, few nearby enemies, and enough player/coach macro rating. Match time is an earliest availability gate, not an automatic call. The 1x/2x/4x control changes playback rate only.
- Objective contests now follow the boss's actual health and the opponent's actions. Both the team taking an objective and a scouting team that decides to contest focus Embermaw or Gravemarch below 32% health, even when enemy champions are nearby. Above that threshold, the team taking the boss continues damaging it until opposing champions actually attack nearby allies. A contester may start a teamfight while the boss is healthy; its choice uses player IQ, teamfight and clutch ratings, PlayStyle traits, coach style, and a `Shotcaller` card's stronger team voice. Cautious contesters can instead attack the boss. A fight call uses the usual avatar combos, skillshots, crowd control, and kiting; speed control has no input to the call. After a secure, the team chooses to press nearby enemies or regroup toward lane from card and coach attitudes, health, and numbers. Regroup lasts six game seconds and can be interrupted by a fresh enemy champion hit. A shotcaller signals an actual fight call to allies at normal movement speed.
- Skill one projectiles for the seven newest avatars use cast-time aiming and path collision; targets can leave the path. A learned combo only advances its projectile opener after a real hit.

The objective decision reflects the importance of [lane priority, vision and coordinated objective play in Riot's patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) and [objective voting and jungle leash principles](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/). The code uses original thresholds scaled to this compact arena.

## Map and neutral units

- Each side has three turrets, three class-specific barracks, a large defensive nexus, a wide home well and a visible shop. Turret plating reduces opening siege damage and fades continuously by game minute eight, allowing a pushed wave to close a decisive game sooner. Outer, inner, and nexus turrets deal 160, 190, and 220 base damage to creeps; shots against champions deal pure unmitigated True Damage at 1.8x base damage (288 for outer, 342 for inner, 396 for nexus), completely ignoring champion armor and rendering bold white floating damage numbers. A turret switches to an in-range avatar that attacks its defender, even with creeps present, and keeps dive aggro for 3.5 game seconds. Keeping creep damage at its prior value lets waves push without undoing the faster match pace. The nexus fires five rapid turret shots per volley, then reloads for 2.2 seconds; a continuous five shots per second erased upgraded waves and stalled exposed nexuses. It stays sealed until its nexus turret and at least one barracks have fallen. AI attackers should target the barracks while the nexus is sealed. Destroying a barracks upgrades only the matching melee, ranged, or catapult creeps on later waves.
- Camps and Embermaw remain passive until hit. Regular camps have five seconds of patience refreshed by a hit from an attacker inside their leash. If the target dies, leaves the leash, or patience expires, the camp drops aggro, returns home, restores 6% maximum health per second during a six-second soft reset, and then fully heals. A valid new hit during the soft reset restarts combat; hits from outside the leash are ignored. A thin orange bar under a scouted camp's health shows remaining patience. These arena values adapt the soft/hard reset and leash behavior described in [Riot's patch 12.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/); they are not League's exact timings or distances. Camp trees remain rooted while the monsters move. Scouted camps show idle breathing, moving footsteps, a warning before a shot, a strike lunge and a brief hit flash; shrouded camps do not reveal these combat cues. Scouted camp models use the same immediate horizontal facing flip as avatars when pursuing an attacker or returning home. They keep their full silhouette while turning. Their attack poses use the actual attack timer: stone fists slam, wolves bite, behemoths thrust their tusks, and drakes breathe fire. Health bars and names stay readable outside the facing transform.
- Four crest camps, one blue and one red on each side, give the killing team a 90-second buff: blue increases mana recovery and red adds attack damage.
- Normal lane creep bodies render 1.28× larger, with wider shadows, empowerment rings, and health bars. Caster projectiles render at 2.5px radius and cannon projectiles at 5px radius. Their attack cadence, damage, speed, and collision rules are unchanged.
- The lower Gravemarch Colossus can be slain once per match and never respawns. Its slayer gets exactly one allied siege golem placed near the leading friendly wave. That unit does not respawn if killed. It can telegraph and charge a live enemy turret in front of it within 165 world units, then slam the turret for 1,050 base damage, modified by normal turret plating, on a 10-second charge cooldown. It cannot charge a nexus, barracks, allied structure, destroyed turret, or out-of-range turret. All jungle models and their camp rings are enlarged; Gravemarch has horns, runes, heavy fists, and a wider silhouette. The neutral and claimed golems raise a fist for attacks. The claimed golem raises its arm during charge windup and slams after tower contact; its attack and turn poses do not change charge damage or timing.
- Every avatar may place a free ward in a nearby unwarded bush when its personal ward cooldown is ready. Wards last 75 seconds, reveal that bush for their team, and carve a visible hole in the fog.
- Sylla's Spirit Bear immediately flips toward a target or its follow position like an avatar, without narrowing its sprite. A real bear attack drives a leading paw swipe and claw trail; the bear's name and health bar remain outside the facing transform. Its attacks still resolve on the existing combat tick.

## Combat and economy

- Matches end when a nexus falls. There is no required duration; a strong early push can finish sooner. Opening runs before minute 4, mid game begins at minute 4, and late game begins at minute 8. These are timing labels, not match-ending rules.
- Pacing sanity check: 25 completed matches with one balanced draft after the durability and volley changes averaged 421 game seconds; 18 ended before minute 8 and the longest took 655 seconds. This sample is a regression reference for that draft, not a fixed match duration.
- Skill progression scales up to the level cap of 18 with 18 total allocated skill points: Innate trait is active at all levels (1–18); Skill 1 has 7 ranks scaling at levels 1, 4, 7, 9, 12, 14, and 17; Skill 2 has 7 ranks scaling at levels 2, 5, 8, 10, 13, 15, and 18; and Ultimate has 4 ranks scaling at levels 6, 11, 16, and 18 ($7 + 7 + 4 = 18$). In Clash Arena, champions start at level 3 where basic skills start at rank 1 with ~40% damage and 130% cooldown; max rank 7 basic skills achieve 130% damage and 70% cooldown. Ultimate ranks scale from 55% damage / 115% CD at level 6 up to 130% damage / 70% CD at rank 4.
- High-visibility health and level indicators: Overhead canvas health bars are enlarged (66px width, 9px height, with 250 HP pip notches and shields), level badges are 16x16 with bold text, and a live purple/gold XP bar tracks level progress directly under the mana bar. In-game HUD squad cards feature 36px chibi avatars, enlarged level badges, dedicated full-width live HP bars with numeric and percentage readouts, shield overlays, and dedicated XP level bars.
- The top kill score equals recorded player kills. If a camp or Embermaw lands the final blow, or if a defense turret strikes the final blow within ten game seconds of receiving enemy champion damage, the most recent opposing avatar gets the kill credit, gold (300g), XP, and any multikill credit. If a turret destroys an avatar and the elapsed time since last enemy damage exceeds ten seconds (or if the avatar was never hit by an enemy), the kill is attributed to the turret as an execution: no player receives a kill, and the turret's owning team splits the 300g bounty evenly across all roster members (60g each for a standard 5-player squad) accompanied by coin audio and floating gold text. Creep and well deaths without enemy tags remain uncredited executions. Double through penta callouts require consecutive kills by the same player no more than three game seconds apart; a seven-second gap resets to a normal kill.
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
## Kaelen Conflux and Ground-Target Abilities

- **Kaelen's elemental orbs:** Q `Orb of Ice`, W `Orb of Wind`, and E `Orb of Fire` have no cooldown. Each cast adds that orb to the current three-orb FIFO. Only held orbs grant stats; when FIFO overflow removes an orb, its stat bonus is removed too.
- At orb rank 1, each held Ice orb grants 0.2 health regeneration per second, each held Wind orb grants 1 movement speed, and each held Fire orb grants 1% spell amp plus 1% damage amp. Per-orb bonuses scale by 25% per rank from rank 1 to rank 7 using the basic-skill rank milestones (levels 1, 4, 7, 9, 12, 14, 17). The FIFO can hold at most three total orbs, including duplicate elements.
- **Conflux (active R ability):** Pressing Conflux consumes the current three-orb FIFO, invokes the matching spell, and stores it in D/F. D shows the oldest retained invocation; F shows the newest. Adding a third invoked spell drops D and shifts F into D.
- Conflux cooldown is 3s at levels 1-6, 2s at 7-12, 1s at 13-17, and 0s at level 18. Invoked spells retain separate cooldowns. The ten recipes remain `QQQ` Glacier Lock (12s), `QQW` Rime Gale (10s), `QQE` Sleetflare (11s), `QWW` Whiteout Step (9s), `QWE` Primal Tempest (14s), `QEE` Emberfrost Lance (8s), `WWW` Skyshatter (13s), `WWE` Ashen Cyclone (15s), `WEE` Sirocco Flare (16s), and `EEE` Solar Pike (17s).
- Kaelen's `ultimate` data slot is retained for E `Orb of Fire` compatibility, while Conflux is presented and tracked as his R ability.
- **Ground targeting:** Paxi's Illusory Orb and Raijin's Ball Lightning resolve toward a ground point rather than binding to an enemy unit. Their direction can be computed without a target; Paxi can send her orb toward home, while Raijin's retreating AI may launch Ball Lightning away from the fight. The arena clamps destinations to valid bounds.
- These abilities do not change the established turret-dive authorization, perimeter tethering, evacuation, or safe-bush rules. Ground targeting permits aim without a target lock; it does not authorize unsafe turret dives.
- The arena is an auto-battler: its AI selects ground points from target positions or retreat direction. Manual mouse/keyboard ability input is not currently exposed.
- **Aetheris tether kit:** Harmonic Link visually tethers Aetheris to the nearest living ally within 280 arena units. Spirits Orbit Array refreshes five visible orbiting charges for 8 seconds; each Q projectile that hits an enemy avatar bursts for area damage and consumes a charge. Overcharge Surge selects a nearby ally (or Aetheris if alone), applies a visible aura, a 100-point shield, and +15% basic-attack damage for 5 seconds. Resonant Convergence heals and shields living allies within 260 units and maintains visible tethers to them for 5/6/7/8 seconds at ultimate ranks 1/2/3/4.
- **Ability targeting labels:** The roster and draft ability inspectors identify unit-targeted, ally-targeted, self-centered, no-target, and ground-targeted casts. Paxi's Q and Raijin's ultimate explicitly remain ground-targeted; the UI notes they do not require enemy unit selection. The arena still chooses targets automatically and does not expose manual player casting.
- **Avatar terminology, roster layout, and names:** User-facing roster/draft labels call the units avatars while internal kit types and IDs remain unchanged for save/replay compatibility. Avatar `displayName` values provide subtle parody aliases based on their hero inspirations; internal kit names remain stable for combat logic and player-card signature matching. Avatar names shown on player-card signature labels use those aliases, but Player Card identities—including Cardrel—are unchanged. The full-width roster presents two stacked rows: a scrollable grid of avatar cards with alphabetized role filters and search, followed by the selected avatar's identity, combat tags, lore, stats, and ability inspector. Role filters are listed alphabetically in both roster and draft.
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
  - A `Shotcaller` calls the contest, and teammates converge at their normal movement speed.
  - Upon reaching the pit, contesting units prioritize attacking the enemy team taking boss damage. A specialist may recognize a late last-hit window, but receives no extra execute damage.

## Player Card Unique Combat Traits (PlayStyle Engine)

Traits change choices, routes, targets, and timing. They grant no hidden damage, shields, speed, tenacity, cooldown reduction, or random damage reduction. Health thresholds below only trigger decisions; IQ, lane, teamfight, and mechanics ratings still affect execution.

- **Aggro Diver:** Pursues a wounded enemy under a turret when the approach is survivable, then looks for an exit.
- **Clutch King:** Below 32% health in an active fight, finishes the current attack or skill sequence instead of immediately retreating. The enemy can still punish the choice.
- **Baron Steal:** Reads a contested Embermaw or Colossus attempt and enters late to threaten the last hit with ordinary attacks and available skills.
- **One-Tap God:** Picks an exposed marksman or mage and directs an available burst combo at that target instead of the nearest frontline unit.
- **Laning Demon:** Clears the enemy wave before attacking a structure and escorts allied minions into turret range.
- **Unkillable Demon:** When wounded, ducks into nearby cover and re-enters if an opponent spends a key skill while its own skill is ready.
- **Ice in Veins:** Keeps the chosen fight target through crowd control, then resumes the plan when control ends at its normal duration.
- **Vision Master:** Uses the normal free ward cooldown to cover an unobserved objective pit or approach before a team commits.
- **Shotcaller:** Signals an objective contest and brings allies toward the same fight at normal movement speed.
- **Golden Flash:** Proposed move: reads a visible skillshot and sidesteps. This trait has no separate gameplay hook yet; ordinary dodging still depends on card mechanics.

## Pack Store and Avatar Combat Types

- The header shows rating and coins; the unused Fans and Day counters are removed. Sponsor Stream earns coins without a separate fan resource.
- Evolution eligibility cards keep a readable fixed width inside their horizontal scroller. The list has a name, role, and tier search so a large club can find a player without shrinking cards to fit the row.
- A paid pack deducts its listed price once. Duplicate pulls upgrade the owned card and refresh that card in the active lineup; they never pay coins back during purchase. Free supply packs leave the coin balance unchanged. The opening summary shows coins spent and the remaining balance. The initial club owns the current pack pool, so pulls currently train existing cards unless the roster has been reduced.
- Avatars have nine combat types: Carry, Support, Nuker, Disabler, Jungler, Durable, Escape, Pusher, and Initiator. These are play tendencies displayed in the avatar hub and draft; they do not modify base combat stats. Stonewake explicitly favors Initiator and Disabler, with Durable and Support tendencies. The taxonomy is inspired by [Dota 2's Earthshaker hero page](https://www.dota2.com/hero/earthshaker); Stonewake's values are original to this arena.
- An area control avatar chooses a target within its real cast range that catches a group. Stonewake's Faultline and Nullweaver's opening control look for multi-target lines or clusters when the player has enough IQ and teamfight skill. For self-centered ultimates such as Stonewake's Quake Chorus, the decision counts enemies inside the actual radius around the caster. High-IQ/high-TF players usually hold the ultimate for a cluster and nearby ally follow-up; emergency protection of a wounded carry can justify a single-target cast. Lower-rated players may commit earlier under pressure. Existing cooldown, mana, crowd-control chain, and combo rules still apply.

## Sylla Spirit Bear

- Summon Spirit Bear creates one visible companion per Sylla, with its own health bar and `SPIRIT BEAR` label. The old tiny cub baked into Sylla's character sprite is removed.
- The bear starts near Sylla, follows him when idle, pursues the enemy picked by Skill 1, and attacks nearby enemy champions, creeps, or structures. It is represented as a special melee minion so normal hostile attacks and turret shots can kill it. Its attacks credit Sylla for damage and last hits.
- Recasting Skill 1 heals the existing bear and changes its focus instead of multiplying summons. The bear disappears when its owner dies. Health rises from 1,080 at level 1 to a cap of 1,800; attack damage rises with level. Skill 1 still applies its immediate root and impact.
- Savage Roar checks enemy proximity to both Sylla and a living Spirit Bear, and shows a roar effect at each origin.
- A sprite smoke test checks the model renders for both teams. The browser replay was visually reviewed with Sylla drafted on blue at 0:17 game time; [the captured frame](sylla-live-review.png) shows the bear's readable foreground sprite and label in a crowded fight. [The jungle frame](jungle-live-review.png) and a scouted Gravemarch view were also inspected. `npm run check:game` passed with 89 tests plus design checks, and `npm run build` passed.

## Avatar Skill Audio

- All 39 playable avatars have a recorded cue for Skill 1, Skill 2, and Ultimate in the main arena and the avatar hub preview. Passives have no cast event.
- Each cue combines a primary material sound with a quieter accent. Avatar and slot choose a stable pitch, gain, and timing; audio playback never consumes the match simulation's random stream or changes combat results.
- The source recordings are 27 `.ogg` files selected from Kenney's CC0 RPG Audio, Impact Sounds, and Sci-fi Sounds packs. Pack provenance and the CC0 license are recorded in `EsportsClash.Web/public/audio/kenney/README.md`.
- Audio buffers load after a user interaction. Repeated casts of the same avatar skill within 145 real milliseconds are throttled; the mix caps at 16 active voices, with basic skills suppressed above 12 to reserve space for ultimates. Missing or blocked recorded audio falls back to the existing short synthesized hit cue.
- Generic projectile impacts use a quiet Kenney impact recording, and boss or structure explosions use a Kenney explosion recording. Their playback is throttled separately so they do not bury named skill cues.
- `src/avatarSkillAudio.test.mjs` verifies all 117 active skill cues are defined, each avatar's three primary recordings differ, and all referenced recordings ship with the web app. This is structural verification; live speaker mixing is a remaining listening task.

## Active Ability Runtime Rules

- Nullweaver's Singularity Well is a 3.2-second channel centered on its target. Enemies within 150px are pulled, briefly held, and damaged every 0.4 seconds. Stun, knockup, fear, charm, or death interrupts the channel. Higher-IQ/high-teamfight allies focus caught enemies; similarly rated enemies target the channeler. The persistent black hole effect only renders while the channel is active.
- Raijin's Ball Lightning has fixed 3, 2.3, 1.6, and 1 second cooldowns at ultimate ranks 1 through 4. It costs 58, 63, 68, and 73 mana respectively. Ability haste does not reduce this cooldown below its stated rank value. Mana capacity starts at 100 and increases from item mana stats; item mana regeneration adds to natural regeneration. Aegis Orb, Forgotten Grimoire, Thunderclap Staff, and Tempest Folio have functional mana stats. Raijin's purchase planner values mana and regeneration so repeated jumps require item investment.
- Renn's Gilded Vault, Harmonic Waltz, and Dazzling Rush travel over time with a visible trail. Vault control and damage occur on enemy contact; Rush charms each enemy it crosses once. Kaolin's Rolling Boulder replaces his sprite with a rotating boulder until first enemy contact or maximum travel, then applies its damage and knockup. Paxi's Illusory Orb has a timed traveling position; it damages an avatar once per pass and eligible AI jaunts to its still-active position when it offers a useful engage.
- Tequoia's Forest Link replaces Awaken Treants. It links every living avatar in a 125px target zone for four seconds. After shields, 10% of actual health lost by one linked avatar is dealt as true shared damage to each other linked avatar, with no recursive sharing. An ally hit through the link does not award a teamkill to a friendly attacker. Higher-IQ Tequoia players require more enemies than allies in the zone before casting.
- Cinderlock's Q costs 20 mana per stage: dash to target, ignite, and critical magic strike while ignite lasts. Each follow-up must occur within 3.5 seconds and within close range; after stage three or an expired sequence, the normal Q cooldown starts. Ash Veil grants 3.5 seconds of invisibility and 60 movement speed until it expires, Cinderlock attacks, or damage reveals him. Detection at close range still works.
- Defensive and setup Skill 2 casts are evaluated before Skill 1. A self or ally Skill 2 does not need the enemy within its own cast range; hostile control skills retain their range. Higher card IQ still holds crowd control to avoid wasting an active stun.
- Decision, files, verification, and remaining visual review limits for this request are recorded in `docs/agent-handoff.md`. `npm run check:game` passed 101 tests plus design checks, and `npm run build` passed.

## Forest Link Readability, Neutral Reach, and Match Insights

- Forest Link is indicated by a green `LINKED` badge above each affected avatar's IGN. No connector lines or area ring remain after the cast. Shared damage and the four-second duration follow the existing Forest Link rules.
- A champion's basic attack against an ordinary jungle camp is capped at 130 arena units, or 145 against Embermaw and Gravemarch, with the existing 12-unit collision allowance. The same cap applies when the attack resolves. Champion-versus-champion range is unaffected. Runaan bolts do not branch from neutral, boss, or structure attacks.
- Higher-IQ and teamfight-rated avatars may spread when a ready, mana-funded Nullweaver is nearby. Eligible crowd-control users preserve an interrupt against a healthy ready Nullweaver, then release it once Black Hole is channeling. Low-health kill opportunities and vulnerable users are exempt from the hold. Paxi can cast her orb toward home under threat and jaunt to it while active if it improves her distance from both the well and nearby enemies.
- Each match keeps per-avatar Q/W/R cast totals, skillshot attempts and hits, throttled mana shortage windows, interrupted Black Holes, and Paxi engage or escape jaunts. The live Insights panel exposes a time-windowed decision and cast timeline. Saved reports carry the same counters; balance runs aggregate selected metrics. The panel is an event inspector, not a video replay.
- The decision, affected files, verification, and remaining limits are recorded in `docs/agent-handoff.md` under **Forest Link Marker, Neutral Range, and Match Decisions**.

## Channeled Ability Follow-Up Engage Invariants

- Channeled abilities (`blackHole`, `corsaraBarrage`, `monkeySpin`) are classified as aggressive initiations rather than vulnerable states requiring defensive peel.
- Allies never select a channeling teammate as a carry to peel for in `chooseTeamfightTarget`.
- High-TF macro grouping (`fightingAlly`) explicitly excludes channeling teammates so allies never path toward the channeler and cancel their own combat loop.
- When an ally channels an ability, all living allies within 650px prioritize enemies caught in or targeted by the channel (enemies in Singularity Well, Broadside Waltz cone, or Cyclone Dance radius), sorting by lowest health and squishy carries.
- Living teammates with at least 25% health recognize the engage opportunity: retreat and recall channels are suppressed, lane wave-clearing is deferred, combat engagement radius expands to 550px, and units sprint at +30 movement speed toward the engaged targets while displaying a `⚔️ FOLLOW-UP ENGAGE!` floater.
- When the channeled ability ends or is interrupted, units smoothly transition back to standard arena engagement and wave-clear priorities.
- Regression tests in `src/combatDecision.test.mjs` verify peel exclusion, target prioritization, and follow-up ultimate triggering.

## Tower Dive Limits, Avatar Durability & Emergency Evacuation Invariants

- **Avatar Durability & Role Limits (`getAvatarDiveLimits`):**
  - Towers deal 288-396 true damage per shot. Champions must have sufficient durability to absorb at least two full turret shots before considering a dive.
  - Tanks: Require at least 40% max HP and 650 raw HP; may solo dive low targets ($\le 38\%$).
  - Fighters: Require at least 45% max HP and 600 raw HP; target $\le 35\%$.
  - Assassins: Require burst cooldown readiness (`cd1 <= 0` or `cdUlt <= 0`), at least 45% max HP, and target $\le 32\%$.
  - Squishy Mages & Marksmen: Strictly forbidden from diving into melee turret range without an active allied minion wave buffer under the tower; require at least 58-60% max HP; target must be an absolute execute ($\le 18-20\%$).
  - Supports: Never solo dive; require at least 55% max HP and minion wave presence.
- **Player Card Invariants:**
  - High IQ ($\ge 75$) players demand minion wave crash ($\ge 2$ minions under tower), calculate lethal burst windows, and never dive when outnumbered (`defendersUnderTower > attackersUnderTower`).
  - `Aggro Diver` trait enables calculated aggression on low targets ($\le 38\%$), but respects avatar limits and will never suicide dive when wounded ($< 30\%$ HP) or outnumbered.
  - In `chooseTeamfightTarget`, enemies standing under live opposing turrets receive a $-3.8 \times \text{IQ} \times (\text{isSquishy} ? 1.5 : 1.0)$ safety penalty to prevent tunneling into enemy defenses.
- **Turret Perimeter Tethering:**
  - Non-diving units hold at `getTurretPerimeterHoldPoint` (safe boundary 28px outside turret attack range), allowing ranged champions to poke safely from outside the turret radius and melee champions to wait with their minion wave.
- **Failed Dive Abort & Emergency Turret Evacuation (`shouldAbortTowerDive`):**
  - When an in-progress dive fails (target killed, target in Zhonya's Golden Stasis or untargetable, target heavily shielded, diver taking turret fire with dropping HP, dive duration $> 2.6$s, or minions wiped), the diver triggers immediate emergency evacuation:
    - Sets `diveAborting = true` and `diveAbortCooldown = 3.5s`.
    - Displays `🏃 ABORT DIVE!` floater.
    - Acquires `getTurretEvacuationVector` directed straight away from the turret toward home lane safety.
    - Receives a $+35$ movement speed emergency evacuation sprint bonus.
    - Suppresses routine auto-attacks and skill casts to avoid stopping inside turret range.
    - Clears abort state once safely outside the turret attack range $+50$px.
- **Turret-Safe Bush Invariants:**
- Regression tests in `src/towerDiveLimits.test.mjs` verify all avatar limits, player card factors, failed dive abort triggers, emergency evacuation vectors, and bush safety checks.

## Nature Link (Tequoia Skill 2) Invariants & Status Representation

- **Enemy-Only Targeting:**
  - Tequoia's Skill 2 (`Nature Link` / `Forest Link`) exclusively targets and links enemy champions (`e.team !== u.team`). Allied champions are never linked and never take shared damage.
  - AI cast logic in `combatDecision.ts` evaluates enemy clumping ($\ge 2$ hostile champions within 125px or $\ge 1$ in an active teamfight) without requiring friendly count checks, allowing aggressive usage even with melee allies engaging in the center.
- **Shared Damage Clutter Elimination:**
  - When linked enemy champions take shared health damage (10% true damage propagated to all other living linked enemies), repetitive floating text labels (`Nature Link -XX` / `Forest Link -XX`) are suppressed in `applyDamageToChampion`.
  - This eliminates visual screen clutter when 4 or more heroes are linked, keeping the battlefield clean and legible while preserving full health bar depletion and combat logs.
- **Unique Status Crest & Visual Links:**
  - The overhead rectangular `'LINKED'` text badge is replaced with a custom circular emerald crest icon at `(u.x, barY - 18)`.
  - The icon features interlocking vine chain rings, an emerald leaf bud accent, and a radial arc that ticks down with remaining link duration.
- Regression tests in `src/combatDecision.test.mjs` verify AI cast decisions with clustered allies and enemies.

## Equalized 100 OVR Draft Mode (Normal Game · No Rank)

- **Squad Lineup Bypassed & 100 OVR Normalization:**
  - In Clash Arena, players can launch `Equalized Draft (Normal · 100 OVR · No Rank)`. In this mode, user squad cards, bench cards, and collection ratings are completely bypassed.
  - Every player card in the game (the pool of 63 athletes) is equalized to 100 Overall GOAT tier with 100 in all stats (`lan`, `tf`, `iq`, `clu`, `sta`, `flx`), all combat roles unlocked (`playableRoles`), and all avatars registered as signatures.
  - `playerCardCombatPower` yields an identical maximum multiplier of 1.05 for every avatar, creating complete mechanical stat parity.
  - Both teams are guided by equalized Master Tactician coaches (`EQUALIZED_COACH_BLUE` and `EQUALIZED_COACH_RED`) with identical 10 playbook and 10 chemistry bonuses.
- **Two-Phase Draft Flow:**
  - **Phase 1: Player Card Draft (`PlayerDraftPhaseView`):**
    - Blue (User) and Red (Opponent AI) participate in a 10-turn Snake Draft (`PLAYER_DRAFT_TURNS`: Blue -> Red -> Red -> Blue -> Blue -> Red -> Red -> Blue -> Blue -> Red).
    - Coaches draft 5 starting athletes across TOP, JUNGLE, MID, BOT, and SUPPORT slots.
    - AI Coach evaluates complementary roles, trait synergies (`Shotcaller`, `Clutch King`, `Aggro Diver`, `One-Tap God`), and origin chemistry.
    - Supports card search, role/origin filters, slot targeting, and an "Auto-Draft Rest" button for quick simulation.
  - **Phase 2: Avatar Draft (`DraftPhaseView`):**
    - The drafted 100 OVR Blue and Red rosters sit on stage to draft their avatars via standard ban/pick phases.
    - Coaches can return to Phase 1 (`← Back to Player Draft`) at any time before avatars lock in.
- **Pure Draft Outcome & Zero Rating Risk:**
  - Because all 10 players have identical 100 stats, victory is determined purely by drafting strategy, player trait moves, avatar synergies, and arena execution.
  - The mode is strictly a Normal Game: Chess Elo rating is never risked or modified.
  - Normal multiplayer rooms (Vs Player) also feature an `Equalize to 100 OVR` toggle to enable casual equalized friendlies between players.
- Regression tests in `src/equalizedMode.test.mjs` verify 100 OVR generation, Cardrel parody alias preservation, stat parity (1.05 power across avatars), snake draft turn structure, AI pick complementary role selection, and coach equity.

## Ability and Teamfight Decisions (Current)

- Nullweaver's Singularity Well has a 105px pull radius and 175px cast reach. Corsara's Broadside Waltz is a repeated-wave channel that crowd control or silence can interrupt. Faelith, Oathmute, Cloudtail and Stonebranch have separate original kits; Cloudtail and Stonebranch are brothers in the game's lore. `docs/ability-balance-review.md` lists the per-avatar balance observations and proposed measurements.
- A team remembers an enemy Q, W or R cooldown only after a nearby living ally sees that ability used. Oathmute's global ultimate reveals its own cooldown to both teams, without revealing unseen Q/W casts. Knowledge expires when the observed cooldown is expected to finish. Teams presume unknown enemy abilities may be ready.
- Higher-IQ cards use remembered ultimate and key-skill downtime to choose fight targets, judge incoming damage, time Black Hole spacing and bait an enemy skill from cover. Objective contests use the same target knowledge. Cards with lower IQ make these reads less consistently. Ratings change decisions, not combat stats.
- An allied channel is an engage opportunity only for teammates who can survive their local fight. The retreat check compares nearby pressure, available personal damage, allied help and reachable targets. A low-health enemy is not a safe finish when multiple nearby opponents can punish it. Clutch and Unkillable traits obey the losing-fight check.
- `src/cooldownKnowledge.test.mjs` and `src/blackHoleCounterplay.test.mjs` cover visibility, global casts, memory expiry, IQ-dependent retreat and target choice, multi-enemy finish bait, and Black Hole danger. `npm run check:game` passed 153 tests plus design validation and TypeScript; `npm run build` passed.
- Cooldown estimates do not follow hidden cooldown resets or post-cast haste changes. Balance and teamfight timing still need a complete stable live match batch.

## Respawn and Hook Travel

- Champion death timers use `calculateDeathTimer` in `src/combatPacingRules.ts` for both combat and fountain deaths. The current checkpoints are 8 seconds at level 3/1:00, 13 seconds at level 10/4:00, 20 seconds at level 15/8:00, 27 seconds at level 18/12:00, and a hard cap of 28 seconds.
- Mirehook, Voltgrip, and Wraithhook Skill 1 remain dodgeable projectile hooks. Their projectile head and chain are drawn during flight. A hit applies ordinary damage/control and starts a visible grab: the victim travels toward the living caster at 560 world units per second, stopping 43 units away. The pull lasts at most 1.1 seconds, stops if the caster dies, and interrupts recall. No instant position jump is permitted for these hooks.
- `src/combatPacingRules.test.mjs` checks the timer curve and that a hook pull takes several simulation ticks. `npm run check:game` passed 155 tests plus design validation and TypeScript; `npm run build` passed. A live desktop match showed a hook chain in a crowded fight ([frame](hook-live-review.png)); a frame-by-frame pull capture and measured kill-to-structure conversion remain open.

## Raised Base and Gravemarch Siege Rules

- The arena remains 2000 world units wide. Wells are at x=65/1935, Nexuses at x=205/1795, matching barracks at x=345/1655, and third turrets at x=420/1580. Each barracks is 140 units from its Nexus; the raised base extends from the third turret through its well. The raised stone and drifting mist are visual terrain and currently give no height-based attack or vision bonus.
- Four entrance bushes at x=540/1460 on the north and south flanks precede the ramps. They follow ordinary bush concealment, ward, and reveal rules. The rocky clusters between camps and epic pits were made solid in the follow-up below.
- The neutral Gravemarch Colossus starts absent, awakens once at 2:00, and never respawns after defeat. A claim queues exactly one friendly siege Golem for the claiming team's next 22-second creep wave. The lane model uses the same 1.7 scale as the neutral model, with its health bar and name raised to fit. Its charge still targets a living enemy tower. Embermaw starts absent and first awakens at 4:00.
- After a champion kill, an AI card may keep a short structure-push call when at least two allies survive, they outnumber living enemies, the next enemy structure is within 900 units, and the actor is healthy and not losing its local fight. High-IQ cards or strong macro coaches keep the read up to 18 seconds at 35% health; others require 48% health and a kill within 12 seconds. While the call applies, shopping recall, optional jungle farming, fresh epic starts, and passive regrouping yield to the lane siege. Dangerous fights still trigger retreat. This is a decision rule, not a damage buff.
- `src/arenaRules.test.mjs`, `src/macroFarmRules.test.mjs`, and `src/siegeGolemRules.test.mjs` cover the new geometry, entrances, push call, and awakening. `npm run check:game` passed all 157 tests, design validation, and TypeScript; `npm run build` passed. A live visual review of the claimed reinforcement remains open.

## Solid Rock and Nexus Volley Rules

- `CAMP_ROCK_RINGS` in `src/arenaRules.ts` defines one nearly circular, raised stone enclosure around each of the eight ordinary camps and both epic pits. Each ring has a lane-facing opening wide enough for an avatar to enter; the two top buff camps were moved outward so their walls do not overlap adjacent camps. Mirrored rows of solid stones frame the north and south sides of each high-ground ramp, leaving its central stair open at lane y=380. Farming AI uses `rockApproachWaypoint` to reach the open ramp stair and camp gate, including routes from either base to upper and lower flank camps. `ROCK_TERRAIN` supplies both collision and canvas footprints. Champions, minions (including the claimed Colossus and Spirit Bear), and neutral camps cannot occupy these footprints. Movement is swept in short steps to prevent short dashes crossing stone. A teleport longer than 350 units can cross stone but its destination is pushed clear if it lands inside it. Rocks currently block units, not spell projectiles.
- Alive barracks have unique canvas models: a Melee forge with crossed blades, a Ranged watchtower with a drawn bow, and a Catapult siege yard with wheels and a loaded arm. Destroying each barracks retains its matching creep upgrade rule.
- The Nexus is drawn at 1.85 scale with six orbiting emitters. Its existing volley remains five pulses at 0.2-second intervals followed by a 2.2-second reload. Each pulse picks up to six **distinct** targets in range, prioritizing a dive aggressor and then champions before minions, and fires one true-damage shot at each. A unit is never hit six times by one pulse solely because fewer targets are present. The current 85 damage per shot is unchanged.
- `src/arenaRules.test.mjs` checks five-pulse timing, six distinct targets, collision, each camp opening, nearby lane approaches, both central high-ground stairs, and farming routes from both bases to upper and lower camps. `src/siegeGolemRules.test.mjs` checks the 2:00 one-time awakening. The Dragon's first spawn time is 4:00. Rocks do not absorb projectiles; non-farming pursuit still uses local collision rather than a general pathfinder.

## Natural Geological Rock Formations and Cove Embankments

- **Continuous Bedrock Foundations (`drawRaisedRockTerrain` in `AramMatchView.tsx`):**
  - Camp walls are drawn over a continuous curved bedrock embankment along the non-entrance perimeter (`entrance + 0.62` to `entrance + 2*Math.PI - 0.62`).
  - Highground walls have continuous horizontal bedrock shelves connecting the 3 stones in each row.
  - This eliminates isolated "teeth" and embeds all camps naturally into organic cliff coves.
- **Procedural 3D Organic Boulders:**
  - Deterministic coordinate hashing (`rockHash`) varies rock width, height, chiseled vertices, and tilt per stone without any frame jitter.
  - Boulders around camp perimeters align tangentially with the cove curve, naturally wrapping around the clearing.
  - Multi-faceted 3D lighting: soft ground contact shadow, dark under-facet base, midtone body with directional light gradient, sunlit upper-left crest facet, chiseled ridge highlights, and hairline fracture fissures.
- **Biome Theming:**
  - **Dragon Pit (`dragon_boss`):** Scorched basalt/obsidian, glowing molten magma veins (`rgba(249, 115, 22, 0.85)` / `#fed7aa`), amber ember rim lighting, no green vegetation.
  - **Siege Golem Pit (`j_siege_golem`):** Ancient monolithic runic slate with deep teal lichen (`#0d9488`).
  - **Jungle Camps:** Weathered river granite with lush emerald moss patches (`#047857`, `#10b981`) and base scree pebbles.
  - **Highground Base Ramps:** Fortified masonry bedrock ledges.
- **Invariant Protection:** All 132 `ROCK_TERRAIN` positions, radii, and collision tests in `arenaRules.ts` remain identical, ensuring zero regression to pathing, movement, or dash clipping.
