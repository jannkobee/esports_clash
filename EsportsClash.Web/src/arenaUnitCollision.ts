import { ARENA_WIDTH, isInsideRockTerrain } from './arenaRules.ts';
import { CHAMPION_BODY_RADIUS, creepBodyRadius, resolveCrowdMovement, type CollisionPoint } from './unitCollision.ts';

type Unit = CollisionPoint & {
  id: string; type?: string; isAlive: boolean; isRecalling?: boolean; zhonyaActive?: boolean;
  stunTimer?: number; knockupTimer?: number; dash?: unknown; hookPull?: unknown;
  untargetableTimer?: number; siegeGolem?: boolean; summonedBearOwnerId?: string; prismWardenOwnerId?: string;
};
type Start = CollisionPoint & { locked: boolean; alive: boolean };
const locked = (unit: Unit) => !!(unit.isRecalling || unit.zhonyaActive || unit.dash || unit.hookPull
  || (unit.stunTimer ?? 0) > 0 || (unit.knockupTimer ?? 0) > 0 || (unit.untargetableTimer ?? 0) > 0);

export function captureUnitCollisionStarts(units: readonly Unit[]): Map<string, Start> {
  return new Map(units.map(unit => [unit.id, { x: unit.x, y: unit.y, locked: locked(unit), alive: unit.isAlive }]));
}

export function resolveArenaUnitCollisions(
  champions: readonly Unit[], creeps: readonly Unit[],
  anchors: readonly (CollisionPoint & { id: string; isAlive: boolean; radius: number })[],
  starts: ReadonlyMap<string, Start>, dt: number,
): void {
  const walking = [...champions, ...creeps].filter(unit => unit.isAlive);
  const championIds = new Set(champions.map(unit => unit.id));
  const bodies = walking.map(unit => {
    const champion = championIds.has(unit.id), start = starts.get(unit.id);
    const terrainRadius = champion ? 13 : unit.siegeGolem ? 28 : 10;
    const forced = start?.locked || locked(unit) || start?.alive === false
      || !!start && Math.hypot(unit.x - start.x, unit.y - start.y) > Math.max(12, 220 * dt)
      || !!start && isInsideRockTerrain(start.x, start.y, terrainRadius);
    return { id: unit.id, from: start ?? { x: unit.x, y: unit.y }, to: { x: unit.x, y: unit.y },
      radius: champion ? CHAMPION_BODY_RADIUS : creepBodyRadius(unit), terrainRadius, locked: forced };
  });
  const result = resolveCrowdMovement([...bodies, ...anchors.filter(unit => unit.isAlive).map(unit => ({
    id: unit.id, from: unit, to: unit, radius: unit.radius, locked: true,
  }))], dt, (point, radius) => point.x >= 40 && point.x <= ARENA_WIDTH - 40
    && point.y >= 80 && point.y <= 620 && !isInsideRockTerrain(point.x, point.y, radius));
  for (const unit of walking) {
    const next = result.get(unit.id);
    if (next) { unit.x = next.x; unit.y = next.y; }
  }
}
