import React, { useEffect, useRef, useState } from 'react';
import { perceiveChampions } from '../decisionPerception';
import { resolveFightCommitment } from '../decisionCommitment';
import { beginOrContinueAction, chooseCommittedActionTarget, decisiveActionKey,
  inspectActionProgress, isActionRetryBlocked, recordActionFailure, type DecisiveActionKind } from '../decisionActionRecovery';
import { chooseMacroAction, nextMacroCommitment } from '../macroActionDecision';
import { evaluateResidualPush, planResidualPush } from '../residualPushRules';
import { assignSafeMacroExperiment, createExperimentRandom, safeMacroExperimentGate } from '../safeMacroExperiment';
import { pairedMacroTargetMatches, pairedStateFingerprint, parsePairedMacroTarget, serializePairedState } from '../pairedMacroReplay';
import { pairedScoutAfter } from '../pairedStudyDraft';
import { summarizeTaskOutcome, type TaskEvent, type TaskEventKind } from '../taskOutcome';
import { captureTeamTaskSnapshot, summarizeTeamTaskOutcome, type TeamTaskSnapshot } from '../teamTaskOutcome';
import { chooseRewardGuidedMacro } from '../rewardMacroDecision';
import { buildTaskActionContext } from '../taskActionContext';
import { captureTerrainRoutes, restoreTerrainRoutes } from '../arenaRules';
import { macroScenarioPosition, parseMacroScenarioFixture } from '../macroScenarioFixture';
import { inspectSafeMacroExperiment } from '../safeMacroExperiment';
import { isInsideEnemyWellBeam, isInsideHealingWell, isUnsafeWellChase } from '../baseSafetyRules';
import { coordinateTeamIntent, teamIntentRole, type TeamIntent } from '../teamIntentDecision';
import { createSpatialInfluence } from '../spatialInfluence';
import { estimateTacticalOutlook } from '../tacticalOutlook';
import { createOpponentTacticalMemory, observeOpponentTacticalMemory, readOpponentTacticalMemory } from '../opponentTacticalMemory';
import { choosePostFightConversion } from '../postFightConversion';
import { recordAIDecision, settleExperimentOutcome, shouldRecordAIDecision, type AIDecisionRecord } from '../aiDecisionTelemetry';
import { scoreUtility } from '../utilityDecision';
import { summarizeDecisionCalibration } from '../decisionCalibration';
import { adaptiveFeatures, adaptivePolicyScore, adaptivePreferenceAllowed, loadAdaptivePolicy, trainAdaptivePolicy,
  type AdaptiveAction, type AdaptivePolicy } from '../adaptivePolicy';
import { runSimulationSlice, shouldPublishHud } from '../simulationPresentation';
import { ARENA_RENDER_HEIGHT, clampArenaCamera } from '../arenaPresentationCamera';
import type { ThreeArenaTerrain } from '../threeArenaTerrain';
import { SpectatorRoster } from './SpectatorRoster';
import './spectator.css';
import { drawKaelenSpell } from '../kaelenSpellVisuals';
import { KAELEN_ORB_MANA, KAELEN_ACTION_INTERVAL, chooseKaelenPlan, nextKaelenRecipeOrb } from '../kaelenAbilities';
import { advanceKaelenCast, isKaelenZoneActive, kaelenCastLifetime, kaelenCastPosition, type KaelenCast } from '../kaelenSpellRuntime';
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
import { applyMoodEvent, applyTeamPsychologyEvent, decayMood, deriveTeamPsychology, ensurePsychology, normalizePlayerPersonality,
  personalityActionDelta, personalityCallAlignment, personalityDecisionBreakdown, personalityOf, type PersonalityAction } from '../playerPersonality';
import { observeEngagementOutcome, type EngagementObservation, type EngagementSnapshot } from '../engagementOutcomeRules';

