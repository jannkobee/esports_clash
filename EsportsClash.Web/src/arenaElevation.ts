import { LANDSCAPE, topLaneEdges, botLaneEdges } from './arenaLandform.ts';
import { ARENA_WIDTH, ARENA_HEIGHT, LANE_Y, laneY, LANE_SLOPE, ACTIVE_MAP_PROFILE, topLaneY, botLaneY } from './arenaLayout.ts';

/** Presentation height only: game positions, ranges, collision and AI stay 2D. */
export const RIDGE_HEIGHT = 38;
export const RIDGE_RAMPS = ACTIVE_MAP_PROFILE.ramps;

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function ridgeRampInfluence(x: number, north: boolean) {
  let influence = 0;
  for (const center of north ? RIDGE_RAMPS.north : RIDGE_RAMPS.south) {
    influence = Math.max(influence, 1 - smooth(24, 62, Math.abs(x - center)));
  }
  return influence;
}

/** Center X of the organic winding river dividing West and East jungles. */
export function chasmCenterX(y: number) {
  return ARENA_WIDTH / 2 + Math.sin((y - LANE_Y) * 0.0055) * 26;
}

export function arenaGroundHeight(x: number, y: number): number {
  if (x < 0 || x > ARENA_WIDTH || y < 0 || y > ARENA_HEIGHT) return 0;

  // Center River Island (1400, 720) & Boss Coves stay at natural ground level
  const distCenter = Math.hypot(x - ARENA_WIDTH / 2, y - LANE_Y);
  const islandFactor = 1 - smooth(78, 138, distCenter);

  const distTopPit = Math.hypot(x - ARENA_WIDTH / 2, y - 95);
  const distBotPit = Math.hypot(x - ARENA_WIDTH / 2, y - 1345);
  const pitFactor = Math.max(1 - smooth(64, 112, distTopPit), 1 - smooth(64, 112, distBotPit));

  // Top and Bottom organic earthen lanes sit flush with the grassy field (no platform step!)
  const laneX = Math.max(240, Math.min(ARENA_WIDTH - 240, x));
  const topY = topLaneY(laneX);
  const botY = botLaneY(laneX);
  const distTopLane = Math.hypot(x - laneX, y - topY);
  const distBotLane = Math.hypot(x - laneX, y - botY);
  const minLaneDist = Math.min(distTopLane, distBotLane);
  const halfWidth = ACTIVE_MAP_PROFILE.laneHalfWidth;

  // Base clearings and lanes are at RIDGE_HEIGHT; grassy field is flush with a gentle organic roll (0..1.8 units)
  const distBlueBase = Math.hypot(x - 200, y - LANE_Y);
  const distRedBase = Math.hypot(x - (ARENA_WIDTH - 200), y - LANE_Y);
  const baseKeepFlat = Math.max(1 - smooth(120, 220, Math.min(distBlueBase, distRedBase)), islandFactor, minLaneDist <= halfWidth ? 1 : 0);
  const organicWave = (Math.cos((x - 1400) * 0.006) * Math.cos((y - 720) * 0.008) - 0.5) * 1.6 * (1 - baseKeepFlat);
  const groundLevel = RIDGE_HEIGHT + organicWave;

  // River bed gently carved below the grassy field (masked out at river fords, center island, and boss coves)
  const fordMask = smooth(halfWidth - 8, halfWidth + 58, minLaneDist);
  const chasmDist = Math.abs(x - chasmCenterX(y)) + Math.sin(y * 0.018) * 8;
  const riverMask = (1 - smooth(32, 96, chasmDist)) * (1 - islandFactor) * (1 - pitFactor * 0.88) * fordMask;
  const riverDrop = -50.0 * riverMask;

  return Math.max(-14, groundLevel + riverDrop);
}

/** Shader elevation equations used for 3D terrain rendering */
export const arenaElevationGLSL = /* glsl */ `
 vec2 ridgeLaneEdges(float x){
  float ly = ${LANE_Y}.0;
  return vec2(ly - 450.0, ly + 450.0);
 }
 float ridgeHeight(vec2 p){
  return ${RIDGE_HEIGHT}.0;
 }
`;
