import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources} from './threeAvatarModels.ts';
import {avatarModelUrl,getArsenaldoModelVariant,saveArsenaldoModelVariant} from './avatarModelUrl.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';
const path=new URL('../public/models/imports/arsenaldo-claude.glb',import.meta.url);
const unpack=bytes=>{const n=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+n)),bin:bytes.subarray(28+n),n};};
async function parseGeometry(){
 const bytes=await readFile(path),{json,bin,n}=unpack(bytes);
 delete json.images;delete json.textures;delete json.samplers;
 json.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
 for(const mesh of json.meshes)for(const p of mesh.primitives)p.material=0;
 const text=Buffer.from(JSON.stringify(json)),chunk=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(28+chunk.length+bin.length,8);header.writeUInt32LE(chunk.length,12);
 const rebuilt=Buffer.concat([header,chunk,bytes.subarray(20+n,28+n),bin]);
 return new GLTFLoader().parseAsync(rebuilt.buffer.slice(rebuilt.byteOffset,rebuilt.byteOffset+rebuilt.byteLength),'');
}
const transforms=scene=>{const values=[];scene.traverse(n=>{if(n.isBone||n.userData.avatarPart)values.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray());});return values;};
test('submitted Arsenaldo stays byte-exact and retains current geometry/rig with ten rewritten native clips',async()=>{
 const bytes=await readFile(path),old=await readFile(new URL('../public/models/avatars-v9/c_invoker.glb',import.meta.url)),submitted=unpack(bytes),current=unpack(old);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'f26c855ff883f9d697513cdf1285a27e80297b881e0b8cfab241f62a15204476');
 assert.equal(bytes.readUInt32LE(8),bytes.length);assert.ok(submitted.bin.subarray(0,current.bin.length).equals(current.bin));
 assert.deepEqual(submitted.json.nodes,current.json.nodes);assert.equal(submitted.json.meshes.length,21);
 assert.deepEqual(submitted.json.animations.map(a=>a.name),['Idle','Walk','Run','Strafe','Attack','Cast','Hit','Death','TurnLeft','TurnRight']);
 assert.ok(submitted.json.skins.every(s=>s.joints.length===17));assert.ok(submitted.json.images.every(i=>i.bufferView!==undefined&&!i.uri));
 assert.match(avatarModelUrl('c_invoker','claude'),/imports\/arsenaldo-claude/);assert.match(avatarModelUrl('c_invoker'),/avatars-v9/);
 assert.equal(avatarModelUrl('c_solana','claude'),avatarModelUrl('c_solana'));
});
test('import playback preserves submitted clip transforms through pause, crossfade, death and live orb colors',async()=>{
 const file=await parseGeometry(),resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources);
 library.files.set('c_invoker:claude',file);library.nativeImports.add(file);
 const model=library.instantiate('c_invoker','claude'),raw=clone(file.scene),mixer=new THREE.AnimationMixer(raw);
 assert.equal(model.body.userData.modelVariant,'claude');
 for(const clip of file.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();
  for(const fraction of [.1,.42,.8]){
   action.time=clip.duration*fraction;mixer.update(0);
   const pose=Object.freeze({motionState:clip.name.toLowerCase(),motionTime:action.time,recoil:.9,kaelenOrbs:Object.freeze(['fire','fire','fire'])});
   model.animate(pose,action.time);const expected=transforms(raw),actual=transforms(model.body);
   assert.ok(actual.every((v,i)=>Number.isFinite(v)&&Math.abs(v-expected[i])<1e-7),clip.name+' overwritten by runtime overlays');
   for(let n=0;n<60;n++)model.animate(pose,action.time);
   assert.deepEqual(transforms(model.body),actual,clip.name+' paused drift');
  }
 }
 model.animate({motionState:'attack',motionTime:.3,previousMotion:'walk',previousMotionTime:.2,motionBlend:.5},1);
 assert.ok(transforms(model.body).every(Number.isFinite));
 model.animate({motionState:'death',motionTime:3},3);const death=transforms(model.body);
 model.animate({motionState:'death',motionTime:4},4);assert.deepEqual(transforms(model.body),death,'death must hold its endpoint');
 model.dispose();mixer.stopAllAction();mixer.uncacheRoot(raw);library.close();disposeArenaTerrainResources(file.scene);disposeArenaTerrainResources(resources.owner);
});
test('Arsenaldo model preference persists and defaults to the latest supplied appearance when storage is unavailable',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
  assert.equal(getArsenaldoModelVariant(),'submitted');saveArsenaldoModelVariant('current');assert.equal(getArsenaldoModelVariant(),'current');
  saveArsenaldoModelVariant('claude');assert.equal(getArsenaldoModelVariant(),'claude');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
  assert.equal(getArsenaldoModelVariant(),'submitted');assert.doesNotThrow(()=>saveArsenaldoModelVariant('current'));
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});

test('an unavailable submitted file falls back to the current GLB without labelling it as imported',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),file=await parseGeometry(),resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources);
 try{
  Object.defineProperty(globalThis,'window',{configurable:true,value:{}});
  const urls=[];library.loader.loadAsync=async url=>{urls.push(url);if(url.includes('/imports/'))throw Error('unavailable');return file;};
  assert.equal(await library.request('c_invoker',undefined,'claude'),true);assert.equal(urls.length,2);
  const model=library.instantiate('c_invoker','claude');assert.equal(model.body.userData.modelVariant,'current');model.dispose();
 }finally{
  library.close();disposeArenaTerrainResources(file.scene);disposeArenaTerrainResources(resources.owner);
  if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;
 }
});
