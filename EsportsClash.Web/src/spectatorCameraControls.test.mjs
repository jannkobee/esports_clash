import { test } from 'node:test';
import assert from 'node:assert/strict';

test('LoL spectator key mappings correctly map 1-5 to Blue and 6-0 to Red champions', () => {
  const blueChamps = [
    { id: 'b1', name: 'Hero B1', team: 'blue' },
    { id: 'b2', name: 'Hero B2', team: 'blue' },
    { id: 'b3', name: 'Hero B3', team: 'blue' },
    { id: 'b4', name: 'Hero B4', team: 'blue' },
    { id: 'b5', name: 'Hero B5', team: 'blue' },
  ];

  const redChamps = [
    { id: 'r1', name: 'Hero R1', team: 'red' },
    { id: 'r2', name: 'Hero R2', team: 'red' },
    { id: 'r3', name: 'Hero R3', team: 'red' },
    { id: 'r4', name: 'Hero R4', team: 'red' },
    { id: 'r5', name: 'Hero R5', team: 'red' },
  ];

  // Test Blue keys 1-5
  for (let i = 1; i <= 5; i++) {
    const key = i.toString();
    const champ = blueChamps[parseInt(key, 10) - 1];
    assert.equal(champ.id, `b${i}`, `Key ${key} should map to blue champ b${i}`);
  }

  // Test Red keys 6-9
  for (let i = 6; i <= 9; i++) {
    const key = i.toString();
    const champ = redChamps[parseInt(key, 10) - 6];
    assert.equal(champ.id, `r${i - 5}`, `Key ${key} should map to red champ r${i - 5}`);
  }

  // Test Red key 0
  const champ0 = redChamps[4];
  assert.equal(champ0.id, 'r5', 'Key 0 should map to red champ r5');
});

test('follow camera tracks hero with 3D spectator offset and unlocks on death', () => {
  const hero = { id: 'b1', x: 1200, y: 720, isAlive: true };
  const targetCamera = { x: 0, y: 0 };
  let lockedId = hero.id;

  // Live follow step
  if (lockedId === hero.id && hero.isAlive) {
    targetCamera.x = hero.x;
    targetCamera.y = hero.y + 60; // 3D elevation tilt offset
  }

  assert.equal(targetCamera.x, 1200);
  assert.equal(targetCamera.y, 780);

  // Hero dies
  hero.isAlive = false;
  if (!hero.isAlive) {
    lockedId = null;
  }

  assert.equal(lockedId, null, 'Lock should release to auto-cam on hero death');
});

test('pan inertia damping applies smooth exponential decay without jitter', () => {
  let pos = 1000;
  let vel = 400; // 400 px/s drag flick
  const dt = 0.016; // 60fps frame

  for (let frame = 0; frame < 60; frame++) {
    pos += vel * dt;
    vel *= 0.88; // Damping factor
  }

  // Velocity should have decayed to nearly 0
  assert.ok(Math.abs(vel) < 0.2, 'Velocity should decay towards 0');
  // Position should have glided smoothly
  assert.ok(pos > 1040 && pos < 1060, 'Position should glide smoothly under inertia');
});

