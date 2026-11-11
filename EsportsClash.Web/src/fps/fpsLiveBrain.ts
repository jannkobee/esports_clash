import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsPrimaryRole } from './fpsIdentity.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { distance } from './fpsLiveMap.ts';

export interface LiveApproach {key:string;point:FpsPoint;purpose:'entry'|'control'|'flank'|'clear'}
export interface LiveApproachContext {
  position:FpsPoint;role:FpsPrimaryRole;remaining:number;judgment:number;
  allies:readonly FpsPoint[];beliefs:readonly LiveIntelBelief[];
  previous?:string;committed:boolean;visited:ReadonlySet<string>;execute:boolean;
}

/** A bounded local planner. No world opponents, secret orders or future outcomes are inputs. */
export function chooseLiveApproach(candidates:readonly LiveApproach[],context:LiveApproachContext,random:()=>number):LiveApproach {
  const available=candidates.filter(c=>!context.visited.has(c.key));
  const unvisited=available.length?available:candidates;
  const urgent=context.remaining<35||context.execute;
  const direct=unvisited.filter(c=>c.purpose==='entry'||c.purpose==='clear');
  const pool=urgent&&direct.length?direct:unvisited;
  if(!pool.length)throw Error('An approach requires a legal candidate');
  const retained=pool.find(c=>c.key===context.previous);
  const dangerAt=(candidate:LiveApproach)=>context.beliefs.reduce((sum,b)=>sum+(distance(b,candidate.point)<b.radius+5?b.certainty:0),0);
  const dangerChanged=retained&&context.beliefs.some(b=>b.age<3&&b.certainty>=.55&&distance(b,retained.point)<b.radius+5)
    &&pool.some(c=>dangerAt(c)+.5<dangerAt(retained));
  if(retained&&context.committed&&!context.execute&&!dangerChanged)return retained;
  const scored=pool.map(candidate=>{
    const detour=candidate.purpose==='control'||candidate.purpose==='flank';
    const roleValue=candidate.purpose==='flank'?(context.role==='lurker'?3:.1)
      :candidate.purpose==='control'?(['caller','sniper','support'].includes(context.role)?1.3:.1)
      :candidate.purpose==='entry'?(['entry','trade'].includes(context.role)?1.8:.8):.4;
    const crowd=context.allies.filter(a=>distance(a,candidate.point)<5).length;
    const danger=dangerAt(candidate);
    const urgency=detour?(context.remaining<35?6:context.execute?4:0):0;
    return {candidate,score:roleValue-distance(context.position,candidate.point)*.12-crowd*1.5
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

export interface LiveSmokeVolume extends FpsPoint {y:number;radius:number;expires:number}
/** Smoke blocks sight, not bullets, movement, or sound. Heights follow the actual ray. */
export function liveSmokeOccludes(from:FpsPoint,to:FpsPoint,fromY:number,toY:number,smoke:LiveSmokeVolume):boolean {
  const dx=to.x-from.x,dz=to.z-from.z,dy=toY-fromY;
  const t=Math.max(0,Math.min(1,((smoke.x-from.x)*dx+(smoke.z-from.z)*dz+(smoke.y-fromY)*dy)/(dx*dx+dz*dz+dy*dy||1)));
  return Math.hypot(from.x+t*dx-smoke.x,from.z+t*dz-smoke.z,fromY+t*dy-smoke.y)<smoke.radius;
}

/** Move briefly, then leave enough braking/aim time to shoot. A strafe is not a permanent state. */
export function liveCombatStrafe(now:number,moveUntil:number,settleUntil:number,canStrafe:boolean):'start'|'move'|'settle' {
  if(!canStrafe)return 'settle';
  if(now<moveUntil)return 'move';
  return now>=settleUntil?'start':'settle';
}
