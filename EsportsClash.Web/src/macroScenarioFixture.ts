import {LANE_Y} from './arenaLayout.ts';
/** Disposable browser-evaluation fixture; absent from ordinary matches. */
export interface MacroScenarioFixture {
  gap: number;
  spread: number;
  frontCount: number;
  rearOffset: number;
}

export function parseMacroScenarioFixture(value: string | null): MacroScenarioFixture | undefined {
  if (!value) return undefined;
  try {
    const input: unknown = JSON.parse(value);
    if (!input || typeof input !== 'object') return undefined;
    const item = input as Record<string, unknown>;
    const { gap, spread, frontCount, rearOffset } = item;
    if (typeof gap !== 'number' || !Number.isFinite(gap) || gap < 200 || gap > 400
      || typeof spread !== 'number' || !Number.isFinite(spread) || spread < 20 || spread > 50
      || typeof frontCount !== 'number' || !Number.isInteger(frontCount) || frontCount < 1 || frontCount > 3
      || typeof rearOffset !== 'number' || !Number.isFinite(rearOffset)
      || rearOffset < 0 || rearOffset > 220) return undefined;
    return { gap, spread, frontCount, rearOffset };
  } catch { return undefined; }
}

export function macroScenarioPosition(team: 'blue' | 'red', teamIndex: number,
  fixture: MacroScenarioFixture): { x: number; y: number } {
  const direction = team === 'blue' ? -1 : 1;
  return { x: 1300 + direction * (fixture.gap / 2
    + (teamIndex < fixture.frontCount ? 0 : fixture.rearOffset)),
  y: LANE_Y + (teamIndex - 2) * fixture.spread };
}
