import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTacticalOutlook } from './tacticalOutlook.ts';

const read = overrides => estimateTacticalOutlook({ actor: { x: 0, y: 0, hp: 100, maxHp: 100 },
  target: { x: 180, y: 0, hp: 40, maxHp: 100 }, travelSpeed: 100, interactionRange: 80,
  nearbyAllies: 3, nearbyEnemies: 1, approachThreat: .2, approachCover: .7, ...overrides });

test('a supported short approach outranks an exposed long approach without changing legality', () => {
  const safe = read({});
  const exposed = read({ target: { x: 700, y: 0, hp: 40, maxHp: 100 }, approachThreat: .9, approachCover: 0, nearbyAllies: 1, nearbyEnemies: 3 });
  assert.ok(safe.survival > exposed.survival && safe.pressure > exposed.pressure);
});
