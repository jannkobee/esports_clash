export interface ArenaPoint {
  x: number;
  y: number;
}

export interface KickArenaBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getTeamwardKickDestination(
  target: ArenaPoint,
  allies: ArenaPoint[],
  caster: ArenaPoint,
  distance: number,
  bounds: KickArenaBounds
): ArenaPoint {
  const formation = allies.length > 0 ? allies : [caster];
  const center = formation.reduce(
    (sum, ally) => ({ x: sum.x + ally.x, y: sum.y + ally.y }),
    { x: 0, y: 0 }
  );
  center.x /= formation.length;
  center.y /= formation.length;

  let dx = center.x - target.x;
  let dy = center.y - target.y;
  let magnitude = Math.hypot(dx, dy);
  if (magnitude === 0) {
    dx = caster.x - target.x;
    dy = caster.y - target.y;
    magnitude = Math.hypot(dx, dy);
  }
  if (magnitude === 0) {
    dx = 1;
    magnitude = 1;
  }

  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, target.x + dx / magnitude * distance)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, target.y + dy / magnitude * distance))
  };
}
