export function passiveGoldPerSecond(lan: number): number {
  return 4 + Math.max(1, Math.min(99, lan)) * 0.085;
}
