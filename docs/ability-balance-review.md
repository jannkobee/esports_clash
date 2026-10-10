# Ability balance review

This is a static review of all 45 current avatar kits in `src/mockData.ts` and `src/additionalChampions.ts`, their cast branches in `src/components/AramMatchView.tsx`, and AI choices in `src/combatDecision.ts`. It records proposed tuning, not changes already made. The game's ability-rank multiplier, armor, items, target count, and the match clock make displayed base damage an incomplete measure of power. Compare equal-card seeded drafts before changing numbers.

## Rules to measure first

1. **One-button fight swings:** measure damage, enemy seconds controlled, and allies saved per ultimate cast. A large area ultimate should have a clear approach risk, aim requirement, delay, channel, or interrupt window. Nullweaver now has a 105-unit hole radius and 175-unit cast range; Corsara's six-wave cone now requires a stationary three-second channel.
2. **Stacked hard control:** the existing chain-stun cap is 3.5 seconds, but several kits offer multiple hard-control buttons. Measure actual time a target cannot act and the percent of casts used on already controlled targets. Shorten repeated control before lowering every ability's damage.
3. **Safety plus damage:** an escape, stealth, invulnerability, or death-prevention skill should cost a meaningful damage opportunity. Track kills and deaths within five seconds after using one.
4. **Mana pressure:** Raijin's one-second late-rank ultimate and all frequent Q casts need actual mana-shortage telemetry. An empty bar should change the fight rather than be hidden by passive regeneration or attack refunds.
5. **Description fidelity:** several inherited tooltips promise effects that are simplified in the runtime. Audit every Q/W/R description against its actual cast branch before tuning by tooltip numbers. Treat draft database `winRate` values as authored metadata, not measured balance results.

## Per-avatar review

