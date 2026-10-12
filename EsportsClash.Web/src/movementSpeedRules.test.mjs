import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORDINARY_MOVEMENT_BASE_SPEED,
  STEALTH_MOVEMENT_BONUS,
  TOWER_EVACUATION_BASE_SPEED,
  WARHORN_AURA_MOVEMENT_BONUS,
  retreatSpeedBreakdown,
} from './movementSpeedRules.ts';

test('ordinary retreat has no blanket speed advantage over normal routing', () => {
  const speed = retreatSpeedBreakdown({});

  assert.equal(ORDINARY_MOVEMENT_BASE_SPEED, 85);
  assert.equal(speed.base, ORDINARY_MOVEMENT_BASE_SPEED);
  assert.equal(speed.total, 85);
});

test('boots, wind orbs, stealth, and Warhorn remain explicit additive effects', () => {
  const speed = retreatSpeedBreakdown({
    bootsMoveSpeed: 20,
    orbMoveSpeed: 7.5,
    stealthActive: true,
    warhornAuraActive: true,
  });

  assert.deepEqual(speed, {
    base: 85,
    boots: 20,
    orbs: 7.5,
    stealth: STEALTH_MOVEMENT_BONUS,
    warhornAura: WARHORN_AURA_MOVEMENT_BONUS,
    total: 192.5,
  });
  assert.equal(WARHORN_AURA_MOVEMENT_BONUS, 20);
});

test('failed-dive evacuation has no rescue sprint after a bad dive', () => {
  const speed = retreatSpeedBreakdown({ emergencyTowerEvacuation: true });

  assert.equal(TOWER_EVACUATION_BASE_SPEED, 105);
  assert.equal('evacuationSprint' in speed, false);
  assert.equal(speed.total, 105);
});

test('invalid negative stat inputs cannot slow a retreat', () => {
  const speed = retreatSpeedBreakdown({ bootsMoveSpeed: -20, orbMoveSpeed: -4 });
  assert.equal(speed.boots, 0);
  assert.equal(speed.orbs, 0);
  assert.equal(speed.total, ORDINARY_MOVEMENT_BASE_SPEED);
});

