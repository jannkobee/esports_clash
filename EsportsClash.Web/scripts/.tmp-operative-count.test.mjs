import test from 'node:test';
import { Color3, Mesh, NullEngine, Scene, StandardMaterial } from '@babylonjs/core';
import { createTacticalOperativeMesh } from '../src/fps/fpsLiveViewer.ts';
test('count', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const mats = new Map();
  const getMat = (hex) => { const k = hex.toLowerCase(); let m = mats.get(k); if (!m) { m = new StandardMaterial(k, scene); m.diffuseColor = Color3.FromHexString(hex); mats.set(k, m); } return m; };
  const rows = [];
  for (const force of ['ct', 't']) for (let v = 0; v < 5; v++) {
    const op = createTacticalOperativeMesh(force, `c-${force}-${v}`, scene, getMat, v);
    const meshes = op.root.getChildMeshes().filter(m => m instanceof Mesh);
    const enabled = meshes.filter(m => m.isEnabled());
    rows.push(`${force}${v} ${op.variantStyle.code}: meshes=${meshes.length} drawn=${enabled.length} verts=${enabled.reduce((s, m) => s + m.getTotalVertices(), 0)} mats=${new Set(enabled.map(m => m.material?.uniqueId)).size}`);
  }
  console.log(rows.join('\n'));
});
