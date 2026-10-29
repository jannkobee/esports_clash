import { mapLayoutY, PLAY_MIN_Y, PLAY_MAX_Y, laneY, ARENA_WIDTH, ARENA_HEIGHT, BARRACKS_X, NEXUS_TOWER_X } from './arenaLayout.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { barracksPosition, minionSpawnPosition, advanceLaneMinion, lowlandRegionDistance, WELL_RADII } from './arenaLandform.ts';
import { WELL_X, NEXUS_X, LANE_Y } from './arenaLayout.ts';
import { isInsideHealingWell, isInsideEnemyWellBeam } from './baseSafetyRules.ts';
import { createSimulationState, stepSimulation } from './matchSimulationEngine.ts';
import { ROCK_TERRAIN, resolveRockTerrainMovement } from './arenaRules.ts';

test('three real barracks occupy the north, middle and south of each broad base', () => {
  for (const kind of ['melee', 'ranged', 'catapult']) {
    const blue = barracksPosition('blue', kind), red = barracksPosition('red', kind);
    assert.equal(blue.x + red.x, ARENA_WIDTH);
    assert.equal(blue.y - laneY(BARRACKS_X.blue), kind === 'melee' ? -240 : kind === 'catapult' ? 240 : 0);
    assert.equal(red.y - laneY(BARRACKS_X.red), kind === 'melee' ? -240 : kind === 'catapult' ? 240 : 0);
    assert.ok(blue.x > NEXUS_X.blue && blue.x < NEXUS_TOWER_X.blue);
    assert.ok(lowlandRegionDistance(blue.x, blue.y) > 35, 'Barracks stays on the dry base bank');
  }
  assert.deepEqual(
    ['melee', 'ranged', 'catapult'].map(k => barracksPosition('blue', k).y),
    [laneY(BARRACKS_X.blue) - 240, laneY(BARRACKS_X.blue), laneY(BARRACKS_X.blue) + 240]
  );
});

test('every new wave walks from the Nexus into the lane without crossing camp collision', () => {
  for (const team of ['blue', 'red']) for (const type of ['melee', 'caster', 'cannon']) for (let index = 0; index < 3; index++) {
    const m = { ...minionSpawnPosition(team, type, index), team, speed: 90 };
    for (let tick = 0; tick < 240; tick++) {
      const before = { ...m }; advanceLaneMinion(m, 1 / 30);
      assert.ok(Math.hypot(m.x - before.x, m.y - before.y) <= 3.000001);
      assert.ok(ROCK_TERRAIN.every(r => Math.hypot(m.x - r.x, m.y - r.y) > r.radius + 10));
    }
    assert.ok(Math.abs(m.y - laneY(m.x)) < 1.0);
    assert.ok(team === 'blue' ? m.x > NEXUS_TOWER_X.blue : m.x < NEXUS_TOWER_X.red);
  }
});

test('expanded well heals north and south, matches its ellipse and leaves Nexus finishing legal', () => {
  for (const team of ['blue', 'red']) {
    const enemy = team === 'blue' ? 'red' : 'blue';
    const wy = laneY(WELL_X[team]);
    const ny = laneY(NEXUS_X[team]);
    for (const dy of [-220, 0, 220]) assert.ok(isInsideHealingWell(team, { x: WELL_X[team], y: wy + dy }));
    assert.equal(isInsideHealingWell(team, { x: WELL_X[team], y: wy + WELL_RADII.y + 1 }), false);
    assert.equal(isInsideHealingWell(team, { x: NEXUS_X[team], y: ny }), false);
    assert.equal(isInsideEnemyWellBeam(enemy, { x: NEXUS_X[team], y: ny }), false);
  }
});

test('forested lowlands remain traversable around the central stone ridge', () => {
  for (const x of [400, 2400]) for (const y of [200, 380, 620].map(mapLayoutY)) {
    const from = { x: x - 5, y }, to = { x: x + 5, y };
    assert.deepEqual(resolveRockTerrainMovement(from, to), to);
  }
  assert.ok(lowlandRegionDistance(1400, 240) < 0);
  assert.ok(lowlandRegionDistance(1400, 1200) < 0);
  assert.ok(lowlandRegionDistance(1400, 720) > 0);
  assert.ok(lowlandRegionDistance(260, laneY(260)) > 0);
});

test('simulation preserves six barracks and spawns all three creep classes at the Nexus', () => {
  const sim = createSimulationState({ seed: 42 });
  for (const team of ['blue', 'red']) for (const kind of ['melee', 'ranged', 'catapult']) {
    const st = sim.structures.find(s => s.team === team && s.barracksKind === kind);
    const p = barracksPosition(team, kind); assert.equal(st.x, p.x); assert.equal(st.y, p.y);
  }
  sim.waveCount = 2; sim.waveTimer = 0; stepSimulation(sim, 1 / 30);
  for (const team of ['blue', 'red']) for (const type of ['melee', 'caster', 'cannon']) {
    const creeps = sim.minions.filter(m => m.team === team && m.type === type);
    assert.equal(creeps.length, type === 'cannon' ? 1 : 3);
    creeps.forEach((m, index) => {
      const p = minionSpawnPosition(team, type, index);
      assert.ok(Math.hypot(p.x - NEXUS_X[team], p.y - laneY(NEXUS_X[team])) < 100);
      assert.ok(Math.hypot(m.x - p.x, m.y - p.y) <= m.speed / 30 + .001);
    });
  }
});
