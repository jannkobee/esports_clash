import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  LANE_Y,
  LANE_SLOPE,
  laneY,
  MAP_PROFILES,
  ARENA_MAP_VERSION,
  DEFAULT_ARENA_FEATURE_FLAGS,
  getArenaFeatureFlags,
  setArenaFeatureFlags,
  computeArenaRulesetVersion,
  resolveArenaMapProfileId,
  laneYForProfile,
} from './arenaLayout.ts';
import { CAMP_ROCK_RINGS, ROCK_TERRAIN } from './arenaRules.ts';
import { stoneLaneEdges } from './arenaLandform.ts';
import { ViewerReplay } from './match-viewer/ViewerReplay.ts';
import { recordAIDecision } from './aiDecisionTelemetry.ts';
import { ArenaTrajectory } from './arenaTrajectory.ts';
import { ARENA_OUTCOME_REWARD_VERSION } from './arenaOutcomeReward.ts';
import { drawV3Telegraphs } from './v3Telegraphs.ts';
import {
  computeActiveBossMeter,
  computeTeamfightAutoZoom,
  computeWaveFrontX,
  drawArena3dTacticalReadability,
  formatStructurePlateLabel,
  isMinionLastHittable,
  shouldShowNeutralCampBar,
} from './phase3SpectatorReadability.ts';
import {
  BUSH_ATTACK_REVEAL_SECONDS,
  WARD_SPECS,
  chooseWardKindForChampion,
  hasLineOfSight,
  isBlockedByPitEnclosure,
  isEnemyVisibleToTeam,
  isPositionVisibleToTeam,
  updateLastSeenEnemies,
  updateWardDetectionStates,
} from './visionRules.ts';
import {
  checkCounterJungleSteal,
  createInitialJunglePlants,
  createInitialRiverScuttlers,
  getCampPackMinions,
  getPrimalSmiteDamage,
  scaleCampStatsByMinute,
  stepRiverScuttlers,
  transferJungleBuffsOnTakedown,
} from './jungleEcosystemRules.ts';
import {
  getActiveArenaElementalAccent,
  getDragonCombatPhase,
  getDragonElementForIndex,
  getMinionBannerDamageMultiplier,
  getSiegeGolemRearCoreMultiplier,
  isBossPulledOutsidePit,
  recordTeamDragonSlain,
  shouldSpawnElderDragon,
  shouldTriggerElderExecute,
} from './epicObjectivesRules.ts';
import {
  calculateAssistGoldShare,
  calculateProximityXpShare,
  checkWallSlamCollision,
  evaluateWallDashPassability,
  findRetaliatingEnemyMinions,
  getHighgroundElevationDamageMultiplier,
  getHomeguardSpeedMultiplier,
  getStreakShutdownBountyGold,
  getTurretPlatesRemaining,
  hasStructureBackdoorProtection,
  isObjectiveBountyActiveForTeam,
} from './terrainStructureEconomyRules.ts';
import {
  BROADCAST_CAMERA_PRESETS,
  auditArenaSymmetryAndBalance,
  buildBattlefieldWaypointDescriptors,
  checkTeamAce,
  computeInfluenceHeatmapCells,
  computeObjectivePipAlert,
  computeSpatialAudioMix,
  isOvertimeConvergenceActive,
  recordChampionKillForMultiKill,
  shouldCullOffscreenPoint,
  stepCelestialSupplyDrop,
} from './dynamicEventsAtmosphereRelease.ts';

