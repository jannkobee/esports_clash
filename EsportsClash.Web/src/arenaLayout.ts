// Shared world-space layout. Canvas scaling must not change travel distances.
export const ARENA_WIDTH = 2600;
export const LANE_Y = 380;
export const WELL_X = { blue: 65, red: 2535 } as const;
export const NEXUS_X = { blue: 235, red: 2365 } as const;
export const BARRACKS_X = { blue: 430, red: 2170 } as const;
export const NEXUS_TOWER_X = { blue: 610, red: 1990 } as const;
export const INNER_TOWER_X = { blue: 830, red: 1770 } as const;
export const OUTER_TOWER_X = { blue: 1050, red: 1550 } as const;
export const DRAGON_X = ARENA_WIDTH / 2;
export const CENTRAL_MAP_OFFSET = (ARENA_WIDTH - 2000) / 2;
