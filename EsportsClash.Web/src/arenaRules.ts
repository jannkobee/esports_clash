import type { BushPatch, LaneStructure, MinionType } from './types';

export const ARENA_WIDTH = 2000;
export const LANE_Y = 380;
export const WELL_X = { blue: 70, red: 1930 } as const;
export const NEXUS_X = { blue: 220, red: 1780 } as const;
export const BARRACKS_X = { blue: 320, red: 1680 } as const;
export const DRAGON_X = ARENA_WIDTH / 2;

export type BarracksKind = 'melee' | 'ranged' | 'catapult';

export const ARAM_BUSHES: BushPatch[] = [
  // 1. Upper Blue River Brush (Guards Blue Jungle & Dragon Pit Approach)
  { id: 'bush_blue_river', name: 'Blue River Brush', x: 750, y: 235, width: 95, height: 40 },
  // 2. Upper Red River Brush (Guards Red Jungle & Dragon Pit Approach)
  { id: 'bush_red_river', name: 'Red River Brush', x: 1250, y: 235, width: 95, height: 40 },
  // 3. Dragon / Roshan River Chokepoint Brush
  { id: 'bush_dragon_choke', name: 'Dragon Pit Brush', x: 1000, y: 215, width: 120, height: 38 },
  // 4. Lower Blue Flank Brush (Valley Ambush)
  { id: 'bush_blue_lower', name: 'Blue Valley Brush', x: 800, y: 525, width: 105, height: 42 },
  // 5. Lower Red Flank Brush (Valley Ambush)
  { id: 'bush_red_lower', name: 'Red Valley Brush', x: 1200, y: 525, width: 105, height: 42 },
];

export function getBushAt(x: number, y: number): BushPatch | undefined {
  return ARAM_BUSHES.find((b) => {
    const rx = b.width / 2;
    const ry = b.height / 2;
    const dx = (x - b.x) / rx;
    const dy = (y - b.y) / ry;
    return dx * dx + dy * dy <= 1.0;
  });
}

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

export function canUnitRecall(
  nearestEnemyDist: number,
  nearestMinionDist: number,
  nearestStructureDist: number,
  recallCooldown: number,
  isInBush: boolean
): boolean {
  const safeEnemyDistance = isInBush ? 300 : 450;
  const isClearAndSafe = nearestEnemyDist > safeEnemyDistance && nearestMinionDist > 270 && nearestStructureDist > 250;
  return isClearAndSafe && recallCooldown <= 0;
}
