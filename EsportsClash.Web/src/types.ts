export type CardTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'GOAT';
export type AvatarRole = 'Tank' | 'Mage' | 'Marksman' | 'Support' | 'Fighter' | 'Assassin';
export type CombatRole = AvatarRole;
export type GameOrigin = 'LoL' | 'CS' | 'Dota2' | 'Valorant';
export type TacticalArchetype = 'Aggressive Dive' | 'Objective Macro' | 'Scaling Poke' | 'Pick & Burst' | 'Dynamic Adapt';

export interface PlayerAttributes {
  lan: number; // Mechanics & Micro Skillshots (1-99)
  tf: number;  // 5v5 Teamfight Execution (1-99)
  iq: number;  // Game Sense & Objective Timing (1-99)
  clu: number; // Clutch Factor under Pressure (1-99)
  sta: number; // Stamina & Tilt Resistance (1-99)
  flx: number; // Champion Pool Flexibility (1-99)
}

export interface PlayerCard {
  id: string;
  name: string;
  realName: string;
  origin: GameOrigin;
  role?: AvatarRole;
  preferredRole?: AvatarRole;
  tier: CardTier;
  ovr: number;
  stats: PlayerAttributes;
  personality: string;
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
}

export interface ChampionSkill {
  name: string;
  desc: string;
  cooldown: number;
  damage: number;
  damageType: 'Physical' | 'Magic' | 'True';
  isUlt?: boolean;
}

export interface ChampionKit {
  id: string;
  name: string;
  title: string;
  basis: string;
  primaryRole: AvatarRole;
  secondaryRole?: AvatarRole;
  archetype: string;
  hp: number;
  ad: number;
  armor: number;
  mr: number;
  aspd: number;
  range: number;
  passiveDesc: string;
  skill1: ChampionSkill;
  skill2: ChampionSkill;
  ultimate: ChampionSkill;
  primaryColor: string;
  accentColor: string;
}

export type AvatarKit = ChampionKit;

export interface EvolutionObjective {
  id: string;
  desc: string;
  target: number;
  current: number;
  completed: boolean;
}

export interface EvolutionPlan {
  id: string;
  name: string;
  desc: string;
  maxTier: CardTier;
  maxOvr: number;
  coinCost: number;
  targetTier: CardTier;
  statBoost: Partial<PlayerAttributes>;
  unlockedBadge: string;
  objectives: EvolutionObjective[];
}

export interface Facility {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  cost: number;
  desc: string;
  icon: string;
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
// ARAM ITEMS & WAVE SIMULATION ENGINE TYPES
// ==========================================
export interface ItemDef {
  id: string;
  name: string;
  cost: number;
  tier: 'Starting' | 'Component' | 'Legendary' | 'Mythic';
  icon: string;
  stats: {
    hp?: number;
    ad?: number;
    ap?: number;
    armor?: number;
    mr?: number;
    aspd?: number;
    haste?: number;
    crit?: number;
  };
  passiveName: string;
  passiveDesc: string;
  suitableRoles: CombatRole[];
}

export type MinionType = 'melee' | 'caster' | 'cannon';

export interface LaneMinion {
  id: string;
  team: 'blue' | 'red';
  type: MinionType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  speed: number;
  attackTimer: number;
  goldReward: number;
  xpReward: number;
  isAlive: boolean;
}

export type StructureType = 'outer_tower' | 'inner_tower' | 'nexus_tower' | 'nexus';

export interface LaneStructure {
  id: string;
  team: 'blue' | 'red';
  type: StructureType;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  attackTimer: number;
  isAlive: boolean;
  targetId: string | null;
  armor: number;
}

export interface AramChampionUnit {
  id: string;
  player: PlayerCard;
  champion: ChampionKit;
  team: 'blue' | 'red';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  mana: number;
  shield: number;
  level: number;
  xp: number;
  gold: number;
  items: ItemDef[];
  kills: number;
  deaths: number;
  assists: number;
  cs: number; // Creep Score
  damageDealt: number;
  damageTaken: number;
  isAlive: boolean;
  respawnTimer: number;
  attackTimer: number;
  cd1: number;
  cd2: number;
  cdUlt: number;
  stunTimer: number;
  charmTimer: number;
  facing: 'left' | 'right';
  animState: 'idle' | 'walk' | 'attack' | 'cast' | 'dead';
  animTimer: number;
  isInBush: boolean;
  // Item passives state
  sterakCooldown: number;
  zhonyaActive: boolean;
  zhonyaTimer: number;
  immolateTimer: number;
  krakenCounter: number;
  // Autonomous retreat and recall
  isRecalling?: boolean;
  recallTimer?: number;
}

export interface HealthRelic {
  id: string;
  x: number;
  y: number;
  respawnTimer: number;
  healAmount: number;
}

