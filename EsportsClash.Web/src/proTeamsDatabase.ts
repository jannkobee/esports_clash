// Pro Esports Circuit & World Teams Database
// Living simulation database containing 120+ authentic pro teams with distinct coaches, rosters, and tactical AI archetypes.

import type { CoachCard, PlayerCard, CardTier, AvatarRole } from './types';

export interface ProTeam {
  id: string;
  name: string;
  tag: string;
  league: 'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers';
  globalRank: number;
  avgOvr: number;
  primaryColor: string;
  secondaryColor: string;
  coach: CoachCard;
  starters: PlayerCard[];
  reserves: PlayerCard[];
  stats: {
    wins: number;
    losses: number;
    points: number;
    winRate: number;
    form: ('W' | 'L')[];
  };
  playstyle: string;
  threatLevel: 'World Champion' | 'Elite Contender' | 'Playoff Contender' | 'Dark Horse' | 'Rebuilding';
}

// Deterministic Pseudo-Random Generator for consistent team generation
function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PARODY_FIRST_NAMES = [
  'Ch0vy', 'CanyonKing', 'Rulerz', 'KeriaP', 'ViperX', 'Scouty', 'Knighty', 'JackeyLover',
  'BinWarlord', 'ElkFast', 'OnSupport', 'Capsy', 'MikyxP', 'HansSamael', 'BrokenBlader',
  'BwipoB', 'InspiredJ', 'JensenM', 'CoreJJJ', 'DannyBot', 'BlaberFish', 'FudgeCake',
  'Jojopyun', 'BeryLL', 'ShowMake', 'CuzzLord', 'DeftHands', 'PyosikWolf', 'KingenTitan',
  'ZekaBlade', 'PeyzKid', 'LehendsHook', 'TarzanJ', 'XiaohuTiger', 'GALAJet', 'MingShield',
  'MeikoWard', 'JiejieJ', 'FlandreAxe', 'AleFighter', 'TianFire', 'CrispSupport', 'LwxCarry',
  'DoinbMage', 'GimGoon', 'RookieGod', 'TheShyTwin', 'BaolanShield', 'NingJungle', 'UziJunior',
  'MlxgGank', 'LetmeRock', 'ClearloveSeven', 'Koro1', 'PawNBlade', 'DeftCopy', 'MataVision',
  'DandyKick', 'LooperTeleport', 'ImpSmile', 'FlameBlaze', 'ShyTop', 'MadLifeHook', 'AmbitionBat',
  'ScoreJungle', 'SmebCarry', 'PraYArrow', 'GorillAShield', 'KuroMage', 'HuniHoller', 'ReignoverP',
  'YellowStar', 'xPekeBackdoor', 'SoAZTP', 'CyanideJ', 'AlexIch', 'Diamondprox', 'DarienLizard',
  'GenjaEyebrow', 'EdwardThresh', 'FroggenAnivia', 'WickdIrelia', 'SnoopehStare', 'KrepoBird',
  'DoubleliftFace', 'ChausterIron', 'HotshotNid', 'SaintviciousSmite', 'VoyboyBoy', 'ScarraWard',
  'DyrusPillow', 'TheOddOneGeneral', 'ReginaldBlue', 'WildTurtleSmile', 'XpecialFlay', 'SneakySnack',
  'MeteosEgo', 'HaiShotcall', 'BallsDunk', 'LemonNationNotebook', 'AphromooSupport', 'StixxayShot',
  'DarshanTeacher', 'HuhiAsol', 'XmithieSmite', 'PobelterNotorious', 'WildcardHero', 'AceStriker'
];

const COACH_NAMES = [
  'kkOma Supreme', 'Homme Strategist', 'Daeny Vision', 'WarHorse Tactician', 'KenZhu General',
  'cvMax Discipline', 'Tabe Playmaker', 'Edgar Veteran', 'Bengi Wisdom', 'GrabbZ Draft',
  'Mac Commander', 'YamatoCannon Speech', 'DylanFalco Chess', 'YoungBuck SixStars', 'PeterDun Scout',
  'Reapered Notebook', 'Inero Architect', 'Spawn Thunder', 'Guilhoto Voice', 'Thinkcard Matrix'
];

const COACH_QUOTES = [
  'Draft is 70% of victory; execution seals the rest.',
  'Fight for every dragon, collapse on every overextended carry.',
  'Patience until the 20-minute power spike, then wipe them completely.',
  'Early dive aggression breaks their mental before the first turret falls.',
  'Adapt like water. No single draft plan survives first blood.'
];

