import type { FpsGameplan } from './fpsIdentity.ts';
import type { LiveEnemyEconomyRead } from './fpsLiveEconomyRead.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTendencyValues } from './fpsPlayerTendencies.ts';

export type LiveAttackStyle='adaptive';
export type LiveAttackPhase='default'|'entry'|'post-plant';
export type LiveTacticArchetype='rush_b'|'rush_a'|'default_pick'|'split_b'|'split_a'|'fake_execute'|'mid_control';
export type LiveDefenseSetup='standard'|'stack_b'|'stack_a'|'aggressive_banana'|'mid_push'|'retake_setup';
export type LiveCallLifecycle='proposed'|'communicated'|'preparing'|'ready'|'executing'|'evaluating';

export interface LiveCallUtilityAssignment {
  actorId?:string;
  kind:'smoke'|'flash'|'incendiary'|'he';
  target:FpsPoint;
  watch?:FpsPoint;
  lineupId?:string;
  purpose:'lane_smoke'|'execute_smoke'|'corner_burn'|'entry_flash'|'choke_he'|'retake_smoke'|'retake_flash';
  label:string;
  completed?:boolean;
}

export interface LiveInformationOrder {
  mode:'hold'|'watch'|'reinforce'|'rotate'|'recheck'|'probe'|'execute';site?:'A'|'B';
  lifecycle?:LiveCallLifecycle;
  responders:string[];until:number;strength:number;reason:string;readyAt?:number;
  issuedAt?:number;callerId?:string;point?:FpsPoint;
  executePhase?:'regroup'|'utility'|'breach';phaseAt?:number;smokesSent?:number;flashSent?:boolean;flashesSent?:number;flashPhaseAt?:number;breachAt?:number;
  smokeLineupOrder?:string[];smokeLineupDone?:string[];
  entryId?:string;lanes?:Record<string,number>;nextUtilityAt?:number;
  setPiece?:string;
  utilityPlan?:LiveCallUtilityAssignment[];
  mollySent?:boolean;
  heSent?:boolean;
  /** Backed by commitment evidence (losses, the device, every opponent located): responders go without second-guessing. */
  firm?:boolean;
}
export function liveOrderActive(order:LiveInformationOrder,now:number):boolean {
  return now>=(order.readyAt??0)&&now<order.until;
}

export interface LiveRoundHistory {
  round: number;
  attackSite: 'A'|'B';
  tactic: LiveTacticArchetype;
  defenseSetup?:LiveDefenseSetup;
  firstBloodSite?: 'A'|'B'|'Mid';
  bombPlanted: boolean;
  winner: 'blue'|'red';
  attackTeam?: 'blue'|'red';
}

