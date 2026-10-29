import type { AdaptiveContext } from './adaptivePolicy.ts';
import type { CardMatchMemory } from './cardMemory.ts';

/** Strategy observation boundary. Opponent unspent gold and hidden levels are
 * unavailable even though the authoritative simulator can inspect them. */
export function adaptiveObservation(input: {
  ownLevel: number; kills: number; deaths: number; outnumbered: boolean;
  visibleOpponents: readonly { level: number }[]; cardMemory?: CardMatchMemory;
}): AdaptiveContext {
  const levels = input.visibleOpponents.map(unit => unit.level).filter(Number.isFinite);
  return { ...(levels.length && Number.isFinite(input.ownLevel)
    ? { levelGap: input.ownLevel - levels.reduce((sum, level) => sum + level, 0) / levels.length } : {}),
    outnumbered: input.outnumbered, isFeeding: input.deaths - input.kills >= 3,
    cardMemory: input.cardMemory };
}
