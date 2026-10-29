import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCrowdMovement, creepBodyRadius } from './unitCollision.ts';
import { captureUnitCollisionStarts, resolveArenaUnitCollisions } from './arenaUnitCollision.ts';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const body = (id, from, to = from, radius = 10, soft = true, locked = false) => ({ id, from, to, radius, soft, locked });
const toward = (from, to, step) => {
  const d = distance(from, to), fraction = d ? Math.min(1, step / d) : 0;
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
};

test('creeps steer before touching an avatar, pass on a stable side and spend only their walking budget', () => {
  let p = { x: -80, y: 0 };
  const obstacle = { x: 0, y: 0 }, goal = { x: 100, y: 0 };
  let startedEarly = false, side = 0;
  for (let tick = 0; tick < 160; tick++) {
    const input = [body('creep', p, toward(p, goal, 2)), body('avatar', obstacle, obstacle, 17, false)];
    const snapshot = structuredClone(input);
    const result = resolveCrowdMovement(input, 1 / 30);
    assert.deepEqual([...result], [...resolveCrowdMovement([...input].reverse(), 1 / 30)]);
    assert.deepEqual(input, snapshot);
    const next = result.get('creep');
    assert.deepEqual(result.get('avatar'), obstacle, 'creep must not shove the avatar');
    assert.ok(distance(p, next) <= 2.000001, 'dodging must not add speed');
    assert.ok(distance(next, obstacle) >= 27 - .05, `creep cut through avatar at ${tick}: ${distance(next, obstacle)}`);
    if (Math.abs(next.y) > .1 && p.x < -35) startedEarly = true;
    if (next.x < 20 && Math.abs(next.y) > 1) {
      side ||= Math.sign(next.y);
      assert.equal(Math.sign(next.y), side, 'dodge side must not oscillate');
    }
    p = next;
  }
  assert.ok(startedEarly);
  assert.ok(p.x > 90, `creep did not pass: ${JSON.stringify(p)}`);
});

test('creeps can dodge left or right and select the open side beside terrain', () => {
  const p = { x: -40, y: 0 };
  for (const offset of [-5, 5]) {
    const r = resolveCrowdMovement([body('creep', p, { x: -37, y: 0 }),
      body('avatar', { x: 0, y: offset }, undefined, 17, false, true)], 1 / 30);
    assert.equal(Math.sign(r.get('creep').y), -Math.sign(offset));
  }
  const r = resolveCrowdMovement([body('creep', p, { x: -37, y: 0 }),
    body('avatar', { x: 0, y: 0 }, undefined, 17, false, true)], 1 / 30, point => point.y <= 0);
  assert.ok(r.get('creep').y < 0, 'blocked preferred side must yield to the open side');
});

test('head-on creeps pass each other at different tick rates without flipping sides or gaining speed', () => {
  for (const dt of [1 / 60, 1 / 30, 1 / 15]) {
    let a = { x: -70, y: 0 }, b = { x: 70, y: 0 };
    const step = 60 * dt;
    for (let tick = 0; tick < 6 / dt; tick++) {
      const r = resolveCrowdMovement([body('a', a, toward(a, { x: 90, y: 0 }, step)),
        body('b', b, toward(b, { x: -90, y: 0 }, step))], dt);
      const na = r.get('a'), nb = r.get('b');
      assert.ok(distance(a, na) <= step + .000001);
      assert.ok(distance(b, nb) <= step + .000001);
      assert.ok(distance(na, nb) >= 20 - .05, `head-on overlap at dt=${dt}, tick=${tick}`);
      if (a.x < 0 && b.x > 0) {
        assert.ok(na.y >= -.000001 && nb.y <= .000001, 'head-on creeps must keep their dodge side');
      }
      a = na; b = nb;
    }
    assert.ok(a.x > 80 && b.x < -80, `head-on deadlock at dt=${dt}`);
  }
});

test('soft creep contacts cannot body-block a narrow passage; explicit hard bodies retain swept contact', () => {
  for (const softMover of [false, true]) {
    const r = resolveCrowdMovement([body('walker', { x: -80, y: 0 }, { x: 80, y: 0 }, 17, softMover),
      body('creep', { x: 0, y: 0 }, undefined, 10, true, true)], 1 / 30, p => Math.abs(p.y) < .001);
    assert.deepEqual(r.get('walker'), { x: 80, y: 0 }, 'creeps cannot become solid walls');
  }
  const r = resolveCrowdMovement([body('walker', { x: -80, y: 0 }, { x: 80, y: 0 }, 17, false),
    body('avatar', { x: 0, y: 0 }, undefined, 17, false, true)], 1 / 30, p => Math.abs(p.y) < .001);
  assert.ok(r.get('walker').x < -34, 'explicit hard bodies must retain swept solid contact');
});

