import type { FpsPoint, FpsTerrainLevel, FpsWall, LiveSurfaceAcoustic } from './fpsSpatialWorld.ts';

/** One source for the walkable stair treads, rendered stone and ballistic floor. */
export const LIVE_B_APARTMENTS = Object.freeze({
  minX: 30.4, maxX: 33.4, stairStart: 8, stairEnd: 14, endZ: 21.8,
  height: 1.8, steps: 10, hold: { x: 32, z: 18.6 },
});
/** The CT lookout is entered from the rear stairs, never through a painted wall. */
export const LIVE_MID_WINDOW = Object.freeze({
  minX: -4.5, maxX: 4.5, minZ: 17, maxZ: 26.5, height: 1.8,
  frontZ: 17, openingHalfWidth: 2.1, sillY: 2.82, lintelY: 4.65, roofY: 5.4,
  stairMinX: -4.4, stairMaxX: -1.8, stairStart: 18, stairEnd: 22.4, steps: 12,
  hold: { x: 0, z: 18.6 }, watch: { x: 0, z: 6 }, rearApproach: { x: 2.8, z: 29 },
  sideDoor: { x: -4.5, z: 24 }, sideLanding: { x: -5.8, z: 24 }, sideApproach: { x: -16.2, z: 24 }, tApproach: { x: -3.1, z: 15.8 },
});
export const LIVE_MID_PASSAGE = Object.freeze({
  minX: -7.2, maxX: -4.5, minZ: 22.2, maxZ: 26.5, height: 1.8,
  stairMinZ: 22.5, stairMaxZ: 26.1, stairStart: -7.2, stairEnd: -15.3, steps: 12,
});
export const LIVE_BRIDGE = { minX: -1.6, maxX: 1.6, deckY: 1, parapetY: 1.85, southApproach: -6.2, northEnd: 5.6 };
export const LIVE_STEP_HEIGHT = .24;

export interface LiveTerrainSolid extends FpsWall {
  id: string;
  height: number;
  color: string;
  baseY?: number;
  surface?: LiveSurfaceAcoustic;
  cutawayGroup?: 'roof' | 'overpass' | 'ceiling';
}
export interface LiveGroundRect { minX: number; maxX: number; minZ: number; maxZ: number }
export interface GroundPatch extends LiveGroundRect {
  height: number;
  id?: string;
  suspended?: boolean;
  canal?: boolean;
  streetOnly?: boolean;
  layer?: FpsTerrainLevel;
  excludedLevels?: readonly FpsTerrainLevel[];
  stair?: boolean;
  surface?: LiveSurfaceAcoustic;
  solidColor?: string;
  solidBaseY?: number;
  solidHeight?: number;
  noSolid?: boolean;
}
export interface LiveWaterVolume extends LiveGroundRect {
  id: string;
  waterY: number;
  bedY: number;
  wadeable?: boolean;
  bridges?: readonly { minX: number; maxX: number }[];
}
export interface LiveTerrainBoundsSpec {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellSize?: number;
}
export interface LiveTerrainSpec {
  id: string;
  bounds: LiveTerrainBoundsSpec;
  baseHeight?: number;
  baseSurface?: LiveSurfaceAcoustic;
  groundPatches: readonly GroundPatch[];
  deepWaterZones?: readonly LiveWaterVolume[];
  wadeableWaterZones?: readonly LiveWaterVolume[];
  canalFootprint?: readonly LiveGroundRect[];
  canalBank?: LiveGroundRect & { height: number };
  canalAccess?: readonly LiveGroundRect[];
  upperFootprint?: readonly LiveGroundRect[];
  cutHoles?: readonly LiveGroundRect[];
  terraceBounds?: readonly LiveGroundRect[];
  extraTerrainSolids?: readonly LiveTerrainSolid[];
  defaultPatchColor?: string;
  canalPatchColor?: string;
  disableDefaultClamp?: boolean;
}

