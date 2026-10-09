import type { AvatarRole, CardTier, GameOrigin, PlayerCard } from './types';

export interface ReserveFilters {
  query: string;
  role: AvatarRole | 'all';
  origin: GameOrigin | 'all';
  tier: CardTier | 'all';
  sort: 'rating' | 'name';
}

export function filterReserveCards(cards: readonly PlayerCard[], filters: ReserveFilters): PlayerCard[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return cards.filter(card =>
    (!query || card.name.toLocaleLowerCase().includes(query))
    && (filters.role === 'all' || (card.playableRoles ? card.playableRoles.includes(filters.role) : (card.preferredRole ?? card.role) === filters.role))
    && (filters.origin === 'all' || card.origin === filters.origin)
    && (filters.tier === 'all' || card.tier === filters.tier)
  ).sort((a, b) => filters.sort === 'rating'
    ? b.ovr - a.ovr || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name));
}
