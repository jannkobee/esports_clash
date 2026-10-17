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

test('five fragile attackers cannot promise a Nexus finish before its first shot', () => {
  const attackers = Array.from({ length: 5 }, (_, i) => attacker({ id: `a${i}`, hp: 200,
    distance: 350, attackRange: 70, structureAttackDamage: 60 }));
  for (const actorTakingNexusFire of [false, true]) {
    const result = evaluateNexusFinish({ nexus: { ...nexus, hp: 2500 }, exposed: true,
      attackers, actorId: 'a0', nearbyDefenders: 5, actorTakingNexusFire });
    assert.equal(result.feasible, false);
    assert.ok(Number.isFinite(result.estimatedSurvivalSeconds));
  }
});

test('late arrivals and dead-before-arrival allies cannot inflate finish damage', () => {
  const result = evaluateNexusFinish({ nexus: { ...nexus, hp: 1200 }, exposed: true,
    attackers: [attacker({ hp: 100, structureAttackDamage: 40 }), ...Array.from({ length: 4 }, (_, i) =>
      attacker({ id: `far${i}`, hp: 100, distance: 600, structureAttackDamage: 1000 }))],
    actorId: 'blue-carry', nearbyDefenders: 0, actorTakingNexusFire: false });
  assert.equal(result.feasible, false);
});

test('a legal immediate last hit survives the real volley window despite nearby defenders', () => {
  const result = evaluateNexusFinish({ nexus: { ...nexus, hp: 100 }, exposed: true,
    attackers: [attacker({ hp: 180 })], actorId: 'blue-carry', nearbyDefenders: 5, actorTakingNexusFire: false });
  assert.equal(result.feasible, true);
  const blocked = evaluateNexusFinish({ nexus: { ...nexus, hp: 100 }, exposed: true,
    attackers: [attacker({ hp: 180, incomingDamage: 180 })], actorId: 'blue-carry', nearbyDefenders: 5, actorTakingNexusFire: true });
  assert.equal(blocked.feasible, false);
});

test('safe ranged finishes and genuinely healthy group finishes remain available', () => {
  const ranged = evaluateNexusFinish({ nexus, exposed: true,
    attackers: [attacker({ hp: 100, distance: 250, attackRange: 250 })], actorId: 'blue-carry', nearbyDefenders: 0, actorTakingNexusFire: false });
  assert.equal(ranged.feasible, true);
  const group = Array.from({ length: 5 }, (_, i) => attacker({ id: `a${i}`, hp: 2200 }));
  assert.equal(evaluateNexusFinish({ nexus: { ...nexus, hp: 3000 }, exposed: true,
    attackers: group, actorId: 'a0', nearbyDefenders: 1, actorTakingNexusFire: false }).feasible, true);
});

test('an idle Nexus holds its first volley until attackers enter range', () => {
  const result = evaluateNexusFinish({ nexus: { ...nexus, hp: 10, volleyActive: false,
    attackTimer: 0, volleyShotsRemaining: 5 }, exposed: true,
    attackers: [attacker({ hp: 100, distance: 275, attackRange: 180, approachSpeed: 85 })],
    actorId: 'blue-carry', nearbyDefenders: 0, actorTakingNexusFire: false });
  assert.equal(result.feasible, false);
  assert.ok(Math.abs(result.estimatedSurvivalSeconds - 1.2) < 1e-8);
});
