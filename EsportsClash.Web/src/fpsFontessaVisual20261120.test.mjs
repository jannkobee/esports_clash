import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { liveBoxSurfaceUV, LIVE_SURFACE_BOX_WRAP, LiveSurfaceLibrary } from './fps/fpsLiveGraphics.ts';
import { liveSmokeCloudLobes, liveSmokeDepth, liveSmokeSettle, LIVE_SMOKE_FLOOR_DROP } from './fps/fpsLiveBrain.ts';
import { buildCanalWaterfront } from './fps/fpsCanalWaterfront.ts';
import { buildLiveScenery } from './fps/fpsLiveScenery.ts';
import { LIVE_CANAL_STAIRWELLS, MERCATO_GATE } from './fps/fpsVillageMercato.ts';
import { LIVE_LAUNDRY_LINES } from './fps/fpsVillageDetails.ts';
import { LIVE_FPS_MAP, LIVE_ACTOR_RADIUS } from './fps/fpsLiveMap.ts';
import { FONTESSA_TERRAIN_RUNTIME, liveGroundHeight } from './fps/fpsLiveTerrain.ts';

// CPU stand-ins verify geometry and data; they do not claim GPU or visual acceptance.
function fixture() {
  const engine = new NullEngine();
  engine.createCanvas = (width, height) => ({ width, height, getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData() {},
    fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
    save() {}, restore() {}, translate() {}, scale() {}, fillText() {}, measureText: text => ({ width: text.length * 20 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  }) });
  const scene = new Scene(engine), materials = new Map();
  const material = hex => { if (!materials.has(hex)) materials.set(hex, new StandardMaterial(hex, scene)); return materials.get(hex); };
  const detail = (mesh, color) => { mesh.material = material(color); mesh.isPickable = false; return mesh; };
  const box = (name, x, y, z, w, h, d, color) => { const mesh = detail(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), color); mesh.position.set(x, y, z); return mesh; };
  return { scene, material, box, detail, dispose: () => { scene.dispose(); engine.dispose(); } };
}
const bounds = mesh => { mesh.computeWorldMatrix(true); const b = mesh.getBoundingInfo().boundingBox; return { min: b.minimumWorld, max: b.maximumWorld }; };

test('surface boxes map metre-scale UVs on all six faces, so treads and decks are not stretched into planks', () => {
  const f = fixture();
  try {
    const [w, h, d, m] = [3, 1.4, 7, 4];
    const mesh = MeshBuilder.CreateBox('uv-probe', { width: w, height: h, depth: d, faceUV: liveBoxSurfaceUV(w, h, d, m), wrap: LIVE_SURFACE_BOX_WRAP }, f.scene);
    const p = mesh.getVerticesData('position'), n = mesh.getVerticesData('normal'), uv = mesh.getVerticesData('uv');
    const extent = { x: w, y: h, z: d };
    // Expected texture axes per face normal: U along the face's width direction, V along its height direction.
    const axes = { x: ['z', 'y'], y: ['x', 'z'], z: ['x', 'y'] };
    for (let face = 0; face < 6; face++) {
      const vertices = [0, 1, 2, 3].map(i => face * 4 + i).map(i => ({ x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2], u: uv[i * 2], v: uv[i * 2 + 1], n: [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]] }));
      const normalAxis = ['x', 'y', 'z'][vertices[0].n.findIndex(c => Math.abs(c) > .5)], [uAxis, vAxis] = axes[normalAxis];
      for (const a of vertices) for (const b of vertices) {
        if (Math.abs(a[uAxis] - b[uAxis]) < 1e-6) assert.ok(Math.abs(a.u - b.u) < 1e-6, `face ${face}: U must not change along ${vAxis}`);
        if (Math.abs(a[vAxis] - b[vAxis]) < 1e-6) assert.ok(Math.abs(a.v - b.v) < 1e-6, `face ${face}: V must not change along ${uAxis}`);
      }
      const span = (key) => Math.max(...vertices.map(v => v[key])) - Math.min(...vertices.map(v => v[key]));
      assert.ok(Math.abs(span('u') - extent[uAxis] / m) < 1e-6 && Math.abs(span('v') - extent[vAxis] / m) < 1e-6, `face ${face} keeps metre scale`);
    }
  } finally { f.dispose(); }
});

