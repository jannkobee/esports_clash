import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { LiveSkyAtmosphere } from './fpsLiveGraphics.ts';
import type { LiveMapDefinition, LiveMapRuntime, LiveRadialShape, LiveSolid } from './fpsLiveMapTypes.ts';
import { createLiveMapRuntime } from './fpsLiveMap.ts';
import { resolveSpillwayAsset } from './fpsSpillwayDesign.ts';
import { SPILLWAY_TERRAIN_RUNTIME, SPILLWAY_TERRAIN_SPEC } from './fpsSpillwayTerrain.ts';
import type { LiveSmokeLineup } from './fpsSmokeLineupDefinitions.ts';

const box = (
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  height: number,
  baseY = 0,
  bulletPenetration = 0,
  cutawayGroup?: 'roof' | 'overpass' | 'ceiling',
): LiveSolid => {
  const style = resolveSpillwayAsset(id);
  return {
    id, minX, maxX, minZ, maxZ, height, baseY,
    color: style.color,
    bulletPenetration,
    surface: style.acoustic,
    ...(cutawayGroup ? { cutawayGroup } : {}),
  };
};

export const SPILLWAY_SKY_ATMOSPHERE: LiveSkyAtmosphere = {
  stops: [
    [0, '#2c5b8e'],
    [.28, '#5889b8'],
    [.5, '#a8bcc8'],
    [.72, '#e2b98a'],
    [.9, '#d89d68'],
    [1, '#8b9cad'],
  ],
  cloudTint: 'rgba(255,228,192,0.24)',
};

