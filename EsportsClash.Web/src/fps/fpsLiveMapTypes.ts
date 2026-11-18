import type { FpsPoint, FpsTerrainLevel, FpsWall, LiveSurfaceAcoustic } from './fpsSpatialWorld.ts';
import type { LiveSkyAtmosphere, LiveSurface } from './fpsLiveGraphics.ts';
import type { LiveTerrainRuntime, LiveTerrainSolid, LiveTerrainSpec } from './fpsLiveTerrain.ts';
import type { LiveSmokeLineup } from './fpsSmokeLineupDefinitions.ts';

export type LiveMapId = 'fontessa' | 'spillway';

export interface LiveSolid extends FpsWall {
  id: string;
  height: number;
  color: string;
  baseY?: number;
  bulletPenetration?: number;
  surface?: LiveSurfaceAcoustic;
  cutawayGroup?: 'roof' | 'overpass' | 'ceiling';
}

export interface LiveWorldPoint extends FpsPoint { y: number }
export interface LiveWallIntersection { wall: LiveSolid; t: number }

export interface LiveRadialShape {
  x: number;
  z: number;
  minY: number;
  maxY: number;
  radius: number;
  innerRadius?: number;
}

export interface LiveMapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  clampMinX: number;
  clampMaxX: number;
  clampMinZ: number;
  clampMaxZ: number;
  navMinX: number;
  navMaxX: number;
  navMinZ: number;
  navMaxZ: number;
}

export interface LiveMapCallout {
  name: string;
  x: number;
  z: number;
  level?: FpsTerrainLevel;
}

export interface LiveElevationDrop {
  id: string;
  name: string;
  from: { minX: number; maxX: number; minZ: number; maxZ: number };
  fromLevel?: FpsTerrainLevel;
  landing: FpsPoint;
  minForwardDot: number;
}

export interface LiveJumpablePerch {
  id: string;
  name: string;
  top: FpsPoint;
  height: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  approach: FpsPoint;
  approaches: readonly FpsPoint[];
}

export interface LivePlantChoice extends FpsPoint {
  style: string;
}

export interface LiveApproachTemplate {
  key: string;
  point: FpsPoint;
  purpose: 'entry' | 'control' | 'flank' | 'clear';
  minZ?: number;
  maxZ?: number;
}

export interface LiveSiteTactics {
  staging: readonly FpsPoint[];
  rally: readonly FpsPoint[];
  entries: readonly FpsPoint[];
  flash: FpsPoint;
  smoke: FpsPoint;
  holds: readonly FpsPoint[];
  postPlant: readonly FpsPoint[];
  retakeEntrances: readonly FpsPoint[];
  postPlantCheeky: readonly FpsPoint[];
  retakeExtras: readonly FpsPoint[];
  retakeStaging: readonly FpsPoint[];
  plantChoices: readonly LivePlantChoice[];
}

export interface LiveTacticalProfile {
  A: LiveSiteTactics;
  B: LiveSiteTactics;
  mid: {
    approach: FpsPoint;
    control: FpsPoint;
    underpass: { west: FpsPoint; east: FpsPoint };
    window: {
      hold: FpsPoint;
      watch: FpsPoint;
      rearApproach: FpsPoint;
      sideApproach?: FpsPoint;
      tApproach?: FpsPoint;
    };
    splits: { A: FpsPoint; B: FpsPoint };
  };
  chokes: readonly {
    name: string;
    center: FpsPoint;
    width: number;
    axis: 'x' | 'z';
  }[];
  callouts: readonly LiveMapCallout[];
  intelClassify: (point: FpsPoint) => 'A' | 'B' | 'Mid';
  assaultExtras: (site: 'A' | 'B', from: FpsPoint) => LiveApproachTemplate[];
  anchorPoints: { A: readonly FpsPoint[]; B: readonly FpsPoint[] };
  lurkPoints: { A: readonly FpsPoint[]; B: readonly FpsPoint[]; stealthBounds?: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] };
  spawnDirection: { attackForwardSign: 1 | -1; defendForwardSign: 1 | -1; spawnSpreadAxis: 'x' | 'z' };
  surfaceRegions?: readonly {
    id: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    level?: FpsTerrainLevel;
    surface: LiveSurfaceAcoustic;
  }[];
}

export interface LiveMapAudioProfile {
  defaultSurface: LiveSurfaceAcoustic;
  reverbWet: number;
  reverbDelayMs: number;
  lowpassHz: number;
  gunshotTailDecay: number;
}

export interface LiveMapVisualAtmosphere {
  sky: LiveSkyAtmosphere;
  sunDirection: { x: number; y: number; z: number };
  sunHex: string;
  sunIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  fogHex: string;
  fogDensity: number;
  baseGroundHex: string;
  baseGroundSurface: LiveSurface;
}

export interface LiveMapBroadcastConfig {
  displayName: string;
  subtitle: string;
  themeTag: string;
  radarViewBox: { minX: number; minY: number; width: number; height: number };
  overviewCamera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  };
  showcasePoses: readonly {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    label: string;
  }[];
  freezeShowcaseCenter: { x: number; z: number; height: number };
  pipAnchorHeights: { A: number; B: number };
}

