import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { distance, findLivePath, liveSightline, liveWalkable, LIVE_FPS_MAP } from './fpsLiveMap.ts';
import { LIVE_RUN_SPEED } from './fpsLiveMovement.ts';

export interface LiveRoutePlan {
  path:FpsPoint[];distance:number;seconds:number;exposure:number;
}

export const LIVE_PLANT_RULES=Object.freeze({radius:3.5,seconds:3.2});
export type LivePlantSite='A'|'B';
export function livePlantSite(point:FpsPoint):LivePlantSite|undefined {
  return (['A','B'] as const).find(site=>distance(point,LIVE_FPS_MAP.sites[site])<LIVE_PLANT_RULES.radius);
}

export interface LivePlantPlan {site:LivePlantSite;point:FpsPoint;route:LiveRoutePlan;seconds:number}

/** Plant on reachable ground around site geometry, retaining a valid chosen spot until arrival. */
export function planLivePlant(from:FpsPoint,site:LivePlantSite,beliefs:readonly LiveIntelBelief[]=[],previous?:FpsPoint):LivePlantPlan|undefined {
  const center=LIVE_FPS_MAP.sites[site],radius=LIVE_PLANT_RULES.radius-.4;
  const routeTo=createLiveRoutePlanner(from,beliefs);
  const valid=(point:FpsPoint)=>livePlantSite(point)===site&&liveWalkable(point);
  const committed=valid(from)?from:previous&&valid(previous)?previous:undefined;
  const points=committed?[committed]:[center,{x:center.x-radius,z:center.z},{x:center.x+radius,z:center.z},
    {x:center.x,z:center.z-radius},{x:center.x,z:center.z+radius}].filter(valid);
  const plans=points.map(point=>({site,point:{...point},route:routeTo(point)}))
    .filter(plan=>Number.isFinite(plan.route.seconds));
  plans.sort((a,b)=>(a.route.distance+a.route.exposure*.1)-(b.route.distance+b.route.exposure*.1)
    ||a.point.x-b.point.x||a.point.z-b.point.z);
  const best=plans[0];
  return best?{...best,seconds:best.route.seconds+LIVE_PLANT_RULES.seconds}:undefined;
}

/** A decision-local cache. Inputs are static geometry and this actor's own evidence. */
export function createLiveRoutePlanner(from:FpsPoint,beliefs:readonly LiveIntelBelief[]=[],caution=0) {
  const origin={x:from.x,z:from.z},cache=new Map<string,LiveRoutePlan>();
  const threats=beliefs.filter(b=>b.certainty>.35&&b.radius<16);
  return (destination:FpsPoint):LiveRoutePlan=>{
    const key=`${destination.x},${destination.z}`;
    const cached=cache.get(key);if(cached)return cached;
    const path=findLivePath(origin,destination,caution>0?threats:[],caution);
    let length=0,exposure=0,previous=origin;
    for(const point of path){
      const leg=distance(previous,point),samples=Math.max(1,Math.ceil(leg/2));
      for(let i=0;i<samples;i++){
        const t=(i+.5)/samples,sample={x:previous.x+(point.x-previous.x)*t,z:previous.z+(point.z-previous.z)*t};
        for(const threat of threats)if(distance(sample,threat)<45&&liveSightline(threat,sample))
          exposure+=leg/samples*threat.certainty/(1+threat.radius*.15);
      }
      length+=leg;previous=point;
    }
    if(!path.length)length=Infinity;
    const result={path,distance:length,seconds:length/LIVE_RUN_SPEED,exposure};
    cache.set(key,result);return result;
  };
}

export interface LiveObjectiveCandidate extends FpsPoint {
  id:string;slot:number;kit:boolean;channel:number;
}
export interface LiveObjectiveAssignment {id:string;seconds:number;route:LiveRoutePlan}

/** Elect one reachable recoverer/defuser; a teammate's kit can keep the whole retake viable. */
export function assignLiveObjective(actors:readonly LiveObjectiveCandidate[],target:FpsPoint,remaining=Infinity,defuse=false):LiveObjectiveAssignment|undefined {
  const ranked=actors.map(actor=>{
    const route=createLiveRoutePlanner(actor)(target);
    const inRange=distance(actor,target)<(defuse?1.5:1.2)&&liveSightline(actor,target);
    const channeling=defuse&&actor.channel>0&&inRange;
    const seconds=(inRange?0:route.seconds)+(defuse?Math.max(0,(actor.kit?5:10)-(channeling?actor.channel:0)):0);
    return {actor,route,seconds,channeling};
  }).filter(c=>Number.isFinite(c.seconds)&&c.seconds<=remaining);
  ranked.sort((a,b)=>Number(b.channeling)-Number(a.channeling)||a.seconds-b.seconds||a.actor.slot-b.actor.slot||a.actor.id.localeCompare(b.actor.id));
  const best=ranked[0];return best?{id:best.actor.id,seconds:best.seconds,route:best.route}:undefined;
}

/** Quantize evidence changes so new reports invalidate paths without replanning every tick. */
export function liveRouteEvidenceKey(beliefs:readonly LiveIntelBelief[]):string {
  return beliefs.filter(b=>b.certainty>.35&&b.radius<16).map(b=>
    `${b.key}:${Math.round(b.x/2)},${Math.round(b.z/2)}:${Math.floor(b.certainty*4)}:${Math.floor(b.radius/2)}`
  ).sort().join('|');
}