const spillwaySolids: LiveSolid[] = [
  // Outer containment cliffs & perimeter retaining walls (play bounds [-46..46] x [-54..54])
  box('outer-cliff-west', -48, -46, -56, 56, 11.5),
  box('outer-cliff-east', 46, 48, -56, 56, 11.5),
  box('outer-cliff-south', -48, 48, -56, -54.5, 9.5),
  box('outer-cliff-north', -48, 48, 54, 56, 11.5),
  box('outer-fill-sw', -46, -20.5, -54.5, -42, 9.0),
  box('outer-fill-se', 26.5, 46, -54.5, -47.2, 6.2),

  // T Spawn Service Yard (y = 2.8)
  box('t-service-truck', -14, -8, -49.8, -46, 5.2, 2.8),
  box('yard-crate-perch', 5.5, 7.8, -48.5, -46.5, 3.5, 2.8, .38),
  box('t-yard-north-wall', -2, 16, -40.8, -39, 6.4, 2.8),
  box('drainage-ramp-north-wall', 16, 26.5, -41.2, -39.2, 5.8, 0),
  box('drainage-ramp-south-wall', 16, 26.5, -48.5, -47.0, 4.6, 0),

  // Central Retaining Spines separating Upper West District (2.8 / 5.6m) from Lower East District (0.0m)
  box('spine-drainage-cliff', 4.5, 16.0, -40.8, -24, 8.8, 0),
  box('spine-canal-cliff', 4.5, 10.6, -24, 1.3, 8.8, 0),
  box('spine-viaduct-cliff', 4.5, 15.8, 6.8, 33, 9.2, 0),
  box('spine-roadway-parapet', 4.5, 15.8, 33, 41, 7.1, 0),

  // Gardens / Plaza (y = 2.8) -> L2 Ascent Cliff (z in [-21, -14])
  box('gardens-cliff-west', -46, -43, -21, -14, 8.8, 2.8),
  box('gardens-cliff-center', -33, -18, -21, -14, 7.8, 2.8),
  box('plaza-cliff-east', -6, 4.5, -21, -14, 8.4, 2.8),
  box('gardens-fountain', -17.5, -13.5, -31.5, -27.5, 4.3, 2.8),
  box('plaza-service-cover', -10.5, -7.5, -35.5, -32.5, 5.1, 2.8),
  box('gardens-bench-1', -35.5, -31.5, -26.2, -24.8, 3.52, 2.8, .3),
  box('gardens-pergola-pillar-sw', -37.6, -37.0, -34, -33.4, 5.5, 2.8),
  box('gardens-pergola-pillar-se', -31.0, -30.4, -34, -33.4, 5.5, 2.8),
  box('gardens-pergola-pillar-nw', -37.6, -37.0, -29, -28.4, 5.5, 2.8),
  box('gardens-pergola-pillar-ne', -31.0, -30.4, -29, -28.4, 5.5, 2.8),
  box('gardens-pergola-roof', -37.8, -30.2, -34.2, -28.2, 5.8, 5.5, 0, 'roof'),

  // Upper Park / Promenade (A Long, y = 5.6) & Parkhouse Spine
  box('promenade-planter-south', -41.2, -35.8, -8.5, -5.5, 6.85, 5.6),
  box('promenade-kiosk-booth', -39.5, -35.0, 4.0, 9.0, 8.4, 5.6),
  box('promenade-bench', -44.2, -41.6, 15.8, 18.2, 6.28, 5.6, .35),
  box('promenade-rail-west', -46, -45.7, -14, 38, 6.75, 5.6),
  box('parkhouse-south', -30, -22.5, -11.5, -3.5, 9.8, 5.6),
  box('parkhouse-north', -30, -22.5, 1.5, 16, 9.8, 5.6),

  // Mid Courtyard & Connector Frame (y = 5.6)
  box('mid-utility-island', -10.5, -5.5, -4.0, 1.0, 7.55, 5.6),
  box('mid-planter-bench', -19.2, -16.6, -6.2, -3.6, 6.26, 5.6),
  box('mid-east-frame-s', 3.7, 4.6, -14, 1.3, 9.5, 5.6),
  box('mid-east-frame-n', 3.7, 4.6, 6.7, 24, 9.5, 5.6),
  box('connector-north-wall', 4.5, 17.8, 6.7, 7.8, 9.2, 0),
  box('connector-west-lower-wall', 9.6, 11.4, -5.8, 1.3, 8.5, 0),
  box('connector-east-wall', 16.3, 17.8, -1.5, 6.8, 8.5, 0),

  // Kiosk (A Short, y = 5.6): traversable interior + west bypass alley + two doors to A
  box('kiosk-south-w', -18.0, -14.2, 14.5, 15.2, 8.6, 5.6),
  box('kiosk-south-e', -9.8, -3.8, 14.5, 15.2, 8.6, 5.6),
  box('kiosk-west-wall', -18.0, -17.3, 15.2, 23.2, 8.6, 5.6),
  box('kiosk-east-wall', -4.5, -3.8, 15.2, 23.2, 8.6, 5.6),
  box('kiosk-north-c', -17.3, -13.5, 23.2, 23.9, 8.6, 5.6),
  box('kiosk-north-e', -8.8, -3.8, 23.2, 23.9, 8.6, 5.6),
  box('kiosk-counter', -12.6, -8.6, 18.6, 19.6, 6.68, 5.6, .42),
  box('kiosk-roof', -18.2, -3.6, 14.3, 24.1, 9.1, 8.6, 0, 'roof'),

  // Observation Terrace & Bombsite A (Headquarters, y = 5.6)
  box('a-terrace-wall-s', -29.8, -28.0, 16, 23.5, 9.0, 5.6),
  box('a-terrace-wall-n', -29.8, -28.0, 33.5, 44.5, 9.4, 5.6),
  box('a-terrace-planter', -41, -35.5, 26.5, 29.5, 6.9, 5.6),
  box('a-terrace-rail-n', -46, -29.8, 38.0, 38.5, 6.75, 5.6),
  box('a-terrace-rail-back', -46, -29.8, 38.5, 54.0, 9.6, 5.6),
  box('a-response-truck', -22.2, -17.6, 32.5, 37.5, 8.0, 5.6),
  box('a-control-box', -11.0, -8.0, 29.5, 32.0, 7.45, 5.6, .32),
  box('a-flood-barrier', -26.5, -22.5, 26.0, 27.6, 6.95, 5.6),
  box('a-dice-crate', -16.5, -14.2, 38.6, 40.6, 7.3, 5.6, .38),
  box('a-site-pallet', -26.0, -24.1, 34.0, 36.0, 6.26, 5.6, .4),
  box('a-north-hq-wall', -29.8, -4.5, 43.8, 45.2, 10.2, 5.6),
  box('a-east-road-divider', 3.6, 4.6, 23.8, 33.0, 7.6, 5.6),

  // CT Security Compound (y = 5.6)
  box('ct-security-van', 12.5, 17.8, 45.5, 48.5, 8.0, 5.6),
  box('ct-barrier-hut', -.5, 3.2, 46.8, 49.8, 8.2, 5.6),
  box('ct-road-parapet-west', -5.2, -4.4, 41.0, 44.5, 7.2, 5.6),
  box('ct-east-filler', 39.8, 46.0, 35.5, 44.0, 8.8, 0),
  box('ct-compound-east-rail', 43.8, 46.0, 44.0, 54.0, 8.6, 0),

  // Drainage & Canal (y = 0.0)
  box('drainage-pipe-cluster', 33.0, 37.5, -36.5, -33.0, 1.85, 0),
  box('drainage-booth', 23.5, 27.0, -29.5, -26.0, 2.8, 0),
  box('canal-divider-pillar', 28.0, 31.0, -15.5, -12.5, 5.6, 0),
  box('canal-utility-box', 38.0, 40.2, -20.5, -18.5, .68, 0, .35),
  box('canal-west-sandbags', 12.5, 15.5, -17.0, -15.2, 1.25, 0, .3),

  // Short Canal & Main Tunnel -> Bombsite B (y = 0.0)
  box('b-divider-house', 22.8, 33.5, 1.5, 15.5, 6.4, 0),
  box('b-short-sandbags', 14.5, 17.2, 6.2, 7.8, 1.32, 0, .32),
  box('b-tunnel-baffle', 33.5, 37.6, 4.5, 7.5, 3.4, 0),
  box('b-tunnel-east-pocket', 42.4, 46.0, -1.5, 1.5, 3.4, 0),
  box('b-west-perimeter', 13.5, 15.9, 15.5, 36.8, 8.5, 0),
  box('b-silo-pillar', 27.5, 30.5, 23.5, 26.5, 5.6, 0),
  box('b-pump-west', 24.4, 26.8, 24.0, 26.0, 1.75, 0, .25),
  box('b-pump-east', 31.2, 33.6, 24.0, 26.0, 1.75, 0, .25),
  box('b-flood-bags', 22.5, 25.0, 18.6, 20.6, 1.32, 0, .35),
  box('b-east-cabinet', 40.2, 43.2, 23.5, 26.8, 2.15, 0, .28),
  box('b-retake-crate', 30.8, 32.8, 30.2, 32.2, .72, 0, .4),

  // Control Deck Supports, Under-stair Fill & Upper Railings ('upper' 3.6..5.6m)
  box('b-control-stair-underfill', 15.9, 19.7, 23.2, 26.2, 2.0, 0),
  box('b-north-retaining', 15.9, 32.6, 36.0, 41.0, 3.55, 0),
  box('ct-service-divider', 24.2, 32.8, 36.0, 46.0, 8.6, 0),
  box('ct-service-outer-east', 39.6, 46.0, 29.8, 44.0, 8.6, 0),
  box('control-deck-front-rail', 19.8, 29.0, 25.9, 26.2, 3.82, 3.6),
  box('control-deck-east-rail', 28.7, 29.1, 26.0, 36.0, 3.82, 3.6),
  box('control-deck-booth', 24.5, 29.0, 32.6, 36.0, 6.3, 3.6),

  // Rooted park trees (small 0.72m trunks matching clear walkways)
  box('gardens-tree-sw', -25.0, -24.2, -35.0, -34.2, 7.0, 2.8),
  box('promenade-tree-mid', -44.2, -43.4, -2.5, -1.7, 9.8, 5.6),
  box('terrace-tree-nw', -33.2, -32.4, 34.0, 34.8, 9.8, 5.6),
  box('hq-tree-east', -5.5, -4.7, 28.0, 28.8, 9.8, 5.6),
];