export interface LiveTerrainRuntime {
  readonly id: string;
  readonly groundPatches: readonly GroundPatch[];
  readonly terrainSolids: readonly LiveTerrainSolid[];
  readonly canalArea: (point: FpsPoint) => boolean;
  readonly upperArea: (point: FpsPoint) => boolean;
  readonly cutPavingRect: (rect: LiveGroundRect) => LiveGroundRect[];
  readonly riverWater: (point: FpsPoint) => boolean;
  readonly wadeableWater: (point: FpsPoint) => boolean;
  readonly groundHeight: (point: FpsPoint) => number;
  readonly onStairs: (point: FpsPoint) => boolean;
  readonly floorAt: (point: FpsPoint, y: number) => number;
  readonly levelAllowed: (point: FpsPoint) => boolean;
  readonly terrainConnector: (a: FpsPoint, b: FpsPoint) => boolean;
  readonly terrainPathClear: (from: FpsPoint, to: FpsPoint, feetY?: number, allowJump?: boolean) => boolean;
  readonly surfaceAt: (point: FpsPoint, y?: number) => LiveSurfaceAcoustic;
}

const contains = (r: LiveGroundRect, p: FpsPoint) =>
  p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;

function patchApplies(patch: GroundPatch, level: FpsTerrainLevel): boolean {
  if (level === 'upper') {
    return patch.layer === 'upper';
  }
  if (patch.layer === 'upper') return false;
  if (patch.excludedLevels?.includes(level)) return false;
  if (level === 'canal' && (patch.suspended || patch.streetOnly)) return false;
  return true;
}