test('Phase 0 & Phase 1: two-lane-v5 is the canonical default map with organic two-lane layout, 12 regular jungle camps, and 2 boss coves', () => {
  const v5 = MAP_PROFILES['two-lane-v5'];

  assert.equal(ARENA_MAP_VERSION, 'two-lane-v5');
  assert.equal(resolveArenaMapProfileId(), 'two-lane-v5');
  assert.equal(v5.id, 'two-lane-v5');
  assert.equal(v5.laneSlope, 0);
  assert.equal(LANE_SLOPE, 0);
  assert.equal(v5.laneHalfWidth, 80);
  assert.equal(v5.midPlazaRadius, 125);
  assert.equal(v5.brickWidth, 90);
  assert.equal(v5.brickHeight, 65);
  assert.equal(v5.campRings.length, 14);
  assert.equal(v5.bushes.length, 10);

  // Horizontal centerline symmetry across the full map
  for (const x of [0, 430, 920, 1400, 1880, 2370, ARENA_WIDTH]) {
    assert.equal(laneY(x), LANE_Y);
    assert.equal(laneYForProfile(x, v5), LANE_Y);
  }

  // Regular 12 jungle camps sit across the 4 jungle quadrants and are East-West mirrored
  const regularCamps = CAMP_ROCK_RINGS.filter(c => c.stones === 12);
  assert.equal(regularCamps.length, 12);
  for (const camp of regularCamps) {
    const distFromCenter = Math.abs(camp.y - LANE_Y);
    assert.ok(distFromCenter >= 220 && distFromCenter <= 320, `${camp.id} should be in the jungle quadrants, got ${distFromCenter}`);
    assert.ok(camp.radius >= 56, `${camp.id} should have solid camp enclosure radius`);
  }

  // Epic Boss coves (Dragon North & Siege Golem South) sit outside the top/bottom river crossings
  const bossPits = CAMP_ROCK_RINGS.filter(c => c.stones === 16);
  assert.equal(bossPits.length, 2);
  for (const boss of bossPits) {
    const distFromCenter = Math.abs(boss.y - LANE_Y);
    assert.ok(distFromCenter >= 580 && distFromCenter <= 650, `${boss.id} should sit at the north/south river coves, got ${distFromCenter}`);
    assert.ok(boss.radius >= 70, `${boss.id} should have boss cove radius`);
    const stones = ROCK_TERRAIN.filter(r => r.campId === boss.id);
    const gateStones = stones
      .filter(s => Math.sign(s.y - boss.y) === Math.sign(Math.sin(boss.entrance)))
      .sort((a, b) => Math.abs(a.x - boss.x) - Math.abs(b.x - boss.x));
    assert.ok(gateStones.length >= 2);
    const clearMouthWidth = Math.abs(gateStones[0].x - boss.x) * 2 - gateStones[0].radius * 2;
    assert.ok(clearMouthWidth >= 65, `${boss.id} should have a clear river opening (>=65px), got ${clearMouthWidth.toFixed(1)}px`);
  }
});

test('Phase 0: feature-flag registry and ruleset version tag calculation', () => {
  setArenaFeatureFlags(DEFAULT_ARENA_FEATURE_FLAGS);
  assert.equal(computeArenaRulesetVersion(), 'arena-ruleset-v3');

  setArenaFeatureFlags({ jungleDepth: true, fogOfWarShader: true });
  assert.equal(getArenaFeatureFlags().jungleDepth, true);
  assert.equal(getArenaFeatureFlags().fogOfWarShader, true);
  assert.equal(getArenaFeatureFlags().comebackBounties, false);
  assert.equal(computeArenaRulesetVersion(), 'arena-ruleset-v4+fogOfWarShader,jungleDepth');

  // Restore defaults
  setArenaFeatureFlags(DEFAULT_ARENA_FEATURE_FLAGS);
  assert.equal(computeArenaRulesetVersion(), 'arena-ruleset-v3');
});

