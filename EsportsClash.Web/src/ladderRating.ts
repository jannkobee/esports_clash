// src/ladderRating.ts
// Pure Chess-Style Competitive Ladder & Elo Rating System for Esports Clash
// Rating begins at 300. Titles follow genuine Chess hierarchy (Pawn to Grandmaster).
// Does NOT use LP or Bronze/Silver/Gold moba ranks.

import { PRO_TEAMS_DATABASE, type ProTeam } from './proTeamsDatabase.ts';

export type ChessRankId =
  | 'pawn'
  | 'knight'
  | 'bishop'
  | 'rook'
  | 'queen'
  | 'candidate_master'
  | 'master'
  | 'international_master'
  | 'grandmaster';

export interface ChessRankTier {
  id: ChessRankId;
  name: string;
  title: string;
  minRating: number;
  maxRating: number;
  icon: string;
  badgeColor: string;
  borderColor: string;
  gradient: string;
  description: string;
}

export interface LadderMatchRecord {
  id: string;
  opponentName: string;
  opponentRating: number;
  result: 'win' | 'loss';
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  timestamp: number;
}

export interface LadderProfile {
  rating: number;        // Starts at 300
  peakRating: number;    // Starts at 300
  wins: number;
  losses: number;
  streak: number;        // Positive for win streak, negative for loss streak
  matchesPlayed: number;
  recentMatches: LadderMatchRecord[];
}

export interface LadderEntry {
  rank: number;
  id: string;
  name: string;
  tag: string;
  rating: number;
  tier: ChessRankTier;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  recentForm: ('W' | 'L')[];
  avgOvr: number;
  coachName: string;
  isPlayer?: boolean;
}

// Chess Ranks replacing traditional Bronze/Silver/Gold
export const CHESS_RANK_TIERS: ChessRankTier[] = [
  {
    id: 'pawn',
    name: 'Pawn',
    title: 'Novice Contender',
    minRating: 300,
    maxRating: 599,
    icon: '♟️',
    badgeColor: 'bg-slate-800 text-slate-200 border-slate-600',
    borderColor: 'border-slate-600',
    gradient: 'from-slate-700 to-slate-900',
    description: 'Entry bracket. The foundational building blocks of tactical strategy.'
  },
  {
    id: 'knight',
    name: 'Knight',
    title: 'Tactical Striker',
    minRating: 600,
    maxRating: 899,
    icon: '♞',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-600/50',
    borderColor: 'border-emerald-500',
    gradient: 'from-emerald-700 to-slate-900',
    description: 'Agile skirmishers capable of navigating tight angles and executing sudden dives.'
  },
  {
    id: 'bishop',
    name: 'Bishop',
    title: 'Diagonal Strategist',
    minRating: 900,
    maxRating: 1199,
    icon: '♝',
    badgeColor: 'bg-teal-950 text-teal-300 border-teal-600/50',
    borderColor: 'border-teal-500',
    gradient: 'from-teal-700 to-slate-900',
    description: 'Disciplined lane controllers with wide vision and sharp objective timing.'
  },
  {
    id: 'rook',
    name: 'Rook',
    title: 'Fortress Commander',
    minRating: 1200,
    maxRating: 1499,
    icon: '♜',
    badgeColor: 'bg-blue-950 text-blue-300 border-blue-600/50',
    borderColor: 'border-blue-500',
    gradient: 'from-blue-700 to-slate-900',
    description: 'Heavy siege anchors who dominate the bridge corridors with iron authority.'
  },
  {
    id: 'queen',
    name: 'Queen',
    title: 'Grand Strategist',
    minRating: 1500,
    maxRating: 1799,
    icon: '♛',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-600/50',
    borderColor: 'border-purple-500',
    gradient: 'from-purple-700 to-slate-900',
    description: 'Versatile playmakers possessing complete mastery across all combat archetypes.'
  },
  {
    id: 'candidate_master',
    name: 'Candidate Master',
    title: 'Candidate Master (CM)',
    minRating: 1800,
    maxRating: 2099,
    icon: '🎖️',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-600/50',
    borderColor: 'border-amber-500',
    gradient: 'from-amber-700 to-slate-900',
    description: 'Recognized master bracket with deep champion mastery and clutch execution.'
  },
  {
    id: 'master',
    name: 'Master',
    title: 'National Master (M)',
    minRating: 2100,
    maxRating: 2399,
    icon: '🎗️',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-600/50',
    borderColor: 'border-rose-500',
    gradient: 'from-rose-700 to-slate-900',
    description: 'Continental contenders with frame-perfect mechanics and relentless macro.'
  },
  {
    id: 'international_master',
    name: 'International Master',
    title: 'International Master (IM)',
    minRating: 2400,
    maxRating: 2699,
    icon: '⚔️',
    badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-500/60',
    borderColor: 'border-indigo-400',
    gradient: 'from-indigo-600 via-purple-700 to-slate-900',
    description: 'Global esports elite revered internationally for clutch tournament pedigree.'
  },
  {
    id: 'grandmaster',
    name: 'Grandmaster',
    title: 'Super Grandmaster (GM)',
    minRating: 2700,
    maxRating: 9999,
    icon: '👑',
    badgeColor: 'bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-300 text-slate-950 border-amber-300 font-black',
    borderColor: 'border-amber-400',
    gradient: 'from-amber-500 via-pink-600 to-cyan-500',
    description: 'The absolute summit of Esports Clash. Immortals who command the global ladder.'
  }
];