/** Completed rounds only: discount repetition and failed calls without excluding any play. */
export function chooseLiveTactic(
  history:readonly LiveRoundHistory[],
  team:'blue'|'red',
  pistol:boolean,
  random:()=>number,
  plan?:Partial<FpsGameplan>,
  enemyAggression?:{A:number;B:number;Mid:number},
  callerTendencies?:FpsTendencyValues,
  enemyRead?:LiveEnemyEconomyRead,
):LiveTacticArchetype {
  const choices=LIVE_TACTIC_CHOICES,weights=liveTacticWeights(history,team,pistol,plan,enemyAggression,callerTendencies,enemyRead);
  let roll=random()*weights.reduce((a,b)=>a+b,0);
  return choices.find((_,index)=>(roll-=weights[index])<0)??choices[choices.length-1];
}
export const LIVE_TACTIC_CHOICES:readonly LiveTacticArchetype[]=['rush_a','rush_b','default_pick','split_a','split_b','fake_execute','mid_control'];
/** Decision weights per archetype (gameplan, IGL tendencies, lawful enemy reads, recent repetition). */
export function liveTacticWeights(
  history:readonly LiveRoundHistory[],team:'blue'|'red',pistol:boolean,plan?:Partial<FpsGameplan>,
  enemyAggression?:{A:number;B:number;Mid:number},callerTendencies?:FpsTendencyValues,enemyRead?:LiveEnemyEconomyRead,
):number[] {
  const recent=history.filter(h=>h.attackTeam===team).slice(-5);
  const choices=LIVE_TACTIC_CHOICES;
  const tempo=plan?.tempo??.5,aggression=plan?.aggression??.5,prep=plan?.preparation??.5,freedom=plan?.freedom??.5;
  const igl=callerTendencies;
  const tUnit=(k:string)=>(igl?.[k]??50)/100;
  const variation=igl?(.45+tUnit('strategyVariation')*.75):1;
  const weights=choices.map(tactic=>{
    let weight=pistol?(tactic.startsWith('rush')?2:1):1;
    if(tactic==='rush_a'||tactic==='rush_b')weight*=(0.7+tempo*.38+aggression*.32)*(igl?0.65+tUnit('rushCalling')*.75:1);
    else if(tactic==='default_pick')weight*=(0.75+prep*.45+(1-tempo)*.2)*(igl?0.65+(tUnit('defaultPreference')+tUnit('structuredCalling'))*.38+(tUnit('informationDemand')-.5)*.25+(tUnit('sniperPriority')-.5)*.2:1);
    else if(tactic==='split_a'||tactic==='split_b')weight*=(0.8+prep*.3+aggression*.25)*(igl?0.65+(tUnit('splitCalling')+tUnit('tacticalComplexity'))*.38+(tUnit('tempoControl')-.5)*.22:1);
    else if(tactic==='fake_execute')weight*=(0.75+freedom*.45+prep*.2)*(igl?0.60+tUnit('fakeCalling')*.85+(tUnit('tempoControl')-.5)*.22:1);
    else if(tactic==='mid_control')weight*=(0.8+freedom*.3+aggression*.25)*(igl?0.65+(tUnit('mapControlCalling')+tUnit('pickBasedCalling'))*.38+(tUnit('informationDemand')-.5)*.25+(tUnit('sniperPriority')-.5)*.2:1);
    if(enemyAggression){
      if(tactic==='rush_a'&&enemyAggression.A>=2)weight*=0.62;
      if(tactic==='rush_b'&&enemyAggression.B>=2)weight*=0.62;
      if((tactic==='mid_control'||tactic==='fake_execute')&&(enemyAggression.A+enemyAggression.B)>=3)weight*=1.25;
    }
    if(enemyRead&&!pistol){
      if(enemyRead.stackLikely||enemyRead.tier==='broke_eco'||enemyRead.tier==='half_force'){
        if(tactic==='rush_a'||tactic==='rush_b')weight*=0.68;
        if(tactic==='default_pick'||tactic==='mid_control')weight*=1.28;
        if(tactic==='split_a'||tactic==='split_b')weight*=1.15;
      }
      if(enemyRead.lowUtilityLikely&&(tactic==='split_a'||tactic==='split_b'))weight*=1.18;
      if(enemyRead.awpLikely){
        if(tactic==='fake_execute'||tactic==='split_a'||tactic==='split_b')weight*=1.14;
        if(tactic==='mid_control')weight*=0.88;
      }
    }
    for(const [index,round] of recent.entries())if(round.tactic===tactic){
      const recency=(index+1)/recent.length;
      const discount=(round.winner===team?.35:.7)*variation;
      weight*=Math.max(.18,1-recency*discount);
    }
    return Math.max(.12,weight);
  });
  return weights;
}

