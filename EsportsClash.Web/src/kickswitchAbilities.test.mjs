import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeamwardKickDestination } from './kickswitchAbilities.ts';

const bounds = { minX: 60, maxX: 1140, minY: 90, maxY: 610 };

test('Bellbreak Kick displaces a target toward the nearby allied formation', () => {
  const destination = getTeamwardKickDestination(
    { x: 450, y: 300 },
    [{ x: 300, y: 280 }, { x: 220, y: 320 }],
    { x: 360, y: 300 },
    180,
    bounds
  );

  assert.ok(destination.x < 450);
  assert.ok(destination.x > 200);
  assert.equal(destination.y, 300);
});

test('Bellbreak Kick falls back to the caster and keeps targets within arena bounds', () => {
  const destination = getTeamwardKickDestination(
    { x: 70, y: 100 },
    [],
    { x: 10, y: 10 },
    180,
    bounds
  );

  assert.deepEqual(destination, { x: 60, y: 90 });
});
