// Match avatar facing: keep the current side near the target, otherwise flip at once.
// No width-squeeze tween; the sprite keeps its full silhouette through a turn.
export function faceTargetLikeAvatar(facing: number, targetDeltaX: number): number {
  if (Math.abs(targetDeltaX) < 3) return facing;
  return targetDeltaX > 0 ? 1 : -1;
}

export function creatureFacingScale(facing: number): number {
  return facing < 0 ? -1 : 1;
}

export function creatureAttackPose(timer: number, period: number, window = 0.45) {
  const elapsed = period - timer;
  if (timer <= 0 || elapsed < 0 || elapsed >= window) return { windup: 0, strike: 0 };
  const phase = elapsed / window;
  return {
    windup: phase < 0.35 ? Math.sin(phase / 0.35 * Math.PI) : 0,
    strike: phase >= 0.35 ? Math.sin((phase - 0.35) / 0.65 * Math.PI) : 0
  };
}