// Returns the active Chess rank tier for a given rating
export function getChessRank(rating: number): ChessRankTier {
  const safeRating = Math.max(300, Math.round(rating));
  for (let i = CHESS_RANK_TIERS.length - 1; i >= 0; i--) {
    if (safeRating >= CHESS_RANK_TIERS[i].minRating) {
      return CHESS_RANK_TIERS[i];
    }
  }
  return CHESS_RANK_TIERS[0];
}

// Returns the next Chess rank tier to reach, or null if Grandmaster
export function getNextChessRank(rating: number): ChessRankTier | null {
  const current = getChessRank(rating);
  const idx = CHESS_RANK_TIERS.findIndex(t => t.id === current.id);
  if (idx >= 0 && idx < CHESS_RANK_TIERS.length - 1) {
    return CHESS_RANK_TIERS[idx + 1];
  }
  return null;
}

// Calculate progress percentage (0 - 100) towards next rank tier
export function getRankProgressPercent(rating: number): number {
  const current = getChessRank(rating);
  const next = getNextChessRank(rating);
  if (!next) return 100;
  const range = next.minRating - current.minRating;
  const progress = Math.max(0, rating - current.minRating);
  return Math.min(100, Math.round((progress / range) * 100));
}

// Chess Elo Rating calculation
export function calculateEloDelta(
  playerRating: number,
  opponentRating: number,
  isWin: boolean,
  currentStreak: number = 0
): {
  newRating: number;
  delta: number;
  expectedScore: number;
  streakBonus: number;
  promoted: boolean;
  demoted: boolean;
  oldTier: ChessRankTier;
  newTier: ChessRankTier;
} {
  const safePlayer = Math.max(300, Math.round(playerRating));
  const safeOpponent = Math.max(300, Math.round(opponentRating));

  // Elo expected score formula: 1 / (1 + 10 ^ ((R_opp - R_player) / 400))
  const expectedScore = 1 / (1 + Math.pow(10, (safeOpponent - safePlayer) / 400));

  // Dynamic K-Factor: beginners climb faster from 300
  let kFactor = 32;
  if (safePlayer < 800) {
    kFactor = 40;
  } else if (safePlayer >= 1800) {
    kFactor = 24;
  }

  // Win streak bonus (+3 to +8)
  let streakBonus = 0;
  if (isWin && currentStreak >= 2) {
    streakBonus = Math.min(8, 2 + Math.floor(currentStreak / 2) * 2);
  }

  const actualScore = isWin ? 1 : 0;
  let rawDelta = Math.round(kFactor * (actualScore - expectedScore)) + streakBonus;

  // Rating floor: Starting rating is 300, players cannot drop below 300
  if (safePlayer + rawDelta < 300) {
    rawDelta = 300 - safePlayer;
  }

  // Guarantee minimal feedback (at least +12 on win, at least -8 on loss unless at floor)
  if (isWin && rawDelta < 12) rawDelta = 12 + streakBonus;
  if (!isWin && rawDelta > -8 && safePlayer > 300) {
    rawDelta = Math.max(300 - safePlayer, -8);
  }

  const newRating = safePlayer + rawDelta;
  const oldTier = getChessRank(safePlayer);
  const newTier = getChessRank(newRating);

  const promoted = newTier.minRating > oldTier.minRating;
  const demoted = newTier.minRating < oldTier.minRating;

  return {
    newRating,
    delta: rawDelta,
    expectedScore,
    streakBonus,
    promoted,
    demoted,
    oldTier,
    newTier
  };
}

