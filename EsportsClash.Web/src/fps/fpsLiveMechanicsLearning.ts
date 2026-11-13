import type { FpsTeamId } from './fpsTypes.ts';

export type FpsFireCadence='burst'|'sustain';
export type FpsFireContext=`${'near'|'far'}:${'steady'|'moving'}:${'loaded'|'low'}`;
const contexts:FpsFireContext[]=['near:steady:loaded','near:steady:low','near:moving:loaded','near:moving:low','far:steady:loaded','far:steady:low','far:moving:loaded','far:moving:low'];
const actions:FpsFireCadence[]=['burst','sustain'];
const bounded=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');};
export const FPS_MECHANICS_COMPATIBILITY=hash('fps-rifle-cadence-v1:range-distance-20:round-feedback-v1');

export interface FpsMechanicsModel {
  kind:'fps-combat-mechanics';version:1;compatibility:string;revision:number;rounds:number;updates:number;
  values:Record<FpsFireContext,Record<FpsFireCadence,number>>;
  counts:Record<FpsFireContext,Record<FpsFireCadence,number>>;
  recentEpisodes:string[];
}
export interface FpsMechanicsSample {context:FpsFireContext;action:FpsFireCadence;reward:number}
export interface FpsMechanicsRound {id:string;samples:FpsMechanicsSample[]}
export interface FpsMechanicsOptions {model?:unknown;onRound?:(round:FpsMechanicsRound)=>void}
export interface FpsMechanicsStats {revision:number;rounds:number;updates:number;decisions:number;explorations:number;burstSelections:number;sustainSelections:number}
interface ActiveChoice {targetId:string;context:FpsFireContext;action:FpsFireCadence;outcome:number;team:FpsTeamId;}
interface PendingChoice extends FpsMechanicsSample {team:FpsTeamId}

export function createFpsMechanicsModel():FpsMechanicsModel {
  const values=Object.fromEntries(contexts.map(context=>[context,{burst:context.startsWith('far')?.12:0,sustain:context.startsWith('near')?.08:0}])) as FpsMechanicsModel['values'];
  const counts=Object.fromEntries(contexts.map(context=>[context,{burst:0,sustain:0}])) as FpsMechanicsModel['counts'];
  return {kind:'fps-combat-mechanics',version:1,compatibility:FPS_MECHANICS_COMPATIBILITY,revision:0,rounds:0,updates:0,values,counts,recentEpisodes:[]};
}
export function loadFpsMechanicsModel(raw:unknown):FpsMechanicsModel|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return;
  const m=raw as FpsMechanicsModel;
  if(m.kind!=='fps-combat-mechanics'||m.version!==1||m.compatibility!==FPS_MECHANICS_COMPATIBILITY
    ||![m.revision,m.rounds,m.updates].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
    ||!m.values||!m.counts||!Array.isArray(m.recentEpisodes)||m.recentEpisodes.length>64
    ||!m.recentEpisodes.every(id=>typeof id==='string'&&id.length<=128))return;
  for(const context of contexts)for(const action of actions){
    const value=m.values[context]?.[action],count=m.counts[context]?.[action];
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1||!Number.isSafeInteger(count)||count<0||count>1e9)return;
  }
  return {...m,values:Object.fromEntries(contexts.map(context=>[context,{...m.values[context]}])) as FpsMechanicsModel['values'],
    counts:Object.fromEntries(contexts.map(context=>[context,{...m.counts[context]}])) as FpsMechanicsModel['counts'],recentEpisodes:[...m.recentEpisodes]};
}
export function applyFpsMechanicsRound(model:FpsMechanicsModel,round:FpsMechanicsRound):boolean {
  if(typeof round.id!=='string'||!round.id||round.id.length>128||!Array.isArray(round.samples)||round.samples.length>200
    ||round.samples.some(sample=>!sample||typeof sample!=='object'||!contexts.includes(sample.context)||!actions.includes(sample.action)||!Number.isFinite(sample.reward)||Math.abs(sample.reward)>1))throw Error('Invalid FPS mechanics round');
  if(model.recentEpisodes.includes(round.id))return false;
  for(const sample of round.samples){
    const oldCount=model.counts[sample.context][sample.action],oldValue=model.values[sample.context][sample.action];
    const rate=.24/Math.sqrt(1+oldCount/24);
    model.values[sample.context][sample.action]=bounded(oldValue+rate*(sample.reward-oldValue));
    model.counts[sample.context][sample.action]++;model.updates++;
  }
  model.rounds++;model.revision++;model.recentEpisodes=[...model.recentEpisodes,round.id].slice(-64);return true;
}

