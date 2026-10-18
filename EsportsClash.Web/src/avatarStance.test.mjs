import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPIONS} from './mockData.ts';
import {AvatarModelResources,buildAvatarModel,bindAvatarModel} from './threeAvatarModels.ts';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {hasStandingAnatomy} from './avatarStance.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('standing avatars have a curved spine, level planted feet, attached costume and repeatable relaxed stance',()=>{
 const resources=new AvatarModelResources();let standing=0;
 for(const kit of CHAMPIONS){
  const model=buildAvatarModel(Object.freeze({...kit}),resources);
  if(!hasStandingAnatomy(kit.id)){model.dispose();continue;}standing++;
  const pose=Object.freeze({animState:'idle',animTimer:0}),bone=name=>model.body.getObjectByName(name);
  model.animate(pose,0);model.body.updateMatrixWorld(true);
  const point=name=>bone(name).getWorldPosition(new THREE.Vector3());
  const hips=point('Hips'),spine=point('Spine'),chest=point('Chest');
  const t=(spine.y-hips.y)/(chest.y-hips.y);
  assert.ok(spine.z-THREE.MathUtils.lerp(hips.z,chest.z,t)>.7,kit.id+' lumbar arch');
  for(const side of ['L','R']){
   const foot=bone('Foot'+side),up=new THREE.Vector3(0,1,0).applyQuaternion(foot.getWorldQuaternion(new THREE.Quaternion()));
   assert.ok(up.distanceTo(new THREE.Vector3(0,1,0))<1e-6,kit.id+' level ankle');
   assert.ok(Math.abs(point('Foot'+side).y-(model.body.position.y+model.body.userData.contactSoleOffset*model.body.scale.y))<1e-6,kit.id+' planted foot height');
  }
  assert.equal(bone('left-arm').parent,bone('Chest'));assert.equal(bone('right-arm').parent,bone('Chest'));
  const snapshot=()=>{model.body.updateMatrixWorld(true);const values=[];model.body.traverse(n=>{if(n.isBone||n.userData.avatarPart)values.push(...n.position.toArray(),...n.quaternion.toArray());});return values;};
  const before=snapshot();
  for(const state of ['walk','attack','cast','idle'])model.animate(Object.freeze({animState:state,animTimer:.4}),2);
  model.animate(pose,0);assert.deepEqual(snapshot(),before,kit.id+' no accumulated or stale pose');
  model.dispose();
 }
 assert.equal(standing,36);disposeArenaTerrainResources(resources.owner);
});

test('historical stance and current combat assets retain valid rigs/clips and imported poses survive sanitized names',async()=>{
 for(const version of [5,6,7,8,9]){
 const directory=new URL(`../public/models/avatars-v${version}/`,import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
 assert.deepEqual(manifest.avatars.map(a=>a.id).sort(),CHAMPIONS.map(c=>c.id).sort());
 const resources=new AvatarModelResources();
 for(const asset of manifest.avatars){
  const bytes=await readFile(new URL(asset.file,directory)),length=bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(bytes.length,asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  const json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
  for(const skin of json.skins)assert.equal(skin.joints.length,17);
  // Geometry/rig-only Node load. Actual texture decoding is verified separately in Chrome.
  delete json.images;delete json.textures;delete json.samplers;
  json.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
  const data=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4,32)]);
  const header=Buffer.from(bytes.subarray(0,20));header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);
  const binary=Buffer.concat([header,padded,bytes.subarray(20+length,28+length),bin]);
  const file=await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
  assert.deepEqual(file.animations.map(a=>a.name),version===5?['Idle','Walk','Attack','Cast']:['Idle','Walk','Run','Strafe','Attack','Cast','Hit','Death','TurnLeft','TurnRight']);
  let root;file.scene.traverse(node=>{if(node.userData.avatarPart==='avatar-root')root=node;});
  const model=bindAvatarModel(root,resources),pose=Object.freeze({animState:'idle',animTimer:0});
  model.animate(pose,0);file.scene.updateMatrixWorld(true);
  const first=file.scene.getObjectByName('Spine').quaternion.clone();
  for(const animState of ['walk','cast','attack','idle'])model.animate(Object.freeze({animState,animTimer:.2}),.2);
  model.animate(pose,0);assert.ok(file.scene.getObjectByName('Spine').quaternion.equals(first));
  assert.ok(new THREE.Box3().setFromObject(file.scene).min.toArray().every(Number.isFinite));
  model.dispose();disposeArenaTerrainResources(file.scene);
 }
 disposeArenaTerrainResources(resources.owner);
 }
});
