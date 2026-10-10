import { INNER_TOWER_X, OUTER_TOWER_X } from './arenaLayout.ts';
import type { 
  AramChampionUnit, 
  ChampionKit, 
  CoachCard, 
  HealthRelic, 
  ItemDef, 
  LaneMinion, 
  LaneStructure, 
  PlayerCard, 
  AvatarRole 
} from './types.ts';
import { CHAMPIONS } from './mockData.ts';
import { ALL_ITEMS, getRecommendedItem } from './itemsData.ts';
import { getItemPurchasePlan } from './itemStrategy.ts';
import { aimAtCast, dodgeProbability } from './skillshotRules.ts';
import { calculateDeathTimer } from './combatPacingRules.ts';
import { getTeamKillScore, getTeamTotalGold, getTowersAliveCount } from './scoreboardRules.ts';
import {
  shouldStartEpicObjective,
  shouldContestOpponentObjective,
  objectiveFightPreference,
  chooseObjectiveAction
} from './objectiveRules.ts';
import {
  evaluateTowerDive,
  shouldAbortTowerDive,
  getTurretEvacuationVector,
  getTurretPerimeterHoldPoint
} from './towerDiveRules.ts';
import {
  neutralCampRespawnSeconds,
  stepCampPatience,
  stepLeashedMonster
} from './neutralAggroRules.ts';
import {
  createMatchRandom,
  resolveTurretKillReward,
  resolveNeutralKillCredit,
  SIMULATION_STEP,
  type MatchReport,
  type RecordedMatchEvent
} from './matchReplay.ts';
import { passiveGoldPerSecond } from './economyRules.ts';
import {
  abilityDamageFromStats,
  abilityItemStats,
} from './abilityRules.ts';
import { abilityDamageMultiplier, abilityCooldownMultiplier, abilityRank } from './skillProgression.ts';
import { maxMana, manaRegen, skill1ManaCost, ultimateManaCost, ultimateBaseCooldown } from './abilityRules.ts';
import { chooseTeamfightTarget, isEnemyCaughtInAlliedChannel, shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from './combatDecision.ts';
import { createEnemyCooldownMemory, observeCooldownRise } from './cooldownKnowledge.ts';
import { getSkillCastRange, applyChainStun } from './skillRangeRules.ts';
import {
  BARRACKS_X,
  DRAGON_SPAWN_SECOND,
  DRAGON_X,
  LANE_Y,
  NEXUS_X,
  NEXUS_TOWER_X,
  WELL_X,
  STRUCTURE_HP,
  selectTurretTarget,
  turretShotDamage,
  resolveRockTerrainMovement,
  rockApproachWaypoint,
  isMinionEmpowered,
  waveStats,
  canDamageNexus,
  towerSiegeMultiplier
} from './arenaRules.ts';
import { getMinionCrashMultiplier, getMinionStructureDamage, shouldPrioritizeWaveClear } from './waveClearRules.ts';
import { createRatedAvatar } from './playerCardPower.ts';
import { shouldAwakenGolem, selectGolemChargeTower, GOLEM_CHARGE_DAMAGE } from './siegeGolemRules.ts';
import { chooseKnownJungleCamp, shouldFocusExposedNexus, shouldPressWonFight } from './macroFarmRules.ts';
import { shouldFollowUpControl, shouldSeekHealthRelic, shouldPushWithWave, laneAdvanceLimit, wouldOverstep } from './teamTempoRules.ts';
import {
  addInsightEvent,
  createMatchInsights,
  recordAbilityCast,
  recordManaBlock,
  recordSkillshot
} from './matchInspector.ts';
import { createEqualizedRoster, EQUALIZED_COACH_BLUE, EQUALIZED_COACH_RED } from './equalizedMode.ts';

export interface JungleCamp {
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

export interface DragonBoss {
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
  isAlive: boolean;
  spawnTimer: number;
  slayerTeam: 'blue' | 'red' | null;
  slainCount: number;
  targetId?: string;
}

export interface SimulationState {
  seed: number;
  random: () => number;
  matchTime: number;
  matchFinished: boolean;
  winner: 'blue' | 'red' | null;
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  draft: {
    blue: { player: PlayerCard; champion: ChampionKit }[];
    red: { player: PlayerCard; champion: ChampionKit }[];
  };
  champions: AramChampionUnit[];
  minions: LaneMinion[];
  structures: LaneStructure[];
  relics: HealthRelic[];
  jungleCamps: JungleCamp[];
  dragon: DragonBoss;
  waveTimer: number;
  waveCount: number;
  golemAwakened: boolean;
  pendingSiegeGolem: Partial<Record<'blue' | 'red', true>>;
  cooldownMemory: ReturnType<typeof createEnemyCooldownMemory>;
  insights: ReturnType<typeof createMatchInsights>;
  recordedEvents: RecordedMatchEvent[];
  lastTeamKillAt: { blue: number; red: number };
  aegisBuff: { team: 'blue' | 'red'; expiresAt: number; siegeMultiplier: number } | null;
  itemCounts: Partial<Record<8 | 10 | 12 | 13, number[]>>;
  fullBuildsAt15: number | null;
  skillshots: { fired: number; hit: number };
  telemetry: {
    towerDiveAttempts: number;
    towerDiveSuccesses: number;
    towerDiveAborts: number;
    turretExecutions: number;
    supportCampFarms: number;
    dragonKills: { blue: number; red: number };
    golemKills: { blue: number; red: number };
  };
}

export interface SimulationOptions {
  seed: number;
  blueLineup?: { player: PlayerCard; champion: ChampionKit }[];
  redLineup?: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  maxDurationSeconds?: number;
}

export interface ChampionSimulationStats {
  id: string;
  playerName: string;
  avatarName: string;
  avatarDisplayName: string;
  role: AvatarRole;
  team: 'blue' | 'red';
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageDealt: number;
  damageTaken: number;
  itemsCount: number;
  manaBlocks: number;
  level: number;
}

export interface MatchSimulationResult {
  seed: number;
  winner: 'blue' | 'red';
  durationSeconds: number;
  durationMinutes: number;
  blueKills: number;
  redKills: number;
  blueGold: number;
  redGold: number;
  blueTowersAlive: number;
  redTowersAlive: number;
  report: MatchReport;
  champions: ChampionSimulationStats[];
  telemetry: SimulationState['telemetry'];
}

export interface BatchSimulationAnalysis {
  totalMatches: number;
  blueWins: number;
  redWins: number;
  blueWinRate: number;
  redWinRate: number;
  averageDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  medianDurationMinutes: number;
  averageKillsPerMatch: number;
  averageBlueKills: number;
  averageRedKills: number;
  averageBlueGold: number;
  averageRedGold: number;
  skillshotHitRate: number;
  towerDives: {
    totalAttempts: number;
    aborts: number;
    executions: number;
    abortRate: number;
  };
  supportCampFarms: number;
  objectives: {
    totalDragons: number;
    totalGolems: number;
    blueDragons: number;
    redDragons: number;
  };
  roleStats: Record<AvatarRole, {
    avgDamage: number;
    avgGold: number;
    avgKills: number;
    avgDeaths: number;
    avgManaBlocks: number;
  }>;
  avatarWinRates: Record<string, { games: number; wins: number; winRate: number }>;
  diagnostics: string[];
}

export function canDamageStructure(structure: LaneStructure, structures: readonly LaneStructure[]): boolean {
  if (!structure.isAlive) return false;
  const defenders = structures.filter(s => s.team === structure.team);
  if (structure.type === 'inner_tower') {
    return !defenders.some(s => s.type === 'outer_tower' && s.isAlive);
  }
  if (structure.type === 'nexus_tower') {
    return !defenders.some(s => (s.type === 'outer_tower' || s.type === 'inner_tower') && s.isAlive);
  }
  if (structure.type === 'barracks') {
    return !defenders.some(s => s.type.includes('tower') && s.isAlive);
  }
  if (structure.type === 'nexus') {
    return canDamageNexus(structure.team, structures);
  }
  return true;
}

export function setUnitFacing(unit: AramChampionUnit, targetX: number, deadband = 12): void {
  const dx = targetX - unit.x;
  if (Math.abs(dx) > deadband) {
    unit.facing = dx > 0 ? 'right' : 'left';
  }
}

export function createDefaultSimulationLineup(side: 'blue' | 'red'): { player: PlayerCard; champion: ChampionKit }[] {
  const cards = createEqualizedRoster(side);
  const findChamp = (name: string) => CHAMPIONS.find(c => c.name === name || c.displayName === name)!;
  if (side === 'blue') {
    return [
      { player: cards[0], champion: findChamp('Kaolin') },     // TOP Tank (TerraByte)
      { player: cards[1], champion: findChamp('Veyara') },     // JGL Assassin (Crownfetti)
      { player: cards[2], champion: findChamp('Raijin') },     // MID Mage (Voltaire)
      { player: cards[3], champion: findChamp('Cora') },       // BOT Marksman (Plumeira)
      { player: cards[4], champion: findChamp('Tequoia') },    // SUP Support (Fernanda / Cardrel)
    ];
  } else {
    return [
      { player: cards[0], champion: findChamp('Solana') },     // TOP Tank (Dawnna)
      { player: cards[1], champion: findChamp('Cinderbloom') },// JGL Fighter/Assassin (Sootcase)
      { player: cards[2], champion: findChamp('Nullweaver') }, // MID Mage (Midnight Equation)
      { player: cards[3], champion: findChamp('Kindra') },     // BOT Marksman (Lambent)
      { player: cards[4], champion: findChamp('Mirehook') },   // SUP Support (Rotisserie / SneakBro)
    ];
  }
}

export function createSimulationState(options: SimulationOptions): SimulationState {
  const seed = options.seed;
  const random = createMatchRandom(seed);
  const blueLineup = options.blueLineup ?? createDefaultSimulationLineup('blue');
  const redLineup = options.redLineup ?? createDefaultSimulationLineup('red');
  const blueCoach = options.blueCoach ?? EQUALIZED_COACH_BLUE;
  const redCoach = options.redCoach ?? EQUALIZED_COACH_RED;

  const makeBarracks = (team: 'blue' | 'red'): LaneStructure[] =>
    (['melee', 'ranged', 'catapult'] as const).map((kind, index) => ({
      id: `${team === 'blue' ? 'b' : 'r'}_${kind}_barracks`,
      team,
      type: 'barracks',
      barracksKind: kind,
      name: `${team === 'blue' ? 'Blue' : 'Red'} ${kind} Barracks`,
      x: BARRACKS_X[team], y: 305 + index * 75,
      hp: STRUCTURE_HP.barracks, maxHp: STRUCTURE_HP.barracks, ad: 0, range: 0, attackTimer: 0,
      isAlive: true, targetId: null, armor: 20
    }));

  const structures: LaneStructure[] = [
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

  const relics: HealthRelic[] = [
    { id: 'relic_top', x: 1095, y: 295, respawnTimer: 0, healAmount: 260 },
    { id: 'relic_bot', x: 1505, y: 465, respawnTimer: 0, healAmount: 260 }
  ];

  const jungleCamps: JungleCamp[] = [
    { id: 'j_blue_golem', name: 'Frost Sentinel', type: 'golem', x: 876, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_wolves', name: 'Shadow Stalkers', type: 'wolves', x: 1724, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#a855f7' },
    { id: 'j_blue_behemoth', name: 'Murk Behemoth', type: 'behemoth', x: 967, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#10b981' },
    { id: 'j_red_drakes', name: 'Crimson Drakes', type: 'drakes', x: 1633, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#ef4444' },
    { id: 'j_blue_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 640, y: 145, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_blue_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 785, y: 600, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#fb7185' },
    { id: 'j_red_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 1960, y: 145, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 1815, y: 600, hp: 1550, maxHp: 1550, ad: 50, range: 230, goldReward: 100, xpReward: 120, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#fb7185' },
    { id: 'j_siege_golem', name: 'Gravemarch Colossus', type: 'siege_golem', x: 1300, y: 610, hp: 6200, maxHp: 6200, ad: 135, range: 230, goldReward: 250, xpReward: 300, respawnTimer: 0, isAlive: false, attackTimer: 0, color: '#d4a764' }
  ];

  const dragon: DragonBoss = {
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
  };

  const buyInitialLoadout = (role: AvatarRole, champName: string) => {
    const items: ItemDef[] = [];
    let g = 1500;
    const starter = getRecommendedItem(role, [], g, champName);
    if (starter) { items.push(starter); g -= starter.cost; }
    const comp = getRecommendedItem(role, items.map(it => it.id), g, champName);
    if (comp) { items.push(comp); g -= comp.cost; }
    return { items, remainingGold: g };
  };

  const champions: AramChampionUnit[] = [];

  const setupUnits = (lineup: { player: PlayerCard; champion: ChampionKit }[], side: 'blue' | 'red', coach?: CoachCard) => {
    lineup.forEach((item, idx) => {
      const loadout = buyInitialLoadout(item.champion.primaryRole, item.champion.name);
      const champCopy = createRatedAvatar(item.player, item.champion);
      let bonusHp = 0;
      loadout.items.forEach(it => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      champions.push({
        id: `${side}_${item.player.id}`,
        player: item.player,
        champion: champCopy,
        team: side,
        teamChemistry: coach?.chemistryBonus ?? 10,
        x: WELL_X[side] + (idx % 2) * 20,
        y: LANE_Y - 60 + idx * 30,
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
        cdUlt: 0,
        stunTimer: 0,
        charmTimer: 0,
        facing: side === 'blue' ? 'right' : 'left',
        animState: 'idle',
        animTimer: 0,
        isInBush: false,
        sterakCooldown: 0,
        zhonyaActive: false,
        zhonyaTimer: 0,
        immolateTimer: 0,
        krakenCounter: 0,
      });
    });
  };

  setupUnits(blueLineup, 'blue', blueCoach);
  setupUnits(redLineup, 'red', redCoach);

  return {
    seed,
    random,
    matchTime: 0,
    matchFinished: false,
    winner: null,
    blueCoach,
    redCoach,
    draft: { blue: blueLineup, red: redLineup },
    champions,
    minions: [],
    structures,
    relics,
    jungleCamps,
    dragon,
    waveTimer: 2.0,
    waveCount: 0,
    golemAwakened: false,
    pendingSiegeGolem: {},
    cooldownMemory: createEnemyCooldownMemory(),
    insights: createMatchInsights(),
    recordedEvents: [],
    lastTeamKillAt: { blue: -Infinity, red: -Infinity },
    aegisBuff: null,
    itemCounts: {},
    fullBuildsAt15: null,
    skillshots: { fired: 0, hit: 0 },
    telemetry: {
      towerDiveAttempts: 0,
      towerDiveSuccesses: 0,
      towerDiveAborts: 0,
      turretExecutions: 0,
      supportCampFarms: 0,
      dragonKills: { blue: 0, red: 0 },
      golemKills: { blue: 0, red: 0 }
    }
  };
}

export function stepSimulation(sim: SimulationState, dt: number): void {
  if (sim.matchFinished) return;
  sim.matchTime += dt;
  const now = sim.matchTime;

  // 1. Minion Wave Spawn (Every 22s)
  sim.waveTimer -= dt;
  if (sim.waveTimer <= 0) {
    sim.waveCount++;
    sim.waveTimer = 22.0;
    (['blue', 'red'] as const).forEach(team => {
      const dir = team === 'blue' ? 1 : -1;
      const spawnX = BARRACKS_X[team] + dir * 42;
      const addM = (type: LaneMinion['type'], idx: number, x: number, y: number) => {
        const emp = isMinionEmpowered(team, type, sim.structures);
        const stats = waveStats(type, emp);
        sim.minions.push({
          id: `${team}_${type}_${sim.waveCount}_${idx}`,
          team, type, x, y,
          ...stats,
          maxHp: stats.hp,
          attackTimer: 0,
          isAlive: true,
          empowered: emp
        });
      };
      for (let i = 0; i < 3; i++) {
        addM('melee', i, spawnX + dir * (20 + i * 16), 350 + i * 15);
        addM('caster', i, spawnX - dir * (16 + i * 16), 365 + i * 15);
      }
      if (sim.waveCount % 3 === 0 || isMinionEmpowered(team, 'cannon', sim.structures)) {
        addM('cannon', 0, spawnX - dir * 38, 430);
      }
      if (sim.pendingSiegeGolem[team]) {
        sim.minions.push({
          id: `siege_golem_${team}_${sim.waveCount}`,
          team, type: 'melee', siegeGolem: true,
          x: spawnX - dir * 55, y: LANE_Y,
          hp: 3200, maxHp: 3200, ad: 110, range: 75, speed: 86,
          attackTimer: 0, goldReward: 110, xpReward: 130, isAlive: true,
          siegeChargeCooldown: 2.5, siegeChargeWindup: 0
        });
        delete sim.pendingSiegeGolem[team];
      }
    });
  }

  // 2. Boss & Jungle Spawns
  if (shouldAwakenGolem(now, sim.golemAwakened)) {
    const colossus = sim.jungleCamps.find(c => c.type === 'siege_golem');
    if (colossus) {
      colossus.isAlive = true;
      colossus.hp = colossus.maxHp;
      sim.golemAwakened = true;
    }
  }
  if (!sim.dragon.isAlive && now >= DRAGON_SPAWN_SECOND && sim.dragon.slainCount === 0) {
    sim.dragon.isAlive = true;
    sim.dragon.hp = sim.dragon.maxHp;
  }

  // 3. Relics
  sim.relics.forEach(r => {
    if (r.respawnTimer > 0) r.respawnTimer = Math.max(0, r.respawnTimer - dt);
  });

  // 4. Milestone Checkpoints
  for (const m of [8, 10, 12, 13] as const) {
    if (now - dt < m * 60 && now >= m * 60) {
      sim.itemCounts[m] = sim.champions.map(c => c.items.filter(it => it.tier === 'Legendary' || it.tier === 'Mythic').length);
    }
  }
  if (now - dt < 900 && now >= 900) {
    sim.fullBuildsAt15 = sim.champions.filter(c => c.items.filter(it => it.tier === 'Legendary' || it.tier === 'Mythic').length >= 6).length;
  }

  // 5. Champions Income, Health Regen, Fountain & Shopping
  sim.champions.forEach(c => {
    if (!c.isAlive) {
      c.respawnTimer -= dt;
      if (c.respawnTimer <= 0) {
        c.isAlive = true;
        c.hp = c.maxHp;
        c.mana = 100;
        c.x = WELL_X[c.team];
        c.y = LANE_Y;
      }
      return;
    }

    // Passive gold & mana
    c.gold += passiveGoldPerSecond(c.player.stats.lan) * dt;
    c.mana = Math.min(maxMana(c), c.mana + (1.5 + manaRegen(c)) * dt);

    // In Fountain Well
    const inWell = c.team === 'blue' ? (c.x <= WELL_X.blue + 105) : (c.x >= WELL_X.red - 105);
    if (inWell) {
      c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.45 * dt);
      c.mana = Math.min(maxMana(c), c.mana + 75 * dt);

      // Shop items
      for (let purchase = 0; purchase < 6; purchase++) {
        const plan = getItemPurchasePlan(c.champion.primaryRole, c.items, c.gold, c.champion.name, ALL_ITEMS);
        if (!plan) break;
        const nextItem = plan.item;
        c.gold -= plan.goldCost;
        for (const removed of plan.removed) {
          const index = c.items.findIndex(item => item.id === removed.id);
          if (index >= 0) c.items.splice(index, 1);
          c.champion.ad -= removed.stats.ad ?? 0;
          c.champion.armor -= removed.stats.armor ?? 0;
          c.champion.mr -= removed.stats.mr ?? 0;
          c.champion.aspd -= removed.stats.aspd ?? 0;
          c.maxHp -= removed.stats.hp ?? 0;
          c.hp = Math.min(c.hp, c.maxHp);
        }
        c.items.push(nextItem);
        c.champion.ad += nextItem.stats.ad ?? 0;
        c.champion.armor += nextItem.stats.armor ?? 0;
        c.champion.mr += nextItem.stats.mr ?? 0;
        c.champion.aspd += nextItem.stats.aspd ?? 0;
        c.maxHp += nextItem.stats.hp ?? 0;
        c.hp += nextItem.stats.hp ?? 0;
      }
    }

    // Cooldown ticks
    c.cd1 = Math.max(0, c.cd1 - dt);
    c.cd2 = Math.max(0, c.cd2 - dt);
    c.cdUlt = Math.max(0, c.cdUlt - dt);
    c.attackTimer = Math.max(0, c.attackTimer - dt);
    c.stunTimer = Math.max(0, c.stunTimer - dt);
    c.combatTimer = Math.max(0, (c.combatTimer ?? 0) - dt);

    // Relic pickup if close
    if (c.hp < c.maxHp * 0.75) {
      const closeRelic = sim.relics.find(r => r.respawnTimer <= 0 && Math.hypot(r.x - c.x, r.y - c.y) <= 45);
      if (closeRelic) {
        c.hp = Math.min(c.maxHp, c.hp + closeRelic.healAmount);
        c.mana = Math.min(maxMana(c), c.mana + 150);
        closeRelic.respawnTimer = 60;
      }
    }
  });

  // 6. Minion Movement & Combat
  sim.minions.forEach(m => {
    if (!m.isAlive) return;
    const oppTeam = m.team === 'blue' ? 'red' : 'blue';
    const oppMinions = sim.minions.filter(o => o.team === oppTeam && o.isAlive);
    const oppStructures = sim.structures.filter(s => s.team === oppTeam && s.isAlive);
    const oppChamps = sim.champions.filter(c => c.team === oppTeam && c.isAlive);

    const closeMinion = oppMinions.find(o => Math.hypot(o.x - m.x, o.y - m.y) <= m.range + 20);
    const closeStructure = oppStructures.find(s => Math.hypot(s.x - m.x, s.y - m.y) <= m.range + 35);
    const closeChamp = oppChamps.find(c => Math.hypot(c.x - m.x, c.y - m.y) <= m.range + 10);

    const target = closeMinion || closeStructure || closeChamp;
    m.attackTimer = Math.max(0, m.attackTimer - dt);

    if (target) {
      if (m.attackTimer <= 0) {
        m.attackTimer = 1.05;
        if ('type' in target && target.type && !('player' in target)) {
          if ('armor' in target) {
            // Target is structure
            const dmg = getMinionStructureDamage(m.type, m.ad);
            damageStructure(sim, target as LaneStructure, dmg);
          } else {
            // Target is minion
            (target as LaneMinion).hp -= m.ad;
            if ((target as LaneMinion).hp <= 0) (target as LaneMinion).isAlive = false;
          }
        } else if ('player' in target) {
          applyChampionDamage(sim, null, target as AramChampionUnit, m.ad, false, 'Creep');
        }
      }
    } else {
      // March down lane
      const dir = m.team === 'blue' ? 1 : -1;
      m.x += dir * m.speed * dt;
    }
  });
  sim.minions = sim.minions.filter(m => m.isAlive);

  // 7. Structure Attacks
  sim.structures.forEach(st => {
    if (!st.isAlive || st.ad === 0) return;
    st.attackTimer = Math.max(0, st.attackTimer - dt);
    const enemyTeam = st.team === 'blue' ? 'red' : 'blue';
    const attackers = sim.champions.filter(c => c.team === enemyTeam && c.isAlive && Math.hypot(c.x - st.x, c.y - st.y) <= st.range);
    const waveMinions = sim.minions.filter(m => m.team === enemyTeam && m.isAlive && Math.hypot(m.x - st.x, m.y - st.y) <= st.range);

    const inRange = [...waveMinions, ...attackers];
    const target = selectTurretTarget(inRange, st.targetId, st.diveAggressorId);
    st.targetId = target ? target.id : null;
    if (target && st.attackTimer <= 0) {
      st.attackTimer = 1.1;
      if ('player' in target) {
        const champ = target as AramChampionUnit;
        const dmg = turretShotDamage(st.ad, true, st.type === 'nexus');
        applyChampionDamage(sim, null, champ, dmg, true, '🏰 Turret');
      } else {
        const minion = target as LaneMinion;
        minion.hp -= turretShotDamage(st.ad, false, st.type === 'nexus');
        if (minion.hp <= 0) minion.isAlive = false;
      }
    }
  });

  // 8. Champion AI, Movement & Combat
  sim.champions.forEach(u => {
    if (!u.isAlive || u.stunTimer > 0) return;

    const oppTeam = u.team === 'blue' ? 'red' : 'blue';
    const allies = sim.champions.filter(a => a.team === u.team && a.isAlive && a.id !== u.id);
    const enemies = sim.champions.filter(e => e.team === oppTeam && e.isAlive);
    const enemyStructures = sim.structures.filter(s => s.team === oppTeam && s.isAlive);
    const enemyLiveTurrets = enemyStructures.filter(s => s.type.includes('tower'));
    const closestEnemyTower = enemyLiveTurrets.sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];

    const attackRange = u.champion.range * 45;

    // Check Tower Dive & Evacuation
    let isDiving = false;
    if (closestEnemyTower) {
      const isInsideTower = Math.hypot(u.x - closestEnemyTower.x, u.y - closestEnemyTower.y) <= closestEnemyTower.range;
      const underTowerEnemies = enemies.filter(e => Math.hypot(e.x - closestEnemyTower.x, e.y - closestEnemyTower.y) <= closestEnemyTower.range);
      const alliedWaveUnderTower = sim.minions.filter(m => m.team === u.team && m.isAlive && Math.hypot(m.x - closestEnemyTower.x, m.y - closestEnemyTower.y) <= closestEnemyTower.range);

      if (isInsideTower) {
        u.diveTimer = (u.diveTimer ?? 0) + dt;
        const targetUnderTower = underTowerEnemies[0] ?? null;
        const abortCheck = shouldAbortTowerDive({
          diver: u,
          target: targetUnderTower,
          tower: closestEnemyTower,
          alliedMinionsUnderTower: alliedWaveUnderTower.length,
          defendersUnderTower: underTowerEnemies.length,
          diveDuration: u.diveTimer,
          takingTurretFire: closestEnemyTower.targetId === u.id,
        });

        if (abortCheck.shouldAbort && !u.diveAborting) {
          u.diveAborting = true;
          sim.telemetry.towerDiveAborts++;
        }
      } else {
        u.diveTimer = 0;
        if (Math.hypot(u.x - closestEnemyTower.x, u.y - closestEnemyTower.y) > closestEnemyTower.range + 50) {
          u.diveAborting = false;
        }
      }

      if (u.diveAborting) {
        const evac = getTurretEvacuationVector(u, closestEnemyTower);
        const edx = evac.targetX - u.x;
        const edy = evac.targetY - u.y;
        const edist = Math.hypot(edx, edy) || 1;
        u.x += (edx / edist) * (95 + 35) * dt;
        u.y += (edy / edist) * (95 + 35) * dt;
        return;
      }

      if (underTowerEnemies.length > 0) {
        const targetUnderTower = underTowerEnemies[0];
        const diveDecision = evaluateTowerDive({
          diver: u,
          target: targetUnderTower,
          tower: closestEnemyTower,
          alliedMinionsUnderTower: alliedWaveUnderTower.length,
          attackersUnderTower: allies.filter(a => Math.hypot(a.x - closestEnemyTower.x, a.y - closestEnemyTower.y) <= closestEnemyTower.range).length + 1,
          defendersUnderTower: underTowerEnemies.length,
        });

        if (diveDecision.canDive) {
          isDiving = true;
          sim.telemetry.towerDiveAttempts++;
        }
      }
    }

    // Target Selection
    const target = chooseTeamfightTarget(u, enemies, allies, attackRange, {
      enemyStructures: closestEnemyTower ? [closestEnemyTower] : undefined,
      alliedMinions: sim.minions.filter(m => m.team === u.team && m.isAlive),
    });

    if (target) {
      const dist = Math.hypot(target.x - u.x, target.y - u.y);
      setUnitFacing(u, target.x);

      // Ability casts
      const skill1Range = getSkillCastRange(u.champion.name, 'skill1', attackRange);
      const skill2Range = getSkillCastRange(u.champion.name, 'skill2', attackRange);
      const ultRange = getSkillCastRange(u.champion.name, 'ultimate', attackRange);

      // Cast Ultimate
      if (u.level >= 6 && u.cdUlt <= 0 && dist <= ultRange) {
        const cost = ultimateManaCost(u);
        if (u.mana >= cost) {
          if (shouldUseUltimate(u, target, enemies, allies, ultRange)) {
            u.mana -= cost;
            u.cdUlt = ultimateBaseCooldown(u) * abilityCooldownMultiplier(u.level, 'ultimate');
            recordAbilityCast(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, 'ultimate', now);
            const { bonusAd, bonusAp } = abilityItemStats(u);
            const ultDmg = abilityDamageFromStats(
              u.champion.ultimate.damage, u.champion, 'ultimate', bonusAd, bonusAp
            ) * abilityDamageMultiplier(u.level, 'ultimate');
            applyChampionDamage(sim, u, target, ultDmg, false, u.champion.ultimate.name);
          }
        } else {
          recordManaBlock(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, 'ultimate', now, cost - u.mana);
        }
      }

      // Cast Skill 1
      if (u.cd1 <= 0 && dist <= skill1Range) {
        const cost = skill1ManaCost(u);
        if (u.mana >= cost) {
          if (shouldUseSkill(u, target, enemies, skill1Range)) {
            u.mana -= cost;
            u.cd1 = (u.champion.skill1.cooldown || 10) * abilityCooldownMultiplier(u.level, 'skill1');
            recordAbilityCast(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, 'skill1', now);
            sim.skillshots.fired++;
            const dodge = dodgeProbability(target.player.stats.lan, target.player.stats.iq, u.player.stats.lan);
            if (sim.random() > dodge) {
              sim.skillshots.hit++;
              recordSkillshot(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, true, now);
              const { bonusAd, bonusAp } = abilityItemStats(u);
              const s1Dmg = abilityDamageFromStats(
                u.champion.skill1.damage, u.champion, 'skill1', bonusAd, bonusAp
              ) * abilityDamageMultiplier(u.level, 'skill1');
              applyChampionDamage(sim, u, target, s1Dmg, false, u.champion.skill1.name);
            } else {
              recordSkillshot(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, false, now);
            }
          }
        } else {
          recordManaBlock(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, 'skill1', now, cost - u.mana);
        }
      }

      // Cast Skill 2
      if (u.cd2 <= 0 && dist <= skill2Range) {
        const cost = 35;
        if (u.mana >= cost) {
          if (shouldUseSecondSkill(u, target, enemies, allies, skill2Range)) {
            u.mana -= cost;
            u.cd2 = (u.champion.skill2.cooldown || 10) * abilityCooldownMultiplier(u.level, 'skill2');
            recordAbilityCast(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, 'skill2', now);
            const { bonusAd, bonusAp } = abilityItemStats(u);
            const s2Dmg = abilityDamageFromStats(
              u.champion.skill2.damage, u.champion, 'skill2', bonusAd, bonusAp
            ) * abilityDamageMultiplier(u.level, 'skill2');
            applyChampionDamage(sim, u, target, s2Dmg, false, u.champion.skill2.name);
          }
        } else {
          recordManaBlock(sim.insights, { id: u.id, team: u.team, player: u.player, champion: u.champion }, 'skill2', now, cost - u.mana);
        }
      }

      // Basic Attack
      if (dist <= attackRange) {
        if (u.attackTimer <= 0) {
          u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
          const hasKraken = u.items.some(it => it.id === 'item_kraken_slayer');
          let extraDmg = 0;
          if (hasKraken) {
            u.krakenCounter = ((u.krakenCounter ?? 0) + 1) % 3;
            if (u.krakenCounter === 0) extraDmg += 75;
          }
          applyChampionDamage(sim, u, target, u.champion.ad + extraDmg, false);
        }
      } else {
        // Approach target
        const angle = Math.atan2(target.y - u.y, target.x - u.x);
        const nextPos = resolveRockTerrainMovement(
          { x: u.x, y: u.y },
          { x: u.x + Math.cos(angle) * 85 * dt, y: u.y + Math.sin(angle) * 85 * dt }
        );
        u.x = nextPos.x;
        u.y = nextPos.y;
      }
    } else {
      // Lane wave push or structure assault
      const targetStructure = enemyStructures.find(s => Math.hypot(s.x - u.x, s.y - u.y) <= attackRange + 25);
      if (targetStructure) {
        if (u.attackTimer <= 0) {
          u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
          const nearbyMinions = sim.minions.filter(m => m.team === u.team && m.isAlive && Math.abs(m.x - targetStructure.x) <= 240);
          const crashMul = getMinionCrashMultiplier(nearbyMinions);
          const marksmanMul = u.champion.primaryRole === 'Marksman' ? 1.25 : 1.0;
          damageStructure(sim, targetStructure, Math.round(u.champion.ad * crashMul * marksmanMul));
        }
      } else {
        const dir = u.team === 'blue' ? 1 : -1;
        const alliedWave = sim.minions.filter(m => m.team === u.team && m.isAlive);
        const oppWave = sim.minions.filter(m => m.team !== u.team && m.isAlive);
        const lanePushed = alliedWave.length >= oppWave.length;

        // Check Epic Objectives (Dragon Embermaw & Gravemarch Colossus)
        const golemCamp = sim.jungleCamps.find(c => c.type === 'siege_golem');
        const dragon = sim.dragon;

        const canDoDragon = dragon.isAlive && shouldStartEpicObjective({
          gameSeconds: now,
          bossHealthFraction: dragon.hp / dragon.maxHp,
          healthyAllies: allies.filter(a => a.hp / a.maxHp > 0.58).length,
          nearbyEnemies: enemies.filter(e => Math.hypot(e.x - dragon.x, e.y - dragon.y) < 360).length,
          lanePriority: lanePushed,
          hasVision: true,
          averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
          averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
          chemistry: 10,
          coachPlaybook: 8,
          actorHealthFraction: u.hp / u.maxHp
        });

        const canDoGolem = !canDoDragon && Boolean(golemCamp && golemCamp.isAlive) && shouldStartEpicObjective({
          gameSeconds: now,
          bossHealthFraction: golemCamp ? golemCamp.hp / golemCamp.maxHp : 1,
          healthyAllies: allies.filter(a => a.hp / a.maxHp > 0.58).length,
          nearbyEnemies: enemies.filter(e => golemCamp ? Math.hypot(e.x - golemCamp.x, e.y - golemCamp.y) < 360 : 0).length,
          lanePriority: lanePushed,
          hasVision: true,
          averageIq: allies.reduce((sum, a) => sum + a.player.stats.iq, 0) / Math.max(1, allies.length),
          averageTeamfight: allies.reduce((sum, a) => sum + a.player.stats.tf, 0) / Math.max(1, allies.length),
          chemistry: 10,
          coachPlaybook: 8,
          actorHealthFraction: u.hp / u.maxHp
        });

        const bossTarget = canDoDragon ? dragon : (canDoGolem && golemCamp ? golemCamp : null);
        if (bossTarget) {
          const bossDist = Math.hypot(bossTarget.x - u.x, bossTarget.y - u.y);
          setUnitFacing(u, bossTarget.x);
          if (bossDist <= attackRange + 15) {
            if (u.attackTimer <= 0) {
              u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
              bossTarget.hp -= u.champion.ad * 1.15;
              if (bossTarget.hp <= 0) {
                bossTarget.isAlive = false;
                if (bossTarget === dragon) {
                  dragon.slayerTeam = u.team;
                  dragon.slainCount++;
                  sim.telemetry.dragonKills[u.team]++;
                  sim.aegisBuff = { team: u.team, expiresAt: now + 120, siegeMultiplier: 1.5 };
                  sim.champions.filter(c => c.team === u.team).forEach(c => { c.gold += 300; });
                } else if (golemCamp && bossTarget === golemCamp) {
                  sim.telemetry.golemKills[u.team]++;
                  sim.pendingSiegeGolem[u.team] = true;
                  sim.champions.filter(c => c.team === u.team).forEach(c => { c.gold += 250; });
                }
              }
            }
            return;
          } else {
            const waypoint = rockApproachWaypoint(u, bossTarget);
            const angle = Math.atan2(waypoint.y - u.y, waypoint.x - u.x);
            const nextPos = resolveRockTerrainMovement(
              { x: u.x, y: u.y },
              { x: u.x + Math.cos(angle) * 85 * dt, y: u.y + Math.sin(angle) * 85 * dt }
            );
            u.x = nextPos.x;
            u.y = nextPos.y;
            return;
          }
        }

        const waveFrontX = alliedWave.length > 0
          ? (u.team === 'blue' ? Math.max(...alliedWave.map(m => m.x)) : Math.min(...alliedWave.map(m => m.x)))
          : undefined;
        const nearestStructure = enemyStructures[0];
        const isExposedNexus = !!nearestStructure && nearestStructure.type === 'nexus' && canDamageNexus(nearestStructure.team, sim.structures);
        const advanceLimit = laneAdvanceLimit({
          team: u.team,
          waveFrontX,
          waveCount: alliedWave.length,
          structureX: nearestStructure?.x,
          structureRange: nearestStructure?.range,
          exposedNexus: isExposedNexus,
          objectiveFight: false,
        });
        const nextX = u.x + dir * 75 * dt;
        if (!wouldOverstep(u.team, nextX, advanceLimit)) {
          const nextPos = resolveRockTerrainMovement({ x: u.x, y: u.y }, { x: nextX, y: LANE_Y });
          u.x = nextPos.x;
          u.y = nextPos.y;
        }
      }
    }
  });

  // 9. Jungle Camp Clears (Only non-supports!)
  sim.jungleCamps.forEach(camp => {
    if (!camp.isAlive) return;
    const hunters = sim.champions.filter(c => c.isAlive && Math.hypot(c.x - camp.x, c.y - camp.y) <= 180);
    const validHunter = hunters.find(c => {
      // The headless model covers solo camp clears, not live post-recall team calls.
      if (c.champion.primaryRole === 'Support') {
        sim.telemetry.supportCampFarms++;
        return false;
      }
      return true;
    });

    if (validHunter) {
      camp.hp -= validHunter.champion.ad * 1.5 * dt;
      if (camp.hp <= 0) {
        camp.isAlive = false;
        camp.respawnTimer = neutralCampRespawnSeconds(camp.type) ?? 0;
        validHunter.gold += camp.goldReward;
        validHunter.cs += 4;
        if (camp.type === 'siege_golem') {
          sim.telemetry.golemKills[validHunter.team]++;
          sim.pendingSiegeGolem[validHunter.team] = true;
        }
      }
    }
  });

  // 10. Dragon Combat
  if (sim.dragon.isAlive) {
    const dragonHunters = sim.champions.filter(c => c.isAlive && Math.hypot(c.x - sim.dragon.x, c.y - sim.dragon.y) <= 230);
    const blueHunters = dragonHunters.filter(c => c.team === 'blue');
    const redHunters = dragonHunters.filter(c => c.team === 'red');

    // Only hit dragon if no immediate fight or low health
    if (blueHunters.length > 0 && redHunters.length === 0) {
      const dps = blueHunters.reduce((sum, h) => sum + h.champion.ad, 0);
      sim.dragon.hp -= dps * dt;
    } else if (redHunters.length > 0 && blueHunters.length === 0) {
      const dps = redHunters.reduce((sum, h) => sum + h.champion.ad, 0);
      sim.dragon.hp -= dps * dt;
    }

    if (sim.dragon.hp <= 0) {
      sim.dragon.isAlive = false;
      sim.dragon.slainCount++;
      const slayerTeam = blueHunters.length > redHunters.length ? 'blue' : 'red';
      sim.telemetry.dragonKills[slayerTeam]++;
      sim.aegisBuff = { team: slayerTeam, expiresAt: now + 120, siegeMultiplier: 1.5 };
      sim.champions.filter(c => c.team === slayerTeam).forEach(c => { c.gold += 300; });
    }
  }
}

function damageStructure(sim: SimulationState, structure: LaneStructure, damage: number): void {
  if (!structure.isAlive) return;
  if (!canDamageStructure(structure, sim.structures)) return;
  const applied = Math.max(1, Math.round(damage * (structure.type.includes('tower') ? towerSiegeMultiplier(sim.matchTime) : 1)));
  structure.hp = Math.max(0, structure.hp - applied);
  if (structure.hp <= 0) {
    structure.isAlive = false;
    const oppTeam = structure.team === 'blue' ? 'red' : 'blue';
    const bounty = structure.type.includes('tower') ? 250 : 200;
    sim.champions.filter(c => c.team === oppTeam).forEach(c => { c.gold += bounty; });

    if (structure.type === 'nexus') {
      sim.matchFinished = true;
      sim.winner = oppTeam;
    }
  }
}

function applyChampionDamage(
  sim: SimulationState,
  attacker: AramChampionUnit | null,
  target: AramChampionUnit,
  rawDamage: number,
  isTrueDamage: boolean,
  label?: string
): void {
  if (!target.isAlive) return;
  const armor = target.champion.armor;
  const mr = target.champion.mr;
  const reduction = isTrueDamage ? 1 : (100 / (100 + armor));
  const finalDamage = Math.max(1, Math.round(rawDamage * reduction));

  target.combatTimer = 5.0;
  if (attacker) {
    attacker.combatTimer = 5.0;
    target.lastEnemyDamage = { attackerId: attacker.id, second: sim.matchTime };
    attacker.damageDealt += finalDamage;
  }
  target.damageTaken += finalDamage;

  if (target.shield > 0) {
    if (target.shield >= finalDamage) {
      target.shield -= finalDamage;
      return;
    } else {
      const leftover = finalDamage - target.shield;
      target.shield = 0;
      target.hp = Math.max(0, target.hp - leftover);
    }
  } else {
    target.hp = Math.max(0, target.hp - finalDamage);
  }

  if (target.hp <= 0 && target.isAlive) {
    target.isAlive = false;
    target.deaths++;
    target.respawnTimer = calculateDeathTimer(target.level, sim.matchTime);

    // Resolve kill credit (10s turret execution window rule)
    const isTurret = !attacker && Boolean(label?.includes('Turret'));
    let killer = attacker;
    if (isTurret) {
      const reward = resolveTurretKillReward(target, sim.matchTime, sim.champions, 10);
      killer = reward.killer;
      if (!killer) {
        sim.telemetry.turretExecutions++;
      }
    }

    if (killer) {
      killer.kills++;
      killer.gold += 300;
      const allies = sim.champions.filter(a => a.team === killer!.team && a.id !== killer!.id && Math.hypot(a.x - target.x, a.y - target.y) <= 450);
      allies.forEach(a => { a.assists++; a.gold += 75; });
    }
  }
}

export function runMatchSimulation(options: SimulationOptions): MatchSimulationResult {
  const maxDurationSeconds = options.maxDurationSeconds ?? 1200;
  const sim = createSimulationState(options);

  while (!sim.matchFinished && sim.matchTime < maxDurationSeconds) {
    stepSimulation(sim, SIMULATION_STEP);
  }

  // If time runs out, winner is decided by gold lead
  if (!sim.winner) {
    const blueGold = sim.champions.filter(c => c.team === 'blue').reduce((sum, c) => sum + c.gold, 0);
    const redGold = sim.champions.filter(c => c.team === 'red').reduce((sum, c) => sum + c.gold, 0);
    sim.winner = blueGold >= redGold ? 'blue' : 'red';
  }

  const { blue: blueKills, red: redKills } = getTeamKillScore(sim.champions);
  const blueGold = getTeamTotalGold(sim.champions, 'blue');
  const redGold = getTeamTotalGold(sim.champions, 'red');
  const blueTowersAlive = getTowersAliveCount(sim.structures, 'blue');
  const redTowersAlive = getTowersAliveCount(sim.structures, 'red');

  const champStats: ChampionSimulationStats[] = sim.champions.map(c => ({
    id: c.id,
    playerName: c.player.name,
    avatarName: c.champion.name,
    avatarDisplayName: c.champion.displayName,
    role: (c.player.preferredRole || c.player.role || c.champion.primaryRole) as AvatarRole,
    team: c.team,
    kills: c.kills,
    deaths: c.deaths,
    assists: c.assists,
    cs: c.cs,
    gold: c.gold,
    damageDealt: c.damageDealt,
    damageTaken: c.damageTaken,
    itemsCount: c.items.length,
    manaBlocks: sim.insights.players[c.id]?.manaBlocks ?? 0,
    level: c.level
  }));

  const report: MatchReport = {
    version: 1,
    seed: sim.seed,
    draft: sim.draft,
    winner: sim.winner,
    durationSeconds: sim.matchTime,
    blueRating: 100,
    redRating: 100,
    fullBuildsAt15: sim.fullBuildsAt15,
    itemCounts: sim.itemCounts,
    blueKills,
    redKills,
    skillshotsFired: sim.skillshots.fired,
    skillshotsHit: sim.skillshots.hit,
    events: sim.recordedEvents,
    insights: sim.insights
  };

  return {
    seed: sim.seed,
    winner: sim.winner,
    durationSeconds: sim.matchTime,
    durationMinutes: sim.matchTime / 60,
    blueKills,
    redKills,
    blueGold,
    redGold,
    blueTowersAlive,
    redTowersAlive,
    report,
    champions: champStats,
    telemetry: sim.telemetry
  };
}

export function simulateBatchMatches(seeds: number[], options?: Omit<SimulationOptions, 'seed'>): BatchSimulationAnalysis {
  const results: MatchSimulationResult[] = seeds.map(seed => runMatchSimulation({ seed, ...options }));

  const totalMatches = results.length;
  const blueWins = results.filter(r => r.winner === 'blue').length;
  const redWins = results.filter(r => r.winner === 'red').length;
  const durations = results.map(r => r.durationMinutes).sort((a, b) => a - b);
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / totalMatches;
  const medianDuration = durations[Math.floor(totalMatches / 2)];

  const totalShots = results.reduce((sum, r) => sum + r.report.skillshotsFired, 0);
  const totalHits = results.reduce((sum, r) => sum + r.report.skillshotsHit, 0);

  const totalDives = results.reduce((sum, r) => sum + r.telemetry.towerDiveAttempts, 0);
  const totalAborts = results.reduce((sum, r) => sum + r.telemetry.towerDiveAborts, 0);
  const totalExecutions = results.reduce((sum, r) => sum + r.telemetry.turretExecutions, 0);
  const totalSupportCamps = results.reduce((sum, r) => sum + r.telemetry.supportCampFarms, 0);

  const totalBlueDragons = results.reduce((sum, r) => sum + r.telemetry.dragonKills.blue, 0);
  const totalRedDragons = results.reduce((sum, r) => sum + r.telemetry.dragonKills.red, 0);
  const totalGolems = results.reduce((sum, r) => sum + r.telemetry.golemKills.blue + r.telemetry.golemKills.red, 0);

  // Role Aggregates
  const roles: AvatarRole[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];
  const roleStats = {} as BatchSimulationAnalysis['roleStats'];

  roles.forEach(role => {
    const roleChamps = results.flatMap(r => r.champions.filter(c => c.role === role));
    const count = Math.max(1, roleChamps.length);
    roleStats[role] = {
      avgDamage: Math.round(roleChamps.reduce((sum, c) => sum + c.damageDealt, 0) / count),
      avgGold: Math.round(roleChamps.reduce((sum, c) => sum + c.gold, 0) / count),
      avgKills: Math.round(roleChamps.reduce((sum, c) => sum + c.kills, 0) / count * 10) / 10,
      avgDeaths: Math.round(roleChamps.reduce((sum, c) => sum + c.deaths, 0) / count * 10) / 10,
      avgManaBlocks: Math.round(roleChamps.reduce((sum, c) => sum + c.manaBlocks, 0) / count * 10) / 10
    };
  });

  // Avatar Win Rates
  const avatarWinRates: Record<string, { games: number; wins: number; winRate: number }> = {};
  results.forEach(r => {
    r.champions.forEach(c => {
      const entry = (avatarWinRates[c.avatarName] ??= { games: 0, wins: 0, winRate: 0 });
      entry.games++;
      if (c.team === r.winner) entry.wins++;
      entry.winRate = Math.round((entry.wins / entry.games) * 100);
    });
  });

  // Diagnostics and Balance Recommendations
  const diagnostics: string[] = [];

  const blueWinPct = Math.round((blueWins / totalMatches) * 100);
  if (Math.abs(blueWinPct - 50) > 18) {
    diagnostics.push(`[Side Imbalance] Blue win rate is ${blueWinPct}%. Map or minion spawn symmetrical tuning recommended.`);
  } else {
    diagnostics.push(`[Side Parity] Healthy side win rates: Blue ${blueWinPct}% / Red ${100 - blueWinPct}%.`);
  }

  if (avgDuration < 6.0) {
    diagnostics.push(`[Pacing Warning] Matches are ending too fast (average ${avgDuration.toFixed(1)} mins). Tower health or early siege resilience may need boosting.`);
  } else if (avgDuration > 17.0) {
    diagnostics.push(`[Pacing Warning] Matches are stalling (average ${avgDuration.toFixed(1)} mins). Late-game siege buffs or minion push power should be increased.`);
  } else {
    diagnostics.push(`[Pacing Healthy] Average match duration is ${avgDuration.toFixed(1)} mins (Median: ${medianDuration.toFixed(1)} mins).`);
  }

  if (totalSupportCamps === 0) {
    diagnostics.push(`[Role Invariant Verified] Supports farmed 0 neutral jungle camps across all ${totalMatches} games.`);
  } else {
    diagnostics.push(`[Role Violation] Supports attempted ${totalSupportCamps} camp farms. Enforce strict macro farm filtering.`);
  }

  const diveAbortRate = totalDives > 0 ? Math.round((totalAborts / totalDives) * 100) : 0;
  diagnostics.push(`[Tower Dive Safety] ${totalDives} total dive attempts, ${totalAborts} safety aborts (${diveAbortRate}% abort rate), ${totalExecutions} turret executions.`);

  const mageManaBlocks = roleStats['Mage']?.avgManaBlocks ?? 0;
  if (mageManaBlocks > 8) {
    diagnostics.push(`[Mana Starvation] Mages experienced ${mageManaBlocks} average mana lockouts. Recommend adjusting base mana regeneration or Folio item mana capacity.`);
  }

  return {
    totalMatches,
    blueWins,
    redWins,
    blueWinRate: blueWins / totalMatches,
    redWinRate: redWins / totalMatches,
    averageDurationMinutes: Math.round(avgDuration * 10) / 10,
    minDurationMinutes: Math.round(durations[0] * 10) / 10,
    maxDurationMinutes: Math.round(durations[durations.length - 1] * 10) / 10,
    medianDurationMinutes: Math.round(medianDuration * 10) / 10,
    averageKillsPerMatch: Math.round(results.reduce((s, r) => s + r.blueKills + r.redKills, 0) / totalMatches * 10) / 10,
    averageBlueKills: Math.round(results.reduce((s, r) => s + r.blueKills, 0) / totalMatches * 10) / 10,
    averageRedKills: Math.round(results.reduce((s, r) => s + r.redKills, 0) / totalMatches * 10) / 10,
    averageBlueGold: Math.round(results.reduce((s, r) => s + r.blueGold, 0) / totalMatches),
    averageRedGold: Math.round(results.reduce((s, r) => s + r.redGold, 0) / totalMatches),
    skillshotHitRate: totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0,
    towerDives: {
      totalAttempts: totalDives,
      aborts: totalAborts,
      executions: totalExecutions,
      abortRate: diveAbortRate
    },
    supportCampFarms: totalSupportCamps,
    objectives: {
      totalDragons: totalBlueDragons + totalRedDragons,
      totalGolems,
      blueDragons: totalBlueDragons,
      redDragons: totalRedDragons
    },
    roleStats,
    avatarWinRates,
    diagnostics
  };
}
