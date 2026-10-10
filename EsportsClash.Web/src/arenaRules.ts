import type { BushPatch, LaneStructure, MinionType } from './types';

export const ARENA_WIDTH = 2000;
export const LANE_Y = 380;
export const WELL_X = { blue: 65, red: 1935 } as const;
export const NEXUS_X = { blue: 205, red: 1795 } as const;
export const BARRACKS_X = { blue: 345, red: 1655 } as const;
export const NEXUS_TOWER_X = { blue: 420, red: 1580 } as const;
export const DRAGON_X = ARENA_WIDTH / 2;
export const DRAGON_SPAWN_SECOND = 4 * 60;

export function shouldSeparateUnitsByTeam(teamA: 'blue' | 'red', teamB: 'blue' | 'red'): boolean {
  return teamA !== teamB;
}

// Each camp has one rocky enclosure with a lane-facing entrance. The boss
// pits use larger stones. These centers also match the neutral spawn points.
export const CAMP_ROCK_RINGS = [
  { id: 'j_blue_golem', x: 576, y: 170, radius: 76, stoneRadius: 18, stones: 12, entrance: Math.PI / 2 },
  { id: 'j_red_wolves', x: 1424, y: 170, radius: 76, stoneRadius: 18, stones: 12, entrance: Math.PI / 2 },
  { id: 'j_blue_behemoth', x: 667, y: 575, radius: 76, stoneRadius: 18, stones: 12, entrance: -Math.PI / 2 },
  { id: 'j_red_drakes', x: 1333, y: 575, radius: 76, stoneRadius: 18, stones: 12, entrance: -Math.PI / 2 },
  { id: 'j_blue_blue_buff', x: 380, y: 145, radius: 76, stoneRadius: 18, stones: 12, entrance: Math.PI / 2 },
  { id: 'j_blue_red_buff', x: 485, y: 600, radius: 76, stoneRadius: 18, stones: 12, entrance: -Math.PI / 2 },
  { id: 'j_red_blue_buff', x: 1620, y: 145, radius: 76, stoneRadius: 18, stones: 12, entrance: Math.PI / 2 },
  { id: 'j_red_red_buff', x: 1515, y: 600, radius: 76, stoneRadius: 18, stones: 12, entrance: -Math.PI / 2 },
  { id: 'j_siege_golem', x: 1000, y: 610, radius: 115, stoneRadius: 21, stones: 16, entrance: -Math.PI / 2 },
  { id: 'dragon_boss', x: 1000, y: 130, radius: 122, stoneRadius: 22, stones: 16, entrance: Math.PI / 2 },
] as const;

const HIGHGROUND_ROCKS = ([455, 495, 535] as const).flatMap(x => [
  { x, y: 295, radius: 22, campId: 'blue_highground' },
  { x, y: 465, radius: 22, campId: 'blue_highground' },
  { x: ARENA_WIDTH - x, y: 295, radius: 22, campId: 'red_highground' },
  { x: ARENA_WIDTH - x, y: 465, radius: 22, campId: 'red_highground' },
]);

export const ROCK_TERRAIN = [
  ...CAMP_ROCK_RINGS.flatMap(ring => Array.from({ length: ring.stones }, (_, index) => {
    const angle = index * Math.PI * 2 / ring.stones;
    const gapAngle = Math.atan2(Math.sin(angle - ring.entrance), Math.cos(angle - ring.entrance));
    const absGap = Math.abs(gapAngle);
    const isBoss = ring.stones === 16;
    const gapThreshold = isBoss ? 0.50 : 0.62;
    if (absGap <= gapThreshold) return null;

    // Gently flare stones near the opening edges so the entrance is wide, flared, and never steep
    const isOpeningEdge = absGap < gapThreshold + 0.50;
    const stoneRadius = isOpeningEdge ? Math.round(ring.stoneRadius * 0.88) : ring.stoneRadius;
    const radialOffset = isOpeningEdge ? ring.radius + 3 : ring.radius;

    return {
      x: ring.x + Math.cos(angle) * radialOffset,
      y: ring.y + Math.sin(angle) * radialOffset,
      radius: stoneRadius,
      campId: ring.id,
    };
  }).filter(stone => stone !== null)),
  ...HIGHGROUND_ROCKS,
];

