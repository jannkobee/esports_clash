/** Evaluation-only credit from actual executed rewards/damage, never passive income. */
export type TaskEventKind = 'camp-share' | 'minion-last-hit' | 'structure-damage';
export interface TaskEvent { second: number; kind: TaskEventKind; targetId: string; amount: number }
export interface TaskOutcome {
  horizonSeconds: number; campGold: number; campClears: number;
  waveGold: number; minionKills: number; structureDamage: number;
  deaths: number; firstCompletionSeconds: number | null; reward: number;
}
export function summarizeTaskOutcome(start: { second: number; deaths: number },
  end: { second: number; deaths: number }, events: readonly TaskEvent[]): TaskOutcome | undefined {
  const horizonSeconds = end.second - start.second;
  if (![start.second, end.second, start.deaths, end.deaths].every(Number.isFinite)
    || horizonSeconds < 3 || horizonSeconds > 30.1 || end.deaths < start.deaths) return undefined;
  const valid = events.filter(event => Number.isFinite(event.second) && Number.isFinite(event.amount)
    && event.amount > 0 && event.second >= start.second && event.second <= end.second
    && ['camp-share', 'minion-last-hit', 'structure-damage'].includes(event.kind));
  const sum = (kind: TaskEventKind) => valid.filter(event => event.kind === kind)
    .reduce((total, event) => total + event.amount, 0);
  const deaths = end.deaths - start.deaths;
  const campGold = sum('camp-share'), waveGold = sum('minion-last-hit');
  const structureDamage = sum('structure-damage');
  const campClears = valid.filter(event => event.kind === 'camp-share').length;
  const minionKills = valid.filter(event => event.kind === 'minion-last-hit').length;
  const first = valid.reduce((at, event) => Math.min(at, event.second), Infinity);
  // A death dominates any amount of farm or siege credit, including a respawn.
  const reward = deaths > 0 ? -1 : Math.min(1,
    Math.min(1, (campGold + waveGold) / 250) * .6 + Math.min(1, structureDamage / 600) * .4);
  return { horizonSeconds, campGold, campClears, waveGold, minionKills, structureDamage,
    deaths, firstCompletionSeconds: Number.isFinite(first) ? first - start.second : null, reward };
}
