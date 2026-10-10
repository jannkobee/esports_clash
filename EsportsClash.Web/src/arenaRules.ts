import type { BushPatch, LaneStructure, MinionType } from './types';
import { createTerrainRouter } from './terrainRouting.ts';

import { ARENA_WIDTH, DRAGON_X, NEXUS_TOWER_X, CENTRAL_MAP_OFFSET } from './arenaLayout.ts';
export { ARENA_WIDTH, LANE_Y, WELL_X, NEXUS_X, BARRACKS_X, NEXUS_TOWER_X, INNER_TOWER_X, OUTER_TOWER_X, DRAGON_X } from './arenaLayout.ts';
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
  { id: 'j_blue_blue_buff', x: 340, y: 145, radius: 76, stoneRadius: 18, stones: 12, entrance: Math.PI / 2 },
  { id: 'j_blue_red_buff', x: 485, y: 600, radius: 76, stoneRadius: 18, stones: 12, entrance: -Math.PI / 2 },
  { id: 'j_red_blue_buff', x: 1660, y: 145, radius: 76, stoneRadius: 18, stones: 12, entrance: Math.PI / 2 },
  { id: 'j_red_red_buff', x: 1515, y: 600, radius: 76, stoneRadius: 18, stones: 12, entrance: -Math.PI / 2 },
  { id: 'j_siege_golem', x: 1000, y: 610, radius: 115, stoneRadius: 21, stones: 16, entrance: -Math.PI / 2 },
  { id: 'dragon_boss', x: 1000, y: 130, radius: 122, stoneRadius: 22, stones: 16, entrance: Math.PI / 2 },
].map(ring => ({ ...ring, x: ring.x + CENTRAL_MAP_OFFSET }));

const HIGHGROUND_ROCKS = [35, 75, 115].map(offset => NEXUS_TOWER_X.blue + offset).flatMap(x => [
  { x, y: 295, radius: 22, campId: 'blue_highground' },
  { x, y: 465, radius: 22, campId: 'blue_highground' },
  { x: ARENA_WIDTH - x, y: 295, radius: 22, campId: 'red_highground' },
  { x: ARENA_WIDTH - x, y: 465, radius: 22, campId: 'red_highground' },
]);

// Mirrored scalloped contours share their geometry with collision and rendering.
export function campWallPoint(ring: (typeof CAMP_ROCK_RINGS)[number], angle: number, offset = 0) {
  const gap = Math.atan2(Math.sin(angle - ring.entrance), Math.cos(angle - ring.entrance));
  const mirrored = gap * (ring.x <= DRAGON_X ? 1 : -1);
  const envelope = Math.min(1, Math.max(0, (Math.abs(gap) - 0.9) / 0.65));
  const curve = envelope * (ring.x === DRAGON_X
    ? Math.cos(gap * 2) * 8 + Math.cos(gap * 3) * 5
    : Math.sin(mirrored * 2) * 8 + Math.sin(mirrored * 3) * 5);
  const radius = ring.radius + curve + offset;
  return { x: ring.x + Math.cos(angle) * radius, y: ring.y + Math.sin(angle) * radius };
}

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
    const point = campWallPoint(ring, angle, isOpeningEdge ? 3 : 0);

    return {
      x: point.x,
      y: point.y,
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
  const origin = { x, y };
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
  // Overlapping expanded footprints can push a misplaced unit back and forth.
  // Search nearby free ground only for this invalid-position repair case.
  if (isInsideRockTerrain(x, y, bodyRadius)) {
    for (let radius = 2; radius <= 200; radius += 2) {
      for (let sample = 0; sample < 64; sample++) {
        const angle = sample * Math.PI * 2 / 64;
        const candidate = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius };
        if (candidate.x < 40 || candidate.x > ARENA_WIDTH - 40 || candidate.y < 80 || candidate.y > 620) continue;
        if (!isInsideRockTerrain(candidate.x, candidate.y, bodyRadius)) return candidate;
      }
    }
  }
  return { x, y };
}

const terrainWaypoint = createTerrainRouter(ROCK_TERRAIN);

// Routes consider every enclosure, including the one the unit is leaving.
export function rockApproachWaypoint(
  from: { x: number; y: number }, goal: { x: number; y: number }, bodyRadius = 13
): { x: number; y: number } {
  if (isInsideRockTerrain(from.x, from.y, bodyRadius + 2)) {
    return projectOutsideRockTerrain(from.x, from.y, bodyRadius + 3);
  }
  return terrainWaypoint(from, goal, bodyRadius);
}

// Sweep movement in small steps so fast dashes cannot cross a ridge. When a
// direct route encounters stone, slide along the rock's tangent toward the target.
export function resolveRockTerrainMovement(
  from: { x: number; y: number }, to: { x: number; y: number }, bodyRadius = 12
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return projectOutsideRockTerrain(to.x, to.y, bodyRadius);

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
      // A normal step may not repair itself by crossing to the far side of a wall.
      const clearPosition = !isInsideRockTerrain(x, y, bodyRadius)
        ? { x, y } : projectOutsideRockTerrain(nextX, nextY, bodyRadius);
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
  { id: 'bush_blue_river', name: 'Blue River Brush', x: 1050, y: 235, width: 95, height: 40 },
  // 2. Upper Red River Brush (Guards Red Jungle & Dragon Pit Approach)
  { id: 'bush_red_river', name: 'Red River Brush', x: 1550, y: 235, width: 95, height: 40 },
  // 3. Dragon / Roshan River Chokepoint Brush
  { id: 'bush_dragon_choke', name: 'Dragon Pit Brush', x: 1300, y: 215, width: 120, height: 38 },
  // 4. Lower Blue Flank Brush (Valley Ambush)
  { id: 'bush_blue_lower', name: 'Blue Valley Brush', x: 1100, y: 525, width: 105, height: 42 },
  // 5. Lower Red Flank Brush (Valley Ambush)
  { id: 'bush_red_lower', name: 'Red Valley Brush', x: 1500, y: 525, width: 105, height: 42 },
  // Flanking brush immediately outside each raised base entrance.
  { id: 'bush_blue_high_north', name: 'Blue Ramp North Brush', x: 730, y: 245, width: 94, height: 42 },
  { id: 'bush_blue_high_south', name: 'Blue Ramp South Brush', x: 730, y: 515, width: 94, height: 42 },
  { id: 'bush_red_high_north', name: 'Red Ramp North Brush', x: 1870, y: 245, width: 94, height: 42 },
  { id: 'bush_red_high_south', name: 'Red Ramp South Brush', x: 1870, y: 515, width: 94, height: 42 },
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