| Avatar | Kit balance suggestion |
| --- | --- |
| Solana | Q, W, and R can all control. Measure full lockdown from one opener; shorten overlap if a target stays helpless past the chain cap. |
| Astra | Q volley and global R are strong safe openings. Track long-range hit rate by card skill; narrow projectile width before lowering damage. |
| Kyumi | Q poke, W charm, and mobile R combine burst with safety. Limit repeat engages when her own team has no follow-up. |
| Buck | Close-range Q and recoil R should win only when he enters danger. Compare damage after recoil with his survival rate. |
| Valkira | Her target access and R execute can make low-health carries unavoidable. Require a reachable, visible target and track turret-dive deaths. |
| Kage | The delayed R mark creates counterplay only if the victim can survive or break contact. Track execution rate after the mark. |
| Kazemaru | Frequent Q plus airborne R may overcapitalize on allied knockups. Track R casts without a real airborne setup and cap repeated lockdown. |
| Kindra | R's death prevention is a major fight reset. Measure how many allied deaths it prevents and whether a single late cast reverses several kills. |
| Cora | Her root and aerial R can be safe together. Track misses and post-R survival before touching damage. |
| Renn | W/R multi-target initiation depends on entering danger. Track how many enemies each dash actually touches and whether he survives disengage. |
| Sylla | Spirit Bear adds persistent damage and a second attack body. Track bear uptime and structure damage separately from Sylla's own damage. |
| Tequoia | Q cage, Forest Link, and bouncing R can punish clusters. Track friendly shared damage as well as enemy shared damage. |
| Zal | W sustain plus R death prevention can stall finishes. Measure seconds of effective invulnerability and test focus switching afterward. |
| Xin | Short Q and mobile R should reward flank setup. Check whether the R bypasses terrain and turret risk too cheaply. |
| Raijin | R cooldown reaches one second. Use mana-wait count and burst per mana to tune item dependence; avoid a blanket damage nerf first. |
| Kaolin | W rolling contact is readable, but Q/R control can repeat immediately. Measure consecutive CC and roll miss rate. |
| Inai | R line strike and stealth make target access strong. Track attacks from unseen positions and counter-ward response. |
| Veyara | Q root, W dash, and large R burst can erase backlines. Use target-count and miss-rate data to tune the shockwave rather than flat AD. |
| Cinderlock | Q has three stages and W stealth. Measure how often all three stages land and how often he escapes afterward; shorten the recast window if completion is trivial. |
| Solenne | Q heal and R shield/damage combine team offense and defense. Keep saved ally health visible in the match report before buffing direct damage. |
| Croakwell | W disruption and R team heal may be stronger than its modest damage suggests. Measure team health restored and control hits. |
| Soulscourge | R is high area damage and fear. Watch clustered multi-kills and require an audible, visible warning before damage lands. |
| Stonewake | Q fissure and R quake are major setup. Track enemies hit per R and reduce single-target reliability if teamfight value stays high. |
| Mirehook | A dodgeable Q should create most of his kills. Track hook hit rate and follow-up time; avoid making R a guaranteed kill without the hook. |
| Nullweaver | The compact channeled R is high-impact but interruptible. Measure targets caught, damage completed, and interrupts at different card ratings. |
| Voltgrip | Long Q hook plus W/R control can chain a caught victim. Track hook accuracy and total CC per pick. |
| Aetherbolt | Q poke and mobile W are safe, while R covers a wide lane. Measure hits from outside retaliation range. |
| Corsara | Six-wave R now rewards setup and punishes poor positioning. Measure full versus interrupted channels, target count, and damage by wave. |
| Brewmaw | W engage and R displacement may create too much guaranteed setup. Track whether the scattered enemy actually lands in allied reach. |
| Wraithhook | Q and lantern defense are both valuable. Measure ally shields used and hooks landed before changing raw damage. |
| Kaelen | His invoked R can strike every foe. This global area damage is a high-priority outlier; give enemies a warning or spatial dodge window before adjusting base damage. |
| Hweilin | W ally defense and R area control can cover too much space. Track actual enemy time in the bloom and ally shield consumed. |
| Jaxon | Fast Q and 45-second base R create frequent power spikes. Track damage per minute by phase and whether R is ready every fight. |
| Valerie | Q/W access plus target-lock R may deny escape. Track R target survival after ally peel and consider a clear travel warning. |
| Jinxy | Fast Q and global execute R can snowball. Track R kills at long distance and whether enemies could see and dodge the rocket. |
| Paxi | Q orb and Jaunt now support engage and escape. Track escape jaunts, orb misses, and deaths before lowering mobility. |
| Batrix | W knockback plus R drag can displace a carry far. Track actual travel and whether the opponent has an interrupt chance. |
| Quillback | A four-second W spam and durability may hide excess area damage. Measure damage per second in long fights and mana waits. |
| Aetheris | Teamwide R sustain plus partner buffs can be stronger than his own damage. Track healing, shields consumed, and partner damage enabled. |
| Faelith | Q is dodgeable, W transmutes one target, R protects one wounded ally. Track ally health saved; avoid letting W and R deny the same attacker for too long. |
| Oathmute | W and global R interrupt channels. Measure casts denied and channel interrupts; lower silence duration if one cast routinely shuts down a whole teamfight. |
| Cloudtail | W creates a brief visual decoy and stealth, R spins close to enemies. Track R hits per cast and whether the decoy changes target decisions; improve decoy behavior before raising damage. |
| Stonebranch | Q line stun, W canopy leap, and stationary R court reward location choice. Track time enemies remain in the court; favor a clearer escape route over a damage nerf. |
| Stepstone | Bellbreak Kick deals rank-scaled single-target damage and sends an enemy toward nearby allies. Measure how often the displacement benefits an allied follow-up, its effect on target deaths, and whether arena-edge clamps produce awkward landings. |
| Skybreaker | The aerial artillery carry attacks safely from extended range. Track salvos landed per fight and deaths caught during barrage setup before tuning the physical burst. |

## Measurement plan

- Run at least 25 seeded matches per comparison with identical drafts, card ratings, coach, and item rules; then swap only one avatar or one rule. Log win rate with uncertainty, match duration, kills, objective takes, item timings, and per-avatar Q/W/R casts, hits, mana waits, interruption count, and damage/healing where available.
- Split by low, middle, and high player-card IQ/TF bands. The retreat rule now considers available damage and nearby help for every card; traits may change willingness but cannot override a clearly losing fight.
- Inspect a live match for every high-impact channel and escape. The current Insights panel has cast and decision events, but not position snapshots, ally health saved, or detailed per-ability damage yet. Those are measurement gaps for the next balancing pass.

The new inspirations use distinct fictional names and original visual/audio assets. Ability themes were checked against [Lulu's official champion page](https://wildrift.leagueoflegends.com/en-us/champions/lulu/), [Dota 2's Monkey King introduction](https://www.dota2.com/700/monkeyking), [Dota 2's Silencer ability build](https://www.dota2.com/workshop/builds/view?embedded=workshop&publishedfileid=2917636763), and [Miss Fortune's official champion page](https://www.leagueoflegends.com/en-gb/champions/missfortune/). These sources informed the themes; the names, visuals, timing, and damage values are original to this arena.
