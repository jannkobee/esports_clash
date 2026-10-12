import test from 'node:test';
import assert from 'node:assert/strict';
import { startCreepAttack, advanceCreepAttack, creepAttackPose, advanceTargetedProjectile } from './creepAttackTiming.ts';
import { drawChampionSprite } from './components/ChampionSpriteRenderer.ts';

test('creep attacks wind up, release exactly once, then recover within the existing cooldown', () => {
  for (const period of [0.18, 0.5, 1, 2]) {
    let state = startCreepAttack('creep', 'minion', 50, 0, period);
    assert.ok(state.releaseAt < state.recoverAt && state.recoverAt < period);
    assert.equal(advanceCreepAttack(state, state.releaseAt - 0.001, false, true).release, false);
    const release = advanceCreepAttack(state, state.releaseAt, false, true);
    assert.equal(release.release, true);
    state = release.state;
    assert.equal(advanceCreepAttack(state, state.releaseAt, false, true).release, false);
    assert.equal(advanceCreepAttack(state, state.recoverAt + 0.1, false, true).state, undefined);
  }
});

test('interrupts, dead/lost targets, and out-of-range targets never release a queued strike', () => {
  for (const kind of ['minion', 'camp', 'dragon']) {
    const state = startCreepAttack('target', kind, 50, 0, 1);
    assert.deepEqual(advanceCreepAttack(state, 0.3, true, true), { release: false });
    assert.deepEqual(advanceCreepAttack(state, 0.3, false, false), { release: false });
    assert.deepEqual(advanceCreepAttack(state, 0.1, true, false), { release: false });
  }
});

test('presentation is read-only and its strike starts only after simulation release', () => {
  const state = Object.freeze(startCreepAttack('target', 'minion', 50, 2, 1));
  assert.equal(creepAttackPose(state, 2.12).windup, 0.5);
  assert.equal(creepAttackPose(state, 2.4).strike, 0);
  const released = advanceCreepAttack(state, state.releaseAt, false, true).state;
  assert.equal(creepAttackPose(released, state.releaseAt).strike, 1);
  assert.deepEqual(creepAttackPose(released, state.recoverAt), { windup: 0, strike: 0 });
  assert.equal(state.released, false);
});

test('ranged arrivals clamp travel including fast shots and never deal pre-arrival damage', () => {
  let shot = { x: 0, y: 0 };
  shot = advanceTargetedProjectile(shot, { x: 100, y: 0 }, 600, 1 / 30);
  assert.equal(shot.x, 20); assert.equal(shot.arrived, false);
  const end = advanceTargetedProjectile(shot, { x: 23, y: 0 }, 1800, 1 / 30);
  assert.equal(end.x, 23); assert.equal(end.arrived, true);
  assert.equal(advanceTargetedProjectile(end, end, 500, 1 / 30).arrived, true);
});

test('1x and 4x frame grouping produce identical releases, arrivals and damage', () => {
  const run = ticksPerFrame => {
    let state = startCreepAttack('creep', 'minion', 50, 0, 1), shot, hp = 100;
    const events = [];
    for (let frame = 0; frame < 60 / ticksPerFrame; frame++) for (let sub = 0; sub < ticksPerFrame; sub++) {
      const tick = frame * ticksPerFrame + sub, now = tick / 30;
      if (shot) {
        shot = advanceTargetedProjectile(shot, { x: 120, y: 0 }, 600, 1 / 30);
        if (shot.arrived) { hp -= 50; events.push(['impact', tick, hp]); shot = undefined; }
      }
      if (state) {
        const next = advanceCreepAttack(state, now, false, true);
        state = next.state;
        if (next.release) { events.push(['release', tick]); shot = { x: 0, y: 0 }; }
      }
    }
    assert.equal(hp, 50);
    return events;
  };
  assert.deepEqual(run(1), run(4));
});

test('melee and ranged sprites accept windup, strike and recovery on a read-only clock', () => {
  const ctx = new Proxy({}, { get: (obj, key) => key in obj ? obj[key]
    : key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
    set: (obj, key, value) => { obj[key] = value; return true; } });
  for (const championName of ['Valkira', 'Astra']) for (const basicAttackPose of [{ windup: 1, strike: 0 }, { windup: 0, strike: 1 }, { windup: 0, strike: 0 }]) {
    assert.doesNotThrow(() => drawChampionSprite(ctx, { championName, x: 0, y: 0, facing: 'right',
      animState: 'attack', animTime: 0.24, team: 'blue', isStunned: false, isCharmed: false, isInBush: false, basicAttackPose }));
  }
});
