import type { AdaptiveFeatures } from './adaptivePolicy.ts';
import type { ResidualPushPlan } from './residualPushRules.ts';

type Point = { x: number; y: number };
export const TASK_CONTEXT_KEYS = [
  'travel', 'routeDetour', 'threat', 'cover', 'allies', 'enemies', 'enemyProximity',
  'towerExposure', 'waveAllies', 'waveEnemies', 'waveDistance', 'laneDistance',
  'campKnown', 'campHealth', 'campReward', 'campIncoming', 'campClear', 'campShare',
  'campLeash', 'campEngaged', 'campHome', 'kind:structure', 'kind:minion', 'kind:camp-exit',
  'kind:advance', 'targetHealth', 'waveCrash', 'structureDistance',
  'ready1', 'ready2', 'readyUlt', 'customCaster', 'attackReady', 'basicDps', 'gameTime',
] as const;
export type TaskAction = 'farm' | 'push';
export interface TaskActionContext { version: 1; actions: Record<TaskAction, AdaptiveFeatures>; }
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const nearest = (origin: Point, points: readonly Point[], reach: number) => points.length
  ? unit(1 - Math.min(...points.map(point => distance(origin, point))) / reach) : 0;
export const isTaskFeature = (key: string) => key.startsWith('task:')
  ? (TASK_CONTEXT_KEYS as readonly string[]).includes(key.slice(5))
  : /^(bias|iq|teamfight|lane|flexibility|health|mana|roleFit|role:(Tank|Mage|Marksman|Support|Fighter|Assassin)|personality:[a-z_]+|card:[a-zA-Z0-9_-]+)$/.test(key);

/** Pure predecision observations. No labels, opponent cooldowns, RNG or executor authority. */
export function buildTaskActionContext(input: {
  features: AdaptiveFeatures; actor: Point; team: 'blue' | 'red'; seconds: number;
  attackRange: number; attackReady: boolean; basicDps: number; travelSpeed: number;
  ready1: boolean; ready2: boolean; readyUlt: boolean; customCaster: boolean;
  allies: readonly Point[]; visibleEnemies: readonly Point[];
  alliedMinions: readonly Point[]; enemyMinions: readonly Point[];
  enemyTowers: readonly (Point & { range: number })[];
  camp?: Point & { hp: number; maxHp: number; goldReward: number; ad: number;
    observed: boolean; contributors: number; engaged: boolean; leashFraction: number; home?: Point };
  campWaypoint?: Point; push: ResidualPushPlan; laneDestination: Point;
  structure?: Point; waveCrash: number;
  influence: { approach: (from: Point, to: Point) => { threat: number; cover: number } };
}): TaskActionContext {
  const contextAt = (target: Point, speed: number) => {
    const influence = input.influence.approach(input.actor, target);
    const nearby = (points: readonly Point[]) => unit(points.filter(point => distance(target, point) <= 400).length / 5);
    const values: Record<string, number> = {
      travel: unit(Math.max(0, distance(input.actor, target) - input.attackRange) / Math.max(1, speed) / 30),
      routeDetour: 0, threat: unit(influence.threat), cover: unit(influence.cover),
      allies: nearby(input.allies), enemies: nearby(input.visibleEnemies),
      enemyProximity: nearest(target, input.visibleEnemies, 700),
      towerExposure: Number(input.enemyTowers.some(tower => distance(target, tower) <= tower.range + 28)),
      waveAllies: unit(input.alliedMinions.filter(point => distance(target, point) < 300).length / 10),
      waveEnemies: unit(input.enemyMinions.filter(point => distance(target, point) < 300).length / 10),
      waveDistance: nearest(target, input.enemyMinions, 700),
      laneDistance: unit(Math.abs(target.y - input.laneDestination.y) / 500),
      ready1: Number(input.ready1), ready2: Number(input.ready2), readyUlt: Number(input.readyUlt),
      customCaster: Number(input.customCaster), attackReady: Number(input.attackReady),
      basicDps: unit(input.basicDps / 400), gameTime: unit(input.seconds / 900),
    };
    return { ...Object.fromEntries(Object.entries(input.features).filter(([key, value]) =>
      isTaskFeature(key) && !key.startsWith('task:') && Number.isFinite(value)).map(([key, value]) => [key, unit(value)])),
      ...Object.fromEntries(TASK_CONTEXT_KEYS.map(key => [`task:${key}`, unit(values[key] ?? 0)])) };
  };
  const farmTarget = input.camp && !input.camp.observed ? input.camp.home ?? input.camp : input.camp;
  const farm = contextAt(farmTarget ?? input.actor, input.travelSpeed);
  if (input.camp) {
    const camp = input.camp;
    const direct = distance(input.actor, farmTarget!);
    const route = input.campWaypoint ? distance(input.actor, input.campWaypoint) + distance(input.campWaypoint, farmTarget!) : direct;
    farm['task:travel'] = unit(Math.max(0, route - input.attackRange) / Math.max(1, input.travelSpeed) / 30);
    farm['task:routeDetour'] = unit((route - direct) / 700);
    farm['task:campKnown'] = Number(camp.observed);
    // Static reward/home are known. Live health, aggression and leash need vision.
    farm['task:campHealth'] = camp.observed ? unit(camp.hp / Math.max(1, camp.maxHp)) : 0;
    farm['task:campReward'] = unit(camp.goldReward / 150);
    farm['task:campIncoming'] = camp.observed ? unit(camp.ad / 100) : 0;
    farm['task:campClear'] = camp.observed ? unit(camp.hp / Math.max(1, input.basicDps) / 30) : 0;
    farm['task:campShare'] = camp.observed ? unit(1 / Math.max(1, camp.contributors)) : 0;
    farm['task:campLeash'] = camp.observed ? unit(camp.leashFraction) : 0;
    farm['task:campEngaged'] = Number(camp.observed && camp.engaged);
    farm['task:campHome'] = Number(input.team === 'blue' ? farmTarget!.x < 1300 : farmTarget!.x > 1300);
  }
  const push = contextAt(input.push.target, Math.max(1, input.travelSpeed - 15));
  push[`task:kind:${input.push.kind}`] = 1;
  push['task:targetHealth'] = 'hp' in input.push.target
    ? unit(input.push.target.hp / Math.max(1, input.push.target.maxHp)) : 0;
  push['task:waveCrash'] = unit(input.waveCrash / 10);
  push['task:structureDistance'] = input.structure ? unit(distance(input.actor, input.structure) / 1000) : 1;
  return { version: 1, actions: { farm, push } };
}

/** Reject incomplete/foreign snapshots rather than silently using card-only inputs. */
export function validTaskActionContext(value: unknown): value is TaskActionContext {
  if (!value || typeof value !== 'object') return false;
  const item = value as TaskActionContext;
  return item.version === 1 && !!item.actions && (['farm', 'push'] as const).every(action => {
    const features = item.actions[action];
    return !!features && typeof features === 'object' && features.bias === 1
      && TASK_CONTEXT_KEYS.every(key => typeof features[`task:${key}`] === 'number')
      && Object.keys(features).length <= 128 && Object.entries(features).every(([key, feature]) =>
        isTaskFeature(key) && Number.isFinite(feature) && feature >= 0 && feature <= 1);
  });
}
