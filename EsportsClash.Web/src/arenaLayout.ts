// Shared world-space layout. Canvas scaling must not change travel distances.
export const ARENA_WIDTH = 2800;
export const ARENA_HEIGHT = 1440;
export const PLAY_MIN_Y = 40;
export const PLAY_MAX_Y = ARENA_HEIGHT - 40;
export const LANE_Y = ARENA_HEIGHT / 2; // Central symmetry spine: 720

export type ArenaMapProfileId = 'two-lane-v5';

// Top and Bottom Lane geometric parameters
export const TOP_LANE_Y = 270;
export const BOT_LANE_Y = 1170;
export const LANE_HALF_WIDTH = 80;

/** Natural organic curve for Top Lane with subtle East-West symmetric meander */
export function topLaneY(x: number): number {
  const clamped = Math.max(240, Math.min(2560, x));
  let base = TOP_LANE_Y;
  if (clamped < 580) {
    const u = (clamped - 240) / (580 - 240);
    base = TOP_LANE_Y + (570 - TOP_LANE_Y) * Math.pow(1 - u, 1.55);
  } else if (clamped > 2220) {
    const u = (2560 - clamped) / (2560 - 2220);
    base = TOP_LANE_Y + (570 - TOP_LANE_Y) * Math.pow(1 - u, 1.55);
  }
  const centerDist = Math.abs(clamped - 1400);
  const midBlend = Math.max(0, Math.min(1, (820 - centerDist) / 220));
  const wave = Math.cos(((clamped - 1400) / 800) * Math.PI * 2) * 14 * midBlend;
  return base + wave;
}

/** Bottom Lane is mirrored across the horizontal midline */
export function botLaneY(x: number): number {
  return ARENA_HEIGHT - topLaneY(x);
}

export function laneCenterY(lane: 'top' | 'bot', x: number): number {
  return lane === 'top' ? topLaneY(x) : botLaneY(x);
}

export interface ArenaCampRingDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly stoneRadius: number;
  readonly stones: number;
  readonly entrance: number;
}

