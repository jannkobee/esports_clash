import { ARENA_WIDTH,PLAY_MIN_Y,PLAY_MAX_Y, isInsideRockTerrain } from './arenaRules.ts';
import { CHAMPION_BODY_RADIUS, creepBodyRadius, resolveCrowdMovement, type CollisionPoint } from './unitCollision.ts';

type Unit = CollisionPoint & {
  id: string; type?: string; isAlive: boolean; isRecalling?: boolean; zhonyaActive?: boolean;
  stunTimer?: number; knockupTimer?: number; dash?: unknown; hookPull?: unknown;
  untargetableTimer?: number; siegeGolem?: boolean; summonedBearOwnerId?: string; prismWardenOwnerId?: string;v3Transport?:boolean;
};
type Start = CollisionPoint & { locked: boolean; alive: boolean };
type NeutralBody = { unit: Unit; radius: number; locked?: boolean };
const locked = (unit: Unit) => !!(unit.v3Transport || unit.isRecalling || unit.zhonyaActive || unit.dash || unit.hookPull
  || (unit.stunTimer ?? 0) > 0 || (unit.knockupTimer ?? 0) > 0 || (unit.untargetableTimer ?? 0) > 0);

export function captureUnitCollisionStarts(units: readonly Unit[]): Map<string, Start> {
  return new Map(units.map(unit => [unit.id, { x: unit.x, y: unit.y, locked: locked(unit), alive: unit.isAlive }]));
}

export function resolveArenaUnitCollisions(
  champions: readonly Unit[], creeps: readonly Unit[],
  neutrals: readonly NeutralBody[],
  starts: ReadonlyMap<string, Start>, dt: number,
  structures?: readonly { unit: Unit; radius: number; locked?: boolean }[],
): void {
  const walking = [...champions, ...creeps, ...neutrals.map(body => body.unit)].filter(unit => unit.isAlive);
  const championIds = new Set(champions.map(unit => unit.id));
  const neutralBodies = new Map(neutrals.map(body => [body.unit.id, body]));
  const liveStructures = (structures ?? []).filter(s => s.unit.isAlive);
  const bodies = [
    ...walking.map(unit => {
      const champion = championIds.has(unit.id), start = starts.get(unit.id);
      const neutral = neutralBodies.get(unit.id);
      const terrainRadius = neutral?.radius ?? (champion ? 13 : unit.siegeGolem ? 28 : 10);
      const forced = neutral?.locked || start?.locked || locked(unit) || start?.alive === false
        || !!start && Math.hypot(unit.x - start.x, unit.y - start.y) > Math.max(12, 220 * dt)
        || !!start && isInsideRockTerrain(start.x, start.y, terrainRadius);
      return { id: unit.id, from: start ?? { x: unit.x, y: unit.y }, to: { x: unit.x, y: unit.y },
        radius: neutral?.radius ?? (champion ? CHAMPION_BODY_RADIUS : creepBodyRadius(unit)),
        terrainRadius, soft: true, spacingPriority: champion ? 1 : 0, locked: forced };
    }),
    ...liveStructures.map(s => ({
      id: s.unit.id,
      from: { x: s.unit.x, y: s.unit.y },
      to: { x: s.unit.x, y: s.unit.y },
      radius: s.radius,
      terrainRadius: s.radius,
      soft: false,
      spacingPriority: 10,
      locked: true,
    }))
  ];
  const result = resolveCrowdMovement(bodies, dt, (point, radius) => point.x >= 40 && point.x <= ARENA_WIDTH - 40
    && point.y >= PLAY_MIN_Y && point.y <= PLAY_MAX_Y && !isInsideRockTerrain(point.x, point.y, radius));
  for (const unit of walking) {
    const next = result.get(unit.id);
    if (next) { unit.x = next.x; unit.y = next.y; }
  }
}
