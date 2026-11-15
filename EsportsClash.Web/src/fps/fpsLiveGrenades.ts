import { LIVE_COLLISION_SOLIDS, LIVE_FPS_MAP, distance } from './fpsLiveMap.ts';
import { segmentHitsWall, type FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTeamId } from './fpsTypes.ts';
import { liveGroundHeight, liveFloorAt, liveCanalArea } from './fpsLiveTerrain.ts';
import {createLiveGeometryIndex} from './fpsStaticGeometry.ts';

const grenadeSolidsAt=createLiveGeometryIndex(LIVE_COLLISION_SOLIDS);

/** Shared gameplay facts consumed by both physics and the local utility planner. */
export const LIVE_UTILITY_RULES=Object.freeze({smokeRadius:4.8,smokeDuration:18,smokeSpread:1.8,fireRadius:4.2,fireDuration:7,incendiaryDuration:5.5,fireSpread:1.25,fireDamagePerSecond:38,flashRadius:13,flashFacingDuration:2.2,flashTurnedDuration:.45,gravity:18});

/** Verified Counter-Strike 2 utility detonation timers and rest thresholds (in seconds). */
export const LIVE_UTILITY_FUSES=Object.freeze({
  flashFuse:1.5,
  heFuse:1.5,
  fireAirFuse:2.0,
  molotovDuration:7.0,
  incendiaryDuration:5.5,
  smokeRestSpeed:.42,
  smokeRestDelay:.12,
  smokeMaxFlight:8.5,
});

export type LiveGrenadeKind='flash'|'smoke'|'incendiary'|'he';
export type LiveThrowStyle='standard'|'underhand'|'medium'|'jump'|'walk-jump'|'run-jump'|'run'|'walk'|'crouch'|'crouch-jump'|'step'|'running-bounce'|'banked'|'overhead';
export interface LiveThrowStylePhysics {
  speed:number;maxLaunchSpeed:number;maxRange:number;forceMultiplier:number;momentumScale:number;
}
/** Physical impulse tiers: standing < walk < run < jump < walk-jump < run-jump. */
export const LIVE_THROW_PHYSICS:Readonly<Record<LiveThrowStyle,LiveThrowStylePhysics>>=Object.freeze({
  underhand:       {speed:11.5,maxLaunchSpeed:14.5,maxRange:11.0,forceMultiplier:.55,momentumScale:.12},
  medium:          {speed:15.5,maxLaunchSpeed:18.8,maxRange:19.0,forceMultiplier:.78,momentumScale:.16},
  crouch:          {speed:17.5,maxLaunchSpeed:20.5,maxRange:21.0,forceMultiplier:.88,momentumScale:.10},
  banked:          {speed:16.5,maxLaunchSpeed:20.0,maxRange:20.0,forceMultiplier:.85,momentumScale:.15},
  standard:        {speed:19.0,maxLaunchSpeed:22.8,maxRange:24.5,forceMultiplier:1.00,momentumScale:.15},
  overhead:        {speed:20.0,maxLaunchSpeed:24.5,maxRange:26.5,forceMultiplier:1.08,momentumScale:.18},
  step:            {speed:20.5,maxLaunchSpeed:25.4,maxRange:28.5,forceMultiplier:1.16,momentumScale:.25},
  walk:            {speed:21.2,maxLaunchSpeed:26.5,maxRange:30.8,forceMultiplier:1.25,momentumScale:.32},
  run:             {speed:22.5,maxLaunchSpeed:27.8,maxRange:33.5,forceMultiplier:1.35,momentumScale:.42},
  'running-bounce':{speed:22.5,maxLaunchSpeed:27.8,maxRange:33.5,forceMultiplier:1.35,momentumScale:.42},
  jump:            {speed:24.2,maxLaunchSpeed:29.8,maxRange:36.2,forceMultiplier:1.48,momentumScale:.36},
  'crouch-jump':   {speed:24.0,maxLaunchSpeed:29.5,maxRange:35.8,forceMultiplier:1.45,momentumScale:.34},
  'walk-jump':     {speed:26.4,maxLaunchSpeed:31.8,maxRange:42.0,forceMultiplier:1.68,momentumScale:.48},
  'run-jump':      {speed:28.0,maxLaunchSpeed:32.0,maxRange:46.0,forceMultiplier:1.82,momentumScale:.56},
});
export function computeLiveThrowForce(throwStyle:LiveThrowStyle='standard',momentum:FpsPoint={x:0,z:0}):number {
  const phys=LIVE_THROW_PHYSICS[throwStyle]??LIVE_THROW_PHYSICS.standard;
  return phys.forceMultiplier+Math.hypot(momentum.x,momentum.z)*phys.momentumScale*.06;
}
export const LIVE_HE_RULES=Object.freeze({damageRadius:8.5,maxDamage:74,wallDamageScale:.32,smokeDisturbance:1.25,shotSmokeDisturbance:.72,smokeClearanceRadius:3.8});
/** Exhibition-only reduced friendly damage. Utility self-damage remains higher
 * than teammate damage so throwing at your own feet is still dangerous. */
