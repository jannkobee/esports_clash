import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runMatchSimulation,
  createSimulationState,
  stepSimulation,
  createDefaultSimulationLineup,
} from './matchSimulationEngine.ts';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  LANE_Y,
  OUTER_TOWER_X,
  INNER_TOWER_X,
  NEXUS_TOWER_X,
  BARRACKS_X,
  NEXUS_X,
  WELL_X,
  DRAGON_X,
} from './arenaLayout.ts';
import {
  CAMP_ROCK_RINGS,
  ROCK_TERRAIN,
  STRUCTURE_HP,
  canDamageNexus,
  resolveRockTerrainMovement,
  turretShotDamage,
} from './arenaRules.ts';
import { canDamageStructure, structureProtectionReason } from './structureProtection.ts';
import { resolveTurretKillReward } from './matchReplay.ts';
import { ViewerReplay } from './match-viewer/ViewerReplay.ts';
import { captureViewerSnapshot } from './match-viewer/MatchViewer.ts';

test('Phase 5.1: Complete match simulation executes through conclusion with authoritative stats', () => {
  const seed = 20261028;
  const match = runMatchSimulation({ seed, maxDurationSeconds: 480 });

  assert.ok(match, 'match simulation must return a valid result');
  assert.ok(match.winner === 'blue' || match.winner === 'red', 'match must declare a winner');
  assert.ok(match.durationSeconds > 60, `match duration should exceed 60s (got ${match.durationSeconds}s)`);
  assert.ok(match.blueKills >= 0 && match.redKills >= 0, 'kills must be non-negative');
  assert.ok(match.blueGold > 3000 && match.redGold > 3000, 'both teams must accumulate economy');
  assert.ok(match.report, 'report must be generated');
  assert.ok(match.report.seed === seed, 'report seed must match input seed');

  // Verify damage and telemetry breakdown
  const totalDamage = match.champions.reduce((sum, c) => sum + c.damageDealt, 0);
  assert.ok(totalDamage > 0, 'champions must deal combat damage');
  assert.ok(match.telemetry.towerDiveAttempts >= 0, 'tower dive telemetry must be tracked');
});

test('Phase 5.2: 3D lane navigation steers units around expanded turret footprints without clipping', () => {
  const sim = createSimulationState({ seed: 5050 });

  // Simulate first 25 seconds so initial minion waves spawn and march down the lane
  for (let i = 0; i < 250; i++) {
    stepSimulation(sim, 0.1);
  }

  assert.ok(sim.minions.length > 0, 'minion waves must spawn');

  // Verify live structure footprints: Outer, Inner, Nexus towers
  const blueTowers = sim.structures.filter(s => s.team === 'blue' && s.type.endsWith('_tower') && s.isAlive);
  assert.ok(blueTowers.length >= 3, 'all 3 blue towers must start alive');

  for (const tower of blueTowers) {
    for (const minion of sim.minions) {
      if (!minion.isAlive) continue;
      const dist = Math.hypot(minion.x - tower.x, minion.y - tower.y);
      // Minion center must never penetrate the solid core of the tower (radius 32px)
      assert.ok(
        dist >= 26,
        `minion ${minion.id} at (${minion.x.toFixed(1)}, ${minion.y.toFixed(1)}) penetrated tower ${tower.id} at (${tower.x}, ${tower.y}) - distance ${dist.toFixed(1)}px`
      );
    }
  }
});

test('Phase 5.3: Jungle camps and epic boss pits maintain clear navigable access away from lane', () => {
  assert.ok(CAMP_ROCK_RINGS.length >= 8, 'at least 8 jungle camps populated');

  // Check 4 North camps (Y < 720) and 4 South camps (Y > 720)
  const northCamps = CAMP_ROCK_RINGS.filter(c => c.y < LANE_Y);
  const southCamps = CAMP_ROCK_RINGS.filter(c => c.y > LANE_Y);
  assert.ok(northCamps.length >= 4, `expected >= 4 north camps, got ${northCamps.length}`);
  assert.ok(southCamps.length >= 4, `expected >= 4 south camps, got ${southCamps.length}`);

  // Both Dragon pit (top) and Golem pit (bottom) are reachable without colliding into blocking rock terrain
  const startLane = { x: DRAGON_X, y: LANE_Y };
  const dragonPit = { x: DRAGON_X, y: 320 };
  const stepToDragon = resolveRockTerrainMovement(startLane, dragonPit, 14);
  assert.ok(stepToDragon.y < LANE_Y, `unit must be able to move north toward dragon pit (got y=${stepToDragon.y})`);

  const golemPit = { x: DRAGON_X, y: 1120 };
  const stepToGolem = resolveRockTerrainMovement(startLane, golemPit, 14);
  assert.ok(stepToGolem.y > LANE_Y, `unit must be able to move south toward golem pit (got y=${stepToGolem.y})`);
});

