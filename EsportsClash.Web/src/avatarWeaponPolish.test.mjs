import {retiredAvatarAssetTest} from './testFixtures/retiredAvatarAssets.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CHAMPIONS} from './mockData.ts';
import {weaponCycle,AVATAR_WEAPON_FINISH} from './avatarWeaponPolish.ts';
import {combatDuration} from './avatarCombatMotion.ts';
import {AvatarModelResources,buildAvatarModel} from './threeAvatarModels.ts';
import {bindWeaponSocket} from './avatarWeaponSockets.ts';
import {ArenaAbilityEffects} from './threeAbilityEffects.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('all weapon identities have a finish and draw/recoil recover after the established release',()=>{
 assert.deepEqual(Object.keys(AVATAR_WEAPON_FINISH).sort(),CHAMPIONS.map(c=>c.id).sort());
 for(const kit of CHAMPIONS){
  const duration=combatDuration(kit.id,'attack'),sample=t=>weaponCycle(kit.id,{motionState:'attack',motionTime:t*duration},0);
  assert.ok(Math.abs(sample(.42).kick-1)<1e-9);assert.equal(sample(.42).arrow,0);assert.ok(sample(.41).draw>.99);
  assert.ok(sample(.55).draw<.01);assert.equal(sample(1).kick,0);assert.equal(sample(1).follow,0);assert.equal(sample(1).arrow,1);
 }
});

test('blade guards point beyond the forearm and nocked arrows disappear after release',()=>{
 const resources=new AvatarModelResources();
 for(const id of ['c_solana','c_valkira','c_kazemaru','c_xin','c_locke']){
  const model=buildAvatarModel(CHAMPIONS.find(c=>c.id===id),resources),socket=bindWeaponSocket(model.body,id);
  for(const state of ['idle','attack']){
   model.animate({motionState:state,motionTime:.35},.35);const at=socket();
   assert.ok(at.tip[2]-at.base[2]>15,id+' blade folds back into arm');
  }
  model.dispose();
 }
 for(const id of ['c_astra','c_kindra']){
  const model=buildAvatarModel(CHAMPIONS.find(c=>c.id===id),resources),duration=combatDuration(id,'attack');
  let arrow;model.body.traverse(n=>{if(n.userData.avatarPart==='nocked-arrow')arrow=n;});
  for(const phase of [.2,.42,.6,1]){model.animate({motionState:'attack',motionTime:phase*duration},phase);assert.equal(arrow.scale.x,phase<.42||phase>.92?1:0);}
  model.dispose();
 }
 disposeArenaTerrainResources(resources.owner);
});

test('weapon impact particles require explicit confirmed cues, freeze on pause and expire',()=>{
 const fx=new ArenaAbilityEffects();fx.update([],[],1,[]);assert.equal(fx.stats().effects,0,'removed projectile is not a hit');
 const cue=Object.freeze({id:'confirmed',avatarId:'c_vi',kind:'melee',x:120,y:240,age:.08,color:'#ffffff'}),before=JSON.stringify(cue);
 fx.update([],[],1,[],[cue]);const first=JSON.stringify(fx.pool.slice(0,fx.used).map(m=>[...m.position.toArray(),...m.scale.toArray()]));
 assert.ok(fx.stats().effects>=5);fx.update([],[],1,[],[cue]);
 assert.equal(JSON.stringify(fx.pool.slice(0,fx.used).map(m=>[...m.position.toArray(),...m.scale.toArray()])),first);
 assert.equal(JSON.stringify(cue),before);fx.update([],[],2,[],[{...cue,age:1}]);assert.equal(fx.stats().effects,0);disposeArenaTerrainResources(fx.root);
});

retiredAvatarAssetTest('v9 shipped GLBs and Blender sources retain strict trees, actions, grip shapes and matching hashes',async()=>{
 const folder=new URL('../public/models/avatars-v9/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const sources=new URL('../../art/avatars-v9/',import.meta.url),blends=JSON.parse(await readFile(new URL('manifest.json',sources),'utf8'));
 assert.equal(manifest.avatars.length,45);assert.equal(blends.models.length,45);let shapes=0;
 for(const asset of manifest.avatars){
  const bytes=await readFile(new URL(asset.file,folder)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),parents=new Set();
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  for(const n of json.nodes)for(const child of n.children??[]){assert.ok(!parents.has(child),asset.id+' multiple parents');parents.add(child);}
  for(const skin of json.skins)assert.equal(skin.joints.length,17);assert.equal(json.animations.length,10);
  if(['c_astra','c_kindra'].includes(asset.id))assert.ok(json.nodes.some(n=>n.extras?.avatarPart==='nocked-arrow'));
  const saved=blends.models.find(m=>m.id===asset.id);shapes+=saved.gripShapes;
  assert.equal(saved.actions.length,10);assert.equal(createHash('sha256').update(await readFile(new URL(saved.file,sources))).digest('hex'),saved.sha256);
 }
 assert.equal(shapes,68);
});
