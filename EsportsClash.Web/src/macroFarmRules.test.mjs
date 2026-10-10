import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseKnownJungleCamp, neutralAttackRange, shouldFocusExposedNexus, shouldPressWonFight } from './macroFarmRules.ts';

const camps = [
  { id: 'home', type: 'blue_buff', x: 530, y: 150, homeX: 485, homeY: 145, isAlive: true },
  { id: 'enemy', type: 'red_buff', x: 1515, y: 145, isAlive: true },
];
const actor = {
  x: 800, y: 380, team: 'blue', hpFraction: 0.9, iq: 82,
  jungleStrength: 2, gameSeconds: 90, nearbyEnemyCount: 0,
  nearestLaneEnemyDistance: 500, urgentStructurePush: false,
};

test('neutral attacks keep a short reach without changing champion attack range', () => {
  assert.equal(neutralAttackRange(205), 130);
  assert.equal(neutralAttackRange(205, true), 145);
  assert.equal(neutralAttackRange(50), 50);
});

test('a jungler routes to a known camp home without a vision requirement', () => {
  assert.equal(chooseKnownJungleCamp(camps, actor)?.id, 'home');
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, x: 10, y: 600 }), undefined);
});

test('lane pressure, enemy threat, and a nexus finish window cancel camp farming', () => {
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, nearestLaneEnemyDistance: 160 }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, nearbyEnemyCount: 1 }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, urgentStructurePush: true }), undefined);
});

test('an exposed low-health nexus becomes a finish objective, informed by card and coach', () => {
  const nexus = { isAlive: true, hp: 2800, maxHp: 7500 };
  assert.equal(shouldFocusExposedNexus(nexus, true, 90, 12), true);
  assert.equal(shouldFocusExposedNexus(nexus, true, 30, 4), false);
  assert.equal(shouldFocusExposedNexus(nexus, false, 90, 12), false);
  assert.equal(shouldFocusExposedNexus({ ...nexus, isAlive: false }, true, 90, 12), false);
});

test('a won fight sends healthy survivors to structures before shopping or farming', () => {
  const opportunity = { secondsSinceTeamKill: 6, aliveAllies: 4, aliveEnemies: 1,
    healthFraction: 0.62, nearestStructureDistance: 450, iq: 86, coachMacro: 15, losingFight: false };
  assert.equal(shouldPressWonFight(opportunity), true);
  assert.equal(shouldPressWonFight({ ...opportunity, aliveEnemies: 4 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, healthFraction: 0.2 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, losingFight: true }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, nearestStructureDistance: 950 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, secondsSinceTeamKill: 19 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, iq: 45, coachMacro: 5,
    healthFraction: 0.42 }), false);
});
