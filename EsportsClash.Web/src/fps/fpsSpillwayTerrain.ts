import { createLiveTerrainRuntime, type GroundPatch, type LiveTerrainSolid, type LiveWaterVolume } from './fpsLiveTerrain.ts';

/**
 * Spillway 3-tier Flood Management District Terrain (96m x 112m, [-48..+48] x [-56..+56]):
 *   - Level 0 (0.0m): Drainage -> Canal (shallow splash water) -> Short Canal & Main Tunnel -> Bombsite B & Service Corridor
 *   - Level 1 (2.8m): Service Yard (T Spawn), Lower Gardens, Plaza Fountain, Connector Mid-Landing
 *   - Level 2 (5.6m): Upper Park, Promenade (A Long), Terrace, Mid, Kiosk (A Short), HQ (Bombsite A), CT Compound
 *   - Upper Deck (layer: 'upper', 3.6m..5.6m): Control Deck cantilevered over B NW / Service approach
 */

export const SPILLWAY_SHALLOW_WATERS: readonly LiveWaterVolume[] = [
  { id: 'canal-main-water', minX: 11, maxX: 45, minZ: -23, maxZ: -5, waterY: -.06, bedY: -.18, wadeable: true },
  { id: 'canal-short-gutter', minX: 13.5, maxX: 19.5, minZ: -5, maxZ: 14, waterY: -.06, bedY: -.16, wadeable: true },
];

const stepsZ = (
  prefix: string,
  minX: number,
  maxX: number,
  zStart: number,
  zEnd: number,
  hStart: number,
  hEnd: number,
  count: number,
  surface: 'concrete' | 'stone' = 'concrete',
  layer?: 'upper' | 'street',
): GroundPatch[] => {
  const dz = (zEnd - zStart) / count;
  const dh = (hEnd - hStart) / count;
  return Array.from({ length: count }, (_, i) => {
    const a = zStart + i * dz;
    const b = zStart + (i + 1) * dz;
    const h = Number((hStart + (i + 1) * dh).toFixed(3));
    return {
      id: `${prefix}-${i}`,
      minX,
      maxX,
      minZ: Math.min(a, b),
      maxZ: Math.max(a, b),
      height: h,
      stair: true,
      surface,
      ...(layer === 'upper' ? { layer: 'upper' as const, solidBaseY: Math.max(0, h - .28) } : { solidBaseY: 0 }),
    };
  });
};

const stepsX = (
  prefix: string,
  xStart: number,
  xEnd: number,
  minZ: number,
  maxZ: number,
  hStart: number,
  hEnd: number,
  count: number,
  surface: 'concrete' | 'stone' = 'concrete',
): GroundPatch[] => {
  const dx = (xEnd - xStart) / count;
  const dh = (hEnd - hStart) / count;
  return Array.from({ length: count }, (_, i) => {
    const a = xStart + i * dx;
    const b = xStart + (i + 1) * dx;
    return {
      id: `${prefix}-${i}`,
      minX: Math.min(a, b),
      maxX: Math.max(a, b),
      minZ,
      maxZ,
      height: Number((hStart + (i + 1) * dh).toFixed(3)),
      stair: true,
      surface,
      solidBaseY: 0,
    };
  });
};

