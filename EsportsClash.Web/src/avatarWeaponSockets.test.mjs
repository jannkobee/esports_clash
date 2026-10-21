import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPIONS} from './mockData.ts';
import {buildAvatarModel,AvatarModelResources} from './threeAvatarModels.ts';
import {AVATAR_WEAPON_SOCKETS,bindWeaponSocket} from './avatarWeaponSockets.ts';
import {AvatarProjectilePresentation} from './avatarProjectilePresentation.ts';
import {ArenaAbilityEffects} from './threeAbilityEffects.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('fitted equipment supplies its actual posed tip without changing combat geometry',()=>{
 const root=new THREE.Group(),grip=new THREE.Group();root.add(grip);grip.userData.avatarPart='right-grip';
 grip.userData.weaponTip=[0,60,0];grip.userData.weaponBase=[0,-4,0];grip.position.set(2,3,4);grip.scale.setScalar(.02);
 const sample=bindWeaponSocket(root,'c_solana');
 assert.deepEqual(sample().tip,[2,4.2,4]);assert.deepEqual(sample().base,[2,2.92,4]);
 grip.userData.weaponTip=[NaN,1,2];assert.ok(sample().tip.every(Number.isFinite),'Invalid fitting must retain the authored fallback');
});

test('all 45 modeled weapon mounts follow animation, world scale, yaw and knock-up',()=>{
 assert.deepEqual(Object.keys(AVATAR_WEAPON_SOCKETS).sort(),CHAMPIONS.map(c=>c.id).sort());
 const resources=new AvatarModelResources();
 for(const kit of CHAMPIONS){
  const model=buildAvatarModel(kit,resources),parent=new THREE.Group();parent.add(model.body);
  const sample=bindWeaponSocket(model.body,kit.id);
  model.animate({motionState:'attack',motionTime:.32},.32);
  const original=sample();assert.ok(original,kit.id);
  parent.position.set(120,24,-40);parent.rotation.y=Math.PI/2;parent.scale.setScalar(.8);
  const actual=sample();
  const expected=new THREE.Vector3(...original.tip).multiplyScalar(.8).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).add(parent.position);
  assert.ok(expected.distanceTo(new THREE.Vector3(...actual.tip))<1e-8,kit.id+' detached socket');
  assert.ok(actual.tip[1]>0&&actual.tip[1]<200,kit.id+' invalid weapon height');
  parent.visible=false;assert.equal(sample(),undefined,'hidden forms must not emit');
  model.dispose();
 }
 disposeArenaTerrainResources(resources.owner);
});

test('projectiles leave a fixed launch snapshot, reach the collision path and reset on rewind/removal',()=>{
 const tracker=new AvatarProjectilePresentation(),socket={tip:[140,54,190],base:[130,54,190],style:'gun'};
 const shot=Object.freeze({id:'shot',x:118,y:186,angle:0,targetX:318,targetY:186,type:'pellet'});
 tracker.begin(1,new Set(['shot']));const first=tracker.sample(shot,1,socket);
 assert.deepEqual(first.at,socket.tip);assert.deepEqual(first.tail,socket.tip);
 const moved={...shot,x:178};tracker.begin(1.1,new Set(['shot']));
 const flight=tracker.sample(moved,1.1,{...socket,tip:[999,999,999]});
 assert.deepEqual(flight.at,[189,40.5,188]);
 const frozen=tracker.sample(moved,1.1,socket);assert.deepEqual(frozen,flight);
 tracker.begin(1.3,new Set(['shot']));assert.deepEqual(tracker.sample({...shot,x:318},1.3,socket).at,[318,27,186]);
 tracker.begin(.5,new Set(['shot']));assert.deepEqual(tracker.sample(shot,.5,socket).at,socket.tip);
 tracker.begin(.6,new Set());assert.equal(tracker.sample(shot,.6),undefined);
 assert.equal(tracker.sample({...shot,id:'already-flying',x:250},.6,socket,{x:100,y:186}),undefined,'view switch re-launched an airborne shot');
 for(const type of ['tornado','turret_shot','boss_breath'])assert.equal(tracker.sample({...shot,type},.6,socket),undefined);
 assert.equal(JSON.stringify(shot),JSON.stringify({id:'shot',x:118,y:186,angle:0,targetX:318,targetY:186,type:'pellet'}));
});

test('actual effect geometry launches at weapon height, keeps frozen input intact and expires',()=>{
 const fx=new ArenaAbilityEffects();
 const socket=Object.freeze({tip:Object.freeze([130,61,215]),base:Object.freeze([120,61,215]),style:'gun'});
 const source=Object.freeze({id:'gunner',x:100,y:200,isAlive:true,weaponSocket:socket});
 const shot=Object.freeze({id:'shot',attackerId:'gunner',x:118,y:186,angle:0,targetX:300,targetY:186,size:4,color:'#ffaa33',type:'pellet'});
 const before=JSON.stringify({source,shot});fx.update([shot],[],1,[source]);
 assert.ok(fx.pool.slice(0,fx.used).some(mesh=>mesh.position.distanceTo(new THREE.Vector3(...socket.tip))<1e-8),'no geometry at muzzle');
 assert.ok(fx.pool.slice(0,fx.used).every(mesh=>Math.abs(mesh.position.y-61)<1e-8),'launch geometry still uses fixed height');
 const count=fx.stats().effects;fx.update([shot],[],1,[source]);assert.equal(fx.stats().effects,count);
 assert.equal(JSON.stringify({source,shot}),before);
 fx.update([],[],1.5,[]);assert.equal(fx.stats().effects,0);disposeArenaTerrainResources(fx.root);
});

test('hook chains and melee trails originate on the posed equipment without moving ground footprints',()=>{
 const fx=new ArenaAbilityEffects(),socket={tip:[130,61,215],base:[125,50,215],style:'blade'};
 const source={id:'hooker',x:100,y:200,isAlive:true,weaponSocket:socket,attackAge:.05};
 fx.update([{id:'hook',attackerId:'hooker',x:118,y:186,angle:0,targetX:300,targetY:186,size:4,color:'#aaffaa',type:'hook'}],[],1,[source]);
 // Both the chain and attack highlight meet the modeled hook, at its current height.
 assert.ok(fx.pool.slice(0,fx.used).some(mesh=>mesh.position.distanceTo(new THREE.Vector3(127.5,55.5,215))<1e-8));
 const at=JSON.stringify(fx.pool.slice(0,fx.used).map(mesh=>mesh.position.toArray()));
 fx.update([{id:'hook',attackerId:'hooker',x:118,y:186,angle:0,targetX:300,targetY:186,size:4,color:'#aaffaa',type:'hook'}],[],1,[source]);
 assert.equal(JSON.stringify(fx.pool.slice(0,fx.used).map(mesh=>mesh.position.toArray())),at,'paused weapon trail drifts');
 fx.update([],[],2,[{...source,attackAge:1}]);assert.equal(fx.stats().effects,0);
 disposeArenaTerrainResources(fx.root);
});