export const LIVE_FRIENDLY_FIRE_RULES=Object.freeze({bulletDamageScale:.35,teammateUtilityDamageScale:.35,selfUtilityDamageScale:.5});

export interface LiveGrenade extends FpsPoint {
  id:number;kind:LiveGrenadeKind;actorId:string;team:FpsTeamId;y:number;
  vx:number;vy:number;vz:number;releaseAt:number;detonateAt:number;coordinated:boolean;
  protocolAt?:number;throwStyle?:LiveThrowStyle;
}
export function launchLiveGrenade(id:number,kind:LiveGrenadeKind,actorId:string,team:FpsTeamId,from:FpsPoint,to:FpsPoint,now:number,coordinated=false,throwStyle:LiveThrowStyle='standard',height=1.55,momentum:FpsPoint={x:0,z:0},authoredFlightTime?:number):LiveGrenade {
  const phys=LIVE_THROW_PHYSICS[throwStyle]??LIVE_THROW_PHYSICS.standard;
  const isJump=throwStyle==='jump'||throwStyle==='crouch-jump'||throwStyle==='walk-jump'||throwStyle==='run-jump';
  const floor=liveGroundHeight(from);
  const y=throwStyle==='underhand'?Math.max(floor+.35,height-.45):throwStyle==='medium'?Math.max(floor+.45,height-.22):throwStyle==='crouch'?Math.max(floor+.1,height-.53):isJump?Math.max(height+.35,floor+1.9):height;
  const targetY=liveGroundHeight(to)+(kind==='flash'?(throwStyle==='underhand'?.95:1.6):.12);
  const rawDx=to.x-from.x,rawDz=to.z-from.z,rawDist=Math.hypot(rawDx,rawDz);
  const dropBonus=Math.max(0,(y-targetY)*1.6);
  const momentumBoost=Math.hypot(momentum.x,momentum.z)*phys.momentumScale*1.4;
  const maxReach=phys.maxRange+dropBonus+momentumBoost;
  const reachScale=rawDist>maxReach&&rawDist>1e-5?maxReach/rawDist:1;
  const effTo={x:from.x+rawDx*reachScale,z:from.z+rawDz*reachScale};
  const effDist=rawDist*reachScale;
  // A lineup may choose a verified launch angle/time. It still follows exactly
  // the same ballistic flight, collisions and fuse as every ordinary throw.
  const flight=authoredFlightTime!==undefined&&Number.isFinite(authoredFlightTime)?Math.max(.42,Math.min(3.4,authoredFlightTime))
    :throwStyle==='underhand'?Math.max(.42,Math.min(1.35,effDist/phys.speed+.14))
    :throwStyle==='medium'?Math.max(.55,Math.min(1.75,effDist/phys.speed+.18))
    :throwStyle==='overhead'?Math.max(1.8,Math.min(3.2,effDist/15+.25))
    :isJump?Math.max(1.4,Math.min(3.15,effDist/15.5+.24))
    :Math.max(.65,Math.min(2.45,effDist/phys.speed+.22));
  let vx=(effTo.x-from.x)/flight+momentum.x*phys.momentumScale;
  let vz=(effTo.z-from.z)/flight+momentum.z*phys.momentumScale;
  let vy=(targetY-y+.5*LIVE_UTILITY_RULES.gravity*flight*flight)/flight;
  const totalSpeed=Math.hypot(vx,vy,vz);
  if(totalSpeed>phys.maxLaunchSpeed&&totalSpeed>1e-5){
    const clampScale=phys.maxLaunchSpeed/totalSpeed;
    vx*=clampScale;vy*=clampScale;vz*=clampScale;
  }
  const base:LiveGrenade={id,kind,actorId,team,x:from.x,y,z:from.z,level:from.level,vx,vz,
    vy,releaseAt:now,detonateAt:now+flight,coordinated,throwStyle};
  if(kind==='flash')base.detonateAt=now+LIVE_UTILITY_FUSES.flashFuse;
  else if(kind==='he')base.detonateAt=now+LIVE_UTILITY_FUSES.heFuse;
  else if(kind==='incendiary')base.detonateAt=resolveFireDetonationTime(base);
  else if(kind==='smoke')base.detonateAt=resolveSmokeDetonationTime(base);
  return base;
}