test('blooming, dissipating and HE-cut smokes rest on their floor instead of floating; a bloomed smoke is unchanged', () => {
  const smoke = radius => ({ id: 7, x: 0, z: 0, y: 1.4, radius, startedAt: 0, expires: 20 });
  assert.equal(liveSmokeSettle(4.8), 0, 'A full-size cloud keeps its authored shape');
  for (const radius of [.3, .9, 1.8, 2.8]) {
    const lowest = Math.min(...liveSmokeCloudLobes(smoke(radius), 5).map(l => l.y - l.scaleY / 2));
    assert.ok(lowest <= -LIVE_SMOKE_FLOOR_DROP + .1, `radius ${radius}: cloud bottom ${lowest.toFixed(2)} must reach the floor`);
  }
  // Sight tests use the same settled volume: low lines through a small cloud are blocked, the old floating
  // chest-height position above it is clear.
  const floor = 1.4 - LIVE_SMOKE_FLOOR_DROP;
  assert.ok(liveSmokeDepth({ x: -3, z: 0 }, { x: 3, z: 0 }, floor + .35, floor + .35, smoke(1.8), 5) > .48);
  assert.equal(liveSmokeDepth({ x: -3, z: 0 }, { x: 3, z: 0 }, 1.4, 1.4, smoke(.9), 5), 0);
  assert.ok(liveSmokeDepth({ x: -3, z: 0 }, { x: 3, z: 0 }, floor + .3, floor + .3, smoke(.9), 5) > 0);
});

test('Mercato gate dressing never stands where an actor centre can be, and the gate keeps its named frieze', () => {
  const f = fixture();
  try {
    assert.ok(MERCATO_GATE);
    buildCanalWaterfront(f.scene, { box: f.box, detail: f.detail }, new LiveSurfaceLibrary(f.scene));
    for (const name of ['b-passage-lintel-7.87', 'b-passage-lintel-11.13', 'b-passage-spandrel-south', 'b-passage-spandrel-north', 'b-passage-lantern-glass', 'b-passage-shrine-halo', 'b-passage-terrace-cotto'])
      assert.ok(f.scene.getMeshByName(name), name);
    const walls = [MERCATO_GATE.minX, MERCATO_GATE.maxX];
    for (const mesh of f.scene.meshes.filter(m => m.name.startsWith('b-passage-'))) {
      const { min, max } = bounds(mesh);
      assert.ok([min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite), mesh.name);
      const floor = Math.max(...[[min.x, min.z], [max.x, max.z], [min.x, max.z], [max.x, min.z]].map(([x, z]) => liveGroundHeight({ x, z })));
      const overhead = min.y >= 2.2, flush = max.y <= floor + .03;
      const wallMounted = walls.some(w => Math.max(Math.abs(min.x - w), Math.abs(max.x - w)) <= LIVE_ACTOR_RADIUS + .001);
      assert.ok(overhead || flush || wallMounted, `${mesh.name} occupies walkable space (${min.x.toFixed(2)}..${max.x.toFixed(2)}, y ${min.y.toFixed(2)}..${max.y.toFixed(2)})`);
    }
  } finally { f.dispose(); }
});

test('every canal stairwell drop from street level has a retaining cheek or a building wall', () => {
  const inBuilding = p => LIVE_FPS_MAP.solids.some(s => (s.baseY ?? 0) <= 0 && s.height > 2 && p.x > s.minX && p.x < s.maxX && p.z > s.minZ && p.z < s.maxZ);
  for (const stair of LIVE_CANAL_STAIRWELLS) {
    const treads = FONTESSA_TERRAIN_RUNTIME.groundPatches.filter(p => p.id?.startsWith(`${stair.id}-`));
    assert.ok(treads.length >= 6, stair.id);
    const minX = Math.min(...treads.map(t => t.minX)), maxX = Math.max(...treads.map(t => t.maxX));
    const minZ = Math.min(...treads.map(t => t.minZ)), maxZ = Math.max(...treads.map(t => t.maxZ));
    for (let z = minZ + .1; z < maxZ - .05; z += .25) for (const [edge, dir] of [[minX, -1], [maxX, 1]]) {
      const outside = { x: edge + dir * .15, z }, inside = { x: edge - dir * .15, z };
      if (liveGroundHeight(outside) <= liveGroundHeight(inside) + .05 || inBuilding(outside)) continue;
      assert.ok(stair.cheeks.some(c => c.x === edge && z >= c.minZ - 1e-6 && z <= c.maxZ + 1e-6), `${stair.id} open at x ${edge}, z ${z.toFixed(2)}`);
    }
  }
});

test('village scenery shadow casters stay inside the playable village so the sun shadow map is not stretched', () => {
  const f = fixture();
  try {
    const casters = buildLiveScenery(f.scene, f.material, new LiveSurfaceLibrary(f.scene));
    assert.ok(casters.length > 0);
    for (const mesh of casters) {
      const { min, max } = bounds(mesh);
      assert.ok(min.x >= -40.5 && max.x <= 40.5 && min.z >= -48.5 && max.z <= 48.5, `${mesh.name} x ${min.x.toFixed(1)}..${max.x.toFixed(1)} z ${min.z.toFixed(1)}..${max.z.toFixed(1)}`);
    }
    for (const line of LIVE_LAUNDRY_LINES) assert.ok(line.y - line.sag - .7 > 2.4, `${line.id} laundry hangs above head height`);
  } finally { f.dispose(); }
});
