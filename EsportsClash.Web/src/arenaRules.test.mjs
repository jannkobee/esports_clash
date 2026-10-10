import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_WIDTH, BARRACKS_X, CAMP_ROCK_RINGS, DRAGON_SPAWN_SECOND, NEXUS_X, NEXUS_TOWER_X, ROCK_TERRAIN, WELL_X, STRUCTURE_HP, nextNexusVolleyShot, selectNexusTargets, selectTurretTarget, turretShotDamage, resolveRockTerrainMovement, rockApproachWaypoint, isInsideRockTerrain, isMinionEmpowered, waveStats, ARAM_BUSHES, getBushAt, canUnitRecall, towerSiegeMultiplier, canDamageNexus } from './arenaRules.ts';

test('expanded map leaves room between each well, nexus, and barracks', () => {
  assert.equal(ARENA_WIDTH, 2000);
  assert.ok(NEXUS_X.blue - WELL_X.blue >= 140);
  assert.ok(BARRACKS_X.blue - NEXUS_X.blue >= 140);
  assert.ok(NEXUS_TOWER_X.blue - BARRACKS_X.blue >= 65);
  assert.ok(WELL_X.red - NEXUS_X.red >= 140);
  assert.ok(NEXUS_X.red - BARRACKS_X.red >= 140);
  assert.ok(BARRACKS_X.red - NEXUS_TOWER_X.red >= 65);
});

test('tower plating tapers with game time and a nexus opens after its turret and one barracks fall', () => {
  assert.equal(towerSiegeMultiplier(0), 0.30);
  assert.ok(Math.abs(towerSiegeMultiplier(240) - 0.65) < 1e-9);
  assert.ok(towerSiegeMultiplier(300) > towerSiegeMultiplier(0));
  assert.equal(towerSiegeMultiplier(480), 1);
  assert.ok(STRUCTURE_HP.outer_tower < STRUCTURE_HP.inner_tower);
  assert.ok(STRUCTURE_HP.inner_tower < STRUCTURE_HP.nexus_tower);
  assert.ok(STRUCTURE_HP.nexus > STRUCTURE_HP.nexus_tower);
  const defenders = [
    { team: 'red', type: 'nexus_tower', isAlive: true },
    { team: 'red', type: 'barracks', isAlive: true },
    { team: 'red', type: 'barracks', isAlive: true }
  ];
  assert.equal(canDamageNexus('red', defenders), false);
  defenders[0].isAlive = false;
  assert.equal(canDamageNexus('red', defenders), false);
  defenders[1].isAlive = false;
  assert.equal(canDamageNexus('red', defenders), true);
});

test('nexus fires five rapid shots then reloads so upgraded waves can siege', () => {
  let shotsRemaining = 5;
  const cooldowns = [];
  for (let shot = 0; shot < 5; shot++) {
    const next = nextNexusVolleyShot(shotsRemaining);
    shotsRemaining = next.shotsRemaining;
    cooldowns.push(next.cooldown);
  }
  assert.deepEqual(cooldowns, [0.2, 0.2, 0.2, 0.2, 2.2]);
  assert.equal(shotsRemaining, 5);
});

test('each nexus pulse selects up to six distinct enemies and keeps dive aggro first', () => {
  const wave = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, type: 'melee' }));
  const champions = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, champion: 'Valkira' }));
  const targets = selectNexusTargets([...wave, ...champions], null, 'c2');
  assert.equal(targets.length, 6);
  assert.equal(targets[0].id, 'c2');
  assert.equal(new Set(targets.map(target => target.id)).size, 6);
  assert.equal(targets.filter(target => target.id.startsWith('c')).length, 5);
  assert.deepEqual(selectNexusTargets([wave[0]], null).map(target => target.id), ['m0']);
});