export interface LiveMapNavConfig {
  defaultStep: number;
  fineLevelStep: number;
  levels: readonly FpsTerrainLevel[];
  fineNodes: readonly FpsPoint[];
  fineLinks: readonly [FpsPoint, FpsPoint][];
}

export interface LiveMapDefinition {
  id: LiveMapId;
  runtimeId: string;
  name: string;
  width: number;
  depth: number;
  bounds: LiveMapBounds;
  influenceGrid: { minX: number; minZ: number; cols: number; rows: number; cellSize: number };
  spawns: { attackers: FpsPoint; defenders: FpsPoint };
  sites: Record<'A' | 'B', FpsPoint>;
  siteRadii?: { A: number; B: number };
  solids: readonly LiveSolid[];
  movementSolids?: readonly LiveSolid[];
  collisionSolids?: readonly LiveSolid[];
  terrainSpec: LiveTerrainSpec;
  radialShapesById: Readonly<Record<string, { maxHeight: number; shapes: readonly LiveRadialShape[] }>>;
  elevationDrops: readonly LiveElevationDrop[];
  perchIgnorePattern: RegExp;
  resolveAssetStyle: (id: string) => { purpose: string; surface: LiveSurface; color?: string };
  tactical: LiveTacticalProfile;
  authoredSmokeLineups: readonly LiveSmokeLineup[];
  nav: LiveMapNavConfig;
  audio: LiveMapAudioProfile;
  atmosphere: LiveMapVisualAtmosphere;
  broadcast: LiveMapBroadcastConfig;
  learningCompatibility?: string;
}

export interface LiveMapRuntime {
  readonly id: LiveMapId;
  readonly definition: LiveMapDefinition;
  readonly terrain: LiveTerrainRuntime;
  readonly walls: readonly LiveSolid[];
  readonly movementSolids: readonly LiveSolid[];
  readonly collisionSolids: readonly LiveSolid[];
  readonly movementSolidsAt: (a: FpsPoint, b?: FpsPoint, radius?: number) => readonly LiveSolid[];
  readonly collisionSolidsAt: (a: FpsPoint, b?: FpsPoint, radius?: number) => readonly LiveSolid[];
  readonly wallLookup: ReadonlyMap<string, LiveSolid>;
  readonly navNodes: readonly FpsPoint[];
  readonly neighbors: readonly (readonly number[])[];
  readonly elevationDrops: readonly LiveElevationDrop[];
  readonly jumpablePerches: readonly LiveJumpablePerch[];
  readonly authoredSmokeLineups: readonly LiveSmokeLineup[];
  readonly openingLineups: readonly LiveSmokeLineup[];
  readonly smokeLineups: readonly LiveSmokeLineup[];
  readonly walkable: (point: FpsPoint) => boolean;
  readonly movementSegmentClear: (a: FpsPoint, b: FpsPoint) => boolean;
  readonly safePoint: (point: FpsPoint) => FpsPoint;
  readonly actorSolids: (point: FpsPoint, feetY?: number, height?: number, crouchJump?: boolean) => LiveSolid[];
  readonly supportHeight: (point: FpsPoint, feetY: number, crouchJump?: boolean) => number;
  readonly findPath: (from: FpsPoint, destination: FpsPoint, threats?: readonly FpsPoint[], caution?: number, heatAt?: (point: FpsPoint) => number) => FpsPoint[];
  readonly findPathsFrom: (from: FpsPoint, threats?: readonly FpsPoint[], caution?: number, heatAt?: (point: FpsPoint) => number) => (destination: FpsPoint) => FpsPoint[];
  readonly pathLength: (from: FpsPoint, to: FpsPoint) => number;
  readonly wallSegmentHit: (from: LiveWorldPoint, to: LiveWorldPoint, wall: LiveSolid) => number | undefined;
  readonly wallIntersections: (from: LiveWorldPoint, to: LiveWorldPoint) => LiveWallIntersection[];
  readonly sightline: (a: FpsPoint, b: FpsPoint, eyeA?: number, eyeB?: number) => boolean;
  readonly grenadeSightline: (from: FpsPoint & { y: number }, to: FpsPoint & { y: number }) => boolean;
  readonly findCover: (from: FpsPoint, threat: FpsPoint, allies: readonly FpsPoint[], quality?: number, knownThreats?: readonly FpsPoint[], heatAt?: (point: FpsPoint) => number) => FpsPoint | undefined;
  readonly findPeek: (from: FpsPoint, contact: FpsPoint) => FpsPoint | undefined;
  readonly clearAngles: (from: FpsPoint, toward: FpsPoint) => { id: string; point: FpsPoint }[];
  readonly callout: (point: FpsPoint) => string;
  readonly intelArea: (point: FpsPoint) => 'A' | 'B' | 'Mid';
  readonly surfaceAt: (point: FpsPoint, y?: number) => LiveSurfaceAcoustic;
  readonly learningCompatibility: string;
}
