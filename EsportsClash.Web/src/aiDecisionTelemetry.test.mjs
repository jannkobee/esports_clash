import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordAIDecision,
  settleExperimentOutcome,
  settlePendingAIDecisions,
  computeDecisionOutcomeReward,
  decisionOutcome,
} from './aiDecisionTelemetry.ts';

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

test('settlePendingAIDecisions settles on actor death even before regular horizon', () => {
  const start = record(10.0);
  const records = [start];
  const liveSnapshots = new Map([
    ['blue-card', { healthFraction: 0, gold: 50, cs: 0, kills: 0, deaths: 1, damageDealt: 120 }],
  ]);

  // At second 11.2, actor dies (only 1.2s elapsed)
  settlePendingAIDecisions(records, 11.2, liveSnapshots, { actorDied: 'blue-card' });
  assert.ok(start.outcome, 'outcome must settle when actor dies');
  assert.equal(start.outcome.deathGain, 1);
  assert.equal(start.outcome.horizonSeconds, 1.2);
  assert.ok(start.outcome.shapedReward < 0, 'death must receive negative reward');
});

test('settlePendingAIDecisions settles at 5-second simulation target without waiting for next decision', () => {
  const start = record(10.0);
  const records = [start];
  const liveSnapshots = new Map([
    ['blue-card', { healthFraction: 0.9, gold: 120, cs: 2, kills: 0, deaths: 0, damageDealt: 250 }],
  ]);

  // At second 13.0: only 3.0s elapsed (not target horizon yet)
  settlePendingAIDecisions(records, 13.0, liveSnapshots);
  assert.equal(start.outcome, undefined);

  // At second 15.0: 5.0s elapsed => settles!
  settlePendingAIDecisions(records, 15.0, liveSnapshots);
  assert.ok(start.outcome);
  assert.equal(start.outcome.horizonSeconds, 5.0);
  assert.equal(start.outcome.csGain, 2);
  assert.ok(start.outcome.shapedReward > 0);
});

test('computeDecisionOutcomeReward consolidates OpenAI Five death penalty and tactical bonuses', () => {
  // 1. Death penalty: -1.2 to -1.8, bounded and not teaching permanent cowardice
  const deathOutcome = {
    horizonSeconds: 5,
    healthChange: -1,
    goldGain: 0,
    csGain: 0,
    killGain: 0,
    deathGain: 1,
    damageGain: 50,
    progress: -0.6,
    wasGapped: true,
    wasOutnumbered: true,
  };
  const deathReward = computeDecisionOutcomeReward(deathOutcome, 'blue', 'red');
  assert.ok(deathReward <= -1.5 && deathReward >= -2.5, 'death reward is bounded around OpenAI Five scale');

  // 2. Peel, CC chain, and objective conversion
  const teamplayOutcome = {
    horizonSeconds: 5,
    healthChange: 0,
    goldGain: 150,
    csGain: 1,
    killGain: 1,
    deathGain: 0,
    damageGain: 300,
    progress: 0.8,
    peelOrRescue: true,
    effectiveCcChain: true,
    objectiveConversion: true,
  };
  const teamReward = computeDecisionOutcomeReward(teamplayOutcome, 'blue', 'blue');
  assert.ok(teamReward >= 2.0, 'reward reinforces objective conversion, peel and CC chaining');
});
