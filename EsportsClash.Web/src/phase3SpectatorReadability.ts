import { CAMP_ROCK_RINGS } from './arenaRules.ts';
import { laneY } from './arenaLayout.ts';

export interface BossMeterState {
  name: string;
  hp: number;
  maxHp: number;
  executeHp: number;
  executeRatio: number;
  inExecuteZone: boolean;
  kind: 'dragon' | 'golem';
}

/**
 * Catalogue Item 73: Teamfight Camera Auto-Zoom.
 * Slightly widens the camera when 4+ champions from both teams are engaged across a broad area,
 * keeping close League/Wild Rift framing in normal play while preventing off-screen teamfight clipping.
 */
export function computeTeamfightAutoZoom(
  baseZoom: number,
  champions: readonly { isAlive: boolean; team: 'blue' | 'red'; x: number; y: number }[],
  cameraMode: 'auto' | 'manual',
): number {
  if (cameraMode !== 'auto' || baseZoom <= 1.35) return baseZoom;
  const alive = champions.filter(c => c.isAlive);
  const blueAlive = alive.filter(c => c.team === 'blue');
  const redAlive = alive.filter(c => c.team === 'red');
  if (blueAlive.length === 0 || redAlive.length === 0) return baseZoom;

  // Find champions participating in a shared clash (within 650px of an opposing champion)
  const engaged = alive.filter(u =>
    alive.some(other => other.team !== u.team && Math.hypot(other.x - u.x, other.y - u.y) <= 650),
  );
  if (engaged.length < 4) return baseZoom;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const c of engaged) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const spread = Math.hypot(maxX - minX, maxY - minY);
  if (spread <= 300) return baseZoom;
  const widenRatio = Math.min(1, (spread - 300) / 550);
  return Number((baseZoom * (1 - widenRatio * 0.14)).toFixed(3));
}

/**
 * Catalogue Item 53: Lane Wave-Front Indicator.
 * Computes the horizontal meeting point of the active Blue and Red minion waves.
 */
export function computeWaveFrontX(
  minions: readonly { isAlive: boolean; team: 'blue' | 'red'; x: number }[],
  defaultX = 1400,
): number {
  let maxBlueX = -Infinity;
  let minRedX = Infinity;
  for (const m of minions) {
    if (!m.isAlive) continue;
    if (m.team === 'blue' && m.x > maxBlueX) maxBlueX = m.x;
    if (m.team === 'red' && m.x < minRedX) minRedX = m.x;
  }
  if (Number.isFinite(maxBlueX) && Number.isFinite(minRedX)) {
    return Math.round((maxBlueX + minRedX) / 2);
  }
  if (Number.isFinite(maxBlueX)) return Math.round(maxBlueX);
  if (Number.isFinite(minRedX)) return Math.round(minRedX);
  return defaultX;
}

/**
 * Catalogue Item 51: Minion Last-Hit Threshold Marker.
 */
export function isMinionLastHittable(hp: number, maxHp: number, baseThreshold = 75): boolean {
  return hp > 0 && hp <= Math.max(baseThreshold, maxHp * 0.18);
}

/**
 * Catalogue Item 39: Top-Bar Boss HP Meter during Contests.
 */
export function computeActiveBossMeter(
  dragon: { name: string; isAlive: boolean; hp: number; maxHp: number; aggroTeam?: string | null },
  camps: readonly { name: string; type: string; isAlive: boolean; hp: number; maxHp: number; targetId?: string }[],
): BossMeterState | null {
  if (dragon.isAlive && (dragon.hp < dragon.maxHp || Boolean(dragon.aggroTeam))) {
    const executeHp = Math.round(dragon.maxHp * 0.32);
    return {
      name: dragon.name,
      hp: Math.max(0, Math.round(dragon.hp)),
      maxHp: Math.max(1, Math.round(dragon.maxHp)),
      executeHp,
      executeRatio: 0.32,
      inExecuteZone: dragon.hp <= executeHp,
      kind: 'dragon',
    };
  }
  const golem = camps.find(c => c.type === 'siege_golem');
  if (golem && golem.isAlive && (golem.hp < golem.maxHp || Boolean(golem.targetId))) {
    const executeHp = Math.round(golem.maxHp * 0.32);
    return {
      name: golem.name,
      hp: Math.max(0, Math.round(golem.hp)),
      maxHp: Math.max(1, Math.round(golem.maxHp)),
      executeHp,
      executeRatio: 0.32,
      inExecuteZone: golem.hp <= executeHp,
      kind: 'golem',
    };
  }
  return null;
}

/**
 * Compact structure protection badge unless debug labels are enabled.
 */
export function formatStructurePlateLabel(
  protection: string | null | undefined,
  showDebugLabels: boolean,
): string {
  if (!protection) return '';
  return showDebugLabels ? protection : '🛡';
}