test('Phase 5.4: Authoritative structure sequence strictly enforces: Outer -> Inner -> Nexus Tower -> All 3 Barracks -> Nexus', () => {
  const blueStructures = [
    { id: 'b_t1', team: 'blue', type: 'outer_tower', isAlive: true },
    { id: 'b_t2', team: 'blue', type: 'inner_tower', isAlive: true },
    { id: 'b_t3', team: 'blue', type: 'nexus_tower', isAlive: true },
    { id: 'b_b1', team: 'blue', type: 'barracks', barracksKind: 'melee', isAlive: true },
    { id: 'b_b2', team: 'blue', type: 'barracks', barracksKind: 'ranged', isAlive: true },
    { id: 'b_b3', team: 'blue', type: 'barracks', barracksKind: 'catapult', isAlive: true },
    { id: 'b_nx', team: 'blue', type: 'nexus', isAlive: true },
  ];

  // Stage 1: Only Outer Tower is vulnerable
  assert.equal(canDamageStructure(blueStructures[0], blueStructures), true, 'outer tower is vulnerable');
  assert.equal(canDamageStructure(blueStructures[1], blueStructures), false, 'inner tower is immune');
  assert.equal(canDamageStructure(blueStructures[2], blueStructures), false, 'nexus tower is immune');
  assert.equal(canDamageStructure(blueStructures[3], blueStructures), false, 'barracks are immune');
  assert.equal(canDamageStructure(blueStructures[6], blueStructures), false, 'nexus is immune');

  // Stage 2: Outer falls -> Inner becomes vulnerable
  blueStructures[0].isAlive = false;
  assert.equal(canDamageStructure(blueStructures[1], blueStructures), true, 'inner tower becomes vulnerable');
  assert.equal(canDamageStructure(blueStructures[2], blueStructures), false, 'nexus tower still immune');

  // Stage 3: Inner falls -> Nexus tower becomes vulnerable
  blueStructures[1].isAlive = false;
  assert.equal(canDamageStructure(blueStructures[2], blueStructures), true, 'nexus tower becomes vulnerable');
  assert.equal(canDamageStructure(blueStructures[3], blueStructures), false, 'barracks still immune');

  // Stage 4: Nexus tower falls -> Barracks become vulnerable
  blueStructures[2].isAlive = false;
  assert.equal(canDamageStructure(blueStructures[3], blueStructures), true, 'melee barracks becomes vulnerable');
  assert.equal(canDamageStructure(blueStructures[4], blueStructures), true, 'ranged barracks becomes vulnerable');
  assert.equal(canDamageStructure(blueStructures[5], blueStructures), true, 'catapult barracks becomes vulnerable');
  assert.equal(canDamageStructure(blueStructures[6], blueStructures), false, 'nexus is STILL immune (all 3 barracks required)');

  // Destroy 2 of 3 barracks: Nexus MUST remain immune
  blueStructures[3].isAlive = false;
  blueStructures[4].isAlive = false;
  assert.equal(canDamageStructure(blueStructures[6], blueStructures), false, 'nexus MUST remain immune with 1 barracks intact');

  // Destroy last barracks: Nexus finally vulnerable!
  blueStructures[5].isAlive = false;
  assert.equal(canDamageStructure(blueStructures[6], blueStructures), true, 'nexus unlocks ONLY when all 3 barracks fall');
});

