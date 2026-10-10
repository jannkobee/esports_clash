import React, { useEffect, useRef, useState } from 'react';
import { 
  AramChampionUnit, 
  ChampionKit, 
  CoachCard, 
  HealthRelic, 
  ItemDef, 
  LaneMinion, 
  LaneStructure, 
  PlayerCard 
} from '../types';
import { ALL_ITEMS, BOOTS, getRecommendedItem } from '../itemsData';
import { getItemPurchasePlan } from '../itemStrategy';
import { aimAtCast, dodgeProbability, segmentHitsCircle } from '../skillshotRules';
import { advanceHookPull, calculateDeathTimer } from '../combatPacingRules';
import { AVATAR_COMBOS, comboPracticeNeeded } from '../avatarCombos';
import { getTeamKillScore, getTeamTotalGold, getTowersAliveCount, getTeamNames } from '../scoreboardRules';
import { nextMultikillCount } from '../multikillRules';
import { shouldStartEpicObjective, shouldContestOpponentObjective, hasObjectiveVision,
  objectiveFightPreference, chooseObjectiveAction, choosePostObjectiveAction } from '../objectiveRules';
import {
  hasPlayerTrait,
  canAggroDive,
  shouldHoldClutchFight,
  shouldLaningDemonClearWave,
  shouldBaitEnemySkill
} from '../playerTraits';
import {
  evaluateTowerDive,
  shouldAbortTowerDive,
  getTurretEvacuationVector,
  isBushSafeFromTowers,
  getTurretPerimeterHoldPoint
} from '../towerDiveRules';
import { CAMP_PATIENCE_SECONDS, neutralCampRespawnSeconds, stepCampPatience, stepLeashedMonster } from '../neutralAggroRules';
import { consumeFixedSteps, createMatchRandom, resolveNeutralKillCredit, resolveTurretKillReward, SIMULATION_STEP, summarizeMatchReports, type MatchReport, type RecordedMatchEvent } from '../matchReplay';
import { matchEconomyPhase, passiveGoldPerSecond } from '../economyRules';
import { abilityDamageMultiplier, abilityCooldownMultiplier, abilityRank, type AbilitySlot } from '../skillProgression';
import { maxMana, manaRegen, skill1ManaCost, ultimateManaCost, ultimateBaseCooldown } from '../abilityRules';
import { drawChampionSprite, drawSpiritBearSprite } from './ChampionSpriteRenderer';
import { creatureAttackPose, creatureFacingScale, faceTargetLikeAvatar } from '../creatureAnimation';
import { drawAvatarSkillAnimation, type SkillSlot } from '../avatarSkillAnimation';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { chooseTeamfightTarget, isChannelingAbility, isEnemyCaughtInAlliedChannel, isUnitVisibleTo, shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from '../combatDecision';
import { createEnemyCooldownMemory, isObservedCooling, observeCooldownRise, type CooldownSnapshot } from '../cooldownKnowledge';
import { getSkillCastRange, isCrowdControlSkill, applyChainStun, HEX_SIZE } from '../skillRangeRules';
import { ARENA_WIDTH, BARRACKS_X, CAMP_ROCK_RINGS, DRAGON_SPAWN_SECOND, DRAGON_X, LANE_Y, NEXUS_X, NEXUS_TOWER_X, ROCK_TERRAIN, WELL_X, STRUCTURE_HP, nextNexusVolleyShot, selectNexusTargets, selectTurretTarget, turretShotDamage, resolveRockTerrainMovement, rockApproachWaypoint, isMinionEmpowered, waveStats, ARAM_BUSHES, getBushAt, canUnitRecall, towerSiegeMultiplier, canDamageNexus } from '../arenaRules';
import { getMinionCrashMultiplier, getMinionStructureDamage, shouldPrioritizeWaveClear, shouldCastWaveClearSkill } from '../waveClearRules';
import { createRatedAvatar } from '../playerCardPower';
import { campAnimation } from '../campAnimation';
import { GOLEM_CHARGE_DAMAGE, GOLEM_SPAWN_SECOND, selectGolemChargeTower, shouldAwakenGolem } from '../siegeGolemRules';
import { chooseKnownJungleCamp, neutralAttackRange, shouldFocusExposedNexus, shouldPressWonFight } from '../macroFarmRules';
import { BLACK_HOLE_RADIUS, shouldSpreadForBlackHole, threatensBlackHole } from '../blackHoleCounterplay';
import { shouldRetreatLosingFight } from '../fightSurvivalRules';
import { laneAdvanceLimit, shouldFollowUpControl, shouldPushWithWave, shouldSeekHealthRelic, wouldOverstep } from '../teamTempoRules';
import { shouldPaxiEscapeJaunt } from '../paxiDecision';
import { getGroundTargetPoint } from '../groundTargetRules';
import { aetherisUltimateDurationAtRank, findAetherisInnateAlly } from '../aetherisAbilities';
import {
  appendKaelenInvokedSpell,
  appendKaelenOrb,
  getKaelenInvokedSpell,
  kaelenOrbCounts,
  KAELEN_INVOKED_SPELLS,
  kaelenInvokeCooldownAtLevel,
  kaelenOrbStatBonuses,
  type KaelenElement
} from '../kaelenAbilities';
import { addInsightEvent, createMatchInsights, recordAbilityCast, recordBlackHoleInterrupt,
  recordManaBlock, recordPaxiJaunt, recordSkillshot } from '../matchInspector';
import { getAvatarCombatProfile } from '../avatarCombatRoles';
import { 
  Play, 
  Pause, 
  Swords, 
  Shield, 
  Zap, 
  Coins, 
  Trophy, 
  Info, 
  X, 
  Sparkles,
  ArrowRight,
  Crosshair,
  TrendingUp,
  Skull,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  speed: number;
  color: string;
  type: 'arrow' | 'ult_arrow' | 'orb' | 'pellet' | 'laser' | 'turret_shot' | 'minion_shot' | 'boss_breath'
    | 'jungle_shot'
    | 'tornado' | 'shuriken' | 'feather' | 'nature_bolt' | 'boulder' | 'spirit_arrow' | 'poison_dart' | 'electric_spark' | 'seed_shot' | 'hook';
  size: number;
  targetUnitId?: string;
  damage: number;
  attackerId: string;
  angle: number;
  skillshot?: boolean;
  countedShot?: boolean;
  dodgeAttempted?: boolean;
  stunOnHit?: number;
  charmOnHit?: number;
  splashRadius?: number;
  healAlliesOnHit?: number;
  hookOnHit?: boolean;
  trueDamage?: boolean;
  skillLabel?: string;
  abilitySlot?: AbilitySlot;
  collisionRadius?: number;
  comboStage?: 1 | 2;
  aetherisOrb?: boolean;
}

interface SpellAOE {
  id: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  color: string;
  sourceUnitId?: string;
  targetUnitId?: string;
  extraText?: string;
  sourceX?: number;
  sourceY?: number;
  avatarName?: string;
  abilitySlot?: SkillSlot;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  scale: number;
}

interface MatchEvent {
  id: string;
  text: string;
  type: 'kill' | 'execution' | 'tower' | 'item' | 'level' | 'combo' | 'micro' | 'fountain' | 'dragon' | 'jungle';
  time: string;
}

interface ItemMilestone {
  playerName: string;
  champName: string;
  itemName: string;
  itemIcon: string;
  time: string;
  stats: string;
  team: 'blue' | 'red';
}

// Jungle Monster Entity for Level & Gold Farming
interface JungleCamp {
  id: string;
  name: string;
  type: 'golem' | 'wolves' | 'behemoth' | 'drakes' | 'blue_buff' | 'red_buff' | 'siege_golem';
  x: number;
  y: number;
  homeX?: number;
  homeY?: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  goldReward: number;
  xpReward: number;
  respawnTimer: number;
  isAlive: boolean;
  attackTimer: number;
  hurtTimer?: number;
  facingX?: number;
  targetId?: string;
  claimTeam?: 'blue' | 'red';
  patience?: number;
  resetElapsed?: number;
  color: string;
}

// Epic Boss: Embermaw Dragon Pit at Top of Map
interface DragonBoss {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  attackTimer: number;
  slamTimer: number;
  slamWindup?: number;
  isAlive: boolean;
  spawnTimer: number;
  slayerTeam: 'blue' | 'red' | null;
  slainCount: number;
  aggroTeam?: 'blue' | 'red' | null;
  claimTeam?: 'blue' | 'red';
  targetId?: string;
}

interface AegisBuff {
  team: 'blue' | 'red';
  expiresAt: number;
  adBonus: number;
  apBonus: number;
  siegeMultiplier: number;
  burnTrueDamage: boolean;
}

export interface KillCallout {
  id: string;
  killerName: string;
  killerChamp: string;
  killerTeam: 'blue' | 'red';
  killerAvatar?: string;
  neutralFinisher?: string;
  victimName: string;
  victimChamp: string;
  victimTeam: 'blue' | 'red';
  victimAvatar?: string;
  multiKill?: 'DOUBLE KILL' | 'TRIPLE KILL' | 'QUADRA KILL' | 'PENTA KILL' | null;
  streakText?: string | null;
  isFirstBlood?: boolean;
}

interface AramMatchViewProps {
  seed: number;
  onlineMode?: boolean;
  onReplay: () => void;
  batchMode?: boolean;
  batchId?: number;
  batchNumber?: number;
  onBatchStart: () => void;
  onBatchStop: () => void;
  blueLineup: { player: PlayerCard; champion: ChampionKit }[];
  redLineup: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  blueTeamName?: string;
  redTeamName?: string;
  opponentName?: string;
  onMatchComplete: (winner: 'blue' | 'red', mvp: any, stats: any[]) => void;
}

// XP Threshold curve for Levels 3 to 18
function getXpThreshold(lvl: number): number {
  const table: { [key: number]: number } = {
    3: 0,
    4: 180,
    5: 380,
    6: 640,
    7: 960,
    8: 1350,
    9: 1800,
    10: 2320,
    11: 2920,
    12: 3600,
    13: 4360,
    14: 5200,
    15: 6120,
    16: 7120,
    17: 8200,
    18: 9380
  };
  return table[lvl] || 99999;
}

function getChampionAttackRange(champName: string): number {
  switch (champName) {
    case 'Solenne': return 205;
    case 'Aetherbolt': return 205;
    case 'Corsara': return 190;
    case 'Nullweaver': return 175;
    case 'Faelith': return 180;
    case 'Oathmute': return 185;
    case 'Cloudtail': return 58;
    case 'Stonebranch': return 62;
    case 'Wraithhook': return 140;
    case 'Voltgrip': return 62;
    case 'Mirehook': return 58;
    case 'Brewmaw': return 60;
    case 'Soulscourge': return 180;
    case 'Cinderbloom':
    case 'Cinderlock': return 50;
    case 'Croakwell': return 65;
    case 'Astra': return 195;
    case 'Tequoia': return 190;
    case 'Kindra':
    case 'Kindra & Grim': return 185;
    case 'Cora': return 180;
    case 'Zal': return 170;
    case 'Raijin': return 165;
    case 'Kyumi': return 145;
    case 'Sylla': return 130;
    case 'Buck': return 95;
    case 'Renn': return 65;
    case 'Kazemaru': return 55;
    case 'Inai': return 55;
    case 'Kage': return 50;
    case 'Xin': return 50;
    case 'Kaolin': return 50;
    case 'Valkira': return 50;
    case 'Solana': return 40;
    default: return 55;
  }
}

function setUnitFacing(unit: AramChampionUnit, targetX: number, deadband = 12) {
  const dx = targetX - unit.x;
  if (Math.abs(dx) > deadband) {
    unit.facing = dx > 0 ? 'right' : 'left';
  }
}

const getKaelenOrbBonuses = (unit: AramChampionUnit) =>
  kaelenOrbStatBonuses(unit.level, kaelenOrbCounts(unit.kaelenOrbs ?? []));

const PROJECTILE_SKILL1_CHAMPIONS = new Set([
  'Astra', 'Kyumi', 'Kage', 'Kazemaru', 'Kindra', 'Kindra & Grim', 'Cora', 'Kaolin', 'Veyara', 'Cinderbloom', 'Cinderlock',
  'Mirehook', 'Nullweaver', 'Voltgrip', 'Aetherbolt', 'Corsara', 'Brewmaw', 'Wraithhook',
  'Kaelen', 'Hweilin', 'Jaxon', 'Valerie', 'Jinxy', 'Paxi', 'Batrix', 'Quillback', 'Aetheris'
]);

function getChampionFormationY(champName: string, idx: number): number {
  switch (champName) {
    case 'Solana':
    case 'Kaolin': return 380;
    case 'Valkira':
    case 'Kazemaru':
    case 'Xin': return 420;
    case 'Buck':
    case 'Sylla':
    case 'Renn': return 340;
    case 'Kyumi':
    case 'Raijin':
    case 'Tequoia':
    case 'Zal': return 365;
    case 'Astra':
    case 'Cora':
    case 'Kindra':
    case 'Kindra & Grim': return 400;
    case 'Kage':
    case 'Inai': return 350;
    default: return 350 + (idx % 5) * 20;
  }
}

export const AramMatchView: React.FC<AramMatchViewProps> = ({
  seed,
  onlineMode = false,
  onReplay,
  batchMode = false,
  batchId = 0,
  batchNumber = 0,
  onBatchStart,
  onBatchStop,
  blueLineup,
  redLineup,
  blueCoach,
  redCoach,
  blueTeamName,
  redTeamName,
  opponentName,
  onMatchComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchRootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [matchTime, setMatchTime] = useState<number>(0);
  const matchTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const randomRef = useRef(createMatchRandom(seed));
  const random = () => randomRef.current();
  const recordedEventsRef = useRef<RecordedMatchEvent[]>([]);
  const insightsRef = useRef(createMatchInsights());
  const [showInsights, setShowInsights] = useState(false);
  const [insightAt, setInsightAt] = useState<number | null>(null);
  const objectiveCallsRef = useRef(new Set<string>());
  const cooldownMemoryRef = useRef(createEnemyCooldownMemory());
  const cooldownSnapshotsRef = useRef<Record<string, CooldownSnapshot>>({});
  const postObjectivePlanRef = useRef<Partial<Record<'blue' | 'red', {
    x: number; y: number; startedAt: number; until: number; action: 'fight' | 'regroup';
  }>>>({});
  const skillshotsRef = useRef({ fired: 0, hit: 0 });
  const fullBuildsAt15Ref = useRef(0);
  const itemCountsRef = useRef<Partial<Record<8 | 10 | 12 | 13, number[]>>>({});
  const matchFinishedRef = useRef(false);
  const latestReportRef = useRef<MatchReport | null>(null);
  const [balanceSummary, setBalanceSummary] = useState<ReturnType<typeof summarizeMatchReports> | null>(() => {
    try {
      const all = JSON.parse(localStorage.getItem('esports-clash-match-reports') || '[]') as MatchReport[];
      const reports = batchId ? all.filter(report => report.batchId === batchId) : all;
      return reports.length ? summarizeMatchReports(reports) : null;
    } catch { return null; }
  });
  const downloadMatchReport = () => {
    if (!latestReportRef.current) return;
    const blob = new Blob([JSON.stringify(latestReportRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esports-clash-${seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const downloadBalanceReport = () => {
    try {
      const all = JSON.parse(localStorage.getItem('esports-clash-match-reports') || '[]') as MatchReport[];
      const reports = batchId ? all.filter(report => report.batchId === batchId) : all;
      const blob = new Blob([JSON.stringify({ summary: summarizeMatchReports(reports), reports }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `esports-clash-balance-${batchId || 'history'}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { /* Local storage may be disabled; individual match export remains available. */ }
  };
  const [matchOver, setMatchOver] = useState<boolean>(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === matchRootRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      setFullscreenError(false);
      if (document.fullscreenElement === matchRootRef.current) await document.exitFullscreen();
      else await matchRootRef.current?.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  };

  // Event feed & Power Spike banners
  const [eventFeed, setEventFeed] = useState<MatchEvent[]>([]);
  const [activeBanner, setActiveBanner] = useState<{ text: string; subtext: string; icon: string } | null>(null);
  const [killCallout, setKillCallout] = useState<KillCallout | null>(null);
  const [recentKills, setRecentKills] = useState<KillCallout[]>([]);
  const [itemMilestones, setItemMilestones] = useState<ItemMilestone[]>([]);

  // Multikill & First Blood Tracking Refs
  const firstBloodRef = useRef<boolean>(false);
  const killStreaksRef = useRef<{ [champId: string]: { count: number; lastTime: number; multiCount: number } }>({});


  // Selected item modal for inspection
  const [inspectedItem, setInspectedItem] = useState<ItemDef | null>(null);

  // Units State for UI bottom bar
  const [champions, setChampions] = useState<AramChampionUnit[]>([]);

  // In-Game Squad HUD view mode: 'expanded' (tactical overlay) | 'compact' (broadcast strip) | 'docked' (docked in arena) | 'hidden' (minimized)
  const [hudMode, setHudMode] = useState<'docked' | 'hidden'>('docked');

  // Universal hotkey: Tab toggles in-game scoreboard HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setHudMode((prev) => (prev === 'hidden' ? 'docked' : 'hidden'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Simulation Refs
  const championsRef = useRef<AramChampionUnit[]>([]);
  const minionsRef = useRef<LaneMinion[]>([]);
  const structuresRef = useRef<LaneStructure[]>([]);
  const relicsRef = useRef<HealthRelic[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const spellsRef = useRef<SpellAOE[]>([]);
  const floatsRef = useRef<FloatingText[]>([]);
  const waveTimerRef = useRef<number>(2.0);
  const waveCountRef = useRef<number>(0);
  const pendingSiegeGolemRef = useRef<Partial<Record<'blue' | 'red', true>>>({});
  const golemAwakenedRef = useRef(false);
  const lastTeamKillAtRef = useRef({ blue: -Infinity, red: -Infinity });
  const wardsRef = useRef<{ id: string; team: 'blue' | 'red'; bushId: string; x: number; y: number; expiresAt: number }[]>([]);
  const jungleBuffsRef = useRef<{ blue: { blue: number; red: number }; red: { blue: number; red: number } }>({
    blue: { blue: 0, red: 0 }, red: { blue: 0, red: 0 }
  });

  // Epic Dragon Boss Ref (Contestable objective that unlocks decisive game-ending buffs)
  const dragonRef = useRef<DragonBoss>({
    id: 'dragon_boss',
    name: 'Embermaw, the Ancient Dragon',
    x: DRAGON_X,
    y: 130,
    hp: 5200,
    maxHp: 5200,
    ad: 120,
    range: 230,
    attackTimer: 0,
    slamTimer: 6.0,
    isAlive: false,
    spawnTimer: DRAGON_SPAWN_SECOND,
    slayerTeam: null,
    slainCount: 0
  });

  // 4 Neutral Jungle Camps across the map
  const jungleCampsRef = useRef<JungleCamp[]>([
    { id: 'j_blue_golem', name: 'Frost Sentinel', type: 'golem', x: 576, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_wolves', name: 'Shadow Stalkers', type: 'wolves', x: 1424, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#a855f7' },
    { id: 'j_blue_behemoth', name: 'Murk Behemoth', type: 'behemoth', x: 667, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#10b981' },
    { id: 'j_red_drakes', name: 'Crimson Drakes', type: 'drakes', x: 1333, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#ef4444' },
    { id: 'j_blue_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 380, y: 145, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_blue_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 485, y: 600, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#fb7185' },
    { id: 'j_red_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 1620, y: 145, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 1515, y: 600, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#fb7185' },
    { id: 'j_siege_golem', name: 'Gravemarch Colossus', type: 'siege_golem', x: 1000, y: 610,
      hp: 6200, maxHp: 6200, ad: 135, range: 230, goldReward: 250, xpReward: 300,
      respawnTimer: 0, isAlive: false, attackTimer: 0, color: '#d4a764' }
  ]);

  const aegisBuffRef = useRef<AegisBuff | null>(null);

  const showBanner = (text: string, subtext: string, icon: string) => {
    setActiveBanner({ text, subtext, icon });
    setTimeout(() => {
      setActiveBanner((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  const addEvent = (text: string, type: MatchEvent['type']) => {
    const mins = Math.floor(matchTimeRef.current / 60);
    const secs = (Math.floor(matchTimeRef.current % 60)).toString().padStart(2, '0');
    recordedEventsRef.current.push({ second: Math.round(matchTimeRef.current * 100) / 100, type, text });
    if ((type === 'dragon' || type === 'jungle') && /called|committed|chose|focus|regroup/i.test(text)) {
      addInsightEvent(insightsRef.current, { second: matchTimeRef.current, kind: 'decision', text });
    }
    setEventFeed((prev) => [
      { id: random().toString(), text, type, time: `${mins}:${secs}` },
      ...prev.slice(0, 18)
    ]);
  };

  // Helper: Initial item purchase (Buys Starter 500g + 1st Component 700-1000g right at match start!)
  const buyInitialLoadout = (role: any, startingGold: number, champName?: string): { items: ItemDef[]; remainingGold: number } => {
    const items: ItemDef[] = [];
    let g = startingGold;
    // 1. Buy Starter item (500g)
    const starter = getRecommendedItem(role, [], g, champName);
    if (starter) {
      items.push(starter);
      g -= starter.cost;
    }
    // 2. Buy initial component (700-1000g) with remaining gold
    const comp = getRecommendedItem(role, items.map((it) => it.id), g, champName);
    if (comp) {
      items.push(comp);
      g -= comp.cost;
    }
    return { items, remainingGold: g };
  };

  // Initialize Structures, Relics, and Champions
  useEffect(() => {
    // Three spaced turrets, three destructible barracks, and a nexus per side.
    const makeBarracks = (team: 'blue' | 'red'): LaneStructure[] =>
      (['melee', 'ranged', 'catapult'] as const).map((kind, index) => ({
        id: `${team === 'blue' ? 'b' : 'r'}_${kind}_barracks`,
        team,
        type: 'barracks',
        barracksKind: kind,
        name: `${team === 'blue' ? 'Blue' : 'Red'} ${kind === 'ranged' ? 'Ranged' : kind === 'catapult' ? 'Catapult' : 'Melee'} Barracks`,
        x: BARRACKS_X[team], y: 305 + index * 75,
        hp: STRUCTURE_HP.barracks, maxHp: STRUCTURE_HP.barracks, ad: 0, range: 0, attackTimer: 0,
        isAlive: true, targetId: null, armor: 20
      }));
    const initialStructures: LaneStructure[] = [
      { id: 'b_t1', team: 'blue', type: 'outer_tower', name: 'Blue Outer Turret', x: 790, y: LANE_Y, hp: STRUCTURE_HP.outer_tower, maxHp: STRUCTURE_HP.outer_tower, ad: 160, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 25 },
      { id: 'b_t2', team: 'blue', type: 'inner_tower', name: 'Blue Inner Turret', x: 590, y: LANE_Y, hp: STRUCTURE_HP.inner_tower, maxHp: STRUCTURE_HP.inner_tower, ad: 190, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 30 },
      { id: 'b_t3', team: 'blue', type: 'nexus_tower', name: 'Blue Nexus Turret', x: NEXUS_TOWER_X.blue, y: LANE_Y, hp: STRUCTURE_HP.nexus_tower, maxHp: STRUCTURE_HP.nexus_tower, ad: 220, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 35 },
      ...makeBarracks('blue'),
      { id: 'b_nexus', team: 'blue', type: 'nexus', name: 'Blue Nexus', x: NEXUS_X.blue, y: LANE_Y, hp: STRUCTURE_HP.nexus, maxHp: STRUCTURE_HP.nexus, ad: 85, range: 190, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
      { id: 'r_t1', team: 'red', type: 'outer_tower', name: 'Red Outer Turret', x: 1210, y: LANE_Y, hp: STRUCTURE_HP.outer_tower, maxHp: STRUCTURE_HP.outer_tower, ad: 160, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 25 },
      { id: 'r_t2', team: 'red', type: 'inner_tower', name: 'Red Inner Turret', x: 1410, y: LANE_Y, hp: STRUCTURE_HP.inner_tower, maxHp: STRUCTURE_HP.inner_tower, ad: 190, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 30 },
      { id: 'r_t3', team: 'red', type: 'nexus_tower', name: 'Red Nexus Turret', x: NEXUS_TOWER_X.red, y: LANE_Y, hp: STRUCTURE_HP.nexus_tower, maxHp: STRUCTURE_HP.nexus_tower, ad: 220, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 35 },
      ...makeBarracks('red'),
      { id: 'r_nexus', team: 'red', type: 'nexus', name: 'Red Nexus', x: NEXUS_X.red, y: LANE_Y, hp: STRUCTURE_HP.nexus, maxHp: STRUCTURE_HP.nexus, ad: 85, range: 190, attackTimer: 0, isAlive: true, targetId: null, armor: 40 }
    ];
    structuresRef.current = initialStructures;

    // 2. Health & Mana Relics on Bridge & Lower Valley
    relicsRef.current = [
      { id: 'relic_top', x: 795, y: 295, respawnTimer: 0, healAmount: 260 },
      { id: 'relic_bot', x: 1205, y: 465, respawnTimer: 0, healAmount: 260 },
      { id: 'relic_river', x: DRAGON_X, y: 590, respawnTimer: 0, healAmount: 320 }
    ];

    // 3. Champions Initial Setup
    const initChamps: AramChampionUnit[] = [];

    blueLineup.forEach((item, idx) => {
      const loadout = buyInitialLoadout(item.champion.primaryRole, 1500, item.champion.name);
      const champCopy = createRatedAvatar(item.player, item.champion);
      let bonusHp = 0;
      loadout.items.forEach((it) => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      initChamps.push({
        id: `blue_${item.player.id}`,
        player: item.player,
        champion: champCopy,
        team: 'blue',
        teamChemistry: blueCoach?.chemistryBonus ?? 10,
        x: WELL_X.blue + (idx % 2) * 20,
        y: getChampionFormationY(item.champion.name, idx),
        vx: 0,
        vy: 0,
        hp: champCopy.hp + bonusHp,
        maxHp: champCopy.hp + bonusHp,
        mana: 100,
        shield: 0,
        level: 3,
        xp: 0,
        gold: loadout.remainingGold,
        items: loadout.items,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        damageDealt: 0,
        damageTaken: 0,
        isAlive: true,
        respawnTimer: 0,
        attackTimer: 0,
        cd1: 0,
        cd2: 0,
        cdUlt: item.champion.name === 'Kaelen' ? 0 : 999,
        stunTimer: 0,
        charmTimer: 0,
        facing: 'right',
        animState: 'idle',
        animTimer: 0,
        isInBush: false,
        sterakCooldown: 0,
        zhonyaActive: false,
        zhonyaTimer: 0,
        immolateTimer: 0,
        krakenCounter: 0,
        isRecalling: false,
        recallTimer: 0,
        kaelenOrbs: item.champion.name === 'Kaelen' ? [] : undefined,
        kaelenOrbCursor: item.champion.name === 'Kaelen' ? 0 : undefined,
        kaelenInvokedSlots: item.champion.name === 'Kaelen' ? [] : undefined,
        kaelenInvokeCooldown: item.champion.name === 'Kaelen' ? 0 : undefined,
        kaelenSpellCooldowns: item.champion.name === 'Kaelen' ? {} : undefined
      });
    });

    redLineup.forEach((item, idx) => {
      const loadout = buyInitialLoadout(item.champion.primaryRole, 1500, item.champion.name);
      const champCopy = createRatedAvatar(item.player, item.champion);
      let bonusHp = 0;
      loadout.items.forEach((it) => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      initChamps.push({
        id: `red_${item.player.id}`,
        player: item.player,
        champion: champCopy,
        team: 'red',
        teamChemistry: redCoach?.chemistryBonus ?? 10,
        x: WELL_X.red - (idx % 2) * 20,
        y: getChampionFormationY(item.champion.name, idx),
        vx: 0,
        vy: 0,
        hp: champCopy.hp + bonusHp,
        maxHp: champCopy.hp + bonusHp,
        mana: 100,
        shield: 0,
        level: 3,
        xp: 0,
        gold: loadout.remainingGold,
        items: loadout.items,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        damageDealt: 0,
        damageTaken: 0,
        isAlive: true,
        respawnTimer: 0,
        attackTimer: 0,
        cd1: 0,
        cd2: 0,
        cdUlt: item.champion.name === 'Kaelen' ? 0 : 999,
        stunTimer: 0,
        charmTimer: 0,
        facing: 'left',
        animState: 'idle',
        animTimer: 0,
        isInBush: false,
        sterakCooldown: 0,
        zhonyaActive: false,
        zhonyaTimer: 0,
        immolateTimer: 0,
        krakenCounter: 0,
        isRecalling: false,
        recallTimer: 0,
        kaelenOrbs: item.champion.name === 'Kaelen' ? [] : undefined,
        kaelenOrbCursor: item.champion.name === 'Kaelen' ? 0 : undefined,
        kaelenInvokedSlots: item.champion.name === 'Kaelen' ? [] : undefined,
        kaelenInvokeCooldown: item.champion.name === 'Kaelen' ? 0 : undefined,
        kaelenSpellCooldowns: item.champion.name === 'Kaelen' ? {} : undefined
      });
    });

    championsRef.current = initChamps;
    cooldownMemoryRef.current = createEnemyCooldownMemory();
    cooldownSnapshotsRef.current = {};
    postObjectivePlanRef.current = {};
    pendingSiegeGolemRef.current = {};
    golemAwakenedRef.current = false;
    lastTeamKillAtRef.current = { blue: -Infinity, red: -Infinity };
    setChampions(initChamps);
  }, [blueLineup, redLineup]);

  // Destroying an enemy barracks upgrades the matching class in future waves.
  const spawnMinionWave = () => {
    waveCountRef.current++;
    const newMinions: LaneMinion[] = [];
    (['blue', 'red'] as const).forEach((team) => {
      const direction = team === 'blue' ? 1 : -1;
      const prefix = team === 'blue' ? 'b' : 'r';
      const spawnX = BARRACKS_X[team] + direction * 42;
      const addMinion = (type: LaneMinion['type'], index: number, x: number, y: number) => {
        const empowered = isMinionEmpowered(team, type, structuresRef.current);
        const stats = waveStats(type, empowered);
        newMinions.push({
          id: `${prefix}_${type}_${waveCountRef.current}_${index}`,
          team, type, x, y,
          ...stats,
          maxHp: stats.hp,
          attackTimer: 0,
          isAlive: true,
          empowered
        });
      };
      for (let i = 0; i < 3; i++) {
        addMinion('melee', i, spawnX + direction * (20 + i * 16), 350 + i * 15);
        addMinion('caster', i, spawnX - direction * (16 + i * 16), 365 + i * 15);
      }
      if (waveCountRef.current % 3 === 0 || isMinionEmpowered(team, 'cannon', structuresRef.current)) {
        addMinion('cannon', 0, spawnX - direction * 38, 430);
      }
      if (pendingSiegeGolemRef.current[team]) {
        newMinions.push({
          id: `siege_golem_${team}_${waveCountRef.current}`, team, type: 'melee', siegeGolem: true,
          x: spawnX - direction * 55, y: LANE_Y,
          hp: 3200, maxHp: 3200, ad: 110, range: 75, speed: 86,
          attackTimer: 0, goldReward: 110, xpReward: 130, isAlive: true,
          siegeChargeCooldown: 2.5, siegeChargeWindup: 0
        });
        delete pendingSiegeGolemRef.current[team];
        addEvent(`${team.toUpperCase()} Gravemarch Colossus joins this creep wave!`, 'jungle');
      }
    });
    minionsRef.current = [...minionsRef.current, ...newMinions];
  };

  // Grant Champion XP & Level Spike Announcer
  const grantChampionXp = (u: AramChampionUnit, amount: number) => {
    if (u.level >= 18) return;

    u.xp += amount;
    const needed = getXpThreshold(u.level + 1);

    if (u.xp >= needed && u.level < 18) {
      const previousSkill1 = abilityRank(u.level, 'skill1');
      const previousSkill2 = abilityRank(u.level, 'skill2');
      u.level += 1;
      u.maxHp += 110;
      u.hp = Math.min(u.maxHp, u.hp + 120);
      u.champion.ad += 4;
      u.champion.armor += 3;

      sound.playCoin();
      floatsRef.current.push({
        id: random().toString(),
        x: u.x,
        y: u.y - 35,
        text: `LEVEL UP! Lvl ${u.level} ✨`,
        color: '#facc15',
        opacity: 1,
        scale: 1.3
      });
      if (abilityRank(u.level, 'skill1') > previousSkill1 || abilityRank(u.level, 'skill2') > previousSkill2) {
        const upgraded = abilityRank(u.level, 'skill1') > previousSkill1 ? u.champion.skill1 : u.champion.skill2;
        addEvent(`${u.player.name} upgraded ${upgraded.name} at level ${u.level}.`, 'level');
      }

      if (u.level === 6 && u.champion.name !== 'Kaelen') {
        u.cdUlt = 0;
        const msg = `${u.player.name} (${u.champion.displayName}) hit Level 6!`;
        const sub = `Unlocked Ultimate: ${u.champion.ultimate.name}! (75s Cooldown)`;
        showBanner(msg, sub, '⚡');
        addEvent(`⚡ LEVEL 6 SPIKE: ${msg} Unlocked ${u.champion.ultimate.name}!`, 'level');
      } else if (u.level === 11 && u.champion.name !== 'Kaelen') {
        const msg = `${u.player.name} reached Ultimate Rank 2!`;
        showBanner(msg, `+25% Damage & 60s Cooldown!`, '👑');
        addEvent(`⚡ LEVEL 11 SPIKE: ${msg}`, 'level');
      } else if (u.level === 16 && u.champion.name !== 'Kaelen') {
        const msg = `${u.player.name} reached Ultimate Rank 3!`;
        showBanner(msg, `Late Game Power Spike: 45s Cooldown!`, '🔥');
        addEvent(`⚡ LEVEL 16 SPIKE: ${msg}`, 'level');
      } else if (u.level === 18 && u.champion.name !== 'Kaelen') {
        const msg = `${u.player.name} reached LEVEL 18 CAP (Rank 4 Ultimate)!`;
        showBanner(msg, `MAX LEVEL CAP! Peak Ascendance: 35s Cooldown!`, '🌟');
        addEvent(`🌟 LEVEL 18 ASCENDANCE: ${msg}`, 'level');
      }
    }
  };

  const practiceAvatarCombo = (u: AramChampionUnit) => {
    if (u.comboMastered) return;
    const needed = comboPracticeNeeded(u.player, u.champion.name);
    if (needed === null) return;
    u.comboPractice = (u.comboPractice ?? 0) + 1;
    if (u.comboPractice >= needed) {
      u.comboMastered = true;
      const name = AVATAR_COMBOS[u.champion.name].name;
      floatsRef.current.push({ id: random().toString(), x: u.x, y: u.y - 42,
        text: `COMBO LEARNED: ${name}`, color: '#facc15', opacity: 1, scale: 1.2 });
      addEvent(`${u.player.name} learned ${name} on ${u.champion.displayName}!`, 'combo');
    }
  };

  const executeAvatarCombo = (
    u: AramChampionUnit, target: AramChampionUnit, enemies: AramChampionUnit[], allies: AramChampionUnit[],
    attackRange: number, cooldownFactor: number, dt: number
  ): boolean => {
    const recipe = AVATAR_COMBOS[u.champion.name];
    if (!recipe || !u.comboMastered || u.champion.name === 'Cinderlock' || u.champion.name === 'Cinderbloom') return false;
    if (u.comboStage && (u.comboExpiresAt ?? 0) < matchTimeRef.current) {
      u.comboStage = 0;
      u.comboHitConfirmed = false;
    }
    if (u.comboStage && u.comboTargetId !== target.id) {
      u.comboStage = 0;
      u.comboHitConfirmed = false;
    }
    const castStep = (skill: 'skill1' | 'skill2', stage: 1 | 2) => {
      u.comboStage = stage;
      u.comboTargetId = target.id;
      u.comboHitConfirmed = false;
      u.comboExpiresAt = matchTimeRef.current + 4.5;
      u.animState = 'cast';
      if (skill === 'skill1') {
        u.mana -= 45;
        u.cd1 = (u.champion.skill1.cooldown || 10) * cooldownFactor * abilityCooldownMultiplier(u.level, 'skill1');
        castChampionSkill1(u, target);
        if (!PROJECTILE_SKILL1_CHAMPIONS.has(u.champion.name)) {
          u.comboHitConfirmed = true;
          u.mana = Math.min(maxMana(u), u.mana + 45);
        }
      } else {
        u.mana -= 35;
        u.cd2 = (u.champion.skill2.cooldown || 10) * cooldownFactor * abilityCooldownMultiplier(u.level, 'skill2');
        castChampionSkill2(u, target);
        u.comboHitConfirmed = true;
        u.mana = Math.min(maxMana(u), u.mana + 35);
      }
    };
    const targetDist = Math.hypot(target.x - u.x, target.y - u.y);
    const openerRange = getSkillCastRange(u.champion.name, recipe.opener, attackRange);
    const followupRange = getSkillCastRange(u.champion.name, recipe.followup, attackRange);
    const ultRange = getSkillCastRange(u.champion.name, 'ultimate', attackRange);

    if (!u.comboStage && u.level >= 6 && u.cd1 <= 0 && u.cd2 <= 0 && u.cdUlt <= 0
      && u.mana >= ultimateManaCost(u) && target.hp > u.champion.ad && shouldUseUltimate(u, target, enemies, allies, ultRange)) {
      if (targetDist <= openerRange) {
        castStep(recipe.opener, 1);
        return true;
      }
      // If beyond opener range, move within cast range to initiate combo
      u.animState = 'walk';
      const angle = Math.atan2(target.y - u.y, target.x - u.x);
      u.x += Math.cos(angle) * 75 * dt;
      u.y += Math.sin(angle) * 75 * dt;
      return true;
    }
    if (u.comboStage === 1 && u.comboHitConfirmed && u.mana >= (recipe.followup === 'skill1' ? 45 : 35)
      && (recipe.followup === 'skill1' ? u.cd1 <= 0 : u.cd2 <= 0)) {
      if (targetDist <= followupRange) {
        castStep(recipe.followup, 2);
        return true;
      }
      u.animState = 'walk';
      const angle = Math.atan2(target.y - u.y, target.x - u.x);
      u.x += Math.cos(angle) * 75 * dt;
      u.y += Math.sin(angle) * 75 * dt;
      return true;
    }
    if (u.comboStage === 2 && u.comboHitConfirmed && u.mana >= ultimateManaCost(u) && u.cdUlt <= 0
      && shouldUseUltimate(u, target, enemies, allies, ultRange)) {
      if (targetDist <= ultRange) {
        u.comboStage = 0;
        u.comboHitConfirmed = false;
        u.mana -= ultimateManaCost(u);
        u.cdUlt = u.champion.name === 'Raijin' ? ultimateBaseCooldown(u)
          : ultimateBaseCooldown(u) * cooldownFactor * abilityCooldownMultiplier(u.level, 'ultimate');
        u.animState = 'cast';
        if (u.champion.name === 'Raijin') {
          castRaijinGroundUltimate(u, target, enemies, u.team === 'blue' ? 1 : -1);
        } else {
          castChampionUltimate(u, target, enemies);
        }
        addEvent(`${u.player.name} executed ${recipe.name}: ${u.champion.skill1.name}, ${u.champion.skill2.name}, ${u.champion.ultimate.name}!`, 'combo');
        return true;
      }
      u.animState = 'walk';
      const angle = Math.atan2(target.y - u.y, target.x - u.x);
      u.x += Math.cos(angle) * 75 * dt;
      u.y += Math.sin(angle) * 75 * dt;
      return true;
    }
    if (u.comboStage) {
      if (Math.hypot(target.x - u.x, target.y - u.y) <= attackRange && u.attackTimer <= 0) {
        u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
        u.animState = 'attack';
        performChampionAttack(u, target);
      } else {
        u.animState = 'walk';
        const angle = Math.atan2(target.y - u.y, target.x - u.x);
        u.x += Math.cos(angle) * 70 * dt;
        u.y += Math.sin(angle) * 70 * dt;
      }
      return true;
    }
    return false;
  };

  // Main Simulation Step (fixed 30 Hz game clock)
  const updateAramSimulation = (dt: number) => {
    for (const minute of [8, 10, 12, 13] as const) {
      const at = minute * 60;
      if (matchTimeRef.current - dt < at && matchTimeRef.current >= at) {
        itemCountsRef.current[minute] = championsRef.current.map(champion => champion.items.filter(item =>
          item.tier === 'Legendary' || item.tier === 'Mythic').length);
      }
    }
    if (matchTimeRef.current - dt < 900 && matchTimeRef.current >= 900) {
      fullBuildsAt15Ref.current = championsRef.current.filter(champion => champion.items.filter(item =>
        item.tier === 'Legendary' || item.tier === 'Mythic').length >= 6).length;
    }
    // 1. Minion Wave Spawn Timer (Every 22s)
    waveTimerRef.current -= dt;
    if (waveTimerRef.current <= 0) {
      spawnMinionWave();
      waveTimerRef.current = 22.0;
    }

    const champs = championsRef.current;
    champs.forEach(actor => {
      const previous = cooldownSnapshotsRef.current[actor.id];
      const witnessed = actor.isAlive && champs.some(observer => observer.team !== actor.team && observer.isAlive
        && Math.hypot(observer.x - actor.x, observer.y - actor.y) <= 340 && isUnitVisibleTo(actor, observer));
      cooldownSnapshotsRef.current[actor.id] = observeCooldownRise(cooldownMemoryRef.current, previous,
        actor, matchTimeRef.current, witnessed, actor.champion.name === 'Oathmute');
    });
    const minions = minionsRef.current;
    const structures = structuresRef.current;
    const relics = relicsRef.current;
    const dragon = dragonRef.current;
    const jungleCamps = jungleCampsRef.current;
    const championStarts = new Map(champs.map(unit => [unit.id, { x: unit.x, y: unit.y }]));
    const minionStarts = new Map(minions.map(unit => [unit.id, { x: unit.x, y: unit.y }]));
    const campStarts = new Map(jungleCamps.map(unit => [unit.id, { x: unit.x, y: unit.y }]));
    wardsRef.current = wardsRef.current.filter(w => w.expiresAt > matchTimeRef.current);

    if (shouldAwakenGolem(matchTimeRef.current, golemAwakenedRef.current)) {
      const colossus = jungleCamps.find(camp => camp.type === 'siege_golem');
      if (colossus) {
        colossus.isAlive = true;
        colossus.hp = colossus.maxHp;
        golemAwakenedRef.current = true;
        addEvent('Gravemarch Colossus has awakened in the lower pit!', 'jungle');
      }
    }

    // Check Aegis Buff Expiry
    if (aegisBuffRef.current && matchTimeRef.current > aegisBuffRef.current.expiresAt) {
      aegisBuffRef.current = null;
      addEvent(`🛡️ Aegis of the Immortal has expired!`, 'dragon');
    }

    // 2. Jungle Camps Respawn & Logic
    jungleCamps.forEach((camp) => {
      const homeX = camp.homeX ?? (camp.homeX = camp.x);
      const homeY = camp.homeY ?? (camp.homeY = camp.y);
      if (!camp.isAlive) {
        if (neutralCampRespawnSeconds(camp.type) === null) return;
        camp.respawnTimer -= dt;
        if (camp.respawnTimer <= 0) {
          camp.isAlive = true;
          camp.hp = camp.maxHp;
          camp.targetId = undefined;
          camp.claimTeam = undefined;
          camp.hurtTimer = 0;
          camp.patience = 0;
          camp.resetElapsed = 0;
          camp.x = homeX;
          camp.y = homeY;
          addEvent(`🌲 ${camp.name} has respawned in the jungle!`, 'jungle');
        }
        return;
      }
      camp.attackTimer = Math.max(0, camp.attackTimer - dt);
      camp.hurtTimer = Math.max(0, (camp.hurtTimer ?? 0) - dt);
      const target = champs.find((c) => c.id === camp.targetId && c.isAlive);
      const leashRadius = camp.type === 'siege_golem' ? 300 : 220;
      const targetInLeash = !!target && Math.hypot(target.x - homeX, target.y - homeY) <= leashRadius
        && Math.hypot(camp.x - homeX, camp.y - homeY) <= leashRadius;
      const state = stepCampPatience(camp.hp, camp.maxHp, camp.patience ?? 0,
        camp.resetElapsed ?? 0, targetInLeash, dt);
      camp.hp = state.hp;
      camp.patience = state.patience;
      camp.resetElapsed = state.resetElapsed;
      const movement = stepLeashedMonster(camp.x, camp.y, homeX, homeY,
        state.chasing ? target ?? null : null, dt,
        camp.type === 'siege_golem' ? 82 : 72, leashRadius);
      camp.x = movement.x;
      camp.y = movement.y;
      camp.facingX = faceTargetLikeAvatar(camp.facingX ?? 1,
        state.chasing && target ? target.x - camp.x : homeX - camp.x);
      if (!state.chasing || !movement.chasing) {
        camp.targetId = undefined;
        camp.claimTeam = undefined;
        return;
      }
      if (target && camp.attackTimer <= 0 && Math.hypot(target.x - camp.x, target.y - camp.y) <= 95) {
        camp.attackTimer = 1.35;
        projectilesRef.current.push({
          id: random().toString(), x: camp.x, y: camp.y - 16,
          targetX: target.x, targetY: target.y - 12,
          vx: 0, vy: 0, speed: 430, color: camp.color,
          type: 'jungle_shot', size: 7, targetUnitId: target.id,
          damage: camp.ad, attackerId: camp.id,
          angle: Math.atan2(target.y - camp.y, target.x - camp.x)
        });
      }
    });

    // 3. Dragon Boss Logic & Shockwave Slam
    if (!dragon.isAlive) {
      dragon.spawnTimer -= dt;
      if (dragon.spawnTimer <= 0) {
        dragon.isAlive = true;
        dragon.slamWindup = 0;
        dragon.aggroTeam = null;
        dragon.claimTeam = undefined;
        dragon.targetId = undefined;
        dragon.hp = dragon.maxHp + dragon.slainCount * 1200;
        dragon.maxHp = dragon.hp;
        showBanner('🔥 EMBERMAW HAS AWAKENED!', 'Contest the volcanic dragon pit for the Aegis!', '🐉');
        addEvent(`🐉 DRAGON: Embermaw has awakened in the Upper Cavern!`, 'dragon');
      }
    } else {
      dragon.slamTimer -= dt;
      dragon.attackTimer -= dt;

      const nearbyChallengers = dragon.aggroTeam
        ? champs.filter((c) => c.isAlive && Math.hypot(c.x - dragon.x, c.y - dragon.y) <= dragon.range)
        : [];

      if (nearbyChallengers.length === 0 && dragon.aggroTeam) {
        dragon.aggroTeam = null;
        dragon.claimTeam = undefined;
        dragon.targetId = undefined;
        dragon.slamWindup = 0;
        dragon.hp = Math.min(dragon.maxHp, dragon.hp + 90 * dt);
      }

      if (nearbyChallengers.length > 0) {
        const primaryTarget = nearbyChallengers.sort((a, b) => a.hp - b.hp)[0];

        // Warn first, then resolve against positions at impact so challengers can evade.
        if ((dragon.slamWindup ?? 0) > 0) {
          dragon.slamWindup = Math.max(0, (dragon.slamWindup ?? 0) - dt);
          if (dragon.slamWindup === 0) {
            sound.playUltimateExplosion();
            spellsRef.current.push({
              id: random().toString(), type: 'boss_slam', x: dragon.x, y: dragon.y,
              radius: 120, duration: 0.85, maxDuration: 0.85, color: '#f97316'
            });
            champs.filter(c => c.isAlive && Math.hypot(c.x - dragon.x, c.y - dragon.y) <= 120)
              .forEach(c => {
                applyDamageToChampion(null, c, 160, false, '🔥 Inferno Slam');
                c.stunTimer = Math.max(c.stunTimer, 1.0);
              });
          }
        } else if (dragon.slamTimer <= 0) {
          dragon.slamTimer = 6.0;
          dragon.slamWindup = 1.1;
          spellsRef.current.push({
            id: random().toString(),
            type: 'boss_warning',
            x: dragon.x,
            y: dragon.y,
            radius: 120,
            duration: 1.1,
            maxDuration: 1.1,
            color: '#f97316'
          });
        }
        // Boss Flame Breath auto-attack
        else if (dragon.attackTimer <= 0) {
          dragon.attackTimer = 1.5;
          sound.playSpellHit();
          projectilesRef.current.push({
            id: random().toString(),
            x: dragon.x,
            y: dragon.y - 10,
            targetX: primaryTarget.x,
            targetY: primaryTarget.y,
            vx: 0,
            vy: 0,
            speed: 400,
            color: '#fb923c',
            type: 'boss_breath',
            size: 8,
            targetUnitId: primaryTarget.id,
            damage: dragon.ad,
            attackerId: dragon.id,
            angle: 0
          });
        }
      }
    }

    // 5. Health Relics Regen
    relics.forEach((r) => {
      if (r.respawnTimer > 0) r.respawnTimer = Math.max(0, r.respawnTimer - dt);
    });

    // 6. Healing wells at the far ends of the expanded map.
    champs.forEach((c) => {
      if (!c.isAlive) return;

      const inBlueWell = c.team === 'blue' && (c.x <= WELL_X.blue + 105 && Math.abs(c.y - LANE_Y) <= 105);
      const inRedWell = c.team === 'red' && (c.x >= WELL_X.red - 105 && Math.abs(c.y - LANE_Y) <= 105);

      if (inBlueWell || inRedWell) {
        // High rapid fountain regeneration (+45% HP/s and +75 Mana/s)
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.45 * dt);
        c.mana = Math.min(maxMana(c), c.mana + 75 * dt);

        // Shop items while in well!
        evaluateAndBuyItems(c);

        if (random() < 0.1) {
          floatsRef.current.push({
            id: random().toString(),
            x: c.x + (random() - 0.5) * 16,
            y: c.y - 25,
            text: `+HP/MANA 💧`,
            color: '#34d399',
            opacity: 0.8,
            scale: 0.85
          });
        }
      }

      // Fountain Defense Laser on Intruders
      const redInvadingBlueWell = c.team === 'red' && c.x <= WELL_X.blue + 50;
      const blueInvadingRedWell = c.team === 'blue' && c.x >= WELL_X.red - 50;
      if (redInvadingBlueWell || blueInvadingRedWell) {
        c.hp = Math.max(0, c.hp - 1400 * dt);
        sound.playSpellHit();
        floatsRef.current.push({
          id: random().toString(),
          x: c.x,
          y: c.y - 35,
          text: `⚡ WELL DEFENSE -1400!`,
          color: '#ef4444',
          opacity: 1,
          scale: 1.3
        });
        if (c.hp <= 0 && c.isAlive) {
          c.isAlive = false;
          c.hookPull = undefined;
          c.deaths++;
          c.respawnTimer = calculateDeathTimer(c.level, matchTimeRef.current);
          c.isRecalling = false;
          c.recallTimer = 0;
          addEvent(`⚡ Fountain Defense laser executed ${c.player.name}!`, 'fountain');
        }
      }

      // Natural Mana & XP Tick
      // Income rises with individual farm skill; strong farmers reach item spikes sooner.
      c.gold += passiveGoldPerSecond(c.player.stats.lan) * dt;
      c.mana = Math.min(maxMana(c), c.mana + ((jungleBuffsRef.current[c.team].blue > matchTimeRef.current ? 4.5 : 1.5) + manaRegen(c)) * dt);
      c.animTimer += dt;
      grantChampionXp(c, 3.5 * dt);

      // Combat, True Form & Grievous timers decay
      c.combatTimer = Math.max(0, (c.combatTimer ?? 0) - dt);
      c.trueFormTimer = Math.max(0, (c.trueFormTimer ?? 0) - dt);
      c.grievousTimer = Math.max(0, (c.grievousTimer ?? 0) - dt);
      c.zhonyaRemaining = Math.max(0, (c.zhonyaRemaining ?? 0) - dt);
      if (c.zhonyaRemaining === 0) c.zhonyaActive = false;

      // Warmog's Passive Regen: Requires out-of-combat (no recent damage taken or dealt)
      const hasWarmogs = c.items.some((it) => it.id === 'item_warmogs');
      if (hasWarmogs && c.hp < c.maxHp && (c.combatTimer ?? 0) <= 0) {
        const healFactor = (c.grievousTimer && c.grievousTimer > 0) ? 0.024 : 0.04;
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * healFactor * dt);
      }

      // Sunfire Immolate Passive
      const hasSunfire = c.items.some((it) => it.id === 'item_sunfire' || it.id === 'item_bami_cinder');
      if (hasSunfire) {
        c.immolateTimer += dt;
        if (c.immolateTimer >= 1.0) {
          c.immolateTimer = 0;
          const enemyChamps = champs.filter((e) => e.team !== c.team && e.isAlive && Math.hypot(e.x - c.x, e.y - c.y) <= 100);
          enemyChamps.forEach((e) => applyDamageToChampion(c, e, 35, false, '🔥 Immolate'));
          const enemyMinions = minions.filter((m) => m.team !== c.team && m.isAlive && Math.hypot(m.x - c.x, m.y - c.y) <= 100);
          enemyMinions.forEach((m) => { m.hp -= 35; });
        }
      }

      // Support Items Periodic Utility
      // 1. Chime of Renewal (Echoes of Helia) & Beacon of Deliverance (Redemption): periodic heal
      const hasSupportHeal = c.items.some((it) => it.id === 'item_echoes_of_helia' || it.id === 'item_redemption');
      if (hasSupportHeal) {
        c.supportHealTimer = (c.supportHealTimer ?? 0) + dt;
        if (c.supportHealTimer >= 3.5) {
          c.supportHealTimer = 0;
          const woundedAlly = champs.find(a => a.team === c.team && a.isAlive && a.hp < a.maxHp * 0.85 && Math.hypot(a.x - c.x, a.y - c.y) <= 240);
          if (woundedAlly) {
            const healVal = c.items.some((it) => it.id === 'item_redemption') ? 95 : 65;
            woundedAlly.hp = Math.min(woundedAlly.maxHp, woundedAlly.hp + healVal);
            floatsRef.current.push({
              id: random().toString(),
              x: woundedAlly.x,
              y: woundedAlly.y - 28,
              text: `✨ +${healVal} HEAL`,
              color: '#34d399',
              opacity: 0.95,
              scale: 1.1
            });
            if (c.items.some((it) => it.id === 'item_ardent_censer')) {
              woundedAlly.censerBuffTimer = 4.0;
            }
          }
        }
      }

      // 2. Aegis of the Protector (Locket): Emergency shield when nearby ally falls below 35% HP
      const hasLocket = c.items.some((it) => it.id === 'item_locket');
      if (hasLocket && (c.locketCooldown ?? 0) <= 0) {
        const endangeredAlly = champs.find(a => a.team === c.team && a.isAlive && a.hp <= a.maxHp * 0.35 && Math.hypot(a.x - c.x, a.y - c.y) <= 220);
        if (endangeredAlly) {
          c.locketCooldown = 45.0;
          endangeredAlly.shield += 190;
          floatsRef.current.push({
            id: random().toString(),
            x: endangeredAlly.x,
            y: endangeredAlly.y - 32,
            text: '🛡️ LOCKET AEGIS (+190)',
            color: '#38bdf8',
            opacity: 1,
            scale: 1.25
          });
        }
      }
      if (c.locketCooldown && c.locketCooldown > 0) {
        c.locketCooldown = Math.max(0, c.locketCooldown - dt);
      }
    });

    // Skillshots travel toward the cast-time position and collide with the path.
    projectilesRef.current = projectilesRef.current
      .map((p) => {
        if (p.skillshot && !p.countedShot) {
          p.countedShot = true;
          skillshotsRef.current.fired++;
          const owner = champs.find(c => c.id === p.attackerId);
          if (owner) recordSkillshot(insightsRef.current, owner, false, matchTimeRef.current);
        }
        // Yasuo Wind Wall Projectile Dissolution
        const blockedByWindWall = spellsRef.current.some(
          (s) => s.type === 'wind_wall' && Math.hypot(p.x - s.x, p.y - s.y) <= s.radius
        );
        if (blockedByWindWall && p.type !== 'boss_breath') {
          sound.playSpellHit();
          floatsRef.current.push({
            id: random().toString(),
            x: p.x,
            y: p.y - 15,
            text: '💨 WIND WALL DEFLECT!',
            color: '#38bdf8',
            opacity: 1,
            scale: 1.0
          });
          return null;
        }

        if (p.skillshot) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.hypot(dx, dy);
          const travel = Math.min(dist, p.speed * dt);
          const end = dist > 0 ? { x: p.x + dx / dist * travel, y: p.y + dy / dist * travel } : { x: p.x, y: p.y };
          const attacker = champs.find(c => c.id === p.attackerId);
          const hit = champs.find(c => c.isAlive && c.team !== attacker?.team
            && segmentHitsCircle({ x: p.x, y: p.y }, end, { x: c.x, y: c.y - 15 }, (p.collisionRadius ?? 17) + p.size));
          if (hit) {
            skillshotsRef.current.hit++;
            if (attacker) recordSkillshot(insightsRef.current, attacker, true, matchTimeRef.current);
            handleProjectileImpact({ ...p, targetUnitId: hit.id });
            return null;
          }
          if (travel >= dist) return null;
          return { ...p, x: end.x, y: end.y, angle: Math.atan2(dy, dx) };
        }

        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 18) {
          handleProjectileImpact(p);
          return null;
        }
        const vx = (dx / dist) * p.speed * dt;
        const vy = (dy / dist) * p.speed * dt;
        return { ...p, x: p.x + vx, y: p.y + vy, angle: Math.atan2(dy, dx) };
      })
      .filter((p): p is Projectile => p !== null);

    // 8. Update Spell AOEs & Continuous Mechanics (Tethers, Pulls, Traps)
    spellsRef.current = spellsRef.current
      .map((s) => {
        // Continuous Pull Tether: Raijin's Electric Vortex
        if (s.type === 'electric_vortex') {
          const source = champs.find((c) => c.id === s.sourceUnitId);
          const target = champs.find((c) => c.id === s.targetUnitId);
          if (source && target && source.isAlive && target.isAlive) {
            s.sourceX = source.x;
            s.sourceY = source.y;
            s.x = target.x;
            s.y = target.y;
            target.stunTimer = Math.max(target.stunTimer, 0.25);
            const dx = source.x - target.x;
            const dy = source.y - target.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 36) {
              const pullStep = Math.min(dist - 36, 175 * dt);
              target.x += (dx / dist) * pullStep;
              target.y += (dy / dist) * pullStep;
            }
          }
        } else if (s.type === 'ribbon_lash') {
          // Croakwell: Ribbon Lash Tongue Pull
          const source = champs.find((c) => c.id === s.sourceUnitId);
          const target = champs.find((c) => c.id === s.targetUnitId);
          if (source && target && source.isAlive && target.isAlive) {
            s.sourceX = source.x;
            s.sourceY = source.y;
            s.x = target.x;
            s.y = target.y;
            target.stunTimer = Math.max(target.stunTimer, 0.25);
            const dx = source.x - target.x;
            const dy = source.y - target.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 40) {
              const pullStep = Math.min(dist - 40, 190 * dt);
              target.x += (dx / dist) * pullStep;
              target.y += (dy / dist) * pullStep;
            }
          }
        } else if (s.type === 'aether_remnant') {
          // Inai: Aether Remnant Gaze Pull
          const target = champs.find((c) => c.id === s.targetUnitId);
          if (target && target.isAlive) {
            const dx = s.x - target.x;
            const dy = s.y - target.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 15) {
              const pullStep = Math.min(dist - 15, 145 * dt);
              target.x += (dx / dist) * pullStep;
              target.y += (dy / dist) * pullStep;
              target.stunTimer = Math.max(target.stunTimer, 0.25);
            }
          }
        } else if (s.type === 'aetheris_ultimate_link' || s.type === 'aetheris_overcharge') {
          const source = champs.find(c => c.id === s.sourceUnitId);
          const target = champs.find(c => c.id === s.targetUnitId);
          if (source?.isAlive && target?.isAlive) {
            s.sourceX = source.x;
            s.sourceY = source.y;
            s.x = target.x;
            s.y = target.y;
          } else {
            s.duration = 0;
          }
        } else if (s.type === 'sprout_ring') {
          // Tequoia: Sprout Tree Ring Enclosure
          const target = champs.find((c) => c.id === s.targetUnitId);
          if (target && target.isAlive) {
            const dx = target.x - s.x;
            const dy = target.y - s.y;
            const dist = Math.hypot(dx, dy);
            const maxRadius = s.radius - 10;
            if (dist > maxRadius && dist > 0) {
              target.x = s.x + (dx / dist) * maxRadius;
              target.y = s.y + (dy / dist) * maxRadius;
            }
          }
        }
        return { ...s, duration: s.duration - dt };
      })
      .filter((s) => s.duration > 0);

    // 9. Update Floating Text
    floatsRef.current = floatsRef.current
      .map((f) => ({ ...f, y: f.y - 30 * dt, opacity: f.opacity - 1.1 * dt }))
      .filter((f) => f.opacity > 0);

    // 10. Structures (Turrets) Logic & Diving Aggro
    structures.forEach((st) => {
      if (!st.isAlive || st.ad === 0) return;

      st.attackTimer = Math.max(0, st.attackTimer - dt);

      const inRangeEnemies = [
        ...minions.filter((m) => m.team !== st.team && m.isAlive && Math.hypot(m.x - st.x, m.y - st.y) <= st.range),
        ...champs.filter((c) => c.team !== st.team && c.isAlive && Math.hypot(c.x - st.x, c.y - st.y) <= st.range)
      ];

      if (inRangeEnemies.length === 0) {
        st.targetId = null;
        return;
      }

      const diveAggressorId = (st.diveAggroUntil ?? 0) > matchTimeRef.current ? st.diveAggressorId : undefined;
      const target = selectTurretTarget(inRangeEnemies, st.targetId, diveAggressorId);
      if (!target) return;
      st.targetId = target.id;

      // The nexus fires five rapid shots, then reloads. Continuous rapid fire
      // erased every upgraded wave and could stall a fully exposed nexus.
      if (st.attackTimer <= 0) {
        if (st.type === 'nexus') {
          const nextShot = nextNexusVolleyShot(st.volleyShotsRemaining);
          st.volleyShotsRemaining = nextShot.shotsRemaining;
          st.attackTimer = nextShot.cooldown;
        } else {
          st.attackTimer = 1.0;
        }
        sound.playSpellHit();
        const targets = st.type === 'nexus'
          ? selectNexusTargets(inRangeEnemies, st.targetId, diveAggressorId) : [target];
        targets.forEach((shotTarget, index) => {
          const angle = st.type === 'nexus' ? index * Math.PI / 3 : 0;
          projectilesRef.current.push({
            id: random().toString(),
            x: st.x + (st.type === 'nexus' ? Math.cos(angle) * 66 : 0),
            y: st.type === 'nexus' ? st.y + Math.sin(angle) * 30 : st.y - 32,
            targetX: shotTarget.x,
            targetY: shotTarget.y - 15,
            vx: 0,
            vy: 0,
            speed: 460,
            color: st.team === 'blue' ? '#38bdf8' : '#f43f5e',
            type: 'turret_shot',
            size: st.type === 'nexus' ? 8 : 9,
            targetUnitId: shotTarget.id,
            damage: turretShotDamage(st.ad, !('type' in shotTarget), st.type === 'nexus'),
            trueDamage: st.type === 'nexus',
            attackerId: st.id,
            angle: 0
          });
        });
      }
    });

    // 11. Minions Logic
    minions.forEach((m) => {
      if (!m.isAlive) return;

      m.attackTimer = Math.max(0, m.attackTimer - dt);
      if (m.siegeGolem) m.siegeChargeImpactTimer = Math.max(0, (m.siegeChargeImpactTimer ?? 0) - dt);

      if (m.summonedBearOwnerId) {
        const owner = champs.find(c => c.id === m.summonedBearOwnerId && c.isAlive);
        if (!owner) { m.isAlive = false; return; }

        const nearby = (unit: { x: number; y: number }, range: number) =>
          Math.hypot(unit.x - m.x, unit.y - m.y) <= range;
        const hostileChamps = champs.filter(c => c.team !== m.team && c.isAlive && nearby(c, 280));
        const focus = hostileChamps.find(c => c.id === m.summonedBearFocusId);
        const championTarget = focus ?? hostileChamps.sort((a, b) =>
          Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
        const enemyMinion = minions.find(e => e.team !== m.team && e.isAlive && nearby(e, 160));
        const enemyStructure = structures.find(s => s.team !== m.team && s.isAlive && nearby(s, 140)
          && (s.type !== 'nexus' || canDamageNexus(s.team, structures)));
        const target = championTarget ?? enemyMinion ?? enemyStructure;
        const follow = target ?? { x: owner.x + (owner.team === 'blue' ? 45 : -45), y: owner.y + 52 };
        m.facingX = faceTargetLikeAvatar(m.facingX ?? (m.team === 'blue' ? 1 : -1), follow.x - m.x);
        const distance = Math.hypot(follow.x - m.x, follow.y - m.y);
        const stopRange = target ? 35 : 28;
        if (distance > stopRange) {
          const step = Math.min(distance - stopRange, m.speed * dt);
          m.x += (follow.x - m.x) / distance * step;
          m.y += (follow.y - m.y) / distance * step;
        } else if (target && m.attackTimer <= 0) {
          m.attackTimer = 1.15;
          if ('player' in target) applyDamageToChampion(owner, target, m.ad, false, 'Spirit Bear Claws');
          else if ('armor' in target) applyDamageToStructure(owner, target, m.ad);
          else applyDamageToMinion(owner, target, m.ad);
        }
        return;
      }

      if (m.siegeGolem) {
        m.siegeChargeCooldown = Math.max(0, (m.siegeChargeCooldown ?? 0) - dt);
        if ((m.siegeChargeWindup ?? 0) > 0) {
          const chargeTarget = structures.find(s => s.id === m.siegeChargeTargetId && s.isAlive);
          if (chargeTarget) m.facingX = faceTargetLikeAvatar(m.facingX ?? (m.team === 'blue' ? 1 : -1), chargeTarget.x - m.x);
          m.siegeChargeWindup = Math.max(0, (m.siegeChargeWindup ?? 0) - dt);
          if (m.siegeChargeWindup === 0) {
            const tower = structures.find(s => s.id === m.siegeChargeTargetId && s.isAlive);
            if (tower && Math.hypot(tower.x - m.x, tower.y - m.y) <= 185) {
              const chargeDir = m.team === 'blue' ? 1 : -1;
              m.x = tower.x - chargeDir * 43;
              m.y = tower.y + 15;
              m.siegeChargeImpactTimer = 0.5;
              const dealt = damageStructure(tower, GOLEM_CHARGE_DAMAGE);
              spellsRef.current.push({ id: random().toString(), type: 'golem_charge_impact',
                x: tower.x, y: tower.y, radius: 75, duration: 0.9, maxDuration: 0.9, color: '#fbbf24' });
              floatsRef.current.push({ id: random().toString(), x: tower.x, y: tower.y - 72,
                text: `COLOSSUS CHARGE -${dealt}`, color: '#fef08a', opacity: 1, scale: 1.4 });
              addEvent(`🗿 COLOSSUS CHARGE: Gravemarch slammed ${tower.name} for ${dealt} damage!`, 'tower');
              sound.playUltimateExplosion();
            }
            m.siegeChargeTargetId = undefined;
          }
          return;
        }
        const chargeTower = selectGolemChargeTower(m, structures);
        if (chargeTower && (m.siegeChargeCooldown ?? 0) <= 0) {
          m.siegeChargeTargetId = chargeTower.id;
          m.siegeChargeWindup = 0.95;
          m.siegeChargeCooldown = 10;
          spellsRef.current.push({ id: random().toString(), type: 'golem_charge_warning',
            x: chargeTower.x, y: chargeTower.y, radius: 75,
            duration: 0.95, maxDuration: 0.95, color: '#fbbf24' });
          return;
        }
      }

      const dir = m.team === 'blue' ? 1 : -1;
      const enemyMinions = minions.filter((em) => em.team !== m.team && em.isAlive && Math.abs(em.x - m.x) <= m.range + 20);
      const enemyStructures = structures.filter((es) => es.team !== m.team && es.isAlive && Math.abs(es.x - m.x) <= m.range + 30);
      const enemyChamps = champs.filter((ec) => ec.team !== m.team && ec.isAlive && Math.hypot(ec.x - m.x, ec.y - m.y) <= m.range + 10);

      const target = enemyMinions[0] || enemyStructures[0] || enemyChamps[0];
      if (m.siegeGolem) m.facingX = faceTargetLikeAvatar(m.facingX ?? dir, target ? target.x - m.x : dir * 50);

      if (target) {
        if (m.attackTimer <= 0) {
          m.attackTimer = 1.2;
          if (m.type === 'caster' || m.type === 'cannon') {
            const isTargetStructure = 'armor' in target;
            const projDamage = isTargetStructure ? getMinionStructureDamage(m.type, m.ad) : m.ad;
            projectilesRef.current.push({
              id: random().toString(),
              x: m.x,
              y: m.y - 8,
              targetX: target.x,
              targetY: target.y - 8,
              vx: 0,
              vy: 0,
              speed: 380,
              color: m.team === 'blue' ? '#60a5fa' : '#f87171',
              type: 'minion_shot',
              size: m.type === 'cannon' ? 5 : 2.5,
              targetUnitId: target.id,
              damage: projDamage,
              attackerId: m.id,
              angle: 0
            });
          } else {
            applyMinionDamage(m, target);
          }
        }
      } else {
        m.x += dir * m.speed * dt;
        m.x = Math.max(40, Math.min(ARENA_WIDTH - 40, m.x));
      }
    });

    minionsRef.current = minions.filter((m) => m.isAlive);

    // 12. Champions Micro & Macro Intelligence
    champs.forEach((u, uIdx) => {
      if (!u.isAlive) {
        u.respawnTimer = Math.max(0, u.respawnTimer - dt);
        if (u.respawnTimer <= 0) {
          u.isAlive = true;
          u.hookPull = undefined;
          u.hp = u.maxHp;
          u.mana = maxMana(u);
          u.isRecalling = false;
          u.recallTimer = 0;
          u.x = WELL_X[u.team];
          u.y = getChampionFormationY(u.champion.name, uIdx);
          evaluateAndBuyItems(u);
          addEvent(`💧 ${u.player.name} respawned in home fountain!`, 'fountain');
        }
        return;
      }

      // Check Active Recalling Channel (2.5s channel to teleport to base well)
      if (u.isRecalling) {
        const channelers = champs.filter(ally => ally.isAlive && ally.team === u.team
          && ally.id !== u.id && isChannelingAbility(ally));
        const caught = channelers.length > 0 ? champs.filter(enemy => enemy.isAlive
          && enemy.team !== u.team && isUnitVisibleTo(enemy, u)
          && isEnemyCaughtInAlliedChannel(enemy, channelers)
          && Math.hypot(enemy.x - u.x, enemy.y - u.y) <= 650) : [];
        const firstCaught = caught.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y)
          - Math.hypot(b.x - u.x, b.y - u.y))[0];
        const activeEnemyTower = firstCaught && structures.some(st => st.isAlive
          && st.team !== u.team && (st.type.includes('tower') || st.type === 'nexus')
          && Math.hypot(st.x - firstCaught.x, st.y - firstCaught.y) <= st.range);
        const castReach = Math.max(
          u.cd1 <= 0 && u.mana >= skill1ManaCost(u) ? getSkillCastRange(u.champion.name, 'skill1', getChampionAttackRange(u.champion.name)) : 0,
          u.cd2 <= 0 && u.mana >= 35 ? getSkillCastRange(u.champion.name, 'skill2', getChampionAttackRange(u.champion.name)) : 0,
        );
        if (shouldFollowUpControl({
          healthFraction: u.hp / u.maxHp, caughtEnemies: caught.length,
          freeThreats: champs.filter(enemy => enemy.isAlive && enemy.team !== u.team
            && Math.hypot(enemy.x - u.x, enemy.y - u.y) < 350
            && !caught.some(trapped => trapped.id === enemy.id)).length,
          nearbyAllies: champs.filter(ally => ally.isAlive && ally.team === u.team
            && ally.id !== u.id && Math.hypot(ally.x - u.x, ally.y - u.y) < 400).length,
          distanceToCatch: firstCaught ? Math.hypot(firstCaught.x - u.x, firstCaught.y - u.y) : Infinity,
          attackRange: getChampionAttackRange(u.champion.name), readyCastRange: castReach,
          controlSeconds: firstCaught ? Math.max(0, ...channelers.filter(ally => isEnemyCaughtInAlliedChannel(firstCaught, [ally]))
            .map(ally => ally.blackHole?.remaining ?? ally.corsaraBarrage?.remaining ?? ally.monkeySpin?.remaining ?? 0)) : 0,
          moveSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0),
          iq: u.player.stats.iq, teamfight: u.player.stats.tf, losingFight: true,
          underEnemyTower: !!activeEnemyTower,
          takingTowerFire: structures.some(st => st.isAlive && st.team !== u.team
            && (st.targetId === u.id || st.diveAggressorId === u.id)),
          abortingDive: !!u.diveAborting,
        })) {
          u.isRecalling = false;
          u.recallTimer = 0;
        }
      }
      if (u.isRecalling) {
        u.vx = 0;
        u.vy = 0;
        u.animState = 'idle';
        u.recallTimer = (u.recallTimer ?? 2.5) - dt;
        if (u.recallTimer <= 0) {
          u.isRecalling = false;
          u.recallTimer = 0;
          u.recallCooldown = 12.0;
          u.x = WELL_X[u.team];
          u.y = 380;
          u.hp = u.maxHp;
          u.mana = maxMana(u);
          evaluateAndBuyItems(u);
          sound.playCoin();
          floatsRef.current.push({
            id: random().toString(),
            x: u.x,
            y: u.y - 35,
            text: `💧 RECALLED TO FOUNTAIN!`,
            color: '#38bdf8',
            opacity: 1,
            scale: 1.3
          });
          addEvent(`💧 ${u.player.name} (${u.champion.displayName}) safely recalled to base!`, 'fountain');
        }
        return;
      }

      // Decrement timers
      if (u.attackTimer > 0) u.attackTimer = Math.max(0, u.attackTimer - dt);
      if (u.cd1 > 0) u.cd1 = Math.max(0, u.cd1 - dt);
      if (u.cd2 > 0) u.cd2 = Math.max(0, u.cd2 - dt);
      if (u.cdUlt > 0 && (u.level >= 6 || u.champion.name === 'Kaelen')) u.cdUlt = Math.max(0, u.cdUlt - dt);
      if (u.champion.name === 'Kaelen') {
        u.hp = Math.min(u.maxHp, u.hp + getKaelenOrbBonuses(u).healthRegen * dt);
      }
      if (u.kaelenInvokeCooldown && u.kaelenInvokeCooldown > 0) {
        u.kaelenInvokeCooldown = Math.max(0, u.kaelenInvokeCooldown - dt);
      }
      if (u.kaelenSpellCooldowns) {
        Object.keys(u.kaelenSpellCooldowns).forEach(spellId => {
          u.kaelenSpellCooldowns![spellId] = Math.max(0, u.kaelenSpellCooldowns![spellId] - dt);
        });
      }
      if (u.aetherisOrbs) {
        u.aetherisOrbs.remaining = Math.max(0, u.aetherisOrbs.remaining - dt);
        if (u.aetherisOrbs.remaining <= 0 || u.aetherisOrbs.charges <= 0) u.aetherisOrbs = undefined;
      }
      if (u.aetherisOverchargeTimer && u.aetherisOverchargeTimer > 0) {
        u.aetherisOverchargeTimer = Math.max(0, u.aetherisOverchargeTimer - dt);
        if (u.aetherisOverchargeTimer === 0) u.aetherisOverchargeSourceId = undefined;
      }
      if (u.stunTimer > 0) u.stunTimer = Math.max(0, u.stunTimer - dt);
      if (u.silenceTimer && u.silenceTimer > 0) u.silenceTimer = Math.max(0, u.silenceTimer - dt);
      if (u.charmTimer > 0) u.charmTimer = Math.max(0, u.charmTimer - dt);
      if (u.fearTimer && u.fearTimer > 0) u.fearTimer = Math.max(0, u.fearTimer - dt);
      if (u.knockupTimer && u.knockupTimer > 0) u.knockupTimer = Math.max(0, u.knockupTimer - dt);
      if (u.untargetableTimer && u.untargetableTimer > 0) u.untargetableTimer = Math.max(0, u.untargetableTimer - dt);
      if (u.recallCooldown && u.recallCooldown > 0) u.recallCooldown = Math.max(0, u.recallCooldown - dt);
      if (u.revealedTimer && u.revealedTimer > 0) u.revealedTimer = Math.max(0, u.revealedTimer - dt);
      if (u.iceFocusTimer && u.iceFocusTimer > 0) u.iceFocusTimer = Math.max(0, u.iceFocusTimer - dt);
      if (u.clutchCommitTimer && u.clutchCommitTimer > 0) {
        u.clutchCommitTimer = Math.max(0, u.clutchCommitTimer - dt);
        if (u.clutchCommitTimer === 0) u.clutchCommitActive = false;
      }
      if (u.shotcallSignalTimer && u.shotcallSignalTimer > 0) {
        u.shotcallSignalTimer = Math.max(0, u.shotcallSignalTimer - dt);
      }
      if (u.traitFloatTimer && u.traitFloatTimer > 0) {
        u.traitFloatTimer = Math.max(0, u.traitFloatTimer - dt);
      }
      if (u.decisionCommitTimer && u.decisionCommitTimer > 0) {
        u.decisionCommitTimer = Math.max(0, u.decisionCommitTimer - dt);
      }
      if (u.censerBuffTimer && u.censerBuffTimer > 0) {
        u.censerBuffTimer = Math.max(0, u.censerBuffTimer - dt);
      }

      if (u.stealthTimer && u.stealthTimer > 0) u.stealthTimer = Math.max(0, u.stealthTimer - dt);
      if (u.forestLink) {
        u.forestLink.remaining -= dt;
        if (u.forestLink.remaining <= 0) u.forestLink = undefined;
      }
      if (u.cinderQStage && (u.cinderQExpiresAt ?? 0) <= matchTimeRef.current) {
        u.cinderQStage = undefined;
        u.cd1 = Math.max(u.cd1, u.champion.skill1.cooldown);
      }
      if (u.paxiOrb) {
        const orb = u.paxiOrb;
        orb.remaining -= dt;
        const dx = orb.targetX - orb.x;
        const dy = orb.targetY - orb.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.min(distance, 320 * dt);
        if (distance > 0) { orb.x += dx / distance * step; orb.y += dy / distance * step; }
        champs.filter(e => e.isAlive && e.team !== u.team && !orb.hitIds.includes(e.id)
          && Math.hypot(e.x - orb.x, e.y - orb.y) < 27).forEach(e => {
          if (orb.hitIds.length === 0) {
            skillshotsRef.current.hit++;
            recordSkillshot(insightsRef.current, u, true, matchTimeRef.current);
          }
          orb.hitIds.push(e.id);
          applyDamageToChampion(u, e, u.champion.skill1.damage, false, u.champion.skill1.name, 'skill1');
        });
        if (orb.remaining <= 0) u.paxiOrb = undefined;
      }
      if (u.blackHole) {
        const hole = u.blackHole;
        if (u.stunTimer > 0 || (u.knockupTimer ?? 0) > 0 || (u.fearTimer ?? 0) > 0 || (u.charmTimer ?? 0) > 0 || (u.silenceTimer ?? 0) > 0) {
          u.blackHole = undefined;
          recordBlackHoleInterrupt(insightsRef.current, u, matchTimeRef.current);
          addEvent(`${u.player.name}'s Singularity Well was interrupted!`, 'combo');
        } else {
          hole.remaining -= dt;
          hole.tick += dt;
          champs.filter(e => e.isAlive && e.team !== u.team && Math.hypot(e.x - hole.x, e.y - hole.y) < BLACK_HOLE_RADIUS)
            .forEach(e => {
              const dx = hole.x - e.x;
              const dy = hole.y - e.y;
              const distance = Math.max(1, Math.hypot(dx, dy));
              const step = Math.min(distance, 95 * dt);
              e.x += dx / distance * step;
              e.y += dy / distance * step;
              e.stunTimer = Math.max(e.stunTimer, 0.18);
              if (hole.tick >= 0.4) applyDamageToChampion(u, e, 32, false, 'Singularity Well', 'ultimate');
            });
          if (hole.tick >= 0.4) hole.tick = 0;
          if (hole.remaining <= 0) u.blackHole = undefined;
          u.animState = 'cast';
          if (u.blackHole) return;
        }
      }
      if (u.corsaraBarrage) {
        const barrage = u.corsaraBarrage;
        if (u.stunTimer > 0 || (u.knockupTimer ?? 0) > 0 || (u.fearTimer ?? 0) > 0
          || (u.charmTimer ?? 0) > 0 || (u.silenceTimer ?? 0) > 0) {
          u.corsaraBarrage = undefined;
          addEvent(`${u.player.name}'s Broadside Waltz was interrupted!`, 'combo');
        } else {
          barrage.remaining -= dt;
          barrage.tick += dt;
          while (barrage.tick >= 0.5) {
            barrage.tick -= 0.5;
            champs.filter(e => e.isAlive && e.team !== u.team && (e.x - u.x) * (barrage.facing === 'right' ? 1 : -1) > 0)
              .filter(e => {
                const forward = Math.abs(e.x - u.x);
                return forward <= 260 && Math.abs(e.y - u.y) <= forward * 0.55 + 24;
              }).forEach(e => applyDamageToChampion(u, e, u.champion.ultimate.damage / 6, false, 'Broadside Waltz', 'ultimate'));
          }
          u.animState = 'cast'; u.vx = 0; u.vy = 0;
          if (barrage.remaining <= 0) u.corsaraBarrage = undefined;
          if (u.corsaraBarrage) return;
        }
      }
      if (u.monkeySpin) {
        const spin = u.monkeySpin;
        spin.remaining -= dt; spin.tick += dt;
        while (spin.tick >= 0.4) {
          spin.tick -= 0.4;
          champs.filter(e => e.isAlive && e.team !== u.team && Math.hypot(e.x - u.x, e.y - u.y) <= 105)
            .forEach(e => {
              if (!spin.hitIds.includes(e.id)) {
                spin.hitIds.push(e.id);
                applyChampionCrowdControl(u, e, 0.65, 'knockup', 'Cyclone Dance');
              }
              applyDamageToChampion(u, e, u.champion.ultimate.damage / 5, false, 'Cyclone Dance', 'ultimate');
            });
        }
        u.animState = 'cast';
        if (spin.remaining <= 0) u.monkeySpin = undefined;
        if (u.monkeySpin) return;
      }
      if (u.monkeyCourt) {
        const court = u.monkeyCourt;
        court.remaining -= dt; court.tick += dt;
        while (court.tick >= 0.6) {
          court.tick -= 0.6;
          champs.filter(e => e.isAlive && e.team !== u.team && Math.hypot(e.x - court.x, e.y - court.y) <= 120)
            .forEach(e => applyDamageToChampion(u, e, u.champion.ultimate.damage / 7, false, 'Court of Branches', 'ultimate'));
        }
        if (court.remaining <= 0) u.monkeyCourt = undefined;
      }
      if (u.dash) {
        const dash = u.dash;
        dash.startX ??= u.x;
        dash.startY ??= u.y;
        const dx = dash.targetX - u.x;
        const dy = dash.targetY - u.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.min(distance, dash.speed * dt);
        if (distance > 0) { u.x += dx / distance * step; u.y += dy / distance * step; u.facing = dx >= 0 ? 'right' : 'left'; }
        dash.remaining -= dt;
        u.animState = 'walk';
        const hit = champs.find(e => e.team !== u.team && e.isAlive && Math.hypot(e.x - u.x, e.y - u.y) < (dash.kind === 'kaolin_roll' ? 35 : 28));
        if (hit && dash.kind === 'raijin_bolt' && !(dash.hitIds ?? []).includes(hit.id)) {
          (dash.hitIds ??= []).push(hit.id);
          applyDamageToChampion(u, hit, dash.damage ?? u.champion.ultimate.damage, false, '⚡ Ball Lightning');
        }
        if (dash.kind === 'renn_rush') {
          champs.filter(e => e.team !== u.team && e.isAlive && !(dash.hitIds ?? []).includes(e.id)
            && Math.hypot(e.x - u.x, e.y - u.y) < 40).forEach(e => {
              (dash.hitIds ??= []).push(e.id);
              e.charmTimer = Math.max(e.charmTimer, 1.5); e.charmSourceId = u.id;
              applyDamageToChampion(u, e, dash.damage ?? 180, false, 'Dazzling Rush', 'ultimate');
            });
        }
        if (hit && (dash.kind === 'renn_vault' || dash.kind === 'kaolin_roll' || dash.kind === 'cinder_lunge' || dash.kind === 'canopy_bound')) {
          if (dash.kind === 'renn_vault') {
            spellsRef.current.push({ id: random().toString(), type: 'grand_entrance', x: u.x, y: u.y,
              radius: 65, duration: 0.8, maxDuration: 0.8, color: '#f59e0b' });
            champs.filter(e => e.team !== u.team && e.isAlive && Math.hypot(e.x - u.x, e.y - u.y) < 65)
              .forEach(e => { applyChampionCrowdControl(u, e, 1.2, 'knockup', 'Gilded Vault'); applyDamageToChampion(u, e, dash.damage ?? 115, false, 'Gilded Vault', 'skill1'); });
          } else if (dash.kind === 'kaolin_roll') {
            applyChampionCrowdControl(u, hit, 0.8, 'knockup', 'Rolling Boulder');
            applyDamageToChampion(u, hit, dash.damage ?? 105, false, 'Rolling Boulder', 'skill2');
          } else if (dash.kind === 'canopy_bound') {
            champs.filter(e => e.team !== u.team && e.isAlive && Math.hypot(e.x - u.x, e.y - u.y) < 60)
              .forEach(e => applyDamageToChampion(u, e, dash.damage ?? 105, false, 'Canopy Bound', 'skill2'));
            spellsRef.current.push({ id: random().toString(), type: 'canopy_landing', x: u.x, y: u.y,
              radius: 65, duration: 0.8, maxDuration: 0.8, color: '#86efac', avatarName: 'Stonebranch', abilitySlot: 'skill2' });
          }
          u.dash = undefined;
        } else if (distance <= step + 1 || dash.remaining <= 0) {
          if (dash.kind === 'raijin_bolt') {
            champs.filter(enemy => enemy.team !== u.team && enemy.isAlive
              && !(dash.hitIds ?? []).includes(enemy.id) && Math.hypot(enemy.x - u.x, enemy.y - u.y) <= 55)
              .forEach(enemy => {
                (dash.hitIds ??= []).push(enemy.id);
                applyDamageToChampion(u, enemy, dash.damage ?? u.champion.ultimate.damage, false, '⚡ Ball Lightning');
              });
          }
          u.dash = undefined;
        }
        return;
      }

      // Check bush status
      const bush = getBushAt(u.x, u.y);
      u.isInBush = !!bush;
      u.currentBushId = bush?.id;

      // Vision Master & Strategic Warding
      const isVisionMaster = hasPlayerTrait(u.player, 'Vision Master');
      const wardCooldown = 50;

      // Deep pit warding for Vision Master
      if (isVisionMaster && matchTimeRef.current >= (u.wardReadyAt ?? 0) && matchTimeRef.current > 25) {
        const dragonPitDist = Math.hypot(dragon.x - u.x, dragon.y - u.y);
        const hasDragonPitWard = wardsRef.current.some(w => w.team === u.team && Math.hypot(w.x - dragon.x, w.y - dragon.y) < 260);
        if (dragon.isAlive && dragonPitDist <= 380 && !hasDragonPitWard) {
          wardsRef.current.push({
            id: `pit_${u.id}_${matchTimeRef.current}`,
            team: u.team,
            bushId: 'pit_dragon',
            x: dragon.x,
            y: dragon.y,
            expiresAt: matchTimeRef.current + 85
          });
          u.wardReadyAt = matchTimeRef.current + wardCooldown;
          floatsRef.current.push({ id: random().toString(), x: dragon.x, y: dragon.y - 25,
            text: '👁️ PIT WARD PLACED', color: '#10b981', opacity: 1, scale: 1.0 });
        }
        const golem = jungleCamps.find(c => c.type === 'siege_golem' && c.isAlive);
        if (golem && matchTimeRef.current >= (u.wardReadyAt ?? 0)
          && Math.hypot(golem.x - u.x, golem.y - u.y) <= 380
          && !wardsRef.current.some(w => w.team === u.team && Math.hypot(w.x - golem.x, w.y - golem.y) < 260)) {
          wardsRef.current.push({ id: `pit_${u.id}_${matchTimeRef.current}`, team: u.team,
            bushId: 'pit_golem', x: golem.x, y: golem.y, expiresAt: matchTimeRef.current + 85 });
          u.wardReadyAt = matchTimeRef.current + wardCooldown;
        }
      }

      const nearbyBush = ARAM_BUSHES.find(b => Math.hypot(b.x - u.x, b.y - u.y) < 155
        && !wardsRef.current.some(w => w.team === u.team && w.bushId === b.id));
      if (nearbyBush && matchTimeRef.current >= (u.wardReadyAt ?? 0) && matchTimeRef.current > 30) {
        wardsRef.current.push({ id: `${u.id}_${matchTimeRef.current}`, team: u.team, bushId: nearbyBush.id,
          x: nearbyBush.x, y: nearbyBush.y, expiresAt: matchTimeRef.current + 75 });
        u.wardReadyAt = matchTimeRef.current + wardCooldown;
        floatsRef.current.push({ id: random().toString(), x: nearbyBush.x, y: nearbyBush.y - 20,
          text: isVisionMaster ? '👁️ MASTER WARD' : 'WARD PLACED', color: isVisionMaster ? '#10b981' : '#a3e635', opacity: 1, scale: 0.95 });
      }

      // Recovery to Idle
      if (u.attackTimer <= 1.0 / Math.max(0.5, u.champion.aspd) - 0.28) {
        if (u.animState === 'attack') u.animState = 'idle';
      }

      // A landed hook keeps its victim attached to a visible chain while the
      // victim travels. It stops short of the caster and does not teleport.
      if (u.hookPull) {
        const source = champs.find(c => c.id === u.hookPull?.sourceId && c.isAlive);
        if (!source) {
          u.hookPull = undefined;
        } else {
          const startX = u.x;
          const startY = u.y;
          const next = advanceHookPull(u, source, dt);
          u.x = next.x;
          u.y = next.y;
          u.vx = (u.x - startX) / dt;
          u.vy = (u.y - startY) / dt;
          u.facing = source.x >= u.x ? 'right' : 'left';
          u.animState = 'walk';
          u.hookPull.remaining -= dt;
          if (next.done || u.hookPull.remaining <= 0) u.hookPull = undefined;
          else return;
        }
      }

      // 1. Actual Charm Walk (Kyumi / Renn)
      if (u.charmTimer > 0) {
        if (u.isRecalling) { u.isRecalling = false; u.recallTimer = 0; u.recallCooldown = 4.0; }
        const caster = champs.find((c) => c.id === u.charmSourceId && c.isAlive)
          || champs.find((c) => c.team !== u.team && c.isAlive && (c.champion.name === 'Kyumi' || c.champion.name === 'Renn'));
        if (caster) {
          const dx = caster.x - u.x;
          const dy = caster.y - u.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 32) {
            u.facing = dx >= 0 ? 'right' : 'left';
            u.x += (dx / dist) * 75 * dt;
            u.y += (dy / dist) * 75 * dt;
            u.animState = 'walk';
          }
        }
        return;
      }

      // 2. Actual Fear Flee (Sylla / Soulscourge)
      if (u.fearTimer && u.fearTimer > 0) {
        if (u.isRecalling) { u.isRecalling = false; u.recallTimer = 0; u.recallCooldown = 4.0; }
        const caster = champs.find((c) => c.id === u.fearSourceId && c.isAlive)
          || champs.find((c) => c.team !== u.team && c.isAlive && (c.champion.name === 'Sylla' || c.champion.name === 'Soulscourge'));
        if (caster) {
          const dx = u.x - caster.x;
          const dy = u.y - caster.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          u.facing = dx >= 0 ? 'right' : 'left';
          u.x = Math.max(60, Math.min(ARENA_WIDTH - 60, u.x + (dx / dist) * 125 * dt));
          u.y = Math.max(100, Math.min(600, u.y + (dy / dist) * 125 * dt));
          u.animState = 'walk';
        }
        return;
      }

      // 3. Stun / Knockup Immobilization
      if (u.stunTimer > 0 || (u.knockupTimer && u.knockupTimer > 0)) {
        if (u.isRecalling) {
          u.isRecalling = false;
          u.recallTimer = 0;
          u.recallCooldown = 4.0;
          floatsRef.current.push({
            id: random().toString(),
            x: u.x,
            y: u.y - 35,
            text: `❌ RECALL INTERRUPTED!`,
            color: '#ef4444',
            opacity: 1,
            scale: 1.2
          });
        }
        u.animState = 'idle';
        return;
      }

      // Check if currently inside fountain well recovering
      const inBlueWell = u.team === 'blue' && (u.x <= WELL_X.blue + 105 && Math.abs(u.y - LANE_Y) <= 105);
      const inRedWell = u.team === 'red' && (u.x >= WELL_X.red - 105 && Math.abs(u.y - LANE_Y) <= 105);
      const isInsideWell = inBlueWell || inRedWell;

      // If champion is inside the well, stay in well until HP >= 95% and Mana >= 90!
      if (isInsideWell && (u.hp < u.maxHp * 0.95 || u.mana < 90)) {
        u.animState = 'idle';
        u.vx = 0;
        u.vy = 0;
        return;
      }

      // Relic Pickup
      relics.forEach((r) => {
        if (r.respawnTimer <= 0 && Math.hypot(u.x - r.x, u.y - r.y) <= 32 && (u.hp < u.maxHp || u.mana < 90)) {
          r.respawnTimer = 45.0;
          u.hp = Math.min(u.maxHp, u.hp + r.healAmount);
          u.mana = Math.min(maxMana(u), u.mana + 45);
          sound.playCoin();
          floatsRef.current.push({
            id: random().toString(),
            x: u.x,
            y: u.y - 25,
            text: `+${r.healAmount} HP / +45 Mana! 💧`,
            color: '#10b981',
            opacity: 1,
            scale: 1.2
          });
        }
      });

      // Targets: Enemies, Allies, Dragon, Jungle, Structures, Minions
      const enemies = champs.filter((e) => e.team !== u.team && e.isAlive && ((e.stealthTimer ?? 0) <= 0 || Math.hypot(e.x - u.x, e.y - u.y) < 48) && (!e.isInBush
        || (e.revealedTimer ?? 0) > 0
        || wardsRef.current.some(w => w.team === u.team && w.bushId === e.currentBushId)
        || champs.some(a => a.team === u.team && a.isAlive && a.currentBushId === e.currentBushId)));
      const allies = champs.filter((a) => a.team === u.team && a.isAlive);
      const enemyStructures = structures.filter((st) => st.team !== u.team && st.isAlive
        && (st.type !== 'nexus' || canDamageNexus(st.team, structures)));
      const enemyMinions = minions.filter((m) => m.team !== u.team && m.isAlive);
      const availableJungleCamps = jungleCamps.filter((c) => c.isAlive && c.type !== 'siege_golem');

      // Read the local numbers before committing to a fight.
      const localEnemies = enemies.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) <= 400);
      const localAllies = allies.filter((a) => Math.hypot(a.x - u.x, a.y - u.y) <= 400);
      const iq = Math.max(1, Math.min(99, u.player.stats.iq));
      const tfStat = Math.max(1, Math.min(99, u.player.stats.tf));
      const flxStat = Math.max(1, Math.min(99, u.player.stats.flx));
      const lanStat = Math.max(1, Math.min(99, u.player.stats.lan));
      const readyNullweaver = enemies.find(enemy => isUnitVisibleTo(enemy, u)
        && threatensBlackHole(enemy, isObservedCooling(cooldownMemoryRef.current[u.team], enemy.id,
          'ultimate', matchTimeRef.current)));
      const clusteredAlly = readyNullweaver && allies.filter(ally => ally.id !== u.id)
        .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      if (readyNullweaver && clusteredAlly && shouldSpreadForBlackHole(u, readyNullweaver, clusteredAlly,
        isObservedCooling(cooldownMemoryRef.current[u.team], readyNullweaver.id, 'ultimate', matchTimeRef.current))) {
        const verticalGap = u.y - clusteredAlly.y;
        const side = Math.abs(verticalGap) > 3 ? Math.sign(verticalGap)
          : u.id.localeCompare(clusteredAlly.id) < 0 ? -1 : 1;
        u.y = Math.max(95, Math.min(620, u.y + side * 65 * dt));
      }
      const isOutnumbered = localEnemies.length > localAllies.length + (iq >= 70 ? 0 : 1);
      const losingFight = shouldRetreatLosingFight(u, localAllies, localEnemies,
        cooldownMemoryRef.current, matchTimeRef.current, u.team);
      const deathFearThreshold = 0.30 + (99 - iq) * 0.001;
      const isLowHpScared = u.hp < u.maxHp * deathFearThreshold || (u.mana < 15 && u.hp < u.maxHp * 0.55);

      // AUTHENTIC WEAPON ATTACK RANGES
      const attackRange = getChampionAttackRange(u.champion.name);
      const isRanged = attackRange >= 90;
      const kiteBackstepThreshold = attackRange * 0.65;
      const threateningMinions = enemyMinions.filter(m => Math.hypot(m.x - u.x, m.y - u.y) <= Math.max(attackRange + 40, 240));

      // Skilled shoppers recall on a safe item spike after the mid game.
      const lateShop = matchEconomyPhase(matchTimeRef.current) === 'Late game';
      const hasShopGold = u.gold >= (lateShop ? 1450 : 1700);
      const safeShopWindow = hasShopGold && (u.hp < u.maxHp * 0.65 || (u.gold >= (lateShop ? 1900 : 2400) && iq >= 70))
        && localEnemies.length === 0 && threateningMinions.length === 0 && (u.recallCooldown ?? 0) <= 0;
      const wantsItemPurchase = safeShopWindow
        && !!getItemPurchasePlan(u.champion.primaryRole, u.items, u.gold, u.champion.name, ALL_ITEMS);
      // Unique Card PlayStyle: Clutch King Surge trigger
      if (!losingFight && shouldHoldClutchFight(u, localEnemies.length)) {
        u.clutchCommitActive = true;
        u.clutchCommitTimer = 6.0;
        sound.playUltimateExplosion();
        floatsRef.current.push({
          id: random().toString(),
          x: u.x,
          y: u.y - 36,
          text: '👑 CLUTCH COMMIT!',
          color: '#fbbf24',
          opacity: 1,
          scale: 1.3
        });
        addEvent(`👑 CLUTCH: ${u.player.name} (${u.champion.displayName}) committed to the fight in 1v${localEnemies.length}!`, 'combo');
      }

      const nearestStructureForDive = enemyStructures.sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
      const structureDistForDive = nearestStructureForDive ? Math.hypot(nearestStructureForDive.x - u.x, nearestStructureForDive.y - u.y) : 999;
      const alliedMinionsForDive = minions.filter(m => m.team === u.team && m.isAlive);
      const initialPrimaryTarget = chooseTeamfightTarget(u, enemies, allies, attackRange, {
        enemyStructures,
        alliedMinions: alliedMinionsForDive,
        cooldownMemory: cooldownMemoryRef.current,
        matchSecond: matchTimeRef.current
      });

      // Update dive timers & cooldowns
      u.diveAbortCooldown = Math.max(0, (u.diveAbortCooldown ?? 0) - dt);
      const isInsideEnemyTowerRange = nearestStructureForDive
        ? structureDistForDive <= nearestStructureForDive.range + 30
        : false;

      const alliedMinionsUnderTower = nearestStructureForDive
        ? alliedMinionsForDive.filter(m => Math.hypot(m.x - nearestStructureForDive.x, m.y - nearestStructureForDive.y) <= nearestStructureForDive.range).length
        : 0;
      const defendersUnderTower = nearestStructureForDive
        ? enemies.filter(e => e.isAlive && Math.hypot(e.x - nearestStructureForDive.x, e.y - nearestStructureForDive.y) <= nearestStructureForDive.range).length
        : 0;
      const attackersUnderTower = nearestStructureForDive
        ? allies.filter(a => a.isAlive && Math.hypot(a.x - nearestStructureForDive.x, a.y - nearestStructureForDive.y) <= nearestStructureForDive.range).length
        : 0;

      const isTakingTurretFire = nearestStructureForDive
        ? (nearestStructureForDive.targetId === u.id || nearestStructureForDive.diveAggressorId === u.id)
        : false;

      // Check if active dive has failed and must abort immediately
      if (isInsideEnemyTowerRange && nearestStructureForDive) {
        u.diveTimer = (u.diveTimer ?? 0) + dt;
        const abortCheck = shouldAbortTowerDive({
          diver: u,
          target: initialPrimaryTarget,
          tower: nearestStructureForDive,
          alliedMinionsUnderTower,
          defendersUnderTower,
          diveDuration: u.diveTimer,
          takingTurretFire: isTakingTurretFire
        });
        if (abortCheck.shouldAbort && !u.diveAborting) {
          u.diveAborting = true;
          u.diveAbortCooldown = 3.5;
          u.committedState = 'retreat';
          floatsRef.current.push({
            id: random().toString(),
            x: u.x,
            y: u.y - 36,
            text: '🏃 ABORT DIVE!',
            color: '#f87171',
            opacity: 1,
            scale: 1.25
          });
          addEvent(`🏃 ABORT: ${u.player.name} (${u.champion.displayName}) aborted tower dive: ${abortCheck.reason}!`, 'tower');
        }
      } else {
        u.diveTimer = 0;
        if (structureDistForDive > (nearestStructureForDive?.range ?? 280) + 60) {
          u.diveAborting = false;
        }
      }

      // Evaluate whether to initiate or maintain dive
      const diveEval = nearestStructureForDive && initialPrimaryTarget
        ? evaluateTowerDive({
            diver: u,
            target: initialPrimaryTarget,
            tower: nearestStructureForDive,
            alliedMinionsUnderTower,
            defendersUnderTower,
            attackersUnderTower
          })
        : { canDive: false };

      const traitCanDive = initialPrimaryTarget
        ? canAggroDive(u, initialPrimaryTarget, structureDistForDive, {
            alliedMinionsUnderTower,
            defendersUnderTower,
            attackersUnderTower
          })
        : false;

      const isAggroDiving = !losingFight && !u.diveAborting && (u.diveAbortCooldown ?? 0) <= 0
        && (diveEval.canDive || traitCanDive);

      const isClutchRefusingRetreat = !losingFight && !isTakingTurretFire && u.clutchCommitActive && localEnemies.length > 0;
      const canPunishSpentSkill = !losingFight && !isTakingTurretFire && shouldBaitEnemySkill(u, localEnemies.length) && u.isInBush
        && localEnemies.some(enemy => isObservedCooling(cooldownMemoryRef.current[u.team], enemy.id, 'skill1', matchTimeRef.current)
          || isObservedCooling(cooldownMemoryRef.current[u.team], enemy.id, 'skill2', matchTimeRef.current))
        && u.cd1 <= 0 && u.mana >= 45;

      const hasActiveAlliedChannel = allies.some(a => a.isAlive && a.id !== u.id && isChannelingAbility(a));
      const caughtEnemies = hasActiveAlliedChannel
        ? enemies.filter(enemy => isEnemyCaughtInAlliedChannel(enemy, allies)
          && Math.hypot(enemy.x - u.x, enemy.y - u.y) <= 650) : [];
      const closestCaught = caughtEnemies.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y)
        - Math.hypot(b.x - u.x, b.y - u.y))[0];
      const readyCastRange = Math.max(
        u.cd1 <= 0 && u.mana >= skill1ManaCost(u) ? getSkillCastRange(u.champion.name, 'skill1', attackRange) : 0,
        u.cd2 <= 0 && u.mana >= 35 ? getSkillCastRange(u.champion.name, 'skill2', attackRange) : 0,
        u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)
          ? getSkillCastRange(u.champion.name, 'ultimate', attackRange) : 0,
      );
      const catchUnderTower = !!closestCaught && enemyStructures.some(st => (st.type.includes('tower') || st.type === 'nexus')
        && Math.hypot(st.x - closestCaught.x, st.y - closestCaught.y) <= st.range);
      const canFollowUpEngage = hasActiveAlliedChannel && shouldFollowUpControl({
        healthFraction: u.hp / u.maxHp, caughtEnemies: caughtEnemies.length,
        freeThreats: localEnemies.filter(enemy => !caughtEnemies.some(caught => caught.id === enemy.id)).length,
        nearbyAllies: Math.max(0, localAllies.length - 1),
        distanceToCatch: closestCaught ? Math.hypot(closestCaught.x - u.x, closestCaught.y - u.y) : Infinity,
        attackRange, readyCastRange,
        controlSeconds: closestCaught ? Math.max(0, ...allies.filter(ally => isEnemyCaughtInAlliedChannel(closestCaught, [ally]))
          .map(ally => ally.blackHole?.remaining ?? ally.corsaraBarrage?.remaining ?? ally.monkeySpin?.remaining ?? 0)) : 0,
        moveSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0),
        iq, teamfight: tfStat, losingFight,
        underEnemyTower: catchUnderTower, takingTowerFire: isTakingTurretFire,
        abortingDive: !!u.diveAborting,
      });

      const rawDangerousFight = u.diveAborting || (!canFollowUpEngage && (losingFight || (!canPunishSpentSkill && !isClutchRefusingRetreat && !isAggroDiving && (isLowHpScared || (isOutnumbered && u.hp < u.maxHp * (0.4 + iq * 0.002))))));

      // Decision Commitment & Anti-Spin Damping:
      // Prevents 30Hz fight/retreat flip-flopping caused by minute distance or health changes.
      let isDangerousFight = rawDangerousFight;
      if (u.committedState === 'retreat' && (u.decisionCommitTimer ?? 0) > 0 && localEnemies.length > 0 && !isInsideWell && !canFollowUpEngage) {
        isDangerousFight = true;
      } else if (u.committedState === 'fight' && (u.decisionCommitTimer ?? 0) > 0 && !isLowHpScared && !losingFight) {
        isDangerousFight = false;
      }

      if (isDangerousFight && u.committedState !== 'retreat') {
        u.committedState = 'retreat';
        u.decisionCommitTimer = 0.45;
      } else if (!isDangerousFight && u.committedState !== 'fight' && localEnemies.length > 0) {
        u.committedState = 'fight';
        u.decisionCommitTimer = 0.35;
      } else if (localEnemies.length === 0) {
        u.committedState = undefined;
      }

      const nearestPushDistance = enemyStructures.length
        ? Math.min(...enemyStructures.map(st => Math.hypot(st.x - u.x, st.y - u.y))) : Infinity;
      const pressWonFight = shouldPressWonFight({
        secondsSinceTeamKill: matchTimeRef.current - lastTeamKillAtRef.current[u.team],
        aliveAllies: allies.length,
        aliveEnemies: champs.filter(champ => champ.team !== u.team && champ.isAlive).length,
        healthFraction: u.hp / u.maxHp,
        nearestStructureDistance: nearestPushDistance,
        iq, coachMacro: (u.team === 'blue' ? blueCoach : redCoach)?.playbookBonus ?? 8,
        losingFight: losingFight || u.diveAborting || isTakingTurretFire
          || (localEnemies.length > 0 && isDangerousFight),
      });
      const laneDirection = u.team === 'blue' ? 1 : -1;
      const alliedLaneWave = minions.filter(m => m.team === u.team && m.isAlive
        && Math.abs(m.y - LANE_Y) < 150 && laneDirection * (m.x - u.x) > -800
        && laneDirection * (m.x - u.x) < 400);
      const waveFrontX = alliedLaneWave.length > 0
        ? (laneDirection > 0 ? Math.max(...alliedLaneWave.map(m => m.x)) : Math.min(...alliedLaneWave.map(m => m.x)))
        : undefined;
      const wavePushCall = shouldPushWithWave({
        healthFraction: u.hp / u.maxHp, iq, lan: lanStat,
        coachMacro: (u.team === 'blue' ? blueCoach : redCoach)?.playbookBonus ?? 8,
        alliedWaveCount: alliedLaneWave.length,
        enemyWaveCount: enemyMinions.filter(m => waveFrontX !== undefined
          && Math.hypot(m.x - waveFrontX, m.y - LANE_Y) < 210).length,
        waveFrontDistance: waveFrontX === undefined ? Infinity : Math.abs(waveFrontX - u.x),
        structureDistance: nearestPushDistance, nearbyAllies: localAllies.length,
        nearbyEnemies: localEnemies.length, winningFightWindow: pressWonFight,
      });
      const tempoPush = pressWonFight || wavePushCall;
      const wantsRecall = !tempoPush && !canFollowUpEngage && !canPunishSpentSkill && !isClutchRefusingRetreat && !isAggroDiving && (isDangerousFight || isLowHpScared || wantsItemPurchase) && !isInsideWell && (u.recallCooldown ?? 0) <= 0;

      const wellTargetX = WELL_X[u.team];

      const recoveryRelic = relics.filter(relic => relic.respawnTimer <= 0
        && shouldSeekHealthRelic({
          healthFraction: u.hp / u.maxHp, missingHealth: u.maxHp - u.hp,
          healAmount: relic.healAmount, distance: Math.hypot(relic.x - u.x, relic.y - u.y),
          enemyDistanceToRelic: enemies.length ? Math.min(...enemies.map(enemy => Math.hypot(enemy.x - relic.x, enemy.y - relic.y))) : Infinity,
          enemyDistanceToUnit: localEnemies.length ? Math.min(...localEnemies.map(enemy => Math.hypot(enemy.x - u.x, enemy.y - u.y))) : Infinity,
          followUpEngage: canFollowUpEngage, pushWindow: tempoPush,
          underEnemyTower: isInsideEnemyTowerRange,
        })).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      if (recoveryRelic && !isInsideWell) {
        const distance = Math.hypot(recoveryRelic.x - u.x, recoveryRelic.y - u.y);
        if (distance > 25) {
          const speed = 95 + (u.boots?.stats.moveSpeed ?? 0);
          u.vx = (recoveryRelic.x - u.x) / distance * speed;
          u.vy = (recoveryRelic.y - u.y) / distance * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          u.animState = 'walk';
          setUnitFacing(u, recoveryRelic.x);
          return;
        }
      }

      // 1. If wanting to recall, but enemy minions are threatening nearby: CLEAR FIRST!
      if (wantsRecall && threateningMinions.length > 0 && localEnemies.length === 0 && !u.isInBush) {
        const minionToClear = threateningMinions[0];
        setUnitFacing(u, minionToClear.x);
        const mDist = Math.hypot(minionToClear.x - u.x, minionToClear.y - u.y);
        if (mDist <= attackRange + 15) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            u.revealedTimer = 2.0;
            executeChampionAttack(u, minionToClear, 'minion', u.champion.ad);
          }
        } else {
          u.animState = 'walk';
          const ang = Math.atan2(minionToClear.y - u.y, minionToClear.x - u.x);
          u.vx = Math.cos(ang) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.vy = Math.sin(ang) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // 2. Disengage and walk backward to safety before channeling recall
      const nearestEnemyDist = enemies.length > 0
        ? Math.min(...enemies.map((e) => Math.hypot(e.x - u.x, e.y - u.y)))
        : 999;
      const nearestMinionDist = enemyMinions.length > 0
        ? Math.min(...enemyMinions.map((m) => Math.hypot(m.x - u.x, m.y - u.y)))
        : 999;
      const nearestStructureDist = enemyStructures.length > 0
        ? Math.min(...enemyStructures.map((st) => Math.hypot(st.x - u.x, st.y - u.y)))
        : 999;

      const canChannelRecall = canUnitRecall(
        nearestEnemyDist,
        nearestMinionDist,
        nearestStructureDist,
        u.recallCooldown ?? 0,
        !!u.isInBush
      );

      if (u.champion.name === 'Paxi' && isDangerousFight && localEnemies.length > 0
        && iq >= 55 && flxStat >= 55 && !isInsideWell) {
        if (u.paxiOrb && shouldPaxiEscapeJaunt(u, u.paxiOrb, localEnemies, wellTargetX)) {
          u.x = u.paxiOrb.x; u.y = u.paxiOrb.y;
          u.paxiOrb = undefined;
          recordPaxiJaunt(insightsRef.current, u, matchTimeRef.current, 'escape');
          spellsRef.current.push({ id: random().toString(), type: 'paxi_jaunt', x: u.x, y: u.y,
            radius: 36, duration: 0.5, maxDuration: 0.5, color: '#6ee7b7' });
          addEvent(`PAXI: ${u.player.name} jaunted away from danger!`, 'combo');
          return;
        }
        if (!u.paxiOrb && u.cd1 <= 0 && u.mana >= 45) {
          const direction = wellTargetX < u.x ? -1 : 1;
          setPaxiGroundOrb(u, undefined, direction, 230);
          u.mana -= 45;
          u.cd1 = (u.champion.skill1.cooldown || 7) * abilityCooldownMultiplier(u.level, 'skill1');
          recordAbilityCast(insightsRef.current, u, 'skill1', matchTimeRef.current);
          skillshotsRef.current.fired++;
          recordSkillshot(insightsRef.current, u, false, matchTimeRef.current);
          sound.playAvatarSkill(u.champion.name, 'skill1');
          addEvent(`PAXI: ${u.player.name} sent an escape orb toward home!`, 'combo');
        }
      }

      if ((isDangerousFight || wantsRecall) && Math.abs(u.x - wellTargetX) > 40 && !isInsideWell) {
        // Can only channel recall if threats are cleared, distance is established, and recall is not on cooldown!
        if (wantsRecall && canChannelRecall) {
          u.isRecalling = true;
          u.recallTimer = 2.5;
          u.animState = 'idle'; // MUST be 'idle' so teammates don't mistake it for combat casting!
          u.vx = 0;
          u.vy = 0;
          floatsRef.current.push({
            id: random().toString(),
            x: u.x,
            y: u.y - 35,
            text: wantsItemPurchase ? `🛍️ ITEM SHOP RECALL...` : `💧 SAFE RECALLING...`,
            color: wantsItemPurchase ? '#fbbf24' : '#38bdf8',
            opacity: 1,
            scale: 1.15
          });
          addEvent(wantsItemPurchase
            ? `🛍️ ${u.player.name} (${u.champion.displayName}) found a safe position and is recalling to shop items with ${Math.floor(u.gold)}g!`
            : `💧 ${u.player.name} (${u.champion.displayName}) cleared threats and safely recalled!`, 'fountain');
          return;
        }

        // Otherwise: walk towards safety (duck into nearby bush to take cover or retreat toward fountain well)!
        const nearbyRetreatBush = !u.isInBush && !u.diveAborting && !isInsideEnemyTowerRange
          ? ARAM_BUSHES.find(b => Math.hypot(b.x - u.x, b.y - u.y) < 180
            && isBushSafeFromTowers(b, enemyStructures)
            && (shouldBaitEnemySkill(u, localEnemies.length)
              ? localEnemies.every(enemy => Math.hypot(b.x - enemy.x, b.y - enemy.y) > Math.hypot(u.x - enemy.x, u.y - enemy.y))
              : Math.sign(wellTargetX - u.x) === Math.sign(b.x - u.x)))
          : undefined;

        let targetX = nearbyRetreatBush ? nearbyRetreatBush.x : wellTargetX;
        let targetY = nearbyRetreatBush ? nearbyRetreatBush.y : LANE_Y;

        // Emergency Turret Evacuation vector when aborting or trapped under tower
        if ((u.diveAborting || isInsideEnemyTowerRange) && nearestStructureForDive) {
          const evac = getTurretEvacuationVector(u, nearestStructureForDive, LANE_Y);
          targetX = evac.targetX;
          targetY = evac.targetY;
        }

        const distToTarget = Math.hypot(targetX - u.x, targetY - u.y);

        // Arrival at cover: stop moving to prevent spinning or jitter ONLY IF SAFELY OUTSIDE ENEMY TOWERS!
        if (distToTarget <= 14 && !isInsideEnemyTowerRange) {
          u.x = targetX;
          u.y = targetY;
          u.vx = 0;
          u.vy = 0;
          u.animState = 'idle';
          setUnitFacing(u, targetX);
          return;
        }

        u.animState = 'walk';
        const retreatAngle = Math.atan2(targetY - u.y, targetX - u.x);
        const warhornBonus = allies.some(a => a.isAlive && a.items.some(it => it.id === 'item_shurelyas') && Math.hypot(a.x - u.x, a.y - u.y) <= 240) ? 18 : 0;
        const evacSprint = (u.diveAborting || isInsideEnemyTowerRange) ? 35 : 0;
        const totalSpeed = 105 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0) + warhornBonus + evacSprint;
        u.vx = Math.cos(retreatAngle) * totalSpeed;
        u.vy = Math.sin(retreatAngle) * totalSpeed;
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setUnitFacing(u, targetX);
        return;
      }

      // A team earns an epic objective window by clearing lane, seeing the pit,
      // grouping healthy members and reading enemy numbers. Playback speed is irrelevant.
      const alliedWave = minions.filter(m => m.team === u.team && m.isAlive && Math.abs(m.x - DRAGON_X) < 420);
      const opposingWave = minions.filter(m => m.team !== u.team && m.isAlive && Math.abs(m.x - DRAGON_X) < 420);
      const pushedWave = alliedWave.some(m => u.team === 'blue' ? m.x > DRAGON_X + 80 : m.x < DRAGON_X - 80);
      const nearbyPitAllies = allies.filter(a => Math.hypot(a.x - dragon.x, a.y - dragon.y) < 620);
      const shouldContestDragon = !tempoPush && dragon.isAlive && shouldStartEpicObjective({
        gameSeconds: matchTimeRef.current,
        bossHealthFraction: dragon.hp / dragon.maxHp,
        healthyAllies: nearbyPitAllies.filter(a => a.hp / a.maxHp > 0.58).length,
        nearbyEnemies: enemies.filter(e => Math.hypot(e.x - dragon.x, e.y - dragon.y) < 360).length,
        lanePriority: pushedWave && alliedWave.length >= opposingWave.length,
        hasVision: nearbyPitAllies.some(a => Math.hypot(a.x - dragon.x, a.y - dragon.y) < 340)
          || wardsRef.current.some(w => w.team === u.team && Math.hypot(w.x - dragon.x, w.y - dragon.y) < 230),
        averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
        averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
        chemistry: u.teamChemistry ?? 10,
        coachPlaybook: (u.team === 'blue' ? blueCoach : redCoach)?.playbookBonus ?? 8,
        actorHealthFraction: u.hp / u.maxHp,
      });

      // OPPONENT OBJECTIVE CONTESTATION & REGROUPING:
      // If the opposing team is doing Dragon Embermaw or Siege Golem Gravemarch, and our team has pit vision/scouting,
      // healthy teammates regroup immediately and march to contest!
      const isOpponentAtDragon = dragon.isAlive && dragon.claimTeam !== u.team && (
        (dragon.claimTeam && dragon.claimTeam !== u.team && dragon.hp < dragon.maxHp) ||
        (enemies.filter(e => Math.hypot(e.x - dragon.x, e.y - dragon.y) < 320).length >= 2 && dragon.hp < dragon.maxHp)
      );
      const hasDragonVision = hasObjectiveVision(u.team, dragon, allies, enemies, wardsRef.current);
      const enemiesAtDragon = enemies.filter(e => Math.hypot(e.x - dragon.x, e.y - dragon.y) < 360);
      const healthyContestAllies = allies.filter(a => a.hp / a.maxHp > 0.35).length;
      const shouldContestEnemyDragon = isOpponentAtDragon && hasDragonVision && shouldContestOpponentObjective({
        gameSeconds: matchTimeRef.current,
        bossHealthFraction: dragon.hp / dragon.maxHp,
        healthyAllies: healthyContestAllies,
        enemiesAtBoss: enemiesAtDragon.length,
        hasVisionOfPit: hasDragonVision,
        hasShotcaller: allies.some(a => hasPlayerTrait(a.player, 'Shotcaller')),
        hasStealSpecialist: hasPlayerTrait(u.player, 'Baron Steal'),
        averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
        averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
        chemistry: u.teamChemistry ?? 10,
        actorHealthFraction: u.hp / u.maxHp,
        isDragon: true
      });

      const golem = jungleCamps.find(c => c.type === 'siege_golem' && c.isAlive);
      const golemAllies = golem ? allies.filter(a => Math.hypot(a.x - golem.x, a.y - golem.y) < 610) : [];
      const isOpponentAtGolem = !!golem && golem.isAlive && golem.claimTeam !== u.team
        && !!golem.claimTeam && golem.hp < golem.maxHp;
      const hasGolemVision = !!golem && hasObjectiveVision(u.team, golem, allies, enemies, wardsRef.current);
      const enemiesAtGolem = golem ? enemies.filter(e => Math.hypot(e.x - golem.x, e.y - golem.y) < 360) : [];
      const shouldContestEnemyGolem = !!golem && isOpponentAtGolem && hasGolemVision && !shouldContestEnemyDragon && shouldContestOpponentObjective({
        gameSeconds: matchTimeRef.current,
        bossHealthFraction: golem.hp / golem.maxHp,
        healthyAllies: healthyContestAllies,
        enemiesAtBoss: enemiesAtGolem.length,
        hasVisionOfPit: hasGolemVision,
        hasShotcaller: allies.some(a => hasPlayerTrait(a.player, 'Shotcaller')),
        hasStealSpecialist: hasPlayerTrait(u.player, 'Baron Steal'),
        averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
        averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
        chemistry: u.teamChemistry ?? 10,
        actorHealthFraction: u.hp / u.maxHp,
        isDragon: false
      });

      const coach = u.team === 'blue' ? blueCoach : redCoach;
      const fightPreference = objectiveFightPreference(allies.map(a => a.player), coach, u.player);
      const enemyStartedFightAt = (boss: { x: number; y: number }) => allies.some(ally =>
        Math.hypot(ally.x - boss.x, ally.y - boss.y) < 460
        && !!ally.lastEnemyDamage && matchTimeRef.current - ally.lastEnemyDamage.second <= 2.5
        && champs.some(enemy => enemy.id === ally.lastEnemyDamage?.attackerId && enemy.team !== u.team
          && enemy.isAlive && Math.hypot(enemy.x - boss.x, enemy.y - boss.y) < 520));
      const teamTakingDragon = dragon.isAlive && dragon.claimTeam === u.team && dragon.hp < dragon.maxHp;
      const teamTakingGolem = !!golem && golem.claimTeam === u.team && golem.hp < golem.maxHp;
      const dragonAction = (teamTakingDragon || shouldContestEnemyDragon)
        ? chooseObjectiveAction({ bossHealthFraction: dragon.hp / dragon.maxHp,
          hasVision: hasDragonVision, contestedByEnemy: !!shouldContestEnemyDragon,
          enemyStartedFight: enemyStartedFightAt(dragon), fightPreference }) : 'none';
      const golemAction = golem && dragonAction === 'none' && (teamTakingGolem || shouldContestEnemyGolem)
        ? chooseObjectiveAction({ bossHealthFraction: golem.hp / golem.maxHp,
          hasVision: hasGolemVision, contestedByEnemy: !!shouldContestEnemyGolem,
          enemyStartedFight: enemyStartedFightAt(golem), fightPreference }) : 'none';
      const isContestingDragon = dragonAction === 'fight';
      const isContestingGolem = golemAction === 'fight';
      const postPlan = postObjectivePlanRef.current[u.team];
      const activePostPlan = postPlan && postPlan.until > matchTimeRef.current
        && Math.hypot(u.x - postPlan.x, u.y - postPlan.y) < 680 ? postPlan : undefined;
      const postFightEnemies = activePostPlan?.action === 'fight'
        ? enemies.filter(e => Math.hypot(e.x - activePostPlan.x, e.y - activePostPlan.y) < 650) : [];
      const isPostObjectiveFight = postFightEnemies.length > 0 && dragonAction === 'none' && golemAction === 'none';
      const isObjectiveFight = isContestingDragon || isContestingGolem || isPostObjectiveFight;

      if (isContestingDragon) {
        const contestKey = `contest:dragon:${dragon.slainCount}:${u.team}`;
        if (!objectiveCallsRef.current.has(contestKey)) {
          objectiveCallsRef.current.add(contestKey);
          sound.playUltimateExplosion();
          showBanner('⚔️ TEAMFIGHT ENGAGE!', `${u.team.toUpperCase()} ${teamTakingDragon ? 'defends Embermaw from attackers' : 'engages the team at Embermaw'}!`, '🐉');
          addEvent(`⚔️ ${u.team.toUpperCase()} chose to fight at Embermaw while it was healthy.`, 'dragon');
        }
      } else if (isContestingGolem && golem) {
        const contestKey = `contest:golem:${u.team}`;
        if (!objectiveCallsRef.current.has(contestKey)) {
          objectiveCallsRef.current.add(contestKey);
          sound.playSpellHit();
          showBanner('⚔️ TEAMFIGHT ENGAGE!', `${u.team.toUpperCase()} ${teamTakingGolem ? 'defends Gravemarch from attackers' : 'engages the team at Gravemarch'}!`, '🗿');
          addEvent(`⚔️ ${u.team.toUpperCase()} chose to fight at Gravemarch while it was healthy.`, 'jungle');
        }
      }

      if (isObjectiveFight && hasPlayerTrait(u.player, 'Shotcaller') && (u.shotcallSignalTimer ?? 0) <= 0) {
        u.shotcallSignalTimer = 5.0;
        allies.forEach(a => { a.shotcallSignalTimer = 5.0; });
        floatsRef.current.push({
          id: random().toString(), x: u.x, y: u.y - 35,
          text: '📢 SHOTCALL RALLY!', color: '#8b5cf6', opacity: 1, scale: 1.3
        });
      }

      const enemiesAtContest = isContestingDragon ? enemiesAtDragon : (isContestingGolem ? enemiesAtGolem : postFightEnemies);
      const contestEnemyPool = enemiesAtContest.length > 0 ? enemiesAtContest : enemies;
      const contestTargetOptions = { cooldownMemory: cooldownMemoryRef.current, matchSecond: matchTimeRef.current };
      const contestFightTarget = isObjectiveFight
        ? (chooseTeamfightTarget(u, contestEnemyPool, allies, attackRange, contestTargetOptions)
          || chooseTeamfightTarget(u, enemies, allies, attackRange, contestTargetOptions))
        : undefined;

      // Fight calls use player card attitudes, the shotcaller, coach style and a real enemy attack.
      const primaryTarget = (canFollowUpEngage ? closestCaught : undefined) || contestFightTarget || chooseTeamfightTarget(u, enemies, allies, attackRange, {
        enemyStructures,
        alliedMinions: alliedMinionsForDive,
        cooldownMemory: cooldownMemoryRef.current,
        matchSecond: matchTimeRef.current
      });
      if (u.paxiOrb && primaryTarget && u.player.stats.iq >= 55
        && Math.hypot(primaryTarget.x - u.paxiOrb.x, primaryTarget.y - u.paxiOrb.y) < 90
        && Math.hypot(u.x - u.paxiOrb.x, u.y - u.paxiOrb.y) > 70
        && (primaryTarget.hp / primaryTarget.maxHp < 0.65 || allies.filter(a => Math.hypot(a.x - primaryTarget.x, a.y - primaryTarget.y) < 160).length >= 2)) {
        u.x = u.paxiOrb.x; u.y = u.paxiOrb.y;
        u.paxiOrb = undefined;
        recordPaxiJaunt(insightsRef.current, u, matchTimeRef.current, 'engage');
        spellsRef.current.push({ id: random().toString(), type: 'paxi_jaunt', x: u.x, y: u.y,
          radius: 36, duration: 0.5, maxDuration: 0.5, color: '#6ee7b7' });
        addEvent(`PAXI: ${u.player.name} jaunted to Illusory Orb!`, 'combo');
      }
      const nearestMinion = enemyMinions.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      const enemyNexus = structures.find(st => st.team !== u.team && st.type === 'nexus');
      const focusNexus = !!enemyNexus && shouldFocusExposedNexus(enemyNexus,
        canDamageNexus(enemyNexus.team, structures), iq, coach?.playbookBonus ?? 8);
      const nearestStructure = focusNexus ? enemyNexus
        : enemyStructures.sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
      const minionInRange = !isObjectiveFight && !!nearestMinion && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= attackRange;
      const structureInRange = !isObjectiveFight && !!nearestStructure && Math.hypot(nearestStructure.x - u.x, nearestStructure.y - u.y) <= attackRange + 40;
      const alliedCrash = nearestStructure
        ? minions.filter(m => m.team === u.team && m.isAlive && Math.hypot(m.x - nearestStructure.x, m.y - nearestStructure.y) < 180).length
        : 0;
      const closestEnemyChampion = enemies.length
        ? Math.min(...enemies.map(e => Math.hypot(e.x - u.x, e.y - u.y))) : Infinity;
      const alliedWaveAtNexus = focusNexus && enemyNexus
        ? minions.some(m => m.team === u.team && m.isAlive && Math.hypot(m.x - enemyNexus.x, m.y - enemyNexus.y) < 220)
        : false;
      const blockingNexusMinion = focusNexus && enemyNexus && nearestMinion && minionInRange
        && Math.sign(enemyNexus.x - u.x) * (nearestMinion.x - u.x) >= -20
        && Math.abs(nearestMinion.y - LANE_Y) < 145;
      const clearWaveFirst = !isObjectiveFight && !canFollowUpEngage
        && (focusNexus
          ? !alliedWaveAtNexus && !!blockingNexusMinion
          : ((wavePushCall && minionInRange && alliedCrash < 2)
            || shouldPrioritizeWaveClear(iq, lanStat, minionInRange, structureInRange, alliedCrash, closestEnemyChampion)
            || (shouldLaningDemonClearWave(u, matchTimeRef.current, minionInRange)
              && alliedCrash < 2 && !structureInRange)))
        && (closestEnemyChampion > 160 || !primaryTarget);
      const advanceLimit = laneAdvanceLimit({
        team: u.team, waveFrontX, waveCount: alliedLaneWave.length,
        structureX: nearestStructure?.x, structureRange: nearestStructure?.range,
        exposedNexus: focusNexus, objectiveFight: isObjectiveFight,
      });
      const holdChaseForWave = !!primaryTarget && !canFollowUpEngage && !pressWonFight
        && !isObjectiveFight && !focusNexus
        && primaryTarget.hp / primaryTarget.maxHp > 0.22
        && wouldOverstep(u.team, primaryTarget.x, advanceLimit)
        && closestEnemyChampion > Math.max(150, attackRange + 35);

      // A vulnerable, low-health nexus is a team finish call. Clear a blocking
      // wave first; otherwise attack or route to it before considering camps.
      if (focusNexus && enemyNexus && u.hp > u.maxHp * 0.38
        && (!isObjectiveFight || Math.hypot(enemyNexus.x - u.x, enemyNexus.y - u.y) < 400)
        && !clearWaveFirst
        && (closestEnemyChampion > Math.max(150, attackRange) || enemyNexus.hp / enemyNexus.maxHp <= 0.16)) {
        const nexusDist = Math.hypot(enemyNexus.x - u.x, enemyNexus.y - u.y);
        setUnitFacing(u, enemyNexus.x);
        if (nexusDist <= attackRange + 18) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            executeChampionAttack(u, enemyNexus, 'structure', u.champion.ad);
          }
        } else {
          const angle = Math.atan2(enemyNexus.y - u.y, enemyNexus.x - u.x);
          const speed = 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          u.animState = 'walk';
        }
        return;
      }

      // The secure call owns the next few seconds. A fresh champion hit can
      // interrupt a regroup, but an old hit from the objective fight cannot.
      const wasJustAttacked = !!activePostPlan && !!u.lastEnemyDamage
        && u.lastEnemyDamage.second > activePostPlan.startedAt
        && matchTimeRef.current - u.lastEnemyDamage.second <= 2.5;
      if (activePostPlan?.action === 'regroup' && !focusNexus && !tempoPush && !canFollowUpEngage && !wasJustAttacked && dragonAction === 'none' && golemAction === 'none') {
        const laneX = activePostPlan.x + (u.team === 'blue' ? -90 : 90);
        const laneY = LANE_Y;
        const distance = Math.hypot(laneX - u.x, laneY - u.y);
        if (distance > 20) {
          const angle = Math.atan2(laneY - u.y, laneX - u.x);
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          setUnitFacing(u, laneX);
          u.animState = 'walk';
        } else {
          u.vx = 0; u.vy = 0; u.animState = 'idle';
        }
        return;
      }

      // MACRO OBJECTIVE 1: START DRAGON IN UPPER PIT (Game-Ending Objective Priority)
      const focusDragon = !focusNexus && (!tempoPush || dragonAction === 'finish') && (dragonAction === 'finish' || (dragonAction === 'none' && shouldContestDragon));
      if (!isObjectiveFight && focusDragon && (dragonAction === 'finish' || !primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > 220)) {
        const callKey = `dragon:${dragon.slainCount}:${u.team}`;
        if (!objectiveCallsRef.current.has(callKey)) {
          objectiveCallsRef.current.add(callKey);
          addEvent(dragonAction === 'finish'
            ? `${u.team.toUpperCase()} committed to finish Embermaw before fighting.`
            : `${u.team.toUpperCase()} called Embermaw with wave priority, pit vision, and healthy teammates.`, 'dragon');
        }
        if (dragonAction === 'finish' && dragon.hp / dragon.maxHp <= 0.32 && enemiesAtDragon.length > 0) {
          const finishKey = `finish:dragon:${dragon.slainCount}:${u.team}`;
          if (!objectiveCallsRef.current.has(finishKey)) {
            objectiveCallsRef.current.add(finishKey);
            addEvent(`${u.team.toUpperCase()} called FOCUS EMBERMAW at low health despite the contest.`, 'dragon');
          }
        }
        const dragonDist = Math.hypot(dragon.x - u.x, dragon.y - u.y);
        setUnitFacing(u, dragon.x);

        if (dragonDist <= neutralAttackRange(attackRange, true) + 12) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            u.mana = Math.min(maxMana(u), u.mana + 4);
            u.revealedTimer = 2.0;
            executeChampionAttack(u, dragon, 'dragon', u.champion.ad * 1.2);
          }
        } else {
          u.animState = 'walk';
          const angle = Math.atan2(dragon.y - u.y, dragon.x - u.x);
          u.vx = Math.cos(angle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.vy = Math.sin(angle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      const shouldContestGolem = !tempoPush && !!golem && !shouldContestDragon && shouldStartEpicObjective({
        gameSeconds: matchTimeRef.current, bossHealthFraction: golem.hp / golem.maxHp,
        healthyAllies: golemAllies.filter(a => a.hp / a.maxHp > 0.58).length,
        nearbyEnemies: enemies.filter(e => Math.hypot(e.x - golem.x, e.y - golem.y) < 360).length,
        lanePriority: pushedWave && alliedWave.length >= opposingWave.length,
        hasVision: golemAllies.some(a => Math.hypot(a.x - golem.x, a.y - golem.y) < 350)
          || wardsRef.current.some(w => w.team === u.team && Math.hypot(w.x - golem.x, w.y - golem.y) < 300),
        averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
        averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
        chemistry: u.teamChemistry ?? 10,
        coachPlaybook: (u.team === 'blue' ? blueCoach : redCoach)?.playbookBonus ?? 8,
        actorHealthFraction: u.hp / u.maxHp
      });
      const focusGolem = !focusNexus && (!tempoPush || golemAction === 'finish') && (golemAction === 'finish' || (golemAction === 'none' && shouldContestGolem));
      if (!isObjectiveFight && golem && focusGolem && (golemAction === 'finish' || !primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > 220)) {
        const callKey = `golem:${u.team}`;
        if (!objectiveCallsRef.current.has(callKey)) {
          objectiveCallsRef.current.add(callKey);
          addEvent(golemAction === 'finish'
            ? `${u.team.toUpperCase()} committed to finish Gravemarch before fighting.`
            : `${u.team.toUpperCase()} called Gravemarch after clearing the wave and scouting the lower pit.`, 'jungle');
        }
        if (golemAction === 'finish' && golem.hp / golem.maxHp <= 0.32 && enemiesAtGolem.length > 0) {
          const finishKey = `finish:golem:${u.team}`;
          if (!objectiveCallsRef.current.has(finishKey)) {
            objectiveCallsRef.current.add(finishKey);
            addEvent(`${u.team.toUpperCase()} called FOCUS GRAVEMARCH at low health despite the contest.`, 'jungle');
          }
        }
        const dist = Math.hypot(golem.x - u.x, golem.y - u.y);
        setUnitFacing(u, golem.x);
        if (dist <= neutralAttackRange(attackRange, true) + 12) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            executeChampionAttack(u, golem, 'camp', u.champion.ad * 1.15);
          }
        } else {
          u.animState = 'walk';
          const angle = Math.atan2(golem.y - u.y, golem.x - u.x);
          u.x += Math.cos(angle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
          u.y += Math.sin(angle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
        }
        return;
      }

      // Camp spawn locations are known to both teams. Vision is needed to see
      // the monster and nearby threats, but not to choose a farming route.
      // Support avatars must NEVER farm neutral jungle camps: low basic attack damage and utility kits.
      const isSupportAvatar = u.champion.primaryRole === 'Support' || u.champion.secondaryRole === 'Support' || getAvatarCombatProfile(u.champion).Support >= 2;
      const nearestJungleCamp = !isObjectiveFight && dragonAction === 'none' && golemAction === 'none' && !isSupportAvatar
        ? chooseKnownJungleCamp(availableJungleCamps, {
          x: u.x, y: u.y, team: u.team, hpFraction: u.hp / u.maxHp,
          iq, jungleStrength: getAvatarCombatProfile(u.champion).Jungler,
          gameSeconds: matchTimeRef.current, nearbyEnemyCount: localEnemies.length,
          nearestLaneEnemyDistance: nearestMinion
            ? Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) : Infinity,
          urgentStructurePush: focusNexus || tempoPush,
          role: u.champion.primaryRole,
          supportStrength: getAvatarCombatProfile(u.champion).Support,
        }) : undefined;

      if (nearestJungleCamp) {
        const campHomeX = nearestJungleCamp.homeX ?? nearestJungleCamp.x;
        const campHomeY = nearestJungleCamp.homeY ?? nearestJungleCamp.y;
        const distanceToHome = Math.hypot(campHomeX - u.x, campHomeY - u.y);
        const farmWaypoint = distanceToHome < 50 ? nearestJungleCamp
          : rockApproachWaypoint(u, { x: campHomeX, y: campHomeY });
        const farmX = farmWaypoint.x;
        const farmY = farmWaypoint.y;
        const campDist = Math.hypot(nearestJungleCamp.x - u.x, nearestJungleCamp.y - u.y);
        setUnitFacing(u, farmX);

        if (distanceToHome <= 220 && campDist <= neutralAttackRange(attackRange) + 12) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            u.mana = Math.min(maxMana(u), u.mana + 4);
            u.revealedTimer = 2.0;
            executeChampionAttack(u, nearestJungleCamp, 'camp', u.champion.ad);
          }
        } else {
          u.animState = 'walk';
          const angle = Math.atan2(farmY - u.y, farmX - u.x);
          u.vx = Math.cos(angle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.vy = Math.sin(angle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // Macro Teamfight Grouping: High TF players converge to fight together (exclude channeling allies)
      const fightingAlly = allies.find(a => a.isAlive && !a.isRecalling && !isChannelingAbility(a) && Math.hypot(a.x - u.x, a.y - u.y) <= 500 && (a.animState === 'attack' || a.animState === 'cast'));
      if (!focusNexus && !tempoPush && !canFollowUpEngage && fightingAlly && tfStat >= 55 && (!primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > attackRange)) {
        u.animState = 'walk';
        const groupAngle = Math.atan2(fightingAlly.y - u.y, fightingAlly.x - u.x);
        u.vx = Math.cos(groupAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
        u.vy = Math.sin(groupAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setUnitFacing(u, fightingAlly.x);
        return;
      }

      // Support Macro Tethering: Support champions naturally stick with their living carries / allies for protection and peel
      const nearestLivingCarry = allies.find(a => a.isAlive && a.id !== u.id && !a.isRecalling && Math.hypot(a.x - u.x, a.y - u.y) <= 550);
      if (isSupportAvatar && nearestLivingCarry && !primaryTarget && Math.hypot(nearestLivingCarry.x - u.x, nearestLivingCarry.y - u.y) > 130) {
        u.animState = 'walk';
        const followAngle = Math.atan2(nearestLivingCarry.y - u.y, nearestLivingCarry.x - u.x);
        u.vx = Math.cos(followAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed);
        u.vy = Math.sin(followAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed);
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setUnitFacing(u, nearestLivingCarry.x);
        return;
      }

      // Compute authentic skill cast ranges (e.g. Raijin Electric Vortex strictly 120px / 2-3 hexes)
      const skill1Range = getSkillCastRange(u.champion.name, 'skill1', attackRange);
      const skill2Range = getSkillCastRange(u.champion.name, 'skill2', attackRange);
      const ultRange = getSkillCastRange(u.champion.name, 'ultimate', attackRange);
      const standardCombatRange = Math.max(attackRange * 1.5, skill1Range, skill2Range, u.level >= 6 ? ultRange : 0, 190);
      const isFollowUpEngage = canFollowUpEngage && !!primaryTarget && isEnemyCaughtInAlliedChannel(primaryTarget, allies);
      const maxCombatRange = isFollowUpEngage ? Math.max(standardCombatRange, 650) : standardCombatRange;

      if (isFollowUpEngage && !u.followUpEngageSignaled) {
        u.followUpEngageSignaled = true;
        floatsRef.current.push({
          id: random().toString(),
          x: u.x,
          y: u.y - 32,
          text: '⚔️ FOLLOW-UP ENGAGE!',
          color: '#38bdf8',
          opacity: 1,
          scale: 1.15
        });
        const channeler = allies.find(a => a.isAlive && isChannelingAbility(a));
        if (channeler) {
          addEvent(`⚔️ ENGAGE: ${u.player.name} committed follow-up engage with ${channeler.player.name}!`, 'combo');
        }
      } else if (!canFollowUpEngage && u.followUpEngageSignaled) {
        u.followUpEngageSignaled = false;
      }

      // COMBAT ENGAGEMENT WITH ENEMIES:
      if (!clearWaveFirst && !holdChaseForWave && primaryTarget && Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) <= maxCombatRange) {
        setUnitFacing(u, primaryTarget.x);
        const dist = Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y);
        const haste = u.items.reduce((total, item) => total + (item.stats.haste ?? 0), 0);
        const cooldownFactor = 100 / (100 + haste);
        if (u.champion.name !== 'Kaelen' && u.level >= 6 && u.cdUlt <= 0
          && dist <= ultRange && u.mana < ultimateManaCost(u)) {
          recordManaBlock(insightsRef.current, u, 'ultimate', matchTimeRef.current, ultimateManaCost(u) - u.mana);
        }
        if (u.cd2 <= 0 && dist <= skill2Range && u.mana < 35) {
          recordManaBlock(insightsRef.current, u, 'skill2', matchTimeRef.current, 35 - u.mana);
        }
        if (u.cd1 <= 0 && dist <= skill1Range && u.mana < skill1ManaCost(u)) {
          recordManaBlock(insightsRef.current, u, 'skill1', matchTimeRef.current, skill1ManaCost(u) - u.mana);
        }

        // Skill decisions share the actual mana and cooldown rules used by the cast.
        const isCinder = u.champion.name === 'Cinderlock' || u.champion.name === 'Cinderbloom';
        const kaelenActed = u.champion.name === 'Kaelen' && (u.silenceTimer ?? 0) <= 0
          && processKaelenTurn(u, primaryTarget, enemies);
        if (kaelenActed) {
          // Kaelen's custom orb and D/F spell cycle owns his active casts.
        } else if (u.champion.name !== 'Kaelen' && (u.silenceTimer ?? 0) <= 0 && isCinder && u.cinderQStage
          && shouldUseSkill(u, primaryTarget, enemies, skill1Range)) {
          u.mana -= skill1ManaCost(u);
          u.cd1 = u.cinderQStage === 2 ? u.champion.skill1.cooldown * cooldownFactor : 0;
          u.animState = 'cast';
          castChampionSkill1(u, primaryTarget);
        } else if (u.champion.name !== 'Kaelen' && (u.silenceTimer ?? 0) <= 0 && executeAvatarCombo(u, primaryTarget, enemies, allies, attackRange, cooldownFactor, dt)) {
          // Continue the learned sequence, or wait for its aimed opening cast to hit.
        } else if (u.champion.name !== 'Kaelen' && (u.silenceTimer ?? 0) <= 0
          && (shouldUseUltimate(u, primaryTarget, enemies, allies, ultRange)
            || (u.champion.name === 'Raijin' && u.committedState === 'retreat'
              && u.hp / u.maxHp < 0.55 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)))) {
          u.mana -= ultimateManaCost(u);
          const baseUltCd = ultimateBaseCooldown(u);
          u.cdUlt = u.champion.name === 'Raijin' ? baseUltCd
            : baseUltCd * cooldownFactor * abilityCooldownMultiplier(u.level, 'ultimate');
          u.animState = 'cast';
          if (u.champion.name === 'Raijin') {
            const isDisengaging = u.committedState === 'retreat';
            castRaijinGroundUltimate(
              u,
              isDisengaging ? undefined : primaryTarget,
              enemies,
              isDisengaging ? (u.team === 'blue' ? -1 : 1) : (u.team === 'blue' ? 1 : -1)
            );
          } else {
            castChampionUltimate(u, primaryTarget, enemies);
          }
        }
        // Defensive and setup Skill 2s get a cast window before a ready Skill 1.
        else if (u.champion.name !== 'Kaelen' && (u.silenceTimer ?? 0) <= 0 && shouldUseSecondSkill(u, primaryTarget, enemies, allies, skill2Range)
          && (u.champion.skill2.damage === 0 || ['Cinderbloom', 'Cinderlock', 'Kaolin', 'Tequoia', 'Renn'].includes(u.champion.name))) {
          u.mana -= 35;
          u.cd2 = (u.champion.skill2.cooldown || 10) * cooldownFactor * abilityCooldownMultiplier(u.level, 'skill2');
          u.animState = 'cast';
          castChampionSkill2(u, primaryTarget);
          practiceAvatarCombo(u);
        }
        // 2. Skill 1
        else if (u.champion.name !== 'Kaelen' && (u.silenceTimer ?? 0) <= 0 && shouldUseSkill(u, primaryTarget, enemies, skill1Range)) {
          u.mana -= skill1ManaCost(u);
          u.cd1 = isCinder && u.cinderQStage
            ? (u.cinderQStage === 2 ? (u.champion.skill1.cooldown || 10) * cooldownFactor : 0)
            : isCinder ? 0 : (u.champion.skill1.cooldown || 10.0) * cooldownFactor * abilityCooldownMultiplier(u.level, 'skill1');
          u.animState = 'cast';
          castChampionSkill1(u, primaryTarget);
          practiceAvatarCombo(u);
        }
        // Skill 2 provides follow-up control, defense, or damage between first casts (Authentic Skill Range)
        else if (u.champion.name !== 'Kaelen' && (u.silenceTimer ?? 0) <= 0 && shouldUseSecondSkill(u, primaryTarget, enemies, allies, skill2Range)) {
          u.mana -= 35;
          u.cd2 = (u.champion.skill2.cooldown || 10.0) * cooldownFactor * abilityCooldownMultiplier(u.level, 'skill2');
          u.animState = 'cast';
          castChampionSkill2(u, primaryTarget);
          practiceAvatarCombo(u);
        }
        // 3. Basic Attack & Stutter-Step Kiting
        else if (dist <= attackRange) {
          const isKiting = u.committedState === 'retreat' || dist < kiteBackstepThreshold * 0.88;
          if (isRanged && isKiting && dist < kiteBackstepThreshold * 1.12) {
            u.animState = 'walk';
            const retreatDir = u.team === 'blue' ? -1 : 1;
            u.x += retreatDir * 65 * dt;
            const formationY = getChampionFormationY(u.champion.name, uIdx);
            const dy = formationY - u.y;
            if (Math.abs(dy) > 1.5) {
              u.y += Math.sign(dy) * Math.min(Math.abs(dy), 60 * dt);
            }
          } else {
            u.vx = 0;
            u.vy = 0;
            // When basic attack is on cooldown, step into skill range if close ability (like Raijin Electric Vortex) is ready
            const wantsCloseSkill = (u.cd2 <= 0 && u.mana >= 35 && dist > skill2Range) || (u.cd1 <= 0 && u.mana >= 45 && dist > skill1Range);
            if (wantsCloseSkill && u.attackTimer > 0) {
              u.animState = 'walk';
              const angle = Math.atan2(primaryTarget.y - u.y, primaryTarget.x - u.x);
              u.x += Math.cos(angle) * (70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
              u.y += Math.sin(angle) * (70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
            }
          }

          if (primaryTarget.zhonyaActive && isInsideEnemyTowerRange) {
            u.diveAborting = true;
            u.diveAbortCooldown = 3.5;
            u.committedState = 'retreat';
          }

          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd + (u.censerBuffTimer && u.censerBuffTimer > 0 ? 0.25 : 0));
            u.animState = 'attack';
            u.mana = Math.min(maxMana(u), u.mana + 3.5);
            performChampionAttack(u, primaryTarget);
          }
        }
        // 4. Close the Distance
        else {
          const isTargetUnderEnemyTower = nearestStructureForDive && nearestStructureForDive.isAlive
            && Math.hypot(primaryTarget.x - nearestStructureForDive.x, primaryTarget.y - nearestStructureForDive.y) <= nearestStructureForDive.range;
          if (isTargetUnderEnemyTower && !isAggroDiving && nearestStructureForDive) {
            // Non-divers tether safely at the perimeter outside tower range rather than walking into turret fire!
            const holdPoint = getTurretPerimeterHoldPoint(u, nearestStructureForDive, LANE_Y);
            const distToHold = Math.hypot(holdPoint.x - u.x, holdPoint.y - u.y);
            setUnitFacing(u, primaryTarget.x);
            if (distToHold > 14) {
              u.animState = 'walk';
              const angle = Math.atan2(holdPoint.y - u.y, holdPoint.x - u.x);
              u.vx = Math.cos(angle) * 75;
              u.vy = Math.sin(angle) * 75;
              u.x += u.vx * dt;
              u.y += u.vy * dt;
            } else {
              u.vx = 0;
              u.vy = 0;
              u.animState = 'idle';
            }
          } else {
            u.animState = 'walk';
            const angle = Math.atan2(primaryTarget.y - u.y, primaryTarget.x - u.x);
            const engageSprintBonus = isFollowUpEngage ? 30 : 0;
            const speed = 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0) + engageSprintBonus;
            u.vx = Math.cos(angle) * speed;
            u.vy = Math.sin(angle) * speed;
            u.x += u.vx * dt;
            u.y += u.vy * dt;
          }
        }
      }
      // A fight call pursues enemy champions; a finish call already returned from the objective branch.
      else if (isObjectiveFight) {
        const enemyToEngage = primaryTarget
          || (contestEnemyPool.length > 0 ? contestEnemyPool[0] : null)
          || enemies.find(e => e.isAlive);

        if (enemyToEngage) {
          u.animState = 'walk';
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          const angle = Math.atan2(enemyToEngage.y - u.y, enemyToEngage.x - u.x);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          setUnitFacing(u, enemyToEngage.x);
        } else {
          // If enemies are momentarily obscured in brush, advance toward river engagement approach
          u.animState = 'walk';
          const engageX = DRAGON_X;
          const engageY = isContestingDragon ? 230 : 490;
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          const angle = Math.atan2(engageY - u.y, engageX - u.x);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          setUnitFacing(u, engageX);
        }
      }
      // SIEGE TURRET
      else if (clearWaveFirst && nearestMinion) {
        setUnitFacing(u, nearestMinion.x);
        const cluster = enemyMinions.filter(m => Math.hypot(m.x - nearestMinion.x, m.y - nearestMinion.y) <= 90);
        if (u.champion.name !== 'Cinderlock' && u.champion.name !== 'Cinderbloom' && shouldCastWaveClearSkill(u.champion.primaryRole, u.mana, u.cd1, cluster.length, iq, lanStat)) {
          u.mana -= 45;
          recordAbilityCast(insightsRef.current, u, 'skill1', matchTimeRef.current);
          u.cd1 = (u.champion.skill1.cooldown || 10) * 0.8 * abilityCooldownMultiplier(u.level, 'skill1');
          u.animState = 'cast';
          cluster.forEach(m => applyDamageToMinion(u, m, u.champion.skill1.damage * abilityDamageMultiplier(u.level, 'skill1') * (0.7 + lanStat / 180)));
          spellsRef.current.push({ id: random().toString(), type: 'wave_burst', x: nearestMinion.x, y: nearestMinion.y,
            radius: 90, duration: 0.55, maxDuration: 0.55, color: u.champion.primaryColor });
        } else if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd + (u.censerBuffTimer && u.censerBuffTimer > 0 ? 0.25 : 0));
          u.animState = 'attack';
          executeChampionAttack(u, nearestMinion, 'minion', u.champion.ad);
        }
      }
      else if (nearestStructure && structureInRange) {
        setUnitFacing(u, nearestStructure.x);
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd + (u.censerBuffTimer && u.censerBuffTimer > 0 ? 0.25 : 0));
          u.animState = 'attack';
          executeChampionAttack(u, nearestStructure, 'structure', u.champion.ad);
        }
      }
      // WAVE CLEAR
      else if (nearestMinion && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= attackRange) {
        setUnitFacing(u, nearestMinion.x);
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd + (u.censerBuffTimer && u.censerBuffTimer > 0 ? 0.25 : 0));
          u.animState = 'attack';
          executeChampionAttack(u, nearestMinion, 'minion', u.champion.ad);
        }
      }
      // PUSH LANE IN FORMATION (Smooth, natural walking speed - no snapping or accelerated sprint!)
      else {
        u.animState = 'walk';
        const pushDir = u.team === 'blue' ? 1 : -1;
        const nextX = u.x + pushDir * (70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
        u.x = wouldOverstep(u.team, nextX, advanceLimit)
          ? u.x + Math.sign(advanceLimit - u.x) * Math.min(Math.abs(advanceLimit - u.x), 70 * dt)
          : nextX;
        u.facing = pushDir === 1 ? 'right' : 'left';

        const targetFormY = getChampionFormationY(u.champion.name, uIdx);
        const dy = targetFormY - u.y;
        if (Math.abs(dy) > 1.5) {
          u.y += Math.sign(dy) * Math.min(Math.abs(dy), 70 * dt);
        }
      }

      u.x = Math.max(40, Math.min(ARENA_WIDTH - 40, u.x));
      u.y = Math.max(80, Math.min(620, u.y));
    });

    // 13. PAIRWISE ANTI-CLUMPING SEPARATION PHYSICS
    for (let i = 0; i < champs.length; i++) {
      for (let j = i + 1; j < champs.length; j++) {
        const c1 = champs[i];
        const c2 = champs[j];
        if (!c1.isAlive || !c2.isAlive) continue;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const d = Math.hypot(dx, dy);
        const minDistance = 34;

        if (d < minDistance && d > 0.05) {
          const overlap = (minDistance - d) / 2;
          const nx = dx / d;
          const ny = dy / d;

          // If a unit is channeling recall, only push the other unit so the recall position remains steady!
          if (c1.isRecalling && c2.isRecalling) continue;
          if (c1.isRecalling) {
            c2.x += nx * overlap * 2;
            c2.y += ny * overlap * 2;
          } else if (c2.isRecalling) {
            c1.x -= nx * overlap * 2;
            c1.y -= ny * overlap * 2;
          } else {
            c1.x -= nx * overlap;
            c1.y -= ny * overlap;
            c2.x += nx * overlap;
            c2.y += ny * overlap;
          }

          c1.x = Math.max(40, Math.min(ARENA_WIDTH - 40, c1.x));
          c1.y = Math.max(80, Math.min(620, c1.y));
          c2.x = Math.max(40, Math.min(ARENA_WIDTH - 40, c2.x));
          c2.y = Math.max(80, Math.min(620, c2.y));
        }
      }
    }

    // Raised rock outcrops block all walking units, including dashes and
    // forced movement. Project each tick onto the rock edge so units can
    // slide around it instead of stepping inside the terrain.
    champs.forEach(unit => {
      if (!unit.isAlive) return;
      const start = championStarts.get(unit.id);
      if (start) Object.assign(unit, resolveRockTerrainMovement(start, unit, 13));
    });
    minions.forEach(unit => {
      if (!unit.isAlive) return;
      const start = minionStarts.get(unit.id);
      if (start) Object.assign(unit, resolveRockTerrainMovement(start, unit, unit.siegeGolem ? 28 : 10));
    });
    jungleCamps.forEach(unit => {
      if (!unit.isAlive) return;
      const start = campStarts.get(unit.id);
      if (start) Object.assign(unit, resolveRockTerrainMovement(start, unit, unit.type === 'siege_golem' ? 32 : 23));
    });

    // Check Nexus Victory
    const blueNexus = structures.find((s) => s.id === 'b_nexus');
    const redNexus = structures.find((s) => s.id === 'r_nexus');

    if (redNexus && !redNexus.isAlive && !matchOver) {
      endAramMatch('blue');
    } else if (blueNexus && !blueNexus.isAlive && !matchOver) {
      endAramMatch('red');
    }

    if (!batchMode) setChampions(champs.map((c) => ({ ...c, items: [...c.items] })));
  };

  // Evaluate & Purchase Items progressively
  const evaluateAndBuyItems = (u: AramChampionUnit) => {
    const inHomeShop = Math.abs(u.y - LANE_Y) <= 105 && (u.team === 'blue'
      ? u.x <= WELL_X.blue + 105 : u.x >= WELL_X.red - 105);
    if (!inHomeShop) return;
    if (!u.boots && u.gold >= BOOTS.cost) {
      u.gold -= BOOTS.cost;
      u.boots = BOOTS;
      addEvent(`👢 ${u.player.name} bought Pathfinder Boots at the home shop.`, 'item');
    }
    for (let purchase = 0; purchase < 6; purchase++) {
      const plan = getItemPurchasePlan(u.champion.primaryRole, u.items, u.gold, u.champion.name, ALL_ITEMS);
      if (!plan) break;
      const nextItem = plan.item;
      u.gold -= plan.goldCost;
      for (const removed of plan.removed) {
        const index = u.items.findIndex(item => item.id === removed.id);
        if (index >= 0) u.items.splice(index, 1);
        u.champion.ad -= removed.stats.ad ?? 0;
        u.champion.armor -= removed.stats.armor ?? 0;
        u.champion.mr -= removed.stats.mr ?? 0;
        u.champion.aspd -= removed.stats.aspd ?? 0;
        u.maxHp -= removed.stats.hp ?? 0;
        u.hp = Math.min(u.hp, u.maxHp);
      }
      u.items.push(nextItem);
      u.champion.ad += nextItem.stats.ad ?? 0;
      u.champion.armor += nextItem.stats.armor ?? 0;
      u.champion.mr += nextItem.stats.mr ?? 0;
      u.champion.aspd += nextItem.stats.aspd ?? 0;
      u.maxHp += nextItem.stats.hp ?? 0;
      u.hp += nextItem.stats.hp ?? 0;

      sound.playCoin();
      const mins = Math.floor(matchTimeRef.current / 60);
      const secs = (Math.floor(matchTimeRef.current % 60)).toString().padStart(2, '0');
      const timeStr = `${mins}:${secs}`;

      setItemMilestones((prev) => [
        {
          playerName: u.player.name,
          champName: u.champion.name,
          itemName: nextItem.name,
          itemIcon: nextItem.icon,
          time: timeStr,
          stats: nextItem.tier,
          team: u.team
        },
        ...prev
      ].slice(0, 12));

      showBanner(
        `🛍️ ${u.player.name} completed ${nextItem.name}!`,
        `${nextItem.tier} Spike: ${nextItem.passiveName}`,
        nextItem.icon
      );
      addEvent(`🛍️ ITEM TIMING: ${u.player.name} purchased ${nextItem.name} (${nextItem.icon})!`, 'item');
    }
  };

  const callAfterObjective = (team: 'blue' | 'red', x: number, y: number, name: string,
    eventType: 'dragon' | 'jungle') => {
    const allies = championsRef.current.filter(c => c.team === team && c.isAlive);
    const nearbyAllies = allies.filter(c => Math.hypot(c.x - x, c.y - y) < 650);
    const nearbyEnemies = championsRef.current.filter(c => c.team !== team && c.isAlive
      && Math.hypot(c.x - x, c.y - y) < 650);
    const preference = objectiveFightPreference(allies.map(c => c.player), team === 'blue' ? blueCoach : redCoach);
    const action = choosePostObjectiveAction({ fightPreference: preference,
      nearbyEnemies: nearbyEnemies.length,
      healthyAllies: nearbyAllies.filter(c => c.hp / c.maxHp > 0.45).length,
      healthyEnemies: nearbyEnemies.filter(c => c.hp / c.maxHp > 0.45).length,
      averageHealthFraction: nearbyAllies.reduce((sum, c) => sum + c.hp / c.maxHp, 0) / Math.max(1, nearbyAllies.length) });
    postObjectivePlanRef.current[team] = { x, y, action,
      startedAt: matchTimeRef.current, until: matchTimeRef.current + 6 };
    addEvent(`${team.toUpperCase()} secured ${name} and called to ${action === 'fight' ? 'press the nearby fight' : 'regroup toward lane'}.`, eventType);
  };

  // Attack Dragon Boss
  const applyDamageToDragon = (attacker: AramChampionUnit, damage: number) => {
    const dragon = dragonRef.current;
    if (!dragon.isAlive) return;

    if (!dragon.claimTeam || !championsRef.current.some(c => c.team === dragon.claimTeam && c.isAlive
      && Math.hypot(c.x - dragon.x, c.y - dragon.y) < 360)) dragon.claimTeam = attacker.team;
    dragon.aggroTeam = attacker.team;
    dragon.targetId = attacker.id;
    dragon.hp -= damage;
    floatsRef.current.push({
      id: random().toString(),
      x: dragon.x + (random() - 0.5) * 40,
      y: dragon.y - 30,
      text: `-${Math.round(damage)}`,
      color: '#fb923c',
      opacity: 1,
      scale: 1.1
    });

    if (dragon.hp <= 0) {
      dragon.isAlive = false;
      callAfterObjective(attacker.team, dragon.x, dragon.y, 'Embermaw', 'dragon');
      dragon.slainCount++;
      dragon.spawnTimer = 120.0;
      sound.playUltimateExplosion();

      aegisBuffRef.current = {
        team: attacker.team,
        expiresAt: matchTimeRef.current + 90.0,
        adBonus: 45,
        apBonus: 50,
        siegeMultiplier: 1.5,
        burnTrueDamage: true
      };

      const bounty = 250;
      championsRef.current
        .filter((c) => c.team === attacker.team)
        .forEach((ally) => {
          ally.gold += bounty;
          grantChampionXp(ally, 320);
          ally.shield += 300;
        });

      showBanner(
        `🐉 ${attacker.team.toUpperCase()} TEAM SLAIN EMBERMAW!`,
        `Dragon Slayer Aspect! +45 AD, +50 AP, 1.5x Tower Siege Damage, and True Damage Burn!`,
        '🐉'
      );
      addEvent(`🐉 DRAGON SLAIN: ${attacker.player.name} secured Embermaw! Team claimed Dragon Slayer Aspect!`, 'dragon');
    }
  };

  // Farm Neutral Jungle Camps
  const applyDamageToJungleCamp = (attacker: AramChampionUnit, camp: JungleCamp, damage: number) => {
    if (!camp.isAlive) return;

    const homeX = camp.homeX ?? camp.x;
    const homeY = camp.homeY ?? camp.y;
    const leashRadius = camp.type === 'siege_golem' ? 300 : 220;
    if (Math.hypot(attacker.x - homeX, attacker.y - homeY) > leashRadius) return;

    if (!camp.targetId) camp.attackTimer = Math.max(camp.attackTimer, 0.4);
    if (!camp.claimTeam || !championsRef.current.some(c => c.team === camp.claimTeam && c.isAlive
      && Math.hypot(c.x - camp.x, c.y - camp.y) < 320)) camp.claimTeam = attacker.team;
    camp.targetId = attacker.id;
    camp.hurtTimer = 0.25;
    camp.patience = CAMP_PATIENCE_SECONDS;
    camp.resetElapsed = 0;
    camp.hp -= damage;
    floatsRef.current.push({
      id: random().toString(),
      x: camp.x + (random() - 0.5) * 20,
      y: camp.y - 20,
      text: `-${Math.round(damage)}`,
      color: '#facc15',
      opacity: 1,
      scale: 0.95
    });

    if (camp.hp <= 0) {
      camp.isAlive = false;
      if (camp.type === 'siege_golem') callAfterObjective(attacker.team, camp.x, camp.y, 'Gravemarch', 'jungle');
      camp.targetId = undefined;
      camp.respawnTimer = neutralCampRespawnSeconds(camp.type) ?? 0;
      attacker.gold += camp.goldReward;
      grantChampionXp(attacker, camp.xpReward);
      if (camp.type === 'blue_buff' || camp.type === 'red_buff') {
        const kind = camp.type === 'blue_buff' ? 'blue' : 'red';
        jungleBuffsRef.current[attacker.team][kind] = matchTimeRef.current + 90;
        addEvent(`${attacker.team.toUpperCase()} team claimed ${kind} buff for 90s!`, 'jungle');
      }
      if (camp.type === 'siege_golem') {
        pendingSiegeGolemRef.current[attacker.team] = true;
        showBanner('GRAVEMARCH CLAIMED', `${attacker.team.toUpperCase()} Colossus joins the next wave and can charge towers!`, '🗿');
        addEvent(`${attacker.team.toUpperCase()} claimed the one-time Gravemarch Colossus. It joins the next creep wave!`, 'jungle');
      }
      sound.playCoin();

      floatsRef.current.push({
        id: random().toString(),
        x: camp.x,
        y: camp.y - 30,
        text: `+${camp.goldReward}g 🌲`,
        color: '#facc15',
        opacity: 1,
        scale: 1.2
      });

      addEvent(`🌲 JUNGLE: ${attacker.player.name} cleared ${camp.name} (+${camp.goldReward}g)!`, 'jungle');
    }
  };

  // Apply Authentic Crowd Control & Layered Chain Stun Mechanics
  const applyChampionCrowdControl = (
    caster: AramChampionUnit | null,
    target: AramChampionUnit,
    duration: number,
    ccType: 'stun' | 'root' | 'knockup' = 'stun',
    skillName?: string
  ) => {
    if (target.zhonyaActive || !target.isAlive) return;

    if (!caster) {
      target.stunTimer = Math.max(target.stunTimer, duration);
      if (ccType === 'knockup') {
        target.knockupTimer = Math.max(target.knockupTimer ?? 0, duration);
        target.knockupMax = target.knockupTimer;
      }
      return;
    }

    const casterIq = caster.player.stats.iq;
    const casterTf = caster.player.stats.tf;
    const teamChemistry = caster.teamChemistry ?? 10;
    const castSlot = skillName === caster.champion.ultimate.name ? 'ultimate' : caster.activeAbilitySlot ?? 'skill1';
    const scaledDuration = duration * Math.min(1.1, 0.55 + 0.45 * abilityDamageMultiplier(caster.level, castSlot));

    const tenacityDuration = scaledDuration;
    if (hasPlayerTrait(target.player, 'Ice in Veins')) {
      target.iceFocusTimer = Math.max(target.iceFocusTimer ?? 0, tenacityDuration + 1);
    }

    const { isChainStun, finalDuration } = applyChainStun(
      target.stunTimer,
      tenacityDuration,
      casterIq,
      casterTf,
      teamChemistry
    );

    target.stunTimer = finalDuration;
    if (ccType === 'knockup') {
      target.knockupTimer = Math.max(target.knockupTimer ?? 0, tenacityDuration);
      target.knockupMax = Math.max(target.knockupMax ?? 0, target.knockupTimer);
    }

    if (isChainStun) {
      sound.playSpellHit();
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 45,
        text: `⚡ CHAIN STUN!`,
        color: '#facc15',
        opacity: 1,
        scale: 1.3
      });
      addEvent(`⚡ CHAIN STUN: ${caster.player.name} (${caster.champion.displayName}) layered CC on ${target.player.name} for ${finalDuration.toFixed(1)}s!`, 'combo');
    }
  };

  const handleProjectileImpact = (p: Projectile) => {
    sound.playSpellHit();

    if (p.targetUnitId) {
      const targetChamp = championsRef.current.find((c) => c.id === p.targetUnitId && c.isAlive);
      const targetMinion = minionsRef.current.find((m) => m.id === p.targetUnitId && m.isAlive);
      const targetStructure = structuresRef.current.find((st) => st.id === p.targetUnitId && st.isAlive);
      const attackerChamp = championsRef.current.find((c) => c.id === p.attackerId);

      if (targetChamp) {
        if (p.skillshot) {
          if (p.stunOnHit) {
            applyChampionCrowdControl(attackerChamp ?? null, targetChamp, p.stunOnHit, 'stun', p.skillLabel);
          }
          targetChamp.charmTimer = Math.max(targetChamp.charmTimer, p.charmOnHit ?? 0);
          if (p.hookOnHit && attackerChamp && p.type === 'hook') {
            if (targetChamp.isRecalling) {
              targetChamp.isRecalling = false;
              targetChamp.recallTimer = 0;
              targetChamp.recallCooldown = 4;
            }
            targetChamp.hookPull = {
              sourceId: attackerChamp.id,
              kind: attackerChamp.champion.name as 'Mirehook' | 'Voltgrip' | 'Wraithhook',
              remaining: 1.1
            };
            targetChamp.revealedTimer = Math.max(targetChamp.revealedTimer ?? 0, 1.1);
            floatsRef.current.push({ id: random().toString(), x: targetChamp.x, y: targetChamp.y - 48,
              text: 'GRABBED!', color: p.color, opacity: 1, scale: 1.25 });
          }
          applyDamageToChampion(attackerChamp ?? null, targetChamp, p.damage, !!p.trueDamage, p.skillLabel, p.abilitySlot ?? 'skill1');
          if (p.splashRadius && attackerChamp) {
            championsRef.current.filter(c => c.team !== attackerChamp.team && c.id !== targetChamp.id && c.isAlive
              && Math.hypot(c.x - targetChamp.x, c.y - targetChamp.y) < p.splashRadius!)
              .forEach(c => applyDamageToChampion(attackerChamp, c, p.damage * 0.55, !!p.trueDamage, p.skillLabel, p.abilitySlot ?? 'skill1'));
          }
          if (p.aetherisOrb && attackerChamp?.champion.name === 'Aetheris') {
            const orbiting = attackerChamp.aetherisOrbs;
            if (orbiting && orbiting.charges > 0) orbiting.charges--;
            spellsRef.current.push({
              id: random().toString(),
              type: 'aetheris_orb_explosion',
              x: targetChamp.x,
              y: targetChamp.y,
              radius: 78,
              duration: 0.65,
              maxDuration: 0.65,
              color: '#7dd3fc',
              extraText: 'SPIRIT BURST',
              avatarName: 'Aetheris',
              abilitySlot: 'skill1'
            });
          }
          if (p.healAlliesOnHit && attackerChamp) {
            championsRef.current.filter(c => c.team === attackerChamp.team && c.isAlive && Math.hypot(c.x - attackerChamp.x, c.y - attackerChamp.y) < 190)
              .forEach(c => { c.hp = Math.min(c.maxHp, c.hp + p.healAlliesOnHit! * abilityDamageMultiplier(attackerChamp.level, 'skill1')); emitSkillEffect(attackerChamp, c, false, p.skillLabel || 'Dusk Lance', 'skill1'); });
          }
          if (attackerChamp) emitSkillEffect(attackerChamp, targetChamp, false, p.skillLabel, 'skill1');
          if (p.comboStage && attackerChamp?.comboStage === p.comboStage && attackerChamp.comboTargetId === targetChamp.id) {
            attackerChamp.comboHitConfirmed = true;
            attackerChamp.mana = Math.min(maxMana(attackerChamp), attackerChamp.mana + 45);
          }
          return;
        }
        applyDamageToChampion(attackerChamp || null, targetChamp, p.damage, !!p.trueDamage || p.type === 'turret_shot',
          p.trueDamage ? 'Nexus True Strike' : p.type === 'turret_shot' ? '🏰 Turret' : p.type === 'boss_breath' ? '🔥 Flame Breath'
            : p.type === 'jungle_shot' ? '🌲 Jungle Camp' : undefined);
      } else if (targetMinion) {
        if (attackerChamp) {
          applyDamageToMinion(attackerChamp, targetMinion, p.damage * (p.skillshot ? abilityDamageMultiplier(attackerChamp.level, p.abilitySlot ?? 'skill1') : 1));
        } else {
          targetMinion.hp -= p.damage;
          if (targetMinion.hp <= 0 && targetMinion.isAlive) {
            targetMinion.isAlive = false;
          }
        }
      } else if (targetStructure) {
        if (attackerChamp) {
          applyDamageToStructure(attackerChamp, targetStructure, p.damage);
        } else {
          damageStructure(targetStructure, p.damage);
        }
      } else {
        const targetCamp = jungleCampsRef.current.find((c) => c.id === p.targetUnitId && c.isAlive);
        if (targetCamp && attackerChamp) {
          applyDamageToJungleCamp(attackerChamp, targetCamp, p.damage);
        } else if (dragonRef.current.id === p.targetUnitId && dragonRef.current.isAlive && attackerChamp) {
          applyDamageToDragon(attackerChamp, p.damage);
        }
      }

      floatsRef.current.push({
        id: random().toString(),
        x: p.x,
        y: p.y - 10,
        text: '✨',
        color: p.color || '#facc15',
        opacity: 0.85,
        scale: 0.85
      });
    }
  };

  const applyMinionDamage = (m: LaneMinion, target: LaneMinion | LaneStructure | AramChampionUnit) => {
    if ('armor' in target) {
      const siegeDmg = getMinionStructureDamage(m.type, m.ad);
      damageStructure(target, siegeDmg);
      return;
    }
    if ('player' in target) {
      applyDamageToChampion(null, target, m.ad, false, 'Creep');
      return;
    }
    target.hp -= m.ad;
    if (target.hp <= 0 && target.isAlive) {
      target.isAlive = false;
    }
  };

  const getChampionBasicProjectile = (champ: ChampionKit): {
    type: Projectile['type'];
    color: string;
    speed: number;
    size: number;
  } => {
    switch (champ.name) {
      case 'Astra':
        return { type: 'arrow', color: '#38bdf8', speed: 520, size: 5 };
      case 'Kindra':
      case 'Kindra & Grim':
        return { type: 'spirit_arrow', color: '#a855f7', speed: 520, size: 5 };
      case 'Cora':
        return { type: 'feather', color: '#ec4899', speed: 530, size: 5 };
      case 'Tequoia':
        return { type: 'nature_bolt', color: '#22c55e', speed: 480, size: 6 };
      case 'Zal':
        return { type: 'poison_dart', color: '#d946ef', speed: 470, size: 5 };
      case 'Raijin':
        return { type: 'electric_spark', color: '#06b6d4', speed: 490, size: 6 };
      case 'Sylla':
        return { type: 'seed_shot', color: '#15803d', speed: 480, size: 5 };
      case 'Kyumi':
        return { type: 'orb', color: '#f472b6', speed: 460, size: 7 };
      case 'Buck':
        return { type: 'pellet', color: '#fbbf24', speed: 480, size: 4 };
      case 'Solenne':
        return { type: 'laser', color: '#fde047', speed: 540, size: 6 };
      case 'Soulscourge':
        return { type: 'orb', color: '#a855f7', speed: 500, size: 6 };
      case 'Cinderbloom':
      case 'Cinderlock':
        return { type: 'orb', color: '#f97316', speed: 510, size: 6 };
      case 'Veyara':
        return { type: 'orb', color: '#c084fc', speed: 510, size: 6 };
      case 'Morrigan':
        return { type: 'orb', color: '#818cf8', speed: 500, size: 6 };
      case 'Aurelius':
        return { type: 'orb', color: '#eab308', speed: 500, size: 6 };
      case 'Lyra':
        return { type: 'feather', color: '#38bdf8', speed: 510, size: 5 };
      default:
        return { type: 'orb', color: champ.accentColor || '#38bdf8', speed: 500, size: 6 };
    }
  };

  // Champion Basic Attack (Ranged Projectiles with Impact Sparks & Melee Slashes)
  const executeChampionAttack = (
    u: AramChampionUnit,
    target: { id: string; x: number; y: number },
    targetType: 'champion' | 'minion' | 'structure' | 'camp' | 'dragon',
    baseDamage: number
  ) => {
    if ((targetType === 'camp' || targetType === 'dragon')
      && Math.hypot(target.x - u.x, target.y - u.y)
        > neutralAttackRange(getChampionAttackRange(u.champion.name), targetType === 'dragon' || target.id === 'j_siege_golem') + 12) return;
    sound.playSpellHit();

    let bonusAd = 0;
    const hasInfinity = u.items.some((it) => it.id === 'item_infinity_edge');
    const critChance = Math.min(0.85, 0.1 + u.items.reduce((total, item) => total + (item.stats.crit ?? 0) / 100, 0));
    const isCrit = random() < critChance;
    if (isCrit) bonusAd += u.champion.ad * (hasInfinity ? 1.25 : 0.75);

    if (aegisBuffRef.current?.team === u.team) {
      bonusAd += aegisBuffRef.current.adBonus;
    }
    if (jungleBuffsRef.current[u.team].red > matchTimeRef.current) bonusAd += 28;

    const champTarget = targetType === 'champion' ? championsRef.current.find(c => c.id === target.id) : null;
    if (u.champion.name === 'Faelith' && (targetType === 'champion' || targetType === 'minion')) {
      bonusAd += 11 + Math.min(15, u.level);
    }

    // Kraken Slayer: Bring It Down (Every 3rd attack deals bonus damage scaling with target missing HP)
    const hasKraken = u.items.some((it) => it.id === 'item_kraken_slayer');
    if (hasKraken) {
      u.krakenCounter = (u.krakenCounter ?? 0) + 1;
      if (u.krakenCounter % 3 === 0) {
        const missingHpFactor = champTarget ? Math.min(1.0, Math.max(0, 1 - (champTarget.hp / champTarget.maxHp))) : 0;
        const krakenProcDmg = Math.round((140 + u.champion.ad * 0.45) * (1 + missingHpFactor * 0.50));
        bonusAd += krakenProcDmg;
        floatsRef.current.push({
          id: random().toString(),
          x: target.x,
          y: target.y - 36,
          text: `🔱 BRING IT DOWN! (+${krakenProcDmg})`,
          color: '#38bdf8',
          opacity: 1,
          scale: 1.25
        });
      }
    }

    // Blade of the Ruined King: Mist's Edge (9% current HP on-hit bonus damage)
    const hasBork = u.items.some((it) => it.id === 'item_bork');
    if (hasBork) {
      const borkBonus = champTarget ? Math.round(Math.max(15, champTarget.hp * 0.09)) : 35;
      bonusAd += borkBonus;
    }

    // Lord Dominik's Regards: Giant Slayer (up to +22% bonus damage vs higher max HP targets)
    const hasLdr = u.items.some((it) => it.id === 'item_ldr');
    if (hasLdr && champTarget && champTarget.maxHp > u.maxHp) {
      const hpRatio = Math.min(1.0, (champTarget.maxHp - u.maxHp) / 1200);
      const giantSlayerBonus = Math.round((baseDamage + bonusAd) * (hpRatio * 0.22));
      bonusAd += giantSlayerBonus;
      if (hpRatio >= 0.2) {
        floatsRef.current.push({
          id: random().toString(),
          x: target.x,
          y: target.y - 25,
          text: `🏹 GIANT SLAYER! (+${Math.round(hpRatio * 22)}%)`,
          color: '#fbbf24',
          opacity: 0.95,
          scale: 1.1
        });
      }
    }

    // Mortal Reminder: Grievous Execution
    const hasMortal = u.items.some((it) => it.id === 'item_mortal_reminder');
    if (hasMortal && champTarget) {
      champTarget.grievousTimer = 3.5;
    }

    // Lifesteal Recovery on Attack
    const lifestealPercent = u.items.reduce((sum, it) => sum + (it.stats.lifesteal ?? 0), 0);
    if (lifestealPercent > 0 && u.hp < u.maxHp) {
      const healAmount = Math.round((baseDamage + bonusAd) * (lifestealPercent / 100) * 0.65);
      u.hp = Math.min(u.maxHp, u.hp + healAmount);
    }

    // Navori Quickblades: basic attacks refund non-ultimate ability cooldowns
    if (u.items.some((it) => it.id === 'item_navori')) {
      u.cd1 = Math.max(0, u.cd1 - 0.7);
      u.cd2 = Math.max(0, u.cd2 - 0.7);
    }

    // Unique Card Traits Attack Modifiers
    const overchargeMultiplier = (u.aetherisOverchargeTimer ?? 0) > 0 ? 1.15 : 1;
    const totalDmg = (baseDamage + bonusAd) * overchargeMultiplier;
    const attackRange = getChampionAttackRange(u.champion.name);
    const isRanged = attackRange >= 90;

    // Runaan's Hurricane: Wind's Fury (fires secondary bolts at up to 2 nearby enemies)
    const hasRunaans = u.items.some((it) => it.id === 'item_runaans');
    if (isRanged && hasRunaans && (targetType === 'champion' || targetType === 'minion')) {
      const nearbyEnemies = (targetType === 'champion'
        ? championsRef.current.filter(c => c.team !== u.team && c.isAlive && c.id !== target.id && Math.hypot(c.x - u.x, c.y - u.y) <= attackRange + 40)
        : minionsRef.current.filter(m => m.team !== u.team && m.isAlive && m.id !== target.id && Math.hypot(m.x - u.x, m.y - u.y) <= attackRange + 40)
      ).slice(0, 2);

      nearbyEnemies.forEach((subTarget) => {
        const subOriginX = u.x + (u.facing === 'right' ? 18 : -18);
        const subOriginY = u.y - 14;
        const subTargetCenterY = 'champion' in subTarget ? subTarget.y - 14 : subTarget.y;
        const subDx = subTarget.x - subOriginX;
        const subDy = subTargetCenterY - subOriginY;
        const subAngle = Math.atan2(subDy, subDx);
        projectilesRef.current.push({
          id: random().toString(),
          x: subOriginX,
          y: subOriginY,
          targetX: subTarget.x,
          targetY: subTargetCenterY,
          vx: 0,
          vy: 0,
          speed: 620,
          color: '#a7f3d0',
          type: 'pellet',
          size: 7,
          targetUnitId: subTarget.id,
          damage: Math.round(totalDmg * 0.40),
          attackerId: u.id,
          angle: subAngle
        });
      });
    }

    if (isRanged) {
      const proj = getChampionBasicProjectile(u.champion);
      const originX = u.x + (u.facing === 'right' ? 18 : -18);
      const originY = u.y - 14;
      const targetCenterY = targetType === 'structure' || targetType === 'camp' || targetType === 'dragon' ? target.y : target.y - 14;
      const dx = target.x - originX;
      const dy = targetCenterY - originY;
      const angle = Math.atan2(dy, dx);

      if (u.champion.name === 'Buck') {
        for (let s = -1; s <= 1; s++) {
          projectilesRef.current.push({
            id: random().toString(),
            x: originX,
            y: originY,
            targetX: target.x,
            targetY: targetCenterY + s * 10,
            vx: 0,
            vy: 0,
            speed: proj.speed,
            color: proj.color,
            type: 'pellet',
            size: proj.size,
            targetUnitId: target.id,
            damage: totalDmg / 2.2,
            attackerId: u.id,
            angle: angle + s * 0.12
          });
        }
      } else {
        projectilesRef.current.push({
          id: random().toString(),
          x: originX,
          y: originY,
          targetX: target.x,
          targetY: targetCenterY,
          vx: 0,
          vy: 0,
          speed: proj.speed,
          color: proj.color,
          type: proj.type,
          size: proj.size,
          targetUnitId: target.id,
          damage: totalDmg,
          attackerId: u.id,
          angle
        });
      }
    } else {
      // Melee attack: direct strike with melee impact spark
      floatsRef.current.push({
        id: random().toString(),
        x: target.x + (random() - 0.5) * 16,
        y: target.y - 15,
        text: '💥',
        color: '#facc15',
        opacity: 0.9,
        scale: 0.95
      });
      if (targetType === 'champion') {
        const champTarget = championsRef.current.find(c => c.id === target.id);
        if (champTarget) applyDamageToChampion(u, champTarget, totalDmg, false);
      } else if (targetType === 'minion') {
        const minionTarget = minionsRef.current.find(m => m.id === target.id);
        if (minionTarget) applyDamageToMinion(u, minionTarget, totalDmg);
      } else if (targetType === 'structure') {
        const structTarget = structuresRef.current.find(s => s.id === target.id);
        if (structTarget) applyDamageToStructure(u, structTarget, totalDmg);
      } else if (targetType === 'camp') {
        const campTarget = jungleCampsRef.current.find(c => c.id === target.id);
        if (campTarget) applyDamageToJungleCamp(u, campTarget, totalDmg);
      } else if (targetType === 'dragon') {
        applyDamageToDragon(u, totalDmg * 1.2);
      }
    }
  };

  const performChampionAttack = (u: AramChampionUnit, target: AramChampionUnit) => {
    executeChampionAttack(u, target, 'champion', u.champion.ad);
  };

  const emitSkillEffect = (
    u: AramChampionUnit,
    target: AramChampionUnit,
    ultimate = false,
    label = '',
    explicitSlot?: SkillSlot
  ) => {
    const abilitySlot: SkillSlot = explicitSlot ?? (ultimate ? 'ultimate'
      : (label === u.champion.skill2.name ? 'skill2' : 'skill1'));
    spellsRef.current.push({
      id: random().toString(),
      type: ultimate ? 'ultimate_burst' : 'skill_burst',
      x: target.x, y: target.y,
      sourceX: u.x, sourceY: u.y,
      radius: ultimate ? (u.champion.name === 'Stonewake' ? 155 : u.champion.name === 'Soulscourge' ? 115 : 94) : 52,
      duration: ultimate ? 1.3 : 0.9,
      maxDuration: ultimate ? 1.3 : 0.9,
      color: ultimate ? u.champion.accentColor : u.champion.primaryColor,
      extraText: label,
      avatarName: u.champion.name,
      abilitySlot,
    });
  };

  const fireFirstSkillshot = (u: AramChampionUnit, target: AramChampionUnit, spec: Partial<Projectile>) => {
    const speed = spec.speed ?? 420;
    const accuracy = u.player.stats.lan * 0.75 + u.player.stats.flx * 0.15 + u.player.stats.iq * 0.1
      + (u.player.signatureChampions.includes(u.champion.name) ? 7 : 0);
    const origin = { x: u.x + (u.facing === 'right' ? 16 : -16), y: u.y - 15 };
    const aim = aimAtCast(origin, { x: target.x, y: target.y - 15, vx: target.vx, vy: target.vy }, speed, accuracy, random);
    projectilesRef.current.push({
      id: random().toString(), x: origin.x, y: origin.y,
      targetX: aim.x, targetY: aim.y, vx: 0, vy: 0, speed,
      color: u.champion.accentColor, type: spec.type ?? 'orb', size: spec.size ?? 8,
      targetUnitId: target.id, damage: u.champion.skill1.damage,
      attackerId: u.id, angle: Math.atan2(aim.y - origin.y, aim.x - origin.x),
      skillshot: true, skillLabel: u.champion.skill1.name,
      comboStage: u.comboStage === 1 || u.comboStage === 2 ? u.comboStage : undefined,
      stunOnHit: spec.stunOnHit, charmOnHit: spec.charmOnHit,
      splashRadius: spec.splashRadius, healAlliesOnHit: spec.healAlliesOnHit,
      hookOnHit: spec.hookOnHit, trueDamage: spec.trueDamage,
      collisionRadius: spec.collisionRadius,
      aetherisOrb: spec.aetherisOrb,
    });
    emitSkillEffect(u, target, false, u.champion.skill1.name);
  };

  const setPaxiGroundOrb = (
    u: AramChampionUnit,
    target?: AramChampionUnit,
    fallbackDirection: -1 | 1 = u.team === 'blue' ? 1 : -1,
    maxRange = 700
  ) => {
    const destination = getGroundTargetPoint(
      u,
      target ? { x: target.x, y: target.y } : undefined,
      fallbackDirection,
      maxRange,
      { minX: 75, maxX: ARENA_WIDTH - 75, minY: 105, maxY: 610 }
    );
    u.paxiOrb = {
      x: u.x,
      y: u.y,
      targetX: destination.x,
      targetY: destination.y,
      remaining: 2.2,
      hitIds: []
    };
  };

  // Champion Skill 1 Cast (Remarkable High-Visibility Abilities)
  const castChampionSkill1 = (u: AramChampionUnit, target: AramChampionUnit) => {
    recordAbilityCast(insightsRef.current, u, 'skill1', matchTimeRef.current);
    u.activeAbilitySlot = 'skill1';
    const utility = abilityDamageMultiplier(u.level, 'skill1');
    sound.playAvatarSkill(u.champion.name, 'skill1');
    emitSkillEffect(u, target, false, u.champion.skill1.name, 'skill1');

    if (u.champion.name === 'Solana') {
      applyChampionCrowdControl(u, target, 1.2, 'stun', '☀️ Solar Shieldbash');
      applyDamageToChampion(u, target, 120, false, '☀️ Solar Shieldbash');
      spellsRef.current.push({
        id: random().toString(),
        type: 'solar_flare',
        x: target.x,
        y: target.y,
        radius: 35,
        duration: 0.6,
        maxDuration: 0.6,
        color: '#facc15'
      });
      addEvent(`☀️ CC: Solana stunned ${target.player.name} with Solar Shieldbash!`, 'combo');
    } else if (u.champion.name === 'Astra') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let w = -2; w <= 2; w++) {
        projectilesRef.current.push({
          id: random().toString(),
          x: u.x + (u.facing === 'right' ? 18 : -18),
          y: u.y - 15,
          targetX: target.x,
          targetY: target.y - 15 + w * 20,
          vx: 0,
          vy: 0,
          speed: 550,
          color: '#06b6d4',
          type: 'arrow',
          size: 4,
          targetUnitId: target.id,
          damage: 90,
          attackerId: u.id,
          skillshot: true,
          skillLabel: 'Volley Cone',
          comboStage: u.comboStage === 1 || u.comboStage === 2 ? u.comboStage : undefined,
          angle: angle + w * 0.09
        });
      }
      addEvent(`🏹 POKE: Astra fired Volley barrage across the lane!`, 'micro');
    } else if (u.champion.name === 'Kyumi') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 480,
        color: '#06b6d4',
        type: 'orb',
        size: 9,
        targetUnitId: target.id,
        damage: 155,
        trueDamage: true,
        attackerId: u.id,
        skillshot: true,
        skillLabel: 'Orb of Illusion',
        comboStage: u.comboStage === 1 || u.comboStage === 2 ? u.comboStage : undefined,
        angle
      });
      addEvent(`🔮 ORB: Kyumi hurled Orb of Illusion spirit fox sphere!`, 'micro');
    } else if (u.champion.name === 'Buck') {
      applyDamageToChampion(u, target, 160, false, '💥 Powder Keg Blast');
      spellsRef.current.push({
        id: random().toString(),
        type: 'shotgun_blast',
        x: target.x,
        y: target.y,
        radius: 52,
        duration: 0.65,
        maxDuration: 0.65,
        color: '#f97316',
        extraText: 'Powder Keg Blast',
        avatarName: 'Buck',
        abilitySlot: 'skill1'
      });
      addEvent(`💥 POWDER KEG: Buck blasted a fiery powder keg at ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Valkira') {
      applyChampionCrowdControl(u, target, 0.8, 'stun', '⚔️ Crescent Cleave');
      applyDamageToChampion(u, target, 150, false, '⚔️ Crescent Cleave');
      u.shield += 100 * utility;
    } else if (u.champion.name === 'Kage') {
      // Zed: Razor Shuriken
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 600,
        color: '#dc2626',
        type: 'shuriken',
        size: 7,
        targetUnitId: target.id,
        damage: 165,
        attackerId: u.id,
        angle
      });
      addEvent(`🥷 SHADOW: Kage hurled Razor Shuriken at ${target.player.name}!`, 'micro');
    } else if (u.champion.name === 'Kazemaru') {
      // Yasuo: Steel Tempest Tornado Knockup!
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 560,
        color: '#38bdf8',
        type: 'tornado',
        size: 14,
        targetUnitId: target.id,
        damage: 145,
        attackerId: u.id,
        angle
      });
      applyChampionCrowdControl(u, target, 1.5, 'knockup', '🌪️ Steel Tempest Tornado');
      addEvent(`🌪️ TORNADO: Kazemaru knocked ${target.player.name} airborne with Steel Tempest Tornado!`, 'combo');
    } else if (u.champion.name === 'Kindra' || u.champion.name === 'Kindra & Grim') {
      // Kindred: Dance of Arrows
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let a = -1; a <= 1; a++) {
        projectilesRef.current.push({
          id: random().toString(),
          x: u.x + (u.facing === 'right' ? 16 : -16),
          y: u.y - 15,
          targetX: target.x,
          targetY: target.y - 15 + a * 25,
          vx: 0,
          vy: 0,
          speed: 540,
          color: '#a855f7',
          type: 'spirit_arrow',
          size: 5,
          targetUnitId: target.id,
          damage: 135 / 1.5,
          attackerId: u.id,
          angle: angle + a * 0.12
        });
      }
      addEvent(`🏹 DANCE: Kindra vaulted and unleashed Dance of Arrows!`, 'micro');
    } else if (u.champion.name === 'Cora') {
      // Xayah: Double Daggers
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let f = -1; f <= 1; f += 2) {
        projectilesRef.current.push({
          id: random().toString(),
          x: u.x + (u.facing === 'right' ? 16 : -16),
          y: u.y - 15,
          targetX: target.x,
          targetY: target.y - 15 + f * 15,
          vx: 0,
          vy: 0,
          speed: 580,
          color: '#ec4899',
          type: 'feather',
          size: 6,
          targetUnitId: target.id,
          damage: 75,
          attackerId: u.id,
          angle: angle + f * 0.08
        });
      }
      addEvent(`🪶 FEATHERS: Cora flung Twin Plumage quill barrage!`, 'micro');
    } else if (u.champion.name === 'Renn') {
      // Renn: Gilded Vault Knockup!
      u.dash = { kind: 'renn_vault', targetX: target.x, targetY: target.y, targetId: target.id,
        remaining: 0.75, speed: 360, damage: u.champion.skill1.damage };
      addEvent(`✨ DIVE: Renn leaped with Gilded Vault toward ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Sylla') {
      // One targetable bear per Sylla. Recasting heals and redirects it.
      const bearId = `spirit_bear_${u.id}`;
      const bearHp = Math.min(1800, 1000 + u.level * 80);
      let bear = minionsRef.current.find(m => m.id === bearId && m.isAlive);
      if (bear) {
        bear.hp = bear.maxHp = bearHp;
        bear.ad = 22 + u.level * 4;
        bear.summonedBearFocusId = target.id;
      } else {
        bear = {
          id: bearId, team: u.team, type: 'melee',
          x: u.x + (u.team === 'blue' ? 45 : -45), y: Math.min(625, u.y + 52),
          hp: bearHp, maxHp: bearHp, ad: 22 + u.level * 4,
          range: 38, speed: 115, attackTimer: 0,
          goldReward: 75, xpReward: 80, isAlive: true,
          summonedBearOwnerId: u.id, summonedBearFocusId: target.id
        };
        minionsRef.current.push(bear);
      }
      applyChampionCrowdControl(u, target, 1.5, 'root', '🐻 Entangling Claws');
      applyDamageToChampion(u, target, 130, false, '🐻 Entangling Claws');
      spellsRef.current.push({
        id: random().toString(),
        type: 'spirit_bear',
        x: target.x,
        y: target.y,
        radius: 35,
        duration: 1.5,
        maxDuration: 1.5,
        color: '#10b981'
      });
      addEvent(`🐻 BEAR: Sylla summoned his Spirit Bear to hunt ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Tequoia') {
      // Nature's Prophet: Sprout Ring of Trees!
      applyChampionCrowdControl(u, target, 2.0, 'root', '🌲 Sprout');
      applyDamageToChampion(u, target, 90, false, '🌲 Sprout');
      spellsRef.current.push({
        id: random().toString(),
        type: 'sprout_ring',
        x: target.x,
        y: target.y,
        radius: 42,
        duration: 2.8,
        maxDuration: 2.8,
        color: '#22c55e',
        targetUnitId: target.id
      });
      addEvent(`🌲 SPROUT: Tequoia encircled ${target.player.name} in a living cage of oak trees!`, 'combo');
    } else if (u.champion.name === 'Zal') {
      // Dazzle: Shadow Wave heal & zap
      championsRef.current.filter((c) => c.team === u.team && c.isAlive).forEach((ally) => {
        ally.hp = Math.min(ally.maxHp, ally.hp + 180 * utility);
      });
      applyDamageToChampion(u, target, 130, false, '⚡ Shadow Wave');
      addEvent(`💖 SHADOW WAVE: Zal restored +180 HP to all allies and zapped ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Xin') {
      // Ember Spirit: Searing Chains
      applyChampionCrowdControl(u, target, 1.8, 'root', '🔥 Searing Chains');
      applyDamageToChampion(u, target, 140, false, '🔥 Searing Chains');
      addEvent(`🔥 CHAINS: Xin locked down ${target.player.name} in flaming Searing Chains!`, 'combo');
    } else if (u.champion.name === 'Raijin') {
      // Storm Spirit: Static Remnant
      spellsRef.current.push({
        id: random().toString(),
        type: 'static_remnant',
        x: u.x,
        y: u.y,
        radius: 40,
        duration: 3.0,
        maxDuration: 3.0,
        color: '#06b6d4'
      });
      applyDamageToChampion(u, target, 140, false, '⚡ Static Remnant');
      addEvent(`⚡ STATIC: Raijin planted a crackling Static Remnant!`, 'micro');
    } else if (u.champion.name === 'Kaolin') {
      // Earth Spirit: Boulder Smash
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 12,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 550,
        color: '#059669',
        type: 'boulder',
        size: 13,
        targetUnitId: target.id,
        damage: 135,
        attackerId: u.id,
        angle
      });
      applyChampionCrowdControl(u, target, 1.5, 'stun', '🗿 Boulder Smash');
      addEvent(`🗿 BOULDER: Kaolin smashed a giant jade boulder into ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Inai') {
      // Void Spirit: Aether Remnant Watcher pulling target into void gaze!
      applyChampionCrowdControl(u, target, 1.4, 'stun', '🔮 Aether Remnant');
      spellsRef.current.push({
        id: random().toString(),
        type: 'aether_remnant',
        x: target.x,
        y: target.y,
        sourceX: u.x,
        sourceY: u.y,
        sourceUnitId: u.id,
        targetUnitId: target.id,
        radius: 45,
        duration: 1.4,
        maxDuration: 1.4,
        color: '#7c3aed',
        extraText: 'Aether Remnant',
        avatarName: 'Inai',
        abilitySlot: 'skill1'
      });
      applyDamageToChampion(u, target, 125, false, '🔮 Aether Remnant');
      addEvent(`🔮 VOID: Inai deployed Aether Remnant, pulling ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Veyara') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 520,
        color: '#14b8a6',
        type: 'shuriken',
        size: 9,
        targetUnitId: target.id,
        damage: u.champion.skill1.damage,
        attackerId: u.id,
        skillshot: true,
        skillLabel: 'Prism Hurl',
        stunOnHit: 0.8,
        comboStage: u.comboStage === 1 || u.comboStage === 2 ? u.comboStage : undefined,
        angle
      });
      applyChampionCrowdControl(u, target, 0.8, 'stun', '🌀 Prism Hurl');
      addEvent(`🌀 PRISM: Veyara hurled spinning elemental Ohmlat blade!`, 'combo');
    } else if (u.champion.name === 'Cinderlock' || u.champion.name === 'Cinderbloom') {
      const stage = u.cinderQStage ?? 0;
      if (stage === 0) {
        u.dash = { kind: 'cinder_lunge', targetX: target.x - (target.x >= u.x ? 22 : -22), targetY: target.y,
          targetId: target.id, remaining: 0.7, speed: 400 };
        u.cinderQStage = 1;
      } else if (stage === 1) {
        target.cinderIgnitedUntil = matchTimeRef.current + 4;
        applyDamageToChampion(u, target, u.champion.skill1.damage * 0.35, false, 'Cinder Ignite', 'skill1');
        u.cinderQStage = 2;
      } else {
        const ignited = (target.cinderIgnitedUntil ?? 0) > matchTimeRef.current;
        applyDamageToChampion(u, target, u.champion.skill1.damage * (ignited ? 2 : 1), false,
          ignited ? 'Cinder Critical' : 'Cinder Strike', 'skill1');
        target.cinderIgnitedUntil = undefined;
        u.cinderQStage = undefined;
      }
      if (u.cinderQStage) u.cinderQExpiresAt = matchTimeRef.current + 3.5;
    } else if (u.champion.name === 'Soulscourge') {
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Gloom Raze');
      championsRef.current.filter(e => e.team !== u.team && e.id !== target.id && e.isAlive && Math.hypot(e.x - target.x, e.y - target.y) < 75)
        .forEach(e => applyDamageToChampion(u, e, 95, false, 'Gloom Raze'));
      spellsRef.current.push({
        id: random().toString(),
        type: 'soul_draw',
        x: target.x,
        y: target.y,
        radius: 65,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#7f1d1d',
        extraText: 'Gloom Raze',
        avatarName: 'Soulscourge',
        abilitySlot: 'skill1'
      });
      addEvent(`💀 RAZE: Soulscourge erupted dark soul geysers under ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Solenne') {
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Dusk Lance');
      championsRef.current.filter(a => a.team === u.team && a.isAlive && Math.hypot(a.x - u.x, a.y - u.y) < 180)
        .forEach(a => { a.hp = Math.min(a.maxHp, a.hp + 110 * utility); emitSkillEffect(u, a, false, 'Dusk Lance', 'skill1'); });
      addEvent(`✨ DUSK LANCE: Solenne fired piercing relic beam, healing allies!`, 'combo');
    } else if (u.champion.name === 'Croakwell') {
      // Largo / Croakwell: Ribbon Lash Tongue pulling target continuously!
      applyChampionCrowdControl(u, target, 0.8, 'stun', '👅 Ribbon Lash');
      spellsRef.current.push({
        id: random().toString(),
        type: 'ribbon_lash',
        x: target.x,
        y: target.y,
        sourceX: u.x,
        sourceY: u.y,
        sourceUnitId: u.id,
        targetUnitId: target.id,
        radius: 32,
        duration: 0.8,
        maxDuration: 0.8,
        color: '#84cc16',
        extraText: 'Ribbon Lash',
        avatarName: 'Croakwell',
        abilitySlot: 'skill1'
      });
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Ribbon Lash');
      addEvent(`👅 LASH: Croakwell reeled in ${target.player.name} with Ribbon Lash!`, 'combo');
    } else if (u.champion.name === 'Stonewake') {
      applyChampionCrowdControl(u, target, 1.4, 'knockup', 'Faultline');
      spellsRef.current.push({
        id: random().toString(),
        type: 'faultline',
        x: target.x,
        y: target.y,
        sourceX: u.x,
        sourceY: u.y,
        radius: 80,
        duration: 1.6,
        maxDuration: 1.6,
        color: '#a16207',
        extraText: 'Faultline',
        avatarName: 'Stonewake',
        abilitySlot: 'skill1'
      });
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Faultline');
      championsRef.current.filter(e => e.team !== u.team && e.id !== target.id && e.isAlive && Math.abs(e.y - target.y) < 32 && Math.abs(e.x - target.x) < 90)
        .forEach(e => {
          applyChampionCrowdControl(u, e, 0.9, 'knockup', 'Faultline');
          applyDamageToChampion(u, e, 95, false, 'Faultline');
        });
    } else if (['Mirehook', 'Voltgrip', 'Wraithhook'].includes(u.champion.name)) {
      fireFirstSkillshot(u, target, { type: 'hook', speed: u.champion.name === 'Voltgrip' ? 530 : 455,
        size: 9, collisionRadius: 15, stunOnHit: 0.9, hookOnHit: true });
    } else if (u.champion.name === 'Nullweaver') {
      fireFirstSkillshot(u, target, { speed: 420, size: 11, collisionRadius: 17, stunOnHit: 0.8,
        splashRadius: 42 });
    } else if (u.champion.name === 'Faelith') {
      fireFirstSkillshot(u, target, { speed: 490, size: 7, collisionRadius: 12 });
    } else if (u.champion.name === 'Oathmute') {
      fireFirstSkillshot(u, target, { speed: 440, size: 10, collisionRadius: 15, splashRadius: 72 });
    } else if (u.champion.name === 'Cloudtail') {
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Longstaff Crack', 'skill1');
    } else if (u.champion.name === 'Stonebranch') {
      const direction = Math.sign(target.x - u.x) || 1;
      championsRef.current.filter(e => e.isAlive && e.team !== u.team
        && (e.x - u.x) * direction > 0 && (e.x - u.x) * direction < 155 && Math.abs(e.y - target.y) < 31)
        .forEach(e => {
          applyChampionCrowdControl(u, e, 0.85, 'stun', 'Skyroot Strike');
          applyDamageToChampion(u, e, u.champion.skill1.damage, false, 'Skyroot Strike', 'skill1');
        });
    } else if (u.champion.name === 'Aetherbolt') {
      fireFirstSkillshot(u, target, { speed: 620, size: 7, collisionRadius: 11 });
    } else if (u.champion.name === 'Corsara') {
      fireFirstSkillshot(u, target, { speed: 570, size: 8, collisionRadius: 14, splashRadius: 85 });
    } else if (u.champion.name === 'Brewmaw') {
      fireFirstSkillshot(u, target, { speed: 390, size: 12, collisionRadius: 22, splashRadius: 90 });
    } else if (u.champion.name === 'Kaelen') {
      u.kaelenOrbs = appendKaelenOrb(u.kaelenOrbs ?? [], 'ice');
    } else if (u.champion.name === 'Hweilin') {
      fireFirstSkillshot(u, target, { speed: 510, size: 10, collisionRadius: 16, splashRadius: 75 });
    } else if (u.champion.name === 'Jaxon') {
      fireFirstSkillshot(u, target, { speed: 640, size: 9, collisionRadius: 13, splashRadius: 60 });
    } else if (u.champion.name === 'Valerie') {
      u.x = target.x + (u.team === 'blue' ? -25 : 25);
      applyChampionCrowdControl(u, target, 0.9, 'knockup', 'Vault Breaker Punch');
    } else if (u.champion.name === 'Jinxy') {
      fireFirstSkillshot(u, target, { speed: 580, size: 11, collisionRadius: 15, splashRadius: 80 });
    } else if (u.champion.name === 'Paxi') {
      setPaxiGroundOrb(u, target);
      skillshotsRef.current.fired++;
      recordSkillshot(insightsRef.current, u, false, matchTimeRef.current);
    } else if (u.champion.name === 'Batrix') {
      fireFirstSkillshot(u, target, { speed: 460, size: 9, collisionRadius: 15, splashRadius: 65 });
    } else if (u.champion.name === 'Quillback') {
      fireFirstSkillshot(u, target, { speed: 500, size: 8, collisionRadius: 14, stunOnHit: 0.3 });
    } else if (u.champion.name === 'Aetheris') {
      u.aetherisOrbs = { charges: 5, remaining: 8 };
      fireFirstSkillshot(u, target, {
        speed: 480, size: 11, collisionRadius: 17, splashRadius: 78, aetherisOrb: true
      });
    }
  };

  const castRaijinGroundUltimate = (
    u: AramChampionUnit,
    target: AramChampionUnit | undefined,
    enemies: AramChampionUnit[],
    fallbackDirection: -1 | 1
  ) => {
    const destination = getGroundTargetPoint(
      u,
      target ? { x: target.x, y: target.y } : undefined,
      fallbackDirection,
      320,
      { minX: 60, maxX: ARENA_WIDTH - 60, minY: 90, maxY: 610 }
    );
    const ultRank = u.level >= 18 ? 4 : u.level >= 16 ? 3 : u.level >= 11 ? 2 : 1;
    const damage = Math.round(u.champion.ultimate.damage * (1 + (ultRank - 1) * 0.25));
    const hitIds: string[] = [];
    u.activeAbilitySlot = 'ultimate';
    recordAbilityCast(insightsRef.current, u, 'ultimate', matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, 'ultimate');
    u.dash = {
      kind: 'raijin_bolt',
      targetX: destination.x,
      targetY: destination.y,
      remaining: 0.75,
      speed: 540,
      damage,
      hitIds
    };
    spellsRef.current.push({
      id: random().toString(),
      type: 'ball_lightning',
      x: destination.x,
      y: destination.y,
      radius: 55,
      duration: 1,
      maxDuration: 1,
      color: '#06b6d4'
    });
    enemies.filter(enemy => enemy.isAlive && Math.hypot(enemy.x - destination.x, enemy.y - destination.y) <= 55)
      .forEach(enemy => {
        hitIds.push(enemy.id);
        applyDamageToChampion(u, enemy, damage, false, '⚡ Ball Lightning');
      });
    addEvent(`⚡ BALL LIGHTNING: ${u.player.name} launched toward a ground point!`, 'combo');
  };

  const castKaelenOrb = (u: AramChampionUnit, element: KaelenElement) => {
    const slot: SkillSlot = element === 'ice' ? 'skill1' : element === 'wind' ? 'skill2' : 'ultimate';
    const castSlot = element === 'ice' ? 'orbQ' : element === 'wind' ? 'orbW' : 'orbE';
    if (u.mana < 20) return false;
    u.mana -= 20;
    u.kaelenOrbs = appendKaelenOrb(u.kaelenOrbs ?? [], element);
    u.activeAbilitySlot = slot;
    recordAbilityCast(insightsRef.current, u, castSlot, matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, slot);
    floatsRef.current.push({
      id: random().toString(),
      x: u.x,
      y: u.y - 38,
      text: `${element.toUpperCase()} ORB`,
      color: element === 'ice' ? '#7dd3fc' : element === 'wind' ? '#a7f3d0' : '#fb923c',
      opacity: 1,
      scale: 1.05
    });
    const bonuses = getKaelenOrbBonuses(u);
    const statSummary = element === 'ice' ? `held orbs: +${bonuses.healthRegen.toFixed(1)} HP regen/s`
      : element === 'wind' ? `held orbs: +${bonuses.moveSpeed.toFixed(1)} movement speed`
        : `held orbs: +${(bonuses.spellAmp * 100).toFixed(1)}% spell and damage amp`;
    addEvent(`🔮 ${u.player.name} gathered a ${element} orb (${statSummary}).`, 'combo');
    return true;
  };

  const castKaelenConflux = (u: AramChampionUnit) => {
    const spell = getKaelenInvokedSpell(u.kaelenOrbs ?? []);
    if (!spell || (u.kaelenInvokeCooldown ?? 0) > 0) return false;
    u.kaelenOrbs = [];
    u.kaelenInvokedSlots = appendKaelenInvokedSpell(u.kaelenInvokedSlots ?? [], spell.id);
    u.kaelenInvokeCooldown = kaelenInvokeCooldownAtLevel(u.level);
    u.activeAbilitySlot = 'ultimate';
    u.animState = 'cast';
    recordAbilityCast(insightsRef.current, u, 'conflux', matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, 'ultimate');
    floatsRef.current.push({
      id: random().toString(),
      x: u.x,
      y: u.y - 50,
      text: `CONFLUX: ${spell.name}`,
      color: '#f8fafc',
      opacity: 1,
      scale: 1.15
    });
    addEvent(`🔮 ${u.player.name} invoked ${spell.name}; it entered the D/F FIFO.`, 'combo');
    return true;
  };

  const castKaelenInvokedSpell = (
    u: AramChampionUnit,
    spell: (typeof KAELEN_INVOKED_SPELLS)[number],
    target: AramChampionUnit | undefined,
    enemies: AramChampionUnit[],
    fallbackDirection: -1 | 1,
    abilitySlot: 'skill1' | 'skill2',
    castSlot: 'invokedD' | 'invokedF'
  ) => {
    const destination = getGroundTargetPoint(
      u,
      target ? { x: target.x, y: target.y } : undefined,
      fallbackDirection,
      320,
      { minX: 60, maxX: ARENA_WIDTH - 60, minY: 90, maxY: 610 }
    );
    u.kaelenSpellCooldowns ??= {};
    if ((u.kaelenSpellCooldowns[spell.id] ?? 0) > 0 || u.mana < 45) return false;
    u.mana -= 45;
    u.kaelenSpellCooldowns[spell.id] = spell.cooldown;
    u.activeAbilitySlot = abilitySlot;
    u.animState = 'cast';
    recordAbilityCast(insightsRef.current, u, castSlot, matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, abilitySlot);
    spellsRef.current.push({
      id: random().toString(),
      type: 'kaelen_invoke',
      x: destination.x,
      y: destination.y,
      radius: spell.radius,
      duration: 0.8,
      maxDuration: 0.8,
      color: '#a5f3fc',
      extraText: spell.name,
      avatarName: 'Kaelen',
      abilitySlot
    });
    enemies.filter(enemy => enemy.isAlive
      && Math.hypot(enemy.x - destination.x, enemy.y - destination.y) <= spell.radius)
      .forEach(enemy => {
        if (spell.control === 'stun') applyChampionCrowdControl(u, enemy, spell.controlDuration, 'stun', spell.name);
        else if (spell.control === 'root') applyChampionCrowdControl(u, enemy, spell.controlDuration, 'root', spell.name);
        else if (spell.control === 'knockup') applyChampionCrowdControl(u, enemy, spell.controlDuration, 'knockup', spell.name);
        else if (spell.control === 'knockback') {
          const dx = enemy.x - destination.x;
          const dy = enemy.y - destination.y;
          const distance = Math.hypot(dx, dy) || 1;
          enemy.x = Math.max(60, Math.min(ARENA_WIDTH - 60, enemy.x + dx / distance * 58));
          enemy.y = Math.max(90, Math.min(610, enemy.y + dy / distance * 58));
        }
        applyDamageToChampion(u, enemy, spell.damage, false, spell.name, 'ultimate');
      });
    addEvent(`❄️🌬️🔥 ${u.player.name} cast ${spell.name} at a ground point!`, 'combo');
    return true;
  };

  const processKaelenTurn = (
    u: AramChampionUnit,
    target: AramChampionUnit | undefined,
    enemies: AramChampionUnit[]
  ) => {
    const slots = u.kaelenInvokedSlots ?? [];
    const readySpell = slots
      .map((spellId, index) => ({
        spell: KAELEN_INVOKED_SPELLS.find(candidate => candidate.id === spellId),
        index
      }))
      .find(({ spell }) => !!spell && (u.kaelenSpellCooldowns?.[spell.id] ?? 0) <= 0);
    const fallbackDirection = u.team === 'blue' ? 1 : -1;
    if (readySpell?.spell) {
      return castKaelenInvokedSpell(
        u,
        readySpell.spell,
        target,
        enemies,
        fallbackDirection,
        readySpell.index === 0 ? 'skill1' : 'skill2',
        readySpell.index === 0 ? 'invokedD' : 'invokedF'
      );
    }
    if ((u.kaelenOrbs?.length ?? 0) === 3 && (u.kaelenInvokeCooldown ?? 0) <= 0) {
      return castKaelenConflux(u);
    }

    const orbCandidates: KaelenElement[] = ['ice', 'wind', 'fire'];
    const orbCursor = (u.kaelenOrbCursor ?? 0) % orbCandidates.length;
    const currentOrbs = u.kaelenOrbs ?? [];
    const nextOrb = orbCandidates
      .map((element, index) => ({
        element,
        index,
        count: currentOrbs.filter(orb => orb === element).length,
        cursorDistance: (index - orbCursor + orbCandidates.length) % orbCandidates.length
      }))
      .sort((a, b) => a.count - b.count || a.cursorDistance - b.cursorDistance)[0]?.element;
    if (!nextOrb) return false;
    const cast = castKaelenOrb(u, nextOrb);
    if (cast) u.kaelenOrbCursor = (orbCandidates.indexOf(nextOrb) + 1) % orbCandidates.length;
    return cast;
  };

  const castChampionSkill2 = (u: AramChampionUnit, target: AramChampionUnit) => {
    recordAbilityCast(insightsRef.current, u, 'skill2', matchTimeRef.current);
    u.activeAbilitySlot = 'skill2';
    const utility = abilityDamageMultiplier(u.level, 'skill2');
    const name = u.champion.name;
    const skill = u.champion.skill2;
    const nearbyAllies = championsRef.current.filter(c => c.team === u.team && c.isAlive);
    const nearbyEnemies = championsRef.current.filter(c => c.team !== u.team && c.isAlive);
    const aetherisOverchargeTarget = name === 'Aetheris'
      ? findAetherisInnateAlly(u, nearbyAllies, 260) ?? u
      : undefined;
    sound.playAvatarSkill(u.champion.name, 'skill2');
    emitSkillEffect(u, name === 'Aetheris' ? aetherisOverchargeTarget ?? u
      : name === 'Cinderlock' || name === 'Cinderbloom' || name === 'Renn' ? u : target, false, skill.name, 'skill2');

    if (name === 'Solana') {
      u.x = target.x + (u.team === 'blue' ? -28 : 28);
      applyChampionCrowdControl(u, target, 1.1, 'stun', 'Zenith Lance');
    } else if (name === 'Kyumi') {
      target.charmTimer = 1.4;
      target.charmSourceId = u.id;
      addEvent(`💖 CHARM: Kyumi charmed ${target.player.name} with Charm of Longing!`, 'combo');
    } else if (name === 'Buck') {
      spellsRef.current.push({ id: random().toString(), type: 'smoke_screen',
        x: target.x, y: target.y, radius: 55, duration: 2.5, maxDuration: 2.5, color: '#94a3b8' });
    } else if (name === 'Valkira') {
      u.shield += 200 * utility;
    } else if (name === 'Kaolin') {
      u.dash = { kind: 'kaolin_roll', targetX: target.x, targetY: target.y,
        targetId: target.id, remaining: 0.8, speed: 365, damage: skill.damage };
    } else if (name === 'Kage' || name === 'Inai') {
      u.x = target.x + (u.team === 'blue' ? -32 : 32);
      u.y = target.y - 12;
    } else if (name === 'Kazemaru') {
      spellsRef.current.push({ id: random().toString(), type: 'wind_wall',
        x: u.x + (target.x - u.x) * 0.5, y: u.y, radius: 50,
        duration: 3.5, maxDuration: 3.5, color: '#38bdf8' });
    } else if (name === 'Cora') {
      applyChampionCrowdControl(u, target, 1.3, 'root', '🪶 Feather Recall');
      addEvent(`🪶 FEATHER RECALL: Cora recalled ground feathers, rooting ${target.player.name}!`, 'combo');
    } else if (name === 'Astra') {
      applyChampionCrowdControl(u, target, 0.6, 'stun', '❄️ Frost Shot');
      addEvent(`❄️ FROST: Astra applied Frost Shot frostbite to ${target.player.name}!`, 'micro');
    } else if (name === 'Kindra' || name === 'Kindra & Grim') {
      spellsRef.current.push({
        id: random().toString(),
        type: 'wolf_frenzy',
        x: target.x,
        y: target.y,
        radius: 60,
        duration: 2.2,
        maxDuration: 2.2,
        color: '#a855f7',
        extraText: "Wolf's Frenzy",
        avatarName: 'Kindra',
        abilitySlot: 'skill2'
      });
      addEvent(`🐺 FRENZY: Grim dashed to attack in Wolf's Frenzy territory!`, 'combo');
    } else if (name === 'Tequoia') {
      const groupId = `forest_${u.id}_${matchTimeRef.current}`;
      const linked = championsRef.current.filter(e => e.isAlive && e.team !== u.team && Math.hypot(e.x - target.x, e.y - target.y) <= 125);
      linked.forEach(e => { e.forestLink = { groupId, remaining: 4 }; });
      spellsRef.current.push({ id: groupId, type: 'forest_link', x: target.x, y: target.y,
        radius: 125, duration: 4, maxDuration: 4, color: '#22c55e',
        avatarName: 'Tequoia', abilitySlot: 'skill2' });
      addEvent(`🌿 NATURE LINK: ${u.player.name} linked ${linked.length} enemy champions!`, 'combo');
    } else if (name === 'Sylla') {
      const bear = minionsRef.current.find(m => m.summonedBearOwnerId === u.id && m.isAlive);
      nearbyEnemies.filter((c) => Math.hypot(c.x - u.x, c.y - u.y) < 140
        || (bear && Math.hypot(c.x - bear.x, c.y - bear.y) < 140)).forEach((e) => {
        e.fearTimer = 1.3;
        e.fearSourceId = u.id;
      });
      spellsRef.current.push({
        id: random().toString(),
        type: 'savage_roar',
        x: u.x,
        y: u.y,
        radius: 140,
        duration: 1.3,
        maxDuration: 1.3,
        color: '#15803d',
        extraText: 'Savage Roar',
        avatarName: 'Sylla',
        abilitySlot: 'skill2'
      });
      if (bear) {
        spellsRef.current.push({
          id: random().toString(), type: 'savage_roar', x: bear.x, y: bear.y,
          radius: 140, duration: 1.3, maxDuration: 1.3, color: '#34d399',
          avatarName: 'Sylla', abilitySlot: 'skill2'
        });
      }
      addEvent(`🐻 ROAR: Sylla${bear ? ' and his Spirit Bear' : ''} terrified nearby enemies with Savage Roar!`, 'combo');
    } else if (name === 'Raijin') {
      // Storm Spirit / Raijin: Electric Vortex continuous tether pulling victim!
      applyChampionCrowdControl(u, target, 1.4, 'stun', '⚡ Electric Vortex');
      spellsRef.current.push({
        id: random().toString(),
        type: 'electric_vortex',
        x: target.x,
        y: target.y,
        sourceX: u.x,
        sourceY: u.y,
        sourceUnitId: u.id,
        targetUnitId: target.id,
        radius: 40,
        duration: 1.4,
        maxDuration: 1.4,
        color: '#06b6d4',
        extraText: 'Electric Vortex',
        avatarName: 'Raijin',
        abilitySlot: 'skill2'
      });
      addEvent(`⚡ VORTEX: Raijin tethered and is pulling ${target.player.name} with Electric Vortex!`, 'combo');
    } else if (name === 'Renn') {
      const ally = nearbyAllies.filter(c => c.id !== u.id && Math.hypot(c.x - u.x, c.y - u.y) <= 170)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      u.shield += 220 * utility;
      if (ally) {
        ally.shield += 220 * utility;
        u.dash = { kind: 'renn_waltz', targetX: ally.x, targetY: ally.y,
          targetId: ally.id, remaining: 0.65, speed: 380 };
        emitSkillEffect(u, ally, false, skill.name, 'skill2');
      }
    } else if (name === 'Aetheris') {
      const ally = aetherisOverchargeTarget ?? u;
      ally.aetherisOverchargeTimer = 5;
      ally.aetherisOverchargeSourceId = u.id;
      ally.shield += 100 * utility;
      spellsRef.current.push({
        id: random().toString(),
        type: 'aetheris_overcharge',
        x: ally.x,
        y: ally.y,
        radius: 48,
        duration: 5,
        maxDuration: 5,
        color: '#38bdf8',
        sourceUnitId: u.id,
        targetUnitId: ally.id,
        extraText: 'OVERCHARGE',
        avatarName: 'Aetheris',
        abilitySlot: 'skill2'
      });
      addEvent(`✨ OVERCHARGE: Aetheris empowered ${ally.player.name} for 5 seconds.`, 'combo');
    } else if (name === 'Zal') {
      nearbyAllies.filter(c => Math.hypot(c.x - u.x, c.y - u.y) < 200).forEach(c => {
        c.hp = Math.min(c.maxHp, c.hp + 180 * utility);
        emitSkillEffect(u, c, false, skill.name, 'skill2');
      });
    } else if (name === 'Xin') {
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - target.x, c.y - target.y) < 90)
        .forEach(c => applyDamageToChampion(u, c, skill.damage * 0.6, false, skill.name));
    } else if (name === 'Veyara') {
      u.x = target.x + (u.team === 'blue' ? -30 : 30);
      u.y = target.y;
    } else if (name === 'Cinderlock' || name === 'Cinderbloom') {
      u.stealthTimer = 3.5;
      u.revealedTimer = 0;
      spellsRef.current.push({ id: random().toString(), type: 'ash_veil', x: u.x, y: u.y,
        radius: 55, duration: 0.7, maxDuration: 0.7, color: '#f97316' });
    } else if (name === 'Solenne') {
      applyChampionCrowdControl(u, target, 1.3, 'root', 'Prismatic Barrier');
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - target.x, c.y - target.y) < 70)
        .forEach(c => { applyChampionCrowdControl(u, c, 0.8, 'root', 'Prismatic Barrier'); applyDamageToChampion(u, c, 65, false, skill.name); });
    } else if (name === 'Croakwell') {
      applyChampionCrowdControl(u, target, 0.8, 'stun', 'Bogbeat');
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - target.x, c.y - target.y) < 85)
        .forEach(c => { applyChampionCrowdControl(u, c, 0.5, 'stun', 'Bogbeat'); applyDamageToChampion(u, c, 75, false, skill.name); });
      spellsRef.current.push({
        id: random().toString(),
        type: 'bogbeat',
        x: u.x,
        y: u.y,
        radius: 85,
        duration: 1.8,
        maxDuration: 1.8,
        color: '#84cc16',
        extraText: 'Bogbeat',
        avatarName: 'Croakwell',
        abilitySlot: 'skill2'
      });
    } else if (name === 'Soulscourge') {
      u.shield += 120 * utility;
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - u.x, c.y - u.y) < 95)
        .forEach(c => applyDamageToChampion(u, c, 65, false, skill.name));
      spellsRef.current.push({
        id: random().toString(),
        type: 'soul_draw',
        x: u.x,
        y: u.y,
        radius: 95,
        duration: 1.2,
        maxDuration: 1.2,
        color: '#7f1d1d',
        extraText: 'Soul Draw',
        avatarName: 'Soulscourge',
        abilitySlot: 'skill2'
      });
    } else if (name === 'Stonewake') {
      applyChampionCrowdControl(u, target, 1.0, 'knockup', 'Runic Maul');
      u.shield += 130 * utility;
      spellsRef.current.push({
        id: random().toString(),
        type: 'runic_maul',
        x: target.x,
        y: target.y,
        radius: 60,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#facc15',
        extraText: 'Runic Maul',
        avatarName: 'Stonewake',
        abilitySlot: 'skill2'
      });
    } else if (name === 'Mirehook') {
      u.shield += 110 * utility;
      nearbyEnemies.filter(e => Math.hypot(e.x - u.x, e.y - u.y) < 90).forEach(e => {
        if (e.id !== target.id) applyDamageToChampion(u, e, skill.damage * 0.7, false, skill.name);
      });
    } else if (name === 'Nullweaver') {
      nearbyEnemies.filter(e => Math.hypot(e.x - target.x, e.y - target.y) < 85).forEach(e => {
        if (e.id !== target.id) applyDamageToChampion(u, e, skill.damage * 0.65, false, skill.name);
      });
    } else if (name === 'Faelith') {
      target.stunTimer = Math.max(target.stunTimer, 1.15 * utility);
      const warded = nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) <= 185)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (warded) { warded.shield += 135 * utility; emitSkillEffect(u, warded, false, 'Mothspell', 'skill2'); }
      spellsRef.current.push({ id: random().toString(), type: 'mothspell', x: target.x, y: target.y,
        radius: 35, duration: 1.2, maxDuration: 1.2, color: '#bef264', avatarName: name, abilitySlot: 'skill2' });
    } else if (name === 'Oathmute') {
      target.silenceTimer = Math.max(target.silenceTimer ?? 0, 1.55 * utility);
      spellsRef.current.push({ id: random().toString(), type: 'silence_mark', x: target.x, y: target.y,
        radius: 35, duration: 1.0, maxDuration: 1.0, color: '#a5b4fc', avatarName: name, abilitySlot: 'skill2' });
    } else if (name === 'Cloudtail') {
      u.stealthTimer = Math.max(u.stealthTimer ?? 0, 1.4);
      spellsRef.current.push({ id: random().toString(), type: 'mist_double', x: u.x, y: u.y,
        radius: 33, duration: 1.8, maxDuration: 1.8, color: '#c084fc', avatarName: name, abilitySlot: 'skill2' });
      u.y = Math.max(100, Math.min(610, u.y + (u.y <= target.y ? -46 : 46)));
    } else if (name === 'Stonebranch') {
      u.dash = { kind: 'canopy_bound', targetX: target.x, targetY: target.y, targetId: target.id,
        remaining: 0.9, speed: 350, damage: skill.damage * utility };
    } else if (name === 'Voltgrip') {
      applyChampionCrowdControl(u, target, 0.9, 'knockup', skill.name);
      u.shield += 100 * utility;
    } else if (name === 'Aetherbolt') {
      u.x = Math.max(60, Math.min(ARENA_WIDTH - 60, u.x + (u.team === 'blue' ? -65 : 65)));
      u.y = Math.max(90, Math.min(610, u.y + (u.y < LANE_Y ? -35 : 35)));
    } else if (name === 'Corsara') {
      nearbyEnemies.filter(e => Math.hypot(e.x - target.x, e.y - target.y) < 95).forEach(e => {
        e.stunTimer = Math.max(e.stunTimer, 0.35);
        if (e.id !== target.id) applyDamageToChampion(u, e, skill.damage * 0.5, false, skill.name);
      });
    } else if (name === 'Brewmaw') {
      u.x = target.x + (u.team === 'blue' ? -28 : 28);
      applyChampionCrowdControl(u, target, 0.8, 'knockup', skill.name);
      u.hp = Math.min(u.maxHp, u.hp + 90 * utility);
    } else if (name === 'Wraithhook') {
      nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) < 180).forEach(a => { a.shield += 150 * utility; });
      target.x += u.team === 'blue' ? 30 : -30;
    } else if (name === 'Kaelen') {
      u.kaelenOrbs = appendKaelenOrb(u.kaelenOrbs ?? [], 'wind');
    } else if (name === 'Hweilin') {
      nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) < 140).forEach(a => { a.shield += 130 * utility; });
    } else if (name === 'Jaxon') {
      u.x = target.x + (u.team === 'blue' ? -25 : 25);
      applyChampionCrowdControl(u, target, 0.7, 'root', 'Thundering Leap');
    } else if (name === 'Valerie') {
      u.shield += 140 * utility;
    } else if (name === 'Jinxy') {
      applyChampionCrowdControl(u, target, 1.2, 'root', 'Shock Pistols Zap');
    } else if (name === 'Paxi') {
      nearbyEnemies.filter(e => Math.hypot(e.x - u.x, e.y - u.y) < 90).forEach(e => {
        applyChampionCrowdControl(u, e, 1.1, 'root', 'Waning Rift Silence');
      });
    } else if (name === 'Batrix') {
      target.x += u.team === 'blue' ? -40 : 40;
      applyChampionCrowdControl(u, target, 0.6, 'knockup', 'Flamebreak Grenade');
    } else if (name === 'Quillback') {
      nearbyEnemies.filter(e => Math.hypot(e.x - u.x, e.y - u.y) < 110).forEach(e => {
        applyDamageToChampion(u, e, skill.damage * 0.8, false, 'Quill Spray Nova');
      });
    } else if (name === 'Aetheris') {
      nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) < 160).forEach(a => { a.shield += 160 * utility; });
    }

    if (skill.damage > 0 && target.isAlive && !['Kaolin', 'Cinderbloom', 'Cinderlock', 'Tequoia', 'Stonebranch'].includes(name)) {
      applyDamageToChampion(u, target, skill.damage, skill.damageType === 'True', skill.name);
    }
    addEvent(`✨ ${u.player.name} used ${skill.name}!`, 'combo');
  };

  // Champion Ultimate Cast (Level 6 Spike: 75s / 60s / 45s CD)
  const castChampionUltimate = (u: AramChampionUnit, target: AramChampionUnit, enemies: AramChampionUnit[]) => {
    recordAbilityCast(insightsRef.current, u, 'ultimate', matchTimeRef.current);
    u.activeAbilitySlot = 'ultimate';
    const utility = abilityDamageMultiplier(u.level, 'ultimate');
    if (!target) return;
    sound.playAvatarSkill(u.champion.name, 'ultimate');
    if (!['Nullweaver', 'Corsara', 'Faelith', 'Oathmute', 'Cloudtail', 'Stonebranch'].includes(u.champion.name)) {
      emitSkillEffect(u, ['Astra', 'Soulscourge', 'Stonewake', 'Croakwell', 'Aetheris'].includes(u.champion.name) ? u : target,
        true, u.champion.ultimate.name, 'ultimate');
    }

    const ultRank = u.level >= 18 ? 4 : u.level >= 16 ? 3 : u.level >= 11 ? 2 : 1;
    const ultDamage = Math.round(u.champion.ultimate.damage * (1 + (ultRank - 1) * 0.25));

    showBanner(
      `💥 ${u.player.name.toUpperCase()} CAST ${u.champion.ultimate.name.toUpperCase()}!`,
      `Rank ${ultRank} Ultimate Power Spike Unleashed!`,
      '⚡'
    );
    addEvent(`💥 ULTIMATE: ${u.player.name} unleashed ${u.champion.ultimate.name} (Rank ${ultRank})!`, 'combo');

    if (u.champion.name === 'Aetheris') {
      const duration = aetherisUltimateDurationAtRank(ultRank);
      const linkedAllies = championsRef.current.filter(ally => ally.team === u.team && ally.isAlive
        && Math.hypot(ally.x - u.x, ally.y - u.y) <= 260);
      linkedAllies.forEach(ally => {
        ally.hp = Math.min(ally.maxHp, ally.hp + 250 * utility);
        ally.shield += 150 * utility;
        if (ally.id === u.id) return;
        spellsRef.current.push({
          id: random().toString(),
          type: 'aetheris_ultimate_link',
          x: ally.x,
          y: ally.y,
          radius: 0,
          duration,
          maxDuration: duration,
          color: '#67e8f9',
          sourceUnitId: u.id,
          targetUnitId: ally.id,
          extraText: 'RESONANT CONVERGENCE',
          avatarName: 'Aetheris',
          abilitySlot: 'ultimate'
        });
        emitSkillEffect(u, ally, true, 'Resonant Convergence', 'ultimate');
      });
      showBanner(
        '✨ RESONANT CONVERGENCE!',
        `${u.player.name} linked ${Math.max(0, linkedAllies.length - 1)} nearby allies for ${duration} seconds!`,
        '✨'
      );
      addEvent(`✨ RESONANT CONVERGENCE: Aetheris tethered nearby allies for ${duration}s.`, 'combo');
    } else if (u.champion.name === 'Solana') {
      spellsRef.current.push({
        id: random().toString(),
        type: 'solar_flare',
        x: target.x,
        y: target.y,
        radius: 80,
        duration: 1.2,
        maxDuration: 1.2,
        color: '#f59e0b'
      });
      enemies.filter((e) => Math.hypot(e.x - target.x, e.y - target.y) <= 80).forEach((e) => {
        applyChampionCrowdControl(u, e, 1.8, 'stun', '☀️ Solar Flare');
        applyDamageToChampion(u, e, ultDamage, false, '☀️ Solar Flare');
      });
    } else if (u.champion.name === 'Astra') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: random().toString(),
        x: u.x,
        y: u.y - 15,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 620,
        color: '#38bdf8',
        type: 'ult_arrow',
        size: 14,
        targetUnitId: target.id,
        damage: ultDamage,
        attackerId: u.id,
        skillshot: true,
        skillLabel: 'Crystal Comet',
        abilitySlot: 'ultimate',
        stunOnHit: 2.5,
        collisionRadius: 25,
        angle
      });
    } else if (u.champion.name === 'Kyumi') {
      target.charmTimer = 1.6;
      target.charmSourceId = u.id;
      applyDamageToChampion(u, target, ultDamage, true, '💖 Spirit Rush');
    } else if (u.champion.name === 'Buck') {
      const recoilDir = u.facing === 'right' ? -1 : 1;
      u.x = Math.max(100, Math.min(ARENA_WIDTH - 100, u.x + recoilDir * 60));
      spellsRef.current.push({
        id: random().toString(),
        type: 'shotgun_blast',
        x: u.x - recoilDir * 20,
        y: u.y - 10,
        radius: 75,
        duration: 0.65,
        maxDuration: 0.65,
        color: '#f97316',
        extraText: 'Collateral Blast',
        avatarName: 'Buck',
        abilitySlot: 'ultimate'
      });
      applyDamageToChampion(u, target, ultDamage, false, '💥 Collateral Blast');
    } else if (u.champion.name === 'Valkira') {
      applyDamageToChampion(u, target, ultDamage * 1.3, false, '🩸 Executioner Descent');
    } else if (u.champion.name === 'Kage') {
      // Zed: Death Mark
      u.x = target.x - (u.facing === 'right' ? 25 : -25);
      u.y = target.y;
      spellsRef.current.push({
        id: random().toString(),
        type: 'death_mark',
        x: target.x,
        y: target.y,
        radius: 40,
        duration: 3.0,
        maxDuration: 3.0,
        color: '#dc2626',
        targetUnitId: target.id
      });
      applyDamageToChampion(u, target, ultDamage, false, '🩸 Death Mark');
      showBanner(`🩸 DEATH MARK!`, `${u.player.name} branded ${target.player.name} with Death Mark!`, '🩸');
    } else if (u.champion.name === 'Kazemaru') {
      // Yasuo: Wind Wall & Last Breath
      spellsRef.current.push({
        id: random().toString(),
        type: 'wind_wall',
        x: u.x + (u.facing === 'right' ? 35 : -35),
        y: u.y,
        radius: 50,
        duration: 3.5,
        maxDuration: 3.5,
        color: '#38bdf8'
      });
      u.x = target.x;
      u.y = target.y - 15;
      applyChampionCrowdControl(u, target, 1.8, 'knockup', '⚔️ Last Breath');
      u.knockupTimer = 1.8;
      u.knockupMax = 1.8;
      applyDamageToChampion(u, target, ultDamage, false, '⚔️ Last Breath (50% Shred)');
      showBanner(`⚔️ LAST BREATH!`, `${u.player.name} suspended ${target.player.name} in mid-air with Last Breath!`, '⚔️');
    } else if (u.champion.name === 'Kindra' || u.champion.name === 'Kindra & Grim') {
      // Kindred: Lamb's Respite
      spellsRef.current.push({
        id: random().toString(),
        type: 'lambs_respite',
        x: u.x,
        y: u.y,
        radius: 65,
        duration: 4.0,
        maxDuration: 4.0,
        color: '#facc15'
      });
      championsRef.current.filter((c) => c.team === u.team && c.isAlive).forEach((ally) => {
        ally.hp = Math.min(ally.maxHp, ally.hp + 450 * utility);
      });
      showBanner(`✨ SANCTUARY OF ETERNITY!`, `${u.player.name} blessed a golden sanctuary of immortality!`, '✨');
    } else if (u.champion.name === 'Cora') {
      // Cora: Skyward Plumes
      u.untargetableTimer = 1.4;
      u.knockupTimer = 1.4;
      u.knockupMax = 1.4;
      applyDamageToChampion(u, target, ultDamage, false, '🪶 Skyward Plumes');
      applyChampionCrowdControl(u, target, 1.3, 'root', '🪶 Skyward Plumes');
      showBanner(`🪶 SKYWARD PLUMES!`, `${u.player.name} leaped untargetable and recalled all quills!`, '🪶');
    } else if (u.champion.name === 'Renn') {
      u.dash = { kind: 'renn_rush', targetX: target.x, targetY: target.y,
        remaining: 1.1, speed: 380, damage: ultDamage * 0.75, hitIds: [] };
      showBanner('DAZZLING RUSH!', `${u.player.name} rushed through the enemy team!`, '?');
    } else if (u.champion.name === 'Sylla') {
      // Lone Druid: True Form & Savage Roar (Temporary transformation buff)
      u.trueFormTimer = 12.0;
      u.shield += 450 * utility;
      enemies.forEach((e) => {
        if (Math.hypot(e.x - u.x, e.y - u.y) <= 90) applyChampionCrowdControl(u, e, 1.3, 'stun', '🐻 True Form Roar');
      });
      applyDamageToChampion(u, target, ultDamage, false, '🐻 True Form Roar');
      showBanner(`🐻 TRUE FORM!`, `${u.player.name} transformed into the colossal Ironclaw Bear!`, '🐻');
    } else if (u.champion.name === 'Tequoia') {
      // Nature's Prophet: Wrath of Nature
      enemies.forEach((e, idx) => {
        const bounceDmg = Math.round(ultDamage * (1 + idx * 0.1));
        applyDamageToChampion(u, e, bounceDmg, false, '⚡ Wrath of Nature');
      });
      showBanner(`⚡ WRATH OF NATURE!`, `${u.player.name} unleashed bouncing green solar lightning!`, '⚡');
    } else if (u.champion.name === 'Zal') {
      // Dazzle: Shallow Grave!
      const lowestAlly = championsRef.current
        .filter((c) => c.team === u.team && c.isAlive)
        .sort((a, b) => a.hp - b.hp)[0];
      if (lowestAlly) {
        spellsRef.current.push({
          id: random().toString(),
          type: 'shallow_grave',
          x: lowestAlly.x,
          y: lowestAlly.y,
          radius: 35,
          duration: 4.5,
          maxDuration: 4.5,
          color: '#ec4899',
          targetUnitId: lowestAlly.id
        });
        showBanner(`💖 SHALLOW GRAVE!`, `${u.player.name} placed the pink cross of immortality on ${lowestAlly.player.name}!`, '💖');
      }
    } else if (u.champion.name === 'Xin') {
      // Ember Spirit: Sleight of Fist & Remnants
      spellsRef.current.push({
        id: random().toString(),
        type: 'sleight_circle',
        x: target.x,
        y: target.y,
        radius: 45,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#ea580c'
      });
      enemies.filter((e) => Math.hypot(e.x - target.x, e.y - target.y) <= 80).forEach((e) => {
        applyDamageToChampion(u, e, ultDamage, false, '🔥 Sleight of Fist');
      });
      showBanner(`🔥 SLEIGHT OF FIST!`, `${u.player.name} slashed through the flame remnant field!`, '🔥');
    } else if (u.champion.name === 'Raijin') {
      // Storm Spirit: Ball Lightning
      u.dash = { kind: 'raijin_bolt', targetX: target.x, targetY: target.y, targetId: target.id,
        remaining: 0.75, speed: 540 };
      spellsRef.current.push({
        id: random().toString(),
        type: 'ball_lightning',
        x: target.x,
        y: target.y,
        radius: 55,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#06b6d4'
      });
      applyDamageToChampion(u, target, ultDamage, false, '⚡ Ball Lightning');
      showBanner(`⚡ BALL LIGHTNING!`, `${u.player.name} zipped in supersonic ball lightning blast!`, '⚡');
    } else if (u.champion.name === 'Kaolin') {
      // Earth Spirit: Magnetize
      spellsRef.current.push({
        id: random().toString(),
        type: 'magnetize_pulse',
        x: u.x,
        y: u.y,
        radius: 55,
        duration: 2.0,
        maxDuration: 2.0,
        color: '#059669'
      });
      enemies.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) <= 100).forEach((e) => {
        applyChampionCrowdControl(u, e, 1.0, 'stun', '🗿 Magnetize');
        applyDamageToChampion(u, e, ultDamage, false, '🗿 Magnetize');
      });
      showBanner(`🗿 MAGNETIZE!`, `${u.player.name} triggered resonant jade magnetic shockwaves!`, '🗿');
    } else if (u.champion.name === 'Inai') {
      // Void Spirit: Astral Step
      u.x = target.x + (u.facing === 'right' ? 30 : -30);
      applyDamageToChampion(u, target, ultDamage, true, '🔮 Astral Step');
      showBanner(`🔮 ASTRAL STEP!`, `${u.player.name} cut through reality with planar Astral Step!`, '🔮');
    } else if (u.champion.name === 'Veyara' || u.champion.name === 'Cinderlock' || u.champion.name === 'Cinderbloom' || u.champion.name === 'Soulscourge' || u.champion.name === 'Stonewake') {
      const radius = u.champion.name === 'Stonewake' ? 155 : 115;
      const center = u.champion.name === 'Soulscourge' || u.champion.name === 'Stonewake' ? u : target;
      const victims = enemies.filter(e => e.isAlive && Math.hypot(e.x - center.x, e.y - center.y) <= radius);
      victims.forEach(e => {
        if (u.champion.name === 'Veyara') applyChampionCrowdControl(u, e, 1.5, 'stun', 'Ultimate');
        if (u.champion.name === 'Stonewake') applyChampionCrowdControl(u, e, 1.5, 'knockup', 'Quake Chorus');
        if (u.champion.name === 'Soulscourge') {
          applyChampionCrowdControl(u, e, 1.0, 'stun', 'Dirge Wave');
          e.fearTimer = Math.max(e.fearTimer ?? 0, 1.5);
          e.fearSourceId = u.id;
        }
        applyDamageToChampion(u, e, ultDamage * (u.champion.name === 'Stonewake' ? 0.85 + victims.length * 0.08 : 1), false, u.champion.ultimate.name);
        emitSkillEffect(u, e, true, u.champion.ultimate.name);
      });
      if (u.champion.name === 'Soulscourge') {
        spellsRef.current.push({
          id: random().toString(),
          type: 'dirge_wave',
          x: u.x,
          y: u.y,
          radius,
          duration: 1.8,
          maxDuration: 1.8,
          color: '#831843',
          extraText: 'Dirge Wave',
          avatarName: 'Soulscourge',
          abilitySlot: 'ultimate'
        });
      } else if (u.champion.name === 'Stonewake') {
        spellsRef.current.push({
          id: random().toString(),
          type: 'quake_chorus',
          x: u.x,
          y: u.y,
          radius,
          duration: 1.5,
          maxDuration: 1.5,
          color: '#eab308',
          extraText: 'Quake Chorus',
          avatarName: 'Stonewake',
          abilitySlot: 'ultimate'
        });
      } else if (u.champion.name === 'Cinderlock' || u.champion.name === 'Cinderbloom') {
        spellsRef.current.push({
          id: random().toString(),
          type: 'cinder_verdict',
          x: target.x,
          y: target.y,
          radius,
          duration: 1.6,
          maxDuration: 1.6,
          color: '#ea580c',
          extraText: 'Cinder Verdict',
          avatarName: u.champion.name,
          abilitySlot: 'ultimate'
        });
      }
    } else if (u.champion.name === 'Solenne') {
      spellsRef.current.push({
        id: random().toString(),
        type: 'daybreak_veil',
        x: u.x,
        y: u.y,
        radius: 130,
        duration: 2.2,
        maxDuration: 2.2,
        color: '#fde047',
        extraText: 'Daybreak Veil',
        avatarName: 'Solenne',
        abilitySlot: 'ultimate'
      });
      enemies.filter(e => e.isAlive && Math.abs(e.y - target.y) < 90).forEach(e => {
        applyDamageToChampion(u, e, ultDamage, false, 'Daybreak Veil');
        emitSkillEffect(u, e, true, 'Daybreak Veil');
      });
      championsRef.current.filter(a => a.team === u.team && a.isAlive).forEach(a => {
        a.shield += 220 * utility;
        emitSkillEffect(u, a, true, 'Daybreak Veil');
      });
    } else if (u.champion.name === 'Croakwell') {
      spellsRef.current.push({
        id: random().toString(),
        type: 'marsh_anthem',
        x: u.x,
        y: u.y,
        radius: 145,
        duration: 2.5,
        maxDuration: 2.5,
        color: '#10b981',
        extraText: 'Marsh Anthem',
        avatarName: 'Croakwell',
        abilitySlot: 'ultimate'
      });
      championsRef.current.filter(a => a.team === u.team && a.isAlive).forEach(a => {
        a.hp = Math.min(a.maxHp, a.hp + 300 * utility);
        a.shield += 120 * utility;
        emitSkillEffect(u, a, true, 'Marsh Anthem');
      });
      enemies.filter(e => e.isAlive && Math.hypot(e.x - u.x, e.y - u.y) < 145)
        .forEach(e => applyDamageToChampion(u, e, ultDamage, false, 'Marsh Anthem'));
    } else if (u.champion.name === 'Nullweaver') {
      u.blackHole = { x: target.x, y: target.y, remaining: 3.2, tick: 0 };
      spellsRef.current.push({ id: random().toString(), type: 'black_hole', x: target.x, y: target.y,
        radius: BLACK_HOLE_RADIUS, duration: 3.2, maxDuration: 3.2, color: '#a78bfa',
        sourceUnitId: u.id, avatarName: 'Nullweaver', abilitySlot: 'ultimate' });
      addEvent(`BLACK HOLE: ${u.player.name} began channeling Singularity Well!`, 'combo');
    } else if (u.champion.name === 'Corsara') {
      u.facing = target.x >= u.x ? 'right' : 'left';
      u.corsaraBarrage = { remaining: 3, tick: 0, facing: u.facing };
      spellsRef.current.push({ id: random().toString(), type: 'broadside_channel', x: u.x, y: u.y,
        radius: 260, duration: 3, maxDuration: 3, color: '#fb7185',
        sourceUnitId: u.id, avatarName: 'Corsara', abilitySlot: 'ultimate' });
      addEvent(`${u.player.name} began channeling Broadside Waltz!`, 'combo');
    } else if (u.champion.name === 'Faelith') {
      const ally = championsRef.current.filter(a => a.isAlive && a.team === u.team && Math.hypot(a.x - u.x, a.y - u.y) <= 215)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? u;
      ally.shield += 285 * utility;
      championsRef.current.filter(e => e.isAlive && e.team !== u.team && Math.hypot(e.x - ally.x, e.y - ally.y) <= 95)
        .forEach(e => { applyChampionCrowdControl(u, e, 0.8, 'knockup', 'Wildheart Bloom'); applyDamageToChampion(u, e, 95, false, 'Wildheart Bloom', 'ultimate'); });
      spellsRef.current.push({ id: random().toString(), type: 'wildheart_bloom', x: ally.x, y: ally.y,
        radius: 95, duration: 1.1, maxDuration: 1.1, color: '#bef264', avatarName: 'Faelith', abilitySlot: 'ultimate' });
    } else if (u.champion.name === 'Oathmute') {
      enemies.filter(e => e.isAlive).forEach(e => { e.silenceTimer = Math.max(e.silenceTimer ?? 0, 1.8 * utility); });
      spellsRef.current.push({ id: random().toString(), type: 'stillness_decree', x: u.x, y: u.y,
        radius: 180, duration: 1.3, maxDuration: 1.3, color: '#ddd6fe', avatarName: 'Oathmute', abilitySlot: 'ultimate' });
    } else if (u.champion.name === 'Cloudtail') {
      u.monkeySpin = { remaining: 2, tick: 0, hitIds: [] };
      spellsRef.current.push({ id: random().toString(), type: 'cyclone_dance', x: u.x, y: u.y,
        radius: 105, duration: 2, maxDuration: 2, color: '#fbbf24', sourceUnitId: u.id,
        avatarName: 'Cloudtail', abilitySlot: 'ultimate' });
    } else if (u.champion.name === 'Stonebranch') {
      u.monkeyCourt = { x: target.x, y: target.y, remaining: 4.2, tick: 0 };
      spellsRef.current.push({ id: random().toString(), type: 'branch_court', x: target.x, y: target.y,
        radius: 120, duration: 4.2, maxDuration: 4.2, color: '#86efac', sourceUnitId: u.id,
        avatarName: 'Stonebranch', abilitySlot: 'ultimate' });
    } else if (['Mirehook', 'Voltgrip', 'Aetherbolt', 'Brewmaw', 'Wraithhook', 'Hweilin', 'Jaxon', 'Valerie', 'Jinxy', 'Paxi', 'Batrix', 'Quillback'].includes(u.champion.name)) {
      const name = u.champion.name;
      const origin = name === 'Voltgrip' || name === 'Corsara' || name === 'Quillback' || name === 'Aetheris' ? u : target;
      const radius = name === 'Mirehook' ? 55 : name === 'Aetherbolt' ? 80 : name === 'Corsara' ? 210 : 150;
      spellsRef.current.push({ id: random().toString(), type: 'ultimate_burst', x: origin.x, y: origin.y,
        sourceX: u.x, sourceY: u.y, radius, duration: 1.5, maxDuration: 1.5,
        color: u.champion.accentColor, extraText: u.champion.ultimate.name,
        avatarName: name, abilitySlot: 'ultimate' });
      const struck = enemies.filter(e => {
        if (!e.isAlive) return false;
        if (name === 'Aetherbolt') return Math.abs(e.y - target.y) < 75;
        if (name === 'Corsara') {
          const forward = (e.x - u.x) * (u.facing === 'right' ? 1 : -1);
          return forward > 0 && forward < 260 && Math.abs(e.y - u.y) < forward * 0.55 + 24;
        }
        return Math.hypot(e.x - origin.x, e.y - origin.y) < radius;
      });
      struck.forEach(e => {
        if (name === 'Mirehook') { applyChampionCrowdControl(u, e, 1.35, 'stun', 'Feast Lock'); u.hp = Math.min(u.maxHp, u.hp + 90 * utility); }
        if (name === 'Voltgrip' || name === 'Wraithhook') applyChampionCrowdControl(u, e, 1.0, 'stun', u.champion.ultimate.name);
        if (name === 'Brewmaw') { e.x += (e.x - target.x >= 0 ? 1 : -1) * 80; applyChampionCrowdControl(u, e, 0.7, 'knockup', 'Grand Vintage'); }
        if (name === 'Hweilin') applyChampionCrowdControl(u, e, 1.2, 'root', 'Vortex of Torment');
        if (name === 'Valerie' && e.id === target.id) applyChampionCrowdControl(u, e, 1.3, 'knockup', 'Cease and Desist');
        if (name === 'Paxi') applyChampionCrowdControl(u, e, 1.4, 'stun', 'Dream Coil Tether');
        if (name === 'Batrix' && e.id === target.id) {
          applyChampionCrowdControl(u, e, 1.5, 'stun', 'Flaming Lasso Drag');
          e.x += (u.x - e.x) * 0.6;
        }
        const finalUltDmg = name === 'Jinxy' ? Math.round(ultDamage * (1 + (1 - e.hp / e.maxHp) * 0.6)) : ultDamage;
        applyDamageToChampion(u, e, finalUltDmg, false, u.champion.ultimate.name);
      });
    }
  };

  const applyDamageToChampion = (
    attacker: AramChampionUnit | null,
    target: AramChampionUnit,
    rawDamage: number,
    isTrueDamage: boolean = false,
    label?: string,
    abilitySlot?: AbilitySlot,
    sharedDamage: boolean = false
  ) => {
    if (target.zhonyaActive) return;
    target.stealthTimer = 0;
    if (attacker) attacker.stealthTimer = 0;

    // Interrupt Recall channel immediately if taking damage
    if (target.isRecalling) {
      target.isRecalling = false;
      target.recallTimer = 0;
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 42,
        text: `❌ RECALL CANCELLED!`,
        color: '#ef4444',
        opacity: 1,
        scale: 1.2
      });
      sound.playSpellHit();
    }
    // Taking any damage puts recall on cooldown for 6.0 seconds and triggers combat timer
    target.recallCooldown = 6.0;
    target.combatTimer = 6.0;
    if (attacker) attacker.combatTimer = 6.0;
    if (attacker && attacker.team !== target.team) {
      structuresRef.current.forEach(tower => {
        if (!tower.isAlive || !tower.type.includes('tower') || tower.team !== target.team) return;
        if (Math.hypot(attacker.x - tower.x, attacker.y - tower.y) > tower.range
          || Math.hypot(target.x - tower.x, target.y - tower.y) > tower.range) return;
        tower.diveAggressorId = attacker.id;
        tower.diveAggroUntil = matchTimeRef.current + 3.5;
        tower.targetId = attacker.id;
      });
    }

    const ap = label && attacker
      ? attacker.items.reduce((total, item) => total + (item.stats.ap ?? 0), 0)
        + (aegisBuffRef.current?.team === attacker.team ? aegisBuffRef.current.apBonus : 0) : 0;
    const bonusAd = label && attacker
      ? attacker.items.reduce((total, item) => total + (item.stats.ad ?? 0), 0)
        + (aegisBuffRef.current?.team === attacker.team ? aegisBuffRef.current.adBonus : 0) : 0;
    const itemDamage = label?.includes('Immolate') || label?.includes('Kraken') || label?.includes('Dragon Burn');
    const slot = abilitySlot ?? (label === attacker?.champion.ultimate.name ? 'ultimate'
      : label === attacker?.champion.skill2.name ? 'skill2'
      : label === attacker?.champion.skill1.name ? 'skill1' : attacker?.activeAbilitySlot ?? 'skill1');

    // Ability scaling: casters get AP ratios, physical classes get bonus AD ratios
    const isMage = attacker?.champion.primaryRole === 'Mage' || attacker?.champion.secondaryRole === 'Mage';
    const isPhysicalRole = attacker?.champion.primaryRole === 'Assassin' || attacker?.champion.primaryRole === 'Fighter' || attacker?.champion.primaryRole === 'Marksman';
    const apRatio = isMage ? 0.42 : 0.25;
    const adRatio = isPhysicalRole ? 0.36 : 0.18;

    let abilityAmp = 1.0;
    if (attacker && label && !itemDamage) {
      abilityAmp += getKaelenOrbBonuses(attacker).spellAmp;
      // Shojin: +10% non-ultimate ability damage
      if (attacker.items.some(it => it.id === 'item_shojin') && slot !== 'ultimate') {
        abilityAmp += 0.10;
      }
      // Duskblade: up to 12% bonus damage scaling with target missing HP
      if (attacker.items.some(it => it.id === 'item_duskblade')) {
        const missingHpPct = Math.max(0, 1 - (target.hp / target.maxHp));
        abilityAmp += missingHpPct * 0.12;
      }
      // Horizon Focus: +10% ability damage when cast from range >= 170
      if (attacker.items.some(it => it.id === 'item_horizon_focus') && Math.hypot(target.x - attacker.x, target.y - attacker.y) >= 170) {
        abilityAmp += 0.10;
      }
      // Echoes of Helia: dealing ability damage restores 35 HP to nearest wounded ally
      if (attacker.items.some(it => it.id === 'item_echoes_of_helia')) {
        const woundedAlly = championsRef.current.find(a => a.team === attacker.team && a.isAlive && a.hp < a.maxHp && Math.hypot(a.x - attacker.x, a.y - attacker.y) <= 220);
        if (woundedAlly) {
          woundedAlly.hp = Math.min(woundedAlly.maxHp, woundedAlly.hp + 35);
        }
      }
    }

    const spellDamage = sharedDamage ? rawDamage : attacker && label && !itemDamage
      ? ((rawDamage + ap * apRatio + bonusAd * adRatio) * abilityDamageMultiplier(attacker.level, slot)) * abilityAmp
      : rawDamage + ap * 0.35;

    // Fang of the Serpent: reduces target current shield by 40%
    if (attacker?.items.some(it => it.id === 'item_serpents_fang') && target.shield > 0) {
      target.shield = Math.round(target.shield * 0.60);
    }

    let effectiveArmor = target.champion.armor;
    if (target.trueFormTimer && target.trueFormTimer > 0) {
      effectiveArmor += 30; // Temporary True Form armor bonus
    }

    let effective = spellDamage * (1 + (attacker ? getKaelenOrbBonuses(attacker).damageAmp : 0));
    if (!isTrueDamage) {
      if (attacker) {
        // Armor penetration percentage (e.g. 35% LDR, 30% Mortal Reminder/Terminus, 18% Last Whisper, 24% Black Cleaver)
        const percentPen = Math.min(0.55, attacker.items.reduce((acc, it) => acc + (it.stats.armorPen ?? 0) / 100, 0));
        const lethality = attacker.items.reduce((acc, it) => acc + (it.stats.lethality ?? 0), 0);
        const flatArmorPen = lethality * (0.6 + (0.4 * (attacker.level || 1)) / 18);
        effectiveArmor = Math.max(0, effectiveArmor * (1 - percentPen) - flatArmorPen);

        // Magic Penetration
        const magicPen = attacker.items.reduce((acc, it) => acc + (it.stats.magicPen ?? 0), 0);
        if (ap > 0 && magicPen > 0) {
          effectiveArmor = Math.max(0, effectiveArmor - magicPen);
        }
      }
      effective = spellDamage * (100 / (100 + effectiveArmor));
    }

    // Shadowflame: +22 bonus magic damage to targets under 35% HP or with shields
    if (attacker?.items.some(it => it.id === 'item_shadowflame') && (target.hp < target.maxHp * 0.35 || target.shield > 0)) {
      effective += 22;
    }

    if (attacker?.isInBush && !sharedDamage) {
      effective *= 1.35;
      showBanner('🌿 BRUSH AMBUSH TRAP!', `${attacker.player.name} leaped from brush with an ambush crit!`, '🌿');
      addEvent(`🌿 AMBUSH: ${attacker.player.name} caught ${target.player.name} from brush with an ambush crit!`, 'combo');
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 36,
        text: '🌿 AMBUSH CRIT! (+35%)',
        color: '#34d399',
        opacity: 1,
        scale: 1.3
      });
    }

    // Dragon Slayer Aspect: True damage burning tick on every hit!
    if (attacker && !sharedDamage && aegisBuffRef.current?.team === attacker.team && aegisBuffRef.current.burnTrueDamage) {
      effective += 20;
      floatsRef.current.push({
        id: random().toString(),
        x: target.x + (random() - 0.5) * 18,
        y: target.y - 25,
        text: '🔥 +20 DRAGON BURN!',
        color: '#f97316',
        opacity: 0.95,
        scale: 1.05
      });
    }

    const finalDamage = Math.round(effective);

    // Knight's Vow (Warden's Pledge): Redirect 12% of damage taken by ally to protector
    let redirectedDamage = 0;
    const protector = championsRef.current.find(a => a.team === target.team && a.isAlive && a.id !== target.id
      && a.items.some(it => it.id === 'item_knights_vow') && Math.hypot(a.x - target.x, a.y - target.y) <= 220);
    if (protector && !sharedDamage && finalDamage > 25) {
      redirectedDamage = Math.round(finalDamage * 0.12);
      protector.hp = Math.max(1, protector.hp - redirectedDamage);
      floatsRef.current.push({
        id: random().toString(),
        x: protector.x,
        y: protector.y - 25,
        text: `🛡️ PLEDGE (-${redirectedDamage})`,
        color: '#eab308',
        opacity: 0.9,
        scale: 1.05
      });
    }
    const damageToTarget = Math.max(1, finalDamage - redirectedDamage);

    // Sterak's Lifeline
    const hasSteraks = target.items.some((it) => it.id === 'item_steraks');
    if (hasSteraks && target.hp - damageToTarget <= target.maxHp * 0.3 && target.sterakCooldown <= 0) {
      const shieldValue = (target.grievousTimer && target.grievousTimer > 0) ? 360 : 600;
      target.shield += shieldValue;
      target.sterakCooldown = 60.0;
      sound.playCoin();
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 30,
        text: '🛡️ STERAK LIFELINE (+600)',
        color: '#f59e0b',
        opacity: 1,
        scale: 1.3
      });
    }

    // Zhonya's Stasis
    const hasZhonyas = target.items.some((it) => it.id === 'item_zhonyas');
    if (hasZhonyas && target.hp - damageToTarget <= 0 && target.zhonyaTimer <= 0) {
      target.zhonyaActive = true;
      target.zhonyaTimer = 90.0;
      target.zhonyaRemaining = 2.5;
      target.hp = 1;
      sound.playSpellHit();
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 30,
        text: '⏳ GOLDEN STASIS!',
        color: '#facc15',
        opacity: 1,
        scale: 1.4
      });
      return;
    }

    // Shallow Grave: Ally cannot fall below 1 HP!
    const hasShallowGrave = spellsRef.current.some((s) => s.type === 'shallow_grave' && s.targetUnitId === target.id);
    // Lamb's Respite: Units inside cannot fall below 10% HP!
    const inLambsRespite = spellsRef.current.some((s) => s.type === 'lambs_respite' && Math.hypot(s.x - target.x, s.y - target.y) <= s.radius);

    const minFloorHp = hasShallowGrave ? 1 : inLambsRespite ? Math.round(target.maxHp * 0.10) : 0;

    // Shield absorbs incoming damage before health
    let damageRemaining = damageToTarget;
    if (target.shield > 0) {
      if (target.shield >= damageRemaining) {
        target.shield -= damageRemaining;
        damageRemaining = 0;
      } else {
        damageRemaining -= target.shield;
        target.shield = 0;
      }
    }
    const hpBefore = target.hp;
    target.hp = Math.max(minFloorHp, target.hp - damageRemaining);
    const healthLost = hpBefore - target.hp;
    if (!sharedDamage && healthLost > 0 && target.forestLink && target.forestLink.remaining > 0) {
      const groupId = target.forestLink.groupId;
      championsRef.current.filter(other => other.id !== target.id && other.isAlive && other.team === target.team
        && other.forestLink?.groupId === groupId && other.forestLink.remaining > 0)
        .forEach(other => applyDamageToChampion(attacker?.team === other.team ? null : attacker, other, healthLost * 0.1,
          true, 'Nature Link', 'innate', true));
    }

    // The Collector Execute (<5% HP)
    const hasCollector = attacker?.items.some((it) => it.id === 'item_collector');
    if (hasCollector && attacker && target.hp > 0 && target.hp <= target.maxHp * 0.05 && !hasShallowGrave && !inLambsRespite) {
      target.hp = 0;
      attacker.gold += 25;
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 45,
        text: '☠️ COLLECTED! (+25g)',
        color: '#f43f5e',
        opacity: 1,
        scale: 1.4
      });
      sound.playCoin();
    }

    if (minFloorHp > 0 && target.hp === minFloorHp) {
      floatsRef.current.push({
        id: random().toString(),
        x: target.x,
        y: target.y - 32,
        text: hasShallowGrave ? '💖 SHALLOW GRAVE RESCUE!' : '✨ IMMORTAL SANCTUARY!',
        color: hasShallowGrave ? '#ec4899' : '#facc15',
        opacity: 1,
        scale: 1.2
      });
    }

    if (attacker && attacker.team !== target.team && finalDamage > 0) {
      target.lastEnemyDamage = { attackerId: attacker.id, second: matchTimeRef.current };
    }
    target.damageTaken += finalDamage;
    if (attacker) attacker.damageDealt += finalDamage;

    // Suppress floating text for shared damage / Nature Link to avoid cluttering screen with repetitive labels
    if (!sharedDamage && label !== 'Forest Link' && label !== 'Nature Link') {
      floatsRef.current.push({
        id: random().toString(),
        x: target.x + (random() - 0.5) * 20,
        y: target.y - 28,
        text: label ? `${label} -${finalDamage}` : `-${finalDamage}`,
        color: isTrueDamage ? '#ffffff' : (attacker?.team === 'blue' ? '#38bdf8' : '#f43f5e'),
        opacity: 1,
        scale: isTrueDamage ? 1.25 : 1.0
      });
    }

    if (target.hp <= 0 && target.isAlive) {
      const isTurretFinish = !attacker && Boolean(label?.includes('Turret'));
      const isMonsterFinish = !attacker && Boolean(label?.includes('Jungle Camp') || label?.includes('Flame Breath') || label?.includes('Inferno Slam'));
      const isNeutralFinish = isTurretFinish || isMonsterFinish;
      const turretReward = isTurretFinish
        ? resolveTurretKillReward(target, matchTimeRef.current, championsRef.current, 10)
        : null;
      const killer = attacker ?? (isTurretFinish
        ? turretReward?.killer ?? null
        : isMonsterFinish
          ? resolveNeutralKillCredit(target.lastEnemyDamage, target.team, matchTimeRef.current, championsRef.current, 10)
          : null);
      target.isAlive = false;
      target.hookPull = undefined;
      if (target.blackHole) recordBlackHoleInterrupt(insightsRef.current, target, matchTimeRef.current);
      target.blackHole = undefined;
      target.corsaraBarrage = undefined;
      target.monkeySpin = undefined;
      target.monkeyCourt = undefined;
      target.dash = undefined;
      target.paxiOrb = undefined;
      target.cinderQStage = undefined;
      target.lastEnemyDamage = undefined;
      target.deaths++;
      target.respawnTimer = calculateDeathTimer(target.level, matchTimeRef.current);
      target.comboStage = 0;
      target.comboHitConfirmed = false;
      target.isRecalling = false;
      target.recallTimer = 0;

      let multiKillTitle: 'DOUBLE KILL' | 'TRIPLE KILL' | 'QUADRA KILL' | 'PENTA KILL' | null = null;
      let streakTitle: string | null = null;
      let isFirstBlood = false;

      if (killer) {
        killer.kills++;
        lastTeamKillAtRef.current[killer.team] = matchTimeRef.current;
        killer.gold += 300;
        grantChampionXp(killer, 240);

        if (!firstBloodRef.current) {
          firstBloodRef.current = true;
          isFirstBlood = true;
          killer.gold += 150;
        }

        // Grant assists and assist gold/XP to nearby living teammates
        championsRef.current
          .filter((c) => c.team === killer.team && c.id !== killer.id && c.isAlive && Math.hypot(c.x - target.x, c.y - target.y) <= 460)
          .forEach((ally) => {
            ally.assists++;
            ally.gold += 150;
            grantChampionXp(ally, 120);
          });

        // Multikill & Spree tracking
        const tracker = killStreaksRef.current[killer.id] || { count: 0, lastTime: 0, multiCount: 0 };
        const timeSinceLast = matchTimeRef.current - tracker.lastTime;
        tracker.multiCount = nextMultikillCount(tracker.multiCount, timeSinceLast);
        tracker.count += 1;
        tracker.lastTime = matchTimeRef.current;
        killStreaksRef.current[killer.id] = tracker;

        if (tracker.multiCount === 2) multiKillTitle = 'DOUBLE KILL';
        else if (tracker.multiCount === 3) multiKillTitle = 'TRIPLE KILL';
        else if (tracker.multiCount === 4) multiKillTitle = 'QUADRA KILL';
        else if (tracker.multiCount >= 5) multiKillTitle = 'PENTA KILL';

        if (tracker.count === 3) streakTitle = 'KILLING SPREE';
        else if (tracker.count === 4) streakTitle = 'RAMPAGE';
        else if (tracker.count === 5) streakTitle = 'UNSTOPPABLE';
        else if (tracker.count >= 6) streakTitle = 'GODLIKE / LEGENDARY';

        sound.playSpellHit();
        if (multiKillTitle) {
          sound.playUltimateExplosion();
        }
      } else if (isTurretFinish && turretReward && turretReward.splitGoldPerAlly > 0) {
        // Pure turret execution (>10s or unhit by enemies): turret's team splits the 300g kill bounty evenly
        turretReward.turretAllies.forEach((ally) => {
          ally.gold += turretReward.splitGoldPerAlly;
          floatsRef.current.push({
            id: random().toString(),
            x: ally.x + (random() - 0.5) * 20,
            y: ally.y - 28,
            text: `+${turretReward.splitGoldPerAlly}g Turret Split! 💰`,
            color: '#fbbf24',
            opacity: 1,
            scale: 1.15
          });
        });
        sound.playCoin();
      }

      if (target && killStreaksRef.current[target.id]) {
        killStreaksRef.current[target.id].count = 0;
      }

      const neutralKiller = label?.includes('Jungle Camp') ? 'Jungle Camp'
        : label?.includes('Flame Breath') || label?.includes('Inferno Slam') ? dragonRef.current.name
          : label === 'Creep' ? 'Creep'
            : isTurretFinish ? 'Defense Turret' : null;
      const killerName = killer?.player.name || (isTurretFinish ? 'Defense Turret' : neutralKiller || 'Turret');
      const turretTeam = target.team === 'blue' ? 'red' : 'blue';

      // Trigger the top kill callout
      const callout: KillCallout = {
        id: random().toString(),
        killerName,
        killerChamp: killer?.champion.displayName || (isTurretFinish ? 'Defense Turret' : neutralKiller ? 'Neutral Monster' : 'Defense Turret'),
        killerTeam: killer?.team || turretTeam,
        killerAvatar: killer?.player.avatarSvg,
        neutralFinisher: isNeutralFinish ? (isTurretFinish ? 'Defense Turret' : neutralKiller ?? 'Neutral Monster') : undefined,
        victimName: target.player.name,
        victimChamp: target.champion.displayName,
        victimTeam: target.team,
        victimAvatar: target.player.avatarSvg,
        multiKill: multiKillTitle,
        streakText: killer ? streakTitle : 'EXECUTED',
        isFirstBlood
      };

      setKillCallout(callout);
      setRecentKills((previous) => [callout, ...previous].slice(0, 4));
      setTimeout(() => {
        setKillCallout((curr) => (curr?.id === callout.id ? null : curr));
      }, 4200);

      const killEventText = multiKillTitle
        ? `🔥 ${multiKillTitle}! ${killer?.player.name} eliminated ${target.player.name}!`
        : killer
          ? `☠️ ${killer.player.name} eliminated ${target.player.name} (${target.champion.displayName})${isTurretFinish ? ' under Defense Turret fire' : isMonsterFinish ? ' after a neutral monster struck the final blow' : ''}`
          : isTurretFinish
            ? `⚡ ${target.player.name} (${target.champion.displayName}) was EXECUTED by Defense Turret!${turretReward && turretReward.splitGoldPerAlly > 0 ? ` (+${turretReward.splitGoldPerAlly}g split to ${turretReward.turretTeam.toUpperCase()})` : ''}`
            : `⚡ ${target.player.name} (${target.champion.displayName}) was EXECUTED by ${killerName}!`;
      addEvent(killEventText, killer ? 'kill' : 'execution');
    }
  };

  const applyDamageToStructure = (attacker: AramChampionUnit, structure: LaneStructure, damage: number) => {
    const nearbyAlliedMinions = minionsRef.current.filter((m) => m.team === attacker.team && m.isAlive && Math.abs(m.x - structure.x) <= 240);
    const crashMultiplier = getMinionCrashMultiplier(nearbyAlliedMinions);
    const dragonSiegeFactor = aegisBuffRef.current?.team === attacker.team ? aegisBuffRef.current.siegeMultiplier : 1.0;
    const marksmanBonus = attacker.champion.primaryRole === 'Marksman' ? 1.25 : 1.0;

    const finalDamage = Math.round(damage * crashMultiplier * dragonSiegeFactor * marksmanBonus);
    const appliedDamage = damageStructure(structure, finalDamage);

    const isCrashBonus = crashMultiplier >= 1.2;
    floatsRef.current.push({
      id: random().toString(),
      x: structure.x,
      y: structure.y - 40,
      text: appliedDamage === 0 ? '🛡️ NEXUS SEALED'
        : dragonSiegeFactor > 1.0
        ? `-${appliedDamage} 🐉 SIEGE!`
        : isCrashBonus
          ? `-${appliedDamage} 💥 DEMOLITION!`
          : crashMultiplier < 0.5
            ? `-${appliedDamage} 🛡️ FORTIFIED`
            : `-${appliedDamage}`,
      color: dragonSiegeFactor > 1.0 ? '#fb923c' : isCrashBonus ? '#f59e0b' : '#facc15',
      opacity: 1,
      scale: dragonSiegeFactor > 1.0 ? 1.3 : isCrashBonus ? 1.25 : 1.0
    });
  };

  const damageStructure = (structure: LaneStructure, damage: number) => {
    if (!structure.isAlive) return 0;
    if (structure.type === 'nexus' && !canDamageNexus(structure.team, structuresRef.current)) return 0;
    const applied = Math.max(1, Math.round(damage * (structure.type.includes('tower') ? towerSiegeMultiplier(matchTimeRef.current) : 1)));
    structure.hp = Math.max(0, structure.hp - applied);
    if (structure.hp === 0) handleStructureDestruction(structure);
    return applied;
  };

  const handleStructureDestruction = (structure: LaneStructure) => {
    structure.isAlive = false;
    sound.playUltimateExplosion();

    if (structure.type === 'nexus') return;
    const isTower = structure.type !== 'barracks';
    const bounty = isTower ? 250 : 200;

    const enemyTeam = structure.team === 'blue' ? 'red' : 'blue';
    championsRef.current
      .filter((c) => c.team === enemyTeam)
      .forEach((ally) => {
        ally.gold += bounty;
      });

    const bonus = structure.barracksKind ? `${structure.barracksKind.toUpperCase()} creeps upgraded from the next wave!` : 'Causeways advanced!';
    showBanner(`🏰 ${structure.name} DESTROYED!`, `+${bounty}g Team Bounty. ${bonus}`, '🏰');
    addEvent(`🏰 ${structure.name} destroyed! ${bonus}`, 'tower');
  };

  const applyDamageToMinion = (attacker: AramChampionUnit, minion: LaneMinion, damage: number) => {
    minion.hp -= damage;
    if (minion.hp <= 0 && minion.isAlive) {
      minion.isAlive = false;
      attacker.cs += 1;
      attacker.gold += minion.goldReward;
      grantChampionXp(attacker, minion.xpReward);

      championsRef.current
        .filter((c) => c.team === attacker.team && c.id !== attacker.id && c.isAlive && Math.hypot(c.x - minion.x, c.y - minion.y) <= 320)
        .forEach((ally) => grantChampionXp(ally, Math.round(minion.xpReward * 0.7)));

      floatsRef.current.push({
        id: random().toString(),
        x: minion.x,
        y: minion.y - 15,
        text: `+${minion.goldReward}g`,
        color: '#facc15',
        opacity: 0.9,
        scale: 0.9
      });
    }
  };

  const endAramMatch = (winner: 'blue' | 'red') => {
    if (matchFinishedRef.current) return;
    matchFinishedRef.current = true;
    setMatchOver(true);
    sound.playWalkoutFanfare();

    const all = championsRef.current;
    const mvp = [...all].sort((a, b) => b.kills * 4 + b.cs * 2 + b.damageDealt / 300 - a.kills * 4 - a.cs * 2 - a.damageDealt / 300)[0];
    const rating = (team: 'blue' | 'red') => all.filter(champion => champion.team === team)
      .reduce((sum, champion) => sum + champion.player.ovr, 0) / Math.max(1, all.filter(champion => champion.team === team).length);
    const report: MatchReport = {
      version: 1, seed, batchId: batchMode ? batchId : undefined,
      draft: { blue: blueLineup, red: redLineup, blueCoach, redCoach },
      winner, durationSeconds: matchTimeRef.current,
      blueRating: rating('blue'), redRating: rating('red'),
      fullBuildsAt15: matchTimeRef.current >= 900 ? fullBuildsAt15Ref.current : null,
      itemCounts: itemCountsRef.current,
      blueKills: all.filter(champion => champion.team === 'blue').reduce((sum, champion) => sum + champion.kills, 0),
      redKills: all.filter(champion => champion.team === 'red').reduce((sum, champion) => sum + champion.kills, 0),
      skillshotsFired: skillshotsRef.current.fired, skillshotsHit: skillshotsRef.current.hit,
      events: recordedEventsRef.current,
      insights: insightsRef.current
    };
    latestReportRef.current = report;
    try {
      const prior = JSON.parse(localStorage.getItem('esports-clash-match-reports') || '[]') as MatchReport[];
      let reports = [...prior.filter(previous => batchMode || previous.batchId !== undefined || previous.seed !== seed), report].slice(-100);
      let stored = false;
      while (!stored && reports.length > 0) {
        try {
          localStorage.setItem('esports-clash-match-reports', JSON.stringify(reports));
          stored = true;
        } catch {
          reports = reports.slice(Math.max(1, Math.floor(reports.length / 4)));
        }
      }
      setBalanceSummary(summarizeMatchReports(stored
        ? batchMode ? reports.filter(saved => saved.batchId === batchId) : reports : [report]));
    } catch { setBalanceSummary(summarizeMatchReports([report])); }
    onMatchComplete(winner, mvp, all);
  };

  // =========================================================================
  // DEDICATED PROCEDURAL MODELS FOR JUNGLE MONSTERS & DRAGON
  // =========================================================================

  // 1. Frost Sentinel (Granite & Ice Golem)
  const drawGravemarchModel = (ctx: CanvasRenderingContext2D, animTime: number, attack = { windup: 0, strike: 0 }) => {
    ctx.save();
    const pulse = Math.sin(animTime * 2) * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath(); ctx.ellipse(0, 16, 50, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#29251f';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 16, -32 + pulse);
      ctx.lineTo(side * 38, -69 + pulse);
      ctx.lineTo(side * 30, -23 + pulse);
      ctx.closePath(); ctx.fill();
    }
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#54452d';
    ctx.beginPath(); ctx.roundRect(-29 + attack.strike * 6, -34 + pulse + attack.windup * 5, 58, 49, 10); ctx.fill();
    ctx.fillStyle = '#8e7650';
    ctx.fillRect(-44, -29 + pulse - attack.windup * 12, 14, 34);
    ctx.fillRect(30 + attack.strike * 13, -29 + pulse - attack.windup * 19 + attack.strike * 11, 14, 34);
    ctx.fillStyle = '#bda272';
    ctx.beginPath(); ctx.roundRect(-18, -51 + pulse, 36, 24, 5); ctx.fill();
    // An offset cheek plate gives the otherwise frontal colossus a clear facing.
    ctx.fillStyle = '#d6b77b';
    ctx.beginPath(); ctx.moveTo(17, -45 + pulse); ctx.lineTo(29, -39 + pulse);
    ctx.lineTo(17, -32 + pulse); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-12, -43 + pulse, 8, 5); ctx.fillRect(4, -43 + pulse, 8, 5);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -28 + pulse); ctx.lineTo(-8, -17 + pulse);
    ctx.lineTo(0, -11 + pulse); ctx.lineTo(8, -17 + pulse);
    ctx.stroke();
    ctx.fillStyle = '#2f2924';
    ctx.beginPath(); ctx.roundRect(-51, -4 + pulse - attack.windup * 12, 19, 20, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(32 + attack.strike * 13, -4 + pulse - attack.windup * 19 + attack.strike * 11, 19, 20, 4); ctx.fill();
    if (attack.strike > 0) {
      ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3; ctx.globalAlpha = attack.strike;
      ctx.beginPath(); ctx.ellipse(49, 14, 19 + attack.strike * 12, 6 + attack.strike * 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#eab308'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-17, -10 + pulse); ctx.lineTo(0, 5 + pulse); ctx.lineTo(17, -10 + pulse); ctx.stroke();
    ctx.restore();
  };

  const drawFrostSentinelModel = (ctx: CanvasRenderingContext2D, animTime: number, attack = { windup: 0, strike: 0 }) => {
    const bob = Math.sin(animTime * 3) * 2;
    ctx.save();
    ctx.translate(0, bob);
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone Legs
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10, 2, 8, 12);
    ctx.fillRect(2, 2, 8, 12);

    // Heavy Granite Torso
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Glowing Cyan Core
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f2ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ice Crystal Shoulders
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(-16, -14); ctx.lineTo(-24, -22); ctx.lineTo(-12, -18); ctx.fill();
    ctx.moveTo(16, -14); ctx.lineTo(24, -22); ctx.lineTo(12, -18); ctx.fill();

    // Golem Head & Eye Slit
    ctx.fillStyle = '#334155';
    ctx.fillRect(-7, -24, 14, 10);
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath(); ctx.moveTo(6, -23); ctx.lineTo(14, -19); ctx.lineTo(6, -15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-5, -21, 3, 2);
    ctx.fillRect(2, -21, 3, 2);

    // Stone Fists
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-16, -attack.windup * 11, 6, 0, Math.PI * 2);
    ctx.arc(16 + attack.strike * 9, -attack.windup * 13 + attack.strike * 7, 6, 0, Math.PI * 2);
    ctx.fill();
    if (attack.strike > 0) {
      ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2.5; ctx.globalAlpha = attack.strike;
      ctx.beginPath(); ctx.arc(24, 5, 9 + attack.strike * 5, -1, 1); ctx.stroke();
    }
    ctx.restore();
  };

  // 2. Shadow Stalkers (Dire Wolves)
  const drawShadowWolfModel = (ctx: CanvasRenderingContext2D, animTime: number, attack = { windup: 0, strike: 0 }) => {
    const breathe = Math.sin(animTime * 4) * 1.5;
    ctx.save();
    ctx.translate(0, breathe);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.strokeStyle = '#4c1d95';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.quadraticCurveTo(-20, -10, -22, 2);
    ctx.stroke();

    // Wolf Body
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spiky Fur Crest
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.moveTo(-6, -8); ctx.lineTo(2, -16); ctx.lineTo(10, -6); ctx.fill();

    // Head & Muzzle
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(20 + attack.strike * 9, -1 - attack.windup * 4);
    ctx.lineTo(10, 4 + attack.strike * 4);
    ctx.closePath();
    ctx.fill();

    // Ears
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.moveTo(8, -8); ctx.lineTo(10, -18); ctx.lineTo(13, -7); ctx.fill();

    // Glowing Purple Eye
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(12, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    if (attack.strike > 0) {
      ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 1.8; ctx.globalAlpha = attack.strike;
      ctx.beginPath(); ctx.moveTo(17, 2); ctx.lineTo(28 + attack.strike * 7, 7); ctx.stroke();
    }

    // Paws
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(-8, 6, 4, 7);
    ctx.fillRect(6, 6, 4, 7);
    ctx.restore();
  };

  // 3. Murk Behemoth (Armored Swamp Beast)
  const drawMurkBehemothModel = (ctx: CanvasRenderingContext2D, animTime: number, attack = { windup: 0, strike: 0 }) => {
    const step = Math.sin(animTime * 3) * 1.5;
    ctx.save();
    ctx.translate(0, step);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Jade Shell
    ctx.fillStyle = '#065f46';
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -2, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shell Plates
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(-5, -4, 4, 0, Math.PI * 2);
    ctx.arc(5, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.arc(14 + attack.strike * 7 - attack.windup * 4, attack.strike * 3, 9, 0, Math.PI * 2);
    ctx.fill();

    // Curved Tusks
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(18 + attack.strike * 7, 3);
    ctx.quadraticCurveTo(25 + attack.strike * 8, 4, 24 + attack.strike * 8, -4);
    ctx.stroke();

    // Glowing Eye
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(15, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Paws
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(-10, 6, 7, 9);
    ctx.fillRect(4, 6, 7, 9);
    ctx.restore();
  };

  // 4. Crimson Drakes (Fiery Drake)
  const drawCrimsonDrakeModel = (ctx: CanvasRenderingContext2D, animTime: number, attack = { windup: 0, strike: 0 }) => {
    const flap = Math.sin(animTime * 5) * 5;
    ctx.save();
    ctx.translate(0, flap);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bat Wings
    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-24, -22 - flap - attack.windup * 12);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.lineTo(24, -22 - flap - attack.windup * 12);
    ctx.lineTo(12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spiked Tail
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.quadraticCurveTo(-20, 8, -24, 0);
    ctx.stroke();

    // Horned Head
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(12, -4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(10, -10); ctx.lineTo(14, -20); ctx.lineTo(16, -9); ctx.fill();

    // Eye
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(14, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    if (attack.strike > 0) {
      ctx.fillStyle = '#fbbf24'; ctx.globalAlpha = attack.strike;
      ctx.beginPath(); ctx.moveTo(17, -1); ctx.lineTo(33 + attack.strike * 13, -8);
      ctx.lineTo(28 + attack.strike * 13, 7); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  // Embermaw has a long snout, scale plates, spined tail, and batlike wings.
  const drawEmbermawDragonModel = (ctx: CanvasRenderingContext2D, animTime: number) => {
    const flap = Math.sin(animTime * 3.6) * 9;
    const hover = Math.sin(animTime * 2.1) * 3;
    ctx.save();
    ctx.translate(0, hover);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 28 - hover, 54, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // The forked, spined tail curls behind the body.
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 13);
    ctx.bezierCurveTo(-48, 18, -46, 48, -78, 32);
    ctx.stroke();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.moveTo(-78, 32); ctx.lineTo(-93, 23); ctx.lineTo(-87, 40);
    ctx.closePath(); ctx.fill();

    // Veined wings lift independently of the torso.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      const wing = ctx.createLinearGradient(15, -48, 82, 16);
      wing.addColorStop(0, '#fb923c');
      wing.addColorStop(0.45, '#b91c1c');
      wing.addColorStop(1, '#431407');
      ctx.fillStyle = wing;
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -12);
      ctx.lineTo(42, -58 - flap);
      ctx.lineTo(88, -65 - flap);
      ctx.lineTo(70, -33 - flap * 0.5);
      ctx.lineTo(92, -10);
      ctx.lineTo(53, -15);
      ctx.lineTo(61, 20);
      ctx.lineTo(13, 7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(12, -12); ctx.lineTo(88, -65 - flap);
      ctx.moveTo(12, -12); ctx.lineTo(92, -10);
      ctx.moveTo(12, -12); ctx.lineTo(61, 20);
      ctx.stroke();
      ctx.restore();
    }

    const scales = ctx.createLinearGradient(-30, -28, 35, 28);
    scales.addColorStop(0, '#fdba74');
    scales.addColorStop(0.35, '#c2410c');
    scales.addColorStop(1, '#7c2d12');
    ctx.fillStyle = scales;
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-3, 2, 34, 25, -0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(5, 12, 21, 10, -0.1, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#f97316' : '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-28 + i * 12, -17);
      ctx.lineTo(-24 + i * 12, -35 - (i % 2) * 5);
      ctx.lineTo(-16 + i * 12, -17);
      ctx.fill();
    }

    // Neck, horned skull and angular open jaws make the silhouette a dragon.
    ctx.fillStyle = '#9a3412';
    ctx.beginPath();
    ctx.moveTo(15, -11); ctx.quadraticCurveTo(30, -42, 42, -42);
    ctx.lineTo(47, -25); ctx.lineTo(31, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(31, -45); ctx.quadraticCurveTo(43, -58, 58, -49);
    ctx.lineTo(73, -35); ctx.lineTo(58, -28); ctx.lineTo(45, -32);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#431407'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.moveTo(38, -49); ctx.lineTo(31, -70); ctx.lineTo(48, -54);
    ctx.moveTo(48, -48); ctx.lineTo(54, -67); ctx.lineTo(59, -45);
    ctx.fill();
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.moveTo(47, -28); ctx.lineTo(77, -29); ctx.lineTo(62, -21);
    ctx.lineTo(49, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.moveTo(57, -28); ctx.lineTo(61, -21); ctx.lineTo(64, -28);
    ctx.moveTo(69, -28); ctx.lineTo(71, -23); ctx.lineTo(74, -29);
    ctx.fill();
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(51, -43, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    if (Math.sin(animTime * 3) > 0.1) {
      for (let i = 0; i < 4; i++) {
        const px = 76 + i * 9;
        ctx.fillStyle = i % 2 ? '#f97316' : '#facc15';
        ctx.beginPath();
        ctx.moveTo(px, -28 + Math.sin(animTime * 8 + i) * 4);
        ctx.lineTo(px + 16, -24 + i * 2);
        ctx.lineTo(px, -20);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // =========================================================================
  // HIGH-FIDELITY SPECTATOR-GRADE CANVAS RENDERER (LARGER MIDDLE ARENA)
  // =========================================================================
  const drawAramBattleground = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height);
    // Stretch the architectural backdrop to the wider world; actors use world coordinates.
    ctx.save();
    ctx.scale(width / 1320, 1);

    // 1. ORGANIC FOREST TERRAIN & EARTHEN GROUND BASE
    const groundGrad = ctx.createLinearGradient(0, 0, 0, height);
    groundGrad.addColorStop(0, '#091811');
    groundGrad.addColorStop(0.2, '#0e261d');
    groundGrad.addColorStop(0.5, '#133326');
    groundGrad.addColorStop(0.8, '#0e281e');
    groundGrad.addColorStop(1, '#091710');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, 1320, height);

    // Natural moss & grass texture patches
    ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
    for (let p = 0; p < 25; p++) {
      const px = (p * 57) % 1300 + 10;
      const py = (p * 73) % (height - 40) + 20;
      const pr = 18 + (p % 4) * 8;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Natural Riverbed cutting through the center valley
    const riverGrad = ctx.createLinearGradient(590, 0, 730, 0);
    riverGrad.addColorStop(0, 'rgba(6, 78, 59, 0.4)');
    riverGrad.addColorStop(0.2, 'rgba(15, 118, 110, 0.55)');
    riverGrad.addColorStop(0.5, 'rgba(13, 148, 136, 0.65)');
    riverGrad.addColorStop(0.8, 'rgba(15, 118, 110, 0.55)');
    riverGrad.addColorStop(1, 'rgba(6, 78, 59, 0.4)');
    ctx.fillStyle = riverGrad;
    ctx.beginPath();
    ctx.moveTo(630, 0);
    ctx.bezierCurveTo(610, 200, 690, 480, 640, height);
    ctx.lineTo(720, height);
    ctx.bezierCurveTo(770, 480, 690, 200, 710, 0);
    ctx.closePath();
    ctx.fill();

    // River water flow ripples
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)';
    ctx.lineWidth = 1.8;
    for (let r = 0; r < 9; r++) {
      const ry = ((r * 85 + time * 35) % height);
      const rx = 645 + Math.sin(ry * 0.012 + time * 1.5) * 22;
      ctx.beginPath();
      ctx.moveTo(rx - 22, ry);
      ctx.quadraticCurveTo(rx, ry + 4, rx + 22, ry);
      ctx.stroke();
    }

    // 2. LIVING FOREST TREES ALONG NORTHERN & SOUTHERN MARGINS
    const drawTree = (tx: number, ty: number, tr: number, seed: number) => {
      const sway = Math.sin(time * 1.6 + seed) * 3;
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(tx, ty + tr * 0.45, tr * 0.9, tr * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tree trunk
      ctx.fillStyle = '#3e2312';
      ctx.fillRect(tx - tr * 0.16, ty - tr * 0.1, tr * 0.32, tr * 0.55);

      // Layer 1: Dark deep canopy base
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.arc(tx + sway * 0.4, ty - tr * 0.35, tr * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Layer 2: Lush emerald mid-canopy
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(tx + sway * 0.7, ty - tr * 0.5, tr * 0.68, 0, Math.PI * 2);
      ctx.fill();

      // Layer 3: Vibrant leaf highlight cluster
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(tx + sway - tr * 0.15, ty - tr * 0.65, tr * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(tx + sway + tr * 0.15, ty - tr * 0.58, tr * 0.28, 0, Math.PI * 2);
      ctx.fill();
    };

    // Northern Ridge Trees (avoiding Dragon Pit at 660)
    const northTreePositions = [
      [80, 50, 24], [140, 42, 28], [210, 58, 22], [280, 45, 26], [360, 52, 24],
      [440, 40, 26], [510, 56, 22], [800, 52, 24], [870, 40, 26], [950, 55, 22],
      [1030, 42, 26], [1110, 56, 24], [1180, 46, 28], [1250, 52, 24]
    ];
    northTreePositions.forEach(([tx, ty, tr], idx) => drawTree(tx, ty, tr, idx * 1.3));

    // Southern Valley Trees (framing lower valley and bushes)
    const southTreePositions = [
      [70, 680, 28], [140, 690, 25], [210, 675, 27], [290, 695, 24], [380, 680, 26],
      [460, 690, 25], [540, 675, 28], [630, 695, 24], [720, 685, 26], [810, 690, 25],
      [900, 675, 27], [990, 695, 25], [1080, 680, 28], [1170, 690, 25], [1250, 675, 27]
    ];
    southTreePositions.forEach(([tx, ty, tr], idx) => drawTree(tx, ty, tr, idx * 1.7 + 10));

    // Deterministic pseudo-random generator based on coordinates
    const rockHash = (x: number, y: number, seed: number) => {
      const val = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
      return val - Math.floor(val);
    };

    // 3. SCATTERED NATURAL ROCKS, BOULDERS & PEBBLES
    const drawRock = (rx: number, ry: number, rw: number, rh: number, color = '#475569') => {
      const rh1 = rockHash(rx, ry, 1);
      const rh2 = rockHash(rx, ry, 2);
      const tilt = (rh1 - 0.5) * 0.4;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(tilt);

      // Diffuse contact shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(2, rh * 0.35, rw * 1.05, rh * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep shaded bottom rim
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(0, 2, rw * 0.98, rh * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rock body with directional lighting
      const stoneGrad = ctx.createLinearGradient(-rw * 0.5, -rh * 0.8, rw * 0.5, rh * 0.8);
      stoneGrad.addColorStop(0, '#64748b');
      stoneGrad.addColorStop(0.45, color);
      stoneGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = stoneGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();

      // Natural sunlit crest highlight
      ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-rw * 0.28, -rh * 0.3, rw * 0.52, rh * 0.35, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Natural moss growth on river rocks
      if (color !== '#292524' && rh2 > 0.3) {
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.ellipse(rw * 0.22, rh * 0.08, rw * 0.28, rh * 0.24, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(rw * 0.2, rh * 0.06, rw * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // Rocks scattered along riverbanks and trail borders
    const rockLocations = [
      [240, 225, 12, 8], [305, 240, 16, 11], [530, 235, 14, 9], [610, 215, 18, 12],
      [740, 215, 17, 11], [840, 235, 13, 9], [1060, 225, 15, 10], [1160, 240, 12, 8],
      [250, 520, 15, 10], [330, 510, 12, 8], [600, 535, 18, 12], [730, 535, 16, 11],
      [870, 515, 14, 9], [1050, 520, 15, 10], [1180, 510, 13, 8]
    ];
    rockLocations.forEach(([rx, ry, rw, rh]) => drawRock(rx, ry, rw, rh));

    // Natural geological formations: Continuous curved bedrock coves and 3D multi-faceted boulders
    const campRingMap = new Map<string, (typeof CAMP_ROCK_RINGS)[number]>(
      CAMP_ROCK_RINGS.map(ring => [ring.id, ring])
    );

    const drawRaisedRockTerrain = () => {
      // Step A: Continuous bedrock embankments linking camp rings into cohesive cliff coves
      CAMP_ROCK_RINGS.forEach(ring => {
        const cx = (ring.x / ARENA_WIDTH) * 1320;
        const cy = ring.y;
        const rx = (ring.radius / ARENA_WIDTH) * 1320;
        const ry = ring.radius;
        const sR = (ring.stoneRadius / ARENA_WIDTH) * 1320;
        const isDragon = ring.id === 'dragon_boss';
        const isGolem = ring.id === 'j_siege_golem';

        // Non-entrance perimeter of the camp cove: wide flared opening with no gate pinch
        const isBoss = ring.stones === 16;
        const gapThreshold = isBoss ? 0.58 : 0.72;
        const startAngle = ring.entrance + gapThreshold;
        const endAngle = ring.entrance + Math.PI * 2 - gapThreshold;

        ctx.save();
        // 1. Soft foundation shadow
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, rx + 2, ry + 4, 0, startAngle, endAngle);
        ctx.lineWidth = sR * 2.1;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = isDragon ? 'rgba(0, 0, 0, 0.62)' : 'rgba(0, 0, 0, 0.45)';
        ctx.stroke();

        // 2. Continuous bedrock core linking all stones into an authentic cliff wall
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
        ctx.lineWidth = sR * 1.75;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = isDragon ? '#18181b' : isGolem ? '#151f2e' : '#16281e';
        ctx.stroke();

        // 3. Cove outer edge / turf transition
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, rx + sR * 0.35, ry + sR * 0.35, 0, startAngle, endAngle);
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = isDragon ? 'rgba(120, 53, 15, 0.4)' : isGolem ? 'rgba(30, 41, 59, 0.5)' : 'rgba(4, 120, 87, 0.3)';
        ctx.stroke();

        // 4. Subtle inner caldera glow for Dragon pit
        if (isDragon) {
          ctx.beginPath();
          ctx.ellipse(cx, cy + 1, rx - sR * 0.4, ry - sR * 0.4, 0, startAngle, endAngle);
          ctx.lineWidth = 3;
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(234, 88, 12, 0.45)';
          ctx.stroke();
        }
        ctx.restore();
      });

      // Step B: Continuous bedrock shelves for Highground base ramp walls
      const highgroundSegments = [
        { x1: (455 / ARENA_WIDTH) * 1320, x2: (535 / ARENA_WIDTH) * 1320, y: 295 },
        { x1: (455 / ARENA_WIDTH) * 1320, x2: (535 / ARENA_WIDTH) * 1320, y: 465 },
        { x1: ((ARENA_WIDTH - 535) / ARENA_WIDTH) * 1320, x2: ((ARENA_WIDTH - 455) / ARENA_WIDTH) * 1320, y: 295 },
        { x1: ((ARENA_WIDTH - 535) / ARENA_WIDTH) * 1320, x2: ((ARENA_WIDTH - 455) / ARENA_WIDTH) * 1320, y: 465 },
      ];
      highgroundSegments.forEach(({ x1, x2, y }) => {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(x1 - 18, y + 4, (x2 - x1) + 36, 18, 9);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(x1 - 16, y - 6, (x2 - x1) + 32, 22, 7);
        ctx.fill();

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });

      // Step C: Procedural 3D organic boulders for each rock in ROCK_TERRAIN
      ROCK_TERRAIN.forEach((rock) => {
        const ridgeX = (rock.x / ARENA_WIDTH) * 1320;
        const ridgeY = rock.y;
        const baseR = (rock.radius / ARENA_WIDTH) * 1320;

        const isDragon = rock.campId === 'dragon_boss';
        const isGolem = rock.campId === 'j_siege_golem';
        const isHighground = rock.campId.includes('highground');

        const h1 = rockHash(rock.x, rock.y, 1);
        const h2 = rockHash(rock.x, rock.y, 2);
        const h3 = rockHash(rock.x, rock.y, 3);
        const h4 = rockHash(rock.x, rock.y, 4);
        const h5 = rockHash(rock.x, rock.y, 5);

        const wR = baseR * (0.95 + h1 * 0.22);
        const hR = baseR * (0.86 + h2 * 0.24);

        // Natural tangential orientation along the camp cove / ridge
        let alignAngle = 0;
        const camp = campRingMap.get(rock.campId);
        if (camp) {
          const dx = ((rock.x - camp.x) / ARENA_WIDTH) * 1320;
          const dy = rock.y - camp.y;
          alignAngle = Math.atan2(dy, dx) + Math.PI / 2 + (h3 - 0.5) * 0.32;
        } else {
          alignAngle = (h3 - 0.5) * 0.22;
        }

        ctx.save();
        ctx.translate(ridgeX, ridgeY);
        ctx.rotate(alignAngle);

        // 1. Soft contact shadow
        ctx.fillStyle = isDragon ? 'rgba(0, 0, 0, 0.52)' : 'rgba(0, 0, 0, 0.42)';
        ctx.beginPath();
        ctx.ellipse(h4 * 2 - 1, hR * 0.32 + 3, wR * 1.15, hR * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Chiseled 8-point organic boulder silhouette
        const pts: [number, number][] = [];
        for (let k = 0; k < 8; k++) {
          const ang = k * (Math.PI * 2 / 8);
          const vh = rockHash(rock.x + k * 17, rock.y + k * 23, k + 6);
          const distFactor = (ang > 0.2 && ang < Math.PI - 0.2)
            ? (0.88 + vh * 0.22)
            : (0.92 + vh * 0.24);
          pts.push([
            Math.cos(ang) * wR * distFactor,
            Math.sin(ang) * hR * distFactor,
          ]);
        }

        // Base dark shaded under-facet
        ctx.fillStyle = isDragon ? '#18181b' : isGolem ? '#101726' : isHighground ? '#182232' : '#15201b';
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < 8; k++) {
          ctx.lineTo(pts[k][0], pts[k][1]);
        }
        ctx.closePath();
        ctx.fill();

        // 3. Midtone Rock Body (lifted toward light)
        const midColor1 = isDragon ? '#292524' : isGolem ? '#222f3e' : isHighground ? '#283648' : '#2b3b34';
        const midColor2 = isDragon ? '#44403c' : isGolem ? '#334155' : isHighground ? '#3f4f66' : '#3d4f44';
        const bodyGrad = ctx.createLinearGradient(-wR * 0.6, -hR * 0.8, wR * 0.5, hR * 0.6);
        bodyGrad.addColorStop(0, midColor2);
        bodyGrad.addColorStop(0.5, midColor1);
        bodyGrad.addColorStop(1, isDragon ? '#1c1917' : '#141d24');
        ctx.fillStyle = bodyGrad;

        ctx.beginPath();
        ctx.moveTo(pts[0][0] * 0.95, pts[0][1] * 0.92 - 1.5);
        ctx.lineTo(pts[1][0] * 0.95, pts[1][1] * 0.92 - 1.5);
        ctx.lineTo(pts[2][0] * 0.92, pts[2][1] * 0.88 - 2.5);
        ctx.lineTo(pts[3][0] * 0.88, pts[3][1] * 0.82 - 3);
        ctx.lineTo(pts[4][0] * 0.88, pts[4][1] * 0.82 - 3);
        ctx.lineTo(pts[5][0] * 0.92, pts[5][1] * 0.88 - 2.5);
        ctx.lineTo(pts[6][0] * 0.95, pts[6][1] * 0.92 - 1.5);
        ctx.lineTo(pts[7][0] * 0.95, pts[7][1] * 0.92 - 1.5);
        ctx.closePath();
        ctx.fill();

        // 4. Sunlit Upper Crest Facet
        const sunlitColor = isDragon ? '#57534e' : isGolem ? '#475569' : isHighground ? '#53657d' : '#526b5d';
        ctx.fillStyle = sunlitColor;
        ctx.beginPath();
        ctx.moveTo(pts[5][0] * 0.92, pts[5][1] * 0.88 - 2.5);
        ctx.lineTo(pts[6][0] * 0.95, pts[6][1] * 0.92 - 1.5);
        ctx.lineTo(pts[7][0] * 0.95, pts[7][1] * 0.92 - 1.5);
        ctx.lineTo(-wR * 0.1, -hR * 0.2);
        ctx.closePath();
        ctx.fill();

        // 5. Crisp Chiseled Crest Highlight Ridge
        const crestHighlight = isDragon
          ? 'rgba(249, 115, 22, 0.45)'
          : isGolem
            ? 'rgba(148, 163, 184, 0.5)'
            : isHighground
              ? 'rgba(203, 213, 225, 0.55)'
              : 'rgba(167, 243, 208, 0.45)';
        ctx.strokeStyle = crestHighlight;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(pts[5][0] * 0.92, pts[5][1] * 0.88 - 2.5);
        ctx.lineTo(pts[6][0] * 0.95, pts[6][1] * 0.92 - 1.5);
        ctx.lineTo(pts[7][0] * 0.95, pts[7][1] * 0.92 - 1.5);
        ctx.stroke();

        // 6. Geological Fracture Fissures
        ctx.strokeStyle = isDragon ? 'rgba(249, 115, 22, 0.85)' : 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = isDragon ? 1.4 : 1.0;
        const crackX1 = pts[6][0] * 0.7;
        const crackY1 = pts[6][1] * 0.7;
        const crackMidX = (h4 - 0.5) * wR * 0.3;
        const crackMidY = -hR * 0.15;
        const crackEndX = (h5 - 0.5) * wR * 0.5;
        const crackEndY = hR * 0.3;
        ctx.beginPath();
        ctx.moveTo(crackX1, crackY1);
        ctx.lineTo(crackMidX, crackMidY);
        ctx.lineTo(crackEndX, crackEndY);
        ctx.stroke();

        if (isDragon) {
          ctx.strokeStyle = '#fed7aa';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(crackX1, crackY1);
          ctx.lineTo(crackMidX, crackMidY);
          ctx.lineTo(crackEndX, crackEndY);
          ctx.stroke();
        }

        // 7. Biome Surface Overgrowth (Moss / Lichen / Ember Dust)
        if (!isDragon) {
          const mossX = -wR * 0.25 + (h4 - 0.5) * 4;
          const mossY = -hR * 0.35 + (h5 - 0.5) * 3;
          const mossR = baseR * (0.28 + h1 * 0.12);
          ctx.fillStyle = isGolem ? '#0d9488' : '#047857';
          ctx.beginPath();
          ctx.ellipse(mossX, mossY, mossR, mossR * 0.68, (h2 - 0.5) * 0.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isGolem ? '#2dd4bf' : '#10b981';
          ctx.beginPath();
          ctx.arc(mossX - 1, mossY - 1, mossR * 0.42, 0, Math.PI * 2);
          ctx.fill();

          if (h3 > 0.4) {
            ctx.fillStyle = isGolem ? '#115e59' : '#065f46';
            ctx.beginPath();
            ctx.arc(wR * 0.28, hR * 0.1, baseR * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (h1 > 0.4) {
          ctx.fillStyle = 'rgba(251, 146, 60, 0.7)';
          ctx.beginPath();
          ctx.arc(wR * 0.2, -hR * 0.2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 8. Scree Pebbles at Ground Contact
        if (h5 > 0.3) {
          const pX = (h2 - 0.5) * wR * 0.8;
          const pY = hR * 0.65;
          ctx.fillStyle = isDragon ? '#292524' : '#1e293b';
          ctx.beginPath();
          ctx.ellipse(pX, pY, 3, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    };

    // 4. EMBERMAW'S VOLCANIC CRATER PIT (Natural scorched granite & magma)
    ctx.save();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(660, 130, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.stroke();

    for (let b = 0; b < 10; b++) {
      const ba = b * (Math.PI * 2 / 10);
      const bx = 660 + Math.cos(ba) * 92;
      const by = 130 + Math.sin(ba) * 88;
      drawRock(bx, by, 14, 10, '#292524');
    }

    const pitGrad = ctx.createRadialGradient(660, 130, 10, 660, 130, 88);
    pitGrad.addColorStop(0, '#451a03');
    pitGrad.addColorStop(0.45, '#9a3412');
    pitGrad.addColorStop(0.85, '#292524');
    pitGrad.addColorStop(1, '#1c1917');
    ctx.fillStyle = pitGrad;
    ctx.beginPath();
    ctx.arc(660, 130, 86, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 146, 60, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(660, 130, 55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fed7aa';
    for (let s = 0; s < 5; s++) {
      const sa = (time * 2 + s * 1.4) % (Math.PI * 2);
      const sr = 15 + (s * 8);
      ctx.beginPath();
      ctx.arc(660 + Math.cos(sa) * sr, 130 + Math.sin(sa) * sr * 0.7, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMBERMAW • DRAGON PIT', 660, 24);
    ctx.restore();

    // 5. JUNGLE WALKWAYS & NATURAL COBBLESTONE STAIR CONNECTORS
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(320, 120, 240, 95, 14);
    ctx.roundRect(760, 120, 240, 95, 14);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(360, 520, 600, 105, 14);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // Cobblestone connectors between causeway and side paths
    ctx.fillStyle = '#263346';
    ctx.fillRect(480, 205, 55, 60);
    ctx.fillRect(785, 205, 55, 60);
    ctx.fillRect(480, 495, 55, 55);
    ctx.fillRect(785, 495, 55, 55);

    // 6. MAIN CENTRAL CAUSEWAY: WEATHERED STONE PAVERS & COBBLESTONES
    ctx.fillStyle = '#162232';
    ctx.fillRect(50, 260, 1220, 240);

    ctx.fillStyle = '#1e2d40';
    ctx.fillRect(54, 264, 1212, 232);

    ctx.fillStyle = '#27384e';
    ctx.fillRect(58, 268, 1204, 224);

    // Weathered Flagstone Paver Grid with stone joints
    ctx.strokeStyle = '#182433';
    ctx.lineWidth = 1.5;
    for (let x = 70; x <= 1250; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 268);
      ctx.lineTo(x, 492);
      ctx.stroke();
    }
    for (let y = 280; y <= 480; y += 32) {
      ctx.beginPath();
      ctx.moveTo(58, y);
      ctx.lineTo(1262, y);
      ctx.stroke();
    }

    // Moss creeping along stone paver edges
    ctx.fillStyle = 'rgba(4, 120, 87, 0.35)';
    ctx.fillRect(58, 268, 1204, 8);
    ctx.fillRect(58, 484, 1204, 8);

    // Raised stone bases begin at the third turrets and run to each well.
    const blueRampX = NEXUS_TOWER_X.blue / ARENA_WIDTH * 1320;
    const redRampX = NEXUS_TOWER_X.red / ARENA_WIDTH * 1320;
    ([{ start: 50, end: blueRampX, edge: blueRampX, color: '#38bdf8' },
      { start: redRampX, end: 1270, edge: redRampX, color: '#fb7185' }]).forEach(platform => {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.11)';
      ctx.fillRect(platform.start, 269, platform.end - platform.start, 222);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(platform.start, 264, platform.end - platform.start, 8);
      ctx.fillRect(platform.start, 488, platform.end - platform.start, 8);
      ctx.strokeStyle = platform.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(platform.edge, 270); ctx.lineTo(platform.edge, 490); ctx.stroke();
      for (let step = 1; step <= 3; step++) {
        const x = platform.edge + (platform.edge === blueRampX ? 1 : -1) * step * 10;
        ctx.strokeStyle = `rgba(203, 213, 225, ${0.35 - step * 0.07})`;
        ctx.beginPath(); ctx.moveTo(x, 280); ctx.lineTo(x, 480); ctx.stroke();
      }
      for (let mist = 0; mist < 4; mist++) {
        const drift = Math.sin(time * 0.5 + mist * 2.1) * 13;
        const fogX = platform.start + (platform.end - platform.start) * (mist + 0.5) / 4 + drift;
        const fog = ctx.createRadialGradient(fogX, 310 + mist * 43, 4, fogX, 310 + mist * 43, 68);
        fog.addColorStop(0, 'rgba(203, 213, 225, 0.20)');
        fog.addColorStop(1, 'rgba(203, 213, 225, 0)');
        ctx.fillStyle = fog;
        ctx.fillRect(fogX - 68, 270, 136, 220);
      }
    });

    // Central Cobblestone Crossing Highway
    ctx.fillStyle = '#1a2737';
    ctx.fillRect(80, 350, 1160, 60);
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 350, 1160, 60);

    // 7. EXPANDED GRAND MIDDLE BATTLE ARENA (Ancient Radial Stone Plaza)
    ctx.fillStyle = '#152132';
    ctx.beginPath();
    ctx.arc(660, 380, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Radial Stone Inset Ring
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(660, 380, 95, 0, Math.PI * 2);
    ctx.stroke();

    // 8. Stone Parapet Braziers
    const torchX = [180, 320, 460, 600, 720, 860, 1000, 1140];
    torchX.forEach((tx) => {
      // Top Brazier
      ctx.fillStyle = '#090d16';
      ctx.fillRect(tx - 6, 262, 12, 14);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(tx, 262 + Math.sin(time * 9 + tx) * 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx, 261, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bottom Brazier
      ctx.fillStyle = '#090d16';
      ctx.fillRect(tx - 6, 484, 12, 14);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(tx, 494 + Math.sin(time * 9 + tx) * 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx, 494, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // 6. ACTUAL PROCEDURAL JUNGLE MONSTER MODELS WITH FOG OF WAR SHROUD!
    const isFirstWaveTime = matchTimeRef.current < 45.0;
    jungleCampsRef.current.forEach((camp) => {
      ctx.save();
      ctx.translate(camp.homeX ?? camp.x, camp.homeY ?? camp.y);

      const isCampScouted = championsRef.current.some(c => c.isAlive && Math.hypot(c.x - camp.x, c.y - camp.y) <= 220);
      const isShrouded = isFirstWaveTime || !isCampScouted;

      // Camp stone perimeter: spacious interior clearing pad
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, camp.type === 'siege_golem' ? 95 : 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = camp.isAlive ? (isShrouded ? '#334155' : camp.color) : '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Trees stay rooted along the outer back rim of the camp clearing
      for (let tree = 0; tree < 8; tree++) {
        const angle = tree * Math.PI / 4;
        const tx = Math.cos(angle) * (camp.type === 'siege_golem' ? 122 : 86);
        const ty = Math.sin(angle) * (camp.type === 'siege_golem' ? 95 : 68);
        ctx.fillStyle = '#173b2a';
        ctx.beginPath(); ctx.arc(tx, ty, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2d6945';
        ctx.beginPath(); ctx.arc(tx - 2, ty - 3, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.translate(camp.x - (camp.homeX ?? camp.x), camp.y - (camp.homeY ?? camp.y));

      if (camp.isAlive) {
        if (isFirstWaveTime) {
          // Wave 1 Jungle Shroud: Swirling fog cloud obscuring camp
          const fogRadius = camp.type === 'siege_golem' ? 105 : 55;
          const fogG = ctx.createRadialGradient(0, 0, 4, 0, 0, fogRadius);
          fogG.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
          fogG.addColorStop(0.7, 'rgba(30, 41, 59, 0.7)');
          fogG.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = fogG;
          ctx.beginPath();
          ctx.arc(0, 0, fogRadius, 0, Math.PI * 2);
          ctx.fill();

          // Swirling mist wisps
          for (let w = 0; w < 3; w++) {
            const wa = time * 0.9 + w * (Math.PI * 2 / 3);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(Math.cos(wa) * 6, Math.sin(wa) * 5, 18 + w * 4, wa, wa + Math.PI * 0.9);
            ctx.stroke();
          }

          // Shrouded faint creature silhouette
          ctx.save();
          ctx.globalAlpha = 0.28;
          ctx.scale(camp.type === 'siege_golem' ? 1.7 : 1.45, camp.type === 'siege_golem' ? 1.7 : 1.45);
          if (camp.type === 'golem') drawFrostSentinelModel(ctx, time);
          else if (camp.type === 'wolves') drawShadowWolfModel(ctx, time);
          else if (camp.type === 'behemoth') drawMurkBehemothModel(ctx, time);
          else if (camp.type === 'siege_golem') drawGravemarchModel(ctx, time);
          else if (camp.type === 'blue_buff') drawFrostSentinelModel(ctx, time);
          else if (camp.type === 'red_buff') drawCrimsonDrakeModel(ctx, time);
          else drawCrimsonDrakeModel(ctx, time);
          ctx.restore();

          // Wave 1 Shroud Badge & Unlock Countdown
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🌫️ WAVE 1 FOG', 0, -28);
          const unlockRemaining = Math.max(0, Math.ceil(45.0 - matchTimeRef.current));
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`🔒 Unlocks: ${unlockRemaining}s`, 0, -18);
        } else if (!isCampScouted) {
          // Post-wave 1 but outside vision: light unexplored fog
          ctx.save();
          ctx.globalAlpha = 0.38;
          ctx.scale(camp.type === 'siege_golem' ? 1.7 : 1.45, camp.type === 'siege_golem' ? 1.7 : 1.45);
          if (camp.type === 'golem') drawFrostSentinelModel(ctx, time);
          else if (camp.type === 'wolves') drawShadowWolfModel(ctx, time);
          else if (camp.type === 'behemoth') drawMurkBehemothModel(ctx, time);
          else if (camp.type === 'siege_golem') drawGravemarchModel(ctx, time);
          else if (camp.type === 'blue_buff') drawFrostSentinelModel(ctx, time);
          else drawCrimsonDrakeModel(ctx, time);
          ctx.restore();

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🌫️ UNEXPLORED', 0, -26);
        } else {
          // Fully scouted and unlocked!
          const target = championsRef.current.find(champion => champion.id === camp.targetId && champion.isAlive);
          const motion = campAnimation({
            x: camp.x, y: camp.y, homeX: camp.homeX ?? camp.x, homeY: camp.homeY ?? camp.y,
            targetX: target?.x, targetDistance: target ? Math.hypot(target.x - camp.x, target.y - camp.y) : undefined,
            attackTimer: camp.attackTimer, hurtTimer: camp.hurtTimer ?? 0
          }, matchTimeRef.current);
          if (motion.state !== 'idle') {
            ctx.save();
            ctx.globalAlpha = motion.state === 'windup' ? 0.35 + motion.windup * 0.5 : 0.4;
            ctx.strokeStyle = camp.color;
            ctx.lineWidth = motion.state === 'windup' ? 3 : 1.5;
            ctx.beginPath(); ctx.ellipse(0, 12, 27 + motion.windup * 7, 10 + motion.windup * 3, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
          if (motion.moving) {
            ctx.fillStyle = 'rgba(148,163,184,0.3)';
            ctx.beginPath(); ctx.arc(-12 - motion.lunge, 12, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10 - motion.lunge, 13, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.save();
          ctx.translate(motion.lunge, -motion.bob);
          ctx.rotate(motion.lean);
          ctx.scale(creatureFacingScale(camp.facingX ?? 1), 1);
          ctx.scale(camp.type === 'siege_golem' ? 1.7 : 1.45, camp.type === 'siege_golem' ? 1.7 : 1.45);
          if (motion.state === 'windup') ctx.scale(1 + motion.windup * 0.08, 1 - motion.windup * 0.08);
          const attack = creatureAttackPose(camp.attackTimer, 1.35);
          if (camp.type === 'golem') drawFrostSentinelModel(ctx, time, attack);
          else if (camp.type === 'wolves') drawShadowWolfModel(ctx, time, attack);
          else if (camp.type === 'behemoth') drawMurkBehemothModel(ctx, time, attack);
          else if (camp.type === 'siege_golem') drawGravemarchModel(ctx, time, attack);
          else if (camp.type === 'blue_buff') drawFrostSentinelModel(ctx, time, attack);
          else drawCrimsonDrakeModel(ctx, time, attack);
          if (motion.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${motion.flash * 0.22})`;
            ctx.beginPath(); ctx.arc(0, -6, camp.type === 'siege_golem' ? 43 : 28, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
          if (motion.state === 'attack') {
            ctx.save();
            ctx.globalAlpha = 0.65;
            ctx.strokeStyle = camp.color;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, -5, 30, -0.9, 0.9); ctx.stroke();
            ctx.restore();
          }

          // HP Bar
          const hpPct = Math.max(0, camp.hp / camp.maxHp);
          ctx.fillStyle = '#020617';
          ctx.fillRect(-30, camp.type === 'siege_golem' ? -110 : -56, 60, 5);
          ctx.fillStyle = camp.color;
          ctx.fillRect(-30, camp.type === 'siege_golem' ? -110 : -56, 60 * hpPct, 5);

          if (camp.targetId) {
            ctx.fillStyle = '#334155';
            ctx.fillRect(-30, camp.type === 'siege_golem' ? -103 : -49, 60, 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-30, camp.type === 'siege_golem' ? -103 : -49,
              60 * Math.max(0, (camp.patience ?? 0) / CAMP_PATIENCE_SECONDS), 2);
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(camp.name, 0, camp.type === 'siege_golem' ? -115 : -61);
        }
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(camp.type === 'siege_golem' && !golemAwakenedRef.current
          ? `AWAKENS ${Math.max(0, Math.ceil(GOLEM_SPAWN_SECOND - matchTimeRef.current))}s`
          : camp.type === 'siege_golem' ? 'CLAIMED • ONE TIME'
          : `🌲 Respawns ${Math.ceil(camp.respawnTimer)}s`, 0, 4);
      }
      ctx.restore();
    });

    // 7. EMBERMAW DRAGON BOSS PROCEDURAL MODEL
    const dragon = dragonRef.current;
    ctx.save();
    ctx.translate(dragon.x, dragon.y);

    if (dragon.isAlive) {
      drawEmbermawDragonModel(ctx, time);

      // Boss Overhead HP Bar
      const bW = 66;
      ctx.fillStyle = '#020617';
      ctx.fillRect(-bW / 2, -78, bW, 6);
      const hpPct = Math.max(0, dragon.hp / dragon.maxHp);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(-bW / 2 + 1, -77, (bW - 2) * hpPct, 4);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🐉 ${dragon.name}`, 0, -84);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 ${dragon.slainCount === 0 ? 'Awakens' : 'Respawns'} in ${Math.ceil(dragon.spawnTimer)}s`, 0, 0);
    }
    ctx.restore();

    // 8. Wide home platforms with visible shop stalls and a protected fountain.
    (['blue', 'red'] as const).forEach((team) => {
      const left = team === 'blue' ? 8 : ARENA_WIDTH - 178;
      const color = team === 'blue' ? '#38bdf8' : '#fb7185';
      ctx.save();
      ctx.fillStyle = '#101b2c'; ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(left, LANE_Y - 108, 170, 216, 24); ctx.fill(); ctx.stroke();
      for (const offset of [-82, 82]) {
        ctx.fillStyle = '#334155'; ctx.fillRect(left + 20, LANE_Y + offset - 10, 130, 20);
        ctx.fillStyle = color;
        ctx.fillRect(left + 25, LANE_Y + offset - 3, 120, 3);
      }
      const shopX = team === 'blue' ? left + 127 : left + 43;
      ctx.fillStyle = '#78350f'; ctx.fillRect(shopX - 18, LANE_Y - 67, 36, 28);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(shopX - 22, LANE_Y - 72, 44, 9);
      ctx.fillStyle = '#fef3c7'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SHOP', shopX, LANE_Y - 82);
      ctx.restore();
    });

    // HEALING WELLS AT THE MAP ENDS
    // BLUE HEALING WELL (Left)
    ctx.save();
    ctx.translate(WELL_X.blue, LANE_Y);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.stroke();

    const blueWater = ctx.createRadialGradient(0, 0, 5, 0, 0, 52);
    blueWater.addColorStop(0, '#e0f2fe');
    blueWater.addColorStop(0.4, '#38bdf8');
    blueWater.addColorStop(0.8, '#0284c7');
    blueWater.addColorStop(1, '#075985');
    ctx.fillStyle = blueWater;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // Spire Crystal
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(9, 0); ctx.lineTo(0, 16); ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // RED HEALING WELL (Right)
    ctx.save();
    ctx.translate(WELL_X.red, LANE_Y);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 4;
    ctx.stroke();

    const redWater = ctx.createRadialGradient(0, 0, 5, 0, 0, 52);
    redWater.addColorStop(0, '#ffe4e6');
    redWater.addColorStop(0.4, '#f43f5e');
    redWater.addColorStop(0.8, '#be123c');
    redWater.addColorStop(1, '#881337');
    ctx.fillStyle = redWater;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(9, 0); ctx.lineTo(0, 16); ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 9. TACTICAL AMBUSH BRUSHES (7 PROCEDURAL STRATEGIC BUSHES)
    ARAM_BUSHES.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      const rx = b.width / 2;
      const ry = b.height / 2;
      const isOccupied = championsRef.current.some((c) => c.isAlive && c.currentBushId === b.id);

      // Dark forest soil bed shadow
      const soilGrad = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx + 6);
      soilGrad.addColorStop(0, 'rgba(4, 28, 18, 0.75)');
      soilGrad.addColorStop(0.7, 'rgba(6, 45, 30, 0.5)');
      soilGrad.addColorStop(1, 'rgba(6, 45, 30, 0)');
      ctx.fillStyle = soilGrad;
      ctx.beginPath();
      ctx.ellipse(0, 4, rx + 8, ry + 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep emerald moss base
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dense swaying grass blades
      const bladeCount = Math.round(b.width / 4.8);
      for (let i = 0; i < bladeCount; i++) {
        const frac = (i / (bladeCount - 1)) * 2 - 1; // -1 .. 1
        const bladeX = frac * (rx - 5);
        const maxBladeY = ry * Math.sqrt(Math.max(0, 1 - frac * frac));
        const bladeY = Math.sin(i * 1.9 + b.x) * 0.45 * maxBladeY;

        const sway = Math.sin(time * 3.2 + i * 0.75 + b.x * 0.01) * (isOccupied ? 6 : 3.5);
        const bladeH = ry * 0.95 + Math.sin(i * 2.3) * 6;

        const bladeGrad = ctx.createLinearGradient(bladeX, bladeY, bladeX + sway, bladeY - bladeH);
        bladeGrad.addColorStop(0, '#047857');
        bladeGrad.addColorStop(0.5, '#10b981');
        bladeGrad.addColorStop(1, '#86efac');

        ctx.strokeStyle = bladeGrad;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bladeX, bladeY + 2);
        ctx.quadraticCurveTo(bladeX + sway * 0.5, bladeY - bladeH * 0.5, bladeX + sway, bladeY - bladeH);
        ctx.stroke();

        // Tip highlight
        ctx.fillStyle = '#bbf7d0';
        ctx.beginPath();
        ctx.arc(bladeX + sway, bladeY - bladeH, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // If occupied by an athlete, rustling leaf particles & active shimmer!
      if (isOccupied) {
        ctx.strokeStyle = 'rgba(167, 243, 208, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx + 4, ry + 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        for (let p = 0; p < 4; p++) {
          const pCycle = (time * 1.7 + p * 0.6) % 2;
          const px = Math.sin(time * 2.2 + p * 1.5) * (rx * 0.65);
          const py = -ry * 0.4 - pCycle * 14;
          const pAlpha = 1 - pCycle / 2;
          ctx.fillStyle = `rgba(134, 239, 172, ${pAlpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌿 OCCUPIED', 0, -ry - 7);
      } else {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, 0, -ry - 5);
      }

      ctx.restore();
    });

    // 10. Health Relics
    relicsRef.current.forEach((r) => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = r.respawnTimer <= 0 ? '#10b981' : '#64748b';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (r.respawnTimer <= 0) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(r.x, r.y + Math.sin(time * 4) * 2.5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 11. STRUCTURES (Towers & Nexus)
    structuresRef.current.forEach((st) => {
      if (!st.isAlive) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(st.x - 18, st.y - 14, 36, 28);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(st.x - 18, st.y - 14, 36, 28);
        return;
      }

      if (st.type === 'nexus') {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.scale(1.85, 1.85);
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = st.team === 'blue' ? '#0284c7' : '#e11d48';
        ctx.lineWidth = 3;
        ctx.stroke();

        for (let o = 0; o < 6; o++) {
          const orbitAngle = time * 2.5 + (o / 6) * Math.PI * 2;
          const ox = Math.cos(orbitAngle) * 36;
          const oy = Math.sin(orbitAngle) * 16;
          ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
          ctx.fillRect(ox - 3, oy - 4, 6, 8);
        }

        const nGrad = ctx.createLinearGradient(0, -26, 0, 26);
        nGrad.addColorStop(0, '#ffffff');
        nGrad.addColorStop(0.5, st.team === 'blue' ? '#38bdf8' : '#f43f5e');
        nGrad.addColorStop(1, st.team === 'blue' ? '#0369a1' : '#9f1239');
        ctx.fillStyle = nGrad;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 28);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
        if (!canDamageNexus(st.team, structuresRef.current)) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.arc(0, 0, 40, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      } else if (st.type === 'barracks') {
        ctx.save();
        ctx.translate(st.x, st.y);
        const glow = st.team === 'blue' ? '#38bdf8' : '#fb7185';
        ctx.fillStyle = '#020617';
        ctx.fillRect(-27, 14, 54, 10);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-23, -19, 46, 36);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-19, -15, 38, 30);
        ctx.strokeStyle = glow; ctx.lineWidth = 2;
        ctx.strokeRect(-23, -19, 46, 36);
        if (st.barracksKind === 'melee') {
          // Forge and crossed blades.
          ctx.fillStyle = '#78350f'; ctx.fillRect(-15, 5, 30, 8);
          ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-11, 0, 22, 5);
          ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(-13, -13); ctx.lineTo(11, 9);
          ctx.moveTo(13, -13); ctx.lineTo(-11, 9); ctx.stroke();
          ctx.strokeStyle = glow; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-15, 5); ctx.lineTo(-8, 12);
          ctx.moveTo(15, 5); ctx.lineTo(8, 12); ctx.stroke();
        } else if (st.barracksKind === 'ranged') {
          // Watchtower with a drawn bow and arrow slit.
          ctx.fillStyle = '#475569'; ctx.fillRect(-13, -27, 26, 12);
          ctx.fillStyle = glow; ctx.fillRect(-4, -25, 8, 5);
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-10, -8); ctx.quadraticCurveTo(7, 0, -10, 10); ctx.stroke();
          ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-10, 10);
          ctx.moveTo(-10, 1); ctx.lineTo(13, 1); ctx.stroke();
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath(); ctx.moveTo(13, 1); ctx.lineTo(7, -3); ctx.lineTo(7, 5); ctx.fill();
        } else {
          // Siege yard with two wheels and a loaded throwing arm.
          ctx.fillStyle = '#92400e'; ctx.fillRect(-16, 7, 32, 5);
          ctx.fillStyle = '#78350f';
          ctx.beginPath(); ctx.arc(-12, 13, 6, 0, Math.PI * 2);
          ctx.arc(12, 13, 6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-8, 7); ctx.lineTo(7, -14);
          ctx.lineTo(14, -12); ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath(); ctx.arc(12, -16, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.barracksKind?.toUpperCase() ?? '', 0, -36);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(-18, -10, 36, 20);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-15, -34, 30, 48);

        ctx.strokeStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(0, 10);
        ctx.stroke();

        const crystalY = -42 + Math.sin(time * 3 + st.x) * 3;
        ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
        ctx.shadowColor = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, crystalY - 12);
        ctx.lineTo(10, crystalY);
        ctx.lineTo(0, crystalY + 12);
        ctx.lineTo(-10, crystalY);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        if (st.targetId) {
          const targetUnit = [
            ...championsRef.current,
            ...minionsRef.current
          ].find((u) => u.id === st.targetId);

          if (targetUnit) {
            ctx.strokeStyle = st.team === 'blue' ? '#00f2ff' : '#ff0055';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, crystalY);
            ctx.lineTo(targetUnit.x - st.x, targetUnit.y - st.y - 12);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      const bW = st.type === 'nexus' ? 88 : 44;
      const bH = 5;
      const bX = st.x - bW / 2;
      const bY = st.y - (st.type === 'nexus' ? 78 : st.type === 'barracks' ? 53 : 62);

      ctx.fillStyle = '#020617';
      ctx.fillRect(bX, bY, bW, bH);
      const pct = Math.max(0, st.hp / st.maxHp);
      ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(bX + 0.5, bY + 0.5, (bW - 1) * pct, bH - 1);
      const plating = st.type.includes('tower') ? Math.round((1 - towerSiegeMultiplier(matchTimeRef.current)) * 100) : 0;
      if (plating > 0 || (st.type === 'nexus' && !canDamageNexus(st.team, structuresRef.current))) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.type === 'nexus' ? 'SEALED' : `PLATING ${plating}%`, st.x, bY - 3);
      }
    });

    // Terrain sits over the road but under combat units and their overhead
    // labels. Fog can dim unseen rocks without hiding a visible nameplate.
    ctx.save();
    ctx.scale(width / 1320, 1);
    drawRaisedRockTerrain();
    ctx.restore();

    // 12. MINIONS
    minionsRef.current.forEach((m) => {
      if (m.summonedBearOwnerId) return;
      ctx.save();
      ctx.translate(m.x, m.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 3, m.siegeGolem ? 44 : 12, m.siegeGolem ? 12 : 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (m.empowered) {
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 13;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -4, 16, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      const teamColor = m.team === 'blue' ? '#2563eb' : '#dc2626';

      ctx.save();
      if (!m.siegeGolem) ctx.scale(1.28, 1.28);
      if (m.siegeGolem) {
        ctx.save();
        const chargeWindup = m.siegeChargeWindup ?? 0;
        const impactTimer = m.siegeChargeImpactTimer ?? 0;
        const attack = chargeWindup > 0
          ? { windup: Math.min(1, (0.95 - chargeWindup) / 0.75), strike: 0 }
          : impactTimer > 0
            ? { windup: 0, strike: Math.sin((0.5 - impactTimer) / 0.5 * Math.PI) }
            : creatureAttackPose(m.attackTimer, 1.2);
        ctx.scale(1.7, 1.7);
        ctx.scale(creatureFacingScale(m.facingX ?? (m.team === 'blue' ? 1 : -1)), 1);
        drawGravemarchModel(ctx, time, attack);
        ctx.restore();
      } else if (m.type === 'cannon') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-10, -10, 20, 8);
        ctx.fillStyle = '#78716c';
        ctx.fillRect(m.team === 'blue' ? 2 : -16, -14, 15, 6);
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(-6, -2, 5, 0, Math.PI * 2);
        ctx.arc(6, -2, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.type === 'caster') {
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(0, -14);
        ctx.lineTo(6, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(0, -10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.team === 'blue' ? 4 : -4, -4);
        ctx.lineTo(m.team === 'blue' ? 8 : -8, -14);
        ctx.stroke();
        ctx.fillStyle = m.team === 'blue' ? '#67e8f9' : '#f472b6';
        ctx.beginPath();
        ctx.arc(m.team === 'blue' ? 8 : -8, -14, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = teamColor;
        ctx.fillRect(-5, -11, 10, 10);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-4, -15, 8, 5);
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sx = m.team === 'blue' ? 4 : -8;
        ctx.rect(sx, -10, 5, 9);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
      const mW = m.siegeGolem ? 60 : 22;
      ctx.fillStyle = '#020617';
      ctx.fillRect(-mW / 2, m.siegeGolem ? -110 : -25, mW, 3);
      ctx.fillStyle = m.empowered ? '#fbbf24' : m.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(-mW / 2 + 0.5, m.siegeGolem ? -109.5 : -24.5,
        (mW - 1) * (m.hp / m.maxHp), m.siegeGolem ? 2 : 1.5);
      if (m.siegeGolem) {
        ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#020617';
        ctx.strokeText('GRAVEMARCH', 0, -115);
        ctx.fillStyle = '#fef08a'; ctx.fillText('GRAVEMARCH', 0, -115);
      }
      ctx.restore();
    });

    // 13. PROJECTILES
    const drawHookChain = (sourceX: number, sourceY: number, endX: number, endY: number, color: string) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.lineTo(endX, endY); ctx.stroke();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.lineDashOffset = -time * 55;
      ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.lineTo(endX, endY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };
    projectilesRef.current.forEach((p) => {
      if (p.type === 'hook') {
        const source = championsRef.current.find(c => c.id === p.attackerId && c.isAlive);
        if (source) drawHookChain(source.x, source.y - 15, p.x, p.y, p.color);
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.skillshot) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(4, p.size * 0.55);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (p.type === 'hook') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-13, 0); ctx.lineTo(4, 0);
        ctx.moveTo(4, 0); ctx.lineTo(14, -9);
        ctx.moveTo(4, 0); ctx.lineTo(14, 9);
        ctx.stroke();
      } else if (p.type === 'ult_arrow') {
        // Astra: Enchanted Crystal Comet (Global Ice Hawk)
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur = 24;
        const tailGrad = ctx.createLinearGradient(-50, 0, 0, 0);
        tailGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        tailGrad.addColorStop(1, '#38bdf8');
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(-55, 0); ctx.lineTo(0, 9); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(22, 0); ctx.lineTo(0, -9); ctx.lineTo(4, 0); ctx.lineTo(0, 9); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (p.type === 'tornado') {
        // Yasuo / Kazemaru: Spinning Wind Tornado
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        const spin = time * 20;
        ctx.rotate(spin);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, Math.PI * 0.5, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shuriken') {
        // Zed / Kage: Razor Shuriken
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        const spin = time * 28;
        ctx.rotate(spin);
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * 4, Math.sin(a + Math.PI / 4) * 4);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'feather') {
        // Xayah / Cora: Magenta Quill Feather
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-10, -5); ctx.lineTo(-14, 0); ctx.lineTo(-10, 5); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fbcfe8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
      } else if (p.type === 'spirit_arrow') {
        // Kindred / Kindra: Spectral Arrow
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = '#e9d5ff';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'nature_bolt') {
        // Furion / Tequoia: Wrath of Nature Solar Bolt
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'boulder') {
        // Earth Spirit / Kaolin: Rolling Jade Boulder
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        const spin = time * 8;
        ctx.rotate(spin);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(-6, -6, 4, 4);
        ctx.fillRect(2, 2, 5, 5);
      } else if (p.type === 'poison_dart') {
        // Dazzle / Zal: Shadow Dart
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#d946ef';
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-8, -3.5); ctx.lineTo(-8, 3.5); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'electric_spark') {
        // Storm Spirit / Raijin: Electric Spark
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'seed_shot') {
        // Lone Druid / Sylla: Seed Shot
        ctx.shadowColor = '#15803d';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'laser') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(18, 0); ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 12;
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(20, 0); ctx.stroke();
      } else if (p.type === 'pellet') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -7); ctx.lineTo(-5, 0); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill();
      } else if (p.type === 'arrow') {
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'orb') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        const orbGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.5, p.color);
        orbGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'boss_breath') {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(-3, -11, -18, -7);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-18, 7);
        ctx.quadraticCurveTo(-3, 11, 12, 0);
        ctx.fill();
      } else if (p.type === 'jungle_shot') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-7, -6); ctx.lineTo(-4, 0); ctx.lineTo(-7, 6);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'minion_shot' ? 4 : 8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    championsRef.current.forEach(target => {
      if (!target.isAlive || !target.hookPull) return;
      const source = championsRef.current.find(c => c.id === target.hookPull?.sourceId && c.isAlive);
      if (!source) return;
      const color = target.hookPull.kind === 'Voltgrip' ? '#38bdf8'
        : target.hookPull.kind === 'Wraithhook' ? '#7dd3fc' : '#f97316';
      drawHookChain(source.x, source.y - 15, target.x, target.y - 15, color);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y - 15, 19 + Math.sin(time * 24) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 14. REMARKABLE SPELL AOES (UNMISTAKABLE ABILITY ANIMATIONS)
    spellsRef.current.forEach((s) => {
      const alpha = s.duration / s.maxDuration;
      ctx.save();

      if (s.type === 'skill_burst' || s.type === 'ultimate_burst') {
        const ultimate = s.type === 'ultimate_burst';
        const progress = 1 - alpha;
        ctx.globalAlpha = alpha;

        if (s.avatarName && s.abilitySlot && s.sourceX !== undefined && s.sourceY !== undefined) {
          // Dedicated procedural visual animation for this specific avatar ability!
          drawAvatarSkillAnimation(ctx, {
            avatarName: s.avatarName,
            slot: s.abilitySlot,
            x: s.x,
            y: s.y,
            sourceX: s.sourceX,
            sourceY: s.sourceY,
            radius: s.radius,
            progress,
            color: s.color,
          });
        } else {
          // Fallback only for neutral/generic impacts
          const radius = s.radius * (0.45 + progress * 0.8);
          ctx.shadowColor = s.color;
          ctx.shadowBlur = ultimate ? 28 : 16;
          ctx.fillStyle = s.color;
          ctx.globalAlpha = alpha * 0.25;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = ultimate ? 3.5 : 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (s.extraText) {
          const label = s.extraText.toUpperCase();
          ctx.globalAlpha = Math.min(1, alpha * 2.2);
          ctx.font = `900 ${ultimate ? 16 : 11}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = ultimate ? 5 : 3.5;
          ctx.strokeStyle = '#020617';
          ctx.shadowBlur = 0;
          ctx.strokeText(label, s.x, s.y - s.radius - (ultimate ? 24 : 14));
          ctx.fillStyle = ultimate ? '#fef08a' : '#ffffff';
          ctx.fillText(label, s.x, s.y - s.radius - (ultimate ? 24 : 14));
        }
      } else if (s.type === 'kaelen_invoke') {
        const progress = 1 - alpha;
        const pulse = s.radius * (0.45 + progress * 0.7);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 22;
        ctx.fillStyle = 'rgba(14, 116, 144, 0.2)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = progress < 0.5 ? '#bae6fd' : '#fb923c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, pulse, progress * Math.PI * 2, (progress + 0.72) * Math.PI * 2);
        ctx.stroke();
        if (s.extraText) {
          ctx.globalAlpha = alpha;
          ctx.font = '900 12px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#020617';
          ctx.strokeText(s.extraText.toUpperCase(), s.x, s.y - s.radius - 12);
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(s.extraText.toUpperCase(), s.x, s.y - s.radius - 12);
        }
      } else if (s.type === 'solar_flare') {
        // Leona / Solana: Blinding Daybreak Flare Solar Beam
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 28;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Solar Beam Core
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Radiating Sunburst Rays
        for (let r = 0; r < 8; r++) {
          const rayAngle = (r / 8) * Math.PI * 2 + time * 2;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(rayAngle) * (s.radius * 0.4), s.y + Math.sin(rayAngle) * (s.radius * 0.4));
          ctx.lineTo(s.x + Math.cos(rayAngle) * s.radius, s.y + Math.sin(rayAngle) * s.radius);
          ctx.stroke();
        }
      } else if (s.type === 'wind_wall') {
        // Yasuo / Kazemaru: Shimmering Cyan Wind Wall Barrier
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 22;
        ctx.globalAlpha = Math.min(1, alpha * 1.5);
        // Vertical Shimmering Air Curtain (90px wide, 14px thick)
        const wallGrad = ctx.createLinearGradient(s.x, s.y - 45, s.x, s.y + 45);
        wallGrad.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
        wallGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.95)');
        wallGrad.addColorStop(1, 'rgba(56, 189, 248, 0.1)');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(s.x - 7, s.y - 45, 14, 90);
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(s.x - 7, s.y - 45, 14, 90);
        // Wind Mist Ripples
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (let w = -35; w <= 35; w += 20) {
          const wave = Math.sin(time * 14 + w) * 5;
          ctx.beginPath();
          ctx.moveTo(s.x - 6, s.y + w);
          ctx.quadraticCurveTo(s.x + wave, s.y + w, s.x + 6, s.y + w);
          ctx.stroke();
        }
      } else if (s.type === 'death_mark') {
        // Zed / Kage: Pulsing Crimson Death Mark
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 24;
        ctx.globalAlpha = Math.min(1, alpha * 1.4);
        // Blood Red Circle on Ground
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (1 - alpha * 0.2), 0, Math.PI * 2);
        ctx.stroke();
        // Crimson Crossed "X" of Death
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 16, s.y - 16); ctx.lineTo(s.x + 16, s.y + 16);
        ctx.moveTo(s.x + 16, s.y - 16); ctx.lineTo(s.x - 16, s.y + 16);
        ctx.stroke();
        // Countdown Pulse Text
        ctx.fillStyle = '#fee2e2';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🩸 MARK', s.x, s.y - 25);
      } else if (s.type === 'shallow_grave') {
        // Dazzle / Zal: Signature Pink Immortality Cross
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 26;
        ctx.globalAlpha = Math.min(1, alpha * 1.5);
        // Luminous Bright Pink Cross over Ally
        ctx.fillStyle = '#f472b6';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        // Vertical beam
        ctx.beginPath();
        ctx.roundRect(s.x - 6, s.y - 48, 12, 36, 3);
        ctx.fill();
        ctx.stroke();
        // Horizontal bar
        ctx.beginPath();
        ctx.roundRect(s.x - 18, s.y - 39, 36, 11, 3);
        ctx.fill();
        ctx.stroke();
        // Protective Pink Life Halo
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 30, 24, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'lambs_respite') {
        // Kindred / Kindra: 130px Golden Sanctuary of Immortality
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 28;
        ctx.globalAlpha = Math.min(1, alpha * 1.3);
        // Golden Protective Sanctuary Circle
        ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Celestial Rune Ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        // Center Lamb Ankh
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✨ RESPITE', s.x, s.y + 4);
      } else if (s.type === 'sprout_ring') {
        // Furion / Tequoia: Ring of 8 Living Oak Trees
        ctx.globalAlpha = Math.min(1, alpha * 1.4);
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 14;
        for (let t = 0; t < 8; t++) {
          const treeAngle = (t / 8) * Math.PI * 2;
          const tx = s.x + Math.cos(treeAngle) * s.radius;
          const ty = s.y + Math.sin(treeAngle) * (s.radius * 0.65);
          // Tree Trunk
          ctx.fillStyle = '#713f12';
          ctx.fillRect(tx - 3, ty - 6, 6, 12);
          // Foliage Leaves
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(tx, ty - 8, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(tx - 2, ty - 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.type === 'sleight_circle') {
        // Ember Spirit / Xin: Sleight of Fist Blazing Rune Circle
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Flame Slash Streaks
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        for (let sl = 0; sl < 4; sl++) {
          const a1 = (sl / 4) * Math.PI * 2 + time * 12;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a1) * s.radius, s.y + Math.sin(a1) * s.radius);
          ctx.lineTo(s.x - Math.cos(a1) * s.radius, s.y - Math.sin(a1) * s.radius);
          ctx.stroke();
        }
      } else if (s.type === 'ball_lightning') {
        // Storm Spirit / Raijin: Supersonic Ball Lightning
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 30;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'grand_entrance') {
        // Rakan / Renn: Grand Entrance Golden Knockup Ring
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (2 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'static_remnant') {
        // Storm Spirit / Raijin: Static Remnant
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 20;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (s.type === 'magnetize_pulse') {
        // Earth Spirit / Kaolin: Magnetize Resonance Rings
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (1 + (1 - alpha)), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'boss_warning') {
        const pulse = 0.5 + 0.5 * Math.sin(time * 19);
        ctx.globalAlpha = 0.5 + pulse * 0.35;
        ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4 + pulse * 2;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff7ed';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('INFERNO SLAM', s.x, s.y - s.radius - 12);
      } else if (s.type === 'boss_slam') {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (1 - alpha * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(234, 88, 12, 0.25)';
        ctx.fill();
      } else if (s.type === 'electric_vortex') {
        // Raijin / Storm Spirit: Electric Vortex continuous lightning tether pulling victim!
        const sx = s.sourceX ?? s.x;
        const sy = (s.sourceY ?? s.y) - 12;
        const tx = s.x;
        const ty = s.y - 12;
        const dist = Math.hypot(tx - sx, ty - sy);
        const steps = Math.max(8, Math.floor(dist / 14));

        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 26;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        for (let i = 1; i < steps; i++) {
          const frac = i / steps;
          const jitter = Math.sin(time * 35 + i * 2.8) * 12 * (1 - Math.abs(frac - 0.5) * 1.5);
          const nx = -(ty - sy) / (dist || 1);
          const ny = (tx - sx) / (dist || 1);
          ctx.lineTo(sx + (tx - sx) * frac + nx * jitter, sy + (ty - sy) * frac + ny * jitter);
        }
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vortex suction coil around victim collapsing inwards
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        for (let ring = 0; ring < 3; ring++) {
          const rSize = ((time * 40 + ring * 14) % 38);
          ctx.beginPath();
          ctx.arc(tx, ty + 12, rSize, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Crackling lightning sparks orbiting victim
        for (let sp = 0; sp < 6; sp++) {
          const spAngle = sp * (Math.PI / 3) + time * 12;
          const spRad = 18 + Math.sin(time * 20 + sp) * 6;
          ctx.fillStyle = sp % 2 === 0 ? '#ffffff' : '#06b6d4';
          ctx.beginPath();
          ctx.arc(tx + Math.cos(spAngle) * spRad, ty + 12 + Math.sin(spAngle) * spRad * 0.65, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ VORTEX PULL', tx, ty - 24);
      } else if (s.type === 'ribbon_lash') {
        // Croakwell: Ribbon Lash frog tongue reeling in victim!
        const sx = s.sourceX ?? s.x;
        const sy = (s.sourceY ?? s.y) - 8;
        const tx = s.x;
        const ty = s.y - 8;
        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2 + Math.sin(time * 16) * 10;

        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(midX, midY, tx, ty);
        ctx.stroke();

        ctx.strokeStyle = '#84cc16';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(tx, ty, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#bef264';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👅 REELED', tx, ty - 18);
      } else if (s.type === 'aether_remnant') {
        // Inai: Floating Aether Remnant void eye pulling victim!
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#6b21a8';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 10, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d8b4fe';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 10, 6 + Math.sin(time * 10) * 2, 0, Math.PI * 2);
        ctx.fill();

        if (s.sourceX !== undefined && s.sourceY !== undefined) {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - 10);
          ctx.lineTo(s.sourceX, s.sourceY - 10);
          ctx.stroke();
        }
      } else if (s.type === 'faultline') {
        // Stonewake: Seismic Faultline Fissure & Rock Spires
        const sx = s.sourceX ?? (s.x - 60);
        const sy = s.sourceY ?? s.y;
        ctx.shadowColor = '#d97706';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const segs = 7;
        for (let i = 1; i <= segs; i++) {
          const f = i / segs;
          const px = sx + (s.x - sx) * f;
          const py = sy + (s.y - sy) * f + (i % 2 === 0 ? 8 : -8);
          ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.fillStyle = '#b45309';
        for (let i = 0; i <= segs; i++) {
          const f = i / segs;
          const px = sx + (s.x - sx) * f;
          const py = sy + (s.y - sy) * f;
          ctx.beginPath();
          ctx.moveTo(px - 5, py);
          ctx.lineTo(px, py - 18 - (i % 3) * 6);
          ctx.lineTo(px + 5, py);
          ctx.closePath();
          ctx.fill();
        }
      } else if (s.type === 'runic_maul') {
        // Stonewake: Golden Seismic Hammer Crater
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 3;
        ctx.stroke();
        for (let c = 0; c < 6; c++) {
          const ca = c * (Math.PI / 3);
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + Math.cos(ca) * s.radius, s.y + Math.sin(ca) * (s.radius * 0.7));
          ctx.stroke();
        }
      } else if (s.type === 'dirge_wave') {
        // Soulscourge: Expanding Banshee Soul Shockwave
        ctx.shadowColor = '#9d174d';
        ctx.shadowBlur = 28;
        const curR = s.radius * (1 - alpha * 0.3);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, curR, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + time * 3;
          const gx = s.x + Math.cos(a) * (curR * 0.85);
          const gy = s.y + Math.sin(a) * (curR * 0.6);
          ctx.fillStyle = '#fda4af';
          ctx.beginPath();
          ctx.arc(gx, gy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx - Math.cos(a + 0.3) * 10, gy - Math.sin(a + 0.3) * 8);
          ctx.stroke();
        }
      } else if (s.type === 'quake_chorus') {
        // Stonewake: Quake Chorus Seismic Shockwaves
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 30;
        for (let ring = 0; ring < 3; ring++) {
          const rFrac = ((time * 1.5 + ring * 0.33) % 1);
          const rDist = s.radius * rFrac;
          ctx.strokeStyle = ring % 2 === 0 ? '#facc15' : '#854d0e';
          ctx.lineWidth = 4 * (1 - rFrac);
          ctx.beginPath();
          ctx.arc(s.x, s.y, rDist, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (s.type === 'marsh_anthem') {
        // Croakwell: Radiant Emerald Musical Stave & Floating Notes
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        const notes = ['♪', '♫', '♬', '♩'];
        ctx.font = 'bold 16px serif';
        ctx.fillStyle = '#6ee7b7';
        ctx.textAlign = 'center';
        for (let n = 0; n < 6; n++) {
          const na = (n / 6) * Math.PI * 2 + time * 1.2;
          const nr = s.radius * 0.65;
          const nx = s.x + Math.cos(na) * nr;
          const ny = s.y + Math.sin(na) * (nr * 0.7) - ((time * 25 + n * 10) % 25);
          ctx.fillText(notes[n % notes.length], nx, ny);
        }
      } else if (s.type === 'daybreak_veil') {
        // Solenne: Solar Mandala Aegis Shield
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 28;
        ctx.fillStyle = 'rgba(253, 224, 71, 0.2)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let p = 0; p < 8; p++) {
          const pa = (p / 8) * Math.PI * 2 + time;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(pa) * (s.radius * 0.4), s.y + Math.sin(pa) * (s.radius * 0.4));
          ctx.lineTo(s.x + Math.cos(pa) * (s.radius * 0.9), s.y + Math.sin(pa) * (s.radius * 0.9));
          ctx.stroke();
        }
      } else if (s.type === 'cinder_verdict') {
        // Cinderlock: 4 Hellfire Pillars & Swirling Ash
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 26;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let fp = 0; fp < 4; fp++) {
          const fpa = (fp / 4) * Math.PI * 2 + Math.PI / 4;
          const fpx = s.x + Math.cos(fpa) * (s.radius * 0.75);
          const fpy = s.y + Math.sin(fpa) * (s.radius * 0.5);
          const flameH = 24 + Math.sin(time * 15 + fp) * 8;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(fpx - 6, fpy);
          ctx.quadraticCurveTo(fpx - 3, fpy - flameH, fpx, fpy - flameH - 6);
          ctx.quadraticCurveTo(fpx + 3, fpy - flameH, fpx + 6, fpy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(fpx, fpy - 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.type === 'bogbeat') {
        // Croakwell: Mossy Swamp Ripples with Bubbles
        ctx.shadowColor = '#84cc16';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#65a30d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let b = 0; b < 5; b++) {
          const ba = (b / 5) * Math.PI * 2 + time * 2;
          const bx = s.x + Math.cos(ba) * (s.radius * 0.6);
          const by = s.y + Math.sin(ba) * (s.radius * 0.4);
          ctx.fillStyle = 'rgba(132, 204, 22, 0.6)';
          ctx.beginPath();
          ctx.arc(bx, by, 5 + Math.sin(time * 8 + b) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.type === 'soul_draw') {
        // Soulscourge: Dark Crimson Soul Siphon Tendrils
        ctx.shadowColor = '#b91c1c';
        ctx.shadowBlur = 20;
        for (let t = 0; t < 5; t++) {
          const ta = (t / 5) * Math.PI * 2 + time * 4;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(ta) * s.radius, s.y + Math.sin(ta) * (s.radius * 0.7));
          ctx.quadraticCurveTo(s.x + Math.cos(ta + 0.8) * (s.radius * 0.5), s.y + Math.sin(ta + 0.8) * (s.radius * 0.35), s.x, s.y);
          ctx.stroke();
        }
      } else if (s.type === 'smoke_screen') {
        // Buck: Dense Tactical Smoke Cloud
        ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();
        for (let p = 0; p < 6; p++) {
          const pa = p * 1.1 + time;
          const pr = (p * 8) % (s.radius * 0.7);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(pa) * pr, s.y + Math.sin(pa) * pr * 0.7, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.type === 'shotgun_blast') {
        // Buck: Shotgun Blast Cone & Fiery Bursts
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        for (let b = 0; b < 8; b++) {
          const ba = (b / 8) * Math.PI * 2;
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + Math.cos(ba) * s.radius, s.y + Math.sin(ba) * (s.radius * 0.7));
          ctx.stroke();
        }
      } else if (s.type === 'wolf_frenzy') {
        // Kindra: Wolf's Frenzy spectral hunting ground
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.stroke();
        const wolfAngle = time * 3.5;
        const wx = s.x + Math.cos(wolfAngle) * (s.radius * 0.7);
        const wy = s.y + Math.sin(wolfAngle) * (s.radius * 0.5);
        ctx.fillStyle = '#581c87';
        ctx.beginPath();
        ctx.arc(wx, wy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(wx + 2, wy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.type === 'broadside_channel') {
        const source = championsRef.current.find(c => c.id === s.sourceUnitId);
        if (source?.corsaraBarrage && source.isAlive) {
          const direction = source.corsaraBarrage.facing === 'right' ? 1 : -1;
          ctx.fillStyle = 'rgba(251, 113, 133, 0.16)';
          ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(source.x, source.y);
          ctx.lineTo(source.x + direction * 260, source.y - 165);
          ctx.lineTo(source.x + direction * 260, source.y + 165);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath(); ctx.moveTo(source.x, source.y);
            ctx.lineTo(source.x + direction * (170 + (time * 130) % 90), source.y + i * 54);
            ctx.stroke();
          }
        }
      } else if (s.type === 'cyclone_dance') {
        const source = championsRef.current.find(c => c.id === s.sourceUnitId);
        if (source?.monkeySpin && source.isAlive) {
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 7;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(source.x, source.y, 55 + i * 22, time * 6 + i * 2, time * 6 + i * 2 + Math.PI * 1.4); ctx.stroke();
          }
        }
      } else if (s.type === 'branch_court') {
        const source = championsRef.current.find(c => c.id === s.sourceUnitId);
        if (source?.monkeyCourt && source.isAlive) {
          ctx.strokeStyle = '#86efac'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            const px = s.x + Math.cos(a) * s.radius;
            const py = s.y + Math.sin(a) * s.radius * 0.7;
            ctx.fillStyle = '#854d0e'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(px - 10, py - 13); ctx.lineTo(px + 10, py - 18 + Math.sin(time * 10 + i) * 5); ctx.stroke();
          }
        }
      } else if (s.type === 'mist_double') {
        ctx.fillStyle = 'rgba(192, 132, 252, 0.25)'; ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, s.y - 22, 15, 27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (s.type === 'black_hole') {
        const source = championsRef.current.find(c => c.id === s.sourceUnitId);
        if (source?.blackHole) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(time * 2);
          ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 28;
          ctx.fillStyle = 'rgba(22, 8, 43, 0.82)';
          ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(0, 0, s.radius * 0.58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          for (let i = 0; i < 4; i++) {
            ctx.beginPath(); ctx.arc(0, 0, 24 + i * 27, i, i + Math.PI * 1.2); ctx.stroke();
          }
          ctx.restore();
        }
      } else if (s.type === 'aetheris_orb_explosion') {
        const progress = 1 - s.duration / s.maxDuration;
        const burstRadius = Math.max(8, s.radius * progress);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 5 * (1 - progress) + 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 12, burstRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fill();
        ctx.restore();
      } else if (s.type === 'aetheris_overcharge') {
        const pulse = (Math.sin(time * 8) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = Math.min(0.9, s.duration / s.maxDuration + 0.25);
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 16, 19 + pulse * 5, 30 + pulse * 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const angle = time * 3 + i * Math.PI * 2 / 3;
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(angle) * 26, s.y - 16 + Math.sin(angle) * 34, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (s.type === 'aetheris_ultimate_link') {
        const source = championsRef.current.find(c => c.id === s.sourceUnitId);
        const target = championsRef.current.find(c => c.id === s.targetUnitId);
        if (source?.isAlive && target?.isAlive) {
          const pulse = (Math.sin(time * 6) + 1) / 2;
          ctx.save();
          ctx.globalAlpha = Math.min(0.9, s.duration / s.maxDuration + 0.15);
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 2.5 + pulse;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 14;
          ctx.setLineDash([8, 5]);
          ctx.lineDashOffset = -time * 28;
          ctx.beginPath();
          ctx.moveTo(source.x, source.y - 15);
          ctx.lineTo(target.x, target.y - 15);
          ctx.stroke();
          ctx.restore();
        }
      } else if (s.type === 'forest_link') {
        // Draw shimmering vine links between all connected targets
        const linkedUnits = championsRef.current.filter(c => c.isAlive && c.forestLink?.groupId === s.id);
        if (linkedUnits.length >= 2) {
          ctx.save();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -time * 24;
          ctx.shadowColor = '#4ade80';
          ctx.shadowBlur = 8;
          ctx.globalAlpha = Math.min(0.7, (s.duration / s.maxDuration));
          for (let i = 0; i < linkedUnits.length; i++) {
            for (let j = i + 1; j < linkedUnits.length; j++) {
              ctx.beginPath();
              ctx.moveTo(linkedUnits[i].x, linkedUnits[i].y);
              ctx.lineTo(linkedUnits[j].x, linkedUnits[j].y);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      } else if (s.type === 'treants') {
        // Tequoia: Nature's Call animated wooden Treants
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let tr = 0; tr < 3; tr++) {
          const tra = tr * (Math.PI * 2 / 3) + time * 1.5;
          const tx = s.x + Math.cos(tra) * (s.radius * 0.6);
          const ty = s.y + Math.sin(tra) * (s.radius * 0.5);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(tx - 3, ty - 6, 6, 12);
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(tx, ty - 8, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 15. CHAMPIONS RENDERING WITH OVERHEAD STATS
    const sortedChamps = [...championsRef.current].sort((a, b) => a.y - b.y);

    sortedChamps.forEach((u) => {
      if (!u.isAlive) {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(u.x - 7, u.y - 10, 14, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(u.respawnTimer)}s`, u.x, u.y - 14);
        return;
      }

      // Swirling Cyan Teleport Rings when Recalling (B)
      if (u.isRecalling && u.recallTimer !== undefined) {
        ctx.save();
        const progress = Math.max(0, Math.min(1, 1 - u.recallTimer / 2.5));
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;

        // Ground rune circle
        ctx.beginPath();
        ctx.arc(u.x, u.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();

        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Channeling bar above champion
        const rBarW = 36;
        const rBarX = u.x - rBarW / 2;
        const rBarY = u.y - 58;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rBarX, rBarY, rBarW, 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(rBarX, rBarY, rBarW * progress, 4);
        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(`RECALL ${u.recallTimer.toFixed(1)}s`, u.x, rBarY - 2);
        ctx.restore();
      }

      // Aegis of the Immortal Golden Halo
      if (aegisBuffRef.current?.team === u.team) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(u.x, u.y - 14, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (jungleBuffsRef.current[u.team].blue > matchTimeRef.current || jungleBuffsRef.current[u.team].red > matchTimeRef.current) {
        ctx.save();
        const blueActive = jungleBuffsRef.current[u.team].blue > matchTimeRef.current;
        const redActive = jungleBuffsRef.current[u.team].red > matchTimeRef.current;
        ctx.strokeStyle = blueActive && redActive ? '#c084fc' : blueActive ? '#38bdf8' : '#fb7185';
        ctx.lineWidth = 2; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 20, 7, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      const isKnockedUp = (u.knockupTimer ?? 0) > 0;
      const knockupMax = u.knockupMax || 1.2;
      const knockupProgress = isKnockedUp ? Math.max(0, Math.min(1, 1 - ((u.knockupTimer ?? 0) / knockupMax))) : 0;
      const knockupHeight = isKnockedUp ? Math.sin(knockupProgress * Math.PI) * 34 : 0;

      if (u.dash && u.dash.startX !== undefined && u.dash.startY !== undefined) {
        ctx.save();
        const trailColor = u.dash.kind === 'kaolin_roll' ? '#86efac'
          : u.dash.kind === 'raijin_bolt' ? '#67e8f9'
            : u.dash.kind === 'cinder_lunge' ? '#fb923c' : '#fbbf24';
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = u.dash.kind === 'kaolin_roll' ? 11 : 7;
        ctx.globalAlpha = 0.6; ctx.shadowColor = trailColor; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(u.dash.startX, u.dash.startY - 16);
        ctx.lineTo(u.x, u.y - 16); ctx.stroke(); ctx.restore();
      }

      // Draw Procedural TFT Chibi Sprite
      if (u.dash?.kind === 'kaolin_roll') {
        ctx.save();
        ctx.translate(u.x, u.y - 18); ctx.rotate(time * 11);
        ctx.fillStyle = '#14532d'; ctx.strokeStyle = '#86efac'; ctx.lineWidth = 4;
        ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(i * Math.PI * 0.4) * 20, Math.sin(i * Math.PI * 0.4) * 20); ctx.stroke(); }
        ctx.restore();
      } else drawChampionSprite(ctx, {
        championName: u.champion.name,
        x: u.x,
        y: u.y,
        facing: u.facing,
        animState: u.animState,
        animTime: u.animTimer,
        team: u.team,
        isStunned: u.stunTimer > 0,
        isCharmed: u.charmTimer > 0,
        isFeared: (u.fearTimer ?? 0) > 0,
        isKnockedUp,
        knockupHeight,
        isInBush: u.isInBush
      });

      if (u.champion.name === 'Aetheris' && u.isAlive) {
        const link = findAetherisInnateAlly(u, championsRef.current);
        if (link) {
          const pulse = (Math.sin(time * 7) + 1) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(u.x, u.y - 13);
          ctx.quadraticCurveTo((u.x + link.x) / 2, Math.min(u.y, link.y) - 28 - pulse * 8, link.x, link.y - 13);
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 2.5 + pulse;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 14;
          ctx.setLineDash([7, 5]);
          ctx.lineDashOffset = -time * 22;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(link.x, link.y - 24, 4 + pulse * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        const orbCharges = u.aetherisOrbs?.charges ?? 0;
        for (let i = 0; i < orbCharges; i++) {
          const angle = time * 4.2 + i * Math.PI * 2 / Math.max(orbCharges, 1);
          const orbX = u.x + Math.cos(angle) * 29;
          const orbY = u.y - 20 + Math.sin(angle) * 14;
          ctx.save();
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#bae6fd';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      if (u.paxiOrb) {
        ctx.save(); ctx.fillStyle = '#6ee7b7'; ctx.strokeStyle = '#e0f2fe';
        ctx.shadowColor = '#5eead4'; ctx.shadowBlur = 20; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(u.paxiOrb.x, u.paxiOrb.y - 15, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if ((u.stealthTimer ?? 0) > 0) {
        ctx.save(); ctx.strokeStyle = '#fdba74'; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(u.x, u.y - 18, 24, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }

      // Show the current three-orb FIFO and the two invoked spell slots.
      if (u.champion.name === 'Kaelen' && u.isAlive) {
        const orbColors: Record<KaelenElement, string> = { ice: '#7dd3fc', wind: '#a7f3d0', fire: '#fb923c' };
        const orbs = u.kaelenOrbs ?? [];
        const rot = matchTimeRef.current * 3.5;
        orbs.forEach((element, i) => {
          const ang = rot + (i * Math.PI * 2 / 3);
          const orbX = u.x + Math.cos(ang) * 22;
          const orbY = u.y - 18 + Math.sin(ang) * 9;
          ctx.save();
          ctx.beginPath();
          ctx.arc(orbX, orbY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = orbColors[element];
          ctx.shadowColor = orbColors[element];
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        });
        const invoked = u.kaelenInvokedSlots ?? [];
        ctx.save();
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        invoked.forEach((spellId, index) => {
          const spell = KAELEN_INVOKED_SPELLS.find(candidate => candidate.id === spellId);
          if (!spell) return;
          ctx.fillStyle = index === 0 ? '#bae6fd' : '#fed7aa';
          ctx.fillText(`${index === 0 ? 'D' : 'F'}: ${spell.name}`, u.x, u.y + 29 + index * 9);
        });
        ctx.restore();
      }

      // Overhead MOBA Health & Mana Bar (Enlarged for high clarity)
      const barWidth = 66;
      const barHeight = 9;
      const barX = u.x - barWidth / 2;
      const barY = u.y - 50 - knockupHeight;

      // Level badge (16x16 rounded badge with bold level number)
      const lvlBadgeSize = 16;
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX - lvlBadgeSize - 3, barY - 2, lvlBadgeSize, lvlBadgeSize);
      ctx.strokeStyle = u.level >= 18 ? '#e11d48' : u.level >= 6 ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(barX - lvlBadgeSize - 3, barY - 2, lvlBadgeSize, lvlBadgeSize);
      ctx.fillStyle = u.level >= 18 ? '#fb7185' : u.level >= 6 ? '#fbbf24' : '#e2e8f0';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${u.level}`, barX - lvlBadgeSize / 2 - 3, barY + lvlBadgeSize - 4.5);

      // HP Bar background
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      const hpPct = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = u.team === 'blue' ? '#0ea5e9' : '#e11d48';
      ctx.fillRect(barX + 0.5, barY + 0.5, (barWidth - 1) * hpPct, barHeight - 1);

      // HP pip notches (every 250 HP)
      const pips = Math.floor(u.maxHp / 250);
      if (pips > 0 && pips < 20) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        for (let p = 1; p <= pips; p++) {
          const pipX = barX + (p * 250 / u.maxHp) * barWidth;
          if (pipX < barX + barWidth - 2) {
            ctx.fillRect(pipX - 0.5, barY + 0.5, 1, barHeight - 1);
          }
        }
      }

      // Shield bar
      if (u.shield > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(barX + 0.5, barY + 0.5, Math.min(barWidth - 1, (u.shield / u.maxHp) * barWidth), barHeight - 1);
      }

      // Mana Bar under HP bar
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY + barHeight + 1.5, barWidth, 3);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(barX + 0.5, barY + barHeight + 1.5, (barWidth - 1) * (u.mana / maxMana(u)), 2);

      // Level XP progress bar under mana bar
      const currentLevelBaseXp = getXpThreshold(u.level);
      const nextLevelNeededXp = getXpThreshold(u.level + 1);
      const xpRange = Math.max(1, nextLevelNeededXp - currentLevelBaseXp);
      const currentLevelProgress = Math.max(0, u.xp - currentLevelBaseXp);
      const xpRatio = u.level >= 18 ? 1.0 : Math.min(1.0, currentLevelProgress / xpRange);

      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY + barHeight + 5.5, barWidth, 2);
      ctx.fillStyle = u.level >= 18 ? '#f59e0b' : '#a855f7';
      ctx.fillRect(barX + 0.5, barY + barHeight + 5.5, (barWidth - 1) * xpRatio, 1.5);

      // Champion & Athlete Name Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.player.name, u.x, barY - 4);
      if (u.forestLink && u.forestLink.remaining > 0) {
        ctx.save();
        const iconX = u.x;
        const iconY = barY - 18;
        const progress = Math.max(0, Math.min(1, u.forestLink.remaining / 4));

        // Circular emerald crest backing
        ctx.fillStyle = '#052e16';
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Remaining duration radial timer ring
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 8.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();

        // Unique Nature Link Emblem: interlocking vine rings with leaf bud
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#86efac';
        // Left loop
        ctx.beginPath();
        ctx.ellipse(iconX - 2.8, iconY, 3.4, 2.2, -Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();
        // Right loop
        ctx.beginPath();
        ctx.ellipse(iconX + 2.8, iconY, 3.4, 2.2, Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();
        // Central binding knot highlight
        ctx.fillStyle = '#f0fdf4';
        ctx.beginPath();
        ctx.arc(iconX, iconY, 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Sprouting emerald leaf bud accent
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(iconX + 4.2, iconY - 4.5, 2.2, 1.3, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
      if ((u.silenceTimer ?? 0) > 0) {
        ctx.save(); ctx.fillStyle = '#ddd6fe'; ctx.font = 'bold 8px sans-serif';
        ctx.fillText('SILENCED', u.x, barY - (u.forestLink ? 32 : 19)); ctx.restore();
      }
      ctx.fillStyle = u.team === 'blue' ? '#a5f3fc' : '#fecdd3';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(u.champion.displayName, u.x, u.y + 30);

      // Ultimate Cooldown Status Indicator
      if (u.level >= 6) {
        ctx.font = 'bold 7px sans-serif';
        if (u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)) {
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('ULT [R]', u.x, barY - (u.forestLink ? 30 : 12));
        } else if (u.cdUlt > 0) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`${Math.ceil(u.cdUlt)}s`, u.x, barY - (u.forestLink ? 30 : 12));
        }
      }
    });

    // Summons occupy a separate foreground pass so crowded teamfights cannot hide the bear.
    minionsRef.current.filter(m => m.summonedBearOwnerId && m.isAlive).forEach(m => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.save();
      ctx.scale(1.18 * creatureFacingScale(m.facingX ?? (m.team === 'blue' ? 1 : -1)), 1.18);
      drawSpiritBearSprite(ctx, time, m.team, creatureAttackPose(m.attackTimer, 1.15));
      ctx.restore();
      const hpPct = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = '#020617'; ctx.fillRect(-24, -57, 48, 5);
      ctx.fillStyle = m.team === 'blue' ? '#34d399' : '#fb7185';
      ctx.fillRect(-23, -56, 46 * hpPct, 3);
      ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#020617';
      ctx.strokeText('SPIRIT BEAR', 0, -63);
      ctx.fillStyle = '#ecfdf5'; ctx.fillText('SPIRIT BEAR', 0, -63);
      ctx.restore();
    });

    // 16. DYNAMIC JUNGLE FOG OF WAR (WAVE 1 SHROUD & VISION CARVING)
    if (typeof document !== 'undefined') {
      if (!fogCanvasRef.current) {
        fogCanvasRef.current = document.createElement('canvas');
      }
      const fCanvas = fogCanvasRef.current;
      if (fCanvas) {
        if (fCanvas.width !== width || fCanvas.height !== height) {
          fCanvas.width = width;
          fCanvas.height = height;
        }
        const fCtx = fCanvas.getContext('2d');
        if (fCtx) {
          fCtx.clearRect(0, 0, width, height);

          const isWave1 = matchTimeRef.current < 45.0;
          const fogOpacity = isWave1 ? 0.74 : 0.52;

          fCtx.fillStyle = `rgba(10, 15, 30, ${fogOpacity})`;
          // Upper jungle (river and dragon quadrant)
          fCtx.fillRect(0, 0, width, 280);
          // Lower jungle (river valley quadrant)
          fCtx.fillRect(0, 480, width, height - 480);

          // Animated drifting mist wisps across jungle corridors
          for (let m = 0; m < 12; m++) {
            const mx = ((time * 28 + m * 170) % (width + 200)) - 100;
            const my = m % 2 === 0 ? 80 + (m * 23) % 150 : 515 + (m * 21) % 170;
            const mRadius = 45 + (m % 4) * 15;
            const mistGrad = fCtx.createRadialGradient(mx, my, 0, mx, my, mRadius);
            mistGrad.addColorStop(0, `rgba(30, 41, 59, ${isWave1 ? 0.35 : 0.2})`);
            mistGrad.addColorStop(1, 'rgba(30, 41, 59, 0)');
            fCtx.fillStyle = mistGrad;
            fCtx.beginPath();
            fCtx.arc(mx, my, mRadius, 0, Math.PI * 2);
            fCtx.fill();
          }

          // Cut out vision around ALIVE champions and structures using destination-out
          fCtx.globalCompositeOperation = 'destination-out';

          // Alive champions vision cutouts
          championsRef.current.forEach((champ) => {
            if (!champ.isAlive) return;
            const visRad = champ.isInBush ? 130 : 230;
            const vGrad = fCtx.createRadialGradient(champ.x, champ.y, visRad * 0.45, champ.x, champ.y, visRad);
            vGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            vGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.85)');
            vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            fCtx.fillStyle = vGrad;
            fCtx.beginPath();
            fCtx.arc(champ.x, champ.y, visRad, 0, Math.PI * 2);
            fCtx.fill();
          });

          wardsRef.current.forEach((ward) => {
            fCtx.fillStyle = '#000';
            fCtx.beginPath(); fCtx.arc(ward.x, ward.y, 145, 0, Math.PI * 2); fCtx.fill();
          });

          // Alive towers and structures vision cutouts
          structuresRef.current.forEach((st) => {
            if (!st.isAlive) return;
            const vGrad = fCtx.createRadialGradient(st.x, st.y, 140, st.x, st.y, 270);
            vGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            vGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.85)');
            vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            fCtx.fillStyle = vGrad;
            fCtx.beginPath();
            fCtx.arc(st.x, st.y, 270, 0, Math.PI * 2);
            fCtx.fill();
          });

          // Reset composite mode
          fCtx.globalCompositeOperation = 'source-over';

          // Blit fog canvas onto main battleground canvas
          ctx.drawImage(fCanvas, 0, 0);
          wardsRef.current.forEach((ward) => {
            ctx.save();
            ctx.fillStyle = ward.team === 'blue' ? '#67e8f9' : '#fda4af';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(ward.x, ward.y - 12, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(ward.x - 1, ward.y - 8, 2, 12);
            ctx.restore();
          });

          // Wave 1 Broadcast HUD Banner across upper river
          if (isWave1) {
            ctx.save();
            const bannerX = width / 2;
            const bannerY = 48;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.beginPath();
            ctx.roundRect(bannerX - 220, bannerY - 14, 440, 28, 8);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            const remainingSec = Math.max(0, Math.ceil(45.0 - matchTimeRef.current));
            ctx.fillText(`🌫️ JUNGLE SHROUD: Wave 1 in progress — Camps locked for ${remainingSec}s`, bannerX, bannerY + 4);
            ctx.restore();
          }
        }
      }
    }

    // 17. FLOATING COMBAT TEXT
    floatsRef.current.forEach((f) => {
      ctx.save();
      ctx.fillStyle = f.color;
      ctx.globalAlpha = f.opacity;
      ctx.font = `bold ${Math.round(10 * f.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  };

  // Animation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const steps = batchMode ? (matchFinishedRef.current ? 0 : 120)
        : consumeFixedSteps(accumulatorRef, dt, speed, paused || matchOver);
      if (steps > 0) {
        for (let step = 0; step < steps && !matchFinishedRef.current; step++) {
          matchTimeRef.current += SIMULATION_STEP;
          updateAramSimulation(SIMULATION_STEP);
        }
        if (batchMode) setChampions(championsRef.current.map(champion => ({ ...champion, items: [...champion.items] })));
        setMatchTime(matchTimeRef.current);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawAramBattleground(ctx, canvas.width, canvas.height, now * 0.001);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [paused, matchOver, speed, batchMode]);

  const blueChamps = champions.filter((c) => c.team === 'blue');
  const redChamps = champions.filter((c) => c.team === 'red');
  const { blue: blueKills, red: redKills } = getTeamKillScore(champions);
  const blueGold = getTeamTotalGold(champions, 'blue');
  const redGold = getTeamTotalGold(champions, 'red');
  const blueTowersAlive = getTowersAliveCount(structuresRef.current, 'blue');
  const redTowersAlive = getTowersAliveCount(structuresRef.current, 'red');
  const teamNames = getTeamNames({ blueTeamName, redTeamName, opponentName });

  const blueAvgLevel = (blueChamps.reduce((acc, c) => acc + c.level, 0) / Math.max(1, blueChamps.length)).toFixed(1);
  const redAvgLevel = (redChamps.reduce((acc, c) => acc + c.level, 0) / Math.max(1, redChamps.length)).toFixed(1);
  const barracksKinds = ['melee', 'ranged', 'catapult'] as const;
  const barracksIntact = (team: 'blue' | 'red', kind: typeof barracksKinds[number]) =>
    structuresRef.current.some(st => st.team === team && st.type === 'barracks' && st.barracksKind === kind && st.isAlive);
  const deadChampions = champions.filter(c => !c.isAlive);
  const insightPlayers = Object.values(insightsRef.current.players).sort((a, b) =>
    a.team.localeCompare(b.team) || b.casts.skill2 - a.casts.skill2 || a.player.localeCompare(b.player));
  const insightWindowEnd = insightAt ?? matchTime;
  const insightWindow = insightsRef.current.timeline.filter(event =>
    event.second <= insightWindowEnd && event.second >= Math.max(0, insightWindowEnd - 30)).reverse();

  return (
    <div ref={matchRootRef} className={`relative space-y-4 animate-fade-in max-w-[1600px] mx-auto ${isFullscreen ? 'fixed inset-0 z-[100] max-w-none w-screen h-screen overflow-y-auto bg-slate-950 p-3' : ''}`}>
      {/* ======================================================== */}
      {/* 1. TOP BROADCAST SCOREBOARD */}
      {/* ======================================================== */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-3 shadow-2xl flex justify-between items-center relative overflow-hidden">
        {/* Blue Squad Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-cyan-400">{teamNames.blue}</h2>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-bold border border-cyan-400/40">
                {blueTowersAlive}/3 Towers
              </span>
              <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-400/40">
                Avg Lvl {blueAvgLevel}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Coins className="w-3 h-3 text-amber-400" />
              <strong className="text-amber-300 font-mono">${blueGold.toLocaleString()}</strong>
              <span className="text-slate-500">|</span>
              <span>Coach: {blueCoach?.name || 'None'}</span>
            </div>
            <div className="flex gap-1 mt-1" aria-label="Blue barracks status">
              {barracksKinds.map(kind => <span key={kind} title={`${kind} barracks ${barracksIntact('blue', kind) ? 'intact' : 'destroyed'}`}
                className={`text-[9px] px-1.5 py-0.5 rounded border ${barracksIntact('blue', kind) ? 'text-cyan-300 border-cyan-700' : 'text-amber-300 border-amber-600'}`}>
                {kind === 'catapult' ? 'Cata' : kind === 'ranged' ? 'Range' : 'Melee'} {barracksIntact('blue', kind) ? '◆' : '✕'}
              </span>)}
            </div>
          </div>
        </div>

        {/* Center Live Scoreboard & Gold Advantage */}
        <div className="flex flex-col items-center">
          <div className="flex items-center bg-slate-950 px-6 py-1.5 rounded-xl border border-slate-700 gap-6">
            <span className="text-3xl font-black text-cyan-400 drop-shadow">{blueKills}</span>
            <div className="flex flex-col items-center">
              <Swords className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-[11px] text-amber-300 font-mono font-bold mt-0.5">
                {Math.floor(matchTime / 60)}:{(Math.floor(matchTime % 60)).toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{matchEconomyPhase(matchTime)}</span>
            </div>
            <span className="text-3xl font-black text-rose-400 drop-shadow">{redKills}</span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold">
            {blueGold >= redGold ? (
              <span className="text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                +{Math.round(blueGold - redGold).toLocaleString()}g {teamNames.blue} Lead
              </span>
            ) : (
              <span className="text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                +{Math.round(redGold - blueGold).toLocaleString()}g {teamNames.red} Lead
              </span>
            )}
          </div>
          <button onClick={toggleFullscreen} className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-amber-300" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={isFullscreen} title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-300">
            <span title="Match seed; replaying uses the same draft and random sequence">Seed {seed}</span>
            <button onClick={() => setShowInsights(value => !value)} aria-expanded={showInsights}
              className={`font-bold ${showInsights ? 'text-emerald-300' : 'hover:text-emerald-300'}`}
              title="Open live ability stats and the match event timeline">Insights</button>
            {!batchMode && !onlineMode && <button onClick={onReplay} className="hover:text-cyan-300" title="Restart this draft with the same seed">Replay</button>}
            {!batchMode && !onlineMode && <button onClick={onBatchStart} className="hover:text-amber-300" title="Simulate 25 real arena matches with fresh seeds and save balance reports">Run 25</button>}
            {batchMode && <><span className="text-amber-300">Balance {batchNumber}/25</span><button onClick={onBatchStop} className="text-rose-300 hover:text-rose-100">Stop</button></>}
            {latestReportRef.current && <button onClick={downloadMatchReport} className="hover:text-emerald-300">Export</button>}
            {balanceSummary && !batchMode && <button onClick={downloadBalanceReport} className="hover:text-emerald-300">Export balance</button>}
          </div>
          {balanceSummary && !batchMode && <div className="mt-1 text-[9px] text-slate-400 text-center" title="Aggregated from completed arena matches saved in this browser">
            {balanceSummary.matches} games · {balanceSummary.averageMinutes.toFixed(1)}m avg · {(balanceSummary.blueWinRate * 100).toFixed(0)}% blue wins · {(balanceSummary.higherRatedWinRate * 100).toFixed(0)}% higher rated wins · {(balanceSummary.skillshotHitRate * 100).toFixed(0)}% skillshot hits · {balanceSummary.averageObjectiveTime ? `${balanceSummary.averageObjectiveTime.toFixed(1)}m objective avg` : 'no objectives'}
            <div>Skill 2 {balanceSummary.averageSkill2Casts.toFixed(1)} casts/avatar · Mana waits {balanceSummary.averageManaBlocks.toFixed(1)}/avatar · Black Hole interrupts {balanceSummary.blackHoleInterrupts} · Paxi escapes {balanceSummary.paxiEscapeJaunts}</div>
            <div>{([8, 10, 12, 13] as const).map(minute => balanceSummary.itemTimings[minute].matches
              ? `${minute}m: ${balanceSummary.itemTimings[minute].averageItems.toFixed(1)} avg items / ${balanceSummary.itemTimings[minute].bestFarmerItems.toFixed(1)} best farmer`
              : `${minute}m: no item sample`).join(' · ')}</div>
          </div>}
        </div>

        {/* Red Squad Badge */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-400/40">
                Avg Lvl {redAvgLevel}
              </span>
              <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded font-mono font-bold border border-rose-400/40">
                {redTowersAlive}/3 Towers
              </span>
              <h2 className="text-base font-black text-rose-400">{teamNames.red}</h2>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 justify-end mt-0.5">
              <span>Split Contenders</span>
              <span className="text-slate-500">|</span>
              <Coins className="w-3 h-3 text-amber-400" />
              <strong className="text-amber-300 font-mono">${redGold.toLocaleString()}</strong>
            </div>
            <div className="flex gap-1 mt-1 justify-end" aria-label="Red barracks status">
              {barracksKinds.map(kind => <span key={kind} title={`${kind} barracks ${barracksIntact('red', kind) ? 'intact' : 'destroyed'}`}
                className={`text-[9px] px-1.5 py-0.5 rounded border ${barracksIntact('red', kind) ? 'text-rose-300 border-rose-700' : 'text-amber-300 border-amber-600'}`}>
                {kind === 'catapult' ? 'Cata' : kind === 'ranged' ? 'Range' : 'Melee'} {barracksIntact('red', kind) ? '◆' : '✕'}
              </span>)}
            </div>
          </div>
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
            ⚔️
          </div>
        </div>
      </div>

      {showInsights && <section aria-label="Match insights" className="absolute top-28 right-3 z-[70] w-[min(94vw,680px)] max-h-[70vh] overflow-y-auto rounded-2xl border border-emerald-500/50 bg-slate-950/95 p-3 text-slate-100 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-2">
          <div>
            <h3 className="text-sm font-black text-emerald-300">Match Insights</h3>
            <p className="text-[10px] text-slate-400">Cast totals, projectile hits, mana waits, and decisions from this seeded match.</p>
          </div>
          <button onClick={() => setShowInsights(false)} aria-label="Close match insights" className="rounded p-1 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-[10px]">
            <thead className="text-slate-400"><tr><th className="pb-1">Player / avatar</th><th>Q</th><th>W</th><th>R</th><th>Shots hit/fired</th><th>Mana waits</th><th>Special</th></tr></thead>
            <tbody>{insightPlayers.map(stats => <tr key={stats.id} className="border-t border-slate-800">
              <td className={`py-1 font-bold ${stats.team === 'blue' ? 'text-cyan-300' : 'text-rose-300'}`}>{stats.player} <span className="font-normal text-slate-400">{stats.avatar}</span></td>
              <td>{stats.casts.skill1}</td><td className="font-bold text-emerald-300">{stats.casts.skill2}</td><td>{stats.casts.ultimate}</td>
              <td>{stats.skillshotsHit}/{stats.skillshotsFired}</td><td>{stats.manaBlocks}</td>
              <td>{stats.blackHoleInterrupts ? `${stats.blackHoleInterrupts} interrupts` : stats.escapeJaunts || stats.engageJaunts ? `${stats.escapeJaunts} escapes / ${stats.engageJaunts} engages` : '—'}</td>
            </tr>)}</tbody>
          </table>
          {insightPlayers.length === 0 && <p className="py-2 text-[10px] text-slate-400">No abilities cast yet.</p>}
        </div>
        <div className="mt-3 border-t border-slate-700 pt-2">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <strong className="text-emerald-300">Event timeline · {Math.floor(insightWindowEnd / 60)}:{String(Math.floor(insightWindowEnd % 60)).padStart(2, '0')}</strong>
            <button onClick={() => setInsightAt(null)} className="rounded border border-slate-600 px-2 py-0.5 hover:border-emerald-400">Live</button>
          </div>
          <input aria-label="Inspect match time" type="range" min={0} max={Math.max(1, Math.floor(matchTime))} step={1}
            value={Math.min(Math.floor(insightWindowEnd), Math.max(1, Math.floor(matchTime)))}
            onChange={event => setInsightAt(Number(event.target.value))} className="mt-1 w-full accent-emerald-400" />
          <p className="mb-1 text-[9px] text-slate-500">Showing the 30 seconds ending at the selected match time. Replay restarts the same seed.</p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {insightWindow.slice(0, 35).map((event, index) => <div key={`${event.second}-${event.kind}-${index}`} className="flex gap-2 rounded bg-slate-900/80 px-2 py-1 text-[10px]">
              <span className="shrink-0 font-mono text-amber-300">{Math.floor(event.second / 60)}:{String(Math.floor(event.second % 60)).padStart(2, '0')}</span>
              <span className={event.kind === 'decision' ? 'text-violet-300' : event.kind === 'mana' ? 'text-orange-300' : 'text-slate-200'}>{event.text}</span>
            </div>)}
            {insightWindow.length === 0 && <p className="text-[10px] text-slate-500">No recorded decisions or casts in this window.</p>}
          </div>
        </div>
      </section>}

      {/* ======================================================== */}
      {/* 2. THE EXPANDED ARENA CANVAS WITH DRAGON PIT & JUNGLE */}
      {/* ======================================================== */}
      <div className="relative w-full rounded-3xl overflow-hidden border-4 border-slate-700 shadow-2xl bg-black">
        <div className="relative w-full h-10 bg-gradient-to-r from-slate-950 via-indigo-950/80 to-slate-950 border-b border-amber-500/25 pointer-events-none flex items-center px-4 gap-3 z-20">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shrink-0">Live kill feed</span>
          {deadChampions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono text-amber-300 pointer-events-auto">
              <Skull className="w-3 h-3 text-rose-400 shrink-0" />
              {deadChampions.map(c => (
                <span key={c.id} className="bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300 shrink-0">
                  {c.player.name} <strong className="text-amber-300">{Math.ceil(c.respawnTimer)}s</strong>
                </span>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 overflow-hidden">
            {recentKills.length === 0 ? (
              <span className="text-xs text-slate-400">No champion kills yet</span>
            ) : recentKills.map((kill) => (
              kill.streakText === 'EXECUTED' || !kill.killerAvatar ? (
                <div key={kill.id} className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                  <span className="text-amber-300">⚡ {kill.killerName}</span>
                  <span className="text-slate-400">executed</span>
                  <span className={kill.victimTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'}>{kill.victimName}</span>
                </div>
              ) : (
                <div key={kill.id} className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${kill.killerTeam === 'blue' ? 'border-cyan-500/40 bg-cyan-950/50' : 'border-rose-500/40 bg-rose-950/50'}`}>
                  <span className={kill.killerTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'}>{kill.killerName}</span>
                  <span className="text-amber-300">⚔</span>
                  <span className={kill.victimTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'}>{kill.victimName}</span>
                </div>
              )
            ))}
          </div>
        </div>
        <div className="min-h-[78px] flex flex-wrap items-center justify-center gap-2 bg-slate-950/90 border-b border-slate-700 px-2 py-1">
        {/* TOP KILL CALLOUT BANNER (ESPORTS BROADCAST ANNOUNCEMENT) */}
        {killCallout && (
          <div className="relative z-40 pointer-events-none flex flex-col items-center animate-fade-in max-w-full">
            {/* Main Kill Card */}
            <div className="bg-slate-950/95 border-2 border-amber-400/90 shadow-[0_0_30px_rgba(251,191,36,0.5)] px-2 sm:px-4 py-2 rounded-2xl flex items-center gap-2 sm:gap-4 backdrop-blur-md">
              {/* Killer Info */}
              <div className="flex items-center gap-2.5">
                {killCallout.killerAvatar ? (
                  <ChibiAvatar avatarType={killCallout.killerAvatar} size={36} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-lg shadow">
                    {killCallout.killerName.includes('Dragon') || killCallout.killerName.includes('Embermaw') ? '🐉' : killCallout.killerName.includes('Jungle') ? '🌲' : '🏰'}
                  </div>
                )}
                <div className="text-left">
                  <div className={`font-black text-xs ${killCallout.killerTeam === 'blue' ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {killCallout.killerName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">{killCallout.killerChamp}</div>
                </div>
              </div>

              {/* Action Badge */}
              <div className="flex flex-col items-center px-3 border-x border-slate-700/60">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {killCallout.streakText === 'EXECUTED' ? '⚡ EXECUTED ⚡' : '⚔️ KILLED ⚔️'}
                </div>
                <div className="text-[9px] text-amber-400 font-mono font-bold">
                  {killCallout.streakText === 'EXECUTED' ? '+0g' : '+300g'}
                </div>
                {killCallout.neutralFinisher && <div className="text-[9px] text-orange-300">{killCallout.neutralFinisher} finished</div>}
              </div>

              {/* Victim Info */}
              <div className="flex items-center gap-2.5 opacity-80">
                <div className="text-right">
                  <div className={`font-bold text-xs ${killCallout.victimTeam === 'blue' ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {killCallout.victimName}
                  </div>
                  <div className="text-[10px] text-slate-400">{killCallout.victimChamp}</div>
                </div>
                <ChibiAvatar avatarType={killCallout.victimAvatar || 'faker'} size={36} />
              </div>
            </div>

            {/* Multikill & Streak Callout Sub-Badge */}
            {(killCallout.multiKill || killCallout.isFirstBlood || killCallout.streakText) && (
              <div className="mt-1.5 px-5 py-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-full shadow-lg border border-yellow-200 animate-pulse flex items-center gap-2">
                {killCallout.isFirstBlood && <span>🩸 FIRST BLOOD!</span>}
                {killCallout.multiKill && <span>⚡ {killCallout.multiKill}!</span>}
                {killCallout.streakText && <span className="text-[10px] font-bold">({killCallout.streakText})</span>}
              </div>
            )}
          </div>
        )}

        {/* Top-Right Flash Banner */}
        {activeBanner && (
          <div className="relative bg-slate-900/95 backdrop-blur-md border-2 border-amber-400/70 p-2 rounded-xl shadow-2xl flex items-center gap-2 animate-scale-up max-w-sm z-30">
            <div className="text-2xl">{activeBanner.icon}</div>
            <div>
              <div className="font-black text-amber-300 text-xs tracking-wider uppercase">{activeBanner.text}</div>
              <div className="text-[10px] text-slate-300 font-semibold mt-0.5">{activeBanner.subtext}</div>
            </div>
          </div>
        )}
        </div>
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={760}
          className="w-full h-auto block"
        />

        {/* ======================================================== */}
        {/* IN-GAME SQUAD HUD & ITEM SCOREBOARD OVERLAY */}
        {/* ======================================================== */}
        {hudMode === 'hidden' ? (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
            <button
              onClick={() => setHudMode('docked')}
              className="bg-slate-900/90 hover:bg-slate-800 border-2 border-amber-400/80 text-amber-300 text-xs font-black px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 transition hover:scale-105"
              title="Open In-Game Squad Scoreboard (Tab)"
            >
              <span>🛡️⚔️ Show In-Game Squads & Items</span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">Tab</span>
            </button>
          </div>
        ) : (
          <div className="w-full bg-slate-950/95 border-t-2 border-slate-700/80 p-2.5 shadow-2xl animate-fade-in">
            {/* Header bar: Teams, Gold totals, and HUD controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5 mb-2 text-xs">
              {/* Blue Squad Header */}
              <div className="flex items-center gap-2 font-black uppercase text-cyan-400">
                <span className="text-sm">🛡️</span>
                <span className="truncate max-w-[150px]">{teamNames.blue}</span>
                <span className="font-mono text-amber-300 font-bold bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px]">
                  ${blueGold.toLocaleString()}
                </span>
                {blueGold > redGold && (
                  <span className="text-[9px] text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded hidden sm:inline">
                    +{Math.round(blueGold - redGold).toLocaleString()}g Lead
                  </span>
                )}
              </div>

              {/* Center Controls & View Switcher */}
              <div className="flex items-center gap-2">
                {/* Match playback controls */}
                <div className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setPaused(!paused)}
                    className="p-1 text-slate-300 hover:text-white transition"
                    title={paused ? 'Resume Match' : 'Pause Match'}
                  >
                    {paused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                  {[1, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition ${
                        speed === s ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* HUD Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setHudMode('docked')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      hudMode === 'docked' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Dock Under Canvas"
                  >
                    ⚓ Docked
                  </button>
                  <button
                    onClick={() => setHudMode('hidden')}
                    className="px-1.5 py-0.5 text-slate-400 hover:text-rose-400 transition text-[10px] font-bold"
                    title="Hide HUD (Tab)"
                  >
                    ✕
                  </button>
                </div>

                <span className="text-[9px] text-slate-500 font-mono hidden xl:inline" title="Press Tab key anytime to toggle">
                  (Tab)
                </span>
              </div>

              {/* Red Squad Header */}
              <div className="flex items-center gap-2 font-black uppercase text-rose-400">
                {redGold > blueGold && (
                  <span className="text-[9px] text-rose-300 bg-rose-950/80 border border-rose-500/30 px-1.5 py-0.5 rounded hidden sm:inline">
                    +{Math.round(redGold - blueGold).toLocaleString()}g Lead
                  </span>
                )}
                <span className="font-mono text-amber-300 font-bold bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px]">
                  ${redGold.toLocaleString()}
                </span>
                <span className="truncate max-w-[150px]">{teamNames.red}</span>
                <span className="text-sm">⚔️</span>
              </div>
            </div>

            {(
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Blue Squad Cards */}
                <div className="space-y-1.5">
                  {blueChamps.map((u) => (
                    <div
                      key={u.id}
                      className={`border rounded-xl p-2 transition flex items-center justify-between gap-2.5 ${
                        u.isAlive ? 'bg-slate-950/85 border-cyan-500/30' : 'bg-slate-950/70 border-slate-800 opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <ChibiAvatar avatarType={u.player.avatarSvg} size={36} />
                          <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-black shadow">
                            L{u.level}
                          </span>
                          {!u.isAlive && (
                            <div className="absolute inset-0 bg-slate-950/85 rounded-full flex items-center justify-center text-[9px] font-mono font-bold text-amber-300">
                              💀{Math.ceil(u.respawnTimer)}s
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap leading-tight">
                            <span className="truncate max-w-[85px]">{u.player.name}</span>
                            {u.comboMastered && (
                              <span className="text-[9px] bg-violet-500/20 text-violet-200 px-1 py-0.5 rounded font-bold border border-violet-500/30" title={`${AVATAR_COMBOS[u.champion.name]?.name} learned`}>
                                Combo: {AVATAR_COMBOS[u.champion.name]?.name}
                              </span>
                            )}
                            {!u.comboMastered && comboPracticeNeeded(u.player, u.champion.name) !== null && (
                              <span className="text-[9px] text-violet-300 bg-violet-950/50 px-1 py-0.5 rounded border border-violet-500/20">
                                Combo {u.comboPractice ?? 0}/{comboPracticeNeeded(u.player, u.champion.name)}
                              </span>
                            )}
                            {u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u) && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.5 rounded font-bold animate-pulse">
                                Ult Ready!
                              </span>
                            )}
                            {u.level >= 6 && u.cdUlt > 0 && (
                              <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono border border-slate-700">
                                Ult: {Math.ceil(u.cdUlt)}s
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-cyan-300 font-bold leading-tight">{u.champion.displayName}</div>
                          
                          {/* Live Health Bar */}
                          <div className="mt-1 w-full max-w-[210px]">
                            <div className="flex items-center justify-between text-[9px] font-mono leading-none mb-0.5">
                              <span className="font-bold text-slate-200">
                                {Math.round(u.hp)}/{u.maxHp} HP
                              </span>
                              <span className={u.hp / u.maxHp <= 0.3 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                                {Math.round((u.hp / u.maxHp) * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 border border-slate-700/80 rounded h-2 overflow-hidden relative">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-150"
                                style={{ width: `${Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100))}%` }}
                              />
                              {u.shield > 0 && (
                                <div
                                  className="absolute top-0 bottom-0 bg-white/70 border-r border-white"
                                  style={{
                                    left: `${Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100))}%`,
                                    width: `${Math.max(0, Math.min(100 - (u.hp / u.maxHp) * 100, (u.shield / u.maxHp) * 100))}%`
                                  }}
                                />
                              )}
                            </div>
                            {/* Level / XP Progress Bar */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] font-mono text-purple-300 font-bold shrink-0">
                                {u.level >= 18 ? 'MAX' : `XP ${Math.round(u.xp)}/${getXpThreshold(u.level + 1)}`}
                              </span>
                              <div
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-sm h-1.5 overflow-hidden"
                                title={u.level >= 18 ? 'Level 18 (Capped)' : `Level ${u.level} Progress`}
                              >
                                <div
                                  className={`h-full ${u.level >= 18 ? 'bg-amber-400' : 'bg-gradient-to-r from-purple-500 to-indigo-400'}`}
                                  style={{
                                    width: `${
                                      u.level >= 18
                                        ? 100
                                        : Math.max(0, Math.min(100, ((u.xp - getXpThreshold(u.level)) / Math.max(1, getXpThreshold(u.level + 1) - getXpThreshold(u.level))) * 100))
                                    }%`
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                            KDA: <strong className="text-amber-300">{u.kills}/{u.deaths}/{u.assists}</strong> | CS: <strong className="text-white">{u.cs}</strong>
                            <span className="text-slate-600"> | </span>
                            Mana: <strong className="text-yellow-400">{Math.round(u.mana)}/100</strong>
                            {!u.isAlive && <span className="text-rose-400 font-bold ml-1.5">💀 Respawns in {Math.ceil(u.respawnTimer)}s</span>}
                          </div>
                        </div>
                      </div>

                      {/* 6-Item Inventory Slots */}
                      <div className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-1 rounded-lg border border-slate-800 shrink-0">
                        {Array.from({ length: 6 }).map((_, slotIdx) => {
                          const it = u.items[slotIdx];
                          return (
                            <button
                              key={slotIdx}
                              onClick={() => it && setInspectedItem(it)}
                              disabled={!it}
                              title={it ? `${it.name} (${it.tier})` : 'Empty item slot'}
                              className={`w-6 h-6 rounded border flex items-center justify-center text-xs transition ${
                                it
                                  ? it.tier === 'Mythic'
                                    ? 'bg-amber-950/90 border-amber-400 text-amber-200 hover:scale-110 shadow'
                                    : it.tier === 'Component'
                                    ? 'bg-blue-950/80 border-cyan-500 text-cyan-200 hover:scale-110 shadow'
                                    : 'bg-slate-800 border-slate-600 hover:border-slate-400 hover:scale-110'
                                  : 'bg-slate-950/70 border-slate-800/60'
                              }`}
                            >
                              {it ? it.icon : ''}
                            </button>
                          );
                        })}
                        <button onClick={() => u.boots && setInspectedItem(u.boots)} disabled={!u.boots}
                          title={u.boots ? `${u.boots.name} (boots slot)` : 'Empty boots slot'}
                          className="w-6 h-6 rounded border border-lime-500/60 bg-slate-900 text-xs">{u.boots?.icon ?? '👢'}</button>
                        <span title={`Free ward: ${matchTime >= (u.wardReadyAt ?? 0) ? 'ready' : `${Math.ceil((u.wardReadyAt ?? 0) - matchTime)}s cooldown`}`}
                          className={`w-6 h-6 rounded border flex items-center justify-center text-xs ${matchTime >= (u.wardReadyAt ?? 0) ? 'border-lime-400 text-lime-300' : 'border-slate-700 text-slate-500'}`}>◉</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Red Squad Cards */}
                <div className="space-y-1.5">
                  {redChamps.map((u) => (
                    <div
                      key={u.id}
                      className={`border rounded-xl p-2 transition flex items-center justify-between gap-2.5 ${
                        u.isAlive ? 'bg-slate-950/85 border-rose-500/30' : 'bg-slate-950/70 border-slate-800 opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <ChibiAvatar avatarType={u.player.avatarSvg} size={36} />
                          <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-black shadow">
                            L{u.level}
                          </span>
                          {!u.isAlive && (
                            <div className="absolute inset-0 bg-slate-950/85 rounded-full flex items-center justify-center text-[9px] font-mono font-bold text-amber-300">
                              💀{Math.ceil(u.respawnTimer)}s
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap leading-tight">
                            <span className="truncate max-w-[85px]">{u.player.name}</span>
                            {u.comboMastered && (
                              <span className="text-[9px] bg-violet-500/20 text-violet-200 px-1 py-0.5 rounded font-bold border border-violet-500/30" title={`${AVATAR_COMBOS[u.champion.name]?.name} learned`}>
                                Combo: {AVATAR_COMBOS[u.champion.name]?.name}
                              </span>
                            )}
                            {!u.comboMastered && comboPracticeNeeded(u.player, u.champion.name) !== null && (
                              <span className="text-[9px] text-violet-300 bg-violet-950/50 px-1 py-0.5 rounded border border-violet-500/20">
                                Combo {u.comboPractice ?? 0}/{comboPracticeNeeded(u.player, u.champion.name)}
                              </span>
                            )}
                            {u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u) && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.5 rounded font-bold animate-pulse">
                                Ult Ready!
                              </span>
                            )}
                            {u.level >= 6 && u.cdUlt > 0 && (
                              <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono border border-slate-700">
                                Ult: {Math.ceil(u.cdUlt)}s
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-rose-300 font-bold leading-tight">{u.champion.displayName}</div>
                          
                          {/* Live Health Bar */}
                          <div className="mt-1 w-full max-w-[210px]">
                            <div className="flex items-center justify-between text-[9px] font-mono leading-none mb-0.5">
                              <span className="font-bold text-slate-200">
                                {Math.round(u.hp)}/{u.maxHp} HP
                              </span>
                              <span className={u.hp / u.maxHp <= 0.3 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                                {Math.round((u.hp / u.maxHp) * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 border border-slate-700/80 rounded h-2 overflow-hidden relative">
                              <div
                                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-150"
                                style={{ width: `${Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100))}%` }}
                              />
                              {u.shield > 0 && (
                                <div
                                  className="absolute top-0 bottom-0 bg-white/70 border-r border-white"
                                  style={{
                                    left: `${Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100))}%`,
                                    width: `${Math.max(0, Math.min(100 - (u.hp / u.maxHp) * 100, (u.shield / u.maxHp) * 100))}%`
                                  }}
                                />
                              )}
                            </div>
                            {/* Level / XP Progress Bar */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] font-mono text-purple-300 font-bold shrink-0">
                                {u.level >= 18 ? 'MAX' : `XP ${Math.round(u.xp)}/${getXpThreshold(u.level + 1)}`}
                              </span>
                              <div
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-sm h-1.5 overflow-hidden"
                                title={u.level >= 18 ? 'Level 18 (Capped)' : `Level ${u.level} Progress`}
                              >
                                <div
                                  className={`h-full ${u.level >= 18 ? 'bg-amber-400' : 'bg-gradient-to-r from-purple-500 to-indigo-400'}`}
                                  style={{
                                    width: `${
                                      u.level >= 18
                                        ? 100
                                        : Math.max(0, Math.min(100, ((u.xp - getXpThreshold(u.level)) / Math.max(1, getXpThreshold(u.level + 1) - getXpThreshold(u.level))) * 100))
                                    }%`
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                            KDA: <strong className="text-amber-300">{u.kills}/{u.deaths}/{u.assists}</strong> | CS: <strong className="text-white">{u.cs}</strong>
                            <span className="text-slate-600"> | </span>
                            Mana: <strong className="text-yellow-400">{Math.round(u.mana)}/100</strong>
                            {!u.isAlive && <span className="text-rose-400 font-bold ml-1.5">💀 Respawns in {Math.ceil(u.respawnTimer)}s</span>}
                          </div>
                        </div>
                      </div>

                      {/* 6-Item Inventory Slots */}
                      <div className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-1 rounded-lg border border-slate-800 shrink-0">
                        {Array.from({ length: 6 }).map((_, slotIdx) => {
                          const it = u.items[slotIdx];
                          return (
                            <button
                              key={slotIdx}
                              onClick={() => it && setInspectedItem(it)}
                              disabled={!it}
                              title={it ? `${it.name} (${it.tier})` : 'Empty item slot'}
                              className={`w-6 h-6 rounded border flex items-center justify-center text-xs transition ${
                                it
                                  ? it.tier === 'Mythic'
                                    ? 'bg-amber-950/90 border-amber-400 text-amber-200 hover:scale-110 shadow'
                                    : it.tier === 'Component'
                                    ? 'bg-blue-950/80 border-cyan-500 text-cyan-200 hover:scale-110 shadow'
                                    : 'bg-slate-800 border-slate-600 hover:border-slate-400 hover:scale-110'
                                  : 'bg-slate-950/70 border-slate-800/60'
                              }`}
                            >
                              {it ? it.icon : ''}
                            </button>
                          );
                        })}
                        <button onClick={() => u.boots && setInspectedItem(u.boots)} disabled={!u.boots}
                          title={u.boots ? `${u.boots.name} (boots slot)` : 'Empty boots slot'}
                          className="w-6 h-6 rounded border border-lime-500/60 bg-slate-900 text-xs">{u.boots?.icon ?? '👢'}</button>
                        <span title={`Free ward: ${matchTime >= (u.wardReadyAt ?? 0) ? 'ready' : `${Math.ceil((u.wardReadyAt ?? 0) - matchTime)}s cooldown`}`}
                          className={`w-6 h-6 rounded border flex items-center justify-center text-xs ${matchTime >= (u.wardReadyAt ?? 0) ? 'border-lime-400 text-lime-300' : 'border-slate-700 text-slate-500'}`}>◉</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. ITEM TIMINGS & POWER SPIKES DOSSIER PANEL */}
      {/* ======================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Match Item Timings & Power Spikes</span>
          </h3>
          <span className="text-[10px] text-slate-400">Recorded In-Game Purchases & Objectives</span>
        </div>

        {itemMilestones.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-950 rounded-xl border border-slate-800/50">
            Champions building initial components and trading towards legendary item spikes...
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5">
            {itemMilestones.map((ms, idx) => (
              <div
                key={idx}
                className={`bg-slate-950 border rounded-xl p-2.5 shadow text-xs flex items-center gap-2.5 ${
                  ms.team === 'blue' ? 'border-cyan-500/30' : 'border-rose-500/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-amber-400/40 flex items-center justify-center text-base shadow">
                  {ms.itemIcon}
                </div>
                <div>
                  <div className="font-black text-white leading-tight flex items-center gap-1">
                    <span>{ms.itemName}</span>
                    <span className="text-[9px] font-mono text-amber-400">[{ms.time}]</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {ms.playerName} ({ms.champName}) • <strong className="text-amber-300">{ms.stats}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. LIVE MATCH EVENT LOG & ANNOUNCEMENTS */}
      {/* ======================================================== */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 max-h-36 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
        {eventFeed.map((evt) => (
          <div key={evt.id} className="flex items-center gap-2 leading-relaxed">
            <span className="text-slate-500 font-bold">[{evt.time}]</span>
            <span className={
              evt.type === 'tower' ? 'text-amber-400 font-black' :
              evt.type === 'dragon' ? 'text-cyan-300 font-black' :
              evt.type === 'jungle' ? 'text-emerald-300 font-bold' :
              evt.type === 'item' ? 'text-yellow-300 font-bold' :
              evt.type === 'level' ? 'text-purple-300 font-bold' :
              evt.type === 'combo' ? 'text-emerald-400 font-black' :
              evt.type === 'micro' ? 'text-cyan-300 font-bold' :
              evt.type === 'fountain' ? 'text-blue-300 font-bold' :
              'text-rose-300'
            }>
              {evt.text}
            </span>
          </div>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 6. ITEM INSPECTION MODAL */}
      {/* ======================================================== */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setInspectedItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl border border-amber-400/50 flex items-center justify-center text-2xl shadow">
                {inspectedItem.icon}
              </div>
              <div>
                <h3 className="font-black text-white text-base leading-tight">{inspectedItem.name}</h3>
                <div className="text-xs text-amber-400 font-bold flex items-center gap-1.5 mt-0.5">
                  <span>{inspectedItem.tier} Item</span>
                  <span>•</span>
                  <span>🪙 {inspectedItem.cost} Gold</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs space-y-1 mb-3">
              {inspectedItem.stats.ad && <div className="text-orange-300 font-bold">+{inspectedItem.stats.ad} Attack Damage</div>}
              {inspectedItem.stats.ap && <div className="text-cyan-300 font-bold">+{inspectedItem.stats.ap} Ability Power</div>}
              {inspectedItem.stats.hp && <div className="text-emerald-300 font-bold">+{inspectedItem.stats.hp} Health</div>}
              {inspectedItem.stats.armor && <div className="text-yellow-300 font-bold">+{inspectedItem.stats.armor} Armor</div>}
              {inspectedItem.stats.mr && <div className="text-purple-300 font-bold">+{inspectedItem.stats.mr} Magic Resist</div>}
              {inspectedItem.stats.aspd && <div className="text-blue-300 font-bold">+{Math.round(inspectedItem.stats.aspd * 100)}% Attack Speed</div>}
              {inspectedItem.stats.haste && <div className="text-indigo-300 font-bold">+{inspectedItem.stats.haste} Ability Haste</div>}
              {inspectedItem.stats.lethality && <div className="text-rose-400 font-bold">+{inspectedItem.stats.lethality} Lethality</div>}
              {inspectedItem.stats.magicPen && <div className="text-violet-300 font-bold">+{inspectedItem.stats.magicPen} Magic Penetration</div>}
              {inspectedItem.stats.armorPen && <div className="text-amber-400 font-bold">+{inspectedItem.stats.armorPen}% Armor Penetration</div>}
              {inspectedItem.stats.crit && <div className="text-red-300 font-bold">+{inspectedItem.stats.crit}% Critical Strike Chance</div>}
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs">
              <div className="font-black text-amber-300 flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Unique: {inspectedItem.passiveName}
              </div>
              <div className="text-slate-300 leading-relaxed">
                {inspectedItem.passiveDesc}
              </div>
            </div>

            <button
              onClick={() => setInspectedItem(null)}
              className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
