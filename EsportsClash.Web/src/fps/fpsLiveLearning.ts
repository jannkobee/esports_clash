import { segmentHitsWall, type FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTeamId } from './fpsTypes.ts';
import type { FpsPrimaryRole } from './fpsIdentity.ts';
import type { LiveIntelBelief } from './fpsLiveIntel.ts';
import { LIVE_FPS_MAP, LIVE_ACTOR_RADIUS, distance, liveWalkable } from './fpsLiveMap.ts';
import { createLiveRoutePlanner, LIVE_PLANT_RULES } from './fpsLivePlanning.ts';
import { LIVE_RUN_SPEED } from './fpsLiveMovement.ts';
import { LIVE_WEAPONS } from './fpsLiveWeapons.ts';

const bounded=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const contexts=['attack:A','attack:B','defend:A','defend:B'] as const;
export type FpsLearningContext=typeof contexts[number];
export const FPS_LEARNING_FEATURES=76;
export const FPS_LEARNING_DISCOUNT=.995;
const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');};
const learningMap={id:LIVE_FPS_MAP.id,width:LIVE_FPS_MAP.width,depth:LIVE_FPS_MAP.depth,spawns:LIVE_FPS_MAP.spawns,sites:LIVE_FPS_MAP.sites,
  geometry:LIVE_FPS_MAP.solids.map(({id,minX,maxX,minZ,maxZ,height})=>({id,minX,maxX,minZ,maxZ,height}))};
export const FPS_LEARNING_COMPATIBILITY=hash(JSON.stringify(['fps-navigation-value-v1',FPS_LEARNING_FEATURES,learningMap,LIVE_RUN_SPEED,LIVE_PLANT_RULES,LIVE_WEAPONS]));

export interface FpsLearningModel {
  kind:'fps-navigation-value';version:1;compatibility:string;revision:number;rounds:number;updates:number;
  weights:Record<FpsLearningContext,number[]>;recentEpisodes:string[];
}
export interface FpsLearningSample {context:FpsLearningContext;features:number[];target:number}
export interface FpsLearningRound {id:string;samples:FpsLearningSample[]}
export interface FpsLearningOptions {mode:'learn'|'frozen';model?:unknown;exploration?:number;onRound?:(round:FpsLearningRound)=>void}
export interface FpsLearningStats {mode:'learn'|'frozen';revision:number;rounds:number;updates:number;decisions:number;explorations:number;lastValue:number}

export function createFpsLearningModel():FpsLearningModel {
  // Mutable geometric priors keep a fresh learner purposeful. Training can change
  // every coefficient, including the initially zero map-cell/context features.
  const initial=()=>{const w=Array(FPS_LEARNING_FEATURES).fill(0);w[1]=.55;w[2]=-.25;w[3]=-.18;w[4]=-.1;w[5]=.04;w[6]=-.2;w[7]=.2;return w;};
  return {kind:'fps-navigation-value',version:1,compatibility:FPS_LEARNING_COMPATIBILITY,revision:0,rounds:0,updates:0,
    weights:Object.fromEntries(contexts.map(key=>[key,initial()])) as FpsLearningModel['weights'],recentEpisodes:[]};
}
const validFeatures=(value:unknown):value is number[]=>Array.isArray(value)&&value.length===FPS_LEARNING_FEATURES&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1);
export function loadFpsLearningModel(raw:unknown):FpsLearningModel|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return;
  const m=raw as FpsLearningModel;
  if(m.kind!=='fps-navigation-value'||m.version!==1||m.compatibility!==FPS_LEARNING_COMPATIBILITY
    ||![m.revision,m.rounds,m.updates].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
    ||!m.weights||Object.keys(m.weights).length!==4
    ||!contexts.every(key=>Array.isArray(m.weights[key])&&m.weights[key].length===FPS_LEARNING_FEATURES&&m.weights[key].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=4))
    ||!Array.isArray(m.recentEpisodes)||m.recentEpisodes.length>64||!m.recentEpisodes.every(id=>typeof id==='string'&&id.length<=128))return;
  return {kind:m.kind,version:1,compatibility:m.compatibility,revision:m.revision,rounds:m.rounds,updates:m.updates,
    weights:Object.fromEntries(contexts.map(key=>[key,[...m.weights[key]]])) as FpsLearningModel['weights'],recentEpisodes:[...m.recentEpisodes]};
}
export const fpsLearningModelHash=(model:FpsLearningModel)=>hash(JSON.stringify(model));
export function fpsActionValue(model:FpsLearningModel,context:FpsLearningContext,features:readonly number[]):number {
  return model.weights[context].reduce((value,weight,i)=>value+weight*features[i],0);
}

