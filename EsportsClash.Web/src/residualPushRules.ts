import { estimateTacticalOutlook } from './tacticalOutlook.ts';
import type { InfluenceRead, SpatialPoint } from './spatialInfluence.ts';

type PointTarget = SpatialPoint & { id: string };
type AttackTarget = PointTarget & { hp: number; maxHp: number };
export type ResidualPushPlan = { kind: 'structure' | 'minion'; target: AttackTarget }
  | { kind: 'camp-exit' | 'advance'; target: PointTarget };

/** Owners supply only already-legal, in-range attacks and the bounded lane route. */
export function planResidualPush(input: {
  structureInRange?: AttackTarget;
  minionInRange?: AttackTarget;
  campExit?: PointTarget;
  laneDestination: PointTarget;
}): ResidualPushPlan {
  if (input.structureInRange) return { kind: 'structure', target: input.structureInRange };
  if (input.minionInRange) return { kind: 'minion', target: input.minionInRange };
  if (input.campExit) return { kind: 'camp-exit', target: input.campExit };
  return { kind: 'advance', target: input.laneDestination };
}

/** Score the executor's work. Walking is not an attack on a distant building. */
export function evaluateResidualPush(input: {
  plan: ResidualPushPlan;
  actor: SpatialPoint & { hp: number; maxHp: number };
  attackRange: number;
  travelSpeed: number;
  nearbyAllies: number;
  nearbyEnemies: number;
  influence: { at: (point: SpatialPoint) => InfluenceRead;
    approach: (from: SpatialPoint, to: SpatialPoint) => InfluenceRead };
}): { tactical: number; danger: number } {
  const approach = input.influence.approach(input.actor, input.plan.target);
  if (input.plan.kind === 'structure' || input.plan.kind === 'minion') {
    const outlook = estimateTacticalOutlook({ actor: input.actor, target: input.plan.target,
      travelSpeed: input.travelSpeed, interactionRange: input.attackRange,
      nearbyAllies: input.nearbyAllies, nearbyEnemies: input.nearbyEnemies,
      approachThreat: approach.threat, approachCover: approach.cover });
    return { tactical: Math.max(input.plan.kind === 'structure' ? .5 : .18, outlook.pressure),
      danger: 1 - outlook.survival };
  }
  return { tactical: .18, danger: Math.max(input.influence.at(input.actor).threat, approach.threat) };
}
