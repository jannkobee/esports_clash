import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNexusFinish } from './nexusFinishRules.ts';

const nexus = { id: 'r_nexus', isAlive: true, hp: 360, maxHp: 9000, range: 190, ad: 85 };
const attacker = (overrides = {}) => ({
  id: 'blue-carry', isAlive: true, hp: 780, maxHp: 1200, distance: 110, attackRange: 125,
  structureAttackDamage: 180, attacksPerSecond: 1.2, approachSpeed: 100, ...overrides,
});

test('an exposed low Nexus commits from legal range using authored structure DPS', () => {
  const result = evaluateNexusFinish({ nexus, exposed: true, attackers: [attacker()], actorId: 'blue-carry',
    nearbyDefenders: 1, actorTakingNexusFire: true });
  assert.equal(result.feasible, true);
  assert.equal(result.reason, 'NEXUS_FINISH_READY');
  assert.equal(result.availableAttackers, 1);
  assert.ok(result.estimatedFinishSeconds < result.estimatedSurvivalSeconds);
});

test('a sealed Nexus cannot receive a finish commitment', () => {
  const result = evaluateNexusFinish({ nexus, exposed: false, attackers: [attacker()], actorId: 'blue-carry',
    nearbyDefenders: 0, actorTakingNexusFire: false });
  assert.equal(result.feasible, false);
  assert.equal(result.reason, 'NEXUS_UNAVAILABLE');
});

test('a critically endangered attacker is not held for a finish it cannot contribute to', () => {
  const result = evaluateNexusFinish({ nexus: { ...nexus, hp: 900 }, exposed: true,
    attackers: [attacker({ hp: 45 })], actorId: 'blue-carry', nearbyDefenders: 2, actorTakingNexusFire: true });
  assert.equal(result.feasible, false);
  assert.equal(result.reason, 'LETHAL_INCOMING_DAMAGE');
});

test('a distant roster member cannot start a map-wide Nexus finish call', () => {
  const result = evaluateNexusFinish({ nexus, exposed: true,
    attackers: [attacker({ distance: 1200 })], actorId: 'blue-carry', nearbyDefenders: 0, actorTakingNexusFire: false });
  assert.equal(result.feasible, false);
  assert.equal(result.reason, 'NO_AVAILABLE_ATTACKERS');
});
