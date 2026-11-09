# EsportsClash V3 — Original Character Art and Animation Bible

**Companion to:** `ESPORTSCLASH_ORIGINAL_45_HERO_REDESIGN_V3.md`. Concept directions, not generated imagery or rigs. The roster should look like one coherent darkly whimsical, stylized strategy world **without looking like League of Legends or Dota 2 skin swaps**.

## Unified production art rules

- **Silhouette:** each must be recognizable at 64 px height in a MOBA camera. Primary form, prop and secondary head detail must differ from adjacent heroes; avoid all heroes sharing athletic human hourglass shapes.
- **Shape language:** helmets/collars/capes/shoulders are intentional; head:body ratios vary. 25% heroes should be stocky, aged, non-human or unusually proportioned, with anatomical plausibility for their rig.
- **Palette:** choose 2 principal material colors + 1 high-contrast action color. Avoid effects covering entire silhouette; reserve saturation for telegraphs and targets.
- **Character reference:** full body, neutral near-frontal A-pose (or T-pose if rig auto detection requires), neutral lighting, clean transparent RGBA, hand and finger separation, no weapon fused to hands, whole feet visible. Weapons and mechanical rigs supplied as isolated objects with grip/root at world origin and named socket targets. Rendered PNG is reference only: conversion to mesh, retopology, UVs, rigging, animations are separate work.
- **Rig & animation:** torso twist, anticipation, planted foot, follow-through and recoil; ranged windups visibly communicate orientation/impact timing. Each kit's major telegraph has 0.35s+ clearly readable lead-in; true ability execution lives in simulation timeline, not animation events.
- **VFX system:** visually differentiate **ally safe route** (thin warm line and dotted forward arrows), **enemy hazardous zone** (solid bordered geometry with countdown), **destructible construct** (white outlined HP notches), **optional transport** (boarding and disembark icons), and **windup/recovery tax** (clock glyph over casting bar). Never replace important game tells with purely decorative particles.

