import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS } from './mockData.ts';
import {
  ABILITY_CAST_TYPES, CAST_TYPE_LABELS, canCastWithoutUnitTarget, getAbilityCastType,
  shouldCastNoTargetMobilityUltimate,
} from './abilityCastTypes.ts';
import { abilityTargetingDetails } from './aetherisAbilities.ts';
import { chooseBaseDefense, defenseRallyPoint, shouldChaseDefenseTarget } from './baseDefenseRules.ts';

test('every playable ability is assigned one of the five Dota-style cast groups', () => {
  const valid = new Set(Object.keys(CAST_TYPE_LABELS));
  for (const champion of CHAMPIONS) {
    assert.ok(ABILITY_CAST_TYPES[champion.name], `${champion.name} has a cast-type entry`);
    for (const slot of ['skill1', 'skill2', 'ultimate']) {
      assert.ok(valid.has(champion[slot].castType), `${champion.name} ${slot} is stamped with a cast type`);
      assert.equal(champion[slot].castType, getAbilityCastType(champion.name, slot));
    }
  }
});

test('Voltaire (Raijin) Ball Lightning is a no-target ultimate usable at will', () => {
  const raijin = CHAMPIONS.find(champion => champion.name === 'Raijin');
  assert.equal(raijin.ultimate.castType, 'no_target');
  assert.equal(raijin.ultimate.targeting, 'none');
  assert.ok(canCastWithoutUnitTarget('no_target'));
  assert.match(abilityTargetingDetails(raijin.ultimate), /No Target/);
});

test('stance swaps are toggles and every group is represented', () => {
  assert.equal(getAbilityCastType('Jaxon', 'ultimate'), 'toggle');
  assert.equal(getAbilityCastType('Jinxy', 'skill1'), 'toggle');
  const used = new Set(Object.values(ABILITY_CAST_TYPES).flat());
  for (const type of Object.keys(CAST_TYPE_LABELS)) assert.ok(used.has(type), `${type} is used`);
});

test('no-target Ball Lightning closes gaps and finishes, but never dashes at a target under a turret', () => {
  const base = { healthFraction: 0.9, targetDistance: 330, targetHealthFraction: 0.8,
    targetUnderEnemyTurret: false, nearbyAllies: 1, nearbyEnemies: 1 };
  assert.equal(shouldCastNoTargetMobilityUltimate(base), true);
  assert.equal(shouldCastNoTargetMobilityUltimate({ ...base, targetDistance: 120 }), false);
  assert.equal(shouldCastNoTargetMobilityUltimate({ ...base, healthFraction: 0.3 }), false);
  assert.equal(shouldCastNoTargetMobilityUltimate({ ...base, nearbyAllies: 0, nearbyEnemies: 4 }), false);
  assert.equal(shouldCastNoTargetMobilityUltimate({ ...base, targetDistance: 120, targetHealthFraction: 0.2 }), true);
  assert.equal(shouldCastNoTargetMobilityUltimate({ ...base, targetUnderEnemyTurret: true }), false);
});

test('lane towers are defended from the front while the base is held from behind', () => {
  assert.deepEqual(defenseRallyPoint('blue', { x: 1000, y: 380, type: 'outer_tower' }), { x: 1040, y: 380 });
  assert.deepEqual(defenseRallyPoint('red', { x: 1600, y: 380, type: 'outer_tower' }), { x: 1560, y: 380 });
  assert.deepEqual(defenseRallyPoint('blue', { x: 235, y: 380, type: 'nexus' }), { x: 170, y: 380 });
  const tower = { id: 't1', team: 'blue', type: 'outer_tower', x: 1050, y: 380, isAlive: true, hp: 300, maxHp: 1500, range: 230 };
  const siege = { id: 'e1', team: 'red', x: 1250, y: 380, isAlive: true };
  const call = chooseBaseDefense({ team: 'blue', x: 900, y: 380 }, [tower], [siege], []);
  assert.ok(call.rally.x > tower.x, 'defenders rally in front of the dying tower, not behind it');
});

test('defenders chase tower attackers within the leash but never into enemy turret fire', () => {
  const tower = { x: 1050, y: 380, range: 230 };
  const ok = { targetUnderEnemyTurret: false, healthFraction: 0.8 };
  assert.equal(shouldChaseDefenseTarget(tower, { x: 1300, y: 380 }, ok), true);
  assert.equal(shouldChaseDefenseTarget(tower, { x: 1700, y: 380 }, ok), false);
  assert.equal(shouldChaseDefenseTarget(tower, { x: 1300, y: 380 }, { ...ok, targetUnderEnemyTurret: true }), false);
  assert.equal(shouldChaseDefenseTarget(tower, { x: 1300, y: 380 }, { ...ok, healthFraction: 0.2 }), false);
});

