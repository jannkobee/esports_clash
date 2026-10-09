import type { LaneStructure, MinionType } from './types';

export const ARENA_WIDTH = 2000;
export const LANE_Y = 380;
export const WELL_X = { blue: 70, red: 1930 } as const;
export const NEXUS_X = { blue: 220, red: 1780 } as const;
export const BARRACKS_X = { blue: 320, red: 1680 } as const;
export const DRAGON_X = ARENA_WIDTH / 2;

export type BarracksKind = 'melee' | 'ranged' | 'catapult';

export function barracksKindForMinion(type: MinionType): BarracksKind {
  return type === 'caster' ? 'ranged' : type === 'cannon' ? 'catapult' : 'melee';
}

export function isMinionEmpowered(team: 'blue' | 'red', type: MinionType, structures: LaneStructure[]): boolean {
  const enemy = team === 'blue' ? 'red' : 'blue';
  return structures.some(structure => structure.team === enemy && structure.type === 'barracks'
    && structure.barracksKind === barracksKindForMinion(type) && !structure.isAlive);
}

export function waveStats(type: MinionType, empowered: boolean) {
  const base = type === 'melee'
    ? { hp: 475, ad: 22, range: 35, speed: 70, goldReward: 21, xpReward: 32 }
    : type === 'caster'
      ? { hp: 310, ad: 28, range: 130, speed: 70, goldReward: 14, xpReward: 22 }
      : { hp: 920, ad: 45, range: 120, speed: 70, goldReward: 65, xpReward: 75 };
  return empowered
    ? { ...base, hp: Math.round(base.hp * 1.4), ad: Math.round(base.ad * 1.35), speed: base.speed + 12 }
    : base;
}