export function createLiveTerrainRuntime(spec: LiveTerrainSpec): LiveTerrainRuntime {
  const cellSize = spec.bounds.cellSize ?? 4;
  const cols = Math.max(1, Math.ceil((spec.bounds.maxX - spec.bounds.minX) / cellSize));
  const rows = Math.max(1, Math.ceil((spec.bounds.maxZ - spec.bounds.minZ) / cellSize));
  const patchCells: GroundPatch[][] = Array.from({ length: cols * rows }, () => []);

  for (const patch of spec.groundPatches) {
    const x0 = Math.floor((patch.minX - spec.bounds.minX) / cellSize);
    const x1 = Math.floor((patch.maxX - spec.bounds.minX) / cellSize);
    const z0 = Math.floor((patch.minZ - spec.bounds.minZ) / cellSize);
    const z1 = Math.floor((patch.maxZ - spec.bounds.minZ) / cellSize);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < cols && z >= 0 && z < rows) patchCells[z * cols + x].push(patch);
      }
    }
  }

  const canalFootprint = spec.canalFootprint ?? [];
  const canalAccess = spec.canalAccess ?? [];
  const upperFootprint = spec.upperFootprint ?? [];
  const deepWaterZones = spec.deepWaterZones ?? [];
  const wadeableWaterZones = spec.wadeableWaterZones ?? [];
  const cutHoles = spec.cutHoles ?? [];
  const baseHeight = spec.baseHeight ?? 0;
  const baseSurface = spec.baseSurface ?? 'stone';
  const defaultPatchColor = spec.defaultPatchColor ?? '#c5b79b';
  const canalPatchColor = spec.canalPatchColor ?? '#a3a28b';

  const canalArea = (p: FpsPoint) => canalFootprint.some(r => contains(r, p));
  const upperArea = (p: FpsPoint) => upperFootprint.some(r => contains(r, p));

  const cutPavingRect = (rect: LiveGroundRect): LiveGroundRect[] => {
    let parts = [rect];
    for (const hole of cutHoles) {
      parts = parts.flatMap(r => {
        const a = Math.max(r.minX, hole.minX), b = Math.min(r.maxX, hole.maxX);
        const c = Math.max(r.minZ, hole.minZ), d = Math.min(r.maxZ, hole.maxZ);
        if (a >= b || c >= d) return [r];
        return [
          { ...r, maxX: a },
          { ...r, minX: b },
          { minX: a, maxX: b, minZ: r.minZ, maxZ: c },
          { minX: a, maxX: b, minZ: d, maxZ: r.maxZ },
        ].filter(p => p.maxX - p.minX > .001 && p.maxZ - p.minZ > .001);
      });
    }
    return parts;
  };

  const riverWater = (p: FpsPoint): boolean => {
    for (const w of deepWaterZones) {
      if (w.wadeable) continue;
      if (p.x >= w.minX && p.x <= w.maxX && p.z > w.minZ && p.z < w.maxZ) {
        if (w.bridges?.some(b => p.x >= b.minX && p.x <= b.maxX)) continue;
        return true;
      }
    }
    return false;
  };

  const wadeableWater = (p: FpsPoint): boolean => {
    for (const w of wadeableWaterZones) {
      if (contains(w, p)) {
        if (w.bridges?.some(b => p.x >= b.minX && p.x <= b.maxX)) continue;
        return true;
      }
    }
    return false;
  };

  const patchesAt = (point: FpsPoint): readonly GroundPatch[] => {
    const x = Math.floor((point.x - spec.bounds.minX) / cellSize);
    const z = Math.floor((point.z - spec.bounds.minZ) / cellSize);
    if (x < 0 || x >= cols || z < 0 || z >= rows) return [];
    return patchCells[z * cols + x];
  };

  const groundHeight = (point: FpsPoint): number => {
    const level: FpsTerrainLevel = point.level ?? 'street';
    const inBank = spec.canalBank ? contains(spec.canalBank, point) : false;
    let h = baseHeight;
    if (level !== 'upper') {
      for (const w of deepWaterZones) {
        if (contains(w, point)) { h = w.bedY; break; }
      }
      if (h === baseHeight && inBank && spec.canalBank) h = spec.canalBank.height;
      // Access stairs cut below street grade; don't clamp their negative treads to zero.
      if (spec.canalBank && canalAccess.some(r => contains(r, point))) h = spec.canalBank.height;
    } else {
      h = -Infinity;
    }

    const candidates = patchesAt(point);
    for (const patch of candidates) {
      if (contains(patch, point) && patchApplies(patch, level)) {
        h = Math.max(h, patch.height);
      }
    }
    if (level === 'upper') {
      return Number.isFinite(h) ? h : baseHeight;
    }
    if (!spec.disableDefaultClamp && h < -.001 && !inBank && !candidates.some(p => p.canal && contains(p, point))
      && !wadeableWaterZones.some(w => contains(w, point))) {
      h = baseHeight;
    }
    return h;
  };

  const onStairs = (point: FpsPoint): boolean => {
    const level: FpsTerrainLevel = point.level ?? 'street';
    return patchesAt(point).some(p =>
      contains(p, point)
      && !p.suspended
      && patchApplies(p, level)
      && (p.stair === true || p.maxZ - p.minZ < .65 || Boolean(p.id?.includes('stair-'))),
    );
  };

  const floorAt = (point: FpsPoint, y: number): number => {
    if (upperFootprint.length > 0 && upperArea(point)) {
      const upperPatches = patchesAt(point).filter(p => p.layer === 'upper' && contains(p, point));
      if (upperPatches.length > 0) {
        const upperH = groundHeight({ ...point, level: 'upper' });
        if (y >= upperH - .15) return upperH;
      }
    }
    const upper = groundHeight({ ...point, level: undefined });
    return canalFootprint.length > 0 && canalArea(point) && y < upper - .05
      ? groundHeight({ ...point, level: 'canal' })
      : upper;
  };

  const levelAllowed = (point: FpsPoint): boolean => {
    if (point.level === 'canal') return canalArea(point);
    if (point.level === 'upper') {
      return upperArea(point) && patchesAt(point).some(p => p.layer === 'upper' && contains(p, point));
    }
    if (spec.canalBank && contains(spec.canalBank, point)) {
      return groundHeight(point) >= -.001;
    }
    return true;
  };

  const terrainConnector = (a: FpsPoint, b: FpsPoint): boolean =>
    a.x === b.x && a.z === b.z && levelAllowed(a) && levelAllowed(b)
    && Math.abs(groundHeight(a) - groundHeight(b)) <= LIVE_STEP_HEIGHT;

  const terrainPathClear = (from: FpsPoint, to: FpsPoint, feetY?: number, allowJump = false): boolean => {
    const fromLevel: FpsTerrainLevel = from.level ?? 'street';
    const toLevel: FpsTerrainLevel = to.level ?? 'street';
    if (fromLevel !== toLevel) return terrainConnector(from, to);
    if (!levelAllowed(from) || !levelAllowed(to)) return false;
    if (spec.terraceBounds && !spec.terraceBounds.some(patch =>
      Math.max(from.x, to.x) >= patch.minX && Math.min(from.x, to.x) <= patch.maxX
      && Math.max(from.z, to.z) >= patch.minZ && Math.min(from.z, to.z) <= patch.maxZ)) {
      return true;
    }
    const dx = to.x - from.x, dz = to.z - from.z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-10) return !riverWater(to);
    const cuts = [0, 1];
    const minX = Math.min(from.x, to.x), maxX = Math.max(from.x, to.x);
    const minZ = Math.min(from.z, to.z), maxZ = Math.max(from.z, to.z);
    const cut = (t: number) => { if (t > 0 && t < 1) cuts.push(t); };

    if (spec.terraceBounds) {
      for (const patch of spec.groundPatches) {
        if (maxX < patch.minX || minX > patch.maxX || maxZ < patch.minZ || minZ > patch.maxZ) continue;
        if (Math.abs(dx) > 1e-10) { cut((patch.minX - from.x) / dx); cut((patch.maxX - from.x) / dx); }
        if (Math.abs(dz) > 1e-10) { cut((patch.minZ - from.z) / dz); cut((patch.maxZ - from.z) / dz); }
      }
    } else {
      const seen = new Set<GroundPatch>();
      const x0 = Math.max(0, Math.min(cols - 1, Math.floor((minX - spec.bounds.minX) / cellSize)));
      const x1 = Math.max(0, Math.min(cols - 1, Math.floor((maxX - spec.bounds.minX) / cellSize)));
      const z0 = Math.max(0, Math.min(rows - 1, Math.floor((minZ - spec.bounds.minZ) / cellSize)));
      const z1 = Math.max(0, Math.min(rows - 1, Math.floor((maxZ - spec.bounds.minZ) / cellSize)));
      for (let gz = z0; gz <= z1; gz++) {
        for (let gx = x0; gx <= x1; gx++) {
          for (const patch of patchCells[gz * cols + gx]) {
            if (seen.has(patch)) continue;
            seen.add(patch);
            if (maxX < patch.minX || minX > patch.maxX || maxZ < patch.minZ || minZ > patch.maxZ) continue;
            if (Math.abs(dx) > 1e-10) { cut((patch.minX - from.x) / dx); cut((patch.maxX - from.x) / dx); }
            if (Math.abs(dz) > 1e-10) { cut((patch.minZ - from.z) / dz); cut((patch.maxZ - from.z) / dz); }
          }
        }
      }
      if (fromLevel === 'upper') {
        for (const r of upperFootprint) {
          if (maxX < r.minX || minX > r.maxX || maxZ < r.minZ || minZ > r.maxZ) continue;
          if (Math.abs(dx) > 1e-10) { cut((r.minX - from.x) / dx); cut((r.maxX - from.x) / dx); }
          if (Math.abs(dz) > 1e-10) { cut((r.minZ - from.z) / dz); cut((r.maxZ - from.z) / dz); }
        }
      }
    }

    for (const water of deepWaterZones) {
      if (maxZ > water.minZ && minZ < water.maxZ && maxX >= water.minX && minX <= water.maxX) {
        if (Math.abs(dz) > 1e-10) { cut((water.minZ - from.z) / dz); cut((water.maxZ - from.z) / dz); }
        if (Math.abs(dx) > 1e-10 && water.bridges) {
          for (const bridge of water.bridges) {
            cut((bridge.minX - from.x) / dx); cut((bridge.maxX - from.x) / dx);
          }
        }
      }
    }

    cuts.sort((a, b) => a - b);
    let count = 1;
    for (let i = 1; i < cuts.length; i++) if (cuts[i] - cuts[count - 1] > 1e-10) cuts[count++] = cuts[i];
    cuts.length = count;
    let support = Math.max(groundHeight(from), feetY ?? -Infinity);
    const allowed = allowJump ? .6 : LIVE_STEP_HEIGHT;
    for (let i = 0; i < cuts.length; i++) {
      const t = i === cuts.length - 1 ? 1 : (cuts[i] + cuts[i + 1]) / 2;
      const point: FpsPoint = { x: from.x + dx * t, z: from.z + dz * t, level: from.level };
      const ground = groundHeight(point);
      if (riverWater(point) || !levelAllowed(point)) return false;
      if (ground > support + allowed + 1e-6) return false;
      support = Math.max(ground, feetY ?? -Infinity);
    }
    return true;
  };

  const surfaceAt = (point: FpsPoint, y?: number): LiveSurfaceAcoustic => {
    const level: FpsTerrainLevel = point.level ?? 'street';
    const checkY = y ?? groundHeight(point);
    let bestH = -Infinity;
    let bestSurface: LiveSurfaceAcoustic | undefined;
    for (const patch of patchesAt(point)) {
      if (!contains(patch, point) || !patchApplies(patch, level)) continue;
      if (patch.surface && patch.height >= bestH - .05) {
        bestH = patch.height;
        bestSurface = patch.surface;
      }
    }
    if (level !== 'upper' && checkY <= 0.08 && !bestSurface && wadeableWater(point)) return 'water';
    return bestSurface ?? baseSurface;
  };

  const terrainSolids: LiveTerrainSolid[] = [
    ...spec.groundPatches
      .filter(p => !p.noSolid)
      .map((patch, i) => ({
        id: patch.id ?? `${spec.id}-patch-${i}`,
        minX: patch.minX,
        maxX: patch.maxX,
        minZ: patch.minZ,
        maxZ: patch.maxZ,
        height: patch.solidHeight ?? patch.height,
        color: patch.solidColor ?? (patch.canal ? canalPatchColor : defaultPatchColor),
        baseY: patch.solidBaseY ?? (patch.suspended ? patch.height - .18 : patch.canal ? -1.4 : 0),
        surface: patch.surface,
      })),
    ...(spec.extraTerrainSolids ?? []),
  ];

  return {
    id: spec.id,
    groundPatches: spec.groundPatches,
    terrainSolids,
    canalArea,
    upperArea,
    cutPavingRect,
    riverWater,
    wadeableWater,
    groundHeight,
    onStairs,
    floorAt,
    levelAllowed,
    terrainConnector,
    terrainPathClear,
    surfaceAt,
  };
}

