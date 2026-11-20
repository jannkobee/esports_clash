import {distance,FONTESSA_MAP_RUNTIME} from './fpsLiveMap.ts';
import type {LiveMapRuntime} from './fpsLiveMapTypes.ts';
import {liveIntelBeliefs,liveIntelArea,type LiveIntelContact,type LiveIntelMemory} from './fpsLiveIntel.ts';
import type {FpsPoint} from './fpsSpatialWorld.ts';

export interface LiveMotionObservation extends FpsPoint {at:number;vx:number;vz:number;samples:number}
export interface LiveAnticipation extends FpsPoint {key:string;observed:number;until:number;confidence:number;uncertainty:number;prefire:boolean;reason:string;shots:number}

/** Only firsthand samples supply velocity; sounds/reports cannot reveal a hidden body's motion. */
export function recordLiveMotion(samples:Map<string,LiveMotionObservation>,contact:LiveIntelContact,observerId:string):void {
  if(contact.source!=='sight'||!contact.enemyId||contact.observerId!==observerId||contact.via)return;
  const before=samples.get(contact.enemyId),dt=before?contact.observed-before.at:0;
  if(before&&dt<=.04)return;
  const usable=!!before&&dt<1.2&&dt>0;
  const vx=usable?Math.max(-4.1,Math.min(4.1,(contact.x-before.x)/dt)):0;
  const vz=usable?Math.max(-4.1,Math.min(4.1,(contact.z-before.z)/dt)):0;
  samples.set(contact.enemyId,{x:contact.x,z:contact.z,level:contact.level,at:contact.observed,vx,vz,samples:usable?before.samples+1:1});
  if(samples.size>10)samples.delete(samples.keys().next().value!);
}

/** Bounded hypotheses from initial information. No live-enemy collection is accepted here. */
export function anticipateLiveContact(memory:LiveIntelMemory,motion:ReadonlyMap<string,LiveMotionObservation>,from:FpsPoint,now:number,reading:number,timing:number,judgment:number,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LiveAnticipation|undefined {
  const beliefs=liveIntelBeliefs(memory,now).filter(contact=>contact.age<2.1&&contact.certainty>.4&&distance(from,contact)<30)
    .sort((a,b)=>b.certainty-a.certainty||a.age-b.age);
  for(const contact of beliefs){
    const sample=contact.enemyId?motion.get(contact.enemyId):undefined;
    if(contact.source==='sight'&&sample&&sample.samples>=2&&Math.abs(sample.at-contact.observed)<.1&&Math.hypot(sample.vx,sample.vz)>.65){
      const horizon=Math.min(.8,contact.age+.12+timing*.25),length=Math.hypot(sample.vx,sample.vz)||1;
      const travel=Math.min(2.8,length*horizon),point={x:contact.x+sample.vx/length*travel,z:contact.z+sample.vz/length*travel,level:contact.level};
      if(!runtime.walkable(point)||!runtime.sightline(contact,point)||!runtime.sightline(from,point))continue;
      const confidence=contact.certainty*(.5+reading*.45)*Math.exp(-contact.age*.6),uncertainty=contact.uncertainty+contact.age*(1.4-reading*.7);
      return {...point,key:contact.key,observed:contact.observed,until:now+.55,confidence,uncertainty,
        prefire:reading>.45&&judgment>.4&&confidence>.55&&uncertainty<1.35&&contact.age>.08,
        reason:'Anticipate a crossing from the last observed movement',shots:0};
    }
    if(contact.source==='sight'&&contact.age>.2&&contact.age<1.4&&contact.radius<2.4){
      const confidence=contact.certainty*(.6+reading*.35);
      return {...contact,key:contact.key,observed:contact.observed,until:now+.55,confidence,uncertainty:contact.radius,
        prefire:reading>.45&&judgment>.4&&confidence>.58&&contact.radius<1.7,
        reason:'Pre-aim the last seen hold before re-peeking it',shots:0};
    }
    if(contact.source==='reload'&&contact.age<.9){
      return {...contact,key:contact.key,observed:contact.observed,until:now+.45,confidence:contact.certainty*(.55+reading*.4),uncertainty:contact.radius,prefire:false,
        reason:'Use the heard reload as a short timing window; clear the uncertain angle',shots:0};
    }
    if(contact.source==='footstep'||contact.source==='gunfire'){
      const area=liveIntelArea(contact,runtime.intelArea);if(area==='Mid'||reading<.35)continue;
      const gate=[...runtime.definition.tactical[area].entries].sort((a,b)=>distance(a,contact)-distance(b,contact))[0];
      if(!gate||distance(gate,contact)>contact.radius+5||!runtime.sightline(from,gate))continue;
      return {...gate,key:contact.key,observed:contact.observed,until:now+.65,confidence:contact.certainty*(.5+reading*.4),uncertainty:Math.max(2,contact.radius),prefire:false,
        reason:'Pre-aim the plausible entrance from the reported sound',shots:0};
    }
  }
}
