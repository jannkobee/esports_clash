import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';
import {
  PROPELLA_MAX_ROTOR_STACKS,
  PROPELLA_ATTACK_RANGE,
  propellaAttackSpeedBonus,
  propellaFlakSplashRatio,
  propellaGunshipDurationAtRank,
  propellaRotorStacksAfterAttack,
} from './propellaRules.ts';

test('Propella is an open-cockpit flak-skiff hypercarry with a complete original kit', () => {
  const propella = ADDITIONAL_CHAMPIONS.find(champion => champion.name === 'Skybreaker');
  assert.ok(propella);
  assert.equal(propella.displayName, 'Propella');
  assert.equal(propella.primaryRole, 'Marksman');
  assert.equal(propella.combatRoles.Carry, 3);
  assert.match(propella.passiveDesc, /flak/i);
  assert.match(propella.passiveDesc, /lift fans/i);
  assert.match(propella.skill1.name, /flak/i);
  assert.match(propella.skill2.name, /rotor/i);
  assert.match(propella.ultimate.desc, /gunship/i);
  assert.equal(PROPELLA_ATTACK_RANGE, 180);
});

test('Propella spools to a capped attack-speed state and scales flak damage into gunship mode', () => {
  let stacks = 0;
  for (let i = 0; i < 12; i++) stacks = propellaRotorStacksAfterAttack(stacks);
  assert.equal(stacks, PROPELLA_MAX_ROTOR_STACKS);
  assert.ok(Math.abs(propellaAttackSpeedBonus(6, false, false) - 0.15) < 1e-9);
  assert.ok(Math.abs(propellaAttackSpeedBonus(6, true, true) - 0.95) < 1e-9);
  assert.ok(propellaFlakSplashRatio(18, true) > propellaFlakSplashRatio(1, false));
  assert.equal(propellaGunshipDurationAtRank(1), 8);
  assert.equal(propellaGunshipDurationAtRank(4), 11);
});
