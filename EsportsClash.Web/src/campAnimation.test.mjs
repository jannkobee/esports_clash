import test from 'node:test';
import assert from 'node:assert/strict';
import { campAnimation } from './campAnimation.ts';

const camp = { x: 100, y: 100, homeX: 100, homeY: 100, attackTimer: 0, hurtTimer: 0 };

test('jungle camp motion communicates idle, pursuit, attack warning, strike and hit', () => {
  assert.equal(campAnimation(camp, 1).state, 'idle');
  assert.equal(campAnimation({ ...camp, x: 130, targetX: 190, targetDistance: 60, attackTimer: 0.8 }, 1).state, 'chase');
  assert.ok(campAnimation({ ...camp, targetX: 160, targetDistance: 60, attackTimer: 0.2 }, 1).windup > 0);
  assert.equal(campAnimation({ ...camp, targetX: 160, targetDistance: 60, attackTimer: 1.2 }, 1).state, 'attack');
  assert.ok(campAnimation({ ...camp, hurtTimer: 0.2 }, 1).flash > 0);
  assert.equal(campAnimation({ ...camp, x: 130 }, 1).state, 'return');
});
