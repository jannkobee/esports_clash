# EsportsClash — Original Roster Rebuild V3

**Status:** SPECIFICATION / CONCEPT, not implemented. **Roster:** 45. **Source of legacy IDs:** `avatar-ability-catalog-20261023.md`. **Supersedes:** `esportsclash-renamed-avatar-roster-v1.md` and the earlier teamfight-first redesign for ability behavior.

## Design mandate

A new costume is not a new combat identity. This document replaces the underlying kits, including those that resembled recognizable Dota/League signature combinations. In particular, **Lulla does not get orb/jaunt, phase shift, AoE silence, or dream coil; Mirelle does not get Quas/Wex/Exort or three-orb Invoke; Mora does not get hook/lantern/box; Garruk does not get hook/rot/dismember; Pippa does not get weapon swap/zap/global execute rocket; Ivera does not get stacked auto slows/global stun arrow; Nyxara does not get a shadow-clone teleport-and-detonate combo.** The other heroes receive equivalent full-kit audits.

Each entry: **legacy ID → permanent full name and title; role; original silhouette; gameplay signature; passive, S1, S2, R; answer/counterplay; bot decision**. Names are proposals, not proof of trademark availability. Ability numbers are *playtest starting points*, not replacements for telemetry calibration. Geometry uses normalized gameplay units (GU), assuming a champion collision radius near 18 GU and typical move speed near 100 GU/s; scale proportionately after verifying engine units.

### Shared rulebook

- Each hero has **P + S1 + S2 + R**. The sole exception is Mirelle's **ten selectable pattern finishes accessed from her R pattern palette**, not ten always-equipped spell slots. A selection is UI/config state, *not an extra free cast*.
- Recommended starting cooldowns: S1 7–12 s; S2 11–18 s; R 65–110 s; these are draft targets. Hard CC normally 0.45–0.9 s with >=0.35 s warning; no inescapable full-team CC. Max ally damage redistribution per effect and max delayed-damage queues must be bounded.
- All devices/marks/lines have ownership, createdAt, expiresAt, radius/segments, team rules, max charges, destruction/cancel rules, and VFX silhouettes. Collision/LOS and CC are authoritative engine effects; animations never control gameplay.
- Enemies receive enough information to respond: targeted projections, detonation countdowns, destroyable constructs, open exits, or meaningful ability-choice alternatives. Bots get the *same observable state* as players, not hidden outcomes.
- One-lane gameplay: kits must matter in a narrow lane, tower defense, wave control, flanking pockets, and boss contests. No kit depends on neutral camps, trees, respawn timing, or a side lane existing.
- **Role diversity:** initiator, punisher, anti-dive, ranged geometry, formation support, tactical rescue, combat economy, anti-channel pressure, and dynamic cover—not forty-five stuns.

---

## 01 — Solenne Vaelor, **The Sunwall Oath**
**Legacy:** Dawnna · **Role:** protector / angular defense. **Look:** battle-scarred sun knight with a tall hinged heliograph shield; ivory-bronze armor, burnt-red sash, mechanical iris on the shield. **Signature:** turns *facing and coverage* into a teamfight resource.

- **P — Earned Daylight:** blocking hostile damage with the front 110° of her shield stocks up to 3 Radiance (1 stack / 3 s). No free stacks for standing still.
- **S1 — Sun Dial** *(9 s)*: stakes a 70-GU-wide oriented shield panel for 3.5 s. Intercepts the first two hostile projectiles that cross its front; melee units pass. Opponents may walk around it.
- **S2 — Pivot Order** *(12 s)*: rotates an existing panel up to 100° or, if none exists, rotates Solenne's personal guard and advances 38 GU; Radiance spent gives adjacent allies a 1.5 s directional damage reduction against attacks coming from the chosen side.
- **R — Noon Divide** *(85 s)*: from her current panel, projects two slowly separating sunbeams for 4 s, creating a wide **protected wedge**. Allies inside gain 18% damage mitigation from outside; enemies inside can still fight. Spending 3 Radiance gives 1 brief shove at initial expansion (not a mass stun).

**Fight / counter:** take side angles, destroy the panel with two projectile impacts, or force her to protect the wrong flank. **AI cue:** place panel along highest expected incoming damage vector; rotate after the opponent changes angle, not on cooldown.

## 02 — Ivera Frostwhistle, **The Frost Resonant**
**Legacy:** Aiselle · **Role:** marksman / echo geometry. **Look:** tall northern bow engineer wearing permafrost string gauges and layered ice-tuning plates; asymmetric longbow bearing vibrating crystal forks. **Signature:** makes **resonant frost strings**, not auto-attack slow stacks.

- **P — Overtone:** landing a aimed shot temporarily tunes a visible location, maximum 2, each persisting 5 s. Shots do not globally slow.
- **S1 — Tuning Shot** *(8 s, two charges)*: fires a narrow bolt that installs a crystal fork at its endpoint (terrain or ground); fork has 2 hit points. Can be fired through a champion for light damage, but ends behind them.
- **S2 — Singing Ice** *(14 s)*: activates a frost vibration along the line between the two newest forks for 3 s. Enemies *crossing* the line suffer 28% slow for 1.1 s and take one burst; allies firing **parallel** to the line gain a small projectile-speed bonus.
- **R — Glass Rapture** *(80 s)*: resonates all active forks in a broad triangular sound field. Over 1.2 s the field forms three visible safe gaps; enemies still on the sounding lines take high damage and a 0.55 s stagger. Consumes forks.

**Fight / counter:** smash one fork, enter through gaps, or attack while Ivera is placing geometry. **AI cue:** span an objective exit or enemy retreat corridor, not chase a single stunned victim.

## 03 — Mireth Lune, **The Witness of False Roads**
**Legacy:** Vixelle · **Role:** route deception mage. **Look:** austere one-tailed fox archivist in deep blue-gray traveling robes with glass route tablets; no alluring charm trope. **Signature:** makes an enemy's *chosen route* risky, without mind control.

- **P — Witness Marks:** after an enemy moves 70 GU while visible to Mireth, records its heading as a glowing arrow for 3 s, once per enemy / 6 s.
- **S1 — Counterpath** *(8 s)*: draws a short luminous road across an observed heading. Crossing it in the recorded direction costs 25% move speed for 1 s; crossing opposite grants no penalty. Can be skirted.
- **S2 — False Exit** *(13 s)*: places a glass doorway that visually points to safety but openly projects its **actual** exit 75 GU to one side. The first enemy who voluntarily enters is displaced to that endpoint after 0.35 s. Enemy sees both endpoints before entering; no forced input manipulation.
- **R — Map of Might-Have-Beens** *(83 s)*: shows up to three recorded headings as public spectral roads for 4 s; allies gain speed while traversing them opposite the recorded direction, and foes crossing in the old direction receive a short revealed/exposed mark. No auto charm, orb return, or dash chain.

**Fight / counter:** vary approach headings, ignore the tempting doorway, destroy it with attacks. **AI cue:** exploit enemy committed routes rather than blindly placing escape doors.

## 04 — Bramm Coil, **The Breach Marshal**
**Legacy:** Gritlock · **Role:** anti-cover artillery / knockline specialist. **Look:** industrial tunnel-breaker with rotary ram-gun mounted to a back brace, orange work stripes and one reinforced leg. **Signature:** generates **controlled breach lanes**, not shotgun pellet bursts or smoke obscuration.

- **P — Structural Survey:** repeated hits on the same piece of deployable cover mark it as weakened (maximum one mark).
- **S1 — Anchor Ram** *(9 s)*: shoots a riveted anchor 140 GU to a ground point. After 0.6 s the anchor pushes a rectangular 45×90-GU blast **away from its own facing**; hits one time, moves enemies 24 GU, dislodges deployable barriers.
- **S2 — Brace Exchange** *(13 s)*: Bramm exchanges mobility for steadiness for 3 s. He slows by 25%; each shot fired from the brace creates a short **safe opening** in allied cover that closes after 0.7 s, permitting planned fire without permanently destroying shields.
- **R — Tunnel Cut** *(76 s)*: slowly draws a huge visible straight cutting lane for 1.1 s. It then advances a mechanical ram through the lane over 1.4 s, collapsing temporary structures and forcing units sideways to the nearest free side; never passes world walls.

**Fight / counter:** relocate laterally, interrupt his bracing, attack his exposed back. **AI cue:** use R to open a route into defended ground, not as a generic execute.

## 05 — Kael Vespera, **The Oath Ledger**
**Legacy:** Bessara · **Role:** anti-save fighter / wager duelist. **Look:** weathered oath collector with paired crescent ledgers as blades, stitched gray cape and ink-red wrist seals. **Signature:** enforces a transparent **risk bargain** on one enemy instead of leaping for an execute.

- **P — Outstanding Balance:** first melee contact with a hero issues a visible 4 s Contract: target receives a 4% damage discount from Kael, but each shield granted during the Contract accumulates *Debt* (capped at 160). Only Kael may collect; no denial of healing.
- **S1 — Collection Line** *(7 s)*: short sweeping arc which draws a red boundary on the ground for 2 s. Contracted targets crossing it pay a fraction of Debt as magic damage; staying put avoids payment.
- **S2 — Witness Required** *(13 s)*: Kael braces for 0.8 s. If the contracted enemy or a defender hits her during the brace, she gains a dashless counter slash and a 1 s damage reduction; otherwise she is vulnerable after bracing.
- **R — Terms of Mercy** *(80 s)*: challenges a contracted target for 4 s. Their team can clear the Contract by landing two attacks on Kael, or ignore it and let Kael cash out accrued Debt as a single capped hit. Does not suppress, force 1v1, or execute automatically.

**Fight / counter:** assign a defender to pressure Kael; avoid shielding into her Contract without reason. **AI cue:** prioritize high-save carries when the enemy protection budget is committed.

