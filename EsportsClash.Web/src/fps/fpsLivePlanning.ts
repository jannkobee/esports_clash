import {LIVE_C4_RULES} from './fpsLiveBomb.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { distance, FONTESSA_MAP_RUNTIME, LIVE_FPS_MAP, LIVE_TACTICAL } from './fpsLiveMap.ts';
import type { LiveMapRuntime } from './fpsLiveMapTypes.ts';
import { LIVE_RUN_SPEED } from './fpsLiveMovement.ts';

export interface LiveRoutePlan {
  path:FpsPoint[];distance:number;seconds:number;exposure:number;
}

export const LIVE_PLANT_RULES=Object.freeze({radius:3.5,seconds:3.2});
export type LivePlantSite='A'|'B';
export function livePlantSite(point:FpsPoint,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LivePlantSite|undefined {
  return (['A','B'] as const).find(site=>distance(point,runtime.definition.sites[site])<(runtime.definition.siteRadii?.[site]??LIVE_PLANT_RULES.radius));
}

export interface LivePlantPlan {site:LivePlantSite;point:FpsPoint;route:LiveRoutePlan;seconds:number;style:string}
const plantChoices={
 A:[{x:-23,z:18.1,style:'for main'},{x:-20.1,z:21,style:'for middle'},{x:-23,z:23.9,style:'for guard street'},{x:-24.8,z:20,style:'safe civic cover'}],
 B:[{x:23,z:18.1,style:'for main'},{x:20.1,z:21,style:'for catwalk'},{x:23,z:23.9,style:'for guard street'},{x:25.9,z:21,style:'for gallery'}]
};
/** Choose an actual open plant and its defensible direction using only personal evidence. */
export function planLivePlant(from:FpsPoint,site:LivePlantSite,beliefs:readonly LiveIntelBelief[]=[],previous?:FpsPoint,coverage:readonly FpsPoint[]=[],runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LivePlantPlan|undefined {
 const siteChoices=runtime.definition.tactical[site].plantChoices.length?runtime.definition.tactical[site].plantChoices:plantChoices[site];
 const routeTo=createLiveRoutePlanner(from,beliefs,0,undefined,runtime),valid=(p:FpsPoint)=>livePlantSite(p,runtime)===site&&runtime.walkable(p);
 const saved=previous&&valid(previous)?siteChoices.find(p=>distance(p,previous)<.2):undefined;
 const choices=saved?[saved]:siteChoices.filter(valid);
 const plans=choices.map(point=>({site,point:{x:point.x,z:point.z},style:point.style,route:routeTo(point)})).filter(p=>Number.isFinite(p.route.seconds));
 const openPreferred=coverage.length>=2&&!beliefs.some(b=>b.age<3.5&&b.certainty>.65&&distance(b,runtime.definition.sites[site])<18);
 const score=(p:typeof plans[number])=>{
  const alliesCovering=coverage.filter(a=>distance(a,p.point)<22&&runtime.sightline(a,p.point)).length;
  const exposedScore=beliefs.reduce((sum,b)=>sum+(b.age<6&&runtime.sightline(b,p.point)?b.certainty*11:0),0);
  const isOpenSpot=p.style.includes('main')||p.style.includes('middle')||p.style.includes('catwalk');
  const styleBias=openPreferred?(isOpenSpot?-1.6:1.1):(isOpenSpot?2.4:-1.8);
  return p.route.distance*.65+p.route.exposure*.28-alliesCovering*1.7+exposedScore+styleBias;
 };
 plans.sort((a,b)=>score(a)-score(b)||a.style.localeCompare(b.style));
 const best=plans[0];return best?{...best,seconds:best.route.seconds+LIVE_PLANT_RULES.seconds}:undefined;
}
export function planLivePostPlant(from:FpsPoint,site:LivePlantSite,bomb:FpsPoint,slot:number,beliefs:readonly LiveIntelBelief[],occupied:readonly FpsPoint[],quality:number,cheeky=false,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):{point:FpsPoint;watch:FpsPoint;reason:string} {
 const entrances=runtime.definition.tactical[site].retakeEntrances;
 const evidence=beliefs.filter(b=>b.age<8&&b.certainty>.4);
 const pressure=entrances.map((p,i)=>({p,i,w:evidence.reduce((n,b)=>n+b.certainty*Math.max(0,1-distance(b,p)/24),0)})).sort((a,b)=>b.w-a.w||a.i-b.i);
 // Every lane has a cover player before extra players reinforce the evidence-led lane.
 let watch=slot<3&&entrances.length?entrances[(pressure[0].i+slot)%entrances.length]:(pressure[0]?.p??runtime.definition.sites[site]);
 const extras=runtime.definition.tactical[site].postPlantCheeky;
 const candidates=[...runtime.definition.tactical[site].postPlant,...(cheeky?extras:[]),from].map(p=>runtime.safePoint(p));
 const route=createLiveRoutePlanner(from,beliefs,0,undefined,runtime);
 const bombWatched=occupied.some(a=>distance(a,bomb)<24&&runtime.sightline(a,bomb));
 const scored=candidates.filter(p=>Number.isFinite(route(p).seconds)&&route(p).seconds<12&&runtime.sightline(p,watch,runtime.terrain.groundHeight(p)+1.55,runtime.terrain.groundHeight(watch)+1.55)&&distance(p,bomb)<24).map(point=>{
  const spacing=occupied.reduce((n,a)=>n+Math.max(0,3-distance(a,point))*12,0);
  // Prefer crossfire separation over stacking parallel angles with an occupying teammate.
  const crossfireBonus=occupied.reduce((best,a)=>{
   const d=distance(a,point);if(d<3.5||d>26)return best;
   const ax=watch.x-a.x,az=watch.z-a.z,px=watch.x-point.x,pz=watch.z-point.z;
   const denom=Math.hypot(ax,az)*Math.hypot(px,pz);if(denom<.1)return best;
   const cos=(ax*px+az*pz)/denom;
   return Math.max(best,cos<.78?1-Math.abs(cos+.1)*.5:0);
  },0);
  const exposed=evidence.reduce((n,b)=>n+(runtime.sightline(b,point)?b.certainty:0),0);
  const bombPenalty=runtime.sightline(point,bomb)?0:(bombWatched?2.2:5);
  return {point,score:route(point).seconds*.7+spacing+exposed*quality*9+bombPenalty-crossfireBonus*2.6*quality-Math.min(15,distance(point,watch))*.12};
 }).sort((a,b)=>a.score-b.score);
 let point=scored[0]?.point;
 if(!point){const alternate=candidates.flatMap(p=>entrances.filter(e=>runtime.sightline(p,e)&&Number.isFinite(route(p).seconds)).map(e=>({p,e,cost:route(p).seconds+occupied.filter(a=>distance(a,p)<2.5).length*6}))).sort((a,b)=>a.cost-b.cost)[0];if(alternate){point=alternate.p;watch=alternate.e;}}
 point??=runtime.safePoint(runtime.definition.tactical[site].postPlant[slot%runtime.definition.tactical[site].postPlant.length]);
 const personal=evidence.find(b=>runtime.sightline(point,b)&&distance(point,b)<30);
 return {point,watch:personal?{x:personal.x,z:personal.z,level:personal.level}:watch,reason:personal?'Cover the reported retake approach from a separated crossfire':`Cover ${slot<3?'a separate retake lane':'the likely retake lane'}; ${runtime.sightline(point,bomb)?'keep the device visible':'trade the device peek'}`};
}

/** A decision-local cache. Inputs are static geometry and this actor's own evidence. */
export function createLiveRoutePlanner(from:FpsPoint,beliefs:readonly LiveIntelBelief[]=[],caution=0,heatAt?:(point:FpsPoint)=>number,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME) {
  const origin:FpsPoint={x:from.x,z:from.z,level:from.level},cache=new Map<string,LiveRoutePlan>();
  const threats=beliefs.filter(b=>b.certainty>.35&&b.radius<16);
  return (destination:FpsPoint):LiveRoutePlan=>{
    const key=`${destination.x},${destination.z},${destination.level??'street'}`;
    const cached=cache.get(key);if(cached)return cached;
    const path=runtime.findPath(origin,destination,caution>0?threats:[],caution,heatAt);
    let length=0,exposure=0,previous=origin;
    for(const point of path){
      const leg=distance(previous,point),samples=Math.max(1,Math.ceil(leg/2));
      for(let i=0;i<samples;i++){
        const t=(i+.5)/samples,sample={x:previous.x+(point.x-previous.x)*t,z:previous.z+(point.z-previous.z)*t,level:point.level};
        for(const threat of threats)if(distance(sample,threat)<45&&runtime.sightline(threat,sample))
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
export function assignLiveObjective(actors:readonly LiveObjectiveCandidate[],target:FpsPoint,remaining=Infinity,defuse=false,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LiveObjectiveAssignment|undefined {
  const ranked=actors.map(actor=>{
    const route=createLiveRoutePlanner(actor,undefined,0,undefined,runtime)(target);
    const inRange=distance(actor,target)<(defuse?1.5:1.2)&&runtime.sightline(actor,target);
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
    `${b.key}:${Math.round(b.x/2)},${Math.round(b.z/2)},${b.level??'street'}:${Math.floor(b.certainty*4)}:${Math.floor(b.radius/2)}`
  ).sort().join('|');
}

/** Reach guaranteed blast clearance using known map geometry, never enemy positions. */
export function planLiveBombEscape(from:FpsPoint,bomb:FpsPoint,slot=0,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LiveRoutePlan&{point:FpsPoint}|undefined {
 if(distance(from,bomb)>=LIVE_C4_RULES.safeDistance)return {point:{...from},path:[],distance:0,seconds:0,exposure:0};
 const baseEscapes:FpsPoint[]=runtime.id==='fontessa'
  ?[{x:-32,z:40},{x:-14,z:40},{x:18,z:40},{x:32,z:40},{x:-32,z:-12},{x:32,z:-12},{x:0,z:-21}]
  :[runtime.definition.spawns.attackers,runtime.definition.spawns.defenders,runtime.definition.tactical.mid.approach,runtime.definition.tactical.mid.control,...runtime.definition.tactical.A.staging,...runtime.definition.tactical.B.staging];
 const candidates=[...baseEscapes,
  ...Array.from({length:12},(_,i)=>({x:bomb.x+Math.sin(i*Math.PI/6)*18.5,z:bomb.z+Math.cos(i*Math.PI/6)*18.5}))]
  .map(p=>runtime.safePoint(p)).filter((p,i,all)=>distance(p,bomb)>=LIVE_C4_RULES.safeDistance&&distance(p,from)<(runtime.id==='fontessa'?45:65)&&all.findIndex(q=>distance(p,q)<.2)===i)
  .sort((a,b)=>distance(from,a)-distance(from,b));
 const route=createLiveRoutePlanner(from,undefined,0,undefined,runtime),plans=candidates.slice(0,6).map(point=>({point,...route(point)})).filter(p=>Number.isFinite(p.seconds));
 plans.sort((a,b)=>(a.seconds+.12*a.path.length)-(b.seconds+.12*b.path.length)||distance(a.point,{x:from.x+(slot%2?1:-1),z:from.z})-distance(b.point,{x:from.x+(slot%2?1:-1),z:from.z}));
 const best=plans[0];return best?{...best,seconds:best.seconds+.6+best.path.length*.1}:undefined;
}
