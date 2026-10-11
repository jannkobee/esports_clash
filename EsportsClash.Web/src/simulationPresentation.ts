/** Wall-clock presentation cadence, independent of gameplay speed and RNG. */
export function shouldPublishHud(last: { current: number }, now: number, force = false): boolean {
  if (!force && now - last.current < 100) return false;
  last.current = now;
  return true;
}

/** Yield between fixed ticks; never interrupt a tick or reorder decisions. */
export function runSimulationSlice(steps: number, tick: () => void, stopped: () => boolean,
  now: () => number, budgetMs = Infinity): number {
  const started = now();
  let completed = 0;
  while (completed < steps && !stopped()) {
    if (completed > 0 && now() - started >= budgetMs) break;
    tick();
    completed++;
  }
  return completed;
}