const SILO_SHAPES: readonly LiveRadialShape[] = [
  { x: 29, z: 25, minY: 0, maxY: .35, radius: 1.65 },
  { x: 29, z: 25, minY: .35, maxY: 5.6, radius: 1.48 },
];

const GARDENS_FOUNTAIN_SHAPES: readonly LiveRadialShape[] = [
  { x: -15.5, z: -29.5, minY: 2.8, maxY: 3.15, radius: 1.98 },
  { x: -15.5, z: -29.5, minY: 3.15, maxY: 3.62, radius: 1.82, innerRadius: 1.62 },
  { x: -15.5, z: -29.5, minY: 3.2, maxY: 4.3, radius: .42 },
];

const SPILLWAY_SMOKE_LINEUPS: readonly LiveSmokeLineup[] = [
  // T Opening / Control
  { id: 'sw-t-mid-screen', name: 'Service Yard to Mid Utility', phase: 'opening', attacking: true, site: 'Mid', mapId: 'spillway', position: { x: -4, z: -42 }, target: { x: -10, z: 3 } },
  { id: 'sw-t-canal-cross', name: 'Service Yard to Canal Crossing', phase: 'opening', attacking: true, site: 'B', mapId: 'spillway', position: { x: 10, z: -44 }, target: { x: 24, z: -12 } },
  { id: 'sw-t-plaza-park', name: 'Plaza Steps to Parkhouse Gap', phase: 'control', attacking: true, site: 'A', mapId: 'spillway', position: { x: -12, z: -24 }, target: { x: -24, z: -1 } },
  { id: 'sw-t-connector', name: 'Mid Courtyard into Connector Mouth', phase: 'control', attacking: true, site: 'Mid', mapId: 'spillway', position: { x: -6, z: 2 }, target: { x: 4, z: 4 } },
  // T Execute A (Headquarters)
  { id: 'sw-a-ct-bank', name: 'Terrace to HQ CT Gate', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -34, z: 22 }, target: { x: -2, z: 37 } },
  { id: 'sw-a-truck-back', name: 'Kiosk Exterior to Response Truck Rear', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -20, z: 16 }, target: { x: -13, z: 36 } },
  { id: 'sw-a-dumpster', name: 'Kiosk to HQ Electrical Cross', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -12, z: 13 }, target: { x: -7, z: 29 } },
  // T Execute B (Pumping Station)
  { id: 'sw-b-control-deck', name: 'Short Canal up to Control Deck Heaven', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 16, z: 10 }, target: { x: 23, z: 29, level: 'upper' } },
  { id: 'sw-b-service-exit', name: 'Canal Bridge to CT Service Exit', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 28, z: -4 }, target: { x: 35, z: 30 } },
  { id: 'sw-b-pillar-cross', name: 'Main Tunnel Entrance to B Pillar Cross', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 39, z: -2 }, target: { x: 28, z: 21 } },
  // CT Opening / Retake / Delay
  { id: 'sw-ct-a-long', name: 'HQ Gate to A Long Terrace', phase: 'opening', attacking: false, site: 'A', mapId: 'spillway', position: { x: -3, z: 38 }, target: { x: -31, z: 28 } },
  { id: 'sw-ct-b-main', name: 'Service Tunnel to B Main Tunnel Mouth', phase: 'opening', attacking: false, site: 'B', mapId: 'spillway', position: { x: 35, z: 32 }, target: { x: 39, z: 15 } },
  { id: 'sw-ct-b-short', name: 'Control Deck to B Short Sluice', phase: 'opening', attacking: false, site: 'B', mapId: 'spillway', position: { x: 24, z: 29, level: 'upper' }, target: { x: 20, z: 14 } },
  { id: 'sw-ct-mid-control', name: 'Kiosk North to Mid Control', phase: 'control', attacking: false, site: 'Mid', mapId: 'spillway', position: { x: -12, z: 26 }, target: { x: -11, z: 8 } },
];

