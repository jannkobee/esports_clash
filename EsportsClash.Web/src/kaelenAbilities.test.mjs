import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendKaelenInvokedSpell,
  appendKaelenOrb,
  getKaelenInvokedSpell,
  KAELEN_INVOKED_SPELLS,
  kaelenInvokeCooldownAtLevel
} from './kaelenAbilities.ts';

test('Kaelen orb FIFO invokes all ten elemental recipes into distinct spells', () => {
  assert.equal(KAELEN_INVOKED_SPELLS.length, 10);
  assert.equal(new Set(KAELEN_INVOKED_SPELLS.map(spell => spell.id)).size, 10);
  assert.equal(new Set(KAELEN_INVOKED_SPELLS.map(spell => spell.cooldown)).size, 10);
  for (const spell of KAELEN_INVOKED_SPELLS) {
    assert.equal(getKaelenInvokedSpell(spell.recipe)?.id, spell.id);
  }
  assert.deepEqual(appendKaelenOrb(['ice', 'wind', 'fire'], 'ice'), ['wind', 'fire', 'ice']);
});

test('Kaelen invoked spell slots keep the newest two spells in FIFO order', () => {
  assert.deepEqual(appendKaelenInvokedSpell([], 'glacier-lock'), ['glacier-lock']);
  assert.deepEqual(appendKaelenInvokedSpell(['glacier-lock'], 'rime-gale'), ['glacier-lock', 'rime-gale']);
  assert.deepEqual(appendKaelenInvokedSpell(['glacier-lock', 'rime-gale'], 'solar-pike'), ['rime-gale', 'solar-pike']);
});

test('Kaelen Conflux cooldown falls at levels 1, 7, 13, and 18', () => {
  assert.deepEqual([1, 6, 7, 12, 13, 17, 18].map(kaelenInvokeCooldownAtLevel), [3, 3, 2, 2, 1, 1, 0]);
});