## 06 — Nyxara Vale, **The Silhouette Thief**
**Legacy:** Vanta · **Role:** vision-pressure assassin. **Look:** angular thief wearing articulated matte-black lacquer strips that cast sharp, oversized silhouettes on the ground; no shadow clones. **Signature:** manipulates **the edges of visibility**.

- **P — Blind Side:** Nyxara gains a small first-hit bonus when striking from outside the target's *forward* vision cone, once / target / 7 s. Visible directional marker informs defenders when exposed.
- **S1 — Shadow Pin** *(8 s)*: projects a dark triangular plane from a chosen wall or her own location for 4 s. It blocks **line of sight for basic attack acquisition**, not projectiles, and is transparent to all after a unit steps through.
- **S2 — Light Theft** *(13 s)*: steals illumination from one existing Shadow Pin for 2 s, collapsing that plane into a mobile veil around Nyxara. She remains targetable at close range and leaves bright footsteps; while veiled, her next attack briefly reduces the victim's turn speed.
- **R — Total Eclipse, Partial Truth** *(85 s)*: places three visible *false target silhouettes* along an 80-GU arc. They do not attack, teleport, or explode; enemy targeting systems briefly need fresh line-of-sight confirmation when Nyxara crosses the arc. Her next hit against an isolated foe deals bonus damage, capped.

**Fight / counter:** sweep close vision across the veil, stand back-to-back, shoot area spells into silhouette arcs. **AI cue:** flank a separated backliner after allies draw forward attention.

## 07 — Serrin Galecrest, **The Crosswind Cartographer**
**Legacy:** Galejandro · **Role:** projectile-lane engineer / duelist. **Look:** white-haired sailor swordsman with a collapsible wind vane shield and narrow curved blade; weather-map tapes attached to armor. **Signature:** changes **wind vectors** rather than summoning tornadoes or airborne execution.

- **P — Weather Reading:** Serrin sees recent incoming projectile headings as faint arrows; after narrowly dodging one, gains one Wind Notch (max 2).
- **S1 — Compass Slash** *(7 s)*: cuts a 65-GU directional current across a target corridor for 2.2 s. Enemy **non-homing** projectiles crossing it are deflected up to 15°; allied shots get a 10% speed boost.
- **S2 — Tack Change** *(12 s)*: spends a Wind Notch to rotate a current or quickly sidestep 28 GU perpendicular to its path. Cannot pass hard terrain.
- **R — Eye of the Crosswind** *(88 s)*: maps a 140-GU radius ring with four public directional wind channels for 4 s. Enemy projectile lanes become less reliable; walking normally still works. No blanket projectile deletion, knockup, or blink slashes.

**Fight / counter:** use melee pressure, homing attacks, or reposition before firing. **AI cue:** read enemy ranged threats and place currents across their probable firing lanes.

## 08 — Orin and Fen, **Keepers of the Last Lantern**
**Legacy:** Lambent · **Role:** scouting marksman / extraction support. **Look:** scarred human lantern scout followed by a blind, horned dusk-hound made of moving ember fur; **not** a wolf plus death-immunity circle. **Signature:** tracks danger and guides **one wounded ally out**.

- **P — Scent of Trouble:** Fen marks heroes who recently damaged Orin's allies, revealing their direction for 3 s (not through fog beyond a short final ping).
- **S1 — Track Lantern** *(9 s)*: Orin drops a lantern that records the next enemy who passes within 55 GU, pinging their direction; can be destroyed in 2 hits.
- **S2 — Fen, Guard** *(14 s)*: sends Fen to a chosen ally or lantern for 3 s. Fen absorbs the next **one** eligible hostile projectile and then withdraws, with a clearly visible charge indicator.
- **R — Road Home** *(90 s)*: paints a luminous curved **retreat path** from Orin to one low-HP ally for 4 s. The selected ally may voluntarily follow it for 30% speed and 18% damage reduction while moving toward Orin; leaving the path cancels protection. No HP floor or mass invulnerability.

**Fight / counter:** attack the lantern, attack from non-projectile angles, or force the rescued ally off the route. **AI cue:** protect the true high-value exposed ally, not the nearest low-HP unit.

## 09 — Quillene Rook, **The Sky Loom Fletcher**
**Legacy:** Plumeira · **Role:** ranged interception carry. **Look:** masked archer with hawk-inspired shoulder fins and bow strung with miniature kite rigging; feathers are **air anchors**, not returning blade traps. **Signature:** creates temporary **crossfire windows**.

- **P — Airborne Fletching:** every third aimed attack releases a tiny kite that hangs for 3 s at the shot's endpoint (max 3). Kites are visible and destroyable.
- **S1 — Tetherbolt** *(8 s)*: shoots a kite anchor 150 GU into the air; anchors do not damage when planted.
- **S2 — Crosswind Stitch** *(13 s)*: ties her two nearest kites into an aerial span for 3 s. Her next two arrows passing through it split into two shallow angled shots at 60% damage each (one-hit cap per target); enemy units may shoot down either kite.
- **R — Harrier Net** *(85 s)*: all active kites fan into a broad descending mesh. Enemies inside may move out but have ranged attack windups increased for 2.5 s; meanwhile allied projectiles from outside the mesh get a slight side-angle adjustment. No untargetable leap, ground feather recall, or root-on-three-feathers.

**Fight / counter:** pop the kites or enter close combat beneath the span. **AI cue:** prebuild crossfire above an objective approach.

## 10 — Aurelio Vane, **The Masquerade Marshal**
**Legacy:** Gildan · **Role:** formation choreographer / rescue. **Look:** masked fencing host in ceremonial midnight tux-armor with luminous floorwork slippers and half-moon fan shield. **Signature:** gives allies **explicit dance steps** instead of dash-and-charm engagement.

- **P — Perfect Partner:** an ally who follows an Aurelio-created floor arrow gains brief tenacity, once / ally / 6 s.
- **S1 — Mark the Floor** *(8 s)*: lays two 30-GU glowing steps; an ally crossing them in order gains 22% movement speed for 1.5 s. Enemies see the steps and can deny the route.
- **S2 — Change Partners** *(13 s)*: selects an allied hero in 120 GU; for 1.2 s both can voluntarily trade their places by pressing an interaction or by an AI commitment. Cannot trade into walls or out of hard CC.
- **R — The Grand Procession** *(78 s)*: reveals a three-turn floor route for 4 s. Allies following it earn a small shield at each turn; enemies who stand on the route are pushed sideways 18 GU once when the procession advances. No AoE charm or automatic ally dash.

**Fight / counter:** block a turn or attack the side where the next step ends. **AI cue:** choreograph a real extraction or coordinated flank rather than casting into an empty lane.

## 11 — Droven Bearmantle, **The Keeper of the Second Heart**
**Legacy:** Sylvan Solo · **Role:** two-body defender / attrition. **Look:** rugged warden in patched antlered mantle accompanied by a massive **moss-backed pack tortoise**, not a spirit bear or shapeshifter. **Signature:** a slow second body that redistributes pressure.

- **P — Shared Heartbeat:** Droven and the tortoise Hark have a shared reserve of 220 guard energy; damage absorbed by Hark drains guard. Hark does not respawn instantly after destruction.
- **S1 — Hark, Settle** *(12 s)*: directs Hark to a nearby point where he plants as a 55-GU-wide **walk-around obstacle** for 4 s. Hark can be attacked; allies may pass through slowly.
- **S2 — Shelter Under Shell** *(14 s)*: Hark opens his shell to cover one nearby ally with 20% incoming-damage redirection to guard energy for 2.5 s. Droven temporarily loses part of his own armor while energy is transferred.
- **R — Carry the Line** *(92 s)*: Hark slowly advances 100 GU over 4 s as moving cover. Allies behind his shell gain limited projectile protection; opponents can flank Hark or destroy the shell's guard energy.

**Fight / counter:** hit Droven when guard moves away, attack shell from side, or use area damage around the tortoise. **AI cue:** anchor Hark at defendable geometry and move only for objective commitments.

## 12 — Thalara Rootwright, **The Mycelial Architect**
**Legacy:** Fernanda · **Role:** ground economy / area control. **Look:** elderly fungus architect with ceramic seed jars, branching mycelium sleeves and mushroom-coral parasol; no tree-ring prison. **Signature:** grows **networks with limited nutrient supply**.

- **P — Spores in Soil:** ability hits leave a nutrient node for 6 s (max 4). Nodes are visible small mushrooms with 2 hit points.
- **S1 — Root Survey** *(8 s)*: grows a narrow mycelial line between Thalara and one node. Allies moving along it gain minor speed; enemies crossing it suffer an initial short slow. One line per node.
- **S2 — Transplant** *(14 s)*: moves a single active nutrient node up to 60 GU with 0.5 s tell; enemies standing on the displaced line are gently redirected to nearest free space, no stun.
- **R — The Living Understory** *(90 s)*: activates the node network for 5 s: allies touching a connected line regenerate modest HP over time; enemy AoE detonations on the web burn one node but trigger a one-time small burst. Opponents can cut the network one node at a time.

**Fight / counter:** sever key nodes or force the fight beyond the nutrient network. **AI cue:** build a connected zone before a contested boss rather than spam vines on cooldown.

## 13 — Vesper Loom, **The Gossamer Chirurgeon**
**Legacy:** Glimmerick · **Role:** triage support / risk redistribution. **Look:** elderly spider-silk surgeon with mechanical needle-fingers, a cracked porcelain medical mask and lilac thread reservoirs. **Signature:** treats wounds as **bounded queues**, not no-death immunity.