/**
 * Show neutral camp health/nameplate only when damaged/engaged (or when debug overlay is on).
 */
export function shouldShowNeutralCampBar(
  camp: { isAlive: boolean; hp: number; maxHp: number; targetId?: string; aggroTeam?: string | null },
  showDebugLabels: boolean,
): boolean {
  if (!camp.isAlive) return false;
  return showDebugLabels || camp.hp < camp.maxHp || Boolean(camp.targetId) || Boolean(camp.aggroTeam);
}

export interface TacticalOverlayDrawParams {
  ctx: CanvasRenderingContext2D;
  project: (x: number, y: number, height: number) => { x: number; y: number };
  actorHeight: (id: string) => number;
  matchTime: number;
  lockedChampionId: string | null;
  champions: readonly {
    id: string;
    x: number;
    y: number;
    isAlive: boolean;
    isInBush?: boolean;
    respawnTimer: number;
    team: 'blue' | 'red';
    player: { name: string };
    actionIntent?: { kind: string; targetId?: string };
    committedState?: string;
  }[];
  minions: readonly {
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    isAlive: boolean;
    team: 'blue' | 'red';
  }[];
  structures: readonly {
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    range: number;
    isAlive: boolean;
    type: string;
    team: 'blue' | 'red';
    targetId?: string | null;
  }[];
  camps: readonly {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    homeX?: number;
    homeY?: number;
    isAlive: boolean;
    respawnTimer: number;
  }[];
  dragon: {
    id: string;
    name: string;
    x: number;
    y: number;
    isAlive: boolean;
    spawnTimer: number;
  };
  golemAwakened: boolean;
  golemSpawnSecond: number;
}

/**
 * Draws Phase 3 tactical readability overlays onto the 3D match canvas:
 * - Item 13: Selected Champion Vision Radius Circle
 * - Item 19: Tactical Ping System (Attack, Danger, On My Way)
 * - Item 25: Camp Respawn Timer Clocks
 * - Item 36: Objective Spawn Countdown Ring
 * - Item 41: Turret Targeting Laser Telegraph
 * - Item 42: Turret Range Ring Indicator
 * - Item 53: Lane Wave-Front Indicator
 * - Item 64: Respawn Countdown Corpse Marker
 */