const PERSONALITY_ACTION_FOR_INTENT: Record<DecisiveActionKind, PersonalityAction> = {
  champion: 'engage', structure: 'siege', minion: 'wave', camp: 'farm', objective: 'objective',
  defend: 'peel', regroup: 'regroup', stage: 'regroup', relic: 'retreat', push: 'siege', hold: 'regroup',
};
import {
  assessTowerDiveRisk,
  isBushSafeFromTowers,
  getTurretPerimeterHoldPoint
} from '../towerDiveRules';
import { CAMP_PATIENCE_SECONDS, neutralCampRespawnSeconds, stepCampPatience, stepLeashedMonster } from '../neutralAggroRules';
import { consumeFixedSteps, createMatchRandom, resolveNeutralKillCredit, resolveTurretKillReward, SIMULATION_STEP, summarizeMatchReports, type MatchReport, type RecordedMatchEvent } from '../matchReplay';
import { matchEconomyPhase, passiveGoldPerSecond } from '../economyRules';
import { abilityDamageMultiplier, abilityCooldownMultiplier, abilityRank, type AbilitySlot } from '../skillProgression';
import { abilityDamageFromStats, abilityItemStats } from '../abilityRules';
import { maxMana, manaRegen, skill1ManaCost, ultimateManaCost, ultimateBaseCooldown } from '../abilityRules';
import { drawChampionSprite, drawSpiritBearSprite } from './ChampionSpriteRenderer';
import {
  BATTLEFIELD_MODEL_METRICS,
  drawBarracksStructure,
  drawLaneMinionModel,
  drawNexusStructure,
  drawTowerStructure,
} from './BattlefieldModelRenderer';
import { creatureAttackPose, creatureFacingScale, faceTargetLikeAvatar } from '../creatureAnimation';
import { drawAvatarSkillAnimation, type SkillSlot } from '../avatarSkillAnimation';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { chooseTeamfightTarget, isChannelingAbility, isEnemyCaughtInAlliedChannel, isUnitVisibleTo, shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from '../combatDecision';
import { createEnemyCooldownMemory, isObservedCooling, observeCooldownRise, type CooldownSnapshot } from '../cooldownKnowledge';
import { getSkillCastRange, isCrowdControlSkill, applyChainStun, HEX_SIZE } from '../skillRangeRules';
import { ARENA_WIDTH, BARRACKS_X, CAMP_ROCK_RINGS, DRAGON_SPAWN_SECOND, DRAGON_X, LANE_Y, NEXUS_X, NEXUS_TOWER_X, ROCK_TERRAIN, WELL_X, STRUCTURE_HP, nextNexusVolleyShot, selectNexusTargets, selectTurretTarget, turretShotDamage, resolveRockTerrainMovement, rockApproachWaypoint, rockRouteDistance, isMinionEmpowered, waveStats, ARAM_BUSHES, getBushAt, canUnitRecall, towerSiegeMultiplier, canDamageNexus, shouldSeparateUnitsByTeam } from '../arenaRules';
import { getMinionCrashMultiplier, getMinionStructureDamage, getWaveClearProfile, isInsideWaveClear, shouldPrioritizeWaveClear, shouldCastWaveClearSkill } from '../waveClearRules';
import { structureBasicAttackDamage } from '../structureSiegeRules';
import { evaluateNexusFinish } from '../nexusFinishRules';
import { createRatedAvatar } from '../playerCardPower';
import { campAnimation } from '../campAnimation';
import { GOLEM_CHARGE_DAMAGE, GOLEM_SPAWN_SECOND, selectGolemChargeTower, shouldAwakenGolem } from '../siegeGolemRules';
import { chooseKnownJungleCamp, neutralAttackRange, shouldFocusExposedNexus, shouldPressWonFight,
  choosePostRecallTeamCamp, shouldStartPostRecallCampObjective, shareJungleCampRewards } from '../macroFarmRules';
import { BLACK_HOLE_RADIUS, shouldSpreadForBlackHole, threatensBlackHole } from '../blackHoleCounterplay';
import { shouldRetreatLosingFight } from '../fightSurvivalRules';
import { chooseRetreatPlan, shouldKeepRetreatPlan } from '../retreatRouting';
import { retreatSpeedBreakdown } from '../movementSpeedRules';
import { canBasicAttackStructure, getChampionBasicAttackRange } from '../basicAttackRangeRules';
import { BUCK_SMOKE_DURATION, BUCK_SMOKE_RADIUS, getAbilityAdjustedBasicAttackRange,
  getKindraHuntDamageMultiplier, getLambsRespiteExpiryHeal, getLambsRespiteMinimumHealth,
  KINDRA_HUNT_DURATION, LAMBS_RESPITE_DURATION, LAMBS_RESPITE_RADIUS,
  shouldTriggerKindraHunt } from '../abilityRuntimeRules';
import { advanceCreepAttack, advanceTargetedProjectile, creepAttackPose, startCreepAttack } from '../creepAttackTiming';
import { isInsideRockTerrain } from '../arenaRules';
import { chooseNearbyFightingAlly, shouldKeepRecallPlan } from '../actionDecisionRules';
import { INNER_TOWER_X, OUTER_TOWER_X } from '../arenaLayout';
import { campWallPoint } from '../arenaRules';
import { shouldCastNoTargetMobilityUltimate } from '../abilityCastTypes';
import { chooseBaseDefense, shouldChaseDefenseTarget, shouldStandAndDefendBase, shouldLeaveWellToDefend,
  shouldRecallToDefendBase, shouldInterruptRecallForDefense } from '../baseDefenseRules';
import { isTeamfightApproachSafe, laneAdvanceLimit, shouldCoordinateObjectiveRecall, shouldFollowUpControl, shouldPrioritizeTeamfight, shouldPushWithWave, shouldSeekHealthRelic, shouldStageForObjective, shouldStartProactiveAllIn, wouldOverstep } from '../teamTempoRules';
import { shouldPaxiEscapeJaunt } from '../paxiDecision';
import { getGroundTargetPoint } from '../groundTargetRules';
import { getTeamwardKickDestination } from '../kickswitchAbilities';
import { aetherisUltimateDurationAtRank, findAetherisInnateAlly } from '../aetherisAbilities';
import { PROPELLA_OVERDRIVE_SECONDS, PROPELLA_ROTOR_STACK_SECONDS, propellaAttackSpeedBonus,
  propellaFlakSplashRatio, propellaGunshipDurationAtRank, propellaRotorStacksAfterAttack } from '../propellaRules';
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
import { addInsightEvent, createMatchInsights, recordAbilityCast, recordAbilityMovement, recordBlackHoleInterrupt,
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
  Minimize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface Projectile {
  creepAttackTarget?: 'minion' | 'camp' | 'dragon';
  waveClear?: boolean;
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
    | 'tornado' | 'shuriken' | 'feather' | 'nature_bolt' | 'boulder' | 'spirit_arrow' | 'poison_dart' | 'electric_spark' | 'seed_shot' | 'hook' | 'flak_round';
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
  flakSplashRatio?: number;
}

interface SpellAOE {
  halfWidth?: number;
  halfHeight?: number;
  kaelenCast?: KaelenCast;
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
  damageContributors?: Record<string, number>;
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

interface PostRecallCampPlan {
  campId: string;
  memberIds: string[];
  expiresAt: number;
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
  onExit?: () => void;
  seed: number;
  onlineMode?: boolean;
  onReplay: () => void;
  replayLabel?: string;
  replayTitle?: string;
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

function getEffectiveAttackSpeed(unit: AramChampionUnit): number {
  const censerBonus = (unit.censerBuffTimer ?? 0) > 0 ? 0.25 : 0;
  const propellaBonus = unit.champion.name === 'Skybreaker'
    ? propellaAttackSpeedBonus(
      unit.propellaRotorStacks ?? 0,
      (unit.propellaOverdriveTimer ?? 0) > 0,
      (unit.propellaGunshipTimer ?? 0) > 0
    )
    : 0;
  return Math.max(0.5, unit.champion.aspd + censerBonus + propellaBonus);
}

function setUnitFacing(unit: AramChampionUnit, targetX: number, deadband = 12) {
  const dx = targetX - unit.x;
  if (Math.abs(dx) > deadband) {
    unit.facing = dx > 0 ? 'right' : 'left';
  }
}

const getKaelenOrbBonuses = (unit: AramChampionUnit) =>
  kaelenOrbStatBonuses(unit.level, kaelenOrbCounts(unit.kaelenOrbs ?? []));

// Keeps elemental buffs and slows in the existing movement model without changing base stats.
const getKaelenMovementAdjustment = (unit: AramChampionUnit) => {
  const orbAndBuff = getKaelenOrbBonuses(unit).moveSpeed + ((unit.kaelenEquinoxTimer ?? 0) > 0 ? unit.kaelenEquinoxMoveSpeed ?? 0 : 0);
  return orbAndBuff - 90 * Math.max(0, Math.min(.45, unit.kaelenSlowAmount ?? 0));
};

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
  onExit,
  replayLabel = 'Replay',
  replayTitle = 'Restart this draft with the same seed',
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
  const threeTerrainHostRef = useRef<HTMLDivElement>(null);
  const threeTerrainRef = useRef<ThreeArenaTerrain | null>(null);
  const threeTerrainAvailableRef = useRef(false);
  const [arenaView, setArenaView] = useState<'3d' | '2d'>('3d');
  const [webglAvailable, setWebglAvailable] = useState(false);
  const arenaViewRef = useRef(arenaView);
  arenaViewRef.current = arenaView;
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchRootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [dockTab, setDockTab] = useState<'squads' | 'events' | 'items'>('squads');
  const [recordPage, setRecordPage] = useState(0);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);

  useEffect(() => {
    const host = threeTerrainHostRef.current;
    if (!host) return;
    let unmounted = false;
    host.dataset.renderer = 'canvas-fallback';
    void import('../threeArenaTerrain').then(({ ThreeArenaTerrain }) => {
      if (unmounted) return;
      try {
        const terrain = new ThreeArenaTerrain(
          host,
          ARENA_WIDTH,
          ARENA_RENDER_HEIGHT,
          NEXUS_TOWER_X.blue,
          NEXUS_TOWER_X.red,
          available => {
            threeTerrainAvailableRef.current = available;
            if (!unmounted) setWebglAvailable(available);
            host.dataset.renderer = available ? 'three' : 'canvas-fallback';
          },
        );
        threeTerrainRef.current = terrain;
        threeTerrainAvailableRef.current = terrain.isAvailable();
      } catch {
        // The complete Canvas view remains available if WebGL cannot start.
        threeTerrainAvailableRef.current = false;
        host.dataset.renderer = 'canvas-fallback';
      }
    }).catch(() => {
      threeTerrainAvailableRef.current = false;
      host.dataset.renderer = 'canvas-fallback';
    });
    return () => {
      unmounted = true;
      threeTerrainAvailableRef.current = false;
      threeTerrainRef.current?.dispose();
      threeTerrainRef.current = null;
    };
  }, []);

  // Camera Zoom & Spectator Tracking
  const [zoom, setZoom] = useState<number>(2);
  const [cameraMode, setCameraMode] = useState<'auto' | 'manual'>('auto');
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const zoomRef = useRef(2);
  zoomRef.current = zoom;
  const cameraModeRef = useRef<'auto' | 'manual'>('auto');
  cameraModeRef.current = cameraMode;
  const showMinimapRef = useRef<boolean>(true);
  showMinimapRef.current = showMinimap;

  const cameraPosRef = useRef<{ x: number; y: number }>({ x: ARENA_WIDTH / 2, y: 380 });
  const targetCameraPosRef = useRef<{ x: number; y: number }>({ x: ARENA_WIDTH / 2, y: 380 });
  const isDraggingRef = useRef<boolean>(false);
  const isDraggingMinimapRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; camX: number; camY: number }>({
    clientX: 0,
    clientY: 0,
    camX: ARENA_WIDTH / 2,
    camY: 380
  });
  const touchStartRef = useRef<{ x: number; y: number; dist: number; camX: number; camY: number }>({
    x: 0,
    y: 0,
    dist: 0,
    camX: ARENA_WIDTH / 2,
    camY: 380
  });
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
  const teamIntentRef = useRef<Partial<Record<'blue' | 'red', TeamIntent>>>({});
  const cooldownMemoryRef = useRef(createEnemyCooldownMemory());
  const opponentTacticalMemoryRef = useRef(createOpponentTacticalMemory());
  const aiDecisionRecordsRef = useRef<AIDecisionRecord[]>([]);
  const macroExperimentEnabledRef = useRef((() => { try {
    return sessionStorage.getItem('esports-clash-macro-experiment') === '1';
  } catch { return false; } })());
  const pairedMacroModeRef = useRef<'scout' | 'replay' | null>((() => { try {
    const mode = sessionStorage.getItem('esports-clash-macro-pair-mode');
    return macroExperimentEnabledRef.current && (mode === 'scout' || mode === 'replay') ? mode : null;
  } catch { return null; } })());
  const pairedMacroTargetRef = useRef((() => { try {
    return parsePairedMacroTarget(sessionStorage.getItem('esports-clash-macro-pair-target'));
  } catch { return undefined; } })());
  const pairedScoutAfterRef = useRef((() => { try {
    return pairedScoutAfter(sessionStorage.getItem('esports-clash-macro-pair-after'));
  } catch { return 120; } })());
  const macroExperimentRandomRef = useRef<(() => number) | null>((() => { try {
    const seedText = sessionStorage.getItem('esports-clash-macro-experiment-seed');
    return seedText !== null && /^\d+$/.test(seedText) ? createExperimentRandom(Number(seedText)) : null;
  } catch { return null; } })());
  const lastMacroExperimentRef = useRef<Record<string, number>>({});
  const adaptivePolicyRef = useRef<AdaptivePolicy>((() => { try {
    return loadAdaptivePolicy(JSON.parse(localStorage.getItem('esports-clash-adaptive-policy') || ''));
  } catch { return loadAdaptivePolicy(null); } })());
  const evaluationReferencePolicyRef = useRef<AdaptivePolicy | null>((() => { try {
    const stored = localStorage.getItem('esports-clash-evaluation-reference-policy');
    return stored ? loadAdaptivePolicy(JSON.parse(stored)) : null;
  } catch { return null; } })());
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

  const computeActionCenter = (
    champs: AramChampionUnit[],
    width: number,
    height: number
  ): { x: number; y: number } => {
    const aliveChamps = champs.filter((c) => c.isAlive);
    if (aliveChamps.length === 0) {
      return { x: width / 2, y: 380 };
    }

    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;

    for (const c of aliveChamps) {
      let w = 1.0;
      const hpRatio = c.hp / Math.max(1, c.maxHp);
      if (hpRatio < 0.6) w += 1.5;
      if (c.stunTimer > 0 || c.animState === 'cast' || isChannelingAbility(c)) w += 2.0;

      const inCombat = aliveChamps.some(
        (other) => other.team !== c.team && Math.hypot(other.x - c.x, other.y - c.y) <= 520
      );
      if (inCombat) {
        w += 3.5;
      }

      totalWeight += w;
      sumX += c.x * w;
      sumY += c.y * w;
    }

    const rawX = sumX / Math.max(0.001, totalWeight);
    const rawY = sumY / Math.max(0.001, totalWeight);
    const targetY = 380 + (rawY - 380) * 0.45;

    return { x: rawX, y: targetY };
  };

  // Universal hotkeys: Tab toggles HUD; Space recenters auto cam; +/- zooms; 0 fits arena; M toggles minimap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, summary, a, [contenteditable="true"]')) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        setHudMode((prev) => (prev === 'hidden' ? 'docked' : 'hidden'));
      } else if (e.code === 'Space') {
        e.preventDefault();
        setCameraMode('auto');
        targetCameraPosRef.current = computeActionCenter(championsRef.current, ARENA_WIDTH, 760);
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(1.0, Math.round((z - 0.15) * 100) / 100));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
        setCameraMode('manual');
        targetCameraPosRef.current = { x: ARENA_WIDTH / 2, y: 380 };
      } else if (e.key === 'm' || e.key === 'M') {
        setShowMinimap((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const minimapRect = (width: number, height: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (arenaViewRef.current === '3d' && threeTerrainAvailableRef.current && rect?.width && rect.height) {
      const cssWidth = Math.min(180, rect.width * .3);
      const Mw = cssWidth * width / rect.width, Mh = cssWidth * 760 / 2600 * height / rect.height;
      return { Mw, Mh, mx: width - Mw - 12 * width / rect.width, my: height - Mh - 12 * height / rect.height };
    }
    return { Mw: 260, Mh: 76, mx: width - 278, my: height - 94 };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    if (showMinimapRef.current) {
      const { Mw, Mh, mx, my } = minimapRect(canvas.width, canvas.height);
      if (canvasX >= mx && canvasX <= mx + Mw && canvasY >= my && canvasY <= my + Mh) {
        isDraggingMinimapRef.current = true;
        setCameraMode('manual');
        const worldX = ((canvasX - mx) / Mw) * ARENA_WIDTH;
        const worldY = ((canvasY - my) / Mh) * 760;
        targetCameraPosRef.current = { x: worldX, y: worldY };
        cameraPosRef.current = { x: worldX, y: worldY };
        return;
      }
    }

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      camX: cameraPosRef.current.x,
      camY: cameraPosRef.current.y
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    if (isDraggingMinimapRef.current) {
      const { Mw, Mh, mx, my } = minimapRect(canvas.width, canvas.height);
      const clampedX = Math.max(mx, Math.min(mx + Mw, canvasX));
      const clampedY = Math.max(my, Math.min(my + Mh, canvasY));
      const worldX = ((clampedX - mx) / Mw) * ARENA_WIDTH;
      const worldY = ((clampedY - my) / Mh) * 760;
      targetCameraPosRef.current = { x: worldX, y: worldY };
      cameraPosRef.current = { x: worldX, y: worldY };
      return;
    }

    if (isDraggingRef.current) {
      const deltaX = (e.clientX - dragStartRef.current.clientX) * scaleX;
      const deltaY = (e.clientY - dragStartRef.current.clientY) * scaleY;
      const z = zoomRef.current;
      const pan = arenaViewRef.current === '3d' && threeTerrainAvailableRef.current
        ? threeTerrainRef.current?.pan(deltaX * 2 / canvas.width, deltaY * 2 / canvas.height, z) : null;
      const newX = dragStartRef.current.camX - (pan?.x ?? deltaX / z);
      const newY = dragStartRef.current.camY - (pan?.y ?? deltaY / z);

      targetCameraPosRef.current = { x: newX, y: newY };
      cameraPosRef.current = { x: newX, y: newY };
      if (cameraModeRef.current !== 'manual') {
        setCameraMode('manual');
      }
    }
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
    isDraggingMinimapRef.current = false;
    setIsDragging(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.max(1.0, Math.min(2.5, Math.round((prev + delta) * 100) / 100)));
  };

  const handleCanvasDoubleClick = () => {
    setCameraMode('auto');
    targetCameraPosRef.current = computeActionCenter(championsRef.current, ARENA_WIDTH, 760);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (touch.clientX - rect.left) * scaleX;
      const canvasY = (touch.clientY - rect.top) * scaleY;

      if (showMinimapRef.current) {
        const { Mw, Mh, mx, my } = minimapRect(canvas.width, canvas.height);
        if (canvasX >= mx && canvasX <= mx + Mw && canvasY >= my && canvasY <= my + Mh) {
          isDraggingMinimapRef.current = true;
          setCameraMode('manual');
          const worldX = ((canvasX - mx) / Mw) * ARENA_WIDTH;
          const worldY = ((canvasY - my) / Mh) * 760;
          targetCameraPosRef.current = { x: worldX, y: worldY };
          cameraPosRef.current = { x: worldX, y: worldY };
          return;
        }
      }

      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        camX: cameraPosRef.current.x,
        camY: cameraPosRef.current.y
      };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      isDraggingMinimapRef.current = false;
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
        dist,
        camX: cameraPosRef.current.x,
        camY: cameraPosRef.current.y
      };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (touch.clientX - rect.left) * scaleX;
      const canvasY = (touch.clientY - rect.top) * scaleY;

      if (isDraggingMinimapRef.current) {
        const { Mw, Mh, mx, my } = minimapRect(canvas.width, canvas.height);
        const clampedX = Math.max(mx, Math.min(mx + Mw, canvasX));
        const clampedY = Math.max(my, Math.min(my + Mh, canvasY));
        const worldX = ((clampedX - mx) / Mw) * ARENA_WIDTH;
        const worldY = ((clampedY - my) / Mh) * 760;
        targetCameraPosRef.current = { x: worldX, y: worldY };
        cameraPosRef.current = { x: worldX, y: worldY };
        return;
      }

      if (isDraggingRef.current) {
        const deltaX = (touch.clientX - dragStartRef.current.clientX) * scaleX;
        const deltaY = (touch.clientY - dragStartRef.current.clientY) * scaleY;
        const z = zoomRef.current;
        const pan = arenaViewRef.current === '3d' && threeTerrainAvailableRef.current
          ? threeTerrainRef.current?.pan(deltaX * 2 / canvas.width, deltaY * 2 / canvas.height, z) : null;
        const newX = dragStartRef.current.camX - (pan?.x ?? deltaX / z);
        const newY = dragStartRef.current.camY - (pan?.y ?? deltaY / z);

        targetCameraPosRef.current = { x: newX, y: newY };
        cameraPosRef.current = { x: newX, y: newY };
        if (cameraModeRef.current !== 'manual') {
          setCameraMode('manual');
        }
      }
    } else if (e.touches.length === 2 && touchStartRef.current.dist > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartRef.current.dist;
      setZoom((prev) => Math.max(1.0, Math.min(2.5, Math.round(prev * ratio * 100) / 100)));
      touchStartRef.current.dist = dist;
    }
  };

  const handleCanvasTouchEnd = () => {
    isDraggingRef.current = false;
    isDraggingMinimapRef.current = false;
    setIsDragging(false);
    touchStartRef.current.dist = 0;
  };

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
  const objectiveRecallPlanRef = useRef<Partial<Record<'blue' | 'red', string>>>({});
  const postRecallCampPlanRef = useRef<Partial<Record<'blue' | 'red', PostRecallCampPlan>>>({});
  const lastTeamKillAtRef = useRef({ blue: -Infinity, red: -Infinity });
  const engagementTrackerRef = useRef<EngagementSnapshot | undefined>(undefined);
  const nextEngagementIdRef = useRef(1);
  const engagementOutcomeCooldownRef = useRef(0);
  const wardsRef = useRef<{ id: string; team: 'blue' | 'red'; bushId: string; x: number; y: number; expiresAt: number }[]>([]);
  const jungleBuffsRef = useRef<{ blue: { blue: number; red: number }; red: { blue: number; red: number } }>({
    blue: { blue: 0, red: 0 }, red: { blue: 0, red: 0 }
  });

  const isInsideEnemySmoke = (unit: AramChampionUnit) => spellsRef.current.some(spell => {
    if (spell.type !== 'smoke_screen' || Math.hypot(spell.x - unit.x, spell.y - unit.y) > spell.radius) return false;
    const source = championsRef.current.find(champion => champion.id === spell.sourceUnitId);
    return !!source && source.team !== unit.team;
  });

  const getLiveBasicAttackRange = (unit: AramChampionUnit) => getAbilityAdjustedBasicAttackRange(
    unit.champion, unit.kindraHuntTimer ?? 0, isInsideEnemySmoke(unit)
  );

  const triggerKindraHunt = (unit: AramChampionUnit) => {
    const wasInactive = (unit.kindraHuntTimer ?? 0) <= 0;
    unit.kindraHuntTimer = KINDRA_HUNT_DURATION;
    if (wasInactive) floatsRef.current.push({
      id: random().toString(), x: unit.x, y: unit.y - 42,
      text: 'SPIRIT MARK +15%', color: '#c084fc', opacity: 1, scale: 1.1
    });
  };

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
    { id: 'j_blue_golem', name: 'Frost Sentinel', type: 'golem', x: 876, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_wolves', name: 'Shadow Stalkers', type: 'wolves', x: 1724, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#a855f7' },
    { id: 'j_blue_behemoth', name: 'Murk Behemoth', type: 'behemoth', x: 967, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#10b981' },
    { id: 'j_red_drakes', name: 'Crimson Drakes', type: 'drakes', x: 1633, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#ef4444' },
    { id: 'j_blue_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 640, y: 145, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_blue_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 785, y: 600, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#fb7185' },
    { id: 'j_red_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 1960, y: 145, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 1815, y: 600, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#fb7185' },
    { id: 'j_siege_golem', name: 'Gravemarch Colossus', type: 'siege_golem', x: 1300, y: 610,
      hp: 6200, maxHp: 6200, ad: 135, range: 230, goldReward: 250, xpReward: 300,
      respawnTimer: 0, isAlive: false, attackTimer: 0, color: '#d4a764' }
  ]);

  const aegisBuffRef = useRef<AegisBuff | null>(null);

  const teamTaskSnapshot = (team: 'blue' | 'red') => captureTeamTaskSnapshot({
    second: matchTimeRef.current, team, champions: championsRef.current,
    structures: structuresRef.current, dragonTeam: aegisBuffRef.current?.team, siegeUnits: minionsRef.current,
  });

  const capturePairedCheckpoint = () => structuredClone({
    terrainRoutes: captureTerrainRoutes([...championsRef.current, ...jungleCampsRef.current]),
    second: matchTimeRef.current,
    randomState: randomRef.current.getState(),
    champions: championsRef.current, minions: minionsRef.current,
    structures: structuresRef.current, relics: relicsRef.current,
    projectiles: projectilesRef.current, spells: spellsRef.current,
    floats: floatsRef.current, waveTimer: waveTimerRef.current,
    waveCount: waveCountRef.current,
    pendingSiegeGolem: pendingSiegeGolemRef.current,
    golemAwakened: golemAwakenedRef.current,
    objectiveRecallPlan: objectiveRecallPlanRef.current,
    postRecallCampPlan: postRecallCampPlanRef.current,
    lastTeamKillAt: lastTeamKillAtRef.current,
    engagementTracker: engagementTrackerRef.current,
    nextEngagementId: nextEngagementIdRef.current,
    engagementOutcomeCooldown: engagementOutcomeCooldownRef.current,
    wards: wardsRef.current, jungleBuffs: jungleBuffsRef.current,
    dragon: dragonRef.current, jungleCamps: jungleCampsRef.current,
    aegisBuff: aegisBuffRef.current,
    objectiveCalls: objectiveCallsRef.current,
    teamIntent: teamIntentRef.current,
    cooldownMemory: cooldownMemoryRef.current,
    opponentTacticalMemory: opponentTacticalMemoryRef.current,
    cooldownSnapshots: cooldownSnapshotsRef.current,
    postObjectivePlan: postObjectivePlanRef.current,
    lastMacroExperiment: lastMacroExperimentRef.current,
    aiDecisionRecords: aiDecisionRecordsRef.current,
    recordedEvents: recordedEventsRef.current,
    insights: insightsRef.current,
    firstBlood: firstBloodRef.current,
    killStreaks: killStreaksRef.current,
    skillshots: skillshotsRef.current,
    fullBuildsAt15: fullBuildsAt15Ref.current,
    itemCounts: itemCountsRef.current,
    matchFinished: matchFinishedRef.current,
    latestReport: latestReportRef.current,
  });
  const pairedCheckpointRef = useRef<ReturnType<typeof capturePairedCheckpoint> | null>(null);

  const restorePairedCheckpoint = (rawTarget: unknown): boolean => {
    if (!macroExperimentEnabledRef.current || !pairedCheckpointRef.current) return false;
    const target = parsePairedMacroTarget(JSON.stringify(rawTarget));
    if (!target || Math.abs(target.second - pairedCheckpointRef.current.second) > 1e-6) return false;
    const state = structuredClone(pairedCheckpointRef.current);
    matchTimeRef.current = state.second - SIMULATION_STEP;
    accumulatorRef.current = 0;
    randomRef.current.setState(state.randomState);
    championsRef.current = state.champions; minionsRef.current = state.minions;
    structuresRef.current = state.structures; relicsRef.current = state.relics;
    projectilesRef.current = state.projectiles; spellsRef.current = state.spells;
    floatsRef.current = state.floats; waveTimerRef.current = state.waveTimer;
    waveCountRef.current = state.waveCount;
    pendingSiegeGolemRef.current = state.pendingSiegeGolem;
    golemAwakenedRef.current = state.golemAwakened;
    objectiveRecallPlanRef.current = state.objectiveRecallPlan;
    postRecallCampPlanRef.current = state.postRecallCampPlan;
    lastTeamKillAtRef.current = state.lastTeamKillAt;
    engagementTrackerRef.current = state.engagementTracker;
    nextEngagementIdRef.current = state.nextEngagementId;
    engagementOutcomeCooldownRef.current = state.engagementOutcomeCooldown;
    wardsRef.current = state.wards; jungleBuffsRef.current = state.jungleBuffs;
    dragonRef.current = state.dragon; jungleCampsRef.current = state.jungleCamps;
    restoreTerrainRoutes([...state.champions, ...state.jungleCamps], state.terrainRoutes);
    aegisBuffRef.current = state.aegisBuff;
    objectiveCallsRef.current = state.objectiveCalls;
    teamIntentRef.current = state.teamIntent;
    cooldownMemoryRef.current = state.cooldownMemory;
    opponentTacticalMemoryRef.current = state.opponentTacticalMemory;
    cooldownSnapshotsRef.current = state.cooldownSnapshots;
    postObjectivePlanRef.current = state.postObjectivePlan;
    lastMacroExperimentRef.current = state.lastMacroExperiment;
    aiDecisionRecordsRef.current = state.aiDecisionRecords;
    recordedEventsRef.current = state.recordedEvents;
    insightsRef.current = state.insights;
    firstBloodRef.current = state.firstBlood;
    killStreaksRef.current = state.killStreaks;
    skillshotsRef.current = state.skillshots;
    fullBuildsAt15Ref.current = state.fullBuildsAt15;
    itemCountsRef.current = state.itemCounts;
    matchFinishedRef.current = state.matchFinished;
    latestReportRef.current = state.latestReport;
    pairedMacroModeRef.current = 'replay';
    pairedMacroTargetRef.current = target;
    (window as Window & { __esportsPairedMacro?: Record<string, unknown> }).__esportsPairedMacro = undefined;
    return true;
  };

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
    // Consume gameplay RNG synchronously, never inside React's deferred/replayed updater.
    const event: MatchEvent = { id: random().toString(), text, type, time: `${mins}:${secs}` };
    setEventFeed((prev) => [event, ...prev.slice(0, 18)]);
  };

  // Personality reads only observed match outcomes. This bounded five-player
  // update is deliberately event-driven, never a per-tick social simulation.
  const recordTeamPsychologyEvent = (team: 'blue' | 'red', eventId: string,
    kind: 'comeback' | 'teamfight_win' | 'teamfight_loss' | 'team_wipe' | 'objective_steal' | 'objective_loss' | 'defense' | 'failed_siege' | 'failed_engagement' | 'coordination',
    leadershipOutcome?: 'success' | 'failure') => {
    applyTeamPsychologyEvent(championsRef.current.filter(unit => unit.team === team), eventId, kind, leadershipOutcome);
  };

  // Rescue credit uses only an identified recent enemy hit plus a concrete ally
  // heal/shield. It never infers fault or awards mood for ordinary sustain.
  const recordRescue = (rescuer: AramChampionUnit, rescued: AramChampionUnit) => {
    const recentThreat = rescued.lastEnemyDamage;
    if (rescuer.id === rescued.id || !recentThreat || matchTimeRef.current - recentThreat.second > 2.4
      || rescued.hp / rescued.maxHp > 0.55) return;
    const eventId = `rescue:${rescuer.id}:${rescued.id}:${recentThreat.attackerId}:${Math.floor(matchTimeRef.current / 4)}`;
    const alreadyRecorded = rescuer.psychology?.processedEventIds.includes(eventId)
      || rescued.psychology?.processedEventIds.includes(eventId);
    rescuer.psychology = applyMoodEvent(ensurePsychology(rescuer.player, rescuer.psychology), eventId,
      'rescue', personalityOf(rescuer.player));
    rescued.psychology = applyMoodEvent(ensurePsychology(rescued.player, rescued.psychology), eventId,
      'rescue', personalityOf(rescued.player));
    const improvePair = (relationship?: { trust: number; cooperation: number }) => {
      if (!relationship) return;
      relationship.trust = Math.min(100, relationship.trust + 4);
      relationship.cooperation = Math.min(100, relationship.cooperation + 4);
    };
    if (!alreadyRecorded) {
      improvePair(rescuer.relationships?.[rescued.id]);
      improvePair(rescued.relationships?.[rescuer.id]);
    }
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
      { id: 'b_t1', team: 'blue', type: 'outer_tower', name: 'Blue Outer Turret', x: OUTER_TOWER_X.blue, y: LANE_Y, hp: STRUCTURE_HP.outer_tower, maxHp: STRUCTURE_HP.outer_tower, ad: 160, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 25 },
      { id: 'b_t2', team: 'blue', type: 'inner_tower', name: 'Blue Inner Turret', x: INNER_TOWER_X.blue, y: LANE_Y, hp: STRUCTURE_HP.inner_tower, maxHp: STRUCTURE_HP.inner_tower, ad: 190, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 30 },
      { id: 'b_t3', team: 'blue', type: 'nexus_tower', name: 'Blue Nexus Turret', x: NEXUS_TOWER_X.blue, y: LANE_Y, hp: STRUCTURE_HP.nexus_tower, maxHp: STRUCTURE_HP.nexus_tower, ad: 220, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 35 },
      ...makeBarracks('blue'),
      { id: 'b_nexus', team: 'blue', type: 'nexus', name: 'Blue Nexus', x: NEXUS_X.blue, y: LANE_Y, hp: STRUCTURE_HP.nexus, maxHp: STRUCTURE_HP.nexus, ad: 85, range: 190, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
      { id: 'r_t1', team: 'red', type: 'outer_tower', name: 'Red Outer Turret', x: OUTER_TOWER_X.red, y: LANE_Y, hp: STRUCTURE_HP.outer_tower, maxHp: STRUCTURE_HP.outer_tower, ad: 160, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 25 },
      { id: 'r_t2', team: 'red', type: 'inner_tower', name: 'Red Inner Turret', x: INNER_TOWER_X.red, y: LANE_Y, hp: STRUCTURE_HP.inner_tower, maxHp: STRUCTURE_HP.inner_tower, ad: 190, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 30 },
      { id: 'r_t3', team: 'red', type: 'nexus_tower', name: 'Red Nexus Turret', x: NEXUS_TOWER_X.red, y: LANE_Y, hp: STRUCTURE_HP.nexus_tower, maxHp: STRUCTURE_HP.nexus_tower, ad: 220, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 35 },
      ...makeBarracks('red'),
      { id: 'r_nexus', team: 'red', type: 'nexus', name: 'Red Nexus', x: NEXUS_X.red, y: LANE_Y, hp: STRUCTURE_HP.nexus, maxHp: STRUCTURE_HP.nexus, ad: 85, range: 190, attackTimer: 0, isAlive: true, targetId: null, armor: 40 }
    ];
    structuresRef.current = initialStructures;

    // 2. Health & Mana Relics on Bridge & Lower Valley
    relicsRef.current = [
      { id: 'relic_top', x: 1095, y: 295, respawnTimer: 0, healAmount: 260 },
      { id: 'relic_bot', x: 1505, y: 465, respawnTimer: 0, healAmount: 260 }
    ];

    // 3. Champions Initial Setup
    const initChamps: AramChampionUnit[] = [];

    blueLineup.forEach((item, idx) => {
      const player = normalizePlayerPersonality(item.player);
      const loadout = buyInitialLoadout(item.champion.primaryRole, 1500, item.champion.name);
      const champCopy = createRatedAvatar(player, item.champion);
      let bonusHp = 0;
      loadout.items.forEach((it) => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      initChamps.push({
        id: `blue_${player.id}`,
        player,
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
      const player = normalizePlayerPersonality(item.player);
      const loadout = buyInitialLoadout(item.champion.primaryRole, 1500, item.champion.name);
      const champCopy = createRatedAvatar(player, item.champion);
      let bonusHp = 0;
      loadout.items.forEach((it) => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      initChamps.push({
        id: `red_${player.id}`,
        player,
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

    const scenarioFixture = macroExperimentEnabledRef.current ? (() => { try {
      return parseMacroScenarioFixture(sessionStorage.getItem('esports-clash-macro-scenario'));
    } catch { return undefined; } })() : undefined;
    if (scenarioFixture) for (const team of ['blue', 'red'] as const)
      initChamps.filter(unit => unit.team === team).forEach((unit, index) => {
        const position = macroScenarioPosition(team, index, scenarioFixture);
        unit.x = position.x;
        unit.y = position.y;
      });
    initChamps.forEach(unit => {
      unit.psychology = ensurePsychology(unit.player);
      unit.relationships = Object.fromEntries(initChamps.filter(other => other.team === unit.team && other.id !== unit.id)
        .map(other => [other.id, { trust: 60, cooperation: 60, rivalry: 10, leadershipRespect: 60 }]));
    });
    championsRef.current = initChamps;
    cooldownMemoryRef.current = createEnemyCooldownMemory();
    opponentTacticalMemoryRef.current = createOpponentTacticalMemory();
    aiDecisionRecordsRef.current = [];
    lastMacroExperimentRef.current = {};
    cooldownSnapshotsRef.current = {};
    postObjectivePlanRef.current = {};
    pendingSiegeGolemRef.current = {};
    golemAwakenedRef.current = false;
    objectiveRecallPlanRef.current = {};
    postRecallCampPlanRef.current = {};
    lastTeamKillAtRef.current = { blue: -Infinity, red: -Infinity };
    engagementTrackerRef.current = undefined;
    nextEngagementIdRef.current = 1;
    engagementOutcomeCooldownRef.current = 0;
    const matchChamps = [...blueLineup.map(i => i.champion.name), ...redLineup.map(i => i.champion.name)];
    sound.preloadAvatarSkills(matchChamps);
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
          castRaijinGroundUltimate(u, target, u.team === 'blue' ? 1 : -1);
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
        u.attackTimer = 1 / getEffectiveAttackSpeed(u);
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
  const recordPairedTaskEvent = (actorId: string, kind: TaskEventKind, targetId: string, amount: number) => {
    if (!macroExperimentEnabledRef.current || pairedMacroModeRef.current !== 'replay') return;
    const event = (window as Window & { __esportsPairedMacro?: Record<string, unknown> }).__esportsPairedMacro;
    if (!event?.matched || event.actorId !== actorId || event.followup) return;
    const events = (event.taskEvents ??= []) as TaskEvent[];
    events.push({ second: matchTimeRef.current, kind, targetId, amount });
  };
  const updateAramSimulation = (dt: number) => {
    const pairedEvent = (window as Window & { __esportsPairedMacro?: Record<string, unknown> }).__esportsPairedMacro;
    const pairedTarget = pairedMacroTargetRef.current;
    if (pairedMacroModeRef.current === 'replay' && pairedEvent?.matched === true && pairedTarget
      && matchTimeRef.current - pairedTarget.second <= (pairedTarget.horizonSeconds ?? 3) + .05) {
      const actor = championsRef.current.find(unit => unit.id === pairedTarget.actorId);
      if (actor) {
        const behavior = (pairedEvent.behaviorTrace ??= []) as unknown[];
        behavior.push({ second: matchTimeRef.current - SIMULATION_STEP,
          x: actor.x, y: actor.y, hpFraction: actor.hp / actor.maxHp,
          damageDealt: actor.damageDealt, animState: actor.animState,
          intent: actor.actionIntent?.kind, targetId: actor.actionIntent?.targetId,
          cd1: actor.cd1, cd2: actor.cd2, cdUlt: actor.cdUlt,
          decision: pairedEvent.lastDecision });
      }
    }
    if (pairedMacroModeRef.current === 'replay' && pairedEvent?.matched === true && pairedTarget
      && sessionStorage.getItem('esports-clash-macro-pair-trace') === '1'
      && matchTimeRef.current - pairedTarget.second <= (pairedTarget.horizonSeconds ?? 3) + .05) {
      const state = capturePairedCheckpoint();
      const trace = (pairedEvent.trace ??= []) as { second: number; fields: Record<string, string> }[];
      trace.push({ second: matchTimeRef.current,
        fields: Object.fromEntries(Object.entries(state).map(([key, value]) =>
          [key, pairedStateFingerprint(value)])) });
      if (trace.length > 400) trace.shift();
    }
    if (pairedMacroModeRef.current === 'replay' && pairedEvent?.matched === true
      && !pairedEvent.followup && pairedTarget
      && matchTimeRef.current - pairedTarget.second >= (pairedTarget.horizonSeconds ?? 3)) {
      const actor = championsRef.current.find(unit => unit.id === pairedTarget.actorId);
      if (actor) {
        const liveEnemies = championsRef.current.filter(unit => unit.team !== actor.team && unit.isAlive);
        pairedEvent.followup = {
          second: matchTimeRef.current,
          actor: { x: actor.x, y: actor.y, hpFraction: actor.hp / actor.maxHp,
            mana: actor.mana, isAlive: actor.isAlive, gold: actor.gold, cs: actor.cs,
            kills: actor.kills, deaths: actor.deaths, damageDealt: actor.damageDealt,
            economicValue: actor.gold + actor.items.reduce((sum, item) => sum + item.cost, 0)
              + (actor.boots?.cost ?? 0) },
          team: {
            ownStructureHp: structuresRef.current.filter(structure => structure.team === actor.team)
              .reduce((sum, structure) => sum + Math.max(0, structure.hp), 0),
            enemyStructureHp: structuresRef.current.filter(structure => structure.team !== actor.team)
              .reduce((sum, structure) => sum + Math.max(0, structure.hp), 0),
            dragonAspect: aegisBuffRef.current?.team === actor.team,
            siegeGolemUnits: minionsRef.current.filter(minion => minion.team === actor.team
              && minion.isAlive && minion.siegeGolem).length,
          },
          nearestEnemyDistance: liveEnemies.length
            ? Math.min(...liveEnemies.map(enemy => Math.hypot(enemy.x - actor.x, enemy.y - actor.y))) : null,
          insideEnemyTower: structuresRef.current.some(structure => structure.isAlive
            && structure.team !== actor.team && (structure.type.includes('tower') || structure.type === 'nexus')
            && Math.hypot(structure.x - actor.x, structure.y - actor.y) <= structure.range),
        };
        pairedEvent.followupStateFingerprint = pairedStateFingerprint(capturePairedCheckpoint());
        const start = pairedEvent.actorStart as { deaths: number };
        pairedEvent.taskOutcome = summarizeTaskOutcome({ second: pairedTarget.second, deaths: start.deaths },
          { second: matchTimeRef.current, deaths: actor.deaths }, (pairedEvent.taskEvents ?? []) as TaskEvent[]);
        if (pairedEvent.taskOutcome && pairedEvent.teamStart)
          pairedEvent.teamOutcome = summarizeTeamTaskOutcome(pairedEvent.teamStart as TeamTaskSnapshot,
            teamTaskSnapshot(actor.team), pairedEvent.taskOutcome as NonNullable<ReturnType<typeof summarizeTaskOutcome>>);
      }
    }
    if (pairedMacroModeRef.current === 'scout' && matchTimeRef.current >= pairedScoutAfterRef.current
      && !(window as Window & { __esportsPairedMacro?: unknown }).__esportsPairedMacro)
      pairedCheckpointRef.current = capturePairedCheckpoint();
    if (macroExperimentEnabledRef.current
      && aiDecisionRecordsRef.current.some(record => record.experiment && !record.outcome)) {
      for (const unit of championsRef.current) settleExperimentOutcome(aiDecisionRecordsRef.current, {
        second: matchTimeRef.current, actorId: unit.id, team: unit.team, candidates: [],
        snapshot: { healthFraction: unit.hp / unit.maxHp, gold: unit.gold, cs: unit.cs,
          kills: unit.kills, deaths: unit.deaths, damageDealt: unit.damageDealt },
      });
    }
    const pinnedPairRecord = pairedEvent?.assignmentRecord as AIDecisionRecord | undefined;
    if (pairedMacroModeRef.current === 'replay' && pairedEvent?.matched && pinnedPairRecord
      && !pinnedPairRecord.outcome) {
      const actor = championsRef.current.find(unit => unit.id === pinnedPairRecord.actorId);
      if (actor) settleExperimentOutcome([pinnedPairRecord], { second: matchTimeRef.current,
        actorId: actor.id, team: actor.team, candidates: [], snapshot: {
          healthFraction: actor.hp / actor.maxHp, gold: actor.gold, cs: actor.cs,
          kills: actor.kills, deaths: actor.deaths, damageDealt: actor.damageDealt } });
    }
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
    const activeEngagement = engagementTrackerRef.current;
    const engagement: EngagementObservation = matchTimeRef.current < engagementOutcomeCooldownRef.current
      ? { failedTeams: [] }
      : observeEngagementOutcome(champs, matchTimeRef.current, activeEngagement, nextEngagementIdRef.current);
    if (engagement.next && !activeEngagement) nextEngagementIdRef.current++;
    engagementTrackerRef.current = engagement.next;
    if (engagement.endedByDeath) engagementOutcomeCooldownRef.current = matchTimeRef.current + 8;
    if (activeEngagement && !engagement.next && engagement.failedTeams.length > 0) {
      engagement.failedTeams.forEach(team => {
        const eventId = `failed-engagement:${activeEngagement.id}:${team}`;
        recordTeamPsychologyEvent(team, eventId, 'failed_engagement');
        champs.filter(unit => unit.team === team && unit.isAlive).forEach(unit => {
          const psychology = ensurePsychology(unit.player, unit.psychology);
          const retreat = personalityDecisionBreakdown(unit.player, psychology, 'retreat');
          unit.decisionTelemetry = {
            action: 'retreat', baseline: 0, baselineReason: 'observed failed group engagement',
            personalityDelta: retreat.personalityDelta, moodDelta: retreat.moodDelta,
            coordinationDelta: retreat.coordinationDelta,
            safetyGate: 'the existing retreat policy remains authoritative',
            explanation: `failed engagement:${activeEngagement.id}; observed group withdrawal after damage`,
            at: matchTimeRef.current,
          };
        });
      });
    }
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
        camp.type === 'siege_golem' ? 82 : 72, leashRadius,
        destination => rockApproachWaypoint(camp, destination, camp.type === 'siege_golem' ? 32 : 23));
      camp.x = movement.x;
      camp.y = movement.y;
      camp.facingX = faceTargetLikeAvatar(camp.facingX ?? 1,
        state.chasing && target ? target.x - camp.x : homeX - camp.x);
      if (!state.chasing || !movement.chasing) {
        camp.targetId = undefined;
        camp.claimTeam = undefined;
        camp.damageContributors = undefined;
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

      if (isInsideHealingWell(c.team, c)) {
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
      if (isInsideEnemyWellBeam(c.team, c)) {
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
            recordRescue(c, woundedAlly);
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
          recordRescue(c, endangeredAlly);
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
          const candidates = p.waveClear ? [...champs, ...minions] : champs;
          const hits = candidates.filter(c => c.isAlive && c.team !== attacker?.team
            && segmentHitsCircle({ x: p.x, y: p.y }, end, { x: c.x, y: c.y - 15 }, (p.collisionRadius ?? 17) + p.size));
          // A wave shot stops at the first enemy along this tick's segment, not roster order.
          const hit = p.waveClear ? hits.sort((a, b) => Math.hypot(a.x - p.x, a.y - 15 - p.y)
            - Math.hypot(b.x - p.x, b.y - 15 - p.y))[0] : hits[0];
          if (hit) {
            skillshotsRef.current.hit++;
            if (attacker) recordSkillshot(insightsRef.current, attacker, true, matchTimeRef.current);
            handleProjectileImpact({ ...p, targetUnitId: hit.id });
            return null;
          }
          if (travel >= dist) return null;
          return { ...p, x: end.x, y: end.y, angle: Math.atan2(dy, dx) };
        }

        if (p.creepAttackTarget) {
          const target = p.creepAttackTarget === 'minion' ? minions.find(m => m.id === p.targetUnitId)
            : p.creepAttackTarget === 'camp' ? jungleCamps.find(c => c.id === p.targetUnitId) : dragon;
          if (!target?.isAlive) return null;
          p.targetX = target.x;
          p.targetY = target.y - (p.creepAttackTarget === 'minion' ? 14 : 0);
          const next = advanceTargetedProjectile(p, { x: p.targetX, y: p.targetY }, p.speed, dt);
          if (next.arrived) {
            handleProjectileImpact({ ...p, ...next });
            return null;
          }
          return { ...p, ...next };
        }
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 18) {
          handleProjectileImpact(p);
          return null;
        }
        return { ...p, x: p.x + dx / dist * p.speed * dt,
          y: p.y + dy / dist * p.speed * dt, angle: Math.atan2(dy, dx) };
      })
      .filter((p): p is Projectile => p !== null);

    // 8. Update Spell AOEs & Continuous Mechanics (Tethers, Pulls, Traps)
    spellsRef.current = spellsRef.current
      .map((s) => {
        if (s.kaelenCast) {
          const source = champs.find(c => c.id === s.sourceUnitId);
          const spell = KAELEN_INVOKED_SPELLS.find(spell => spell.id === s.kaelenCast!.spellId);
          if (source && spell && spell.targeting !== 'ally' && spell.targeting !== 'summon') {
            const hits = advanceKaelenCast(s.kaelenCast, spell, dt, champs.filter(enemy => enemy.team !== source.team));
            Object.assign(s, kaelenCastPosition(s.kaelenCast, spell));
            const initialHits = spell.zone && s.kaelenCast.zoneStarted ? [] : hits;
            if (spell.zone && s.kaelenCast.elapsed >= spell.delay) s.kaelenCast.zoneStarted = true;
            if (initialHits.length > 0 && spell.id === 'sirocco-flare') sound.playUltimateExplosion();
            initialHits.forEach(enemy => {
              if (spell.id !== 'glacier-lock' && (spell.control === 'stun' || spell.control === 'root' || spell.control === 'knockup')) {
                applyChampionCrowdControl(source, enemy, spell.controlDuration, spell.control, spell.name);
              } else if (spell.control === 'knockback') {
                const origin = s.kaelenCast!.origin, aim = s.kaelenCast!.aim;
                const gap = Math.max(1, Math.hypot(aim.x - origin.x, aim.y - origin.y));
                const destination = { x: Math.max(40, Math.min(ARENA_WIDTH - 40, enemy.x + (aim.x - origin.x) / gap * 54)),
                  y: Math.max(80, Math.min(620, enemy.y + (aim.y - origin.y) / gap * 54)) };
                Object.assign(enemy, resolveRockTerrainMovement(enemy, destination, 13));
              }
              applyDamageToChampion(source, enemy, spell.damage, false, spell.name, 'skill1', false, spell.ratios);
              if (spell.slow) {
                enemy.kaelenSlowTimer = Math.max(enemy.kaelenSlowTimer ?? 0, spell.slow.duration);
                enemy.kaelenSlowAmount = Math.max(enemy.kaelenSlowAmount ?? 0, spell.slow.amount);
              }
              if (spell.id === 'glacier-lock') {
                enemy.kaelenFrostStacks = 0;
                enemy.kaelenFrostExpiresAt = matchTimeRef.current + (spell.debuff?.duration ?? 3.2);
                enemy.kaelenFrostSourceId = source.id;
              }
              if (spell.debuff && spell.id !== 'glacier-lock') {
                enemy.kaelenAshenStacks = Math.min(spell.debuff.maxStacks ?? 1, (enemy.kaelenAshenStacks ?? 0) + 1);
                enemy.kaelenAshenExpiresAt = matchTimeRef.current + spell.debuff.duration;
                enemy.kaelenAshenNextTickAt = matchTimeRef.current + spell.debuff.tickInterval;
                enemy.kaelenAshenSourceId = source.id;
                enemy.kaelenAshenRatios = spell.ratios;
              }
              if (enemy.id === source.kaelenComboTargetId && source.kaelenAwaitSpellId === spell.id) source.kaelenLastSpellHitAt = matchTimeRef.current;
            });
            if (spell.zone && isKaelenZoneActive(s.kaelenCast, spell) && (s.kaelenCast.nextTickAt ?? 0) <= s.kaelenCast.elapsed) {
              s.kaelenCast.nextTickAt = s.kaelenCast.elapsed + spell.zone.tickInterval;
              const position = kaelenCastPosition(s.kaelenCast, spell);
              champs.filter(enemy => enemy.team !== source.team && enemy.isAlive && !enemy.zhonyaActive
                && Math.hypot(enemy.x - position.x, enemy.y - position.y) <= spell.radius).forEach(enemy => {
                applyDamageToChampion(source, enemy, spell.zone!.tickDamage, false, `${spell.name} zone`, 'skill1', false, spell.ratios);
                if (spell.slow) { enemy.kaelenSlowTimer = Math.max(enemy.kaelenSlowTimer ?? 0, spell.slow.duration); enemy.kaelenSlowAmount = Math.max(enemy.kaelenSlowAmount ?? 0, spell.slow.amount); }
              });
            }
          }
        }
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
        if (s.type === 'lambs_respite' && s.duration > 0 && s.duration - dt <= 0) {
          const source = champs.find(champion => champion.id === s.sourceUnitId);
          if (source) {
            const heal = getLambsRespiteExpiryHeal(abilityDamageMultiplier(source.level, 'ultimate'));
            champs.filter(ally => ally.isAlive && ally.team === source.team
              && Math.hypot(ally.x - s.x, ally.y - s.y) <= s.radius)
              .forEach(ally => {
                ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                floatsRef.current.push({ id: random().toString(), x: ally.x, y: ally.y - 34,
                  text: `+${Math.round(heal)} SANCTUARY`, color: '#fde047', opacity: 1, scale: 1.05 });
              });
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

      if (m.summonedBearOwnerId || m.prismWardenOwnerId) {
        const isWarden = !!m.prismWardenOwnerId;
        const owner = champs.find(c => c.id === (m.summonedBearOwnerId ?? m.prismWardenOwnerId) && c.isAlive);
        if (!owner || (isWarden && (m.prismWardenExpiresAt ?? 0) <= matchTimeRef.current)) { m.isAlive = false; return; }

        const nearby = (unit: { x: number; y: number }, range: number) =>
          Math.hypot(unit.x - m.x, unit.y - m.y) <= range;
        const hostileChamps = champs.filter(c => c.team !== m.team && c.isAlive && nearby(c, 280));
        const focus = hostileChamps.find(c => c.id === (m.summonedBearFocusId ?? m.prismWardenFocusId));
        const championTarget = focus ?? hostileChamps.sort((a, b) =>
          Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
        const enemyMinion = minions.find(e => e.team !== m.team && e.isAlive && nearby(e, isWarden ? 220 : 160));
        // Prism Warden is intentionally barred from structure targeting; it is area pressure, not siege damage.
        const enemyStructure = isWarden ? undefined : structures.find(s => s.team !== m.team && s.isAlive && nearby(s, 140)
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
          m.attackTimer = isWarden ? 1.2 : 1.15;
          if ('player' in target) {
            applyDamageToChampion(owner, target, m.ad, false, isWarden ? 'Prism Warden Bolt' : 'Spirit Bear Claws');
            if (isWarden) { target.kaelenSlowTimer = Math.max(target.kaelenSlowTimer ?? 0, .65); target.kaelenSlowAmount = Math.max(target.kaelenSlowAmount ?? 0, .12); }
          }
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

    const upcomingTempoObjective = [
      ...(!dragon.isAlive && dragon.spawnTimer > 0
        ? [{ key: `dragon:${dragon.slainCount}`, type: 'dragon' as const, secondsUntil: dragon.spawnTimer }]
        : []),
      ...(!golemAwakenedRef.current && matchTimeRef.current < GOLEM_SPAWN_SECOND
        ? [{ key: 'golem:initial', type: 'golem' as const,
          secondsUntil: GOLEM_SPAWN_SECOND - matchTimeRef.current }]
        : [])
    ].sort((a, b) => a.secondsUntil - b.secondsUntil)[0];

    // 12. Champions Micro & Macro Intelligence
    champs.forEach((u, uIdx) => {
      let auditedMacro: { selected: string; x: number; y: number;
        pushPlan?: { kind: string; target: { id: string; x: number; y: number } } } | undefined;
      try {
      if (!u.isAlive) {
        u.kaelenComboId = undefined;
        u.kaelenPlanSpells = undefined;
        u.kaelenPlanExpiresAt = undefined;
        u.kaelenTacticalGoal = undefined;
        u.kaelenAwaitSpellId = undefined;
        u.kaelenLastSpellHitAt = undefined;
        u.recallIntent = false;
        u.farmTargetId = undefined;
        u.baseDefenseTargetId = undefined;
        u.actionIntent = undefined;
        u.actionFailures = undefined;
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
          u.actionIntent = undefined;
          u.actionFailures = undefined;
          evaluateAndBuyItems(u);
          addEvent(`💧 ${u.player.name} respawned in home fountain!`, 'fountain');
        }
        return;
      }

      // Check Active Recalling Channel (2.5s channel to teleport to base well)
      if (u.isRecalling && u.hp / u.maxHp >= 0.6 && u.mana / maxMana(u) >= 0.25) {
        const nearbyDefense = chooseBaseDefense(u, structures,
          champs.filter(enemy => enemy.team !== u.team && isUnitVisibleTo(enemy, u)),
          minions, u.baseDefenseTargetId);
        const defenseSpeed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u);
        // Do not cancel a nearly finished recall when it is the quicker way home.
        if (nearbyDefense && shouldInterruptRecallForDefense(nearbyDefense, {
          position: u, rally: nearbyDefense.rally, well: { x: WELL_X[u.team], y: LANE_Y },
          movementSpeed: defenseSpeed, channelRemaining: u.recallTimer ?? 2.5,
          healthy: u.hp / u.maxHp >= 0.6 && u.mana / maxMana(u) >= 0.25,
        })) {
          u.isRecalling = false;
          u.recallTimer = 0;
          u.recallIntent = false;
        }
      }
      if (u.isRecalling) {
        u.actionIntent = undefined;
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
          u.cd1 <= 0 && u.mana >= skill1ManaCost(u) ? getSkillCastRange(u.champion.name, 'skill1', getChampionBasicAttackRange(u.champion)) : 0,
          u.cd2 <= 0 && u.mana >= 35 ? getSkillCastRange(u.champion.name, 'skill2', getChampionBasicAttackRange(u.champion)) : 0,
        );
        if (shouldFollowUpControl({
          healthFraction: u.hp / u.maxHp, caughtEnemies: caught.length,
          freeThreats: champs.filter(enemy => enemy.isAlive && enemy.team !== u.team
            && Math.hypot(enemy.x - u.x, enemy.y - u.y) < 350
            && !caught.some(trapped => trapped.id === enemy.id)).length,
          nearbyAllies: champs.filter(ally => ally.isAlive && ally.team === u.team
            && ally.id !== u.id && Math.hypot(ally.x - u.x, ally.y - u.y) < 400).length,
          distanceToCatch: firstCaught ? Math.hypot(firstCaught.x - u.x, firstCaught.y - u.y) : Infinity,
          attackRange: getChampionBasicAttackRange(u.champion), readyCastRange: castReach,
          controlSeconds: firstCaught ? Math.max(0, ...channelers.filter(ally => isEnemyCaughtInAlliedChannel(firstCaught, [ally]))
            .map(ally => ally.blackHole?.remaining ?? ally.corsaraBarrage?.remaining ?? ally.monkeySpin?.remaining ?? 0)) : 0,
          moveSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0),
          iq: u.player.stats.iq, teamfight: u.player.stats.tf, losingFight: true,
          underEnemyTower: !!activeEnemyTower,
          takingTowerFire: structures.some(st => st.isAlive && st.team !== u.team
            && (st.targetId === u.id || st.diveAggressorId === u.id)),
        })) {
          u.isRecalling = false;
          u.recallTimer = 0;
          u.recallIntent = false;
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
          u.recallIntent = false;
          u.farmTargetId = undefined;
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
      u.psychology = decayMood(ensurePsychology(u.player, u.psychology), personalityOf(u.player), dt);
      if (u.cd1 > 0) u.cd1 = Math.max(0, u.cd1 - dt);
      if (u.cd2 > 0) u.cd2 = Math.max(0, u.cd2 - dt);
      if (u.cdUlt > 0 && (u.level >= 6 || u.champion.name === 'Kaelen')) u.cdUlt = Math.max(0, u.cdUlt - dt);
      if (u.champion.name === 'Kaelen') {
        u.hp = Math.min(u.maxHp, u.hp + getKaelenOrbBonuses(u).healthRegen * dt);
      }
      if ((u.kaelenSlowTimer ?? 0) > 0) {
        u.kaelenSlowTimer = Math.max(0, u.kaelenSlowTimer! - dt);
        if (u.kaelenSlowTimer === 0) u.kaelenSlowAmount = 0;
      }
      if ((u.kaelenEquinoxTimer ?? 0) > 0) {
        u.kaelenEquinoxTimer = Math.max(0, u.kaelenEquinoxTimer! - dt);
        if (u.kaelenEquinoxTimer === 0) {
          u.shield = Math.max(0, u.shield - (u.kaelenEquinoxShield ?? 0));
          u.kaelenEquinoxShield = 0; u.kaelenEquinoxMoveSpeed = 0;
        }
      }
      if ((u.kaelenFrostExpiresAt ?? 0) <= matchTimeRef.current) {
        u.kaelenFrostStacks = 0; u.kaelenFrostSourceId = undefined;
      }
      if ((u.kaelenAshenExpiresAt ?? 0) > matchTimeRef.current && (u.kaelenAshenNextTickAt ?? Infinity) <= matchTimeRef.current) {
        const source = champs.find(c => c.id === u.kaelenAshenSourceId && c.isAlive) ?? null;
        applyDamageToChampion(source, u, 24 * Math.max(1, u.kaelenAshenStacks ?? 1), false, 'Ashen Hail burn', 'skill1', false, u.kaelenAshenRatios);
        u.kaelenAshenNextTickAt = matchTimeRef.current + .55;
      } else if ((u.kaelenAshenExpiresAt ?? 0) <= matchTimeRef.current) {
        u.kaelenAshenStacks = 0; u.kaelenAshenSourceId = undefined; u.kaelenAshenRatios = undefined;
      }
      if (u.kaelenInvokeCooldown && u.kaelenInvokeCooldown > 0) {
        u.kaelenInvokeCooldown = Math.max(0, u.kaelenInvokeCooldown - dt);
      }
      u.kaelenActionTimer = Math.max(0, (u.kaelenActionTimer ?? 0) - dt);
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
      if (u.kindraHuntTimer && u.kindraHuntTimer > 0) {
        u.kindraHuntTimer = Math.max(0, u.kindraHuntTimer - dt);
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
      if (u.allInCommitTimer && u.allInCommitTimer > 0) {
        u.allInCommitTimer = Math.max(0, u.allInCommitTimer - dt);
      }
      if (u.censerBuffTimer && u.censerBuffTimer > 0) {
        u.censerBuffTimer = Math.max(0, u.censerBuffTimer - dt);
      }
      if (u.propellaRotorTimer && u.propellaRotorTimer > 0) {
        u.propellaRotorTimer = Math.max(0, u.propellaRotorTimer - dt);
        if (u.propellaRotorTimer === 0) u.propellaRotorStacks = 0;
      }
      if (u.propellaOverdriveTimer && u.propellaOverdriveTimer > 0) {
        u.propellaOverdriveTimer = Math.max(0, u.propellaOverdriveTimer - dt);
      }
      if (u.propellaGunshipTimer && u.propellaGunshipTimer > 0) {
        u.propellaGunshipTimer = Math.max(0, u.propellaGunshipTimer - dt);
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
      const hardCrowdControl = u.stunTimer > 0 || (u.knockupTimer ?? 0) > 0
        || u.charmTimer > 0 || (u.fearTimer ?? 0) > 0;
      if (u.dash && hardCrowdControl) {
        const dash = u.dash;
        recordAbilityMovement(insightsRef.current, u, {
          second: matchTimeRef.current, kind: dash.kind, startX: dash.startX ?? u.x, startY: dash.startY ?? u.y,
          targetX: dash.targetX, targetY: dash.targetY, endX: u.x, endY: u.y,
          targetId: dash.targetId, result: 'interrupted', interruptionReason: 'hard_cc',
        });
        u.dash = undefined;
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
        const rawDestination = distance > 0
          ? { x: u.x + dx / distance * step, y: u.y + dy / distance * step }
          : { x: u.x, y: u.y };
        if (isInsideRockTerrain(rawDestination.x, rawDestination.y, 13)) {
          const terrainSafePosition = resolveRockTerrainMovement({ x: u.x, y: u.y }, rawDestination, 13);
          u.x = terrainSafePosition.x;
          u.y = terrainSafePosition.y;
          recordAbilityMovement(insightsRef.current, u, {
            second: matchTimeRef.current, kind: dash.kind, startX: dash.startX ?? u.x, startY: dash.startY ?? u.y,
            targetX: dash.targetX, targetY: dash.targetY, endX: u.x, endY: u.y,
            targetId: dash.targetId, result: 'terrain', interruptionReason: 'terrain',
          });
          u.dash = undefined;
          return;
        }
        if (distance > 0) { u.x = rawDestination.x; u.y = rawDestination.y; u.facing = dx >= 0 ? 'right' : 'left'; }
        dash.remaining -= dt;
        u.animState = 'walk';
        const hit = champs.find(e => e.team !== u.team && e.isAlive && Math.hypot(e.x - u.x, e.y - u.y) < (dash.kind === 'kaolin_roll' ? 35 : 28));
        const resolveTargetDashImpact = (victim: AramChampionUnit) => {
          if (dash.kind === 'valerie_punch') {
            applyChampionCrowdControl(u, victim, 0.9, 'knockup', 'Vault Breaker Punch');
            applyDamageToChampion(u, victim, dash.damage ?? u.champion.skill1.damage, false, 'Vault Breaker Punch', 'skill1');
            emitSkillEffect(u, victim, false, 'Vault Breaker Punch', 'skill1');
          } else if (dash.kind === 'jaxon_leap') {
            applyChampionCrowdControl(u, victim, 0.7, 'root', 'Thundering Leap');
            applyDamageToChampion(u, victim, dash.damage ?? u.champion.skill2.damage, false, 'Thundering Leap', 'skill2');
            emitSkillEffect(u, victim, false, 'Thundering Leap', 'skill2');
          } else if (dash.kind === 'brewmaw_rush') {
            applyChampionCrowdControl(u, victim, 0.8, 'knockup', 'Barrel Rush');
            applyDamageToChampion(u, victim, dash.damage ?? u.champion.skill2.damage, false, 'Barrel Rush', 'skill2');
            u.hp = Math.min(u.maxHp, u.hp + 90 * abilityDamageMultiplier(u.level, 'skill2'));
            emitSkillEffect(u, victim, false, 'Barrel Rush', 'skill2');
          }
        };
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
        if (hit && (dash.kind === 'renn_vault' || dash.kind === 'kaolin_roll' || dash.kind === 'cinder_lunge' || dash.kind === 'canopy_bound' || dash.kind === 'solana_lance' || dash.kind === 'veyara_dash' || dash.kind === 'valerie_punch' || dash.kind === 'jaxon_leap' || dash.kind === 'brewmaw_rush')) {
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
          } else if (dash.kind === 'solana_lance') {
            applyChampionCrowdControl(u, hit, 1.1, 'stun', 'Zenith Lance');
            applyDamageToChampion(u, hit, dash.damage ?? u.champion.skill2.damage, false, 'Zenith Lance', 'skill2');
            emitSkillEffect(u, hit, false, 'Zenith Lance', 'skill2');
          } else if (dash.kind === 'veyara_dash') {
            applyDamageToChampion(u, hit, dash.damage ?? u.champion.skill2.damage, false, 'Facet Dash', 'skill2');
            emitSkillEffect(u, hit, false, 'Facet Dash', 'skill2');
          } else {
            resolveTargetDashImpact(hit);
          }
          recordAbilityMovement(insightsRef.current, u, {
            second: matchTimeRef.current, kind: dash.kind, startX: dash.startX ?? u.x, startY: dash.startY ?? u.y,
            targetX: dash.targetX, targetY: dash.targetY, endX: u.x, endY: u.y,
            targetId: dash.targetId, result: 'collision',
          });
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
          const endpointTarget = dash.targetId ? champs.find(enemy => enemy.id === dash.targetId && enemy.isAlive) : undefined;
          if (endpointTarget && dash.kind === 'solana_lance') {
            applyChampionCrowdControl(u, endpointTarget, 1.1, 'stun', 'Zenith Lance');
            applyDamageToChampion(u, endpointTarget, dash.damage ?? u.champion.skill2.damage, false, 'Zenith Lance', 'skill2');
            emitSkillEffect(u, endpointTarget, false, 'Zenith Lance', 'skill2');
          } else if (endpointTarget && dash.kind === 'veyara_dash') {
            applyDamageToChampion(u, endpointTarget, dash.damage ?? u.champion.skill2.damage, false, 'Facet Dash', 'skill2');
            emitSkillEffect(u, endpointTarget, false, 'Facet Dash', 'skill2');
          } else if (endpointTarget && (dash.kind === 'valerie_punch' || dash.kind === 'jaxon_leap' || dash.kind === 'brewmaw_rush')) {
            resolveTargetDashImpact(endpointTarget);
          }
          recordAbilityMovement(insightsRef.current, u, {
            second: matchTimeRef.current, kind: dash.kind, startX: dash.startX ?? u.x, startY: dash.startY ?? u.y,
            targetX: dash.targetX, targetY: dash.targetY, endX: u.x, endY: u.y,
            targetId: dash.targetId, result: 'endpoint',
          });
          u.dash = undefined;
        }
        return;
      }

      // Check bush status
      const bush = getBushAt(u.x, u.y);
      u.isInBush = !!bush;
      u.currentBushId = bush?.id;

      // Vision Master & Strategic Warding
      const isVisionMaster = personalityOf(u.player).some(id => id === 'bush_stalker' || id === 'objective_zealot');
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

      // Proactive Highground Base Scouting: Ward enemy base ramp and flanking bushes when approaching
      const enemyHighgroundBushes = u.team === 'blue'
        ? ARAM_BUSHES.filter(b => b.id === 'bush_red_high_north' || b.id === 'bush_red_high_south')
        : ARAM_BUSHES.filter(b => b.id === 'bush_blue_high_north' || b.id === 'bush_blue_high_south');
      const unwardedHighgroundBush = enemyHighgroundBushes.find(b =>
        Math.hypot(b.x - u.x, b.y - u.y) <= 300
        && !wardsRef.current.some(w => w.team === u.team && w.bushId === b.id));

      if (unwardedHighgroundBush && matchTimeRef.current >= (u.wardReadyAt ?? 0) && matchTimeRef.current > 30) {
        wardsRef.current.push({
          id: `hg_${u.id}_${matchTimeRef.current}`,
          team: u.team,
          bushId: unwardedHighgroundBush.id,
          x: unwardedHighgroundBush.x,
          y: unwardedHighgroundBush.y,
          expiresAt: matchTimeRef.current + 85
        });
        u.wardReadyAt = matchTimeRef.current + wardCooldown;
        floatsRef.current.push({
          id: random().toString(),
          x: unwardedHighgroundBush.x,
          y: unwardedHighgroundBush.y - 20,
          text: isVisionMaster ? '👁️ MASTER HIGHGROUND WARD' : '👁️ HIGHGROUND WARD',
          color: isVisionMaster ? '#10b981' : '#38bdf8',
          opacity: 1,
          scale: 1.05
        });
        addEvent(`👁️ VISION: ${u.player.name} (${u.champion.displayName}) warded the highground flank at ${unwardedHighgroundBush.name}!`, 'micro');
      }

      const highgroundRampX = NEXUS_TOWER_X[u.team === 'blue' ? 'red' : 'blue'] + (u.team === 'blue' ? -60 : 60);
      const isApproachingHighground = Math.abs(u.x - highgroundRampX) <= 240;
      const hasRampWard = wardsRef.current.some(w => w.team === u.team && Math.hypot(w.x - highgroundRampX, w.y - LANE_Y) < 220);
      if (!unwardedHighgroundBush && isApproachingHighground && !hasRampWard
        && matchTimeRef.current >= (u.wardReadyAt ?? 0) && matchTimeRef.current > 30) {
        wardsRef.current.push({
          id: `hg_ramp_${u.id}_${matchTimeRef.current}`,
          team: u.team,
          bushId: 'highground_ramp',
          x: highgroundRampX,
          y: LANE_Y,
          expiresAt: matchTimeRef.current + 85
        });
        u.wardReadyAt = matchTimeRef.current + wardCooldown;
        floatsRef.current.push({
          id: random().toString(),
          x: highgroundRampX,
          y: LANE_Y - 20,
          text: isVisionMaster ? '👁️ MASTER HIGHGROUND WARD' : '👁️ HIGHGROUND WARD',
          color: isVisionMaster ? '#10b981' : '#38bdf8',
          opacity: 1,
          scale: 1.05
        });
        addEvent(`👁️ VISION: ${u.player.name} (${u.champion.displayName}) warded the highground ramp to reveal base defenses!`, 'micro');
      }

      // Recovery to Idle
      if (u.attackTimer <= 1.0 / getEffectiveAttackSpeed(u) - 0.28) {
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
        u.actionIntent = undefined;
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
        u.actionIntent = undefined;
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
        u.actionIntent = undefined;
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

      // Healthy fountain defenders leave early if a core building is under siege.
      // Ordinary regeneration still finishes before returning to the lane.
      const wellDefense = isInsideWell ? chooseBaseDefense(u, structures,
        champs.filter(enemy => enemy.team !== u.team && isUnitVisibleTo(enemy, u)),
        minions, u.baseDefenseTargetId) : undefined;
      if (isInsideWell && (u.hp < u.maxHp * 0.95 || u.mana < 90)
        && !shouldLeaveWellToDefend(wellDefense, {
          healthFraction: u.hp / u.maxHp, manaFraction: u.mana / maxMana(u),
        })) {
        u.actionIntent = undefined;
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
      const { enemies, allies, localEnemies, localAllies, availableAllies } =
        perceiveChampions(u, champs, wardsRef.current);
      observeOpponentTacticalMemory({ memory: opponentTacticalMemoryRef.current, viewer: u.team,
        now: matchTimeRef.current, visibleOpponents: enemies,
        observedFocuses: allies.flatMap(ally => ally.lastEnemyDamage
          ? [{ attackerId: ally.lastEnemyDamage.attackerId, targetId: ally.id, second: ally.lastEnemyDamage.second }]
          : []),
      });
      const teamPsychology = deriveTeamPsychology(allies);
      const iglRelationship = teamPsychology.iglId ? u.relationships?.[teamPsychology.iglId] : undefined;
      const baseCallAlignment = u.id === teamPsychology.iglId ? 1
        : ((iglRelationship?.leadershipRespect ?? 60) + (iglRelationship?.cooperation ?? 60) + (u.psychology?.mood.trust ?? 60)) / 300;
      const callAlignment = Math.max(0, Math.min(1, baseCallAlignment + personalityCallAlignment(
        u.player, ensurePsychology(u.player, u.psychology), {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          isolatedTarget: localEnemies.length === 1 && localAllies.length <= 1,
          allyThreatened: allies.some(ally => ally.id !== u.id && ally.hp / ally.maxHp < .48
            && enemies.some(enemy => Math.hypot(enemy.x - ally.x, enemy.y - ally.y) < 170)),
        },
      )));
      // A sealed Nexus still fires. Attack legality must not hide it from threat reads.
      const enemyStructures = structures.filter((st) => st.team !== u.team && st.isAlive);
      const attackableEnemyStructures = enemyStructures.filter(st => st.type !== 'nexus' || canDamageNexus(st.team, structures));
      const enemyMinions = minions.filter((m) => m.team !== u.team && m.isAlive);
      const availableJungleCamps = jungleCamps.filter((c) => c.isAlive && c.type !== 'siege_golem');
      const spatialInfluence = createSpatialInfluence({ team: u.team, allies, enemies, structures });
      const localInfluence = spatialInfluence.at(u);

      // Resolve the previous concrete action before choosing another one. Point
      // actions retain their stored destination; entity actions follow live state.
      if (u.actionIntent) {
        const pointAction = ['regroup', 'stage', 'push', 'hold'].includes(u.actionIntent.kind);
        const trackedTarget = pointAction
          ? { x: u.actionIntent.targetX, y: u.actionIntent.targetY }
          : [...champs, ...minions, ...structures, ...jungleCamps, ...relics, dragon]
            .find(target => target.id === u.actionIntent?.targetId);
        const trackedAvailable = pointAction || !!trackedTarget
          && (!('isAlive' in trackedTarget) || trackedTarget.isAlive);
        const shouldAuditRoute = u.actionIntent.mode === 'move' && !!trackedTarget
          && matchTimeRef.current - u.actionIntent.lastProgressAt >= 0.45;
        const trackedReachable = !shouldAuditRoute
          || Number.isFinite(rockRouteDistance(u, trackedTarget!, 13));
        const progress = inspectActionProgress({
          intent: u.actionIntent,
          failures: u.actionFailures,
          actor: u,
          target: trackedTarget,
          now: matchTimeRef.current,
          emergencyInterrupt: u.committedState === 'retreat',
          available: trackedAvailable,
          safe: u.committedState !== 'retreat',
          reachable: trackedReachable,
        });
        u.actionIntent = progress.intent;
        u.actionFailures = progress.failures;
      }

      // Read the local numbers before committing to a fight.
      const fightingAlly = chooseNearbyFightingAlly(u, allies, enemies, matchTimeRef.current);
      const defenseCall = chooseBaseDefense(u, structures, enemies, minions, u.baseDefenseTargetId);
      u.baseDefenseTargetId = defenseCall?.building.id;
      if (defenseCall?.urgent) {
        const callKey = `defend:${u.team}:${defenseCall.building.id}:${Math.floor(matchTimeRef.current / 20)}`;
        if (!objectiveCallsRef.current.has(callKey)) {
          objectiveCallsRef.current.add(callKey);
          addEvent(`DEFEND: ${u.team.toUpperCase()} rally to ${defenseCall.building.name}!`, 'tower');
          floatsRef.current.push({ id: random().toString(), x: u.x, y: u.y - 35,
            text: 'DEFEND BASE!', color: '#38bdf8', opacity: 1, scale: 1.15 });
        }
      }
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
      const baseAttackRange = getChampionBasicAttackRange(u.champion);
      const attackRange = getLiveBasicAttackRange(u);
      const isRanged = attackRange >= 90;
      const kiteBackstepThreshold = attackRange * 0.65;
      const threateningMinions = enemyMinions.filter(m => Math.hypot(m.x - u.x, m.y - u.y) <= Math.max(attackRange + 40, 240));
      const liveAlliedMinionCount = minions.reduce((count, minion) =>
        count + Number(minion.team === u.team && minion.isAlive), 0);
      const actionContextFor = (kind: string, target: { x: number; y: number; isAlive?: boolean }) => [
        kind,
        target.isAlive === false ? 0 : 1,
        Math.floor(target.x / 80),
        Math.floor(target.y / 80),
        localEnemies.length,
        localAllies.length,
        enemyMinions.length,
        liveAlliedMinionCount,
        Number(u.cd1 <= 0 && u.mana >= skill1ManaCost(u)),
        Number(u.cd2 <= 0 && u.mana >= 35),
        Number(u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)),
      ].join('|');
      const setActionIntent = (kind: Parameters<typeof beginOrContinueAction>[0]['kind'],
        target: { id: string; x: number; y: number }, mode: Parameters<typeof beginOrContinueAction>[0]['mode'],
        contextKey = actionContextFor(kind, target), commitSeconds?: number) => {
        u.actionIntent = beginOrContinueAction({ intent: u.actionIntent, kind, target, actor: u,
          contextKey, mode, now: matchTimeRef.current, commitSeconds });
        const action = PERSONALITY_ACTION_FOR_INTENT[kind];
        const breakdown = personalityDecisionBreakdown(u.player, ensurePsychology(u.player, u.psychology), action, teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !losingFight,
          allyThreatened: allies.some(ally => ally.id !== u.id && ally.hp / ally.maxHp < .48
            && enemies.some(enemy => Math.hypot(enemy.x - ally.x, enemy.y - ally.y) < 170)),
          isolatedTarget: kind === 'champion' && localEnemies.length === 1,
          alliedResourcesReady: localAllies.filter(ally => ally.cd1 <= 0 || ally.cd2 <= 0 || (ally.level >= 6 && ally.cdUlt <= 0)).length >= 2,
          siegeOpportunity: kind === 'structure' || kind === 'push', isInBush: !!u.isInBush,
        });
        const baseline = ['champion', 'defend', 'objective'].includes(kind) ? localAllies.length - localEnemies.length : 0;
        const safetyGate = kind === 'hold' ? 'turret-perimeter safety hold'
          : losingFight ? 'retreat risk remains eligible to interrupt this intent'
          : 'existing availability, route, commitment, and safety checks passed';
        u.decisionTelemetry = {
          action, baseline, baselineReason: `${kind} candidate selected by the existing decision policy`,
          personalityDelta: breakdown.personalityDelta, moodDelta: breakdown.moodDelta,
          coordinationDelta: breakdown.coordinationDelta, combinationDelta: breakdown.combinationDelta,
          combinations: breakdown.combinations.map(combination => `${combination.label}: ${combination.reason}`),
          safetyGate, targetId: target.id, commitUntil: u.actionIntent.committedUntil,
          explanation: `${kind}:${target.id}; ${mode}; IGL alignment ${Math.round(callAlignment * 100)}%${breakdown.combinations.length ? `; ${breakdown.combinations.map(combination => combination.label).join(', ')}` : ''}`,
          at: matchTimeRef.current,
        };
      };
      const actionCandidate = <T extends { id: string; x: number; y: number; isAlive?: boolean }>(
        kind: Parameters<typeof beginOrContinueAction>[0]['kind'], target: T, safe = true,
      ) => ({ ...target, contextKey: actionContextFor(kind, target),
        available: target.isAlive !== false,
        safe: safe && (kind !== 'champion' || !isUnsafeWellChase(u,
          { ...target, team: u.team === 'blue' ? 'red' : 'blue' }, attackRange)), reachable: true });

      // Skilled shoppers recall on a safe item spike after the mid game.
      const lateShop = matchEconomyPhase(matchTimeRef.current) === 'Late game';
      const hasShopGold = u.gold >= (lateShop ? 1450 : 1700);
      const safeShopWindow = hasShopGold && (u.hp < u.maxHp * 0.65 || (u.gold >= (lateShop ? 1900 : 2400) && iq >= 70))
        && localEnemies.length === 0 && threateningMinions.length === 0 && (u.recallCooldown ?? 0) <= 0;
      const wantsItemPurchase = safeShopWindow
        && !!getItemPurchasePlan(u.champion.primaryRole, u.items, u.gold, u.champion.name, ALL_ITEMS);
      // Clutch Performer can briefly commit to a viable fight, without overriding danger exits.
      if (!losingFight && personalityOf(u.player).includes('clutch_performer') && localEnemies.length > 0
        && u.hp / u.maxHp > .28 && u.hp / u.maxHp < .42 && !u.clutchCommitActive) {
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
      const initiallyPreferredTarget = chooseTeamfightTarget(u, enemies, allies, attackRange, {
        enemyStructures,
        alliedMinions: alliedMinionsForDive,
        cooldownMemory: cooldownMemoryRef.current,
        matchSecond: matchTimeRef.current
      });
      const initialTargetCandidate = chooseCommittedActionTarget({
        intent: u.actionIntent,
        kind: 'champion',
        preferred: initiallyPreferredTarget ? actionCandidate('champion', initiallyPreferredTarget) : undefined,
        candidates: enemies.map(enemy => actionCandidate('champion', enemy)),
        failures: u.actionFailures,
        now: matchTimeRef.current,
      });
      const initialPrimaryTarget = initialTargetCandidate
        ? enemies.find(enemy => enemy.id === initialTargetCandidate.id) : undefined;
      if (initialPrimaryTarget) {
        const psychology = ensurePsychology(u.player, u.psychology);
        const engage = personalityDecisionBreakdown(u.player, psychology, 'engage', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !losingFight, isolatedTarget: localEnemies.length === 1,
          isInBush: !!u.isInBush,
        });
        u.decisionTelemetry = {
          action: 'engage', baseline: localAllies.length - localEnemies.length,
          baselineReason: 'existing target policy selected a visible legal opponent',
          personalityDelta: engage.personalityDelta, moodDelta: engage.moodDelta,
          coordinationDelta: engage.coordinationDelta, combinationDelta: engage.combinationDelta,
          combinations: engage.combinations.map(combination => `${combination.label}: ${combination.reason}`),
          safetyGate: 'target remains subject to turret risk and retreat evaluation',
          targetId: initialPrimaryTarget.id,
          explanation: `target:${initialPrimaryTarget.id}; ${u.player.personality} preference applied after baseline evaluation`,
          at: matchTimeRef.current,
        };
      }

      // Tower risk is evaluated before a commitment, but never installs a
      // separate abort state or forced evacuation controller.
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

      // Nexus finishing is a legal structure-siege decision. It is evaluated
      // alongside, rather than being interrupted by, normal tower risk.
      const nexusFinishTarget = structures.find(structure => structure.team !== u.team && structure.type === 'nexus');
      const nexusFinish = evaluateNexusFinish({
        nexus: nexusFinishTarget ? { ...nexusFinishTarget,
          volleyActive: [...allies, ...minions.filter(minion => minion.team === u.team)]
            .some(ally => ally.isAlive && Math.hypot(ally.x - nexusFinishTarget.x, ally.y - nexusFinishTarget.y)
              <= nexusFinishTarget.range) } : undefined,
        exposed: !!nexusFinishTarget && canDamageNexus(nexusFinishTarget.team, structures),
        attackers: allies.map(ally => {
          const allyRange = getLiveBasicAttackRange(ally);
          return {
            id: ally.id,
            isAlive: ally.isAlive && !ally.isRecalling && ally.stunTimer <= 0,
            hp: ally.hp,
            maxHp: ally.maxHp,
            distance: nexusFinishTarget ? Math.hypot(ally.x - nexusFinishTarget.x, ally.y - nexusFinishTarget.y) : Infinity,
            attackRange: allyRange,
            structureAttackDamage: Math.round(structureBasicAttackDamage({ baseAttackDamage: ally.champion.ad,
              persistentAttackBonus: aegisBuffRef.current?.team === ally.team ? aegisBuffRef.current.adBonus : 0 })
              * getMinionCrashMultiplier(minions.filter(minion => minion.team === ally.team && minion.isAlive
                && !!nexusFinishTarget && Math.abs(minion.x - nexusFinishTarget.x) <= 240))
              * (aegisBuffRef.current?.team === ally.team ? aegisBuffRef.current.siegeMultiplier : 1)
              * (ally.champion.primaryRole === 'Marksman' ? 1.25 : 1)),
            attacksPerSecond: getEffectiveAttackSpeed(ally),
            approachSpeed: 85 + (ally.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(ally),
            attackReadyIn: ally.attackTimer,
            incomingDamage: projectilesRef.current.filter(projectile => projectile.targetUnitId === ally.id
              && projectile.attackerId === nexusFinishTarget?.id).reduce((sum, projectile) => sum + projectile.damage, 0),
            approachSafe: !!nexusFinishTarget && isTeamfightApproachSafe(ally, nexusFinishTarget,
              enemyStructures.filter(structure => structure.id !== nexusFinishTarget.id)),
          };
        }),
        actorId: u.id,
        nearbyDefenders: nexusFinishTarget
          ? enemies.filter(enemy => Math.hypot(enemy.x - nexusFinishTarget.x, enemy.y - nexusFinishTarget.y) <= 330).length
          : 0,
        actorTakingNexusFire: !!nexusFinishTarget && nearestStructureForDive?.id === nexusFinishTarget.id && isTakingTurretFire,
      });
      const nexusFinishCommit = !defenseCall && nexusFinish.feasible && !!nexusFinishTarget;
      if (nexusFinishCommit && (u.nexusFinishTargetId !== nexusFinishTarget!.id
        || u.nexusFinishContextKey !== nexusFinish.contextKey)) {
        u.nexusFinishTargetId = nexusFinishTarget!.id;
        u.nexusFinishContextKey = nexusFinish.contextKey;
        u.nexusFinishBlockedKey = undefined;
        addEvent(`NEXUS_FINISH_EVALUATED: ${u.team} ${nexusFinish.availableAttackers} attackers, ${nexusFinish.estimatedFinishSeconds.toFixed(1)}s finish, ${Number.isFinite(nexusFinish.estimatedSurvivalSeconds) ? nexusFinish.estimatedSurvivalSeconds.toFixed(1) : 'safe'}s survival.`, 'tower');
        addEvent(`NEXUS_FINISH_COMMITTED: ${u.player.name} advances on ${nexusFinishTarget!.name}.`, 'tower');
      } else if (!nexusFinishCommit && u.nexusFinishTargetId) {
        addEvent(`NEXUS_FINISH_CANCELLED: ${u.player.name} — ${nexusFinish.reason}.`, 'tower');
        u.nexusFinishTargetId = undefined;
        u.nexusFinishContextKey = undefined;
      } else if (!nexusFinishCommit && nexusFinishTarget
        && nexusFinishTarget.hp / nexusFinishTarget.maxHp <= .40
        && u.nexusFinishBlockedKey !== nexusFinish.contextKey) {
        u.nexusFinishBlockedKey = nexusFinish.contextKey;
        addEvent(`NEXUS_FINISH_BLOCKED: ${u.player.name} — ${nexusFinish.reason}.`, 'tower');
      }

      const towerDiveRisk = nearestStructureForDive && initialPrimaryTarget
        ? assessTowerDiveRisk({ diver: u, target: initialPrimaryTarget, tower: nearestStructureForDive,
          alliedMinionsUnderTower, defendersUnderTower, attackersUnderTower, takingTurretFire: isTakingTurretFire })
        : { shouldCommit: false, risk: Infinity, expectedEliminationSeconds: Infinity,
          expectedSurvivalSeconds: 0, reason: 'no structure engagement' };
      const isAggroDiving = !losingFight && towerDiveRisk.shouldCommit;
      if (initialPrimaryTarget && nearestStructureForDive && isInsideEnemyTowerRange && u.decisionTelemetry) {
        u.decisionTelemetry = {
          ...u.decisionTelemetry,
          safetyGate: `tower risk ${Number.isFinite(towerDiveRisk.risk) ? towerDiveRisk.risk.toFixed(2) : 'n/a'}; ${towerDiveRisk.reason}`,
          explanation: `${u.decisionTelemetry.explanation}; elimination ${towerDiveRisk.expectedEliminationSeconds.toFixed(1)}s / survival ${towerDiveRisk.expectedSurvivalSeconds.toFixed(1)}s`,
        };
      }

      const isClutchRefusingRetreat = !losingFight && !isTakingTurretFire && u.clutchCommitActive && localEnemies.length > 0;
      const canPunishSpentSkill = !losingFight && !isTakingTurretFire && personalityOf(u.player).includes('counterpuncher') && u.isInBush
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
        u.cd1 <= 0 && u.mana >= skill1ManaCost(u) ? getSkillCastRange(u.champion.name, 'skill1', baseAttackRange) : 0,
        u.cd2 <= 0 && u.mana >= 35 ? getSkillCastRange(u.champion.name, 'skill2', baseAttackRange) : 0,
        u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)
          ? getSkillCastRange(u.champion.name, 'ultimate', baseAttackRange) : 0,
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
      });

      const allInTargetUnderTower = !!initialPrimaryTarget && enemyStructures.some(st =>
        (st.type.includes('tower') || st.type === 'nexus')
        && Math.hypot(st.x - initialPrimaryTarget.x, st.y - initialPrimaryTarget.y) <= st.range + 28);
      const groupedAllInAllies = initialPrimaryTarget ? allies.filter(ally => ally.isAlive
        && !ally.isRecalling && !ally.recallIntent && ally.committedState !== 'retreat'
        && Math.hypot(ally.x - initialPrimaryTarget.x, ally.y - initialPrimaryTarget.y) <= 420) : [];
      const groupedAllInEnemies = initialPrimaryTarget ? enemies.filter(enemy => enemy.isAlive
        && isUnitVisibleTo(enemy, u)
        && Math.hypot(enemy.x - initialPrimaryTarget.x, enemy.y - initialPrimaryTarget.y) <= 380) : [];
      const readyAllInContributors = groupedAllInAllies.filter(ally =>
        (ally.cd1 <= 0 && ally.mana >= skill1ManaCost(ally))
        || (ally.cd2 <= 0 && ally.mana >= 35)
        || (ally.level >= 6 && ally.cdUlt <= 0 && ally.mana >= ultimateManaCost(ally))).length;
      const personalityTraits = personalityOf(u.player);
      const safeIsolatedTarget = !!initialPrimaryTarget && localEnemies.length === 1 && localAllies.length >= localEnemies.length
        && !allInTargetUnderTower && isTeamfightApproachSafe(u, initialPrimaryTarget, enemyStructures);
      const firstBloodWindow = matchTimeRef.current <= 180 && personalityTraits.includes('first_blood_hunter')
        && safeIsolatedTarget && u.hp / u.maxHp >= .62 && initialPrimaryTarget!.hp / initialPrimaryTarget!.maxHp <= .7;
      const bushPickWindow = personalityTraits.includes('bush_stalker') && !!u.isInBush && safeIsolatedTarget;
      const perfectionistWaits = personalityTraits.includes('perfectionist') && (u.allInCommitTimer ?? 0) <= 0
        && readyAllInContributors < Math.min(3, Math.max(2, groupedAllInAllies.length));
      const averageHealth = (units: AramChampionUnit[]) => units.length
        ? units.reduce((sum, unit) => sum + unit.hp / Math.max(1, unit.maxHp), 0) / units.length : 0;
      const proactiveAllIn = !!initialPrimaryTarget && !isInsideWell && !perfectionistWaits && shouldStartProactiveAllIn({
        healthFraction: u.hp / u.maxHp,
        alliedAverageHealth: averageHealth(groupedAllInAllies),
        enemyAverageHealth: averageHealth(groupedAllInEnemies),
        groupedAllies: groupedAllInAllies.length,
        groupedEnemies: groupedAllInEnemies.length,
        readyContributors: readyAllInContributors,
        targetDistance: Math.hypot(initialPrimaryTarget.x - u.x, initialPrimaryTarget.y - u.y),
        approachSafe: isTeamfightApproachSafe(u, initialPrimaryTarget, enemyStructures) || towerDiveRisk.shouldCommit,
        targetUnderEnemyTower: allInTargetUnderTower,
        towerRiskAcceptable: towerDiveRisk.shouldCommit,
        takingTowerFire: isTakingTurretFire,
        losingFight,
        iq,
        teamfight: tfStat,
      });
      if (proactiveAllIn) u.allInCommitTimer = Math.max(u.allInCommitTimer ?? 0, 12);
      const activeAllInCommit = proactiveAllIn || !!initialPrimaryTarget
        && (u.allInCommitTimer ?? 0) > 0
        && u.hp / u.maxHp >= 0.25
        && Math.hypot(initialPrimaryTarget.x - u.x, initialPrimaryTarget.y - u.y) <= 500
        && !isTakingTurretFire && !allInTargetUnderTower
        && isTeamfightApproachSafe(u, initialPrimaryTarget, enemyStructures);
      if (!activeAllInCommit) u.allInCommitTimer = 0;
      const allInFocusPool = activeAllInCommit ? enemies.filter(enemy => isUnitVisibleTo(enemy, u)
        && Math.hypot(enemy.x - u.x, enemy.y - u.y) <= 500
        && isTeamfightApproachSafe(u, enemy, enemyStructures)
        && !enemyStructures.some(st => (st.type.includes('tower') || st.type === 'nexus')
          && Math.hypot(st.x - enemy.x, st.y - enemy.y) <= st.range + 28)) : [];
      const proactiveFocusTarget = allInFocusPool
        .sort((a, b) => (a.hp + a.shield) - (b.hp + b.shield)
          || a.hp / a.maxHp - b.hp / b.maxHp || a.id.localeCompare(b.id))[0];
      const coordinatedEngage = canFollowUpEngage || activeAllInCommit;

      const personalityCautiousRetreat = !coordinatedEngage && !isClutchRefusingRetreat && !isAggroDiving
        && personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'retreat', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !isTakingTurretFire,
        }) >= 4.5 && isOutnumbered && u.hp / u.maxHp < .58;
      const lethalBaseEnvironment = isInsideEnemyWellBeam(u.team, u)
        || (!nexusFinishCommit && !!nexusFinishTarget
          && Math.hypot(u.x - nexusFinishTarget.x, u.y - nexusFinishTarget.y) <= nexusFinishTarget.range
          && nexusFinish.estimatedSurvivalSeconds < 1);
      const rawDangerousFight = lethalBaseEnvironment || (!nexusFinishCommit && personalityCautiousRetreat) || (!nexusFinishCommit && !coordinatedEngage && (losingFight || (!canPunishSpentSkill && !isClutchRefusingRetreat && !isAggroDiving && (isLowHpScared || (isOutnumbered && u.hp < u.maxHp * (0.4 + iq * 0.002))))));

      const commitment = resolveFightCommitment({
        committedState: nexusFinishCommit ? undefined : u.committedState, timer: nexusFinishCommit ? 0 : u.decisionCommitTimer ?? 0,
        dangerous: !!rawDangerousFight, enemyCount: localEnemies.length,
        inWell: isInsideWell, followUp: coordinatedEngage, lowHealth: isLowHpScared,
        losingFight: nexusFinishCommit ? false : losingFight,
        lethalEnvironment: lethalBaseEnvironment,
      });
      const isDangerousFight = commitment.dangerous;
      u.committedState = commitment.committedState;
      u.decisionCommitTimer = commitment.timer;
      if (activeAllInCommit) u.decisionCommitTimer = Math.max(u.decisionCommitTimer ?? 0, 1.2);

      const canReinforceFightingAlly = !!fightingAlly && tfStat >= 55
        && Math.hypot(fightingAlly.x - u.x, fightingAlly.y - u.y) > 130
        && isBushSafeFromTowers(fightingAlly, enemyStructures)
        && isTeamfightApproachSafe(u, fightingAlly, enemyStructures);
      const prioritizeFightWith = (target: AramChampionUnit | undefined, reinforceAlly = true) => !isInsideWell && shouldPrioritizeTeamfight({
        dangerousFight: !!isDangerousFight, lowHealth: isLowHpScared,
        takingTowerFire: !!isTakingTurretFire,
        targetDistance: target && isUnitVisibleTo(target, u) && !target.zhonyaActive
          && (target.untargetableTimer ?? 0) <= 0
          && isTeamfightApproachSafe(u, target, enemyStructures)
          ? Math.hypot(target.x - u.x, target.y - u.y) : Infinity,
        attackRange, readyCastRange, canReinforceAlly: reinforceAlly && canReinforceFightingAlly,
      });
      const teamfightPriority = activeAllInCommit || prioritizeFightWith(initialPrimaryTarget)
        || ((firstBloodWindow || bushPickWindow) && !isDangerousFight && !!initialPrimaryTarget);
      const nearestPushDistance = enemyStructures.length
        ? Math.min(...enemyStructures.map(st => Math.hypot(st.x - u.x, st.y - u.y))) : Infinity;
      const pressWonFight = !teamfightPriority && shouldPressWonFight({
        secondsSinceTeamKill: matchTimeRef.current - lastTeamKillAtRef.current[u.team],
        aliveAllies: allies.length,
        aliveEnemies: champs.filter(champ => champ.team !== u.team && champ.isAlive).length,
        healthFraction: u.hp / u.maxHp,
        nearestStructureDistance: nearestPushDistance,
        iq, coachMacro: (u.team === 'blue' ? blueCoach : redCoach)?.playbookBonus ?? 8,
        losingFight: losingFight || isTakingTurretFire
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
        activeFight: teamfightPriority,
      });
      const personalitySiegeConversion = pressWonFight && personalityActionDelta(u.player,
        ensurePsychology(u.player, u.psychology), 'siege', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !isTakingTurretFire && !isDangerousFight,
          siegeOpportunity: true,
        }) >= 4;
      // The pair can only reinforce an already-earned, safe conversion window;
      // the existing wave, tower, and structure-vulnerability gates still choose execution.
      const tempoPush = pressWonFight || wavePushCall || personalitySiegeConversion;
      const teamHasActiveThreat = allies.some(ally => {
        const recentChampionDamage = ally.lastEnemyDamage
          && matchTimeRef.current - ally.lastEnemyDamage.second <= 3;
        const nearbyEnemy = champs.some(enemy => enemy.isAlive && enemy.team !== u.team
          && Math.hypot(enemy.x - ally.x, enemy.y - ally.y) <= 620);
        const towerAggro = structures.some(structure => structure.isAlive && structure.team !== u.team
          && (structure.targetId === ally.id || structure.diveAggressorId === ally.id));
        return !!recentChampionDamage || nearbyEnemy || towerAggro;
      });
      const objectiveResetCandidates = upcomingTempoObjective
        ? allies.filter(ally => {
          const allyInWell = ally.team === 'blue'
            ? ally.x <= WELL_X.blue + 105 && Math.abs(ally.y - LANE_Y) <= 105
            : ally.x >= WELL_X.red - 105 && Math.abs(ally.y - LANE_Y) <= 105;
          if (ally.isRecalling || allyInWell) return false;
          const allyEnemies = champs.filter(enemy => enemy.isAlive && enemy.team !== ally.team);
          const allyEnemyMinions = minions.filter(minion => minion.isAlive && minion.team !== ally.team);
          const allyEnemyStructures = structures.filter(structure => structure.isAlive && structure.team !== ally.team);
          const nearestDistance = (targets: { x: number; y: number }[]) => targets.length
            ? Math.min(...targets.map(target => Math.hypot(target.x - ally.x, target.y - ally.y)))
            : Infinity;
          const safe = canUnitRecall(
            nearestDistance(allyEnemies),
            nearestDistance(allyEnemyMinions),
            nearestDistance(allyEnemyStructures),
            ally.recallCooldown ?? 0,
            !!getBushAt(ally.x, ally.y)
          );
          const lateShop = matchEconomyPhase(matchTimeRef.current) === 'Late game';
          const hasShopGold = ally.gold >= (lateShop ? 1450 : 1700);
          const wantsShop = hasShopGold
            && (ally.hp < ally.maxHp * 0.65 || (ally.gold >= (lateShop ? 1900 : 2400) && ally.player.stats.iq >= 70))
            && !!getItemPurchasePlan(ally.champion.primaryRole, ally.items, ally.gold, ally.champion.name, ALL_ITEMS);
          const needsReset = ally.hp < ally.maxHp * 0.82
            || ally.mana < maxMana(ally) * 0.75 || wantsShop;
          return safe && needsReset;
        })
        : [];
      const existingRecallPlan = objectiveRecallPlanRef.current[u.team];
      if (teamHasActiveThreat || !upcomingTempoObjective || upcomingTempoObjective.secondsUntil < 18
        || (existingRecallPlan && existingRecallPlan !== upcomingTempoObjective.key)) {
        objectiveRecallPlanRef.current[u.team] = undefined;
      }
      if (upcomingTempoObjective && shouldCoordinateObjectiveRecall({
        secondsUntilObjective: upcomingTempoObjective.secondsUntil,
        livingAllies: allies.length,
        safeRecallers: objectiveResetCandidates.length,
        activeThreat: teamHasActiveThreat,
        activePush: tempoPush,
      })) {
        objectiveRecallPlanRef.current[u.team] = upcomingTempoObjective.key;
      }
      const wantsObjectiveRecall = !!upcomingTempoObjective
        && upcomingTempoObjective.secondsUntil >= 18
        && objectiveRecallPlanRef.current[u.team] === upcomingTempoObjective.key
        && objectiveResetCandidates.some(ally => ally.id === u.id);
      const nearbyActiveObjective = [dragon, ...jungleCamps.filter(c => c.type === 'siege_golem')]
        .some(boss => boss.isAlive && boss.hp < boss.maxHp && !!boss.claimTeam
          && Math.hypot(boss.x - u.x, boss.y - u.y) <= 620
          && hasObjectiveVision(u.team, boss, allies, enemies, wardsRef.current));
      const defendNow = shouldStandAndDefendBase(defenseCall, {
        healthFraction: u.hp / u.maxHp, losingFight, outnumbered: isOutnumbered,
        takingTurretFire: !!isTakingTurretFire,
      });
      const nearestEnemyDist = enemies.length
        ? Math.min(...enemies.map(enemy => Math.hypot(enemy.x - u.x, enemy.y - u.y))) : 999;
      const nearestMinionDist = enemyMinions.length
        ? Math.min(...enemyMinions.map(minion => Math.hypot(minion.x - u.x, minion.y - u.y))) : 999;
      const nearestStructureDist = enemyStructures.length
        ? Math.min(...enemyStructures.map(st => Math.hypot(st.x - u.x, st.y - u.y))) : 999;
      const canChannelRecall = canUnitRecall(nearestEnemyDist, nearestMinionDist,
        nearestStructureDist, u.recallCooldown ?? 0, !!u.isInBush);
      const recallToDefend = !!defenseCall && shouldRecallToDefendBase(defenseCall, {
        position: u, rally: defenseCall.rally, well: { x: WELL_X[u.team], y: LANE_Y },
        movementSpeed: 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenOrbBonuses(u).moveSpeed,
        channelSeconds: 2.5, canChannel: canChannelRecall && !isInsideWell && defendNow,
      });
      const personalityRecoveryReset = !defendNow && !isInsideWell && canChannelRecall
        && personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'retreat', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: localEnemies.length === 0 && threateningMinions.length === 0,
        }) >= 4.5 && u.hp / u.maxHp < .64;
      const wantsRecall = !nexusFinishCommit && ((!!defenseCall && !defendNow && !isInsideWell)
        || recallToDefend || (!defendNow && shouldKeepRecallPlan({
        healthFraction: u.hp / u.maxHp, manaFraction: u.mana / maxMana(u),
        manaDependent: ['Mage', 'Support'].includes(u.champion.primaryRole),
        lowHealth: isLowHpScared, dangerousFight: !!isDangerousFight,
        shopping: wantsItemPurchase, objectiveReset: wantsObjectiveRecall,
        previousIntent: !!u.recallIntent, inWell: isInsideWell,
        followUp: coordinatedEngage,
        combatCommit: !!(activeAllInCommit || canPunishSpentSkill || isClutchRefusingRetreat || isAggroDiving),
        pushWindow: tempoPush, objectiveCall: teamfightPriority || nearbyActiveObjective || !!fightingAlly || !!defenseCall,
      })) || personalityRecoveryReset);
      u.recallIntent = wantsRecall;
      if (wantsRecall || isDangerousFight || teamfightPriority || coordinatedEngage || fightingAlly || tempoPush || nearbyActiveObjective || defenseCall) {
        u.farmTargetId = undefined;
      }

      const wellTargetX = WELL_X[u.team];

      const recoveryRelic = relics.filter(relic => relic.respawnTimer <= 0
        && shouldSeekHealthRelic({
          healthFraction: u.hp / u.maxHp, missingHealth: u.maxHp - u.hp,
          healAmount: relic.healAmount, distance: Math.hypot(relic.x - u.x, relic.y - u.y),
          enemyDistanceToRelic: enemies.length ? Math.min(...enemies.map(enemy => Math.hypot(enemy.x - relic.x, enemy.y - relic.y))) : Infinity,
          enemyDistanceToUnit: localEnemies.length ? Math.min(...localEnemies.map(enemy => Math.hypot(enemy.x - u.x, enemy.y - u.y))) : Infinity,
          followUpEngage: coordinatedEngage, pushWindow: tempoPush,
          activeFight: teamfightPriority,
          underEnemyTower: isInsideEnemyTowerRange,
        })).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      const recoveryRetreatAvailable = !isInsideWell
        && ((isDangerousFight && !defendNow) || wantsRecall);
      const recoveryRelicAvailable = !!recoveryRelic && !isInsideWell && !defenseCall && !nexusFinishCommit;
      const recoveryMacroCandidates = [
        { action: 'retreat' as const, available: recoveryRetreatAvailable,
          priority: (isDangerousFight || recallToDefend) ? 'emergency' as const : 'tactical' as const,
          contextKey: `recovery:${wantsRecall ? 'recall' : 'danger'}:${Math.floor(u.hp / Math.max(1, u.maxHp) * 10)}`,
          factors: { tactical: wantsRecall ? .7 : .45, danger: isDangerousFight ? 1 : 0,
            resource: wantsRecall ? 0 : .15 },
          reason: 'existing recall and retreat safety gates passed' },
        { action: 'relic' as const, available: recoveryRelicAvailable,
          priority: 'tactical' as const,
          contextKey: `relic:${recoveryRelic?.id ?? 'none'}`,
          factors: { tactical: Math.min(1, (recoveryRelic?.healAmount ?? 0) / Math.max(1, u.maxHp - u.hp)),
            travel: recoveryRelic ? Math.min(1, Math.hypot(recoveryRelic.x - u.x, recoveryRelic.y - u.y) / 700) : 1,
            danger: isDangerousFight ? 1 : 0 },
          reason: 'existing health-relic safety gate passed' },
      ];
      const recoveryMacroDecision = chooseMacroAction({ actorAvailable: u.isAlive,
        now: matchTimeRef.current, candidates: recoveryMacroCandidates, commitment: u.macroDecision });
      const selectedRecoveryAction = recoveryMacroDecision.selected?.value;
      const selectedRecoveryCandidate = selectedRecoveryAction
        ? recoveryMacroCandidates.find(candidate => candidate.action === selectedRecoveryAction) : undefined;
      if (selectedRecoveryCandidate) u.macroDecision = {
        action: selectedRecoveryCandidate.action, contextKey: selectedRecoveryCandidate.contextKey,
        until: matchTimeRef.current + .45,
      };
      if (selectedRecoveryAction === 'relic' && recoveryRelic) {
        const distance = Math.hypot(recoveryRelic.x - u.x, recoveryRelic.y - u.y);
        if (distance > 25) {
          setActionIntent('relic', recoveryRelic, 'move');
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
      if (selectedRecoveryAction === 'retreat' && wantsRecall && !recallToDefend && !defenseCall && threateningMinions.length > 0 && localEnemies.length === 0 && !u.isInBush
        && u.hp / u.maxHp >= 0.4 && !isInsideEnemyTowerRange
        && threateningMinions.every(m => isBushSafeFromTowers(m, enemyStructures))) {
        const minionToClear = threateningMinions[0];
        setActionIntent('minion', minionToClear,
          Math.hypot(minionToClear.x - u.x, minionToClear.y - u.y) <= attackRange + 15 ? 'execute' : 'move');
        setUnitFacing(u, minionToClear.x);
        const mDist = Math.hypot(minionToClear.x - u.x, minionToClear.y - u.y);
        if (mDist <= attackRange + 15) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
            u.animState = 'attack';
            u.revealedTimer = 2.0;
            executeChampionAttack(u, minionToClear, 'minion', u.champion.ad);
          }
        } else {
          u.animState = 'walk';
          const ang = Math.atan2(minionToClear.y - u.y, minionToClear.x - u.x);
          u.vx = Math.cos(ang) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.vy = Math.sin(ang) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // 2. Disengage or use the precomputed safe recall route for distant base defenders.
      if (selectedRecoveryAction === 'retreat' && u.champion.name === 'Paxi' && isDangerousFight && localEnemies.length > 0
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
          sound.playAvatarSkill(u.champion.name, 'skill1', u.x / ARENA_WIDTH * 2 - 1);
          addEvent(`PAXI: ${u.player.name} sent an escape orb toward home!`, 'combo');
        }
      }

      if (selectedRecoveryAction === 'retreat' && Math.abs(u.x - wellTargetX) > 40 && !isInsideWell) {
        u.actionIntent = undefined;
        const retreat = personalityDecisionBreakdown(u.player, ensurePsychology(u.player, u.psychology), 'retreat', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !isInsideEnemyTowerRange,
        });
        u.decisionTelemetry = {
          action: 'retreat', baseline: localAllies.length - localEnemies.length,
          baselineReason: wantsRecall ? 'existing recall/recovery policy selected a reset' : 'existing danger policy selected withdrawal',
          personalityDelta: retreat.personalityDelta, moodDelta: retreat.moodDelta,
          coordinationDelta: retreat.coordinationDelta, combinationDelta: retreat.combinationDelta,
          combinations: retreat.combinations.map(combination => `${combination.label}: ${combination.reason}`),
          safetyGate: isInsideEnemyTowerRange ? 'ordinary retreat must first reach tower-safe ground' : 'existing retreat and recall safety checks passed',
          explanation: wantsRecall ? 'resetting only after the authored recall safety gates' : 'retreating through the normal risk-aware route',
          at: matchTimeRef.current,
        };
        // Can only channel recall if threats are cleared, distance is established, and recall is not on cooldown!
        if (wantsRecall && canChannelRecall && !isInsideEnemyTowerRange) {
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

        // Rank safe homeward ground, allied cover, teammates, fountain and bushes.
        // A bush is only one scored cover option, never the default retreat target.
        let targetX: number = wellTargetX;
        let targetY: number = LANE_Y;

        {
          const retreatInput = {
            actor: {
              id: u.id,
              team: u.team,
              x: u.x,
              y: u.y,
              healthFraction: u.hp / Math.max(1, u.maxHp),
              iq,
              teamfight: tfStat,
              hasEscapeAbility: (u.champion.name === 'Paxi' && (!!u.paxiOrb || (u.cd1 <= 0 && u.mana >= 45)))
                || (u.champion.name === 'Raijin' && u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)),
            },
            now: matchTimeRef.current,
            laneY: LANE_Y,
            well: { x: wellTargetX, y: LANE_Y },
            enemies: enemies.map(enemy => ({ id: enemy.id, team: enemy.team, x: enemy.x, y: enemy.y,
              healthFraction: enemy.hp / Math.max(1, enemy.maxHp), isAlive: enemy.isAlive })),
            allies: allies.map(ally => ({ id: ally.id, team: ally.team, x: ally.x, y: ally.y,
              healthFraction: ally.hp / Math.max(1, ally.maxHp), isAlive: ally.isAlive })),
            structures: structures.map(structure => ({ id: structure.id, team: structure.team, type: structure.type,
              x: structure.x, y: structure.y, range: structure.range, isAlive: structure.isAlive })),
            bushes: ARAM_BUSHES,
            isPassable: (point: { x: number; y: number }) => !isInsideRockTerrain(point.x, point.y, 13),
            routeLength: (from: { x: number; y: number }, to: { x: number; y: number }) => rockRouteDistance(from, to, 13),
            influenceThreat: (point: { x: number; y: number }) => spatialInfluence.at(point).threat,
          };
          const plan = shouldKeepRetreatPlan(u.retreatPlan, retreatInput)
            ? u.retreatPlan
            : chooseRetreatPlan(retreatInput);
          if (plan) {
            u.retreatPlan = plan;
            targetX = plan.x;
            targetY = plan.y;
          } else {
            // The fountain lane remains the conservative fallback if every local
            // cover candidate is unsafe or blocked.
            u.retreatPlan = undefined;
          }
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
        // Every retreat uses the same terrain-aware route; tower danger affects
        // the scored destination but never installs a dive-only movement mode.
        const retreatWaypoint = rockApproachWaypoint(u, { x: targetX, y: targetY });
        const retreatAngle = Math.atan2(retreatWaypoint.y - u.y, retreatWaypoint.x - u.x);
        const retreatSpeed = retreatSpeedBreakdown({
          bootsMoveSpeed: u.boots?.stats.moveSpeed,
          orbMoveSpeed: getKaelenOrbBonuses(u).moveSpeed,
          stealthActive: (u.stealthTimer ?? 0) > 0,
          warhornAuraActive: allies.some(a => a.isAlive && a.items.some(it => it.id === 'item_shurelyas')
            && Math.hypot(a.x - u.x, a.y - u.y) <= 240),
          emergencyTowerEvacuation: false,
        });
        const totalSpeed = Math.min(retreatSpeed.total,
          Math.hypot(retreatWaypoint.x - u.x, retreatWaypoint.y - u.y) / dt);
        u.vx = Math.cos(retreatAngle) * totalSpeed;
        u.vy = Math.sin(retreatAngle) * totalSpeed;
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setUnitFacing(u, retreatWaypoint.x);
        return;
      }

      u.retreatPlan = undefined;

      // A team earns an epic objective window by clearing lane, seeing the pit,
      // grouping healthy members and reading enemy numbers. Playback speed is irrelevant.
      const alliedWave = minions.filter(m => m.team === u.team && m.isAlive && Math.abs(m.x - DRAGON_X) < 420);
      const opposingWave = minions.filter(m => m.team !== u.team && m.isAlive && Math.abs(m.x - DRAGON_X) < 420);
      const pushedWave = alliedWave.some(m => u.team === 'blue' ? m.x > DRAGON_X + 80 : m.x < DRAGON_X - 80);
      const nearbyPitAllies = availableAllies.filter(a => Math.hypot(a.x - dragon.x, a.y - dragon.y) < 620);
      const objectivePreference = personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'objective', teamPsychology, {
        healthFraction: u.hp / u.maxHp, nearbyAllies: nearbyPitAllies.length, nearbyEnemies: localEnemies.length,
        callAlignment, isSafe: !losingFight,
      });
      const shouldContestDragon = !nexusFinishCommit && !defenseCall && !teamfightPriority && !tempoPush && !coordinatedEngage && !fightingAlly && dragon.isAlive && objectivePreference >= -2.5 && shouldStartEpicObjective({
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
      const healthyContestAllies = availableAllies.filter(a => a.hp / a.maxHp > 0.35).length;
      const dragonContestPreference = personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology),
        dragon.hp / dragon.maxHp <= .32 ? 'objective' : 'engage', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: healthyContestAllies, nearbyEnemies: enemiesAtDragon.length,
          callAlignment, isSafe: !losingFight, isContestedObjective: true,
          objectiveHealthFraction: dragon.hp / dragon.maxHp,
        });
      const shouldContestEnemyDragon = !nexusFinishCommit && isOpponentAtDragon && hasDragonVision && (callAlignment >= .48 || dragonContestPreference >= 1) && shouldContestOpponentObjective({
        gameSeconds: matchTimeRef.current,
        bossHealthFraction: dragon.hp / dragon.maxHp,
        healthyAllies: healthyContestAllies,
        enemiesAtBoss: enemiesAtDragon.length,
        hasVisionOfPit: hasDragonVision,
        hasShotcaller: allies.some(a => personalityOf(a.player).includes('igl')),
        hasStealSpecialist: personalityOf(u.player).includes('steal_gambler'),
        averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
        averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
        chemistry: u.teamChemistry ?? 10,
        actorHealthFraction: u.hp / u.maxHp,
        isDragon: true
      });

      const golem = jungleCamps.find(c => c.type === 'siege_golem' && c.isAlive);
      const golemAllies = golem ? availableAllies.filter(a => Math.hypot(a.x - golem.x, a.y - golem.y) < 610) : [];
      const isOpponentAtGolem = !!golem && golem.isAlive && golem.claimTeam !== u.team
        && !!golem.claimTeam && golem.hp < golem.maxHp;
      const hasGolemVision = !!golem && hasObjectiveVision(u.team, golem, allies, enemies, wardsRef.current);
      const enemiesAtGolem = golem ? enemies.filter(e => Math.hypot(e.x - golem.x, e.y - golem.y) < 360) : [];
      const golemContestPreference = golem ? personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology),
        golem.hp / golem.maxHp <= .32 ? 'objective' : 'engage', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: healthyContestAllies, nearbyEnemies: enemiesAtGolem.length,
          callAlignment, isSafe: !losingFight, isContestedObjective: true,
          objectiveHealthFraction: golem.hp / golem.maxHp,
        }) : -Infinity;
      const shouldContestEnemyGolem = !nexusFinishCommit && !!golem && isOpponentAtGolem && hasGolemVision && !shouldContestEnemyDragon && (callAlignment >= .48 || golemContestPreference >= 1) && shouldContestOpponentObjective({
        gameSeconds: matchTimeRef.current,
        bossHealthFraction: golem.hp / golem.maxHp,
        healthyAllies: healthyContestAllies,
        enemiesAtBoss: enemiesAtGolem.length,
        hasVisionOfPit: hasGolemVision,
        hasShotcaller: allies.some(a => personalityOf(a.player).includes('igl')),
        hasStealSpecialist: personalityOf(u.player).includes('steal_gambler'),
        averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
        averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
        chemistry: u.teamChemistry ?? 10,
        actorHealthFraction: u.hp / u.maxHp,
        isDragon: false
      });

      const coach = u.team === 'blue' ? blueCoach : redCoach;
      const fightPreference = objectiveFightPreference(allies.map(a => a.player), coach, u.player)
        + personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'engage', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !losingFight,
          isContestedObjective: isOpponentAtDragon || isOpponentAtGolem,
          objectiveHealthFraction: isOpponentAtDragon ? dragon.hp / dragon.maxHp : golem ? golem.hp / golem.maxHp : undefined,
        }) * Math.max(.4, callAlignment);
      const enemyStartedFightAt = (boss: { x: number; y: number }) => allies.some(ally =>
        Math.hypot(ally.x - boss.x, ally.y - boss.y) < 460
        && !!ally.lastEnemyDamage && matchTimeRef.current - ally.lastEnemyDamage.second <= 2.5
        && champs.some(enemy => enemy.id === ally.lastEnemyDamage?.attackerId && enemy.team !== u.team
          && enemy.isAlive && Math.hypot(enemy.x - boss.x, enemy.y - boss.y) < 520));
      const teamTakingDragon = dragon.isAlive && dragon.claimTeam === u.team && dragon.hp < dragon.maxHp;
      const teamTakingGolem = !!golem && golem.claimTeam === u.team && golem.hp < golem.maxHp;
      const dragonAction = !nexusFinishCommit && !defenseCall && (teamTakingDragon || shouldContestEnemyDragon)
        ? chooseObjectiveAction({ bossHealthFraction: dragon.hp / dragon.maxHp,
          hasVision: hasDragonVision, contestedByEnemy: !!shouldContestEnemyDragon,
          enemyStartedFight: enemyStartedFightAt(dragon), fightPreference }) : 'none';
      const golemAction = !nexusFinishCommit && !defenseCall && golem && dragonAction === 'none' && (teamTakingGolem || shouldContestEnemyGolem)
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
      const isPostObjectiveFight = !nexusFinishCommit && !defenseCall && postFightEnemies.length > 0 && dragonAction === 'none' && golemAction === 'none';
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

      if (isObjectiveFight && teamPsychology.iglId === u.id && (u.shotcallSignalTimer ?? 0) <= 0) {
        u.shotcallSignalTimer = 5.0;
        allies.forEach(a => { a.shotcallSignalTimer = 5.0; });
        floatsRef.current.push({
          id: random().toString(), x: u.x, y: u.y - 35,
          text: '📢 SHOTCALL RALLY!', color: '#8b5cf6', opacity: 1, scale: 1.3
        });
      }

      const enemiesAtContest = isContestingDragon ? enemiesAtDragon : (isContestingGolem ? enemiesAtGolem : postFightEnemies);
      const contestEnemyPool = enemiesAtContest.length > 0 ? enemiesAtContest : enemies;
      const contestTargetOptions = { enemyStructures, alliedMinions: alliedMinionsForDive,
        cooldownMemory: cooldownMemoryRef.current, matchSecond: matchTimeRef.current };
      const contestFightTarget = isObjectiveFight
        ? (chooseTeamfightTarget(u, contestEnemyPool, allies, attackRange, contestTargetOptions)
          || chooseTeamfightTarget(u, enemies, allies, attackRange, contestTargetOptions))
        : undefined;

      // Fight calls use player card attitudes, the shotcaller, coach style and a real enemy attack.
      const defenseTarget = defenseCall && chooseTeamfightTarget(u,
        enemies.filter(enemy => defenseCall.attackers.some(attacker => attacker.id === enemy.id)), allies, attackRange, contestTargetOptions);
      const finishFocusPool = pressWonFight ? enemies.filter(enemy => isUnitVisibleTo(enemy, u)
        && Math.hypot(enemy.x - u.x, enemy.y - u.y) <= 500
        && isTeamfightApproachSafe(u, enemy, enemyStructures)
        && !enemyStructures.some(st => (st.type.includes('tower') || st.type === 'nexus')
          && Math.hypot(st.x - enemy.x, st.y - enemy.y) <= st.range + 28))
        .sort((a, b) => (a.hp + a.shield) - (b.hp + b.shield)
          || a.hp / a.maxHp - b.hp / b.maxHp || a.id.localeCompare(b.id)) : [];
      const finishFocusTarget = finishFocusPool[0];
      const canFinishWonFight = pressWonFight && !!finishFocusTarget;
      const preferredPrimaryTarget = defenseCall ? defenseTarget : (canFollowUpEngage ? closestCaught : undefined)
        || proactiveFocusTarget || finishFocusTarget || contestFightTarget || chooseTeamfightTarget(u, enemies, allies, attackRange, {
        enemyStructures,
        alliedMinions: alliedMinionsForDive,
        cooldownMemory: cooldownMemoryRef.current,
        matchSecond: matchTimeRef.current
      });
      const combatContext = defenseCall ? 'defense' : canFollowUpEngage ? 'follow-up' : activeAllInCommit ? 'all-in'
        : canFinishWonFight ? 'finish-fight'
        : isObjectiveFight ? 'objective-fight' : 'lane-fight';
      const combatPool = defenseCall
        ? enemies.filter(enemy => defenseCall.attackers.some(attacker => attacker.id === enemy.id))
        : canFollowUpEngage && closestCaught ? caughtEnemies
          : activeAllInCommit ? allInFocusPool
          : canFinishWonFight ? finishFocusPool
          : isObjectiveFight ? contestEnemyPool : enemies;
      const combatCandidates = combatPool.map(enemy => ({
        ...actionCandidate('champion', enemy),
        contextKey: `${combatContext}:${actionContextFor('champion', enemy)}`,
      }));
      const preferredCombatCandidate = preferredPrimaryTarget ? {
        ...actionCandidate('champion', preferredPrimaryTarget),
        contextKey: `${combatContext}:${actionContextFor('champion', preferredPrimaryTarget)}`,
      } : undefined;
      const committedCombatCandidate = chooseCommittedActionTarget({
        intent: u.actionIntent,
        kind: 'champion',
        preferred: preferredCombatCandidate,
        candidates: combatCandidates,
        failures: u.actionFailures,
        now: matchTimeRef.current,
      });
      const primaryTarget = committedCombatCandidate
        ? combatPool.find(enemy => enemy.id === committedCombatCandidate.id) : undefined;
      const selectedTeamfightPriority = activeAllInCommit || canFinishWonFight || prioritizeFightWith(primaryTarget);
      const tacticalOutlook = primaryTarget ? estimateTacticalOutlook({
        actor: u, target: primaryTarget,
        travelSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u),
        interactionRange: Math.max(attackRange, readyCastRange), nearbyAllies: localAllies.length,
        nearbyEnemies: localEnemies.length,
        approachThreat: spatialInfluence.approach(u, primaryTarget).threat,
        approachCover: spatialInfluence.approach(u, primaryTarget).cover,
      }) : undefined;
      const primaryTargetMemory = readOpponentTacticalMemory(opponentTacticalMemoryRef.current, u.team,
        primaryTarget?.id, u.id, matchTimeRef.current);
      const localFocusPressure = localEnemies.filter(enemy => readOpponentTacticalMemory(
        opponentTacticalMemoryRef.current, u.team, enemy.id, u.id, matchTimeRef.current).focusingActor).length;
      // Reinforce the threatened defensive layer before starting side activities.
      // Emergency retreat/recall and dive evacuation have already run above.
      const moveToDefense = () => {
        if (!defenseCall) return;
        const waypoint = rockApproachWaypoint(u, defenseCall.rally);
        const distance = Math.hypot(waypoint.x - u.x, waypoint.y - u.y);
        const speed = Math.min(90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u), distance / dt);
        u.vx = distance > 8 ? (waypoint.x - u.x) / distance * speed : 0;
        u.vy = distance > 8 ? (waypoint.y - u.y) / distance * speed : 0;
        u.x += u.vx * dt; u.y += u.vy * dt;
        u.animState = distance > 8 ? 'walk' : 'idle';
        setUnitFacing(u, defenseCall.building.x);
      };
      if (defenseCall && defenseCall.distance > 320) {
        setActionIntent('defend', defenseCall.building, 'move',
          `defend:${defenseCall.building.id}:${defenseCall.attackers.length}:${defenseCall.wave.length}`, 0.9);
        moveToDefense();
        return;
      }
      if (!defenseCall && u.paxiOrb && primaryTarget && u.player.stats.iq >= 55
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
      const defenseMinion = defenseCall ? enemyMinions
        .filter(minion => defenseCall.wave.some(threat => threat.id === minion.id))
        .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]
        : undefined;
      const actionableMinions = defenseCall
        ? enemyMinions.filter(minion => defenseCall.wave.some(threat => threat.id === minion.id))
        : enemyMinions;
      const preferredMinion = defenseCall ? defenseMinion : actionableMinions
        .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      const committedMinionCandidate = chooseCommittedActionTarget({
        intent: u.actionIntent,
        kind: 'minion',
        preferred: preferredMinion ? actionCandidate('minion', preferredMinion) : undefined,
        candidates: actionableMinions.map(minion => actionCandidate('minion', minion)),
        failures: u.actionFailures,
        now: matchTimeRef.current,
      });
      const nearestMinion = committedMinionCandidate
        ? actionableMinions.find(minion => minion.id === committedMinionCandidate.id) : undefined;
      const enemyNexus = structures.find(st => st.team !== u.team && st.type === 'nexus');
      const isNexusLow = !!enemyNexus && canDamageNexus(enemyNexus.team, structures)
        && (enemyNexus.hp / enemyNexus.maxHp <= 0.40);
      const focusNexus = nexusFinishCommit && !defenseCall && !!enemyNexus && (shouldFocusExposedNexus(enemyNexus,
        canDamageNexus(enemyNexus.team, structures), iq, coach?.playbookBonus ?? 8) || isNexusLow);
      const preferredStructure = focusNexus ? enemyNexus
        : attackableEnemyStructures.sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
      const pushOutlook = preferredStructure ? estimateTacticalOutlook({
        actor: u, target: preferredStructure,
        travelSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u),
        interactionRange: attackRange, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
        approachThreat: spatialInfluence.approach(u, preferredStructure).threat,
        approachCover: spatialInfluence.approach(u, preferredStructure).cover,
      }) : undefined;
      const committedStructureCandidate = chooseCommittedActionTarget({
        intent: u.actionIntent,
        kind: 'structure',
        preferred: preferredStructure ? actionCandidate('structure', preferredStructure) : undefined,
        candidates: attackableEnemyStructures.map(structure => actionCandidate('structure', structure)),
        failures: focusNexus && isNexusLow ? undefined : u.actionFailures,
        now: matchTimeRef.current,
      });
      const nearestStructure = committedStructureCandidate
        ? attackableEnemyStructures.find(structure => structure.id === committedStructureCandidate.id) : undefined;
      const minionInRange = !isObjectiveFight && !!nearestMinion && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= attackRange;
      const structureInRange = !isObjectiveFight && !!nearestStructure && canBasicAttackStructure({
        x: u.x, y: u.y, attackRange,
      }, nearestStructure);
      const alliedCrash = nearestStructure
        ? minions.filter(m => m.team === u.team && m.isAlive && Math.hypot(m.x - nearestStructure.x, m.y - nearestStructure.y) < 180).length
        : 0;
      const closestEnemyChampion = enemies.length
        ? Math.min(...enemies.map(e => Math.hypot(e.x - u.x, e.y - u.y))) : Infinity;
      const waveArchitectSetup = personalityTraits.includes('wave_architect') && !!nearestStructure
        && Math.hypot(nearestStructure.x - u.x, nearestStructure.y - u.y) <= 520
        && personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'wave', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: !losingFight, siegeOpportunity: true,
        }) > 2;
      const alliedWaveAtNexus = focusNexus && enemyNexus
        ? minions.some(m => m.team === u.team && m.isAlive && Math.hypot(m.x - enemyNexus.x, m.y - enemyNexus.y) < 220)
        : false;
      const blockingNexusMinion = focusNexus && enemyNexus && nearestMinion && minionInRange
        && Math.sign(enemyNexus.x - u.x) * (nearestMinion.x - u.x) >= -20
        && Math.abs(nearestMinion.y - LANE_Y) < 145;
      const clearWaveFirst = defenseCall
        ? !!defenseMinion && minionInRange && (!defenseTarget
          || Math.hypot(defenseTarget.x - u.x, defenseTarget.y - u.y) > attackRange + 40)
        : !isObjectiveFight && !coordinatedEngage
        && (focusNexus
          ? !alliedWaveAtNexus && !!blockingNexusMinion && !isNexusLow
          : (!selectedTeamfightPriority && ((wavePushCall && minionInRange && alliedCrash < 2)
            || (waveArchitectSetup && minionInRange && alliedCrash < 2)
            || shouldPrioritizeWaveClear(iq, lanStat, minionInRange, structureInRange, alliedCrash, closestEnemyChampion)
            || (personalityOf(u.player).includes('wave_architect') && matchTimeRef.current <= 240 && minionInRange
              && alliedCrash < 2 && !structureInRange))))
        && (closestEnemyChampion > 160 || !primaryTarget);
      const advanceLimit = laneAdvanceLimit({
        team: u.team, waveFrontX, waveCount: alliedLaneWave.length,
        structureX: nearestStructure?.x, structureRange: nearestStructure?.range,
        exposedNexus: focusNexus, objectiveFight: isObjectiveFight, attackRange,
        structureApproachUnsafe: nearestStructure?.type === 'nexus' && !nexusFinishCommit
          && nexusFinish.estimatedSurvivalSeconds < 3,
      });
      const personalityCanContinueChase = !!primaryTarget && !isDangerousFight
        && isTeamfightApproachSafe(u, primaryTarget, enemyStructures)
        && personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'chase', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: true, isolatedTarget: localEnemies.length === 1,
        }) >= 3.5;
      const holdChaseForWave = !defenseCall && !!primaryTarget && !activeAllInCommit && !prioritizeFightWith(primaryTarget, false) && !canFollowUpEngage && !pressWonFight
        && !personalityCanContinueChase
        && !isObjectiveFight && !focusNexus
        && primaryTarget.hp / primaryTarget.maxHp > 0.22
        && wouldOverstep(u.team, primaryTarget.x, advanceLimit)
        && closestEnemyChampion > Math.max(150, attackRange + 35);

      // A feasible commitment outranks optional objectives, farming, regrouping,
      // and champion chasing. It remains subject to the evaluator's legal
      // exposure, approach, structure-DPS, and survival checks.
      if (nexusFinishCommit && enemyNexus && !clearWaveFirst) {
        const nexusDist = Math.hypot(enemyNexus.x - u.x, enemyNexus.y - u.y);
        setActionIntent('structure', enemyNexus,
          canBasicAttackStructure({ x: u.x, y: u.y, attackRange }, enemyNexus) ? 'execute' : 'move',
          `nexus-finish:${nexusFinish.contextKey}`);
        setUnitFacing(u, enemyNexus.x);
        if (canBasicAttackStructure({ x: u.x, y: u.y, attackRange }, enemyNexus)) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1 / getEffectiveAttackSpeed(u);
            u.animState = 'attack';
            if (isNexusLow && random() < 0.22) {
              floatsRef.current.push({
                id: random().toString(),
                x: u.x,
                y: u.y - 32,
                text: '⚔️ NEXUS COMMIT!',
                color: '#fbbf24',
                opacity: 1,
                scale: 1.2
              });
            }
            executeChampionAttack(u, enemyNexus, 'structure', u.champion.ad);
            if ((u.nexusFinishLastAttackAt ?? -Infinity) + 0.75 <= matchTimeRef.current) {
              u.nexusFinishLastAttackAt = matchTimeRef.current;
              addEvent(`NEXUS_FINISH_ATTACK: ${u.player.name} applied an authored structure hit to ${enemyNexus.name}.`, 'tower');
            }
          }
        } else {
          // Direct route toward nexus along the central lane corridor
          const targetRouteY = Math.abs(u.y - LANE_Y) > 40 ? (u.y * 0.6 + LANE_Y * 0.4) : enemyNexus.y;
          const angle = Math.atan2(targetRouteY - u.y, enemyNexus.x - u.x);
          const speed = 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          u.animState = 'walk';
        }
        return;
      }

      // Optional regrouping yields to a viable fight without waiting to take damage.
      // An old hit from the objective fight alone still cannot interrupt regrouping.
      const wasJustAttacked = !!activePostPlan && !!u.lastEnemyDamage
        && u.lastEnemyDamage.second > activePostPlan.startedAt
        && matchTimeRef.current - u.lastEnemyDamage.second <= 2.5;
      if (!defenseCall && activePostPlan?.action === 'regroup' && !focusNexus && !selectedTeamfightPriority && !tempoPush && !coordinatedEngage && !wasJustAttacked && dragonAction === 'none' && golemAction === 'none') {
        const laneX = activePostPlan.x + (u.team === 'blue' ? -90 : 90);
        const laneY = LANE_Y;
        const distance = Math.hypot(laneX - u.x, laneY - u.y);
        setActionIntent('regroup', { id: `post-objective:${u.team}`, x: laneX, y: laneY },
          distance > 20 ? 'move' : 'hold', `post-objective:${u.team}:${Number(wasJustAttacked)}`, 1.0);
        if (distance > 20) {
          const angle = Math.atan2(laneY - u.y, laneX - u.x);
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
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

      const stagingBoss = upcomingTempoObjective?.type === 'dragon'
        ? dragon
        : upcomingTempoObjective?.type === 'golem'
          ? jungleCamps.find(camp => camp.type === 'siege_golem')
          : undefined;
      const stagingEnemies = stagingBoss
        ? enemies.filter(enemy => Math.hypot(enemy.x - stagingBoss.x, enemy.y - stagingBoss.y) <= 500)
        : [];
      const hasLanePriorityForSetup = pushedWave && alliedWave.length >= opposingWave.length;
      if (!defenseCall && upcomingTempoObjective && stagingBoss && !focusNexus && !pressWonFight
        && !selectedTeamfightPriority && !coordinatedEngage && !isDangerousFight && !isObjectiveFight
        && shouldStageForObjective({
          secondsUntilObjective: upcomingTempoObjective.secondsUntil,
          healthFraction: u.hp / u.maxHp,
          lanePriority: hasLanePriorityForSetup,
          nearbyEnemies: stagingEnemies.length,
          activeFight: localEnemies.length > 0 || isTakingTurretFire,
        })) {
        const approachX = stagingBoss.x + (u.team === 'blue' ? -215 : 215);
        const approachY = stagingBoss.y + ((uIdx % 5) - 2) * 48;
        const approachDistance = Math.hypot(approachX - u.x, approachY - u.y);
        setActionIntent('stage', { id: `stage:${upcomingTempoObjective.key}`, x: approachX, y: approachY },
          approachDistance > 20 ? 'move' : 'hold',
          `stage:${upcomingTempoObjective.key}:${Math.ceil(upcomingTempoObjective.secondsUntil / 3)}`, 0.9);
        if (approachDistance > 20) {
          const angle = Math.atan2(approachY - u.y, approachX - u.x);
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
            + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          u.animState = 'walk';
          setUnitFacing(u, approachX);
        } else {
          u.vx = 0;
          u.vy = 0;
          u.animState = 'idle';
        }
        return;
      }

      // MACRO OBJECTIVE 1: START DRAGON IN UPPER PIT (Game-Ending Objective Priority)
      const dragonStartAvailable = !isObjectiveFight && !defenseCall && !focusNexus
        && (!tempoPush || dragonAction === 'finish')
        && (dragonAction === 'finish' || (dragonAction === 'none' && shouldContestDragon))
        && (dragonAction === 'finish' || !primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > 220);
      const dragonOutlook = estimateTacticalOutlook({ actor: u, target: dragon,
        travelSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u),
        interactionRange: neutralAttackRange(attackRange, true), nearbyAllies: nearbyPitAllies.length,
        nearbyEnemies: enemiesAtDragon.length, approachThreat: spatialInfluence.approach(u, dragon).threat,
        approachCover: spatialInfluence.approach(u, dragon).cover,
      });
      const dragonStartDecision = chooseMacroAction({ actorAvailable: u.isAlive,
        now: matchTimeRef.current, commitment: u.macroDecision, candidates: [
          { action: 'objective' as const, available: dragonStartAvailable,
            priority: dragonAction === 'finish' ? 'finish' as const : 'tactical' as const,
            contextKey: `dragon-start:${dragon.slainCount}:${dragonAction}`,
            factors: { strategic: dragonAction === 'finish' ? .9 : .7, tactical: dragonOutlook.pressure,
              coordination: Math.max(nearbyPitAllies.length / Math.max(1, allies.length), dragonOutlook.support),
              danger: Math.max(isDangerousFight ? 1 : 0, 1 - dragonOutlook.survival) },
            reason: 'existing Dragon start, vision, wave, and safety gates passed' },
          { action: 'fight' as const, available: !dragonStartAvailable && !!primaryTarget && selectedTeamfightPriority,
            priority: 'tactical' as const, contextKey: `dragon-fight:${primaryTarget?.id ?? 'none'}`,
            factors: { tactical: .9, danger: isDangerousFight ? 1 : 0 },
            reason: 'existing combat policy has a nearer active target' },
        ] });
      const focusDragon = dragonStartDecision.selected?.value === 'objective';
      if (focusDragon) {
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
        setActionIntent('objective', dragon,
          dragonDist <= neutralAttackRange(attackRange, true) + 12 ? 'execute' : 'move',
          `dragon:${dragon.slainCount}:${dragonAction}:${Math.ceil(dragon.hp / Math.max(1, dragon.maxHp) * 10)}`, 1.0);
        setUnitFacing(u, dragon.x);

        if (dragonDist <= neutralAttackRange(attackRange, true) + 12) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
            u.animState = 'attack';
            u.mana = Math.min(maxMana(u), u.mana + 4);
            u.revealedTimer = 2.0;
            executeChampionAttack(u, dragon, 'dragon', u.champion.ad * 1.2);
          }
        } else {
          u.animState = 'walk';
          const waypoint = rockApproachWaypoint(u, dragon);
          const angle = Math.atan2(waypoint.y - u.y, waypoint.x - u.x);
          const speed = Math.min(85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
            + ((u.stealthTimer ?? 0) > 0 ? 60 : 0), Math.hypot(waypoint.x - u.x, waypoint.y - u.y) / dt);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      const shouldContestGolem = !defenseCall && !selectedTeamfightPriority && !tempoPush && !coordinatedEngage && !fightingAlly && !!golem && !shouldContestDragon && objectivePreference >= -2.5 && shouldStartEpicObjective({
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
      const golemStartAvailable = !isObjectiveFight && !!golem && !defenseCall && !focusNexus
        && (!tempoPush || golemAction === 'finish')
        && (golemAction === 'finish' || (golemAction === 'none' && shouldContestGolem))
        && (golemAction === 'finish' || !primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > 220);
      const golemOutlook = golem ? estimateTacticalOutlook({ actor: u, target: golem,
        travelSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u),
        interactionRange: neutralAttackRange(attackRange, true), nearbyAllies: golemAllies.length,
        nearbyEnemies: enemiesAtGolem.length, approachThreat: spatialInfluence.approach(u, golem).threat,
        approachCover: spatialInfluence.approach(u, golem).cover,
      }) : undefined;
      const golemStartDecision = chooseMacroAction({ actorAvailable: u.isAlive,
        now: matchTimeRef.current, commitment: u.macroDecision, candidates: [
          { action: 'objective' as const, available: golemStartAvailable,
            priority: golemAction === 'finish' ? 'finish' as const : 'tactical' as const,
            contextKey: `golem-start:${golem?.id ?? 'none'}:${golemAction}`,
            factors: { strategic: golemAction === 'finish' ? .9 : .7, tactical: golemOutlook?.pressure ?? 0,
              coordination: Math.max(golemAllies.length / Math.max(1, allies.length), golemOutlook?.support ?? 0),
              danger: Math.max(isDangerousFight ? 1 : 0, 1 - (golemOutlook?.survival ?? 0)) },
            reason: 'existing Gravemarch start, vision, wave, and safety gates passed' },
          { action: 'fight' as const, available: !golemStartAvailable && !!primaryTarget && selectedTeamfightPriority,
            priority: 'tactical' as const, contextKey: `golem-fight:${primaryTarget?.id ?? 'none'}`,
            factors: { tactical: .9, danger: isDangerousFight ? 1 : 0 },
            reason: 'existing combat policy has a nearer active target' },
        ] });
      const focusGolem = golemStartDecision.selected?.value === 'objective';
      if (golem && focusGolem) {
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
        setActionIntent('objective', golem,
          dist <= neutralAttackRange(attackRange, true) + 12 ? 'execute' : 'move',
          `golem:${golemAction}:${Math.ceil(golem.hp / Math.max(1, golem.maxHp) * 10)}`, 1.0);
        setUnitFacing(u, golem.x);
        if (dist <= neutralAttackRange(attackRange, true) + 12) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1 / getEffectiveAttackSpeed(u);
            u.animState = 'attack';
            executeChampionAttack(u, golem, 'camp', u.champion.ad * 1.15);
          }
        } else {
          u.animState = 'walk';
          const waypoint = rockApproachWaypoint(u, golem);
          const angle = Math.atan2(waypoint.y - u.y, waypoint.x - u.x);
          const speed = Math.min(85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
            + ((u.stealthTimer ?? 0) > 0 ? 60 : 0), Math.hypot(waypoint.x - u.x, waypoint.y - u.y) / dt);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // Camp spawn locations are known to both teams. Vision is needed to see
      // the monster and nearby threats, but not to choose a farming route.
      // Supports may join a coordinated post-recall camp call, but never solo-farm camps.
      const isSupportAvatar = u.champion.primaryRole === 'Support' || u.champion.secondaryRole === 'Support' || getAvatarCombatProfile(u.champion).Support >= 2;
      const atTeamWell = (ally: AramChampionUnit) => ally.team === 'blue'
        ? ally.x <= WELL_X.blue + 105 && Math.abs(ally.y - LANE_Y) <= 105
        : ally.x >= WELL_X.red - 105 && Math.abs(ally.y - LANE_Y) <= 105;
      const recentlyRecalledAllies = allies.filter(ally => (ally.recallCooldown ?? 0) > 0 && atTeamWell(ally));
      const canStartTeamCampObjective = shouldStartPostRecallCampObjective({
        recentlyRecalledAllies: recentlyRecalledAllies.length,
        livingAllies: allies.length,
        healthyAllies: allies.filter(ally => ally.hp / ally.maxHp >= 0.62).length,
        campAvailable: availableJungleCamps.length > 0,
        activeThreat: teamHasActiveThreat || !!defenseCall,
        activePush: tempoPush,
      });
      let teamCampPlan = postRecallCampPlanRef.current[u.team];
      let plannedTeamCamp = teamCampPlan
        ? availableJungleCamps.find(camp => camp.id === teamCampPlan?.campId)
        : undefined;
      const livingPlanMembers = teamCampPlan
        ? allies.filter(ally => teamCampPlan?.memberIds.includes(ally.id)).length
        : 0;
      if (teamCampPlan && (!plannedTeamCamp || teamCampPlan.expiresAt <= matchTimeRef.current
        || livingPlanMembers < 2 || teamHasActiveThreat || !!defenseCall || tempoPush || isObjectiveFight
        || dragonAction !== 'none' || golemAction !== 'none')) {
        delete postRecallCampPlanRef.current[u.team];
        teamCampPlan = undefined;
        plannedTeamCamp = undefined;
      }
      if (!teamCampPlan && canStartTeamCampObjective && !isObjectiveFight
        && dragonAction === 'none' && golemAction === 'none') {
        const selectedCamp = choosePostRecallTeamCamp(availableJungleCamps, u.team, recentlyRecalledAllies);
        if (selectedCamp) {
          teamCampPlan = {
            campId: selectedCamp.id,
            memberIds: recentlyRecalledAllies.map(ally => ally.id),
            expiresAt: matchTimeRef.current + 30,
          };
          postRecallCampPlanRef.current[u.team] = teamCampPlan;
          plannedTeamCamp = selectedCamp;
          const campCallKey = `post-recall-camp:${u.team}:${selectedCamp.id}:${Math.floor(matchTimeRef.current / 60)}`;
          if (!objectiveCallsRef.current.has(campCallKey)) {
            objectiveCallsRef.current.add(campCallKey);
            addEvent(`${u.team.toUpperCase()} called ${selectedCamp.name} after recalling together.`, 'jungle');
          }
        }
      }
      const isPostRecallTeamCampMember = !!teamCampPlan?.memberIds.includes(u.id);
      const callLeader = teamPsychology.iglId ? allies.find(ally => ally.id === teamPsychology.iglId && ally.isAlive) : undefined;
      const personalityRegroupCall = !!callLeader && callLeader.id !== u.id && !defenseCall && !selectedTeamfightPriority
        && !isObjectiveFight && !coordinatedEngage && !fightingAlly && !focusNexus && !tempoPush
        && localEnemies.length === 0 && Math.hypot(callLeader.x - u.x, callLeader.y - u.y) > 175
        && isTeamfightApproachSafe(u, callLeader, enemyStructures)
        && personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'regroup', teamPsychology, {
          healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
          callAlignment, isSafe: true,
        }) >= 2.2;
      const retryableJungleCamps = availableJungleCamps.filter(camp => !isActionRetryBlocked(
        u.actionFailures,
        decisiveActionKey('camp', camp.id),
        matchTimeRef.current,
        actionContextFor('camp', camp),
      ));
      const personalityFarmReady = personalityActionDelta(u.player, ensurePsychology(u.player, u.psychology), 'farm', teamPsychology, {
        healthFraction: u.hp / u.maxHp, nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length,
        callAlignment, isSafe: localEnemies.length === 0,
      }) >= -0.25 || matchTimeRef.current > 180;
      const nearestJungleCamp = !defenseCall && !selectedTeamfightPriority && !isObjectiveFight && !coordinatedEngage && !fightingAlly
        && !focusNexus && !tempoPush && dragonAction === 'none' && golemAction === 'none'
        && personalityFarmReady
        ? isPostRecallTeamCampMember && plannedTeamCamp
          ? chooseKnownJungleCamp(retryableJungleCamps.filter(camp => camp.id === plannedTeamCamp?.id), {
            x: u.x, y: u.y, team: u.team, hpFraction: u.hp / u.maxHp,
            iq, jungleStrength: getAvatarCombatProfile(u.champion).Jungler,
            gameSeconds: matchTimeRef.current, nearbyEnemyCount: localEnemies.length,
            nearestLaneEnemyDistance: nearestMinion ? Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) : Infinity,
            urgentStructurePush: false, teamObjective: true,
          })
          : !isSupportAvatar ? chooseKnownJungleCamp(retryableJungleCamps, {
          x: u.x, y: u.y, team: u.team, hpFraction: u.hp / u.maxHp,
          iq, jungleStrength: getAvatarCombatProfile(u.champion).Jungler,
          gameSeconds: matchTimeRef.current, nearbyEnemyCount: localEnemies.length,
          nearestLaneEnemyDistance: nearestMinion
            ? Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) : Infinity,
          urgentStructurePush: focusNexus || tempoPush,
          role: u.champion.primaryRole,
          supportStrength: getAvatarCombatProfile(u.champion).Support,
          currentCampId: u.farmTargetId,
        }) : undefined
        : undefined;
      u.farmTargetId = nearestJungleCamp?.id;

      // The stronger finish/defense/objective branches above have already
      // returned. Arbitrate the remaining legal macro work once rather than
      // allowing farm, regroup, combat, wave and push branches to race.
      const nearestLivingCarry = allies.find(ally => ally.isAlive && ally.id !== u.id && !ally.isRecalling
        && !isInsideEnemyWellBeam(u.team, ally)
        && Math.hypot(ally.x - u.x, ally.y - u.y) <= 550);
      const regroupTarget = personalityRegroupCall && callLeader ? callLeader
        : (!focusNexus && !tempoPush && !coordinatedEngage && !isObjectiveFight && !defenseCall
          && !!fightingAlly && canReinforceFightingAlly
          && (!primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > attackRange))
          ? fightingAlly
          : !defenseCall && isSupportAvatar && nearestLivingCarry && !primaryTarget
            && Math.hypot(nearestLivingCarry.x - u.x, nearestLivingCarry.y - u.y) > 130
            ? nearestLivingCarry : undefined;
      const canRegroup = !!regroupTarget;
      const skill1Range = getSkillCastRange(u.champion.name, 'skill1', baseAttackRange);
      const skill2Range = getSkillCastRange(u.champion.name, 'skill2', baseAttackRange);
      const ultRange = getSkillCastRange(u.champion.name, 'ultimate', baseAttackRange);
      const standardCombatRange = Math.max(attackRange * 1.5, skill1Range, skill2Range, u.level >= 6 ? ultRange : 0, u.champion.name === 'Kaelen' ? 420 : 190);
      const isFollowUpEngage = canFollowUpEngage && !!primaryTarget && isEnemyCaughtInAlliedChannel(primaryTarget, allies);
      const maxCombatRange = isFollowUpEngage ? Math.max(standardCombatRange, 650)
        : activeAllInCommit || canFinishWonFight ? Math.max(standardCombatRange, 500) : standardCombatRange;
      const postFightConversion = choosePostFightConversion({ now: matchTimeRef.current, wonFight: pressWonFight,
        candidates: [
          { action: 'push' as const, available: tempoPush, contextKey: `push:${Math.floor(advanceLimit / 40)}`,
            factors: { strategic: .75, tactical: pushOutlook?.pressure ?? .3, danger: 1 - (pushOutlook?.survival ?? 0) }, reason: 'existing post-win push gate passed' },
          { action: 'objective' as const, available: dragonStartAvailable || golemStartAvailable, contextKey: `objective:${dragonAction}:${golemAction}`,
            factors: { strategic: .7 }, reason: 'existing objective-start gate passed' },
          { action: 'reset' as const, available: wantsRecall && !isDangerousFight, contextKey: `reset:${Math.floor(u.hp / Math.max(1, u.maxHp) * 10)}`,
            factors: { resource: .2 }, reason: 'existing safe recall gate passed' },
          { action: 'farm' as const, available: !!nearestJungleCamp, contextKey: `farm:${nearestJungleCamp?.id ?? 'none'}`,
            factors: { strategic: .4, travel: .2 }, reason: 'existing safe farm gate passed' },
          { action: 'regroup' as const, available: canRegroup, contextKey: `regroup:${callLeader?.id ?? fightingAlly?.id ?? 'none'}`,
            factors: { coordination: .7 }, reason: 'existing regroup gate passed' },
        ],
      }).selected?.value;
      const teamIntentCandidates = [
        { intent: 'defend' as const, available: !!defenseCall && defenseCall.urgent,
          priority: 'emergency' as const, contextKey: `defend:${defenseCall?.building.id ?? 'none'}`,
          factors: { tactical: .9 }, reason: 'existing urgent base-defense call is active' },
        { intent: 'fight' as const, available: !!primaryTarget && !clearWaveFirst && !holdChaseForWave
            && (selectedTeamfightPriority || isObjectiveFight || !!fightingAlly),
          priority: 'tactical' as const, contextKey: `fight:${primaryTarget?.id ?? 'none'}:${isObjectiveFight ? 1 : 0}`,
          factors: { tactical: selectedTeamfightPriority || isObjectiveFight ? .9 : .55,
            coordination: coordinatedEngage ? .8 : 0, danger: isDangerousFight ? 1 : 0 },
          reason: 'existing live fight or objective-contest policy is active' },
        { intent: 'objective' as const, available: dragonAction === 'finish' || golemAction === 'finish',
          priority: 'finish' as const, contextKey: `objective:${dragonAction}:${golemAction}`,
          factors: { strategic: .9 }, reason: 'existing low-health objective finish policy is active' },
        { intent: 'regroup' as const, available: canRegroup,
          priority: 'tactical' as const,
          contextKey: `regroup:${callLeader?.id ?? fightingAlly?.id ?? nearestLivingCarry?.id ?? 'none'}`,
          factors: { tactical: .55, coordination: callAlignment, personality: personalityRegroupCall ? 1 : 0 },
          reason: 'existing IGL, reinforcement, or carry-protection policy requested regrouping' },
        { intent: 'push' as const, available: tempoPush,
          priority: 'optional' as const, contextKey: `push:${Math.floor(advanceLimit / 40)}`,
          factors: { strategic: .62, tactical: structureInRange ? .5 : .18 },
          reason: 'existing safe conversion policy found a push window' },
        { intent: 'hold' as const, available: true, priority: 'optional' as const,
          contextKey: `hold:${Math.floor(matchTimeRef.current)}`,
          factors: { tactical: .05 }, reason: 'no stronger existing team call is legal' },
      ];
      const teamIntentDecision = coordinateTeamIntent({ now: matchTimeRef.current,
        candidates: teamIntentCandidates, commitment: teamIntentRef.current[u.team] });
      const selectedTeamIntent = teamIntentDecision.selected?.value;
      const selectedTeamIntentCandidate = selectedTeamIntent
        ? teamIntentCandidates.find(candidate => candidate.intent === selectedTeamIntent) : undefined;
      if (selectedTeamIntentCandidate) teamIntentRef.current[u.team] = {
        intent: selectedTeamIntentCandidate.intent, contextKey: selectedTeamIntentCandidate.contextKey,
        until: matchTimeRef.current + .65,
      };
      const assignedTeamIntent = teamIntentRole(selectedTeamIntent, u.champion.primaryRole);
      const learnedFeatures = adaptiveFeatures(u.player, u.champion, u.hp / u.maxHp, u.mana / maxMana(u));
      const learnedMacroEnabled = adaptivePreferenceAllowed(u.hp / u.maxHp, isDangerousFight);
      const learnedMacroScore = (action: AdaptiveAction) => learnedMacroEnabled
        ? adaptivePolicyScore(adaptivePolicyRef.current, action, learnedFeatures) : 0;
      const enclosingPushCamp = CAMP_ROCK_RINGS.find(ring => Math.hypot(u.x - ring.x, u.y - ring.y)
        < ring.radius + ring.stoneRadius + 45);
      const pushCampExit = enclosingPushCamp ? rockApproachWaypoint(u, {
        x: u.team === 'blue' ? Math.min(enclosingPushCamp.x, advanceLimit) : Math.max(enclosingPushCamp.x, advanceLimit),
        y: LANE_Y,
      }) : undefined;
      const residualPushPlan = planResidualPush({
        structureInRange: structureInRange && nearestStructure ? nearestStructure : undefined,
        minionInRange: nearestMinion && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= attackRange
          ? nearestMinion : undefined,
        campExit: pushCampExit && enclosingPushCamp ? { id: `camp-exit:${enclosingPushCamp.id}`, ...pushCampExit } : undefined,
        laneDestination: { id: `lane-advance:${u.team}`, x: advanceLimit,
          y: getChampionFormationY(u.champion.name, uIdx) },
      });
      const residualPushOutlook = evaluateResidualPush({ plan: residualPushPlan, actor: u,
        attackRange, travelSpeed: 70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u),
        nearbyAllies: localAllies.length, nearbyEnemies: localEnemies.length, influence: spatialInfluence });
      const macroCandidates = [
        { action: 'fight' as const, available: !!primaryTarget && !clearWaveFirst && !holdChaseForWave
            && (isObjectiveFight || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) <= maxCombatRange),
          priority: 'tactical' as const, contextKey: `fight:${primaryTarget?.id ?? 'none'}:${isObjectiveFight ? 1 : 0}`,
          factors: { tactical: Math.max(selectedTeamfightPriority || isObjectiveFight ? .95 : .72,
              tacticalOutlook?.pressure ?? 0, primaryTargetMemory.retreating ? .82 : 0),
            coordination: Math.max(assignedTeamIntent === 'fight' ? .9 : (coordinatedEngage || isObjectiveFight ? .8 : 0), tacticalOutlook?.support ?? 0),
            danger: Math.max(isDangerousFight ? 1 : 0, 1 - (tacticalOutlook?.survival ?? 1), localFocusPressure > 0 ? .65 : 0), learned: learnedMacroScore('fight') },
          reason: 'existing combat and objective-fight policy supplied a reachable target' },
        { action: 'wave' as const, available: clearWaveFirst && !!nearestMinion,
          priority: 'tactical' as const, contextKey: `wave:${nearestMinion?.id ?? 'none'}:${alliedCrash}`,
          factors: { strategic: wavePushCall ? .72 : .45, tactical: .58,
            personality: personalityTraits.includes('wave_architect') ? 1 : 0, danger: closestEnemyChampion <= 160 ? 1 : 0, learned: learnedMacroScore('wave') },
          reason: 'existing wave policy requires a safe, actionable minion' },
        { action: 'regroup' as const, available: canRegroup,
          priority: 'tactical' as const,
          contextKey: `regroup:${regroupTarget?.id ?? 'none'}`,
          factors: { tactical: assignedTeamIntent === 'regroup' ? .82 : .55, coordination: Math.max(assignedTeamIntent === 'regroup' ? .9 : callAlignment, postFightConversion === 'regroup' ? .85 : 0), personality: personalityRegroupCall ? 1 : 0,
            danger: localEnemies.length > 0 ? 1 : 0, opportunity: Math.max(1 - localInfluence.cover, localFocusPressure > 0 ? .8 : 0), learned: learnedMacroScore('regroup') },
          reason: 'existing IGL, fight-reinforcement, or carry-protection rule requested regrouping' },
        { action: 'farm' as const, available: !!nearestJungleCamp,
          priority: 'optional' as const, contextKey: `farm:${nearestJungleCamp?.id ?? 'none'}`,
          factors: { strategic: .42, tactical: postFightConversion === 'farm' ? .65 : .36, personality: personalityFarmReady ? .35 : 0,
            travel: nearestJungleCamp ? Math.min(1, Math.hypot(nearestJungleCamp.x - u.x, nearestJungleCamp.y - u.y) / 700) : 1, learned: learnedMacroScore('farm') },
          reason: 'existing safe camp-farm policy selected a known camp' },
        { action: 'push' as const, available: !defenseCall,
          priority: 'optional' as const, contextKey: `push:${residualPushPlan.kind}:${residualPushPlan.target.id}:${Math.floor(advanceLimit / 40)}:${enemyMinions.length}`,
          factors: { strategic: tempoPush ? .62 : .18, tactical: residualPushOutlook.tactical,
            coordination: Math.max(assignedTeamIntent === 'push' ? .75 : 0, postFightConversion === 'push' ? .85 : 0),
            danger: residualPushOutlook.danger,
            personality: personalityTraits.includes('siege_closer') ? .35 : 0, learned: learnedMacroScore('push') },
          reason: 'existing lane-advance fallback remains available' },
      ];
      const priorMacroCommitment = u.macroDecision;
      const residualMacroDecision = chooseMacroAction({ actorAvailable: u.isAlive,
        now: matchTimeRef.current, candidates: macroCandidates, commitment: priorMacroCommitment });
      const experimentInput = {
        enabled: macroExperimentEnabledRef.current, now: matchTimeRef.current,
        lastAssignmentSecond: lastMacroExperimentRef.current[u.id] ?? -Infinity,
        healthFraction: u.hp / u.maxHp, dangerousFight: isDangerousFight,
        insideEnemyTower: isInsideEnemyTowerRange, objectiveFight: isObjectiveFight,
        defending: !!defenseCall, influenceThreat: localInfluence.threat,
        survival: tacticalOutlook?.survival ?? 1,
        enemyDistance: closestEnemyChampion,
        incumbent: residualMacroDecision.selected?.value, selectionReason: residualMacroDecision.reason,
        candidates: macroCandidates,
        randomDraw: macroExperimentEnabledRef.current && !pairedMacroModeRef.current
          ? (macroExperimentRandomRef.current?.() ?? Math.random()) : -1,
      };
      const experimentInspection = pairedMacroModeRef.current ? inspectSafeMacroExperiment(experimentInput) : undefined;
      const experimentGate = experimentInspection ? experimentInspection.gates[0]
        : macroExperimentEnabledRef.current ? safeMacroExperimentGate(experimentInput) : undefined;
      if (experimentInspection) {
        const auditWindow = window as Window & { __esportsMacroOpportunityAudit?: {
          total: number; firstGates: Record<string, number>; allGates: Record<string, number>;
          safeExceptGap: Record<string, { count: number; minGap: number; maxGap: number }>;
          examples: unknown[];
        } };
        const audit = (auditWindow.__esportsMacroOpportunityAudit ??= {
          total: 0, firstGates: {}, allGates: {}, safeExceptGap: {}, examples: [] });
        audit.total++;
        const first = experimentGate ?? 'eligible';
        audit.firstGates[first] = (audit.firstGates[first] ?? 0) + 1;
        for (const gate of experimentInspection.gates) audit.allGates[gate] = (audit.allGates[gate] ?? 0) + 1;
        if (experimentInspection.pair && experimentInspection.gates.length === 1 && experimentGate === 'utility-gap') {
          const pair = experimentInspection.pair;
          const key = `${u.player.id}:${[pair.incumbent, pair.alternate].sort().join('-')}`;
          const row = (audit.safeExceptGap[key] ??= { count: 0, minGap: pair.utilityGap, maxGap: pair.utilityGap });
          row.count++;
          row.minGap = Math.min(row.minGap, pair.utilityGap);
          row.maxGap = Math.max(row.maxGap, pair.utilityGap);
          if (row.count === 1 && audit.examples.length < 24) audit.examples.push({
            second: matchTimeRef.current, actorId: u.id, cardId: u.player.id, ...pair,
            healthFraction: u.hp / u.maxHp, previousIntent: u.actionIntent?.kind,
            actor: { x: u.x, y: u.y },
            candidates: macroCandidates.filter(candidate => candidate.available).map(candidate => ({
              action: candidate.action, contextKey: candidate.contextKey, factors: candidate.factors,
              ...scoreUtility(candidate.factors),
            })),
            farm: nearestJungleCamp ? { id: nearestJungleCamp.id, x: nearestJungleCamp.x,
              y: nearestJungleCamp.y, distance: Math.hypot(nearestJungleCamp.x - u.x, nearestJungleCamp.y - u.y) } : undefined,
            push: { plan: residualPushPlan, structureInRange, minionInRange, advanceLimit,
              laneY: getChampionFormationY(u.champion.name, uIdx), localThreat: localInfluence.threat,
              structure: preferredStructure ? { id: preferredStructure.id, x: preferredStructure.x,
                y: preferredStructure.y, distance: Math.hypot(preferredStructure.x - u.x, preferredStructure.y - u.y),
                outlook: pushOutlook } : undefined,
              enclosingCamp: CAMP_ROCK_RINGS.find(ring => Math.hypot(u.x - ring.x, u.y - ring.y)
                < ring.radius + ring.stoneRadius + 45)?.id },
          });
        }
      }
      let experimentAssignment = experimentGate === undefined && macroExperimentEnabledRef.current
        && !pairedMacroModeRef.current ? assignSafeMacroExperiment(experimentInput) : undefined;
      const pairMode = pairedMacroModeRef.current;
      const pairWindow = window as Window & { __esportsPairedMacro?: Record<string, unknown>;
        __esportsPairedRestore?: (target: unknown) => boolean };
      const pairTarget = pairedMacroTargetRef.current;
      const pairAtTarget = pairMode === 'replay' && pairTarget?.actorId === u.id
        && Math.abs(pairTarget.second - matchTimeRef.current) < 1e-6;
      const scoutPairFilter = pairMode === 'scout'
        ? sessionStorage.getItem('esports-clash-macro-pair-filter') : null;
      const scoutCardFilter = pairMode === 'scout'
        ? sessionStorage.getItem('esports-clash-macro-pair-card') : null;
      if ((pairMode === 'scout' && !pairWindow.__esportsPairedMacro
        && pairedCheckpointRef.current?.second === matchTimeRef.current
        && (!scoutCardFilter || scoutCardFilter === u.player.id)) || pairAtTarget) {
        // Evaluation-only predecision observations, outside the simulation checkpoint.
        // Dynamic camp state is masked unless existing team vision covers the camp.
        const taskCamp = nearestJungleCamp;
        const taskCampHome = taskCamp ? { x: taskCamp.homeX ?? taskCamp.x, y: taskCamp.homeY ?? taskCamp.y } : undefined;
        const taskCampWaypoint = taskCamp && taskCampHome ? rockApproachWaypoint({ x: u.x, y: u.y },
          Math.hypot(taskCampHome.x - u.x, taskCampHome.y - u.y) < 50 ? taskCamp : taskCampHome) : undefined;
        const customCaster = u.champion.name === 'Kaelen';
        const taskContext = experimentGate === undefined ? buildTaskActionContext({ features: learnedFeatures, actor: u, team: u.team,
          seconds: matchTimeRef.current, attackRange, attackReady: u.attackTimer <= 0,
          basicDps: u.champion.ad * getEffectiveAttackSpeed(u),
          travelSpeed: 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
            + ((u.stealthTimer ?? 0) > 0 ? 60 : 0),
          customCaster, ready1: !customCaster && (u.silenceTimer ?? 0) <= 0 && u.cd1 <= 0 && u.mana >= skill1ManaCost(u),
          ready2: !customCaster && (u.silenceTimer ?? 0) <= 0 && u.cd2 <= 0 && u.mana >= 35,
          readyUlt: !customCaster && (u.silenceTimer ?? 0) <= 0 && u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u),
          allies: allies.filter(ally => ally.id !== u.id), visibleEnemies: enemies,
          alliedMinions: alliedMinionsForDive, enemyMinions,
          enemyTowers: enemyStructures.filter(structure => structure.type.includes('tower') || structure.type === 'nexus'),
          camp: taskCamp ? { ...taskCamp, home: taskCampHome,
            observed: hasObjectiveVision(u.team, taskCamp, allies, enemies, wardsRef.current),
            contributors: Math.max(1, allies.filter(ally => ally.id === u.id
              || (taskCamp.damageContributors?.[ally.id] ?? 0) > 0).length),
            engaged: !!taskCamp.targetId,
            leashFraction: Math.hypot(taskCamp.x - taskCampHome!.x, taskCamp.y - taskCampHome!.y) / 220,
          } : undefined, campWaypoint: taskCampWaypoint,
          push: residualPushPlan, laneDestination: { x: advanceLimit, y: getChampionFormationY(u.champion.name, uIdx) },
          structure: nearestStructure, waveCrash: alliedCrash, influence: spatialInfluence,
        }) : undefined;
        const rewardDecision = pairAtTarget && pairTarget?.arm === 'reward' ? chooseRewardGuidedMacro({
          experiment: experimentInput, policy: pairTarget.rewardPolicy, features: learnedFeatures,
          taskPolicy: pairTarget.rewardTaskPolicy, confidencePolicy: pairTarget.rewardConfidencePolicy, taskContext }) : undefined;
        const forcedDraw = pairTarget?.arm === 'alternate' || rewardDecision?.changed ? .75 : .25;
        const pairAssignment = experimentGate === undefined
          ? assignSafeMacroExperiment({ ...experimentInput, randomDraw: forcedDraw }) : undefined;
        if ((pairAssignment && (!scoutPairFilter || pairAssignment.pair === scoutPairFilter)) || pairAtTarget) {
          const predecisionState = {
            terrainRoutes: captureTerrainRoutes([...championsRef.current, ...jungleCampsRef.current]),
            second: matchTimeRef.current, randomState: randomRef.current.getState(),
            champions: championsRef.current, minions: minionsRef.current,
            structures: structuresRef.current, relics: relicsRef.current,
            projectiles: projectilesRef.current, spells: spellsRef.current,
            waveTimer: waveTimerRef.current, waveCount: waveCountRef.current,
            pendingSiegeGolem: pendingSiegeGolemRef.current,
            golemAwakened: golemAwakenedRef.current,
            objectiveRecallPlan: objectiveRecallPlanRef.current,
            postRecallCampPlan: postRecallCampPlanRef.current,
            lastTeamKillAt: lastTeamKillAtRef.current,
            engagementTracker: engagementTrackerRef.current,
            nextEngagementId: nextEngagementIdRef.current,
            engagementOutcomeCooldown: engagementOutcomeCooldownRef.current,
            wards: wardsRef.current, jungleBuffs: jungleBuffsRef.current,
            dragon: dragonRef.current, jungleCamps: jungleCampsRef.current,
            aegisBuff: aegisBuffRef.current, objectiveCalls: objectiveCallsRef.current,
            teamIntent: teamIntentRef.current, cooldownMemory: cooldownMemoryRef.current,
            opponentTacticalMemory: opponentTacticalMemoryRef.current,
            cooldownSnapshots: cooldownSnapshotsRef.current,
            postObjectivePlan: postObjectivePlanRef.current,
            lastMacroExperiment: lastMacroExperimentRef.current,
          };
          const fingerprint = pairedStateFingerprint(predecisionState);
          const matched = !!pairTarget && !!pairAssignment && pairedMacroTargetMatches(
            pairTarget, u.id, matchTimeRef.current, pairAssignment, fingerprint);
          pairWindow.__esportsPairedMacro = {
            mode: pairMode, actorId: u.id, second: matchTimeRef.current,
            cardId: u.player.id, champion: u.champion.name,
            incumbent: pairAssignment?.incumbent, alternate: pairAssignment?.alternate,
            fingerprint, matched, gate: experimentGate ?? null, rewardDecision,
            predecisionState: sessionStorage.getItem('esports-clash-checkpoint-state') === '1'
              ? serializePairedState(predecisionState) : undefined,
            decisionCandidates: structuredClone(macroCandidates), features: learnedFeatures, taskContext,
            teamStart: teamTaskSnapshot(u.team),
            actorStart: { x: u.x, y: u.y, hpFraction: u.hp / u.maxHp,
              gold: u.gold, cs: u.cs, kills: u.kills, deaths: u.deaths,
              damageDealt: u.damageDealt },
          };
          if (pairMode === 'scout') pairWindow.__esportsPairedRestore = restorePairedCheckpoint;
          if (pairMode === 'replay' && matched) experimentAssignment = pairAssignment;
        }
      }
      if (experimentAssignment) lastMacroExperimentRef.current[u.id] = matchTimeRef.current;
      const selectedMacroAction = experimentAssignment?.selected ?? residualMacroDecision.selected?.value;
      if (pairedMacroModeRef.current && selectedMacroAction)
        auditedMacro = { selected: selectedMacroAction, x: u.x, y: u.y,
          pushPlan: selectedMacroAction === 'push' ? residualPushPlan : undefined };
      const selectedMacroCandidate = selectedMacroAction
        ? macroCandidates.find(candidate => candidate.action === selectedMacroAction) : undefined;
      u.macroDecision = nextMacroCommitment(selectedMacroCandidate,
        residualMacroDecision.reason, priorMacroCommitment, matchTimeRef.current);
      const activePair = pairWindow.__esportsPairedMacro;
      if (pairMode === 'replay' && activePair?.matched === true && activePair.actorId === u.id)
        activePair.lastDecision = { second: matchTimeRef.current, selected: selectedMacroAction,
          reason: experimentAssignment ? `assigned:${experimentAssignment.arm}` : residualMacroDecision.reason,
          until: u.macroDecision?.until };
      const decisionRecord: AIDecisionRecord = {
        second: matchTimeRef.current, actorId: u.id, team: u.team,
        selected: selectedMacroAction, contextKey: selectedMacroCandidate?.contextKey, features: learnedFeatures,
        selectionReason: experimentAssignment ? `evaluation-experiment:${experimentAssignment.arm}` : residualMacroDecision.reason,
        heldAction: priorMacroCommitment?.action,
        experiment: experimentAssignment ? { incumbent: experimentAssignment.incumbent,
          alternate: experimentAssignment.alternate, pair: experimentAssignment.pair,
          arm: experimentAssignment.arm, propensity: experimentAssignment.propensity,
          utilityGap: experimentAssignment.utilityGap } : undefined,
        experimentGate: macroExperimentEnabledRef.current ? experimentGate ?? 'eligible' : undefined,
        learnedSuppressedReason: learnedMacroEnabled ? undefined : u.hp / u.maxHp < .3 ? 'low-health' : 'dangerous-fight',
        snapshot: { healthFraction: u.hp / u.maxHp, gold: u.gold, cs: u.cs, kills: u.kills,
          deaths: u.deaths, damageDealt: u.damageDealt },
        candidates: macroCandidates.map(candidate => ({ key: candidate.action, available: candidate.available,
          priority: candidate.priority, reason: candidate.reason })),
      };
      if (shouldRecordAIDecision(aiDecisionRecordsRef.current, decisionRecord)) {
        const zeroPolicyDecision = chooseMacroAction({ actorAvailable: u.isAlive,
          now: matchTimeRef.current, commitment: priorMacroCommitment,
          candidates: macroCandidates.map(candidate => ({ ...candidate,
            factors: { ...candidate.factors, learned: 0 } })),
        });
        decisionRecord.zeroPolicySelected = zeroPolicyDecision.selected?.value;
        decisionRecord.zeroPolicyReason = zeroPolicyDecision.reason;
        if (evaluationReferencePolicyRef.current) {
          const referencePolicy = evaluationReferencePolicyRef.current;
          const referenceDecision = chooseMacroAction({ actorAvailable: u.isAlive,
            now: matchTimeRef.current, commitment: priorMacroCommitment,
            candidates: macroCandidates.map(candidate => ({ ...candidate,
              factors: { ...candidate.factors, learned: learnedMacroEnabled
                ? adaptivePolicyScore(referencePolicy, candidate.action, learnedFeatures) : 0 } })),
          });
          decisionRecord.referencePolicySelected = referenceDecision.selected?.value;
        }
        if (decisionRecord.zeroPolicySelected !== selectedMacroAction) {
          decisionRecord.candidates = macroCandidates.map(candidate => ({
            key: candidate.action, available: candidate.available, priority: candidate.priority,
            reason: candidate.reason, learnedFactor: candidate.factors.learned ?? 0,
            baselineUtility: scoreUtility({ ...candidate.factors, learned: 0 }, false).utility,
            actualUtility: scoreUtility(candidate.factors, false).utility,
          }));
        }
        recordAIDecision(aiDecisionRecordsRef.current, decisionRecord);
        if (experimentAssignment && pairMode === 'replay' && pairWindow.__esportsPairedMacro?.matched)
          pairWindow.__esportsPairedMacro.assignmentRecord = decisionRecord;
      }

      if (selectedMacroAction === 'farm' && nearestJungleCamp) {
        const campHomeX = nearestJungleCamp.homeX ?? nearestJungleCamp.x;
        const campHomeY = nearestJungleCamp.homeY ?? nearestJungleCamp.y;
        const distanceToHome = Math.hypot(campHomeX - u.x, campHomeY - u.y);
        const farmWaypoint = rockApproachWaypoint(u, distanceToHome < 50 ? nearestJungleCamp
          : { x: campHomeX, y: campHomeY });
        const farmX = farmWaypoint.x;
        const farmY = farmWaypoint.y;
        const campDist = Math.hypot(nearestJungleCamp.x - u.x, nearestJungleCamp.y - u.y);
        setActionIntent('camp', nearestJungleCamp,
          distanceToHome <= 220 && campDist <= neutralAttackRange(attackRange) + 12 ? 'execute' : 'move');
        setUnitFacing(u, farmX);

        if (distanceToHome <= 220 && campDist <= neutralAttackRange(attackRange) + 12) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
            u.animState = 'attack';
            u.mana = Math.min(maxMana(u), u.mana + 4);
            u.revealedTimer = 2.0;
            executeChampionAttack(u, nearestJungleCamp, 'camp', u.champion.ad);
          }
        } else {
          u.animState = 'walk';
          const angle = Math.atan2(farmY - u.y, farmX - u.x);
          const speed = Math.min(85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
            + ((u.stealthTimer ?? 0) > 0 ? 60 : 0), Math.hypot(farmX - u.x, farmY - u.y) / dt);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // Execute the same safe IGL destination that made regroup available to the selector.
      if (selectedMacroAction === 'regroup' && personalityRegroupCall && callLeader) {
        const waypoint = rockApproachWaypoint(u, callLeader);
        const distance = Math.hypot(waypoint.x - u.x, waypoint.y - u.y);
        setActionIntent('regroup', callLeader, 'move', `igl-regroup:${callLeader.id}`, 0.8);
        const speed = Math.min(85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
          + ((u.stealthTimer ?? 0) > 0 ? 60 : 0), distance / dt);
        const angle = Math.atan2(waypoint.y - u.y, waypoint.x - u.x);
        u.vx = Math.cos(angle) * speed;
        u.vy = Math.sin(angle) * speed;
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        u.animState = 'walk';
        setUnitFacing(u, waypoint.x);
        return;
      }

      // Macro Teamfight Grouping: High TF players converge to fight together (exclude channeling allies)
      if (selectedMacroAction === 'regroup' && !focusNexus && !tempoPush && !coordinatedEngage && !isObjectiveFight
        && !defenseCall && fightingAlly && canReinforceFightingAlly
        && (!primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > attackRange)) {
        setActionIntent('regroup', fightingAlly, 'move',
          `fight-regroup:${actionContextFor('regroup', fightingAlly)}`, 0.8);
        u.animState = 'walk';
        const groupAngle = Math.atan2(fightingAlly.y - u.y, fightingAlly.x - u.x);
        u.vx = Math.cos(groupAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
        u.vy = Math.sin(groupAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0));
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setUnitFacing(u, fightingAlly.x);
        return;
      }

      // Support Macro Tethering: Support champions naturally stick with their living carries / allies for protection and peel
      if (selectedMacroAction === 'regroup' && !defenseCall && isSupportAvatar && nearestLivingCarry && !primaryTarget && Math.hypot(nearestLivingCarry.x - u.x, nearestLivingCarry.y - u.y) > 130) {
        setActionIntent('regroup', nearestLivingCarry, 'move',
          `support-tether:${actionContextFor('regroup', nearestLivingCarry)}`, 0.8);
        u.animState = 'walk';
        const followAngle = Math.atan2(nearestLivingCarry.y - u.y, nearestLivingCarry.x - u.x);
        u.vx = Math.cos(followAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u));
        u.vy = Math.sin(followAngle) * (85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u));
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        setUnitFacing(u, nearestLivingCarry.x);
        return;
      }

      if ((isFollowUpEngage || activeAllInCommit) && !u.followUpEngageSignaled) {
        u.followUpEngageSignaled = true;
        floatsRef.current.push({
          id: random().toString(),
          x: u.x,
          y: u.y - 32,
          text: activeAllInCommit ? '⚔️ ALL-IN!' : '⚔️ FOLLOW-UP ENGAGE!',
          color: activeAllInCommit ? '#fb923c' : '#38bdf8',
          opacity: 1,
          scale: 1.15
        });
        const channeler = isFollowUpEngage ? allies.find(a => a.isAlive && isChannelingAbility(a)) : undefined;
        if (activeAllInCommit) {
          addEvent(`⚔️ ALL-IN: ${u.player.name} (${u.champion.displayName}) committed to a proactive ${groupedAllInAllies.length}v${groupedAllInEnemies.length} teamfight!`, 'combo');
        } else if (channeler) {
          addEvent(`⚔️ ENGAGE: ${u.player.name} committed follow-up engage with ${channeler.player.name}!`, 'combo');
        }
      } else if (!coordinatedEngage && u.followUpEngageSignaled) {
        u.followUpEngageSignaled = false;
      }

      // Equinox remains valid defensive utility even when no enemy is inside direct combat range.
      if (u.champion.name === 'Kaelen' && !primaryTarget && (u.silenceTimer ?? 0) <= 0
        && (u.kaelenActionTimer ?? 0) <= 0
        && allies.filter(ally => ally.isAlive && Math.hypot(ally.x - u.x, ally.y - u.y) <= 260 && ally.hp / ally.maxHp < .55).length >= 2) {
        const accord = KAELEN_INVOKED_SPELLS.find(spell => spell.id === 'primal-tempest');
        if (accord && (u.kaelenInvokedSlots ?? []).includes(accord.id)
          && castKaelenInvokedSpell(u, accord, u, (u.kaelenInvokedSlots ?? []).indexOf(accord.id))) {
          u.kaelenActionTimer = KAELEN_ACTION_INTERVAL;
          addEvent(`🛡 ARSENALDO: ${u.player.name} used Equinox Accord without requiring an enemy target.`, 'combo');
          return;
        }
      }

      // COMBAT ENGAGEMENT WITH ENEMIES:
      if (selectedMacroAction === 'fight' && !clearWaveFirst && !holdChaseForWave && primaryTarget && Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) <= maxCombatRange) {
        setUnitFacing(u, primaryTarget.x);
        const dist = Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y);
        setActionIntent('champion', primaryTarget, dist > attackRange ? 'move' : 'execute',
          committedCombatCandidate?.contextKey ?? actionContextFor('champion', primaryTarget), activeAllInCommit || canFinishWonFight ? 1.2 : 0.8);
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
              && u.hp / u.maxHp < 0.55 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u))
            // Ball Lightning is a no-target ability: use it at will to close a gap or finish a foe.
            || (u.champion.name === 'Raijin' && u.level >= 6 && u.cdUlt <= 0 && u.mana >= ultimateManaCost(u)
              && shouldCastNoTargetMobilityUltimate({
                healthFraction: u.hp / u.maxHp,
                targetDistance: dist,
                targetHealthFraction: primaryTarget.hp / primaryTarget.maxHp,
                targetUnderEnemyTurret: enemyStructures.some(st => st.type !== 'nexus'
                  && Math.hypot(primaryTarget.x - st.x, primaryTarget.y - st.y) <= st.range + 20),
                nearbyAllies: allies.filter(a => a.id !== u.id && Math.hypot(a.x - u.x, a.y - u.y) <= 320).length,
                nearbyEnemies: enemies.filter(e => Math.hypot(e.x - primaryTarget.x, e.y - primaryTarget.y) <= 320).length,
              })))) {
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
              u.x += Math.cos(angle) * (70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
              u.y += Math.sin(angle) * (70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
            }
          }

          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
            u.animState = 'attack';
            u.mana = Math.min(maxMana(u), u.mana + 3.5);
            performChampionAttack(u, primaryTarget);
          }
        }
        // 4. Close the Distance
        else {
          const isTargetUnderEnemyTower = nearestStructureForDive && nearestStructureForDive.isAlive
            && (nearestStructureForDive.type !== 'nexus' || !focusNexus)
            && Math.hypot(primaryTarget.x - nearestStructureForDive.x, primaryTarget.y - nearestStructureForDive.y) <= nearestStructureForDive.range;
          if (isTargetUnderEnemyTower && !isAggroDiving && nearestStructureForDive) {
            // Non-divers tether safely at the perimeter outside tower range rather than walking into turret fire!
            if (u.actionIntent?.kind === 'champion') {
              u.actionFailures = recordActionFailure(u.actionFailures, u.actionIntent,
                'unsafe', matchTimeRef.current);
              u.actionIntent = undefined;
            }
            const holdPoint = getTurretPerimeterHoldPoint(u, nearestStructureForDive);
            const distToHold = Math.hypot(holdPoint.x - u.x, holdPoint.y - u.y);
            setActionIntent('hold', { id: `tower-perimeter:${nearestStructureForDive.id}`,
              x: holdPoint.x, y: holdPoint.y }, distToHold > 14 ? 'move' : 'hold',
              `tower-perimeter:${nearestStructureForDive.id}:${alliedMinionsUnderTower}`, 0.8);
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
          const speed = 85 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0) + engageSprintBonus;
            u.vx = Math.cos(angle) * speed;
            u.vy = Math.sin(angle) * speed;
            u.x += u.vx * dt;
            u.y += u.vy * dt;
          }
        }
      }
      // A fight call pursues enemy champions; a finish call already returned from the objective branch.
      else if (selectedMacroAction === 'fight' && isObjectiveFight) {
        const enemyToEngage = primaryTarget
          || (contestEnemyPool.length > 0 ? contestEnemyPool[0] : null)
          || enemies.find(e => e.isAlive);

        if (enemyToEngage) {
          setActionIntent('champion', enemyToEngage, 'move',
            committedCombatCandidate?.contextKey ?? `objective-fight:${actionContextFor('champion', enemyToEngage)}`, 0.8);
          u.animState = 'walk';
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
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
          setActionIntent('regroup', { id: `objective-approach:${isContestingDragon ? 'dragon' : 'golem'}`,
            x: engageX, y: engageY }, 'move',
            `objective-approach:${isContestingDragon ? 'dragon' : 'golem'}`, 0.8);
          const speed = 90 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0);
          const angle = Math.atan2(engageY - u.y, engageX - u.x);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          setUnitFacing(u, engageX);
        }
      }
      // SIEGE TURRET
      else if (selectedMacroAction === 'wave' && clearWaveFirst && nearestMinion) {
        setActionIntent('minion', nearestMinion, 'execute');
        setUnitFacing(u, nearestMinion.x);
        const waveProfile = getWaveClearProfile(u.champion.name);
        const cluster = waveProfile ? enemyMinions.filter(m => isInsideWaveClear(m, nearestMinion, waveProfile)) : [];
        const stats = abilityItemStats(u);
        const waveDamage = abilityDamageFromStats(u.champion.skill1.damage, u.champion, 'skill1', stats.bonusAd, stats.bonusAp)
          * abilityDamageMultiplier(u.level, 'skill1') * (0.7 + lanStat / 180);
        const manaCost = skill1ManaCost(u);
        const haste = u.items.reduce((sum, item) => sum + (item.stats.haste ?? 0), 0);
        const cooldown = (u.champion.skill1.cooldown || 10) * 100 / (100 + haste) * abilityCooldownMultiplier(u.level, 'skill1');
        if (waveProfile && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= getSkillCastRange(u.champion.name, 'skill1', baseAttackRange)
          && shouldCastWaveClearSkill(u.champion.primaryRole, u.mana, u.cd1, cluster.length, iq, lanStat, {
            supported: true, manaCost, maxMana: maxMana(u), cooldownSeconds: cooldown,
            damage: waveDamage * (waveProfile.speed ? 0.55 : 1), basicDamage: u.champion.ad,
            minionHealth: cluster.map(m => m.hp), nearbyEnemies: enemies.filter(e => Math.hypot(e.x - u.x, e.y - u.y) <= 450).length,
            secondsUntilObjective: upcomingTempoObjective?.secondsUntil ?? Infinity,
            siegeOpportunity: structureInRange || tempoPush, teamfight: tfStat,
            laningDemon: personalityOf(u.player).includes('wave_architect'),
            macroStyle: (u.team === 'blue' ? blueCoach : redCoach)?.style === 'Objective Macro',
          })) {
          u.creepAttack = undefined;
          u.mana -= manaCost;
          recordAbilityCast(insightsRef.current, u, 'skill1', matchTimeRef.current);
          u.cd1 = cooldown;
          u.animState = 'cast';
          u.activeAbilitySlot = 'skill1';
          sound.playAvatarSkill(u.champion.name, 'skill1', u.x / ARENA_WIDTH * 2 - 1);
          if (waveProfile.speed) {
            fireFirstSkillshot(u, { ...nearestMinion, vx: 0, vy: 0 }, {
              waveClear: true, speed: waveProfile.speed, size: waveProfile.size,
              collisionRadius: waveProfile.collisionRadius, splashRadius: waveProfile.radius,
              type: u.champion.name === 'Skybreaker' ? 'flak_round' : 'orb',
            });
          } else {
            cluster.forEach(m => applyDamageToMinion(u, m, waveDamage));
            emitSkillEffect(u, nearestMinion, false, u.champion.skill1.name, 'skill1', waveProfile);
          }
        } else if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
          u.animState = 'attack';
          executeChampionAttack(u, nearestMinion, 'minion', u.champion.ad);
        }
      }
      else if (defenseCall) {
        // Never idle behind a dying structure: engage whoever is sieging it, within the defense leash
        // and outside enemy turret fire, instead of waiting at the rally point.
        const siegeChampion = defenseTarget || enemies
          .filter(enemy => defenseCall.attackers.some(attacker => attacker.id === enemy.id))
          .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
        const siegeUnderEnemyTurret = !!siegeChampion && enemyStructures.some(st =>
          st.type !== 'nexus' && Math.hypot(siegeChampion.x - st.x, siegeChampion.y - st.y) <= st.range + 20);
        if (siegeChampion && shouldChaseDefenseTarget(defenseCall.building, siegeChampion,
          { targetUnderEnemyTurret: siegeUnderEnemyTurret, healthFraction: u.hp / u.maxHp })) {
          const gap = Math.hypot(siegeChampion.x - u.x, siegeChampion.y - u.y);
          setActionIntent('defend', siegeChampion, gap > attackRange * 0.92 ? 'move' : 'execute',
            `defend:${defenseCall.building.id}:${actionContextFor('defend', siegeChampion)}`, 0.9);
          setUnitFacing(u, siegeChampion.x);
          if (gap > attackRange * 0.92) {
            const angle = Math.atan2(siegeChampion.y - u.y, siegeChampion.x - u.x);
            const chaseSpeed = 88 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u);
            u.vx = Math.cos(angle) * chaseSpeed; u.vy = Math.sin(angle) * chaseSpeed;
            u.x += u.vx * dt; u.y += u.vy * dt;
            u.animState = 'walk';
          } else {
            u.vx = 0; u.vy = 0;
            if (u.attackTimer <= 0) {
              u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
              u.animState = 'attack';
              performChampionAttack(u, siegeChampion);
            }
          }
          return;
        }
        const waveTarget = defenseMinion;
        // Step into range of siege creeps, but never pursue them outside the defensive zone.
        if (waveTarget && !defenseTarget) {
          const gap = Math.hypot(waveTarget.x - u.x, waveTarget.y - u.y);
          if (gap > attackRange) {
            const stop = Math.max(0, gap - attackRange + 5) / Math.max(1, gap);
            defenseCall.rally = { x: u.x + (waveTarget.x - u.x) * stop, y: u.y + (waveTarget.y - u.y) * stop };
          }
        }
        setActionIntent('defend', defenseCall.building,
          defenseCall.distance > 12 ? 'move' : 'hold',
          `defend:${defenseCall.building.id}:${defenseCall.attackers.length}:${defenseCall.wave.length}`, 0.9);
        moveToDefense();
      }
      else if (nearestStructure && structureInRange) {
        setActionIntent('structure', nearestStructure, 'execute');
        setUnitFacing(u, nearestStructure.x);
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
          u.animState = 'attack';
          executeChampionAttack(u, nearestStructure, 'structure', u.champion.ad);
        }
      }
      // WAVE CLEAR
      else if (nearestMinion && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= attackRange) {
        setActionIntent('minion', nearestMinion, 'execute');
        setUnitFacing(u, nearestMinion.x);
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / getEffectiveAttackSpeed(u);
          u.animState = 'attack';
          executeChampionAttack(u, nearestMinion, 'minion', u.champion.ad);
        }
      }
      // PUSH LANE IN FORMATION (Smooth, natural walking speed - no snapping or accelerated sprint!)
      else {
        u.animState = 'walk';
        const pushDir = u.team === 'blue' ? 1 : -1;
        if (residualPushPlan.kind === 'camp-exit') {
          const waypoint = residualPushPlan.target;
          const distance = Math.hypot(waypoint.x - u.x, waypoint.y - u.y);
          setActionIntent('push', waypoint,
            distance > 8 ? 'move' : 'hold', waypoint.id, 0.8);
          const speed = Math.min(70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u)
            + ((u.stealthTimer ?? 0) > 0 ? 60 : 0), distance / dt);
          const angle = Math.atan2(waypoint.y - u.y, waypoint.x - u.x);
          u.vx = Math.cos(angle) * speed;
          u.vy = Math.sin(angle) * speed;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
          setUnitFacing(u, waypoint.x);
          return;
        }
        const targetFormY = residualPushPlan.target.y;
        const advanceDistance = Math.hypot(advanceLimit - u.x, targetFormY - u.y);
        setActionIntent(advanceDistance <= 3 ? 'hold' : 'push',
          residualPushPlan.target,
          advanceDistance <= 3 ? 'hold' : 'move',
          `lane:${u.team}:${Math.floor(advanceLimit / 40)}:${enemyMinions.length}`, 0.8);
        if (advanceDistance <= 3) {
          u.vx = 0;
          u.vy = 0;
          u.animState = 'idle';
          return;
        }
        const nextX = u.x + pushDir * (70 + (u.boots?.stats.moveSpeed ?? 0) + getKaelenMovementAdjustment(u) + ((u.stealthTimer ?? 0) > 0 ? 60 : 0)) * dt;
        u.x = wouldOverstep(u.team, nextX, advanceLimit)
          ? u.x + Math.sign(advanceLimit - u.x) * Math.min(Math.abs(advanceLimit - u.x), 70 * dt)
          : nextX;
        u.facing = pushDir === 1 ? 'right' : 'left';

        const dy = targetFormY - u.y;
        if (Math.abs(dy) > 1.5) {
          u.y += Math.sign(dy) * Math.min(Math.abs(dy), 70 * dt);
        }
      }

      u.x = Math.max(40, Math.min(ARENA_WIDTH - 40, u.x));
      u.y = Math.max(80, Math.min(620, u.y));
      } finally {
        // Release after this actor's safety/decision pass, even when that pass returns early.
        // Later actors observe the resulting damage in the original roster order.
        settleCreepAttack(u);
        if (auditedMacro) {
          const auditWindow = window as Window & { __esportsMacroExecutionAudit?: {
            counts: Record<string, number>; regroupPaths: Record<string, number>; samples: unknown[];
            pushPlans?: { total: number; mismatches: number; examples: unknown[] } } };
          const audit = (auditWindow.__esportsMacroExecutionAudit ??= { counts: {}, regroupPaths: {}, samples: [] });
          const key = `${auditedMacro.selected}:${u.actionIntent?.kind ?? 'none'}`;
          audit.counts[key] = (audit.counts[key] ?? 0) + 1;
          if (auditedMacro.pushPlan) {
            const plans = (audit.pushPlans ??= { total: 0, mismatches: 0, examples: [] });
            const plan = auditedMacro.pushPlan;
            const expectedIntent = plan.kind === 'structure' || plan.kind === 'minion' ? plan.kind : 'push';
            const matched = (u.actionIntent?.kind === expectedIntent
              || expectedIntent === 'push' && u.actionIntent?.kind === 'hold')
              && u.actionIntent?.targetId === plan.target.id;
            plans.total++;
            if (!matched) {
              plans.mismatches++;
              if (plans.examples.length < 12) plans.examples.push({ second: matchTimeRef.current,
                actorId: u.id, plan, intent: u.actionIntent });
            }
          }
          if (auditedMacro.selected === 'regroup') {
            const path = u.actionIntent?.contextKey.split(':')[0] ?? 'none';
            audit.regroupPaths[path] = (audit.regroupPaths[path] ?? 0) + 1;
          }
          if (audit.counts[key] <= 3) audit.samples.push({ second: matchTimeRef.current,
            actorId: u.id, selected: auditedMacro.selected, intent: u.actionIntent?.kind,
            distanceMoved: Math.hypot(u.x - auditedMacro.x, u.y - auditedMacro.y),
            animState: u.animState, cd1: u.cd1, cd2: u.cd2, cdUlt: u.cdUlt,
            damageDealt: u.damageDealt });
        }
      }
    });

    // 13. PAIRWISE ANTI-CLUMPING SEPARATION PHYSICS
    for (let i = 0; i < champs.length; i++) {
      for (let j = i + 1; j < champs.length; j++) {
        const c1 = champs[i];
        const c2 = champs[j];
        if (!c1.isAlive || !c2.isAlive || !shouldSeparateUnitsByTeam(c1.team, c2.team)) continue;

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
    const psychology = deriveTeamPsychology(allies);
    const personalityPressure = allies.reduce((sum, ally) => sum + personalityActionDelta(ally.player,
      ensurePsychology(ally.player, ally.psychology), 'objective', psychology), 0) / Math.max(1, allies.length);
    const preference = objectiveFightPreference(allies.map(c => c.player), team === 'blue' ? blueCoach : redCoach) + personalityPressure;
    const action = choosePostObjectiveAction({ fightPreference: preference,
      nearbyEnemies: nearbyEnemies.length,
      healthyAllies: nearbyAllies.filter(c => c.hp / c.maxHp > 0.45).length,
      healthyEnemies: nearbyEnemies.filter(c => c.hp / c.maxHp > 0.45).length,
      averageHealthFraction: nearbyAllies.reduce((sum, c) => sum + c.hp / c.maxHp, 0) / Math.max(1, nearbyAllies.length) });
    postObjectivePlanRef.current[team] = { x, y, action,
      startedAt: matchTimeRef.current, until: matchTimeRef.current + 6 };
    const eventId = `objective:${name}:${Math.floor(matchTimeRef.current * 10)}:${team}`;
    const iglCallSucceeded = nearbyAllies.some(ally => ally.id === psychology.iglId && (ally.shotcallSignalTimer ?? 0) > 0);
    recordTeamPsychologyEvent(team, eventId, nearbyEnemies.length >= 2 ? 'objective_steal' : 'coordination', iglCallSucceeded ? 'success' : undefined);
    if (nearbyEnemies.length >= 2) recordTeamPsychologyEvent(team, `${eventId}:coordination`, 'coordination');
    const opposingTeam = team === 'blue' ? 'red' : 'blue';
    const opposingPsychology = deriveTeamPsychology(championsRef.current.filter(unit => unit.team === opposingTeam));
    const iglCallFailed = nearbyEnemies.some(enemy => enemy.id === opposingPsychology.iglId && (enemy.shotcallSignalTimer ?? 0) > 0);
    if (nearbyEnemies.length >= 2) recordTeamPsychologyEvent(opposingTeam, eventId, 'objective_loss', iglCallFailed ? 'failure' : undefined);
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
    camp.damageContributors ??= {};
    camp.damageContributors[attacker.id] = (camp.damageContributors[attacker.id] ?? 0) + damage;
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
      const contributorIds = championsRef.current
        .filter(champion => champion.team === attacker.team && (camp.damageContributors?.[champion.id] ?? 0) > 0)
        .map(champion => champion.id);
      const rewardShares = shareJungleCampRewards(camp.goldReward, camp.xpReward, contributorIds, attacker.id);
      rewardShares.forEach(share => {
        const participant = championsRef.current.find(champion => champion.id === share.id);
        if (!participant) return;
        participant.gold += share.gold;
        recordPairedTaskEvent(participant.id, 'camp-share', camp.id, share.gold);
        grantChampionXp(participant, share.xp);
        floatsRef.current.push({
          id: random().toString(),
          x: participant.x,
          y: participant.y - 30,
          text: `+${share.gold}g / +${share.xp} XP 🌲`,
          color: '#facc15',
          opacity: 1,
          scale: 1.1,
        });
      });
      camp.damageContributors = undefined;
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
        text: `${rewardShares.length} CAMP HELPERS`,
        color: '#facc15',
        opacity: 1,
        scale: 1.2
      });

      addEvent(`🌲 JUNGLE: ${attacker.player.name} secured ${camp.name}; ${rewardShares.length} contributor${rewardShares.length === 1 ? '' : 's'} shared ${camp.goldReward}g and ${camp.xpReward} XP.`, 'jungle');
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
    if (personalityOf(target.player).includes('cold_as_ice')) {
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
        const triggersKindraHunt = !!attackerChamp && shouldTriggerKindraHunt(
          attackerChamp.champion.name, 'champion', targetChamp.hp / targetChamp.maxHp
        );
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
            if (p.waveClear) {
              const stats = abilityItemStats(attackerChamp);
              const damage = abilityDamageFromStats(p.damage, attackerChamp.champion, 'skill1', stats.bonusAd, stats.bonusAp)
                * abilityDamageMultiplier(attackerChamp.level, 'skill1') * (0.7 + attackerChamp.player.stats.lan / 180);
              minionsRef.current.filter(m => m.isAlive && m.team !== attackerChamp.team
                && Math.hypot(m.x - targetChamp.x, m.y - targetChamp.y) <= p.splashRadius!)
                .forEach(m => applyDamageToMinion(attackerChamp, m, damage * 0.55));
            }
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
          if (attackerChamp) emitSkillEffect(attackerChamp, targetChamp, false, p.skillLabel, 'skill1',
            p.waveClear ? getWaveClearProfile(attackerChamp.champion.name) : undefined);
          if (p.comboStage && attackerChamp?.comboStage === p.comboStage && attackerChamp.comboTargetId === targetChamp.id) {
            attackerChamp.comboHitConfirmed = true;
            attackerChamp.mana = Math.min(maxMana(attackerChamp), attackerChamp.mana + 45);
          }
          return;
        }
        applyDamageToChampion(attackerChamp || null, targetChamp, p.damage, !!p.trueDamage || p.type === 'turret_shot',
          p.trueDamage ? 'Nexus True Strike' : p.type === 'turret_shot' ? '🏰 Turret' : p.type === 'boss_breath' ? '🔥 Flame Breath'
            : p.type === 'jungle_shot' ? '🌲 Jungle Camp' : undefined);
        if (attackerChamp && triggersKindraHunt) triggerKindraHunt(attackerChamp);
        if (p.flakSplashRatio && attackerChamp) {
          const splashDamage = p.damage * p.flakSplashRatio;
          championsRef.current.filter(enemy => enemy.team !== attackerChamp.team && enemy.isAlive
            && enemy.id !== targetChamp.id && Math.hypot(enemy.x - targetChamp.x, enemy.y - targetChamp.y) <= 72)
            .sort((a, b) => Math.hypot(a.x - targetChamp.x, a.y - targetChamp.y)
              - Math.hypot(b.x - targetChamp.x, b.y - targetChamp.y))
            .slice(0, 3)
            .forEach(enemy => applyDamageToChampion(attackerChamp, enemy, splashDamage, false, 'Flak Shrapnel', 'skill1', true));
          minionsRef.current.filter(minion => minion.team !== attackerChamp.team && minion.isAlive
            && Math.hypot(minion.x - targetChamp.x, minion.y - targetChamp.y) <= 72)
            .slice(0, 3)
            .forEach(minion => applyDamageToMinion(attackerChamp, minion, splashDamage));
          spellsRef.current.push({ id: random().toString(), type: 'flak_shrapnel',
            x: targetChamp.x, y: targetChamp.y, radius: 72, duration: 0.38, maxDuration: 0.38,
            color: '#fb923c', avatarName: 'Skybreaker', abilitySlot: 'skill1' });
        }
      } else if (targetMinion) {
        if (attackerChamp) {
          if (p.waveClear) {
            const stats = abilityItemStats(attackerChamp);
            const damage = abilityDamageFromStats(p.damage, attackerChamp.champion, 'skill1', stats.bonusAd, stats.bonusAp)
              * abilityDamageMultiplier(attackerChamp.level, 'skill1') * (0.7 + attackerChamp.player.stats.lan / 180);
            applyDamageToMinion(attackerChamp, targetMinion, damage);
            minionsRef.current.filter(m => m.isAlive && m.team !== attackerChamp.team && m.id !== targetMinion.id
              && Math.hypot(m.x - targetMinion.x, m.y - targetMinion.y) <= (p.splashRadius ?? 0))
              .forEach(m => applyDamageToMinion(attackerChamp, m, damage * 0.55));
            emitSkillEffect(attackerChamp, targetMinion, false, p.skillLabel, 'skill1', getWaveClearProfile(attackerChamp.champion.name));
          } else applyDamageToMinion(attackerChamp, targetMinion, p.damage * (p.skillshot ? abilityDamageMultiplier(attackerChamp.level, p.abilitySlot ?? 'skill1') : 1));
          if (p.flakSplashRatio) {
            const splashDamage = p.damage * p.flakSplashRatio;
            minionsRef.current.filter(minion => minion.team !== attackerChamp.team && minion.isAlive
              && minion.id !== targetMinion.id && Math.hypot(minion.x - targetMinion.x, minion.y - targetMinion.y) <= 72)
              .sort((a, b) => Math.hypot(a.x - targetMinion.x, a.y - targetMinion.y)
                - Math.hypot(b.x - targetMinion.x, b.y - targetMinion.y))
              .slice(0, 3)
              .forEach(minion => applyDamageToMinion(attackerChamp, minion, splashDamage));
            championsRef.current.filter(enemy => enemy.team !== attackerChamp.team && enemy.isAlive
              && Math.hypot(enemy.x - targetMinion.x, enemy.y - targetMinion.y) <= 72)
              .slice(0, 2)
              .forEach(enemy => applyDamageToChampion(attackerChamp, enemy, splashDamage, false, 'Flak Shrapnel', 'skill1', true));
            spellsRef.current.push({ id: random().toString(), type: 'flak_shrapnel',
              x: targetMinion.x, y: targetMinion.y, radius: 72, duration: 0.38, maxDuration: 0.38,
              color: '#fb923c', avatarName: 'Skybreaker', abilitySlot: 'skill1' });
          }
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
          if (shouldTriggerKindraHunt(attackerChamp.champion.name, 'camp')) triggerKindraHunt(attackerChamp);
        } else if (dragonRef.current.id === p.targetUnitId && dragonRef.current.isAlive && attackerChamp) {
          applyDamageToDragon(attackerChamp, p.damage);
          if (shouldTriggerKindraHunt(attackerChamp.champion.name, 'dragon')) triggerKindraHunt(attackerChamp);
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
      case 'Skybreaker':
        return { type: 'flak_round', color: '#fb923c', speed: 680, size: 8 };
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
  const settleCreepAttack = (u: AramChampionUnit) => {
    const pending = u.creepAttack;
    if (!pending) return;
    const target = pending.targetType === 'minion' ? minionsRef.current.find(m => m.id === pending.targetId)
      : pending.targetType === 'camp' ? jungleCampsRef.current.find(c => c.id === pending.targetId) : dragonRef.current;
    const attackRange = getLiveBasicAttackRange(u);
    const reach = pending.targetType === 'minion' ? attackRange
      : neutralAttackRange(attackRange, pending.targetType === 'dragon' || pending.targetId === 'j_siege_golem') + 12;
    const interrupted = !u.isAlive || !!u.isRecalling || u.committedState === 'retreat'
      || u.stunTimer > 0 || u.charmTimer > 0 || (u.fearTimer ?? 0) > 0 || (u.knockupTimer ?? 0) > 0
      || !!u.zhonyaActive || isChannelingAbility(u) || u.animState === 'cast'
      || (!!u.actionIntent && u.actionIntent.targetId !== pending.targetId);
    const result = advanceCreepAttack(pending, matchTimeRef.current, interrupted,
      !!target?.isAlive && Math.hypot(target.x - u.x, target.y - u.y) <= reach);
    u.creepAttack = result.state;
    if (result.release && target) executeChampionAttack(u, target, pending.targetType, pending.damage, true);
  };

  const executeChampionAttack = (
    u: AramChampionUnit,
    target: { id: string; x: number; y: number },
    targetType: 'champion' | 'minion' | 'structure' | 'camp' | 'dragon',
    baseDamage: number,
    releaseCreepAttack = false
  ) => {
    const attackRange = getLiveBasicAttackRange(u);
    if (!releaseCreepAttack && (targetType === 'minion' || targetType === 'camp' || targetType === 'dragon')) {
      if (!u.creepAttack || u.creepAttack.released) {
        u.creepAttack = startCreepAttack(target.id, targetType, baseDamage, matchTimeRef.current, 1 / getEffectiveAttackSpeed(u));
      }
      return;
    }
    if (targetType === 'structure') {
      const structureTarget = structuresRef.current.find(candidate => candidate.id === target.id);
      if (!structureTarget || !canBasicAttackStructure({ x: u.x, y: u.y, attackRange }, structureTarget)) return;
    }
    if ((targetType === 'camp' || targetType === 'dragon')
      && Math.hypot(target.x - u.x, target.y - u.y)
        > neutralAttackRange(attackRange, targetType === 'dragon' || target.id === 'j_siege_golem') + 12) return;
    sound.playSpellHit();
    if (u.champion.name === 'Skybreaker') {
      u.propellaRotorStacks = propellaRotorStacksAfterAttack(u.propellaRotorStacks ?? 0);
      u.propellaRotorTimer = PROPELLA_ROTOR_STACK_SECONDS;
    }

    let bonusAd = 0;
    let persistentStructureBonus = 0;
    const hasInfinity = u.items.some((it) => it.id === 'item_infinity_edge');
    const critChance = Math.min(0.85, 0.1 + u.items.reduce((total, item) => total + (item.stats.crit ?? 0) / 100, 0));
    const isCrit = random() < critChance;
    if (isCrit) bonusAd += u.champion.ad * (hasInfinity ? 1.25 : 0.75);

    if (aegisBuffRef.current?.team === u.team) {
      bonusAd += aegisBuffRef.current.adBonus;
      persistentStructureBonus += aegisBuffRef.current.adBonus;
    }
    if (jungleBuffsRef.current[u.team].red > matchTimeRef.current) {
      bonusAd += 28;
      persistentStructureBonus += 28;
    }

    const champTarget = targetType === 'champion' ? championsRef.current.find(c => c.id === target.id) : null;
    if (u.champion.name === 'Faelith' && (targetType === 'champion' || targetType === 'minion')) {
      bonusAd += 11 + Math.min(15, u.level);
    }

    // Kraken Slayer: Bring It Down (Every 3rd attack deals bonus damage scaling with target missing HP)
    const hasKraken = u.items.some((it) => it.id === 'item_kraken_slayer');
    if (hasKraken && targetType !== 'structure') {
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
    if (hasBork && targetType !== 'structure') {
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
    if (targetType !== 'structure' && lifestealPercent > 0 && u.hp < u.maxHp) {
      const healAmount = Math.round((baseDamage + bonusAd) * (lifestealPercent / 100) * 0.65);
      u.hp = Math.min(u.maxHp, u.hp + healAmount);
    }

    // Navori Quickblades: basic attacks refund non-ultimate ability cooldowns
    if (targetType !== 'structure' && u.items.some((it) => it.id === 'item_navori')) {
      u.cd1 = Math.max(0, u.cd1 - 0.7);
      u.cd2 = Math.max(0, u.cd2 - 0.7);
    }

    // Unique Card Traits Attack Modifiers
    const overchargeMultiplier = (u.aetherisOverchargeTimer ?? 0) > 0 ? 1.15 : 1;
    const totalDmg = targetType === 'structure'
      ? structureBasicAttackDamage({ baseAttackDamage: baseDamage, persistentAttackBonus: persistentStructureBonus,
        criticalBonus: isCrit ? u.champion.ad * (hasInfinity ? 1.25 : 0.75) : 0,
        championOnHitBonus: bonusAd - persistentStructureBonus, temporaryCombatMultiplier: overchargeMultiplier })
      : (baseDamage + bonusAd) * overchargeMultiplier
        * getKindraHuntDamageMultiplier(u.champion.name, u.kindraHuntTimer ?? 0);
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
          creepAttackTarget: targetType === 'minion' ? 'minion' : undefined,
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
        for (const spread of [-1.5, -0.5, 0.5, 1.5]) {
          projectilesRef.current.push({
            id: random().toString(),
            x: originX,
            y: originY,
            targetX: target.x,
            targetY: targetCenterY + spread * 8,
            vx: 0,
            vy: 0,
            speed: proj.speed,
            color: proj.color,
            type: 'pellet',
            size: proj.size,
            targetUnitId: target.id,
            creepAttackTarget: releaseCreepAttack ? targetType as 'minion' | 'camp' | 'dragon' : undefined,
            damage: totalDmg / 4,
            attackerId: u.id,
            angle: angle + spread * 0.08
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
          creepAttackTarget: releaseCreepAttack ? targetType as 'minion' | 'camp' | 'dragon' : undefined,
          damage: totalDmg,
          attackerId: u.id,
          angle,
          flakSplashRatio: u.champion.name === 'Skybreaker' && (targetType === 'champion' || targetType === 'minion')
            ? propellaFlakSplashRatio(u.level, (u.propellaGunshipTimer ?? 0) > 0)
            : undefined
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
    target: { x: number; y: number },
    ultimate = false,
    label = '',
    explicitSlot?: SkillSlot,
    waveGeometry?: { radius: number; halfWidth?: number; halfHeight?: number }
  ) => {
    const abilitySlot: SkillSlot = explicitSlot ?? (ultimate ? 'ultimate'
      : (label === u.champion.skill2.name ? 'skill2' : 'skill1'));
    spellsRef.current.push({
      id: random().toString(),
      type: waveGeometry ? 'wave_clear_impact' : ultimate ? 'ultimate_burst' : 'skill_burst',
      x: target.x, y: target.y,
      sourceX: u.x, sourceY: u.y,
      radius: waveGeometry?.radius ?? (ultimate ? (u.champion.name === 'Stonewake' ? 155 : u.champion.name === 'Soulscourge' ? 115 : 94) : 52),
      halfWidth: waveGeometry?.halfWidth, halfHeight: waveGeometry?.halfHeight,
      duration: ultimate ? 1.3 : 0.9,
      maxDuration: ultimate ? 1.3 : 0.9,
      color: ultimate ? u.champion.accentColor : u.champion.primaryColor,
      extraText: label,
      avatarName: u.champion.name,
      abilitySlot,
    });
  };

  const fireFirstSkillshot = (u: AramChampionUnit, target: { id: string; x: number; y: number; vx: number; vy: number }, spec: Partial<Projectile>) => {
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
      waveClear: spec.waveClear,
    });
    if (!spec.waveClear) emitSkillEffect(u, target, false, u.champion.skill1.name);
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
    sound.playAvatarSkill(u.champion.name, 'skill1', u.x / ARENA_WIDTH * 2 - 1);
    emitSkillEffect(u, target, false, u.champion.skill1.name, 'skill1');

    if (u.champion.name === 'Solana') {
      applyChampionCrowdControl(u, target, 1.2, 'stun', '☀️ Solar Shieldbash');
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, '☀️ Solar Shieldbash');
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
      u.dash = { kind: 'renn_vault', startX: u.x, startY: u.y, targetX: target.x, targetY: target.y, targetId: target.id,
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
        u.dash = { kind: 'cinder_lunge', startX: u.x, startY: u.y, targetX: target.x - (target.x >= u.x ? 22 : -22), targetY: target.y,
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
      u.dash = { kind: 'valerie_punch', startX: u.x, startY: u.y,
        targetX: target.x + (u.team === 'blue' ? -25 : 25), targetY: target.y, targetId: target.id,
        remaining: .65, speed: 385, damage: u.champion.skill1.damage };
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
    } else if (u.champion.name === 'Skybreaker') {
      fireFirstSkillshot(u, target, {
        type: 'flak_round', speed: 660, size: 11, collisionRadius: 18, splashRadius: 105
      });
      addEvent(`FLAKBURST: ${u.player.name} fired a high-velocity flak shell into the formation!`, 'combo');
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
    fallbackDirection: -1 | 1
  ) => {
    const destination = getGroundTargetPoint(
      u,
      target ? { x: target.x, y: target.y } : undefined,
      fallbackDirection,
      320,
      { minX: 60, maxX: ARENA_WIDTH - 60, minY: 90, maxY: 610 }
    );
    // applyDamageToChampion owns rank and item scaling; dash state keeps authored base damage.
    const damage = u.champion.ultimate.damage;
    const hitIds: string[] = [];
    u.activeAbilitySlot = 'ultimate';
    recordAbilityCast(insightsRef.current, u, 'ultimate', matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, 'ultimate', u.x / ARENA_WIDTH * 2 - 1);
    u.dash = {
      kind: 'raijin_bolt', startX: u.x, startY: u.y,
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
    addEvent(`⚡ BALL LIGHTNING: ${u.player.name} launched toward a ground point!`, 'combo');
  };

  const castKaelenOrb = (u: AramChampionUnit, element: KaelenElement) => {
    const slot: SkillSlot = element === 'ice' ? 'skill1' : element === 'wind' ? 'skill2' : 'ultimate';
    const castSlot = element === 'ice' ? 'orbQ' : element === 'wind' ? 'orbW' : 'orbE';
    if (u.mana < KAELEN_ORB_MANA) return false;
    u.mana -= KAELEN_ORB_MANA;
    u.kaelenOrbs = appendKaelenOrb(u.kaelenOrbs ?? [], element);
    u.activeAbilitySlot = slot;
    recordAbilityCast(insightsRef.current, u, castSlot, matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, slot, u.x / ARENA_WIDTH * 2 - 1);
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
    sound.playAvatarSkill(u.champion.name, 'ultimate', u.x / ARENA_WIDTH * 2 - 1);
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
    u: AramChampionUnit, spell: (typeof KAELEN_INVOKED_SPELLS)[number],
    target: AramChampionUnit, slotIndex: number,
  ) => {
    if ((u.kaelenSpellCooldowns?.[spell.id] ?? 0) > 0 || u.mana < spell.mana) return false;
    const alliedTarget = spell.targeting === 'ally'
      ? championsRef.current.filter(ally => ally.team === u.team && ally.isAlive && Math.hypot(ally.x - u.x, ally.y - u.y) <= spell.range)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? u
      : undefined;
    const castTarget = alliedTarget ?? target;
    if (Math.hypot(castTarget.x - u.x, castTarget.y - u.y) > spell.range) return false;
    const destination = spell.targeting === 'ally' ? { x: castTarget.x, y: castTarget.y } : getGroundTargetPoint(
      u, { x: target.x, y: target.y }, u.team === 'blue' ? 1 : -1, spell.range,
      { minX: 40, maxX: ARENA_WIDTH - 40, minY: 80, maxY: 620 });
    u.mana -= spell.mana;
    u.kaelenSpellCooldowns ??= {};
    u.kaelenSpellCooldowns[spell.id] = spell.cooldown;
    u.activeAbilitySlot = slotIndex === 0 ? 'skill1' : 'skill2';
    u.animState = 'cast';
    recordAbilityCast(insightsRef.current, u, slotIndex === 0 ? 'invokedD' : 'invokedF', matchTimeRef.current);
    sound.playAvatarSkill(u.champion.name, u.activeAbilitySlot, u.x / ARENA_WIDTH * 2 - 1);
    if (spell.shield) {
      championsRef.current.filter(ally => ally.team === u.team && ally.isAlive && Math.hypot(ally.x - destination.x, ally.y - destination.y) <= spell.radius).forEach(ally => {
        const priorEquinox = ally.kaelenEquinoxShield ?? 0;
        ally.shield += Math.max(0, spell.shield!.amount - priorEquinox);
        ally.kaelenEquinoxShield = spell.shield!.amount;
        ally.kaelenEquinoxTimer = spell.shield!.duration;
        ally.kaelenEquinoxMoveSpeed = spell.shield!.moveSpeed;
      });
    }
    if (spell.summon) {
      const wardenId = `prism-warden-${u.id}`;
      const existing = minionsRef.current.find(minion => minion.prismWardenOwnerId === u.id && minion.isAlive);
      if (existing) {
        existing.x = destination.x; existing.y = destination.y; existing.hp = existing.maxHp = spell.summon.health;
        existing.prismWardenFocusId = target.id; existing.prismWardenExpiresAt = matchTimeRef.current + spell.summon.duration;
      } else minionsRef.current.push({ id: wardenId, team: u.team, type: 'caster', x: destination.x, y: destination.y,
        hp: spell.summon.health, maxHp: spell.summon.health, ad: spell.summon.attackDamage, range: 155, speed: 82,
        attackTimer: 0, goldReward: 0, xpReward: 0, isAlive: true, prismWardenOwnerId: u.id,
        prismWardenFocusId: target.id, prismWardenExpiresAt: matchTimeRef.current + spell.summon.duration });
      sound.playCoin();
    }
    const cast: KaelenCast = { spellId: spell.id, origin: { x: u.x, y: u.y }, aim: destination,
      elapsed: 0, hitIds: [], resolved: false };
    const lifetime = kaelenCastLifetime(spell);
    spellsRef.current.push({ id: random().toString(), type: 'kaelen_invoke',
      ...kaelenCastPosition(cast, spell), duration: lifetime, maxDuration: lifetime,
      color: spell.color, extraText: spell.name, sourceUnitId: u.id, kaelenCast: cast });
    addEvent(u.player.name + ' cast ' + spell.name + '!', 'combo');
    return true;
  };

  const processKaelenTurn = (u: AramChampionUnit, target: AramChampionUnit | undefined, enemies: AramChampionUnit[]) => {
    if (!target || !target.isAlive || target.zhonyaActive || (target.untargetableTimer ?? 0) > 0
      || u.isRecalling || (u.kaelenActionTimer ?? 0) > 0) return false;
    const nearbyAllies = championsRef.current.filter(ally => ally.team === u.team && ally.isAlive && Math.hypot(ally.x - u.x, ally.y - u.y) < 260);
    const needsProtection = nearbyAllies.filter(ally => ally.hp / ally.maxHp < .5).length;
    const cluster = enemies.filter(enemy => Math.hypot(enemy.x - target.x, enemy.y - target.y) < 145).length;
    const gravemarch = jungleCampsRef.current.find(camp => camp.type === 'siege_golem' && camp.isAlive);
    const objectiveFight = Math.hypot(u.x - DRAGON_X, u.y - LANE_Y) < 260
      || !!gravemarch && Math.hypot(u.x - gravemarch.x, u.y - gravemarch.y) < 260;
    let combo = u.kaelenComboId && u.kaelenPlanExpiresAt && u.kaelenPlanExpiresAt > matchTimeRef.current && u.kaelenComboTargetId === target.id
      ? { id: u.kaelenComboId, name: u.kaelenTacticalGoal ?? 'Adaptive Conflux', spells: [] as string[], tacticalGoal: u.kaelenTacticalGoal ?? 'adaptive pressure' }
      : undefined;
    // The plan is rebuilt from current resources and threat, not pinned to a preset rotation.
    if (!combo) {
      const plan = chooseKaelenPlan({ healthFraction: u.hp / u.maxHp, enemyDistance: Math.hypot(target.x - u.x, target.y - u.y),
        clusteredEnemies: cluster, threatenedAllies: needsProtection, objectiveFight, defending: u.hp / u.maxHp < .58,
        mana: u.mana, iq: u.player.stats.iq, cooldowns: u.kaelenSpellCooldowns ?? {}, cycle: u.kaelenComboCycle ?? 0,
        personality: personalityOf(u.player) });
      if (!plan) return false;
      u.kaelenComboId = plan.id; u.kaelenComboStep = 0; u.kaelenComboTargetId = target.id;
      u.kaelenPlanExpiresAt = matchTimeRef.current + 7; u.kaelenTacticalGoal = plan.tacticalGoal;
      // Store the evolving spell IDs under the existing plan ID as a local dynamic sequence.
      u.kaelenInvokedSlots ??= [];
      u.kaelenPlanSpells = plan.spells;
      combo = { ...plan };
      addEvent(`🔮 ARSENALDO PLAN: ${plan.tacticalGoal} · ${plan.spells.length} legal spell${plan.spells.length === 1 ? '' : 's'} queued.`, 'combo');
    }
    const planSpells = u.kaelenPlanSpells ?? combo.spells;
    const step = u.kaelenComboStep ?? 0;
    const desired = KAELEN_INVOKED_SPELLS.find(spell => spell.id === planSpells[step]);
    if (!desired) { u.kaelenComboId = undefined; return false; }
    const slots = u.kaelenInvokedSlots ?? [];
    // Preload two slots when legal; each successful cast makes space for later reinvocation.
    const prepareId = !slots.includes(desired.id) ? desired.id
      : step === 0 && !slots.includes(planSpells[1] ?? '') ? planSpells[1] : undefined;
    let acted = false;
    if (prepareId) {
      const spell = KAELEN_INVOKED_SPELLS.find(spell => spell.id === prepareId)!;
      const current = u.kaelenOrbs ?? [];
      if (getKaelenInvokedSpell(current)?.id === spell.id) {
        acted = castKaelenConflux(u);
      } else {
        // Preserve the longest FIFO suffix matching the next recipe prefix.
        acted = castKaelenOrb(u, nextKaelenRecipeOrb(current, spell.recipe));
      }
    } else {
      // Wait for the opening projectile/telegraph to connect. On a miss, release
      // the sequence instead of firing the finisher at a stale landing point.
      const pending = spellsRef.current.find(effect => effect.sourceUnitId === u.id && effect.kaelenCast
        && effect.kaelenCast.spellId === planSpells[step - 1]);
      if (step > 0 && u.kaelenLastSpellHitAt === undefined && pending?.kaelenCast && !pending.kaelenCast.resolved) return false;
      if (step > 0 && u.kaelenLastSpellHitAt === undefined && desired.targeting === 'ground' && cluster < 2) {
        u.kaelenComboId = undefined; return false;
      }
      acted = castKaelenInvokedSpell(u, desired, target, slots.indexOf(desired.id));
      if (acted) {
        if (step === 0) addEvent(u.player.name + ' begins ' + (u.kaelenTacticalGoal ?? 'an adaptive Conflux plan') + '.', 'combo');
        u.kaelenComboStep = step + 1;
        u.kaelenAwaitSpellId = desired.id;
        u.kaelenLastSpellHitAt = undefined;
        if (step + 1 >= planSpells.length) {
          u.kaelenComboId = undefined;
          u.kaelenPlanExpiresAt = undefined;
          u.kaelenComboCycle = (u.kaelenComboCycle ?? 0) + 1;
        }
      }
    }
    if (acted) u.kaelenActionTimer = KAELEN_ACTION_INTERVAL;
    return acted;
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
    sound.playAvatarSkill(u.champion.name, 'skill2', u.x / ARENA_WIDTH * 2 - 1);
    emitSkillEffect(u, name === 'Aetheris' ? aetherisOverchargeTarget ?? u
      : name === 'Cinderlock' || name === 'Cinderbloom' || name === 'Renn' || name === 'Solana' || name === 'Veyara' ? u : target, false, skill.name, 'skill2');

    if (name === 'Solana') {
      const landingX = target.x + (u.team === 'blue' ? -28 : 28);
      u.dash = { kind: 'solana_lance', startX: u.x, startY: u.y, targetX: landingX, targetY: target.y, targetId: target.id,
        remaining: .72, speed: 400, damage: skill.damage };
    } else if (name === 'Kyumi') {
      target.charmTimer = 1.4;
      target.charmSourceId = u.id;
      addEvent(`💖 CHARM: Kyumi charmed ${target.player.name} with Charm of Longing!`, 'combo');
    } else if (name === 'Buck') {
      spellsRef.current.push({ id: random().toString(), type: 'smoke_screen',
        x: target.x, y: target.y, radius: BUCK_SMOKE_RADIUS,
        duration: BUCK_SMOKE_DURATION, maxDuration: BUCK_SMOKE_DURATION,
        color: '#94a3b8', sourceUnitId: u.id, avatarName: 'Buck', abilitySlot: 'skill2' });
      nearbyEnemies.filter(enemy => Math.hypot(enemy.x - target.x, enemy.y - target.y) <= BUCK_SMOKE_RADIUS)
        .forEach(enemy => applyDamageToChampion(u, enemy, skill.damage, false, skill.name, 'skill2'));
    } else if (name === 'Valkira') {
      u.shield += 200 * utility;
    } else if (name === 'Kaolin') {
      u.dash = { kind: 'kaolin_roll', startX: u.x, startY: u.y, targetX: target.x, targetY: target.y,
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
        u.dash = { kind: 'renn_waltz', startX: u.x, startY: u.y, targetX: ally.x, targetY: ally.y,
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
      const landingX = target.x + (u.team === 'blue' ? -30 : 30);
      u.dash = { kind: 'veyara_dash', startX: u.x, startY: u.y, targetX: landingX, targetY: target.y, targetId: target.id,
        remaining: .7, speed: 390, damage: skill.damage };
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
      u.dash = { kind: 'canopy_bound', startX: u.x, startY: u.y, targetX: target.x, targetY: target.y, targetId: target.id,
        remaining: 0.9, speed: 350, damage: skill.damage };
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
      u.dash = { kind: 'brewmaw_rush', startX: u.x, startY: u.y,
        targetX: target.x + (u.team === 'blue' ? -28 : 28), targetY: target.y, targetId: target.id,
        remaining: .55, speed: 360, damage: skill.damage };
    } else if (name === 'Wraithhook') {
      nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) < 180).forEach(a => { a.shield += 150 * utility; });
      target.x += u.team === 'blue' ? 30 : -30;
    } else if (name === 'Kaelen') {
      u.kaelenOrbs = appendKaelenOrb(u.kaelenOrbs ?? [], 'wind');
    } else if (name === 'Hweilin') {
      nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) < 140).forEach(a => { a.shield += 130 * utility; });
    } else if (name === 'Jaxon') {
      u.dash = { kind: 'jaxon_leap', startX: u.x, startY: u.y,
        targetX: target.x + (u.team === 'blue' ? -25 : 25), targetY: target.y, targetId: target.id,
        remaining: .65, speed: 385, damage: skill.damage };
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
    } else if (name === 'Skybreaker') {
      u.propellaOverdriveTimer = PROPELLA_OVERDRIVE_SECONDS;
      u.propellaRotorStacks = Math.max(3, u.propellaRotorStacks ?? 0);
      u.propellaRotorTimer = PROPELLA_ROTOR_STACK_SECONDS;
      spellsRef.current.push({ id: random().toString(), type: 'rotor_overdrive',
        x: u.x, y: u.y, radius: 58, duration: 0.9, maxDuration: 0.9,
        color: '#60a5fa', avatarName: 'Skybreaker', abilitySlot: 'skill2' });
      addEvent(`ROTOR OVERDRIVE: ${u.player.name} pushed Propella's flak skiff beyond redline for 5 seconds!`, 'combo');
    } else if (name === 'Aetheris') {
      nearbyAllies.filter(a => Math.hypot(a.x - u.x, a.y - u.y) < 160).forEach(a => { a.shield += 160 * utility; });
    }

    if (skill.damage > 0 && target.isAlive && !['Buck', 'Kaolin', 'Cinderbloom', 'Cinderlock', 'Tequoia', 'Stonebranch', 'Solana', 'Veyara', 'Brewmaw', 'Jaxon'].includes(name)) {
      // Damage application owns the per-rank multiplier. Passing a pre-scaled
      // value here would multiply the rank progression a second time.
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
    sound.playAvatarSkill(u.champion.name, 'ultimate', u.x / ARENA_WIDTH * 2 - 1);
    if (!['Nullweaver', 'Corsara', 'Faelith', 'Oathmute', 'Cloudtail', 'Stonebranch', 'Stepstone'].includes(u.champion.name)) {
      emitSkillEffect(u, ['Astra', 'Soulscourge', 'Stonewake', 'Croakwell', 'Aetheris'].includes(u.champion.name) ? u : target,
        true, u.champion.ultimate.name, 'ultimate');
    }

    const ultRank = u.level >= 18 ? 4 : u.level >= 16 ? 3 : u.level >= 11 ? 2 : 1;
    // applyDamageToChampion owns the authored rank multiplier. Keep this raw
    // base value so every ultimate, including deferred projectiles, is scaled
    // exactly once and agrees with the dossier presentation.
    const ultDamage = u.champion.ultimate.damage;

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
        radius: LAMBS_RESPITE_RADIUS,
        duration: LAMBS_RESPITE_DURATION,
        maxDuration: LAMBS_RESPITE_DURATION,
        color: '#facc15',
        sourceUnitId: u.id,
        avatarName: 'Kindra',
        abilitySlot: 'ultimate'
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
      u.dash = { kind: 'renn_rush', startX: u.x, startY: u.y, targetX: target.x, targetY: target.y,
        remaining: 1.1, speed: 380, damage: u.champion.ultimate.damage * 0.75, hitIds: [] };
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
      u.dash = { kind: 'raijin_bolt', startX: u.x, startY: u.y, targetX: target.x, targetY: target.y, targetId: target.id,
        remaining: 0.75, speed: 540, damage: u.champion.ultimate.damage, hitIds: [] };
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
    } else if (u.champion.name === 'Stepstone') {
      const nearbyAllies = championsRef.current.filter(ally => ally.isAlive && ally.team === u.team
        && Math.hypot(ally.x - u.x, ally.y - u.y) <= 360);
      const destination = getTeamwardKickDestination(
        target,
        nearbyAllies,
        u,
        180,
        { minX: 60, maxX: ARENA_WIDTH - 60, minY: 90, maxY: 610 }
      );
      target.x = destination.x;
      target.y = destination.y;
      applyChampionCrowdControl(u, target, 0.45, 'knockup', u.champion.ultimate.name);
      applyDamageToChampion(u, target, ultDamage, false, u.champion.ultimate.name, 'ultimate');
      emitSkillEffect(u, target, true, u.champion.ultimate.name, 'ultimate');
      addEvent(`🔔 BELLBREAK KICK: ${u.player.name} sent ${target.player.name} toward the allied formation!`, 'combo');
    } else if (u.champion.name === 'Skybreaker') {
      const duration = propellaGunshipDurationAtRank(ultRank);
      u.propellaGunshipTimer = duration;
      u.propellaRotorStacks = 6;
      u.propellaRotorTimer = Math.max(PROPELLA_ROTOR_STACK_SECONDS, duration);
      const victims = enemies.filter(enemy => enemy.isAlive
        && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 155);
      victims.forEach(enemy => applyDamageToChampion(
        u, enemy, ultDamage * 0.58, false, u.champion.ultimate.name, 'ultimate'
      ));
      spellsRef.current.push({ id: random().toString(), type: 'propella_air_superiority',
        x: target.x, y: target.y, sourceX: u.x, sourceY: u.y,
        radius: 155, duration: 1.8, maxDuration: 1.8,
        color: '#fb923c', extraText: 'AIR SUPERIORITY',
        avatarName: 'Skybreaker', abilitySlot: 'ultimate' });
      addEvent(`AIR SUPERIORITY: ${u.player.name} entered gunship mode for ${duration}s and bombarded ${victims.length} enemies!`, 'combo');
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
    sharedDamage: boolean = false,
    ratioOverride?: { adRatio: number; apRatio: number }
  ) => {
    if (target.zhonyaActive) return;
    target.stealthTimer = 0;
    if (attacker) attacker.stealthTimer = 0;

    // Hoarfrost only reacts to real subsequent hostile champion hits. The mark has a
    // short per-target control lockout so coordinated follow-up cannot create a root loop.
    if (attacker && attacker.team !== target.team && (target.kaelenFrostExpiresAt ?? 0) > matchTimeRef.current
      && label !== 'Hoarfrost Decree') {
      target.kaelenFrostStacks = Math.min(3, (target.kaelenFrostStacks ?? 0) + 1);
      if ((target.kaelenFrostStacks ?? 0) >= 3 && (target.kaelenFrostRootLockoutUntil ?? 0) <= matchTimeRef.current) {
        const source = championsRef.current.find(c => c.id === target.kaelenFrostSourceId && c.isAlive) ?? attacker;
        applyChampionCrowdControl(source, target, .65, 'root', 'Hoarfrost Fracture');
        target.kaelenFrostStacks = 0;
        target.kaelenFrostRootLockoutUntil = matchTimeRef.current + 4;
        floatsRef.current.push({ id: random().toString(), x: target.x, y: target.y - 48, text: '❄ FROST FRACTURE', color: '#bae6fd', opacity: 1, scale: 1.08 });
      }
    }

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

    const itemStats = label && attacker ? abilityItemStats(attacker) : { bonusAd: 0, bonusAp: 0 };
    const ap = itemStats.bonusAp
      + (label && attacker && aegisBuffRef.current?.team === attacker.team ? aegisBuffRef.current.apBonus : 0);
    const bonusAd = itemStats.bonusAd
      + (label && attacker && aegisBuffRef.current?.team === attacker.team ? aegisBuffRef.current.adBonus : 0);
    const itemDamage = label?.includes('Immolate') || label?.includes('Kraken') || label?.includes('Dragon Burn');
    const slot = abilitySlot ?? (label === attacker?.champion.ultimate.name ? 'ultimate'
      : label === attacker?.champion.skill2.name ? 'skill2'
      : label === attacker?.champion.skill1.name ? 'skill1' : attacker?.activeAbilitySlot ?? 'skill1');

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
      ? (abilityDamageFromStats(rawDamage, attacker.champion, slot, bonusAd, ap, ratioOverride)
        * abilityDamageMultiplier(attacker.level, slot)) * abilityAmp
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

    const minFloorHp = hasShallowGrave ? 1 : inLambsRespite ? getLambsRespiteMinimumHealth(target.maxHp) : 0;

    // Shield absorbs incoming damage before health
    let damageRemaining = damageToTarget;
    if (target.shield > 0) {
      if (target.shield >= damageRemaining) {
        const absorbed = damageRemaining;
        target.shield -= damageRemaining;
        damageRemaining = 0;
        if ((target.kaelenEquinoxShield ?? 0) > 0) target.kaelenEquinoxShield = Math.max(0, target.kaelenEquinoxShield! - absorbed);
      } else {
        const absorbed = target.shield;
        damageRemaining -= target.shield;
        target.shield = 0;
        if ((target.kaelenEquinoxShield ?? 0) > 0) target.kaelenEquinoxShield = Math.max(0, target.kaelenEquinoxShield! - absorbed);
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
      target.propellaRotorStacks = 0;
      target.propellaRotorTimer = 0;
      target.propellaOverdriveTimer = 0;
      target.propellaGunshipTimer = 0;
      target.lastEnemyDamage = undefined;
      target.deaths++;
      target.psychology = applyMoodEvent(ensurePsychology(target.player, target.psychology),
        `death:${target.id}:${target.deaths}`, 'death', personalityOf(target.player));
      target.respawnTimer = calculateDeathTimer(target.level, matchTimeRef.current);
      target.comboStage = 0;
      target.comboHitConfirmed = false;
      target.isRecalling = false;
      target.recallTimer = 0;

      let multiKillTitle: 'DOUBLE KILL' | 'TRIPLE KILL' | 'QUADRA KILL' | 'PENTA KILL' | null = null;
      let streakTitle: string | null = null;
      let isFirstBlood = false;

      if (killer) {
        const opposingTeam = killer.team === 'blue' ? 'red' : 'blue';
        const scoreBeforeKill = getTeamKillScore(championsRef.current);
        const goldBeforeKill = {
          [killer.team]: getTeamTotalGold(championsRef.current, killer.team),
          [opposingTeam]: getTeamTotalGold(championsRef.current, opposingTeam),
        };
        const wasMateriallyBehind = scoreBeforeKill[killer.team] + 2 <= scoreBeforeKill[opposingTeam]
          || goldBeforeKill[killer.team] + 1000 <= goldBeforeKill[opposingTeam];
        killer.kills++;
        killer.psychology = applyMoodEvent(ensurePsychology(killer.player, killer.psychology),
          `kill:${killer.id}:${target.id}:${killer.kills}`, 'kill', personalityOf(killer.player));
        target.psychology.recentKillerId = killer.id;
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
            ally.psychology = applyMoodEvent(ensurePsychology(ally.player, ally.psychology),
              `assist:${ally.id}:${target.id}:${ally.assists}`, 'assist', personalityOf(ally.player));
            ally.gold += 150;
            grantChampionXp(ally, 120);
          });
        const nearbyWinners = championsRef.current.filter(c => c.team === killer.team && c.isAlive
          && Math.hypot(c.x - target.x, c.y - target.y) <= 460);
        const nearbyLosers = championsRef.current.filter(c => c.team === target.team && c.isAlive
          && Math.hypot(c.x - target.x, c.y - target.y) <= 460);
        const fightEventId = `fight:${target.id}:${target.deaths}:${killer.team}`;
        if (nearbyWinners.length >= 3 && nearbyLosers.length >= 2) {
          const winningIgl = deriveTeamPsychology(championsRef.current.filter(unit => unit.team === killer.team)).iglId;
          const losingIgl = deriveTeamPsychology(championsRef.current.filter(unit => unit.team === target.team)).iglId;
          const winningCallSucceeded = nearbyWinners.some(unit => unit.id === winningIgl && (unit.shotcallSignalTimer ?? 0) > 0);
          const losingCallFailed = nearbyLosers.some(unit => unit.id === losingIgl && (unit.shotcallSignalTimer ?? 0) > 0);
          recordTeamPsychologyEvent(killer.team, fightEventId, 'teamfight_win', winningCallSucceeded ? 'success' : undefined);
          recordTeamPsychologyEvent(target.team, fightEventId, 'teamfight_loss', losingCallFailed ? 'failure' : undefined);
          if (wasMateriallyBehind) {
            recordTeamPsychologyEvent(killer.team, `${fightEventId}:comeback`, 'comeback', winningCallSucceeded ? 'success' : undefined);
          }
        }
        if (!championsRef.current.some(c => c.team === target.team && c.isAlive)) {
          recordTeamPsychologyEvent(killer.team, `${fightEventId}:wipe`, 'team_wipe');
        }
        if (structuresRef.current.some(structure => structure.team === killer.team && structure.isAlive
          && Math.hypot(structure.x - target.x, structure.y - target.y) <= structure.range + 150)) {
          recordTeamPsychologyEvent(killer.team, `${fightEventId}:defense`, 'defense');
        }

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
        if (tracker.multiCount >= 2) {
          killer.psychology = applyMoodEvent(ensurePsychology(killer.player, killer.psychology),
            `multikill:${killer.id}:${tracker.multiCount}:${Math.floor(matchTimeRef.current * 10)}`,
            'multikill', personalityOf(killer.player));
        }

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
    const previousHp = structure.hp;
    const appliedDamage = damageStructure(structure, finalDamage);
    if (appliedDamage > 0) recordPairedTaskEvent(attacker.id, 'structure-damage', structure.id,
      Math.min(previousHp, appliedDamage));

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

    if (structure.type === 'nexus') {
      addEvent(`NEXUS_FINISH_COMPLETED: ${structure.name} was destroyed through normal structure damage.`, 'tower');
      return;
    }
    const isTower = structure.type !== 'barracks';
    const bounty = isTower ? 250 : 200;

    const enemyTeam = structure.team === 'blue' ? 'red' : 'blue';
    championsRef.current
      .filter((c) => c.team === enemyTeam)
      .forEach((ally) => {
        ally.gold += bounty;
      });

    recordTeamPsychologyEvent(enemyTeam, `siege:${structure.id}:${Math.floor(matchTimeRef.current * 10)}`, 'teamfight_win');
    recordTeamPsychologyEvent(structure.team, `siege:${structure.id}:${Math.floor(matchTimeRef.current * 10)}`, 'failed_siege');

    const bonus = structure.barracksKind ? `${structure.barracksKind.toUpperCase()} creeps upgraded from the next wave!` : 'Causeways advanced!';
    showBanner(`🏰 ${structure.name} DESTROYED!`, `+${bounty}g Team Bounty. ${bonus}`, '🏰');
    addEvent(`🏰 ${structure.name} destroyed! ${bonus}`, 'tower');
  };

  const applyDamageToMinion = (attacker: AramChampionUnit, minion: LaneMinion, damage: number) => {
    if (!minion.isAlive || minion.team === attacker.team) return;
    minion.hitFlashUntil = matchTimeRef.current + 0.16;
    minion.hp -= damage;
    if (minion.hp <= 0 && minion.isAlive) {
      minion.isAlive = false;
      attacker.cs += 1;
      attacker.gold += minion.goldReward;
      recordPairedTaskEvent(attacker.id, 'minion-last-hit', minion.id, minion.goldReward);
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
    adaptivePolicyRef.current = trainAdaptivePolicy(adaptivePolicyRef.current, aiDecisionRecordsRef.current, winner);
    try { localStorage.setItem('esports-clash-adaptive-policy', JSON.stringify(adaptivePolicyRef.current)); } catch { /* Local policy remains session-only. */ }
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
      insights: insightsRef.current,
      aiDecisionRecords: [...aiDecisionRecordsRef.current],
      decisionCalibration: summarizeDecisionCalibration(aiDecisionRecordsRef.current)
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
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 0;
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
    ctx.shadowBlur = 0;
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
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 0;
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

  // Screen-space Minimap Radar showing the complete 2600-wide arena overview
  const drawMinimapRadar = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camX: number,
    camY: number,
    halfW: number,
    halfH: number
  ) => {
    const mini = minimapRect(width, height);
    const Mw = 260;
    const Mh = 76;
    const mx = 0;
    const my = 0;
    const scale = Mw / ARENA_WIDTH;

    ctx.save();
    ctx.translate(mini.mx, mini.my);
    ctx.scale(mini.Mw / Mw, mini.Mh / Mh);

    // Radar panel background & glowing outline
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mx, my, Mw, Mh, 8);
    else ctx.rect(mx, my, Mw, Mh);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle lane guide
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mx + 8, my + 38);
    ctx.lineTo(mx + Mw - 8, my + 38);
    ctx.stroke();
    ctx.setLineDash([]);

    // Neutral boss dots
    const isDragonAlive = dragonRef.current.isAlive;
    ctx.fillStyle = isDragonAlive ? '#c084fc' : '#475569';
    ctx.beginPath();
    ctx.arc(mx + DRAGON_X * scale, my + 160 * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const isGolemAlive = jungleCampsRef.current.some((camp) => camp.type === 'siege_golem' && camp.isAlive);
    ctx.fillStyle = isGolemAlive ? '#4ade80' : '#475569';
    ctx.beginPath();
    ctx.arc(mx + DRAGON_X * scale, my + 600 * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Structures (Towers, Barracks, Nexus)
    structuresRef.current.forEach((st) => {
      if (!st.isAlive) return;
      ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
      const sx = mx + st.x * scale;
      const sy = my + st.y * scale;
      const sz = st.type === 'nexus' ? 4 : st.type === 'barracks' ? 2.5 : 3;
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    });

    // Champions
    championsRef.current.forEach((c) => {
      if (!c.isAlive) return;
      ctx.fillStyle = c.team === 'blue' ? '#22d3ee' : '#f43f5e';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(mx + c.x * scale, my + c.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Viewport camera rectangle
    const vx = Math.max(0, camX - halfW) * scale;
    const vy = Math.max(0, camY - halfH) * scale;
    const vw = Math.min(Mw - vx, halfW * 2 * scale);
    const vh = Math.min(Mh - vy, halfH * 2 * scale);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mx + vx, my + vy, vw, vh, 2);
    else ctx.rect(mx + vx, my + vy, vw, vh);
    ctx.fill();
    ctx.stroke();

    // Mini label
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.fillText('RADAR', mx + 6, my + 10);

    ctx.restore();
  };

  // =========================================================================
  // HIGH-FIDELITY SPECTATOR-GRADE CANVAS RENDERER (LARGER MIDDLE ARENA)
  // =========================================================================
  const drawAramBattleground = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height);

    const z = zoomRef.current;
    const { x: camX, y: camY, halfW, halfH } = clampArenaCamera(
      cameraPosRef.current.x,
      cameraPosRef.current.y,
      z,
      width,
      height
    );
    cameraPosRef.current.x = camX;
    cameraPosRef.current.y = camY;

    // Apply world-to-camera transformation
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(z, z);
    ctx.translate(-camX, -camY);

    // Stretch the architectural backdrop to the wider world; actors use world coordinates.
    ctx.save();
    ctx.scale(width / 1320, 1);

    const drawLegacyStaticTerrain = !threeTerrainAvailableRef.current;
    if (drawLegacyStaticTerrain) {
      // WebGL fallback for the static terrain layers migrated in Phase 1.
      const groundGrad = ctx.createLinearGradient(0, 0, 0, height);
      groundGrad.addColorStop(0, '#1b3028');
      groundGrad.addColorStop(0.22, '#344a38');
      groundGrad.addColorStop(0.5, '#405441');
      groundGrad.addColorStop(0.78, '#344838');
      groundGrad.addColorStop(1, '#1a2d26');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 0, 1320, height);

      for (let p = 0; p < 42; p++) {
        const px = (p * 137 + 41) % 1300 + 10;
        const py = (p * 97 + 29) % (height - 48) + 24;
        const pr = 34 + (p % 5) * 13;
        const ph = 13 + (p % 4) * 5;
        ctx.fillStyle = p % 3 === 0 ? 'rgba(177, 166, 111, 0.075)' : 'rgba(157, 190, 126, 0.07)';
        ctx.beginPath();
        ctx.ellipse(px, py, pr, ph, (p % 7) * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }

      const vignette = ctx.createRadialGradient(660, height * 0.5, 170, 660, height * 0.5, 790);
      vignette.addColorStop(0, 'rgba(5, 15, 13, 0)');
      vignette.addColorStop(1, 'rgba(5, 15, 13, 0.42)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 1320, height);

      const riverGrad = ctx.createLinearGradient(590, 0, 730, 0);
      riverGrad.addColorStop(0, 'rgba(17, 54, 57, 0.42)');
      riverGrad.addColorStop(0.2, 'rgba(39, 105, 111, 0.72)');
      riverGrad.addColorStop(0.5, 'rgba(62, 139, 143, 0.82)');
      riverGrad.addColorStop(0.8, 'rgba(39, 105, 111, 0.72)');
      riverGrad.addColorStop(1, 'rgba(17, 54, 57, 0.42)');
      ctx.fillStyle = riverGrad;
      ctx.beginPath();
      ctx.moveTo(630, 0);
      ctx.bezierCurveTo(610, 200, 690, 480, 640, height);
      ctx.lineTo(720, height);
      ctx.bezierCurveTo(770, 480, 690, 200, 710, 0);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(13, 35, 37, 0.65)';
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.fill();

      ctx.strokeStyle = 'rgba(168, 211, 191, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(632, 0);
      ctx.bezierCurveTo(612, 200, 692, 480, 642, height);
      ctx.stroke();
    }

    // Water glints remain a Canvas animation until the effects migration.
    ctx.strokeStyle = 'rgba(126, 202, 191, 0.34)';
    ctx.lineWidth = 1.8;
    for (let r = 0; r < 12; r++) {
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
        const sR = (ring.stoneRadius / ARENA_WIDTH) * 1320;
        const isDragon = ring.id === 'dragon_boss';
        const isGolem = ring.id === 'j_siege_golem';

        // Non-entrance perimeter of the camp cove: wide flared opening with no gate pinch
        const isBoss = ring.stones === 16;
        const gapThreshold = isBoss ? 0.58 : 0.72;
        const startAngle = ring.entrance + gapThreshold;
        const endAngle = ring.entrance + Math.PI * 2 - gapThreshold;
        const traceContour = (offset = 0, lift = 0) => {
          ctx.beginPath();
          for (let i = 0; i <= 72; i++) {
            const point = campWallPoint(ring, startAngle + (endAngle - startAngle) * i / 72, offset);
            const x = point.x / ARENA_WIDTH * 1320;
            if (i === 0) ctx.moveTo(x, point.y + lift);
            else ctx.lineTo(x, point.y + lift);
          }
        };

        ctx.save();
        // 1. Soft foundation shadow
        ctx.beginPath();
        traceContour(4, 4);
        ctx.lineWidth = sR * 2.1;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = isDragon ? 'rgba(0, 0, 0, 0.62)' : 'rgba(0, 0, 0, 0.45)';
        ctx.stroke();

        // 2. Continuous bedrock core linking all stones into an authentic cliff wall
        ctx.beginPath();
        traceContour();
        ctx.lineWidth = sR * 1.75;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = isDragon ? '#18181b' : isGolem ? '#151f2e' : '#16281e';
        ctx.stroke();

        // 3. Cove outer edge / turf transition
        ctx.beginPath();
        traceContour(ring.stoneRadius * 0.35, -2);
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = isDragon ? 'rgba(120, 53, 15, 0.4)' : isGolem ? 'rgba(30, 41, 59, 0.5)' : 'rgba(4, 120, 87, 0.3)';
        ctx.stroke();

        // 4. Subtle inner caldera glow for Dragon pit
        if (isDragon) {
          ctx.beginPath();
          traceContour(-ring.stoneRadius * 0.4, 1);
          ctx.lineWidth = 3;
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(234, 88, 12, 0.45)';
          ctx.stroke();
        }
        ctx.restore();
      });

      // Step B: Continuous bedrock shelves for Highground base ramp walls
      const highgroundSegments = [
        { x1: ((NEXUS_TOWER_X.blue + 35) / ARENA_WIDTH) * 1320, x2: ((NEXUS_TOWER_X.blue + 115) / ARENA_WIDTH) * 1320, y: 295 },
        { x1: ((NEXUS_TOWER_X.blue + 35) / ARENA_WIDTH) * 1320, x2: ((NEXUS_TOWER_X.blue + 115) / ARENA_WIDTH) * 1320, y: 465 },
        { x1: ((NEXUS_TOWER_X.red - 115) / ARENA_WIDTH) * 1320, x2: ((NEXUS_TOWER_X.red - 35) / ARENA_WIDTH) * 1320, y: 295 },
        { x1: ((NEXUS_TOWER_X.red - 115) / ARENA_WIDTH) * 1320, x2: ((NEXUS_TOWER_X.red - 35) / ARENA_WIDTH) * 1320, y: 465 },
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
    ctx.fillStyle = 'rgba(17, 27, 25, 0.58)';
    ctx.beginPath();
    ctx.roundRect(320, 120, 240, 95, 22);
    ctx.roundRect(760, 120, 240, 95, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(196, 175, 125, 0.44)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(17, 27, 25, 0.58)';
    ctx.beginPath();
    ctx.roundRect(360, 520, 600, 105, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(196, 175, 125, 0.44)';
    ctx.stroke();

    // Cobblestone connectors between causeway and side paths
    ctx.fillStyle = '#6d7059';
    ctx.fillRect(480, 205, 55, 60);
    ctx.fillRect(785, 205, 55, 60);
    ctx.fillRect(480, 495, 55, 55);
    ctx.fillRect(785, 495, 55, 55);

    const blueRampX = NEXUS_TOWER_X.blue / ARENA_WIDTH * 1320;
    const redRampX = NEXUS_TOWER_X.red / ARENA_WIDTH * 1320;
    const basePlatforms = [
      { start: 50, end: blueRampX, edge: blueRampX, color: '#38bdf8' },
      { start: redRampX, end: 1270, edge: redRampX, color: '#fb7185' },
    ];

    if (drawLegacyStaticTerrain) {
    // 6. MAIN CENTRAL CAUSEWAY: Canvas fallback for the migrated Three.js surface
    ctx.fillStyle = 'rgba(14, 21, 22, 0.48)';
    ctx.beginPath();
    ctx.roundRect(46, 266, 1228, 230, 23);
    ctx.fill();

    const causewayGrad = ctx.createLinearGradient(0, 268, 0, 492);
    causewayGrad.addColorStop(0, '#514f45');
    causewayGrad.addColorStop(0.12, '#706b59');
    causewayGrad.addColorStop(0.5, '#7c7764');
    causewayGrad.addColorStop(0.88, '#6d6857');
    causewayGrad.addColorStop(1, '#47483f');
    ctx.fillStyle = causewayGrad;
    ctx.beginPath();
    ctx.roundRect(52, 264, 1216, 232, 20);
    ctx.fill();

    ctx.strokeStyle = 'rgba(224, 211, 169, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(58, 270, 1204, 220, 15);
    ctx.stroke();

    // Broken flagstone joints and a pale worn centerline guide the eye.
    ctx.strokeStyle = 'rgba(31, 39, 34, 0.32)';
    ctx.lineWidth = 1;
    for (let x = 70; x <= 1250; x += 44) {
      ctx.beginPath();
      const offset = (Math.floor(x / 44) % 2) * 14;
      ctx.moveTo(x, 270 + offset);
      ctx.lineTo(x, 490 - offset);
      ctx.stroke();
    }
    for (let y = 280; y <= 480; y += 32) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(1260, y);
      ctx.stroke();
    }

    const roadSheen = ctx.createLinearGradient(0, 350, 0, 410);
    roadSheen.addColorStop(0, 'rgba(213, 197, 151, 0)');
    roadSheen.addColorStop(0.5, 'rgba(213, 197, 151, 0.18)');
    roadSheen.addColorStop(1, 'rgba(213, 197, 151, 0)');
    ctx.fillStyle = roadSheen;
    ctx.fillRect(70, 350, 1180, 60);

    // Moss and scattered weeds soften the paving-to-meadow transition.
    ctx.fillStyle = 'rgba(82, 119, 72, 0.62)';
    ctx.fillRect(60, 268, 1200, 5);
    ctx.fillRect(60, 487, 1200, 5);

    // Raised stone bases begin at the third turrets and run to each well.
    basePlatforms.forEach(platform => {
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
    });

    // Central Cobblestone Crossing Highway
    ctx.fillStyle = '#5b5a4a';
    ctx.fillRect(80, 350, 1160, 60);
    ctx.strokeStyle = 'rgba(230, 213, 165, 0.52)';
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
    }

    // Base mist remains an animation-layer effect on Canvas in this increment.
    basePlatforms.forEach(platform => {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.08)';
      for (let mist = 0; mist < 4; mist++) {
        const drift = Math.sin(time * 0.5 + mist * 2.1) * 13;
        const fogX = platform.start + (platform.end - platform.start) * (mist + 0.5) / 4 + drift;
        ctx.beginPath();
        ctx.arc(fogX, 310 + mist * 43, 56, 0, Math.PI * 2);
        ctx.fill();
      }
    });

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
      ctx.fillStyle = 'rgba(4, 28, 18, 0.65)';
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
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < bladeCount; i++) {
        const frac = (i / (bladeCount - 1)) * 2 - 1; // -1 .. 1
        const bladeX = frac * (rx - 5);
        const maxBladeY = ry * Math.sqrt(Math.max(0, 1 - frac * frac));
        const bladeY = Math.sin(i * 1.9 + b.x) * 0.45 * maxBladeY;

        const sway = Math.sin(time * 3.2 + i * 0.75 + b.x * 0.01) * (isOccupied ? 6 : 3.5);
        const bladeH = ry * 0.95 + Math.sin(i * 2.3) * 6;

        ctx.strokeStyle = i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#059669' : '#34d399';
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
        const ruinRadius = st.type === 'nexus' ? 48 : st.type === 'barracks' ? 31 : 27;
        ctx.save(); ctx.translate(st.x, st.y);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.52)';
        ctx.beginPath(); ctx.ellipse(0, 8, ruinRadius, ruinRadius * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
        for (let rubble = 0; rubble < 7; rubble++) {
          const angle = rubble * Math.PI * 2 / 7;
          const distance = ruinRadius * (0.28 + (rubble % 3) * 0.16);
          const rx = Math.cos(angle) * distance;
          const ry = Math.sin(angle) * distance * 0.38;
          ctx.save(); ctx.translate(rx, ry); ctx.rotate(angle * 1.7);
          ctx.fillRect(-5 - rubble % 2, -4, 10 + rubble % 2 * 3, 8); ctx.strokeRect(-5 - rubble % 2, -4, 10 + rubble % 2 * 3, 8);
          ctx.restore();
        }
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.ellipse(0, 5, ruinRadius * 0.34, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      if (st.type === 'nexus') {
        ctx.save(); ctx.translate(st.x, st.y);
        drawNexusStructure(ctx, st.team, time, !canDamageNexus(st.team, structuresRef.current));
        ctx.restore();
      } else if (st.type === 'barracks') {
        ctx.save(); ctx.translate(st.x, st.y);
        drawBarracksStructure(ctx, st.team, st.barracksKind ?? 'melee', time);
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = '#020617';
        ctx.strokeText(st.barracksKind?.toUpperCase() ?? '', 0, -57);
        ctx.fillText(st.barracksKind?.toUpperCase() ?? '', 0, -57);
        ctx.restore();
      } else {
        const targetUnit = st.targetId ? [...championsRef.current, ...minionsRef.current]
          .find((unit) => unit.id === st.targetId) : undefined;
        ctx.save(); ctx.translate(st.x, st.y);
        drawTowerStructure(ctx, st.team, time, targetUnit
          ? { x: targetUnit.x - st.x, y: targetUnit.y - st.y - 12 }
          : undefined);
        ctx.restore();
      }

      const structureMetric = st.type === 'nexus' ? BATTLEFIELD_MODEL_METRICS.nexus
        : st.type === 'barracks' ? BATTLEFIELD_MODEL_METRICS.barracks : BATTLEFIELD_MODEL_METRICS.tower;
      const bW = structureMetric.healthWidth;
      const bH = 5;
      const bX = st.x - bW / 2;
      const bY = st.y + structureMetric.healthY;

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
      if (m.summonedBearOwnerId || m.prismWardenOwnerId) return;
      ctx.save();
      ctx.translate(m.x, m.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      const minionShadowWidth = m.type === 'cannon' ? 17 : 11;
      ctx.ellipse(0, 5, m.siegeGolem ? 44 : minionShadowWidth, m.siegeGolem ? 12 : 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (m.empowered) {
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -6, m.type === 'cannon' ? 18 : 14, m.type === 'cannon' ? 13 : 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.save();
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
      } else {
        drawLaneMinionModel(ctx, m.team, m.type, time, m.attackTimer);
      }

      ctx.restore();
      if ((m.hitFlashUntil ?? 0) > matchTimeRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, ((m.hitFlashUntil ?? 0) - matchTimeRef.current) / 0.16);
        ctx.strokeStyle = '#fff7cc'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -10, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const minionMetric = m.type === 'cannon' ? BATTLEFIELD_MODEL_METRICS.cannonMinion
        : m.type === 'caster' ? BATTLEFIELD_MODEL_METRICS.casterMinion : BATTLEFIELD_MODEL_METRICS.meleeMinion;
      const mW = m.siegeGolem ? 60 : minionMetric.healthWidth;
      const minionHealthY = m.siegeGolem ? -110 : minionMetric.healthY;
      ctx.fillStyle = '#020617';
      ctx.fillRect(-mW / 2, minionHealthY, mW, 3);
      ctx.fillStyle = m.empowered ? '#fbbf24' : m.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(-mW / 2 + 0.5, minionHealthY + 0.5,
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
      ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#d946ef';
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-8, -3.5); ctx.lineTo(-8, 3.5); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'electric_spark') {
        // Storm Spirit / Raijin: Electric Spark
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'laser') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(18, 0); ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 12;
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(20, 0); ctx.stroke();
      } else if (p.type === 'flak_round') {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.roundRect(-11, -5, 20, 10, 3); ctx.fill();
        ctx.strokeStyle = '#fdba74'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(7, -5); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill();
        for (let spark = 0; spark < 3; spark++) {
          ctx.fillStyle = spark === 0 ? '#ffffff' : '#fb923c';
          ctx.beginPath(); ctx.arc(-14 - spark * 5, (spark - 1) * 3, 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.type === 'pellet') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -7); ctx.lineTo(-5, 0); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill();
      } else if (p.type === 'arrow') {
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-7, -6); ctx.lineTo(-4, 0); ctx.lineTo(-7, 6);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
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
      ctx.shadowBlur = 0;
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

      if (s.type === 'wave_clear_impact') {
        ctx.globalAlpha = alpha * 0.75;
        ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 3;
        ctx.beginPath();
        if (s.halfWidth !== undefined && s.halfHeight !== undefined)
          ctx.rect(s.x - s.halfWidth, s.y - s.halfHeight, s.halfWidth * 2, s.halfHeight * 2);
        else ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke(); ctx.globalAlpha = alpha * 0.15; ctx.fill();
      } else if (s.type === 'skill_burst' || s.type === 'ultimate_burst') {
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
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
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
        if (s.kaelenCast) drawKaelenSpell(ctx, s.kaelenCast, alpha);
      } else if (s.type === 'solar_flare') {
        // Leona / Solana: Blinding Daybreak Flare Solar Beam
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (2 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'static_remnant') {
        // Storm Spirit / Raijin: Static Remnant
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        for (let sp = 0; sp < 3; sp++) {
          const spAngle = sp * (Math.PI * 2 / 3) + time * 12;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
        for (let t = 0; t < 5; t++) {
          const ta = (t / 5) * Math.PI * 2 + time * 4;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(ta) * s.radius, s.y + Math.sin(ta) * (s.radius * 0.7));
          ctx.quadraticCurveTo(s.x + Math.cos(ta + 0.8) * (s.radius * 0.5), s.y + Math.sin(ta + 0.8) * (s.radius * 0.35), s.x, s.y);
          ctx.stroke();
        }
      } else if (s.type === 'flak_shrapnel') {
        const burst = 1 - alpha;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#fed7aa';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius * (0.25 + burst * 0.75), 0, Math.PI * 2); ctx.stroke();
        for (let fragment = 0; fragment < 5; fragment++) {
          const a = fragment * Math.PI * 0.4 + time * 0.8;
          const inner = 12 + burst * 20;
          const outer = inner + 8 + (fragment % 3) * 4;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a) * inner, s.y + Math.sin(a) * inner * 0.7);
          ctx.lineTo(s.x + Math.cos(a) * outer, s.y + Math.sin(a) * outer * 0.7);
          ctx.stroke();
        }
      } else if (s.type === 'rotor_overdrive') {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#bfdbfe';
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        for (let blade = 0; blade < 4; blade++) {
          const a = time * 16 + blade * Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(s.x, s.y - 28);
          ctx.lineTo(s.x + Math.cos(a) * s.radius, s.y - 28 + Math.sin(a) * s.radius * 0.32); ctx.stroke();
        }
        ctx.strokeStyle = '#fb923c';
        ctx.beginPath(); ctx.arc(s.x, s.y - 12, 22 + (1 - alpha) * 24, 0, Math.PI * 2); ctx.stroke();
      } else if (s.type === 'propella_air_superiority') {
        const barrage = 1 - alpha;
        ctx.globalAlpha = Math.min(1, alpha * 1.4);
        ctx.strokeStyle = '#93c5fd';
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
        for (let shell = 0; shell < 6; shell++) {
          const a = shell * Math.PI / 3 + barrage * 2.2;
          const r = s.radius * (0.25 + (shell % 4) * 0.18);
          const sx = s.x + Math.cos(a) * r;
          const sy = s.y + Math.sin(a) * r * 0.58;
          ctx.fillStyle = shell % 2 ? '#fb923c' : '#fef08a';
          ctx.beginPath(); ctx.arc(sx, sy, 4 + Math.sin(time * 15 + shell) * 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx, sy - 38); ctx.lineTo(sx, sy - 6); ctx.stroke();
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
          ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
          ctx.shadowBlur = 0;
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
          ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
        ctx.lineWidth = 2; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 20, 7, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      const isKnockedUp = (u.knockupTimer ?? 0) > 0;
      const knockupMax = u.knockupMax || 1.2;
      const knockupProgress = isKnockedUp ? Math.max(0, Math.min(1, 1 - ((u.knockupTimer ?? 0) / knockupMax))) : 0;
      const knockupHeight = isKnockedUp ? Math.sin(knockupProgress * Math.PI) * 34 : 0;
      const dashLiftDuration = u.dash?.kind === 'renn_vault' ? .75
        : u.dash?.kind === 'canopy_bound' ? .9 : u.dash?.kind === 'jaxon_leap' ? .65 : 0;
      // This is presentation-only: the simulation's x/y path and collision position stay unchanged.
      const dashLift = dashLiftDuration && u.dash
        ? Math.sin(Math.max(0, Math.min(1, 1 - u.dash.remaining / dashLiftDuration)) * Math.PI) * 26 : 0;

      if (u.dash && u.dash.startX !== undefined && u.dash.startY !== undefined) {
        ctx.save();
        const trailColor = u.dash.kind === 'kaolin_roll' ? '#86efac'
          : u.dash.kind === 'raijin_bolt' ? '#67e8f9'
            : u.dash.kind === 'cinder_lunge' || u.dash.kind === 'brewmaw_rush' ? '#fb923c'
              : u.dash.kind === 'valerie_punch' ? '#f43f5e'
                : u.dash.kind === 'jaxon_leap' ? '#7dd3fc' : '#fbbf24';
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = u.dash.kind === 'kaolin_roll' ? 11 : 7;
        ctx.globalAlpha = 0.6; ctx.shadowColor = trailColor; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(u.dash.startX, u.dash.startY - 16);
        ctx.lineTo(u.x, u.y - 16); ctx.stroke(); ctx.restore();
      }

      // Draw Procedural TFT Chibi Sprite
      if (u.dash?.kind === 'kaolin_roll') {
        ctx.save();
        ctx.translate(u.x, u.y - 18); ctx.rotate(time * 11);
        ctx.fillStyle = '#14532d'; ctx.strokeStyle = '#86efac'; ctx.lineWidth = 4;
        ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 0;
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
        animTime: u.creepAttack ? matchTimeRef.current - u.creepAttack.startedAt : u.animTimer,
        basicAttackPose: creepAttackPose(u.creepAttack, matchTimeRef.current),
        team: u.team,
        isStunned: u.stunTimer > 0,
        isCharmed: u.charmTimer > 0,
        isFeared: (u.fearTimer ?? 0) > 0,
        isKnockedUp,
        knockupHeight: knockupHeight + dashLift,
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
          ctx.shadowBlur = 0;
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
          ctx.shadowBlur = 0;
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
        ctx.shadowColor = '#5eead4'; ctx.shadowBlur = 0; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(u.paxiOrb.x, u.paxiOrb.y - 15, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if ((u.stealthTimer ?? 0) > 0) {
        ctx.save(); ctx.strokeStyle = '#fdba74'; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(u.x, u.y - 18, 24, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if ((u.kaelenFrostExpiresAt ?? 0) > matchTimeRef.current) {
        const stacks = u.kaelenFrostStacks ?? 0;
        ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 9px system-ui'; ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = '#082f49'; ctx.lineWidth = 3; const label = `❄ ${stacks}/3 FROST`;
        ctx.strokeText(label, u.x, u.y - 64 - knockupHeight); ctx.fillText(label, u.x, u.y - 64 - knockupHeight);
        ctx.strokeStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(u.x, u.y - 18, 20 + stacks * 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if ((u.kaelenAshenExpiresAt ?? 0) > matchTimeRef.current) {
        ctx.save(); ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
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
          ctx.shadowBlur = 0;
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
        ctx.shadowBlur = 0;
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
    minionsRef.current.filter(m => (m.summonedBearOwnerId || m.prismWardenOwnerId) && m.isAlive).forEach(m => {
      ctx.save();
      ctx.translate(m.x, m.y);
      if (m.prismWardenOwnerId) {
        const pulse = 1 + Math.sin(time * 5) * .1;
        ctx.scale(pulse, pulse);
        const prism = ctx.createRadialGradient(0, -5, 2, 0, 0, 27);
        prism.addColorStop(0, '#fef3c7'); prism.addColorStop(.45, '#fb7185'); prism.addColorStop(1, '#701a75');
        ctx.fillStyle = prism; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(23, 8); ctx.lineTo(0, 25); ctx.lineTo(-23, 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
      } else {
      ctx.save();
      ctx.scale(1.18 * creatureFacingScale(m.facingX ?? (m.team === 'blue' ? 1 : -1)), 1.18);
      drawSpiritBearSprite(ctx, time, m.team, creatureAttackPose(m.attackTimer, 1.15));
      ctx.restore();
      }
      const hpPct = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = '#020617'; ctx.fillRect(-24, -57, 48, 5);
      ctx.fillStyle = m.team === 'blue' ? '#34d399' : '#fb7185';
      ctx.fillRect(-23, -56, 46 * hpPct, 3);
      ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#020617';
      ctx.strokeText(m.prismWardenOwnerId ? 'PRISM WARDEN' : 'SPIRIT BEAR', 0, -63);
      ctx.fillStyle = m.prismWardenOwnerId ? '#fef3c7' : '#ecfdf5'; ctx.fillText(m.prismWardenOwnerId ? 'PRISM WARDEN' : 'SPIRIT BEAR', 0, -63);
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
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 0;
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

    // Restore camera transformation back to screen space
    ctx.restore();

    // 18. SCREEN-SPACE OVERLAYS (MINIMAP RADAR)
    if (showMinimapRef.current) {
      drawMinimapRadar(ctx, width, height, camX, camY, halfW, halfH);
    }
  };

  const drawArena3dOverlay = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const renderer = threeTerrainRef.current;
    if (!renderer) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Use CSS pixels for sharp, undistorted labels at any stage aspect ratio.
    ctx.save();
    ctx.scale(canvas.width / rect.width, canvas.height / rect.height);
    const project = (x: number, y: number, height: number) => renderer.project(x, y, height, rect.width, rect.height);
    const bar = (entity: { id: string; x: number; y: number; hp: number; maxHp: number }, color: string,
      label = '', width = 42, mana?: number) => {
      const p = project(entity.x, entity.y, renderer.actorHeight(entity.id));
      if (p.x < -width || p.x > rect.width + width || p.y < -30 || p.y > rect.height + 30) return;
      ctx.fillStyle = '#06101ce8'; ctx.fillRect(p.x - width / 2 - 1, p.y - 1, width + 2, mana === undefined ? 5 : 8);
      ctx.fillStyle = color; ctx.fillRect(p.x - width / 2, p.y, width * Math.max(0, Math.min(1, entity.hp / entity.maxHp)), 3);
      if (mana !== undefined) { ctx.fillStyle = '#818cf8'; ctx.fillRect(p.x - width / 2, p.y + 5, width * Math.max(0, Math.min(1, mana)), 1); }
      if (label) {
        ctx.font = '600 10px system-ui'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = '#06101c'; ctx.strokeText(label, p.x, p.y - 5);
        ctx.fillStyle = '#e6efed'; ctx.fillText(label, p.x, p.y - 5);
      }
    };
    structuresRef.current.filter(st => st.isAlive).forEach(st => bar(st, st.team === 'blue' ? '#38c9ed' : '#f16b84', '', 42));
    minionsRef.current.filter(m => m.isAlive && m.hp < m.maxHp).forEach(m => bar(m, m.team === 'blue' ? '#38c9ed' : '#f16b84', '', 19));
    [...jungleCampsRef.current, dragonRef.current].filter(c => c.isAlive).forEach(c => bar(c, '#e1b86e', c.name, 44));
    championsRef.current.filter(c => c.isAlive).forEach(c => bar(c, c.team === 'blue' ? '#38c9ed' : '#f16b84',
      `${c.level}  ${c.player.name}`, 48, c.mana / Math.max(1, maxMana(c))));
    floatsRef.current.forEach(f => {
      const p = project(f.x, f.y, 55);
      ctx.globalAlpha = f.opacity; ctx.font = `bold ${Math.round(11 * f.scale)}px system-ui`;
      ctx.textAlign = 'center'; ctx.fillStyle = f.color; ctx.fillText(f.text, p.x, p.y);
    });
    ctx.restore();
    if (showMinimapRef.current) {
      const v = renderer.viewport(cameraPosRef.current.x, cameraPosRef.current.y, zoomRef.current);
      drawMinimapRadar(ctx, canvas.width, canvas.height, v.x, v.y, v.halfW, v.halfH);
    }
  };

  // Evaluation-only stepping keeps checkpoint comparisons independent of animation-frame grouping.
  useEffect(() => {
    if (!macroExperimentEnabledRef.current || !pairedMacroModeRef.current || !paused) return;
    const fixtureWindow = window as Window & { __esportsPairedStep?: (steps: number) => boolean;
      __esportsPairedInspect?: () => unknown };
    fixtureWindow.__esportsPairedInspect = () => ({ second: matchTimeRef.current,
      fingerprint: pairedStateFingerprint(capturePairedCheckpoint()), randomState: randomRef.current.getState(),
      finished: matchFinishedRef.current,
      executionAudit: (window as Window & { __esportsMacroExecutionAudit?: unknown }).__esportsMacroExecutionAudit,
      opportunityAudit: (window as Window & { __esportsMacroOpportunityAudit?: unknown }).__esportsMacroOpportunityAudit });
    fixtureWindow.__esportsPairedStep = (steps: number) => {
      if (!pairedMacroModeRef.current || !Number.isInteger(steps)
        || steps < 1 || steps > 960 || matchFinishedRef.current) return false;
      for (let index = 0; index < steps && !matchFinishedRef.current; index++) {
        matchTimeRef.current += SIMULATION_STEP;
        updateAramSimulation(SIMULATION_STEP);
        if (pairedMacroModeRef.current === 'scout'
          && (window as Window & { __esportsPairedMacro?: unknown }).__esportsPairedMacro) break;
      }
      return true;
    };
    return () => { delete fixtureWindow.__esportsPairedStep; delete fixtureWindow.__esportsPairedInspect; };
  }, [paused]);

  // Animation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const lastHud = { current: -Infinity };

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const steps = batchMode ? (matchFinishedRef.current ? 0 : 120)
        : consumeFixedSteps(accumulatorRef, dt, speed, paused || matchOver);
      if (steps > 0) {
        runSimulationSlice(steps, () => {
          matchTimeRef.current += SIMULATION_STEP;
          updateAramSimulation(SIMULATION_STEP);
        }, () => matchFinishedRef.current, () => performance.now(), batchMode ? 8 : Infinity);
      }
      if ((steps > 0 || lastHud.current === -Infinity)
        && shouldPublishHud(lastHud, now, matchFinishedRef.current && steps > 0)) {
        setChampions(championsRef.current.map(champion => ({ ...champion, items: [...champion.items] })));
        setMatchTime(matchTimeRef.current);
      }

      // Smooth Auto-Follow Action Camera
      if (cameraModeRef.current === 'auto') {
        const actionTarget = computeActionCenter(championsRef.current, ARENA_WIDTH, 760);
        targetCameraPosRef.current.x = actionTarget.x;
        targetCameraPosRef.current.y = actionTarget.y;
      }

      const lerpRate = 1 - Math.exp(-4.2 * Math.min(0.1, dt));
      cameraPosRef.current.x += (targetCameraPosRef.current.x - cameraPosRef.current.x) * lerpRate;
      cameraPosRef.current.y += (targetCameraPosRef.current.y - cameraPosRef.current.y) * lerpRate;

      const canvas = canvasRef.current;
      if (canvas) {
        const use3d = arenaViewRef.current === '3d' && threeTerrainAvailableRef.current;
        const viewport = (use3d ? threeTerrainRef.current?.viewport(cameraPosRef.current.x, cameraPosRef.current.y, zoomRef.current) : null) ?? clampArenaCamera(
          cameraPosRef.current.x,
          cameraPosRef.current.y,
          zoomRef.current,
          canvas.width,
          canvas.height,
        );
        cameraPosRef.current.x = viewport.x;
        cameraPosRef.current.y = viewport.y;
        const ctx = canvas.getContext('2d');
        const rendered3d = use3d && threeTerrainRef.current?.renderArena({
          champions: championsRef.current, minions: minionsRef.current, structures: structuresRef.current,
          camps: jungleCampsRef.current, dragon: dragonRef.current, projectiles: projectilesRef.current,
          spells: spellsRef.current, wards: wardsRef.current, second: matchTimeRef.current,
        }, viewport.x, viewport.y, zoomRef.current);
        if (rendered3d) {
          if (ctx) drawArena3dOverlay(ctx, canvas);
        } else {
          threeTerrainRef.current?.render(viewport.x, viewport.y, zoomRef.current);
          if (ctx) drawAramBattleground(ctx, canvas.width, canvas.height, now * 0.001);
        }
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

  const focusUnit = (unit: AramChampionUnit) => {
    setCameraMode('manual');
    targetCameraPosRef.current = { x: unit.x, y: unit.y };
  };
  const hudXpProgress = (unit: AramChampionUnit) => {
    if (unit.level >= 18) return 1;
    const base = unit.level <= 3 ? 0 : getXpThreshold(unit.level);
    return Math.max(0, Math.min(1, (unit.xp - base) / Math.max(1, getXpThreshold(unit.level + 1) - base)));
  };
  const records = dockTab === 'items' ? itemMilestones.map(ms => ({ time: ms.time, text: ms.playerName + ' / ' + ms.itemName + ' / ' + ms.stats })) : eventFeed;
  const pages = Math.max(1, Math.ceil(records.length / 5));
  const page = Math.min(recordPage, pages - 1);
  return (
    <div ref={matchRootRef} className="spectator-shell" aria-label="Clash Arena spectator">
      <header className="spectator-top">
        <div className="spectator-team"><b>{teamNames.blue}</b><small>{blueGold.toLocaleString()}g | {blueTowersAlive}/3 towers | Lv {blueAvgLevel}</small>
          <small>{barracksKinds.map(kind => (barracksIntact('blue', kind) ? '+ ' : 'x ') + kind).join(' | ')}</small></div>
        <div className="spectator-score"><strong className="text-cyan-300">{blueKills}</strong><div><time>{Math.floor(matchTime / 60)}:{String(Math.floor(matchTime % 60)).padStart(2, '0')}</time>
          <small>{matchOver ? 'Final' : paused ? 'Paused' : matchEconomyPhase(matchTime)}</small></div><strong className="text-rose-300">{redKills}</strong></div>
        <div className="spectator-team red"><b>{teamNames.red}</b><small>{redGold.toLocaleString()}g | {redTowersAlive}/3 towers | Lv {redAvgLevel}</small>
          <small>{barracksKinds.map(kind => (barracksIntact('red', kind) ? '+ ' : 'x ') + kind).join(' | ')}</small></div>
      </header>
      <div className="spectator-toolbar" role="toolbar" aria-label="Spectator controls">
        <div className="spectator-control-group">
          <button onClick={onExit}>Lobby</button>
          <button onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume match' : 'Pause match'}>{paused ? 'Play' : 'Pause'}</button>
          {[1, 2, 4].map(value => <button key={value} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}x</button>)}
          <button aria-pressed={cameraMode === 'auto'} onClick={() => { setCameraMode(cameraMode === 'auto' ? 'manual' : 'auto'); targetCameraPosRef.current = computeActionCenter(championsRef.current, ARENA_WIDTH, 760); }}>{cameraMode === 'auto' ? 'Auto cam' : 'Free pan'}</button>
          <button onClick={() => setZoom(z => Math.max(1, z - 0.15))} aria-label="Zoom out">-</button>
          <button onClick={() => setZoom(zoom === 1 ? 2 : 1)} title="Toggle fit / action zoom">{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} aria-label="Zoom in">+</button>
          <button aria-pressed={showMinimap} onClick={() => setShowMinimap(!showMinimap)}>Map</button>
          <button aria-pressed={arenaView === '3d'} onClick={() => setArenaView(v => v === '3d' ? '2d' : '3d')}
            title={webglAvailable ? 'Switch between 3D arena and 2D tactical view' : 'WebGL unavailable; showing 2D fallback'}>
            {arenaView === '3d' ? webglAvailable ? '3D arena' : '2D fallback' : '2D tactical'}
          </button>
        </div>
        <div className="spectator-control-group">
          <button aria-expanded={showInsights} onClick={() => setShowInsights(!showInsights)}>Insights</button>
          <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? 'Window' : 'Fullscreen'}</button>
          <details className="spectator-menu"><summary>More</summary><div>
            <span className="text-slate-400">Seed {seed} | {Math.abs(blueGold - redGold).toLocaleString()}g lead</span>
            <span className="text-slate-400">Coaches: {blueCoach?.name ?? 'None'} / {redCoach?.name ?? 'None'}</span>
            {!batchMode && !onlineMode && <button onClick={onReplay} title={replayTitle}>{replayLabel}</button>}
            {!batchMode && !onlineMode && <button onClick={onBatchStart}>Run 25 balance matches</button>}
            {batchMode && <button onClick={onBatchStop}>Stop batch ({batchNumber}/25)</button>}
            {latestReportRef.current && <button onClick={downloadMatchReport}>Export match</button>}
            {balanceSummary && <><button onClick={downloadBalanceReport}>Export balance</button><span>{balanceSummary.matches} games | {balanceSummary.averageMinutes.toFixed(1)}m average</span></>}
            <button onClick={() => sound.toggleMusic()}>Toggle music</button>
            <span className="text-slate-500">Drag to pan | Wheel to zoom | Space: auto | M: map | Tab: squads</span>
          </div></details>
        </div>
      </div>
      <div className="spectator-feed" aria-live="polite">
        <span className="shrink-0 text-cyan-300">LIVE</span>
        <strong>{activeBanner ? activeBanner.text + ' | ' + activeBanner.subtext : killCallout ? killCallout.killerName + ' | ' + killCallout.victimName + (killCallout.multiKill ? ' | ' + killCallout.multiKill : '') : 'Bridge of Champions'}</strong>
        <span className="ml-auto truncate">{dragonRef.current.isAlive ? 'Embermaw alive' : 'Embermaw ' + Math.ceil(dragonRef.current.spawnTimer) + 's'} | {jungleCampsRef.current.find(c => c.type === 'siege_golem')?.isAlive ? 'Gravemarch alive' : 'Gravemarch waiting'}</span>
        {fullscreenError && <span>Fullscreen unavailable; viewport mode active.</span>}
      </div>
      <div className="spectator-stage">
        <div className="spectator-render-stack" data-view={arenaView === '3d' && webglAvailable ? '3d' : '2d'}>
          <div ref={threeTerrainHostRef} className="spectator-three-host" aria-hidden="true" />
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_RENDER_HEIGHT}
            className={`spectator-canvas-overlay select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            onDoubleClick={handleCanvasDoubleClick}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          />
        </div>
      </div>
      <footer className="spectator-dock">
        <div className="spectator-tabs" role="group" aria-label="Broadcast panels">
          {(['squads', 'events', 'items'] as const).map(tab => <button key={tab} aria-pressed={dockTab === tab && hudMode !== 'hidden'} onClick={() => { setDockTab(tab); setRecordPage(0); setHudMode('docked'); }}>{tab === 'squads' ? 'Squads & items' : tab === 'events' ? 'Event log' : 'Power spikes'}</button>)}
          <button onClick={() => setHudMode(hudMode === 'hidden' ? 'docked' : 'hidden')}>{hudMode === 'hidden' ? 'Show' : 'Hide'} panel</button>
          <small>Click a portrait to focus | Items open their details | HP / mana / cooldowns</small>
        </div>
        {hudMode !== 'hidden' && (dockTab === 'squads' ? <div className="spectator-squads">
          <SpectatorRoster units={blueChamps} team="blue" onItem={setInspectedItem} onFocus={focusUnit} xpProgress={hudXpProgress} second={matchTime} />
          <SpectatorRoster units={redChamps} team="red" onItem={setInspectedItem} onFocus={focusUnit} xpProgress={hudXpProgress} second={matchTime} />
        </div> : <div className="spectator-records">
          {records.slice(page * 5, page * 5 + 5).map((event, index) => <p key={index} title={event.text}><time>{event.time}</time>{event.text}</p>)}
          {records.length === 0 && <p>No {dockTab === 'items' ? 'purchases or power spikes' : 'events'} recorded yet.</p>}
          <nav aria-label="Log pages"><button disabled={page === 0} onClick={() => setRecordPage(page - 1)}>Newer</button><span>{page + 1}/{pages}</span><button disabled={page >= pages - 1} onClick={() => setRecordPage(page + 1)}>Older</button></nav>
        </div>)}
      </footer>
      {showInsights && <section aria-label="Match insights" className="absolute top-28 right-3 z-[70] w-[min(94vw,680px)] max-h-[70vh] overflow-y-auto rounded-2xl border border-emerald-500/50 bg-slate-950/95 p-3 text-slate-100 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-2">
          <div>
            <h3 className="text-sm font-black text-emerald-300">Match Insights</h3>
            <p className="text-[10px] text-slate-400">Cast totals, projectile hits, mana waits, movement completions, and decisions from this seeded match.</p>
          </div>
          <button onClick={() => setShowInsights(false)} aria-label="Close match insights" className="rounded p-1 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-[10px]">
            <thead className="text-slate-400"><tr><th className="pb-1">Player / avatar</th><th>Q</th><th>W</th><th>R / Conflux</th><th>D / F</th><th>Shots hit/fired</th><th>Mana waits</th><th>Special</th></tr></thead>
            <tbody>{insightPlayers.map(stats => <tr key={stats.id} className="border-t border-slate-800">
              <td className={`py-1 font-bold ${stats.team === 'blue' ? 'text-cyan-300' : 'text-rose-300'}`}>{stats.player} <span className="font-normal text-slate-400">{stats.avatar}</span></td>
              <td>{stats.casts.skill1 + stats.casts.orbQ}</td><td className="font-bold text-emerald-300">{stats.casts.skill2 + stats.casts.orbW}</td><td>{stats.casts.ultimate + stats.casts.conflux}</td>
              <td>{stats.casts.invokedD} / {stats.casts.invokedF}</td>
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
              <span className={event.kind === 'decision' ? 'text-violet-300' : event.kind === 'mana' ? 'text-orange-300' : event.kind === 'movement' ? 'text-emerald-300' : 'text-slate-200'}>{event.text}</span>
            </div>)}
            {insightWindow.length === 0 && <p className="text-[10px] text-slate-500">No recorded decisions or casts in this window.</p>}
          </div>
        </div>
      </section>}
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