export function isInsideRockTerrain(x: number, y: number, bodyRadius = 0): boolean {
  return ROCK_TERRAIN.some(rock => Math.hypot(x - rock.x, y - rock.y) < rock.radius + bodyRadius);
}

function projectOutsideRockTerrain(
  x: number, y: number, bodyRadius: number
): { x: number; y: number } {
  for (let pass = 0; pass < 16; pass++) {
    let collided = false;
    for (const rock of ROCK_TERRAIN) {
      const limit = rock.radius + bodyRadius;
      const awayX = x - rock.x;
      const awayY = y - rock.y;
      const gap = Math.hypot(awayX, awayY);
      if (gap >= limit) continue;

      collided = true;
      const scale = (limit + 0.5) / Math.max(gap, 0.001);
      x = rock.x + (gap < 0.001 ? -(limit + 0.5) : awayX * scale);
      y = rock.y + (gap < 0.001 ? 0 : awayY * scale);
    }
    if (!collided) break;
  }
  return { x, y };
}

// Farming routes pass through the open base stair and each camp's lane-facing
// gate instead of repeatedly aiming into its stone wall.
export function rockApproachWaypoint(
  from: { x: number; y: number }, goal: { x: number; y: number }
): { x: number; y: number } {
  const ring = CAMP_ROCK_RINGS.find(pit => Math.hypot(goal.x - pit.x, goal.y - pit.y) < 18);
  if (!ring) return goal;
  const blueBase = from.x < 620 && goal.x > 440;
  const redBase = from.x > ARENA_WIDTH - 620 && goal.x < ARENA_WIDTH - 440;
  if (blueBase || redBase) {
    const gateX = blueBase ? 595 : ARENA_WIDTH - 595;
    const flankY = goal.y < LANE_Y ? 235 : 525;
    if (Math.abs(from.y - LANE_Y) < 75 && Math.abs(from.x - gateX) > 4)
      return { x: gateX, y: LANE_Y };
    if (Math.abs(from.x - gateX) < 5
      && (goal.y < LANE_Y ? from.y > flankY + 5 : from.y < flankY - 5))
      return { x: gateX, y: flankY };
  }
  const entry = {
    x: ring.x + Math.cos(ring.entrance) * (ring.radius + ring.stoneRadius + 38),
    y: ring.y + Math.sin(ring.entrance) * (ring.radius + ring.stoneRadius + 38),
  };
  const distanceToCenter = Math.hypot(from.x - ring.x, from.y - ring.y);
  const approachAngle = Math.atan2(from.y - ring.y, from.x - ring.x);
  const openingAngle = Math.atan2(Math.sin(approachAngle - ring.entrance), Math.cos(approachAngle - ring.entrance));
  // If already inside the clearing or in front of the opening, navigate straight to goal.
  if (distanceToCenter < ring.radius - 8
    || (distanceToCenter <= ring.radius + 70 && Math.abs(openingAngle) < 0.95)) return goal;
  if (Math.abs(openingAngle) >= 0.95) {
    const arcAngle = approachAngle - Math.sign(openingAngle) * Math.min(Math.abs(openingAngle), 0.55);
    const approachRadius = ring.radius + ring.stoneRadius + 38;
    return {
      x: ring.x + Math.cos(arcAngle) * approachRadius,
      y: ring.y + Math.sin(arcAngle) * approachRadius,
    };
  }
  return entry;
}

