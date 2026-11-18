import type { FpsPoint } from './fpsSpatialWorld.ts';
import { liveIntelArea, type LiveIntelClassifier, type LiveIntelContact, type LiveIntelMemory, assessLiveIntel, liveIntelBeliefs } from './fpsLiveIntel.ts';
import { fpsAbilityUnit, type FpsSkillProfile } from './fpsSkillProfile.ts';

export interface FpsOpponentPattern extends FpsPoint {
  key:string;
  rounds:number[];
  lastObserved:number;
  earlyRounds?:number[];
  sniperRounds?:number[];
  enemyId?:string;
  elevatedRounds?:number[];
  lethalRounds?:number[];
}
export function recordFpsOpponentPattern(
  patterns:FpsOpponentPattern[],
  contact:LiveIntelContact,
  round:number,
  elapsed=Infinity,
  classifier:LiveIntelClassifier=liveIntelArea,
  elevated=false,
  lethal=false,
):void {
  if(contact.source!=='sight'||!contact.enemyId||contact.confidence<.55)return;
  const key=`${classifier(contact)}:${Math.round(contact.x/5)}:${Math.round(contact.z/5)}`;
  let pattern=patterns.find(p=>p.key===key);
  if(!pattern){pattern={key,x:contact.x,z:contact.z,rounds:[],lastObserved:contact.observed,enemyId:contact.enemyId};patterns.push(pattern);}
  if(!pattern.rounds.includes(round))pattern.rounds.push(round);
  if(elapsed<25){pattern.earlyRounds??=[];if(!pattern.earlyRounds.includes(round))pattern.earlyRounds.push(round);pattern.earlyRounds=pattern.earlyRounds.slice(-6);}
  if(contact.weaponHint==='sniper'){pattern.sniperRounds??=[];if(!pattern.sniperRounds.includes(round))pattern.sniperRounds.push(round);pattern.sniperRounds=pattern.sniperRounds.slice(-6);}
  if(elevated){pattern.elevatedRounds??=[];if(!pattern.elevatedRounds.includes(round))pattern.elevatedRounds.push(round);pattern.elevatedRounds=pattern.elevatedRounds.slice(-6);}
  if(lethal){pattern.lethalRounds??=[];if(!pattern.lethalRounds.includes(round))pattern.lethalRounds.push(round);pattern.lethalRounds=pattern.lethalRounds.slice(-6);}
  pattern.rounds=pattern.rounds.slice(-6);pattern.lastObserved=Math.max(pattern.lastObserved,contact.observed);
  patterns.sort((a,b)=>b.lastObserved-a.lastObserved||a.key.localeCompare(b.key));patterns.splice(16);
}

/** Lawful observed danger spots from the last 6 rounds, scored by frequency, lethality, sniper presence, and elevation. */
export function knownFpsDangerSpots(
  patterns:readonly FpsOpponentPattern[],
  round:number,
  classifier:LiveIntelClassifier=liveIntelArea,
):{x:number;z:number;area:'A'|'B'|'Mid';danger:number;lethal:boolean;sniper:boolean;elevated:boolean}[] {
  const recent=(arr?:readonly number[])=>(arr??[]).filter(r=>r<round&&r>=round-6);
  return patterns.flatMap(p=>{
    const rounds=recent(p.rounds);
    if(!rounds.length)return [];
    const lethalRounds=recent(p.lethalRounds);
    const sniperRounds=recent(p.sniperRounds);
    const elevatedRounds=recent(p.elevatedRounds);
    const danger=rounds.length*0.35+lethalRounds.length*0.55+sniperRounds.length*0.4+elevatedRounds.length*0.3;
    return [{
      x:p.x,
      z:p.z,
      area:classifier(p),
      danger,
      lethal:lethalRounds.length>0,
      sniper:sniperRounds.length>0,
      elevated:elevatedRounds.length>0,
    }];
  }).sort((a,b)=>b.danger-a.danger||a.area.localeCompare(b.area));
}

/** Lawful observed sniper-lane habit from confirmed sight sightings (never reads hidden enemy profiles). */
export function knownFpsSniperTendency(patterns:readonly FpsOpponentPattern[],round:number,classifier:LiveIntelClassifier=liveIntelArea) {
  return (['A','B','Mid'] as const).map(area=>{
    const matching=patterns.filter(p=>classifier(p)===area);
    const rounds=new Set(matching.flatMap(p=>p.sniperRounds??[]).filter(r=>r<round&&r>=round-6));
    const anchor=matching.find(p=>(p.sniperRounds??[]).some(r=>r<round&&r>=round-6));
    return {area,samples:rounds.size,point:anchor?{x:anchor.x,z:anchor.z}:undefined};
  }).filter(p=>p.samples>=2).sort((a,b)=>b.samples-a.samples||a.area.localeCompare(b.area))[0];
}

/** Lawful observed elevated off-angle habit from confirmed sight sightings. */
export function knownFpsElevatedTendency(patterns:readonly FpsOpponentPattern[],round:number,classifier:LiveIntelClassifier=liveIntelArea) {
  return (['A','B','Mid'] as const).map(area=>{
    const matching=patterns.filter(p=>classifier(p)===area);
    const rounds=new Set(matching.flatMap(p=>p.elevatedRounds??[]).filter(r=>r<round&&r>=round-6));
    const anchor=matching.find(p=>(p.elevatedRounds??[]).some(r=>r<round&&r>=round-6));
    return {area,samples:rounds.size,point:anchor?{x:anchor.x,z:anchor.z}:undefined};
  }).filter(p=>p.samples>=2).sort((a,b)=>b.samples-a.samples||a.area.localeCompare(b.area))[0];
}