/** Normalized Monte Carlo action-value update. The target is measured experience,
 * never an authored "correct" action. No mechanical stats are modified. */
export function learnFpsActionValue(model:FpsLearningModel,sample:FpsLearningSample):number {
  if(!contexts.includes(sample.context)||!validFeatures(sample.features)||!Number.isFinite(sample.target)||Math.abs(sample.target)>2)throw Error('Invalid FPS learning sample');
  const error=sample.target-fpsActionValue(model,sample.context,sample.features);
  const norm=Math.max(1,sample.features.reduce((sum,value)=>sum+value*value,0));
  const rate=.18/Math.sqrt(1+model.updates/3000);
  const weights=model.weights[sample.context];
  for(let i=0;i<weights.length;i++)weights[i]=bounded(weights[i]+rate*bounded(error,-2,2)*sample.features[i]/norm,-4,4);
  model.updates++;return error;
}
export function applyFpsLearningRound(model:FpsLearningModel,round:FpsLearningRound):boolean {
  if(typeof round.id!=='string'||!round.id||round.id.length>128||!Array.isArray(round.samples)||!round.samples.length||round.samples.length>400)throw Error('Invalid FPS learning round');
  // Validate the complete batch before mutating the checkpoint.
  if(round.samples.some(s=>!contexts.includes(s.context)||!validFeatures(s.features)||!Number.isFinite(s.target)||Math.abs(s.target)>2))throw Error('Invalid FPS learning round');
  if(model.recentEpisodes.includes(round.id))return false;
  for(const sample of round.samples)learnFpsActionValue(model,sample);
  model.revision++;model.rounds++;model.recentEpisodes=[...model.recentEpisodes,round.id].slice(-64);return true;
}

export interface FpsNavigationActor extends FpsPoint {id:string;team:FpsTeamId;attacking:boolean;hp:number;yaw:number;role:FpsPrimaryRole;bomb:boolean;ammo:number;reload:number}
export interface FpsNavigationContext {
  actor:FpsNavigationActor;goal:FpsPoint;remaining:number;planted:boolean;time:number;
  beliefs:readonly LiveIntelBelief[];allies:readonly FpsPoint[];caution:number;evidence:string;
}
export interface FpsNavigationChoice {point:FpsPoint;path:FpsPoint[];features:number[];context:FpsLearningContext;goalDistance:number}

function ahead(from:FpsPoint,path:readonly FpsPoint[],metres:number):FpsPoint {
  let previous=from;
  for(const point of path){const d=distance(previous,point);if(d>=metres)return {x:previous.x+(point.x-previous.x)*metres/(d||1),z:previous.z+(point.z-previous.z)*metres/(d||1)};metres-=d;previous=point;}
  return {...previous};
}

/** Candidate generation sees static geometry, allies and the actor's own bounded
 * beliefs. No world-opponent list or hidden positions enter the learner. */
