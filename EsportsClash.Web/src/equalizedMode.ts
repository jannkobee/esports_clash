import type { CoachCard, PlayerCard, AvatarRole, CardTier, GameOrigin } from './types.ts';
import { CHAMPIONS } from './mockData.ts';

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

export function createEqualizedRoster(side: 'blue' | 'red'): PlayerCard[] {
  const blueProfiles = [
    { name: 'TheSpicy', role: 'Fighter', avatarSvg: 'theshy', realName: 'TheShy' },
    { name: 'p1mple', role: 'Assassin', avatarSvg: 's1mple', realName: 's1mple' },
    { name: 'Flaker', role: 'Mage', avatarSvg: 'faker', realName: 'Faker' },
    { name: 'Ouzi', role: 'Marksman', avatarSvg: 'uzi', realName: 'Uzi' },
    { name: 'Cardrel', role: 'Support', avatarSvg: 'caedrel', realName: 'Caedrel' },
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
