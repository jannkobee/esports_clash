import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLeashedMonster } from './neutralAggroRules.ts';

test('neutral monsters stand still until attacked, chase, then return home', () => {
  assert.deepEqual(stepLeashedMonster(100, 100, 100, 100, null, 1), { x: 100, y: 100, chasing: false });
  const chase = stepLeashedMonster(100, 100, 100, 100, { x: 170, y: 100 }, 0.5);
  assert.equal(chase.chasing, true);
  assert.ok(chase.x > 100);
  const reset = stepLeashedMonster(chase.x, chase.y, 100, 100, { x: 300, y: 100 }, 1);
  assert.equal(reset.chasing, false);
  assert.equal(reset.x, 100);
});
