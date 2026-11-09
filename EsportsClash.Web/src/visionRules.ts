import type { AramChampionUnit, BushPatch } from './types.ts';
import { ARAM_BUSHES, ROCK_TERRAIN, CAMP_ROCK_RINGS } from './arenaRules.ts';

const DRAGON_PIT = CAMP_ROCK_RINGS.find(r => r.id === 'dragon_pit') ?? { x: 1400, y: 240, radius: 136 };
const SIEGE_GOLEM_PIT = CAMP_ROCK_RINGS.find(r => r.id === 'golem_pit') ?? { x: 1400, y: 1200, radius: 136 };

export type WardKind = 'stealth' | 'control' | 'farsight';

export interface ArenaWard {
  id: string;
  team: 'blue' | 'red';
  kind: WardKind;
  bushId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  placedAt: number;
  expiresAt: number;
  ownerId?: string;
  revealed?: boolean;
  disabled?: boolean;
}

export interface WardRubbleMarker {
  id: string;
  team: 'blue' | 'red';
  kind: WardKind;
  x: number;
  y: number;
  destroyedAt: number;
  expiresAt: number;
}

export interface LastSeenEnemyMarker {
  id: string;
  team: 'blue' | 'red';
  championName: string;
  playerName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  seenAt: number;
  expiresAt: number;
}

export interface WardSpec {
  kind: WardKind;
  label: string;
  maxHp: number;
  duration: number;
  visionRadius: number;
  castRange: number;
  bountyGold: number;
  visionScoreReward: number;
  revealsStealth: boolean;
}

export const WARD_SPECS: Record<WardKind, WardSpec> = {
  stealth: {
    kind: 'stealth',
    label: 'Stealth Ward',
    maxHp: 3,
    duration: 75,
    visionRadius: 320,
    castRange: 260,
    bountyGold: 25,
    visionScoreReward: 1.5,
    revealsStealth: false,
  },
  control: {
    kind: 'control',
    label: 'Control Ward',
    maxHp: 4,
    duration: 150,
    visionRadius: 280,
    castRange: 260,
    bountyGold: 35,
    visionScoreReward: 2.0,
    revealsStealth: true,
  },
  farsight: {
    kind: 'farsight',
    label: 'Farsight Ward',
    maxHp: 1,
    duration: 60,
    visionRadius: 240,
    castRange: 580,
    bountyGold: 15,
    visionScoreReward: 1.0,
    revealsStealth: false,
  },
};

export const BUSH_ATTACK_REVEAL_SECONDS = 4.5;
export const SWEEPER_DURATION_SECONDS = 6.0;
export const SWEEPER_COOLDOWN_SECONDS = 40.0;
export const SWEEPER_RADIUS = 190;
export const MAX_WARD_CHARGES = 2;
export const WARD_RECHARGE_SECONDS = 45;
export const LAST_SEEN_GHOST_DURATION = 5.0;

export function getWardSpec(kind: WardKind = 'stealth'): WardSpec {
  return WARD_SPECS[kind] ?? WARD_SPECS.stealth;
}

export function getWardVisionRadius(kind: WardKind = 'stealth'): number {
  return getWardSpec(kind).visionRadius;
}

/**
 * Selects which ward type a champion places based on role, level, and objective state (Items 15 & 16).
 */
export function chooseWardKindForChampion(
  unit: Pick<AramChampionUnit, 'level' | 'champion' | 'player'>,
  matchSecond: number,
  isObjectiveWindow: boolean,
): WardKind {
  const role = unit.champion.primaryRole;
  const iq = unit.player?.stats?.iq ?? 60;
  if ((role === 'Support' || role === 'Tank' || iq >= 82) && (isObjectiveWindow || matchSecond >= 85)) {
    return 'control';
  }
  if ((role === 'Marksman' || role === 'Mage') && (unit.level >= 9 || matchSecond >= 150)) {
    return 'farsight';
  }
  return 'stealth';
}