test('Phase 0 (Item 87): mapVersion and rulesetVersion tags on ViewerReplay, AIDecisionRecord, and ArenaTrajectory', () => {
  setArenaFeatureFlags(DEFAULT_ARENA_FEATURE_FLAGS);

  // 1. ViewerReplay roundtrip preserves mapVersion and rulesetVersion
  const replay = new ViewerReplay(100, 'two-lane-v5', 'arena-ruleset-v4+fogOfWarShader');
  replay.record({ tick: 0, second: 0, actors: [], effects: [] });
  replay.record({ tick: 30, second: 1, actors: [], effects: [] });
  const exported = replay.export();
  const raw = JSON.parse(exported);
  assert.equal(raw.mapVersion, 'two-lane-v5');
  assert.equal(raw.rulesetVersion, 'arena-ruleset-v4+fogOfWarShader');

  const parsed = ViewerReplay.parse(exported);
  assert.equal(parsed.mapVersion, 'two-lane-v5');
  assert.equal(parsed.rulesetVersion, 'arena-ruleset-v4+fogOfWarShader');

  // 2. AIDecisionRecord stamps mapVersion and rulesetVersion
  const records = [];
  recordAIDecision(records, {
    second: 10,
    actorId: 'b_0',
    team: 'blue',
    selected: 'wave',
    candidates: [{ key: 'wave', available: true, reason: 'farm' }],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].mapVersion, ARENA_MAP_VERSION);
  assert.equal(records[0].rulesetVersion, 'arena-ruleset-v3');

  // 3. ArenaTrajectory stamps mapVersion and rulesetVersion on rows and drain()
  const snap = {
    second: 1,
    teamKills: 0, enemyKills: 0,
    teamGold: 2500, enemyGold: 2500,
    teamAlive: 5, enemyAlive: 5,
    teamTowers: 3, enemyTowers: 3,
    teamBarracks: 3, enemyBarracks: 3,
    teamNexusHp: 1, enemyNexusHp: 1,
    teamDragon: 0, enemyDragon: 0,
    teamSiege: 0, enemySiege: 0,
  };
  const traj = new ArenaTrajectory({}, true, ARENA_OUTCOME_REWARD_VERSION, 'two-lane-v5', 'arena-ruleset-v3');
  traj.pending.set('b_0', {
    actor: 'b_0',
    team: 'blue',
    second: 1,
    candidates: [[1, 0]],
    action: 0,
    logp: -0.2,
    state: [0],
    start: snap,
    command: 'move',
    executed: true,
  });
  traj.settle('b_0', { ...snap, second: 3 }, false);
  const drained = traj.drain();
  assert.equal(drained.mapVersion, 'two-lane-v5');
  assert.equal(drained.rulesetVersion, 'arena-ruleset-v3');
  assert.equal(drained.rows.length, 1);
  assert.equal(drained.rows[0].mapVersion, 'two-lane-v5');
  assert.equal(drained.rows[0].rulesetVersion, 'arena-ruleset-v3');
});

test('Phase 0 (Item 78): drawV3Telegraphs suppresses Resource/mark debug text by default and shows it when enabled', () => {
  const createMockCtx = () => {
    const texts = [];
    return {
      texts,
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      stroke() {},
      arc() {},
      setLineDash() {},
      strokeRect() {},
      fillRect() {},
      fillText(text) { texts.push(String(text)); },
    };
  };

  const world = {
    tick: 60,
    constructs: [
      {
        id: 'c1', kind: 'stage-cell', x: 500, y: 500, radius: 40, angle: 0,
        team: 'blue', hp: 2, maxHp: 2, created: 30, expires: 180, disabledUntil: 0,
        attackable: true, points: [],
      },
    ],
    casts: [
      { request: { actor: 'b_0', slot: 'skill1', point: { x: 520, y: 500 } }, start: 50, commit: 75, recovery: 15 },
    ],
    actors: {
      b_0: {
        recoveryUntil: 90,
        notes: {},
        roster: {
          resource: 45,
          marks: { 'resonance:target': { value: 3, expires: 120 } },
        },
      },
    },
    events: [],
    counters: {},
  };
  const units = [{ id: 'b_0', x: 500, y: 500 }];

  // Default: debug labels hidden
  const defaultCtx = createMockCtx();
  drawV3Telegraphs(defaultCtx, world, p => p, units);
  assert.equal(defaultCtx.texts.length, 0, 'Default view should not draw debug text labels');

  // Enabled: debug labels rendered
  const debugCtx = createMockCtx();
  drawV3Telegraphs(debugCtx, world, p => p, units, { showDebugLabels: true });
  assert.ok(debugCtx.texts.some(t => t.includes('Resource 45')), 'Should draw Resource label when showDebugLabels is true');
  assert.ok(debugCtx.texts.some(t => t.includes('resonance 3')), 'Should draw mark label when showDebugLabels is true');
  assert.ok(debugCtx.texts.some(t => t.includes('recovery')), 'Should draw recovery label when showDebugLabels is true');
});

