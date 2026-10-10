import type { CoachCard, PlayerCard, AvatarRole, CardTier, GameOrigin } from './types.ts';
import { CHAMPIONS, INITIAL_PLAYERS } from './mockData.ts';

export const EQUALIZED_COACH_BLUE: CoachCard = {
  id: 'c_eq_blue',
  name: 'Master Tactician (Blue)',
  realName: 'Tactician Blue',
  tier: 'GOAT',
  style: 'Dynamic Adapt',
  chemistryBonus: 10,
  playbookBonus: 10,
  extraBans: 0,
  quote: 'Every avatar has a purpose. The draft decides the victor.',
  avatarSvg: 'kkoma'
};

export const EQUALIZED_COACH_RED: CoachCard = {
  id: 'c_eq_red',
  name: 'Master Tactician (Red)',
  realName: 'Tactician Red',
  tier: 'GOAT',
  style: 'Dynamic Adapt',
  chemistryBonus: 10,
  playbookBonus: 10,
  extraBans: 0,
  quote: 'Adaptation is absolute. Counter every pick with precision.',
  avatarSvg: 'kkoma'
};

export interface SlotDefinition {
  slot: number;
  label: string;
  role: AvatarRole;
  icon: string;
  description: string;
}

export const TEAM_SLOTS: readonly SlotDefinition[] = [
  { slot: 0, label: 'TOP', role: 'Fighter', icon: '⚔️', description: 'Frontline bruiser & split-pusher' },
  { slot: 1, label: 'JUNGLE', role: 'Assassin', icon: '🌲', description: 'Ambush roamer & objective secure' },
  { slot: 2, label: 'MID', role: 'Mage', icon: '🔮', description: 'Burst magic damage & wave control' },
  { slot: 3, label: 'BOT', role: 'Marksman', icon: '🏹', description: 'Ranged physical DPS carry' },
  { slot: 4, label: 'SUPPORT', role: 'Support', icon: '🛡️', description: 'Vision control & team protection' }
] as const;

export interface PlayerDraftTurn {
  turnIndex: number;
  side: 'blue' | 'red';
  round: number;
}

export const PLAYER_DRAFT_TURNS: readonly PlayerDraftTurn[] = [
  { turnIndex: 0, side: 'blue', round: 1 },
  { turnIndex: 1, side: 'red', round: 1 },
  { turnIndex: 2, side: 'red', round: 2 },
  { turnIndex: 3, side: 'blue', round: 2 },
  { turnIndex: 4, side: 'blue', round: 3 },
  { turnIndex: 5, side: 'red', round: 3 },
  { turnIndex: 6, side: 'red', round: 4 },
  { turnIndex: 7, side: 'blue', round: 4 },
  { turnIndex: 8, side: 'blue', round: 5 },
  { turnIndex: 9, side: 'red', round: 5 },
] as const;

export function equalizePlayerCard(card: PlayerCard): PlayerCard {
  const allChampionNames = CHAMPIONS.map((c) => c.name);
  return {
    ...card,
    ovr: 100,
    tier: 'GOAT' as CardTier,
    level: 60,
    currentXp: 9999,
    maxXp: 9999,
    isEvo: true,
    stats: {
      lan: 100,
      tf: 100,
      iq: 100,
      clu: 100,
      sta: 100,
      flx: 100
    },
    playableRoles: ['Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin'] as AvatarRole[],
    signatureChampions: allChampionNames,
    morale: 100,
    fatigue: 0
  };
}

export function getEqualizedPlayerPool(): PlayerCard[] {
  return INITIAL_PLAYERS.map(equalizePlayerCard);
}

