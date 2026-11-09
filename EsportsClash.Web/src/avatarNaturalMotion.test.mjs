import {retiredAvatarAssetTest} from './testFixtures/retiredAvatarAssets.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {springStep,avatarSecondaryMotion,AVATAR_CROSSFADE_SECONDS} from './avatarSecondaryMotion.ts';
import {motionTimeline} from './avatarMotionTimeline.ts';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources,disposeAvatarRig} from './threeAvatarModels.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('damped secondary springs converge equally at 30/60/144 Hz and settle after stopping',()=>{
 const result=hz=>{let p=0,v=0;for(let i=0;i<hz;i++){const r=springStep(p,v,.1,1/hz);p=r.position;v=r.velocity;}return [p,v];};
 for(const hz of [30,144])result(hz).forEach((n,i)=>assert.ok(Math.abs(n-result(60)[i])<1e-10));
 const [p,v]=result(60),settled=springStep(p,v,0,3);
 assert.ok(Math.abs(settled.position)<1e-9);assert.ok(Math.abs(settled.velocity)<1e-8);
 assert.equal(AVATAR_CROSSFADE_SECONDS,.2);
});

test('secondary motion responds to turning/stopping, freezes on pause, resets on seek/death and leaves limbs untouched',()=>{
 const root=new THREE.Group(),chest=new THREE.Bone(),spine=new THREE.Bone(),hair=new THREE.Bone(),foot=new THREE.Bone(),weapon=new THREE.Bone();
 chest.name='Chest';spine.name='Spine';hair.userData.secondaryMotion={kind:'hair',depth:0};weapon.name='HandR';
 root.add(spine,foot,weapon);spine.add(chest);chest.add(hair);
 const apply=avatarSecondaryMotion(root);
 const reset=()=>root.traverse(n=>n.quaternion.identity());
 const pose=Object.freeze({motionState:'run',moveX:0,moveZ:180,motionYaw:0});
 for(let i=0;i<30;i++){reset();apply(pose,i/60);}
 assert.ok(hair.quaternion.angleTo(new THREE.Quaternion())>.01);
 reset();apply({...pose,moveZ:0,motionYaw:.4},.5);
 const turned=hair.quaternion.clone();assert.ok(Math.abs(turned.z)>0);
 reset();apply({...pose,moveZ:0,motionYaw:.4},.5);assert.deepEqual(hair.quaternion.toArray(),turned.toArray());
 for(let i=31;i<240;i++){reset();apply({motionState:'idle',moveX:0,moveZ:0,motionYaw:.4},i/60);}
 assert.ok(hair.quaternion.angleTo(new THREE.Quaternion())<1e-5);
 assert.ok(chest.quaternion.angleTo(new THREE.Quaternion())>0);
 assert.ok(chest.quaternion.angleTo(new THREE.Quaternion())<=.02001);
 assert.deepEqual(foot.quaternion.toArray(),[0,0,0,1]);assert.deepEqual(weapon.quaternion.toArray(),[0,0,0,1]);
 reset();apply(pose,0);assert.deepEqual(hair.quaternion.toArray(),[0,0,0,1]);
 reset();apply({motionState:'death'},.1);assert.deepEqual(hair.quaternion.toArray(),[0,0,0,1]);assert.deepEqual(chest.quaternion.toArray(),[0,0,0,1]);
});

test('stride cadence follows actual displacement and model stride at different rates, including blocked movement',()=>{
 const unit={isAlive:true,hp:100,animState:'walk',vx:0,vy:180,attackTimer:0,x:0,y:0};
 const advance=(hz,stride)=>{let t;for(let i=0;i<=hz;i++)t=motionTimeline(t,{...unit,y:i/hz*18},i/hz,0,1,{run:stride});return t;};
 for(const hz of [30,60,144])assert.ok(Math.abs(advance(hz,60).gaitPhase-.3)<1e-9);
 assert.ok(Math.abs(advance(60,120).gaitPhase-.15)<1e-9);
 const t=advance(60,60),blocked=motionTimeline(t,{...unit,y:18},1.1,0,1,{run:60});
 assert.equal(blocked.gaitPhase,t.gaitPhase);
 const teleport=motionTimeline(t,{...unit,y:1000},1.1,0,1,{run:60});assert.equal(teleport.gaitPhase,t.gaitPhase);
 assert.equal(motionTimeline(t,unit,0,0).gaitPhase,0);
});

retiredAvatarAssetTest('real GLB transitions retain the displayed pose when interrupted and never accumulate while paused',async()=>{
 const bytes=await readFile(new URL('../public/models/avatars-v2/c_solana.glb',import.meta.url));
 const file=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 file.scene.traverse(n=>{if(n.userData.avatarPart==='avatar-root')n.userData.assetPreparation={provider:'unirig',animation_mode:'retargeted-native-clips'};});
 const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources);library.files.set('c_solana',file);
 const model=library.instantiate('c_solana'),other=library.instantiate('c_solana');
 const node=m=>{let arm;m.body.traverse(n=>{if(n.userData.avatarPart==='right-arm')arm=n;});return arm;};
 const arm=()=>node(model).quaternion.clone();
 model.animate({motionState:'walk',motionTime:.2},0);const start=arm();
 model.animate({motionState:'attack',motionTime:.1,previousMotion:'walk',motionBlend:0},.01);assert.ok(arm().angleTo(start)<1e-7);
 const halfway={motionState:'attack',motionTime:.2,previousMotion:'walk',motionBlend:.5};
 model.animate(halfway,.11);const mid=arm();
 assert.ok(mid.angleTo(start)>1e-4);
 for(let i=0;i<8;i++){model.animate(halfway,.11);assert.deepEqual(arm().toArray(),mid.toArray());}
 model.animate({motionState:'cast',motionTime:.1,previousMotion:'attack',motionBlend:0},.12);
 assert.deepEqual(arm().toArray(),mid.toArray(),'rapid interruption must start at the displayed blend');
 model.animate({motionState:'cast',motionTime:.2,previousMotion:'attack',motionBlend:1},.32);
 other.animate({motionState:'cast',motionTime:.2},.32);
 assert.ok(arm().angleTo(node(other).quaternion)<1e-7);
 model.dispose();other.dispose();library.close();disposeAvatarRig(file.scene);disposeArenaTerrainResources(file.scene);disposeArenaTerrainResources(resources.owner);
});