| # | Hero | Body / face silhouette | Costume, material and prop | VFX and signature animation |
|---|---|---|---|---|
| 01 | **Solenne Vaelor** | older imposing knight; steep triangular pauldrons; close-cropped hair; heavy stance | cream ceramic plate, burnished bronze, scorched vermilion sash; tall hinged heliograph panel | strong shield rotation at hips; wedge is planar amber glass, no sun-laser beam |
| 02 | **Ivera Frostwhistle** | tall broad shoulders, asymmetrical forearm braces; windworn features | ice-blue tuning forks, dark ink wool, matte nickel two-hand bow | pluck bowstrings like a cello; resonant lines vibrate in clear rhythmic bars |
| 03 | **Mireth Lune** | one-tailed foxlike archivist, stooped thoughtful pose; angular brows | gray-blue road cloak, chalk-white route tablets, copper map clasps | projects headings as thin road arrows; false doorway must show true exit |
| 04 | **Bramm Coil** | barrel-chested miner with mismatched leg bracing, square jaw | soot leather, hazard orange stitching, riveted hydraulic ram harness | deliberate anchor slam and recoil, machinery rather than shotgun smoke |
| 05 | **Kael Vespera** | gaunt middle-aged duelist, long forearms, stern narrow face | slate trousers, ink seals, matte scarlet ledgers that form paired crescents | public red contract ledger appears above duel target; no execution dive pose |
| 06 | **Nyxara Vale** | angular thief with protruding geometric silhouette fins, masked face | charcoal ceramic plates, sharp white stitch seams, hinged shadow projectors | shadows remain planes on the floor, footsteps betray her actual path |
| 07 | **Serrin Galecrest** | lean weathered sailor, swept white hair, vane on back | storm-teal cloth, pale steel blade, painted nautical compass | translucent airflow arrows; blade only cuts to establish wind vectors |
| 08 | **Orin and Fen** | one-eyed lantern ranger plus squat horned dusk-hound, two independent rigs | tarnished copper lantern, muted russet furs, amber smoke fur | hound body-block snaps and retreats; ally rescue road glows like lantern string |
| 09 | **Quillene Rook** | hawk-nosed archer, feather-ridged asymmetric collar | plum canvas, chalk-gray kite rig, lacquered pointed feather arrow cases | suspended mini-kites visibly tension before splitting her arrows |
| 10 | **Aurelio Vane** | tall thin older ballroom marshal, unmasked lower face, huge pointed shoes | black velvet armor, pearl white gaiters, gold floor chalk | floor choreography arrows, clear voluntary swap icons, not dancing hearts |
| 11 | **Droven Bearmantle** | scarred compact warden + broad heavy moss tortoise; visibly unequal forms | olive bark plates, fur mantle, jade turtle shell with copper repairs | tortoise plants as moving wall; transfers guard energy as visible threads of shell light |
| 12 | **Thalara Rootwright** | hunched elderly mushroom-sculptor with wide parasol collar | porous ceramic, fungi jade, dry amber spore jars | connected nodes bloom as soft rooted networks and then visibly wither when destroyed |
| 13 | **Vesper Loom** | spidery silver-haired surgeon, long arms, four tiny medical tool appendages | plum antiseptic apron, ivory medical mask, silk bobbin shoulders | pulls wound meters with precise surgical motions; no pink invulnerability cross |
| 14 | **Rux Emberchain** | wiry postal runner with one oversized shoulder parcel harness | sealed wax crimson, post-office parchment, blue-black iron roller boots | mail moves on dashed public delivery routes; envelopes display fuse timers |
| 15 | **Teslan Veyr** | angular goggled engineer; copper antenna hairstyle | black rubber, tarnished copper, acid-yellow hazard braid | hammer-taps rods and switches circuit polarity; beam displays current direction |
| 16 | **Joruun Jadecoil** | square jade titan with asymmetrical hinged plates, small head | teal granite, pale veined stone, brass counterweights | slamming masonry swings sideways like giant doors; opening arrows show gap |
| 17 | **Astrax Mire** | tall narrow pilgrim in measuring-cord poncho; exposed skeletal hands | charcoal cloth, pale astral thread, moss-white mile markers | tight measure-line bands follow target footsteps; no portal strike particles |
| 18 | **Prismelle Cade** | muscular short crowned regent, heavy one-sided arm shield | smoked purple crystal, rose brass, milk-glass shards | panes stand like optical studio screens, rays preview bend paths |
| 19 | **Ashkar Veilhand** | scarred former soldier-monk, bowed posture, forged ember bells | char-black prayer tags, dusty cinnabar robe, battered iron pauldrons | targets visibly show their own attack-generated ember count, no invisibility cloud |
| 20 | **Maris Solquill** | practical old pathfinder with bent nose, sextant crossbow | parchment white, cobalt cloak, antique brass fold-out reliquary | ground-traversed waypoint lines emit one receipt-like heal at completion |
| 21 | **Odo Bogsong** | stout elder toad in broad drummer waistcoat, very short legs | peat green, ochre reed wood, purple throat sac | mouth and drum sync to crisp three-beat meter; rings pulse on bar lines |
| 22 | **Mourn Ashwake** | human-shaped black furnace with ember chest grate, lowered head | anthracite steel, dusty ash gray, ember-red chimney ribs | vents swing like foundry shutters; expired ash patches re-ignite directionally |
| 23 | **Dolm Runesunder** | squat seismic surveyor with huge pendulum shoulder weights | slate ochre, pumice tan, copper angle gauges | sloped tiles display rolling contour arrows and predictable slide vector |
| 24 | **Garruk Mawsuture** | bulky smith with vise-jaw mask and multiple folding teeth | black wrought iron, bone rivets, dried-red leather | teeth clack in three escalating audible stages; no belly hook or mouth suction |
| 25 | **Vesper Nullcode** | androgynous severe mathematician, huge broken gyroscope halo | midnight indigo, chalk alabaster, stained-gold orbit arms | movement arrows bend slowly along tangents, never collapse into a black hole |
| 26 | **Coiljack Ampfist** | short stocky electrician, square gauntlets like traffic gates | industrial yellow, dark graphite, safety-red chevrons | physical turnstile bars spring at dash collision; no grappling-hand extension |
| 27 | **Talan Slipshot** | lean bespectacled surveyor with tool-slung shoulders | oxidized brass, faded blue cotton, white ceramic reflectors | crisp single-bounce angle previews across mirror planes |
| 28 | **Calixa Broadwake** | rugged weather-lined privateer with rectangular captain hat | salt-green wool, navy leather, tarnished gold double gun spar | mini ghost ship glides broadside at ankle height, timed port/starboard flashes |
| 29 | **Brohm Caskfall** | big brewmaster with visible bubbly tanks and broad rubber boots | olive copper brewery harness, plum overcoat, white foam glass | foam flows with directional vector stripes and pressure gauge dial |
| 30 | **Mora Fenhook** | elderly dark-water ferrier, thin silhouette under deep hood | swamp brown oilcloth, blue lantern chain, dull silver boat oar | boarding circles and boat trajectory appear clearly, not hook chains or spirit cages |
| 31 | **Mirelle Vane** | sharp-eyed mage girl in her twenties, slim functional silhouette with oversized needle-hair comb | ivory fitted waistcoat, oxblood petal skirt, ink-black asymmetric sleeve, flat boots, paper pattern cape; needle familiar | setting *physical* pin seals; fabric unfolds into crisp stitched geometric planes, never elemental orbs |
| 32 | **Maelis Chromabloom** | older conservator, square paint-work smock, mask with one gold repair | terracotta sienna, verdigris, chalk plaster panels | paint begins dry and is lifted into real canvas sheets that can shatter |
| 33 | **Axiom Rail** | compact mechanic with offset rail-cart shoulder and hydraulic knee | dark silver, signal orange, olive workwear | drawn rails have projected branch arrows; cart slides and fires on scheduled ticks |
| 34 | **Brakka Fenn** | heavyset one-eyed marshal with huge stamp-punch gauntlets | indigo city uniform, copper stamp heads, paper notices | oversized public warning placards, target always sees legal exit line |
| 35 | **Pippa Fuseburst** | short mischievous adult stage rigger, practical fireproof suit and scarred gloves | powdered blue jumpsuit, bronze spark stands, sunset confetti | prop rigs pop one at a time; stages of overhead fireworks show safe gaps |
| 36 | **Lulla Faespring** | eerie pale moth archivist, broad quilted mantle, circular glass chime array | dusty lilac, moonstone cream, tarnished pewter, soft ocher sleep-scrolls | post-cast chimes visibly ring; theater intermissions use enormous readable clock hands |
| 37 | **Bryx Emberkite** | angular sailor with damaged one-sided sailboard, asymmetrical goggles | sun-bleached cream sails, deep teal, ember coral sails | thermal vents show strong directional wind arrows; no napalm flames / lasso |
| 38 | **Murdle Ridgehide** | broad armored pangolin-like brute, segmented detach-able dorsal plates | moss iron, burnt ivory, brick clay spine plates | spines detach as barricades and strip visible armor from his back |
| 39 | **Nemea Halolink** | middle-aged conductor with wide collar and floating tuning forks | dusk violet coat, honey-gold forks, black sheet-music cape | individual notes and beat circles, no persistent glowing health tether |
| 40 | **Thimble Briarwish** | tiny elderly fae with an oversized terrarium wheelbarrow, hunched potter hands | earth-green felt, rose terracotta jars, warm mushroom light | miniature planter roofs travel along the ground; allies get small visible cover |
| 41 | **Sevrin Inkseal** | tired thin judge in layered public service robes, broad stamped pauldron | parchment bone, judicial burgundy, ink-black tablets | repeats shown as category glyphs and ink pillars; no global silence blast |
| 42 | **Koro Cloudtail** | wiry simian builder-monk with long arms and vault stilts, short agile tail | bamboo green, warm sandstone, chalk white harness | plants actual bamboo vault poles; jumping arcs include public landing marks |
| 43 | **Bram Stonebranch** | huge aging simian monarch with living leaf crown, weathered muzzle | bark-gold armor, dark forest green, jade scepter cap | roof grown from column supports; downward lob shots break against canopy leaves |
| 44 | **Toma Bellbreak** | stern older martial master with enormous bronze wrist bells, rooted stance | dark red canvas, aged brass, charcoal trouser wraps | misleading feint windup and distinct real counter-guard gesture |
| 45 | **Ravelle Skyrake** | rugged aristocratic skiff pilot, visibly exposed turbine sails and spying telescope | navy indigo, striped ivory wings, weathered copper | overhead public 2×2 grid and delayed selected squares, never indiscriminate gunship bursts |

