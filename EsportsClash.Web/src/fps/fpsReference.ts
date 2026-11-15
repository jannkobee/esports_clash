import {FPS_IDENTITY_PERSONALITIES,FPS_T_POSITIONS,FPS_CT_POSITIONS,FPS_POSITION_LABELS,FPS_BASE_BEHAVIORAL_PROFILES,fpsBaseProfileId,personalityLabel} from './fpsIdentity.ts';
import {FPS_ATTRIBUTE_LABELS} from './fpsPersonality.ts';
import {FPS_WEAPONS} from './fpsWeapons.ts';
import {FPS_MAPS} from './fpsMaps.ts';
import {STARTING_CASH,MAX_CASH,ROUND_WIN_REWARD,OVERTIME_STARTING_CASH,LOSS_BONUS_LADDER} from './fpsEconomy.ts';
import {listLiveMaps} from './fpsLiveMapRegistry.ts';
import {LIVE_KNIFE,LIVE_WEAPONS,canBuyLiveWeapon,liveDrawTime,type LiveWeapon} from './fpsLiveWeapons.ts';
import {LIVE_HE_RULES,LIVE_UTILITY_FUSES,LIVE_UTILITY_RULES} from './fpsLiveGrenades.ts';
import {LIVE_C4_RULES} from './fpsLiveBomb.ts';
import {LIVE_PLANT_RULES} from './fpsLivePlanning.ts';

export const FPS_REFERENCE_SECTIONS = {
  fps:'Tactical FPS', roles:'Player roles', personalities:'Personalities', identityPersonalities:'Personality engine',
  weapons:'Weapons', equipment:'Gear & utility', maps:'Competitive maps', attributes:'Player skills',
  liveSimulation:'Live 3D & AI', rules:'Match rules',
} as const;
export type FpsReferenceSection=keyof typeof FPS_REFERENCE_SECTIONS;
export const isFpsReferenceSection=(value?:string|null):value is FpsReferenceSection=>!!value&&Object.hasOwn(FPS_REFERENCE_SECTIONS,value);
export const fpsReferenceHref=(section:FpsReferenceSection,id?:string)=>`#hexapedia/${section}${id?'/'+encodeURIComponent(id):''}`;
export interface FpsReferenceEntry {id:string;name:string;category:string;summary:string;body:string[];facts:[string,string][]}

const itemDescriptions:Record<string,string>={
  sidearm_standard:'Free starting sidearm. A low-cost fallback when the team is saving.',
  sidearm_heavy:'An expensive sidearm with higher damage and strong armor penetration.',
  smg_tactical:'A close-range primary with a larger elimination reward and weaker long-range damage.',
  rifle_assault:'A versatile primary for rifle rounds, entries and trades.',
  rifle_sniper:'A costly precision primary with a slower firing cadence and strong single-hit damage.',
  gear_kevlar:'Restores armor to 100. Armor mitigates eligible hits and wears down as damage is taken.',
  gear_helmet:'Protects against the extra vulnerability of an unhelmeted headshot. It does not make headshots harmless.',
  gear_defuse_kit:'Defender-only gear that reduces an uninterrupted defuse from 10 seconds to 5.',
  utility_smoke:'Blocks cross-zone sightlines involving its target zone for 15 seconds. Same-zone contact remains possible.',
  utility_flash:'Reduces the accuracy of affected opponents for 2 seconds.',
  utility_he:'Deals damage to opponents sharing the targeted zone.',
  utility_molotov:'Creates a damaging area in the target zone for 7 seconds.',
};
const skillDescriptions:Record<string,string>={
  rifling:'Rifle, pistol and SMG gunfight execution.',
  entry:'Breaking chokes, first-contact execution and creating space.',
  positioning:'Map awareness, rotations, angles and survival execution.',
  shotcalling:'Execution quality of planning, economy calls and counter-strategies; the IGL assignment is chosen separately.',
  sniping:'Sniper rifle execution, including AWP and Scout engagements.',
  utility:'Grenade deployment accuracy and timing within fixed physical rules.',
};

