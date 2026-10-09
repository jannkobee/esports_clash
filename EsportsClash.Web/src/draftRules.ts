import type { ChampionKit, PlayerCard } from './types';

export function isChampionAvailable(championId: string, playerId: string, selections: Record<string, string>, bannedIds: (string | null)[]): boolean {
  return !bannedIds.includes(championId) && !Object.entries(selections).some(([owner, id]) => owner !== playerId && id === championId);
}

export function buildUniqueLineups(
  startingFive: PlayerCard[], opponentRoster: PlayerCard[], champions: ChampionKit[],
  selections: Record<string, string>, bannedIds: (string | null)[]
) {
  const available = champions.filter(c => !bannedIds.includes(c.id));
  if (available.length < startingFive.length + Math.min(5, opponentRoster.length)) {
    throw new Error('The draft needs at least one available champion per player.');
  }
  const used = new Set<string>();
  const blue = startingFive.map(player => {
    const selected = available.find(c => c.id === selections[player.id] && !used.has(c.id));
    const champion = selected ?? available.find(c => !used.has(c.id) && player.signatureChampions.includes(c.name))
      ?? available.find(c => !used.has(c.id) && c.primaryRole === player.preferredRole)
      ?? available.find(c => !used.has(c.id))!;
    used.add(champion.id);
    return { player, champion };
  });
  const red = opponentRoster.slice(0, 5).map(player => {
    const champion = available.find(c => !used.has(c.id) && player.signatureChampions.includes(c.name))
      ?? available.find(c => !used.has(c.id) && c.primaryRole === player.preferredRole)
      ?? available.find(c => !used.has(c.id))!;
    used.add(champion.id);
    return { player, champion };
  });
  return { blue, red };
}
