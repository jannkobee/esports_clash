import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLEM_SPAWN_SECOND, selectGolemChargeTower, shouldAwakenGolem } from './siegeGolemRules.ts';

test('the one-time Colossus awakens at two minutes', () => {
  assert.equal(GOLEM_SPAWN_SECOND, 120);
  assert.equal(shouldAwakenGolem(119, false), false);
  assert.equal(shouldAwakenGolem(120, false), true);
  assert.equal(shouldAwakenGolem(121, true), false);
});

test('one siege golem charges the next live enemy tower in front of it', () => {
  const structures = [
    { id: 'ally', team: 'blue', type: 'outer_tower', isAlive: true, x: 110, y: 380 },
    { id: 'behind', team: 'red', type: 'outer_tower', isAlive: true, x: 90, y: 380 },
    { id: 'broken', team: 'red', type: 'outer_tower', isAlive: false, x: 190, y: 380 },
    { id: 'front', team: 'red', type: 'inner_tower', isAlive: true, x: 205, y: 380 },
    { id: 'blue-front', team: 'blue', type: 'inner_tower', isAlive: true, x: 205, y: 380 },
    { id: 'nexus', team: 'red', type: 'nexus', isAlive: true, x: 220, y: 380 },
  ];
  assert.equal(selectGolemChargeTower({ team: 'blue', x: 100, y: 380 }, structures)?.id, 'front');
  assert.equal(selectGolemChargeTower({ team: 'red', x: 300, y: 380 }, structures)?.id, 'blue-front');
  assert.equal(selectGolemChargeTower({ team: 'blue', x: -100, y: 380 }, structures), undefined);
});
