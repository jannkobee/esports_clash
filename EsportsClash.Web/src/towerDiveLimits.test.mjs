import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvatarDiveLimits,
  evaluateTowerDive,
  shouldAbortTowerDive,
  getTurretEvacuationVector,
  isBushSafeFromTowers,
  getTurretPerimeterHoldPoint
} from './towerDiveRules.ts';
import { chooseTeamfightTarget } from './combatDecision.ts';

const mockCard = (traits = [], iq = 80, tf = 80) => ({
  id: 'c1',
  name: 'TestCard',
  realName: 'Player1',
  origin: 'Esports',
  role: 'Mid',
  tier: 'Diamond',
  ovr: 85,
  stats: { lan: 80, tf, iq, clu: 80, sta: 80, flx: 80 },
  personality: 'Aggressive',
  badges: traits,
  signatureChampions: ['Valen'],
  morale: 90,
  fatigue: 0,
  level: 10,
  currentXp: 0,
  maxXp: 100,
  avatarSvg: 'test'
});

const mockChamp = (role = 'Fighter', name = 'Valen') => ({
  id: 'champ_1',
  name,
  title: 'Test',
  primaryRole: role,
  hp: 2000,
  maxHp: 2000,
  mana: 400,
  maxMana: 400,
  ad: 100,
  armor: 40,
  mr: 35,
  aspd: 1.0,
  range: 1.4,
  moveSpeed: 100,
  primaryColor: '#ef4444',
  accentColor: '#f59e0b',
  skill1: { name: 'S1', desc: '', cooldown: 6, damage: 150, damageType: 'Physical' },
  skill2: { name: 'S2', desc: '', cooldown: 8, damage: 100, damageType: 'Physical' },
  ultimate: { name: 'Ult', desc: '', cooldown: 60, damage: 400, damageType: 'Physical', isUlt: true }
});

const mockUnit = (overrides = {}) => ({
  id: overrides.id || 'u1',
  player: overrides.player || mockCard(),
  champion: overrides.champion || mockChamp(),
  team: overrides.team || 'blue',
  x: overrides.x ?? 1000,
  y: overrides.y ?? 360,
  vx: 0,
  vy: 0,
  hp: overrides.hp ?? 1600,
  maxHp: overrides.maxHp ?? 2000,
  mana: overrides.mana ?? 200,
  shield: overrides.shield ?? 0,
  level: overrides.level ?? 6,
  xp: 0,
  gold: 1500,
  items: overrides.items || [],
  kills: 0,
  deaths: 0,
  assists: 0,
  cs: 0,
  damageDealt: 0,
  damageTaken: 0,
  isAlive: overrides.isAlive ?? true,
  respawnTimer: 0,
  attackTimer: 0,
  cd1: overrides.cd1 ?? 0,
  cd2: overrides.cd2 ?? 0,
  cdUlt: overrides.cdUlt ?? 0,
  stunTimer: 0,
  charmTimer: 0,
  facing: 'right',
  animState: 'idle',
  animTimer: 0,
  isInBush: false,
  sterakCooldown: 0,
  zhonyaActive: overrides.zhonyaActive ?? false,
  zhonyaTimer: 0,
  immolateTimer: 0,
  krakenCounter: 0,
  ...overrides
});

const mockTower = (overrides = {}) => ({
  id: overrides.id || 'tower_red_outer',
  team: overrides.team || 'red',
  type: 'outer_tower',
  name: 'Red Outer Tower',
  x: overrides.x ?? 1350,
  y: overrides.y ?? 360,
  hp: 2500,
  maxHp: 2500,
  ad: 160,
  range: 280,
  attackTimer: 0,
  isAlive: overrides.isAlive ?? true,
  targetId: overrides.targetId ?? null,
  armor: 55,
  diveAggressorId: overrides.diveAggressorId,
  diveAggroUntil: overrides.diveAggroUntil,
  ...overrides
});

