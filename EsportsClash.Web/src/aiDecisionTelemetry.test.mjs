import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAIDecision, settleExperimentOutcome } from './aiDecisionTelemetry.ts';

const record = second => ({ second, actorId: 'blue-card', team: 'blue', selected: 'fight',
  contextKey: 'same', candidates: [{ key: 'fight', available: true, reason: 'legal' }],
  snapshot: { healthFraction: 1, gold: 0, cs: 0, kills: 0, deaths: 0, damageDealt: second * 10 } });

test('randomized assignment gets a three-second outcome even without a new sampled decision', () => {
  const start = { ...record(1), experiment: { incumbent: 'fight', alternate: 'regroup',
    pair: 'fight-regroup', arm: 'incumbent', propensity: .5, utilityGap: .01 } };
  const history = [];
  recordAIDecision(history, start);
  settleExperimentOutcome(history, record(2.5));
  assert.equal(start.outcome, undefined);
  settleExperimentOutcome(history, record(4));
  assert.equal(start.outcome.horizonSeconds, 3);
  assert.equal(start.outcome.damageGain, 30);
  settleExperimentOutcome(history, record(5));
  assert.equal(start.outcome.horizonSeconds, 3);
});