/**
 * Distance from point (px, py) to segment (ax, ay)-(bx, by).
 */
export function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Checks whether an epic pit enclosure wall blocks direct line-of-sight between observer and target (Item 18).
 * A pit's mouth faces toward the central lane (y = 720):
 * - Dragon Pit (North, y = 240): mouth opens south toward y > 240.
 * - Siege Golem Pit (South, y = 1200): mouth opens north toward y < 1200.
 */
export function isBlockedByPitEnclosure(
  observer: { x: number; y: number },
  target: { x: number; y: number },
): boolean {
  const pits = [
    { x: DRAGON_PIT.x, y: DRAGON_PIT.y, radius: DRAGON_PIT.radius ?? 136, opensSouth: true },
    { x: SIEGE_GOLEM_PIT.x, y: SIEGE_GOLEM_PIT.y, radius: SIEGE_GOLEM_PIT.radius ?? 136, opensSouth: false },
  ];

  for (const pit of pits) {
    const obsDist = Math.hypot(observer.x - pit.x, observer.y - pit.y);
    const tgtDist = Math.hypot(target.x - pit.x, target.y - pit.y);
    const obsInside = obsDist <= pit.radius * 0.85;
    const tgtInside = tgtDist <= pit.radius * 0.85;
    if (obsInside === tgtInside) continue;

    // One is inside the pit and the other is outside.
    // Check if the line between them passes through the open mouth (|x - pit.x| <= 96 on the lane-facing side).
    const outside = obsInside ? target : observer;
    const inMouthCorridor =
      Math.abs(outside.x - pit.x) <= 96 &&
      (pit.opensSouth ? outside.y >= pit.y : outside.y <= pit.y);
    if (!inMouthCorridor) {
      return true;
    }
  }
  return false;
}

/**
 * Line-of-sight check between two points against impassable rock terrain, pit walls, and intervening brush (Items 12 & 18).
 */
