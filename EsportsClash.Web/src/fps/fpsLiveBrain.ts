import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsPrimaryRole } from './fpsIdentity.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { distance } from './fpsLiveMap.ts';
import type { LiveRoutePlan } from './fpsLivePlanning.ts';
import { LIVE_PLANT_RULES } from './fpsLivePlanning.ts';

export interface LivePlantThreat extends FpsPoint {blinded:number;reload:number;lastShot:number}
/** React to immediate personal threats without abandoning a protected plant for every distant sighting. */
export function shouldCommitLivePlant(position:FpsPoint,threats:readonly LivePlantThreat[],now:number,remaining:number,channel:number,sinceDamage:number,supported:boolean,concealed:boolean):boolean {
  if(sinceDamage<.65)return false;
  const dangerous=threats.filter(t=>t.blinded<.2&&t.reload<=0);
  const finishing=channel>0&&remaining<LIVE_PLANT_RULES.seconds-channel+1;
  if(dangerous.some(t=>distance(position,t)<8))return finishing;
  if(dangerous.some(t=>distance(position,t)<18||now-t.lastShot<.8&&distance(position,t)<26))
    return supported||concealed||finishing;
  return true;
}

export interface LiveApproach {key:string;point:FpsPoint;purpose:'entry'|'control'|'flank'|'clear'}
export interface LiveApproachContext {
  position:FpsPoint;role:FpsPrimaryRole;remaining:number;judgment:number;
  allies:readonly FpsPoint[];beliefs:readonly LiveIntelBelief[];
  previous?:string;committed:boolean;visited:ReadonlySet<string>;execute:boolean;
  routeTo?:(point:FpsPoint)=>LiveRoutePlan;alliedGoals?:readonly FpsPoint[];
}

/** A bounded local planner. No world opponents, secret orders or future outcomes are inputs. */
export function chooseLiveApproach(candidates:readonly LiveApproach[],context:LiveApproachContext,random:()=>number):LiveApproach|undefined {
  const legal=candidates.filter(c=>!context.routeTo||Number.isFinite(context.routeTo(c.point).distance));
  const available=legal.filter(c=>!context.visited.has(c.key));
  const unvisited=available.length?available:legal;
  const urgent=context.remaining<35||context.execute;
  const direct=unvisited.filter(c=>c.purpose==='entry'||c.purpose==='clear');
  const choices=urgent&&direct.length?direct:unvisited;
  const feasible=choices.filter(c=>!context.routeTo||context.routeTo(c.point).seconds+5<context.remaining);
  const pool=feasible.length?feasible:choices;
  if(!pool.length)return undefined;
  const retained=pool.find(c=>c.key===context.previous);
  const dangerAt=(candidate:LiveApproach)=>context.beliefs.reduce((sum,b)=>sum+(distance(b,candidate.point)<b.radius+5?b.certainty:0),0)
    +(context.routeTo?.(candidate.point).exposure??0)*.06;
  const dangerChanged=retained&&context.beliefs.some(b=>b.age<3&&b.certainty>=.55)
    &&pool.some(c=>dangerAt(c)+.5<dangerAt(retained));
  if(retained&&context.committed&&!dangerChanged)return retained;
  const scored=pool.map(candidate=>{
    const detour=candidate.purpose==='control'||candidate.purpose==='flank';
    const roleValue=candidate.purpose==='flank'?(context.role==='lurker'?3:.1)
      :candidate.purpose==='control'?(['caller','sniper','support'].includes(context.role)?1.3:.1)
      :candidate.purpose==='entry'?(['entry','trade'].includes(context.role)?1.8:.8):.4;
    const crowd=context.allies.filter(a=>distance(a,candidate.point)<5).length;
    const reservations=context.alliedGoals?.filter(a=>distance(a,candidate.point)<5).length??0;
    const danger=dangerAt(candidate);
    const urgency=detour?(context.remaining<35?6:context.execute?4:0):0;
    return {candidate,score:roleValue-(context.routeTo?.(candidate.point).distance??distance(context.position,candidate.point))*.12-crowd*1.5-reservations*.8
      -danger*(.5+context.judgment)-urgency+(candidate.key===context.previous?.4:0)};
  });
  scored.sort((a,b)=>b.score-a.score||a.candidate.key.localeCompare(b.candidate.key));
  // Variety breaks close calls; it cannot make a clearly inferior route win.
  const plausible=scored.filter(c=>c.score>=scored[0].score-(.15+(1-context.judgment)*.35));
  return plausible[Math.min(plausible.length-1,Math.floor(random()*plausible.length))].candidate;
}

