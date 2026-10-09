export const MULTIKILL_WINDOW_SECONDS = 3;

export function nextMultikillCount(previousCount: number, secondsSinceLastKill: number): number {
  return secondsSinceLastKill <= MULTIKILL_WINDOW_SECONDS ? Math.min(5, previousCount + 1) : 1;
}