export interface ArenaBushDef {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ArenaMapProfile {
  readonly id: ArenaMapProfileId;
  readonly label: string;
  readonly laneSlope: number;
  readonly laneHalfWidth: number;
  readonly midPlazaRadius: number;
  readonly brickWidth: number;
  readonly brickHeight: number;
  readonly decorStyle: 'clean-rift';
  readonly ramps: {
    readonly north: readonly number[];
    readonly south: readonly number[];
  };
  readonly campRings: readonly ArenaCampRingDef[];
  readonly bushes: readonly ArenaBushDef[];
}

export interface ArenaFeatureFlags {
  readonly fogOfWarShader: boolean;
  readonly wardVarieties: boolean;
  readonly jungleDepth: boolean;
  readonly epicObjectiveDepth: boolean;
  readonly terrainMobility: boolean;
  readonly structureWaveDepth: boolean;
  readonly comebackBounties: boolean;
  readonly dynamicEvents: boolean;
}

export const DEFAULT_ARENA_FEATURE_FLAGS: ArenaFeatureFlags = Object.freeze({
  fogOfWarShader: false,
  wardVarieties: false,
  jungleDepth: false,
  epicObjectiveDepth: false,
  terrainMobility: false,
  structureWaveDepth: false,
  comebackBounties: false,
  dynamicEvents: false,
});

let activeFeatureFlags: ArenaFeatureFlags = DEFAULT_ARENA_FEATURE_FLAGS;

export function getArenaFeatureFlags(): ArenaFeatureFlags {
  return activeFeatureFlags;
}

export function setArenaFeatureFlags(overrides: Partial<ArenaFeatureFlags>): ArenaFeatureFlags {
  activeFeatureFlags = Object.freeze({ ...DEFAULT_ARENA_FEATURE_FLAGS, ...overrides });
  return activeFeatureFlags;
}

export function computeArenaRulesetVersion(flags: ArenaFeatureFlags = activeFeatureFlags): string {
  const enabled = (Object.keys(flags) as (keyof ArenaFeatureFlags)[]).filter(k => flags[k]).sort();
  return enabled.length === 0 ? 'arena-ruleset-v3' : `arena-ruleset-v4+${enabled.join(',')}`;
}

export const ARENA_RULESET_VERSION = computeArenaRulesetVersion(DEFAULT_ARENA_FEATURE_FLAGS);

export const MAP_PROFILES: Readonly<Record<ArenaMapProfileId, ArenaMapProfile>> = Object.freeze({
  'two-lane-v5': Object.freeze({
    id: 'two-lane-v5',
    label: 'Two-Lane Stadium Arena (v5)',
    laneSlope: 0,
    laneHalfWidth: 80,
    midPlazaRadius: 125,
    brickWidth: 90,
    brickHeight: 65,
    decorStyle: 'clean-rift',
    ramps: Object.freeze({
      north: Object.freeze([880, 1260, 1540, 1920]),
      south: Object.freeze([880, 1260, 1540, 1920]),
    }),
    campRings: Object.freeze([
      // North-West Jungle Quadrant (3 camps, Y < 720, entrance facing South into jungle trails)
      { id: 'j_blue_blue_buff', x: 740, y: 435, radius: 62, stoneRadius: 14, stones: 12, entrance: Math.PI / 2 },
      { id: 'j_blue_behemoth', x: 500, y: 455, radius: 60, stoneRadius: 14, stones: 12, entrance: Math.PI / 2 },
      { id: 'j_blue_wolves', x: 1055, y: 445, radius: 62, stoneRadius: 14, stones: 12, entrance: Math.PI / 2 },

      // Top Dragon Boss Cove
      { id: 'dragon_boss', x: 1400, y: 95, radius: 72, stoneRadius: 15, stones: 16, entrance: Math.PI / 2 },

      // North-East Jungle Quadrant (3 mirrored camps, Y < 720, entrance facing South into jungle trails)
      { id: 'j_red_wolves', x: 1745, y: 445, radius: 62, stoneRadius: 14, stones: 12, entrance: Math.PI / 2 },
      { id: 'j_red_blue_buff', x: 2060, y: 435, radius: 62, stoneRadius: 14, stones: 12, entrance: Math.PI / 2 },
      { id: 'j_red_behemoth', x: 2300, y: 455, radius: 60, stoneRadius: 14, stones: 12, entrance: Math.PI / 2 },

      // South-West Jungle Quadrant (3 camps, Y > 720, entrance facing North into jungle trails)
      { id: 'j_blue_golem', x: 500, y: 985, radius: 60, stoneRadius: 14, stones: 12, entrance: -Math.PI / 2 },
      { id: 'j_blue_red_buff', x: 740, y: 1005, radius: 62, stoneRadius: 14, stones: 12, entrance: -Math.PI / 2 },
      { id: 'j_blue_drakes', x: 1055, y: 995, radius: 62, stoneRadius: 14, stones: 12, entrance: -Math.PI / 2 },

      // Bottom Siege Golem Boss Cove
      { id: 'j_siege_golem', x: 1400, y: 1345, radius: 72, stoneRadius: 15, stones: 16, entrance: -Math.PI / 2 },

      // South-East Jungle Quadrant (3 mirrored camps, Y > 720, entrance facing North into jungle trails)
      { id: 'j_red_drakes', x: 1745, y: 995, radius: 62, stoneRadius: 14, stones: 12, entrance: -Math.PI / 2 },
      { id: 'j_red_red_buff', x: 2060, y: 1005, radius: 62, stoneRadius: 14, stones: 12, entrance: -Math.PI / 2 },
      { id: 'j_red_golem', x: 2300, y: 985, radius: 60, stoneRadius: 14, stones: 12, entrance: -Math.PI / 2 },
    ]),
    bushes: Object.freeze([
      { id: 'bush_dragon_choke', name: 'Dragon River West Brush', x: 1210, y: 410, width: 110, height: 42 },
      { id: 'bush_golem_choke', name: 'Golem River East Brush', x: 1590, y: 1030, width: 110, height: 42 },
      { id: 'bush_blue_river', name: 'Dragon River East Brush', x: 1590, y: 410, width: 110, height: 42 },
      { id: 'bush_red_river', name: 'Golem River West Brush', x: 1210, y: 1030, width: 110, height: 42 },
      { id: 'bush_blue_lower', name: 'Blue Island Grove Brush', x: 820, y: 650, width: 104, height: 42 },
      { id: 'bush_red_lower', name: 'Red Island Grove Brush', x: 1980, y: 790, width: 104, height: 42 },
      { id: 'bush_blue_high_north', name: 'Blue North Alcove Brush', x: 760, y: 395, width: 98, height: 40 },
      { id: 'bush_blue_high_south', name: 'Blue South Alcove Brush', x: 760, y: 1045, width: 98, height: 40 },
      { id: 'bush_red_high_north', name: 'Red North Alcove Brush', x: 2040, y: 395, width: 98, height: 40 },
      { id: 'bush_red_high_south', name: 'Red South Alcove Brush', x: 2040, y: 1045, width: 98, height: 40 },
    ]),
  }),
});

export function isArenaMapProfileId(value: unknown): value is ArenaMapProfileId {
  return value === 'two-lane-v5';
}

export function resolveArenaMapProfileId(
  _options?: { search?: string; storageValue?: string | null; envValue?: string; fallback?: ArenaMapProfileId }
): ArenaMapProfileId {
  return 'two-lane-v5';
}

export function getArenaMapProfile(_id?: ArenaMapProfileId): ArenaMapProfile {
  return MAP_PROFILES['two-lane-v5'];
}

export const ACTIVE_MAP_PROFILE_ID: ArenaMapProfileId = 'two-lane-v5';
export const ACTIVE_MAP_PROFILE: ArenaMapProfile = MAP_PROFILES['two-lane-v5'];
export const ARENA_MAP_VERSION: ArenaMapProfileId = ACTIVE_MAP_PROFILE.id;

export const LANE_SLOPE = ACTIVE_MAP_PROFILE.laneSlope;
export const laneYForProfile = (x: number, _profile: ArenaMapProfile = ACTIVE_MAP_PROFILE) => LANE_Y;
export const laneY = (x: number) => LANE_Y;

/** Migrate authored layout coordinates from the former 760-high strip. */
export const mapLayoutY = (oldY: number) => oldY * ARENA_HEIGHT / 760;
export const WELL_X = { blue: 80, red: 2720 } as const;
export const NEXUS_X = { blue: 260, red: 2540 } as const;
export const BARRACKS_X = { blue: 430, red: 2370 } as const;
export const NEXUS_TOWER_X = { blue: 640, red: 2160 } as const;
export const INNER_TOWER_X = { blue: 920, red: 1880 } as const;
export const OUTER_TOWER_X = { blue: 1220, red: 1580 } as const;
export const DRAGON_X = ARENA_WIDTH / 2;
export const CENTRAL_MAP_OFFSET = (ARENA_WIDTH - 2000) / 2;
