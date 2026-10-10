import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStartEpicObjective, shouldContestOpponentObjective, hasObjectiveVision,
  objectiveFightPreference, chooseObjectiveAction, choosePostObjectiveAction } from './objectiveRules.ts';

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

  // Baron Steal specialist waits for a genuine last-hit window before risking low health.
  assert.equal(shouldContestOpponentObjective({ ...contestSituation, actorHealthFraction: 0.20, hasStealSpecialist: true }), false);
  assert.equal(shouldContestOpponentObjective({ ...contestSituation, bossHealthFraction: 0.20, actorHealthFraction: 0.20, hasStealSpecialist: true }), true);
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

test('both sides finish a low objective; a healthy objective holder only turns after a champion attack', () => {
  const situation = { bossHealthFraction: 0.2, hasVision: true,
    contestedByEnemy: true, enemyStartedFight: true, fightPreference: 30 };
  assert.equal(chooseObjectiveAction(situation), 'finish');
  assert.equal(chooseObjectiveAction({ ...situation, bossHealthFraction: 0.8,
    contestedByEnemy: false, enemyStartedFight: false }), 'finish');
  assert.equal(chooseObjectiveAction({ ...situation, bossHealthFraction: 0.8,
    contestedByEnemy: false }), 'fight');
  assert.equal(chooseObjectiveAction({ ...situation, hasVision: false }), 'none');
});

test('card and coach attitudes change a healthy objective contest and the post-secure call', () => {
  const aggressive = { stats: { iq: 72, tf: 93, clu: 90 }, badges: ['Aggro Diver'], personality: '' };
  const cautious = { stats: { iq: 94, tf: 72, clu: 75 }, badges: ['Baron Steal'], personality: '' };
  const fightBias = objectiveFightPreference([aggressive], { style: 'Aggressive Dive' }, aggressive);
  const finishBias = objectiveFightPreference([cautious], { style: 'Objective Macro' }, cautious);
  assert.ok(fightBias > finishBias);
  const cautiousCaller = { ...cautious, badges: ['Baron Steal', 'Shotcaller'] };
  assert.ok(objectiveFightPreference([cautiousCaller, aggressive], { style: 'Dynamic Adapt' })
    < objectiveFightPreference([cautious, aggressive], { style: 'Dynamic Adapt' }),
  'the shotcaller pulls the squad toward their own objective attitude');
  const contest = { bossHealthFraction: 0.8, hasVision: true, contestedByEnemy: true, enemyStartedFight: false };
  assert.equal(chooseObjectiveAction({ ...contest, fightPreference: fightBias }), 'fight');
  assert.equal(chooseObjectiveAction({ ...contest, fightPreference: finishBias }), 'finish');
  const aftermath = { nearbyEnemies: 2, healthyAllies: 4, healthyEnemies: 2, averageHealthFraction: 0.8 };
  assert.equal(choosePostObjectiveAction({ ...aftermath, fightPreference: fightBias }), 'fight');
  assert.equal(choosePostObjectiveAction({ ...aftermath, fightPreference: finishBias }), 'regroup');
  assert.equal(choosePostObjectiveAction({ ...aftermath, fightPreference: fightBias, averageHealthFraction: 0.25 }), 'regroup');
});