- **P — Recorded Injury:** 16% of damage suffered by a nearby marked ally is logged as Care Debt for 3 s, capped at 180 per ally. This does not reduce damage by itself.
- **S1 — Suture Tag** *(8 s)*: marks an ally for 4 s; the next qualifying damaging hit is reduced by 15%, and the prevented amount becomes Care Debt (not immediate HP).
- **S2 — Stitch Circuit** *(12 s)*: links two allies in range for 2.5 s; healing applied to either is split 70/30 with the other. Link breaks beyond 180 GU. No death prevention.
- **R — Emergency Triage** *(88 s)*: converts up to 200 total Care Debt among nearby allies into a 4 s heal-over-time. Vesper suffers 15% of the converted amount as **nonlethal self-damage** over 4 s. Saves require setup and expose the healer.

**Fight / counter:** burst before tags are set, interrupt positioning by splitting links, or pressure Vesper during repayment. **AI cue:** reserve R for accumulated real debt and a survivable self-cost.

## 14 — Rux Emberchain, **The Cinder Postmaster**
**Legacy:** Cindergent · **Role:** timed-route brawler. **Look:** scarred courier with a giant shoulder mail-satchel of glowing sealed envelopes and iron skate-boots; not a fire-remnant sword ninja. **Signature:** delivers combustible **messages along declared routes**.

- **P — Return Address:** attacks place a stamp on enemy champions (1 stamp / enemy / 6 s). Stamps reveal Rux's intended target for 4 s.
- **S1 — Express Mail** *(8 s)*: throws a volatile letter to an ally, enemy, or ground point. A carrier retains it for up to 3 s; enemies may hand it off to another enemy with a movement interaction to avoid the later blast.
- **S2 — Courier's Crossing** *(12 s)*: draws a short path between Rux and a stamped point. Rux can run it at boosted speed but not dash through collision; crossing a carried letter collects it and produces a radial spark burst.
- **R — Dead Letter Office** *(82 s)*: simultaneously recalls all placed letters **along visible straight routes** toward a central postal seal. Each letter can hit a champion once; safe gaps exist between routes. Enemies can relocate before recall.

**Fight / counter:** carry mail away from allies, intercept Rux on his walking route, move between recall lines. **AI cue:** seed letters across multiple opponents then time the route convergence.

## 15 — Teslan Veyr, **The Storm Circuit**
**Legacy:** Voltaire · **Role:** electrical trap architect. **Look:** coil scientist with portable ground rods, insulated coat with hazard seams, copper articulated monocle. **Signature:** constructs **circuits and switches polarity**; no electric ball travel, remnant decoy, or unit vortex.

- **P — Closed Circuit:** a successful link between two Teslan rods grants a stored Capacitor charge, maximum 2.
- **S1 — Drive Rod** *(8 s, two charges)*: place a destructible rod at a ground point, 140 GU range, 3 s lifetime after the second rod. Two rods generate a clearly drawn current beam between them; crossing once damages lightly.
- **S2 — Reverse Current** *(12 s)*: flips the circuit to **Repel** or **Conduct** for 2.5 s. Repel deflects enemy projectiles crossing the beam slightly; Conduct increases allied attack speed when standing adjacent to the line. Each hero may benefit once per cast.
- **R — Brownout Protocol** *(80 s)*: consumes Capacitors to briefly shut down **deployables** and delay the next cast windup of enemies who remain on the circuit line (up to 0.5 s); opponents can walk away before the 0.75 s charge finishes. It does not silence globally or auto-pull.

**Fight / counter:** destroy a rod, cross before activation or fight outside the line. **AI cue:** straddle a choke with rods, adapt polarity based on projectile pressure versus allied DPS.

## 16 — Joruun Jadecoil, **The Hinge Colossus**
**Legacy:** TerraByte · **Role:** movable cover architect. **Look:** stout jade-mechanical titan with hinged stone shutters and a visible counterweight core; never rolls as a ball. **Signature:** builds **swinging walls** that change lane access.

- **P — Counterweight:** damage taken fills a limited counterweight bar, up to 100, used only to strengthen hinges.
- **S1 — Raise Slab** *(10 s)*: raises one breakable 60-GU jade slab on a ground edge for 4 s. Slab blocks movement and shots, but can be walked around. Max one slab.
- **S2 — Hinge Swing** *(13 s)*: rotates the active slab 90° over 0.65 s, nudging units out of occupied space by at most 24 GU; without slab, Joruun gains a short self-shield but no knockup.
- **R — The Great Door** *(95 s)*: plants two hinged slabs 90 GU apart for 5 s, forming a **temporary gate** with an openable middle. Joruun can spend Counterweight to close it once (0.7 s telegraph); units caught in the closing zone are moved to closest free side, never trapped without exit.

**Fight / counter:** destroy slab segments, approach from an alternate angle, bait premature gate closure. **AI cue:** build choke selectively while leaving allies a legal crossing route.

## 17 — Astrax Mire, **The Distance Pilgrim**
**Legacy:** Nulliver · **Role:** anti-mobility mage / movement tax. **Look:** veiled pilgrim whose long measuring cords float behind a star-map walking staff; no portal-clone mobility burst. **Signature:** converts **distance travelled** into a finite debt.

- **P — Footfall Record:** within sight, tracks enemy travel distance over rolling 3 s windows (max 160 GU) with public meter marks.
- **S1 — Measure Out** *(8 s)*: tags one visible enemy for 3 s. Each 35 GU it voluntarily moves adds one Distance Seal (max 3); stationary targets remain safe.
- **S2 — Mile Marker** *(12 s)*: sets a small stone marker on terrain. Tagged enemies moving **toward** it are slowed lightly; moving away consumes one Distance Seal harmlessly.
- **R — Reckoning of Roads** *(82 s)*: within 140 GU, all tagged enemies receive a visible 1 s verdict countdown. It converts accumulated seals into a capped nonlethal magical burst and movement-speed reduction; seals can be shed by walking away from markers before verdict. Does not teleport, leap, or create rift damage explosions.

**Fight / counter:** pause, redirect, or take the safe exit even if slower strategically. **AI cue:** mark mobile flankers before they commit, not stationary enemy tanks.

## 18 — Prismelle Cade, **The Shard Regent**
**Legacy:** Crownfetti · **Role:** reflective blade defender. **Look:** mineral queen with a floating circlet of glass shields, single asymmetrical cleaver and fractured reflective cape. **Signature:** transforms **projectile direction and line-of-fire**, not elemental dash stance loops.

- **P — Royal Refraction:** once / 5 s, landing a blade hit charges her nearest crystal pane with one optical charge.
- **S1 — Facet Screen** *(9 s)*: places a 55-GU one-way prismatic pane with 2 HP. Enemy shots that hit it lose 25% damage; allied shots fired through at specific visible angles bend 18°.
- **S2 — Claim the Angle** *(12 s)*: moves to the edge of her existing pane by up to 35 GU and rotates it. It is a **short pathing move**, not free-target dash, and cannot move through walls.
- **R — Coronation in Glass** *(86 s)*: creates three panes arranged as a shallow open fan; over 4 s each pane can redirect **one** allied projectile into a separate lane. Enemy champions can smash panes or engage inside the fan.

**Fight / counter:** break panes, attack from rear, or force close melee. **AI cue:** angle a fan for allied skillshots when enemy frontliners shelter carries behind them.

## 19 — Ashkar Veilhand, **The Penitent Ember**
**Legacy:** Sootcase · **Role:** retribution diver / enemy-aggression punisher. **Look:** masked ash monk wearing charred prayer banners and iron ash bells; no invisible assassin smoke. **Signature:** thrives on enemies **damaging his sworn ally**.

- **P — Witness the Hurt:** every 50 damage one chosen nearby ally takes from an enemy creates one Ember Count on that attacker (max 3); counts expire in 5 s.
- **S1 — Ember Brand** *(7 s)*: marks one attacker with a burn that grows with Ember Count; if they stop attacking the protected ally, the burn ends early.
- **S2 — Ash Intercession** *(14 s)*: Ashkar dashes **only to his sworn ally**, landing at a legal adjacent location and briefly blocking the next targeted basic attack for them. No stealth or enemy-target jump.
- **R — Public Penance** *(86 s)*: announces the top Ember Count attacker for 0.8 s, then creates a circular duel hazard around **that enemy's current position**. Damage ramps only while the accused continues attacking Ashkar's protected ally; they can switch targets or exit. No guaranteed execution.

**Fight / counter:** change target, split Ashkar from partner, or force him to choose between two threatened allies. **AI cue:** bind to an actual high-value ally under focused fire.

## 20 — Maris Solquill, **The Reliquary Surveyor**
**Legacy:** Sennova · **Role:** route support marksman. **Look:** armored pilgrim carrying a brass sextant crossbow and foldout field-map shrine; no giant Senna-like healing beam. **Signature:** establishes **illuminated crossing routes**.

- **P — Borrowed Sunlight:** damage that Maris sees nearby leaves one Waylight mote at its ground position (max 3), pickup grants small shield charge.
- **S1 — Waypoint Lantern** *(8 s)*: shoots a lantern onto the ground. It projects a 50-GU-long path; allies walking its length gain a small burst of healing at the far endpoint (once each).
- **S2 — Twilight Survey** *(13 s)*: rotates a placed lantern's path or aligns it toward an ally, granting that ally 1.5 s of vision through nearby obstacles (not global vision) as the line turns.
- **R — The People's Atlas** *(87 s)*: connects up to three Waylight positions into a visible zig-zag safe trail for 5 s. Allies traversing the **entire route** receive a capped shield and 20% speed; enemies can destroy waypoints or ambush turns. No global damaging beam.

**Fight / counter:** cut a waypoint and deny route completion. **AI cue:** draw crossing routes from threatened carry to defensible ground.

## 21 — Odo Bogsong, **The Reed Timekeeper**
**Legacy:** Basso Croak · **Role:** tempo support / telegraph manipulator. **Look:** stout moss-green amphibian clockmaker with hollow reed drums, pedal metronome and tiny percussion frogs. **Signature:** **beats** reward timing, not generic tongue grab and teamwide heal.

