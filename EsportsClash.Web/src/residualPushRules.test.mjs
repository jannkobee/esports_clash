import test from 'node:test';
import assert from 'node:assert/strict';
import { planResidualPush, evaluateResidualPush } from './residualPushRules.ts';
import { createSpatialInfluence } from './spatialInfluence.ts';
import { estimateTacticalOutlook } from './tacticalOutlook.ts';
import { laneAdvanceLimit } from './teamTempoRules.ts';
import { ARENA_WIDTH } from './arenaLayout.ts';

test('safe lane advancement evaluates its bounded route rather than a distant turret attack', () => {
  for (const team of ['blue', 'red']) {
    const mirror = x => team === 'blue' ? x : ARENA_WIDTH - x;
    const actor = { id: 'a', team, x: mirror(630), y: 380, hp: 1000, maxHp: 1000, isAlive: true };
    const tower = { id: 'tower', team: team === 'blue' ? 'red' : 'blue', x: mirror(1550), y: 380,
      hp: 4000, maxHp: 4000, range: 135, type: 'outer_tower', isAlive: true };
    const influence = createSpatialInfluence({ team, allies: [actor], enemies: [], structures: [tower] });
    const advanceLimit = laneAdvanceLimit({ team, waveCount: 0, structureX: tower.x,
      structureRange: tower.range, exposedNexus: false, objectiveFight: false });
    const plan = planResidualPush({ laneDestination: { id: 'lane', x: advanceLimit, y: 380 } });
    const result = evaluateResidualPush({ plan, actor, attackRange: 125, travelSpeed: 70,
      nearbyAllies: 0, nearbyEnemies: 0, influence });
    const old = estimateTacticalOutlook({ actor, target: tower, attackRange: 125, interactionRange: 125,
      travelSpeed: 70, nearbyAllies: 0, nearbyEnemies: 0,
      approachThreat: influence.approach(actor, tower).threat, approachCover: influence.approach(actor, tower).cover });
    assert.equal(plan.kind, 'advance');
    assert.ok(result.danger < .1);
    assert.ok(1 - old.survival > .5);
    const threatened = createSpatialInfluence({ team, allies: [actor], structures: [tower],
      enemies: [{ ...actor, team: tower.team, x: actor.x + 20 }] });
    assert.ok(evaluateResidualPush({ plan, actor, attackRange: 125, travelSpeed: 70,
      nearbyAllies: 0, nearbyEnemies: 1, influence: threatened }).danger > .5);
  }
});

test('real structure and minion attacks retain target pressure, survival and executor precedence', () => {
  const actor = { team: 'blue', x: 1400, y: 380, hp: 500, maxHp: 1000, isAlive: true };
  const tower = { id: 'tower', team: 'red', x: 1500, y: 380, hp: 100, maxHp: 4000,
    range: 135, type: 'outer_tower', isAlive: true };
  const minion = { id: 'creep', x: 1410, y: 380, hp: 5, maxHp: 300 };
  const influence = createSpatialInfluence({ team: 'blue', allies: [actor], enemies: [], structures: [tower] });
  const laneDestination = { id: 'lane', x: 1337, y: 380 };
  const campExit = { id: 'exit', x: 1300, y: 300 };
  const plan = planResidualPush({ structureInRange: tower, minionInRange: minion, campExit, laneDestination });
  assert.equal(plan.target.id, tower.id);
  const result = evaluateResidualPush({ plan, actor, attackRange: 125, travelSpeed: 70,
    nearbyAllies: 0, nearbyEnemies: 0, influence });
  assert.ok(result.tactical >= .5);
  assert.ok(result.danger > .5);
  assert.equal(planResidualPush({ minionInRange: minion, campExit, laneDestination }).kind, 'minion');
  assert.equal(planResidualPush({ campExit, laneDestination }).target, campExit);
  assert.equal(planResidualPush({ laneDestination }).target, laneDestination);
});
