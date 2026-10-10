export interface GroundPoint {
  x: number;
  y: number;
}

export interface GroundTargetBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getGroundTargetPoint(
  origin: GroundPoint,
  requestedPoint: GroundPoint | undefined,
  fallbackDirection: -1 | 1,
  maxRange: number,
  bounds: GroundTargetBounds
): GroundPoint {
  let dx = requestedPoint ? requestedPoint.x - origin.x : 0;
  let dy = requestedPoint ? requestedPoint.y - origin.y : 0;
  if (!requestedPoint || (dx === 0 && dy === 0)) {
    dx = fallbackDirection * maxRange;
    dy = 0;
  }
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxRange ? maxRange / distance : 1;

  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, origin.x + dx * scale)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, origin.y + dy * scale))
  };
}
