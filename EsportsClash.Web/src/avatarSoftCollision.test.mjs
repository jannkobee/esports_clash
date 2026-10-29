import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCrowdMovement } from './unitCollision.ts';
import { captureUnitCollisionStarts, resolveArenaUnitCollisions } from './arenaUnitCollision.ts';
import { laneY } from './arenaLayout.ts';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (point, goal, length) => {
  const d = distance(point, goal), fraction = d ? Math.min(1, length / d) : 0;
  return { x: point.x + (goal.x - point.x) * fraction, y: point.y + (goal.y - point.y) * fraction };
};
const avatarBody = (id, from, to = from, locked = false) => ({
  id, from, to, radius: 17, soft: true, spacingPriority: 1, locked,
});

test('soft avatar contacts compress through a bottleneck without moving locked targets or adding speed', () => {
  let point = { x: -65, y: 0 }, compressed = false;
  const obstacle = avatarBody('anchor', { x: 0, y: 0 }, undefined, true);
  for (let tick = 0; tick < 100; tick++) {
    const input = [avatarBody('walker', point, toward(point, { x: 70, y: 0 }, 2)), obstacle];
    const copy = structuredClone(input);
    const result = resolveCrowdMovement(input, 1 / 30, p => Math.abs(p.y) <= .5);
    assert.deepEqual([...result], [...resolveCrowdMovement([...input].reverse(), 1 / 30, p => Math.abs(p.y) <= .5)]);
    assert.deepEqual(input, copy);
    assert.deepEqual(result.get('anchor'), obstacle.from);
    const next = result.get('walker');
    assert.ok(distance(point, next) <= 2.000001);
    assert.ok(Math.abs(next.y) <= .5);
    compressed ||= distance(next, obstacle.from) < 34;
    point = next;
  }
  assert.ok(compressed, 'a narrow passage may temporarily compress personal space');
  assert.ok(point.x > 65, `avatar remained body-blocked: ${JSON.stringify(point)}`);
});

test('the actual arena adapter lets allied and opposing avatars pass head-on at 15/30/60 Hz', () => {
  for (const opposing of [false, true]) for (const dt of [1 / 15, 1 / 30, 1 / 60]) {
    const a = { id: 'a', x: 1180, y: 380, team: 'blue', isAlive: true };
    const b = { id: 'b', x: 1320, y: 380, team: opposing ? 'red' : 'blue', isAlive: true };
    for (let tick = 0; tick < 6 / dt; tick++) {
      const starts = captureUnitCollisionStarts([a, b]);
      Object.assign(a, toward(a, { x: 1340, y: 380 }, 60 * dt));
      Object.assign(b, toward(b, { x: 1160, y: 380 }, 60 * dt));
      resolveArenaUnitCollisions([a, b], [], [], starts, dt);
      assert.ok(distance(starts.get('a'), a) <= 60 * dt + .000001);
      assert.ok(distance(starts.get('b'), b) <= 60 * dt + .000001);
    }
    assert.ok(a.x > 1330 && b.x < 1170, `head-on block: ${JSON.stringify({ opposing, dt, a, b })}`);
  }
});

test('crowded avatar peers separate gently at rest, while creeps still yield to a stationary avatar', () => {
  const a = { id: 'a', x: 1250, y: laneY(1250), isAlive: true };
  const b = { id: 'b', x: 1255, y: laneY(1255), isAlive: true };
  for (let tick = 0; tick < 90; tick++) {
    const starts = captureUnitCollisionStarts([a, b]);
    resolveArenaUnitCollisions([a, b], [], [], starts, 1 / 30);
    assert.ok(distance(starts.get('a'), a) <= 1.200001);
    assert.ok(distance(starts.get('b'), b) <= 1.200001);
  }
  assert.ok(distance(a, b) >= 33.95);
  const anchor = { id: 'avatar', x: 1300, y: laneY(1300), isAlive: true };
  const creeps = Array.from({ length: 7 }, (_, i) => ({ id: `creep-${i}`, x: 1300, y: laneY(1300), isAlive: true }));
  for (let tick = 0; tick < 180; tick++) {
    const starts = captureUnitCollisionStarts([anchor, ...creeps]);
    resolveArenaUnitCollisions([anchor], creeps, [], starts, 1 / 30);
    assert.deepEqual(anchor, { id: 'avatar', x: 1300, y: laneY(1300), isAlive: true });
  }
  assert.ok(creeps.every(creep => distance(creep, anchor) >= 26.95));
});

test('soft avatar spacing respects pause, control, recall, stasis and forced movement', () => {
  for (const flags of [{ isRecalling: true }, { zhonyaActive: true }, { stunTimer: 1 }, { knockupTimer: 1 },
    { dash: {} }, { hookPull: {} }, { untargetableTimer: 1 }, { isAlive: false }]) {
    const anchor = { id: 'anchor', x: 1300, y: 380, isAlive: true, ...flags };
    const peer = { id: 'peer', x: 1305, y: 380, isAlive: true };
    const starts = captureUnitCollisionStarts([anchor, peer]), copy = structuredClone(anchor);
    resolveArenaUnitCollisions([anchor, peer], [], [], starts, 1 / 30);
    assert.deepEqual(anchor, copy);
  }
  const input = [avatarBody('a', { x: 0, y: 0 }, { x: 2, y: 0 }), avatarBody('b', { x: 0, y: 0 })];
  const paused = resolveCrowdMovement(input, 0);
  assert.deepEqual(paused.get('a'), input[0].from);
  assert.deepEqual(paused.get('b'), input[1].from);
});
