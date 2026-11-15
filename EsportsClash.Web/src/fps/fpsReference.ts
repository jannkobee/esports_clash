import {FPS_IDENTITY_PERSONALITIES,FPS_T_POSITIONS,FPS_CT_POSITIONS,FPS_POSITION_LABELS,FPS_BASE_BEHAVIORAL_PROFILES,fpsBaseProfileId,personalityLabel} from './fpsIdentity.ts';
import {FPS_ATTRIBUTE_LABELS} from './fpsPersonality.ts';
import {FPS_WEAPONS} from './fpsWeapons.ts';
import {FPS_MAPS} from './fpsMaps.ts';
import {STARTING_CASH,MAX_CASH,ROUND_WIN_REWARD,OVERTIME_STARTING_CASH,LOSS_BONUS_LADDER} from './fpsEconomy.ts';

export const FPS_REFERENCE_SECTIONS = {
  fps:'Tactical FPS', roles:'Player roles', personalities:'Personalities', identityPersonalities:'Personality engine',  weapons:'Weapons',
  equipment:'Gear & utility', maps:'Competitive maps', attributes:'Player skills', rules:'Match rules',
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

export function fpsReferenceEntries(section:FpsReferenceSection):FpsReferenceEntry[] {
  if(section==='roles')return [...FPS_T_POSITIONS,...FPS_CT_POSITIONS].map(id=>({id,name:FPS_POSITION_LABELS[id],category:id.startsWith('T_')?'T-side':'CT-side',summary:'Locked tactical responsibility; movement and weapon choices remain contextual.',body:['Each side assigns all five positions once, without duplicates.'],facts:[['Assignment','Locked at match allocation']]}));
  if(section==='identityPersonalities'||section==='personalities')return FPS_IDENTITY_PERSONALITIES.map(p=>({id:p.id,name:p.name,category:personalityLabel(p.temperament),summary:[p.playstyle,p.mindset,p.decisionStyle].map(personalityLabel).join(' / '),body:[FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p)-1].tendency,'Natural behavioral preferences, independent of attributes and results. Every player can adapt, clutch and coordinate.'],facts:[['Mechanical bonuses','None'],['Decision Style',personalityLabel(p.decisionStyle)]]}));
  if(section==='weapons'||section==='equipment')return Object.values(FPS_WEAPONS).filter(item=>section==='weapons'?!['gear','utility'].includes(item.category):['gear','utility'].includes(item.category)).map(item=>({
    id:item.id,name:item.name,category:item.category,summary:itemDescriptions[item.id],body:[],facts:[
      ['Match-bank price',item.cost?`$${item.cost.toLocaleString('en-US')}`:'Free'],
      ...(item.category==='gear'||item.category==='utility'?[]:[['Base damage',String(item.baseDamage)],['Headshot multiplier',`${item.headshotMultiplier}x`],['Armor penetration',`${Math.round(item.armorPenetration*100)}%`],['Preferred distance',item.range],['Elimination reward',`$${item.killReward}`]] as [string,string][]),
    ],
  }));
  if(section==='maps')return Object.values(FPS_MAPS).map(map=>({id:map.id,name:map.name,category:'Competitive pool',summary:map.description,
    body:[`Site A: ${map.siteAZones.map(id=>map.zones[id].name).join(', ')}.`,`Site B: ${map.siteBZones.map(id=>map.zones[id].name).join(', ')}.`],
    facts:[['Zones',String(Object.keys(map.zones).length)],['Choke points',map.chokeZones.map(id=>map.zones[id].name).join(', ')],['Attacker spawn',map.zones[map.attackerSpawnZone].name],['Defender spawn',map.zones[map.defenderSpawnZone].name]],
  }));
  if(section==='attributes')return Object.entries(FPS_ATTRIBUTE_LABELS).map(([id,name])=>({id,name,category:'Stored player skill',summary:skillDescriptions[id],body:[],facts:[['Internal range','1–99'],['Player-facing scale','1–10 bands']]}));
  if(section==='rules')return [
    {id:'rounds',name:'Rounds & sides',category:'MR15',summary:'Five players per team. First to 16 in regulation, with a side swap after round 15.',body:['A 15–15 tie enters repeating MR3 overtime. Each fresh six-round block requires four wins, changes sides after three rounds and begins with a reset bank.'],facts:[['Overtime bank',`$${OVERTIME_STARTING_CASH.toLocaleString('en-US')}`]]},
    {id:'device',name:'Plant, defend or defuse',category:'Objective',summary:'Attackers plant at A or B. Defenders prevent the plant or defuse the device.',body:['Eliminating the attackers after a plant does not stop the device. A fallen carrier drops it, and a living attacker must reach it to recover it. Damage interrupts an objective action.'],facts:[['Prep','15 seconds'],['Live deadline','115 seconds'],['Plant','3.5 seconds'],['Planted countdown','40 seconds'],['Defuse','10 seconds / 5 with kit']]},
    {id:'economy',name:'Round economy',category:'Equipment',summary:'Equipment uses a separate match bank. It never spends club money.',body:['Survivors retain equipment; eliminated players lose their equipment. Purchases cannot make cash negative. Three utility slots are available.'],facts:[['Pistol-round bank',`$${STARTING_CASH}`],['Bank cap',`$${MAX_CASH.toLocaleString('en-US')}`],['Round win',`$${ROUND_WIN_REWARD.toLocaleString('en-US')}`],['Loss ladder',LOSS_BONUS_LADDER.map(n=>`$${n.toLocaleString('en-US')}`).join(' → ')]]},
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
