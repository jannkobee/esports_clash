import type { FpsPoint } from './fpsSpatialWorld.ts';

export type LiveIntelSource='sight'|'footstep'|'gunfire'|'melee'|'reload'|'damage'|'utility';
export type LiveIntelArea='A'|'B'|'Mid';
export interface LiveIntelContact extends FpsPoint {
  key:string;enemyId?:string;observerId:string;source:LiveIntelSource;via?:string;
  observed:number;confidence:number;uncertainty:number;
}
export interface LiveIntelMemory {contacts:LiveIntelContact[]}
export interface LiveIntelBelief extends LiveIntelContact {certainty:number;radius:number;age:number}
export interface LiveAreaEvidence {strength:number;identified:number;confirmed:number;corroborated:boolean;point?:FpsPoint}
export type LiveIntelAssessment=Record<LiveIntelArea,LiveAreaEvidence>;

const distance=(a:FpsPoint,b:FpsPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
const lifetimes:Record<LiveIntelSource,number>={sight:6,footstep:2.6,gunfire:3.6,melee:2.6,reload:2.8,damage:3.5,utility:3};
const weights:Record<LiveIntelSource,number>={sight:1,footstep:.32,gunfire:.52,melee:.35,reload:.4,damage:.7,utility:.22};
export const emptyLiveIntel=():LiveIntelMemory=>({contacts:[]});
export const liveIntelArea=(point:FpsPoint):LiveIntelArea=>point.z>-18&&point.x<-10?'A':point.z>-18&&point.x>10?'B':'Mid';

export function liveIntelBeliefs(memory:LiveIntelMemory,now:number):LiveIntelBelief[] {
  return memory.contacts.map(c=>{
    const age=Math.max(0,now-c.observed);
    return {...c,age,certainty:c.confidence*Math.exp(-age/lifetimes[c.source]),radius:c.uncertainty+age*(c.source==='sight'?1.5:1.8)};
  }).filter(c=>c.age<14&&c.certainty>=.12);
}

/** Reports preserve the original observation time and evidence key; copies cannot manufacture sightings. */
export function rememberLiveIntel(memory:LiveIntelMemory,contact:LiveIntelContact,now:number):void {
  memory.contacts=liveIntelBeliefs(memory,now).map(({age:_,certainty:__,radius:___,...c})=>c);
  const key=contact.enemyId?`enemy:${contact.enemyId}`:contact.key;
  const at=memory.contacts.findIndex(c=>(c.enemyId?`enemy:${c.enemyId}`:c.key)===key);
  if(at>=0){
    const previous=memory.contacts[at];
    if(contact.observed<previous.observed)return;
    if(contact.observed===previous.observed&&contact.confidence<=previous.confidence)return;
    // A weak sound cannot erase a fresh visual identification, even if it happens later.
    if(contact.source!=='sight'&&previous.source==='sight'&&now-previous.observed<2)return;
    memory.contacts[at]={...contact};
  } else memory.contacts.push({...contact});
  const priority=(c:LiveIntelContact)=>c.confidence*Math.exp(-Math.max(0,now-c.observed)/lifetimes[c.source])*(c.enemyId?2:1);
  memory.contacts.sort((a,b)=>priority(b)-priority(a)||b.observed-a.observed||a.key.localeCompare(b.key));
  memory.contacts=memory.contacts.slice(0,16);
}

export function assessLiveIntel(memory:LiveIntelMemory,now:number):LiveIntelAssessment {
  const areas:LiveIntelAssessment={A:{strength:0,identified:0,confirmed:0,corroborated:false},B:{strength:0,identified:0,confirmed:0,corroborated:false},Mid:{strength:0,identified:0,confirmed:0,corroborated:false}};
  // Anonymous noises can suggest pressure, but footsteps never become an exact enemy count.
  const anonymous:Record<LiveIntelArea,Partial<Record<LiveIntelSource,number>>>={A:{},B:{},Mid:{}};
  const best:Partial<Record<LiveIntelArea,number>>={};
  for(const belief of liveIntelBeliefs(memory,now)){
    const area=liveIntelArea(belief),entry=areas[area],value=belief.certainty*weights[belief.source];
    if(belief.enemyId&&belief.certainty>=.35){entry.identified++;if(belief.source==='sight'&&belief.age<3&&belief.certainty>=.6)entry.confirmed++;entry.strength+=value;}
    else if(belief.age<4&&belief.certainty>=.25)anonymous[area][belief.source]=Math.max(anonymous[area][belief.source]??0,value);
    if(value>(best[area]??0)){best[area]=value;entry.point={x:belief.x,z:belief.z};}
  }
  for(const area of ['A','B','Mid'] as const){
    areas[area].strength+=Math.min(.85,Object.values(anonymous[area]).reduce((sum,value)=>sum+value,0));
    areas[area].corroborated=Object.keys(anonymous[area]).length>=2;
  }
  return areas;
}

export function strongestLiveIntel(memory:LiveIntelMemory,from:FpsPoint,now:number):LiveIntelBelief|undefined {
  const score=(c:LiveIntelBelief)=>c.certainty*(c.source==='sight'?1.45:1)/(1+distance(from,c)*.035);
  return liveIntelBeliefs(memory,now).sort((a,b)=>score(b)-score(a)||b.observed-a.observed||a.key.localeCompare(b.key))[0];
}

/** Negative evidence is local: inspect five points in a small uncertainty area, never declare a site empty. */
export function clearLiveIntel(memory:LiveIntelMemory,now:number,observable:(point:FpsPoint)=>boolean,visibleEnemies:readonly FpsPoint[]):void {
  for(const belief of liveIntelBeliefs(memory,now)){
    if(belief.age<.35||belief.radius>3||visibleEnemies.some(p=>distance(p,belief)<=belief.radius+1))continue;
    const r=Math.max(.8,belief.radius);
    const samples=[belief,{x:belief.x-r,z:belief.z},{x:belief.x+r,z:belief.z},{x:belief.x,z:belief.z-r},{x:belief.x,z:belief.z+r}];
    if(samples.every(observable)){
      const stored=memory.contacts.find(c=>c.key===belief.key&&c.observed===belief.observed);
      if(stored)stored.confidence*=.2;
    }
  }
}

export function describeLiveIntel(memory:LiveIntelMemory,from:FpsPoint,now:number):string {
  const best=strongestLiveIntel(memory,from,now);if(!best)return 'No current contact — watch the assigned angle';
  const area=liveIntelArea(best),evidence=assessLiveIntel(memory,now)[area];
  const source=best.via?'Teammate report':best.source==='sight'?'Own sight':best.source==='footstep'?'Footsteps':best.source==='gunfire'?'Gunfire':best.source==='reload'?'Reload':best.source==='melee'?'Nearby knife swing':best.source==='damage'?'Taking fire':'Utility cue';
  const certainty=best.certainty>=.7?'recent':best.certainty>=.35?'uncertain':'fading';
  const count=evidence.identified>0?` · ${evidence.identified} last seen`:'';
  return `${source} · ${area}${count} · ${certainty} (${Math.floor(best.age)}s ago)`;
}