// =============================================================================
// Fontessa Village Default Terrain (100% Bit-Identical Preserved Compatibility)
// =============================================================================
const apartment = LIVE_B_APARTMENTS;
const treadDepth = (apartment.stairEnd - apartment.stairStart) / apartment.steps;
export const LIVE_CANAL_BANK = { minX: -20.5, maxX: 30.4, minZ: 2.9, maxZ: 5.6, height: -1.2 };
const canalAccess = [
  { minX: 18.8, maxX: 21.2, minZ: 5.6, maxZ: 9.6 },
  { minX: -20.5, maxX: -18.5, minZ: 5.6, maxZ: 10.4 },
  { minX: 28.4, maxX: 30.4, minZ: 4.4, maxZ: 8.4 },
];
const canalFootprint = [LIVE_CANAL_BANK, ...canalAccess];

// A five-metre urban canal, bounded by masonry quays rather than exposed riverbanks.
// The harbor is scenery beyond the northern play boundary; CT gathers on its dry quay.
export const LIVE_CANAL = { minX: -115, maxX: 115, minZ: -2.2, maxZ: 2.8, waterY: -1.6, bedY: -2.5 };
export const LIVE_PORT = { minX: -115, maxX: 115, minZ: 44.5, maxZ: 125, waterY: -1.6, bedY: -3 };
export const LIVE_CANAL_CROSSINGS = [
  { minX: -33, maxX: -29 }, { minX: -21, maxX: -16 }, { minX: -1.6, maxX: 1.6 },
  { minX: 18, maxX: 21.8 }, { minX: 28.7, maxX: 33.4 },
];
export const LIVE_RIVER = LIVE_CANAL;
export const LIVE_RIVER_BRIDGES = LIVE_CANAL_CROSSINGS;
export const LIVE_OBJECT_PERCHES: readonly { id: string; x: number; z: number }[] = [];

