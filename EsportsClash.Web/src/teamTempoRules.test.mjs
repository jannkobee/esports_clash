import test from 'node:test';
import assert from 'node:assert/strict';
import { laneAdvanceLimit, shouldCoordinateObjectiveRecall, shouldFollowUpControl, shouldPushWithWave, shouldSeekHealthRelic, shouldStageForObjective, wouldOverstep } from './teamTempoRules.ts';

test('a low-health ranged ally follows a five-target Black Hole when threats are controlled', () => {
  const engage = { healthFraction: 0.18, caughtEnemies: 5, freeThreats: 0, nearbyAllies: 3,
    distanceToCatch: 310, attackRange: 150, readyCastRange: 180, iq: 91, teamfight: 94,
    controlSeconds: 3, moveSpeed: 100,
    losingFight: true, underEnemyTower: false, takingTowerFire: false, abortingDive: false };
  assert.equal(shouldFollowUpControl(engage), true);
  assert.equal(shouldFollowUpControl({ ...engage, caughtEnemies: 1 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, healthFraction: 0.08 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, underEnemyTower: true }), false);
  assert.equal(shouldFollowUpControl({ ...engage, freeThreats: 3 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, controlSeconds: 0.5 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, attackRange: 50, readyCastRange: 0 }), false);
});

test('a nearby safe relic interrupts weak farming, but not a good engage or push', () => {
  const recover = { healthFraction: 0.31, missingHealth: 650, healAmount: 260,
    distance: 125, enemyDistanceToRelic: 420, enemyDistanceToUnit: 350,
    followUpEngage: false, pushWindow: false, underEnemyTower: false };
  assert.equal(shouldSeekHealthRelic(recover), true);
  assert.equal(shouldSeekHealthRelic({ ...recover, followUpEngage: true }), false);
  assert.equal(shouldSeekHealthRelic({ ...recover, pushWindow: true }), false);
  assert.equal(shouldSeekHealthRelic({ ...recover, enemyDistanceToRelic: 120 }), false);
  assert.equal(shouldSeekHealthRelic({ ...recover, healthFraction: 0.18, distance: 230 }), true);
});

test('wave tempo pushes a healthy advantage and holds without a wave', () => {
  const window = { healthFraction: 0.72, iq: 87, lan: 82, coachMacro: 14,
    alliedWaveCount: 4, enemyWaveCount: 2, waveFrontDistance: 160,
    structureDistance: 420, nearbyAllies: 3, nearbyEnemies: 1, winningFightWindow: false };
  assert.equal(shouldPushWithWave(window), true);
  assert.equal(shouldPushWithWave({ ...window, alliedWaveCount: 0 }), false);
  assert.equal(shouldPushWithWave({ ...window, nearbyEnemies: 5 }), false);
  assert.equal(shouldPushWithWave({ ...window, healthFraction: 0.2 }), false);
  assert.equal(laneAdvanceLimit({ team: 'blue', waveFrontX: 620, waveCount: 4,
    structureX: 800, structureRange: 230, exposedNexus: false, objectiveFight: false }), 685);
  assert.equal(laneAdvanceLimit({ team: 'red', waveCount: 0,
    structureX: 1200, structureRange: 230, exposedNexus: false, objectiveFight: false }), 1458);
  assert.equal(wouldOverstep('blue', 720, 685), true);
  assert.equal(wouldOverstep('red', 1430, 1458), true);
});

test('objective reset coordinates safe recalls only 45 to 60 seconds before spawn', () => {
  const reset = { secondsUntilObjective: 52, livingAllies: 5, safeRecallers: 3,
    activeThreat: false, activePush: false };
  assert.equal(shouldCoordinateObjectiveRecall(reset), true);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, secondsUntilObjective: 45 }), true);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, secondsUntilObjective: 60 }), true);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, secondsUntilObjective: 44 }), false);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, secondsUntilObjective: 61 }), false);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, livingAllies: 2 }), false);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, safeRecallers: 2 }), false);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, activeThreat: true }), false);
  assert.equal(shouldCoordinateObjectiveRecall({ ...reset, activePush: true }), false);
});

test('objective staging requires a healthy avatar, lane priority, and no active fight', () => {
  const stage = { secondsUntilObjective: 20, healthFraction: 0.72,
    lanePriority: true, nearbyEnemies: 0, activeFight: false };
  assert.equal(shouldStageForObjective(stage), true);
  assert.equal(shouldStageForObjective({ ...stage, secondsUntilObjective: 0 }), true);
  assert.equal(shouldStageForObjective({ ...stage, secondsUntilObjective: 25 }), true);
  assert.equal(shouldStageForObjective({ ...stage, secondsUntilObjective: 26 }), false);
  assert.equal(shouldStageForObjective({ ...stage, healthFraction: 0.4 }), false);
  assert.equal(shouldStageForObjective({ ...stage, lanePriority: false }), false);
  assert.equal(shouldStageForObjective({ ...stage, nearbyEnemies: 1 }), false);
  assert.equal(shouldStageForObjective({ ...stage, nearbyEnemies: 2 }), false);
  assert.equal(shouldStageForObjective({ ...stage, activeFight: true }), false);
});
