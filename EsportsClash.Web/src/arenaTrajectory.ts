import { criticState,transitionReward } from './intelligencePolicy.ts';
import type { TeamTaskSnapshot } from './teamTaskOutcome.ts';
import type { ArenaCommand,ArenaActor } from './arenaLearning.ts';
import {ArenaMasteryLedger} from './arenaIdentity.ts';
import {ARENA_OUTCOME_REWARD_VERSION,arenaOutcomeReward,arenaOutcomeCriticState} from './arenaOutcomeReward.ts';
export class ArenaTrajectory {
  mastery=new ArenaMasteryLedger();
  secures={blue:{dragon:0,siege:0},red:{dragon:0,siege:0}};
  pending=new Map<string,{actor:string;team:'blue'|'red';second:number;candidates:number[][];action:number;logp:number;
    state:number[];start:TeamTaskSnapshot;command:string;targetId?:string;executed:boolean;
    identity?:{avatarId:string;cardId:string;cardName:string};masteryPotential?:number}>();
  rows:unknown[]=[];
  next:Record<string,number>={};
  commands:Record<string,ArenaCommand|undefined>={};
  executed=new Set<string>();
  counters={decisions:0,executed:0,byAction:{} as Record<string,number>,legacyDecisions:0};
  policies:Partial<Record<'blue'|'red',ArenaActor>>;
  training:boolean;
  rewardVersion:string;
  constructor(policies:Partial<Record<'blue'|'red',ArenaActor>>,training:boolean,rewardVersion='terminal-potential-v1'){
    if(!['terminal-potential-v1',ARENA_OUTCOME_REWARD_VERSION].includes(rewardVersion))throw Error('Unsupported arena reward version');
    this.policies=policies;this.training=training;this.rewardVersion=rewardVersion;
  }
  usesOutcomeReward(team:'blue'|'red'){return this.rewardVersion===ARENA_OUTCOME_REWARD_VERSION&&this.policies[team]?.version===3;}
  critic(s:TeamTaskSnapshot,team:'blue'|'red'){return this.usesOutcomeReward(team)?arenaOutcomeCriticState(s):criticState(s);}
  settle(actor:string,end:TeamTaskSnapshot,terminal=false,winner?:boolean,masteryPotential=0){
    const previous=this.pending.get(actor);if(!previous)return;
    this.pending.delete(actor);
    // A later actor can finish the Nexus on this same fixed tick. Keep that
    // legitimate zero-duration terminal transition instead of losing the win.
    if(this.training&&(end.second>previous.second||(terminal&&end.second===previous.second))){
      const reward=this.usesOutcomeReward(previous.team)?arenaOutcomeReward(previous.start,end,terminal,winner):transitionReward(previous.start,end,terminal,winner);
      const mastery=previous.masteryPotential===undefined?0:reward.discount*(terminal?0:masteryPotential)-previous.masteryPotential;
      this.rows.push({...previous,nextState:previous.masteryPotential===undefined?this.critic(end,previous.team):[...criticState(end),terminal?0:masteryPotential/.08],terminal,
        ...reward,reward:reward.reward+mastery,components:{...reward.components,mastery},elapsed:end.second-previous.second});
    }
  }
  drain(){const rows=this.rows;this.rows=[];return {rows,counters:structuredClone(this.counters)};}
}