const spillwayFineNodes: FpsPoint[] = [
  // Pergola Park Stairs (-43..-33, -21..-14)
  ...Array.from({ length: 8 }, (_, i) => ({ x: -38, z: -21 + i })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: -36, z: -21 + i })),
  // Plaza Grand Steps (-18..-6, -21..-14)
  ...Array.from({ length: 8 }, (_, i) => ({ x: -12, z: -21 + i })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: -10, z: -21 + i })),
  // Drainage Ramp (x = 16..27, z = -44)
  ...Array.from({ length: 12 }, (_, i) => ({ x: 16 + i, z: -44 })),
  // Parkhouse Cross Gap (-30..-22, z = -1)
  ...Array.from({ length: 9 }, (_, i) => ({ x: -30 + i, z: -1 })),
  // Kiosk Doors & Corridor
  ...Array.from({ length: 10 }, (_, i) => ({ x: -12, z: 14 + i })),
  ...Array.from({ length: 10 }, (_, i) => ({ x: -20, z: 14 + i })),
  // Connector Stairs & Exit
  ...Array.from({ length: 14 }, (_, i) => ({ x: 4 + i, z: 4 })),
  ...Array.from({ length: 14 }, (_, i) => ({ x: 14, z: 6 - i })),
  // CT -> B Service Tunnel (x = 36, z = 46..28)
  ...Array.from({ length: 20 }, (_, i) => ({ x: 36, z: 46 - i })),
  // Control Deck ('upper') + both CT and B transition seams (x=18/20/22 z=41..42, x=17/18 z=16..18)
  ...Array.from({ length: 28 }, (_, i) => ({ x: 18, z: 16 + i, level: 'upper' as const })),
  ...Array.from({ length: 28 }, (_, i) => ({ x: 22, z: 26 + Math.min(16, i), level: 'upper' as const })),
  { x: 18, z: 16 }, { x: 18, z: 17 },
  { x: 18, z: 42 }, { x: 20, z: 42 }, { x: 22, z: 42 },
  { x: 18, z: 42, level: 'upper' }, { x: 20, z: 42, level: 'upper' }, { x: 22, z: 42, level: 'upper' },
];