test('Avatar dive limits differentiate durable tanks from fragile squishies', () => {
  const tankLimits = getAvatarDiveLimits('Tank');
  const assassinLimits = getAvatarDiveLimits('Assassin');
  const marksmanLimits = getAvatarDiveLimits('Marksman');
  const mageLimits = getAvatarDiveLimits('Mage');

  assert.equal(tankLimits.canSoloDiveWithoutMinions, true);
  assert.equal(tankLimits.isSquishyRanged, false);
  assert.equal(tankLimits.minHealthFraction <= 0.45, true);

  assert.equal(assassinLimits.diveBurstRequired, true);
  assert.equal(assassinLimits.canSoloDiveWithoutMinions, true);

  assert.equal(marksmanLimits.canSoloDiveWithoutMinions, false);
  assert.equal(marksmanLimits.isSquishyRanged, true);
  assert.equal(marksmanLimits.minHealthFraction >= 0.58, true);

  assert.equal(mageLimits.canSoloDiveWithoutMinions, false);
  assert.equal(mageLimits.isSquishyRanged, true);
});

test('evaluateTowerDive permits dive only when avatar limits, player traits, and wave crash align', () => {
  const tower = mockTower();
  const healthyTank = mockUnit({ champion: mockChamp('Tank', 'Stonewake'), hp: 1600, maxHp: 2200 });
  const lowTarget = mockUnit({ team: 'red', hp: 450, maxHp: 2000 }); // 22.5% HP
  const healthyTarget = mockUnit({ team: 'red', hp: 1700, maxHp: 2000 }); // 85% HP

  // Healthy tank with allied minion wave diving a low target
  const tankDive = evaluateTowerDive({
    diver: healthyTank,
    target: lowTarget,
    tower,
    alliedMinionsUnderTower: 3,
    defendersUnderTower: 1,
    attackersUnderTower: 2
  });
  assert.equal(tankDive.canDive, true);

  // Diver will NOT dive healthy target (not throwing game)
  const failHealthyTarget = evaluateTowerDive({
    diver: healthyTank,
    target: healthyTarget,
    tower,
    alliedMinionsUnderTower: 3,
    defendersUnderTower: 1,
    attackersUnderTower: 2
  });
  assert.equal(failHealthyTarget.canDive, false);

  // Squishy Mage without minion wave will NOT dive solo even on low target
  const squishyMage = mockUnit({ champion: mockChamp('Mage', 'Solana'), hp: 1400, maxHp: 1800 });
  const veryLowTarget = mockUnit({ team: 'red', hp: 280, maxHp: 2000 }); // 14% HP
  const failMageSolo = evaluateTowerDive({
    diver: squishyMage,
    target: veryLowTarget,
    tower,
    alliedMinionsUnderTower: 0,
    defendersUnderTower: 1,
    attackersUnderTower: 1
  });
  assert.equal(failMageSolo.canDive, false);
  assert.match(failMageSolo.reason, /Squishy ranged avatar/);

  // Diver will NOT dive when outnumbered under enemy tower (1v2 or 1v3)
  const failOutnumbered = evaluateTowerDive({
    diver: healthyTank,
    target: lowTarget,
    tower,
    alliedMinionsUnderTower: 2,
    defendersUnderTower: 3,
    attackersUnderTower: 1
  });
  assert.equal(failOutnumbered.canDive, false);
  assert.match(failOutnumbered.reason, /Outnumbered/);
});

test('evaluateTowerDive strictly forbids diving invulnerable or shielded targets', () => {
  const tower = mockTower();
  const diver = mockUnit({ champion: mockChamp('Fighter', 'Valen'), hp: 1500, maxHp: 2000 });
  const zhonyaTarget = mockUnit({ team: 'red', hp: 300, maxHp: 2000, zhonyaActive: true });
  const shieldedTarget = mockUnit({ team: 'red', hp: 400, maxHp: 2000, shield: 600 });

  const failZhonya = evaluateTowerDive({
    diver,
    target: zhonyaTarget,
    tower,
    alliedMinionsUnderTower: 3,
    defendersUnderTower: 1,
    attackersUnderTower: 1
  });
  assert.equal(failZhonya.canDive, false);
  assert.match(failZhonya.reason, /Zhonya stasis/);

  const failShield = evaluateTowerDive({
    diver,
    target: shieldedTarget,
    tower,
    alliedMinionsUnderTower: 3,
    defendersUnderTower: 1,
    attackersUnderTower: 1
  });
  assert.equal(failShield.canDive, false);
});

