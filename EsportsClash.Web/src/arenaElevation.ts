import { LANDSCAPE, stoneLaneEdges } from './arenaLandform.ts';

/** Presentation height only: game positions, ranges, collision and AI stay 2D. */
export const RIDGE_HEIGHT = 32;
export const RIDGE_RAMPS = { north: [870, 1110, 1490, 1730], south: [960, 1120, 1480, 1640] } as const;
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t);
};
export function ridgeRampInfluence(x: number, north: boolean) {
  let influence=0;
  for(const center of north?RIDGE_RAMPS.north:RIDGE_RAMPS.south)influence=Math.max(influence,1-smooth(24,62,Math.abs(x-center)));
  return influence;
}
export function arenaGroundHeight(x: number, y: number) {
  if (x < 0 || x > 2600 || y < 0 || y > 760) return 0;
  const homeDistance=Math.min(x,2600-x);
  if(homeDistance<=LANDSCAPE.left)return RIDGE_HEIGHT;
  const edge = stoneLaneEdges(x), outside = Math.max(edge.top - y, y - edge.bottom, 0);
  if(outside<=0)return RIDGE_HEIGHT;
  if(outside>=90&&homeDistance>=LANDSCAPE.left+56)return 0;
  const width = 44 + ridgeRampInfluence(x, y < 380) * 46;
  const lane = 1 - smooth(0, width, outside);
  const base = 1 - smooth(LANDSCAPE.left, LANDSCAPE.left + 56, homeDistance);
  return RIDGE_HEIGHT * Math.max(lane, base);
}

/** Same equations are used by the ground mesh and its painted shoulder material. */
export const arenaElevationGLSL = /* glsl */`
 vec2 ridgeLaneEdges(float x){
  float u=clamp((x-${LANDSCAPE.left}.0)/${LANDSCAPE.right-LANDSCAPE.left}.0,0.,1.);
  return vec2(${LANDSCAPE.laneTop}.0+sin(u*12.5663706)*9.+sin(u*28.2743339)*3.,
   ${LANDSCAPE.laneBottom}.0+sin(u*9.42477796+.6)*8.+sin(u*21.9911486)*4.);
 }
 float ridgeRamp(float x,bool north){
  float distanceToRamp=north?
   min(min(abs(x-870.),abs(x-1110.)),min(abs(x-1490.),abs(x-1730.))):
   min(min(abs(x-960.),abs(x-1120.)),min(abs(x-1480.),abs(x-1640.)));
  return 1.-smoothstep(24.,62.,distanceToRamp);
 }
 float ridgeHeight(vec2 p){
  vec2 edge=ridgeLaneEdges(p.x);
  float outside=max(max(edge.x-p.y,p.y-edge.y),0.);
  float width=44.+ridgeRamp(p.x,p.y<380.)*46.;
  float lane=1.-smoothstep(0.,width,outside);
  float base=1.-smoothstep(${LANDSCAPE.left}.0,${LANDSCAPE.left+56}.0,min(p.x,2600.-p.x));
  return ${RIDGE_HEIGHT}.0*max(lane,base);
 }
`;
