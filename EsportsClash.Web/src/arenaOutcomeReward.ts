import config from './data/arenaOutcomeRewardV2.json' with {type:'json'};
import type {TeamTaskSnapshot} from './teamTaskOutcome';

export const ARENA_OUTCOME_REWARD_VERSION='terminal-potential-outcomes-v2';
export const ARENA_OUTCOME_REWARD=config;
export type ArenaOutcomeSnapshot=TeamTaskSnapshot&{outcomes:{
  ownStructureLoss:number;enemyStructureLoss:number;ownMana:number;enemyMana:number;
  dragonSecures:number;siegeSecures:number;
}};
export const ARENA_OUTCOME_COMPONENTS=['structures','economy','trades','health','dragon','siege','mana'] as const;
const clamp=(v:number)=>Math.max(-1,Math.min(1,v));

/** Fractional, capped damage to the real structure roster. Moving to a
 * structure, attempted protected damage and overkill do not change progress. */
export function arenaStructureLoss(structures:readonly {type:string;hp:number;maxHp:number;isAlive:boolean}[]):number {
  let damage=0,total=0;
  for(const s of structures){
    if(!Number.isFinite(s.hp)||!Number.isFinite(s.maxHp)||s.maxHp<=0)throw Error('Invalid structure reward input');
    const weight=config.structure_weights[s.type as keyof typeof config.structure_weights]??1;
    total+=weight;damage+=weight*(s.isAlive?Math.max(0,Math.min(1,1-s.hp/s.maxHp)):1);
  }
  return total?damage/total:0;
}

/** Privileged outcomes are critic/reward data only, never actor features. */
export function arenaOutcomeCriticState(s:TeamTaskSnapshot):number[]{
  const extra=(s as ArenaOutcomeSnapshot).outcomes;
  if(!extra||!Object.values(extra).every(Number.isFinite))throw Error('Missing/nonfinite arena outcome snapshot');
  const state=[extra.enemyStructureLoss-extra.ownStructureLoss,(s.ownEconomy-s.enemyEconomy)/config.economy_scale,
    (s.enemyDeaths-s.ownDeaths)/config.death_scale,(s.ownHealth-s.enemyHealth)/5,
    extra.dragonSecures/config.objective_scale,extra.siegeSecures/config.objective_scale,(extra.ownMana-extra.enemyMana)/5];
  if(!state.every(Number.isFinite))throw Error('Nonfinite arena team outcome');
  return state.map(clamp);
}
export function arenaOutcomePotential(s:TeamTaskSnapshot):number {
  const state=arenaOutcomeCriticState(s);
  return ARENA_OUTCOME_COMPONENTS.reduce((sum,key,i)=>sum+config.potential_weights[key]*state[i],0);
}
export function arenaOutcomeReward(start:TeamTaskSnapshot,end:TeamTaskSnapshot,terminal:boolean,winner?:boolean){
  const elapsed=end.second-start.second;
  if(!Number.isFinite(elapsed)||elapsed<0||(terminal&&typeof winner!=='boolean'))throw Error('Invalid arena reward interval/outcome');
  const before=arenaOutcomeCriticState(start),after=arenaOutcomeCriticState(end),discount=config.gamma_second**elapsed;
  const progress=Object.fromEntries(ARENA_OUTCOME_COMPONENTS.map((key,i)=>[key,
    config.potential_weights[key]*(discount*(terminal?0:after[i])-before[i])])) as Record<typeof ARENA_OUTCOME_COMPONENTS[number],number>;
  const shaping=Object.values(progress).reduce((sum,v)=>sum+v,0),outcome=terminal?discount*(winner?config.terminal_win:-config.terminal_win):0;
  return {reward:outcome+shaping,discount,rewardVersion:ARENA_OUTCOME_REWARD_VERSION,
    components:{outcome,shaping,...progress}};
}
