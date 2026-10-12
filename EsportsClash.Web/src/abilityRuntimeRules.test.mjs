import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS } from './mockData.ts';
import { getSkillCastRange, isCrowdControlSkill } from './skillRangeRules.ts';
import {
  BUCK_SMOKE_DURATION,
  BUCK_SMOKE_MELEE_RANGE,
  BUCK_SMOKE_RADIUS,
  getAbilityAdjustedBasicAttackRange,
  getKindraHuntDamageMultiplier,
  getLambsRespiteExpiryHeal,
  getLambsRespiteMinimumHealth,
  KINDRA_HUNT_DURATION,
  shouldTriggerKindraHunt,
} from './abilityRuntimeRules.ts';

test('the playable roster has complete finite ability metadata and bounded cast ranges', () => {
  assert.equal(CHAMPIONS.length, 45);
  assert.equal(new Set(CHAMPIONS.map(champion => champion.id)).size, CHAMPIONS.length);
  for (const champion of CHAMPIONS) {
    assert.ok(champion.passiveDesc.trim().length > 0, `${champion.name} passive is described`);
    for (const slot of ['skill1', 'skill2', 'ultimate']) {
      const ability = champion[slot];
      assert.ok(ability.name.trim().length > 0, `${champion.name} ${slot} has a name`);
      assert.ok(ability.desc.trim().length > 0, `${champion.name} ${slot} has a description`);
      assert.ok(Number.isFinite(ability.damage) && ability.damage >= 0, `${champion.name} ${slot} damage is valid`);
      assert.ok(Number.isFinite(ability.cooldown) && ability.cooldown >= 0, `${champion.name} ${slot} cooldown is valid`);
      const range = getSkillCastRange(champion.name, slot, champion.range * 35);
      assert.ok(Number.isFinite(range) && range >= 0, `${champion.name} ${slot} cast range is valid`);
    }
  }
});

test('Kindra Spirit Mark is temporary, refresh-only eligibility with one 15% modifier', () => {
  const kindra = CHAMPIONS.find(champion => champion.name === 'Kindra');
  assert.equal(KINDRA_HUNT_DURATION, 5);
  assert.equal(shouldTriggerKindraHunt('Kindra', 'camp'), true);
  assert.equal(shouldTriggerKindraHunt('Kindra', 'dragon'), true);
  assert.equal(shouldTriggerKindraHunt('Kindra', 'champion', 0.40), true);
  assert.equal(shouldTriggerKindraHunt('Kindra', 'champion', 0.401), false);
  assert.equal(shouldTriggerKindraHunt('Kindra', 'minion', 0.1), false);
  assert.ok(Math.abs(getAbilityAdjustedBasicAttackRange(kindra, 5, false) - 212.75) < 1e-9);
  assert.equal(getKindraHuntDamageMultiplier('Kindra', 5), 1.15);
  assert.equal(getKindraHuntDamageMultiplier('Kindra', 0), 1);
  assert.equal(getSkillCastRange('Kindra', 'skill1', 212.75), 185, 'hunt range does not extend spells');
});

test('Buck smoke caps only physical basic reach while Lambs Respite uses its documented floor and expiry heal', () => {
  const astra = CHAMPIONS.find(champion => champion.name === 'Astra');
  assert.equal(BUCK_SMOKE_RADIUS, 55);
  assert.equal(BUCK_SMOKE_DURATION, 2.5);
  assert.equal(getAbilityAdjustedBasicAttackRange(astra, 0, true), BUCK_SMOKE_MELEE_RANGE);
  assert.equal(getAbilityAdjustedBasicAttackRange(astra, 0, false), 195);
  assert.equal(isCrowdControlSkill('Buck', 'skill2'), false, 'range loss is not a hard-control chain');
  assert.equal(getLambsRespiteMinimumHealth(1333), 133);
  assert.equal(getLambsRespiteExpiryHeal(1), 450);
  assert.equal(getLambsRespiteExpiryHeal(1.2), 540);
});
