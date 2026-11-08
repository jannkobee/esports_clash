import { ARENA_WIDTH, ARENA_HEIGHT, mapLayoutY, BARRACKS_X, LANE_Y, laneY, NEXUS_X, NEXUS_TOWER_X, ACTIVE_MAP_PROFILE, topLaneY, botLaneY, laneCenterY, TOP_LANE_Y, BOT_LANE_Y, LANE_HALF_WIDTH } from './arenaLayout.ts';
export { topLaneY, botLaneY, laneCenterY, TOP_LANE_Y, BOT_LANE_Y, LANE_HALF_WIDTH };
import { arenaCampArt } from './arenaArtDirection.ts';
import { ARAM_BUSHES, CAMP_ROCK_RINGS } from './arenaRules.ts';

type Team = 'blue' | 'red';
type Kind = 'melee' | 'ranged' | 'catapult';
let valleyArtwork: HTMLImageElement | undefined;
export function setArenaMapArtwork(image: HTMLImageElement) { valleyArtwork = image; naturalBackdrop = undefined; }
export const WELL_RADII = { x: 105, y: 240 } as const;
export const HEALING_SHRINE_Y = LANE_Y - 58;
// Forested lowlands surround a raised stone lane and sanctuary courtyards.
export const LANDSCAPE = { left: 430, right: 2370, top: 24, bottom: ARENA_HEIGHT - 24, corner: 86 } as const;

export function topLaneEdges(x: number) {
  const cy = topLaneY(x);
  const half = ACTIVE_MAP_PROFILE.laneHalfWidth;
  return { top: cy - half, bottom: cy + half, center: cy };
}

export function botLaneEdges(x: number) {
  const cy = botLaneY(x);
  const half = ACTIVE_MAP_PROFILE.laneHalfWidth;
  return { top: cy - half, bottom: cy + half, center: cy };
}

export function stoneLaneEdges(x: number) {
  const u = Math.max(0, Math.min(1, (x - LANDSCAPE.left) / (LANDSCAPE.right - LANDSCAPE.left)));
  const ly = laneY(x);
  const gateDist = Math.min(Math.max(0, x - 760), Math.max(0, 2040 - x));
  const laneExpand = Math.min(1, gateDist / 140) * Math.max(0, 170 - 110);
  const midDist = Math.abs(x - ARENA_WIDTH / 2);
  const midExpand = Math.max(0, 1 - (midDist / 340) ** 2) ** 2 * 40;
  const halfWidth = 110 + laneExpand + midExpand;
  return {
    top: ly - halfWidth + Math.sin(u * Math.PI * 4) * 5,
    bottom: ly + halfWidth + Math.sin(u * Math.PI * 3 + 0.6) * 5
  };
}

export function barracksPosition(team: Team, kind: Kind) {
  const outer = kind !== 'ranged';
  const bx = BARRACKS_X[team] + (outer ? (team === 'blue' ? -60 : 60) : 0);
  const by = laneY(BARRACKS_X[team]);
  const offset = kind === 'melee' ? -240 : kind === 'catapult' ? 240 : 0;
  return { x: bx, y: by + offset };
}

/** All wave classes emerge from the Nexus courtyard; barracks still govern empowerment. */
export function minionSpawnPosition(team: Team, type: 'melee' | 'caster' | 'cannon', index: number, lane?: 'top' | 'bot') {
  const dir = team === 'blue' ? 1 : -1;
  const front = type === 'melee' ? 56 : type === 'caster' ? 24 : 10;
  const spawnX = NEXUS_X[team] + dir * (front + index * 14);
  const laneBias = lane === 'top' ? -32 : lane === 'bot' ? 32 : 0;
  const laneCenter = laneY(spawnX) + laneBias;
  return {
    x: spawnX,
    y: laneCenter + (type === 'melee' ? -11 : type === 'caster' ? 11 : (lane ? 0 : 36)) + (type === 'cannon' ? 0 : (index - 1) * 11),
    ...(lane ? { lane } : {})
  };
}

/** Dual-lane wave navigation following organic Top and Bottom lane trails. */
export function advanceLaneMinion(m: { x: number; y: number; team: Team; speed: number; type?: string; lane?: 'top' | 'bot' }, dt: number) {
  const dir = m.team === 'blue' ? 1 : -1;
  const targetLane = m.lane;
  if (targetLane === 'top' || targetLane === 'bot') {
    const lookaheadX = Math.max(240, Math.min(ARENA_WIDTH - 240, m.x + dir * 75));
    const spreadY = m.type === 'melee' ? -10 : m.type === 'caster' ? 10 : 0;
    const goalX = lookaheadX;
    const goalY = laneCenterY(targetLane, lookaheadX) + spreadY;
    const dx = goalX - m.x, dy = goalY - m.y, distance = Math.hypot(dx, dy);
    const step = Math.min(distance, Math.max(0, m.speed * dt));
    if (distance > 0) {
      m.x += dx / distance * step;
      m.y += dy / distance * step;
    }
    m.x = Math.max(40, Math.min(ARENA_WIDTH - 40, m.x));
    return;
  }

  const rallyX = NEXUS_TOWER_X[m.team] - dir * 55;
  const inBase = dir * (rallyX - m.x) > .01;
  const barracksX = BARRACKS_X[m.team];
  const currentCenter = laneY(m.x);
  const side = m.type === 'melee' || (!m.type && m.y < currentCenter) ? -1 : 1;

  let goalX = inBase ? rallyX : m.x + dir * 100;
  let goalY = laneY(goalX);

  if (dir * (barracksX - dir * 60 - m.x) > .01) {
    goalX = barracksX - dir * 60;
    goalY = laneY(barracksX) + side * 58;
  } else if (dir * (barracksX + dir * 60 - m.x) > .01) {
    goalX = barracksX + dir * 60;
    goalY = laneY(barracksX) + side * 58;
  }

  const dx = goalX - m.x, dy = goalY - m.y, distance = Math.hypot(dx, dy);
  const step = Math.min(distance, Math.max(0, m.speed * dt));
  if (distance > 0) {
    m.x += dx / distance * step;
    m.y += dy / distance * step;
  }
  m.x = Math.max(40, Math.min(ARENA_WIDTH - 40, m.x));
}