test('Phase 3: spectator readability helpers (teamfight auto-zoom, wave front, last-hit threshold, boss meter, plate decluttering)', () => {
  // 1. Teamfight auto-zoom (Item 73): stays at baseZoom when spread is compact, zooms out smoothly when spread >= 4 engaged champions across wide span
  const compactChamps = [
    { x: 1350, y: 700, team: 'blue', isAlive: true },
    { x: 1380, y: 720, team: 'blue', isAlive: true },
    { x: 1410, y: 730, team: 'blue', isAlive: true },
    { x: 1440, y: 710, team: 'red', isAlive: true },
    { x: 1460, y: 740, team: 'red', isAlive: true },
    { x: 1480, y: 720, team: 'red', isAlive: true },
  ];
  assert.equal(computeTeamfightAutoZoom(2.65, compactChamps, 'auto'), 2.65);

  const spreadTeamfight = [
    { x: 950, y: 520, team: 'blue', isAlive: true },
    { x: 1050, y: 600, team: 'blue', isAlive: true },
    { x: 1250, y: 720, team: 'blue', isAlive: true },
    { x: 1450, y: 720, team: 'red', isAlive: true },
    { x: 1650, y: 780, team: 'red', isAlive: true },
    { x: 1800, y: 880, team: 'red', isAlive: true },
  ];
  const autoZoomed = computeTeamfightAutoZoom(2.65, spreadTeamfight, 'auto');
  assert.ok(autoZoomed < 2.65 && autoZoomed >= 1.95, `Expected autoZoomed between 1.95 and 2.65, got ${autoZoomed}`);
  assert.equal(computeTeamfightAutoZoom(2.65, spreadTeamfight, 'manual'), 2.65, 'Manual camera mode should not auto-zoom');

  // 2. Wave-front line (Item 53)
  assert.equal(computeWaveFrontX([]), 1400);
  assert.equal(computeWaveFrontX([{ x: 1200, y: 720, team: 'blue', isAlive: true }]), 1200);
  assert.equal(
    computeWaveFrontX([
      { x: 1200, y: 720, team: 'blue', isAlive: true },
      { x: 1500, y: 720, team: 'red', isAlive: true },
    ]),
    1350,
  );

  // 3. Last-hit threshold (Item 51)
  assert.equal(isMinionLastHittable(50, 300), true);
  assert.equal(isMinionLastHittable(200, 300), false);

  // 4. Active boss meter & 32% execute line (Item 39)
  assert.equal(
    computeActiveBossMeter(
      { id: 'dragon', name: 'Embermaw', x: 1400, y: 240, hp: 4000, maxHp: 4000, isAlive: true, spawnTimer: 0 },
      [],
    ),
    null,
    'Unengaged full-HP boss should not show top-bar active meter',
  );
  const engagedBoss = computeActiveBossMeter(
    { id: 'dragon', name: 'Embermaw', x: 1400, y: 240, hp: 1100, maxHp: 4000, isAlive: true, spawnTimer: 0 },
    [],
  );
  assert.ok(engagedBoss);
  assert.equal(engagedBoss.inExecuteZone, true);
  assert.equal(engagedBoss.executeRatio, 0.32);

  // 5. Decluttered structure & neutral camp labels
  assert.equal(formatStructurePlateLabel('Outer turret first', false), '🛡');
  assert.equal(formatStructurePlateLabel('Outer turret first', true), 'Outer turret first');
  assert.equal(shouldShowNeutralCampBar({ isAlive: true, hp: 1200, maxHp: 1200, engaged: false }, false), false);
  assert.equal(shouldShowNeutralCampBar({ isAlive: true, hp: 900, maxHp: 1200, engaged: false }, false), true);
});

