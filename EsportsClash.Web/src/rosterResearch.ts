import type { AvatarRole, GameOrigin, PlayerCard } from './types';

// Inspiration pool: fictional card ratings are game balance values, not claims about real people.
// LoL tournament roster: https://liquipedia.net/leagueoflegends/World_Championship/2025
// Dota tournament roster: https://liquipedia.net/dota2/The_International/2025
// CS ranking: https://www.hltv.org/news/43492/top-20-players-of-2025-final-list
// Streamer references: https://liquipedia.net/leagueoflegends/Caedrel and
// https://liquipedia.net/leagueoflegends/Tyler1 ; Dendi: https://liquipedia.net/dota2/Dendi
type Inspiration = readonly [realName: string, cardName: string, origin: GameOrigin, role: AvatarRole, ovr: number, iq: number];

export const RESEARCHED_PLAYERS: readonly Inspiration[] = [
  ['Oner', 'Onyx', 'LoL', 'Fighter', 92, 91],
  ['Faker', 'Flaker', 'LoL', 'Mage', 98, 98],
  ['Gumayusi', 'Gumayushi', 'LoL', 'Marksman', 93, 90],
  ['Keria', 'Keriax', 'LoL', 'Support', 94, 96],
  ['Bin', 'Binn', 'LoL', 'Fighter', 92, 87],
  ['knight', 'Knyte', 'LoL', 'Mage', 94, 92],
  ['Elk', 'Elkk', 'LoL', 'Marksman', 91, 87],
  ['ON', 'ONN', 'LoL', 'Support', 88, 84],
  ['Tarzan', 'Tarzahn', 'LoL', 'Fighter', 92, 93],
  ['Kanavi', 'Kanavii', 'LoL', 'Assassin', 92, 89],
  ['JackeyLove', 'JackeyLuv', 'LoL', 'Marksman', 93, 84],
  ['Chovy', 'Chovvy', 'LoL', 'Mage', 96, 94],
  ['Canyon', 'Canyonn', 'LoL', 'Assassin', 94, 94],
  ['Ruler', 'Rulerr', 'LoL', 'Marksman', 95, 93],
  ['Zeus', 'Zeuz', 'LoL', 'Fighter', 93, 90],
  ['Viper', 'Vyper', 'LoL', 'Marksman', 94, 91],
  ['Caedrel', 'Cardrel', 'LoL', 'Support', 88, 97],
  ['Tyler1', 'Tylerr1', 'LoL', 'Fighter', 86, 78],
  ['Yatoro', 'Yatoroo', 'Dota2', 'Marksman', 96, 92],
  ['Collapse', 'Collapz', 'Dota2', 'Tank', 94, 93],
  ['Miposhka', 'MiposhkaX', 'Dota2', 'Support', 92, 96],
  ['skiter', 'Skytah', 'Dota2', 'Marksman', 92, 87],
  ['Malr1ne', 'Malrine', 'Dota2', 'Mage', 93, 90],
  ['ATF', 'ATFury', 'Dota2', 'Fighter', 93, 85],
  ['Cr1t-', 'Critz', 'Dota2', 'Support', 92, 92],
  ['Sneyking', 'Sneykingg', 'Dota2', 'Support', 91, 95],
  ['Nisha', 'Nishah', 'Dota2', 'Mage', 95, 93],
  ['miCKe', 'Micke', 'Dota2', 'Marksman', 92, 89],
  ['SaberLight', 'SaberLite', 'Dota2', 'Tank', 90, 88],
  ['Boxi', 'Boxxy', 'Dota2', 'Support', 91, 91],
  ['SumaiL', 'Sumailz', 'Dota2', 'Mage', 94, 90],
  ['GH', 'GeeH', 'Dota2', 'Support', 92, 94],
  ['NothingToSay', 'MuchToSay', 'Dota2', 'Mage', 92, 91],
  ['Dendi', 'Dendii', 'Dota2', 'Mage', 88, 90],
  ['ZywOo', 'WooZy', 'CS', 'Fighter', 95, 95],
  ['donk', 'd0nk', 'CS', 'Assassin', 94, 83],
  ['ropz', 'r0pz', 'CS', 'Assassin', 93, 93],
  ['m0NESY', 'm0NEY', 'CS', 'Marksman', 94, 88],
  ['sh1ro', 'sh1row', 'CS', 'Marksman', 92, 91],
  ['molodoy', 'molod0y', 'CS', 'Marksman', 90, 83],
  ['frozen', 'fr0zen', 'CS', 'Fighter', 91, 90],
  ['KSCERATO', 'KSCARATO', 'CS', 'Fighter', 91, 89],
  ['Spinx', 'Spynx', 'CS', 'Assassin', 90, 89],
  ['Twistzz', 'Twistzzy', 'CS', 'Fighter', 91, 91],
  ['Senzu', 'Senzuu', 'CS', 'Assassin', 89, 85],
  ['XANTARES', 'XANTARUS', 'CS', 'Fighter', 91, 84],
  ['YEKINDAR', 'YEKINDER', 'CS', 'Assassin', 90, 85],
  ['xertioN', 'xert10N', 'CS', 'Assassin', 90, 86],
  ['torzsi', 'torzsy', 'CS', 'Marksman', 90, 90],
  ['NiKo', 'NeKo', 'CS', 'Fighter', 91, 89],
];

const signatureByRole: Record<AvatarRole, string[]> = {
  Tank: ['Solana', 'Kaolin', 'Bedrock'], Mage: ['Kyumi', 'Raijin', 'Locke', 'Nevermore'],
  Marksman: ['Astra', 'Cora', 'Senara'], Support: ['Renn', 'Zal', 'Largo'],
  Fighter: ['Valkira', 'Buck', 'Bedrock'], Assassin: ['Kage', 'Qiyana', 'Inai'],
};

export function createResearchedCards(existing: PlayerCard[]): PlayerCard[] {
  const known = new Set(existing.map(p => p.realName.toLowerCase()));
  return RESEARCHED_PLAYERS.filter(([realName]) => !known.has(realName.toLowerCase())).map(([realName, name, origin, role, ovr, iq], index) => ({
    id: `p_research_${realName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    name, realName, origin, role, preferredRole: role,
    tier: ovr >= 96 ? 'GOAT' : ovr >= 90 ? 'Diamond' : 'Platinum',
    ovr,
    stats: {
      lan: Math.min(99, ovr + (index % 5) - 2), tf: Math.min(99, ovr + (index % 3) - 1),
      iq, clu: Math.min(99, ovr + (index % 4) - 2), sta: Math.min(99, ovr + (index % 5) - 3),
      flx: Math.min(99, ovr + (index % 6) - 3),
    },
    personality: realName === 'Caedrel' ? 'Vocal Analyst' : realName === 'Tyler1' ? 'Aggressive Grinder' : 'Adaptable Competitor',
    badges: realName === 'Caedrel' ? ['Shotcaller', 'Broadcast Brain'] : ['Competitive Veteran'],
    signatureChampions: signatureByRole[role], morale: 85, fatigue: 12,
    level: Math.max(20, ovr - 50), currentXp: 0, maxXp: Math.max(2000, (ovr - 50) * 100),
    avatarSvg: `research_${realName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  }));
}
