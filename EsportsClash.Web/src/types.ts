export type CardTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'GOAT';
export type AvatarRole = 'Tank' | 'Mage' | 'Marksman' | 'Support' | 'Fighter' | 'Assassin';
export type CombatRole = AvatarRole;
export type GameOrigin = 'LoL' | 'CS' | 'Dota2' | 'Valorant';
export type MacroRegion = 'ASIA' | 'EUROPE' | 'AFRICA' | 'AMERICAS';
export type TacticalArchetype = 'Aggressive Dive' | 'Objective Macro' | 'Scaling Poke' | 'Pick & Burst' | 'Dynamic Adapt';

export interface PlayerAttributes {
  lan: number; // Aim & Micro Mechanics (1-99 internal, 1-10 UI)
  tf: number;  // 5v5 Trading & Execution (1-99 internal, 1-10 UI)
  iq: number;  // Game Sense & Objective Timing (1-99 internal, 1-10 UI)
  clu: number; // Clutch Factor under Pressure (1-99 internal, 1-10 UI)
  sta: number; // Stamina & Tilt Resistance (1-99 internal, 1-10 UI)
  flx: number; // Loadout & Role Flexibility (1-99 internal, 1-10 UI)
  ldr?: number; // Leadership & Shotcalling (1-99 internal, 1-10 UI)
}

export interface CoachAttributes {
  tactical: number;         // 1-10: Boosts IQ & Leadership training speed
  mechanical: number;       // 1-10: Boosts Mechanics & Trading training speed
  conditioning: number;     // 1-10: Boosts Clutch, Stamina & Flexibility training speed
  youthDevelopment: number; // 1-10: Extra training speed for players aged <= 20
  motivation: number;       // 1-10: Global training efficiency multiplier
}

export interface PlayerCard {
  presentation?: import('./supporter').PlayerPresentation | null;
  id: string;
  name: string;
  nationality?: {id?:number;code:string;name:string};
  realName: string;
  origin: GameOrigin;
  macroRegion?: MacroRegion;
  role?: AvatarRole;
  preferredRole?: AvatarRole;
  playableRoles?: AvatarRole[]; // All unlocked playable roles from evolution (e.g. ['Mage', 'Support'])
  isEvo?: boolean;              // EA FC style glowing card treatment
  evolutionLevel?: number;      // 0, 1, 2, ...
  evolutionHistory?: string[];  // Completed evolution program names
  tier: CardTier;
  ovr: number;
  stats: PlayerAttributes;
  age?: number;                 // Athlete Age (16-28)
  potentialOvr?: number;        // Potential ceiling (1-99 internal, 1-10 UI)
  wage?: number;                // Weekly wage in coins
  isCaptain?: boolean;          // Team Captain / In-Game Shotcaller
  trainingProgress?: Partial<Record<keyof PlayerAttributes, number>>; // 0-100% progress toward next attribute point
  matchesPlayedThisWeek?: number; // Real games played this week (affects Hattrick training speed)
  lastMatchTrainingGain?: number; // Last training gain % earned from real games/drills
  /** Legacy presentation text; use primaryPersonality / secondaryPersonality for gameplay. */
  personality: string;
  primaryPersonality?: import('./playerPersonality').PersonalityId;
  secondaryPersonality?: import('./playerPersonality').PersonalityId;
  fpsIdentity?: import('./fps/fpsIdentity.ts').FpsScoutingProfile;
  badges: string[];
  signatureChampions: string[];
  morale: number;   // 0-100
  fatigue: number;  // 0-100
  level: number;
  currentXp: number;
  maxXp: number;
  avatarSvg: string;
}

export interface CoachCard {
  id: string;
  name: string;
  realName: string;
  tier: CardTier;
  style: TacticalArchetype;
  chemistryBonus: number;
  playbookBonus: number;
  extraBans: number;
  quote: string;
  avatarSvg: string;
  rating10?: number;
  coachAttributes?: CoachAttributes;
  isConvertedPlayer?: boolean;
  originalPlayerId?: string;
}

export interface TournamentTeam {
  name: string;
  roster: PlayerCard[];
  coach?: CoachCard;
  wins: number;
  losses: number;
  points: number;
  avgOvr: number;
  isPlayer?: boolean;
}

// ==========================================
// HATTRICK-STYLE TRANSFER MARKET & BIDDING
// ==========================================
export interface BidRecord {
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: number;
  isPlayer: boolean;
}

export interface MarketListing {
  id: string;
  player: PlayerCard;
  sellerClubId: string;
  sellerClubName: string;
  askingPrice: number;
  currentBid: number | null;
  highestBidderId: string | null;
  highestBidderName: string | null;
  buyoutPrice: number;
  bidsCount: number;
  deadlineRound: number;
  deadlineTimestamp: number;
  bidHistory: BidRecord[];
  isPlayerListing?: boolean;
}