test('Phase 4: vision model, ward types (stealth/control/farsight), sweeper detection, pit vision block, and last-seen enemy ghost markers', () => {
  // 1. Ward specs & selection (Items 15 & 16)
  assert.equal(WARD_SPECS.stealth.maxHp, 3);
  assert.equal(WARD_SPECS.control.maxHp, 4);
  assert.equal(WARD_SPECS.farsight.maxHp, 1);
  assert.equal(BUSH_ATTACK_REVEAL_SECONDS, 4.5);

  assert.equal(
    chooseWardKindForChampion({ level: 6, champion: { primaryRole: 'Support' }, player: { stats: { iq: 75 } } }, 110, true),
    'control',
  );
  assert.equal(
    chooseWardKindForChampion({ level: 10, champion: { primaryRole: 'Marksman' }, player: { stats: { iq: 70 } } }, 180, false),
    'farsight',
  );
  assert.equal(
    chooseWardKindForChampion({ level: 4, champion: { primaryRole: 'Fighter' }, player: { stats: { iq: 65 } } }, 50, false),
    'stealth',
  );

  // 2. Control ward & Oracle Lens Sweeper reveal and disable enemy stealth wards (Items 16 & 17)
  const wards = [
    { id: 'w_blue_stealth', team: 'blue', kind: 'stealth', bushId: 'bush_dragon_west', x: 1270, y: 395, hp: 3, maxHp: 3, placedAt: 40, expiresAt: 115 },
    { id: 'w_red_control', team: 'red', kind: 'control', bushId: 'bush_dragon_west', x: 1290, y: 400, hp: 4, maxHp: 4, placedAt: 45, expiresAt: 195 },
  ];
  updateWardDetectionStates(wards, []);
  assert.equal(wards[0].revealed, true, 'Enemy Control Ward should reveal nearby stealth ward');
  assert.equal(wards[0].disabled, true, 'Enemy Control Ward should disable nearby stealth ward');

  // 3. Pit enclosure vision block (Item 18)
  const insideDragonPit = { x: 1400, y: 220 };
  const behindDragonPitWall = { x: 1180, y: 180 };
  const inDragonPitMouth = { x: 1400, y: 390 };
  assert.equal(isBlockedByPitEnclosure(behindDragonPitWall, insideDragonPit), true, 'Pit back/side wall should block direct LoS');
  assert.equal(isBlockedByPitEnclosure(inDragonPitMouth, insideDragonPit), false, 'Pit open mouth should allow direct LoS');
  assert.equal(hasLineOfSight(behindDragonPitWall, insideDragonPit), false);

  // 4. Disabled stealth ward does not reveal bush enemy, but active sweeper does
  const redInBush = {
    id: 'r_1', team: 'red', isAlive: true, x: 1270, y: 395, vx: -20, vy: 0,
    isInBush: true, currentBushId: 'bush_dragon_west',
    champion: { name: 'Veyara', displayName: 'Veyara' },
    player: { name: 'Zypoo' },
  };
  const blueObserver = {
    id: 'b_1', team: 'blue', isAlive: true, x: 1200, y: 500, vx: 0, vy: 0,
    isInBush: false, sweeperTimer: 0,
    champion: { name: 'Solana', displayName: 'Solana' },
    player: { name: 'Cardrel' },
  };
  assert.equal(
    isEnemyVisibleToTeam(redInBush, 'blue', [blueObserver], [wards[0]]),
    false,
    'Disabled stealth ward should not grant bush vision',
  );
  blueObserver.sweeperTimer = 4.0;
  assert.equal(
    isEnemyVisibleToTeam(redInBush, 'blue', [blueObserver], [wards[0]]),
    true,
    'Active Oracle Sweeper within 190px should reveal enemy in bush',
  );

  // 5. Last-seen enemy ghost marker recorded when enemy enters fog/unwarded bush (Item 20)
  blueObserver.sweeperTimer = 0;
  const prevVisible = new Set(['r_1']);
  const ghosts = new Map();
  updateLastSeenEnemies(prevVisible, ghosts, [blueObserver, redInBush], [], 100);
  assert.equal(ghosts.has('r_1'), true, 'Ghost marker should be created when visible enemy enters unwarded bush');
  assert.equal(ghosts.get('r_1').playerName, 'Zypoo');
  assert.equal(ghosts.get('r_1').expiresAt, 105);

  // Expires after 5 seconds
  updateLastSeenEnemies(prevVisible, ghosts, [blueObserver, redInBush], [], 106);
  assert.equal(ghosts.has('r_1'), false, 'Ghost marker should expire after 5 seconds');

  // 6. Position visibility check (Item 12)
  assert.equal(isPositionVisibleToTeam('blue', { x: 1210, y: 510 }, [blueObserver], [], [], []), true);
  assert.equal(isPositionVisibleToTeam('blue', { x: 2400, y: 200 }, [blueObserver], [], [], []), false);
});

