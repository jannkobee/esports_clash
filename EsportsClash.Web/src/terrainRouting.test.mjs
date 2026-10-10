import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMP_ROCK_RINGS, ROCK_TERRAIN, rockApproachWaypoint,
  resolveRockTerrainMovement, isInsideRockTerrain } from './arenaRules.ts';
import { stepLeashedMonster } from './neutralAggroRules.ts';
import { ARENA_WIDTH, WELL_X, NEXUS_TOWER_X } from './arenaLayout.ts';

function walkRoute(start, goal, radius = 13) {
  const walker = { x: start.x, y: start.y };
  for (let tick = 0; tick < 1000; tick++) {
    if (Math.hypot(walker.x - goal.x, walker.y - goal.y) < 8) return true;
    const waypoint = rockApproachWaypoint(walker, goal, radius);
    const distance = Math.hypot(waypoint.x - walker.x, waypoint.y - walker.y);
    if (distance < 0.001) return false;
    const next = resolveRockTerrainMovement(walker, {
      x: walker.x + (waypoint.x - walker.x) / distance * Math.min(3, distance),
      y: walker.y + (waypoint.y - walker.y) / distance * Math.min(3, distance),
    }, radius);
    assert.equal(isInsideRockTerrain(next.x, next.y, radius), false);
    // Match the live champion bounds; a route outside them would pin the avatar.
    Object.assign(walker, { x: Math.max(40, Math.min(ARENA_WIDTH - 40, next.x)), y: Math.max(80, Math.min(620, next.y)) });
  }
  return false;
}

test('all camp-to-camp rotations exit the current enclosure and reach the next camp', () => {
  const failures = [];
  for (const start of CAMP_ROCK_RINGS) for (const goal of CAMP_ROCK_RINGS) {
    if (start.id !== goal.id && !walkRoute(start, goal)) failures.push(`${start.id} -> ${goal.id}`);
  }
  assert.deepEqual(failures, []);
});

test('both wells and ramp flanks can reach every camp and return home', () => {
  const failures = [];
  for (const start of [{ x: WELL_X.blue, y: 380 }, { x: WELL_X.red, y: 380 },
    { x: NEXUS_TOWER_X.blue + 120, y: 245 }, { x: NEXUS_TOWER_X.red - 120, y: 245 },
    { x: NEXUS_TOWER_X.blue + 120, y: 515 }, { x: NEXUS_TOWER_X.red - 120, y: 515 }]) {
    for (const goal of CAMP_ROCK_RINGS) {
      if (!walkRoute(start, goal)) failures.push(`${start.x},${start.y} -> ${goal.id}`);
      if (!walkRoute(goal, start)) failures.push(`${goal.id} -> ${start.x},${start.y}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('large neutral monsters return through their own gates with full body clearance', () => {
  for (const ring of CAMP_ROCK_RINGS) {
    const radius = ring.stones === 16 ? 32 : 23;
    const outside = { x: ring.x + 100, y: ring.y + Math.sin(ring.entrance) * 130 };
    assert.equal(walkRoute(outside, ring, radius), true, ring.id);
  }
});

test('camp approaches recover from every walkable compass side within arena bounds', () => {
  const failures = [];
  for (const ring of CAMP_ROCK_RINGS) for (let side = 0; side < 12; side++) {
    const angle = side * Math.PI / 6;
    const span = ring.radius + ring.stoneRadius + 25;
    const start = { x: ring.x + Math.cos(angle) * span,
      y: Math.max(80, Math.min(620, ring.y + Math.sin(angle) * span)) };
    if (isInsideRockTerrain(start.x, start.y, 13)) continue;
    if (!walkRoute(start, ring)) failures.push(`${ring.id} side ${side}`);
  }
  assert.deepEqual(failures, []);
});

test('neutral chase and reset use the same route while preserving leash and movement speed', () => {
  const ring = CAMP_ROCK_RINGS[0];
  const monster = { x: ring.x, y: ring.y };
  const target = { x: ring.x + 125, y: ring.y + 110 };
  for (const chasing of [true, false]) {
    const goal = chasing ? target : ring;
    for (let tick = 0; tick < 400 && Math.hypot(monster.x - goal.x, monster.y - goal.y) > 4; tick++) {
      const step = stepLeashedMonster(monster.x, monster.y, ring.x, ring.y,
        chasing ? target : null, 1 / 30, 72, 220,
        destination => rockApproachWaypoint(monster, destination, 23));
      assert.equal(step.chasing, chasing);
      assert.ok(Math.hypot(step.x - monster.x, step.y - monster.y) <= (chasing ? 72 : 72 * 1.35) / 30 + 0.001);
      Object.assign(monster, resolveRockTerrainMovement(monster, step, 23));
      assert.equal(isInsideRockTerrain(monster.x, monster.y, 23), false);
    }
    assert.ok(Math.hypot(monster.x - goal.x, monster.y - goal.y) <= 4, 'must arrive without changing leash rules');
  }
});

test('routing repairs embedded positions even when no movement was requested', () => {
  for (const radius of [13, 23, 32]) {
    for (const rock of ROCK_TERRAIN) {
      const repaired = resolveRockTerrainMovement(rock, rock, radius);
      assert.equal(isInsideRockTerrain(repaired.x, repaired.y, radius), false);
    }
  }
});

test('a route can be redirected after displacement, a stalled waypoint, or a changed destination', () => {
  const walker = { x: 576, y: 170 };
  const oldGoal = CAMP_ROCK_RINGS.find(ring => ring.id === 'j_red_blue_buff');
  for (let tick = 0; tick < 35; tick++) {
    const waypoint = rockApproachWaypoint(walker, oldGoal);
    assert.equal(isInsideRockTerrain(waypoint.x, waypoint.y, 13), false);
  }
  Object.assign(walker, { x: 667, y: 575 });
  const waypoint = rockApproachWaypoint(walker, oldGoal);
  assert.equal(isInsideRockTerrain(waypoint.x, waypoint.y, 13), false);
  // Keep the same actor object to exercise cached-route invalidation.
  const newGoal = CAMP_ROCK_RINGS.find(ring => ring.id === 'j_blue_blue_buff');
  for (let tick = 0; tick < 1000 && Math.hypot(walker.x - newGoal.x, walker.y - newGoal.y) > 5; tick++) {
    const next = rockApproachWaypoint(walker, newGoal);
    const d = Math.hypot(next.x - walker.x, next.y - walker.y);
    assert.ok(d > 0);
    Object.assign(walker, resolveRockTerrainMovement(walker, {
      x: walker.x + (next.x - walker.x) / d * Math.min(3, d),
      y: walker.y + (next.y - walker.y) / d * Math.min(3, d),
    }, 13));
  }
  assert.ok(Math.hypot(walker.x - newGoal.x, walker.y - newGoal.y) <= 5);
});