const SIGNATURES_POOL = [
  'Solana', 'Astra', 'Kyumi', 'Buck', 'Valkira', 'Kage', 'Kazemaru', 'Kindra',
  'Cora', 'Renn', 'Sylla', 'Tequoia', 'Zal', 'Xin', 'Raijin', 'Kaolin',
  'Earthshaker', 'Shadowfiend', 'Mirehook', 'Nullweaver'
];

const LEAGUES: ('LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers')[] = ['LCK', 'LPL', 'LEC', 'LCS', 'Challengers'];

// Flagship Real-World Inspired Esports Powerhouses
const FLAGSHIP_TEAMS: {
  name: string;
  tag: string;
  league: 'LCK' | 'LPL' | 'LEC' | 'LCS';
  color: string;
  secColor: string;
  coachName: string;
  coachStyle: 'Aggressive Dive' | 'Objective Macro' | 'Scaling Poke' | 'Pick & Burst' | 'Dynamic Adapt';
  rosterNames: string[];
  baseOvr: number;
}[] = [
  {
    name: 'T1 Tigers',
    tag: 'T1',
    league: 'LCK',
    color: '#e11d48',
    secColor: '#fb7185',
    coachName: 'kkOma Supreme',
    coachStyle: 'Dynamic Adapt',
    rosterNames: ['ZeusLightning', 'OnerPunch', 'Flaker', 'GumayusiBow', 'KeriaP'],
    baseOvr: 97
  },
  {
    name: 'Gen.G Dynamos',
    tag: 'GEN',
    league: 'LCK',
    color: '#d97706',
    secColor: '#fbbf24',
    coachName: 'Kim General',
    coachStyle: 'Objective Macro',
    rosterNames: ['KiinTitan', 'CanyonKing', 'Ch0vy', 'PeyzKid', 'LehendsHook'],
    baseOvr: 96
  },
  {
    name: 'Bilibili Storm',
    tag: 'BLG',
    league: 'LPL',
    color: '#06b6d4',
    secColor: '#67e8f9',
    coachName: 'BigWei Tactician',
    coachStyle: 'Aggressive Dive',
    rosterNames: ['BinWarlord', 'XunSpear', 'Knighty', 'ElkFast', 'OnSupport'],
    baseOvr: 96
  },
  {
    name: 'G2 Samurai',
    tag: 'G2',
    league: 'LEC',
    color: '#1e293b',
    secColor: '#94a3b8',
    coachName: 'DylanFalco Chess',
    coachStyle: 'Pick & Burst',
    rosterNames: ['BrokenBlader', 'YikeRogue', 'Capsy', 'HansSamael', 'MikyxP'],
    baseOvr: 93
  },
  {
    name: 'JD Gaming',
    tag: 'JDG',
    league: 'LPL',
    color: '#dc2626',
    secColor: '#f87171',
    coachName: 'Flandre Strategist',
    coachStyle: 'Objective Macro',
    rosterNames: ['FlandreAxe', 'KanaviKing', 'YagaoOld', 'Rulerz', 'MissingShield'],
    baseOvr: 94
  },
  {
    name: 'Hanwha Esports',
    tag: 'HLE',
    league: 'LCK',
    color: '#ea580c',
    secColor: '#fb923c',
    coachName: 'DanDy Vision',
    coachStyle: 'Scaling Poke',
    rosterNames: ['DoranShield', 'PeanutNut', 'ZekaBlade', 'ViperX', 'DelightTank'],
    baseOvr: 95
  },
  {
    name: 'Top Esports',
    tag: 'TES',
    league: 'LPL',
    color: '#ef4444',
    secColor: '#fca5a5',
    coachName: 'DespaTactician',
    coachStyle: 'Aggressive Dive',
    rosterNames: ['369Dice', 'TianFire', 'CremeBrulee', 'JackeyLover', 'MeikoWard'],
    baseOvr: 94
  },
  {
    name: 'Fnatic Orange',
    tag: 'FNC',
    league: 'LEC',
    color: '#f97316',
    secColor: '#fed7aa',
    coachName: 'Nightshare Mentor',
    coachStyle: 'Aggressive Dive',
    rosterNames: ['OscarininP', 'RazorkDagger', 'HumanoidMage', 'NoahArcher', 'JunSupport'],
    baseOvr: 90
  },
  {
    name: 'Cloud9 Pups',
    tag: 'C9',
    league: 'LCS',
    color: '#0284c7',
    secColor: '#38bdf8',
    coachName: 'Reapered Notebook',
    coachStyle: 'Dynamic Adapt',
    rosterNames: ['FudgeCake', 'BlaberFish', 'Jojopyun', 'BerserkerAim', 'VulcanShield'],
    baseOvr: 89
  },
  {
    name: 'Team Liquid',
    tag: 'TL',
    league: 'LCS',
    color: '#1d4ed8',
    secColor: '#60a5fa',
    coachName: 'Spawn Thunder',
    coachStyle: 'Objective Macro',
    rosterNames: ['ImpactWall', 'UmTiTracker', 'APAClutch', 'YeonSpray', 'CoreJJJ'],
    baseOvr: 89
  },
  {
    name: 'FlyQuest Green',
    tag: 'FLY',
    league: 'LCS',
    color: '#16a34a',
    secColor: '#4ade80',
    coachName: 'Nukeduck Scholar',
    coachStyle: 'Scaling Poke',
    rosterNames: ['BwipoB', 'InspiredJ', 'QuadMage', 'MassuBullet', 'BusioHook'],
    baseOvr: 90
  },
  {
    name: 'Dplus KIA',
    tag: 'DK',
    league: 'LCK',
    color: '#0f172a',
    secColor: '#38bdf8',
    coachName: 'Zefa Tactician',
    coachStyle: 'Pick & Burst',
    rosterNames: ['KingenTitan', 'LucidStar', 'ShowMake', 'AimingCross', 'MohamGuard'],
    baseOvr: 93
  }
];

