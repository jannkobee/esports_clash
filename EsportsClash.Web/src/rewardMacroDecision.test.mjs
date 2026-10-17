import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptivePolicy } from './adaptivePolicy.ts';
import { chooseRewardGuidedMacro } from './rewardMacroDecision.ts';
import { parsePairedMacroTarget } from './pairedMacroReplay.ts';
const context = () => ({ enabled: true, now: 120, lastAssignmentSecond: 0, healthFraction: 1,
  dangerousFight: false, insideEnemyTower: false, objectiveFight: false, defending: false,
  influenceThreat: 0, survival: 1, enemyDistance: Infinity, incumbent: 'farm',
  selectionReason: 'utility', randomDraw: -1, candidates: [
    { action: 'farm', available: true, priority: 'optional', contextKey: 'farm:a', factors: { strategic: .4 }, reason: 'legal' },
    { action: 'push', available: true, priority: 'optional', contextKey: 'push:a', factors: { strategic: .2 }, reason: 'legal' },
  ] });
const features = { bias: 1, 'card:p_a': 1 };
const policy = createAdaptivePolicy();
policy.weights.push['card:p_a'] = .2;

test('reward candidate can execute a different safe action using its card-aware prediction', () => {
  const result = chooseRewardGuidedMacro({ experiment: context(), policy, features });
  assert.equal(result.selected, 'push');
  assert.equal(result.changed, true);
  assert.equal(result.predictedAdvantage, .2);
  const otherCard = chooseRewardGuidedMacro({ experiment: context(), policy,
    features: { bias: 1, 'card:p_b': 1 } });
  assert.equal(otherCard.selected, 'farm');
  assert.equal(otherCard.reason, 'insufficient-task-advantage');
});

test('reward selection cannot bypass tower, survival, priority, commitment, legality or close-pair gates', () => {
  for (const change of [{ enabled: false }, { healthFraction: .69 }, { dangerousFight: true },
    { insideEnemyTower: true }, { objectiveFight: true }, { defending: true }, { influenceThreat: .8 },
    { enemyDistance: 100 }, { selectionReason: 'commitment' }])
    assert.equal(chooseRewardGuidedMacro({ experiment: { ...context(), ...change }, policy, features }).changed, false);
  const wide = context(); wide.candidates[1].factors.strategic = 0;
  assert.equal(chooseRewardGuidedMacro({ experiment: wide, policy, features }).reason, 'utility-gap');
  const illegal = context(); illegal.candidates[1].available = false;
  assert.equal(chooseRewardGuidedMacro({ experiment: illegal, policy, features }).changed, false);
  const priority = context(); priority.candidates.push({ action: 'fight', available: true,
    priority: 'emergency', contextKey: 'fight:a', factors: { tactical: 1 }, reason: 'emergency' });
  assert.equal(chooseRewardGuidedMacro({ experiment: priority, policy, features }).reason, 'priority-or-incumbent-mismatch');
  const fight = context(); fight.candidates[1].action = 'fight'; fight.survival = .54;
  assert.equal(chooseRewardGuidedMacro({ experiment: fight, policy, features }).reason, 'survival');
  fight.survival = 1;
  assert.equal(chooseRewardGuidedMacro({ experiment: fight, policy, features }).reason, 'unsupported-task-pair');
});

test('reward replay requires explicit model metadata and keeps the thirty-second bound', () => {
  const target = { actorId: 'blue_p_a', second: 120, incumbent: 'farm', alternate: 'push',
    fingerprint: '10:abc:def', arm: 'reward', horizonSeconds: 30 };
  assert.equal(parsePairedMacroTarget(JSON.stringify(target)), undefined);
  assert.ok(parsePairedMacroTarget(JSON.stringify({ ...target, rewardPolicy: policy })));
  assert.equal(parsePairedMacroTarget(JSON.stringify({ ...target, rewardPolicy: policy, horizonSeconds: 31 })), undefined);
});
