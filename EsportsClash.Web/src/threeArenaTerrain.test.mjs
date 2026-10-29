import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ARENA_RENDER_HEIGHT,
  arenaWorldToNdc,
  clampArenaCamera,
} from './arenaPresentationCamera.ts';
import {
  ARENA_STATIC_TERRAIN_LAYERS,
  applyArenaCamera,
  disposeArenaTerrainResources,
} from './threeArenaTerrain.ts';

const WORLD_WIDTH = 2600;

test('Three terrain camera preserves Canvas world coordinates at supported zooms', () => {
  const fit = clampArenaCamera(200, 100, 1, WORLD_WIDTH, ARENA_RENDER_HEIGHT);
  assert.deepEqual(fit, { x: 1300, y: ARENA_RENDER_HEIGHT/2, halfW: 1300, halfH: ARENA_RENDER_HEIGHT/2 });
  assert.deepEqual(arenaWorldToNdc(0, 0, fit), { x: -1, y: 1 });
  assert.deepEqual(arenaWorldToNdc(2600, ARENA_RENDER_HEIGHT, fit), { x: 1, y: -1 });

  for (const zoom of [1, 1.45, 2.5]) {
    const view = clampArenaCamera(1300, 380, zoom, WORLD_WIDTH, ARENA_RENDER_HEIGHT);
    assert.deepEqual(arenaWorldToNdc(view.x, view.y, view), { x: 0, y: 0 });
    assert.ok(Math.abs(arenaWorldToNdc(view.x - view.halfW, view.y, view).x + 1) < 1e-12);
    assert.ok(Math.abs(arenaWorldToNdc(view.x, view.y + view.halfH, view).y + 1) < 1e-12);
  }

  const closeLeft = clampArenaCamera(-100, -100, 2.5, WORLD_WIDTH, ARENA_RENDER_HEIGHT);
  assert.equal(closeLeft.x, 520);
  assert.equal(closeLeft.y, ARENA_RENDER_HEIGHT/5);
});

test('orthographic camera uses the same downward screen axis as Canvas', () => {
  const camera = new THREE.OrthographicCamera();
  const view = clampArenaCamera(900, 300, 1.45, WORLD_WIDTH, ARENA_RENDER_HEIGHT);
  applyArenaCamera(camera, view, ARENA_RENDER_HEIGHT);
  assert.equal(camera.position.x, view.x);
  assert.equal(camera.position.y, ARENA_RENDER_HEIGHT - view.y);
  assert.equal(camera.left, -view.halfW);
  assert.equal(camera.bottom, -view.halfH);
});

test('static terrain scope is bounded and shared resources dispose exactly once', () => {
  assert.deepEqual(ARENA_STATIC_TERRAIN_LAYERS, [
    'forest-floor',
    'forested-lowlands',
    'raised-stone-ridge',
    'stone-base-courtyards',
    'sanctuary-shrines',
  ]);

  const root = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  let geometryDisposals = 0;
  let materialDisposals = 0;
  let textureDisposals = 0;
  geometry.dispose = () => { geometryDisposals++; };
  material.dispose = () => { materialDisposals++; };
  texture.dispose = () => { textureDisposals++; };
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

  assert.deepEqual(disposeArenaTerrainResources(root), { geometries: 1, materials: 1, textures: 1 });
  assert.deepEqual([geometryDisposals, materialDisposals, textureDisposals], [1, 1, 1]);
});
