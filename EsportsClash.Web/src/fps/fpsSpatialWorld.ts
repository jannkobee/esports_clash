/** Geometry and fixed-step clock for the experimental live FPS. Coordinates are metres. */
export interface FpsPoint { x: number; z: number }
export interface FpsWall { minX: number; maxX: number; minZ: number; maxZ: number }

/** Intersection of a finite segment and a closed axis-aligned box, including its edges. */
export function segmentHitsWall(from: FpsPoint, to: FpsPoint, wall: FpsWall, radius = 0): boolean {
  let enter = 0, exit = 1;
  for (const [origin, delta, min, max] of [
    [from.x, to.x - from.x, wall.minX - radius, wall.maxX + radius],
    [from.z, to.z - from.z, wall.minZ - radius, wall.maxZ + radius]
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const a = (min - origin) / delta, b = (max - origin) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return true;
}

export function hasFpsLineOfSight(from: FpsPoint, to: FpsPoint, walls: readonly FpsWall[]): boolean {
  return !walls.some(wall => segmentHitsWall(from, to, wall));
}

/** Move with conservative swept collision and wall sliding; never tunnel through cover. */
export function moveFpsActor(from: FpsPoint, delta: FpsPoint, radius: number, walls: readonly FpsWall[]): FpsPoint {
  const blocked = (a: FpsPoint, b: FpsPoint) => walls.some(wall => segmentHitsWall(a, b, wall, radius));
  const desired = { x: from.x + delta.x, z: from.z + delta.z };
  if (!blocked(from, desired)) return desired;
  const xOnly = { x: desired.x, z: from.z };
  const afterX = blocked(from, xOnly) ? from : xOnly;
  const zOnly = { x: afterX.x, z: desired.z };
  return blocked(afterX, zOnly) ? { ...afterX } : zOnly;
}

/** Advance without frame-rate-dependent rules. Backlogs are retained, never discarded. */
export class FpsFixedStepClock {
  private accumulated = 0;
  readonly stepSeconds:number;
  constructor(stepSeconds = 1 / 30) {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) throw new RangeError('Invalid fixed step');
    this.stepSeconds=stepSeconds;
  }
  advance(seconds: number, tick: (seconds: number) => void, maxSteps = 300): number {
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError('Invalid clock advance');
    this.accumulated += seconds;
    let steps = 0;
    while (this.accumulated + 1e-10 >= this.stepSeconds && steps < maxSteps) {
      tick(this.stepSeconds);
      this.accumulated = Math.max(0, this.accumulated - this.stepSeconds);
      steps++;
    }
    return steps;
  }
  get pendingSeconds(): number { return this.accumulated; }
}
