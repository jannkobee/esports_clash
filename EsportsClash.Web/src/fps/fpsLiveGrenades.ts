import { LIVE_FPS_MAP, distance } from './fpsLiveMap.ts';
import { segmentHitsWall, type FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTeamId } from './types.ts';

/** Shared gameplay facts consumed by both physics and the local utility planner. */
export const LIVE_UTILITY_RULES=Object.freeze({smokeRadius:4.8,smokeDuration:18,smokeSpread:1.8,fireRadius:4.2,fireDuration:7,fireSpread:1.25,fireDamagePerSecond:38,flashRadius:13,flashFacingDuration:2.2,flashTurnedDuration:.45,gravity:18});

export type LiveGrenadeKind='flash'|'smoke'|'incendiary'|'he';
export type LiveThrowStyle='standard'|'underhand'|'medium'|'jump'|'run'|'walk'|'crouch'|'crouch-jump'|'step'|'running-bounce'|'banked'|'overhead';
export const LIVE_HE_RULES=Object.freeze({damageRadius:8.5,maxDamage:74,wallDamageScale:.32,smokeDisturbance:1.25,shotSmokeDisturbance:.72,smokeClearanceRadius:3.8});
/** Exhibition-only reduced friendly damage. Utility self-damage remains higher
 * than teammate damage so throwing at your own feet is still dangerous. */
export const LIVE_FRIENDLY_FIRE_RULES=Object.freeze({bulletDamageScale:.35,teammateUtilityDamageScale:.35,selfUtilityDamageScale:.5});

export interface LiveGrenade extends FpsPoint {
  id:number;kind:LiveGrenadeKind;actorId:string;team:FpsTeamId;y:number;
  vx:number;vy:number;vz:number;releaseAt:number;detonateAt:number;coordinated:boolean;
  protocolAt?:number;throwStyle?:LiveThrowStyle;
}
export function launchLiveGrenade(id:number,kind:LiveGrenadeKind,actorId:string,team:FpsTeamId,from:FpsPoint,to:FpsPoint,now:number,coordinated=false,throwStyle:LiveThrowStyle='standard',height=1.55,momentum:FpsPoint={x:0,z:0}):LiveGrenade {
  const speed=throwStyle==='underhand'?13.5:throwStyle==='medium'?16.5:throwStyle==='run'||throwStyle==='running-bounce'?21:throwStyle==='jump'||throwStyle==='crouch-jump'?20:throwStyle==='walk'?17.5:throwStyle==='crouch'?18:throwStyle==='step'?18.5:throwStyle==='banked'?16:throwStyle==='overhead'?20:19;
  const flight=Math.max(.65,Math.min(2.25,distance(from,to)/speed+.22));
  const y=throwStyle==='crouch'?Math.min(height,1.02):throwStyle==='jump'||throwStyle==='crouch-jump'?Math.max(height,1.9):height;
  const targetY=throwStyle==='overhead'?2.25:kind==='flash'?1.6:.12;
  const momentumScale=throwStyle==='run'||throwStyle==='running-bounce'?.22:throwStyle==='banked'?.12:0;
  const vx=(to.x-from.x)/flight+momentum.x*momentumScale,vz=(to.z-from.z)/flight+momentum.z*momentumScale;
  return {id,kind,actorId,team,x:from.x,y,z:from.z,vx,vz,
    vy:(targetY-y+.5*LIVE_UTILITY_RULES.gravity*flight*flight)/flight,releaseAt:now,detonateAt:now+flight,coordinated,throwStyle};
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