/** Negative inside the northern/southern forest floor. Never a movement blocker. */
export function lowlandRegionDistance(x: number, y: number) {
  const lane = stoneLaneEdges(x);
  const rounded = (top: number, bottom: number) => {
    const radius = LANDSCAPE.corner, qx = Math.abs(x - (LANDSCAPE.left + LANDSCAPE.right) / 2) - (LANDSCAPE.right - LANDSCAPE.left) / 2 + radius;
    const qy = Math.abs(y - (top + bottom) / 2) - (bottom - top) / 2 + radius;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  };
  return Math.min(rounded(LANDSCAPE.top, lane.top), rounded(lane.bottom, LANDSCAPE.bottom));
}

/** Shared tactical art: forest floor, worn ridge paving, shaded slopes and ramps. */
function paintNaturalArena(ctx: CanvasRenderingContext2D) {
  const floor = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  floor.addColorStop(0, '#263e32'); floor.addColorStop(.5, '#45563b'); floor.addColorStop(1, '#394331');
  ctx.fillStyle = floor; ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  if (valleyArtwork) ctx.drawImage(valleyArtwork, 0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  for (let i = 0; i < 240; i++) {
    const x = (i * 191 + 23) % ARENA_WIDTH, y = (i * 137 + 37) % ARENA_HEIGHT;
    ctx.fillStyle = i % 3 ? 'rgba(138,142,79,.10)' : 'rgba(13,31,26,.20)';
    ctx.beginPath(); ctx.ellipse(x, y, 24 + i % 41, 12 + i % 17, i * .31, 0, Math.PI * 2); ctx.fill();
  }

  // Soft forest trails lead into the camp clearings.
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const y of [430, 1010]) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const x = 420 + i * 1960 / 60, z = y + Math.sin(x * .006) * 13; if (!i) ctx.moveTo(x, z); else ctx.lineTo(x, z); }
    ctx.strokeStyle = 'rgba(109,99,63,.40)'; ctx.lineWidth = 30; ctx.stroke();
    ctx.strokeStyle = 'rgba(151,131,83,.15)'; ctx.lineWidth = 16; ctx.stroke();
  }

  // Cached tactical art shares the camp families without drawing tall props.
  for (const ring of CAMP_ROCK_RINGS) {
    const ground = arenaCampArt(ring.id).ground.map(n => Math.round(n * 255));
    const pad = ctx.createRadialGradient(ring.x, ring.y, ring.radius * .25, ring.x, ring.y, ring.radius * .92);
    pad.addColorStop(0, `rgba(${ground.join(',')},.85)`); pad.addColorStop(1, `rgba(${ground.join(',')},0)`);
    ctx.fillStyle = pad; ctx.beginPath(); ctx.ellipse(ring.x, ring.y, ring.radius, ring.radius * .85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${ground.map(n => Math.min(255, Math.round(n * 1.18))).join(',')},.35)`;
    ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(ring.x + Math.cos(ring.entrance) * ring.radius * .48, ring.y + Math.sin(ring.entrance) * ring.radius * .48);
    ctx.lineTo(ring.x + Math.cos(ring.entrance) * ring.radius * 1.10, ring.y + Math.sin(ring.entrance) * ring.radius * 1.10); ctx.stroke();
  }

  for (const bush of ARAM_BUSHES) {
    ctx.fillStyle = 'rgba(23,43,27,.18)'; ctx.strokeStyle = 'rgba(128,143,79,.46)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(bush.x, bush.y, bush.width / 2, bush.height / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

// Cache immutable paving and forest-floor artwork for the fallback and minimap.
let naturalBackdrop: HTMLCanvasElement | undefined;
export function drawNaturalArena(ctx: CanvasRenderingContext2D, _time: number) {
  if (!naturalBackdrop) {
    const canvas = ctx.canvas.ownerDocument.createElement('canvas'); canvas.width = ARENA_WIDTH; canvas.height = ARENA_HEIGHT;
    const painter = canvas.getContext('2d'); if (painter) { paintNaturalArena(painter); naturalBackdrop = canvas; }
  }
  if (naturalBackdrop) ctx.drawImage(naturalBackdrop, 0, 0); else paintNaturalArena(ctx);
}