test('coincident idle creeps spread apart without displacing a stationary avatar', () => {
  let units = Array.from({ length: 7 }, (_, i) => ({ id: `creep-${i}`, x: 0, y: 0 }));
  const avatar = body('avatar', { x: 0, y: 0 }, undefined, 17, false);
  for (let tick = 0; tick < 240; tick++) {
    const result = resolveCrowdMovement([...units.map(u => body(u.id, u)), avatar], 1 / 30);
    assert.deepEqual(result.get('avatar'), { x: 0, y: 0 });
    units = units.map(u => {
      const next = result.get(u.id);
      assert.ok(distance(u, next) <= 1.200001);
      return { id: u.id, ...next };
    });
  }
  for (let i = 0; i < units.length; i++) {
    assert.ok(distance(units[i], avatar.from) >= 27 - .05);
    for (let j = i + 1; j < units.length; j++) assert.ok(distance(units[i], units[j]) >= 20 - .05);
  }
});

test('crowded mixed waves keep flowing around an avatar and settle without stacking', () => {
  let units = Array.from({ length: 24 }, (_, i) => ({ id: `creep-${String(i).padStart(2, '0')}`,
    x: -85 - Math.floor(i / 4) * 24, y: (i % 4 - 1.5) * 24 }));
  const anchor = body('avatar', { x: 0, y: 0 }, undefined, 17, false, true);
  for (let tick = 0; tick < 210; tick++) {
    const input = units.map(u => body(u.id, u, toward(u, { x: 180, y: u.y * .98 }, 2)));
    const r = resolveCrowdMovement([...input, anchor], 1 / 30);
    units = units.map(u => {
      const next = r.get(u.id);
      assert.ok(distance(u, next) <= 2.000001);
      return { id: u.id, ...next };
    });
  }
  assert.ok(units.filter(u => u.x > 60).length > 20, 'crowded creeps must keep advancing');
  for (let tick = 0; tick < 180; tick++) {
    const r = resolveCrowdMovement([...units.map(u => body(u.id, u)), anchor], 1 / 30);
    units = units.map(u => ({ id: u.id, ...r.get(u.id) }));
  }
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    assert.ok(distance(units[i], units[j]) >= 20 - .05, `resting stack: ${i},${j}`);
  }
});

test('arena adapter makes every lane/summoned creep soft and preserves locked movement', () => {
  const variants = [{ type: 'melee' }, { type: 'caster' }, { type: 'cannon' }, { siegeGolem: true },
    { summonedBearOwnerId: 'owner' }, { prismWardenOwnerId: 'owner' }];
  for (const variant of variants) {
    const radius = creepBodyRadius(variant);
    const avatar = { id: 'avatar', x: 1300, y: 380, isAlive: true, isRecalling: true };
    const creep = { id: 'creep', ...variant, x: 1300 - radius - 25, y: 380, isAlive: true };
    const starts = captureUnitCollisionStarts([avatar, creep]);
    creep.x += 3;
    resolveArenaUnitCollisions([avatar], [creep], [], starts, 1 / 30);
    assert.ok(Math.abs(creep.y - 380) > .01, `${JSON.stringify(variant)} did not side-step`);
    assert.deepEqual({ x: avatar.x, y: avatar.y }, { x: 1300, y: 380 });
    assert.ok(distance(starts.get('creep'), creep) <= 3.000001);

    creep.stunTimer = 1;
    const lockedStart = captureUnitCollisionStarts([avatar, creep]);
    const snapshot = structuredClone(creep);
    resolveArenaUnitCollisions([avatar], [creep], [], lockedStart, 1 / 30);
    assert.deepEqual(creep, snapshot, 'spacing cannot move a controlled creep');
  }
});

test('overlap repair respects even a very small walking budget and pauses freeze spacing', () => {
  const input = [body('creep', { x: 0, y: 0 }, { x: .1, y: 0 }),
    body('avatar', { x: 0, y: 0 }, undefined, 17, false, true)];
  assert.ok(distance(input[0].from, resolveCrowdMovement(input, 1 / 30).get('creep')) <= .100001);
  assert.deepEqual(resolveCrowdMovement(input, 0).get('creep'), input[0].from);
});

test('neutral monsters use the same dodge rules while the anchored dragon keeps its authored position', () => {
  const avatar = { id: 'avatar', x: 1300, y: 380, isAlive: true };
  const monster = { id: 'camp', x: 1245, y: 380, isAlive: true };
  const dragon = { id: 'dragon', x: 1400, y: 380, isAlive: true };
  const starts = captureUnitCollisionStarts([avatar, monster, dragon]);
  monster.x += 2.4;
  resolveArenaUnitCollisions([avatar], [], [{ unit: monster, radius: 23 },
    { unit: dragon, radius: 32, locked: true }], starts, 1 / 30);
  assert.ok(Math.abs(monster.y - 380) > .01, 'a moving neutral monster must side-step');
  assert.ok(distance(starts.get(monster.id), monster) <= 2.400001);
  assert.deepEqual(avatar, { id: 'avatar', x: 1300, y: 380, isAlive: true });
  assert.deepEqual(dragon, { id: 'dragon', x: 1400, y: 380, isAlive: true });
});