const liveWeaponNotes:Partial<Record<LiveWeapon,string>>={
  usp_s:'CT suppressed starting sidearm with crisp first-shot accuracy and low spread.',
  glock:'T starting 20-round sidearm suited for fast pistol-round pressure and mobile rushes.',
  p250:'Budget armor-piercing upgrade pistol favored on eco/force rounds.',
  fiveseven:'CT 20-round semi-auto pistol with strong armor penetration against full buys.',
  tec9:'T high-mobility 18-round offensive pistol built for close-to-mid entry pushes.',
  cz75:'Fully automatic close-quarters emergency sidearm with tight reserve ammo and slower draw.',
  deagle:'High-caliber .50 hand cannon capable of surgical long-range headshots; AI paces shots past 12m.',
  m4a1_s:'Suppressed CT precision rifle with disciplined recoil and steady spray control.',
  ak47:'High-impact T primary rifle capable of one-tap headshots at range; AI uses 2-round bursts past 20m.',
  budget_ct:'Lower-cost CT force-buy rifle offering rifle range when full buys are unaffordable.',
  budget_t:'Cost-efficient T force-buy rifle bridges eco gaps without dropping to pistol-only armor.',
  mp9:'High-cadence CT close-range SMG with strong kill reward for anti-eco holds.',
  mac10:'Fast-moving T entry SMG with generous kill bonus and aggressive spray pressure.',
  mag7:'CT heavy pump shotgun built for tight indoor chokes and close crossfire angles.',
  nova:'Budget T scattergun rewarding tight corner traps with elevated elimination payouts.',
  sniper:'Bolt-action AWP precision rifle; enforces anti-wall/smoke clearance checks and shoot-and-scoot cycling.',
  scout:'Lightweight high-mobility precision sniper for aggressive picks and jumpshot tags.',
  negev:'High-capacity suppressive machine gun anchoring tight chokepoints under heavy push volume.',
};

const liveCategoryLabel:Record<string,string>={
  pistol:'Live 3D · Pistol',
  smg:'Live 3D · SMG',
  rifle:'Live 3D · Rifle',
  sniper:'Live 3D · Sniper',
  shotgun:'Live 3D · Shotgun',
  heavy:'Live 3D · Heavy',
};

const liveMapDescriptions:Record<string,{summary:string;details:string[]}>={
  fontessa:{
    summary:'Sunlit Mediterranean canal town with tight stone alleys, terracotta loggia A site, central Window connector, and open Banana approach into Fountain B site.',
    details:[
      'Balanced three-lane topology featuring continuous Mid control, Market/Produce passages, B Fountain cover, and car/loggia box angles.',
      'Supports direct vault drops (`mid-window-drop`, `b-apartments-west-drop`, `market-terrace-drop`, `bridge-canal-drop`) and multi-angle post-plant setups.',
    ],
  },
  spillway:{
    summary:'Asymmetric 3-level European municipal flood-control district combining an elevated riverside park (A) above an underground pumping station & drainage canal (B).',
    details:[
      'Built across three navigable vertical tiers: Level 0 Lower Drainage/Canal/Main Tunnel/B Pumping Station, Level 1 T Plaza/Service Connector, and Level 2 Riverside Park/Gardens/A HQ/Control Deck Heaven.',
      'Control Deck (Level 2 overpass) overlooks Bombsite B and Short with open safety rails, enforcing asymmetric 2-1-2 defender rotations and territory control.',
    ],
  },
};