export function fpsFireContext(range:number,speed:number,ammo:number,magazine:number):FpsFireContext {
  return `${range>20?'far':'near'}:${speed<=1?'steady':'moving'}:${ammo<Math.ceil(magazine*.35)?'low':'loaded'}` as FpsFireContext;
}
export class FpsLiveMechanicsLearner {
  readonly model:FpsMechanicsModel;
  readonly initial:FpsMechanicsModel;
  readonly options:FpsMechanicsOptions;
  private active=new Map<string,ActiveChoice>();
  private pending:PendingChoice[]=[];
  private decisions=0;private explorations=0;private burstSelections=0;private sustainSelections=0;
  constructor(options:FpsMechanicsOptions={}){this.options=options;this.model=loadFpsMechanicsModel(options.model)??createFpsMechanicsModel();this.initial=loadFpsMechanicsModel(this.model)!;}
  choose(actorId:string,targetId:string,team:FpsTeamId,context:FpsFireContext,random:()=>number):FpsFireCadence {
    const existing=this.active.get(actorId);
    if(existing?.targetId===targetId)return existing.action;
    if(existing)this.settle(actorId);
    const values=this.model.values[context],greedy=values.burst>=values.sustain?'burst':'sustain';
    const epsilon=Math.max(.025,.10/Math.sqrt(1+this.model.rounds/60));
    const exploring=random()<epsilon,action=exploring?(greedy==='burst'?'sustain':'burst'):greedy;
    this.active.set(actorId,{targetId,team,context,action,outcome:0});this.decisions++;if(exploring)this.explorations++;
    if(action==='burst')this.burstSelections++;else this.sustainSelections++;
    return action;
  }
  recordDamage(actorId:string,targetId:string,damage:number):void {const active=this.active.get(actorId);if(active?.targetId===targetId)active.outcome=bounded(active.outcome+Math.min(38,Math.max(0,damage))*.012);}
  recordIncoming(actorId:string,attackerId:string,damage:number):void {const active=this.active.get(actorId);if(active?.targetId===attackerId)active.outcome=bounded(active.outcome-Math.min(32,Math.max(0,damage))*.012);}
  recordKill(actorId:string,targetId:string):void {const active=this.active.get(actorId);if(active?.targetId===targetId)active.outcome=bounded(active.outcome+.2);}
  private settle(actorId:string):void {const active=this.active.get(actorId);if(!active)return;this.active.delete(actorId);this.pending.push({context:active.context,action:active.action,reward:active.outcome,team:active.team});}
  completeRound(winner:FpsTeamId,id:string):FpsMechanicsRound|undefined {
    for(const actorId of this.active.keys())this.settle(actorId);
    const samples=this.pending.map(({team,...sample})=>({...sample,reward:bounded(sample.reward+(team===winner?.18:-.18))}));
    // The selected action is attributed to the round result without allowing the
    // route learner's report, model, or storage to absorb combat outcomes.
    this.pending=[];
    if(!samples.length)return;
    const round={id,samples};applyFpsMechanicsRound(this.model,round);return round;
  }
  abandonRound():void {this.active.clear();this.pending=[];}
  stats():FpsMechanicsStats {return {revision:this.model.revision,rounds:this.model.rounds,updates:this.model.updates,decisions:this.decisions,explorations:this.explorations,burstSelections:this.burstSelections,sustainSelections:this.sustainSelections};}
  checkpoint():FpsMechanicsModel {return loadFpsMechanicsModel(this.model)!;}
}
