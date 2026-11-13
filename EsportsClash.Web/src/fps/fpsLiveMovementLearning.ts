import type {FpsTeamId} from './fpsTypes.ts';

export type FpsMovementPhase='duel'|'peek';
export type FpsMovementAction='strafe'|'hold'|'crouch-strafe'|'shoulder'|'crouch-swing'|'ferrari'|'double-pump'|'bait'|'fake';
export type FpsDuelMovementAction=Extract<FpsMovementAction,'strafe'|'hold'|'crouch-strafe'>;
export type FpsPeekMovementAction=Exclude<FpsMovementAction,FpsDuelMovementAction>;
export type FpsMovementContext=`${FpsMovementPhase}:${'close'|'mid'|'far'}:${'healthy'|'low'}`;
export interface FpsMovementModel {
  kind:'fps-movement-choice';version:1;compatibility:string;revision:number;rounds:number;updates:number;
  values:Record<FpsMovementContext,Record<FpsMovementAction,number>>;
  counts:Record<FpsMovementContext,Record<FpsMovementAction,number>>;recentEpisodes:string[];
}
export interface FpsMovementSample {context:FpsMovementContext;action:FpsMovementAction;reward:number}
export interface FpsMovementRound {id:string;samples:FpsMovementSample[]}
export interface FpsMovementOptions {mode?:'learn'|'frozen';updateModel?:boolean;model?:unknown;onRound?:(round:FpsMovementRound)=>void}
export interface FpsMovementStats {revision:number;rounds:number;updates:number;decisions:number;explorations:number;actions:Record<FpsMovementAction,number>}

const contexts:FpsMovementContext[]=(['duel','peek'] as const).flatMap(phase=>(['close','mid','far'] as const).flatMap(range=>(['healthy','low'] as const).map(hp=>`${phase}:${range}:${hp}` as FpsMovementContext)));
const actions:FpsMovementAction[]=['strafe','hold','crouch-strafe','shoulder','crouch-swing','ferrari','double-pump','bait','fake'];
const allowed:Record<FpsMovementPhase,FpsMovementAction[]>={duel:['strafe','hold','crouch-strafe'],peek:['shoulder','crouch-swing','ferrari','double-pump','bait','fake']};
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
export const FPS_MOVEMENT_COMPATIBILITY='live-movement-choice-v1-duel-peek-attribute-execution';

export function createFpsMovementModel():FpsMovementModel {
  const values=Object.fromEntries(contexts.map(context=>[context,Object.fromEntries(actions.map(action=>[
    action,context.startsWith('duel:')?(action==='strafe'?.12:action==='hold'?.04:0)
      :action==='shoulder'?.1:action==='crouch-swing'?.06:0,
  ]))])) as FpsMovementModel['values'];
  const counts=Object.fromEntries(contexts.map(context=>[context,Object.fromEntries(actions.map(action=>[action,0]))])) as FpsMovementModel['counts'];
  return {kind:'fps-movement-choice',version:1,compatibility:FPS_MOVEMENT_COMPATIBILITY,revision:0,rounds:0,updates:0,values,counts,recentEpisodes:[]};
}

export function loadFpsMovementModel(raw:unknown):FpsMovementModel|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return;
  const model=raw as FpsMovementModel;
  if(model.kind!=='fps-movement-choice'||model.version!==1||model.compatibility!==FPS_MOVEMENT_COMPATIBILITY
    ||![model.revision,model.rounds,model.updates].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9)
    ||!model.values||!model.counts||!Array.isArray(model.recentEpisodes)||model.recentEpisodes.length>64
    ||!model.recentEpisodes.every(id=>typeof id==='string'&&id.length<=128))return;
  for(const context of contexts)for(const action of actions) {
    const value=model.values[context]?.[action],count=model.counts[context]?.[action];
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1||!Number.isSafeInteger(count)||count<0||count>1e9)return;
  }
  return {...model,values:Object.fromEntries(contexts.map(context=>[context,{...model.values[context]}])) as FpsMovementModel['values'],
    counts:Object.fromEntries(contexts.map(context=>[context,{...model.counts[context]}])) as FpsMovementModel['counts'],recentEpisodes:[...model.recentEpisodes]};
}

