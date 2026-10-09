import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStartEpicObjective } from './objectiveRules.ts';

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
