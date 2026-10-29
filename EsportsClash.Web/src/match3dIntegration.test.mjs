import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveArenaUnitCollisions } from './arenaUnitCollision.ts';
import { OUTER_TOWER_X, INNER_TOWER_X, NEXUS_TOWER_X, LANE_Y, ARENA_WIDTH } from './arenaLayout.ts';
import { CAMP_ROCK_RINGS } from './arenaRules.ts';
import { ViewerReplay } from './match-viewer/ViewerReplay.ts';

test('live structure collisions physically steer units around tower footprints without clipping', () => {
  const tower = { id: 'tower_blue_outer', x: 1120, y: 720, isAlive: true };
  const structures = [{ unit: tower, radius: 24, locked: true }];
  let unit = { id: 'unit_champion', x: 1080, y: 720, isAlive: true };

  // Unit attempts to walk directly rightward through the center of the tower (y=720)
  for (let tick = 0; tick < 10; tick++) {
    const start = { x: unit.x, y: unit.y, locked: false, alive: true };
    const starts = new Map([['unit_champion', start]]);
    unit.x += 6; // Intended step forward toward tower
    resolveArenaUnitCollisions([unit], [], [], starts, 0.033, structures);
    const dist = Math.hypot(unit.x - tower.x, unit.y - tower.y);
    // Unit must maintain safe collision clearance (tower radius 24 + unit radius 18 = ~42px)
    assert.ok(dist >= 38, `tick ${tick}: unit must not penetrate tower footprint, actual dist: ${dist.toFixed(1)}px`);
  }

  // Verify that unit was steered around the tower (deflected along the y axis)
  assert.ok(Math.abs(unit.y - 720) > 30, `unit was steered around obstacle: y moved from 720 to ${unit.y.toFixed(1)}`);
});

test('destroyed structures do not block units from walking across former footprint', () => {
  const deadTower = { id: 'tower_blue_outer', x: 1120, y: 720, isAlive: false };
  const structures = [{ unit: deadTower, radius: 24, locked: true }];
  let unit = { id: 'unit_champion', x: 1080, y: 720, isAlive: true };

  for (let tick = 0; tick < 5; tick++) {
    const start = { x: unit.x, y: unit.y, locked: false, alive: true };
    const starts = new Map([['unit_champion', start]]);
    unit.x += 6;
    resolveArenaUnitCollisions([unit], [], [], starts, 0.033, structures);
  }

  // Since tower is dead, it is excluded from collision bodies and unit walks in a straight line (y stays 720)
  assert.equal(unit.y, 720);
  assert.equal(unit.x, 1110);
});

test('turret spacing provides generous tactical lane buffer and symmetric river battleground', () => {
  // Spacing between Outer and Inner towers
  const blueOuterToInner = OUTER_TOWER_X.blue - INNER_TOWER_X.blue;
  const redOuterToInner = INNER_TOWER_X.red - OUTER_TOWER_X.red;
  assert.equal(blueOuterToInner, 300, 'blue outer-to-inner spacing expanded to 300px');
  assert.equal(redOuterToInner, 300, 'red outer-to-inner spacing expanded to 300px');

  // Spacing between Inner and Nexus towers
  const blueInnerToNexus = INNER_TOWER_X.blue - NEXUS_TOWER_X.blue;
  const redInnerToNexus = NEXUS_TOWER_X.red - INNER_TOWER_X.red;
  assert.equal(blueInnerToNexus, 280, 'blue inner-to-nexus spacing expanded to 280px');
  assert.equal(redInnerToNexus, 280, 'red inner-to-nexus spacing expanded to 280px');

  // Central river battleground between blue and red outer towers
  const riverBattlegroundWidth = OUTER_TOWER_X.red - OUTER_TOWER_X.blue;
  assert.equal(riverBattlegroundWidth, 360, 'central river battleground is 360px wide');
  assert.equal((OUTER_TOWER_X.blue + OUTER_TOWER_X.red) / 2, ARENA_WIDTH / 2, 'river center is perfectly symmetric at arena midpoint');
});

test('all jungle camps and objective pits maintain clear navigable access away from lane choke points', () => {
  assert.ok(CAMP_ROCK_RINGS.length >= 8, 'at least 8 jungle camps populated');
  for (const camp of CAMP_ROCK_RINGS) {
    // Distance from central lane axis
    const distFromLane = Math.abs(camp.y - LANE_Y);
    assert.ok(distFromLane > 150, `camp ${camp.id} at y=${camp.y} must sit in the jungle, well clear of main lane`);
    // Camps must remain within playable arena boundaries
    assert.ok(camp.x >= 200 && camp.x <= ARENA_WIDTH - 200, `camp ${camp.id} x=${camp.x} within bounds`);
  }
});

test('replay engine maintains deterministic synchronization across 1x, 2x, and 4x playback rates', () => {
  const replay = new ViewerReplay();
  for (let tick = 0; tick <= 300; tick++) {
    replay.record({
      tick,
      second: tick / 30,
      actors: [{ id: 'hero_1', heroId: 'c_invoker', x: 500 + tick * 2, y: 720, hp: 100, maxHp: 100, alive: true, facing: 1, team: 'blue', kind: 'champion' }],
      effects: [],
    });
  }

  // 1x speed advance for 1.0s (30 ticks)
  replay.seek(0);
  replay.paused = false;
  replay.setPlaybackRate(1);
  assert.equal(replay.advance(1.0).tick, 30);
  assert.equal(replay.sample().actors[0].x, 560);

  // 2x speed advance for 1.0s (60 ticks -> tick 90)
  replay.setPlaybackRate(2);
  assert.equal(replay.advance(1.0).tick, 90);
  assert.equal(replay.sample().actors[0].x, 680);

  // 4x speed advance for 1.0s (120 ticks -> tick 210)
  replay.setPlaybackRate(4);
  assert.equal(replay.advance(1.0).tick, 210);
  assert.equal(replay.sample().actors[0].x, 920);

  // Pause prevents time drift
  replay.paused = true;
  assert.equal(replay.advance(5.0).tick, 210);
});