const fontessaGroundPatches: GroundPatch[] = [
  { ...LIVE_MID_WINDOW, minX: -1.68, maxZ: 20.5, id: 'mid-window-room-floor', surface: 'wood' },
  { minX: -4.5, maxX: 1.2, minZ: 22.4, maxZ: 26.5, height: 1.8, id: 'mid-window-upper-gallery', surface: 'wood' },
  { minX: -1.68, maxX: 1.2, minZ: 20.5, maxZ: 22.4, height: 1.8, id: 'mid-window-upper-hall', surface: 'wood' },
  ...Array.from({ length: 12 }, (_, i) => ({
    minX: 1.2, maxX: 4.5, minZ: 20.5 + i * .5, maxZ: 20.5 + (i + 1) * .5,
    height: (12 - i) * .15, id: `mid-window-ct-interior-stair-${i}`, surface: 'stone' as const,
  })),
  { ...LIVE_MID_PASSAGE, id: 'mid-window-side-passage-floor', surface: 'wood' },
  ...Array.from({ length: 12 }, (_, i) => ({
    minX: -7.2 - (i + 1) * .675, maxX: -7.2 - i * .675, minZ: 22.5, maxZ: 26.1,
    height: (12 - i) * .15, id: `mid-window-side-stair-${i}`, surface: 'stone' as const,
  })),
  ...Array.from({ length: LIVE_MID_WINDOW.steps }, (_, i) => ({
    minX: LIVE_MID_WINDOW.stairMinX, maxX: LIVE_MID_WINDOW.stairMaxX,
    minZ: LIVE_MID_WINDOW.stairStart + i * (LIVE_MID_WINDOW.stairEnd - LIVE_MID_WINDOW.stairStart) / LIVE_MID_WINDOW.steps,
    maxZ: LIVE_MID_WINDOW.stairStart + (i + 1) * (LIVE_MID_WINDOW.stairEnd - LIVE_MID_WINDOW.stairStart) / LIVE_MID_WINDOW.steps,
    height: (i + 1) * .15, id: `mid-window-rear-stair-${i}`, surface: 'stone' as const,
  })),
  { ...LIVE_CANAL_BANK, id: 'canal-bank-floor', canal: true, surface: 'stone' },
  ...Array.from({ length: 6 }, (_, i) => ({
    minX: 18.8, maxX: 21.2, minZ: 5.6 + i * .6, maxZ: 5.6 + (i + 1) * .6,
    height: -1.2 + (i + 1) * .2, canal: true, id: `canal-market-north-stair-${i}`, surface: 'stone' as const,
  })),
  ...[{ minX: -21, maxX: -16 }, { minX: 18, maxX: 21.8 }].flatMap((r, k) => [
    { ...r, minZ: 2.8, maxZ: 4.2, height: 0, canal: true, id: `canal-stair-landing-${k}`, surface: 'stone' as const },
    ...Array.from({ length: 6 }, (_, i) => ({
      minX: r.maxX + i * .55, maxX: r.maxX + (i + 1) * .55, minZ: 2.9, maxZ: 4.2,
      height: -(i + 1) * .2, canal: true, id: `canal-stair-side-${k}-${i}`, surface: 'stone' as const,
    })),
  ]),
  ...Array.from({ length: 6 }, (_, i) => ({
    minX: -20.5, maxX: -18.5, minZ: 5.6 + i * .6, maxZ: 5.6 + (i + 1) * .6,
    height: -1.2 + (i + 1) * .2, canal: true, id: `canal-west-stair-${i}`, surface: 'stone' as const,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    minX: 28.4, maxX: 30.4, minZ: 4.4 + i * .6, maxZ: 4.4 + (i + 1) * .6,
    height: -1.2 + (i + 1) * .2, canal: true, id: `canal-apartment-stair-${i}`, surface: 'stone' as const,
  })),
  ...LIVE_RIVER_BRIDGES.filter(p => p.minX !== -1.6).map(p => ({
    ...p, minZ: LIVE_RIVER.minZ, maxZ: LIVE_RIVER.maxZ, height: 0, suspended: true, surface: 'stone' as const,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    minX: -1.6, maxX: 1.6, minZ: LIVE_BRIDGE.southApproach + i * .8, maxZ: LIVE_BRIDGE.southApproach + (i + 1) * .8,
    height: (i + 1) * .2, id: `bridge-south-stair-${i}`, surface: 'stone' as const,
  })),
  { minX: -1.6, maxX: 1.6, minZ: LIVE_RIVER.minZ, maxZ: 5.6, height: 1, suspended: true, id: 'bridge-central-deck', surface: 'stone' },
  ...Array.from({ length: 5 }, (_, i) => ({
    minX: -1.6, maxX: 1.6, minZ: 5.6 + i * .8, maxZ: 5.6 + (i + 1) * .8,
    height: (5 - i) * .2, id: `bridge-north-stair-${i}`, surface: 'stone' as const,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    minX: 30.4, maxX: 33.4, minZ: -34 + i * .6, maxZ: -34 + (i + 1) * .6,
    height: (i + 1) * .18, surface: 'stone' as const,
  })),
  { minX: 30.4, maxX: 33.4, minZ: -28, maxZ: apartment.endZ, height: 1.8, surface: 'wood' },
  ...Array.from({ length: apartment.steps }, (_, i) => ({
    minX: 28.4, maxX: 30.4, minZ: apartment.stairStart + i * treadDepth, maxZ: apartment.stairStart + (i + 1) * treadDepth,
    height: apartment.height * (i + 1) / apartment.steps, surface: 'stone' as const,
  })),
  { minX: 28.4, maxX: 33.4, minZ: 14, maxZ: 14.8, height: 1.8, surface: 'wood' },
  ...Array.from({ length: 3 }, (_, i) => ({
    minX: -25.2, maxX: -20.8, minZ: 24.9 + i * .46, maxZ: 24.9 + (i + 1) * .46,
    height: (i + 1) * .15, surface: 'stone' as const,
  })),
];