test('each camp and boss has a solid rocky enclosure with a lane-facing opening', () => {
  assert.equal(DRAGON_SPAWN_SECOND, 240);
  for (const ring of CAMP_ROCK_RINGS) {
    const stones = ROCK_TERRAIN.filter(rock => rock.campId === ring.id);
    assert.ok(stones.length >= ring.stones - 4, `${ring.id} should have a nearly complete wall`);
    assert.equal(isInsideRockTerrain(ring.x, ring.y, 13), false);
    const entryY = ring.y + Math.sin(ring.entrance) * (ring.radius + 28);
    let walker = { x: ring.x, y: entryY };
    for (let tick = 0; tick < 40; tick++) {
      const dy = ring.y - walker.y;
      if (Math.abs(dy) < 7) break;
      walker = resolveRockTerrainMovement(walker,
        { x: walker.x, y: walker.y + Math.sign(dy) * 7 }, 13);
      assert.equal(isInsideRockTerrain(walker.x, walker.y, 13), false);
    }
    assert.ok(Math.hypot(walker.x - ring.x, walker.y - ring.y) < 8, `${ring.id} should be reachable through its opening`);
    const sideRock = stones.find(rock => Math.abs(rock.y - ring.y) < 2 && rock.x > ring.x);
    assert.ok(sideRock, `${ring.id} should have a side wall`);
    assert.equal(isInsideRockTerrain(sideRock.x, sideRock.y, 13), true);
  }
});

test('both raised base entrances keep one clear central stair and rocky side walls', () => {
  for (const x of [515, 1485]) {
    assert.equal(isInsideRockTerrain(x, 295, 13), true);
    assert.equal(isInsideRockTerrain(x, 465, 13), true);
    assert.equal(isInsideRockTerrain(x, 380, 13), false);
  }
  for (const [startX, goalX] of [[610, 420], [1390, 1580]]) {
    let walker = { x: startX, y: 380 };
    for (let tick = 0; tick < 30; tick++) {
      const dx = goalX - walker.x;
      if (Math.abs(dx) < 7) break;
      walker = resolveRockTerrainMovement(walker, { x: walker.x + Math.sign(dx) * 7, y: walker.y }, 13);
      assert.equal(isInsideRockTerrain(walker.x, walker.y, 13), false);
    }
    assert.ok(Math.abs(walker.x - goalX) < 8);
  }
});

test('units can approach objective pits and jungle camps from nearby lane positions', () => {
  for (const [startX, startY, goalX, goalY] of [
    [900, 380, 576, 170], [900, 380, 1000, 130], [900, 380, 1000, 610],
    [1100, 380, 1424, 170], [650, 380, 485, 600], [1350, 380, 1515, 600],
  ]) {
    let walker = { x: startX, y: startY };
    for (let tick = 0; tick < 250; tick++) {
      const dx = goalX - walker.x;
      const dy = goalY - walker.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 8) break;
      walker = resolveRockTerrainMovement(walker,
        { x: walker.x + dx / distance * 7, y: walker.y + dy / distance * 7 }, 13);
      assert.equal(isInsideRockTerrain(walker.x, walker.y, 13), false);
    }
    assert.ok(Math.hypot(goalX - walker.x, goalY - walker.y) < 8,
      `${startX},${startY} should reach ${goalX},${goalY}; stopped at ${walker.x.toFixed(0)},${walker.y.toFixed(0)}`);
  }
});

test('campers and objective teams use the base stair and pit opening', () => {
  for (const [startX, goalX, goalY] of [
    [400, 485, 600], [1600, 1515, 600], [400, 576, 170], [1600, 1424, 170],
    [400, 1000, 130], [1600, 1000, 130], [400, 1000, 610], [1600, 1000, 610],
  ]) {
    const goal = { x: goalX, y: goalY };
    let walker = { x: startX, y: 380 };
    for (let tick = 0; tick < 350; tick++) {
      if (Math.hypot(goal.x - walker.x, goal.y - walker.y) < 8) break;
      const waypoint = rockApproachWaypoint(walker, goal);
      const distance = Math.hypot(waypoint.x - walker.x, waypoint.y - walker.y);
      walker = resolveRockTerrainMovement(walker,
        { x: walker.x + (waypoint.x - walker.x) / distance * Math.min(7, distance),
          y: walker.y + (waypoint.y - walker.y) / distance * Math.min(7, distance) }, 13);
      assert.equal(isInsideRockTerrain(walker.x, walker.y, 13), false);
    }
    assert.ok(Math.hypot(goal.x - walker.x, goal.y - walker.y) < 8,
      `${startX} should reach camp or objective; stopped at ${walker.x.toFixed(0)},${walker.y.toFixed(0)}`);
  }
});