export function chooseEqualizedPlayerPick(
  availablePool: PlayerCard[],
  currentTeam: (PlayerCard | null)[],
  opponentTeam: (PlayerCard | null)[],
  seed: number = 0
): { card: PlayerCard; slot: number } | null {
  if (availablePool.length === 0) return null;

  const emptySlots: number[] = [];
  for (let s = 0; s < 5; s++) {
    if (!currentTeam[s]) emptySlots.push(s);
  }
  if (emptySlots.length === 0) return null;

  let bestCard: PlayerCard = availablePool[0];
  let bestScore = -Infinity;
  let bestSlot = emptySlots[0];

  for (const card of availablePool) {
    const cardRole = card.preferredRole || card.role;
    let slotForCard = emptySlots[0];
    let roleFitScore = 10;

    const matchingSlot = emptySlots.find((s) => TEAM_SLOTS[s].role === cardRole);
    if (matchingSlot !== undefined) {
      slotForCard = matchingSlot;
      roleFitScore = 60;
    } else {
      const isTank = cardRole === 'Tank';
      const isFighter = cardRole === 'Fighter';
      const isAssassin = cardRole === 'Assassin';
      if (isTank && emptySlots.includes(0)) { slotForCard = 0; roleFitScore = 45; }
      else if (isTank && emptySlots.includes(4)) { slotForCard = 4; roleFitScore = 45; }
      else if (isFighter && emptySlots.includes(1)) { slotForCard = 1; roleFitScore = 40; }
      else if (isAssassin && emptySlots.includes(2)) { slotForCard = 2; roleFitScore = 40; }
    }

    let traitScore = 0;
    const currentBadges = new Set(
      currentTeam.filter((p): p is PlayerCard => p !== null).flatMap((p) => p.badges || [])
    );

    if (card.badges?.includes('Shotcaller') && !currentBadges.has('Shotcaller')) {
      traitScore += 20;
    }
    if (card.badges?.includes('Clutch King') && !currentBadges.has('Clutch King')) {
      traitScore += 15;
    }
    if (card.badges?.includes('Aggro Diver') || card.badges?.includes('Unkillable Demon')) {
      traitScore += 10;
    }
    if (card.badges?.includes('One-Tap God') || card.badges?.includes('Laning Demon')) {
      traitScore += 8;
    }

    const currentOrigins = currentTeam.filter((p): p is PlayerCard => p !== null).map((p) => p.origin);
    const originMatches = currentOrigins.filter((o) => o === card.origin).length;
    const originBonus = originMatches * 5;

    const charCodeSum = (card.id + card.name).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const seedVariance = ((seed + charCodeSum * 17) % 31);

    const totalScore = roleFitScore + traitScore + originBonus + seedVariance;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCard = card;
      bestSlot = slotForCard;
    }
  }

  return { card: bestCard, slot: bestSlot };
}

export function createEqualizedRoster(side: 'blue' | 'red'): PlayerCard[] {
  const blueProfiles = [
    { name: 'TheSpicy', role: 'Fighter', avatarSvg: 'theshy', realName: 'TheShy' },
    { name: 'p1mple', role: 'Assassin', avatarSvg: 's1mple', realName: 's1mple' },
    { name: 'Flaker', role: 'Mage', avatarSvg: 'faker', realName: 'Faker' },
    { name: 'Ouzi', role: 'Marksman', avatarSvg: 'uzi', realName: 'Uzi' },
    { name: 'Cardrel', role: 'Fighter', avatarSvg: 'caedrel', realName: 'Caedrel' },
  ];

  const redProfiles = [
    { name: 'Zypoo', role: 'Tank', avatarSvg: 'zywoo', realName: 'ZywOo' },
    { name: 'd4nk', role: 'Fighter', avatarSvg: 'donk', realName: 'donk' },
    { name: 'M0cke', role: 'Mage', avatarSvg: 'micke', realName: 'miCKe' },
    { name: 'flopz', role: 'Marksman', avatarSvg: 'ropz', realName: 'ropz' },
    { name: 'SneakBro', role: 'Support', avatarSvg: 'sneyking', realName: 'Sneyking' },
  ];

  const profiles = side === 'blue' ? blueProfiles : redProfiles;
  const allChampionNames = CHAMPIONS.map((c) => c.name);

  return profiles.map((p, idx) => ({
    id: `eq_${side}_${idx + 1}`,
    name: p.name,
    realName: p.realName,
    origin: (side === 'blue' ? 'LoL' : 'Dota2') as GameOrigin,
    role: p.role as AvatarRole,
    preferredRole: p.role as AvatarRole,
    playableRoles: ['Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin'] as AvatarRole[],
    tier: 'GOAT' as CardTier,
    ovr: 100,
    stats: {
      lan: 100,
      tf: 100,
      iq: 100,
      clu: 100,
      sta: 100,
      flx: 100
    },
    personality: 'Grandmaster Tactician',
    badges: ['Clutch King', 'Unkillable Demon', 'One-Tap God', 'Laning Demon'],
    signatureChampions: allChampionNames,
    morale: 100,
    fatigue: 0,
    level: 60,
    currentXp: 9999,
    maxXp: 9999,
    avatarSvg: p.avatarSvg,
    isEvo: true
  }));
}