// Starting profile for fresh clubs
export const DEFAULT_LADDER_PROFILE: LadderProfile = {
  rating: 300, // Starts at 300 Rating (Pawn tier)
  peakRating: 300,
  wins: 0,
  losses: 0,
  streak: 0,
  matchesPlayed: 0,
  recentMatches: []
};

export const LADDER_STORAGE_KEY = 'esports-clash-ladder-profile';

export function loadLadderProfile(): LadderProfile {
  try {
    const raw = localStorage.getItem(LADDER_STORAGE_KEY);
    if (!raw) return DEFAULT_LADDER_PROFILE;
    const parsed = JSON.parse(raw) as LadderProfile;
    return {
      rating: typeof parsed.rating === 'number' ? Math.max(300, parsed.rating) : 300,
      peakRating: typeof parsed.peakRating === 'number' ? Math.max(300, parsed.peakRating) : 300,
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      losses: typeof parsed.losses === 'number' ? parsed.losses : 0,
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
      matchesPlayed: typeof parsed.matchesPlayed === 'number' ? parsed.matchesPlayed : 0,
      recentMatches: Array.isArray(parsed.recentMatches) ? parsed.recentMatches : []
    };
  } catch {
    return DEFAULT_LADDER_PROFILE;
  }
}

export function saveLadderProfile(profile: LadderProfile): void {
  try {
    localStorage.setItem(LADDER_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage might be restricted
  }
}

// Curated living AI ladder teams across the full 300 to 2850 spectrum
interface StaticRival {
  id: string;
  name: string;
  tag: string;
  baseRating: number;
  avgOvr: number;
  coachName: string;
  wins: number;
  losses: number;
  streak: number;
  recentForm: ('W' | 'L')[];
}

const STATIC_RIVALS: StaticRival[] = [
  // Grandmaster (2700+)
  { id: 'rival_t1', name: 'T1 Dynasty', tag: 'T1', baseRating: 2840, avgOvr: 97, coachName: 'kkOma Supreme', wins: 38, losses: 4, streak: 9, recentForm: ['W', 'W', 'W', 'W', 'W'] },
  { id: 'rival_geng', name: 'Gen.G Dynasts', tag: 'GEN', baseRating: 2795, avgOvr: 96, coachName: 'cvMax Discipline', wins: 35, losses: 7, streak: 4, recentForm: ['W', 'W', 'W', 'L', 'W'] },
  { id: 'rival_blg', name: 'BLG Titans', tag: 'BLG', baseRating: 2735, avgOvr: 95, coachName: 'Tabe Playmaker', wins: 33, losses: 9, streak: 3, recentForm: ['L', 'W', 'W', 'W', 'W'] },

  // International Master (2400-2699)
  { id: 'rival_jdg', name: 'JDG Dominance', tag: 'JDG', baseRating: 2640, avgOvr: 94, coachName: 'Homme Strategist', wins: 30, losses: 10, streak: 2, recentForm: ['W', 'L', 'W', 'W', 'W'] },
  { id: 'rival_hle', name: 'Hanwha Chibi', tag: 'HLE', baseRating: 2580, avgOvr: 93, coachName: 'DanDy Tactician', wins: 28, losses: 12, streak: 1, recentForm: ['W', 'W', 'L', 'W', 'W'] },
  { id: 'rival_g2', name: 'G2 Apex', tag: 'G2', baseRating: 2510, avgOvr: 93, coachName: 'Dylan Falco', wins: 29, losses: 13, streak: 3, recentForm: ['W', 'W', 'W', 'L', 'W'] },
  { id: 'rival_tes', name: 'Top Esports Neo', tag: 'TES', baseRating: 2450, avgOvr: 92, coachName: 'DesPa1r General', wins: 26, losses: 14, streak: -1, recentForm: ['W', 'W', 'L', 'W', 'L'] },

  // Master (2100-2399)
  { id: 'rival_kt', name: 'KT Rollers', tag: 'KT', baseRating: 2360, avgOvr: 91, coachName: 'Hirai Tactician', wins: 25, losses: 15, streak: 2, recentForm: ['L', 'W', 'W', 'W', 'W'] },
  { id: 'rival_fly', name: 'FlyQuest Prime', tag: 'FLY', baseRating: 2290, avgOvr: 90, coachName: 'Nukeduck Coach', wins: 24, losses: 16, streak: 1, recentForm: ['W', 'L', 'W', 'W', 'L'] },
  { id: 'rival_fnc', name: 'Fnatic Legacy', tag: 'FNC', baseRating: 2220, avgOvr: 90, coachName: 'Nightshare', wins: 23, losses: 17, streak: -1, recentForm: ['W', 'L', 'L', 'W', 'L'] },
  { id: 'rival_tl', name: 'Team Liquid Prime', tag: 'TL', baseRating: 2150, avgOvr: 89, coachName: 'Spawn Strategist', wins: 22, losses: 18, streak: 2, recentForm: ['L', 'W', 'W', 'L', 'W'] },

  // Candidate Master (1800-2099)
  { id: 'rival_wbg', name: 'Weibo Rising', tag: 'WBG', baseRating: 2060, avgOvr: 89, coachName: 'Daeny Vision', wins: 21, losses: 17, streak: 1, recentForm: ['W', 'W', 'L', 'W', 'L'] },
  { id: 'rival_dk', name: 'Dplus Neo', tag: 'DK', baseRating: 1990, avgOvr: 88, coachName: 'Zefa Strategist', wins: 20, losses: 18, streak: -2, recentForm: ['W', 'L', 'W', 'L', 'L'] },
  { id: 'rival_kc', name: 'Karmine Corp Blue', tag: 'KC', baseRating: 1920, avgOvr: 88, coachName: 'YamatoCannon', wins: 19, losses: 17, streak: 2, recentForm: ['L', 'W', 'W', 'W', 'L'] },
  { id: 'rival_lng', name: 'LNG Claws', tag: 'LNG', baseRating: 1850, avgOvr: 87, coachName: 'Crescent Master', wins: 18, losses: 18, streak: 1, recentForm: ['W', 'L', 'L', 'W', 'W'] },

  // Queen (1500-1799)
  { id: 'rival_c9', name: 'Cloud9 Neo', tag: 'C9', baseRating: 1750, avgOvr: 87, coachName: 'Mithy Leader', wins: 17, losses: 17, streak: 1, recentForm: ['L', 'W', 'W', 'L', 'W'] },
  { id: 'rival_koi', name: 'KOI Juniors', tag: 'KOI', baseRating: 1680, avgOvr: 86, coachName: 'Ibai Visionary', wins: 16, losses: 18, streak: -1, recentForm: ['W', 'L', 'W', 'L', 'L'] },
  { id: 'rival_th', name: 'Heretics Cadets', tag: 'TH', baseRating: 1610, avgOvr: 86, coachName: 'Peter Dun', wins: 15, losses: 19, streak: 2, recentForm: ['L', 'L', 'W', 'W', 'W'] },
  { id: 'rival_bds', name: 'Team BDS Neo', tag: 'BDS', baseRating: 1540, avgOvr: 85, coachName: 'Striker Tactician', wins: 14, losses: 18, streak: -1, recentForm: ['W', 'W', 'L', 'L', 'L'] },

  // Rook (1200-1499)
  { id: 'rival_tsm', name: 'TSM Minis', tag: 'TSM', baseRating: 1450, avgOvr: 85, coachName: 'General OddOne', wins: 14, losses: 16, streak: 1, recentForm: ['L', 'W', 'L', 'W', 'W'] },
  { id: 'rival_100t', name: '100 Thieves Academy', tag: '100A', baseRating: 1380, avgOvr: 84, coachName: 'Goldenglue', wins: 13, losses: 17, streak: -1, recentForm: ['W', 'L', 'W', 'L', 'L'] },
  { id: 'rival_rge', name: 'Rogue Cadets', tag: 'RGE', baseRating: 1310, avgOvr: 84, coachName: 'Fredy122', wins: 12, losses: 18, streak: 2, recentForm: ['L', 'W', 'L', 'W', 'W'] },
  { id: 'rival_gx', name: 'GIANTX Rising', tag: 'GX', baseRating: 1240, avgOvr: 83, coachName: 'Guilhoto', wins: 12, losses: 16, streak: 1, recentForm: ['W', 'L', 'L', 'W', 'W'] },

  // Bishop (900-1199)
  { id: 'rival_bg2', name: 'Baby-G2 Esports', tag: 'bG2', baseRating: 1160, avgOvr: 83, coachName: 'GrabbZ Draft', wins: 11, losses: 15, streak: 1, recentForm: ['L', 'W', 'W', 'L', 'W'] },
  { id: 'rival_mfnc', name: 'Mini-Fnatic', tag: 'mFNC', baseRating: 1090, avgOvr: 82, coachName: 'Deilor Discipline', wins: 10, losses: 16, streak: -1, recentForm: ['W', 'L', 'L', 'W', 'L'] },
  { id: 'rival_ek', name: 'Echo Knights', tag: 'EK', baseRating: 1020, avgOvr: 82, coachName: 'Froggen Cryo', wins: 10, losses: 14, streak: 2, recentForm: ['L', 'W', 'L', 'W', 'W'] },
  { id: 'rival_sen', name: 'Sentinels Jr', tag: 'SEN', baseRating: 950, avgOvr: 81, coachName: 'Kaplan Tactician', wins: 9, losses: 15, streak: -2, recentForm: ['W', 'W', 'L', 'L', 'L'] },

  // Knight (600-899)
  { id: 'rival_c9p', name: 'Cloud9 Pups', tag: 'C9P', baseRating: 860, avgOvr: 81, coachName: 'Reapered Book', wins: 8, losses: 14, streak: 1, recentForm: ['L', 'L', 'W', 'W', 'W'] },
  { id: 'rival_dig', name: 'Dignitas Recruits', tag: 'DIG', baseRating: 790, avgOvr: 80, coachName: 'Scarra Ward', wins: 7, losses: 15, streak: -1, recentForm: ['W', 'L', 'W', 'L', 'L'] },
  { id: 'rival_mady', name: 'MAD Lions Youth', tag: 'MAD', baseRating: 720, avgOvr: 80, coachName: 'Mac Visionary', wins: 6, losses: 14, streak: 1, recentForm: ['L', 'W', 'L', 'L', 'W'] },
  { id: 'rival_gxm', name: 'GIANTX Mini', tag: 'GXM', baseRating: 650, avgOvr: 79, coachName: 'Lozark', wins: 6, losses: 16, streak: -2, recentForm: ['W', 'L', 'L', 'W', 'L'] },

  // Pawn (300-599) - Entry & Grassroots Competitors
  { id: 'rival_pxp', name: 'Pixel Pups', tag: 'PX', baseRating: 540, avgOvr: 78, coachName: 'Sparky Rookie', wins: 4, losses: 12, streak: 1, recentForm: ['L', 'W', 'L', 'W', 'L'] },
  { id: 'rival_kbd', name: 'Keyboard Warriors', tag: 'KBD', baseRating: 470, avgOvr: 77, coachName: 'Clicker Pro', wins: 3, losses: 13, streak: -1, recentForm: ['W', 'L', 'L', 'L', 'W'] },
  { id: 'rival_scrb', name: 'River Crabs Esports', tag: 'SCRB', baseRating: 410, avgOvr: 76, coachName: 'Scuttle Shell', wins: 2, losses: 14, streak: -2, recentForm: ['L', 'L', 'W', 'L', 'L'] },
  { id: 'rival_min', name: 'Minion Rushers', tag: 'MIN', baseRating: 350, avgOvr: 75, coachName: 'Siege Cannon', wins: 1, losses: 15, streak: -3, recentForm: ['L', 'L', 'L', 'W', 'L'] },
  { id: 'rival_scrub', name: 'Scrub Academy', tag: 'SCRUB', baseRating: 310, avgOvr: 74, coachName: 'Practice Dummy', wins: 0, losses: 16, streak: -5, recentForm: ['L', 'L', 'L', 'L', 'L'] }
];

// Generate full dynamic leaderboard including player squad
export function getLadderLeaderboard(playerProfile: LadderProfile, playerName = 'T-Chibi Squad'): LadderEntry[] {
  const playerTier = getChessRank(playerProfile.rating);
  const playerWins = playerProfile.wins;
  const playerLosses = playerProfile.losses;
  const playerGames = playerWins + playerLosses;
  const playerWinRate = playerGames > 0 ? Math.round((playerWins / playerGames) * 100) : 0;

  // Build recent form from match history
  const recentForm: ('W' | 'L')[] = playerProfile.recentMatches.slice(-5).map(m => m.result === 'win' ? 'W' : 'L');
  while (recentForm.length < 5) {
    recentForm.unshift('W');
  }

  const playerEntry: LadderEntry = {
    rank: 0,
    id: 'player_squad',
    name: playerName,
    tag: 'TCS',
    rating: playerProfile.rating,
    tier: playerTier,
    wins: playerWins,
    losses: playerLosses,
    winRate: playerWinRate,
    streak: playerProfile.streak,
    recentForm,
    avgOvr: 94,
    coachName: 'Cardrel Tactical',
    isPlayer: true
  };

  const rivalEntries: LadderEntry[] = STATIC_RIVALS.map(r => ({
    rank: 0,
    id: r.id,
    name: r.name,
    tag: r.tag,
    rating: r.baseRating,
    tier: getChessRank(r.baseRating),
    wins: r.wins,
    losses: r.losses,
    winRate: Math.round((r.wins / Math.max(1, r.wins + r.losses)) * 100),
    streak: r.streak,
    recentForm: r.recentForm,
    avgOvr: r.avgOvr,
    coachName: r.coachName
  }));

  const allEntries = [...rivalEntries, playerEntry].sort((a, b) => b.rating - a.rating);

  return allEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

// Find a balanced match opponent within ~100 rating
export function findLadderOpponent(playerRating: number, leaderboard: LadderEntry[]): LadderEntry {
  const rivals = leaderboard.filter(e => !e.isPlayer);
  if (rivals.length === 0) {
    return {
      rank: 1,
      id: 'rival_default',
      name: 'Pixel Pups',
      tag: 'PX',
      rating: 320,
      tier: getChessRank(320),
      wins: 1,
      losses: 5,
      winRate: 16,
      streak: -1,
      recentForm: ['L', 'W', 'L', 'L', 'L'],
      avgOvr: 76,
      coachName: 'Dummy Coach'
    };
  }

  // Find rivals within +/- 150 rating first
  const closeCandidates = rivals.filter(r => Math.abs(r.rating - playerRating) <= 150);
  if (closeCandidates.length > 0) {
    // Pick candidate closest to player's rating
    closeCandidates.sort((a, b) => Math.abs(a.rating - playerRating) - Math.abs(b.rating - playerRating));
    return closeCandidates[0];
  }

  // Fallback: pick the closest rival overall
  rivals.sort((a, b) => Math.abs(a.rating - playerRating) - Math.abs(b.rating - playerRating));
  return rivals[0];
}

// Map a LadderEntry to a full playable ProTeam with starters and coach
export function ladderOpponentToProTeam(entry: LadderEntry): ProTeam {
  // Check exact or partial name/tag match in PRO_TEAMS_DATABASE
  const matched = PRO_TEAMS_DATABASE.find(
    t => t.name.toLowerCase() === entry.name.toLowerCase() ||
         t.tag.toLowerCase() === entry.tag.toLowerCase() ||
         entry.name.toLowerCase().includes(t.name.toLowerCase())
  );
  if (matched) return matched;

  // Otherwise, clone a database team with closest avgOvr and customize name/coach
  const closest = [...PRO_TEAMS_DATABASE].sort(
    (a, b) => Math.abs(a.avgOvr - entry.avgOvr) - Math.abs(b.avgOvr - entry.avgOvr)
  )[0] || PRO_TEAMS_DATABASE[0];

  return {
    ...closest,
    id: `ladder_${entry.id}`,
    name: entry.name,
    tag: entry.tag,
    avgOvr: entry.avgOvr,
    coach: {
      ...closest.coach,
      name: entry.coachName
    }
  };
}