- **P — The Beat Goes On:** Odo displays a repeating 3-beat indicator (1.2 s/beat). Allies who begin a spell within a 0.18 s Good Beat window get 8% shorter cast recovery, once / ability / 6 s.
- **S1 — Offbeat Drum** *(8 s)*: places a 3-beat drum pad; each beat makes a visible 40-GU ripple for light damage, never stunning automatically.
- **S2 — Syncopation** *(13 s)*: moves the next pad beat earlier by 0.25 s and provides a small shield pulse to nearby allies on the adjusted beat. Enemies can see the revised countdown.
- **R — The Long Measure** *(85 s)*: for 4 beats, allies on Odo's rhythm gain move speed after completing casts; enemies casting exactly while a ripple touches them incur 0.4 s additional **recovery after the cast**, never a denied cast. No global heal/tenacity aura.

**Fight / counter:** break the drum, cast between ripples, or attack Odo while he tends tempo. **AI cue:** synchronize with allied initiator's actual windup, not random rhythm windows.

## 22 — Mourn Ashwake, **The Furnace Mourner**
**Legacy:** Razeberry · **Role:** reactive inferno mage. **Look:** furnace-backed mortician pulling ember caskets on chains, black glass face shield; no Shadow-Fiend-style line razes/soul-stack requiem. **Signature:** converts **spent battlefield heat** into hazards.

- **P — Ash Residue:** any completed damaging spell cast within 125 GU leaves an Ash Patch where it ended (once / owner / 4 s, max 4 patches). Mourn sees both teams' visible patches.
- **S1 — Ember Tongs** *(8 s)*: drags one patch slowly 45 GU, scorching enemies it passes once, or makes a small patch at his own feet if none exist.
- **S2 — Draft Open** *(12 s)*: opens a furnace vent toward one patch, creating a visibly directional heated current for 3 s that burns enemies walking **against** it.
- **R — Second Combustion** *(90 s)*: ignites every active patch in a 140-GU field after 1.0 s, turning them into low moving walls of ember for 3 s. Patches consumed; no large instant fear wave.

**Fight / counter:** end spell casts away from clustered patches; lure Mourn out of prepared territory. **AI cue:** contest where previous spell exchanges created ash, rather than standing still and spamming R.

## 23 — Dolm Runesunder, **The Seismic Surveyor**
**Legacy:** Quakewell · **Role:** turning-path punisher / terrain tilt. **Look:** squat seismologist titan with two immense pendulum hammers and a floor-level surveying compass; no Fissure/Echo Slam analogue. **Signature:** manipulates **ground slope and turning speed**.

- **P — Strain Lines:** moving enemy champions that make sharp turns (more than 70°/0.4 s) generate a strain point; max 2 on the ground.
- **S1 — Tilt Plate** *(9 s)*: raises one 65×65-GU shallow sloping tile. Units crossing it slide an extra 12 GU in their travel direction; exits always remain open, slide has one-hit cooldown.
- **S2 — Pendulum Strike** *(13 s)*: swings a huge weighted maul across an arc. Enemies on tilted ground are shoved a modest 18 GU; other enemies take normal damage.
- **R — Continental Drift** *(95 s)*: lays three **successive** tilted plates over 2.7 s, visibly changing safe movement vectors, with a final 0.55 s stagger for opponents who fail to leave the last tile. No full-screen slam based on nearby unit count.

**Fight / counter:** wait for slope to settle or traverse perpendicular to the downhill vector. **AI cue:** steer divers away from backline, not stack damage on a five-man cluster.

## 24 — Garruk Mawsuture, **The Jaw Foundry**
**Legacy:** Rotisserie · **Role:** trap engineer / containment tank. **Look:** hunched iron-jawed smith operating a strapped cage forge, rotating trap anvils and huge riveted gauntlets; no hook/rot/dismember. **Signature:** deploys **mechanical jaws** that divide ground.

- **P — Scrap Appetite:** destroyed enemy deployables or spent jaw traps grant Scrap, maximum 3, each increasing next jaw width by 6 GU.
- **S1 — Set Jaws** *(9 s)*: plants two hinged iron teeth on ground 50 GU apart, 2 HP each. After 0.55 s, crossing the gap closes them for a 0.5 s root **only once**, then they jam open. Units can attack or skirt them.
- **S2 — Forge Drag** *(12 s)*: drags one installed tooth 45 GU along a visible chain, scraping a narrow damage lane and reopening a previously triggered jaw with half strength.
- **R — Factory Floor** *(90 s)*: lays three staggered **jaw lanes** around Garruk for 5 s. Their timing is sequential (audible clacks), leaving safe corridors; no suppression, unit grab, or poison aura.

**Fight / counter:** destroy hinge teeth, cross during open beats, fight off the factory floor. **AI cue:** protect a key crossing with trap spacing, not chase a hooked victim.

## 25 — Vesper Nullcode, **The Inertia Heretic**
**Legacy:** Midnight Equation · **Role:** mobility-rewriting control mage. **Look:** androgynous angular physicist with a suspended broken gyroscope, indigo measurement robe and luminous chalk-rings; **not** a black-hole channeler. **Signature:** rewrites **turning and momentum**, never sucks targets into a singularity.

- **P — Unspent Momentum:** enemies traveling 45 GU in a straight line nearby contribute one Momentum sample (max 4, visible).
- **S1 — Tangent Fault** *(8 s)*: lays a 60-GU vector tile; a non-unstoppable enemy crossing is gently redirected 20° clockwise or counterclockwise (chosen on cast), maintaining speed. No teleport/stun.
- **S2 — Mass Argument** *(13 s)*: declares a public high-friction disk for 3 s. Enemy dashes passing through are shortened by at most 20%; ordinary walking is slowed 10%. Does not cancel the dash outright.
- **R — Borrowed Orbit** *(93 s)*: consumes Momentum to construct a rotating 145-GU field lasting 4 s. Within it, movement inputs are smoothly biased into an arc of at most 25°/second, telegraphed by floor arrows. Stationary enemies or those who deliberately countersteer can hold position. No forced center pull or AoE wipe.

**Fight / counter:** stop moving briefly, move against marked vectors, or burst her before the disk is set. **AI cue:** bend committed enemy approaches away from allied carries / boss pit.

## 26 — Coiljack Ampfist, **The Livewire Turnstile**
**Legacy:** Plugsy · **Role:** anti-dive engineer. **Look:** stocky utility electrician with two folding traffic-bar gauntlets, spooled spring cable and safety visor; not an extending hook robot. **Signature:** a **turnstile gate** punishes repeated lunges.

- **P — Impact Audit:** when an enemy ends a dash within 110 GU, Coiljack gets one Inspection charge (max 2, 4 s lockout per enemy).
- **S1 — Turnstile Bar** *(9 s)*: plants a 55-GU breakable spring bar for 3.5 s, showing one open half and one closed half. Walking enemies pass; the first **dash through the closed side** is diverted 20 GU to its safe edge and consumes the bar.
- **S2 — Earth Clip** *(12 s)*: attaches a grounding clip to an ally for 2.5 s. The next displacement inflicted on that ally is reduced by 40% and the attacker is briefly revealed; no stun/knockup.
- **R — Inspection Grid** *(88 s)*: builds two intersecting turnstiles for 5 s. Enemies may walk around or smash either gate, but repeated aggressive dashes spend their movement on detours and trigger a 0.45 s disarm after the second interception.

**Fight / counter:** walk through rather than dash, smash the traffic bars or bait the first gate. **AI cue:** place bars between enemy diver and ally, hold R for a multi-diver engage.

## 27 — Talan Slipshot, **The Archive Ballistician**
**Legacy:** Relic Rick · **Role:** trick-shot ranged carry. **Look:** rugged surveyor with mechanical ricochet bow-rifle, rangefinder eyepieces and foldable brass mirror drones; no blink and giant piercing beam. **Signature:** engineers **reflection angles** with limited shots.

- **P — Proof Mark:** a direct skillshot hit stamps the target with one Proof Mark for 4 s; marks improve the next reflected shot slightly, one proc per target.
- **S1 — Set Mirror** *(8 s, two charges)*: places one thin 2-HP projectile reflector at a selected ground point; at most 2 mirrors exist, facing fixed direction.
- **S2 — Evidence Shot** *(7 s)*: fires a single bolt that may ricochet **once** from one mirror at the previewed angle. Direct and reflected hits deal different capped damage; walls stop shots.
- **R — Closed Case** *(78 s)*: chooses one visible target and displays three **public** predicted lines from existing mirrors for 0.8 s. Fires along the selected legal line for high damage; remaining lines are decoys clearly labeled as possible routes. No global shot or aimless auto-hit.

**Fight / counter:** destroy mirrors or move off predicted bounce routes. **AI cue:** preview LOS, choose a bounce that hits a protected backliner without crossing an allied blocker.

## 28 — Calixa Broadwake, **The Tidebound Privateer**
**Legacy:** Bounty Belle · **Role:** mobile broadside area carry. **Look:** salt-worn privateer captain with a rectangular bicorne hat and a knee-high clockwork skiff that follows her; two mismatched deck cannons, no spinning gun barrage. **Signature:** commits to **port/starboard firing arcs** and makes her orientation consequential.

- **P — Hold the Weather:** after Calixa moves 45 GU along one heading, her skiff stores one Windward charge (max 2); reversing direction spends the accumulated aim. Visible wake trails announce her broadside side.
- **S1 — Signal Buoy** *(8 s)*: tosses a floating 2-HP buoy within 140 GU. The buoy marks a 60-GU sea-lane and reveals enemy movement through that lane for 4 s; Calixa's next basic attack passing the buoy gains a small splash. Max two buoys.
- **S2 — Tack Across** *(12 s)*: Calixa and skiff turn 90° and slide 38 GU *along an unobstructed legal path*. While turning, the skiff fires **one** short range shot from the outward-facing broadside, consuming a Windward charge for extra shove. No dash through obstacles.
- **R — Port Authority** *(88 s)*: selects port or starboard and projects **three staggered 85×35-GU broadside lanes** over 3 s. Every 0.8 s the skiff fires into the next visible lane; each hero can be damaged at most once per volley. The lanes follow Calixa's facing **at cast start**, and remain readable even if she walks; do not auto-track fleeing champions.