/** Vary the opening CT formation while biasing toward only confirmed opponent plants. */
export function chooseLiveDefenseSetup(
  history:readonly LiveRoundHistory[],
  attackTeam:'blue'|'red',
  confirmedPlants:{A:number;B:number},
  random:()=>number,
  firstBloods?:{A:number;B:number;Mid:number},
  plan?:Partial<FpsGameplan>,
  callerTendencies?:FpsTendencyValues,
  enemyRead?:LiveEnemyEconomyRead,
):LiveDefenseSetup {
  const weighted=liveDefenseWeights(history,attackTeam,confirmedPlants,firstBloods,plan,callerTendencies,enemyRead);
  const total=weighted.reduce((sum,item)=>sum+item.weight,0);
  let roll=random()*total;
  return weighted.find(item=>(roll-=item.weight)<0)?.setup??weighted[0]?.setup??'standard';
}
export const LIVE_DEFENSE_CHOICES:readonly LiveDefenseSetup[]=['standard','stack_a','stack_b','aggressive_banana','mid_push','retake_setup'];
/** Decision weights per setup; the previous round's setup is excluded (weight absent). */
export function liveDefenseWeights(
  history:readonly LiveRoundHistory[],attackTeam:'blue'|'red',confirmedPlants:{A:number;B:number},
  firstBloods?:{A:number;B:number;Mid:number},plan?:Partial<FpsGameplan>,callerTendencies?:FpsTendencyValues,enemyRead?:LiveEnemyEconomyRead,
):{setup:LiveDefenseSetup;weight:number}[] {
  const recent=history.filter(round=>round.attackTeam===attackTeam).slice(-5);
  const previous=recent.at(-1)?.defenseSetup;
  const available=LIVE_DEFENSE_CHOICES.filter(setup=>setup!==previous);
  const aggression=plan?.aggression??.5,structure=plan?.structure??.5,economy=plan?.economy??.5;
  const igl=callerTendencies,tUnit=(k:string)=>(igl?.[k]??50)/100;
  const weighted=available.map(setup=>{
    const repeatCount=recent.slice(-3).filter(round=>round.defenseSetup===setup).length;
    let weight=1;
    if(setup==='stack_a')weight+=Math.min(1.8,Math.max(0,confirmedPlants.A-1)*.65)+(firstBloods&&firstBloods.A>=2?.35:0)+(igl?(tUnit('riskCalling')-.5)*.45:0);
    if(setup==='stack_b')weight+=Math.min(1.8,Math.max(0,confirmedPlants.B-1)*.65)+(firstBloods&&firstBloods.B>=2?.35:0)+(igl?(tUnit('riskCalling')-.5)*.45:0);
    if(setup==='aggressive_banana')weight*=(.82+aggression*.48)*(igl?.65+(tUnit('leadFromFront')+tUnit('opportunityCalling'))*.38+(tUnit('informationDemand')-.5)*.25:1);
    if(setup==='mid_push')weight=(1.05+(firstBloods&&firstBloods.Mid>=1?.3:0))*(.85+aggression*.35)*(igl?.65+(tUnit('mapControlCalling')+tUnit('pickBasedCalling'))*.38+(tUnit('informationDemand')-.5)*.25:1);
    if(setup==='retake_setup')weight=.95*(.8+structure*.3+economy*.2)*(igl?.65+(tUnit('saveCalling')+tUnit('structuredCalling'))*.38+(tUnit('teamProtection')-.5)*.25:1);
    if(setup==='standard')weight*=(.9+structure*.3)*(igl?.7+tUnit('defaultPreference')*.6+(tUnit('teamProtection')-.5)*.25+(tUnit('sniperPriority')-.5)*.2:1);
    if(enemyRead){
      if(enemyRead.antiEcoWindow||enemyRead.tier==='broke_eco'){
        if(setup==='standard')weight*=1.22;
        if(setup==='retake_setup')weight*=1.12;
        if(setup==='aggressive_banana')weight*=0.85;
      }else if(enemyRead.tier==='half_force'&&setup==='mid_push'){
        weight*=1.15;
      }
    }
    weight*=repeatCount===0?1:repeatCount===1?.38:.16;
    return {setup,weight};
  });
  return weighted;
}

export interface LiveAttackProtocol {
  style:LiveAttackStyle;phase:LiveAttackPhase;site:'A'|'B';phaseAt:number;
  archetype?:LiveTacticArchetype;defenseSetup?:LiveDefenseSetup;
}
export function createLiveProtocol(site:'A'|'B',now:number,archetype?:LiveTacticArchetype,defenseSetup?:LiveDefenseSetup):LiveAttackProtocol {
  return {style:'adaptive',phase:'default',site,phaseAt:now,archetype,defenseSetup};
}
