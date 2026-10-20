import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveFeatures, adaptivePolicyScore, adaptivePreferenceAllowed, createAdaptivePolicy, loadAdaptivePolicy, trainAdaptivePolicy } from './adaptivePolicy.ts';
import { decisionOutcome, recordAIDecision } from './aiDecisionTelemetry.ts';
import { chooseMacroAction } from './macroActionDecision.ts';
import { summarizeDecisionCalibration } from './decisionCalibration.ts';

const card = (id, stats = { iq: 90, tf: 80, lan: 70, flx: 60 }) => ({
  id, stats, preferredRole: 'Mage', playableRoles: ['Mage'], primaryPersonality: 'wave_architect',
});
const mage = { primaryRole: 'Mage' };
const choice = (actorId, team, selected, features, second = 1) => ({
  second, actorId, team, selected, features, contextKey: 'lane', candidates: [
    { key: 'fight', available: true, priority: 'tactical', reason: '' },
    { key: 'wave', available: true, priority: 'tactical', reason: '' },
    { key: 'push', available: true, priority: 'optional', reason: '' },
  ],
});

test('completed matches learn bounded preferences specific to card and match context', () => {
  const a = adaptiveFeatures(card('a'), mage, .9, .8);
  const b = adaptiveFeatures(card('b'), mage, .9, .8);
  const trained = trainAdaptivePolicy(createAdaptivePolicy(), [choice('a', 'blue', 'fight', a)], 'blue');
  assert.ok(adaptivePolicyScore(trained, 'fight', a) > adaptivePolicyScore(trained, 'fight', b));
  assert.ok(adaptivePolicyScore(trained, 'fight', a) > adaptivePolicyScore(trained, 'wave', a));
  assert.equal(trained.weights.push.bias, undefined, 'lower-priority actions are not contrastive alternatives');
  assert.equal(adaptiveFeatures(card('a'), mage, .2, .1).health, .2);
  assert.equal(adaptiveFeatures(card('a'), { primaryRole: 'Tank' }, .9, .8).roleFit, 0);
});

test('repeated ticks do not multiply outcome credit and non-choice decisions do not train', () => {
  const features = adaptiveFeatures(card('a'), mage, 1, 1);
  const single = trainAdaptivePolicy(createAdaptivePolicy(), [choice('a', 'blue', 'fight', features)], 'blue');
  const repeated = trainAdaptivePolicy(createAdaptivePolicy(), Array.from({ length: 200 }, (_, i) =>
    choice('a', 'blue', 'fight', features, i)), 'blue');
  assert.ok(Math.abs(adaptivePolicyScore(single, 'fight', features) - adaptivePolicyScore(repeated, 'fight', features)) < 1e-10);
  const noChoice = choice('a', 'blue', 'fight', features);
  noChoice.candidates[1].available = false;
  assert.deepEqual(trainAdaptivePolicy(createAdaptivePolicy(), [noChoice], 'blue').weights, createAdaptivePolicy().weights);
  const losing = trainAdaptivePolicy(createAdaptivePolicy(), [choice('a', 'red', 'fight', features)], 'blue');
  assert.ok(adaptivePolicyScore(losing, 'fight', features) < 0);
});

test('storage migration and corrupt values cannot produce nonfinite scores', () => {
  const old = loadAdaptivePolicy({ version: 1, matches: 3, weights: { fight: .3, wave: Infinity } });
  assert.equal(adaptivePolicyScore(old, 'fight', { bias: 1 }), .3);
  assert.equal(adaptivePolicyScore(old, 'wave', { bias: 1 }), 0);
  const bad = loadAdaptivePolicy({ version: 2, matches: Infinity, weights: { fight: { iq: NaN, bias: 100 } } });
  assert.equal(adaptivePolicyScore(bad, 'fight', { bias: 1, iq: 1 }), 1);
  assert.equal(bad.matches, 0);
});

test('telemetry samples stable decisions but records changed choices immediately', () => {
  const records = [];
  const features = adaptiveFeatures(card('a'), mage, 1, 1);
  recordAIDecision(records, choice('a', 'blue', 'fight', features, 1));
  recordAIDecision(records, choice('a', 'blue', 'fight', features, 1.1));
  recordAIDecision(records, choice('a', 'blue', 'wave', features, 1.2));
  recordAIDecision(records, choice('a', 'blue', 'wave', features, 3.3));
  assert.equal(records.length, 3);
});

