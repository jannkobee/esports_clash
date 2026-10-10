import type { LaneMinion, LaneStructure } from './types';

export const GOLEM_CHARGE_DAMAGE = 1050;
export const GOLEM_SPAWN_SECOND = 2 * 60;

export function shouldAwakenGolem(gameSeconds: number, alreadyAwakened: boolean): boolean {
  return !alreadyAwakened && gameSeconds >= GOLEM_SPAWN_SECOND;
}

export function selectGolemChargeTower(
  golem: Pick<LaneMinion, 'team' | 'x' | 'y'>,
  structures: readonly Pick<LaneStructure, 'id' | 'team' | 'type' | 'isAlive' | 'x' | 'y'>[],
) {
  const direction = golem.team === 'blue' ? 1 : -1;
  return structures.filter(structure => structure.team !== golem.team && structure.isAlive
    && structure.type.includes('tower') && direction * (structure.x - golem.x) >= -5
    && Math.hypot(structure.x - golem.x, structure.y - golem.y) <= 165)
    .sort((a, b) => Math.abs(a.x - golem.x) - Math.abs(b.x - golem.x))[0];
}
