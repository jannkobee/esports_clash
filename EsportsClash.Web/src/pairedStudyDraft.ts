import type { ChampionKit, PlayerCard } from './types';

export const PAIRED_STUDY_DRAFTS = 10;

/** Evaluation fixtures only. No match RNG, stat edits or changes to owned cards. */
export function buildPairedStudyDraft(players: readonly PlayerCard[], champions: readonly ChampionKit[], draft: number) {
  if (!Number.isInteger(draft) || draft < 0 || draft >= PAIRED_STUDY_DRAFTS)
    throw new Error('Unknown paired study draft');
  if (players.length < 20 || champions.length < 20) throw new Error('Insufficient fixture roster');
  // Historical drafts remain byte-for-byte equivalent in lineup order and identity.
  if (draft <= 1) {
    const avatars = draft === 0
      ? [champions.find(champion => champion.name === 'Kaelen'), ...champions.filter(champion => champion.name !== 'Kaelen').slice(0, 9)]
      : champions.slice(10, 20);
    if (avatars.some(champion => !champion)) throw new Error('Historical fixture avatar missing');
    return avatars.map((champion, i) => ({ champion: champion!, player: players[i + draft * 10] }));
  }
  const used = new Set<string>();
  return Array.from({ length: 10 }, (_, slot) => {
    // Eight overlapping roster windows cover all 64 identities without duplicate players per match.
    const player = players[((draft - 2) * 8 + slot) % players.length];
    const roles = player.playableRoles?.length ? player.playableRoles : [player.preferredRole ?? player.role];
    const eligible = champions.filter(champion => !used.has(champion.id));
    const roleFit = eligible.filter(champion => roles.includes(champion.primaryRole));
    const signatures = roleFit.filter(champion => player.signatureChampions.includes(champion.name));
    const pool = signatures.length ? signatures : roleFit.length ? roleFit : eligible;
    const champion = pool[(draft + slot) % pool.length];
    if (!champion) throw new Error('Insufficient unique fixture avatars');
    used.add(champion.id);
    return { player, champion };
  });
}

/** No earlier checkpoint capture or forced exploration when a later window is requested. */
export function pairedScoutAfter(value: string | null): number {
  const second = value === null ? 120 : Number(value);
  return Number.isFinite(second) && second >= 120 && second <= 900 ? second : 120;
}
