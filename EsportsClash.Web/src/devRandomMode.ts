import type { ChampionKit, PlayerCard } from './types.ts';
import { equalizePlayerCard } from './equalizedMode.ts';
import { createMatchRandom } from './matchReplay.ts';

export interface DevRandomLineupEntry {
  player: PlayerCard;
  champion: ChampionKit;
}

export interface DevRandomMatch {
  blue: DevRandomLineupEntry[];
  red: DevRandomLineupEntry[];
}

function seededShuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** Builds a deterministic, draft-free sandbox match with ten unique avatars and players. */
export function createDevRandomMatch(
  playerPool: readonly PlayerCard[],
  champions: readonly ChampionKit[],
  seed: number
): DevRandomMatch {
  if (playerPool.length < 10) throw new Error('Developer Random 5v5 needs at least ten player cards.');
  if (champions.length < 10) throw new Error('Developer Random 5v5 needs at least ten avatars.');

  const random = createMatchRandom(seed);
  const players = seededShuffle(playerPool, random).slice(0, 10).map(equalizePlayerCard);
  const avatars = seededShuffle(champions, random).slice(0, 10);
  const entries = players.map((player, index) => ({ player, champion: avatars[index] }));
  return { blue: entries.slice(0, 5), red: entries.slice(5, 10) };
}
