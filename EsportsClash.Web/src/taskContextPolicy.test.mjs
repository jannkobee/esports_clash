import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskActionContext, validTaskActionContext } from './taskActionContext.ts';
import { emptyTaskContextPolicy, fitTaskContextPolicy, fitTeamTaskContextPolicy, loadTaskContextPolicy, taskContextScore } from './taskContextPolicy.ts';
import { summarizeTeamTaskOutcome } from './teamTaskOutcome.ts';
import { chooseRewardGuidedMacro } from './rewardMacroDecision.ts';
import { parsePairedMacroTarget } from './pairedMacroReplay.ts';

const observations = (overrides = {}) => ({ features: { bias: 1, health: 1, 'card:p_a': 1 },
  actor: { x: 600, y: 200 }, team: 'blue', seconds: 125, attackRange: 100,
  attackReady: true, basicDps: 80, travelSpeed: 85, ready1: true, ready2: false,
  readyUlt: false, customCaster: false, allies: [], visibleEnemies: [],
  alliedMinions: [], enemyMinions: [], enemyTowers: [],
  camp: { x: 640, y: 145, hp: 1000, maxHp: 1500, goldReward: 100, ad: 50,
    observed: true, contributors: 1, engaged: true, leashFraction: .2 },
  push: { kind: 'advance', target: { id: 'lane', x: 1100, y: 350 } },
  laneDestination: { x: 1100, y: 350 }, waveCrash: 0,
  influence: { approach: () => ({ threat: .1, cover: .3 }) }, ...overrides });
const outcome = reward => ({ horizonSeconds: 30, reward, deaths: 0, campGold: 0,
  waveGold: 0, structureDamage: 0, campClears: 0, minionKills: 0, firstCompletionSeconds: null });

test('task observations distinguish the same card by camp, route, wave, ready casts and tower exposure', () => {
  const input = observations(), before = structuredClone({ ...input, influence: undefined });
  const context = buildTaskActionContext(input);
  const other = buildTaskActionContext(observations({ campWaypoint: { x: 400, y: 400 },
    ready1: false, readyUlt: true, enemyMinions: [{ x: 1000, y: 350 }],
    enemyTowers: [{ x: 1100, y: 350, range: 250 }],
    push: { kind: 'camp-exit', target: { id: 'exit', x: 1000, y: 350 } } }));
  assert.ok(validTaskActionContext(context)); assert.ok(validTaskActionContext(other));
  assert.deepEqual({ ...input, influence: undefined }, before);
  assert.ok(other.actions.farm['task:travel'] > context.actions.farm['task:travel']);
  assert.equal(other.actions.push['task:kind:camp-exit'], 1);
  assert.equal(other.actions.push['task:towerExposure'], 1);
  assert.equal(other.actions.push['task:waveEnemies'], .1);
  assert.equal(other.actions.push['task:ready1'], 0);
  assert.equal(other.actions.push['task:readyUlt'], 1);
  assert.equal(other.actions.push['card:p_a'], context.actions.push['card:p_a']);
  assert.equal(validTaskActionContext({ ...context, version: 2 }), false);
  assert.equal(validTaskActionContext({ version: 1, actions: { farm: { bias: 1 }, push: { bias: 1 } } }), false);
});

test('unseen camp health, leash and aggression do not leak through task inputs', () => {
  const a = observations(); a.camp.observed = false; a.camp.home = { x: 640, y: 145 };
  const b = structuredClone({ ...a, influence: undefined }); b.influence = a.influence;
  Object.assign(b.camp, { x: 750, y: 250, hp: 1, ad: 900, engaged: false, contributors: 5, leashFraction: 1 });
  assert.deepEqual(buildTaskActionContext(a), buildTaskActionContext(b));
});

const example = (seed, split = 'train') => {
  const context = buildTaskActionContext(observations({
    features: { bias: 1, [`card:p_${seed % 2 ? 'a' : 'b'}`]: 1 } }));
  const positive = seed % 4 < 2;
  context.actions.push['task:waveEnemies'] = positive ? 1 : 0;
  return { seed, draft: seed % 2, cardId: seed % 2 ? 'p_a' : 'p_b', split,
    validPair: true, incumbent: 'farm', alternate: 'push', taskContext: context,
    control: outcome(positive ? 0 : .4), alternative: outcome(positive ? .4 : 0) };
};
test('context fit learns opposite task values for the same card without held-out or duplicate worlds', () => {
  const examples = Array.from({ length: 16 }, (_, i) => example(i + 1));
  const fit = fitTaskContextPolicy(examples);
  assert.equal(fit.sufficient, true); assert.ok(fit.fittedLoss < fit.zeroLoss / 4);
  const positive = example(1).taskContext, negative = example(3).taskContext;
  const delta = context => taskContextScore(fit.policy, 'push', context) - taskContextScore(fit.policy, 'farm', context);
  assert.ok(delta(positive) > .1); assert.ok(delta(negative) < -.1);
  assert.deepEqual(fitTaskContextPolicy([...examples, example(99, 'heldout'), examples[0]]), fit);
  assert.equal(fitTaskContextPolicy([...examples, example(1, 'heldout')]).sufficient, false);
  assert.equal(fitTaskContextPolicy(examples.map(item => ({ ...item, validPair: false }))).trainingEpisodes, 0);
  assert.ok(loadTaskContextPolicy(fit.policy));
  assert.equal(loadTaskContextPolicy({ ...fit.policy, version: 2 }), undefined);
  assert.equal(loadTaskContextPolicy({ ...fit.policy, weights: { farm: { 'task:futureReward': 1 }, push: {} } }), undefined);
});

