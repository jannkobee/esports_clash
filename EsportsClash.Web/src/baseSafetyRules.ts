import { WELL_RADII } from './arenaLandform.ts';
import { LANE_Y, NEXUS_X, WELL_X } from './arenaLayout.ts';

type Team = 'blue' | 'red';
type Point = { x: number; y: number };

/** One shared footprint for healing, shopping and AI recovery decisions. */
export function isInsideHealingWell(team: Team, point: Point): boolean {
  return ((point.x - WELL_X[team]) / WELL_RADII.x) ** 2
    + ((point.y - LANE_Y) / WELL_RADII.y) ** 2 <= 1;
}

export function isInsideEnemyWellBeam(team: Team, point: Point): boolean {
  return team === 'blue' ? point.x >= WELL_X.red - 50 : point.x <= WELL_X.blue + 50;
}

export function isUnsafeWellChase(actor: Point & { team: Team }, target: Point & { team: Team }, attackRange: number): boolean {
  if (actor.team === target.team) return false;
  // Safe ranged poke can remain legal, but it never grants movement into the well beam.
  return isInsideEnemyWellBeam(actor.team, target)
    || (isInsideHealingWell(target.team, target)
      && (Math.hypot(target.x - actor.x, target.y - actor.y) > attackRange
        || isInsideEnemyWellBeam(actor.team, actor)));
}

export function capBaseLaneAdvance(team: Team, limit: number, attackRange: number): number {
  const enemy = team === 'blue' ? 'red' : 'blue';
  const direction = team === 'blue' ? 1 : -1;
  const attackPosition = NEXUS_X[enemy] - direction * Math.max(30, attackRange * .9);
  return team === 'blue' ? Math.min(limit, attackPosition) : Math.max(limit, attackPosition);
}