export function hasLineOfSight(
  observer: { x: number; y: number; currentBushId?: string; isInBush?: boolean },
  target: { x: number; y: number; currentBushId?: string; isInBush?: boolean; revealedTimer?: number },
  rocks: readonly { x: number; y: number; radius: number }[] = ROCK_TERRAIN,
  bushes: readonly BushPatch[] = ARAM_BUSHES,
): boolean {
  const dist = Math.hypot(target.x - observer.x, target.y - observer.y);
  if (dist <= 55) return true;
  if ((target.revealedTimer ?? 0) > 0) return true;

  // 1. Pit wall enclosure block (Item 18)
  if (isBlockedByPitEnclosure(observer, target)) {
    return false;
  }

  // 2. Rock terrain block (only check rocks near the bounding box for speed)
  const minX = Math.min(observer.x, target.x) - 55;
  const maxX = Math.max(observer.x, target.x) + 55;
  const minY = Math.min(observer.y, target.y) - 55;
  const maxY = Math.max(observer.y, target.y) + 55;
  for (const rock of rocks) {
    if (rock.x < minX || rock.x > maxX || rock.y < minY || rock.y > maxY) continue;
    const dObs = Math.hypot(observer.x - rock.x, observer.y - rock.y);
    const dTgt = Math.hypot(target.x - rock.x, target.y - rock.y);
    if (dObs <= rock.radius || dTgt <= rock.radius) continue;
    const segDist = distancePointToSegment(rock.x, rock.y, observer.x, observer.y, target.x, target.y);
    if (segDist < rock.radius * 0.65) {
      return false;
    }
  }

  // 3. Intervening bush block (if a bush sits directly between observer and target and neither is inside it)
  for (const bush of bushes) {
    if (observer.currentBushId === bush.id || target.currentBushId === bush.id) continue;
    const bushRadius = Math.min(bush.width, bush.height) * 0.42;
    const segDist = distancePointToSegment(bush.x, bush.y, observer.x, observer.y, target.x, target.y);
    if (segDist < bushRadius) {
      const dObs = Math.hypot(observer.x - bush.x, observer.y - bush.y);
      const dTgt = Math.hypot(target.x - bush.x, target.y - bush.y);
      if (dObs > bushRadius && dTgt > bushRadius && dObs < dist && dTgt < dist) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Updates ward reveal/disabled state based on enemy Control Wards and active Sweepers (Items 16 & 17).
 */
export function updateWardDetectionStates(
  wards: ArenaWard[],
  champions: readonly Pick<AramChampionUnit, 'team' | 'x' | 'y' | 'isAlive' | 'sweeperTimer'>[],
): void {
  for (const ward of wards) {
    if (ward.kind === 'control' || ward.kind === 'farsight') {
      // Control and Farsight wards are always visible in their location
      ward.revealed = true;
      ward.disabled = false;
      continue;
    }

    // Stealth ward: revealed & disabled if an enemy control ward or enemy active sweeper is in range
    const enemyControlWardNearby = wards.some(
      other =>
        other.team !== ward.team &&
        other.kind === 'control' &&
        other.hp > 0 &&
        Math.hypot(other.x - ward.x, other.y - ward.y) <= WARD_SPECS.control.visionRadius,
    );
    const enemySweeperNearby = champions.some(
      c =>
        c.isAlive &&
        c.team !== ward.team &&
        (c.sweeperTimer ?? 0) > 0 &&
        Math.hypot(c.x - ward.x, c.y - ward.y) <= SWEEPER_RADIUS,
    );

    ward.revealed = enemyControlWardNearby || enemySweeperNearby;
    ward.disabled = enemyControlWardNearby || enemySweeperNearby;
  }
}

/**
 * Checks if a specific enemy unit is visible to a given team (combines bush stealth, camouflage/stealth,
 * control wards, sweepers, and pit vision rules).
 */
export function isEnemyVisibleToTeam(
  enemy: Pick<
    AramChampionUnit,
    'isAlive' | 'team' | 'x' | 'y' | 'isInBush' | 'currentBushId' | 'stealthTimer' | 'revealedTimer'
  >,
  team: 'blue' | 'red',
  allies: readonly Pick<
    AramChampionUnit,
    'isAlive' | 'team' | 'x' | 'y' | 'isInBush' | 'currentBushId' | 'sweeperTimer'
  >[],
  wards: readonly Pick<ArenaWard, 'team' | 'kind' | 'bushId' | 'x' | 'y' | 'hp' | 'disabled'>[],
): boolean {
  if (!enemy.isAlive) return false;
  if (enemy.team === team) return true;

  // Revealed by true sight / bush attack reveal timer
  if ((enemy.revealedTimer ?? 0) > 0) return true;

  // True sight from allied Control Ward or active Oracle Sweeper
  const revealedByControlOrSweeper =
    wards.some(
      w =>
        w.team === team &&
        w.kind === 'control' &&
        (w.hp ?? 1) > 0 &&
        Math.hypot(w.x - enemy.x, w.y - enemy.y) <= WARD_SPECS.control.visionRadius &&
        (!enemy.isInBush || w.bushId === enemy.currentBushId || Math.hypot(w.x - enemy.x, w.y - enemy.y) <= 135),
    ) ||
    allies.some(
      a =>
        a.isAlive &&
        a.team === team &&
        (a.sweeperTimer ?? 0) > 0 &&
        Math.hypot(a.x - enemy.x, a.y - enemy.y) <= SWEEPER_RADIUS,
    );

  // Stealth check
  if ((enemy.stealthTimer ?? 0) > 0) {
    if (revealedByControlOrSweeper) return true;
    const closeAlly = allies.some(a => a.isAlive && a.team === team && Math.hypot(a.x - enemy.x, a.y - enemy.y) < 48);
    return closeAlly;
  }

  // Bush stealth check
  if (enemy.isInBush) {
    if (revealedByControlOrSweeper) return true;
    const allyInSameBush = allies.some(
      a =>
        a.isAlive &&
        a.team === team &&
        ((a.currentBushId && a.currentBushId === enemy.currentBushId) || Math.hypot(a.x - enemy.x, a.y - enemy.y) <= 55),
    );
    if (allyInSameBush) return true;

    const activeWardInBush = wards.some(
      w =>
        w.team === team &&
        !w.disabled &&
        (w.hp ?? 1) > 0 &&
        (w.bushId === enemy.currentBushId || Math.hypot(w.x - enemy.x, w.y - enemy.y) <= 95),
    );
    return activeWardInBush;
  }

  // Pit enclosure vision check (Item 18): if enemy is inside an epic pit, team needs an ally or active ward
  // with line of sight into the pit
  const inDragonPit = Math.hypot(enemy.x - DRAGON_PIT.x, enemy.y - DRAGON_PIT.y) <= (DRAGON_PIT.radius ?? 136) * 0.85;
  const inGolemPit =
    Math.hypot(enemy.x - SIEGE_GOLEM_PIT.x, enemy.y - SIEGE_GOLEM_PIT.y) <= (SIEGE_GOLEM_PIT.radius ?? 136) * 0.85;
  if (inDragonPit || inGolemPit) {
    const pitHasWard = wards.some(
      w =>
        w.team === team &&
        !w.disabled &&
        (w.hp ?? 1) > 0 &&
        Math.hypot(w.x - enemy.x, w.y - enemy.y) <= getWardVisionRadius(w.kind ?? 'stealth'),
    );
    if (pitHasWard) return true;
    const allyHasLoS = allies.some(
      a =>
        a.isAlive &&
        a.team === team &&
        Math.hypot(a.x - enemy.x, a.y - enemy.y) <= 520 &&
        !isBlockedByPitEnclosure(a, enemy),
    );
    return allyHasLoS;
  }

  return true;
}

/**
 * Checks whether a world coordinate is lit by a team's vision sources (Item 12).
 */
export function isPositionVisibleToTeam(
  team: 'blue' | 'red',
  point: { x: number; y: number },
  champions: readonly Pick<AramChampionUnit, 'team' | 'x' | 'y' | 'isAlive'>[],
  minions: readonly { team: 'blue' | 'red'; x: number; y: number; isAlive: boolean }[],
  structures: readonly { team: 'blue' | 'red'; x: number; y: number; isAlive: boolean }[],
  wards: readonly Pick<ArenaWard, 'team' | 'kind' | 'x' | 'y' | 'hp' | 'disabled'>[],
): boolean {
  for (const c of champions) {
    if (c.isAlive && c.team === team && Math.hypot(c.x - point.x, c.y - point.y) <= 440) {
      if (!isBlockedByPitEnclosure(c, point)) return true;
    }
  }
  for (const m of minions) {
    if (m.isAlive && m.team === team && Math.hypot(m.x - point.x, m.y - point.y) <= 300) {
      return true;
    }
  }
  for (const s of structures) {
    if (s.isAlive && s.team === team && Math.hypot(s.x - point.x, s.y - point.y) <= 390) {
      return true;
    }
  }
  for (const w of wards) {
    if (
      w.team === team &&
      !w.disabled &&
      (w.hp ?? 1) > 0 &&
      Math.hypot(w.x - point.x, w.y - point.y) <= getWardVisionRadius(w.kind ?? 'stealth')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Updates the map of Last-Seen Enemy Ghost Markers (Item 20).
 * When an enemy transitions from visible -> unseen for the opposing team, records their last known position and velocity.
 */
export function updateLastSeenEnemies(
  prevVisibleIds: Set<string>,
  ghostMarkers: Map<string, LastSeenEnemyMarker>,
  champions: readonly AramChampionUnit[],
  wards: readonly ArenaWard[],
  matchSecond: number,
): void {
  const nextVisibleIds = new Set<string>();

  for (const unit of champions) {
    if (!unit.isAlive) {
      ghostMarkers.delete(unit.id);
      continue;
    }
    const observerTeam = unit.team === 'blue' ? 'red' : 'blue';
    const visibleToOpponents = isEnemyVisibleToTeam(unit, observerTeam, champions, wards);
    if (visibleToOpponents) {
      nextVisibleIds.add(unit.id);
      ghostMarkers.delete(unit.id);
    } else if (prevVisibleIds.has(unit.id)) {
      // Just stepped into fog / unwarded brush / stealth!
      ghostMarkers.set(unit.id, {
        id: unit.id,
        team: unit.team,
        championName: unit.champion.displayName ?? unit.champion.name,
        playerName: unit.player.name,
        x: unit.x,
        y: unit.y,
        vx: unit.vx ?? 0,
        vy: unit.vy ?? 0,
        seenAt: matchSecond,
        expiresAt: matchSecond + LAST_SEEN_GHOST_DURATION,
      });
    }
  }

  // Expire old ghost markers
  for (const [id, marker] of ghostMarkers.entries()) {
    if (matchSecond >= marker.expiresAt) {
      ghostMarkers.delete(id);
    }
  }

  prevVisibleIds.clear();
  for (const id of nextVisibleIds) {
    prevVisibleIds.add(id);
  }
}

/**
 * Renders Phase 4 Vision Overlays on the 3D Tactical Canvas:
 * - Soft Fog-of-War shroud over unwarded jungle/pit zones (Item 12)
 * - Ward type badges, HP pips, vision rings, disabled X markers, & expiry timers (Items 15 & 16)
 * - Active Oracle Lens Sweeper radar rings & cleared Ward Rubble markers (Item 17)
 * - Last-Seen Enemy Ghost Markers at Fog Edge with directional arrows (Item 20)
 */
export function drawVisionTacticalOverlay(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, h: number) => { x: number; y: number },
  zoom: number,
  matchSecond: number,
  champions: readonly AramChampionUnit[],
  wards: readonly ArenaWard[],
  rubbleMarkers: readonly WardRubbleMarker[],
  lastSeenMarkers: Iterable<LastSeenEnemyMarker>,
): void {
  ctx.save();

  // 1. Soft Fog-of-War Shroud Pockets on Unwarded Jungle / Boss Pits (Item 12)
  const fogZones = [
    { x: DRAGON_PIT.x, y: DRAGON_PIT.y, radius: 145, label: 'PIT FOG' },
    { x: SIEGE_GOLEM_PIT.x, y: SIEGE_GOLEM_PIT.y, radius: 145, label: 'PIT FOG' },
    { x: 1020, y: 410, radius: 110 },
    { x: 1780, y: 410, radius: 110 },
    { x: 1020, y: 1030, radius: 110 },
    { x: 1780, y: 1030, radius: 110 },
  ];
  for (const zone of fogZones) {
    const blueLit = isPositionVisibleToTeam('blue', zone, champions, [], [], wards);
    const redLit = isPositionVisibleToTeam('red', zone, champions, [], [], wards);
    if (!blueLit && !redLit) {
      const p = project(zone.x, zone.y, 6);
      const r = zone.radius * 0.42 * Math.sqrt(zoom);
      const grad = ctx.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r);
      grad.addColorStop(0, 'rgba(9, 16, 28, 0.34)');
      grad.addColorStop(0.65, 'rgba(9, 16, 28, 0.18)');
      grad.addColorStop(1, 'rgba(9, 16, 28, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Cleared Ward Rubble Markers (Item 17)
  for (const rubble of rubbleMarkers) {
    if (matchSecond >= rubble.expiresAt) continue;
    const p = project(rubble.x, rubble.y, 4);
    const alpha = Math.max(0.15, Math.min(0.75, (rubble.expiresAt - matchSecond) / 8));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rubble.team === 'blue' ? '#60a5fa' : '#f87171';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.moveTo(p.x - 5, p.y - 5);
    ctx.lineTo(p.x + 5, p.y + 5);
    ctx.moveTo(p.x + 5, p.y - 5);
    ctx.lineTo(p.x - 5, p.y + 5);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Active Wards: Vision Ring, Type Icon, HP Pips, Disabled State, & Timer Arc (Items 15 & 16)
  for (const ward of wards) {
    if ((ward.hp ?? 1) <= 0) continue;
    const spec = getWardSpec(ward.kind);
    const p = project(ward.x, ward.y, 26);
    const groundP = project(ward.x, ward.y, 4);
    const remaining = Math.max(0, ward.expiresAt - matchSecond);
    const progress = Math.max(0, Math.min(1, remaining / spec.duration));
    const teamColor = ward.team === 'blue' ? '#38bdf8' : '#f87171';
    const kindColor =
      ward.kind === 'control' ? '#f43f5e' : ward.kind === 'farsight' ? '#22d3ee' : '#4ade80';

    // Subtle vision perimeter ring on ground
    const ringR = (spec.visionRadius * 0.22) * Math.sqrt(zoom);
    ctx.save();
    ctx.strokeStyle = ward.disabled ? 'rgba(148, 163, 184, 0.35)' : teamColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash(ward.kind === 'control' ? [6, 4] : [3, 5]);
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.ellipse(groundP.x, groundP.y, ringR, ringR * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Timer arc around ward head
    ctx.save();
    ctx.strokeStyle = kindColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    // Ward HP Pips
    const pipW = 5;
    const pipGap = 2;
    const totalW = ward.maxHp * pipW + (ward.maxHp - 1) * pipGap;
    const startX = p.x - totalW / 2;
    for (let i = 0; i < ward.maxHp; i++) {
      ctx.fillStyle = i < ward.hp ? kindColor : 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(startX + i * (pipW + pipGap), p.y - 18, pipW, 3.5);
    }

    // Disabled X overlay if suppressed by enemy Control Ward or Sweeper
    if (ward.disabled) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 7);
      ctx.lineTo(p.x + 7, p.y + 7);
      ctx.moveTo(p.x + 7, p.y - 7);
      ctx.lineTo(p.x - 7, p.y + 7);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Active Oracle Lens Sweeper Drone Rings around Champions (Item 17)
  for (const unit of champions) {
    if (!unit.isAlive || (unit.sweeperTimer ?? 0) <= 0) continue;
    const groundP = project(unit.x, unit.y, 6);
    const headP = project(unit.x, unit.y, 68);
    const sweepR = (SWEEPER_RADIUS * 0.34) * Math.sqrt(zoom);
    const pulse = 0.75 + Math.sin(matchSecond * 8) * 0.25;

    ctx.save();
    ctx.strokeStyle = `rgba(244, 63, 94, ${0.65 * pulse})`;
    ctx.fillStyle = `rgba(244, 63, 94, ${0.1 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(groundP.x, groundP.y, sweepR, sweepR * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sweeper radar icon above head
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◎ SWEEPER', headP.x, headP.y - 10);
    ctx.restore();
  }

  // 5. Last-Seen Enemy Ghost Markers at Fog Edge (Item 20)
  for (const ghost of lastSeenMarkers) {
    const remaining = ghost.expiresAt - matchSecond;
    if (remaining <= 0) continue;
    const p = project(ghost.x, ghost.y, 14);
    const alpha = Math.max(0.2, Math.min(0.85, remaining / LAST_SEEN_GHOST_DURATION));
    const color = ghost.team === 'blue' ? '#60a5fa' : '#f87171';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Direction arrow showing last known movement vector
    const speed = Math.hypot(ghost.vx, ghost.vy);
    if (speed > 1) {
      const ang = Math.atan2(ghost.vy, ghost.vx);
      const ax = p.x + Math.cos(ang) * 24;
      const ay = p.y + Math.sin(ang) * 16;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 10);
      ctx.lineTo(ax, ay);
      ctx.stroke();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`? ${ghost.playerName}`, p.x, p.y + 3);
    ctx.restore();
  }

  ctx.restore();
}
