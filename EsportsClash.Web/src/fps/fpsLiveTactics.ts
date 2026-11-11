export type LiveAttackStyle='adaptive';
export type LiveAttackPhase='default'|'entry'|'post-plant';
export type LiveTacticArchetype='rush_b'|'rush_a'|'default_pick'|'split_b'|'split_a'|'fake_execute'|'mid_control';
export type LiveDefenseSetup='standard'|'stack_b'|'stack_a'|'aggressive_banana'|'mid_push'|'retake_setup';

export interface LiveInformationOrder {
  mode:'hold'|'watch'|'reinforce'|'rotate'|'recheck'|'probe'|'execute';site?:'A'|'B';
  responders:string[];until:number;strength:number;reason:string;readyAt?:number;
  issuedAt?:number;callerId?:string;point?:{x:number;z:number};
}
export function liveOrderActive(order:LiveInformationOrder,now:number):boolean {
  return now>=(order.readyAt??0)&&now<order.until;
}

export interface LiveRoundHistory {
  round: number;
  attackSite: 'A'|'B';
  tactic: LiveTacticArchetype;
  firstBloodSite?: 'A'|'B'|'Mid';
  bombPlanted: boolean;
  winner: 'blue'|'red';
  attackTeam?: 'blue'|'red';
}

/** Completed rounds only: discount repetition and failed calls without excluding any play. */
export function chooseLiveTactic(history:readonly LiveRoundHistory[],team:'blue'|'red',pistol:boolean,random:()=>number):LiveTacticArchetype {
  const recent=history.filter(h=>h.attackTeam===team).slice(-5);
  const choices:LiveTacticArchetype[]=['rush_a','rush_b','default_pick','split_a','split_b','fake_execute','mid_control'];
  const weights=choices.map(tactic=>{
    let weight=pistol?(tactic.startsWith('rush')?2:1):1;
    for(const [index,round] of recent.entries())if(round.tactic===tactic){
      const recency=(index+1)/recent.length;
      weight*=1-recency*(round.winner===team?.35:.7);
    }
    return Math.max(.12,weight);
  });
  let roll=random()*weights.reduce((a,b)=>a+b,0);
  return choices.find((_,index)=>(roll-=weights[index])<0)??choices[choices.length-1];
}

export interface LiveAttackProtocol {
  style:LiveAttackStyle;phase:LiveAttackPhase;site:'A'|'B';phaseAt:number;
  archetype?:LiveTacticArchetype;defenseSetup?:LiveDefenseSetup;
}
export function createLiveProtocol(site:'A'|'B',now:number,archetype?:LiveTacticArchetype,defenseSetup?:LiveDefenseSetup):LiveAttackProtocol {
  return {style:'adaptive',phase:'default',site,phaseAt:now,archetype,defenseSetup};
}
