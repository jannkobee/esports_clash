import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMP_PATIENCE_SECONDS, neutralCampRespawnSeconds, stepCampPatience, stepLeashedMonster } from './neutralAggroRules.ts';

test('neutral monsters stand still until attacked, chase, then return home', () => {
  assert.deepEqual(stepLeashedMonster(100, 100, 100, 100, null, 1), { x: 100, y: 100, chasing: false });
  const chase = stepLeashedMonster(100, 100, 100, 100, { x: 170, y: 100 }, 0.5);
  assert.equal(chase.chasing, true);
  assert.ok(chase.x > 100);
  const reset = stepLeashedMonster(chase.x, chase.y, 100, 100, { x: 300, y: 100 }, 1);
  assert.equal(reset.chasing, false);
  assert.equal(reset.x, 100);
});

test('camp spends patience while fighting, heals on disengage, then fully resets', () => {
  const fighting = stepCampPatience(500, 1000, CAMP_PATIENCE_SECONDS, 0, true, 1);
  assert.equal(fighting.hp, 500);
  assert.equal(fighting.patience, CAMP_PATIENCE_SECONDS - 1);
  assert.equal(fighting.chasing, true);

  const reset = stepCampPatience(fighting.hp, 1000, fighting.patience, 0, false, 1);
  assert.equal(reset.chasing, false);
  assert.equal(reset.hp, 560);
  const complete = stepCampPatience(reset.hp, 1000, reset.patience, 5.5, false, 0.5);
  assert.equal(complete.hp, 1000);

  const retagged = stepCampPatience(560, 1000, CAMP_PATIENCE_SECONDS, 4, true, 0.5);
  assert.equal(retagged.resetElapsed, 0);
  assert.equal(retagged.hp, 560);
  assert.equal(retagged.chasing, true);

  const exhausted = stepCampPatience(500, 1000, 0.2, 0, true, 0.3);
  assert.equal(exhausted.chasing, false);
});

test('Gravemarch is a one-time neutral boss while regular camps return', () => {
  assert.equal(neutralCampRespawnSeconds('siege_golem'), null);
  assert.equal(neutralCampRespawnSeconds('blue_buff'), 55);
});
