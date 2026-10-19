import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources} from './threeAvatarModels.ts';
import {avatarModelUrl} from './avatarModelUrl.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('supplied Arsenaldo loads its actual geometry at the existing visual height with honest static support',async()=>{
  const bytes=await readFile(new URL('../public/models/imports/arsenaldo-submitted-20261018.glb',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'29661d603b85a3c9227331a5d3b1b930ce23ed241e01f866e1563581c613a4d4');
  const n=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+n));
  assert.equal(json.skins,undefined);assert.equal(json.animations,undefined);
  assert.equal(json.accessors[json.meshes[0].primitives[0].indices].count/3,49986);
  assert.ok(json.images.every(image=>image.bufferView!==undefined&&!image.uri));
  // Node has no browser image decoder. The real browser check loads all maps;
  // this fixture parses the actual mesh/transforms without requesting images.
  delete json.images;delete json.textures;delete json.samplers;delete json.extensionsUsed;
  json.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
  const text=Buffer.from(JSON.stringify(json)),chunk=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),bin=bytes.subarray(20+n);
  const header=Buffer.from(bytes.subarray(0,20));header.writeUInt32LE(20+chunk.length+bin.length,8);header.writeUInt32LE(chunk.length,12);
  const rebuilt=Buffer.concat([header,chunk,bin]);
  const file=await new GLTFLoader().parseAsync(rebuilt.buffer.slice(rebuilt.byteOffset,rebuilt.byteOffset+rebuilt.byteLength),'');
  const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources,undefined,Promise.resolve(new Map()));
  library.files.set('c_invoker:submitted',file);library.resolvedURLs.set('c_invoker:submitted',avatarModelUrl('c_invoker','submitted'));
  const model=library.instantiate('c_invoker','submitted');assert.ok(model);
  assert.equal(model.body.userData.modelVariant,'submitted');assert.equal(model.body.userData.animationSupport,'static-mesh');
  assert.deepEqual(model.body.userData.clips,[]);
  const appearance=model.body.children[0],bounds=new THREE.Box3().setFromObject(appearance);
  assert.ok(Math.abs(bounds.min.y)<1e-5);assert.ok(Math.abs(bounds.max.y-74)<1e-5);
  assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x)<1e-5);
  const original=appearance.matrixWorld.clone(),pose=Object.freeze({motionState:'cast',kaelenOrbs:Object.freeze(['fire','ice','wind'])});
  model.animate(pose,.5);model.body.updateMatrixWorld(true);const first=model.body.children[1].position.clone();
  for(let i=0;i<100;i++)model.animate(pose,.5);
  assert.deepEqual(model.body.children[1].position,first,'Paused orb presentation must not drift');
  assert.ok(appearance.matrixWorld.equals(original),'Static mesh must not accumulate fake skeletal movement');
  model.animate(pose,1);assert.notDeepEqual(model.body.children[1].position,first);
  assert.ok(model.body.children[1].children[0].material.color.equals(new THREE.Color('#ff9960')));
  model.dispose();library.close();disposeArenaTerrainResources(resources.owner);
});

test('missing supplied model falls back to the actual original with its own label',async()=>{
  const oldWindow=globalThis.window,resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources,undefined,Promise.resolve(new Map()));
  try{
    globalThis.window={};const urls=[];
    library.loader.loadAsync=async url=>{urls.push(url);if(url===avatarModelUrl('c_invoker','submitted'))throw Error('Missing supplied GLB');return {scene:new THREE.Group(),animations:[]};};
    assert.equal(await library.request('c_invoker',undefined,'submitted'),true);
    assert.equal(library.sourceUrl('c_invoker','submitted'),avatarModelUrl('c_invoker','current'));assert.equal(urls.length,2);
  }finally{library.close();disposeArenaTerrainResources(resources.owner);if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});
