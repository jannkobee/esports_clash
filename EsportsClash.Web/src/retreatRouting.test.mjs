import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRetreatPlan, isRetreatDestinationSafe, shouldKeepRetreatPlan } from './retreatRouting.ts';

const actor = (overrides = {}) => ({
  id: 'blue-1', team: 'blue', x: 1450, y: 380, healthFraction: 0.42,
  iq: 82, teamfight: 78, hasEscapeAbility: false, ...overrides,
});

const input = (overrides = {}) => ({
  actor: actor(), now: 10, laneY: 380, well: { x: 65, y: 380 },
  enemies: [{ id: 'red-1', team: 'red', x: 1660, y: 380, healthFraction: 0.8, isAlive: true }],
  allies: [], structures: [],
  bushes: [{ id: 'near-bush', x: 1320, y: 235 }],
  isPassable: () => true,
  routeLength: (from, to) => Math.hypot(to.x - from.x, to.y - from.y),
  ...overrides,
});

test('retreat favors safe homeward routing over a merely nearby bush', () => {
  const plan = chooseRetreatPlan(input());
  assert.ok(plan);
  assert.notEqual(plan.kind, 'bush');
  assert.ok(plan.x < 1450, 'blue must retreat toward home');
});

test('tower range, enemy proximity, impassability and unreachable routes are hard gates', () => {
  const guardedBush = { id: 'guarded', x: 1250, y: 280 };
  const tower = { id: 'red-tower', team: 'red', type: 'outer_tower', x: 1300, y: 380, range: 280, isAlive: true };
  assert.equal(isRetreatDestinationSafe(guardedBush, actor(), [], [tower], () => true), false);
  assert.equal(isRetreatDestinationSafe({ x: 1000, y: 380 }, actor(), [{ id: 'enemy', team: 'red', x: 1090, y: 380, healthFraction: 1, isAlive: true }], [], () => true), false);

  const plan = chooseRetreatPlan(input({
    bushes: [guardedBush], structures: [tower],
    routeLength: (_from, to) => to.x === 1170 ? Infinity : Math.hypot(to.x - 1450, to.y - 380),
  }));
  assert.ok(plan);
  assert.notEqual(plan.kind, 'bush');
  assert.notEqual(plan.x, 1170, 'unreachable home-lane destination must be rejected');
});

test('safe teammates and allied towers are valid alternatives without weakening safety', () => {
  const plan = chooseRetreatPlan(input({
    actor: actor({ x: 1050, healthFraction: 0.28, teamfight: 95 }),
    enemies: [{ id: 'red-1', team: 'red', x: 1450, y: 380, healthFraction: 1, isAlive: true }],
    allies: [{ id: 'blue-tank', team: 'blue', x: 800, y: 380, healthFraction: 0.9, isAlive: true }],
    structures: [{ id: 'blue-inner', team: 'blue', type: 'inner_tower', x: 830, y: 380, range: 280, isAlive: true }],
  }));
  assert.ok(plan);
  assert.ok(['allied-tower', 'teammate', 'home-lane', 'open-ground'].includes(plan.kind));
  assert.ok(plan.x < 1050);
});

test('retreat plans commit briefly, then replan immediately when their destination becomes unsafe', () => {
  const plan = chooseRetreatPlan(input());
  assert.ok(plan);
  const base = input();
  assert.equal(shouldKeepRetreatPlan(plan, base), true);
  const enemyAtPlan = { id: 'red-close', team: 'red', x: plan.x + 20, y: plan.y, healthFraction: 1, isAlive: true };
  assert.equal(shouldKeepRetreatPlan(plan, { ...base, enemies: [enemyAtPlan] }), false);
});
