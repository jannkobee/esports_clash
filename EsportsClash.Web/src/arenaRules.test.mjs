import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_WIDTH, BARRACKS_X, NEXUS_X, WELL_X, isMinionEmpowered, waveStats, ARAM_BUSHES, getBushAt, canUnitRecall } from './arenaRules.ts';

test('expanded map leaves room between each well, nexus, and barracks', () => {
  assert.equal(ARENA_WIDTH, 2000);
  assert.ok(NEXUS_X.blue - WELL_X.blue >= 140);
  assert.ok(BARRACKS_X.blue > NEXUS_X.blue);
  assert.ok(WELL_X.red - NEXUS_X.red >= 140);
  assert.ok(BARRACKS_X.red < NEXUS_X.red);
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

test('five strategic bushes cover key flank and jungle choke points (mid bushes removed)', () => {
  assert.equal(ARAM_BUSHES.length, 5);
  const ids = new Set(ARAM_BUSHES.map(b => b.id));
  assert.equal(ids.size, 5);
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
