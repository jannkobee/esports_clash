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
  // Non-box Overpass perimeter cliffs & sculpted corner blocks (minimap stays 96x112 box, playable area is asymmetric)
  box('outer-cliff-west', -48, -46, -56, 56, 11.5),
  box('outer-cliff-east', 46, 48, -56, 56, 11.5),
  box('outer-cliff-south', -48, 48, -56, -54.5, 9.5),
  box('outer-cliff-north', -48, 48, 54, 56, 11.5),
  box('outer-t-iso-west', -48, -2, -56, -44, 9.2),
  box('outer-t-iso-nw', -18, -10, -44, -39, 9.2),
  box('outer-t-iso-east', 16, 48, -56, -48.5, 9.2),
  box('outer-t-iso-ne', 26.5, 48, -48.5, -42, 8.8),
  box('outer-sw-corner', -48, -36, -44, -34, 9.2),
  box('outer-long-w1', -48, -41, -34, 18, 9.6),
  box('outer-long-w2', -48, -36, 18, 36, 9.6),
  box('outer-nw-corner', -48, -28, 36, 56, 10.2),
  box('outer-ne-corner', 33, 48, 36, 56, 10.2),
  box('outer-b-ne-wall', 44, 48, 22, 36, 9.2),
  box('outer-tracks-east', 41, 48, -42, -16, 8.8),

  // Isolated T Spawn Service Yard (x: -2..16, z: -54..-44, y = 2.8)
  box('t-service-truck', 3, 9, -52.5, -49.5, 5.2, 2.8),
  box('yard-crate-perch', 11.5, 13.8, -51.5, -49.5, 3.5, 2.8, .38),
  box('t-yard-north-wall', 3, 16, -44.0, -42.6, 6.4, 2.8),
  box('drainage-ramp-north-wall', 16, 26.5, -43.5, -41.5, 5.8, 0),
  box('drainage-ramp-south-wall', 16, 26.5, -49.8, -48.5, 4.6, 0),

  // Central Retaining Spines + Upper/Lower Tunnel & Squeaky Service Loop (x = 4.5..16.0)
  box('spine-drainage-cliff-s', 4.5, 16.0, -42.6, -35.0, 8.8, 0),
  box('upper-tunnel-west-s', 4.5, 5.4, -35.0, -32.5, 6.0, 2.8),
  box('upper-tunnel-west-n', 4.5, 5.4, -27.5, -21.0, 6.0, 2.8),
  box('upper-tunnel-east-n', 10.6, 16.0, -29.5, -21.0, 8.8, 0),
  box('upper-tunnel-east-wall', 9.8, 10.6, -21.0, 1.4, 9.2, 0),
  box('squeaky-north-wall', 4.6, 10.6, 0.7, 1.4, 9.2, 5.6),
  box('spine-viaduct-cliff', 4.5, 15.8, 6.8, 29.5, 9.2, 0),
  box('spine-roadway-parapet', 4.5, 10.5, 29.5, 41.0, 9.0, 0),

  // Gardens / Playground / Fountain (y = 2.8 / 3.2) -> Tight L2 Stair Chokes (z in [-21, -14])
  box('gardens-cliff-west', -41, -38, -21, -14, 8.8, 2.8),
  box('gardens-cliff-center', -32, -21, -21, -14, 8.4, 2.8),
  box('gardens-cliff-mid-split', -16, -14, -21, -14, 8.4, 2.8),
  box('plaza-cliff-east', -8, 4.5, -21, -14, 8.4, 2.8),
  box('gardens-playground-frame', -33.0, -30.6, -40.2, -38.4, 4.5, 3.2, .35),
  box('gardens-fountain', -17.5, -13.5, -31.5, -27.5, 4.3, 2.8),
  box('party-plaza-planter', -25.0, -22.5, -26.8, -24.4, 3.95, 2.8),
  box('plaza-service-cover', -10.5, -7.5, -35.5, -32.5, 5.1, 2.8),
  box('gardens-bench-1', -35.5, -31.5, -26.2, -24.8, 3.52, 2.8, .3),
  box('gardens-pergola-pillar-sw', -35.6, -35.0, -34, -33.4, 5.5, 2.8),
  box('gardens-pergola-pillar-se', -29.0, -28.4, -34, -33.4, 5.5, 2.8),
  box('gardens-pergola-pillar-nw', -35.6, -35.0, -29, -28.4, 5.5, 2.8),
  box('gardens-pergola-pillar-ne', -29.0, -28.4, -29, -28.4, 5.5, 2.8),
  box('gardens-pergola-roof', -35.8, -28.2, -34.2, -28.2, 5.8, 5.5, 0, 'roof'),

  // Upper Park / Promenade (Tight A Long, y = 5.6) & Traversable Parkhouse (Toilets)
  box('promenade-planter-south', -40.5, -36.5, -8.5, -5.5, 6.85, 5.6),
  box('long-boulder-rock', -37.2, -34.6, -2.0, 0.6, 7.35, 5.6),
  box('promenade-kiosk-booth', -39.5, -35.0, 4.0, 9.0, 8.4, 5.6),
  box('long-picnic-table', -37.2, -34.8, 10.6, 13.0, 6.42, 5.6, .35),
  box('promenade-bench', -40.6, -38.6, 15.8, 18.2, 6.28, 5.6, .35),
  box('long-boost-crate', -39.5, -37.5, 19.0, 21.0, 6.32, 5.6, .38),
  box('promenade-rail-west', -41.0, -40.7, -14, 18, 6.75, 5.6),
  box('parkhouse-south', -30, -22.5, -11.5, -4.0, 9.8, 5.6),
  box('parkhouse-west-s', -30.0, -29.2, 1.5, 6.2, 8.8, 5.6),
  box('parkhouse-west-n', -30.0, -29.2, 8.8, 15.5, 8.8, 5.6),
  box('parkhouse-east-s', -23.3, -22.5, 1.5, 6.2, 8.8, 5.6),
  box('parkhouse-east-n', -23.3, -22.5, 8.8, 15.5, 8.8, 5.6),
  box('parkhouse-south-w', -29.2, -27.4, 1.5, 2.3, 8.8, 5.6),
  box('parkhouse-south-e', -24.8, -23.3, 1.5, 2.3, 8.8, 5.6),
  box('parkhouse-north-w', -29.2, -27.4, 14.7, 15.5, 8.8, 5.6),
  box('parkhouse-north-e', -24.8, -23.3, 14.7, 15.5, 8.8, 5.6),
  box('parkhouse-sink-divider', -26.8, -25.6, 10.6, 12.8, 7.05, 5.6),

  // Party Terrace, Mid Courtyard & Squeaky/Connector Frame (y = 5.6)
  box('party-mid-divider', -16.0, -14.6, -14.0, -5.0, 8.6, 5.6),
  box('party-table-west', -21.2, -18.6, -11.5, -9.5, 6.45, 5.6, .35),
  box('party-arch-pillar', -18.8, -17.2, -7.2, -5.6, 7.7, 5.6),
  box('mid-utility-island', -10.5, -5.5, -4.0, 1.0, 7.55, 5.6),
  box('mid-planter-bench', -19.2, -16.6, -3.5, -1.2, 6.26, 5.6),
  box('mid-east-frame-s1', 3.7, 4.6, -14, -8.0, 9.5, 5.6),
  box('mid-east-frame-s2', 3.7, 4.6, -4.5, 1.3, 9.5, 5.6),
  box('mid-east-frame-n', 3.7, 4.6, 6.7, 24, 9.5, 5.6),
  box('connector-north-wall', 4.5, 17.8, 6.7, 7.8, 9.2, 0),
  box('connector-west-lower-wall', 9.8, 11.4, -5.8, 1.3, 8.5, 0),
  box('connector-east-wall', 16.3, 17.8, -1.5, 6.8, 8.5, 0),

  // Kiosk (A Short, y = 5.6) & A Main Choke Baffle
  box('a-main-baffle', -22.5, -20.2, 16.0, 18.5, 8.4, 5.6),
  box('kiosk-south-w', -18.0, -14.2, 14.5, 15.2, 8.6, 5.6),
  box('kiosk-south-e', -9.8, -3.8, 14.5, 15.2, 8.6, 5.6),
  box('kiosk-west-wall', -18.0, -17.3, 15.2, 23.2, 8.6, 5.6),
  box('kiosk-east-wall', -4.5, -3.8, 15.2, 23.2, 8.6, 5.6),
  box('kiosk-north-c', -17.3, -13.5, 23.2, 23.9, 8.6, 5.6),
  box('kiosk-north-e', -8.8, -3.8, 23.2, 23.9, 8.6, 5.6),
  box('kiosk-counter', -12.6, -8.6, 18.6, 19.6, 6.68, 5.6, .42),
  box('kiosk-roof', -18.2, -3.6, 14.3, 24.1, 9.1, 8.6, 0, 'roof'),

  // Observation Terrace, Bombsite A (Headquarters) & Hydrology Bank (y = 5.6)
  box('a-terrace-wall-s', -29.8, -28.0, 16, 23.5, 9.0, 5.6),
  box('a-terrace-wall-n', -29.8, -28.0, 33.5, 36.5, 9.4, 5.6),
  box('a-headshot-planter', -33.0, -30.4, 26.5, 28.0, 6.85, 5.6),
  box('a-flowers-sign', -23.6, -21.0, 25.2, 26.0, 7.8, 5.6),
  box('a-response-truck', -22.2, -17.6, 32.5, 37.5, 8.0, 5.6),
  box('a-control-box', -11.0, -8.0, 29.5, 32.0, 7.45, 5.6, .32),
  box('a-flood-barrier', -26.5, -22.5, 26.0, 27.6, 6.95, 5.6),
  box('a-dice-crate', -16.5, -14.2, 38.6, 40.6, 7.3, 5.6, .38),
  box('a-site-pallet', -26.0, -24.1, 34.0, 36.0, 6.26, 5.6, .4),
  box('a-bins-dumpster', -6.5, -4.2, 38.5, 41.2, 7.05, 5.6),
  box('a-hq-wall-west', -29.8, -14.5, 43.8, 45.2, 10.0, 5.6),
  box('a-hq-wall-east', -10.5, -4.5, 43.8, 45.2, 10.0, 5.6),
  box('a-bank-west-wall', -20.5, -19.5, 45.2, 52.5, 9.2, 5.6),
  box('a-bank-north-wall', -19.5, -5.5, 51.8, 52.5, 9.2, 5.6),
  box('a-bank-east-wall-n', -6.2, -5.5, 49.5, 51.8, 9.2, 5.6),
  box('a-bank-counter', -16.5, -14.2, 48.2, 49.6, 6.75, 5.6, .35),
  box('a-bank-van', -27.2, -22.6, 47.0, 49.8, 7.9, 5.6),
  box('a-east-road-divider', 3.6, 4.6, 23.8, 33.0, 7.6, 5.6),

  // CT Security Compound (y = 5.6)
  box('ct-security-van', 12.5, 17.8, 45.5, 48.5, 8.0, 5.6),
  box('ct-barrier-hut', -.5, 3.2, 46.8, 49.8, 8.2, 5.6),
  box('ct-road-parapet-west', -5.2, -4.4, 41.0, 44.5, 7.2, 5.6),

  // Tracks, Drainage & Canal (y = 0.0) + Elevated Canal Bridge Rails (y = 1.4..2.25)
  box('drainage-pipe-cluster', 33.0, 37.5, -36.5, -33.0, 1.85, 0),
  box('drainage-booth', 23.5, 27.0, -29.5, -26.0, 2.8, 0),
  box('canal-tracks-divider', 24.0, 28.5, -24.0, -16.5, 5.6, 0),
  box('canal-divider-pillar', 28.0, 31.0, -15.5, -12.5, 5.6, 0),
  box('canal-utility-box', 37.0, 39.2, -20.5, -18.5, .68, 0, .35),
  box('canal-west-sandbags', 12.5, 15.5, -17.0, -15.2, 1.25, 0, .3),
  box('b-canal-bridge-rail-s', 21.0, 26.5, -14.5, -14.3, 2.25, 1.4),
  box('b-canal-bridge-rail-n', 21.0, 26.5, -9.7, -9.5, 2.25, 1.4),

  // Short Canal, Storm Pipe & Main Tunnel -> Bombsite B (y = 0.0)
  box('b-divider-west', 22.8, 25.6, 1.5, 12.0, 6.4, 0),
  box('b-divider-east', 30.0, 33.5, 1.5, 15.5, 6.4, 0),
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
  box('b-barrels-cluster', 34.4, 36.6, 27.6, 29.6, 1.46, 0, .28),
  box('b-jail-wall-s', 42.6, 46.0, 18.2, 18.8, 2.55, 0),
  box('b-jail-wall-n', 42.2, 46.0, 22.0, 22.6, 2.55, 0),
  box('b-jail-pillar', 43.5, 45.2, 19.8, 21.2, 1.55, 0),

  // Control Deck & A-Under Supports, Under-stair Fill & Upper Railings ('upper' 3.6..5.6m)
  box('b-control-stair-underfill', 15.9, 19.7, 23.2, 26.2, 2.0, 0),
  box('b-north-retaining', 15.9, 32.6, 36.0, 41.0, 3.55, 0),
  box('ct-service-divider', 24.2, 32.8, 36.0, 46.0, 8.6, 0),
  box('ct-service-outer-east', 39.6, 46.0, 29.8, 44.0, 8.6, 0),
  box('a-under-south-rail', 10.6, 16.0, 29.5, 29.9, 4.7, 3.6),
  box('a-under-west-rail', 10.6, 10.9, 29.5, 41.0, 4.7, 3.6),
  box('control-deck-front-rail', 19.8, 29.0, 25.9, 26.2, 3.82, 3.6),
  box('control-deck-east-rail', 28.7, 29.1, 26.0, 36.0, 3.82, 3.6),
  box('control-deck-booth', 24.5, 29.0, 32.6, 36.0, 6.3, 3.6),

  // Rooted park trees (small 0.72m trunks matching clear walkways)
  box('gardens-tree-sw', -25.0, -24.2, -35.0, -34.2, 7.0, 2.8),
  box('promenade-tree-mid', -39.2, -38.4, 1.5, 2.3, 9.8, 5.6),
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
  { id: 'sw-t-mid-screen', name: 'Service Yard to Mid Utility', phase: 'opening', attacking: true, site: 'Mid', mapId: 'spillway', position: { x: -10, z: -25 }, target: { x: -10, z: 3 } },
  { id: 'sw-t-canal-cross', name: 'Service Yard to Canal Crossing', phase: 'opening', attacking: true, site: 'B', mapId: 'spillway', position: { x: 17, z: -41 }, target: { x: 24, z: -12 } },
  { id: 'sw-t-plaza-park', name: 'Plaza Steps to Parkhouse Gap', phase: 'control', attacking: true, site: 'A', mapId: 'spillway', position: { x: -12, z: -24 }, target: { x: -24, z: -1 } },
  { id: 'sw-t-connector', name: 'Mid Courtyard into Connector Mouth', phase: 'control', attacking: true, site: 'Mid', mapId: 'spillway', position: { x: -6, z: 2 }, target: { x: 4, z: 4 } },
  { id: 'sw-t-party-long', name: 'Party Terrace to Promenade Long Rock', phase: 'control', attacking: true, site: 'A', mapId: 'spillway', position: { x: -17, z: -11 }, target: { x: -33, z: 6 } },
  // T Execute A (Headquarters)
  { id: 'sw-a-ct-bank', name: 'Terrace to HQ CT Gate', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -34, z: 22 }, target: { x: -2, z: 37 } },
  { id: 'sw-a-truck-back', name: 'Kiosk Exterior to Response Truck Rear', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -19, z: 16 }, target: { x: -13, z: 36 } },
  { id: 'sw-a-dumpster', name: 'Kiosk to HQ Electrical Cross', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -12, z: 13 }, target: { x: -7, z: 29 } },
  { id: 'sw-a-bank-bins', name: 'Parkhouse North to Bank & Bins', phase: 'execute', attacking: true, site: 'A', mapId: 'spillway', position: { x: -26, z: 18 }, target: { x: -10, z: 42 } },
  // T Execute B (Pumping Station)
  { id: 'sw-b-control-deck', name: 'Short Canal up to Control Deck Heaven', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 18, z: 14 }, target: { x: 23, z: 29, level: 'upper' } },
  { id: 'sw-b-service-exit', name: 'Short Canal to CT Service Exit', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 20, z: 9 }, target: { x: 36, z: 27 } },
  { id: 'sw-b-pillar-cross', name: 'Main Tunnel Entrance to B Pillar Cross', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 38, z: 14 }, target: { x: 28, z: 21 } },
  { id: 'sw-b-pipe-bridge', name: 'Canal Bridge to Storm Pipe Exit', phase: 'execute', attacking: true, site: 'B', mapId: 'spillway', position: { x: 24, z: -12 }, target: { x: 27, z: 18 } },
  // CT Opening / Retake / Delay
  { id: 'sw-ct-a-long', name: 'HQ Gate to A Long Terrace', phase: 'opening', attacking: false, site: 'A', mapId: 'spillway', position: { x: -3, z: 38 }, target: { x: -34, z: 25 } },
  { id: 'sw-ct-b-main', name: 'Service Tunnel to B Main Tunnel Mouth', phase: 'opening', attacking: false, site: 'B', mapId: 'spillway', position: { x: 35, z: 32 }, target: { x: 39, z: 15 } },
  { id: 'sw-ct-b-short', name: 'Control Deck to B Short Sluice', phase: 'opening', attacking: false, site: 'B', mapId: 'spillway', position: { x: 24, z: 29, level: 'upper' }, target: { x: 20, z: 14 } },
  { id: 'sw-ct-mid-control', name: 'Kiosk North to Mid Control', phase: 'control', attacking: false, site: 'Mid', mapId: 'spillway', position: { x: -12, z: 26 }, target: { x: -11, z: 8 } },
  { id: 'sw-ct-squeaky', name: 'Connector Top to Squeaky Mid Door', phase: 'control', attacking: false, site: 'Mid', mapId: 'spillway', position: { x: 0, z: 8 }, target: { x: 3, z: -6 } },
];