test('Phase 5: jungle ecosystem (pack minions, buff transfer, river scuttler shrines, plants, minute scaling, smite, counter-jungling)', () => {
  // Item 22: Multi-creep pack minions collapse as camp HP drops below 66% and 33%
  const fullPack = getCampPackMinions({ id: 'j_blue_golem', x: 1020, y: 410, hp: 1200, maxHp: 1200, isAlive: true });
  assert.equal(fullPack.filter(m => m.alive).length, 2);
  const halfPack = getCampPackMinions({ id: 'j_blue_golem', x: 1020, y: 410, hp: 600, maxHp: 1200, isAlive: true });
  assert.equal(halfPack.filter(m => m.alive).length, 1);

  // Item 24: Buff transfer on champion takedown
  const buffs = {
    victim_1: { blueUntil: 150, redUntil: 0, wolfUntil: 140, grompUntil: 0 },
  };
  const transferred = transferJungleBuffsOnTakedown(buffs, 'victim_1', 'killer_1', 100);
  assert.deepEqual(transferred, ['blue', 'wolf']);
  assert.equal(buffs.victim_1.blueUntil, 0);
  assert.ok(buffs.killer_1.blueUntil >= 150);

  // Item 26 & 27: River Scuttlers & Jungle Plants
  const scuttlers = createInitialRiverScuttlers();
  assert.equal(scuttlers.length, 2);
  scuttlers[0].hp = 10;
  const stepRes = stepRiverScuttlers(
    scuttlers,
    [{ id: 'b_1', team: 'blue', isAlive: true, level: 8, x: scuttlers[0].x, y: scuttlers[0].y, player: { name: 'Cardrel' }, champion: { primaryRole: 'Fighter' } }],
    120,
    1.0,
  );
  assert.ok(stepRes.slainBy);
  assert.equal(scuttlers[0].shrineTeam, 'blue');

  const plants = createInitialJunglePlants();
  assert.equal(plants.length, 8);
  assert.equal(plants.filter(p => p.kind === 'blast_cone').length, 4);

  // Item 28 & 29 & 30: Camp scaling, Primal Smite, and Counter-Jungling
  const scaled = scaleCampStatsByMinute({ maxHp: 1000, ad: 40, gold: 80, xp: 100 }, 360);
  assert.ok(scaled.maxHp > 1000 && scaled.ad > 40 && scaled.gold > 80 && scaled.xp > 100);
  assert.equal(getPrimalSmiteDamage(1), 450);
  assert.equal(getPrimalSmiteDamage(18), 800);

  const stolen = checkCounterJungleSteal(
    { id: 'j_blue_golem', name: 'Frost Sentinel', x: 1020, y: 410, type: 'golem' },
    { team: 'red', player: { name: 'p1mple' } },
    140,
  );
  assert.ok(stolen);
  assert.equal(stolen.homeTeam, 'blue');
  assert.equal(stolen.stolenByTeam, 'red');
});

