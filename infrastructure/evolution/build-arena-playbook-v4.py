"""Build the versioned human/numeric curriculum from this game's actual catalog.

Run explicitly from the repository root. Historical teaching briefs stay intact.
This authors examples, not live strategic restrictions or a video importer.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'EsportsClash.Web/src/data'
catalog = json.loads((ROOT / 'EsportsClash.Api/resources/game/catalog.json').read_text())
brief = json.loads((DATA / 'arenaPlaybookV3.json').read_text())
# A job, a concrete lesson, and a tradeoff for EVERY avatar, keyed by stable internal name.
SPECIALIZATIONS = {
 'Solana': ('engage-and-peel', 'Use Zenith Lance to reach a fight your allies can follow; Solar Shieldbash can stop a diver instead. Compare a clustered Daybreak Flare with saving it for a threatening channel.', 'Dashing first is not success if the team cannot follow or an ally dies behind you.'),
 'Astra': ('ranged-control', 'Use Volley Cone to slow approaches, Frost Flurry during a sustained firing window, and Crystal Comet to begin a reachable catch or stop a diver.', 'A long-range stun is useful only if it creates damage, safety or objective progress.'),
 'Kyumi': ('catch-and-burst', 'Threaten Charm of Longing from a useful angle, follow a confirmed catch with Orb of Illusion, and compare Spirit Rush pressure with disengaging.', 'Do not assume the original League champion\'s dash charges exist in this kit.'),
 'Buck': ('close-ranged-disruption', 'Use Powder Keg Blast against reachable clusters, Smoke Screen to reduce enemy attack reach, and Collateral Blast when recoil improves spacing.', 'Shorter reach can make walking into an enemy marksman more expensive than clearing a wave.'),
 'Valkira': ('sustain-and-execute', 'Learn Crescent Cleave spacing, use Iron Will Slam when the shield can absorb retaliation, and compare Executioner\'s Descent with finishing by a basic attack.', 'An execution attempt should be judged by actual damage and the resulting fight, not the ultimate animation.'),
 'Kage': ('priority-burst', 'Look for an accessible damage dealer, combine Shadow Shuriken with Shadow Projection, and evaluate the delayed Eclipse Mark outcome before extending the chase.', 'A marked target may survive or become protected; committing does not guarantee a kill.'),
 'Kazemaru': ('projectile-denial', 'Use Tempest Thrust to create airborne opportunities, Zephyr Barrier against visible incoming missiles, and Airborne Sever when its actual target rules permit.', 'A wind wall has little value when there are no relevant projectiles; melee exposure still matters.'),
 'Kindra': ('sanctuary-carry', 'Use Ghoststep Volley and Shadow Pounce while keeping a firing position. Place Sanctuary of Eternity around a fight where the protected survival window and allied expiry heal can matter.', 'The sanctuary can preserve enemies too; count that trade instead of treating every low-health cast as good.'),
 'Cora': ('feather-setup', 'Compare planting Twin Plumage with recalling existing feathers through enemies. Use Skyward Plumes to avoid a real threat or create a useful feather pattern.', 'A Feather Recall without intersecting feathers is not a successful root.'),
 'Renn': ('mobile-protector', 'Compare a Gilded Vault engage with Harmonic Waltz to a pressured ally. Dazzling Rush can disrupt several threats while staying within allied follow-up distance.', 'Moving to an ally is useful when the shield and position help; repeating dashes alone earns no credit.'),
 'Sylla': ('summon-and-transform', 'Use the real Spirit Bear implementation for pressure, Savage Roar to interrupt nearby threats, and True Form when melee durability is worth giving up ranged spacing.', 'Do not assume independent pet micro is available through the current command interface.'),
 'Tequoia': ('linked-zone-control', 'Use Verdant Cage to restrict a reachable threat, Nature Link on a group the team can actually damage, and Nature\'s Wrath when bounces can connect.', 'The existence of linked targets does not prove meaningful follow-up occurred.'),
 'Zal': ('lifesaving-support', 'Position for Shadow Surge healing and use Soul Sanctuary on a threatened ally before lethal damage. Venom Hex can slow pursuit while your team recovers.', 'A sanctuary on a healthy unpressured ally wastes the survival window; raw cast count is not a rescue count.'),
 'Xin': ('rooted-skirmish', 'Use Blazing Bolas to restrict movement, follow reachable clusters with Flash Flurry, and compare Flame Remnant Charge pressure with preserving resources.', 'Use this game\'s implemented remnant behavior, not assumed external-game escape commands.'),
 'Raijin': ('mana-and-mobility', 'Place Static Remnant where an enemy can trigger it, use Electric Vortex inside its short range, and spend Ball Lightning mana for a worthwhile approach or escape. Weave attacks to use Overload.', 'A remnant does not hit on placement. Terrain can interrupt lightning travel and mana limits repeated jumps.'),
 'Kaolin': ('mobile-frontline', 'Use Boulder Smash to stun a useful line, Rolling Boulder for an approach with a shield, and Magnetize when remaining near opponents can produce useful pulses.', 'Rolling into an isolated position is different from creating space for allies.'),
 'Inai': ('portal-skirmish', 'Use Aether Remnant to disrupt an approach, Dissimilate to change a dangerous position, and Astral Step to pressure an accessible target.', 'Evaluate the position after the movement effect rather than rewarding entry into the fight.'),
 'Veyara': ('cluster-burst', 'Use Prism Hurl control to set up Facet Dash and compare Crownfall Surge against grouped opponents with a safer single-target trade.', 'Do not invent terrain-element selection commands that this controller does not expose.'),
 'Cinderbloom': ('staged-assassin', 'Learn the actual Cinder Sequence stages and timing. Ash Veil can create an approach or recovery window; Cinder Verdict should follow a worthwhile accessible target.', 'Stealth is not invulnerability, and a started sequence can become a losing chase.'),
 'Solenne': ('ranged-protection', 'Align Dusk Lance pressure with nearby allied healing needs, use Mistbind against pursuers, and compare Daybreak Veil damage with its allied shielding opportunity.', 'Long range does not justify leaving every ally beyond protective reach.'),
 'Croakwell': ('disruptive-healer', 'Use Ribbon Lash to disrupt a reachable foe, Bogbeat to interfere with nearby threats, and Marsh Anthem while living teammates can benefit.', 'A sturdy support body is not permission to absorb unlimited damage; an anthem without missing health may waste value.'),
 'Soulscourge': ('close-burst-mage', 'Use Gloom Raze from useful range, Soul Draw during a real exchange, and Dirge Wave when nearby opponents justify the exposure.', 'A large close-range ultimate can be worse than sustained ranged pressure when enemies can interrupt or burst you.'),
 'Stonewake': ('cluster-counterengage', 'Use Faultline to catch a line or protect allies, Runic Maul against a reachable threat, and Quake Chorus when enemies are clustered near its real area.', 'Unlike a hook tank, this kit gains from nearby clusters; waiting forever for five targets can also lose a fight.'),
 'Mirehook': ('single-target-catcher', 'Look for a clear Barbed Chain path that pulls a valuable enemy into allied reach. Use Rot Cloud in useful close combat and Feast Lock to pin a priority threat.', 'The hook can meet another unit first; do not reward casts or pulling a dangerous enemy onto your carry.'),
 'Nullweaver': ('channel-zone-control', 'Use Gravitic Pin to set up Dark Filament or allied attacks. Compare a clustered Singularity Well with a position where opponents can interrupt its channel.', 'A black-hole cast is not success; channel duration, actual follow-up and the later fight matter.'),
 'Voltgrip': ('catch-support', 'Use Arc Grapple with an unobstructed opportunity, Charged Fist against a caught threat, and Thunder Dome when close disruption helps allies.', 'Threatening a hook can preserve space; repeatedly missing hooks is not mastery.'),
 'Aetherbolt': ('mobile-poke', 'Use Relic Bolt through a useful firing line, compare Phase Skip repositioning with keeping an escape, and align Horizon Lance with reachable pressure.', 'A blink into danger is not automatically justified by a small amount of poke damage.'),
 'Corsara': ('protected-barrage', 'Use Ricochet Round and Saltstorm for pressure, then find a Broadside Waltz direction that covers opponents while allies or terrain limit interruption.', 'The cone is fixed during its channel; enemies can move out or interrupt it.'),
 'Brewmaw': ('formation-disruptor', 'Use Bursting Cask for clustered pressure, Barrel Rush when its impact control and healing matter, and Grand Vintage to break a threatening formation.', 'Scattering enemies can spoil allied area damage; disruption is not always a helpful engage.'),
 'Wraithhook': ('catch-and-rescue', 'Compare Spectral Harpoon picks with Guiding Lantern protection and displacement. Lantern Prison can slow threats near your damage dealers.', 'Playing beside a threatened ally can be more useful than behaving like a pure engage tank.'),
 'Kaelen': ('adaptive-spellbook', 'Choose Ice, Wind and Fire orbs, invoke a real three-orb recipe, and use either retained spell for the current job: control, protection, damage or pressure.', 'Orb selection and invocation cost time and mana; repeated preparation without useful casts is not success.'),
 'Hweilin': ('mixed-zone-mage', 'Use Molten Splatter for pressure, Gleaming Wash when allies can use its protection, and Vortex of Torment where spreading area control can connect.', 'A visual paint combo does not establish actual protection or damage.'),
 'Jaxon': ('poke-to-brawl', 'Compare Shock Blast Plasma pressure with a Thundering Leap commitment; use Mercury Overdrive when the resulting attack window can be maintained.', 'Do not assume an unexposed stance-switch key or that ranged and melee positions are interchangeable.'),
 'Valerie': ('priority-lockdown', 'Use Vault Breaker Punch to reach a useful threat, Denting Impact during sustained contact, and Cease and Desist Slam when allies can exploit the lockdown.', 'Reaching the backline alone may lose more than the selected target is worth.'),
 'Jinxy': ('scaling-artillery', 'Use Fishbones Rockets for reachable clustered pressure, Shock Pistols Zap to slow an approach, and Super Mega Rocket when missing health and the firing line make a finish plausible.', 'A speculative long-range execute should be compared with reliable damage and objective attacks.'),
 'Paxi': ('orb-and-disengage', 'Use the actual Illusory Orb and jaunt state, Waning Rift to interrupt nearby threats, and Dream Coil where constrained movement creates follow-up.', 'A jaunt can land in danger; do not assume the original hero\'s immunity or extra commands.'),
 'Batrix': ('displacement-picker', 'Use Firefly for useful pressure, Flamebreak to disrupt a formation, and Flaming Lasso to bring a valuable enemy toward allied follow-up.', 'The destination of a displacement matters as much as landing it.'),
 'Quillback': ('sustained-frontline', 'Use Viscous Nasal Slime to keep a reachable threat in range, Quill Spray for close sustained pressure, and Warpath when repeated contact can help a siege or fight.', 'This tank is a sustained brawler, not a substitute for Quakewell\'s area stun. Taking damage alone earns no reward.'),
 'Aetheris': ('tether-protector', 'Launch Spirits through useful attacks, use Overcharge on an ally who can exploit the shield and damage, and gather living allies within Resonant Convergence reach.', 'A tether to a safe full-health ally may be less useful than moving to a threatened teammate.'),
 'Faelith': ('anti-diver-enchanter', 'Use Glimmerthorn to slow approaches, Mothspell to neutralize a threatening caster, and Wildheart Bloom around a pressured ally.', 'A defensive cast should be judged by the resulting survival and team progress, not the number of shields created.'),
 'Oathmute': ('channel-interrupter', 'Use Inkblight for pressure, Last Edict against a threatening spell user, and Stillness Decree when enemy casting or a channel makes silence valuable.', 'Silencing an enemy who is not attempting useful spells can waste the stronger interruption window.'),
 'Cloudtail': ('decoy-counterengage', 'Use Longstaff Crack against reachable threats, Mist Double to alter a dangerous position, and Cyclone Dance when repeated close hits and disruption can connect.', 'Spinning outside enemy reach or chasing beyond allies does not establish useful disruption.'),
 'Stonebranch': ('territory-fighter', 'Use Skyroot Strike to stun a useful line, Canopy Bound to enter a position allies can exploit, and Court of Branches where opponents will contest the stationary area.', 'The court does not chase enemies; assess actual occupancy and follow-up.'),
 'Stepstone': ('ally-oriented-displacement', 'Compare Quarry Rush pressure with Crosswind Guard beside pressured allies. Bellbreak Kick can send a priority enemy toward a team that is ready to punish it.', 'Delivering a healthy diver to a wounded teammate can make a technically successful kick harmful.'),
 'Skybreaker': ('sustained-area-carry', 'Use Flakburst against useful clusters, Rotor Overdrive for a real attack window, and Air Superiority when gunship reach and allied protection allow repeated fire.', 'An attack-speed steroid while walking or retreating produces less value than one used during safe firing time.'),
}

ROLES = {
 'Tank': ['Create useful space, interrupt threats and make allied damage possible. Compare engaging with protecting an ally.', 'Durability is a resource. Taking damage, standing in front or dying first is not success by itself.', 'A catcher, an area initiator, a mobile disruptor and a sustained brawler require different spacing and timing.'],
 'Fighter': ['Compare short trades, sustained contact and protecting a nearby ally using your actual shield, movement and control tools.', 'Enter with a practical follow-up or exit plan; after a useful exchange consider the wave and next structure.', 'Your kit may favor ranged poke, summons, displacement or territory rather than permanent melee pursuit.'],
 'Assassin': ['Look for an accessible valuable threat and account for protection, control, travel time and the position after a combo.', 'Compare spending burst now with waiting for a better opening; abandoning a failed chase can be correct.', 'A takedown helps when it improves the team\'s chance to finish the game. Kill stealing is not a separate objective.'],
 'Mage': ['Use actual cast ranges, areas, costs and control to deliver pressure while keeping a useful firing position.', 'Compare wave clear, poke, interruption, allied protection and burst; mana and cooldown availability change the trade.', 'Channel mages, close burst mages, mobile mages and spellbook mages need different preparation.'],
 'Marksman': ['Maintain useful attack uptime, use reach and movement between attacks, and choose a reachable target.', 'Trade farm and sustained pressure against helping a fight. After an advantage, use your attacks on the next legal structure.', 'An immobile barrage carry needs different protection and timing from a mobile poke carry or sanctuary carry.'],
 'Support': ['Protect and enable living allies, interrupt meaningful threats and help turn a won fight into progress.', 'Compare shields, healing, control and information with spending resources on damage; missing health and incoming pressure matter.', 'A catch support, mobile engager, lifeguard and ranged enchanter are different jobs. Supports may still farm or finish enemies when useful.'],
}

brief.update(version=4, title='Clash Arena: team play, card identity and individual avatar mastery')
brief['roles'] = [{'id': role, 'directions': directions} for role, directions in ROLES.items()]
brief['player_identity'] = [
 'The player card is the competitor; the avatar is the kit they control. Learn the combination rather than confusing their identities.',
 'Observe the card\'s stable ID, fictional display alias, six attributes, preferred-role fit, signatures, morale, fatigue and both personalities. These inform decisions; they do not grant extra damage, range or immunity.',
 'IQ describes game sense, LAN mechanics, TF teamfight execution, CLU pressure play, STA resilience and FLX adaptability. High attributes do not guarantee a correct decision.',
 'A bodyguard personality can learn protective opportunities and an aggressive personality can learn timing. Neither is a mandatory script or permission to ignore a losing outcome.',
 'The shared policy learns across card/avatar combinations. Do not claim a particular card mastered an avatar unless that pairing has enough independent evaluated evidence.',
]
brief['rewards'] = {
 'version': 'terminal-potential-mastery-v2', 'scale': .08,
 'directions': [
  'The actual Nexus win/loss remains the terminal objective. Internal learning rewards update model weights; they do not mint club coins, prizes or card XP.',
  'A small bounded avatar-specific potential uses effective enemy champion health damage, allied damage following confirmed control, actual objective damage and living teammate health. Each specialization weights these differently.',
  'Training credits confirmed stun/root/knockup follow-up only while the recorded effect remains active and only for allied health damage, excluding the controller\'s own hit. This is a limited attribution measure, not proof the control caused victory.',
  'A cast, missed hook, unused shield, raw damage taken, walking distance or repeated animation has no separate success bonus. Healing/shielding is represented by team survival; exact per-spell rescue attribution is not yet measured.',
  'Reward shaping is a discounted potential difference, with zero potential at real termination. Loops cannot create undiscounted progress bonuses. Censored matches bootstrap; they never receive a fabricated win.',
  'Learning rewards and instruction imitation loss are training signals. Independent matched complete games determine whether a checkpoint improved competitive results.',
 ]}
brief['avatars'] = []
for a in catalog['avatars']:
    job, lesson, caution = SPECIALIZATIONS[a['name']]
    # Every specialization has a different starting preference vector. The live
    # actor learns from fitted examples, not a runtime call to these preferences.
    weights = {'damage': .35, 'control': .25, 'objectives': .25, 'allies': .15}
    if a['primaryRole'] == 'Tank': weights = {'damage': .15, 'control': .4, 'objectives': .2, 'allies': .25}
    if a['primaryRole'] == 'Support': weights = {'damage': .1, 'control': .3, 'objectives': .15, 'allies': .45}
    if a['name'] == 'Quillback': weights = {'damage': .4, 'control': .05, 'objectives': .35, 'allies': .2}
    if a['name'] == 'Brewmaw': weights = {'damage': .25, 'control': .3, 'objectives': .2, 'allies': .25}
    if a['name'] == 'Mirehook': weights = {'damage': .25, 'control': .45, 'objectives': .1, 'allies': .2}
    if a['name'] == 'Kaolin': weights = {'damage': .3, 'control': .3, 'objectives': .2, 'allies': .2}
    if a['name'] == 'Stonewake': weights = {'damage': .1, 'control': .5, 'objectives': .15, 'allies': .25}
    slots = []
    for slot in ['skill1', 'skill2', 'ultimate']:
        ability = a[slot]
        text = ability['desc'].lower()
        tags = {name: any(token in text for token in words) for name, words in {
            'control': ['stun', 'root', 'knock', 'pull', 'charm', 'silenc', 'fear', 'interrupt', 'snare', 'pin ', 'slow'],
            'protect': ['shield', 'heal', 'cannot die', 'cannot fall', 'sanctuary', 'guard', 'untargetable'],
            'mobility': ['dash', 'blink', 'teleport', 'leap', 'jaunt', 'movement', 'recoil', 'propelling'],
            'channel': ['channel', 'spin for'],
        }.items()}
        slots.append({'slot': slot, 'name': ability['name'], 'description': ability['desc'], 'tags': tags})
    brief['avatars'].append({'id': a['id'], 'name': a['displayName'], 'internal_name': a['name'],
        'role': a['primaryRole'], 'secondary_role': a.get('secondaryRole'), 'archetype': a['archetype'],
        'job': job, 'directions': [lesson, 'Reassess after an ally dies, a target becomes protected, a cooldown changes or a structure opens.'],
        'tradeoff': caution, 'abilities': slots, 'mastery_weights': weights,
        'example_preferences': [round((a[s]['damage']/500)*.35 + (i+1)*.04 + (.15 if slots[i]['tags']['control'] else 0), 4)
                                for i,s in enumerate(['skill1','skill2','ultimate'])]})
assert len(brief['avatars']) == len(SPECIALIZATIONS) == 45
destination = DATA / 'arenaPlaybookV4.json'
destination.write_text(json.dumps(brief, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
lines = ['# '+brief['title'], '', brief['scope'], '', '## Actual game rules', '']
lines += ['- '+s for s in brief['mechanics']]
lines += ['', '## Player card and avatar identity', ''] + ['- '+s for s in brief['player_identity']]
for l in brief['lessons']:
    lines += ['', '## '+l['title'], ''] + ['- '+s for s in l['directions']]
for role in brief['roles']:
    lines += ['', '## '+role['id'], ''] + ['- '+s for s in role['directions']]
for a in brief['avatars']:
    lines += ['', '## '+a['name']+' — '+a['role']+' / '+a['job'], '', '*Stable avatar ID: '+a['id']+'*', '']
    lines += a['directions'] + ['', 'Tradeoff: '+a['tradeoff'], '']
    lines += ['- **'+s['name']+'**: '+s['description'] for s in a['abilities']]
lines += ['', '## Learning rewards and evidence', ''] + ['- '+s for s in brief['rewards']['directions']]
lines += ['', 'These are authored lessons from this game\'s catalog. No League video has been ingested or used as evidence.', '']
(ROOT / 'docs/arena-learning-play-guide.md').write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps({'playbook_version':4, 'roles':len(ROLES), 'avatars':len(brief['avatars'])}))