export function liveNavigationChoices(c:FpsNavigationContext):FpsNavigationChoice[] {
  const routeTo=createLiveRoutePlanner(c.actor,c.beliefs,c.caution),direct=routeTo(c.goal);
  if(!Number.isFinite(direct.distance)||direct.distance<3)return [];
  const goalDistance=c.caution>0?createLiveRoutePlanner(c.actor)(c.goal).distance:direct.distance;
  const front=ahead(c.actor,direct.path,6),dx=front.x-c.actor.x,dz=front.z-c.actor.z,len=Math.hypot(dx,dz)||1;
  const fx=dx/len,fz=dz/len,rx=fz,rz=-fx;
  const points=[front,...([-1,1] as const).flatMap(side=>[
    {x:c.actor.x+fx*4+rx*side*5,z:c.actor.z+fz*4+rz*side*5},
    {x:c.actor.x-fx*2+rx*side*6,z:c.actor.z-fz*2+rz*side*6},
  ])];
  const site=distance(c.goal,LIVE_FPS_MAP.sites.A)<distance(c.goal,LIVE_FPS_MAP.sites.B)?'A':'B';
  const context:FpsLearningContext=`${c.actor.attacking?'attack':'defend'}:${site}`;
  const out:FpsNavigationChoice[]=[];
  for(let i=0;i<points.length;i++){
    const point=points[i];if(!liveWalkable(point)||out.some(option=>distance(option.point,point)<1))continue;
    // Local alternatives are directly reachable steps. Crossing a wall is not a
    // local action; the existing route gets the actor to the next opening first.
    if(i>0&&LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(c.actor,point,w,LIVE_ACTOR_RADIUS+.08)))continue;
    const prefix=routeTo(point),suffix=createLiveRoutePlanner(point,c.beliefs,c.caution)(c.goal);
    if(!Number.isFinite(prefix.distance+suffix.distance))continue;
    const exposure=bounded(prefix.exposure/12,0,1),crowd=bounded(c.allies.filter(a=>distance(a,point)<3).length/3,0,1);
    const support=bounded(c.allies.filter(a=>distance(a,point)>=3&&distance(a,point)<9).length/3,0,1);
    const progress=bounded((direct.distance-suffix.distance)/8),lateral=bounded(((point.x-c.actor.x)*Math.cos(c.actor.yaw)-(point.z-c.actor.z)*Math.sin(c.actor.yaw))/8);
    const danger=bounded(c.beliefs.reduce((n,b)=>n+(distance(b,point)<b.radius+5?b.certainty:0),0),0,1);
    const f=Array(FPS_LEARNING_FEATURES).fill(0);
    f.splice(0,28,1,progress,bounded((prefix.distance+suffix.distance-direct.distance)/20,0,1),exposure,crowd,support,
      (1-c.actor.hp/100)*exposure,(1-bounded(c.remaining/115,0,1))*progress,danger,
      bounded(((point.x-c.actor.x)*Math.sin(c.actor.yaw)+(point.z-c.actor.z)*Math.cos(c.actor.yaw))/8),lateral,
      +c.actor.bomb*exposure,+c.actor.bomb,bounded(direct.distance/80,0,1),c.goal.x/34,c.goal.z/43,point.x/34,point.z/43,
      +(c.actor.ammo===0)*exposure,+(c.actor.reload>0)*exposure,
      +(c.actor.role==='entry')*progress,+(c.actor.role==='trade')*support,+(c.actor.role==='support')*exposure,
      +(c.actor.role==='lurker')*lateral,+(c.actor.role==='sniper')*exposure,+(c.actor.role==='anchor')*f[2],+(c.actor.role==='caller')*support,+c.planted*progress);
    const column=Math.min(5,Math.max(0,Math.floor((point.x+34)/68*6))),row=Math.min(7,Math.max(0,Math.floor((point.z+43)/86*8)));
    f[28+row*6+column]=1;
    f[25]=+(c.actor.role==='anchor')*f[2];
    out.push({point:{...point},path:i===0?direct.path:[...prefix.path,...suffix.path],features:f.map(value=>bounded(value)),context,goalDistance});
  }
  return out;
}

export function chooseLearnedNavigation(model:FpsLearningModel,choices:readonly FpsNavigationChoice[],random:()=>number,exploration:number):{index:number;value:number;exploring:boolean}|undefined {
  if(!choices.length)return;
  const values=choices.map(choice=>fpsActionValue(model,choice.context,choice.features));
  let index=values.reduce((best,value,i)=>value>values[best]+1e-9?i:best,0);
  const exploring=choices.length>1&&exploration>0&&random()<bounded(exploration,0,1);
  if(exploring){const alternatives=choices.map((_,i)=>i).filter(i=>i!==index);index=alternatives[Math.min(alternatives.length-1,Math.floor(random()*alternatives.length))];}
  return {index,value:values[index],exploring};
}

