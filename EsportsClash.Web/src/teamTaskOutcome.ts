import type { TaskOutcome } from './taskOutcome.ts';

export interface TeamTaskSnapshot {
  second: number; ownDeaths: number; enemyDeaths: number;
  ownStructureHp: number; enemyStructureHp: number;
  ownEconomy: number; enemyEconomy: number; ownHealth: number; enemyHealth: number;
  dragonBalance: number; siegeBalance: number; ownNexusAlive: boolean; enemyNexusAlive: boolean;
}
export interface TeamTaskOutcome {
  objective: 'team-v1'; horizonSeconds: number; start: TeamTaskSnapshot; end: TeamTaskSnapshot;
  actorTask: TaskOutcome; ownDeaths: number; enemyDeaths: number;
  components: { deaths: number; structures: number; economy: number; health: number;
    dragon: number; siege: number; actor: number };
  reward: number;
}
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
export const TEAM_TASK_REWARD = { deaths: .55, structures: .15, economy: .1,
  health: .05, dragon: .025, siege: .025, actor: .1,
  structureScale: 1000, economyScale: 750, healthScale: 2, siegeScale: 2 } as const;
type Unit = { team: 'blue' | 'red'; deaths: number; isAlive: boolean; hp: number; maxHp: number;
  gold: number; items: readonly { cost: number }[]; boots?: { cost: number } };

/** Outcome labels may observe the whole world; they are never decision features. */
export function captureTeamTaskSnapshot(input: {
  second: number; team: 'blue' | 'red'; champions: readonly Unit[];
  structures: readonly { team: 'blue' | 'red'; type: string; hp: number; isAlive: boolean }[];
  dragonTeam?: 'blue' | 'red'; siegeUnits: readonly { team: 'blue' | 'red'; isAlive: boolean; siegeGolem?: boolean }[];
}): TeamTaskSnapshot {
  const units = (own: boolean) => input.champions.filter(unit => (unit.team === input.team) === own);
  const structures = (own: boolean) => input.structures.filter(unit => (unit.team === input.team) === own);
  const total = (own: boolean, read: (unit: Unit) => number) => units(own).reduce((sum, unit) => sum + read(unit), 0);
  const economy = (unit: Unit) => unit.gold + unit.items.reduce((sum, item) => sum + item.cost, 0) + (unit.boots?.cost ?? 0);
  const health = (unit: Unit) => unit.isAlive ? Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp))) : 0;
  return { second: input.second, ownDeaths: total(true, unit => unit.deaths), enemyDeaths: total(false, unit => unit.deaths),
    ownStructureHp: structures(true).reduce((sum, structure) => sum + Math.max(0, structure.hp), 0),
    enemyStructureHp: structures(false).reduce((sum, structure) => sum + Math.max(0, structure.hp), 0),
    ownEconomy: total(true, economy), enemyEconomy: total(false, economy),
    ownHealth: total(true, health), enemyHealth: total(false, health),
    dragonBalance: input.dragonTeam ? input.dragonTeam === input.team ? 1 : -1 : 0,
    siegeBalance: input.siegeUnits.filter(unit => unit.isAlive && unit.siegeGolem)
      .reduce((sum, unit) => sum + (unit.team === input.team ? 1 : -1), 0),
    ownNexusAlive: structures(true).some(structure => structure.type === 'nexus' && structure.isAlive),
    enemyNexusAlive: structures(false).some(structure => structure.type === 'nexus' && structure.isAlive) };
}

const validSnapshot = (item: TeamTaskSnapshot) => item && Object.entries(item).every(([key, value]) =>
  key.endsWith('NexusAlive') ? typeof value === 'boolean' : Number.isFinite(value))
  && ['second', 'ownDeaths', 'enemyDeaths', 'ownStructureHp', 'enemyStructureHp', 'ownEconomy', 'enemyEconomy',
    'ownHealth', 'enemyHealth', 'dragonBalance', 'siegeBalance'].every(key => Number.isFinite(item[key as keyof TeamTaskSnapshot]))
  && typeof item.ownNexusAlive === 'boolean' && typeof item.enemyNexusAlive === 'boolean'
  && Number.isInteger(item.ownDeaths) && Number.isInteger(item.enemyDeaths)
  && item.ownDeaths >= 0 && item.enemyDeaths >= 0 && Number.isInteger(item.dragonBalance) && Math.abs(item.dragonBalance) <= 1
  && Number.isInteger(item.siegeBalance)
  && item.ownHealth <= 5 && item.enemyHealth <= 5
  && [item.ownStructureHp, item.enemyStructureHp, item.ownEconomy, item.enemyEconomy, item.ownHealth, item.enemyHealth]
    .every(value => value >= 0);

