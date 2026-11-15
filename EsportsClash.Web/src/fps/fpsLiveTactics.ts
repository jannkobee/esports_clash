import type { FpsGameplan } from './fpsIdentity.ts';

export type LiveAttackStyle='adaptive';
export type LiveAttackPhase='default'|'entry'|'post-plant';
export type LiveTacticArchetype='rush_b'|'rush_a'|'default_pick'|'split_b'|'split_a'|'fake_execute'|'mid_control';
export type LiveDefenseSetup='standard'|'stack_b'|'stack_a'|'aggressive_banana'|'mid_push'|'retake_setup';

export interface LiveInformationOrder {
  mode:'hold'|'watch'|'reinforce'|'rotate'|'recheck'|'probe'|'execute';site?:'A'|'B';
  responders:string[];until:number;strength:number;reason:string;readyAt?:number;
  issuedAt?:number;callerId?:string;point?:{x:number;z:number};
  executePhase?:'regroup'|'utility'|'breach';phaseAt?:number;smokesSent?:number;flashSent?:boolean;breachAt?:number;
  smokeLineupOrder?:string[];smokeLineupDone?:string[];
  entryId?:string;lanes?:Record<string,number>;nextUtilityAt?:number;
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
):LiveTacticArchetype {
  const recent=history.filter(h=>h.attackTeam===team).slice(-5);
  const choices:LiveTacticArchetype[]=['rush_a','rush_b','default_pick','split_a','split_b','fake_execute','mid_control'];
  const tempo=plan?.tempo??.5,aggression=plan?.aggression??.5,prep=plan?.preparation??.5,freedom=plan?.freedom??.5;
  const weights=choices.map(tactic=>{
    let weight=pistol?(tactic.startsWith('rush')?2:1):1;
    if(tactic==='rush_a'||tactic==='rush_b')weight*=0.7+tempo*.38+aggression*.32;
    else if(tactic==='default_pick')weight*=0.75+prep*.45+(1-tempo)*.2;
    else if(tactic==='split_a'||tactic==='split_b')weight*=0.8+prep*.3+aggression*.25;
    else if(tactic==='fake_execute')weight*=0.75+freedom*.45+prep*.2;
    else if(tactic==='mid_control')weight*=0.8+freedom*.3+aggression*.25;
    if(enemyAggression){
      if(tactic==='rush_a'&&enemyAggression.A>=2)weight*=0.62;
      if(tactic==='rush_b'&&enemyAggression.B>=2)weight*=0.62;
      if((tactic==='mid_control'||tactic==='fake_execute')&&(enemyAggression.A+enemyAggression.B)>=3)weight*=1.25;
    }
    for(const [index,round] of recent.entries())if(round.tactic===tactic){
      const recency=(index+1)/recent.length;
      weight*=1-recency*(round.winner===team?.35:.7);
    }
    return Math.max(.12,weight);
  });
  let roll=random()*weights.reduce((a,b)=>a+b,0);
  return choices.find((_,index)=>(roll-=weights[index])<0)??choices[choices.length-1];
}

/** Vary the opening CT formation while biasing toward only confirmed opponent plants. */
export function chooseLiveDefenseSetup(
  history:readonly LiveRoundHistory[],
  attackTeam:'blue'|'red',
  confirmedPlants:{A:number;B:number},
  random:()=>number,
  firstBloods?:{A:number;B:number;Mid:number},
  plan?:Partial<FpsGameplan>,
):LiveDefenseSetup {
  const recent=history.filter(round=>round.attackTeam===attackTeam).slice(-5);
  const previous=recent.at(-1)?.defenseSetup;
  const choices:LiveDefenseSetup[]=['standard','stack_a','stack_b','aggressive_banana','mid_push','retake_setup'];
  const available=choices.filter(setup=>setup!==previous);
  const aggression=plan?.aggression??.5,structure=plan?.structure??.5,economy=plan?.economy??.5;
  const weighted=available.map(setup=>{
    const repeatCount=recent.slice(-3).filter(round=>round.defenseSetup===setup).length;
    let weight=1;
    if(setup==='stack_a')weight+=Math.min(1.8,Math.max(0,confirmedPlants.A-1)*.65)+(firstBloods&&firstBloods.A>=2?.35:0);
    if(setup==='stack_b')weight+=Math.min(1.8,Math.max(0,confirmedPlants.B-1)*.65)+(firstBloods&&firstBloods.B>=2?.35:0);
    if(setup==='aggressive_banana')weight*=.82+aggression*.48;
    if(setup==='mid_push')weight=(1.05+(firstBloods&&firstBloods.Mid>=1?.3:0))*(.85+aggression*.35);
    if(setup==='retake_setup')weight=.95*(.8+structure*.3+economy*.2);
    if(setup==='standard')weight*=.9+structure*.3;
    weight*=repeatCount===0?1:repeatCount===1?.38:.16;
    return {setup,weight};
  });
  const total=weighted.reduce((sum,item)=>sum+item.weight,0);
  let roll=random()*total;
  return weighted.find(item=>(roll-=item.weight)<0)?.setup??available[0]??'standard';
}

export interface LiveAttackProtocol {
  style:LiveAttackStyle;phase:LiveAttackPhase;site:'A'|'B';phaseAt:number;
  archetype?:LiveTacticArchetype;defenseSetup?:LiveDefenseSetup;
}
export function createLiveProtocol(site:'A'|'B',now:number,archetype?:LiveTacticArchetype,defenseSetup?:LiveDefenseSetup):LiveAttackProtocol {
  return {style:'adaptive',phase:'default',site,phaseAt:now,archetype,defenseSetup};
}
