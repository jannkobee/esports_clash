import test from 'node:test';
import assert from 'node:assert/strict';
import { assignSafeMacroExperiment, createExperimentRandom, inspectSafeMacroExperiment, safeMacroExperimentGate } from './safeMacroExperiment.ts';

test('evaluation assignment RNG is repeatable for a seed and separate from match RNG', () => {
  const first = createExperimentRandom(81);
  const second = createExperimentRandom(81);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

const candidates = [
  { action: 'fight', available: true, priority: 'tactical', contextKey: 'enemy', factors: { tactical: .6 }, reason: '' },
  { action: 'regroup', available: true, priority: 'tactical', contextKey: 'ally', factors: { tactical: .58 }, reason: '' },
];
const safe = { enabled: true, now: 10, lastAssignmentSecond: 0, healthFraction: .9,
  dangerousFight: false, insideEnemyTower: false, objectiveFight: false, defending: false,
  influenceThreat: .1, survival: .9, enemyDistance: 400,
  incumbent: 'fight', selectionReason: 'utility', candidates };

test('gate diagnostics retain simultaneous rejections and preserve the first authoritative gate', () => {
  const input = { ...safe, healthFraction: .5, dangerousFight: true, insideEnemyTower: true,
    survival: .1, selectionReason: 'commitment', randomDraw: .8 };
  const result = inspectSafeMacroExperiment(input);
  assert.deepEqual(result.gates, ['health', 'danger', 'tower', 'commitment', 'survival']);
  assert.equal(safeMacroExperimentGate(input), 'health');
  assert.equal(assignSafeMacroExperiment(input), undefined);
});

test('a safe wide-gap alternative remains diagnostic only and cannot be assigned', () => {
  const input = { ...safe, candidates: [candidates[0], { ...candidates[1], factors: { tactical: 0 } }], randomDraw: .8 };
  const result = inspectSafeMacroExperiment(input);
  assert.deepEqual(result.gates, ['utility-gap']);
  assert.ok(result.pair.utilityGap > .1);
  assert.equal(assignSafeMacroExperiment(input), undefined);
});

test('evaluation assignment balances close legal actions with recorded propensity', () => {
  const assigned = assignSafeMacroExperiment({ ...safe, randomDraw: .2 });
  assert.equal(assigned?.selected, 'fight');
  assert.equal(assigned?.arm, 'incumbent');
  assert.equal(assigned?.pair, 'fight-regroup');
  assert.equal(assigned?.propensity, .5);
  assert.ok(Math.abs(assigned.utilityGap - .005) < 1e-10);
  assert.equal(assignSafeMacroExperiment({ ...safe, randomDraw: .8 })?.selected, 'regroup');
});

test('evaluation assignment cannot override survival, tower, objective, legality, priority, or commitment', () => {
  for (const patch of [{ enabled: false }, { healthFraction: .69 }, { healthFraction: NaN }, { dangerousFight: true },
    { insideEnemyTower: true }, { objectiveFight: true }, { defending: true },
    { influenceThreat: .8 }, { influenceThreat: NaN }, { survival: .54 }, { survival: NaN },
    { selectionReason: 'commitment' },
    { lastAssignmentSecond: 7 },
    { candidates: [{ ...candidates[0], available: false }, candidates[1]] },
    { candidates: [candidates[0], { ...candidates[1], priority: 'optional' }] },
    { candidates: [candidates[0], { ...candidates[1], factors: { tactical: 0 } }] }])
    assert.equal(assignSafeMacroExperiment({ ...safe, ...patch, randomDraw: .8 }), undefined);
});

test('quiet farm/push assignment requires both optional actions and distant enemies', () => {
  const quiet = { ...safe, incumbent: 'farm', candidates: [
    { action: 'farm', available: true, priority: 'optional', contextKey: 'camp', factors: { tactical: .4 }, reason: '' },
    { action: 'push', available: true, priority: 'optional', contextKey: 'lane', factors: { tactical: .38 }, reason: '' },
  ] };
  const assigned = assignSafeMacroExperiment({ ...quiet, randomDraw: .8 });
  assert.equal(assigned?.selected, 'push');
  assert.equal(assigned?.pair, 'farm-push');
  assert.equal(assignSafeMacroExperiment({ ...quiet, enemyDistance: 179, randomDraw: .8 }), undefined);
  assert.equal(assignSafeMacroExperiment({ ...quiet, enemyDistance: NaN, randomDraw: .8 }), undefined);
});