/** Authored, fixed team proxy; identical actor credit can now distinguish a teammate/tower loss. */
export function summarizeTeamTaskOutcome(start: TeamTaskSnapshot, end: TeamTaskSnapshot,
  actorTask: TaskOutcome): TeamTaskOutcome | undefined {
  if (!validSnapshot(start) || !validSnapshot(end) || !actorTask || !Number.isFinite(actorTask.reward)
    || Math.abs(actorTask.reward) > 1 || !Number.isInteger(actorTask.deaths) || actorTask.deaths < 0
    || ![actorTask.campGold, actorTask.waveGold, actorTask.structureDamage].every(value => Number.isFinite(value) && value >= 0)
    || ![actorTask.campClears, actorTask.minionKills].every(value => Number.isInteger(value) && value >= 0)
    || (actorTask.firstCompletionSeconds !== null && (!Number.isFinite(actorTask.firstCompletionSeconds)
      || actorTask.firstCompletionSeconds < 0 || actorTask.firstCompletionSeconds > actorTask.horizonSeconds))
    || actorTask.reward !== (actorTask.deaths > 0 ? -1 : Math.min(1,
      Math.min(1, (actorTask.campGold + actorTask.waveGold) / 250) * .6
      + Math.min(1, actorTask.structureDamage / 600) * .4))
    || end.second - start.second < 3 || end.second - start.second > 30.1
    || Math.abs(end.second - start.second - actorTask.horizonSeconds) > 1e-6
    || end.ownDeaths < start.ownDeaths || end.enemyDeaths < start.enemyDeaths
    || end.ownDeaths - start.ownDeaths < actorTask.deaths) return undefined;
  const ownDeaths = end.ownDeaths - start.ownDeaths, enemyDeaths = end.enemyDeaths - start.enemyDeaths;
  const margin = (item: TeamTaskSnapshot, own: keyof TeamTaskSnapshot, enemy: keyof TeamTaskSnapshot) =>
    Number(item[own]) - Number(item[enemy]);
  const change = (own: keyof TeamTaskSnapshot, enemy: keyof TeamTaskSnapshot) => margin(end, own, enemy) - margin(start, own, enemy);
  const weights = TEAM_TASK_REWARD;
  const components = {
    deaths: weights.deaths * clamp(enemyDeaths - ownDeaths),
    structures: weights.structures * clamp(change('ownStructureHp', 'enemyStructureHp') / weights.structureScale),
    economy: weights.economy * clamp(change('ownEconomy', 'enemyEconomy') / weights.economyScale),
    health: weights.health * clamp(change('ownHealth', 'enemyHealth') / weights.healthScale),
    dragon: weights.dragon * clamp(end.dragonBalance - start.dragonBalance),
    siege: weights.siege * clamp((end.siegeBalance - start.siegeBalance) / weights.siegeScale),
    actor: weights.actor * actorTask.reward,
  };
  const terminal = !end.enemyNexusAlive && end.ownNexusAlive ? 1 : !end.ownNexusAlive && end.enemyNexusAlive ? -1 : undefined;
  return { objective: 'team-v1', horizonSeconds: end.second - start.second,
    start: structuredClone(start), end: structuredClone(end), actorTask: structuredClone(actorTask), ownDeaths, enemyDeaths,
    components, reward: terminal ?? clamp(Object.values(components).reduce((sum, value) => sum + value, 0)) };
}

export function validTeamTaskOutcome(item: TeamTaskOutcome): boolean {
  if (!item || item.objective !== 'team-v1') return false;
  const expected = summarizeTeamTaskOutcome(item.start, item.end, item.actorTask);
  return !!expected && JSON.stringify(expected) === JSON.stringify(item);
}
