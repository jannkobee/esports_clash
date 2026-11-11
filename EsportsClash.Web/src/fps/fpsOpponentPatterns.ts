import type { FpsPoint } from './fpsSpatialWorld.ts';
import { liveIntelArea, type LiveIntelContact, type LiveIntelMemory, assessLiveIntel, liveIntelBeliefs } from './fpsLiveIntel.ts';
import { fpsAbilityUnit, type FpsSkillProfile } from './fpsSkillProfile.ts';

export interface FpsOpponentPattern extends FpsPoint {key:string;rounds:number[];lastObserved:number;earlyRounds?:number[]}
export function recordFpsOpponentPattern(patterns:FpsOpponentPattern[],contact:LiveIntelContact,round:number,elapsed=Infinity):void {
  if(contact.source!=='sight'||!contact.enemyId||contact.confidence<.55)return;
  const key=`${liveIntelArea(contact)}:${Math.round(contact.x/5)}:${Math.round(contact.z/5)}`;
  let pattern=patterns.find(p=>p.key===key);
  if(!pattern){pattern={key,x:contact.x,z:contact.z,rounds:[],lastObserved:contact.observed};patterns.push(pattern);}
  if(!pattern.rounds.includes(round))pattern.rounds.push(round);
  if(elapsed<25){pattern.earlyRounds??=[];if(!pattern.earlyRounds.includes(round))pattern.earlyRounds.push(round);pattern.earlyRounds=pattern.earlyRounds.slice(-6);}
  pattern.rounds=pattern.rounds.slice(-6);pattern.lastObserved=Math.max(pattern.lastObserved,contact.observed);
  patterns.sort((a,b)=>b.lastObserved-a.lastObserved||a.key.localeCompare(b.key));patterns.splice(16);
}

/** Repeated sightings in one round or echoed reports cannot manufacture a tendency. */
export function knownFpsTendency(patterns:readonly FpsOpponentPattern[],round:number) {
  return (['A','B','Mid'] as const).map(area=>{
    const matching=patterns.filter(p=>liveIntelArea(p)===area);
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
export function interpretFpsInformation(profile:FpsSkillProfile,memory:LiveIntelMemory,now:number) {
  const assessment=assessLiveIntel(memory,now),reading=fpsAbilityUnit(profile,'informationReading');
  for(const area of ['A','B','Mid'] as const){
    const ambiguous=liveIntelBeliefs(memory,now).filter(c=>liveIntelArea(c)===area&&(!c.enemyId||c.age>3));
    assessment[area].strength+=Math.min(.55,ambiguous.reduce((n,c)=>n+c.certainty*.18*(1-reading),0));
  }
  return assessment;
}
