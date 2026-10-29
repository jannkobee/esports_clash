// Shared world-space layout. Canvas scaling must not change travel distances.
export const ARENA_WIDTH = 2800;
export const ARENA_HEIGHT = 1440;
export const ARENA_MAP_VERSION = 'howling-abyss-v3';
export const PLAY_MIN_Y = 40;
export const PLAY_MAX_Y = ARENA_HEIGHT - 40;
export const LANE_Y = ARENA_HEIGHT / 2;
export const LANE_SLOPE = -0.30;
export const laneY = (x: number) => LANE_Y + LANE_SLOPE * (x - ARENA_WIDTH / 2);
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