/** Segmented masonry vaults: the underside remains an open, shared collision arch. */
export const LIVE_BRIDGE_VAULTS: readonly LiveTerrainSolid[] = [
  ...[[LIVE_RIVER.minZ, LIVE_RIVER.maxZ], [2.9, 5.6]].flatMap(([start, end], span) => Array.from({ length: 18 }, (_, i) => {
    const z0 = start + (end - start) * i / 18, z1 = start + (end - start) * (i + 1) / 18;
    const arch = (z: number) => (span === 0 ? -2.1 : -.1) + Math.sqrt(Math.max(0, 1 - ((z - (start + end) / 2) / ((end - start) / 2)) ** 2)) * (span === 0 ? 2.82 : .82);
    return {
      id: `bridge-vault-${span}-${i}`, minX: -1.6, maxX: 1.6, minZ: z0, maxZ: z1,
      baseY: Math.min(arch(z0), arch(z1)), height: .82, color: '#a27e64',
    };
  })),
];

const fontessaExtraSolids: LiveTerrainSolid[] = [
  ...LIVE_BRIDGE_VAULTS,
  ...fontessaGroundPatches.filter(p => p.id?.startsWith('bridge-') && p.id.includes('stair')).flatMap(p => [-1, 1].map(side => ({
    id: `${p.id}-cheek-${side}`, minX: side * 1.7 - .12, maxX: side * 1.7 + .12, minZ: p.minZ, maxZ: p.maxZ,
    baseY: 0, height: p.height + .85, color: '#a47d64',
  }))),
  ...[LIVE_RIVER.minZ, 2.85, 5.6].map(z => ({
    id: `bridge-springing-${z}`, minX: -1.6, maxX: 1.6, minZ: z - .1, maxZ: z + .1,
    baseY: LIVE_RIVER.bedY, height: z < 0 ? -2.05 : -.1, color: '#a7977b',
  })),
  ...[
    { id: 'canal-quay-bakery', minX: -7.5, maxX: -2, minZ: -8, maxZ: -2 },
    { id: 'canal-quay-east-homes', minX: 3, maxX: 14, minZ: -18, maxZ: -2 },
    { id: 'canal-quay-apartment-crossing', minX: 30.4, maxX: 33.4, minZ: LIVE_RIVER.minZ, maxZ: LIVE_RIVER.maxZ },
  ].map(r => ({ ...r, baseY: LIVE_RIVER.bedY, height: 0, color: '#929783' })),
  { id: 'b-apartments-roof', minX: 30.15, maxX: 37.5, minZ: 13.7, maxZ: 22.3, baseY: 4.35, height: 4.52, color: '#b16d4e', cutawayGroup: 'roof' },
];

