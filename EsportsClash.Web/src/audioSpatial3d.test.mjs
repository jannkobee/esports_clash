import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sound } from './audio.ts';

test('calculateSpatialPan computes stereo panning from camera position', () => {
  // Center sound: 0 pan
  const centerPan = sound.calculateSpatialPan(1300, 1300, 400);
  assert.equal(centerPan, 0);

  // Sound to the left of camera
  const leftPan = sound.calculateSpatialPan(1000, 1300, 400);
  assert.ok(leftPan < 0, 'Sound to left of camera should have negative pan');
  assert.ok(leftPan >= -0.85, 'Pan should not exceed -0.85 limit');

  // Sound to the right of camera
  const rightPan = sound.calculateSpatialPan(1600, 1300, 400);
  assert.ok(rightPan > 0, 'Sound to right of camera should have positive pan');
  assert.ok(rightPan <= 0.85, 'Pan should not exceed 0.85 limit');

  // Extreme off-screen sounds clamped to [-0.85, 0.85]
  const extremeLeft = sound.calculateSpatialPan(100, 2000, 400);
  assert.equal(extremeLeft, -0.85);

  const extremeRight = sound.calculateSpatialPan(2500, 500, 400);
  assert.equal(extremeRight, 0.85);
});

test('calculateSpatialGain computes distance falloff attenuation', () => {
  // Sound at camera position
  const closeGain = sound.calculateSpatialGain(1300, 720, 1300, 720, 1600);
  assert.equal(closeGain, 1.0);

  // Sound at moderate distance
  const midGain = sound.calculateSpatialGain(1700, 720, 1300, 720, 1600);
  assert.ok(midGain < 1.0 && midGain > 0.25, 'Mid distance should have moderate attenuation');

  // Sound beyond max distance
  const farGain = sound.calculateSpatialGain(0, 0, 2600, 1440, 1600);
  assert.equal(farGain, 0.25, 'Beyond max distance should fall back to minimum floor');
});

test('3D combat spatial sound methods execute without throwing in node environment', () => {
  // In Node environment, Web Audio API is not present, methods should safely degrade
  assert.doesNotThrow(() => sound.playTurretShot(1120, 1300));
  assert.doesNotThrow(() => sound.playStructureCollapse(820, 1300));
  assert.doesNotThrow(() => sound.playDragonRoar(1300, 1300));
  assert.doesNotThrow(() => sound.playDragonBreath(1300, 1300));
  assert.doesNotThrow(() => sound.playGolemSlam(1300, 1300));
  assert.doesNotThrow(() => sound.playMinionAttack('melee', 1200, 1300));
  assert.doesNotThrow(() => sound.playMinionAttack('caster', 1200, 1300));
  assert.doesNotThrow(() => sound.playMinionAttack('cannon', 1200, 1300));
  assert.doesNotThrow(() => sound.playFrogCroak(1300, 1300));
});