/** Repeated sightings in one round or echoed reports cannot manufacture a tendency. */
export function knownFpsTendency(patterns:readonly FpsOpponentPattern[],round:number,classifier:LiveIntelClassifier=liveIntelArea) {
  return (['A','B','Mid'] as const).map(area=>{
    const matching=patterns.filter(p=>classifier(p)===area);
    const rounds=new Set(matching.flatMap(p=>p.rounds).filter(r=>r<round&&r>=round-6));
    const early=new Set(matching.flatMap(p=>p.earlyRounds??[]).filter(r=>rounds.has(r)));
    return {area,samples:rounds.size,early:early.size,confidence:Math.min(.8,rounds.size/6)};
  }).filter(p=>p.samples>=2).sort((a,b)=>b.samples-a.samples||b.early-a.early||a.area.localeCompare(b.area))[0];
}
export function knownFpsPattern(patterns:readonly FpsOpponentPattern[],from:FpsPoint,round:number):FpsOpponentPattern|undefined {
  return patterns.filter(p=>p.rounds.filter(r=>r<round&&r>=round-6).length>=3&&Math.hypot(p.x-from.x,p.z-from.z)<25)
    .sort((a,b)=>b.rounds.length-a.rounds.length||b.lastObserved-a.lastObserved)[0];
}
/** Poor interpretation can over-weight old anonymous activity; it cannot identify opponents or refresh timestamps. */
export function interpretFpsInformation(profile:FpsSkillProfile,memory:LiveIntelMemory,now:number,classifier:LiveIntelClassifier=liveIntelArea) {
  const assessment=assessLiveIntel(memory,now,classifier),reading=fpsAbilityUnit(profile,'informationReading');
  for(const area of ['A','B','Mid'] as const){
    const ambiguous=liveIntelBeliefs(memory,now).filter(c=>classifier(c)===area&&(!c.enemyId||c.age>3));
    assessment[area].strength+=Math.min(.55,ambiguous.reduce((n,c)=>n+c.certainty*.18*(1-reading),0));
  }
  return assessment;
}

export interface FpsObservedOpponentHabits {
  earlyRushRounds:number[];
  slowDefaultRounds:number[];
  heavyUtilityRounds:number[];
  saveRounds:number[];
  passiveAnchorRounds:number[];
}

export function createFpsObservedOpponentHabits():FpsObservedOpponentHabits {
  return {earlyRushRounds:[],slowDefaultRounds:[],heavyUtilityRounds:[],saveRounds:[],passiveAnchorRounds:[]};
}

/** Records strictly lawful per-round enemy behavioral observations over a rolling 6-round window. */
export function recordFpsObservedOpponentRound(
  habits:FpsObservedOpponentHabits,
  round:number,
  observed:{earlyRush?:boolean;slowDefault?:boolean;heavyEarlyUtility?:boolean;savedOnLoss?:boolean;passiveAnchors?:boolean},
):void {
  const push=(arr:number[],flag?:boolean)=>{
    if(!flag)return;
    if(!arr.includes(round))arr.push(round);
    if(arr.length>6)arr.splice(0,arr.length-6);
  };
  push(habits.earlyRushRounds,observed.earlyRush);
  push(habits.slowDefaultRounds,observed.slowDefault);
  push(habits.heavyUtilityRounds,observed.heavyEarlyUtility);
  push(habits.saveRounds,observed.savedOnLoss);
  push(habits.passiveAnchorRounds,observed.passiveAnchors);
}

export type FpsOpponentExploitKind='anti_rush'|'take_early_space'|'wait_out_utility'|'hunt_saves'|'sniper_smoke';
export interface FpsOpponentExploit {
  kind:FpsOpponentExploitKind;
  samples:number;
  area?:'A'|'B'|'Mid';
  point?:{x:number;z:number};
}

/** Derives lawful tactical counter-suggestions from rolling 6-round observed opponent habits. */
export function knownFpsOpponentExploit(
  habits:FpsObservedOpponentHabits|undefined,
  patterns:readonly FpsOpponentPattern[],
  round:number,
  classifier:LiveIntelClassifier=liveIntelArea,
):FpsOpponentExploit|undefined {
  const recent=(arr?:readonly number[])=>(arr??[]).filter(r=>r<round&&r>=round-6).length;
  const candidates:FpsOpponentExploit[]=[];
  const sniper=knownFpsSniperTendency(patterns,round,classifier);
  if(sniper&&sniper.samples>=2)candidates.push({kind:'sniper_smoke',samples:sniper.samples,area:sniper.area,point:sniper.point});
  if(habits){
    const rush=recent(habits.earlyRushRounds),slow=recent(habits.slowDefaultRounds);
    const heavyUtil=recent(habits.heavyUtilityRounds),saves=recent(habits.saveRounds);
    const passive=recent(habits.passiveAnchorRounds);
    if(rush>=2)candidates.push({kind:'anti_rush',samples:rush});
    if(heavyUtil>=2)candidates.push({kind:'wait_out_utility',samples:heavyUtil});
    if(saves>=2)candidates.push({kind:'hunt_saves',samples:saves});
    if(slow>=2||passive>=2)candidates.push({kind:'take_early_space',samples:Math.max(slow,passive)});
  }
  return candidates.sort((a,b)=>b.samples-a.samples||a.kind.localeCompare(b.kind))[0];
}