export const FONTESSA_TERRAIN_RUNTIME = createLiveTerrainRuntime({
  id: 'fontessa',
  bounds: { minX: -36, maxX: 36, minZ: -46, maxZ: 50, cellSize: 4 },
  baseHeight: 0,
  baseSurface: 'stone',
  groundPatches: fontessaGroundPatches,
  deepWaterZones: [{ id: 'canal', ...LIVE_CANAL, wadeable: false, bridges: LIVE_CANAL_CROSSINGS }],
  canalFootprint,
  canalBank: LIVE_CANAL_BANK,
  canalAccess,
  cutHoles: [
    { minX: -200, maxX: 200, minZ: LIVE_CANAL.minZ, maxZ: LIVE_CANAL.maxZ },
    LIVE_PORT,
    LIVE_CANAL_BANK,
    { minX: 18.8, maxX: 21.2, minZ: 5.6, maxZ: 9.2 },
    { minX: -20.5, maxX: -18.5, minZ: 5.6, maxZ: 9.2 },
    { minX: 28.4, maxX: 30.4, minZ: 4.4, maxZ: 8.4 },
  ],
  terraceBounds: [
    { minX: 28.4, maxX: 33.4, minZ: -34, maxZ: 21.8 },
    { minX: -25.2, maxX: -20.8, minZ: 24.9, maxZ: 26.28 },
    { minX: -34, maxX: 34, minZ: -10.2, maxZ: 11.6 },
    { minX: -19, maxX: 4.7, minZ: 7.8, maxZ: 29.2 },
  ],
  extraTerrainSolids: fontessaExtraSolids,
  defaultPatchColor: '#c5b79b',
  canalPatchColor: '#a3a28b',
});

export const LIVE_TERRAIN_SOLIDS: readonly LiveTerrainSolid[] = FONTESSA_TERRAIN_RUNTIME.terrainSolids;
export const liveCanalArea = FONTESSA_TERRAIN_RUNTIME.canalArea;
export const liveCutPavingRect = FONTESSA_TERRAIN_RUNTIME.cutPavingRect;
export const liveRiverWater = FONTESSA_TERRAIN_RUNTIME.riverWater;
export const liveGroundHeight = FONTESSA_TERRAIN_RUNTIME.groundHeight;
export const liveOnStairs = FONTESSA_TERRAIN_RUNTIME.onStairs;
export const liveFloorAt = FONTESSA_TERRAIN_RUNTIME.floorAt;
export const liveTerrainLevelAllowed = FONTESSA_TERRAIN_RUNTIME.levelAllowed;
export const liveTerrainConnector = FONTESSA_TERRAIN_RUNTIME.terrainConnector;
export const liveTerrainPathClear = FONTESSA_TERRAIN_RUNTIME.terrainPathClear;