/** Detect downward contact with a walkable floor or horizontal solid top (vertical walls bounce instead). */
export function grenadeHitHorizontalSurface(
  before:Pick<LiveGrenade,'x'|'y'|'z'|'level'|'vy'>,
  after:LiveGrenade,
):boolean {
  if(before.vy>.15)return false;
  const floorY=liveFloorAt(after,before.y)+.09;
  if(after.y<=floorY+.015&&(before.y>floorY+.001||before.vy<-.15||after.vy===0))return true;
  for(const w of grenadeSolidsAt(before,after,.09)){
    const inside=after.x>w.minX-.09&&after.x<w.maxX+.09&&after.z>w.minZ-.09&&after.z<w.maxZ+.09;
    if(inside&&before.y>=w.height+.088&&after.y<=w.height+.105)return true;
  }
  return false;
}

export function isGrenadeOnSupportSurface(grenade:LiveGrenade):boolean {
  const floorY=liveFloorAt(grenade,grenade.y)+.09;
  if(grenade.y<=floorY+.02)return true;
  for(const w of grenadeSolidsAt(grenade,grenade,.09)){
    const inside=grenade.x>w.minX-.09&&grenade.x<w.maxX+.09&&grenade.z>w.minZ-.09&&grenade.z<w.maxZ+.09;
    if(inside&&Math.abs(grenade.y-(w.height+.09))<=.025)return true;
  }
  return false;
}

function resolveFireDetonationTime(grenade:LiveGrenade):number {
  const sim:LiveGrenade={...grenade};
  const step=1/30,maxAt=grenade.releaseAt+LIVE_UTILITY_FUSES.fireAirFuse;
  for(let at=grenade.releaseAt;at<maxAt-1e-8;at+=step){
    const dt=Math.min(step,maxAt-at);
    const before={x:sim.x,y:sim.y,z:sim.z,level:sim.level,vy:sim.vy};
    stepLiveGrenade(sim,dt);
    if(grenadeHitHorizontalSurface(before,sim))return Math.min(maxAt,at+dt);
  }
  return maxAt;
}

