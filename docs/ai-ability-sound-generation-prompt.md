# Ability sound catalog and generation

The catalog below is the source of truth for all 135 current active abilities: three abilities for each of the 45 playable avatars. The local ElevenLabs pipeline parses these headings and filenames directly.

From `EsportsClash.Web`, validate the catalog without making API calls:

```powershell
npm run generate:sounds -- --dry-run --all
```

Add the key to the ignored `EsportsClash.Web/.env` file (not the root `.env`), with this variable name and no `VITE_` prefix:

```powershell
ELEVENLABS_API_KEY=your_key_here
```

Replace `your_key_here` locally; do not paste the key into chat or commit the `.env` file. The generator reads that file directly. Install FFmpeg locally and make it available on `PATH`, then from `EsportsClash.Web` run:

```powershell
npm run generate:sounds -- --batch 1
```

Run batches 1–3 separately, or use `--all`. A rerun resumes by validating and reusing completed WAVs; add `--force` to regenerate them. If a response remains slightly short after one longer-duration retry, the script applies a modest pitch-preserving time stretch and validates the result; substantially short or overlong cues still fail instead of being padded with silence. The script writes validated assets under `public/audio/abilities`, updates `manifest.csv`, and creates batch ZIPs under `artifacts/`. Do not commit or share the API key.

The prompt block remains available for audio tools that do not use the local API pipeline:

```text
You are the senior sound designer for an original top-down fantasy arena game. Use your audio-generation capability to create a cohesive, realistic, game-ready sound-effects library for every ability in the catalog below.

IMPORTANT CAPABILITY CHECK
- Generate actual audio files, not written imitations such as “whoosh, boom,” not links to unrelated stock effects, and not base64 pasted into chat.
- If this chat cannot generate or attach audio files, say that clearly before doing any other work. Do not pretend files were generated.
- There are exactly 135 files. If the tool cannot reliably create all of them in one job, work in the three numbered batches below, in order. Finish and package one batch before starting the next. I can reply “Continue with Batch 2” or “Continue with Batch 3.”

CREATIVE DIRECTION
- Build an original sonic identity. Do not imitate, sample, or closely reproduce recognizable sounds, melodies, announcer lines, or character voices from League of Legends, Dota, or any other existing game.
- Every file must be a single dry one-shot cast/impact cue suitable for immediate playback when the ability is activated. Do not make looping ambience.
- Make each cue communicate its gameplay immediately: a sharp readable onset, a distinct material or magical body, and a clean short tail.
- Skill 1 should usually feel quick and readable; Skill 2 should emphasize movement, defense, control, or setup; Ultimates should sound broader, heavier, rarer, and more consequential without simply being louder.
- Match the described material: steel should have physical weight; wind should have airy motion; fire should crackle and bloom; lightning should snap before it rumbles; stone should fracture and shed debris; organic magic should feel woody, leafy, fungal, animal, or fluid; void effects should feel unstable, low, spatial, and uncanny.
- For abilities with several actions, design one compact sequence within the same file. For persistent, transformation, or channeled abilities, create the activation cue only, with a tail that suggests continuation.
- Avoid excessive sub-bass, harsh high-frequency spikes, muddy reverb, generic cinematic braams, and sounds that mask combat for several seconds.
- No speech, whispers, chanting, intelligible vocals, character names, music, rhythmic backing tracks, UI confirmation beeps, or long environmental beds.

DELIVERY SPECIFICATION
- Deliver uncompressed WAV, 48 kHz, 24-bit PCM, mono. Mono is required because the game applies positional stereo panning at runtime.
- Use the exact lowercase filenames listed below. Do not rename, number, or add suffixes to them.
- Trim leading silence to 10 ms or less and unnecessary trailing silence to 50 ms or less. Do not cut off designed reverberation tails.
- Target duration: Skill 1 = 0.45–0.90 seconds; Skill 2 = 0.55–1.10 seconds; Ultimate = 1.20–2.20 seconds. A complex multi-hit cue may exceed its range by up to 0.35 seconds when necessary.
- Use a true-peak ceiling of -3 dBFS. Keep perceived volume consistent across the whole library. Ultimates may feel about 2 dB stronger than basic abilities, primarily through density and low-mid weight rather than peak loudness.
- Do not normalize every file independently to 0 dBFS, hard-clip, or apply obvious limiter pumping.
- Package each completed batch as a ZIP while preserving the filenames. Also attach a UTF-8 CSV manifest with: avatar, slot, ability, filename, duration_seconds, sample_rate, bit_depth, channels, peak_dbfs.
- Before delivery, validate that every listed file exists exactly once, opens correctly, is mono 48 kHz WAV, and has no clipped samples.

BATCH 1 — AVATARS 1–15 — 45 FILES

1. Solana / Dawnna
- Skill 1 — Solar Shieldbash — A shield-led solar metal bash that stuns and raises a radiant barrier. Filename: solana_skill1.wav
- Skill 2 — Zenith Lance — A focused celestial lance roots its target, followed by a rapid armored dash. Filename: solana_skill2.wav
- Ultimate — Daybreak Flare — A giant solar beam blooms into a central stun and wide slowing flare. Filename: solana_ultimate.wav

2. Astra / Aiselle
- Skill 1 — Volley Cone — Seven frost arrows fan outward with crisp bow releases, icy flight, and slowing impacts. Filename: astra_skill1.wav
- Skill 2 — Frost Flurry — A cold acceleration surge drives a fast five-arrow barrage. Filename: astra_skill2.wav
- Ultimate — Enchanted Crystal Comet — A massive crystalline ice arrow tears across the lane and shatters into a long stun. Filename: astra_ultimate.wav

3. Kyumi / Vixelle
- Skill 1 — Orb of Illusion — A bright arcane orb travels outward, turns, and returns with a purer second strike. Filename: kyumi_skill1.wav
- Skill 2 — Charm of Longing — A delicate magical lure blossoms into a compelling charm pulse. Filename: kyumi_skill2.wav
- Ultimate — Spirit Rush — Three extremely fast spirit dashes launch homing spectral bolts toward wounded enemies. Filename: kyumi_ultimate.wav

4. Buck / Gritlock
- Skill 1 — Powder Keg Blast — A heavy powder shell fires and detonates in a forceful T-shaped blast. Filename: buck_skill1.wav
- Skill 2 — Smoke Screen — A canister pops, hisses, and rapidly spreads dense vision-obscuring smoke. Filename: buck_skill2.wav
- Ultimate — Collateral Blast — A devastating cannon shot creates a huge forward blast and violent backward recoil. Filename: buck_ultimate.wav

5. Valkira / Bessara
- Skill 1 — Crescent Cleave — Twin blades sweep in a broad crescent, with a sharper outer-edge cut and deep bleed. Filename: valkira_skill1.wav
- Skill 2 — Iron Will Slam — Both blades strike the ground, forming a dense iron shield and radial shockwave. Filename: valkira_skill2.wav
- Ultimate — Executioner's Descent — A sudden vanish, predatory arrival behind the victim, suppression hit, and lethal downward slam. Filename: valkira_ultimate.wav

6. Kage / Vanta
- Skill 1 — Shadow Shuriken — Spinning crimson shuriken cut through the air and bite into a distant target. Filename: kage_skill1.wav
- Skill 2 — Shadow Projection — A shadow tears free into a mimic clone, followed by a subtle swap-ready phase cue. Filename: kage_skill2.wav
- Ultimate — Eclipse Mark — A void-dark teleport brands the victim with layered crimson death marks that end in a delayed mirror detonation. Filename: kage_ultimate.wav

7. Kazemaru / Galejandro
- Skill 1 — Tempest Thrust & Gale — A katana thrust releases a howling blue tornado that lifts enemies. Filename: kazemaru_skill1.wav
- Skill 2 — Zephyr Barrier — A shimmering vertical wall of compressed wind forms and disintegrates incoming projectiles. Filename: kazemaru_skill2.wav
- Ultimate — Airborne Sever — A blink to airborne enemies leads into five rapid golden blade slashes and a final armor-rending cut. Filename: kazemaru_ultimate.wav

8. Kindra / Lambent
- Skill 1 — Ghoststep Volley — A graceful spectral vault releases three purple spirit arrows toward nearby enemies. Filename: kindra_skill1.wav
- Skill 2 — Shadow Pounce — A spirit territory opens and a shadow wolf lunges with a furious bite. Filename: kindra_skill2.wav
- Ultimate — Sanctuary of Eternity — A radiant golden sanctuary expands, suspends death, then resolves in a warm team heal. Filename: kindra_ultimate.wav

9. Cora / Plumeira
- Skill 1 — Twin Plumage — Two aerodynamic quill feathers launch, penetrate, and plant firmly into the ground. Filename: cora_skill1.wav
- Skill 2 — Feather Recall — Many planted feathers reverse through the air into Cora's hands, with a binding snap when several cross a target. Filename: cora_skill2.wav
- Ultimate — Skyward Plumes — An untargetable upward leap crests into five piercing quills raining down in a crescent fan. Filename: cora_ultimate.wav

10. Renn / Gildan
- Skill 1 — Gilded Vault — A rapid dash becomes a gilded aerial vault and a circular knock-up landing. Filename: renn_skill1.wav
- Skill 2 — Harmonic Waltz — A graceful dash to an ally wraps both characters in feathered golden shields. Filename: renn_skill2.wav
- Ultimate — Dazzling Rush — Hypnotic golden light ignites into a very fast rush that charms every enemy touched. Filename: renn_ultimate.wav

11. Sylla / Sylvan Solo
- Skill 1 — Summon Spirit Bear — An earthy spirit gateway opens and an armored bear lands with a living, weighty charge. Filename: sylla_skill1.wav
- Skill 2 — Savage Roar — Man and bear combine into an emerald sonic roar that drives nearby enemies away in fear. Filename: sylla_skill2.wav
- Ultimate — True Form — Bones, armor, and forest spirit energy expand into a gargantuan Ironclaw Bear transformation. Filename: sylla_ultimate.wav

12. Tequoia / Fernanda
- Skill 1 — Verdant Cage — Eight living oak trees erupt from soil in a fast enclosing ring and lock into place. Filename: tequoia_skill1.wav
- Skill 2 — Nature Link — Green living filaments connect several enemies, then resonate as shared pain travels through the network. Filename: tequoia_skill2.wav
- Ultimate — Nature's Wrath — A green solar-lightning sphere launches and bounces repeatedly, escalating in energy with each leap. Filename: tequoia_ultimate.wav

13. Zal / Glimmerick
- Skill 1 — Venom Hex — Thick violet venom sprays in a cone, hissing as poison clings and slows. Filename: zal_skill1.wav
- Skill 2 — Shadow Surge — Vibrant pink restorative lightning chains through allies and lashes adjacent enemies. Filename: zal_skill2.wav
- Ultimate — Soul Sanctuary — A luminous pink cross seals around a dying ally and declares an uncanny, unbreakable life ward. Filename: zal_ultimate.wav

14. Xin / Cindergent
- Skill 1 — Blazing Bolas — Flaming bolas spin outward, wrap two enemies, and burn while locking them in place. Filename: xin_skill1.wav
- Skill 2 — Flash Flurry — An almost instantaneous fiery dash cuts through every nearby enemy with critical slashes before snapping back. Filename: xin_skill2.wav
- Ultimate — Flame Remnant Charge — Blazing statues ignite in sequence as a rocket-fast charge pierces them with repeated fire shockwaves. Filename: xin_ultimate.wav

15. Raijin / Voltaire
- Skill 1 — Static Remnant — A crackling electrical duplicate forms, waits briefly, then suggests a proximity-triggered detonation. Filename: raijin_skill1.wav
- Skill 2 — Electric Vortex — A lightning tether catches an enemy and pulls them inward through a tightening electrical field. Filename: raijin_skill2.wav
- Ultimate — Ball Lightning — The caster collapses into a concentrated lightning sphere and rockets toward a chosen position. Filename: raijin_ultimate.wav

BATCH 2 — AVATARS 16–30 — 45 FILES

16. Kaolin / TerraByte
- Skill 1 — Boulder Smash — A powerful kick launches a giant jade boulder that rolls, fractures, and stuns everything struck. Filename: kaolin_skill1.wav
- Skill 2 — Rolling Boulder — Stone plates close around the caster into a rolling jade ball that crashes, knocks back, and shields. Filename: kaolin_skill2.wav
- Ultimate — Magnetize — Jade magnetic resonance infects nearby enemies and begins a series of dense pulsing shockwaves. Filename: kaolin_ultimate.wav

17. Inai / Nulliver
- Skill 1 — Aether Remnant — A purple void watcher appears, opens its gaze, and drags enemies toward its center. Filename: inai_skill1.wav
- Skill 2 — Dissimilate — The caster dissolves among seven void portals and crashes from the chosen portal in an astral explosion. Filename: inai_skill2.wav
- Ultimate — Astral Step — An instant void-line teleport slices through enemies, leaves rift marks, and ends with a heavy delayed rupture. Filename: inai_ultimate.wav

18. Veyara / Crownfetti
- Skill 1 — Prism Hurl — An elemental prism blade spins outward, wounds, and briefly crystallizes a root. Filename: veyara_skill1.wav
- Skill 2 — Facet Dash — A faceted elemental shift powers a fast dash and sharp target strike. Filename: veyara_skill2.wav
- Ultimate — Crownfall Surge — A regal prismatic crown tone collapses into a sweeping circular shockwave around clustered enemies. Filename: veyara_ultimate.wav

19. Cinderbloom / Sootcase
- Skill 1 — Cinder Sequence — Ash blades lunge, ignite on the second beat, and finish with a close critical strike. Filename: cinderbloom_skill1.wav
- Skill 2 — Ash Veil — A soft burst of ash swallows the caster into swift invisibility with a tense hidden ember tail. Filename: cinderbloom_skill2.wav
- Ultimate — Cinder Verdict — A great ashen exorcism gathers around the target and detonates with dark fire and expelled spirit energy. Filename: cinderbloom_ultimate.wav

20. Solenne / Sennova
- Skill 1 — Dusk Lance — A focused dusk-light beam hits a foe while releasing a warm healing shimmer to nearby allies. Filename: solenne_skill1.wav
- Skill 2 — Mistbind — Dark mist coils around the target and nearby enemies, tightening into a magical snare. Filename: solenne_skill2.wav
- Ultimate — Daybreak Veil — A very wide dawn beam harms enemies while laying a protective luminous veil across allies. Filename: solenne_ultimate.wav

21. Croakwell / Basso Croak
- Skill 1 — Ribbon Lash — A long wet tongue whips outward, catches a foe, and yanks them off balance. Filename: croakwell_skill1.wav
- Skill 2 — Bogbeat — Several small froglings stomp muddy ground in a disruptive rhythmic impact, without becoming music. Filename: croakwell_skill2.wav
- Ultimate — Marsh Anthem — A luminous amphibian call expands through the whole team as a rich healing and empowerment wave, with no intelligible vocals or melody. Filename: croakwell_ultimate.wav

22. Soulscourge / Razeberry
- Skill 1 — Gloom Raze — Dark fire tears a scorched line through the earth directly ahead. Filename: soulscourge_skill1.wav
- Skill 2 — Soul Draw — Loose nearby souls inhale toward the caster and compress into a dangerous power surge. Filename: soulscourge_skill2.wav
- Ultimate — Dirge Wave — Several concentric soul waves expand with spectral pressure and a final fear-inducing rupture. Filename: soulscourge_ultimate.wav

23. Stonewake / Quakewell
- Skill 1 — Faultline — Rock splits in a long advancing ridge that erupts into a hard stunning fracture. Filename: stonewake_skill1.wav
- Skill 2 — Runic Maul — Ancient runes charge a massive stone blow that lands with a close stun. Filename: stonewake_skill2.wav
- Ultimate — Quake Chorus — A monumental subterranean quake propagates through an entire enemy cluster in escalating fractures. Filename: stonewake_ultimate.wav

24. Mirehook / Rotisserie
- Skill 1 — Barbed Chain — A heavy hooked chain launches, catches the first target, and reels it closer. Filename: mirehook_skill1.wav
- Skill 2 — Rot Cloud — A pressurized release spreads a wet toxic rot cloud while the caster braces against retaliation. Filename: mirehook_skill2.wav
- Ultimate — Feast Lock — A brutal close pin clamps onto one target and begins draining life with grim physical weight. Filename: mirehook_ultimate.wav

25. Nullweaver / Midnight Equation
- Skill 1 — Gravitic Pin — A compact gravity orb launches and collapses around one target, locking it in place. Filename: nullweaver_skill1.wav
- Skill 2 — Dark Filament — Thin void filaments weave across the ground and activate into a damaging field. Filename: nullweaver_skill2.wav
- Ultimate — Singularity Well — Space folds into a compact black hole with a forceful activation and a sustained inward gravity tail suggesting a 3.2-second channel. Filename: nullweaver_ultimate.wav

26. Voltgrip / Plugsy
- Skill 1 — Arc Grapple — A narrow electric grapple snaps outward, attaches, and pulls an enemy closer. Filename: voltgrip_skill1.wav
- Skill 2 — Charged Fist — A fist rapidly charges with current and releases an uppercut that knocks the caught target upward. Filename: voltgrip_skill2.wav
- Ultimate — Thunder Dome — A close electrical dome erupts with branching arcs and one decisive radial stun. Filename: voltgrip_ultimate.wav

27. Aetherbolt / Relic Rick
- Skill 1 — Relic Bolt — An ancient arcane mechanism launches a fast energized bolt through the lane. Filename: aetherbolt_skill1.wav
- Skill 2 — Phase Skip — A short sideways phase blink ends in a precise magical mark on an enemy. Filename: aetherbolt_skill2.wav
- Ultimate — Horizon Lance — A broad relic-powered piercing beam charges briefly and rips across the full fight. Filename: aetherbolt_ultimate.wav

28. Corsara / Bounty Belle
- Skill 1 — Ricochet Round — A hard firearm report sends a round into one target before it splits into nearby ricochets. Filename: corsara_skill1.wav
- Skill 2 — Saltstorm — A compact overhead rain of shot strikes an area with salt-grit impacts and a slowing wash. Filename: corsara_skill2.wav
- Ultimate — Broadside Waltz — A ship-scale broadside opens into six distinct cannon-fire waves, implying a three-second fixed cone channel without musical rhythm. Filename: corsara_ultimate.wav

29. Brewmaw / Kegory
- Skill 1 — Bursting Cask — A sloshing pressurized cask arcs in and bursts among clustered foes. Filename: brewmaw_skill1.wav
- Skill 2 — Barrel Rush — A heavy rolling lunge collides with a target and knocks it aside. Filename: brewmaw_skill2.wav
- Ultimate — Grand Vintage — An enormous aged cask spins in, bursts with tremendous liquid and timber force, and scatters a formation. Filename: brewmaw_ultimate.wav

30. Wraithhook / Hooklyn
- Skill 1 — Spectral Harpoon — A ghost-metal harpoon launches on a chain, catches a foe, and pulls it through spectral tension. Filename: wraithhook_skill1.wav
- Skill 2 — Guiding Lantern — A haunted lantern flares to shield allies while a spirit pulse pushes an enemy away. Filename: wraithhook_skill2.wav
- Ultimate — Lantern Prison — A large ring of spectral lantern walls rises and closes into a slowing spirit cage. Filename: wraithhook_ultimate.wav

BATCH 3 — AVATARS 31–45 — 45 FILES

31. Kaelen / Arsenaldo
- Skill 1 — Orb of Ice — A compact ice orb condenses, crystallizes, and clicks into a three-orb magical queue, suggesting regeneration. Filename: kaelen_skill1.wav
- Skill 2 — Orb of Wind — A circulating wind orb gathers and slots into the three-orb queue, suggesting increased movement. Filename: kaelen_skill2.wav
- Ultimate — Orb of Fire — A dense fire orb ignites and locks into the three-orb queue with a powerful spell-amplifying resonance. Filename: kaelen_ultimate.wav

32. Hweilin / Inkognito
- Skill 1 — Molten Splatter — An arc of hot viscous paint flies outward and erupts on impact. Filename: hweilin_skill1.wav
- Skill 2 — Gleaming Wash — A luminous painted river brushes across the ground, accelerating and shielding allies who enter it. Filename: hweilin_skill2.wav
- Ultimate — Vortex of Torment — A tragic bloom of wet magical paint spreads, grips its victims, and detonates in a vast chromatic rupture. Filename: hweilin_ultimate.wav

33. Jaxon / Hexley
- Skill 1 — Shock Blast Plasma — A plasma orb passes through an acceleration field, sharply increases velocity, and impacts with charged metal energy. Filename: jaxon_skill1.wav
- Skill 2 — Thundering Leap — A hammer charges during a powerful leap and smashes the ground in an electrical shockwave. Filename: jaxon_skill2.wav
- Ultimate — Mercury Overdrive — Complex machinery transforms into cannon mode, spins up, and releases a defense-shredding rapid-fire burst. Filename: jaxon_ultimate.wav

34. Valerie / Knuckleberry
- Skill 1 — Vault Breaker Punch — A powered gauntlet charges during a forward rush and lands an armor-shattering punch. Filename: valerie_skill1.wav
- Skill 2 — Denting Impact — Successive metal-heavy blows crack armor and accelerate into a faster attack cadence. Filename: valerie_skill2.wav
- Ultimate — Cease and Desist Slam — A target lock engages, the caster charges unstoppably through obstacles, and the victim is driven violently into the ground. Filename: valerie_ultimate.wav

35. Jinxy / Boomie
- Skill 1 — Fishbones Rockets — A weapon switches mechanisms and launches a long-range rocket with a compact area explosion. Filename: jinxy_skill1.wav
- Skill 2 — Shock Pistols Zap — A sharp electric beam fires from a pistol, strikes the first enemy, and leaves a heavy slowing charge. Filename: jinxy_skill2.wav
- Ultimate — Super Mega Rocket — A colossal missile launches with extreme propulsion, races globally, and ends in a huge execute-weight explosion. Filename: jinxy_ultimate.wav

36. Paxi / Fizzlewing
- Skill 1 — Illusory Orb Jaunt — A playful astral orb launches toward a point, travels, and leaves a clear magical anchor for a later jaunt. Filename: paxi_skill1.wav
- Skill 2 — Waning Rift Silence — Fairy dust bursts in a circle and collapses nearby magic into sudden muffled silence. Filename: paxi_skill2.wav
- Ultimate — Dream Coil Tether — An astral spring anchors several luminous tethers that strain, snap, stun, and tear when enemies break away. Filename: paxi_ultimate.wav

37. Batrix / Wickety
- Skill 1 — Firefly Scorched Path — Rapid aerial ignition lifts the caster over terrain and paints a continuous burning trail behind. Filename: batrix_skill1.wav
- Skill 2 — Flamebreak Grenade — A glassy incendiary cocktail arcs, explodes, and forcefully knocks enemies away. Filename: batrix_skill2.wav
- Ultimate — Flaming Lasso Drag — A blazing rope whips around an enemy, locks tight, and begins dragging the captive through fire. Filename: batrix_ultimate.wav

38. Quillback / Hedgehoggin
- Skill 1 — Viscous Nasal Slime — Thick sticky goo launches and splats onto an enemy, clinging while it slows and corrodes armor. Filename: quillback_skill1.wav
- Skill 2 — Quill Spray Nova — A full circular volley of poisonous quills snaps outward and lands in rapid stacking impacts. Filename: quillback_skill2.wav
- Ultimate — Warpath Stampede — A feral body surge builds speed and attack power, signaling a relentless escalating stampede. Filename: quillback_ultimate.wav

39. Aetheris / Orbiton
- Skill 1 — Spirits Orbit Array — Five bright spirits appear and settle into orbit, with one spirit peeling off into a splash burst. Filename: aetheris_skill1.wav
- Skill 2 — Overcharge Surge — A bright energetic tether connects to the nearest ally and swells into a shield plus attack-power surge. Filename: aetheris_skill2.wav
- Ultimate — Resonant Convergence — Many allied tethers ignite at once and harmonically converge into a team-wide heal and shield, with no musical melody. Filename: aetheris_ultimate.wav

40. Faelith / Pixabelle
- Skill 1 — Glimmerthorn — A sparkling thorn whistles through the air, pierces a target, and releases slowing fae dust. Filename: faelith_skill1.wav
- Skill 2 — Mothspell — A threatening enemy transforms into a harmless moth while a nearby ally receives a soft fae shield. Filename: faelith_skill2.wav
- Ultimate — Wildheart Bloom — The lowest-health ally rapidly grows inside a powerful wild shield as surrounding roots and magic knock enemies upward. Filename: faelith_ultimate.wav

41. Oathmute / Muffleton
- Skill 1 — Inkblight — A dense magical ink bolt strikes and splashes blight across nearby enemies. Filename: oathmute_skill1.wav
- Skill 2 — Last Edict — A precise written seal closes around one enemy and abruptly suppresses its magic. Filename: oathmute_skill2.wav
- Ultimate — Stillness Decree — A vast authoritative seal flashes across every enemy and cuts all hostile spell sound into an imposing brief stillness. Filename: oathmute_ultimate.wav

42. Cloudtail / Stafford
- Skill 1 — Longstaff Crack — A wooden staff telescopes outward, strikes hard, and cracks armor. Filename: cloudtail_skill1.wav
- Skill 2 — Mist Double — A visible decoy exhales from mist as the real caster slips sideways under a brief veil. Filename: cloudtail_skill2.wav
- Ultimate — Cyclone Dance — A staff-led cyclone spins for two seconds with repeated impacts, rising wind, and brief knock-up accents. Filename: cloudtail_ultimate.wav

43. Stonebranch / Primate Minister
- Skill 1 — Skyroot Strike — A rooted staff extends through a short line and lands a woody stone stun across every enemy crossed. Filename: stonebranch_skill1.wav
- Skill 2 — Canopy Bound — The caster vaults through branches toward an enemy and lands in a broad leafy impact. Filename: stonebranch_skill2.wav
- Ultimate — Court of Branches — A stationary circle of staff-wielding forest echoes rises, readies, and begins striking intruders. Filename: stonebranch_ultimate.wav

44. Stepstone / Kickswitch
- Skill 1 — Quarry Rush — A grounded martial rush closes distance and ends in a dense driving palm strike. Filename: stepstone_skill1.wav
- Skill 2 — Crosswind Guard — A turning guard redirects force and counters enemies crowding nearby allies. Filename: stepstone_skill2.wav
- Ultimate — Bellbreak Kick — A focused spinning kick rings with bell-like force, launches one enemy toward allies, and briefly lifts them. Filename: stepstone_ultimate.wav

45. Skybreaker / Propella
- Skill 1 — Flakburst Cannon — An open-cockpit rotor skiff's oversized rotary flak cannon fires one high-velocity shell that airbursts into hard metallic shrapnel across a wide formation. Filename: skybreaker_skill1.wav
- Skill 2 — Rotor Overdrive — Twin exposed lift fans race beyond redline, their mechanical pitch climbs sharply, and triple-barrel crossfire rakes the target. Filename: skybreaker_skill2.wav
- Ultimate — Air Superiority — The compact flak skiff enters full gunship mode with a deep twin-fan surge, sustained flak battery ignition, and a broad layered bombardment across the enemy formation. Filename: skybreaker_ultimate.wav

FINAL VALIDATION
- Batch 1 must contain 45 WAV files, Batch 2 must contain 45, and Batch 3 must contain 45.
- The completed library must contain exactly 135 unique WAV files and exactly 135 manifest rows.
- Report any generation failure by exact filename so it can be regenerated. Do not silently omit or replace an ability.
```

When returning generated audio for integration, keep the ZIP files and manifests intact. This makes it possible to validate the set automatically and map each cue to the correct avatar and ability slot.
