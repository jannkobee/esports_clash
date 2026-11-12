import type { PlayerCard } from '../types.ts';
import type { FpsPsychology, FpsRoundTactics } from './fpsPersonality.ts';

export type FpsSide = 'attackers' | 'defenders';
export type FpsTeamId = 'blue' | 'red';

export type FpsWeaponCategory = 'sidearm' | 'smg' | 'rifle' | 'sniper' | 'gear' | 'utility';

export type FpsWeaponId =
  | 'sidearm_standard'
  | 'sidearm_heavy'
  | 'smg_tactical'
  | 'rifle_assault'
  | 'rifle_sniper'
  | 'gear_kevlar'
  | 'gear_helmet'
  | 'gear_defuse_kit'
  | 'utility_smoke'
  | 'utility_flash'
  | 'utility_he'
  | 'utility_molotov';

export interface FpsWeaponDef {
  id: FpsWeaponId;
  name: string;
  category: FpsWeaponCategory;
  cost: number;
  killReward: number;
  baseDamage: number;
  headshotMultiplier: number;
  armorPenetration: number; // 0.0 - 1.0
  accuracy: number; // 0.0 - 1.0 baseline
  fireRate: number; // shots per engagement burst
  range: 'close' | 'medium' | 'long';
}

export type FpsMapId = 'breakwater' | 'foundry' | 'old-quarter' | 'red-mesa' | 'northpoint';
export type FpsBombsite = 'A' | 'B';

export interface FpsZone {
  id: string;
  name: string;
  site?: FpsBombsite;
  isSpawn?: FpsSide;
  isChoke?: boolean;
  isSiteArea?: boolean;
  connectedZones: string[];
  coverQuality: number; // 0.0 to 1.0 (reduces incoming damage)
  engagementDistance: 'close' | 'medium' | 'long';
}

export interface FpsMap {
  id: FpsMapId;
  name: string;
  description: string;
  zones: Record<string, FpsZone>;
  attackerSpawnZone: string;
  defenderSpawnZone: string;
  siteAZones: string[];
  siteBZones: string[];
  chokeZones: string[];
  rotationTimes: Record<string, Record<string, number>>; // Estimated seconds between zones
}

export interface FpsPlayerLoadout {
  primaryWeapon?: FpsWeaponId;
  secondaryWeapon: FpsWeaponId;
  armor: number; // 0 - 100
  hasHelmet: boolean;
  hasDefuseKit: boolean;
  hasBomb: boolean;
  utilities: FpsWeaponId[];
}

export interface FpsPlayerState {
  playerId: string;
  name: string;
  card: PlayerCard;
  team: FpsTeamId;
  side: FpsSide;
  hp: number; // 0 - 100
  isAlive: boolean;
  cash: number;
  loadout: FpsPlayerLoadout;
  currentZone: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  plants: number;
  defuses: number;
  tradeKills: number;
  firstBloods: number;
  clutchesWon: number;
  setPiecesInvolved: number;
  headshotKills?: number;
  lastRoundEarlyDeath?: boolean;
  psychology?: FpsPsychology;
  tactics?: FpsRoundTactics;
}

export type SetPieceStrategy =
  | 'set_piece_execute'
  | 'fake_execute'
  | 'fast_rush'
  | 'default_probe'
  | 'eco_save';

export interface SetPieceCall {
  id: string;
  strategy: SetPieceStrategy;
  targetSite: FpsBombsite;
  fakeSite?: FpsBombsite;
  entryChokeZone: string;
  smokeZones: string[];
  flashZones: string[];
  entryFraggerId: string;
  tradeFraggerIds: string[];
  supportFraggerIds: string[];
  confidence: number;
  utilityCount: number;
  callerId?: string;
  decisionReason?: string;
}

export type FpsRoundPhase = 'buy' | 'prep' | 'live' | 'planted' | 'ended';

export type FpsRoundEndReason =
  | 'attackers_eliminated'
  | 'defenders_eliminated'
  | 'device_exploded'
  | 'device_defused'
  | 'time_expired';