const spillwayFineLinks: [FpsPoint, FpsPoint][] = [
  [{ x: 18, z: 16 }, { x: 18, z: 16, level: 'upper' }],
  [{ x: 18, z: 17 }, { x: 18, z: 17, level: 'upper' }],
  [{ x: 18, z: 42 }, { x: 18, z: 42, level: 'upper' }],
  [{ x: 20, z: 42 }, { x: 20, z: 42, level: 'upper' }],
  [{ x: 22, z: 42 }, { x: 22, z: 42, level: 'upper' }],
];

export const SPILLWAY_MAP_DEFINITION: LiveMapDefinition = {
  id: 'spillway',
  runtimeId: 'spillway-v1',
  name: 'Spillway',
  width: 96,
  depth: 112,
  bounds: {
    minX: -48, maxX: 48, minZ: -56, maxZ: 56,
    clampMinX: -45, clampMaxX: 45, clampMinZ: -53, clampMaxZ: 53,
    navMinX: -44, navMaxX: 44, navMinZ: -52, navMaxZ: 52,
  },
  influenceGrid: { minX: -48, minZ: -56, cols: 24, rows: 28, cellSize: 4 },
  spawns: {
    attackers: { x: 0, z: -48 },
    defenders: { x: 8, z: 48 },
  },
  sites: {
    A: { x: -15, z: 31 },
    B: { x: 30, z: 21 },
  },
  siteRadii: { A: 4.2, B: 4.0 },
  solids: spillwaySolids,
  terrainSpec: SPILLWAY_TERRAIN_SPEC,
  radialShapesById: {
    'b-silo-pillar': { maxHeight: 5.6, shapes: SILO_SHAPES },
    'gardens-fountain': { maxHeight: 4.3, shapes: GARDENS_FOUNTAIN_SHAPES },
  },
  elevationDrops: [
    {
      id: 'control-deck-drop',
      name: 'Control Deck railing drop',
      from: { minX: 20, maxX: 28, minZ: 26, maxZ: 28.5 },
      fromLevel: 'upper',
      landing: { x: 24, z: 22.5 },
      minForwardDot: .3,
    },
  ],
  perchIgnorePattern: /outer-|spine-|wall|cliff|parapet|rail|roof|pillar|hut|booth|truck|van|underfill|retaining|divider/,
  resolveAssetStyle: resolveSpillwayAsset,
  tactical: {
    A: {
      staging: [{ x: -36, z: 4 }, { x: -14, z: 4 }],
      rally: [{ x: -34, z: 16 }, { x: -12, z: 16 }],
      entries: [{ x: -27, z: 28 }, { x: -12, z: 24 }],
      flash: { x: -22, z: 22 },
      smoke: { x: -4, z: 37 },
      holds: [{ x: -12, z: 38 }, { x: -24, z: 39 }, { x: -7, z: 32 }],
      postPlant: [{ x: -25, z: 30 }, { x: -12, z: 30 }, { x: -33, z: 26 }, { x: -20, z: 21 }, { x: -16, z: 41 }],
      retakeEntrances: [{ x: -2, z: 37 }, { x: -12, z: 22 }, { x: -32, z: 29 }],
      postPlantCheeky: [{ x: -26, z: 39 }, { x: -19, z: 39 }, { x: -38, z: 32 }],
      retakeExtras: [{ x: -4, z: 38 }, { x: -19, z: 41 }, { x: -32, z: 28 }],
      retakeStaging: [{ x: 2, z: 40 }, { x: -10, z: 19 }, { x: -35, z: 22 }],
      plantChoices: [
        { x: -15, z: 28.2, style: 'open for Kiosk' },
        { x: -17.5, z: 31, style: 'behind truck' },
        { x: -12.5, z: 31, style: 'safe telemetry box' },
        { x: -15, z: 33.8, style: 'for CT gate' },
      ],
    },
    B: {
      staging: [{ x: 18, z: 2 }, { x: 40, z: -2 }],
      rally: [{ x: 18, z: 11 }, { x: 40, z: 10 }],
      entries: [{ x: 20, z: 16 }, { x: 39, z: 16 }],
      flash: { x: 26, z: 14 },
      smoke: { x: 23, z: 29, level: 'upper' },
      holds: [{ x: 24, z: 27.1, level: 'upper' }, { x: 35.5, z: 26.8 }, { x: 23.5, z: 22.0 }, { x: 36.5, z: 21.5 }],
      postPlant: [{ x: 37, z: 21 }, { x: 22, z: 19 }, { x: 20, z: 11 }, { x: 39, z: 11 }, { x: 24.5, z: 27.2, level: 'upper' }],
      retakeEntrances: [{ x: 36, z: 32 }, { x: 23, z: 29, level: 'upper' }, { x: 18, z: 12 }],
      postPlantCheeky: [{ x: 25, z: 31 }, { x: 42, z: 20 }, { x: 17, z: 28 }],
      retakeExtras: [{ x: 36, z: 33 }, { x: 23, z: 30, level: 'upper' }, { x: 18, z: 12 }],
      retakeStaging: [{ x: 36, z: 36 }, { x: 22, z: 36, level: 'upper' }, { x: 24, z: 6 }],
      plantChoices: [
        { x: 28.5, z: 20.5, style: 'default Pillar' },
        { x: 32.5, z: 21.5, style: 'for Main Tunnel' },
        { x: 26.5, z: 22.0, style: 'safe under Control Deck' },
        { x: 31.5, z: 18.8, style: 'open Short/Canal' },
      ],
    },
    mid: {
      approach: { x: -12, z: -24 },
      control: { x: -12, z: 4 },
      underpass: { west: { x: -24, z: -1 }, east: { x: -16, z: -1 } },
      window: {
        hold: { x: -12, z: 18 },
        watch: { x: -12, z: 0 },
        rearApproach: { x: -12, z: 26 },
        sideApproach: { x: -20, z: 14 },
        tApproach: { x: -12, z: 6 },
      },
      splits: { A: { x: -19, z: 16 }, B: { x: 14, z: -5 } },
    },
    chokes: [
      { name: 'Promenade Long', center: { x: -33, z: 28 }, width: 7, axis: 'z' },
      { name: 'Kiosk Short', center: { x: -12, z: 20 }, width: 6, axis: 'x' },
      { name: 'Short Canal', center: { x: 19, z: 14 }, width: 5, axis: 'x' },
      { name: 'Main Tunnel Mouth', center: { x: 39, z: 15 }, width: 7, axis: 'x' },
      { name: 'Mid Connector', center: { x: 6, z: 4 }, width: 5, axis: 'z' },
    ],
    callouts: [
      { name: 'Service Yard (T Spawn)', x: 0, z: -48 },
      { name: 'Gardens', x: -34, z: -32 },
      { name: 'Plaza Fountain', x: -14, z: -29 },
      { name: 'Plaza Steps', x: -12, z: -17 },
      { name: 'Promenade (A Long)', x: -34, z: 4 },
      { name: 'Parkhouse', x: -26, z: -1 },
      { name: 'Terrace', x: -36, z: 30 },
      { name: 'Mid Courtyard', x: -12, z: 4 },
      { name: 'Kiosk (A Short)', x: -12, z: 19 },
      { name: 'Headquarters (A Site)', x: -15, z: 31 },
      { name: 'Response Truck', x: -20, z: 35 },
      { name: 'CT Security Compound', x: 8, z: 48 },
      { name: 'Connector', x: 13, z: 2 },
      { name: 'Drainage Ramp', x: 22, z: -44 },
      { name: 'Drainage', x: 32, z: -34 },
      { name: 'Waterfront Canal', x: 26, z: -14 },
      { name: 'Main Tunnel', x: 40, z: 4 },
      { name: 'Short Canal', x: 18, z: 8 },
      { name: 'Pumping Station (B Site)', x: 30, z: 21 },
      { name: 'B Pillar', x: 29, z: 25 },
      { name: 'B Service Tunnel', x: 36, z: 34 },
      { name: 'Control Deck', x: 23, z: 31, level: 'upper' },
    ],
    intelClassify: (p: FpsPoint) => {
      if (p.x >= 10 && p.z >= -24 && p.z <= 38) return 'B';
      if (p.x <= -2 && p.z >= 14) return 'A';
      if (p.z > 36 && p.x > 4) return 'B';
      return 'Mid';
    },
    assaultExtras: (site, from) => site === 'A' ? [
      { key: 'A:promenade-long', point: { x: -34, z: 24 }, purpose: 'flank' },
      { key: 'A:kiosk-center', point: { x: -12, z: 18 }, purpose: 'entry' },
      ...(from.x > 0 && from.z < 10 ? [{ key: 'A:connector-up', point: { x: 2, z: 4 }, purpose: 'flank' as const }] : []),
    ] : [
      { key: 'B:short-canal', point: { x: 18, z: 11 }, purpose: 'entry' },
      { key: 'B:main-tunnel', point: { x: 40, z: 10 }, purpose: 'entry' },
      ...(from.x < 4 ? [{ key: 'B:connector-drop', point: { x: 14, z: -6 }, purpose: 'flank' as const }] : []),
    ],
    anchorPoints: {
      A: [{ x: -12, z: 38 }, { x: -24, z: 39 }],
      B: [{ x: 24, z: 27.1, level: 'upper' }, { x: 35.5, z: 26.5 }],
    },
    lurkPoints: {
      A: [{ x: -24, z: -1 }, { x: -34, z: 12 }],
      B: [{ x: 14, z: 1 }, { x: 18, z: 6 }],
    },
    spawnDirection: { attackForwardSign: 1, defendForwardSign: -1, spawnSpreadAxis: 'x' },
    surfaceRegions: [
      { id: 'lawn-gardens-w', minX: -46, maxX: -24, minZ: -42, maxZ: -21, surface: 'grass' },
      { id: 'lawn-promenade', minX: -46, maxX: -40, minZ: -14, maxZ: 24, surface: 'grass' },
      { id: 'brick-promenade', minX: -40, maxX: -30, minZ: -14, maxZ: 38, surface: 'brick' },
      { id: 'wood-kiosk', minX: -18, maxX: -4, minZ: 15, maxZ: 23, surface: 'wood' },
      { id: 'metal-control-deck', minX: 16, maxX: 29, minZ: 26, maxZ: 36, level: 'upper', surface: 'metal' },
    ],
  },
  authoredSmokeLineups: SPILLWAY_SMOKE_LINEUPS,
  nav: {
    defaultStep: 2,
    fineLevelStep: 1,
    levels: ['street', 'upper'],
    fineNodes: spillwayFineNodes,
    fineLinks: spillwayFineLinks,
  },
  audio: {
    defaultSurface: 'concrete',
    reverbWet: .34,
    reverbDelayMs: 85,
    lowpassHz: 6900,
    gunshotTailDecay: .28,
  },
  atmosphere: {
    sky: SPILLWAY_SKY_ATMOSPHERE,
    sunDirection: { x: .68, y: -.62, z: -.38 },
    sunHex: '#ffd596',
    sunIntensity: 1.62,
    hemiSkyHex: '#8db4db',
    hemiGroundHex: '#59534b',
    hemiIntensity: .82,
    fogHex: '#b4c2cd',
    fogDensity: .0019,
    baseGroundHex: '#7d8285',
    baseGroundSurface: 'concrete',
  },
  broadcast: {
    displayName: 'Spillway',
    subtitle: 'Municipal Flood Management District',
    themeTag: 'Signal Circuit',
    radarViewBox: { minX: 0, minY: 0, width: 96, height: 112 },
    overviewCamera: { position: { x: 0, y: 112, z: -6 }, target: { x: 0, y: 2, z: 0 }, fov: .92 },
    showcasePoses: [
      { position: { x: -4, y: 42, z: -50 }, target: { x: 0, y: 3, z: 8 }, label: 'Spillway District' },
      { position: { x: -38, y: 26, z: -12 }, target: { x: -15, y: 6, z: 26 }, label: 'Upper Park & HQ (A)' },
      { position: { x: 44, y: 20, z: -16 }, target: { x: 28, y: 2, z: 22 }, label: 'Canal & Pump Station (B)' },
    ],
    freezeShowcaseCenter: { x: 0, z: 2, height: 58 },
    pipAnchorHeights: { A: 7.95, B: 3.9 },
  },
};

export const SPILLWAY_MAP_RUNTIME: LiveMapRuntime = createLiveMapRuntime(SPILLWAY_MAP_DEFINITION, SPILLWAY_TERRAIN_RUNTIME);