**Fight / counter:** approach from the unused broadside, cut off her sailing line, smash buoys, or move between successive volleys. **AI cue:** keep a flank angle alongside the enemy formation and use the chosen broadside to deny an escape corridor, not always to maximize instantaneous DPS.

## 29 — Brohm Caskfall, **The Fermentation King**
**Legacy:** Kegory · **Role:** terrain-flow tank / pressure shaper. **Look:** colossal cellar mechanic with transparent brass fermentation tanks, pressure-wheel forearms and rubber-stopper boots; no body-slam-and-exploding-barrel combo. **Signature:** **liquid pressure** builds currents and forces choices about footing.

- **P — Pressure Reserve:** damage soaked while standing on his own foam builds Pressure (0–100). Pressure decays outside foam; visibly displays on a back-mounted dial. Reserve cannot grow from damage that Brohm himself creates.
- **S1 — Lay the Head** *(9 s)*: opens a directional spigot to spill a 90×28-GU **foam strip** for 4 s. Units on the strip retain normal basic movement but slide up to 9 GU along the marked direction after each voluntary movement step; repeated movement resolution caps total drift.
- **S2 — Repressurize** *(13 s)*: reverses the direction of one active foam strip and gives Brohm a brief damage barrier proportional to Pressure consumed (capped). The reversal is warned by flashing arrows for 0.45 s; opponents may step off it.
- **R — Cellar Breach** *(95 s)*: plants a large cask at the junction of up to two foam strips. After 1 s the cask vents in **three sequential directional surges**, each traveling along existing foam channels and displacing enemies modestly perpendicular to the stream. Surges do not stack displacement against the same target inside 0.8 s. Without strips, it creates one weak short surge only.

**Fight / counter:** move across—not with—the current, destroy the central cask (3 HP), and exploit Brohm's reduced power away from prepared foam. **AI cue:** pre-place a flow away from the allied carry or objective entrance, not blindly chase a single enemy with body collisions.

## 30 — Mora Fenhook, **The Lantern Ferrier**
**Legacy:** Hooklyn · **Role:** tactical extraction support. **Look:** elderly marsh boatwoman beneath a wide oilcloth hood, a segmented oar and a floating narrow spirit skiff; completely remove hooked chains and warden cage. **Signature:** an **opt-in, predictable ferry service** enables rescues and flanks.

- **P — Crossing Fees:** when an allied hero safely finishes a Mora-established route, Mora accrues Fare (max 2), each reducing the next route setup delay by 0.15 s. There is no reward for trapping or dragging enemies.
- **S1 — Mooring Post** *(8 s, 2 charges)*: plants a small lit mooring within 115 GU. Posts have 2 HP, last 7 s, and are legal only on traversable ground. First post is the departure; second is the arrival. Max one linked pair.
- **S2 — Departing Bell** *(13 s)*: if two posts exist and a collision-valid traversable path joins them, summons a 2.3 s ferry that follows that path at fixed speed. Allies and enemies **voluntarily board** within 20 GU using a public interaction or AI accepted decision; a boarded unit cannot attack for the trip but may disembark at legal path checkpoints. No forced motion from hard CC.
- **R — The Last Crossing** *(86 s)*: temporarily creates two public **emergency moorings** at legal points near Mora, then dispatches a second larger ferry allowing up to two passengers for one journey. It gives passengers a small shield **on arrival**, not invulnerability while traveling; destroying arrival post stops the ferry at its nearest legal earlier dock.

**Fight / counter:** deny the embarkation circle, destroy a post, attack exposed passengers after arrival or board to contest the far dock. **AI cue:** reserve an actual safe embarkation point and allied consent; never autopull a threatened ally or send them into tower range.

## 31 — Mirelle Vane, **The Atelier Prodigy**
**Legacy:** Arsenaldo · **Role:** geometry-based tactical mage with ten authored fabric patterns. **Look:** sharp-eyed **adult mage girl (early twenties)**, needle-hair comb, short asymmetrical ink-black sleeve, ivory structured waistcoat, oxblood petal-skirt over practical shorts, flat boots, giant folded-paper pattern cape. Her floating helper is a brass bobbin, **not three elemental spheres**. **Signature:** draws physical **tailoring pins and stitchwork** that temporarily change battlefield relationships. No elemental combinations, ordered orb recipe, or copy of the Invoker ability keyboard.

- **P — Pattern Memory:** Mirelle can maintain **three visible 2-HP tailor pins** at once, each lasting 6 s and anchored to traversable ground; new pins replace the oldest. Two or three pins establish a line/triangle with clear world-projected stitch geometry. Valid layouts must leave legal passage and cannot cross impassable world walls.
- **S1 — Pin the Hem** *(5 s, max 3 stored pin charges with staggered recharge)*: tosses a pin within 125 GU, causing a small impact sting only if it hits a target; the pin stays on the ground. At least one pin is required for most pages. Pins are marked for **both** teams and can be broken by 2 basic attacks.
- **S2 — Recut** *(10 s)*: chooses one existing pin and slides it along a visible, collision-valid 40-GU path after a 0.4 s warning. Enemies crossed by the moving thread take one light hit; recasting on empty ground fails without consuming the cooldown. Also cycles the selected **page group** when no pin is targeted, with no cast or mana cost.
- **R — Pattern Book** *(global weave lockout 7 s)*: hold/activate a **radial palette** of ten named patterns; choosing a page is input selection, then releasing R makes **one authoritative cast**. Each page has its own cooldown, cost and geometry requirement. The global weave lockout is a post-cast throttle, **not an 80-second ultimate imposed on all ten pages**. Major pages have longer personal cooldowns. A single chosen page cannot be released if its pin geometry or cooldown is invalid; show the reason before committing. Each successfully cast page consumes **exactly its declared pins**.

### Mirelle's ten page spells — no element recipes

| Page | Pattern / role | Required setup and behavior | Draft cooldown | Readable answer |
|---|---|---|---|---|
| 01 | **Baste Line** — crossing tax | 2 pins; creates a temporary stitch seam between them for 3 s. First enemy crossing is slowed 20% for 1 s, taking minor damage. Consumes 2 pins. | 16 s | Cut either pin or walk around the open-ended seam |
| 02 | **Pocket Shelter** — single-ally save | 1 pin within 60 GU of a visible ally; projects a directional cloth flap for 2 s that intercepts **one** incoming projectile from the pin-facing side, then tears. Consumes 1. | 22 s | Flank the cloth or bait the single catch |
| 03 | **Held Breath** — projectile scheduling | 2 pins; establishes a 2.2 s fabric pocket. An **allied consenting** non-ultimate projectile crossing the seam is held for up to 0.7 s then released along its **original heading** at its original team ownership and capped damage. Can hold only one projectile. Consumes 2. | 28 s | Move while the shot is parked or sever seam; no instant redirect |
| 04 | **Ladder Stitch** — traversable ground hazard bridge | 2 pins spanning an enemy *temporary ground hazard* up to 80 GU. For 3 s the seam permits allies to cross that specific hazard with reduced tick damage; it never bridges hard world walls, pits or spawn exclusion. Consumes 2. | 32 s | Destroy one pin or contest bridge exit |
| 05 | **Pleat Fold** — cover angle | 3 pins; a triangular drape folds outward from its longest edge for 2.5 s, creating a one-hit projectile obstruction with an openly marked weak vertex. Consumes 3. | 38 s | Fire at the weak vertex or attack from behind |
| 06 | **Serrated Seam** — damage route | 2 pins; a thin serrated thread between them vibrates 3 times over 2.4 s. Enemies crossing get one damaging cut per thread pulse **max once per target across the entire spell**; enemies staying still are not repeatedly hit. Consumes 2. | 24 s | Stop crossing or walk around endpoints |
| 07 | **Wrong-Side Hem** — reposition pressure | 2 pins; for 2.5 s allies entering one side of the seam gain a brief 15% speed burst **toward its far endpoint** once. Enemies see the arrow but are unaffected. Consumes 2. | 26 s | Hold the destination endpoint / destroy pins |
| 08 | **Tacking Waltz** — formation cue | 3 pins; over 3 s, projects three **ordered** steps. Allies who intentionally pass steps 1→2→3 receive a shield upon finishing; skipping a step gives no reward. Consumes 3. | 40 s | Deny a step; the route can be read and contested |
| 09 | **Silhouette Dress** — false threat / information | 1 pin; raises a life-size garment cutout for 3.5 s that **visibly advertises** one fake ability windup on Mirelle's next R selection but causes no damage. The fake always has different stitching from a real cast for skilled readers. Consumes 1. | 35 s | Recognize the dotted stitching or destroy the cutout |
| 10 | **Grand Atelier** — teamfight ultimate finish | 3 pins spanning a valid triangle, all within 150 GU. After a 1.0 s telegraph, a fabric canopy unfolds for 4 s. Allied units inside gain **direction-dependent** 15% incoming damage reduction and 10% faster recovery from *future* non-ultimate casts. Enemies may move freely; seams can be destroyed to collapse the canopy. Consumes 3. | 90 s | Break a support seam, fight from outside, bait the final layout |

**Resource contract:** S1 stock is a three-charge resource (one charge recharges every 5 s), maximum three active pins; choosing pages is free, casting costs mana and locks R for 7 s. All pin consumption occurs only **after** target/path/LOS validation. Ticking, reflection and damage-protection effects use central engine primitives, not bespoke client-side shortcuts. Page 10 is her high-impact ultimate; the other nine pages keep her active between major fights. All cooldowns are first-playtest values; resource economy must be tested against typical fight length and one-lane width.

