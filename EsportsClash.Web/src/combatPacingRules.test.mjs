import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHookPull, calculateDeathTimer } from './combatPacingRules.ts';

test('death timers fit the short match without erasing the late push window', () => {
  assert.equal(calculateDeathTimer(3, 60), 8);
  assert.equal(calculateDeathTimer(10, 240), 13);
  assert.equal(calculateDeathTimer(15, 480), 20);
  assert.equal(calculateDeathTimer(18, 720), 27);
  assert.equal(calculateDeathTimer(18, 1200), 28);
});

test('a landed hook draws the victim toward the caster across several ticks', () => {
  const caster = { x: 100, y: 350 };
  let target = { x: 350, y: 350 };
  const positions = [];
  for (let tick = 0; tick < 20; tick++) {
    const next = advanceHookPull(target, caster, 1 / 30);
    positions.push(next.x);
    target = next;
    if (next.done) break;
  }
  assert.ok(positions.length > 5);
  assert.ok(positions[0] < 350 && positions[0] > 300);
  assert.ok(positions.every((position, index) => index === 0 || position <= positions[index - 1]));
  assert.equal(target.x, 143);
});
