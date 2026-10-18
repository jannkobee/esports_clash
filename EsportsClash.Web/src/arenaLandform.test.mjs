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
    assert.equal(blue.x + red.x, 2600); assert.equal(blue.y, red.y);
    assert.ok(blue.x > NEXUS_X.blue && blue.x < 610);
    assert.ok(lowlandRegionDistance(blue.x, blue.y) > 35, 'Barracks stays on the dry base bank');
  }
  assert.deepEqual(['melee', 'ranged', 'catapult'].map(k => barracksPosition('blue', k).y), [140, 380, 620]);
});

test('every new wave walks from the Nexus into the lane without crossing camp collision', () => {
  for (const team of ['blue', 'red']) for (const type of ['melee', 'caster', 'cannon']) for (let index = 0; index < 3; index++) {
    const m = { ...minionSpawnPosition(team, type, index), team, speed: 90 };
    for (let tick = 0; tick < 240; tick++) {
      const before = { ...m }; advanceLaneMinion(m, 1 / 30);
      assert.ok(Math.hypot(m.x - before.x, m.y - before.y) <= 3.000001);
      assert.ok(ROCK_TERRAIN.every(r => Math.hypot(m.x - r.x, m.y - r.y) > r.radius + 10));
    }
    assert.ok(Math.abs(m.y - LANE_Y) < .01);
    assert.ok(team === 'blue' ? m.x > 610 : m.x < 1990);
  }
});

test('expanded well heals north and south, matches its ellipse and leaves Nexus finishing legal', () => {
  for (const team of ['blue', 'red']) {
    const enemy = team === 'blue' ? 'red' : 'blue';
    for (const dy of [-220, 0, 220]) assert.ok(isInsideHealingWell(team, { x: WELL_X[team], y: LANE_Y + dy }));
    assert.equal(isInsideHealingWell(team, { x: WELL_X[team], y: LANE_Y + WELL_RADII.y + 1 }), false);
    assert.equal(isInsideHealingWell(team, { x: NEXUS_X[team], y: LANE_Y }), false);
    assert.equal(isInsideEnemyWellBeam(enemy, { x: NEXUS_X[team], y: LANE_Y }), false);
  }
});

test('forested lowlands remain traversable around the central stone ridge', () => {
  for (const x of [460, 2140]) for (const y of [200, 380, 620]) {
    const from = { x: x - 5, y }, to = { x: x + 5, y };
    assert.deepEqual(resolveRockTerrainMovement(from, to), to);
  }
  assert.ok(lowlandRegionDistance(1300, 130) < 0);
  assert.ok(lowlandRegionDistance(1300, 610) < 0);
  assert.ok(lowlandRegionDistance(1300, 380) > 0);
  assert.ok(lowlandRegionDistance(235, 380) > 0);
});

test('simulation preserves six barracks and spawns all three creep classes at the Nexus', () => {
  const sim = createSimulationState({seed: 42});
  for (const team of ['blue','red']) for (const kind of ['melee','ranged','catapult']) {
    const st = sim.structures.find(s => s.team === team && s.barracksKind === kind);
    const p = barracksPosition(team, kind); assert.equal(st.x,p.x); assert.equal(st.y,p.y);
  }
  sim.waveCount = 2; sim.waveTimer = 0; stepSimulation(sim, 1/30);
  for (const team of ['blue','red']) for (const type of ['melee','caster','cannon']) {
    const creeps = sim.minions.filter(m => m.team === team && m.type === type);
    assert.equal(creeps.length,type === 'cannon' ? 1 : 3);
    creeps.forEach((m,index) => {
      const p = minionSpawnPosition(team,type,index);
      assert.ok(Math.hypot(p.x-NEXUS_X[team],p.y-LANE_Y) < 100);
      assert.ok(Math.hypot(m.x-p.x,m.y-p.y) <= m.speed/30 + .001);
    });
  }
});
