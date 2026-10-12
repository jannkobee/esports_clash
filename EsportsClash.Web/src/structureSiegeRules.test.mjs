import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURE_HP, towerSiegeMultiplier } from './arenaRules.ts';
import { getMinionCrashMultiplier } from './waveClearRules.ts';
import { activeSiegeMultiplier, estimateStructureTimeToDestroy, structureBasicAttackDamage } from './structureSiegeRules.ts';

test('structure basics retain authored and purchased AD but reject champion-only burst procs', () => {
  assert.equal(structureBasicAttackDamage({
    baseAttackDamage: 180,
    persistentAttackBonus: 28,
    criticalBonus: 225,
    championOnHitBonus: 256,
    temporaryCombatMultiplier: 1.15,
  }), 208);
});

test('wave support removes backdoor protection without multiplying a full team by 2.5x', () => {
  assert.equal(getMinionCrashMultiplier([]), 0.28);
  assert.equal(getMinionCrashMultiplier([{ type: 'melee' }]), 1);
  assert.equal(getMinionCrashMultiplier([
    ...Array.from({ length: 6 }, () => ({ type: 'melee' })),
    { type: 'cannon' },
  ]), 1.35);
});

test('dragon siege power applies only to its team and expires after 120 seconds', () => {
  const buff = { team: 'blue', expiresAt: 420, siegeMultiplier: 1.5 };
  assert.equal(activeSiegeMultiplier(buff, 'blue', 419.9), 1.5);
  assert.equal(activeSiegeMultiplier(buff, 'red', 419.9), 1);
  assert.equal(activeSiegeMultiplier(buff, 'blue', 420.1), 1);
  assert.equal(activeSiegeMultiplier(null, 'blue', 100), 1);
});

test('tier health creates a measurable base-defense ramp without an artificial time gate', () => {
  const lateTeam = [
    { attackDamage: 210, attacksPerSecond: 1.12 },
    { attackDamage: 195, attacksPerSecond: 1.18 },
    { attackDamage: 155, attacksPerSecond: 0.95 },
    { attackDamage: 255, attacksPerSecond: 1.5, marksman: true },
    { attackDamage: 125, attacksPerSecond: 0.9 },
  ];
  const wave = getMinionCrashMultiplier([
    ...Array.from({ length: 6 }, () => ({ type: 'melee' })),
    { type: 'cannon' },
  ]);
  const outer = estimateStructureTimeToDestroy(STRUCTURE_HP.outer_tower, lateTeam, wave, towerSiegeMultiplier(540), 845);
  const nexusTower = estimateStructureTimeToDestroy(STRUCTURE_HP.nexus_tower, lateTeam, wave, towerSiegeMultiplier(540), 845);
  assert.ok(outer > 1.4 && outer < 1.6, `late outer TTD was ${outer}`);
  assert.ok(nexusTower > 2.6 && nexusTower < 2.8, `late nexus-tower TTD was ${nexusTower}`);
  assert.ok(nexusTower > outer * 1.75);
});