export interface FpsRoundResult {
  roundNumber: number;
  winnerTeam: FpsTeamId;
  winnerSide: FpsSide;
  reason: FpsRoundEndReason;
  roundDurationSeconds: number;
  devicePlanted: boolean;
  plantedSite?: FpsBombsite;
  plantedByPlayerId?: string;
  defusedByPlayerId?: string;
  setPieceExecuted: boolean;
  setPieceStrategy?: SetPieceStrategy;
  setPieceSuccessful: boolean;
  blueScoreAfter: number;
  redScoreAfter: number;
  blueCashTotal: number;
  redCashTotal: number;
}

export interface FpsRoundPlayerSnapshot {
  roundNumber: number;
  playerId: string;
  team: FpsTeamId;
  side: FpsSide;
  currentZone: string;
  isAlive: boolean;
  hp: number;
  loadout: FpsPlayerLoadout;
  tactics?: FpsRoundTactics;
}

export type FpsEventType =
  | 'player_moved'
  | 'damage'
  | 'player_eliminated'
  | 'device_exploded'
  | 'bomb_dropped'
  | 'bomb_picked_up'
  | 'round_start'
  | 'buy_phase_complete'
  | 'set_piece_call'
  | 'utility_deployed'
  | 'contact_spotted'
  | 'duel_engagement'
  | 'specialty_activated'
  | 'tactical_decision'
  | 'weapon_recovered'
  | 'kill'
  | 'trade_kill'
  | 'plant_started'
  | 'plant_completed'
  | 'retake_initiated'
  | 'save_equipment'
  | 'defuse_started'
  | 'defuse_completed'
  | 'round_end'
  | 'side_swap'
  | 'overtime_start'
  | 'match_end';

export interface FpsMatchEvent {
  tick: number;
  second: number;
  roundNumber: number;
  type: FpsEventType;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  weaponId?: FpsWeaponId;
  site?: FpsBombsite;
  zone?: string;
  isHeadshot?: boolean;
  damage?: number;
  targetHp?: number;
  targetArmor?: number;
  fromZone?: string;
  specialtyId?: string;
  executionBonus?: number;
  decision?: import('./fpsIdentity.ts').PlayerDecisionResult;
  text: string;
}

export interface FpsPlayerMatchStats {
  playerId: string;
  name: string;
  team: FpsTeamId;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  adr: number;
  headshotRate: number;
  plants: number;
  defuses: number;
  firstBloods: number;
  tradeKills: number;
  clutchesWon: number;
  setPiecesInvolved: number;
}

export interface FpsIdentityExperiment {
  players: Record<string, import('./fpsIdentity.ts').FpsPlayer>;
  teams: Record<FpsTeamId, {coach: import('./fpsIdentity.ts').FpsCoach; plan: import('./fpsIdentity.ts').FpsGameplan; chemistry: import('./fpsIdentity.ts').FpsTeamChemistry; culture?: import('./fpsIdentity.ts').FpsTeamIdentity}>;
}

export interface FpsMatchSettings {
  identityExperiment?: FpsIdentityExperiment;
  maxRounds?: number; // default 30 (MR15)
  overtimeEnabled?: boolean; // default true
  overtimeMaxRounds?: number; // default 6 (MR3)
  startingCash?: number; // default 800
  roundSeconds?: number; // default 115
  bombSeconds?: number; // default 40
}

export interface FpsMatchReport {
  version: 1;
  personalityVersion?: 1;
  simulationVersion?: 2 | 3;
  identityExperiment?: FpsIdentityExperiment;
  identityDevelopment?: FpsIdentityExperiment;
  format: 'MR15_TACTICAL_FPS';
  seed: number;
  mapId: FpsMapId;
  mapName: string;
  totalRounds: number;
  winnerTeam: FpsTeamId | 'draw';
  finalScore: { blue: number; red: number };
  halfScore: { blue: number; red: number };
  secondHalfScore: { blue: number; red: number };
  overtimeScore?: { blue: number; red: number };
  roundResults: FpsRoundResult[];
  roundSnapshots?: FpsRoundPlayerSnapshot[];
  playerStats: Record<string, FpsPlayerMatchStats>;
  events: FpsMatchEvent[];
}