test('task policy requires explicit replay metadata and retains every experimental safety gate', () => {
  const taskPolicy = emptyTaskContextPolicy(); taskPolicy.weights.push['task:kind:advance'] = .3;
  const taskContext = buildTaskActionContext(observations());
  const experiment = { enabled: true, now: 125, lastAssignmentSecond: 0, healthFraction: 1,
    dangerousFight: false, insideEnemyTower: false, objectiveFight: false, defending: false,
    influenceThreat: 0, survival: 1, enemyDistance: Infinity, incumbent: 'farm',
    selectionReason: 'utility', randomDraw: -1, candidates: [
      { action: 'farm', available: true, priority: 'optional', contextKey: 'farm:a', factors: { strategic: .4 } },
      { action: 'push', available: true, priority: 'optional', contextKey: 'push:a', factors: { strategic: .2 } },
    ] };
  const input = { taskPolicy, taskContext, features: { bias: 1 }, experiment };
  assert.equal(chooseRewardGuidedMacro(input).selected, 'push');
  assert.equal(chooseRewardGuidedMacro({ ...input, taskContext: undefined }).changed, false);
  for (const change of [{ enabled: false }, { healthFraction: .69 }, { dangerousFight: true },
    { insideEnemyTower: true }, { objectiveFight: true }, { defending: true }, { influenceThreat: .8 },
    { enemyDistance: 100 }, { selectionReason: 'commitment' }])
    assert.equal(chooseRewardGuidedMacro({ ...input, experiment: { ...experiment, ...change } }).changed, false);
  const target = { actorId: 'blue_p_a', second: 125, incumbent: 'farm', alternate: 'push',
    fingerprint: '10:abc:def', arm: 'reward', horizonSeconds: 30, rewardTaskPolicy: taskPolicy };
  assert.ok(parsePairedMacroTarget(JSON.stringify(target)));
  assert.equal(parsePairedMacroTarget(JSON.stringify({ ...target, rewardPolicy: { version: 2 } })), undefined);
});

test('team policy learns opposite team outcomes with identical actor credit and keeps its objective versioned', () => {
  const start = { second: 120, ownDeaths: 0, enemyDeaths: 0, ownStructureHp: 10000,
    enemyStructureHp: 10000, ownEconomy: 10000, enemyEconomy: 10000, ownHealth: 5, enemyHealth: 5,
    dragonBalance: 0, siegeBalance: 0, ownNexusAlive: true, enemyNexusAlive: true };
  const end = { ...start, second: 150 };
  const records = Array.from({ length: 16 }, (_, i) => {
    const item = example(i + 1), positive = (i + 1) % 4 < 2;
    return { ...item, control: summarizeTeamTaskOutcome(start, end, outcome(0)),
      alternative: summarizeTeamTaskOutcome(start, { ...end,
        ownStructureHp: positive ? 10000 : 9400, enemyStructureHp: positive ? 9400 : 10000 }, outcome(0)) };
  });
  const fit = fitTeamTaskContextPolicy(records);
  assert.ok(fit.sufficient); assert.equal(fit.policy.version, 2); assert.equal(fit.policy.objective, 'team-v1');
  assert.ok(fit.fittedLoss < fit.zeroLoss / 4);
  assert.ok(loadTaskContextPolicy(fit.policy));
  assert.equal(loadTaskContextPolicy({ ...fit.policy, version: 1 }), undefined);
  assert.equal(loadTaskContextPolicy({ ...fit.policy, objective: 'actor-v1' }), undefined);
  assert.equal(parsePairedMacroTarget(JSON.stringify({ actorId: 'blue_p_a', second: 125,
    incumbent: 'farm', alternate: 'push', fingerprint: '10:abc:def', arm: 'reward',
    horizonSeconds: 30, rewardTaskPolicy: fit.policy })).rewardTaskPolicy.objective, 'team-v1');
  assert.deepEqual(fitTeamTaskContextPolicy([...records, { ...records[0], seed: 999, split: 'heldout' }]), fit);
  const forged = records.map(item => ({ ...item, alternative: { ...item.alternative, reward: 1 } }));
  assert.equal(fitTeamTaskContextPolicy(forged).trainingEpisodes, 0);
});
