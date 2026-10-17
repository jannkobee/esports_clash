import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';

function arm({ alive = true, hp = 1, own = 1000, enemy = 1000,
  dragon = false, siege = 0, value = 500, gold = 100, damage = 0 } = {}) {
  return { event: { followup: { actor: { isAlive: alive, hpFraction: hp,
    economicValue: value, gold, damageDealt: damage }, team: {
    ownStructureHp: own, enemyStructureHp: enemy,
    dragonAspect: dragon, siegeGolemUnits: siege } } } };
}

test('survival and both-dead outcomes take precedence over economy', () => {
  assert.equal(assessPairedOutcome(arm(), arm({ alive: false, value: 1000 })).classification,
    'survival-worsened');
  assert.equal(assessPairedOutcome(arm({ alive: false }), arm()).classification,
    'survival-improved');
  assert.equal(assessPairedOutcome(arm({ alive: false }), arm({ alive: false, value: 1000 })).classification,
    'both-dead');
});

test('predeclared structure, health and economic thresholds classify gains and tradeoffs', () => {
  assert.equal(assessPairedOutcome(arm(), arm({ enemy: 899, value: 550 })).classification, 'better');
  assert.equal(assessPairedOutcome(arm(), arm({ hp: .94, enemy: 899 })).classification, 'mixed');
  assert.equal(assessPairedOutcome(arm(), arm({ hp: .96, enemy: 920, value: 549 })).classification,
    'no-material-difference');
  assert.equal(assessPairedOutcome(arm(), arm({ dragon: true })).classification, 'better');
  assert.equal(assessPairedOutcome(arm(), arm({ siege: 1, value: 440 })).classification, 'mixed');
});
