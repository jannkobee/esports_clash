/** Voltaire retains his storm-mage identity; these values drive execution and text. */
export const VOLTAIRE = Object.freeze({remnantArm:.3,remnantLifetime:4,triggerRadius:65,blastRadius:80,
 overloadLifetime:6,overloadDamage:60,overloadRadius:65,slowDuration:.75,slowAmount:.2,
 ballRange:320,ballSpeed:540,ballDuration:.75,ballContactRadius:28,ballArrivalRadius:55});
export type StaticRemnant={elapsed:number;resolved:boolean};
type Enemy={id:string;x:number;y:number;isAlive:boolean;zhonyaActive?:boolean;untargetableTimer?:number};
/** Advance once on simulation time; a trap never hits before arming or twice. */
export function advanceStaticRemnant(state:StaticRemnant,origin:{x:number;y:number},dt:number,enemies:readonly Enemy[]){
 if(state.resolved)return [];
 state.elapsed+=Math.max(0,dt);
 if(state.elapsed>=VOLTAIRE.remnantLifetime){state.resolved=true;return [];}
 if(state.elapsed+1e-9<VOLTAIRE.remnantArm)return [];
 const eligible=enemies.filter(e=>e.isAlive&&!e.zhonyaActive&&!(e.untargetableTimer!>0));
 if(!eligible.some(e=>Math.hypot(e.x-origin.x,e.y-origin.y)<=VOLTAIRE.triggerRadius))return [];
 state.resolved=true;
 return eligible.filter(e=>Math.hypot(e.x-origin.x,e.y-origin.y)<=VOLTAIRE.blastRadius).map(e=>e.id);
}
export function voltaireOverloadReady(unit:{voltaireOverloadTimer?:number}){return (unit.voltaireOverloadTimer??0)>0;}
/** The primary avatar/minion shot spends one charge at release, even if later blocked. */
export function consumeVoltaireOverload(unit:{voltaireOverloadTimer?:number},targetType:string){
 if(!voltaireOverloadReady(unit)||(targetType!=='champion'&&targetType!=='minion'))return false;
 unit.voltaireOverloadTimer=0;return true;
}
/** All eligible contacts count, including overlapping targets; arrival cannot hit them twice. */
export function collectVoltaireBallHits(state:{hitIds?:string[]},origin:{x:number;y:number},enemies:readonly Enemy[],arrival=false){
 const radius=arrival?VOLTAIRE.ballArrivalRadius:VOLTAIRE.ballContactRadius;
 const hits=enemies.filter(e=>e.isAlive&&!e.zhonyaActive&&!(e.untargetableTimer!>0)
  &&!(state.hitIds??[]).includes(e.id)&&Math.hypot(e.x-origin.x,e.y-origin.y)<=radius).map(e=>e.id);
 if(hits.length)(state.hitIds??=[]).push(...hits);return hits;
}
