import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPrioritizeWaveClear, shouldCastWaveClearSkill, getMinionCrashMultiplier, getWaveClearProfile, isInsideWaveClear } from './waveClearRules.ts';

const context = { supported: true, manaCost: 35, maxMana: 100, cooldownSeconds: 10,
  damage: 140, basicDamage: 50, minionHealth: [160, 160, 160], nearbyEnemies: 0,
  secondsUntilObjective: 40, siegeOpportunity: false, teamfight: 80, laningDemon: false, macroStyle: false };
const cast = overrides => shouldCastWaveClearSkill('Mage', 100, 0, 3, 80, 80, { ...context, ...overrides });

test('useful waves may spend a supported skill but cheap last hits and isolated creeps do not', () => {
  assert.equal(cast({}), true);
  assert.equal(cast({ minionHealth: [10, 20, 25, 30] }), false);
  assert.equal(cast({ minionHealth: [500] }), false);
  assert.equal(cast({ damage: 0 }), false);
  assert.equal(cast({ damage: 20 }), false);
  assert.equal(cast({ minionHealth: [160, 160] }), false);
  assert.equal(cast({ minionHealth: [160, 160], siegeOpportunity: true }), true);
  assert.equal(cast({ minionHealth: [120, 120] }), true, 'two useful kills justify a cast');
});

test('danger, mana reserve, actual costs/cooldowns and imminent objectives are hard gates', () => {
  for (const override of [{ supported: false }, { nearbyEnemies: 1 }, { manaCost: 70 },
    { secondsUntilObjective: 14 }, { secondsUntilObjective: 0 }]) assert.equal(cast(override), false);
  assert.equal(cast({ secondsUntilObjective: 15 }), true);
  assert.equal(shouldCastWaveClearSkill('Mage', 100, 1, 3, 99, 99, context), false);
  assert.equal(shouldCastWaveClearSkill('Mage', 30, 0, 3, 99, 99, context), false);
});

test('card lane/macro preferences influence choices but never bypass safety', () => {
  assert.equal(shouldCastWaveClearSkill('Mage', 100, 0, 3, 40, 40, context), false);
  assert.equal(shouldCastWaveClearSkill('Mage', 100, 0, 3, 40, 40, { ...context, laningDemon: true }), true);
  assert.equal(shouldCastWaveClearSkill('Mage', 100, 0, 3, 40, 40, { ...context, macroStyle: true }), true);
  assert.equal(cast({ laningDemon: true, macroStyle: true, nearbyEnemies: 2 }), false);
});

test('only explicit damaging deliveries clear waves; rectangles and projectile splashes keep their shape', () => {
  for (const name of ['Kaelen', 'Aetheris', 'Jinxy', 'Mirehook', 'Valerie', 'Cinderbloom'])
    assert.equal(getWaveClearProfile(name), undefined, name);
  const fault = getWaveClearProfile('Stonewake');
  assert.equal(isInsideWaveClear({ x: 80, y: 30 }, { x: 0, y: 0 }, fault), true);
  assert.equal(isInsideWaveClear({ x: 20, y: 40 }, { x: 0, y: 0 }, fault), false);
  const flak = getWaveClearProfile('Skybreaker');
  assert.equal(flak.speed, 660);
  assert.equal(isInsideWaveClear({ x: 106, y: 0 }, { x: 0, y: 0 }, flak), false);
  assert.equal(isInsideWaveClear({ x: 100, y: 0 }, { x: 0, y: 0 }, flak), true);
});

test('lane skill changes whether a player clears a safe wave before chasing', () => {
  assert.equal(shouldPrioritizeWaveClear(90, 90, true, false, 0, 220), true);
  assert.equal(shouldPrioritizeWaveClear(30, 30, true, false, 0, 220), false);
  assert.equal(shouldPrioritizeWaveClear(30, 30, true, true, 0, 220), true);
  assert.equal(shouldPrioritizeWaveClear(90, 90, true, false, 0, 80), false);
});

test('wave clear spells require a cluster and ready resources; allied crash rewards pushing', () => {
  assert.equal(shouldCastWaveClearSkill('Mage', 80, 0, 3, 85, 85), true);
  assert.equal(shouldCastWaveClearSkill('Mage', 80, 0, 1, 85, 85), false);
  assert.equal(shouldCastWaveClearSkill('Mage', 20, 0, 3, 85, 85), false);
  assert.equal(getMinionCrashMultiplier([]), 0.28);
  assert.ok(getMinionCrashMultiplier([{ type: 'melee' }, { type: 'cannon' }]) > 1);
});
