import type {LaneStructure} from './types';
type Structure = Pick<LaneStructure, 'team' | 'type' | 'isAlive'> & Partial<Pick<LaneStructure, 'lane' | 'id'>>;

function resolveLane(s: Structure): 'top' | 'bot' | undefined {
  if (s.lane) return s.lane;
  if (s.id) {
    if (s.id.includes('top')) return 'top';
    if (s.id.includes('bot')) return 'bot';
  }
  return undefined;
}

/** Mechanical objective order, shared by live damage, target legality and tests. */
export function canDamageNexus(team: 'blue' | 'red', structures: readonly Structure[]): boolean {
  const defenders = structures.filter(s => s.team === team);
  const barracks = defenders.filter(s => s.type === 'barracks');
  if (!(barracks.length>=3&&barracks.every(s=>!s.isAlive))) return false;

  const hasLanes = defenders.some(s => resolveLane(s) !== undefined);
  if (hasLanes) {
    const topTowers = defenders.filter(s => resolveLane(s) === 'top' && s.type.includes('tower'));
    const botTowers = defenders.filter(s => resolveLane(s) === 'bot' && s.type.includes('tower'));
    const topCleared = topTowers.length > 0 && topTowers.every(s => !s.isAlive);
    const botCleared = botTowers.length > 0 && botTowers.every(s => !s.isAlive);
    return topCleared || botCleared;
  }
  return !defenders.some(s => s.type.includes('tower') && s.isAlive);
}

export function canDamageStructure(target: Structure, structures: readonly Structure[]): boolean {
  if (!target.isAlive) return false;
  const defenders = structures.filter(s => s.team === target.team);
  const targetLane = resolveLane(target);

  if (target.type === 'outer_tower') return true;

  if (target.type === 'inner_tower') {
    if (targetLane) {
      return !defenders.some(s => resolveLane(s) === targetLane && s.type === 'outer_tower' && s.isAlive);
    }
    return !defenders.some(s => s.type === 'outer_tower' && s.isAlive);
  }

  if (target.type === 'nexus_tower') {
    if (targetLane) {
      return !defenders.some(s => resolveLane(s) === targetLane && ['outer_tower', 'inner_tower'].includes(s.type) && s.isAlive);
    }
    return !defenders.some(s => ['outer_tower', 'inner_tower'].includes(s.type) && s.isAlive);
  }

  if (target.type === 'barracks') {
    const hasLanes = defenders.some(s => resolveLane(s) !== undefined);
    if (hasLanes) {
      const topTowers = defenders.filter(s => resolveLane(s) === 'top' && s.type.includes('tower'));
      const botTowers = defenders.filter(s => resolveLane(s) === 'bot' && s.type.includes('tower'));
      const topCleared = topTowers.length > 0 && topTowers.every(s => !s.isAlive);
      const botCleared = botTowers.length > 0 && botTowers.every(s => !s.isAlive);
      return topCleared || botCleared;
    }
    return !defenders.some(s => s.type.includes('tower') && s.isAlive);
  }

  return canDamageNexus(target.team, structures);
}

export function structureProtectionReason(target: Structure, structures: readonly Structure[]): string | undefined {
  if (!target.isAlive) return 'Destroyed';
  if (canDamageStructure(target, structures)) return;
  const defenders = structures.filter(s => s.team === target.team && s.isAlive);
  const targetLane = resolveLane(target);

  if (targetLane) {
    if (defenders.some(s => resolveLane(s) === targetLane && s.type === 'outer_tower')) return 'Outer turret first';
    if (defenders.some(s => resolveLane(s) === targetLane && s.type === 'inner_tower')) return 'Inner turret first';
    if (defenders.some(s => resolveLane(s) === targetLane && s.type === 'nexus_tower')) return 'Nexus turret first';
  } else {
    if (defenders.some(s => s.type === 'outer_tower')) return 'Outer turret first';
    if (defenders.some(s => s.type === 'inner_tower')) return 'Inner turret first';
    if (defenders.some(s => s.type === 'nexus_tower')) return 'Nexus turret first';
  }

  const remaining = defenders.filter(s => s.type === 'barracks').length;
  return remaining ? `${remaining} barracks remaining` : 'Barracks required';
}
