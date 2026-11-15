import type { GameOrigin, PlayerCard } from './types';

// Inspiration pool: fictional card ratings are game balance values, not claims about real people.
// LoL tournament roster: https://liquipedia.net/leagueoflegends/World_Championship/2025
// Dota tournament roster: https://liquipedia.net/dota2/The_International/2025
// CS ranking: https://www.hltv.org/news/43492/top-20-players-of-2025-final-list
// Streamer references: https://liquipedia.net/leagueoflegends/Caedrel and
// https://liquipedia.net/leagueoflegends/Tyler1 ; Dendi: https://liquipedia.net/dota2/Dendi
type Inspiration = readonly [realName: string, cardName: string, origin: GameOrigin, ovr: number, positioning: number];

export const RESEARCHED_PLAYERS: readonly Inspiration[] = [
  ['Oner', 'Own3r', 'LoL', 92, 91],
  ['Faker', 'Flaker', 'LoL', 98, 98],
  ['Gumayusi', 'Gumayoshi', 'LoL', 93, 90],
  ['Keria', 'Keriax', 'LoL', 94, 96],
  ['Bin', 'Dustbin', 'LoL', 92, 87],
  ['knight', 'DarkKnyte', 'LoL', 94, 92],
  ['Elk', 'Elko', 'LoL', 91, 87],
  ['ON', 'OFF', 'LoL', 88, 84],
  ['Tarzan', 'Tarz4n', 'LoL', 92, 93],
  ['Kanavi', 'Kanoodle', 'LoL', 92, 89],
  ['JackeyLove', 'JackeyLuv', 'LoL', 93, 84],
  ['Chovy', 'Anchovy', 'LoL', 96, 94],
  ['Canyon', 'Cany0n', 'LoL', 94, 94],
  ['Ruler', 'Protractor', 'LoL', 95, 93],
  ['Zeus', 'Z3us', 'LoL', 93, 90],
  ['Viper', 'Vyper', 'LoL', 94, 91],
  ['Caedrel', 'Cardrel', 'LoL', 90, 97],
  ['Tyler1', 'BigTonka', 'LoL', 86, 78],
  ['Yatoro', 'Totoro', 'Dota2', 96, 92],
  ['Collapse', 'Collapz', 'Dota2', 94, 93],
  ['Miposhka', 'Miposhk4', 'Dota2', 92, 96],
  ['skiter', 'Skytah', 'Dota2', 92, 87],
  ['Malr1ne', 'Submar1ne', 'Dota2', 93, 90],
  ['ATF', 'ATFury', 'Dota2', 93, 85],
  ['Cr1t-', 'Spl1t', 'Dota2', 92, 92],
  ['Sneyking', 'SneakBro', 'Dota2', 91, 95],
  ['Nisha', 'Fisha', 'Dota2', 95, 93],
  ['miCKe', 'M0cke', 'Dota2', 92, 89],
  ['SaberLight', 'SaberLite', 'Dota2', 90, 88],
  ['Boxi', 'Boxxy', 'Dota2', 91, 91],
  ['SumaiL', 'KingSumail', 'Dota2', 94, 90],
  ['GH', 'GeeH', 'Dota2', 92, 94],
  ['NothingToSay', 'PlentyToSay', 'Dota2', 92, 91],
  ['Dendi', 'Dendimon', 'Dota2', 88, 90],
  ['ZywOo', 'Zypoo', 'CS', 95, 95],
  ['donk', 'd4nk', 'CS', 94, 83],
  ['ropz', 'flopz', 'CS', 93, 93],
  ['m0NESY', 'm0NKEY', 'CS', 94, 88],
  ['sh1ro', 'sh1row', 'CS', 92, 91],
  ['molodoy', 'molod0y', 'CS', 90, 83],
  ['frozen', 'melted', 'CS', 91, 90],
  ['KSCERATO', 'KSCARATO', 'CS', 91, 89],
  ['Spinx', 'Sph1nx', 'CS', 90, 89],
  ['Twistzz', 'Twistzzy', 'CS', 91, 91],
  ['Senzu', 'SenzuBean', 'CS', 89, 85],
  ['XANTARES', 'PEEKTARES', 'CS', 91, 84],
  ['YEKINDAR', 'YEKINDER', 'CS', 90, 85],
  ['xertioN', 'xert10N', 'CS', 90, 86],
  ['torzsi', 'torzsy', 'CS', 90, 90],
  ['NiKo', 'NeKo', 'CS', 91, 89],
];

export function createResearchedCards(existing: PlayerCard[]): PlayerCard[] {
  const known = new Set(existing.map(p => p.realName.toLowerCase()));
  return RESEARCHED_PLAYERS.filter(([realName]) => !known.has(realName.toLowerCase())).map(([realName, name, origin, ovr, positioning], index) => ({
    id: `p_research_${realName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    name, realName, origin,
    tier: ovr >= 96 ? 'GOAT' : ovr >= 90 ? 'Diamond' : 'Platinum',
    ovr,
    stats: {
      rifling: Math.min(99, ovr + (index % 5) - 2), entry: Math.min(99, ovr + (index % 3) - 1),
      positioning, sniping: Math.min(99, ovr + (index % 4) - 2), utility: Math.min(99, ovr + (index % 5) - 3), shotcalling: positioning,
    },
    personality: 'Unset',
    morale: 85, fatigue: 12,
    level: Math.max(20, ovr - 50), currentXp: 0, maxXp: Math.max(2000, (ovr - 50) * 100),
    avatarSvg: `research_${realName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  }));
}
