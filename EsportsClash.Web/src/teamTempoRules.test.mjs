import test from 'node:test';
import assert from 'node:assert/strict';
import { isTeamfightApproachSafe, laneAdvanceLimit, shouldCoordinateObjectiveRecall, shouldFollowUpControl, shouldPrioritizeTeamfight, shouldPushWithWave, shouldSeekHealthRelic, shouldStageForObjective, shouldStartProactiveAllIn, wouldOverstep } from './teamTempoRules.ts';
import { shouldKeepRecallPlan } from './actionDecisionRules.ts';
import { resolveFightCommitment } from './decisionCommitment.ts';

const fight = { dangerousFight: false, lowHealth: false, takingTowerFire: false,
  targetDistance: 240, attackRange: 150, readyCastRange: 280, canReinforceAlly: false };

test('fight tempo rejects turret-crossing shortcuts even when both endpoints are safe', () => {
  const tower = { x: 500, y: 360, type: 'tower_t1', range: 135, isAlive: true };
  const left = { x: 320, y: 360 }, right = { x: 680, y: 360 };
  for (const [from, to] of [[left, right], [right, left]]) {
    assert.equal(isTeamfightApproachSafe(from, to, [tower]), false);
    assert.equal(isTeamfightApproachSafe(from, tower, [tower]), false);
    assert.equal(isTeamfightApproachSafe(from, to, [{ ...tower, isAlive: false }]), true);
    assert.equal(isTeamfightApproachSafe({ ...from, y: 524 }, { ...to, y: 524 }, [tower]), true);
    assert.equal(isTeamfightApproachSafe({ ...from, y: 523 }, { ...to, y: 523 }, [tower]), false,
      'the 28-unit perimeter buffer remains protected');
    assert.equal(isTeamfightApproachSafe(from, to, [{ ...tower, type: 'nexus' }]), false);
  }
});

test('tempo recognizes actionable local fights without granting extra attack or global spell reach', () => {
  assert.equal(shouldPrioritizeTeamfight(fight), true);
  assert.equal(shouldPrioritizeTeamfight({ ...fight, readyCastRange: 0 }), false);
  assert.equal(shouldPrioritizeTeamfight({ ...fight, targetDistance: 225, readyCastRange: 0 }), true);
  assert.equal(shouldPrioritizeTeamfight({ ...fight, attackRange: 50, readyCastRange: 0, targetDistance: 190 }), true);
  assert.equal(shouldPrioritizeTeamfight({ ...fight, targetDistance: 401, readyCastRange: 2000 }), false);
  assert.equal(shouldPrioritizeTeamfight({ ...fight, targetDistance: Infinity }), false,
    'unavailable or tower-protected targets cannot release the wave leash');
});

test('a viable allied fight takes priority without requiring a personal target; safety still wins', () => {
  const reinforce = { ...fight, targetDistance: Infinity, canReinforceAlly: true };
  assert.equal(shouldPrioritizeTeamfight(reinforce), true);
  for (const guard of ['dangerousFight', 'lowHealth', 'takingTowerFire']) {
    assert.equal(shouldPrioritizeTeamfight({ ...fight, [guard]: true }), false, guard);
    assert.equal(shouldPrioritizeTeamfight({ ...reinforce, [guard]: true }), false, guard);
  }
});

test('retreat commitment cannot be cancelled by the new tempo opportunity', () => {
  const commitment = resolveFightCommitment({ committedState: 'retreat', timer: 0.4,
    dangerous: false, enemyCount: 2, inWell: false, followUp: false,
    lowHealth: false, losingFight: false });
  assert.equal(commitment.dangerous, true);
  assert.equal(shouldPrioritizeTeamfight({ ...fight, dangerousFight: commitment.dangerous }), false);
});