test('same-state zero-policy comparison detects only a legal learned selection change', () => {
  const policy = createAdaptivePolicy();
  policy.weights.wave.bias = 1;
  const features = { bias: 1 };
  const candidates = [
    { action: 'fight', available: true, priority: 'tactical', contextKey: 'enemy', factors: { tactical: .5 }, reason: '' },
    { action: 'wave', available: true, priority: 'tactical', contextKey: 'minion',
      factors: { tactical: .5, learned: adaptivePolicyScore(policy, 'wave', features) }, reason: '' },
  ];
  const actual = chooseMacroAction({ actorAvailable: true, now: 1, candidates }).selected?.value;
  const zero = chooseMacroAction({ actorAvailable: true, now: 1,
    candidates: candidates.map(candidate => ({ ...candidate, factors: { ...candidate.factors, learned: 0 } })) }).selected?.value;
  assert.equal(actual, 'wave');
  assert.equal(zero, 'fight');
  assert.equal(chooseMacroAction({ actorAvailable: true, now: 1,
    candidates: candidates.map(candidate => candidate.action === 'wave' ? { ...candidate, available: false } : candidate) }).selected?.value, 'fight');
});

test('short-horizon outcome attaches to the prior choice and excludes invalid comparisons', () => {
  const features = { bias: 1 };
  const first = { ...choice('a', 'blue', 'fight', features, 1), snapshot: {
    healthFraction: .9, gold: 100, cs: 0, kills: 0, deaths: 0, damageDealt: 0 } };
  const second = { ...choice('a', 'blue', 'fight', features, 3.1), snapshot: {
    healthFraction: .8, gold: 150, cs: 1, kills: 0, deaths: 0, damageDealt: 180 } };
  const records = [];
  recordAIDecision(records, first);
  recordAIDecision(records, second);
  assert.ok(records[0].outcome.progress > 0);
  assert.equal(records[0].outcome.horizonSeconds, 2.1);
  assert.equal(decisionOutcome(first, { ...second, actorId: 'b' }), undefined);
  assert.equal(decisionOutcome(first, { ...second, second: 9 }), undefined);
  const death = decisionOutcome(first, { ...second, snapshot: { ...second.snapshot, deaths: 1, healthFraction: 1 } });
  assert.ok(death.progress < 0, 'respawned health must not hide the death');
  records[0].zeroPolicySelected = 'wave';
  const calibration = summarizeDecisionCalibration(records);
  assert.equal(calibration.counterfactualChanged, 1);
  assert.equal(calibration.localOutcomeSamples.fight, 1);
});

test('rapid follow-up is not misread as an outcome; learning cannot tip a survival-window choice', () => {
  const features = { bias: 1 };
  const snapshot = { healthFraction: .6, gold: 100, cs: 0, kills: 0, deaths: 0, damageDealt: 0 };
  const records = [];
  const first = { ...choice('a', 'blue', 'fight', features, 1), snapshot };
  recordAIDecision(records, first);
  recordAIDecision(records, { ...choice('a', 'blue', 'regroup', features, 1.1), snapshot });
  assert.equal(records[0].outcome, undefined);
  recordAIDecision(records, { ...choice('a', 'blue', 'fight', features, 3.2),
    snapshot: { ...snapshot, damageDealt: 100 } });
  assert.ok(records[0].outcome.horizonSeconds >= 2);
  assert.ok(records[1].outcome.horizonSeconds >= 2);
  assert.equal(adaptivePreferenceAllowed(.106, false), false);
  assert.equal(adaptivePreferenceAllowed(.52, true), false);
  assert.equal(adaptivePreferenceAllowed(.52, false), true);
  const policy = createAdaptivePolicy();
  policy.weights.fight.bias = 1;
  const candidates = health => [
    { action: 'regroup', available: true, priority: 'tactical', contextKey: 'ally',
      factors: { tactical: .51 }, reason: '' },
    { action: 'fight', available: true, priority: 'tactical', contextKey: 'enemy',
      factors: { tactical: .5, learned: adaptivePreferenceAllowed(health, false)
        ? adaptivePolicyScore(policy, 'fight', features) : 0 }, reason: '' },
  ];
  assert.equal(chooseMacroAction({ actorAvailable: true, now: 1, candidates: candidates(.106) }).selected?.value, 'regroup');
  assert.equal(chooseMacroAction({ actorAvailable: true, now: 1, candidates: candidates(.52) }).selected?.value, 'fight');
});