## Rigging and animation deliverables per hero

1. `hero_reference_front.png`: front-biased full-body neutral pose with clothing and silhouette intact, no merged equipment.
2. `hero_reference_side.png` and `hero_reference_back.png` when practical; keep consistent proportions and materials.
3. `equipment_reference_*.png`: isolated primary rigged prop or weapon, if any, with stated socket (`right_hand_socket`, `left_hand_socket`, `back_socket`, `hip_socket`, or `root_equipment_socket`).
4. Concept texture/material board: metallic/roughness bands and cloth/skin/bark/ceramic distinctions; add mask zones for VFX glow.
5. Motion set: idle, locomotion, attack anticipation/fire/recovery, S1 windup/commit/recover, S2 windup/commit/recover, R windup/commit/recover, hit reaction, stun, death. Summon/devices require matching simple motion states.
6. Rig quality gate: normalized facing; spine/pelvis alignment; detached weapon grips; shoulders, elbows, wrists, knees flex without catastrophic clipping; skinned model LOD; retarget tests for each move. Treat auto-rig as first pass requiring deformation review.
7. Telegraph quality gate: at strategic camera zoom, a viewer can identify danger direction, geometry, expiry and breakable components within 0.3 s. White uncolored wireframe fallback must still communicate danger to color-blind users.

## First five character art prototypes to approve

**Mirelle:** very recognizable asymmetrical tailoring silhouette; compare her against any generic elemental mage. Her needles and cloth constructs must visually explain pin count and pattern shapes.

**Lulla:** frame the character around an eerie bedside-clock/moth design, not a fairy-dragon. Spell visuals communicate 'you may cast, but the aftermath is costly' through delayed clock-tail recovery UI.

**Mora:** ferryman rather than chain warden. Ferry must have a visible travel lane, boarding prompt and end stop; the oar is for steering, not hooking.

**Vesper Nullcode:** curved chalk arrows and broken gyroscope define movement bias. Never use a swirling center black hole.

**Koro:** builder's poles, angular landing markers and a climbable path establish originality; no duplicate monkeys and no spinning staff storm.
