import type { FpsPoint } from './fpsSpatialWorld.ts';

/** Coarse spatial tactical grid bounds covering Fontessa playable coordinates ([-34, 34] x [-43, 43]). */
export const INFLUENCE_CELL_SIZE = 4;
export const INFLUENCE_MIN_X = -36;
export const INFLUENCE_MIN_Z = -44;
export const INFLUENCE_COLS = 18;
export const INFLUENCE_ROWS = 22;

const DANGER_TAU_SECONDS = 14;
const UNCERTAINTY_GRACE_SECONDS = 8;
const UNCERTAINTY_FULL_SECONDS = 20;
const FOV_FAN_OFFSETS = [-0.74, -0.37, 0, 0.37, 0.74] as const;

export interface LiveTeamInfluenceGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly minX: number;
  readonly minZ: number;
  readonly danger: Float32Array;
  readonly dangerAt: Float32Array;
  readonly lastClearedAt: Float32Array;
  hasHeatUntil: number;
}

function clampCell(value: number, max: number): number {
  return value < 0 ? 0 : value >= max ? max - 1 : value;
}

export function influenceCellIndex(grid: LiveTeamInfluenceGrid, point: Pick<FpsPoint, 'x' | 'z'>): number {
  const col = clampCell(Math.floor((point.x - grid.minX) / grid.cellSize), grid.cols);
  const row = clampCell(Math.floor((point.z - grid.minZ) / grid.cellSize), grid.rows);
  return row * grid.cols + col;
}

export function influenceCellCoords(
  grid: LiveTeamInfluenceGrid,
  point: Pick<FpsPoint, 'x' | 'z'>,
): { col: number; row: number } {
  return {
    col: clampCell(Math.floor((point.x - grid.minX) / grid.cellSize), grid.cols),
    row: clampCell(Math.floor((point.z - grid.minZ) / grid.cellSize), grid.rows),
  };
}

export interface LiveInfluenceGridSpec {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  cellSize: number;
}

export function createLiveInfluenceGrid(now = 0, spec?: LiveInfluenceGridSpec): LiveTeamInfluenceGrid {
  const cols = spec?.cols ?? INFLUENCE_COLS;
  const rows = spec?.rows ?? INFLUENCE_ROWS;
  const cellSize = spec?.cellSize ?? INFLUENCE_CELL_SIZE;
  const minX = spec?.minX ?? INFLUENCE_MIN_X;
  const minZ = spec?.minZ ?? INFLUENCE_MIN_Z;
  const size = cols * rows;
  const grid: LiveTeamInfluenceGrid = {
    cols,
    rows,
    cellSize,
    minX,
    minZ,
    danger: new Float32Array(size),
    dangerAt: new Float32Array(size),
    lastClearedAt: new Float32Array(size),
    hasHeatUntil: 0,
  };
  resetLiveInfluenceGrid(grid, now);
  return grid;
}

export function resetLiveInfluenceGrid(grid: LiveTeamInfluenceGrid, now = 0): void {
  grid.danger.fill(0);
  grid.dangerAt.fill(-60);
  grid.lastClearedAt.fill(now);
  grid.hasHeatUntil = 0;
}

export function recordInfluenceDanger(
  grid: LiveTeamInfluenceGrid,
  point: Pick<FpsPoint, 'x' | 'z'>,
  strength: number,
  now: number,
  radiusCells = 1,
): void {
  if (!(strength > 0)) return;
  const { col, row } = influenceCellCoords(grid, point);
  const minCol = Math.max(0, col - radiusCells);
  const maxCol = Math.min(grid.cols - 1, col + radiusCells);
  const minRow = Math.max(0, row - radiusCells);
  const maxRow = Math.min(grid.rows - 1, row + radiusCells);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const idx = r * grid.cols + c;
      const dist = Math.hypot(c - col, r - row);
      if (radiusCells > 0 && dist > radiusCells + 0.45) continue;
      const weight = dist === 0 ? 1 : dist <= 1.01 ? 0.55 : Math.max(0.2, 1 / (1 + dist));
      const elapsed = Math.max(0, now - grid.dangerAt[idx]);
      const decayed = grid.danger[idx] * Math.exp(-elapsed / DANGER_TAU_SECONDS);
      grid.danger[idx] = Math.min(3.5, decayed + strength * weight);
      grid.dangerAt[idx] = now;
    }
  }
  grid.hasHeatUntil = Math.max(grid.hasHeatUntil, now + 42);
}

/** Stamps FOV-traversed cells along bounded fan rays clipped by walls/smoke as cleared at `now`. */
export function stampInfluenceFov(
  grid: LiveTeamInfluenceGrid,
  origin: FpsPoint,
  yaw: number,
  now: number,
  maxRange = 28,
  rayLimitFn?: (origin: FpsPoint, dirX: number, dirZ: number, maxRange: number) => number,
): void {
  grid.lastClearedAt[influenceCellIndex(grid, origin)] = now;
  const step = 2;
  for (const offset of FOV_FAN_OFFSETS) {
    const angle = yaw + offset;
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    const limit = Math.max(0, Math.min(maxRange, rayLimitFn ? rayLimitFn(origin, dirX, dirZ, maxRange) : maxRange));
    for (let d = step; d <= limit; d += step) {
      const idx = influenceCellIndex(grid, {
        x: origin.x + dirX * d,
        z: origin.z + dirZ * d,
      });
      if (grid.lastClearedAt[idx] < now) grid.lastClearedAt[idx] = now;
    }
    if (limit >= 1) {
      const endIdx = influenceCellIndex(grid, {
        x: origin.x + dirX * limit,
        z: origin.z + dirZ * limit,
      });
      if (grid.lastClearedAt[endIdx] < now) grid.lastClearedAt[endIdx] = now;
    }
  }
}

export function hasActiveInfluenceHeat(grid: LiveTeamInfluenceGrid, now: number): boolean {
  return now < grid.hasHeatUntil;
}

export function sampleInfluenceDanger(
  grid: LiveTeamInfluenceGrid,
  point: Pick<FpsPoint, 'x' | 'z'>,
  now: number,
): number {
  if (!hasActiveInfluenceHeat(grid, now)) return 0;
  const idx = influenceCellIndex(grid, point);
  const raw = grid.danger[idx];
  if (raw <= 0.001) return 0;
  const elapsed = Math.max(0, now - grid.dangerAt[idx]);
  return raw * Math.exp(-elapsed / DANGER_TAU_SECONDS);
}

/** Map-control staleness uncertainty in [0, 1]; stays ~0 early or right after clearing, rises toward 1 after ~20s uncleared. */
export function sampleInfluenceUncertainty(
  grid: LiveTeamInfluenceGrid,
  point: Pick<FpsPoint, 'x' | 'z'>,
  now: number,
): number {
  const idx = influenceCellIndex(grid, point);
  const elapsed = Math.max(0, now - grid.lastClearedAt[idx]);
  if (elapsed <= UNCERTAINTY_GRACE_SECONDS) return 0;
  return Math.min(1, (elapsed - UNCERTAINTY_GRACE_SECONDS) / (UNCERTAINTY_FULL_SECONDS - UNCERTAINTY_GRACE_SECONDS));
}
