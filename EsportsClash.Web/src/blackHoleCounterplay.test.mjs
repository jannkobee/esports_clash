import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSaveBlackHoleInterrupt, shouldSpreadForBlackHole } from './blackHoleCounterplay.ts';

const unit = { id: 'hero', x: 0, y: 0, hp: 1000, maxHp: 1000, mana: 100,
  level: 8, cdUlt: 0, champion: { name: 'Stonewake' }, player: { stats: { iq: 88, tf: 82 } } };
const nullweaver = { ...unit, id: 'null', x: 175, champion: { name: 'Nullweaver' } };
const ally = { ...unit, id: 'ally', x: 25 };

test('rated players spread before a ready Black Hole and retain control to interrupt it', () => {
  assert.equal(shouldSpreadForBlackHole(unit, nullweaver, ally), true);
  assert.equal(shouldSaveBlackHoleInterrupt(unit, nullweaver), true);
  assert.equal(shouldSpreadForBlackHole(unit, { ...nullweaver, cdUlt: 12 }, ally), false);
  assert.equal(shouldSaveBlackHoleInterrupt(unit, { ...nullweaver, blackHole: { remaining: 2 } }), false);
  assert.equal(shouldSpreadForBlackHole({ ...unit, player: { stats: { iq: 40, tf: 40 } } }, nullweaver, ally), false);
});
