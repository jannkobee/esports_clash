export function passiveGoldPerSecond(lan: number): number {
  return 4 + Math.max(1, Math.min(99, lan)) * 0.085;
}

export function matchEconomyPhase(seconds: number): 'Opening' | 'Mid game' | 'Late game' {
  if (seconds >= 8 * 60) return 'Late game';
  if (seconds >= 4 * 60) return 'Mid game';
  return 'Opening';
}
