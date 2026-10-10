import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPaxiEscapeJaunt } from './paxiDecision.ts';

test('Paxi takes an active orb out of a losing fight only when it improves safety', () => {
  const paxi = { x: 800, y: 380, hp: 300, maxHp: 1000 };
  const enemy = [{ x: 840, y: 380 }];
  assert.equal(shouldPaxiEscapeJaunt(paxi, { x: 690, y: 370 }, enemy, 110), true);
  assert.equal(shouldPaxiEscapeJaunt(paxi, { x: 900, y: 380 }, enemy, 110), false);
  assert.equal(shouldPaxiEscapeJaunt({ ...paxi, hp: 900 }, { x: 690, y: 370 }, enemy, 110), false);
});
