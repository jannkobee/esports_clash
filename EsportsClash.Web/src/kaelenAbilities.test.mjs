import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendKaelenInvokedSpell,
  appendKaelenOrb,
  getKaelenInvokedSpell,
  KAELEN_INVOKED_SPELLS,
  kaelenOrbCounts,
  kaelenInvokeCooldownAtLevel,
  kaelenOrbRankAtLevel,
  kaelenOrbStatBonuses
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

test('Kaelen orbs are cooldown-free stat stacks which scale with orb rank', () => {
  assert.deepEqual([1, 4, 7, 9, 12, 14, 17].map(kaelenOrbRankAtLevel), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(kaelenOrbStatBonuses(1, { ice: 1, wind: 1, fire: 1 }), {
    healthRegen: 0.2, moveSpeed: 1, spellAmp: 0.01, damageAmp: 0.01
  });
  assert.deepEqual(kaelenOrbStatBonuses(17, { ice: 2, wind: 0, fire: 1 }), {
    healthRegen: 1, moveSpeed: 0, spellAmp: 0.025, damageAmp: 0.025
  });
});

test('Kaelen orb bonuses are limited to the current three-orb FIFO', () => {
  const heldOrbs = appendKaelenOrb(['ice', 'fire', 'fire'], 'wind');
  assert.deepEqual(heldOrbs, ['fire', 'fire', 'wind']);
  assert.deepEqual(kaelenOrbCounts(heldOrbs), { ice: 0, wind: 1, fire: 2 });
  assert.deepEqual(kaelenOrbCounts(['ice', 'fire', 'fire', 'wind']), { ice: 0, wind: 1, fire: 2 });
  assert.deepEqual(kaelenOrbStatBonuses(1, kaelenOrbCounts(heldOrbs)), {
    healthRegen: 0, moveSpeed: 1, spellAmp: 0.02, damageAmp: 0.02
  });
});
