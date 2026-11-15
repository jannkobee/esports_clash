import type { CoachCard, PlayerCard, CardTier, GameOrigin } from './types.ts';
import { INITIAL_PLAYERS } from './mockData.ts';


export const EQUALIZED_COACH_BLUE: CoachCard = {
  id: 'c_eq_blue',
  name: 'Master Tactician (Blue)',
  realName: 'Tactician Blue',
  tier: 'GOAT',
  style: 'Dynamic Adapt',
  chemistryBonus: 10,
  playbookBonus: 10,
  extraBans: 0,
  quote: 'Tactics and execution decide every round.',
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
  quote: 'Adaptation is absolute. Read and counter every setup.',
  avatarSvg: 'kkoma'
};

export function equalizePlayerCard(card: PlayerCard): PlayerCard {
  return {
    ...card,
    ovr: 100,
    tier: 'GOAT' as CardTier,
    level: 60,
    currentXp: 9999,
    maxXp: 9999,
    isEvo: true,
    stats: {
      rifling: 100,
      entry: 100,
      positioning: 100,
      sniping: 100,
      utility: 100,
      shotcalling: 100
    },
    morale: 100,
    fatigue: 0
  };
}

export function getEqualizedPlayerPool(): PlayerCard[] {
  return INITIAL_PLAYERS.map(equalizePlayerCard);
}

export function createEqualizedRoster(side: 'blue' | 'red'): PlayerCard[] {
  const blueProfiles = [
    { name: 'TheSpicy', avatarSvg: 'theshy', realName: 'TheShy' },
    { name: 'p1mple', avatarSvg: 's1mple', realName: 's1mple' },
    { name: 'Flaker', avatarSvg: 'faker', realName: 'Faker' },
    { name: 'Ouzi', avatarSvg: 'uzi', realName: 'Uzi' },
    { name: 'Cardrel', avatarSvg: 'caedrel', realName: 'Caedrel' },
  ];

  const redProfiles = [
    { name: 'Zypoo', avatarSvg: 'zywoo', realName: 'ZywOo' },
    { name: 'd4nk', avatarSvg: 'donk', realName: 'donk' },
    { name: 'M0cke', avatarSvg: 'micke', realName: 'miCKe' },
    { name: 'flopz', avatarSvg: 'ropz', realName: 'ropz' },
    { name: 'SneakBro', avatarSvg: 'sneyking', realName: 'Sneyking' },
  ];

  const profiles = side === 'blue' ? blueProfiles : redProfiles;

  return profiles.map((p, idx) => ({
    id: `eq_${side}_${idx + 1}`,
    name: p.name,
    realName: p.realName,
    origin: (side === 'blue' ? 'LoL' : 'CS') as GameOrigin,
    tier: 'GOAT' as CardTier,
    ovr: 100,
    stats: {
      rifling: 100,
      entry: 100,
      positioning: 100,
      sniping: 100,
      utility: 100,
      shotcalling: 100
    },
    personality: 'Grandmaster Tactician',
    morale: 100,
    fatigue: 0,
    level: 60,
    currentXp: 9999,
    maxXp: 9999,
    avatarSvg: p.avatarSvg,
    isEvo: true
  }));
}