export const SPILLWAY_GROUND_PATCHES: readonly GroundPatch[] = [
  // Level 1 (2.8m): Service Yard (T Spawn) & Gardens / Plaza South
  { id: 't-spawn-yard-floor', minX: -20, maxX: 16, minZ: -56, maxZ: -39, height: 2.8, surface: 'concrete', solidColor: '#8d8f8b', solidBaseY: 0 },
  { id: 'gardens-plaza-lower-floor', minX: -46, maxX: 4.5, minZ: -42, maxZ: -21, height: 2.8, surface: 'brick', solidColor: '#a68d76', solidBaseY: 0 },

  // L1 -> L2 Ascent Stairs along z in [-21, -14] (14 steps * 0.20m = 2.8m -> 5.6m)
  ...stepsZ('gardens-promenade-stair', -43, -33, -21, -14, 2.8, 5.6, 14, 'stone'),
  ...stepsZ('plaza-mid-grand-stair', -18, -6, -21, -14, 2.8, 5.6, 14, 'stone'),

  // L1 -> L0 Drainage Ramp from T Spawn East Edge (x = 16 -> 26.5, z in [-47, -41], 14 steps: 2.8 -> 0.0m)
  ...stepsX('t-drainage-ramp', 16, 26.5, -47, -41, 2.8, 0, 14, 'concrete'),

  // Level 2 (5.6m): Continuous Upper District (Promenade, Terrace, Mid, Kiosk, HQ Bombsite A, CT Compound)
  { id: 'upper-park-mid-hq-deck', minX: -46, maxX: 4.5, minZ: -14, maxZ: 44, height: 5.6, surface: 'concrete', solidColor: '#9c9e9a', solidBaseY: 0 },
  { id: 'upper-hq-west-apron', minX: -46, maxX: -28, minZ: 44, maxZ: 54, height: 5.6, surface: 'concrete', solidColor: '#8d908c', solidBaseY: 0 },
  // Kiosk raised interior slab stays level at 5.6m (wooden interior acoustic override via regions)
  { id: 'ct-compound-deck', minX: -4.5, maxX: 44, minZ: 41, maxZ: 54, height: 5.6, surface: 'concrete', solidColor: '#8c9193', solidBaseY: 0 },
  { id: 'ct-a-roadway-bridge', minX: -4.5, maxX: 4.5, minZ: 33, maxZ: 42, height: 5.6, surface: 'concrete', solidColor: '#8c9193', solidBaseY: 0 },

  // Central Connector Dogleg Stairwell (Mid x=+4.5, z in [1.2..6.8], y=5.6 -> Landing x=[10.5..16], y=2.8 -> Canal South z=-5.8, y=0.0)
  ...stepsX('connector-upper-stair', 4.5, 11.5, 1.4, 6.6, 5.6, 2.8, 14, 'concrete'),
  { id: 'connector-mid-landing', minX: 11.5, maxX: 16.2, minZ: 1.4, maxZ: 6.6, height: 2.8, surface: 'concrete', solidColor: '#858a8c', solidBaseY: 0 },
  ...stepsZ('connector-lower-stair', 11.5, 16.2, 1.4, -5.6, 2.8, 0, 14, 'concrete'),

  // CT -> B Service Tunnel Stairs (x=[32.9, 39.6], z=44 -> 30 descending 5.6 -> 0.0 over 28 steps)
  ...stepsZ('ct-b-service-stair', 32.9, 39.6, 44, 30, 5.6, 0, 28, 'concrete'),

  // Canal grate catwalk island at 0.0m above ankle-deep water
  { id: 'canal-grate-catwalk', minX: 20, maxX: 27, minZ: -15, maxZ: -9, height: 0.04, surface: 'metal', solidColor: '#5c666b', solidBaseY: -.2 },

  // Overlapping Upper Layer: Control Deck (3.6m balcony cantilevered over Bombsite B NW + stairs up to CT & down to B)
  // Top seam at CT Compound z=41..42.5 sits at y=5.6m matching ct-compound-deck.
  { id: 'control-deck-ct-seam', minX: 17, maxX: 24, minZ: 41, maxZ: 42.5, height: 5.6, layer: 'upper', surface: 'concrete', solidColor: '#7a8084', solidBaseY: 5.35 },
  ...stepsZ('control-deck-ct-stair', 17, 24, 41, 36, 5.6, 3.6, 10, 'concrete', 'upper'),
  { id: 'control-deck-balcony', minX: 16, maxX: 29, minZ: 26, maxZ: 36, height: 3.6, layer: 'upper', surface: 'metal', solidColor: '#72797d', solidBaseY: 3.3, solidHeight: 3.6 },
  ...stepsZ('control-deck-b-stair', 16, 19.6, 26, 17, 3.6, 0, 18, 'concrete', 'upper'),
  { id: 'control-deck-b-seam', minX: 16, maxX: 19.6, minZ: 15.8, maxZ: 17.2, height: 0, layer: 'upper', surface: 'concrete', noSolid: true },
];

// Roofs & architectural overheads anchored above head height (walkable underneath, block grenades/bullets overhead)
export const SPILLWAY_EXTRA_TERRAIN_SOLIDS: readonly LiveTerrainSolid[] = [
  // Canal Overpass Concrete Viaduct Piers & Overhang framing East Canal / Mid Connector
  { id: 'overpass-viaduct-roof', minX: 3.5, maxX: 17, minZ: -6, maxZ: 7.4, baseY: 8.6, height: 9.2, color: '#696e72', cutawayGroup: 'ceiling' },
  // Vaulted Main Tunnel Roof (open at z=-4 and z=+16, clear 3.4m interior height)
  { id: 'b-main-tunnel-roof', minX: 33.8, maxX: 46.2, minZ: -4, maxZ: 15.8, baseY: 3.4, height: 4.4, color: '#6b7075', cutawayGroup: 'ceiling' },
  // Service Tunnel Roof covering CT->B East stairs
  { id: 'ct-b-service-roof', minX: 32.5, maxX: 40, minZ: 30, maxZ: 44.5, baseY: 8.4, height: 9.1, color: '#787d82', cutawayGroup: 'overpass' },
  // Control Deck Overhead Canopy Hood
  { id: 'control-deck-hood', minX: 16, maxX: 29, minZ: 26, maxZ: 38, baseY: 6.3, height: 6.75, color: '#586166', cutawayGroup: 'roof' },
];

export const SPILLWAY_TERRAIN_SPEC = {
  id: 'spillway',
  bounds: { minX: -50, maxX: 50, minZ: -58, maxZ: 58, cellSize: 4 },
  baseHeight: 0,
  baseSurface: 'concrete' as const,
  groundPatches: SPILLWAY_GROUND_PATCHES,
  wadeableWaterZones: SPILLWAY_SHALLOW_WATERS,
  upperFootprint: [
    { minX: 15.8, maxX: 29.2, minZ: 15.6, maxZ: 42.6 },
  ],
  extraTerrainSolids: SPILLWAY_EXTRA_TERRAIN_SOLIDS,
  defaultPatchColor: '#989a95',
};

export const SPILLWAY_TERRAIN_RUNTIME = createLiveTerrainRuntime(SPILLWAY_TERRAIN_SPEC);