**Fight / counter:** focus a pin as soon as she commits to a triangle, rotate the battle outside her prepared geometry, or force spells when she holds only one pin. **AI cue:** choose pages by expected ally survival, route safety, projectile timing and objective control—not a fixed spell chain. **Uniqueness gate:** no elemental invocation recipes, no orb passive stat cycling, no Quas/Wex/Exort keyboard layout, no AoE meteor/EMP/ice wall or summoned elemental familiar copied from classic kits.

## 32 — Maelis Chromabloom, **The Conservationist of Ruin**
**Legacy:** Inkognito · **Role:** mutable canvas terrain mage. **Look:** older museum conservator, square terracotta paint smock with elaborate ceramic mask repair, enormous collapsible gallery frames; paint is a **structural medium**, not a stream of colored blasts. **Signature:** makes **breakable canvas partitions** that change line of sight during fights.

- **P — Surface Memory:** when a projectile strikes a Maelis canvas, the canvas stores one imprinted property of that projectile (physical/magic/utility; never copies the ability or exact damage), one property per frame.
- **S1 — Unroll the Canvas** *(9 s, 2 charges)*: erects a 55-GU-wide 2-HP translucent canvas for 3.5 s. It blocks ordinary projectiles from **both** teams but permits walking through with a 15% brief movement penalty. No invisible walls.
- **S2 — Restore the Missing** *(13 s)*: repaints a damaged canvas, restoring one HP and changing its surface into a **one-way reveal window** for 2 s; projectiles still obey the same obstruction rules. If no frame exists, instead creates a 30-GU reveal brush stroke (lower power).
- **R — Private Exhibition** *(90 s)*: joins up to three frames into an open-sided gallery for 4 s. Frames rotate one after another every 1.1 s, opening new shooting angles while closing others. Each rotation briefly releases a burst based on the stored property (capped damage or shield pulse, not copied spells). Public arrows preview next positions.

**Fight / counter:** destroy frames, cross through them on foot, or reposition to the currently open side. **AI cue:** cut an enemy artillery angle while preserving a planned allied approach; never block the only legal escape route.

## 33 — Axiom Rail, **The Scrapline Engineer**
**Legacy:** Hexley · **Role:** deployable rail-gunner / engineering carry. **Look:** compact mechanic with one offset railcart cannon on the shoulder and a hydraulic knee, not a shapeshifting hammer/rifle. **Signature:** builds **temporary train-track firing logistics**.

- **P — Gauge Check:** when Axiom's attack travels within 12 GU of one of his rails it accrues a Gauge token (max 3). Rails are visible to enemies and may be dismantled.
- **S1 — Lay Track** *(8 s, two charges)*: draws one 65-GU segment on legal ground, with open endpoints and a 2-HP switching junction. Max two segments active for 5 s; rail cannot bisect spawn or an objective collision.
- **S2 — Switch Engine** *(12 s)*: sends a small unmanned rail cart along connected track for up to 2.5 s. It fires light suppressive bolts **only at targets with direct LOS from the cart**; enemies can destroy it or stand away from the rail.
- **R — Terminal Delivery** *(80 s)*: charges a heavy shell on the **furthest linked cart/rail endpoint** for 0.9 s, then fires one broad, telegraphed 95-GU shot aligned to the track. Consumes Gauge for range **not** lethal damage. If no rail survives, R refuses cast and preserves cooldown.

**Fight / counter:** break track junctions, approach perpendicular, or wait until the cart's firing window expires. **AI cue:** route fire around a defensive shield from a legal side lane pocket, not free-fire through terrain.

## 34 — Brakka Fenn, **The Civic Enforcer**
**Legacy:** Knuckleberry · **Role:** anti-aggression brawler / custody control. **Look:** heavyset one-eyed town marshal whose gauntlets are giant document stamps, wearing battered city uniform and public warrants. **Signature:** applies **behavioral restraining orders** with openly marked exits, not a Vi-style lockdown leap.

- **P — Repeat Offender:** an enemy that damages the same ally twice within 3 s gains a public Offender tag for 4 s (once per enemy / 8 s), giving Brakka 10% faster movement when approaching that enemy.
- **S1 — File Complaint** *(8 s)*: stamps a 45-GU-wide circle on the ground, warning for 0.5 s. Offenders within receive a 0.4 s stagger and ordinary enemies take light damage; nobody is automatically grabbed.
- **S2 — Right of Way** *(12 s)*: Brakka forms a 55-GU escort path **to one protected ally**, briefly body-blocking incoming basic attacks when physically between attacker and ally. If he leaves the path he loses the guard.
- **R — Writ Served** *(84 s)*: targets one Offender in 110 GU and projects a **public 75-GU exclusion disk** around that enemy for 3 s. The tagged enemy is free to walk **out** at any time; if they remain and attack the previously targeted ally, Brakka's counterstamp inflicts one 0.55 s disarm and moderate damage. Not an automatic targeted slam or suppression.

**Fight / counter:** leave the marked disk, switch targets, or lure Brakka away from his escort line. **AI cue:** punish a real diver focusing the carry, not tag an enemy merely because R is ready.

## 35 — Pippa Fuseburst, **The Firework Stagehand**
**Legacy:** Boomie · **Role:** explosive showrunner / wave-clear carry. **Look:** short, scarred **adult** stage rigger in fireproof powder-blue jumpsuit, lighting tools, collapsible firing racks and confetti wheels; no Jinx-like weapon swap, zap slow or global rocket execute. **Signature:** sets up **staggered stage cues** enemies can read and dodge.

- **P — Cue Card:** Pippa stores one Showstopper token when a **scheduled** explosion catches at least one enemy champion; max 2; one token per cast, no kill-triggered speed frenzy.
- **S1 — Rack and Spark** *(8 s)*: installs a waist-high fireworks rack for 4 s (2 HP); its indicator previews a thin 45-GU blast lane. After 0.9 s it fires once along that lane, then burns out.
- **S2 — Move the Spotlight** *(12 s)*: rotates an **unfired** rack 90° after a 0.45 s warning or, with no rack, drops a small no-damage distraction flare that reveals an area for 2 s.
- **R — Opening Night** *(88 s)*: lays a 120-GU-wide stage grid with **four sequential firing squares**, each warned 0.75 s before ignition. The final square is chosen from three legal candidates at cast start; consumes Showstopper for an additional shield-break pulse (not more raw burst). At every tick at least one contiguous walkable escape cell must remain.

**Fight / counter:** smash racks before ignition, leave the lit square, or move with the timed sequence instead of remaining trapped. **AI cue:** create a moving denial screen as allies secure the boss; aim based on predicted routes, not omniscient future positions.

## 36 — Lulla Faespring, **The Keeper of Unfinished Dreams**
**Legacy:** Fizzlewing · **Role:** spell-recovery controller / anti-combo mage. **Look:** unnervingly calm adult moth archivist with a quilted cloak, waist-hung mechanical bedside clocks and large glass chime ring. **Signature:** doesn't stop enemies *casting*; she makes **repeated completed casts leave a visible afterthought**, creating windows her team can exploit. **Absolutely no orb teleport, phase shift, circle silence or dream-tether.**

- **P — Drowse Ledger:** an enemy champion completing a **non-basic-attack ability** within 95 GU of an active Lulla chime accumulates one Drowse note (max 2, 4 s duration). Each unique cast can add at most one note. Notes do not affect the cast that just finished.
- **S1 — Hang the Chime** *(8 s, two charges)*: places a 2-HP wind chime on legal ground within 125 GU, lasting 5 s. It projects a public 95-GU listening radius. Max two chimes; destroying a chime ends its aura but does not retroactively cancel completed spells.
- **S2 — Borrowed Yawn** *(13 s)*: consumes one Drowse note on an enemy in 130 GU. On that enemy's **next successfully completed non-basic spell** within 3 s, adds **0.35 s post-cast recovery** after the spell's effect already resolves; if no valid cast happens, the tax expires harmlessly. No silence, disable, cast failure or stealth.
- **R — Intermission Theater** *(90 s)*: opens an 135-GU circular dream stage for 4 s, with **three announced chime beats** at 1, 2, and 3 s. Enemy casts which *complete inside* a beat window pay 0.25 s post-cast recovery (subject to the global recovery cap), while allied casts completed during beats gain 12% shorter recovery (never faster windup). Enemy spell results and damage still occur normally.

**Fight / counter:** destroy chimes, cast outside their listening radius, or stagger casts between visible theater beats. **AI cue:** deploy near a known upcoming enemy combo or objective contest; save R for multiple enemies preparing windups, not as a panic global silence. **Originality gate:** no phase immunity, no untargetability, no teleporting projectile, no area silence, no tether-and-snap punishment.

## 37 — Bryx Emberkite, **The Thermal Sailor**
**Legacy:** Wickety · **Role:** zone mobility / current shaping. **Look:** sun-battered wind sailor with a damaged one-sided glider board, patched cream sails and bright coral thermal vents; no Sticky Napalm, Flamebreak, Firefly flight path or lasso drag. **Signature:** deploys **rising and falling thermal currents** that modify movement **voluntarily**.

- **P — Read the Updraft:** Bryx sees public warm-air flows left by his vents; traveling **with** a current for at least 40 GU gives him one Sailspeed charge (max 2), consumed by next ordinary attack for bonus range.
- **S1 — Plant Thermal** *(9 s)*: plants a 2-HP 3-s hot-air vent, generating a visible 80×35-GU directional ground current. Walkers keep control; movement in arrow direction receives 15% speed, against it receives 10% slow. Does not lift units over hard walls.
- **S2 — Trim Sail** *(13 s)*: rotates one active vent by up to 90° after 0.5 s tell. Nearby willing allies may accept one **short airflow boost** along the new direction, capped at 22 GU with full world-collision checks. Enemies get no forced flight.
- **R — Thermocline Crossing** *(87 s)*: connects two vents into a broad angled airflow corridor for 4 s; allies crossing end-to-end gain a small evasion-of-next-basic-attack buff, enemies fighting into the current lose some projectile range. Opponents can destroy a vent to end the corridor.