export function drawArena3dTacticalReadability(params: TacticalOverlayDrawParams): void {
  const {
    ctx,
    project,
    actorHeight,
    matchTime,
    lockedChampionId,
    champions,
    minions,
    structures,
    camps,
    dragon,
    golemAwakened,
    golemSpawnSecond,
  } = params;

  const drawProjectedGroundRing = (
    cx: number,
    cy: number,
    radius: number,
    strokeStyle: string,
    lineWidth = 1.8,
    dash: number[] = [],
    arcFraction = 1,
  ) => {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    if (dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    const steps = 36;
    const maxStep = Math.max(1, Math.round(steps * Math.max(0, Math.min(1, arcFraction))));
    for (let i = 0; i <= maxStep; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
      const p = project(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 2);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  };

  // 1. Item 13: Selected Champion Vision Radius Circle
  if (lockedChampionId) {
    const hero = champions.find(c => c.id === lockedChampionId && c.isAlive);
    if (hero) {
      const visRadius = hero.isInBush ? 130 : 230;
      const color = hero.team === 'blue' ? 'rgba(56, 201, 237, 0.55)' : 'rgba(241, 107, 132, 0.55)';
      drawProjectedGroundRing(hero.x, hero.y, visRadius, color, 1.8, [6, 5]);
    }
  }

  // 2. Item 42 & Item 41: Turret Range Ring Indicator & Turret Targeting Laser Telegraph
  for (const st of structures) {
    if (!st.isAlive || (!st.type.includes('tower') && st.type !== 'nexus')) continue;
    const targetUnit = st.targetId
      ? champions.find(c => c.id === st.targetId && c.isAlive) ??
        minions.find(m => m.id === st.targetId && m.isAlive)
      : undefined;
    const enemyChampNearby = champions.some(
      c => c.isAlive && c.team !== st.team && Math.hypot(c.x - st.x, c.y - st.y) <= st.range + 45,
    );
    const targetingChamp = Boolean(targetUnit && 'player' in targetUnit);

    if (enemyChampNearby || targetingChamp) {
      const ringCol = targetingChamp
        ? 'rgba(239, 68, 68, 0.62)'
        : st.team === 'blue'
          ? 'rgba(56, 201, 237, 0.36)'
          : 'rgba(241, 107, 132, 0.36)';
      drawProjectedGroundRing(st.x, st.y, st.range, ringCol, targetingChamp ? 2.2 : 1.5, [8, 6]);
    }

    if (targetUnit && st.type.includes('tower')) {
      const from = project(st.x, st.y, actorHeight(st.id) * 0.82);
      const to = project(targetUnit.x, targetUnit.y, 'player' in targetUnit ? 28 : 14);
      ctx.save();
      ctx.strokeStyle = targetingChamp
        ? 'rgba(239, 68, 68, 0.88)'
        : st.team === 'blue'
          ? 'rgba(56, 201, 237, 0.52)'
          : 'rgba(241, 107, 132, 0.52)';
      ctx.lineWidth = targetingChamp ? 2.6 : 1.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      if (targetingChamp) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.beginPath();
        ctx.arc(to.x, to.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 3. Item 25 & Item 36: Camp Respawn Timer Clocks & Objective Spawn Countdown Rings
  for (const camp of camps) {
    const cx = camp.homeX ?? camp.x;
    const cy = camp.homeY ?? camp.y;
    if (camp.type === 'siege_golem') {
      if (!camp.isAlive && !golemAwakened) {
        const remaining = Math.max(0, golemSpawnSecond - matchTime);
        const frac = Math.max(0, Math.min(1, 1 - remaining / Math.max(1, golemSpawnSecond)));
        drawProjectedGroundRing(cx, cy, 68, 'rgba(110, 240, 200, 0.55)', 2.5, [], frac);
        const p = project(cx, cy, 12);
        ctx.save();
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6ee7b7';
        ctx.strokeStyle = '#06101c';
        ctx.lineWidth = 3;
        const text = `◆ ${Math.ceil(remaining)}s`;
        ctx.strokeText(text, p.x, p.y);
        ctx.fillText(text, p.x, p.y);
        ctx.restore();
      }
      continue;
    }

    if (!camp.isAlive && camp.respawnTimer > 0) {
      const p = project(cx, cy, 10);
      const frac = Math.max(0, Math.min(1, 1 - camp.respawnTimer / 75));
      ctx.save();
      ctx.fillStyle = 'rgba(6, 16, 28, 0.78)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(225, 184, 110, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`${Math.ceil(camp.respawnTimer)}`, p.x, p.y + 3);
      ctx.restore();
    }
  }

  if (!dragon.isAlive && dragon.spawnTimer > 0) {
    const dragonRing = CAMP_ROCK_RINGS.find(r => r.id === 'dragon_boss');
    const dx = dragonRing?.x ?? dragon.x;
    const dy = dragonRing?.y ?? dragon.y;
    const frac = Math.max(0, Math.min(1, 1 - dragon.spawnTimer / 180));
    drawProjectedGroundRing(dx, dy, 68, 'rgba(251, 146, 60, 0.58)', 2.5, [], frac);
    const p = project(dx, dy, 12);
    ctx.save();
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fdba74';
    ctx.strokeStyle = '#06101c';
    ctx.lineWidth = 3;
    const text = `🐉 ${Math.ceil(dragon.spawnTimer)}s`;
    ctx.strokeText(text, p.x, p.y);
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  }

  // 4. Item 53: Subtle Lane Wave-Front Chevron
  const activeMinions = minions.filter(m => m.isAlive);
  if (activeMinions.length >= 2) {
    const wfX = computeWaveFrontX(activeMinions);
    const wfP = project(wfX, laneY(wfX), 3);
    ctx.save();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(wfP.x, wfP.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Item 64: Respawn Countdown Corpse Marker
  for (const c of champions) {
    if (c.isAlive || c.respawnTimer <= 0) continue;
    const p = project(c.x, c.y, 12);
    ctx.save();
    ctx.fillStyle = 'rgba(6, 16, 28, 0.84)';
    ctx.strokeStyle = c.team === 'blue' ? '#38c9ed' : '#f16b84';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(p.x - 22, p.y - 10, 44, 18, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`💀 ${Math.ceil(c.respawnTimer)}s`, p.x, p.y + 2);
    ctx.restore();
  }

  // 6. Item 19: Tactical Ping Badges above Champions making Macro Calls
  for (const c of champions) {
    if (!c.isAlive) continue;
    const intent = c.actionIntent?.kind;
    const isRetreat = c.committedState === 'retreat' || intent === 'retreat';
    const isObjective = intent === 'dragon' || intent === 'jungle' || intent === 'siege';
    if (!isRetreat && !isObjective) continue;
    // Show concise tactical ping icon pulse for 1.2s at the start of each 4s window
    if (Math.floor(matchTime * 2) % 6 !== 0) continue;
    const p = project(c.x, c.y, actorHeight(c.id) + 22);
    ctx.save();
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    const badge = isRetreat ? '⚠' : intent === 'dragon' ? '🐉' : '⚔';
    ctx.fillStyle = isRetreat ? '#facc15' : '#38bdf8';
    ctx.strokeStyle = '#06101c';
    ctx.lineWidth = 2.5;
    ctx.strokeText(badge, p.x, p.y);
    ctx.fillText(badge, p.x, p.y);
    ctx.restore();
  }
}
