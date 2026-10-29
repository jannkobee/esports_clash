import type { LaneStructure } from './types';
import { canDamageStructure } from './structureProtection.ts';
import { getStructureBasicAttackReach } from './basicAttackRangeRules.ts';

type Point={x:number;y:number};
/** Unarmed side barracks need a two-dimensional approach, not a lane-X stop. */
export function chooseBarracksSiegeTarget(actor:Point&{team:'blue'|'red'},structures:readonly LaneStructure[],maxDistance=650){
  return structures.filter(s=>s.team!==actor.team&&s.type==='barracks'&&Math.hypot(s.x-actor.x,s.y-actor.y)<=maxDistance&&canDamageStructure(s,structures))
    .sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y)||a.id.localeCompare(b.id))[0];
}
export function barracksApproachPoint(actor:Point,target:Pick<LaneStructure,'id'|'x'|'y'|'type'|'range'>,attackRange:number){
  const dx=actor.x-target.x,dy=actor.y-target.y,distance=Math.hypot(dx,dy);
  const stop=Math.max(0,getStructureBasicAttackReach(attackRange,target)-8);
  return {id:target.id,x:target.x+(distance?dx/distance:1)*Math.min(stop,distance),
    y:target.y+(distance?dy/distance:0)*Math.min(stop,distance)};
}
export function approachPoint(actor:Point,target:Point,speed:number,dt:number){
  const dx=target.x-actor.x,dy=target.y-actor.y,distance=Math.hypot(dx,dy),step=Math.min(distance,Math.max(0,speed*dt));
  return {x:actor.x+(distance?dx/distance*step:0),y:actor.y+(distance?dy/distance*step:0)};
}
