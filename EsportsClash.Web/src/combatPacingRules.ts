/** Respawns stay brief in the short arena while late deaths still open a push. */
export function calculateDeathTimer(level: number, currentMatchTime: number): number {
  const matchMinute = Math.max(0, currentMatchTime) / 60;
  const levelTime = 6 + Math.max(1, level) * 0.65;
  const lateTime = Math.max(0, matchMinute - 4) * 1.1;
  return Math.min(28, Math.max(7, Math.round(levelTime + lateTime)));
}

export interface HookPullState {
  sourceId: string;
  kind: 'Mirehook' | 'Voltgrip' | 'Wraithhook';
  remaining: number;
}

/** Advance a caught avatar along the chain without jumping it to the caster. */
export function advanceHookPull(
  target: { x: number; y: number },
  caster: { x: number; y: number },
  dt: number,
  stopDistance = 43,
  speed = 560
): { x: number; y: number; done: boolean } {
  const dx = caster.x - target.x;
  const dy = caster.y - target.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= stopDistance || distance === 0) return { ...target, done: true };
  const step = Math.min(distance - stopDistance, Math.max(0, dt) * speed);
  return {
    x: target.x + dx / distance * step,
    y: target.y + dy / distance * step,
    done: step >= distance - stopDistance
  };
}