export function fpsReferenceEntries(section:FpsReferenceSection):FpsReferenceEntry[] {
  if(section==='roles')return [...FPS_T_POSITIONS,...FPS_CT_POSITIONS].map(id=>({id,name:FPS_POSITION_LABELS[id],category:id.startsWith('T_')?'T-side':'CT-side',summary:'Locked tactical responsibility; movement and weapon choices remain contextual.',body:['Each side assigns all five positions once, without duplicates.'],facts:[['Assignment','Locked at match allocation']]}));
  if(section==='identityPersonalities'||section==='personalities')return FPS_IDENTITY_PERSONALITIES.map(p=>({id:p.id,name:p.name,category:personalityLabel(p.temperament),summary:[p.playstyle,p.mindset,p.decisionStyle].map(personalityLabel).join(' / '),body:[FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p)-1].tendency,'Natural behavioral preferences, independent of attributes and results. Every player can adapt, clutch and coordinate.'],facts:[['Mechanical bonuses','None'],['Decision Style',personalityLabel(p.decisionStyle)]]}));
  if(section==='weapons'){
    const recorded=Object.values(FPS_WEAPONS).filter(item=>!['gear','utility'].includes(item.category)).map(item=>({
      id:item.id,name:item.name,category:`Recorded · ${item.category}`,summary:itemDescriptions[item.id],body:['Used in official scheduled matches and 2D recorded simulations.'],facts:[
        ['Match-bank price',item.cost?`$${item.cost.toLocaleString('en-US')}`:'Free'],
        ['Base damage',String(item.baseDamage)],['Headshot multiplier',`${item.headshotMultiplier}x`],
        ['Armor penetration',`${Math.round(item.armorPenetration*100)}%`],['Preferred distance',item.range],['Elimination reward',`$${item.killReward}`],
      ] as [string,string][],
    }));
    const liveWeapons=(Object.entries(LIVE_WEAPONS) as [LiveWeapon,typeof LIVE_WEAPONS[LiveWeapon]][])
      .filter(([id])=>canBuyLiveWeapon(id,true)||canBuyLiveWeapon(id,false))
      .map(([id,item])=>({
        id,name:item.name,category:liveCategoryLabel[item.category??'rifle']??'Live 3D · Weapon',
        summary:liveWeaponNotes[id]??'Active live 3D simulation weapon.',
        body:[`Real-time 3D broadcast armory (${item.side==='ct'?'CT exclusive':item.side==='t'?'T exclusive':'Both sides'}). Automatically swaps to carried sidearm when primary magazine runs dry mid-fight.`],
        facts:[
          ['Buy price',item.cost?`$${item.cost.toLocaleString('en-US')}`:'Free'],
          ['Magazine / Reserve',`${item.magazine} / ${item.reserve}`],
          ['Body dmg / HS',`${item.damage}${item.pellets?`×${item.pellets}`:''} (${item.headshotMultiplier}x HS)`],
          ['Draw time',`${liveDrawTime(id).toFixed(2)}s`],
          ['Elimination bonus',`$${item.killReward??250}`],
        ] as [string,string][],
      }));
    const liveKnife:FpsReferenceEntry={
      id:'live_knife',name:LIVE_KNIFE.name,category:'Live 3D · Melee',
      summary:'Permanent slot-3 melee blade granting max mobility without replacing carried primary or sidearm.',
      body:[`Deals ${LIVE_KNIFE.damage} front damage or ${LIVE_KNIFE.backDamage} directional backstab damage within ${LIVE_KNIFE.reach}m reach.`],
      facts:[['Run speed',`${LIVE_KNIFE.runSpeed} m/s`],['Draw time',`${LIVE_KNIFE.draw}s`],['Front / Back damage',`${LIVE_KNIFE.damage} / ${LIVE_KNIFE.backDamage}`]],
    };
    return [...liveWeapons,liveKnife,...recorded];
  }
  if(section==='equipment'){
    const recorded=Object.values(FPS_WEAPONS).filter(item=>['gear','utility'].includes(item.category)).map(item=>({
      id:item.id,name:item.name,category:`Recorded · ${item.category}`,summary:itemDescriptions[item.id],body:[],facts:[
        ['Match-bank price',item.cost?`$${item.cost.toLocaleString('en-US')}`:'Free'],
      ] as [string,string][],
    }));
    const liveGear:FpsReferenceEntry[]=[
      {id:'live_smoke',name:'Live Smoke Grenade',category:'Live 3D · Utility',summary:`Deploys a ${LIVE_UTILITY_RULES.smokeRadius}m volumetric sightline screen for ${LIVE_UTILITY_RULES.smokeDuration}s on landing.`,body:['Blocks AI vision raycasts completely; can be temporarily carved open by HE blasts and gunfire disturbance, and forces snipers to pivot off smoked sightlines.','Trajectory trails render strictly after release so viewers see real physics flight without early spoiler previews.'],facts:[['Duration',`${LIVE_UTILITY_RULES.smokeDuration}s`],['Radius',`${LIVE_UTILITY_RULES.smokeRadius}m`],['Equip time',`${liveDrawTime('smoke')}s`]]},
      {id:'live_flash',name:'Live Flashbang',category:'Live 3D · Utility',summary:`Detonates after a ${LIVE_UTILITY_FUSES.flashFuse}s fuse across ${LIVE_UTILITY_RULES.flashRadius}m, blinding facing players for ${LIVE_UTILITY_RULES.flashFacingDuration}s.`,body:['Turned opponents suffer a brief 0.45s half-flash; supports pop-flash execution timing ahead of breaching Entry teammates.'],facts:[['Fuse',`${LIVE_UTILITY_FUSES.flashFuse}s`],['Facing / Turned blind',`${LIVE_UTILITY_RULES.flashFacingDuration}s / ${LIVE_UTILITY_RULES.flashTurnedDuration}s`],['Equip time',`${liveDrawTime('flash')}s`]]},
      {id:'live_incendiary',name:'Live Molotov / Incendiary',category:'Live 3D · Utility',summary:`Spreads ${LIVE_UTILITY_RULES.fireDamagePerSecond} DPS flames over ${LIVE_UTILITY_RULES.fireRadius}m to flush anchors or stall rushes.`,body:[`Burns ${LIVE_UTILITY_FUSES.molotovDuration}s on terrain or self-extinguishes cleanly against active smoke blooms.`],facts:[['Damage',`${LIVE_UTILITY_RULES.fireDamagePerSecond} / sec`],['Duration',`${LIVE_UTILITY_FUSES.molotovDuration}s`],['Equip time',`${liveDrawTime('incendiary')}s`]]},
      {id:'live_he',name:'Live HE Fragmentation',category:'Live 3D · Utility',summary:`Explodes after ${LIVE_UTILITY_FUSES.heFuse}s up to ${LIVE_HE_RULES.maxDamage} damage while temporarily parting smoke clouds.`,body:[`Attenuates through solid cover (${Math.round(LIVE_HE_RULES.wallDamageScale*100)}% wall-scaled blast) and clears a ${LIVE_HE_RULES.smokeClearanceRadius}m smoke sightline gap for ${LIVE_HE_RULES.smokeDisturbance}s.`],facts:[['Max damage',String(LIVE_HE_RULES.maxDamage)],['Blast radius',`${LIVE_HE_RULES.damageRadius}m`],['Smoke clear window',`${LIVE_HE_RULES.smokeDisturbance}s`]]},
      {id:'live_c4',name:'Live C4 Explosive Device',category:'Live 3D · Objective',summary:`Plants in ${LIVE_PLANT_RULES.seconds}s at A or B and emits an audible defuse tick cue that alerts nearby attackers.`,body:[`Defuse clicks let Ts spam smokes or push with melee/rifles to punish sneaky or fake defuses. Blast deals up to ${LIVE_C4_RULES.maxDamage} damage inside ${LIVE_C4_RULES.radius}m (${LIVE_C4_RULES.safeDistance}m safe cutoff).`],facts:[['Plant time',`${LIVE_PLANT_RULES.seconds}s`],['Blast / Safe',`${LIVE_C4_RULES.radius}m / ${LIVE_C4_RULES.safeDistance}m`],['Equip time',`${liveDrawTime('bomb')}s`]]},
    ];
    return [...liveGear,...recorded];
  }
  if(section==='maps'){
    const liveMaps=listLiveMaps().map(def=>{
      const note=liveMapDescriptions[def.id];
      const tiers=def.nav.levels.length||1;
      const elevationList=def.nav.levels.join(' / ');
      return {
        id:def.id,name:def.name,category:'Live 3D Battlefield',
        summary:note?.summary??def.broadcast.subtitle,
        body:[...(note?.details??[]),`${def.tactical.callouts.length} tactical callout zones, ${def.authoredSmokeLineups.length} physical smoke lineups, and ${def.elevationDrops.length} crouch-vault elevation drops.`],
        facts:[
          ['Tactical mode','Real-time 3D Exhibition & Broadcast'],
          ['Elevation layers',tiers>1?`${tiers} (${elevationList})`:'1 continuous plane + vault drops'],
          ['Smoke lineups / Drops',`${def.authoredSmokeLineups.length} lineups / ${def.elevationDrops.length} vault drops`],
          ['Grid footprint',`${def.width}m × ${def.depth}m`],
        ] as [string,string][],
      };
    });
    const recordedMaps=Object.values(FPS_MAPS).map(map=>({id:map.id,name:map.name,category:'Recorded match pool',summary:map.description,
      body:[`Site A: ${map.siteAZones.map(id=>map.zones[id].name).join(', ')}.`,`Site B: ${map.siteBZones.map(id=>map.zones[id].name).join(', ')}.`],
      facts:[['Zones',String(Object.keys(map.zones).length)],['Choke points',map.chokeZones.map(id=>map.zones[id].name).join(', ')],['Attacker spawn',map.zones[map.attackerSpawnZone].name],['Defender spawn',map.zones[map.defenderSpawnZone].name]] as [string,string][],
    }));
    return [...liveMaps,...recordedMaps];
  }
  if(section==='liveSimulation')return [
    {id:'influence-maps-eqs',name:'Influence Maps & EQS Positioning',category:'Spatial AI',summary:'Dynamic danger heatmaps and unchecked-zone uncertainty replace static scripted waypoints.',body:['Gunfire, eliminations and explosions spike local Threat Heatmaps so teams rotate, flank or deploy utility instead of blindly funneling into losing chokes.','Uncertain zones gradually gain exploration weight while EQS cover scoring evaluates sightline hiding, site distance and escape paths.'],facts:[['Replaces','Fixed "on-rails" paths'],['Signals','Gunfire, kills, sound & time unseen']]},
    {id:'blackboards-behavior-trees',name:'IGL Blackboards & Behavior Trees',category:'Team AI',summary:'Shared team intention boards prevent five teammates stacking one doorway while preserving individual agency.',body:['Bots claim smoke throws, pop-flashes, flanks and crossfire holds on a per-side Tactical Blackboard before acting.','Modular Behavior Trees execute crisp micro-mechanics — counter-strafing, jump-peeks, reload timing, mid-fight handgun swaps and bomb plants — while GOAP plans full executes and retakes.'],facts:[['Attack archetypes','7 (rush, default, split, fake, mid)'],['Team synergy','Individual gifts, utility & trade pairing']]},
    {id:'lawful-perception-death-comms',name:'Lawful Perception & Death-Callout Trading',category:'Information & Comms',summary:'Agents never use wallhacks: only 3D FOV vision, acoustics, radio delays and observed last-known death calls.',body:['Stance-dependent 3D sightlines (`1.60m` stand / `1.08m` crouch) pair with human reaction delays, aim spring curves and recoil pull-down.','When a player falls after legally spotting their killer in a duel, they call the nearby landmark (`"ARGH! 1 behind car/truck/tree — trade him!"`), feeding delayed radio intel and Influence Danger so nearby allies swing to trade without ever leaking unseen flank ambushers.'],facts:[['Vision cone','3D FOV + smoke occlusion'],['Unseen flank protection','Zero killer leak']]},
    {id:'loadouts-movement-mechanics',name:'4-Slot Loadouts, Vault Drops & Boosts',category:'Live Mechanics',summary:'Full Primary, Sidearm, Melee Knife and Utility inventories with continuous 3D kinematics.',body:['Running dry on a rifle or sniper mid-duel triggers an automatic handgun swap; snipers disallow close wall/smoke scoping and duck behind cover while cycling the bolt.','Map traversal supports elevation drops (`LIVE_ELEVATION_DROPS`), crate boost off-angles, A/D counter-strafing and crouch jump-peeks.'],facts:[['Slots','Primary · Pistol · Knife · Utility'],['Pistol swap','Automatic at ammo 0']]},
    {id:'broadcast-camera-hud',name:'BLAST Broadcast HUD, Auto Wide & PIP',category:'3D Broadcast',summary:'Esports spectator presentation with prewarmed POV viewmodels, PiP bomb camera and Director pacing.',body:['Switch seamlessly between 1P POV (with prewarmed weapon models to eliminate camera-switch stutter), 3P Chase, Free Cam, Overview and Auto Director.','Auto Wide captures split-site chaos with a strict 1.25s deadline before returning to close combat framing, while release-only trails track thrown grenades cleanly.'],facts:[['Auto Wide cap','1.25s per split-fight episode'],['Map switching','Fontessa & Spillway live toggle']]},
  ];
  if(section==='attributes')return Object.entries(FPS_ATTRIBUTE_LABELS).map(([id,name])=>({id,name,category:'Stored player skill',summary:skillDescriptions[id],body:[],facts:[['Internal range','1–99'],['Player-facing scale','1–10 bands']]}));
  if(section==='rules')return [
    {id:'rounds',name:'Rounds & sides',category:'MR15',summary:'Five players per team. First to 16 in regulation, with a side swap after round 15.',body:['A 15–15 tie enters repeating MR3 overtime. Each fresh six-round block requires four wins, changes sides after three rounds and begins with a reset bank.'],facts:[['Overtime bank',`$${OVERTIME_STARTING_CASH.toLocaleString('en-US')}`]]},
    {id:'device',name:'Plant, defend or defuse',category:'Objective',summary:'Attackers plant at A or B. Defenders prevent the plant or defuse.',body:['Eliminating the attackers after a plant does not stop the device. A fallen carrier drops it, and a living attacker must reach it to recover it. Damage interrupts an objective action; live 3D defuse ticks alert nearby Ts to fake/sneaky defuses.'],facts:[['Recorded Prep / Live','15s / 115s'],['Recorded Plant / Count','3.5s / 40s (3.2s live 3D)'],['Defuse','10s / 5s with kit']]},
    {id:'economy',name:'Round economy',category:'Equipment',summary:'Equipment uses a separate match bank. It never spends club money.',body:['Survivors retain equipment; eliminated players lose their equipment. Live 3D buys honor own-lane reserves, pistol/SMG force buys, armor/kit reserves and weapon gifting to teammates.'],facts:[['Pistol-round bank',`$${STARTING_CASH}`],['Bank cap',`$${MAX_CASH.toLocaleString('en-US')}`],['Round win',`$${ROUND_WIN_REWARD.toLocaleString('en-US')}`],['Loss ladder',LOSS_BONUS_LADDER.map(n=>`$${n.toLocaleString('en-US')}`).join(' → ')]]},
    {id:'personality',name:'Personality & skill',category:'Decision making',summary:'Situational personality, individual DNA and coaching shape legal action probabilities.',body:['Roles are responsibilities. Every player can exploit established opportunities. Familiarity and chemistry affect coordination, while personality never adds aim or damage. Historical v2 recordings retain their original rules.'],facts:[['Personality combinations','54'],['Side-specific positions','10'],['Direct skill bonuses from personality','None']]},
  ];
  return [];
}

export function searchFpsReference(query:string) {
  const term=query.trim().toLowerCase();
  if(term.length<2)return [];
  return (Object.keys(FPS_REFERENCE_SECTIONS) as FpsReferenceSection[]).flatMap(section=>fpsReferenceEntries(section)
    .filter(item=>`${item.name} ${item.category} ${item.summary}`.toLowerCase().includes(term))
    .map(item=>({name:item.name,href:fpsReferenceHref(section,item.id),group:FPS_REFERENCE_SECTIONS[section]}))).slice(0,12);
}