**Fight / counter:** fight sideways to the thermals, destroy vents, exploit his low threat without setup. **AI cue:** rotate a route toward safety or flank; no free escape over terrain.

## 38 — Murdle Ridgehide, **The Living Palisade**
**Legacy:** Hedgehoggin · **Role:** mobile fortification tank. **Look:** squat scarred **pangolin-like** creature with detachable armored dorsal segments, clay talons and patchwork iron saddle; no Bristleback-like rear damage reduction, sticky goo or warpath attack stacks. **Signature:** tears away his own armor to **build small breakable fortifications**.

- **P — Plate Accounting:** Murdle begins with 4 dorsal plates, each providing 4% damage reduction from any direction. Each deployed plate removes its personal reduction until recovered after expiration or collected. Plate inventory shown openly.
- **S1 — Shed a Wall** *(8 s)*: detaches one plate and props it as a 40-GU breakable low wall for 4 s. It blocks one ordinary projectile from **either** team, never closes a chokepoint fully. Max two active walls.
- **S2 — Recall Shell** *(12 s)*: reels one deployed plate along a visible 60-GU path back toward Murdle; units crossed are lightly nudged to nearest free ground but never stunned. Recovered plate re-enters passive armor only upon reaching Murdle; destroyer removes it until its natural recovery timer.
- **R — Fortress Migration** *(92 s)*: for 5 s, Murdle can redeploy up to three plates as a **moving staggered palisade** advancing 60 GU. Each plate remains individually destroyable, with gaps at least two hero diameters wide. His own armor drops dramatically while the wall travels.

**Fight / counter:** hit Murdle while he has shed armor, break the leading plates, or navigate through the deliberate openings. **AI cue:** trade personal safety for a real allied retreat lane, not spam armor barriers when no threat exists.

## 39 — Nemea Halolink, **The Choir Conductor**
**Legacy:** Orbiton · **Role:** spacing / synchronized casting support. **Look:** severe middle-aged maestro holding two tuning forks, no glowing permanent nearest-ally tether; performers are heard as positional *notes*. **Signature:** encourages **spread-but-connected choreography** via timed notes.

- **P — Audible Interval:** whenever two distinct allies finish spells **within 0.6–1.4 s of each other**, Nemea gains one Harmony note (max 3; one per pair / 8 s). No reward for simultaneous spam; notes are visibly displayed.
- **S1 — First Note** *(8 s)*: creates a small 35-GU score circle lasting 3 s; the first ally entering receives one **shield-on-next-damage** token valid 2 s. Max two circles; a given ally benefits once per cast.
- **S2 — Second Note** *(13 s)*: links **two separate score circles** with a luminous 130-GU-max segment. Allies *crossing the segment in either direction* gain 10% movement speed for 1.5 s, once per hero. Enemies can attack circles; the segment is not a tether on bodies.
- **R — Chorus Arrival** *(92 s)*: consumes Harmony to lay three successive public beat circles around the team over 3 s. Allies who voluntarily reach their assigned **different circles** on the announced beat receive a capped shield and brief recovery reduction, while clumping in one circle gives only minimal healing. Does not automatically shield the entire team in place.

**Fight / counter:** contest one destination circle, disrupt the timing, or force allies to cluster. **AI cue:** check whether at least two allies can reach distinct circles before committing R; do not fire just because five teammates are nearby.

## 40 — Thimble Briarwish, **The Walking Gardener**
**Legacy:** Pixabelle · **Role:** portable cover / botanical support. **Look:** tiny elderly fae gardener hauling a giant squeaking terrarium barrow, patched mittens, roots growing through ceramic pots; no polymorph/massive-grow knockup kit. **Signature:** grows **movable, low temporary roofs and hedges** while allies navigate them.

- **P — Seedbank:** after an ally uses cover Thimble created to block a projectile, she collects one Seed (max 2; one per source shot). Seeds improve next planter's hit points; never grant permanent ability amp.
- **S1 — Plant Shelter** *(9 s)*: places a 40-GU dome planter lasting 4 s. It blocks **one arcing/lobbed enemy projectile**, not direct-fire bullets; ally and enemy walkers pass underneath freely. 2 HP baseline.
- **S2 — Wheelbarrow Walk** *(12 s)*: pushes a planted shelter along a valid 55-GU ground segment for 2.5 s. Allies who stay in its moving shade gain minor HP regeneration; the caster is slowed while pushing. Cannot move through walls.
- **R — Traveling Orchard** *(90 s)*: sends **three** small low-roof planters along separate, explicitly visible 70-GU routes for 5 s. Each blocks one overhead attack then crumbles. The gaps remain traversable; Thimble cannot be in three places at once and is vulnerable while directing them.

**Fight / counter:** use ground-level attacks, break roofs, or walk behind the gardener's slow cart. **AI cue:** deploy roof against *known incoming lob trajectories*, not to block basic attacks incorrectly.

## 41 — Sevrin Inkseal, **The Magistrate of Repetition**
**Legacy:** Muffleton · **Role:** anti-pattern controller / decision tax. **Look:** exhausted court magistrate in layered burgundy robes and a huge tablet pauldron, carrying a multi-headed law stamp; no Death Prophet or Silencer-style global silence. **Signature:** penalizes **repeating the same tactical category** in one small jurisdiction.

- **P — Case Law:** observes completed enemy skills within 120 GU and records their declared **server-side category** (`mobility`, `attack`, `protection`, `control`). Only one last category per target, lasting 4 s; does not read hidden cooldowns or private abilities.
- **S1 — Mark Jurisdiction** *(9 s)*: stamps a 70-GU public court disk around a visible 2-HP breakable ink pillar for 3.5 s. Opponents may enter and cast normally. A champion's **second completed skill of the same category** inside the disk receives 0.25 s post-cast recovery, once / target / disk. A different category resets its local repeat count.
- **S2 — Appeal Granted** *(13 s)*: relocates an existing court center up to 45 GU after a 0.45 s warning, or if targeting an ally inside, erases **one** pending cast-recovery tax on that ally. Does not silence or imprison anyone.
- **R — Precedent Review** *(95 s)*: for 4.5 s expands one active court to 125 GU and publishes the current recorded category above every participating enemy. If an enemy repeats the same category a third time, they take one **small shield-stripping hit** and 0.35 s post-cast recovery (subject to global cap). Switching categories avoids penalty; no global affecting enemies elsewhere.

**Fight / counter:** cast mixed categories, move out of jurisdiction, destroy its center ink pillar (2 HP), or simply accept a manageable recovery delay. **AI cue:** use R against predictable repeated mobility/protection chains, not as an interrupt button; evaluate category history from public cast events only.

## 42 — Koro Cloudtail, **The Aerial Polewright**
**Legacy:** Stafford · **Role:** agile route fighter / temporary team mobility. **Look:** nimble simian scaffold builder with bamboo-jointed pole stilts, chalk measuring rope and light tool satchels; no monkey clone, spinning staff ultimate or extended auto-lock hits. **Signature:** builds **vault poles as optional route devices**.

- **P — Measured Landing:** landing on legal ground after his own vault grants Koro a 2 s balanced stance; next basic attack has a small shield break bonus. No stacking knockups.
- **S1 — Plant Vault** *(8 s, 2 charges)*: plants a 2-HP pole at a legal ground point within 110 GU. It stands 5 s, visibly previews a 60-GU landing arc with a collision-tested endpoint. Max two poles.
- **S2 — Pole Transfer** *(12 s)*: Koro or a **voluntarily consenting nearby ally** vaults from one pole to the previewed legal landing point after a 0.45 s windup. Cannot cross hard walls or tower-blocked zones, cannot initiate in hard CC, landing causes only a small radial shove (no full AoE knockup).
- **R — Scaffold Crossing** *(87 s)*: connects two poles with a visible elevated bamboo runway for 4 s. Eligible allies may **individually choose** to take one fast 65-GU arc between the poles. The crossing is not global teleportation; any pole destruction cancels later crossings, passengers already in flight resolve to nearest safe landing.

**Fight / counter:** destroy poles, fight away from vault landing markers, or punish obvious landing recovery. **AI cue:** plant a reachable escape and one flank pole, and require passenger route acceptance.

## 43 — Bram Stonebranch, **The Canopy Regent**
**Legacy:** Primate Minister · **Role:** canopy guardian / overhead protection. **Look:** hulking aging simian monarch with a living leaf crown, wide moss-gold shoulder armor and a **short broad jade scepter**; no staff clone army or circle of striking monkey echoes. **Signature:** grows **overhead canopy** that changes which projectiles can reach the team.

- **P — Old Growth:** when Bram blocks a *lobbed* projectile with canopy cover, he gains one Sap (max 2), empowering his next small shield. Direct low shots are unaffected by canopy.
- **S1 — Root Column** *(9 s, 2 charges)*: plants a 2-HP vertical trunk column for 5 s at a legal position, 45-GU radius. Walkers pass around; two columns can support a canopy.
- **S2 — Leaf Intercept** *(12 s)*: grows a **short overhead roof** between two active columns for 3 s. The roof can absorb up to two **lobbed** enemy projectiles; arching artillery is intercepted, low trajectories pass under. If only one column exists, Bram grants that column a small self-shield instead.
- **R — Kingdom of Shade** *(92 s)*: raises three additional short-lived columns forming a 130-GU **open canopy grove** for 5 s. Within it allies take reduced area-splash damage from above, but enemies can walk in, attack the exposed columns, or aim direct projectiles underneath. Canopy doesn't cancel ground hazards.