// ==========================================
// SCOUTING NETWORK & SCOUT ATTRIBUTES
// ==========================================
export interface ScoutCard {
  id: string;
  name: string;
  avatarSvg: string;
  specialtyRegion: 'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers';
  preferredRole: AvatarRole | 'Any';
  weeklySalary: number;
  hiringCost: number;
  // 6 Hattrick-style attributes (1-10 scale)
  judgingAbility: number;    // 1-10: Accuracy of revealed current stats
  judgingPotential: number;  // 1-10: Accuracy of revealed potential ceiling
  regionalKnowledge: number; // 1-10: Discovery rate bonus in specialty region
  roleExpertise: number;     // 1-10: Higher quality prospects found in preferred role
  negotiation: number;       // 1-10: Discount on player signing fee & initial wage
  networkReach: number;      // 1-10: Number of candidate dossiers delivered per batch (2-5)
  assignedRegion?: MacroRegion | 'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers';
  assignedRole?: AvatarRole | 'Any';
  activeMission?: boolean;
}

export interface ScoutReportDossier {
  id: string;
  prospect: PlayerCard;
  scoutId: string;
  scoutName: string;
  region: MacroRegion | 'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers';
  estimatedOvrRange: [number, number];       // e.g. [7, 8] on 1-10 scale
  revealedPotentialRange: [number, number];  // e.g. [9, 10] on 1-10 scale
  signingFee: number;
  weeklyWage: number;
  scoutNotes: string;
  isSigned?: boolean;
  expiresAtRound: number;
}

// ==========================================
// HATTRICK TRAINING SYSTEM
// ==========================================
export type TrainingFocus = 'lan' | 'tf' | 'iq' | 'ldr' | 'clu' | 'sta' | 'flx';

export interface TrainingRegimen {
  primaryFocus: TrainingFocus;
  intensityPercent: number; // 50 - 100%
  staminaSharePercent: number; // 10 - 30%
  individualSpecializations?: Record<string, {
    targetRole?: AvatarRole;
    targetSignature?: string;
    progress: number;
  }>;
}

// ==========================================
// GLOBAL CIRCUIT & SCALING PYRAMID
// ==========================================
export type InternationalEventKey = 'Hexatrick Vanguard Cup' | 'Hexatrick Summit Masters' | 'Hexatrick Crown Championship';

export interface ThirdPartyCup {
  id: string;
  name: string;
  organizer: string;
  tierLabel: 'S-Tier Major' | 'A-Tier Circuit' | 'Open Invitational';
  prizePoolCoins: number;
  inGameRewardLabel: string;
  inGameRewardType: 'training_booster' | 'scout_token' | 'stamina_recovery' | 'trophy_crest';
  status: 'Open' | 'Quarterfinals' | 'Semifinals' | 'Grand Final' | 'Completed';
  currentRound: number;
  maxRounds: number;
  nextOpponentName: string;
  nextOpponentRegion: MacroRegion;
  nextOpponentOvr: number;
  claimed?: boolean;
}

export interface FriendClub {
  id: string;
  managerName: string;
  clubName: string;
  clubTag: string;
  region: MacroRegion;
  avatarSeed: string;
  status: 'online' | 'in_match' | 'offline';
  avgOvr: number;
  divisionLabel: string;
  headToHeadWins: number;
  headToHeadLosses: number;
}

export interface FriendChallenge {
  id: string;
  friendId: string;
  friendName: string;
  clubName: string;
  region: MacroRegion;
  avatarSeed: string;
  avgOvr: number;
  mode: 'Friendly Scrimmage' | 'Showmatch Wager' | 'Best-of-1 Clash';
  wagerCoins: number;
  trainingBonusLabel: string;
  direction: 'incoming' | 'outgoing';
  createdAtLabel: string;
  status: 'pending' | 'accepted' | 'completed';
}

// ==========================================
// HATTRICK SERIES PYRAMID & CLASH CUP
// ==========================================
export type SeriesDivisionTier = 'Series I' | 'Series II' | 'Series III' | 'Series IV';

export interface SeriesTeam {
  id: string;
  name: string;
  isPlayer: boolean;
  avgOvr: number;
  wins: number;
  losses: number;
  points: number;
  kills: number;
  deaths: number;
  towersDestroyed: number;
  form: ('W' | 'L')[];
}

export interface SeriesFixture {
  id: string;
  round: number;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeKills?: number;
  awayKills?: number;
  homeTowers?: number;
  awayTowers?: number;
  winnerId?: string;
  isPlayerMatch?: boolean;
  played: boolean;
}

export interface SeriesDivision {
  tier: SeriesDivisionTier;
  title: string;
  description: string;
  prestigeOvrCap: number; // FFP Max open-market direct signing OVR (e.g. 8 for Series IV, 10 for Series I)
  teams: SeriesTeam[];
  currentRound: number;
  maxRounds: number;
  fixtures: SeriesFixture[];
}

export interface ClashCupMatch {
  id: string;
  stageName: 'Round of 16' | 'Quarterfinals' | 'Semifinals' | 'Grand Final';
  homeTeamName: string;
  awayTeamName: string;
  homeKills?: number;
  awayKills?: number;
  winnerName?: string;
  isPlayerMatch?: boolean;
  played: boolean;
}

export interface ClashCupBracket {
  season: number;
  currentStage: 'Round of 16' | 'Quarterfinals' | 'Semifinals' | 'Grand Final' | 'Concluded';
  matches: ClashCupMatch[];
  champion?: string;
  prizePool: number;
}