test('Phase 5.5: 10-second turret execution attribution and true damage rules', () => {
  const defenders = [
    { id: 'c1', team: 'blue', gold: 1000 },
    { id: 'c2', team: 'blue', gold: 1000 },
    { id: 'c3', team: 'blue', gold: 1000 },
    { id: 'c4', team: 'blue', gold: 1000 },
    { id: 'c5', team: 'blue', gold: 1000 },
  ];

  // Case A: Recent champion damage within 10s window (e.g. 5s ago)
  const recentVictim = {
    team: 'red',
    lastEnemyDamage: { attackerId: 'c1', second: 55 },
  };
  const rewardA = resolveTurretKillReward(recentVictim, 60, defenders, 10, 300);
  assert.equal(rewardA.killer?.id, 'c1', 'last attacker gets champion kill credit');
  assert.equal(rewardA.splitGoldPerAlly, 0, 'no team split when champion killer exists');

  // Case B: Expired damage (> 10s ago, e.g. 15s ago)
  const executedVictim = {
    team: 'red',
    lastEnemyDamage: { attackerId: 'c1', second: 40 },
  };
  const rewardB = resolveTurretKillReward(executedVictim, 60, defenders, 10, 300);
  assert.equal(rewardB.killer, null, 'death is an authentic execution (no champion credit)');
  assert.equal(rewardB.splitGoldPerAlly, 60, '300g bounty splits evenly (60g each) among 5 defending teammates');

  // Turret shot deals true damage regardless of armor
  const rawDamage = turretShotDamage(180, 0, 1.0);
  const armorDamage = turretShotDamage(180, 150, 1.0);
  assert.equal(rawDamage, armorDamage, 'turret attacks deal true damage ignoring target armor');
});

test('Phase 5.6: Cardrel parody alias and parody gamer roster preservation', () => {
  const blueLineup = createDefaultSimulationLineup('blue');
  const redLineup = createDefaultSimulationLineup('red');
  const allLineup = [...blueLineup, ...redLineup];

  const cardrel = allLineup.find(p => p.player.name === 'Cardrel');
  assert.ok(cardrel, 'Cardrel parody alias must exist on roster');
  assert.equal(cardrel.player.realName, 'Caedrel', 'realName Caedrel preserved internally');

  // Verify parody aliases on the rest of the roster
  const expectedParodies = ['p1mple', 'Zypoo', 'd4nk', 'M0cke', 'flopz', 'SneakBro'];
  for (const alias of expectedParodies) {
    const card = allLineup.find(p => p.player.name === alias);
    assert.ok(card, `parody alias ${alias} must exist on active roster`);
  }
});

test('Phase 5.7: Deterministic replay captures frames and synchronizes across 1x, 2x, and 4x playback rates', () => {
  const replay = new ViewerReplay();
  const sim = createSimulationState({ seed: 9999 });

  const captureSimFrame = (second) => ({
    champions: sim.champions,
    minions: sim.minions,
    structures: sim.structures,
    camps: sim.jungleCamps.map(c => ({
      id: c.id,
      name: c.name,
      x: c.x,
      y: c.y,
      hp: c.hp,
      maxHp: c.maxHp,
      isAlive: c.isAlive,
    })),
    dragon: {
      id: sim.dragon.id,
      name: sim.dragon.name,
      x: sim.dragon.x,
      y: sim.dragon.y,
      hp: sim.dragon.hp,
      maxHp: sim.dragon.maxHp,
      isAlive: sim.dragon.isAlive,
    },
    projectiles: [],
    spells: [],
    wards: [],
    second,
  });

  // Capture initial baseline frame at t=0
  replay.capture(captureSimFrame(0));

  // Record 60 frames (2.0s at 30Hz)
  for (let i = 0; i < 60; i++) {
    stepSimulation(sim, 1 / 30);
    replay.capture(captureSimFrame(sim.matchTime));
  }

  assert.equal(replay.range.start, 0);
  assert.ok(Math.abs(replay.range.end - 2.0) < 0.1, `expected replay range ~2.0s, got ${replay.range.end}`);

  // Test 1x speed advance
  replay.seek(0);
  replay.paused = false;
  replay.setPlaybackRate(1);
  replay.advance(0.5);
  assert.ok(Math.abs(replay.second - 0.5) < 0.05, `1x advance should be 0.5s, got ${replay.second}`);

  // Test 2x speed advance
  replay.setPlaybackRate(2);
  replay.advance(0.5);
  assert.ok(Math.abs(replay.second - 1.5) < 0.05, `2x advance should add 1.0s (total 1.5s), got ${replay.second}`);

  // Test 4x speed advance
  replay.seek(0);
  replay.setPlaybackRate(4);
  replay.advance(0.25);
  assert.ok(Math.abs(replay.second - 1.0) < 0.05, `4x advance should add 1.0s (total 1.0s), got ${replay.second}`);

  // Test seeking backward
  const seekedFrame = replay.seek(0.5);
  assert.ok(seekedFrame, 'seek should return valid frame');
  assert.ok(Math.abs(seekedFrame.second - 0.5) < 0.05, 'seeked frame second should match 0.5s');

  // Test JSON export & parse roundtrip
  const exported = replay.export();
  const parsed = ViewerReplay.parse(exported);
  assert.equal(parsed.range.start, replay.range.start);
  assert.equal(parsed.range.end, replay.range.end);
});
