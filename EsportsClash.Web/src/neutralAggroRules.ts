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

export const CAMP_PATIENCE_SECONDS = 5;
export const CAMP_SOFT_RESET_SECONDS = 6;

export function neutralCampRespawnSeconds(type: string): number | null {
  return type === 'siege_golem' ? null : 55;
}

export function stepCampPatience(
  hp: number, maxHp: number, patience: number, resetElapsed: number,
  hasTargetInLeash: boolean, dt: number,
) {
  const remaining = Math.max(0, patience - dt);
  const chasing = hasTargetInLeash && remaining > 0;
  if (chasing) return { hp, patience: remaining, resetElapsed: 0, chasing };

  const elapsed = resetElapsed + dt;
  return {
    hp: elapsed >= CAMP_SOFT_RESET_SECONDS
      ? maxHp : Math.min(maxHp, hp + maxHp * 0.06 * dt),
    patience: 0,
    resetElapsed: elapsed,
    chasing: false,
  };
}