// Sweep movement in small steps so fast dashes cannot cross a ridge. When a
// direct route encounters stone, slide along the rock's tangent toward the target.
export function resolveRockTerrainMovement(
  from: { x: number; y: number }, to: { x: number; y: number }, bodyRadius = 12
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return { x: to.x, y: to.y };

  const teleport = distance > 350;
  if (teleport) {
    return projectOutsideRockTerrain(to.x, to.y, bodyRadius);
  }

  const steps = Math.max(1, Math.ceil(Math.min(distance, 350) / 8));
  let x = from.x;
  let y = from.y;

  for (let step = 0; step < steps; step++) {
    const stepMoveX = dx / steps;
    const stepMoveY = dy / steps;
    const stepSpeed = Math.hypot(stepMoveX, stepMoveY);
    let nextX = x + stepMoveX;
    let nextY = y + stepMoveY;

    for (let pass = 0; pass < 8; pass++) {
      let collided = false;
      for (const rock of ROCK_TERRAIN) {
        const limit = rock.radius + bodyRadius;
        const awayX = nextX - rock.x;
        const awayY = nextY - rock.y;
        const gap = Math.hypot(awayX, awayY);
        if (gap >= limit) continue;

        collided = true;
        const normX = gap > 0.001 ? awayX / gap : 0;
        const normY = gap > 0.001 ? awayY / gap : 1;

        // Push directly outside the collision boundary
        nextX = rock.x + normX * (limit + 0.2);
        nextY = rock.y + normY * (limit + 0.2);

        // Frictionless goal-seeking tangent sliding: slide along the rock contour toward the goal
        const t1x = -normY;
        const t1y = normX;
        const dotGoal = (to.x - nextX) * t1x + (to.y - nextY) * t1y;
        const tanX = dotGoal >= 0 ? t1x : -t1x;
        const tanY = dotGoal >= 0 ? t1y : -t1y;

        if (pass === 0 && stepSpeed > 0.001) {
          nextX += tanX * stepSpeed * 0.75;
          nextY += tanY * stepSpeed * 0.75;
        }
      }
      if (!collided) break;
    }

    if (isInsideRockTerrain(nextX, nextY, bodyRadius)) {
      const clearPosition = projectOutsideRockTerrain(nextX, nextY, bodyRadius);
      nextX = clearPosition.x;
      nextY = clearPosition.y;
    }

    x = nextX;
    y = nextY;
  }

  return { x, y };
}

export const STRUCTURE_HP = {
  outer_tower: 3400,
  inner_tower: 4100,
  nexus_tower: 4800,
  barracks: 2600,
  nexus: 7500
} as const;

export function nextNexusVolleyShot(shotsRemaining = 5): { shotsRemaining: number; cooldown: number } {
  return shotsRemaining === 1
    ? { shotsRemaining: 5, cooldown: 2.2 }
    : { shotsRemaining: shotsRemaining - 1, cooldown: 0.2 };
}

export function selectTurretTarget<T extends { id: string }>(
  inRange: readonly T[], currentId: string | null, diveAggressorId?: string
): T | undefined {
  return (diveAggressorId ? inRange.find(unit => unit.id === diveAggressorId) : undefined)
    ?? (currentId ? inRange.find(unit => unit.id === currentId) : undefined)
    ?? inRange.find(unit => 'type' in unit)
    ?? inRange[0];
}

export const NEXUS_TARGET_LIMIT = 6;

export function selectNexusTargets<T extends { id: string }>(
  inRange: readonly T[], currentId: string | null, diveAggressorId?: string
): T[] {
  const first = selectTurretTarget(inRange, currentId, diveAggressorId);
  if (!first) return [];
  const remaining = inRange.filter(unit => unit.id !== first.id);
  return [first, ...remaining.filter(unit => !('type' in unit)),
    ...remaining.filter(unit => 'type' in unit)].slice(0, NEXUS_TARGET_LIMIT);
}

export function turretShotDamage(baseDamage: number, isChampion: boolean, isNexus: boolean): number {
  return isChampion && !isNexus ? Math.round(baseDamage * 1.8) : baseDamage;
}

// Early tower plating fades by the eight-minute late-game transition. Wave
// control still helps break a turret, but the opening no longer drags on.
export function towerSiegeMultiplier(gameSeconds: number): number {
  return 0.30 + 0.70 * Math.min(1, Math.max(0, gameSeconds) / 480);
}

export function canDamageNexus(team: 'blue' | 'red', structures: readonly Pick<LaneStructure, 'team' | 'type' | 'isAlive'>[]): boolean {
  const defenders = structures.filter(structure => structure.team === team);
  return !defenders.some(structure => structure.type === 'nexus_tower' && structure.isAlive)
    && defenders.some(structure => structure.type === 'barracks' && !structure.isAlive);
}

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
  // Flanking brush immediately outside each raised base entrance.
  { id: 'bush_blue_high_north', name: 'Blue Ramp North Brush', x: 540, y: 265, width: 94, height: 42 },
  { id: 'bush_blue_high_south', name: 'Blue Ramp South Brush', x: 540, y: 495, width: 94, height: 42 },
  { id: 'bush_red_high_north', name: 'Red Ramp North Brush', x: 1460, y: 265, width: 94, height: 42 },
  { id: 'bush_red_high_south', name: 'Red Ramp South Brush', x: 1460, y: 495, width: 94, height: 42 },
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
