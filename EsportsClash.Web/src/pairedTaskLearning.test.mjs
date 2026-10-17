import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptivePolicy, adaptivePolicyScore } from './adaptivePolicy.ts';
import { fitPairedTaskPolicy } from './pairedTaskLearning.ts';
const outcome = reward => ({ horizonSeconds: 30, reward, deaths: reward === -1 ? 1 : 0,
  campGold: 0, waveGold: reward > 0 ? reward * 250 / .6 : 0, structureDamage: 0,
  campClears: 0, minionKills: 0, firstCompletionSeconds: reward > 0 ? 12 : null });
const example = (seed, overrides = {}) => ({ id: `s${seed}`, seed, draft: seed % 2,
  cardId: `p_${seed % 2}`, split: 'train', validPair: true, incumbent: 'farm', alternate: 'push',
  features: { bias: 1, [`card:p_${seed % 2}`]: 1 }, control: outcome(0), alternative: outcome(.4), ...overrides });

test('paired task learner fits actual contrasts with bounded card-aware weights and no held-out leakage', () => {
  const base = createAdaptivePolicy();
  const records = [1, 2, 3, 4].map(seed => example(seed));
  const fit = fitPairedTaskPolicy(base, records);
  assert.equal(fit.sufficient, true);
  assert.equal(fit.changed, true);
  assert.ok(fit.fittedLoss < fit.initialLoss);
  assert.ok(adaptivePolicyScore(fit.policy, 'push', records[0].features)
    > adaptivePolicyScore(fit.policy, 'farm', records[0].features));
  for (const weights of Object.values(fit.policy.weights)) for (const weight of Object.values(weights))
    assert.ok(Math.abs(weight) <= .08 + 1e-10);
  const withHeldout = fitPairedTaskPolicy(base, [...records,
    example(90, { split: 'heldout', control: outcome(.6), alternative: outcome(-1) })]);
  assert.deepEqual(withHeldout.policy, fit.policy);
  const leakedWorld = fitPairedTaskPolicy(base, [...records, example(1, { split: 'heldout' })]);
  assert.equal(leakedWorld.trainingEpisodes, 3);
  assert.equal(leakedWorld.sufficient, false);
  assert.deepEqual(base, createAdaptivePolicy());
});

test('invalid controls, repeat worlds and empty reward contrasts cannot manufacture training support', () => {
  const records = [example(1), example(1), example(2), example(3, { validPair: false }),
    example(4, { alternative: { ...outcome(1), horizonSeconds: 8 } })];
  const fit = fitPairedTaskPolicy(createAdaptivePolicy(), records);
  assert.equal(fit.trainingEpisodes, 2);
  assert.equal(fit.sufficient, false);
  assert.equal(fit.changed, false);
  assert.equal(fitPairedTaskPolicy(createAdaptivePolicy(), [1, 2, 3, 4].map(seed =>
    example(seed, { alternative: outcome(0) }))).changed, false);
});
