import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_WIDTH, BARRACKS_X, NEXUS_X, WELL_X, isMinionEmpowered, waveStats } from './arenaRules.ts';

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
