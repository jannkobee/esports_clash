import type { PlayerCard } from './types';
import { normalizePlayerPersonality } from './playerPersonality';

const ROSTER_STORAGE_KEY = 'esports-clash-club-roster-v1';
const STARTING_FIVE_STORAGE_KEY = 'esports-clash-club-starting-five-v1';

function parseStoredRoster(): PlayerCard[] | null {
  try {
    const stored = JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY) || 'null');
    return Array.isArray(stored) ? stored.filter(card => card && typeof card.id === 'string') : null;
  } catch { return null; }
}

/** Adds required owned cards exactly once without replacing saved cards or progression. */
export function reconcileClubRoster(defaultRoster: PlayerCard[], requiredCards: PlayerCard[]): PlayerCard[] {
  const stored = parseStoredRoster();
  const source = stored && stored.length > 0 ? stored : defaultRoster;
  let reconciled = [...source];
  requiredCards.forEach(card => {
    const copies = reconciled.filter(candidate => candidate.id === card.id);
    if (copies.length === 0) reconciled.push(card);
    if (copies.length > 1) {
      const preferred = [...copies].sort((a, b) => b.ovr - a.ovr)[0];
      let retained = false;
      reconciled = reconciled.filter(candidate => {
        if (candidate.id !== card.id) return true;
        if (!retained && candidate === preferred) { retained = true; return true; }
        return false;
      });
    }
  });
  return reconciled.map(card => normalizePlayerPersonality(card));
}

export function loadStartingFive(roster: PlayerCard[], fallback: PlayerCard[]): PlayerCard[] {
  try {
    const ids = JSON.parse(localStorage.getItem(STARTING_FIVE_STORAGE_KEY) || 'null');
    if (Array.isArray(ids) && ids.length === 5 && new Set(ids).size === 5) {
      const saved = ids.map(id => roster.find(card => card.id === id)).filter((card): card is PlayerCard => !!card);
      if (saved.length === 5) return saved;
    }
  } catch { /* use the default starting five */ }
  return fallback.map(card => roster.find(candidate => candidate.id === card.id) ?? card);
}

export function persistClubRoster(roster: PlayerCard[], startingFive: PlayerCard[]) {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
    localStorage.setItem(STARTING_FIVE_STORAGE_KEY, JSON.stringify(startingFive.map(card => card.id)));
  } catch { /* storage is optional; the in-memory club remains usable */ }
}
