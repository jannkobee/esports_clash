export type SpatialPoint = { x: number; y: number };
export type SpatialTeam = 'blue' | 'red';

type InfluenceUnit = SpatialPoint & { team: SpatialTeam; hp: number; maxHp: number; isAlive: boolean };
type InfluenceStructure = SpatialPoint & { team: SpatialTeam; range: number; type: string; isAlive: boolean };

export interface InfluenceRead {
  /** Enemy champions and armed enemy structures, normalized to [0, 1]. */
  threat: number;
  /** Nearby healthy allies and allied structures, normalized to [0, 1]. */
  cover: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const distance = (a: SpatialPoint, b: SpatialPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Read-only local spatial field. It has no pathfinding, memory, randomness or
 * mechanics authority; callers may use it only after their existing hard gates.
 */
export function createSpatialInfluence(input: {
  team: SpatialTeam;
  allies: readonly InfluenceUnit[];
  enemies: readonly InfluenceUnit[];
  structures: readonly InfluenceStructure[];
}) {
  const alliedUnits = input.allies.filter(unit => unit.isAlive && unit.team === input.team);
  const enemyUnits = input.enemies.filter(unit => unit.isAlive && unit.team !== input.team);
  const alliedStructures = input.structures.filter(structure => structure.isAlive && structure.team === input.team);
  const enemyStructures = input.structures.filter(structure => structure.isAlive && structure.team !== input.team);

  const at = (point: SpatialPoint): InfluenceRead => {
    const championThreat = enemyUnits.reduce((sum, enemy) => {
      const health = clamp(enemy.hp / Math.max(1, enemy.maxHp));
      return sum + Math.max(0, 1 - distance(point, enemy) / 560) * (.32 + health * .28);
    }, 0);
    const towerThreat = enemyStructures.reduce((sum, structure) => {
      const armed = structure.type.includes('tower') || structure.type === 'nexus';
      if (!armed) return sum;
      const reach = structure.range + 100;
      return sum + Math.max(0, 1 - distance(point, structure) / reach) * .8;
    }, 0);
    const allyCover = alliedUnits.reduce((sum, ally) => {
      const health = clamp(ally.hp / Math.max(1, ally.maxHp));
      return sum + Math.max(0, 1 - distance(point, ally) / 430) * (.18 + health * .22);
    }, 0);
    const structureCover = alliedStructures.reduce((sum, structure) => {
      const armed = structure.type.includes('tower') || structure.type === 'nexus';
      return sum + (armed ? Math.max(0, 1 - distance(point, structure) / (structure.range + 150)) * .5 : 0);
    }, 0);
    return { threat: clamp(championThreat + towerThreat), cover: clamp(allyCover + structureCover) };
  };

  const approach = (from: SpatialPoint, to: SpatialPoint): InfluenceRead => {
    const first = at(from);
    const middle = at({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    const last = at(to);
    return {
      threat: clamp(first.threat * .2 + middle.threat * .45 + last.threat * .35),
      cover: clamp(first.cover * .2 + middle.cover * .45 + last.cover * .35),
    };
  };
  return { at, approach };
}
