import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, StandardMaterial, Texture } from '@babylonjs/core';
import { buildLiveSky, liveBoxSurfaceUV, LIVE_SURFACE_METRES, LiveSurfaceLibrary } from './fps/fpsLiveGraphics.ts';
import { buildLiveScenery, LIVE_FESTOON_SPANS, liveFestoonCablePoint } from './fps/fpsLiveScenery.ts';
import { buildVillageArchitecture } from './fps/fpsVillageArchitecture.ts';
import { MeshBuilder } from '@babylonjs/core';
import { createTacticalOperativeMesh } from './fps/fpsLiveViewer.ts';
import { LIVE_FPS_MAP } from './fps/fpsLiveMap.ts';

// CPU canvas stand-in verifies texture data and scene structure; it does not claim GPU/visual acceptance.
function fixture() {
  const engine = new NullEngine();
  engine.createCanvas = (width, height) => {
    const context = {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData(image) { this.pixels = image.data; },
      fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      closePath() {}, fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, scale() {}, fillText() {},
      measureText: text => ({ width: text.length * 20 }),
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    };
    return { width, height, getContext: () => context };
  };
  const scene = new Scene(engine), library = new LiveSurfaceLibrary(scene);
  return { scene, library, dispose: () => { scene.dispose(); engine.dispose(); } };
}

test('environment UVs preserve metre scale on all six faces without changing solid dimensions', () => {
  const f = fixture();
  try {
    for (const wall of LIVE_FPS_MAP.solids) {
      const width = wall.maxX - wall.minX, depth = wall.maxZ - wall.minZ;
      const metres = LIVE_SURFACE_METRES.stone, uv = liveBoxSurfaceUV(width, wall.height, depth, metres);
      assert.equal(uv.length, 6);
      assert.deepEqual(uv.map(v => [v.z * metres, v.w * metres]),
        [[width, wall.height], [width, wall.height], [depth, wall.height], [depth, wall.height], [width, depth], [width, depth]]);
      assert.ok(uv.every(v => v.asArray().every(Number.isFinite)));
    }
  } finally { f.dispose(); }
});

test('surface maps repeat, share GPU resources across colors, and reproduce deterministic unit normals', () => {
  const a = fixture(), b = fixture();
  try {
    for (const kind of Object.keys(LIVE_SURFACE_METRES)) {
      const first = a.library.material(kind, '#c4b79b'), tinted = a.library.material(kind, '#a89d87');
      const repeated = b.library.material(kind, '#c4b79b');
      assert.equal(first, a.library.material(kind, '#c4b79b'));
      assert.equal(first.diffuseTexture, tinted.diffuseTexture); assert.equal(first.bumpTexture, tinted.bumpTexture);
      for (const texture of [first.diffuseTexture, first.bumpTexture]) {
        assert.equal(texture.wrapU, Texture.WRAP_ADDRESSMODE); assert.equal(texture.wrapV, Texture.WRAP_ADDRESSMODE);
      }
      assert.equal(first.bumpTexture.gammaSpace, false);
      const pixels = first.bumpTexture.getContext().pixels;
      assert.deepEqual(pixels, repeated.bumpTexture.getContext().pixels);
      assert.deepEqual(first.diffuseTexture.getContext().pixels, repeated.diffuseTexture.getContext().pixels);
      for (let at = 0; at < pixels.length; at += 4 * 127) {
        const length = Math.hypot(...Array.from(pixels.subarray(at, at + 3), value => value / 255 * 2 - 1));
        assert.ok(Math.abs(length - 1) < .015); assert.equal(pixels[at + 3], 255);
      }
    }
    assert.equal(a.scene.textures.length, Object.keys(LIVE_SURFACE_METRES).length * 2, 'Each surface owns one shared albedo and one shared normal map');
  } finally { a.dispose(); b.dispose(); }
});

test('water animation follows simulation time and the sky stays noninteractive', () => {
  const f = fixture();
  try {
    const fountain = f.library.water('#477d81'), harbor = f.library.water('#427c88');
    assert.equal(fountain.bumpTexture, harbor.bumpTexture);
    f.library.update(10); const pose = [fountain.bumpTexture.uOffset, fountain.bumpTexture.vOffset];
    f.library.update(10); assert.deepEqual([fountain.bumpTexture.uOffset, fountain.bumpTexture.vOffset], pose);
    f.library.update(20); assert.notEqual(fountain.bumpTexture.uOffset, pose[0]);
    buildLiveSky(f.scene);
    const dome = f.scene.getMeshByName('harbor-atmosphere-dome');
    assert.equal(dome.isPickable, false); assert.equal(dome.infiniteDistance, true);
    assert.equal(dome.material.disableDepthWrite, true); assert.equal(dome.material.disableLighting, true);
    assert.deepEqual(dome.material.emissiveColor.asArray(),[0,0,0],'The sky texture must not be clipped by additive white emission');
  } finally { f.dispose(); }
});

