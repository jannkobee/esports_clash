import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskActionContext } from './taskActionContext.ts';
import { emptyTaskContextPolicy } from './taskContextPolicy.ts';
import { summarizeTeamTaskOutcome } from './teamTaskOutcome.ts';
import { confidenceTaskAdvantage, fitConfidenceTaskPolicy, loadConfidenceTaskPolicy } from './taskConfidencePolicy.ts';
import { chooseRewardGuidedMacro } from './rewardMacroDecision.ts';
import { parsePairedMacroTarget } from './pairedMacroReplay.ts';

const context = () => buildTaskActionContext({ features: { bias: 1, 'card:p_a': 1 },
  actor: { x: 600, y: 200 }, team: 'blue', seconds: 125, attackRange: 100,
  attackReady: true, basicDps: 80, travelSpeed: 85, ready1: true, ready2: false,
  readyUlt: false, customCaster: false, allies: [], visibleEnemies: [], alliedMinions: [],
  enemyMinions: [], enemyTowers: [], push: { kind: 'advance', target: { id: 'lane', x: 1000, y: 350 } },
  laneDestination: { x: 1000, y: 350 }, waveCrash: 0,
  influence: { approach: () => ({ threat: 0, cover: .3 }) } });
const model = (buffer = .2) => {
  const policy = emptyTaskContextPolicy('team-v1'); policy.weights.push['task:kind:advance'] = .3;
  return { kind: 'task-confidence', version: 1, policy,
    fittingSeeds: Array.from({ length: 16 }, (_, i) => i + 1),
    calibrationSeeds: Array.from({ length: 16 }, (_, i) => i + 17), supportedPushKinds: ['advance'],
    calibration: { method: 'split-one-sided-v1', level: .9, sampleSize: 16,
      quantileRank: 16, overpredictionErrors: Array(16).fill(buffer), errorBuffer: buffer } };
};
const experiment = () => ({ enabled: true, now: 125, lastAssignmentSecond: 0, healthFraction: 1,
  dangerousFight: false, insideEnemyTower: false, objectiveFight: false, defending: false,
  influenceThreat: 0, survival: 1, enemyDistance: Infinity, incumbent: 'farm',
  selectionReason: 'utility', randomDraw: -1, candidates: [
    { action: 'farm', available: true, priority: 'optional', contextKey: 'farm:a', factors: { strategic: .4 } },
    { action: 'push', available: true, priority: 'optional', contextKey: 'push:a', factors: { strategic: .2 } },
  ] });

test('uncertainty can veto a positive raw prediction; a cleared lower bound can reach only a gated legal action', () => {
  const choose = confidencePolicy => chooseRewardGuidedMacro({ confidencePolicy, taskContext: context(),
    experiment: experiment(), features: { bias: 1 } });
  const withheld = choose(model(.29));
  assert.equal(withheld.changed, false); assert.equal(withheld.reason, 'uncertain-task-advantage');
  assert.ok(withheld.predictedAdvantage > .02); assert.ok(withheld.lowerBoundAdvantage < .02);
  assert.equal(choose(model()).selected, 'push');
  for (const change of [{ enabled: false }, { healthFraction: .69 }, { dangerousFight: true },
    { insideEnemyTower: true }, { objectiveFight: true }, { defending: true }, { influenceThreat: .8 },
    { enemyDistance: 100 }, { selectionReason: 'commitment' }])
    assert.equal(chooseRewardGuidedMacro({ confidencePolicy: model(), taskContext: context(), features: { bias: 1 },
      experiment: { ...experiment(), ...change } }).changed, false);
  const unsupported = context(); unsupported.actions.push['task:kind:advance'] = 0;
  unsupported.actions.push['task:kind:structure'] = 1;
  assert.equal(confidenceTaskAdvantage(model(), unsupported, 'farm', 'push').reason, 'unsupported-task-context');
  assert.equal(confidenceTaskAdvantage(model(), context(), 'push', 'farm').reason, 'uncalibrated-direction');
});

