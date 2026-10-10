import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNearbyFightingAlly, shouldKeepRecallPlan } from './actionDecisionRules.ts';

const recovery = {
  healthFraction: 0.9, manaFraction: 0.8, manaDependent: false,
  lowHealth: false, dangerousFight: false, shopping: false, objectiveReset: false,
  previousIntent: false, inWell: false, followUp: false, combatCommit: false,
  pushWindow: false, objectiveCall: false,
};

test('recovery continues across retreat thresholds and releases after healing or reaching home', () => {
  let state = { ...recovery, healthFraction: 0.28, lowHealth: true };
  assert.equal(shouldKeepRecallPlan(state), true);
  state = { ...state, previousIntent: true, healthFraction: 0.36, lowHealth: false };
  assert.equal(shouldKeepRecallPlan(state), true, 'losing sight of enemies or crossing low HP must not turn the unit around');
  assert.equal(shouldKeepRecallPlan({ ...state, healthFraction: 0.6 }), false);
  assert.equal(shouldKeepRecallPlan({ ...state, inWell: true }), false);
});

test('mana-dependent avatars reset at low mana and keep the plan through small regeneration ticks', () => {
  const drained = { ...recovery, manaDependent: true, manaFraction: 0.19 };
  assert.equal(shouldKeepRecallPlan(drained), true);
  assert.equal(shouldKeepRecallPlan({ ...drained, previousIntent: true, manaFraction: 0.3 }), true);
  assert.equal(shouldKeepRecallPlan({ ...drained, previousIntent: true, manaFraction: 0.5 }), false);
  assert.equal(shouldKeepRecallPlan({ ...drained, manaDependent: false }), false);
});

test('safe fight follow-up and conversions beat optional recalls; danger still forces recovery', () => {
  assert.equal(shouldKeepRecallPlan({ ...recovery, shopping: true }), true);
  assert.equal(shouldKeepRecallPlan({ ...recovery, objectiveReset: true }), true);
  for (const priority of ['pushWindow', 'objectiveCall', 'followUp', 'combatCommit']) {
    assert.equal(shouldKeepRecallPlan({ ...recovery, shopping: true, [priority]: true }), false);
  }
  for (const opportunity of ['pushWindow', 'objectiveCall']) {
    assert.equal(shouldKeepRecallPlan({ ...recovery, dangerousFight: true, [opportunity]: true }), true);
    assert.equal(shouldKeepRecallPlan({ ...recovery, lowHealth: true, [opportunity]: true }), true);
  }
  assert.equal(shouldKeepRecallPlan({ ...recovery, previousIntent: true, lowHealth: true, followUp: true }), false);
});

const actor = { id: 'self', isAlive: true, x: 500, y: 380, animState: 'attack' };
const ally = { id: 'ally', isAlive: true, x: 800, y: 380, animState: 'attack' };
const enemy = { id: 'enemy', isAlive: true, x: 880, y: 380 };

test('farming, structure attacks, and the actor itself cannot create an allied fight call', () => {
  assert.equal(chooseNearbyFightingAlly(actor, [actor, ally], [enemy], 10), undefined);
  const selfAttacked = { ...actor, lastEnemyDamage: { attackerId: 'enemy', second: 9 } };
  assert.equal(chooseNearbyFightingAlly(selfAttacked, [selfAttacked], [{ ...enemy, x: 600 }], 10), undefined);
});

test('recent visible champion combat rallies nearby allies and expires when contact ends', () => {
  const attackedAlly = { ...ally, lastEnemyDamage: { attackerId: 'enemy', second: 9 } };
  assert.equal(chooseNearbyFightingAlly(actor, [attackedAlly], [enemy], 10)?.id, 'ally');
  const attackedEnemy = { ...enemy, lastEnemyDamage: { attackerId: 'ally', second: 9 } };
  assert.equal(chooseNearbyFightingAlly(actor, [ally], [attackedEnemy], 10)?.id, 'ally');
  assert.equal(chooseNearbyFightingAlly(actor, [attackedAlly], [enemy], 12), undefined);
  assert.equal(chooseNearbyFightingAlly(actor, [attackedAlly], [], 10), undefined);
  assert.equal(chooseNearbyFightingAlly(actor, [attackedAlly], [{ ...enemy, x: 1200 }], 10), undefined);
  for (const state of [{ isAlive: false }, { isRecalling: true }, { recallIntent: true },
    { diveAborting: true }, { committedState: 'retreat' }, { blackHole: {} },
    { corsaraBarrage: {} }, { monkeySpin: {} }]) {
    assert.equal(chooseNearbyFightingAlly(actor, [{ ...attackedAlly, ...state }], [enemy], 10), undefined);
  }
});
