import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStartEpicObjective, shouldContestOpponentObjective, hasObjectiveVision } from './objectiveRules.ts';

test('objective calls require a pushed wave, vision, teammates and ratings', () => {
  const good = { gameSeconds: 180, bossHealthFraction: 1, healthyAllies: 4,
    nearbyEnemies: 0, lanePriority: true, hasVision: true, averageIq: 88,
    averageTeamfight: 86, chemistry: 15, coachPlaybook: 12, actorHealthFraction: 0.9 };
  assert.equal(shouldStartEpicObjective(good), true);
  assert.equal(shouldStartEpicObjective({ ...good, lanePriority: false }), false);
  assert.equal(shouldStartEpicObjective({ ...good, hasVision: false }), false);
  assert.equal(shouldStartEpicObjective({ ...good, healthyAllies: 2 }), false);
  assert.equal(shouldStartEpicObjective({ ...good, averageIq: 35, averageTeamfight: 40, chemistry: 5, coachPlaybook: 3 }), false);
  assert.equal(shouldStartEpicObjective({ ...good, gameSeconds: 50 }), false);
});

test('teams regroup to contest opponent objective when pit is scouted and healthy allies respond', () => {
  const contestSituation = {
    gameSeconds: 200,
    bossHealthFraction: 0.5,
    healthyAllies: 4,
    enemiesAtBoss: 3,
    hasVisionOfPit: true,
    hasShotcaller: true,
    hasStealSpecialist: false,
    averageIq: 80,
    averageTeamfight: 82,
    chemistry: 12,
    actorHealthFraction: 0.85,
    isDragon: true
  };

  // Team with pit vision and healthy allies contests immediately
  assert.equal(shouldContestOpponentObjective(contestSituation), true);

  // If team has NO vision of the pit, they cannot contest (they do not know it is happening)
  assert.equal(shouldContestOpponentObjective({ ...contestSituation, hasVisionOfPit: false }), false);

  // If unit is at 10% health, it does not suicide into pit without steal trait
  assert.equal(shouldContestOpponentObjective({ ...contestSituation, actorHealthFraction: 0.15 }), false);

  // Baron Steal specialist will contest and attempt snipe even at low health
  assert.equal(shouldContestOpponentObjective({ ...contestSituation, actorHealthFraction: 0.20, hasStealSpecialist: true }), true);
});

test('hasObjectiveVision detects pit presence from nearby allies, wards, or spotted enemies', () => {
  const dragon = { x: 1000, y: 130, isAlive: true };

  // 1. Ally nearby
  const allyNear = [{ x: 950, y: 150, isAlive: true }];
  assert.equal(hasObjectiveVision('blue', dragon, allyNear, [], []), true);

  // 2. Ward at pit
  const wards = [{ team: 'blue', x: 980, y: 140 }];
  assert.equal(hasObjectiveVision('blue', dragon, [], [], wards), true);

  // Ward of enemy team does not grant vision to blue team
  const enemyWard = [{ team: 'red', x: 980, y: 140 }];
  assert.equal(hasObjectiveVision('blue', dragon, [], [], enemyWard), false);

  // 3. Enemy visible in pit
  const enemyInPit = [{ x: 1010, y: 140, isAlive: true, revealedTimer: 2.0 }];
  assert.equal(hasObjectiveVision('blue', dragon, [], enemyInPit, []), true);

  // Dead boss has no vision need
  assert.equal(hasObjectiveVision('blue', { ...dragon, isAlive: false }, allyNear, [], []), false);
});
