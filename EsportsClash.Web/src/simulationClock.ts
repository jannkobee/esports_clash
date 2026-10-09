export function advanceSimulationClock(
  clock: { current: number }, realSeconds: number, speed: number, stopped: boolean
): number {
  if (stopped) return 0;
  // Bound a long background-tab frame so combat and objective checks are not skipped.
  const simSeconds = Math.min(Math.max(0, realSeconds), 0.1) * speed;
  clock.current += simSeconds;
  return simSeconds;
}