test('scenery preserves the map and keeps the fountain rim horizontal inside its movement footprint', () => {
  const f = fixture(), before = JSON.stringify(LIVE_FPS_MAP), materials = new Map();
  const material = hex => {
    if (!materials.has(hex)) materials.set(hex, new StandardMaterial(hex, f.scene));
    return materials.get(hex);
  };
  try {
    const casters = buildLiveScenery(f.scene, material, f.library);
    const rim = f.scene.meshes.find(mesh => mesh.name.startsWith('fountain-scalloped-rim'));
    assert.ok(rim); rim.computeWorldMatrix(true);
    const bounds = rim.getBoundingInfo().boundingBox;
    assert.ok(bounds.minimumWorld.y > .83 && bounds.maximumWorld.y < 1);
    assert.ok(bounds.minimumWorld.x > 20.7 && bounds.maximumWorld.x < 25.3);
    assert.ok(bounds.minimumWorld.z > 18.7 && bounds.maximumWorld.z < 23.3);
    assert.ok(casters.every(mesh => mesh.receiveShadows && !mesh.isPickable));
    assert.ok(!f.scene.meshes.some(mesh => mesh.name.startsWith('b-fountain-base-')));
    for (const expected of ['pizzeria-rusticanella-sign', 'mercato-arch-sign', 'casa-dolce-vigna-sign']) {
      const mesh = f.scene.meshes.find(m => m.name.startsWith(expected));
      assert.ok(mesh, `Expected sign mesh ${expected}`);
      assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
    }
    assert.ok(f.scene.meshes.every(mesh => !mesh.getVerticesData('position') || mesh.getVerticesData('position').every(Number.isFinite)));
    assert.equal(JSON.stringify(LIVE_FPS_MAP), before);
  } finally { f.dispose(); }
});

test('italian village architecture builds distinct landmarks without facade collisions', () => {
  const f = fixture(), materials = new Map();
  const material = hex => {
    if (!materials.has(hex)) materials.set(hex, new StandardMaterial(hex, f.scene));
    return materials.get(hex);
  };
  const detail = (mesh, color) => { mesh.material = material(color); mesh.isPickable = false; return mesh; };
  const box = (name, x, y, z, w, h, d, color) => {
    const m = detail(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, f.scene), color);
    m.position.set(x, y, z);
    return m;
  };
  try {
    buildVillageArchitecture(f.scene, { box, detail }, material, f.library);
    for (const landmark of ['a-crates-campanile-spire', 'village-fontanella-column', 'a-loggia-arch-ring-0-0', 'b-car-kiosk-rolling-slat-0']) {
      const mesh = f.scene.getMeshByName(landmark);
      assert.ok(mesh, `Expected landmark mesh ${landmark}`);
      assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
    }
    assert.equal(f.scene.getMeshByName('a-loggia-wall--1-door-surround'), null);
    assert.equal(f.scene.getMeshByName('b-apartments-back--1-3.5-15.1-window-frame'), null);
    assert.equal(f.scene.getMeshByName('mid-approach-screen--1-door-surround'), null);
    assert.ok(f.scene.meshes.every(mesh => mesh.position.asArray().every(Number.isFinite) && mesh.rotation.asArray().every(Number.isFinite) && (!mesh.getVerticesData('position') || mesh.getVerticesData('position').every(Number.isFinite))));
  } finally { f.dispose(); }
});

test('festoon cables attach to their anchors and sag below the endpoint chord',()=>{
  for(const span of LIVE_FESTOON_SPANS){
    const a=liveFestoonCablePoint(span,0),b=liveFestoonCablePoint(span,1),middle=liveFestoonCablePoint(span,.5);
    assert.deepEqual(a.asArray(),[span.from.x,span.from.y,span.from.z]);
    assert.deepEqual(b.asArray(),[span.to.x,span.to.y,span.to.z]);
    assert.ok(Math.abs(middle.y-((a.y+b.y)/2-span.sag))<1e-6);
    for(let i=1;i<=8;i++)assert.ok(liveFestoonCablePoint(span,i/9).y-.32>3.4);
  }
});

test('detailed faction kits keep their animated parents, finite geometry and bounded mesh count',()=>{
  const f=fixture(),materials=new Map();
  const material=hex=>{if(!materials.has(hex))materials.set(hex,new StandardMaterial(hex,f.scene));return materials.get(hex);};
  try{
    for(const force of ['ct','t']){
      const view=createTacticalOperativeMesh(force,force,f.scene,material),children=view.root.getChildMeshes();
      const kit=children.filter(mesh=>mesh.name.includes(`-${force}-kit-`));
      assert.ok(kit.length>8);assert.ok(children.length<75);
      for(const mesh of kit){
        assert.ok([view.spine,view.headPivot,view.leftArmPivot,view.rightArmPivot,view.leftElbowPivot,view.rightElbowPivot,view.leftLegPivot,view.rightLegPivot,view.leftKneePivot,view.rightKneePivot].includes(mesh.parent));
        assert.equal(mesh.isPickable,false);assert.equal(mesh.receiveShadows,true);
        assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
      }
      const headPart=kit.find(mesh=>mesh.parent===view.headPivot);headPart.computeWorldMatrix(true);
      const before=headPart.getBoundingInfo().boundingBox.centerWorld.clone();
      view.root.position.y=1.8;view.headPivot.position.y-=.37;headPart.computeWorldMatrix(true);
      const after=headPart.getBoundingInfo().boundingBox.centerWorld;
      assert.ok(Math.abs(after.y-before.y-1.43)<1e-5,'Equipment follows elevation and the existing crouch pivot once');
    }
  }finally{f.dispose();}
});
