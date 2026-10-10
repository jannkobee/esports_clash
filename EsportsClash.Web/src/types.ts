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
  playableRoles?: AvatarRole[]; // All unlocked playable roles from evolution (e.g. ['Mage', 'Support'])
  isEvo?: boolean;              // EA FC style glowing card treatment
  evolutionLevel?: number;      // 0, 1, 2, ...
  evolutionHistory?: string[];  // Completed evolution program names
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
  targeting?: 'unit' | 'ally' | 'ground' | 'self' | 'none';
}

export type AvatarCombatType = 'Carry' | 'Support' | 'Nuker' | 'Disabler' | 'Jungler' | 'Durable' | 'Escape' | 'Pusher' | 'Initiator';
export type AvatarCombatTypeStrength = 0 | 1 | 2 | 3;

export interface ChampionKit {
  id: string;
  name: string;
  displayName: string;
  title: string;
  basis: string;
  primaryRole: AvatarRole;
  secondaryRole?: AvatarRole;
  archetype: string;
  combatRoles?: Partial<Record<AvatarCombatType, AvatarCombatTypeStrength>>;
  lore?: string;
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
  ovrBoost?: number;
  statBoost: Partial<PlayerAttributes>;
  unlockedBadge: string;
  unlockedRole?: AvatarRole;           // Secondary role unlocked (e.g. Marksman, Support, etc.)
  selectableSignatures?: string[];     // Candidate signatures to add to player's pool
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
    armorPen?: number;
    lethality?: number;
    magicPen?: number;
    lifesteal?: number;
    moveSpeed?: number;
    mana?: number;
    manaRegen?: number;
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
  empowered?: boolean;
  siegeGolem?: boolean;
  siegeChargeCooldown?: number;
  siegeChargeWindup?: number;
  siegeChargeImpactTimer?: number;
  siegeChargeTargetId?: string;
  summonedBearOwnerId?: string;
  summonedBearFocusId?: string;
  facingX?: number;
}

export type StructureType = 'outer_tower' | 'inner_tower' | 'nexus_tower' | 'barracks' | 'nexus';

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
  diveAggressorId?: string;
  diveAggroUntil?: number;
  volleyShotsRemaining?: number;
  barracksKind?: 'melee' | 'ranged' | 'catapult';
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
  hookPull?: import('./combatPacingRules').HookPullState;
  dash?: { kind: 'renn_vault' | 'renn_waltz' | 'renn_rush' | 'kaolin_roll' | 'cinder_lunge' | 'raijin_bolt' | 'canopy_bound'; startX?: number; startY?: number; targetX: number; targetY: number; targetId?: string; remaining: number; speed: number; damage?: number; hitIds?: string[] };
  blackHole?: { x: number; y: number; remaining: number; tick: number };
  corsaraBarrage?: { remaining: number; tick: number; facing: 'left' | 'right' };
  monkeySpin?: { remaining: number; tick: number; hitIds: string[] };
  monkeyCourt?: { x: number; y: number; remaining: number; tick: number };
  silenceTimer?: number;
  forestLink?: { groupId: string; remaining: number };
  paxiOrb?: { x: number; y: number; targetX: number; targetY: number; remaining: number; hitIds: string[] };
  cinderQStage?: 1 | 2;
  cinderQTargetId?: string;
  cinderQExpiresAt?: number;
  cinderIgnitedUntil?: number;
  stealthTimer?: number;
  shield: number;
  level: number;
  xp: number;
  gold: number;
  items: ItemDef[];
  boots?: ItemDef;
  wardReadyAt?: number;
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
  activeAbilitySlot?: 'skill1' | 'skill2' | 'ultimate';
  stunTimer: number;
  charmTimer: number;
  charmSourceId?: string;
  fearTimer?: number;
  fearSourceId?: string;
  knockupTimer?: number;
  knockupMax?: number;
  untargetableTimer?: number;
  facing: 'left' | 'right';
  animState: 'idle' | 'walk' | 'attack' | 'cast' | 'dead';
  animTimer: number;
  isInBush: boolean;
  kaelenOrbs?: ('ice' | 'wind' | 'fire')[];
  kaelenOrbCursor?: number;
  kaelenInvokedSlots?: string[];
  kaelenInvokeCooldown?: number;
  kaelenSpellCooldowns?: Record<string, number>;
  aetherisOrbs?: { charges: number; remaining: number };
  aetherisOverchargeTimer?: number;
  aetherisOverchargeSourceId?: string;
  propellaRotorStacks?: number;
  propellaRotorTimer?: number;
  propellaOverdriveTimer?: number;
  propellaGunshipTimer?: number;
  // Item passives state
  sterakCooldown: number;
  zhonyaActive: boolean;
  zhonyaTimer: number;
  zhonyaRemaining?: number;
  lastEnemyDamage?: { attackerId: string; second: number };
  immolateTimer: number;
  krakenCounter: number;
  combatTimer?: number;
  trueFormTimer?: number;
  grievousTimer?: number;
  // Autonomous retreat, recall & vision
  isRecalling?: boolean;
  recallTimer?: number;
  recallCooldown?: number;
  currentBushId?: string;
  revealedTimer?: number;
  comboPractice?: number;
  comboMastered?: boolean;
  comboStage?: 0 | 1 | 2;
  comboTargetId?: string;
  comboExpiresAt?: number;
  comboHitConfirmed?: boolean;
  teamChemistry?: number;
  // PlayStyle unique trait runtime combat states
  clutchCommitActive?: boolean;
  traitFocusId?: string;
  iceFocusTimer?: number;
  clutchCommitTimer?: number;
  shotcallSignalTimer?: number;
  traitFloatTimer?: number;
  followUpEngageSignaled?: boolean;
  decisionCommitTimer?: number;
  committedState?: 'fight' | 'retreat' | 'cover';
  supportHealTimer?: number;
  locketCooldown?: number;
  censerBuffTimer?: number;
  diveTimer?: number;
  diveAborting?: boolean;
  diveAbortCooldown?: number;
  diveTargetId?: string;
}

export interface BushPatch {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HealthRelic {
  id: string;
  x: number;
  y: number;
  respawnTimer: number;
  healAmount: number;
}
