export function stepLeashedMonster(
  x: number, y: number, homeX: number, homeY: number,
  target: { x: number; y: number } | null, dt: number,
  chaseSpeed = 72, leashRadius = 145,
) {
  const homeDistance = Math.hypot(x - homeX, y - homeY);
  const chasing = !!target && Math.hypot(target.x - homeX, target.y - homeY) <= leashRadius
    && homeDistance <= leashRadius;
  const destination = chasing ? target! : { x: homeX, y: homeY };
  const distance = Math.hypot(destination.x - x, destination.y - y);
  const step = Math.min(distance, (chasing ? chaseSpeed : chaseSpeed * 1.35) * dt);
  return {
    x: distance > 0 ? x + (destination.x - x) / distance * step : x,
    y: distance > 0 ? y + (destination.y - y) / distance * step : y,
    chasing,
  };
}