test('turrets punish an in-range champion dive instead of staying locked on creeps', () => {
  const minion = { id: 'wave1', type: 'melee' };
  const diver = { id: 'diver', champion: 'Valkira' };
  assert.equal(selectTurretTarget([minion, diver], minion.id, diver.id)?.id, diver.id);
  assert.equal(selectTurretTarget([minion, diver], null)?.id, minion.id);
  assert.equal(turretShotDamage(160, true, false), 288);
  assert.equal(turretShotDamage(160, false, false), 160);
  assert.equal(turretShotDamage(85, true, true), 85);
});

test('destroying one enemy barracks upgrades only its matching creep class', () => {
  const structures = [
    { team: 'red', type: 'barracks', barracksKind: 'melee', isAlive: false },
    { team: 'red', type: 'barracks', barracksKind: 'ranged', isAlive: true },
    { team: 'red', type: 'barracks', barracksKind: 'catapult', isAlive: true },
  ];
  assert.equal(isMinionEmpowered('blue', 'melee', structures), true);
  assert.equal(isMinionEmpowered('blue', 'caster', structures), false);
  assert.equal(isMinionEmpowered('blue', 'cannon', structures), false);
  assert.equal(isMinionEmpowered('red', 'melee', structures), false);
});

test('empowered minions gain health, damage, and speed', () => {
  for (const type of ['melee', 'caster', 'cannon']) {
    const base = waveStats(type, false);
    const upgraded = waveStats(type, true);
    assert.ok(upgraded.hp > base.hp);
    assert.ok(upgraded.ad > base.ad);
    assert.ok(upgraded.speed > base.speed);
  }
});

test('nine strategic bushes cover river, pit, valley and highground flanks', () => {
  assert.equal(ARAM_BUSHES.length, 9);
  const ids = new Set(ARAM_BUSHES.map(b => b.id));
  assert.equal(ids.size, 9);
  for (const b of ARAM_BUSHES) {
    assert.ok(b.width >= 90);
    assert.ok(b.height >= 35);
    assert.ok(b.x > 0 && b.x < ARENA_WIDTH);
    // getBushAt center point returns the bush
    const found = getBushAt(b.x, b.y);
    assert.equal(found?.id, b.id);
  }
  // Points in middle lane return undefined (middle bushes removed)
  assert.equal(getBushAt(0, 0), undefined);
  assert.equal(getBushAt(1000, 380), undefined);
  assert.equal(getBushAt(980, 310), undefined);
  assert.equal(getBushAt(1020, 450), undefined);
});

test('canUnitRecall enforces safety distance, minion clearance, bush stealth, and damage cooldown', () => {
  // Safe conditions: enemies far (500px), minions far (300px), structures far (300px), cd 0, not in bush
  assert.equal(canUnitRecall(500, 300, 300, 0, false), true);

  // 1. Threatening enemy within 450px prevents open recall
  assert.equal(canUnitRecall(400, 300, 300, 0, false), false);

  // 2. Ducking into bush reduces safe enemy distance from 450px to 300px (stealth recall)
  assert.equal(canUnitRecall(350, 300, 300, 0, true), true);
  assert.equal(canUnitRecall(250, 300, 300, 0, true), false);

  // 3. Threatening minions (< 270px) must be cleared first
  assert.equal(canUnitRecall(500, 200, 300, 0, false), false);

  // 4. Enemy structures (< 250px) prevent recall
  assert.equal(canUnitRecall(500, 300, 200, 0, false), false);

  // 5. Recall cooldown from taking damage (> 0) prevents recall
  assert.equal(canUnitRecall(500, 300, 300, 4.0, false), false);
  assert.equal(canUnitRecall(500, 300, 300, 0.5, true), false);
});
