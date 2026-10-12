export type CreepAttackTarget = 'minion' | 'camp' | 'dragon';
export interface CreepAttackState {
  targetId: string; targetType: CreepAttackTarget; damage: number;
  startedAt: number; releaseAt: number; recoverAt: number; released: boolean;
}

export function startCreepAttack(targetId: string, targetType: CreepAttackTarget,
  damage: number, now: number, attackPeriod: number): CreepAttackState {
  const windup = Math.min(0.24, attackPeriod * 0.28);
  return { targetId, targetType, damage, startedAt: now, releaseAt: now + windup,
    recoverAt: now + Math.min(attackPeriod * 0.8, windup + 0.2), released: false };
}

/** Only simulation calls this. Clearing/marking state before dispatch makes release exactly once. */
export function advanceCreepAttack(state: CreepAttackState, now: number, interrupted: boolean,
  targetInRange: boolean): { state?: CreepAttackState; release: boolean } {
  if (interrupted || (!state.released && !targetInRange)) return { release: false };
  if (!state.released && now + 1e-9 >= state.releaseAt)
    return { state: { ...state, released: true }, release: true };
  return { state: now >= state.recoverAt ? undefined : state, release: false };
}

/** Read-only presentation sampled from the same simulation timestamps. */
export function creepAttackPose(state: CreepAttackState | undefined, now: number) {
  if (!state || now < state.startedAt || now >= state.recoverAt) return { windup: 0, strike: 0 };
  if (!state.released) return { windup: Math.min(1, (now - state.startedAt) / (state.releaseAt - state.startedAt)), strike: 0 };
  return { windup: 0, strike: Math.max(0, 1 - (now - state.releaseAt) / (state.recoverAt - state.releaseAt)) };
}

/** Clamp the travel step: a fast shot must not oscillate forever across its destination. */
export function advanceTargetedProjectile(from: { x: number; y: number }, to: { x: number; y: number }, speed: number, dt: number) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const arrived = distance <= speed * dt;
  const fraction = distance === 0 ? 1 : Math.min(1, speed * dt / distance);
  return { x: from.x + dx * fraction, y: from.y + dy * fraction, angle: Math.atan2(dy, dx), arrived };
}
