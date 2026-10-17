import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptivePolicy } from './adaptivePolicy.ts';
import { fitRandomizedMacroCandidate } from './randomizedMacroLearning.ts';

const record = (arm, progress, second) => ({ second, actorId: `actor-${second}`, team: 'blue',
  selected: arm === 'alternate' ? 'regroup' : 'fight', candidates: [],
  experiment: { pair: 'fight-regroup', incumbent: 'fight', alternate: 'regroup', arm,
    propensity: .5, utilityGap: .02 },
  outcome: progress === null ? undefined : { horizonSeconds: 4, progress, healthChange: 0,
    goldGain: 0, csGain: 0, killGain: 0, deathGain: 0, damageGain: 0 },
});

test('randomized fit uses arm contrast, preserves incumbent policy, and leaves sparse data untrained', () => {
  const start = createAdaptivePolicy();
  const sparse = fitRandomizedMacroCandidate(start, [record('incumbent', 0, 1), record('alternate', 1, 2)]);
  assert.equal(sparse.trainedGroups, 0);
  assert.deepEqual(sparse.policy, start);
  const records = [1, 2, 3, 4].map(second => record('incumbent', -.4, second))
    .concat([5, 6, 7, 8].map(second => record('alternate', .4, second)));
  const fit = fitRandomizedMacroCandidate(start, records);
  assert.equal(fit.assigned, 8);
  assert.equal(fit.validOutcomes, 8);
  assert.equal(fit.trainedGroups, 1);
  assert.ok(fit.groups[0].alternateMinusIncumbent > 0);
  assert.ok(fit.policy.weights.regroup.bias > 0);
  assert.ok(fit.policy.weights.fight.bias < 0);
  assert.deepEqual(start, createAdaptivePolicy());
});

test('missing or invalid outcomes do not receive reward credit', () => {
  const fit = fitRandomizedMacroCandidate(createAdaptivePolicy(), [
    record('incumbent', null, 1), record('alternate', .3, 2),
    { ...record('alternate', .8, 3), outcome: { horizonSeconds: 1, progress: .8 } },
  ]);
  assert.equal(fit.assigned, 3);
  assert.equal(fit.validOutcomes, 1);
  assert.equal(fit.trainedGroups, 0);
});