test('Phase 6: epic objectives (elemental rotation, soul & elder dragon execute, dragon combat phases, siege golem rear core & banner aura, pit pull-out)', () => {
  // Item 31 & 32: Elemental dragon rotation & arena accent after 2nd dragon
  assert.equal(getDragonElementForIndex(0), 'infernal');
  assert.equal(getDragonElementForIndex(1), 'mountain');
  assert.equal(getDragonElementForIndex(2), 'ocean');
  assert.equal(getDragonElementForIndex(3), 'cloud');
  assert.equal(getActiveArenaElementalAccent(1, ['infernal'], []), null);
  assert.equal(getActiveArenaElementalAccent(2, ['infernal', 'ocean'], [])?.element, 'ocean');

  // Item 33: Dragon Soul at 4 stacks & Elder Dragon execute (<15% HP)
  const blueState = { stacks: ['infernal', 'mountain', 'ocean'] };
  const soulRes = recordTeamDragonSlain(blueState, 'cloud', false, 600);
  assert.equal(soulRes.gainedSoul, true);
  assert.equal(blueState.soulElement, 'cloud');
  assert.equal(shouldSpawnElderDragon(610, blueState.stacks.length, 0), true);

  const elderRes = recordTeamDragonSlain(blueState, 'infernal', true, 850);
  assert.equal(elderRes.gainedElder, true);
  assert.equal(shouldTriggerElderExecute(blueState, 860, 140, 1000), true);
  assert.equal(shouldTriggerElderExecute(blueState, 860, 250, 1000), false);

  // Item 34, 35, 37, 38: Dragon phases, Golem rear core, Siege Banner aura, Pit pull-out reset
  assert.equal(getDragonCombatPhase(4500, 5000), 1);
  assert.equal(getDragonCombatPhase(2500, 5000), 2);
  assert.equal(getDragonCombatPhase(1200, 5000), 3);
  assert.equal(getSiegeGolemRearCoreMultiplier({ x: 1350, y: 1200 }, { x: 1400, y: 1200, facingX: 1 }), 1.22);
  assert.equal(
    getMinionBannerDamageMultiplier(
      { team: 'blue', x: 1400, y: 720, siegeGolem: false },
      [{ team: 'blue', x: 1450, y: 720, isAlive: true, siegeGolem: true }],
    ),
    0.75,
  );
  assert.equal(isBossPulledOutsidePit({ x: 1400, y: 450 }, { x: 1400, y: 240 }), true);
});

test('Phase 7, 8 & 9: terrain mechanics, highground, wall vault/slam, turret plating, backdoor shield, minion call-for-help, shutdown & objective bounties', () => {
  // Phase 7 (Items 5, 6, 7, 61)
  assert.equal(
    getHighgroundElevationDamageMultiplier({ x: 600, y: 720, team: 'red' }, { x: 420, y: 720, team: 'blue' }, false),
    0.85,
  );
  const thinVault = evaluateWallDashPassability({ x: 960, y: 410 }, { x: 1005, y: 410 }, [{ x: 990, y: 410, radius: 24 }]);
  assert.equal(thinVault.canVault, true);
  const slam = checkWallSlamCollision({ x: 950, y: 410 }, { x: 985, y: 410 }, [{ x: 990, y: 410, radius: 24 }]);
  assert.equal(slam.slammed, true);
  assert.equal(slam.bonusStun, 0.55);
  assert.ok(getHomeguardSpeedMultiplier(5.0) > 1.6);

  // Phase 8 (Items 43, 44, 52)
  assert.equal(getTurretPlatesRemaining({ type: 'outer_tower', hp: 1800, maxHp: 2000, isAlive: true }, 180), 5);
  assert.equal(getTurretPlatesRemaining({ type: 'outer_tower', hp: 1800, maxHp: 2000, isAlive: true }, 500), 0);
  assert.equal(hasStructureBackdoorProtection({ team: 'red', x: 2000, y: 720, isAlive: true }, []), true);
  const retaliating = findRetaliatingEnemyMinions(
    { team: 'blue', x: 1400, y: 720 },
    { team: 'red', x: 1440, y: 720 },
    [{ id: 'm1', team: 'red', x: 1460, y: 720, isAlive: true }],
  );
  assert.equal(retaliating.length, 1);

  // Phase 9 (Items 55, 56, 57)
  assert.equal(getStreakShutdownBountyGold(2), 0);
  assert.equal(getStreakShutdownBountyGold(3), 150);
  assert.equal(getStreakShutdownBountyGold(5), 400);
  assert.equal(getStreakShutdownBountyGold(7), 600);
  assert.equal(isObjectiveBountyActiveForTeam('blue', 12000, 15000, 300), true);
  assert.equal(calculateAssistGoldShare(300, 2), 75);
  assert.equal(calculateProximityXpShare(100, 2), 62);
});

