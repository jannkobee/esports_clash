import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsPrimaryRole } from './fpsIdentity.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { distance, FONTESSA_MAP_RUNTIME } from './fpsLiveMap.ts';
import type { LiveMapRuntime } from './fpsLiveMapTypes.ts';
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
  behavior?:import('./fpsPlayerArchitecture.ts').FpsBehaviorPreferences;decision?:string;
  tendencies?:import('./fpsPlayerTendencies.ts').FpsTendencyValues;
  position:FpsPoint;role:FpsPrimaryRole;remaining:number;judgment:number;
  allies:readonly FpsPoint[];beliefs:readonly LiveIntelBelief[];
  previous?:string;committed:boolean;visited:ReadonlySet<string>;execute:boolean;
  routeTo?:(point:FpsPoint)=>LiveRoutePlan;alliedGoals?:readonly FpsPoint[];
  objective?:FpsPoint;health?:number;entrySkill?:number;utilitySkill?:number;
  firepower?:number;preferredRange?:number;
  phase?:'regroup'|'breach'|'retake';
  heatAt?:(point:FpsPoint)=>number;
  uncertaintyAt?:(point:FpsPoint)=>number;
  entryAheadDist?:number;
  sniperPriority?:number;
}

/** Map affordances, not a sequence: each actor evaluates the reachable options. */
export function liveAssaultApproaches(site:'A'|'B',from:FpsPoint,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LiveApproach[] {
  const positions=runtime.definition.tactical[site];
  const extras=runtime.definition.tactical.assaultExtras(site,from).map(c=>({key:c.key,point:c.point,purpose:c.purpose}));
  return [
    ...positions.entries.map((point,i)=>({key:`${site}:entry:${i}`,point,purpose:'entry' as const})).filter(c=>c.point.z>=from.z+2),
    ...positions.holds.map((point,i)=>({key:`${site}:clear:${i}`,point,purpose:'clear' as const})),
    ...extras,
  ];
}

export function liveRetakeApproaches(site:'A'|'B',bomb:FpsPoint,runtime:LiveMapRuntime=FONTESSA_MAP_RUNTIME):LiveApproach[] {
  const positions=runtime.definition.tactical[site];
  const points=[...positions.holds,...positions.postPlant,
    ...positions.retakeExtras,
    ...Array.from({length:6},(_,i)=>({x:bomb.x+Math.sin(i*Math.PI/3)*7,z:bomb.z+Math.cos(i*Math.PI/3)*7,level:bomb.level}))];
  return points.filter((p,i)=>runtime.walkable(p)&&distance(p,bomb)>3&&distance(p,bomb)<19
    &&points.findIndex(q=>distance(p,q)<.5)===i
    &&runtime.sightline(p,bomb,runtime.terrain.groundHeight(p)+1.55,runtime.terrain.groundHeight(bomb)+.5))
    .map((point,i)=>({key:`retake:${site}:${i}`,point,purpose:'clear'}));
}

/** A bounded local planner. No world opponents, secret orders or future outcomes are inputs. */
export function chooseLiveApproach(candidates:readonly LiveApproach[],context:LiveApproachContext,random:()=>number):LiveApproach|undefined {
  // A committed quiet route needs only its own reachability checked. Do not
  // construct every alternative again until there is a reason to reassess.
  const previous=context.committed?candidates.find(c=>c.key===context.previous&&!context.visited.has(c.key)):undefined;
  if(previous&&!context.beliefs.some(b=>b.age<3&&b.certainty>=.55)){
    const urgent=context.remaining<=20&&!context.objective,allowed=!urgent||previous.purpose==='entry'||previous.purpose==='clear';
    const route=context.routeTo?.(previous.point);
    if(allowed&&(!route||Number.isFinite(route.distance)&&route.seconds+(context.phase==='retake'?0:5)<context.remaining))return previous;
  }
  const legal=candidates.filter(c=>!context.routeTo||Number.isFinite(context.routeTo(c.point).distance));
  const available=legal.filter(c=>!context.visited.has(c.key));
  const unvisited=available.length?available:legal;
  const urgent=context.remaining<=20&&!context.objective;
  const direct=unvisited.filter(c=>c.purpose==='entry'||c.purpose==='clear');
  const choices=urgent&&direct.length?direct:unvisited;
  const feasible=choices.filter(c=>!context.routeTo||context.routeTo(c.point).seconds+(context.phase==='retake'?0:5)<context.remaining);
  const pool=feasible.length?feasible:context.phase==='retake'?[...choices].sort((a,b)=>(context.routeTo?.(a.point).seconds??distance(context.position,a.point))-(context.routeTo?.(b.point).seconds??distance(context.position,b.point))).slice(0,2):choices;
  if(!pool.length)return undefined;
  const retained=pool.find(c=>c.key===context.previous);
  const dangerAt=(candidate:LiveApproach)=>context.beliefs.reduce((sum,b)=>sum+(distance(b,candidate.point)<b.radius+5?b.certainty:0),0)
    +(context.routeTo?.(candidate.point).exposure??0)*.06
    +(context.heatAt?.(candidate.point)??0)*.9;
  const dangerChanged=retained&&context.beliefs.some(b=>b.age<3&&b.certainty>=.55)
    &&pool.some(c=>dangerAt(c)+.5<dangerAt(retained));
  if(retained&&context.committed&&!dangerChanged)return retained;
  const scored=pool.map(candidate=>{
    const detour=candidate.purpose==='control'||candidate.purpose==='flank';
    const roleValue=candidate.purpose==='flank'?(context.role==='lurker'?3:.1)
      :candidate.purpose==='control'?(['caller','sniper','support'].includes(context.role)?1.3:.1)
      :candidate.purpose==='entry'?(context.role==='entry'?(context.execute?1.8:2.1):context.role==='trade'?(context.execute?1.8:1.1):(!context.execute&&['support','caller'].includes(context.role)?.55:.8)):.4;
    const crowd=context.allies.filter(a=>distance(a,candidate.point)<5).length;
    const reservations=context.alliedGoals?.filter(a=>distance(a,candidate.point)<5).length??0;
    const danger=dangerAt(candidate);
    const urgency=detour?(context.remaining<35?6:context.execute?.8:0):0;
    const behavior=context.behavior,t=context.tendencies;
    const tUnit=(k:string)=>((t?.[k]??50)-50)/100;
    const tendencyBias=!t?0:candidate.purpose==='entry'?(tUnit('earlyAggression')+tUnit('spaceCreation')+tUnit('duelInitiative'))*.65
      :candidate.purpose==='flank'?(tUnit('lurkFlank')+tUnit('deepControl')+tUnit('opportunityExploitation'))*.65
      :candidate.purpose==='control'?(tUnit('mapControlInitiative')+tUnit('activeInformation'))*.65
      :(tUnit('playDiscipline')+tUnit('angleIsolation'))*.4;
    const preference=!behavior?0:candidate.purpose==='entry'?(behavior.initiative-.5)*1.2+(context.decision==='pressure'?.8:0):candidate.purpose==='flank'?(1-behavior.coordination)*.5+(context.decision==='improvise'?.8:0):candidate.purpose==='control'?(.5-behavior.initiative)*.6:behavior.deliberation*.2;
    const health=context.health??100,initiative=behavior?.initiative??.5;
    const capability=candidate.purpose==='entry'?(context.entrySkill??.5)*.7
      :candidate.purpose==='control'?(context.utilitySkill??.5)*.6:context.judgment*.3;
    const progress=context.objective?distance(candidate.point,context.objective)*.08:0;
    const risk=.5+context.judgment+(1-health/100)*1.4+(behavior?(1-initiative)*.7:0)+(1-(context.firepower??1))*.5+(t?(tUnit('exposureMinimization')-tUnit('economicRisk'))*.4:0);
    const rangeFit=context.objective&&context.preferredRange!==undefined&&candidate.purpose==='clear'
      ?Math.abs(distance(candidate.point,context.objective)-context.preferredRange)*(.04+context.judgment*.04):0;
    const reconBonus=!context.execute&&context.remaining>28
      ?(context.uncertaintyAt?.(candidate.point)??0)*(context.role==='lurker'||context.role==='support'||context.role==='caller'||context.role==='anchor'?1.8:.85)*(t?.75+(t.activeInformation??50)/200:1)
      :0;
    const entryPacingPenalty=!context.execute&&context.role!=='entry'&&context.role!=='lurker'&&context.entryAheadDist!==undefined&&context.objective&&candidate.purpose==='entry'&&distance(candidate.point,context.objective)<context.entryAheadDist-2.5
      ?.85*(.4+(behavior?.coordination??.5)*.6):0;
    const sniperPriorityBonus=context.role==='sniper'&&(context.sniperPriority??0)>.5&&(candidate.purpose==='control'||(candidate.purpose==='clear'&&(!context.objective||distance(candidate.point,context.objective)>=16)))
      ?(context.sniperPriority!-.5)*.9:0;
    return {candidate,score:roleValue+preference+tendencyBias+capability-(context.routeTo?.(candidate.point).distance??distance(context.position,candidate.point))*.12-crowd*1.5-reservations*.8
      -danger*risk-urgency-progress-rangeFit+reconBonus-entryPacingPenalty+sniperPriorityBonus+(candidate.key===context.previous?.4:0)};
  });
  scored.sort((a,b)=>b.score-a.score||a.candidate.key.localeCompare(b.candidate.key));
  // Seeded weighted variation among sensible options. Deliberate players vary
  // less, but no temperament is forced to follow an identical route each round.
  const spread=context.behavior?1.2+(1-context.behavior.deliberation)*1.4+(1-context.judgment)*.4:.15+(1-context.judgment)*.35;
  const plausible=scored.filter(c=>c.score>=scored[0].score-spread);
  const temperature=context.behavior?.deliberation===undefined ? .45 : .45+(1-context.behavior.deliberation)*.8;
  const weights=plausible.map(c=>Math.exp((c.score-scored[0].score)/temperature));
  let roll=random()*weights.reduce((sum,w)=>sum+w,0);
  return (plausible.find((_,i)=>(roll-=weights[i])<0)??plausible[plausible.length-1]).candidate;
}

export function canInvestigateLiveContact(from:FpsPoint,belief:LiveIntelBelief|undefined,remaining:number,lurker=false):boolean {
  if(!belief||belief.age>4||belief.certainty<.4||belief.radius>8)return false;
  const travel=distance(from,belief);
  return travel<=(lurker?18:12)&&remaining>travel/1.65+20;
}

export function shouldFakeLiveDefuse(remaining:number,kit:boolean,covered:boolean,beliefs:readonly LiveIntelBelief[],position:FpsPoint,fakeDefuseTendency=50):boolean {
  const minSlack=fakeDefuseTendency>=65?2.0:fakeDefuseTendency<=30?4.5:3.0;
  return !covered&&remaining>(kit?5:10)+2.5+minSlack
    &&beliefs.some(b=>b.age<3&&b.certainty>=.45&&distance(position,b)<20);
}

export interface LiveSmokeVolume extends FpsPoint {id?:number;y:number;radius:number;expires:number;startedAt?:number;disturbance?:number}
export interface LiveSmokeCloudLobe {x:number;y:number;z:number;scaleX:number;scaleY:number;scaleZ:number}
const smokeLobeCache=new Map<string,LiveSmokeCloudLobe[]>();
/** The viewer renders these exact ellipsoids; AI sight tests the same animated volume. */
export function liveSmokeCloudLobes(smoke:LiveSmokeVolume,now:number):LiveSmokeCloudLobe[] {
  const key=`${smoke.id??0}:${smoke.radius}:${now}`,cached=smokeLobeCache.get(key);
  if(cached)return cached;
  const result:LiveSmokeCloudLobe[]=[];
  for(let i=0;i<15;i++){
    const phase=((smoke.id??0)*2.399+i*4.17)%(Math.PI*2),angle=phase+now*.045;
    const wobble=Math.sin(now*.28+phase);
    if(i===0){
      const width=smoke.radius*1.35;
      result.push({
        x:Math.sin(now*.37+phase)*smoke.radius*.025,
        y:smoke.radius*.02+wobble*smoke.radius*.01,
        z:Math.cos(now*.31+phase)*smoke.radius*.025,
        scaleX:width,scaleY:Math.min(3.65,smoke.radius*.94),scaleZ:width,
      });
    }else if(i<=8){
      // Grounded lower skirt & mid-body billows so the smoke sits flush on stone/earth.
      const spread=.28+(i%4)*.045,width=smoke.radius*(.94+(i%3)*.045);
      result.push({
        x:Math.cos(angle)*smoke.radius*spread+Math.sin(now*.37+phase)*smoke.radius*.022,
        y:-smoke.radius*.06+(i%3)*smoke.radius*.035+wobble*smoke.radius*.012,
        z:Math.sin(angle)*smoke.radius*spread+Math.cos(now*.31+phase)*smoke.radius*.022,
        scaleX:width,scaleY:Math.min(3.25,smoke.radius*(.78+(i%3)*.04)),scaleZ:width,
      });
    }else{
      // Upper crown billows give a natural three-dimensional silhouette and block steep highground angles.
      const spread=.20+(i%3)*.05,width=smoke.radius*(.88+(i%2)*.05);
      result.push({
        x:Math.cos(angle)*smoke.radius*spread+Math.sin(now*.37+phase)*smoke.radius*.022,
        y:smoke.radius*(.04+(i%3)*.03)+wobble*smoke.radius*.012,
        z:Math.sin(angle)*smoke.radius*spread+Math.cos(now*.31+phase)*smoke.radius*.022,
        scaleX:width,scaleY:Math.min(3.65,smoke.radius*(.92+(i%2)*.04)),scaleZ:width,
      });
    }
  }
  smokeLobeCache.set(key,result);if(smokeLobeCache.size>64)smokeLobeCache.delete(smokeLobeCache.keys().next().value!);
  return result;
}
function segmentSmokeLobeContribution(from:FpsPoint,to:FpsPoint,fromY:number,toY:number,smoke:LiveSmokeVolume,lobe:LiveSmokeCloudLobe):{chord:number;optical:number} {
  const floorY=smoke.y-1.42,dyWorld=toY-fromY;
  let minT=0,maxT=1;
  if(Math.abs(dyWorld)<1e-6){
    if(fromY<floorY)return {chord:0,optical:0};
  }else{
    const tFloor=(floorY-fromY)/dyWorld;
    if(dyWorld>0)minT=Math.max(0,tFloor);
    else maxT=Math.min(1,tFloor);
  }
  if(minT>=maxT)return {chord:0,optical:0};
  const rx=Math.max(.001,lobe.scaleX*.5),ry=Math.max(.001,lobe.scaleY*.5),rz=Math.max(.001,lobe.scaleZ*.5);
  const ox=(from.x-smoke.x-lobe.x)/rx,oy=(fromY-smoke.y-lobe.y)/ry,oz=(from.z-smoke.z-lobe.z)/rz;
  const dx=(to.x-from.x)/rx,dy=dyWorld/ry,dz=(to.z-from.z)/rz;
  const a=dx*dx+dy*dy+dz*dz,c=ox*ox+oy*oy+oz*oz-1;
  if(a<1e-12)return c<=0?{chord:1,optical:1}:{chord:0,optical:0};
  const b=2*(ox*dx+oy*dy+oz*dz),discriminant=b*b-4*a*c;
  if(discriminant<0)return {chord:0,optical:0};
  const root=Math.sqrt(discriminant),entry=Math.max(minT,(-b-root)/(2*a)),exit=Math.min(maxT,(-b+root)/(2*a));
  if(exit<=entry)return {chord:0,optical:0};
  const chord=(exit-entry)*Math.hypot(to.x-from.x,dyWorld,to.z-from.z);
  const midT=.5*(entry+exit),mx=ox+dx*midT,my=oy+dy*midT,mz=oz+dz*midT;
  const r2=Math.min(1,mx*mx+my*my+mz*mz),radial=(1-r2)*(1-r2);
  return {chord,optical:chord*(.28+.72*radial)};
}
export function liveSmokeDepth(from:FpsPoint,to:FpsPoint,fromY:number,toY:number,smoke:LiveSmokeVolume,now=smoke.startedAt??0):number {
  if(smoke.expires<=now||smoke.radius<=.02)return 0;
  const fade=Math.min(1,Math.max(0,(smoke.expires-now)/1.2));
  let opticalSum=0;
  for(const lobe of liveSmokeCloudLobes(smoke,now)){
    const part=segmentSmokeLobeContribution(from,to,fromY,toY,smoke,lobe);
    opticalSum+=part.optical;
  }
  // Base optical integral directly tracks shader opticalDepth without maxChord inflating thin wispy rim chords.
  return opticalSum*.52*fade;
}
/** Smoke blocks only the dense visible cloud volume matching Spectator alpha; wispy outer edges remain transparent. */
export function liveSmokeOccludes(from:FpsPoint,to:FpsPoint,fromY:number,toY:number,smoke:LiveSmokeVolume,now=smoke.startedAt??0):boolean {
  return liveSmokeDepth(from,to,fromY,toY,smoke,now)>.48;
}

/** Move briefly, then leave enough braking/aim time to shoot. A strafe is not a permanent state. */
export function liveCombatStrafe(now:number,moveUntil:number,settleUntil:number,canStrafe:boolean):'start'|'move'|'settle' {
  if(!canStrafe)return 'settle';
  if(now<moveUntil)return 'move';
  return now>=settleUntil?'start':'settle';
}