test('shouldAbortTowerDive detects failed dive and triggers emergency disengage', () => {
  const tower = mockTower({ targetId: 'u1' });
  const diver = mockUnit({ id: 'u1', champion: mockChamp('Assassin', 'Locke'), hp: 800, maxHp: 1800 });
  const livingTarget = mockUnit({ team: 'red', hp: 300, maxHp: 1800 });

  // 1. Target died -> immediate evacuation
  const abortTargetDead = shouldAbortTowerDive({
    diver,
    target: null,
    tower,
    alliedMinionsUnderTower: 2,
    defendersUnderTower: 0,
    diveDuration: 1.0,
    takingTurretFire: true
  });
  assert.equal(abortTargetDead.shouldAbort, true);

  // 2. Target popped Zhonya Golden Stasis -> dive failed, abort!
  const abortZhonya = shouldAbortTowerDive({
    diver,
    target: mockUnit({ team: 'red', hp: 200, maxHp: 1800, zhonyaActive: true }),
    tower,
    alliedMinionsUnderTower: 2,
    defendersUnderTower: 1,
    diveDuration: 1.2,
    takingTurretFire: true
  });
  assert.equal(abortZhonya.shouldAbort, true);

  // 3. Dive timeout (>2.6s) -> abort before turret executes diver
  const abortTimeout = shouldAbortTowerDive({
    diver,
    target: livingTarget,
    tower,
    alliedMinionsUnderTower: 2,
    defendersUnderTower: 1,
    diveDuration: 2.8,
    takingTurretFire: false
  });
  assert.equal(abortTimeout.shouldAbort, true);

  // 4. Diver taking turret fire and HP drops below emergency threshold
  const lowDiverTakingFire = mockUnit({ id: 'u1', champion: mockChamp('Assassin', 'Locke'), hp: 420, maxHp: 1800 }); // 23% HP
  const abortCriticalHp = shouldAbortTowerDive({
    diver: lowDiverTakingFire,
    target: livingTarget,
    tower,
    alliedMinionsUnderTower: 2,
    defendersUnderTower: 1,
    diveDuration: 1.0,
    takingTurretFire: true
  });
  assert.equal(abortCriticalHp.shouldAbort, true);
  assert.match(abortCriticalHp.reason, /turret true damage/);
});

test('getTurretEvacuationVector steers away from tower towards home safety', () => {
  const blueDiver = { x: 1300, y: 350, team: 'blue' };
  const redTower = { x: 1350, y: 360, range: 280 };

  const evac = getTurretEvacuationVector(blueDiver, redTower, 360);
  assert.equal(evac.escapeDirX, -1); // Blue diver escapes to the left (negative X)
  assert.equal(evac.targetX <= redTower.x - (redTower.range + 70), true); // Well outside turret range
});

test('isBushSafeFromTowers filters out bushes inside enemy turret range', () => {
  const redTower = mockTower({ x: 1350, y: 360, range: 280 });
  const bushUnderTower = { id: 'bush_trap', name: 'Trap Bush', x: 1250, y: 250, width: 80, height: 40 }; // dist ~148px
  const safeRiverBush = { id: 'bush_safe', name: 'Safe Bush', x: 800, y: 235, width: 80, height: 40 }; // dist ~560px

  assert.equal(isBushSafeFromTowers(bushUnderTower, [redTower]), false);
  assert.equal(isBushSafeFromTowers(safeRiverBush, [redTower]), true);
});

test('getTurretPerimeterHoldPoint prevents non-divers from wandering into turret range', () => {
  const blueUnit = { x: 1100, y: 360, team: 'blue' };
  const redTower = { x: 1350, y: 360, range: 280 };

  const hold = getTurretPerimeterHoldPoint(blueUnit, redTower);
  // Red tower is at 1350, range 280. Safe boundary is 1350 - 308 = 1042
  assert.equal(hold.x <= 1350 - 280, true);
});

test('chooseTeamfightTarget heavily penalizes targeting enemies under live turrets', () => {
  const tower = mockTower({ x: 1350, y: 360, range: 280 });
  const attacker = mockUnit({ champion: mockChamp('Mage', 'Solana'), x: 950, y: 360, player: mockCard([], 85) });

  const enemyInLane = mockUnit({ id: 'enemy_lane', team: 'red', x: 1020, y: 360, hp: 1200, maxHp: 1800 });
  const enemyUnderTower = mockUnit({ id: 'enemy_tower', team: 'red', x: 1330, y: 360, hp: 400, maxHp: 1800 }); // Low HP under tower

  // With enemyStructures context, Solana prioritizes enemy in lane and avoids suicidal dive
  const target = chooseTeamfightTarget(attacker, [enemyInLane, enemyUnderTower], [], 140, {
    enemyStructures: [tower],
    alliedMinions: []
  });

  assert.equal(target?.id, 'enemy_lane');
});