test('Phase 10, 11 & 12: dynamic events (multikill, ace, overtime, supply drop, PiP), atmosphere/audio culling, ML heatmap/waypoints, symmetry audit & broadcast presets', () => {
  // Phase 10 (Items 68, 69, 70, 71, 74)
  const mkMap = {};
  recordChampionKillForMultiKill(mkMap, 'b_1', 100);
  const doubleRes = recordChampionKillForMultiKill(mkMap, 'b_1', 105);
  assert.equal(doubleRes.label, 'DOUBLE KILL!');
  assert.equal(checkTeamAce([{ team: 'red', isAlive: false }, { team: 'blue', isAlive: true }], 'red'), true);
  assert.equal(isOvertimeConvergenceActive(1085), true);

  const spawned = new Set();
  const dropStep1 = stepCelestialSupplyDrop(null, spawned, [], 361, 1.0);
  assert.equal(dropStep1.spawnedNow, true);
  assert.ok(dropStep1.next?.active);
  const dropStep2 = stepCelestialSupplyDrop(
    dropStep1.next,
    spawned,
    [{ id: 'b_1', team: 'blue', isAlive: true, x: 1400, y: 720 }],
    365,
    3.2,
  );
  assert.equal(dropStep2.claimedBy, 'blue');

  const pip = computeObjectivePipAlert(
    { id: 'dragon', name: 'Embermaw', x: 1400, y: 240, hp: 3000, maxHp: 5000, isAlive: true },
    undefined,
    [{ team: 'blue', x: 1400, y: 250, isAlive: true }, { team: 'red', x: 1420, y: 260, isAlive: true }],
    { x: 1400, y: 720 },
  );
  assert.ok(pip);
  assert.equal(pip.contested, true);

  // Phase 11 (Items 77 & 79)
  assert.equal(shouldCullOffscreenPoint({ x: 2600, y: 720 }, { x: 1400, y: 720, halfW: 500, halfH: 300 }), true);
  const audioMix = computeSpatialAudioMix({ x: 1400, y: 720 }, [
    { x: 1380, y: 720, isAlive: true, combatTimer: 3 },
    { x: 1410, y: 720, isAlive: true, combatTimer: 3 },
    { x: 1420, y: 720, isAlive: true, combatTimer: 3 },
    { x: 1440, y: 720, isAlive: true, combatTimer: 3 },
  ], 3);
  assert.equal(audioMix.combatDuckingFactor, 0.45);
  assert.ok(audioMix.crowdExcitement > 0.5);

  // Phase 12 (Items 85, 86, 88, 89)
  const cells = computeInfluenceHeatmapCells(
    [{ team: 'blue', x: 400, y: 720, isAlive: true }],
    [{ team: 'blue', x: 350, y: 720, isAlive: true }],
  );
  assert.equal(cells.length, 21);
  const waypoints = buildBattlefieldWaypointDescriptors(
    [{ id: 'scuttler_north', x: 1400, y: 510, isAlive: true }],
    [{ id: 'plant_honey_north', kind: 'honeyfruit', x: 1515, y: 535, isAlive: true }],
    null,
  );
  assert.equal(waypoints.length, 2);

  const symmetry = auditArenaSymmetryAndBalance();
  assert.equal(symmetry.symmetric, true, `Expected exact mirror symmetry (0px), got ${symmetry.maxAsymmetryPx}px`);
  assert.equal(BROADCAST_CAMERA_PRESETS.broadcast.zoom, 2.65);
  assert.equal(BROADCAST_CAMERA_PRESETS.tactical_high.zoom, 1.85);
  assert.equal(BROADCAST_CAMERA_PRESETS.action_close.zoom, 3.25);
});