const ROLES: AvatarRole[] = ['Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

/**
 * Builds a full roster of 5 starting players + 2 substitutes for a pro team.
 */
function generateTeamRoster(teamId: string, baseOvr: number, customNames?: string[], seed = 100): { starters: PlayerCard[]; reserves: PlayerCard[] } {
  const rand = pseudoRandom(seed);
  const starters: PlayerCard[] = [];
  const reserves: PlayerCard[] = [];

  const tierFromOvr = (ovr: number): CardTier => {
    if (ovr >= 95) return 'GOAT';
    if (ovr >= 91) return 'Diamond';
    if (ovr >= 85) return 'Platinum';
    if (ovr >= 79) return 'Gold';
    if (ovr >= 70) return 'Silver';
    return 'Bronze';
  };

  for (let i = 0; i < 7; i++) {
    const isStarter = i < 5;
    const role = isStarter ? ROLES[i] : ROLES[Math.floor(rand() * ROLES.length)];
    const ovrVariance = Math.floor(rand() * 5) - 2 - (isStarter ? 0 : 3);
    const ovr = Math.min(99, Math.max(72, baseOvr + ovrVariance));
    const tier = tierFromOvr(ovr);

    const name = (customNames && customNames[i])
      ? customNames[i]
      : PARODY_FIRST_NAMES[(Math.floor(rand() * PARODY_FIRST_NAMES.length) + seed + i) % PARODY_FIRST_NAMES.length];

    const sigCount = 2;
    const signatures: string[] = [];
    for (let s = 0; s < sigCount; s++) {
      const sig = SIGNATURES_POOL[Math.floor(rand() * SIGNATURES_POOL.length)];
      if (!signatures.includes(sig)) signatures.push(sig);
    }

    const card: PlayerCard = {
      id: `${teamId}_p${i + 1}`,
      name,
      realName: name,
      origin: rand() > 0.3 ? 'LoL' : rand() > 0.5 ? 'CS' : 'Dota2',
      role,
      preferredRole: role,
      tier,
      ovr,
      stats: {
        lan: Math.min(99, Math.max(70, ovr + Math.floor(rand() * 6) - 3)),
        tf: Math.min(99, Math.max(70, ovr + Math.floor(rand() * 6) - 3)),
        iq: Math.min(99, Math.max(70, ovr + Math.floor(rand() * 6) - 3)),
        clu: Math.min(99, Math.max(70, ovr + Math.floor(rand() * 6) - 3)),
        sta: Math.min(99, Math.max(70, ovr + Math.floor(rand() * 6) - 3)),
        flx: Math.min(99, Math.max(70, ovr + Math.floor(rand() * 6) - 3))
      },
      personality: rand() > 0.6 ? 'Aggro Diver' : rand() > 0.5 ? 'Tactical Shotcaller' : rand() > 0.5 ? 'Ice-Cold Clutch' : 'Laning Demon',
      badges: (() => {
        const pool: string[] = [];
        if (role === 'Fighter') {
          pool.push(rand() > 0.5 ? 'Aggro Diver' : rand() > 0.5 ? 'Laning Demon' : 'Unkillable Demon');
        } else if (role === 'Assassin') {
          pool.push(rand() > 0.4 ? 'Baron Steal' : rand() > 0.5 ? 'Shotcaller' : 'Aggro Diver');
        } else if (role === 'Mage') {
          pool.push(rand() > 0.4 ? 'Clutch King' : rand() > 0.5 ? 'One-Tap God' : 'Laning Demon');
        } else if (role === 'Marksman') {
          pool.push(rand() > 0.4 ? 'Clutch King' : rand() > 0.5 ? 'One-Tap God' : 'Ice in Veins');
        } else {
          // Support / Tank
          pool.push(rand() > 0.4 ? 'Vision Master' : rand() > 0.5 ? 'Shotcaller' : 'Ice in Veins');
        }
        if (ovr >= 93) {
          const eliteTrait = rand() > 0.5 ? 'Clutch King' : rand() > 0.5 ? 'Unkillable Demon' : 'Baron Steal';
          if (!pool.includes(eliteTrait)) pool.push(eliteTrait);
        }
        return pool;
      })(),
      signatureChampions: signatures,
      morale: 85 + Math.floor(rand() * 15),
      fatigue: Math.floor(rand() * 20),
      level: Math.floor(ovr / 2),
      currentXp: 150,
      maxXp: 500,
      avatarSvg: (i % 6) + 1 === 1 ? 'faker' : (i % 6) + 1 === 2 ? 'simple' : (i % 6) + 1 === 3 ? 'niko' : (i % 6) + 1 === 4 ? 'uzi' : (i % 6) + 1 === 5 ? 'zywoo' : 'topson'
    };

    if (isStarter) starters.push(card);
    else reserves.push(card);
  }

  return { starters, reserves };
}

/**
 * Builds a dedicated pro coach card with strategic archetype.
 */
function generateTeamCoach(teamId: string, name: string, style: 'Aggressive Dive' | 'Objective Macro' | 'Scaling Poke' | 'Pick & Burst' | 'Dynamic Adapt', baseOvr: number, seed = 200): CoachCard {
  const rand = pseudoRandom(seed);
  return {
    id: `${teamId}_coach`,
    name,
    realName: name,
    tier: baseOvr >= 94 ? 'GOAT' : baseOvr >= 90 ? 'Diamond' : 'Platinum',
    style,
    chemistryBonus: Math.min(15, Math.max(6, Math.floor(baseOvr / 7))),
    playbookBonus: Math.min(15, Math.max(6, Math.floor(baseOvr / 7))),
    extraBans: baseOvr >= 92 ? 1 : 0,
    quote: COACH_QUOTES[Math.floor(rand() * COACH_QUOTES.length)],
    avatarSvg: 'coach1'
  };
}

// -------------------------------------------------------------
// MASTER PRO TEAMS GENERATOR (120+ Teams across 5 Global Circuits)
// -------------------------------------------------------------
export function generateProTeamsDatabase(): ProTeam[] {
  const teams: ProTeam[] = [];
  let globalRankCounter = 1;

  // 1. Generate Flagship Real-World Inspired Teams (Rank #1 to #12)
  FLAGSHIP_TEAMS.forEach((flag, idx) => {
    const seed = (idx + 1) * 31415;
    const rand = pseudoRandom(seed);
    const { starters, reserves } = generateTeamRoster(`team_${flag.tag.toLowerCase()}`, flag.baseOvr, flag.rosterNames, seed);
    const coach = generateTeamCoach(`team_${flag.tag.toLowerCase()}`, flag.coachName, flag.coachStyle, flag.baseOvr, seed + 1);

    const wins = 18 - idx;
    const losses = 2 + Math.floor(idx / 2);
    const total = wins + losses;
    const winRate = Math.round((wins / total) * 100);

    const form: ('W' | 'L')[] = [];
    for (let f = 0; f < 5; f++) form.push(rand() > (0.2 + idx * 0.03) ? 'W' : 'L');

    teams.push({
      id: `team_${flag.tag.toLowerCase()}`,
      name: flag.name,
      tag: flag.tag,
      league: flag.league,
      globalRank: globalRankCounter++,
      avgOvr: flag.baseOvr,
      primaryColor: flag.color,
      secondaryColor: flag.secColor,
      coach,
      starters,
      reserves,
      stats: { wins, losses, points: wins * 3, winRate, form },
      playstyle: `${flag.coachStyle} driven macro with ${coach.name}'s strategic masterclass`,
      threatLevel: idx < 4 ? 'World Champion' : 'Elite Contender'
    });
  });

  // 2. Procedurally Generate Remaining 110+ Pro Teams
  const PROCEDURAL_TEAM_PREFIXES = [
    'Thunder', 'Phantom', 'Dynasty', 'Viper', 'Krypton', 'Vortex', 'Solar', 'Lunar', 'Iron',
    'Shadow', 'Apex', 'Titan', 'Rebel', 'Frost', 'Inferno', 'Echo', 'Neon', 'Specter', 'Nova',
    'Riptide', 'Aegis', 'Sovereign', 'Zenith', 'Tempest', 'Horizon', 'Sentinel', 'Valkyrie', 'Rune'
  ];

  const PROCEDURAL_TEAM_SUFFIXES = [
    'Gaming', 'Esports', 'Club', 'Squad', 'Legion', 'Wolves', 'Kings', 'Riders', 'Dragons',
    'Titans', 'Guild', 'Force', 'Vanguard', 'Clan', 'Warriors', 'Phantoms', 'Storm', 'Pride'
  ];

  const STYLES: ('Aggressive Dive' | 'Objective Macro' | 'Scaling Poke' | 'Pick & Burst' | 'Dynamic Adapt')[] = [
    'Aggressive Dive', 'Objective Macro', 'Scaling Poke', 'Pick & Burst', 'Dynamic Adapt'
  ];

  for (let i = 13; i <= 125; i++) {
    const seed = i * 7771;
    const rand = pseudoRandom(seed);
    const league = LEAGUES[i % LEAGUES.length];
    
    // Scale OVR from 92 down to 74 as rank increases
    const baseOvr = Math.max(74, Math.round(92 - (i - 12) * 0.17));
    const prefix = PROCEDURAL_TEAM_PREFIXES[Math.floor(rand() * PROCEDURAL_TEAM_PREFIXES.length)];
    const suffix = PROCEDURAL_TEAM_SUFFIXES[Math.floor(rand() * PROCEDURAL_TEAM_SUFFIXES.length)];
    const name = `${prefix} ${suffix}`;
    const tag = (prefix.slice(0, 2) + suffix.slice(0, 1)).toUpperCase();
    const style = STYLES[Math.floor(rand() * STYLES.length)];
    const coachName = COACH_NAMES[Math.floor(rand() * COACH_NAMES.length)];

    const { starters, reserves } = generateTeamRoster(`team_${i}`, baseOvr, undefined, seed);
    const coach = generateTeamCoach(`team_${i}`, coachName, style, baseOvr, seed + 1);

    const wins = Math.max(1, Math.round(20 - (i * 0.15) + (rand() * 4 - 2)));
    const losses = Math.max(1, Math.round(i * 0.14 + (rand() * 4 - 2)));
    const total = wins + losses;
    const winRate = Math.round((wins / total) * 100);

    const form: ('W' | 'L')[] = [];
    for (let f = 0; f < 5; f++) form.push(rand() > (0.35 + (i * 0.003)) ? 'W' : 'L');

    const threatLevel: ProTeam['threatLevel'] =
      baseOvr >= 93 ? 'World Champion'
      : baseOvr >= 88 ? 'Elite Contender'
      : baseOvr >= 83 ? 'Playoff Contender'
      : baseOvr >= 78 ? 'Dark Horse'
      : 'Rebuilding';

    teams.push({
      id: `team_${i}`,
      name,
      tag,
      league,
      globalRank: globalRankCounter++,
      avgOvr: baseOvr,
      primaryColor: `hsl(${Math.floor(rand() * 360)}, 70%, 45%)`,
      secondaryColor: `hsl(${Math.floor(rand() * 360)}, 85%, 65%)`,
      coach,
      starters,
      reserves,
      stats: { wins, losses, points: wins * 3, winRate, form },
      playstyle: `${style} with ${coach.style} tactical setup`,
      threatLevel
    });
  }

  return teams;
}

// Cached Singleton Database
export const PRO_TEAMS_DATABASE = generateProTeamsDatabase();

export function getProTeamById(id: string): ProTeam | undefined {
  return PRO_TEAMS_DATABASE.find(t => t.id === id);
}

