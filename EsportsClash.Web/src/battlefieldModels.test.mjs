import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATTLEFIELD_MODEL_METRICS,
  drawBarracksStructure,
  drawLaneMinionModel,
  drawNexusStructure,
  drawTowerStructure,
} from './components/BattlefieldModelRenderer.ts';

function canvasMock() {
  return new Proxy({}, {
    get(target, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} });
      }
      return key in target ? target[key] : () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}

test('battlefield models keep landmarks large and lane troops compact', () => {
  assert.ok(BATTLEFIELD_MODEL_METRICS.nexus.scale > BATTLEFIELD_MODEL_METRICS.tower.scale);
  assert.ok(BATTLEFIELD_MODEL_METRICS.tower.scale > BATTLEFIELD_MODEL_METRICS.barracks.scale);
  assert.ok(BATTLEFIELD_MODEL_METRICS.cannonMinion.scale > BATTLEFIELD_MODEL_METRICS.meleeMinion.scale);
  assert.ok(BATTLEFIELD_MODEL_METRICS.casterMinion.scale > BATTLEFIELD_MODEL_METRICS.meleeMinion.scale);
  assert.ok(BATTLEFIELD_MODEL_METRICS.cannonMinion.scale < BATTLEFIELD_MODEL_METRICS.tower.scale);
  assert.ok(BATTLEFIELD_MODEL_METRICS.meleeMinion.scale < 1);
  assert.ok(BATTLEFIELD_MODEL_METRICS.nexus.healthWidth > BATTLEFIELD_MODEL_METRICS.tower.healthWidth);
});

test('all realistic structure and minion variants render for both teams', () => {
  for (const team of ['blue', 'red']) {
    const ctx = canvasMock();
    assert.doesNotThrow(() => drawNexusStructure(ctx, team, 2.5, true));
    assert.doesNotThrow(() => drawNexusStructure(ctx, team, 2.5, false));
    assert.doesNotThrow(() => drawTowerStructure(ctx, team, 2.5, { x: 80, y: 10 }));
    for (const kind of ['melee', 'ranged', 'catapult']) {
      assert.doesNotThrow(() => drawBarracksStructure(ctx, team, kind, 2.5));
    }
    for (const kind of ['melee', 'caster', 'cannon']) {
      assert.doesNotThrow(() => drawLaneMinionModel(ctx, team, kind, 2.5, 0.4));
    }
  }
});
