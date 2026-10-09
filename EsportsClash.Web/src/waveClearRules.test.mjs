import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPrioritizeWaveClear, shouldCastWaveClearSkill, getMinionCrashMultiplier } from './waveClearRules.ts';

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
