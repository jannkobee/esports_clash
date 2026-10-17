import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptivePolicy, adaptivePolicyScore } from './adaptivePolicy.ts';
import { fitOfflineOutcomePolicy } from './offlineOutcomePolicy.ts';

const record = (selected, progress, second, actorId = 'actor', suppressed = false) => ({
  actorId, second, selected, team: 'blue', features: { bias: 1, 'card:sample': 1 },
  snapshot: { healthFraction: .8, gold: 0, cs: 0, kills: 0, deaths: 0, damageDealt: 0 },
  outcome: { progress, horizonSeconds: 4, healthChange: 0, goldGain: 0, csGain: 0,
    killGain: 0, deathGain: 0, damageGain: 0 },
  learnedSuppressedReason: suppressed ? 'dangerous-fight' : undefined,
  candidates: ['fight', 'regroup'].map(key => ({ key, available: true, priority: 'tactical', reason: '' })),
});

test('offline fit requires observed action contrast in the same safe actor/legal/health stratum', () => {
  const start = createAdaptivePolicy();
  const data = [0, 5, 10, 15].map(second => record('fight', .8, second))
    .concat([20, 25, 30, 35].map(second => record('regroup', -.4, second)));
  const fit = fitOfflineOutcomePolicy(start, data);
  assert.equal(fit.comparableGroups, 1);
  assert.equal(fit.comparedSamples, 8);
  assert.ok(adaptivePolicyScore(fit.policy, 'fight', { bias: 1, 'card:sample': 1 }) > 0);
  assert.ok(adaptivePolicyScore(fit.policy, 'regroup', { bias: 1, 'card:sample': 1 }) < 0);
  assert.deepEqual(start, createAdaptivePolicy(), 'fitting cannot mutate the live incumbent');
});

test('overlapping windows, suppression, and noncomparable actors cannot manufacture a trained contrast', () => {
  const start = createAdaptivePolicy();
  const data = [record('fight', 1, 0), record('fight', 1, 1), record('fight', 1, 2),
    record('regroup', -1, 5, 'other'), record('regroup', -1, 10, 'other'),
    record('regroup', -1, 15, 'other'), record('regroup', -1, 20, 'actor', true)];
  const fit = fitOfflineOutcomePolicy(start, data);
  assert.equal(fit.comparableGroups, 0);
  assert.equal(fit.independent, 4);
  assert.deepEqual(fit.policy, start);
});