test('adaptiveFeatures extracts relative gapped features and card discipline memory', () => {
  const cardObj = card('player-1', { iq: 85, tf: 75, lan: 70, flx: 65 });
  const memory = {
    cardId: 'player-1',
    matchesPlayed: 3,
    lessons: { gappedDiscipline: 0.6, numericalDiscipline: 0.8, survivalPatience: 0.5 },
    comboMasteries: {
      Solana: { executions: 12, hitRate: 0.8, lethalFinishes: 4, masteryLevel: 1 },
    },
  };
  const featuresGapped = adaptiveFeatures(cardObj, { name: 'Solana', primaryRole: 'Mage' }, 0.4, 0.8, {
    goldGap: -1600,
    levelGap: -2,
    outnumbered: true,
    isFeeding: true,
    cardMemory: memory,
  });

  assert.equal(featuresGapped.goldGap, -0.8);
  assert.equal(featuresGapped.levelGap, -2 / 3);
  assert.equal(featuresGapped.outnumbered, 1);
  assert.equal(featuresGapped.isFeeding, 1);
  assert.equal(featuresGapped['cardMemory:gappedDiscipline'], 0.6);
  assert.equal(featuresGapped['cardMemory:numericalDiscipline'], 0.8);
  assert.equal(featuresGapped['cardMemory:survivalPatience'], 0.5);
  assert.equal(featuresGapped['cardMemory:comboMastery'], 0.2); // 1 / 5

  // When ahead in gold and not outnumbered, discipline features remain inactive
  const featuresAhead = adaptiveFeatures(cardObj, { name: 'Solana', primaryRole: 'Mage' }, 0.9, 0.8, {
    goldGap: 1000,
    levelGap: 1,
    outnumbered: false,
    cardMemory: memory,
  });
  assert.equal(featuresAhead['cardMemory:gappedDiscipline'], undefined);
  assert.equal(featuresAhead['cardMemory:numericalDiscipline'], undefined);
  assert.equal(featuresAhead['cardMemory:survivalPatience'], undefined);
});

test('asymmetric death penalty punishes suicidal decisions even if team wins the match', () => {
  const cardObj = card('diver', { iq: 70, tf: 70, lan: 70, flx: 70 });
  const features = adaptiveFeatures(cardObj, mage, 0.5, 0.5);
  const decision = {
    ...choice('diver', 'blue', 'fight', features, 1),
    outcome: {
      horizonSeconds: 3,
      healthChange: -0.5,
      goldGain: 0,
      csGain: 0,
      killGain: 0,
      deathGain: 1, // Died!
      damageGain: 50,
      progress: -0.7,
      wasGapped: true,
      wasOutnumbered: true,
    },
  };

  // Team won ('blue'), but this actor died while gapped & outnumbered
  const trained = trainAdaptivePolicy(createAdaptivePolicy(), [decision], 'blue');
  // fight score should decrease sharply
  assert.ok(adaptivePolicyScore(trained, 'fight', features) < 0, 'decision leading to death must be penalized despite team win');
  // wave score (alternative) should increase
  assert.ok(adaptivePolicyScore(trained, 'wave', features) > 0, 'alternative action receives positive contrastive credit');
});

test('combo executions provide dense reward spikes and strengthen fight confidence', () => {
  const cardObj = card('combo-master', { iq: 90, tf: 90, lan: 80, flx: 80 });
  const features = adaptiveFeatures(cardObj, mage, 0.8, 0.8);
  const comboDecision = {
    ...choice('combo-master', 'blue', 'fight', features, 1),
    outcome: {
      horizonSeconds: 3,
      healthChange: 0,
      goldGain: 300,
      csGain: 0,
      killGain: 1,
      deathGain: 0,
      damageGain: 450,
      progress: 0.8,
      comboExecuted: true,
      comboLethal: true,
      shapedReward: 4.0,
    },
  };

  const trained = trainAdaptivePolicy(createAdaptivePolicy(), [comboDecision], 'blue');
  assert.ok(adaptivePolicyScore(trained, 'fight', features) > 0.05, 'lethal combo provides substantial positive reward');
});

