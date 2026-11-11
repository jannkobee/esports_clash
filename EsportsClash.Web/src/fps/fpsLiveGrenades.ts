import { LIVE_FPS_MAP, distance } from './fpsLiveMap.ts';
import { segmentHitsWall, type FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTeamId } from './types.ts';

/** Shared gameplay facts consumed by both physics and the local utility planner. */
export const LIVE_UTILITY_RULES=Object.freeze({smokeRadius:4.8,smokeDuration:18,smokeSpread:1.8,fireRadius:4.2,fireDuration:7,fireSpread:1.25,fireDamagePerSecond:38,flashRadius:13,flashFacingDuration:2.2,flashTurnedDuration:.45,gravity:18});

export interface LiveGrenade extends FpsPoint {
  id:number;kind:'flash'|'smoke'|'incendiary';actorId:string;team:FpsTeamId;y:number;
  vx:number;vy:number;vz:number;releaseAt:number;detonateAt:number;coordinated:boolean;
  protocolAt?:number;
}
export function launchLiveGrenade(id:number,kind:'flash'|'smoke'|'incendiary',actorId:string,team:FpsTeamId,from:FpsPoint,to:FpsPoint,now:number,coordinated=false):LiveGrenade {
  const flight=Math.max(.85,Math.min(2.1,distance(from,to)/19+.25));
  const y=1.55,targetY=kind==='flash'?1.6:.12;
  return {id,kind,actorId,team,x:from.x,y,z:from.z,vx:(to.x-from.x)/flight,vz:(to.z-from.z)/flight,
    vy:(targetY-y+.5*LIVE_UTILITY_RULES.gravity*flight*flight)/flight,releaseAt:now,detonateAt:now+flight,coordinated};
}
/** Authoritative ballistic flight with deterministic wall/roof/ground bounces. */
export function stepLiveGrenade(g:LiveGrenade,dt:number):void {
  const before={x:g.x,y:g.y,z:g.z};
  g.x+=g.vx*dt;g.y+=g.vy*dt-.5*LIVE_UTILITY_RULES.gravity*dt*dt;g.z+=g.vz*dt;g.vy-=LIVE_UTILITY_RULES.gravity*dt;
  for(const w of LIVE_FPS_MAP.solids) {
    if(Math.min(before.y,g.y)>w.height+.09 || Math.max(before.y,g.y)<0 || !segmentHitsWall(before,g,w,.09))continue;
    const inside=g.x>w.minX-.09&&g.x<w.maxX+.09&&g.z>w.minZ-.09&&g.z<w.maxZ+.09;
    if(before.y>=w.height+.089&&g.y<=w.height+.09&&inside){g.y=w.height+.09;g.vy=Math.abs(g.vy)*.3;g.vx*=.7;g.vz*=.7;}
    else if(before.y<w.height+.09) {
      if(before.x<=w.minX-.089||before.x>=w.maxX+.089)g.vx*=-.45;else g.vz*=-.45;
      g.x=before.x;g.z=before.z;
    }
  }
  if(g.y<.09){g.y=.09;g.vy=Math.abs(g.vy)*.3;g.vx*=.68;g.vz*=.68;if(g.vy<.8)g.vy=0;}
}

/** Forecast our own throw against known static geometry, without moving the real grenade. */
export function predictLiveGrenade(grenade:LiveGrenade,now:number):LiveGrenade {
  const predicted={...grenade};
  for(let at=Math.max(now,grenade.releaseAt);at<grenade.detonateAt-1e-8;at+=1/30)stepLiveGrenade(predicted,Math.min(1/30,grenade.detonateAt-at));
  return predicted;
}
export function liveGrenadeSightline(from:FpsPoint&{y:number},to:FpsPoint&{y:number}):boolean {
  return !LIVE_FPS_MAP.solids.some(w=>{
    let enter=0,exit=1;
    for(const [origin,delta,min,max] of [[from.x,to.x-from.x,w.minX,w.maxX],[from.z,to.z-from.z,w.minZ,w.maxZ],[from.y,to.y-from.y,0,w.height]]) {
      if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;}
      else {const a=(min-origin)/delta,b=(max-origin)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return false;}
    }
    return enter<=exit;
  });
}
