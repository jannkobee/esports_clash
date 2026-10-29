import { loadAIStrategyConfig, type AIStrategyConfig } from './aiStrategyConfig.ts';
import type { AdaptiveAction } from './adaptivePolicy.ts';
import type { TeamTaskSnapshot } from './teamTaskOutcome.ts';
import { loadArenaActor, type ArenaActor } from './arenaLearning.ts';

export const INTELLIGENCE_ACTIONS: readonly AdaptiveAction[] = ['fight', 'wave', 'regroup', 'farm', 'push'];
export const OBSERVATION_SIZE = 20;
export interface NeuralPolicy { kind: 'macro-actor'; version: 1; input: 20; hidden: 16;
  w1: number[][]; b1: number[]; w2: number[][]; b2: number[] }
/** Deliberately limited source language: affine action preferences only. */
export interface ProgramPolicy { kind: 'macro-program'; version: 1; weights: number[][]; bias: number[] }
export type IntelligencePolicy = AIStrategyConfig | NeuralPolicy | ProgramPolicy | ArenaActor;
const vector = (raw: unknown, n: number): raw is number[] => Array.isArray(raw) && raw.length === n
  && raw.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 20);
const matrix = (raw: unknown, n: number, m: number): raw is number[][] => Array.isArray(raw)
  && raw.length === n && raw.every(row => vector(row, m));
export function loadIntelligencePolicy(raw: unknown): IntelligencePolicy | undefined {
  const arena=loadArenaActor(raw);if(arena)return arena;
  const config = loadAIStrategyConfig(raw); if (config) return config;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const p = raw as unknown as NeuralPolicy & { weights: number[][]; bias: number[]; kind: string };
  if (p.version !== 1) return undefined;
  if (p.kind === 'macro-actor' && Object.keys(p).length === 8 && p.input === 20 && p.hidden === 16
    && matrix(p.w1, 16, 20) && vector(p.b1, 16) && matrix(p.w2, 5, 16) && vector(p.b2, 5)) return structuredClone(p);
  const program = raw as ProgramPolicy;
  if (program.kind === 'macro-program' && Object.keys(program).length === 4
    && matrix(program.weights, 5, 20) && vector(program.bias, 5)) return structuredClone(program);
  return undefined;
}
const clamp = (n: number) => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
/** An explicit observation boundary. Never accept an authoritative enemy object. */
export function intelligenceObservation(own: { hp: number; mana: number; x: number; y: number;
  level: number; iq: number; aggression: number; discipline: number; gold: number;
  cooldowns: readonly number[]; role: string }, visible: readonly { x: number; y: number; hp: number; level: number }[],
  context: { threat: number; survival: number; second: number; allies: number }): number[] {
  const nearest = [...visible].sort((a, b) => Math.hypot(a.x-own.x,a.y-own.y)-Math.hypot(b.x-own.x,b.y-own.y))[0];
  return [own.hp, own.mana, own.x/2000, own.y/1200, own.level/18, own.iq/100,
    own.aggression/100, own.discipline/100, own.gold/10000,
    ...Array.from({length:4},(_,i)=>(own.cooldowns[i]??0)/120), visible.length/5,
    nearest ? Math.hypot(nearest.x-own.x,nearest.y-own.y)/2000 : 1,
    nearest?.hp??0, context.threat, context.survival, context.second/1200,
    (['tank','fighter','assassin','mage','marksman','support'].indexOf(own.role.toLowerCase())+1)/6
  ].map(clamp);
}
export function policyLogits(p: NeuralPolicy | ProgramPolicy, observation: readonly number[]): number[] {
  if (observation.length !== 20 || !observation.every(Number.isFinite)) throw Error('Invalid actor observation');
  const affine = (w: number[][], b: number[], x: readonly number[]) => w.map((row,i)=>row.reduce((v,c,j)=>v+c*x[j],b[i]));
  return p.kind === 'macro-program' ? affine(p.weights,p.bias,observation)
    : affine(p.w2,p.b2,affine(p.w1,p.b1,observation).map(Math.tanh));
}
export function chooseIntelligenceAction(p: NeuralPolicy | ProgramPolicy, observation: number[],
  legal: readonly AdaptiveAction[], draw?: number) {
  const mask = INTELLIGENCE_ACTIONS.map(a=>legal.includes(a));
  if (!mask.some(Boolean)) throw Error('No legal macro action');
  const logits = policyLogits(p,observation); const max=Math.max(...logits.filter((_,i)=>mask[i]));
  const values=logits.map((v,i)=>mask[i]?Math.exp(v-max):0), total=values.reduce((a,b)=>a+b,0);
  const probabilities=values.map(v=>v/total);
  let index=probabilities.indexOf(Math.max(...probabilities));
  if (draw !== undefined) { if (!(draw>=0&&draw<1)) throw Error('Invalid sampling draw');
    let c=0; index=probabilities.findIndex(v=>(c+=v)>draw); }
  return { action:INTELLIGENCE_ACTIONS[index], index, mask, logp:Math.log(probabilities[index]) };
}
/** Central critic only. This privileged state never enters policyLogits. */
export function criticState(s: TeamTaskSnapshot): number[] {
  return [(s.enemyDeaths-s.ownDeaths)/20,(s.ownStructureHp-s.enemyStructureHp)/10000,
    (s.ownEconomy-s.enemyEconomy)/50000,(s.ownHealth-s.enemyHealth)/5,s.dragonBalance,s.siegeBalance/2].map(clamp);
}
export const RL_REWARD_VERSION = 'terminal-potential-v1';
export const RL_GAMMA = .999;
export function potential(s: TeamTaskSnapshot): number {
  const x=criticState(s); return .55*x[0]+.15*x[1]+.1*x[2]+.05*x[3]+.025*x[4]+.025*x[5];
}
export function transitionReward(start: TeamTaskSnapshot,end: TeamTaskSnapshot,terminal: boolean,winner?: boolean) {
  const discount=RL_GAMMA**Math.max(0,end.second-start.second);
  const outcome=terminal?discount*(winner?1:-1):0;
  const shaping=discount*(terminal?0:potential(end))-potential(start);
  return {reward:outcome+shaping,discount,components:{outcome,shaping}};
}