export function applyFpsMovementRound(model:FpsMovementModel,round:FpsMovementRound):boolean {
  if(typeof round.id!=='string'||!round.id||round.id.length>128||!Array.isArray(round.samples)||round.samples.length>200
    ||round.samples.length===0||round.samples.some(sample=>!sample||!contexts.includes(sample.context)
      ||!allowed[sample.context.startsWith('duel:')?'duel':'peek'].includes(sample.action)
      ||!Number.isFinite(sample.reward)||Math.abs(sample.reward)>1))throw Error('Invalid FPS movement round');
  if(model.recentEpisodes.includes(round.id))return false;
  for(const sample of round.samples) {
    const count=model.counts[sample.context][sample.action],value=model.values[sample.context][sample.action];
    const rate=.24/Math.sqrt(1+count/24);
    model.values[sample.context][sample.action]=clamp(value+rate*(sample.reward-value));
    model.counts[sample.context][sample.action]++;model.updates++;
  }
  model.rounds++;model.revision++;model.recentEpisodes=[...model.recentEpisodes,round.id].slice(-64);
  return true;
}

interface ActiveChoice {context:FpsMovementContext;action:FpsMovementAction;targetId:string;team:FpsTeamId;outcome:number}
interface PendingChoice {sample:FpsMovementSample;team:FpsTeamId}

export class FpsLiveMovementLearner {
  readonly model:FpsMovementModel;readonly initial:FpsMovementModel;readonly options:FpsMovementOptions;
  private active=new Map<string,ActiveChoice>();private pending:PendingChoice[]=[];
  private decisions=0;private explorations=0;
  private actionCounts=Object.fromEntries(actions.map(action=>[action,0])) as Record<FpsMovementAction,number>;
  constructor(options:FpsMovementOptions={}) {this.options=options;this.model=loadFpsMovementModel(options.model)??createFpsMovementModel();this.initial=loadFpsMovementModel(this.model)!;}

  choose(actorId:string,targetId:string,team:FpsTeamId,context:FpsMovementContext,random:()=>number,preferred?:FpsMovementAction):FpsMovementAction {
    const current=this.active.get(actorId);
    if(current?.targetId===targetId)return current.action;
    if(current)this.settle(actorId);
    const phase=context.startsWith('duel:')?'duel':'peek',candidates=allowed[phase],values=this.model.values[context];
    const score=(action:FpsMovementAction)=>values[action]+(action===preferred ? .14 : 0);
    const greedy=candidates.reduce((best,action)=>score(action)>score(best)?action:best,candidates[0]);
    const exploring=this.options.mode!=='frozen'&&random()<Math.max(.025,.10/Math.sqrt(1+this.model.rounds/60));
    const action=exploring?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:greedy;
    this.active.set(actorId,{targetId,team,context,action,outcome:0});this.decisions++;if(exploring)this.explorations++;
    this.actionCounts[action]++;return action;
  }
  recordDamage(actorId:string,targetId:string,damage:number):void {
    const active=this.active.get(actorId);if(active?.targetId===targetId)active.outcome=clamp(active.outcome+Math.min(38,Math.max(0,damage))*.012);
  }
  recordIncoming(actorId:string,attackerId:string,damage:number):void {
    const active=this.active.get(actorId);if(active?.targetId===attackerId)active.outcome=clamp(active.outcome-Math.min(32,Math.max(0,damage))*.012);
  }
  recordKill(actorId:string,targetId:string):void {
    const active=this.active.get(actorId);if(active?.targetId===targetId)active.outcome=clamp(active.outcome+.2);
  }
  private settle(actorId:string):void {
    const active=this.active.get(actorId);if(!active)return;this.active.delete(actorId);
    if(this.options.mode!=='frozen')this.pending.push({team:active.team,sample:{context:active.context,action:active.action,reward:active.outcome}});
  }
  close(actorId:string):void {this.settle(actorId);}
  completeRound(winner:FpsTeamId,id:string):FpsMovementRound|undefined {
    for(const actorId of this.active.keys())this.settle(actorId);
    const samples=this.pending.map(({team,sample})=>({...sample,reward:clamp(sample.reward+(team===winner?.18:-.18))}));
    this.pending=[];if(!samples.length)return;
    const round={id,samples:samples.slice(-200)};
    if(this.options.updateModel!==false)applyFpsMovementRound(this.model,round);
    return round;
  }
  abandonRound():void {this.active.clear();this.pending=[];}
  checkpoint():FpsMovementModel {return loadFpsMovementModel(this.model)!;}
  stats():FpsMovementStats {return {revision:this.model.revision,rounds:this.model.rounds,updates:this.model.updates,
    decisions:this.decisions,explorations:this.explorations,actions:{...this.actionCounts}};}
}

export function fpsMovementContext(phase:FpsMovementPhase,range:number,hp:number):FpsMovementContext {
  return `${phase}:${range<8?'close':range<20?'mid':'far'}:${hp<45?'low':'healthy'}`;
}
