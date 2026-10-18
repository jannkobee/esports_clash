import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources} from './threeAvatarModels.ts';
import {CHAMPIONS} from './mockData.ts';
import {hasStandingAnatomy} from './avatarStance.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';
import {bindWeaponSocket} from './avatarWeaponSockets.ts';
import {bindMeleeContact} from './avatarMeleeContact.ts';
import {getChampionBasicAttackRange} from './basicAttackRangeRules.ts';
import {combatDuration} from './avatarCombatMotion.ts';
import {AVATAR_CONTACTS} from './avatarContactProfiles.ts';

async function loadGeometry(id){
 const bytes=await readFile(new URL(`../public/models/avatars-v9/${id}.glb`,import.meta.url)),length=bytes.readUInt32LE(12);
 const json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 // Node regression tests retain geometry, rig, morphs and animation. Chrome verifies maps separately.
 delete json.images;delete json.textures;delete json.samplers;
 json.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
 for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
 const encoded=Buffer.from(JSON.stringify(json)),chunk=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(28+chunk.length+bin.length,8);header.writeUInt32LE(chunk.length,12);
 const rebuilt=Buffer.concat([header,chunk,bytes.subarray(20+length,28+length),bin]);
 return new GLTFLoader().parseAsync(rebuilt.buffer.slice(rebuilt.byteOffset,rebuilt.byteOffset+rebuilt.byteLength),'');
}
const transforms=body=>{const values=[];body.traverse(n=>{if(n.isBone||n.userData.avatarPart)values.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray());});return values;};

test('all 45 loaded avatars keep a stable visible pose through repeated paused frames and overlay states',async()=>{
 const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources);
 for(const kit of CHAMPIONS){
  const file=await loadGeometry(kit.id);library.files.set(kit.id,file);
  const model=library.instantiate(kit.id),other=library.instantiate(kit.id);
  const socket=bindWeaponSocket(model.body,kit.id);
  other.animate({motionState:'idle',motionTime:.35},.35);const untouched=transforms(other.body);
  for(const state of ['idle','walk','attack','cast','hit','turnleft','death']){
   const pose=Object.freeze({motionState:state,motionTime:.35,recoil:.4});
   model.animate(pose,.35);const expected=transforms(model.body);
   if(state!=='death'){
    const mounted=socket();assert.ok(mounted,kit.id+' missing loaded weapon socket');
    assert.ok([...mounted.tip,...mounted.base].every(Number.isFinite),kit.id+' invalid loaded weapon socket');
   }
   for(let frame=0;frame<90;frame++)model.animate(pose,.35);
   const actual=transforms(model.body);assert.ok(actual.every((v,i)=>Number.isFinite(v)&&Math.abs(v-expected[i])<1e-8),kit.id+' accumulates '+state);
   if(state==='idle'&&hasStandingAnatomy(kit.id))assert.ok(model.body.getObjectByName('Hips').position.y>15,kit.id+' sank under the floor');
  }
  // Advance real clip time: constant hip channels must still undo the preceding contact offset.
  for(let frame=0;frame<180;frame++)model.animate({motionState:'idle',motionTime:frame/60},frame/60);
  if(hasStandingAnatomy(kit.id))assert.ok(model.body.getObjectByName('Hips').position.y>15,kit.id+' sinks during live idle');
  assert.deepEqual(transforms(other.body),untouched,kit.id+' leaked transforms to another clone');
  if(getChampionBasicAttackRange(kit)<90){
   const actor=new THREE.Group();actor.position.set(100,0,200);actor.add(model.body);
   const fit=bindMeleeContact(model.body,kit.id),socket=bindWeaponSocket(model.body,kit.id),distance=getChampionBasicAttackRange(kit)-16;
   for(const angle of [0,1.2,-1.7]){
    model.body.position.set(0,0,0);model.body.rotation.y=angle;
    model.animate({motionState:'attack',motionTime:combatDuration(kit.id,'attack')*.42},1);
    const contact={x:100+Math.sin(angle)*distance,y:30,z:200+Math.cos(angle)*distance,weight:1};
    fit(contact,delta=>{const p=model.body.getWorldPosition(new THREE.Vector3()).add(delta);actor.worldToLocal(p);model.body.position.copy(p);model.body.updateWorldMatrix(true,true);});
    const tip=socket().tip;assert.ok(Math.hypot(tip[0]-contact.x,tip[2]-contact.z)<1e-4,kit.id+' loaded melee misses at '+angle);
    assert.ok(tip[1]>12&&tip[1]<50,kit.id+' hits outside the target torso');
    const kind=AVATAR_CONTACTS[kit.id]?.twoHand;
    if(kind){
     const hand=model.body.getObjectByName('HandL'),grip=model.body.getObjectByName('right-grip');
     const palm=hand.localToWorld(new THREE.Vector3(0,-2,0));
     const anchor=grip.localToWorld(new THREE.Vector3(kind==='totem'?-11.5:kind==='keg'?-8:kind==='gun'?-2:0,kind==='gun'?-6:kind==='staff'?8:kind==='keg'?2:8,kind==='totem'||kind==='keg'?8:kind==='gun'?8:5));
     assert.ok(palm.distanceTo(anchor)<1e-4,kit.id+' supporting palm detaches at '+angle);
    }
   }
  }
  model.dispose();other.dispose();disposeArenaTerrainResources(file.scene);
 }
 library.close();disposeArenaTerrainResources(resources.owner);
});

test('same-action transitions evaluate the full native clip instead of fading the only action to zero',async()=>{
 const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources),file=await loadGeometry('c_invoker');
 file.animations=[new THREE.AnimationClip('Idle',1,[new THREE.VectorKeyframeTrack('Hips.position',[0,1],[0,32,0,0,42,0])])];
 library.files.set('c_invoker',file);
 const reference=library.instantiate('c_invoker');reference.animate({motionState:'idle',motionTime:.5},.5);
 const expected=reference.body.getObjectByName('Hips').position.y;assert.ok(expected>32,'fixture samples the native track');
 for(const blend of [0,.1,.5,.99]){
  const model=library.instantiate('c_invoker');model.animate({motionState:'idle',motionTime:.5,previousMotion:'idle',previousMotionTime:0,motionBlend:blend},.5);
  assert.ok(Math.abs(model.body.getObjectByName('Hips').position.y-expected)<1e-8,'same action loses weight at '+blend);model.dispose();
 }
 reference.dispose();library.close();disposeArenaTerrainResources(file.scene);disposeArenaTerrainResources(resources.owner);
});