test('one-sided finite-sample quantile and explicit model metadata cannot silently fall back to raw ranking', () => {
  const item = model(.7); item.calibration.overpredictionErrors = [...Array(15).fill(.01), .7];
  assert.ok(loadConfidenceTaskPolicy(item));
  for (const invalid of [
    { ...item, calibration: { ...item.calibration, errorBuffer: 0 } },
    { ...item, calibration: { ...item.calibration, quantileRank: 15 } },
    { ...item, fittingSeeds: [...item.calibrationSeeds] },
    { ...item, policy: emptyTaskContextPolicy() },
    { ...item, calibration: { ...item.calibration, level: .8 } },
    { ...item, calibration: { ...item.calibration, overpredictionErrors: [.7, ...Array(15).fill(.01)] } },
  ]) assert.equal(loadConfidenceTaskPolicy(invalid), undefined);
  const target = { actorId: 'blue_p_a', second: 125, incumbent: 'farm', alternate: 'push',
    fingerprint: '10:abc:def', arm: 'reward', horizonSeconds: 30, rewardConfidencePolicy: item };
  assert.ok(parsePairedMacroTarget(JSON.stringify(target)));
  assert.equal(parsePairedMacroTarget(JSON.stringify({ ...target, rewardTaskPolicy: item.policy })), undefined);
  assert.equal(parsePairedMacroTarget(JSON.stringify({ ...target, rewardConfidencePolicy: undefined,
    rewardPolicy: item.policy })), undefined);
});

const teamStart = { second: 120, ownDeaths: 0, enemyDeaths: 0, ownStructureHp: 10000,
  enemyStructureHp: 10000, ownEconomy: 10000, enemyEconomy: 10000, ownHealth: 5, enemyHealth: 5,
  dragonBalance: 0, siegeBalance: 0, ownNexusAlive: true, enemyNexusAlive: true };
const actorTask = { horizonSeconds: 30, campGold: 0, waveGold: 0, structureDamage: 0,
  deaths: 0, campClears: 0, minionKills: 0, firstCompletionSeconds: null, reward: 0 };
const example = (seed, split) => {
  const positive = seed % 4 < 2, taskContext = context(), cardId = `p_${seed % 2 ? 'a' : 'b'}`;
  for (const features of Object.values(taskContext.actions)) {
    delete features['card:p_a']; features[`card:${cardId}`] = 1;
    features['task:waveEnemies'] = Number(positive);
  }
  const end = { ...teamStart, second: 150 };
  return { seed, split, draft: seed % 2, cardId, validPair: true, incumbent: 'farm', alternate: 'push', taskContext,
    control: summarizeTeamTaskOutcome(teamStart, end, actorTask),
    alternative: summarizeTeamTaskOutcome(teamStart, { ...end,
      ownStructureHp: positive ? 10000 : 9400, enemyStructureHp: positive ? 9400 : 10000 }, actorTask) };
};

test('calibration never refits weights; held-out, overlapping and duplicate worlds cannot supply support', () => {
  const fitting = Array.from({ length: 16 }, (_, i) => example(i + 1, 'fit'));
  const calibration = Array.from({ length: 16 }, (_, i) => example(i + 17, 'calibration'));
  const original = fitConfidenceTaskPolicy([...fitting, ...calibration]);
  assert.ok(original.sufficient); assert.ok(original.policy);
  assert.equal(original.policy.calibration.quantileRank, 16);
  const adverse = calibration.map(item => ({ ...item, alternative: summarizeTeamTaskOutcome(teamStart,
    { ...teamStart, second: 150, ownDeaths: 1 }, actorTask) }));
  const changedLabels = fitConfidenceTaskPolicy([...fitting, ...adverse]);
  assert.deepEqual(changedLabels.policy.policy, original.policy.policy);
  assert.notEqual(changedLabels.policy.calibration.errorBuffer, original.policy.calibration.errorBuffer);
  assert.deepEqual(fitConfidenceTaskPolicy([...fitting, ...calibration, fitting[0], calibration[0],
    example(999, 'heldout')]), original);
  const heldoutLeak = fitConfidenceTaskPolicy([...fitting, ...calibration, example(1, 'heldout')]);
  assert.equal(heldoutLeak.sufficient, false); assert.equal(heldoutLeak.policy, undefined);
  assert.deepEqual(heldoutLeak.conflictingSeeds, [1]);
  assert.equal(fitConfidenceTaskPolicy([...fitting, ...calibration.slice(0, 15)]).sufficient, false);
});