const spillwayFineNodes: FpsPoint[] = [
  // Pergola Park Stairs (-38..-32, -21..-14)
  ...Array.from({ length: 8 }, (_, i) => ({ x: -36, z: -21 + i })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: -34, z: -21 + i })),
  // Party South Stairs (-21..-16, -21..-14)
  ...Array.from({ length: 8 }, (_, i) => ({ x: -18, z: -21 + i })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: -19, z: -21 + i })),
  // Plaza Mid Grand Steps (-14..-8, -21..-14)
  ...Array.from({ length: 8 }, (_, i) => ({ x: -12, z: -21 + i })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: -10, z: -21 + i })),
  // Isolated T Spawn -> Playground Choke (-10..4, z = -42; doorway x = -2..3, z = -44) & Drainage Alley Ramp (x = 16..27, z = -46)
  ...Array.from({ length: 8 }, (_, i) => ({ x: 0, z: -47 + i })),
  ...Array.from({ length: 15 }, (_, i) => ({ x: -10 + i, z: -42 })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 16 + i, z: -46 })),
  // Upper/Lower Tunnels & Squeaky Corridor
  ...Array.from({ length: 36 }, (_, i) => ({ x: 7, z: -34 + i })),
  ...Array.from({ length: 36 }, (_, i) => ({ x: 8, z: -34 + i })),
  ...Array.from({ length: 17 }, (_, i) => ({ x: 2 + i, z: -32 })),
  ...Array.from({ length: 7 }, (_, i) => ({ x: 2 + i, z: -6 })),
  // Parkhouse Cross Gap & Traversable Interior (Toilets)
  ...Array.from({ length: 9 }, (_, i) => ({ x: -30 + i, z: -1 })),
  ...Array.from({ length: 19 }, (_, i) => ({ x: -26, z: -1 + i })),
  ...Array.from({ length: 13 }, (_, i) => ({ x: -32 + i, z: 7 })),
  ...Array.from({ length: 13 }, (_, i) => ({ x: -32 + i, z: 8 })),
  // Kiosk Doors & Corridor
  ...Array.from({ length: 10 }, (_, i) => ({ x: -12, z: 14 + i })),
  ...Array.from({ length: 10 }, (_, i) => ({ x: -20, z: 14 + i })),
  // Hydrology Bank Interior & Doorways
  ...Array.from({ length: 10 }, (_, i) => ({ x: -12, z: 42 + i })),
  ...Array.from({ length: 15 }, (_, i) => ({ x: -16 + i, z: 47 })),
  // Connector Stairs & Exit
  ...Array.from({ length: 14 }, (_, i) => ({ x: 4 + i, z: 4 })),
  ...Array.from({ length: 14 }, (_, i) => ({ x: 14, z: 6 - i })),
  // Canal Bridge & Storm Pipe Culvert
  ...Array.from({ length: 14 }, (_, i) => ({ x: 17 + i, z: -12 })),
  ...Array.from({ length: 18 }, (_, i) => ({ x: 28, z: 0 + i })),
  ...Array.from({ length: 8 }, (_, i) => ({ x: 21 + i, z: 14 })),
  // CT -> B Service Tunnel (x = 36, z = 46..28)
  ...Array.from({ length: 20 }, (_, i) => ({ x: 36, z: 46 - i })),
  // Control Deck & A-Under ('upper') + transition seams
  ...Array.from({ length: 28 }, (_, i) => ({ x: 18, z: 16 + i, level: 'upper' as const })),
  ...Array.from({ length: 28 }, (_, i) => ({ x: 22, z: 26 + Math.min(16, i), level: 'upper' as const })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 13, z: 31 + i, level: 'upper' as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ x: 13 + i, z: 31, level: 'upper' as const })),
  { x: 18, z: 16 }, { x: 18, z: 17 },
  { x: 18, z: 42 }, { x: 20, z: 42 }, { x: 22, z: 42 }, { x: 13, z: 42 }, { x: 14, z: 42 },
  { x: 18, z: 42, level: 'upper' }, { x: 20, z: 42, level: 'upper' }, { x: 22, z: 42, level: 'upper' },
  { x: 13, z: 42, level: 'upper' }, { x: 14, z: 42, level: 'upper' },
];