function resolveSmokeDetonationTime(grenade:LiveGrenade):number {
  const sim:LiveGrenade={...grenade};
  const step=1/30,maxAt=grenade.releaseAt+LIVE_UTILITY_FUSES.smokeMaxFlight;
  let floorTouches=0,restedFor=0;
  for(let at=grenade.releaseAt;at<maxAt-1e-8;at+=step){
    const dt=Math.min(step,maxAt-at);
    const before={x:sim.x,y:sim.y,z:sim.z,level:sim.level,vy:sim.vy};
    stepLiveGrenade(sim,dt);
    if(grenadeHitHorizontalSurface(before,sim))floorTouches++;
    const hSpeed=Math.hypot(sim.vx,sim.vz);
    if(floorTouches>=1&&isGrenadeOnSupportSurface(sim)&&Math.abs(sim.vy)<=.45&&hSpeed<=LIVE_UTILITY_FUSES.smokeRestSpeed){
      restedFor+=dt;
      if(restedFor>=LIVE_UTILITY_FUSES.smokeRestDelay)return Math.min(maxAt,at+dt);
    }else{
      restedFor=0;
    }
  }
  return maxAt;
}
export function computeLiveThrowAngles(grenade:Pick<LiveGrenade,'vx'|'vy'|'vz'>):{yaw:number;pitch:number} {
  const horiz=Math.hypot(grenade.vx,grenade.vz);
  return {
    yaw:Math.atan2(grenade.vx,grenade.vz),
    pitch:Math.max(-.85,Math.min(1.15,Math.atan2(grenade.vy,Math.max(.001,horiz)))),
  };
}
/** Authoritative ballistic flight with deterministic wall/roof/ground bounces. */
export function stepLiveGrenade(g:LiveGrenade,dt:number):void {
  const before={x:g.x,y:g.y,z:g.z};
  g.x+=g.vx*dt;g.y+=g.vy*dt-.5*LIVE_UTILITY_RULES.gravity*dt*dt;g.z+=g.vz*dt;g.vy-=LIVE_UTILITY_RULES.gravity*dt;
  for(const w of grenadeSolidsAt(before,g,.09)) {
    if(Math.min(before.y,g.y)>w.height+.09 || Math.max(before.y,g.y)<(w.baseY??0)-.09 || !segmentHitsWall(before,g,w,.09))continue;
    const inside=g.x>w.minX-.09&&g.x<w.maxX+.09&&g.z>w.minZ-.09&&g.z<w.maxZ+.09;
    if(before.y>=w.height+.089&&g.y<=w.height+.09&&inside){g.y=w.height+.09;g.vy=Math.abs(g.vy)*.3;g.vx*=.7;g.vz*=.7;}
    else if(w.baseY!==undefined&&before.y<=(w.baseY??0)-.089&&g.y>=(w.baseY??0)-.09&&inside){g.y=(w.baseY??0)-.09;g.vy=-Math.abs(g.vy)*.3;g.vx*=.7;g.vz*=.7;}
    else if(before.y<w.height+.09) {
      if(before.x<=w.minX-.089||before.x>=w.maxX+.089)g.vx*=-.45;else g.vz*=-.45;
      g.x=before.x;g.z=before.z;
    }
  }
  const floor=liveFloorAt(g,g.y)+.09;
  if(g.y<floor){g.y=floor;g.vy=Math.abs(g.vy)*.3;g.vx*=.68;g.vz*=.68;if(g.vy<.8)g.vy=0;}
  g.level=liveCanalArea(g)&&g.y<liveGroundHeight({...g,level:undefined})-.05?'canal':undefined;
}

/** Forecast our own throw against known static geometry, without moving the real grenade. */
export function predictLiveGrenade(grenade:LiveGrenade,now:number):LiveGrenade {
  const predicted={...grenade};
  for(let at=Math.max(now,grenade.releaseAt);at<grenade.detonateAt-1e-8;at+=1/30)stepLiveGrenade(predicted,Math.min(1/30,grenade.detonateAt-at));
  return predicted;
}
export function liveGrenadeSightline(from:FpsPoint&{y:number},to:FpsPoint&{y:number}):boolean {
  return !grenadeSolidsAt(from,to).some(w=>{
    let enter=0,exit=1;
    for(const [origin,delta,min,max] of [[from.x,to.x-from.x,w.minX,w.maxX],[from.z,to.z-from.z,w.minZ,w.maxZ],[from.y,to.y-from.y,w.baseY??0,w.height]]) {
      if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;}
      else {const a=(min-origin)/delta,b=(max-origin)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return false;}
    }
    return enter<=exit;
  });
}