test('a nearby teamfight beats wave conversion, optional relic recovery, setup, and shopping', () => {
  const activeFight = shouldPrioritizeTeamfight(fight);
  const push = { healthFraction: 0.72, iq: 87, lan: 82, coachMacro: 14,
    alliedWaveCount: 4, enemyWaveCount: 2, waveFrontDistance: 160,
    structureDistance: 420, nearbyAllies: 3, nearbyEnemies: 1, winningFightWindow: true };
  assert.equal(shouldPushWithWave(push), true);
  assert.equal(shouldPushWithWave({ ...push, activeFight }), false);
  const relic = { healthFraction: 0.48, missingHealth: 650, healAmount: 260,
    distance: 125, enemyDistanceToRelic: 420, enemyDistanceToUnit: 240,
    followUpEngage: false, pushWindow: false, underEnemyTower: false };
  assert.equal(shouldSeekHealthRelic(relic), true);
  assert.equal(shouldSeekHealthRelic({ ...relic, activeFight }), false);
  assert.equal(shouldSeekHealthRelic({ ...relic, healthFraction: 0.18, activeFight }), true,
    'critical recovery remains available even with a stale fight opportunity');
  assert.equal(shouldStageForObjective({ secondsUntilObjective: 20, healthFraction: 0.72,
    lanePriority: true, nearbyEnemies: 0, activeFight }), false);
  const reset = { healthFraction: 0.72, manaFraction: 0.8, manaDependent: false,
    lowHealth: false, dangerousFight: false, shopping: true, objectiveReset: true,
    previousIntent: true, inWell: false, followUp: false, combatCommit: false,
    pushWindow: false, objectiveCall: activeFight };
  assert.equal(shouldKeepRecallPlan(reset), false);
  assert.equal(shouldKeepRecallPlan({ ...reset, dangerousFight: true }), true);
  assert.equal(shouldKeepRecallPlan({ ...reset, lowHealth: true }), true);
  assert.equal(shouldKeepRecallPlan({ ...reset, objectiveCall: false }), true,
    'ordinary recovery resumes when contact ends');
});

test('a low-health ranged ally follows a five-target Black Hole when threats are controlled', () => {
  const engage = { healthFraction: 0.18, caughtEnemies: 5, freeThreats: 0, nearbyAllies: 3,
    distanceToCatch: 310, attackRange: 150, readyCastRange: 180, iq: 91, teamfight: 94,
    controlSeconds: 3, moveSpeed: 100,
    losingFight: true, underEnemyTower: false, takingTowerFire: false };
  assert.equal(shouldFollowUpControl(engage), true);
  assert.equal(shouldFollowUpControl({ ...engage, caughtEnemies: 1 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, healthFraction: 0.08 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, underEnemyTower: true }), false);
  assert.equal(shouldFollowUpControl({ ...engage, freeThreats: 3 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, controlSeconds: 0.5 }), false);
  assert.equal(shouldFollowUpControl({ ...engage, attackRange: 50, readyCastRange: 0 }), false);
});

test('healthy grouped teams can proactively all-in without landed crowd control', () => {
  const clash = {
    healthFraction: 0.82, alliedAverageHealth: 0.8, enemyAverageHealth: 0.81,
    groupedAllies: 5, groupedEnemies: 5, readyContributors: 4,
    targetDistance: 430, approachSafe: true, targetUnderEnemyTower: false,
    takingTowerFire: false, losingFight: true,
    iq: 64, teamfight: 72,
  };
  assert.equal(shouldStartProactiveAllIn(clash), true,
    'a balanced 5v5 may start even when the frontliner local read looks losing');
  assert.equal(shouldStartProactiveAllIn({ ...clash, groupedAllies: 4 }), false,
    'the team cannot call an outnumbered 4v5');
  assert.equal(shouldStartProactiveAllIn({ ...clash, readyContributors: 2 }), false,
    'the call waits when too few teammates can contribute');
});

test('proactive all-ins preserve health and tower safety gates', () => {
  const clash = {
    healthFraction: 0.75, alliedAverageHealth: 0.76, enemyAverageHealth: 0.7,
    groupedAllies: 4, groupedEnemies: 4, readyContributors: 4,
    targetDistance: 380, approachSafe: true, targetUnderEnemyTower: false,
    takingTowerFire: false, losingFight: false,
    iq: 99, teamfight: 99,
  };
  for (const unsafe of [
    { healthFraction: 0.49 }, { alliedAverageHealth: 0.55 },
    { approachSafe: false }, { targetUnderEnemyTower: true },
    { takingTowerFire: true },
  ]) assert.equal(shouldStartProactiveAllIn({ ...clash, ...unsafe }), false);
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