interface ActiveRoute {choice:FpsNavigationChoice;goal:FpsPoint;evidence:string;at:number;hp:number;team:FpsTeamId;until:number;exploring:boolean;value:number}
interface ObservedStep {context:FpsLearningContext;features:number[];reward:number;at:number;ended:number;team:FpsTeamId}
export class FpsLiveLearner {
  readonly options:FpsLearningOptions;
  readonly initial:FpsLearningModel;
  readonly model:FpsLearningModel;
  private active=new Map<string,ActiveRoute>();
  private episodes=new Map<string,ObservedStep[]>();
  private decisions=0;private explorations=0;private lastValue=0;
  constructor(options:FpsLearningOptions){this.options=options;this.model=loadFpsLearningModel(options.model)??createFpsLearningModel();this.initial=loadFpsLearningModel(this.model)!;}
  route(c:FpsNavigationContext,random:()=>number,allowNew=true):{choice:FpsNavigationChoice;retained:boolean;exploring:boolean;value:number}|undefined {
    const current=this.active.get(c.actor.id);
    if(current&&distance(current.goal,c.goal)<1&&current.evidence===c.evidence&&(!allowNew||c.time<current.until
      &&(distance(c.actor,current.choice.point)>.6||c.time<current.at+.5)))return {choice:current.choice,retained:true,exploring:current.exploring,value:current.value};
    this.close(c.actor,c.time);
    if(!allowNew)return;
    const choices=liveNavigationChoices(c);
    const epsilon=this.options.mode==='frozen'?0:this.options.exploration??Math.max(.03,.1/Math.sqrt(1+this.model.rounds/80));
    const selected=chooseLearnedNavigation(this.model,choices,random,epsilon);if(!selected)return;
    const choice=choices[selected.index];
    this.active.set(c.actor.id,{choice,goal:{...c.goal},evidence:c.evidence,at:c.time,hp:c.actor.hp,team:c.actor.team,until:c.time+4,exploring:selected.exploring,value:selected.value});
    this.decisions++;if(selected.exploring)this.explorations++;this.lastValue=selected.value;
    return {choice,retained:false,exploring:selected.exploring,value:selected.value};
  }
  close(actor:Pick<FpsNavigationActor,'id'|'x'|'z'|'hp'>,now:number):void {
    const previous=this.active.get(actor.id);if(!previous)return;this.active.delete(actor.id);
    if(this.options.mode!=='learn')return;
    const remaining=createLiveRoutePlanner(actor)(previous.goal).distance;
    const progress=Number.isFinite(remaining)?bounded((previous.choice.goalDistance-remaining)/12):0;
    const reward=.08*progress+.2*bounded((actor.hp-previous.hp)/100)-.001*Math.min(8,Math.max(0,now-previous.at));
    const history=this.episodes.get(actor.id)??[];
    history.push({context:previous.choice.context,features:[...previous.choice.features],reward,at:previous.at,ended:now,team:previous.team});
    this.episodes.set(actor.id,history.slice(-40));
  }
  completeRound(actors:readonly Pick<FpsNavigationActor,'id'|'x'|'z'|'hp'>[],winner:FpsTeamId,now:number,id:string):FpsLearningRound|undefined {
    for(const actor of actors)this.close(actor,now);
    if(this.options.mode!=='learn'){this.episodes.clear();return;}
    const samples:FpsLearningSample[]=[];
    for(const history of this.episodes.values()){
      if(!history.length)continue;
      let value=history[0].team===winner?1:-1,after=now;
      for(let i=history.length-1;i>=0;i--){const step=history[i];
        value=bounded(step.reward+Math.pow(FPS_LEARNING_DISCOUNT,Math.max(0,after-step.at))*value,-2,2);
        samples.push({context:step.context,features:step.features,target:value});after=step.at;
      }
    }
    this.episodes.clear();
    if(!samples.length)return;
    const round={id,samples};applyFpsLearningRound(this.model,round);return round;
  }
  abandonRound():void {this.active.clear();this.episodes.clear();}
  stats():FpsLearningStats {return {mode:this.options.mode,revision:this.model.revision,rounds:this.model.rounds,updates:this.model.updates,decisions:this.decisions,explorations:this.explorations,lastValue:this.lastValue};}
  checkpoint():FpsLearningModel {return loadFpsLearningModel(this.model)!;}
}
