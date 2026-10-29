import { LANDSCAPE, stoneLaneEdges } from './arenaLandform.ts';
import { ARENA_WIDTH, ARENA_HEIGHT, LANE_Y, laneY, LANE_SLOPE } from './arenaLayout.ts';

/** Presentation height only: game positions, ranges, collision and AI stay 2D. */
export const RIDGE_HEIGHT = 38;
export const RIDGE_RAMPS = { north: [950, 1200, 1600, 1850], south: [1050, 1220, 1580, 1750] } as const;
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function ridgeRampInfluence(x: number, north: boolean) {
  let influence = 0;
  for (const center of north ? RIDGE_RAMPS.north : RIDGE_RAMPS.south)
    influence = Math.max(influence, 1 - smooth(24, 62, Math.abs(x - center)));
  return influence;
}
/** Center X of the rugged sunken canyon chasm dividing Radiant and Dire lowlands. */
export function chasmCenterX(y: number) {
  return ARENA_WIDTH / 2 + Math.sin(y * 0.005) * 36 + Math.cos(y * 0.011) * 14;
}
export function arenaGroundHeight(x: number, y: number) {
  if (x < 0 || x > ARENA_WIDTH || y < 0 || y > ARENA_HEIGHT) return 0;
  const homeDistance = Math.min(x, ARENA_WIDTH - x);
  if (homeDistance <= LANDSCAPE.left) return RIDGE_HEIGHT;
  const edge = stoneLaneEdges(x),
    outside = Math.max(edge.top - y, y - edge.bottom, 0);
  if (outside <= 0) return RIDGE_HEIGHT;
  const width = 44 + ridgeRampInfluence(x, y < laneY(x)) * 46;
  const lane = 1 - smooth(0, width, outside);
  const base = 1 - smooth(LANDSCAPE.left, LANDSCAPE.left + 56, homeDistance);
  const ridge = RIDGE_HEIGHT * Math.max(lane, base);

  // In the jungle lowlands, carve the rugged sunken canyon chasm and terraced woodland hills
  const lowlandMask = smooth(26, 82, outside) * smooth(LANDSCAPE.left + 26, LANDSCAPE.left + 105, homeDistance);
  const chasmDist = Math.abs(x - chasmCenterX(y));
  // Sunken canyon gorge dipping down dramatically between the Dragon Caldera and Siege Golem Colosseum
  const chasmDepth = -16.5 * (1 - smooth(42, 132, chasmDist)) * lowlandMask;
  const chasmRim = 4.5 * smooth(48, 120, chasmDist) * (1 - smooth(120, 185, chasmDist)) * lowlandMask;
  const hill = (Math.sin(x * 0.0055) * Math.cos(y * 0.007) * 4.0 + Math.cos((x + y) * 0.004) * 2.2) * lowlandMask * smooth(140, 220, chasmDist);
  const rimMound = 9.5 * (1 - smooth(0, 105, Math.min(y, ARENA_HEIGHT - y))) * lowlandMask;

  return ridge + chasmDepth + chasmRim + hill + rimMound;
}

/** Same equations are used by the ground mesh and its painted shoulder material. */
export const arenaElevationGLSL = /* glsl */ `
 vec2 ridgeLaneEdges(float x){
  float u=clamp((x-${LANDSCAPE.left}.0)/${LANDSCAPE.right - LANDSCAPE.left}.0,0.,1.);
  float ly = ${LANE_Y}.0 + ${LANE_SLOPE} * (x - ${ARENA_WIDTH / 2}.0);
  return vec2(ly - 110.0 + sin(u*12.5663706)*9.+sin(u*28.2743339)*3.,
   ly + 110.0 + sin(u*9.42477796+.6)*8.+sin(u*21.9911486)*4.);
 }
 float ridgeRamp(float x,bool north){
  float distanceToRamp=north?
   min(min(abs(x-950.),abs(x-1200.)),min(abs(x-1600.),abs(x-1850.))):
   min(min(abs(x-1050.),abs(x-1220.)),min(abs(x-1580.),abs(x-1750.)));
  return 1.-smoothstep(24.,62.,distanceToRamp);
 }
 float ridgeHeight(vec2 p){
  vec2 edge=ridgeLaneEdges(p.x);
  float outside=max(max(edge.x-p.y,p.y-edge.y),0.);
  float ly = ${LANE_Y}.0 + ${LANE_SLOPE} * (p.x - ${ARENA_WIDTH / 2}.0);
  float width=44.+ridgeRamp(p.x,p.y<ly)*46.;
  float lane=1.-smoothstep(0.,width,outside);
  float base=1.-smoothstep(${LANDSCAPE.left}.0,${LANDSCAPE.left + 56}.0,min(p.x,${ARENA_WIDTH}.0-p.x));
  return ${RIDGE_HEIGHT}.0*max(lane,base);
 }
`;