const spillwayFineLinks: [FpsPoint, FpsPoint][] = [
  [{ x: 18, z: 16 }, { x: 18, z: 16, level: 'upper' }],
  [{ x: 18, z: 17 }, { x: 18, z: 17, level: 'upper' }],
  [{ x: 18, z: 42 }, { x: 18, z: 42, level: 'upper' }],
  [{ x: 20, z: 42 }, { x: 20, z: 42, level: 'upper' }],
  [{ x: 22, z: 42 }, { x: 22, z: 42, level: 'upper' }],
  [{ x: 13, z: 42 }, { x: 13, z: 42, level: 'upper' }],
  [{ x: 14, z: 42 }, { x: 14, z: 42, level: 'upper' }],
];

export const SPILLWAY_MAP_DEFINITION: LiveMapDefinition = {
  id: 'spillway',
  runtimeId: 'spillway-v2',
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
    attackers: { x: 6, z: -47 },
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
  perchIgnorePattern: /outer-|spine-|wall|cliff|parapet|rail|roof|pillar|hut|booth|truck|van|underfill|retaining|divider|bank|jail/,
  resolveAssetStyle: resolveSpillwayAsset,
  tactical: {
    A: {
      staging: [{ x: -36, z: 4 }, { x: -26, z: 8 }, { x: -14, z: 4 }],
      rally: [{ x: -34, z: 16 }, { x: -26, z: 18 }, { x: -12, z: 16 }],
      entries: [{ x: -27, z: 28 }, { x: -12, z: 24 }],
      flash: { x: -22, z: 22 },
      smoke: { x: -4, z: 37 },
      holds: [{ x: -12, z: 38 }, { x: -24, z: 39 }, { x: -7, z: 32 }, { x: -12, z: 46 }],
      postPlant: [{ x: -25, z: 30 }, { x: -12, z: 30 }, { x: -33, z: 26 }, { x: -20, z: 21 }, { x: -16, z: 41 }, { x: -12, z: 46 }],
      retakeEntrances: [{ x: -12, z: 45 }, { x: -2, z: 37 }, { x: -12, z: 22 }, { x: -32, z: 29 }],
      postPlantCheeky: [{ x: -26, z: 39 }, { x: -19, z: 39 }, { x: -38, z: 32 }, { x: -7, z: 37 }],
      retakeExtras: [{ x: -12, z: 46 }, { x: -4, z: 38 }, { x: -19, z: 41 }, { x: -32, z: 28 }],
      retakeStaging: [{ x: -8, z: 48 }, { x: 2, z: 40 }, { x: -10, z: 19 }, { x: -35, z: 22 }],
      plantChoices: [
        { x: -15, z: 28.2, style: 'open for Kiosk' },
        { x: -17.5, z: 31, style: 'behind truck' },
        { x: -12.5, z: 31, style: 'safe telemetry box' },
        { x: -15, z: 33.8, style: 'for CT gate & Bank' },
      ],
    },
    B: {
      staging: [{ x: 18, z: 2 }, { x: 28, z: 0 }, { x: 40, z: -2 }],
      rally: [{ x: 18, z: 11 }, { x: 28, z: 12 }, { x: 40, z: 10 }],
      entries: [{ x: 20, z: 16 }, { x: 28, z: 16 }, { x: 39, z: 16 }],
      flash: { x: 26, z: 14 },
      smoke: { x: 23, z: 29, level: 'upper' },
      holds: [{ x: 24, z: 27.1, level: 'upper' }, { x: 35.5, z: 26.8 }, { x: 23.5, z: 22.0 }, { x: 43.2, z: 20.4 }],
      postPlant: [{ x: 37, z: 21 }, { x: 22, z: 19 }, { x: 20, z: 11 }, { x: 39, z: 11 }, { x: 24.5, z: 27.2, level: 'upper' }, { x: 43.2, z: 20.4 }],
      retakeEntrances: [{ x: 36, z: 32 }, { x: 23, z: 29, level: 'upper' }, { x: 18, z: 12 }, { x: 13, z: 35, level: 'upper' }],
      postPlantCheeky: [{ x: 25, z: 31 }, { x: 42, z: 20 }, { x: 35, z: 30 }, { x: 17, z: 28 }],
      retakeExtras: [{ x: 36, z: 33 }, { x: 23, z: 30, level: 'upper' }, { x: 18, z: 12 }],
      retakeStaging: [{ x: 36, z: 36 }, { x: 22, z: 36, level: 'upper' }, { x: 24, z: 6 }],
      plantChoices: [
        { x: 28.5, z: 20.5, style: 'default Pillar' },
        { x: 32.5, z: 21.5, style: 'for Main Tunnel' },
        { x: 26.5, z: 22.0, style: 'safe under Control Deck' },
        { x: 31.5, z: 18.8, style: 'open Short/Pipe' },
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
      splits: { A: { x: -26, z: 8 }, B: { x: 14, z: -5 } },
    },
    chokes: [
      { name: 'Promenade Long', center: { x: -33, z: 28 }, width: 7, axis: 'z' },
      { name: 'Kiosk Short', center: { x: -12, z: 20 }, width: 6, axis: 'x' },
      { name: 'Parkhouse Toilets', center: { x: -26, z: 8 }, width: 5, axis: 'x' },
      { name: 'Short Canal', center: { x: 19, z: 14 }, width: 5, axis: 'x' },
      { name: 'Storm Pipe Mouth', center: { x: 28, z: 15 }, width: 4.5, axis: 'x' },
      { name: 'Main Tunnel Mouth', center: { x: 39, z: 15 }, width: 7, axis: 'x' },
      { name: 'Mid Connector', center: { x: 6, z: 4 }, width: 5, axis: 'z' },
      { name: 'Squeaky Door', center: { x: 4, z: -6 }, width: 3.5, axis: 'z' },
    ],
    callouts: [
      { name: 'Service Yard (T Spawn)', x: 0, z: -48 },
      { name: 'Playground', x: -34, z: -38 },
      { name: 'Gardens', x: -34, z: -32 },
      { name: 'Plaza Fountain', x: -14, z: -29 },
      { name: 'Plaza Steps', x: -12, z: -17 },
      { name: 'Upper Tunnel', x: 7, z: -28 },
      { name: 'Lower Tunnel', x: 14, z: -32 },
      { name: 'Squeaky', x: 7, z: -6 },
      { name: 'Party Terrace', x: -20, z: -8 },
      { name: 'Long Corner', x: -38, z: -12 },
      { name: 'Long Rock', x: -36, z: -1 },
      { name: 'Promenade (A Long)', x: -34, z: 4 },
      { name: 'Long Picnic', x: -36, z: 12 },
      { name: 'Parkhouse (Toilets)', x: -26, z: 8 },
      { name: 'Headshot Planter', x: -32, z: 27 },
      { name: 'Terrace', x: -36, z: 30 },
      { name: 'Mid Courtyard', x: -12, z: 4 },
      { name: 'Kiosk (A Short)', x: -12, z: 19 },
      { name: 'Flowers Sign', x: -22, z: 25 },
      { name: 'Headquarters (A Site)', x: -15, z: 31 },
      { name: 'Response Truck', x: -20, z: 35 },
      { name: 'Bins', x: -5, z: 40 },
      { name: 'Hydrology Bank', x: -13, z: 48 },
      { name: 'A Under Stairs', x: 13, z: 36, level: 'upper' },
      { name: 'CT Security Compound', x: 8, z: 48 },
      { name: 'Connector', x: 13, z: 2 },
      { name: 'Drainage Ramp', x: 22, z: -44 },
      { name: 'Drainage', x: 32, z: -34 },
      { name: 'Waterfront Canal', x: 26, z: -18 },
      { name: 'Canal Bridge', x: 24, z: -12 },
      { name: 'Main Tunnel', x: 40, z: 4 },
      { name: 'Storm Pipe', x: 28, z: 8 },
      { name: 'Short Canal', x: 18, z: 8 },
      { name: 'Pumping Station (B Site)', x: 30, z: 21 },
      { name: 'B Pillar', x: 29, z: 25 },
      { name: 'Barrels', x: 35, z: 29 },
      { name: 'Jail', x: 43, z: 20 },
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
      { key: 'A:parkhouse-toilets', point: { x: -26, z: 8 }, purpose: 'control' },
      { key: 'A:kiosk-center', point: { x: -12, z: 18 }, purpose: 'entry' },
      ...(from.x > 0 && from.z < 10 ? [{ key: 'A:connector-up', point: { x: 2, z: 4 }, purpose: 'flank' as const }] : []),
    ] : [
      { key: 'B:short-canal', point: { x: 18, z: 11 }, purpose: 'entry' },
      { key: 'B:storm-pipe', point: { x: 28, z: 8 }, purpose: 'entry' },
      { key: 'B:main-tunnel', point: { x: 40, z: 10 }, purpose: 'entry' },
      ...(from.x < 4 ? [{ key: 'B:connector-drop', point: { x: 14, z: -6 }, purpose: 'flank' as const }] : []),
    ],
    anchorPoints: {
      A: [{ x: -12, z: 38 }, { x: -24, z: 39 }, { x: -12, z: 46 }],
      B: [{ x: 24, z: 27.1, level: 'upper' }, { x: 35.5, z: 28.5 }],
    },
    lurkPoints: {
      A: [{ x: -26, z: 8 }, { x: -34, z: 12 }],
      B: [{ x: 7, z: -6 }, { x: 28, z: 10 }, { x: 14, z: 1 }],
    },
    spawnDirection: { attackForwardSign: 1, defendForwardSign: -1, spawnSpreadAxis: 'x' },
    surfaceRegions: [
      { id: 'lawn-gardens-w', minX: -46, maxX: -24, minZ: -42, maxZ: -21, surface: 'grass' },
      { id: 'lawn-promenade', minX: -46, maxX: -40, minZ: -14, maxZ: 24, surface: 'grass' },
      { id: 'brick-promenade', minX: -40, maxX: -30, minZ: -14, maxZ: 38, surface: 'brick' },
      { id: 'tile-parkhouse', minX: -30, maxX: -22.5, minZ: 1.5, maxZ: 15.5, surface: 'stone' },
      { id: 'wood-kiosk', minX: -18, maxX: -4, minZ: 15, maxZ: 23, surface: 'wood' },
      { id: 'metal-control-deck', minX: 16, maxX: 29, minZ: 26, maxZ: 36, level: 'upper', surface: 'metal' },
      { id: 'metal-a-under', minX: 10.6, maxX: 16.2, minZ: 29.5, maxZ: 33, level: 'upper', surface: 'metal' },
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
