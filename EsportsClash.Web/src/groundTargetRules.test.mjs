import test from 'node:test';
import assert from 'node:assert/strict';
import { getGroundTargetPoint } from './groundTargetRules.ts';

const bounds = { minX: 50, maxX: 950, minY: 100, maxY: 600 };

test('ground targets follow the requested point and clamp to ability range', () => {
  assert.deepEqual(getGroundTargetPoint({ x: 100, y: 200 }, { x: 500, y: 500 }, 1, 100, bounds), {
    x: 180,
    y: 260
  });
});

test('ground targets remain castable without an enemy by aiming in the facing direction', () => {
  assert.deepEqual(getGroundTargetPoint({ x: 100, y: 200 }, undefined, -1, 250, bounds), {
    x: 50,
    y: 200
  });
});

test('ground targets stay inside the arena bounds', () => {
  assert.deepEqual(getGroundTargetPoint({ x: 940, y: 590 }, { x: 1100, y: 900 }, 1, 300, bounds), {
    x: 950,
    y: 600
  });
});
