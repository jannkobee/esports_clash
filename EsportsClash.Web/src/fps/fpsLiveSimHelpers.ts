import type { LiveSolid } from './fpsLiveMapTypes.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTeamId } from './fpsTypes.ts';

/** A flash pop farther than this from an eye blinds for under ~0.8 s even when looked at (see the duration falloff). */
export const FLASH_USEFUL_RANGE = 9.5;
export const LIVE_MAX_DROP_THROW_DIST = 4.8;
export const LIVE_INTERACT_PICKUP_DIST = 2.35;

export const other = (team: FpsTeamId): FpsTeamId => (team === 'blue' ? 'red' : 'blue');
export const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const localHash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
};
export const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const heading = (a: FpsPoint, b: FpsPoint) => Math.atan2(b.x - a.x, b.z - a.z);

export function closestShotApproach(
  point: { x: number; y: number; z: number },
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, length = dx * dx + dy * dy + dz * dz || 1;
  const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy + (point.z - from.z) * dz) / length, 0, 1);
  const x = from.x + dx * t, y = from.y + dy * t, z = from.z + dz * t;
  return { distance: Math.hypot(point.x - x, point.y - y, point.z - z), x, z };
}

const COVER_DESCRIPTOR_RULES: readonly [RegExp, string][] = [
  [/car/, 'behind car'],
  [/truck/, 'behind truck'],
  [/van/, 'behind van'],
  [/rock|boulder/, 'behind rock'],
  [/barrel/, 'behind barrels'],
  [/bins|dumpster/, 'by bins'],
  [/tree/, 'behind tree'],
  [/fountain/, 'behind fountain'],
  [/sandbag|flood-bags/, 'behind sandbags'],
  [/silo|pillar/, 'behind pillar'],
  [/pump/, 'behind pump'],
  [/pallet|crate|dice/, 'behind crates'],
  [/control-box|utility-box|cabinet|box/, 'by electrical box'],
  [/kiosk/, 'by kiosk'],
  [/booth|hut/, 'by booth'],
  [/sign/, 'by sign'],
  [/bank/, 'by bank'],
  [/jail/, 'in jail'],
  [/planter|bench|picnic|barrier|baffle/, 'behind barrier'],
];

/** Describe the nearest tactile landmark near an observed position for concise death callouts. */
export function describeNearbyDeathCover(solids: readonly LiveSolid[], point: FpsPoint, groundY: number): string {
  let bestDist = 5.5;
  let bestLabel = '';
  for (const solid of solids) {
    if (solid.cutawayGroup === 'roof' || solid.cutawayGroup === 'ceiling') continue;
    if (solid.id.includes('underfill') || solid.id.includes('outer')) continue;
    if ((solid.baseY ?? 0) > groundY + 1.8 || solid.height < groundY + 0.45) continue;
    let label = '';
    for (const [pattern, text] of COVER_DESCRIPTOR_RULES) {
      if (pattern.test(solid.id)) {
        label = text;
        break;
      }
    }
    if (!label) continue;
    const dx = point.x < solid.minX ? solid.minX - point.x : point.x > solid.maxX ? point.x - solid.maxX : 0;
    const dz = point.z < solid.minZ ? solid.minZ - point.z : point.z > solid.maxZ ? point.z - solid.maxZ : 0;
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist) {
      bestDist = dist;
      bestLabel = label;
    }
  }
  return bestLabel;
}
