# Arena mechanics and regression rules

This file records the intended simulation behavior. When changing the arena, update these rules and run `npm test` and `npm run build` in `EsportsClash.Web`.

## Team decisions

- The same rules govern blue and red. Player IQ affects macro choices and spell timing; LAN affects farm, wave clear, skillshot aim and dodge; TF affects target choice and coordinated fights. Chemistry and coach playbook affect team objective calls. These ratings make strong play more likely without forcing a predetermined winner.
- A player should clear an enemy wave before hitting a fortified tower when allied creeps are absent. Skilled wave clear avatars can spend a ready skill on a clustered wave. Creeps then crash and increase siege damage.
- Embermaw and Gravemarch calls require a pushed wave, pit vision, at least three healthy nearby allies, few nearby enemies, and enough player/coach macro rating. Match time is an earliest availability gate, not an automatic call. The 1x/2x/4x control changes playback rate only.
- Skill one projectiles for the seven newest avatars use cast-time aiming and path collision; targets can leave the path. A learned combo only advances its projectile opener after a real hit.

The objective decision reflects the importance of [lane priority, vision and coordinated objective play in Riot's patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) and [objective voting and jungle leash principles](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/). The code uses original thresholds scaled to this compact arena.

## Map and neutral units

- Each side has three turrets, three class-specific barracks, a large defensive nexus, a wide home well and a visible shop. Turret plating reduces opening siege damage and fades continuously by game minute eight, allowing a pushed wave to close a decisive game sooner. The nexus fires five rapid turret shots per volley, then reloads for 2.2 seconds; a continuous five shots per second erased upgraded waves and stalled exposed nexuses. It stays sealed until its nexus turret and at least one barracks have fallen. AI attackers should target the barracks while the nexus is sealed. Destroying a barracks upgrades only the matching melee, ranged, or catapult creeps on later waves.
- Camps and Embermaw remain passive until hit. Aggroed camps leave their tree-ring home to chase the attacker, fight back, then return and heal when the target leaves the leash. Their home ring never moves with them.
- Four crest camps, one blue and one red on each side, give the killing team a 90-second buff: blue increases mana recovery and red adds attack damage.
- The lower Gravemarch Colossus grants its slayer's team a siege golem with each wave for 125 game seconds. The golem is a larger, tougher siege unit and the neutral boss respawns later.
- Every avatar may place a free ward in a nearby unwarded bush when its personal ward cooldown is ready. Wards last 75 seconds, reveal that bush for their team, and carve a visible hole in the fog.

## Combat and economy

- Matches end when a nexus falls. There is no required duration; a strong early push can finish sooner. Opening runs before minute 4, mid game begins at minute 4, and late game begins at minute 8. These are timing labels, not match-ending rules.
- Pacing sanity check: 25 completed matches with one balanced draft after the durability and volley changes averaged 421 game seconds; 18 ended before minute 8 and the longest took 655 seconds. This sample is a regression reference for that draft, not a fixed match duration.
- Both basic skills begin at rank 1 and about 38% of their reference damage at avatar level 3. Skill one ranks up at levels 4, 5, 7 and 9; skill two at 6, 8, 10 and 12. Their damage, direct healing, shields and cooldowns grow with rank. Ultimates unlock at level 6 and rank up at 11 and 16; early ultimate damage and utility are weaker. This scaling applies to champion hits and skill wave clear, while basic attacks and neutral damage keep their own values.
- The top kill score equals recorded player kills. If a camp or Embermaw lands the final blow, the most recent opposing avatar to damage the victim in the previous ten game seconds gets the kill, gold, XP, and any multikill credit. An untagged neutral death remains an execution. Turret, creep, and well deaths keep their current attribution. Double through penta callouts require consecutive kills by the same player no more than three game seconds apart; a seven-second gap resets to a normal kill.
- Completed items cost 65% of their original arena price; starting items and components retain their costs. Income rises with LAN, so stronger farmers reach item spikes sooner. After minute 8, high-IQ players may recall safely on a smaller gold spike to convert that farm into items. Item inventory snapshots at 8, 10, 12 and 13 minutes only include games that reached those checkpoints. Component cost is credited in full on completion, and later purchases may sell a weaker item. Boots use their own slot and add movement speed; the free ward has its own slot.
- Item purchases happen only when the avatar is inside its own home base. Recalls and respawns return avatars there; field shopping should never occur.
- Player name appears above the battlefield avatar and avatar name below it. The squad item HUD is docked. The 1x/2x/4x control has no influence on AI target or objective conditions.

The seven recent avatars and their [official basis references](avatar-animation-references.md) have original playable names, silhouettes and effects. Their hooks, bolts, casks and follow-up skills use distinct animations and outcomes.

## Replays, balance and spectator cues

- Arena combat advances at a fixed 30 game ticks per second. Playback speed changes how many ticks run per real second; it does not change tick size. Each draft receives a random seed, and all arena random choices use that seed. Stasis also expires on game time.
- **Replay** restarts the current draft with its seed. **Export** saves a completed match report with its seed, full draft, outcome, ratings, kill totals, skillshot counts and timestamped events. On the draft screen, **Replay last saved match** or **Open match report** loads that draft and seed again. Replays never award tournament rewards again.
- **Run 25** simulates 25 actual arena matches with the current draft. Consecutive matches share a seed and swap both lineups and coaches between sides; the last match uses a fresh seed. Those matches do not award tournament rewards. **Stop** cancels the remaining batch. **Export balance** saves the batch reports and summary. Completed reports accumulate locally in the browser, with aggregate game length, blue-side win rate, higher-rated side win rate, skillshot hit rate, objective timing and item counts at 8, 10, 12 and 13 minutes. A checkpoint only appears in the average when a completed match reached it. Compare several drafts before changing ratings or economy.
- Objective calls enter the timestamped event log when a team actually chooses to move toward Embermaw or Gravemarch. Embermaw's Inferno Slam shows a clear circular warning for 1.1 game seconds. Damage and stun resolve at impact against avatars still inside the circle. Leaving the pit cancels the windup. Kill cards and power-spike banners sit in a rail above the canvas so they cannot cover the dragon or the fight.

## Draft and online rooms

- The arena dashboard offers **Vs AI** and **Vs Player**. The draft has one ban per side, followed by ten alternating snake-order picks. A banned or picked avatar is unavailable to every remaining slot. Each pick is assigned to an unfilled player card before lock-in.
- In Vs AI, the rival coach scores available avatars against player preferred role, signatures, frontline, wave clear, and coach style. A seeded tie break varies close fits, so a rival marksman does not always receive Astra. The coach uses its actual style and playbook rating; team composition can change the pick order.
- In Vs Player, two people join a six-character online room. The Node room server checks both identities, turn order, unique bans and picks, open roster slots, and revision numbers. Both clients receive the same lineups, coaches, and match seed. Match combat is AI controlled on both clients; the online interaction is drafting and watching the seeded simulation. In-memory rooms expire after two hours of inactivity and a server restart clears them. Room state is not a ranked result authority.
