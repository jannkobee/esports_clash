export interface CampAnimationInput {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  targetX?: number;
  targetDistance?: number;
  attackTimer: number;
  hurtTimer: number;
}

export function campAnimation(input: CampAnimationInput, time: number) {
  const awayFromHome = Math.hypot(input.x - input.homeX, input.y - input.homeY) > 3;
  const active = input.targetX !== undefined;
  const striking = active && input.attackTimer > 1.05;
  const windingUp = active && (input.targetDistance ?? Infinity) <= 105 && input.attackTimer <= 0.32 && !striking;
  const state = input.hurtTimer > 0 ? 'hurt' : striking ? 'attack' : windingUp ? 'windup'
    : active ? 'chase' : awayFromHome ? 'return' : 'idle';
  const direction = Math.sign((input.targetX ?? input.homeX) - input.x) || 1;
  const moving = state === 'chase' || state === 'return';
  const stride = Math.sin(time * 11);
  return {
    state,
    bob: moving ? Math.abs(stride) * 3 : Math.sin(time * 2.2) * 1.2,
    lean: moving ? stride * 0.08 : state === 'hurt' ? Math.sin(time * 35) * 0.12 : 0,
    lunge: state === 'attack' ? direction * Math.sin(Math.min(1, (1.35 - input.attackTimer) / 0.30) * Math.PI) * 9 : 0,
    flash: Math.max(0, Math.min(1, input.hurtTimer / 0.25)),
    windup: state === 'windup' ? 1 - input.attackTimer / 0.32 : 0,
    moving
  };
}