export function canInvestigateLiveContact(from:FpsPoint,belief:LiveIntelBelief|undefined,remaining:number,lurker=false):boolean {
  if(!belief||belief.age>4||belief.certainty<.4||belief.radius>8)return false;
  const travel=distance(from,belief);
  return travel<=(lurker?18:12)&&remaining>travel/1.65+20;
}

export function shouldFakeLiveDefuse(remaining:number,kit:boolean,covered:boolean,beliefs:readonly LiveIntelBelief[],position:FpsPoint):boolean {
  return !covered&&remaining>(kit?5:10)+2.5+3
    &&beliefs.some(b=>b.age<3&&b.certainty>=.45&&distance(position,b)<20);
}

export interface LiveSmokeVolume extends FpsPoint {id?:number;y:number;radius:number;expires:number;startedAt?:number;disturbance?:number}
export interface LiveSmokeCloudLobe {x:number;y:number;z:number;scaleX:number;scaleY:number;scaleZ:number}
/** The viewer renders these exact ellipsoids; AI sight tests the same animated volume. */
export function liveSmokeCloudLobes(smoke:LiveSmokeVolume,now:number):LiveSmokeCloudLobe[] {
  const result:LiveSmokeCloudLobe[]=[];
  for(let i=0;i<15;i++){
    const phase=((smoke.id??0)*2.399+i*4.17)%(Math.PI*2),angle=phase+now*.045;
    const spread=i===0?0:.17+(i%4)*.055,wobble=Math.sin(now*.48+phase);
    const width=smoke.radius*(i===0?.62:.45+(i%3)*.035);
    result.push({
      x:Math.cos(angle)*smoke.radius*spread+Math.sin(now*.37+phase)*smoke.radius*.025,
      y:smoke.radius*(.015+(i%4)*.055)+wobble*smoke.radius*.025,
      z:Math.sin(angle)*smoke.radius*spread+Math.cos(now*.31+phase)*smoke.radius*.025,
      scaleX:width,scaleY:width*(.7+(i%3)*.07),scaleZ:width,
    });
  }
  return result;
}
function segmentHitsSmokeLobe(from:FpsPoint,to:FpsPoint,fromY:number,toY:number,smoke:LiveSmokeVolume,lobe:LiveSmokeCloudLobe):boolean {
  const rx=Math.max(.001,lobe.scaleX*.5),ry=Math.max(.001,lobe.scaleY*.5),rz=Math.max(.001,lobe.scaleZ*.5);
  const ox=(from.x-smoke.x-lobe.x)/rx,oy=(fromY-smoke.y-lobe.y)/ry,oz=(from.z-smoke.z-lobe.z)/rz;
  const dx=(to.x-from.x)/rx,dy=(toY-fromY)/ry,dz=(to.z-from.z)/rz;
  const a=dx*dx+dy*dy+dz*dz,c=ox*ox+oy*oy+oz*oz-1;
  if(a<1e-12)return c<=0;
  const b=2*(ox*dx+oy*dy+oz*dz),discriminant=b*b-4*a*c;
  if(discriminant<0)return false;
  const root=Math.sqrt(discriminant),entry=(-b-root)/(2*a),exit=(-b+root)/(2*a);
  return exit>=0&&entry<=1;
}
/** Smoke blocks only the visible cloud volume; it does not block bullets, movement, or sound. */
export function liveSmokeOccludes(from:FpsPoint,to:FpsPoint,fromY:number,toY:number,smoke:LiveSmokeVolume,now=smoke.startedAt??0):boolean {
  if(smoke.expires<=now||smoke.radius<=.02)return false;
  return liveSmokeCloudLobes(smoke,now).some(lobe=>segmentHitsSmokeLobe(from,to,fromY,toY,smoke,lobe));
}

/** Move briefly, then leave enough braking/aim time to shoot. A strafe is not a permanent state. */
export function liveCombatStrafe(now:number,moveUntil:number,settleUntil:number,canStrafe:boolean):'start'|'move'|'settle' {
  if(!canStrafe)return 'settle';
  if(now<moveUntil)return 'move';
  return now>=settleUntil?'start':'settle';
}