**Fight / counter:** flank under roofs, use ground-level attacks, or remove support columns. **AI cue:** cover allies against genuine predicted aerial strikes (e.g. Ravelle), not against all damage types. **Character distinction:** Koro builds routes for moving *through* space; Bram builds roofs for surviving *under* space.

## 44 — Toma Bellbreak, **The Thirteenth Bell**
**Legacy:** Kickswitch · **Role:** cast-window counterfighter. **Look:** compact older bell-trained martial artist with heavy bronze wrist bells, battered red canvas and a rooted deliberate stance; no point-click allyward kick ultimate. **Signature:** fights using **telegraphed parry timing** instead of generic knockback combos.

- **P — Listen for the Stroke:** an enemy in 105 GU starting a cast with visible windup grants Toma a public Bell Window until commit (max one tracked per enemy). His next basic attack within 1.2 s after that cast's completion restores 5% missing HP, once / enemy / 6 s.
- **S1 — Open Palm** *(8 s)*: a short 60-GU palm strike that deals modest damage; if it hits during a visible enemy windup, it **does not interrupt**, but grants Toma a parry charge valid 3 s.
- **S2 — Return Stroke** *(12 s)*: consumes parry charge (or performs a weak dry guard) to create a 0.6 s frontal reaction stance. One incoming targeted non-ultimate hit from that frontal arc is partially reduced; after it lands Toma counterstrikes the attacker for moderate damage. Guard is ineffective from behind and against untargeted AoE.
- **R — Thirteenth Bell** *(84 s)*: sets a 1.2 s public dueling rhythm centered on Toma; opponents hear two false chimes then one genuine **final** counter window. If an enemy finishes a damaging cast against Toma during the final 0.25 s, that damage is reduced 35% (not negated) and he sends a non-stunning shockwave outward. Casting earlier or attacking someone else avoids the counter.

**Fight / counter:** vary windup timing, approach from behind, use ground hazards, or simply disengage during the final bell. **AI cue:** predict real incoming commit times from current telegraphs; never read exact unobservable player action timing.

## 45 — Ravelle Skyrake, **The Airspace Duchess**
**Legacy:** Propella · **Role:** airborne surveillance / conditional bombardment. **Look:** battle-worn aristocratic skiff pilot on a fragile fan-powered observation platform, with optical rangefinder, stripy wing-cloth and small survey markers; not a high-attack-speed hovering flak ADC. **Signature:** **reconnaissance determines where timed strikes are legal**.

- **P — Surveyed Grid:** Ravelle's basic attacks or visible direct observation mark 1 of 4 public **map sectors** around her for 5 s. Only sectors she has actually seen can be assigned for artillery. Max two marked sectors active.
- **S1 — Spotting Flare** *(8 s)*: fires a revealing flare into one 60-GU sector for 3.5 s. Does small damage and exposes enemy units who remain in it; does not pierce fog to reveal unrelated sectors.
- **S2 — Reposition Skiff** *(13 s)*: moves the skiff laterally 50 GU along traversable ground projection, with collision at world walls and towers. During travel, Ravelle cannot basic attack; her previously marked sectors remain but are not auto-updated into fog.
- **R — Designated Airspace** *(92 s)*: selects an already-surveyed **2×2 ground grid** totaling 130×130 GU. After a 0.8 s warning, four separate bombardment cells fire sequentially over 3 s **in the declared order**; each cell is shown 0.6 s before it lands, and one guaranteed traversable escape lane remains. Damage is moderate per cell; staying through consecutive cells is costly. All shots use public authoritative sector coordinates, not hidden enemy prediction.

**Fight / counter:** leave the visible target grid, move under overhead protection (Thimble/Bram), destroy spotting systems, or pressure her during vulnerable skiff movement. **AI cue:** mark the objective entrance in advance and schedule cells to make opponents choose between contesting and escaping; do not spam R into unsurveyed fog.

---

# Originality audit and gameplay coherence

**Scope:** This is a creative/gameplay overlap audit, not a trademark clearance, legal opinion, or guarantee that no game in existence uses an individual primitive. Familiar fundamentals (damage, shielding, timed danger zones) are allowed; the test is whether a hero's **four-skill sequence, movement signature, visual silhouette, and player decisions** remain recognizably someone else's design.

| High-risk legacy overlap | Forbidden retained pattern | V3 replacement: core decision |
|---|---|---|
| Fizzlewing → Lulla | orb-teleport + phase immunity + radial silence + dream tether | staged post-cast timing tax; enemy abilities still resolve |
| Arsenaldo → Mirelle | elemental orb recipe / Invoke copy with meteor, EMP etc. | physical pin geometry and ten selectable fabric pattern finishes |
| Hooklyn → Mora | hook + rescue lantern + five-sided spirit cage | voluntary ferry between moorings; contested embarkation and docking |
| Rotisserie → Garruk | hook + rot aura + target suppression | timed mechanical jaw lanes and breakable teeth |
| Boomie → Pippa | weapon toggle + slow zap + global execute missile | stationary firework racks with delayed firing square schedule |
| Aiselle → Ivera | attack slow stacks + global stun arrow | destructible resonance forks and cross-line control |
| Midnight Equation → Vesper Nullcode | black-hole pull channel | directional momentum-bias field with explicit countersteering |
| Muffleton → Sevrin | global silence and single-target silence | local, conditional category-repeat recovery penalties |
| Galejandro → Serrin | crit wind shield + tornado + airborne slashes | crosswind vector routing and projectile angle manipulation |
| Lambent → Orin & Fen | wolf hunter and mutual no-death ultimate | scouting hound, intercept, one-ally voluntary retreat path |
| Sylvan Solo → Droven | summoned spirit bear, roar fear, bear form | tortoise second-body moving cover with guard reserve |
| Cindergent → Rux | chained roots and teleporting fire remnant | postmaster's visible envelope routes and timed delivery |
| Voltaire → Teslan | lightning remnant, pull, ball lightning | rod circuit with switchable polarity and deployable disruption |
| TerraByte → Joruun | stone remnant rolling kick and magnetize | hinged movable slabs with safe passage, no magnetism |
| Fizzlewing and Vixelle crossover | evasive mage dash/escape with automatic charm | Lulla recovery scheduling; Mireth disclosed false paths |
| Stafford → Koro; Primate Minister → Bram | clone staff warrior and duplicate ape-summon court | Koro assembles voluntary pole paths; Bram roofs against overhead fire |
| Pixabelle → Thimble | polymorph/shield/giant ally knockup | portable overhead roof ecology with counterable planter movement |
| Hedgehoggin → Murdle | rear-facing damage reduction + quill spray + stackable chase | removal of own armor plates to make temporary cover |
| Hexley → Axiom | cannon/melee transform + leap + overdrive | tracks, unmanned moving rail cart, aligned fixed-endpoint shot |
| Knuckleberry → Brakka | charged punch + armor shred + locking ultimate dunk | public offender tags, escort line, conditional exclusion order |

## Roster-level uniqueness and balance review

- **Primary hero verbs:** orient, resonate, mislead, breach, contract, occlude, map wind, extract, suspend, choreograph, shelter, cultivate, triage, deliver, conduct, hinge, meter distance, refract, retaliate, survey, count beats, reuse heat, slope, clamp, curve motion, inspect dashes, bank shots, broadside, pressurize, ferry, tailor, conserve, lay rails, escort, stage, defer recovery, trim currents, shed armor, harmonize, move shelters, judge repeats, plant poles, roof, parry, designate airspace.
- **Anti-wombo tools:** directional guards (Solenne), relocations (Mora/Koro), timing disruption (Lulla/Sevrin), overhead defense (Bram/Thimble), anti-dive turnstiles (Coiljack), projectile deflection (Serrin/Teslan), cover reorientation (Maelis).
- **Initiation and offensive tools:** jaw corridors (Garruk), conditional blast timing (Pippa/Ravelle), trajectories and slopes (Dolm/Vesper Nullcode), assault crossfire angles (Calixa/Quillene/Talan), positional traps (Mirelle), punishment against declared commitments (Brakka/Toma).
- **Intentional weaknesses:** extensive setup, breakable objects, limited line of sight, publicly declared routes, interrupted channels, consent-dependent ally transport, and guaranteed open exits. None of the ultimates should give free five-target lockdown or unanswerable damage.
- **Cast input parity:** 44 characters use P/S1/S2/R. Mirelle uniquely has a page palette accessed with R, but uses the same buttons plus a selection UI—not an additional secret ability slot or a ten-spell free-cast hotbar.
- **Mechanical risk:** 45 heroes contain an unusually high amount of geometry, deployables, conditional timing, and AI planning. These create richer tactics but also substantial performance/pathfinding complexity. Prototype foundational mechanics and trim lower-value geometry where tests indicate excessive simulation cost.
- **Provisional values:** GU dimensions, percentages, cooldowns, periods and charges are hypotheses calibrated to an illustrative 18-GU champion radius and 100-GU/s travel. Never treat them as final before observing the actual repo's time-to-kill, lane scale, CC and objective-race metrics.

## Final acceptance of this design phase

1. Every one of the 45 original catalog IDs has an exact one-to-one canonical name and title mapping and one complete P/S1/S2/R kit (Mirelle R contains ten non-elemental pages).
2. Every hero has an identifiable visual silhouette, teamfight job, counterplay mechanism and observable AI cast cue.
3. The old recognizable signature combinations above are explicitly **deprecated and banned as fallbacks**. Reuse existing generic engine primitives only if their resulting kits are materially different.
4. The full art/animation directions and engine/AI/balance/acceptance spec in the companion files are part of V3—not optional background prose.
5. Names, visual designs and ability combinations still require original-art creation, playtesting and professional IP/name clearance before commercial release.
