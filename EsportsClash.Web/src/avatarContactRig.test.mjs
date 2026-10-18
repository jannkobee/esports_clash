import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPIONS} from './mockData.ts';
import {AVATAR_CONTACTS,contactGait} from './avatarContactProfiles.ts';
import {twoBoneSolver} from './avatarContactRig.ts';
import {AvatarModelResources,buildAvatarModel} from './threeAvatarModels.ts';
import {motionTimeline} from './avatarMotionTimeline.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';
import {ArenaScene} from './threeArenaScene.ts';
import {avatarDesign} from './avatarDesigns.ts';
import {hasStandingAnatomy} from './avatarStance.ts';
import {weaponCycle} from './avatarWeaponPolish.ts';

test('two bone contact solver reaches targets, obeys the bend pole and clamps unreachable input',()=>{
 const parent=new THREE.Group(),upper=new THREE.Group(),lower=new THREE.Group(),end=new THREE.Group();
 parent.position.set(8,3,-2);parent.rotation.y=.8;parent.scale.setScalar(1.3);parent.add(upper);upper.add(lower);lower.position.y=-11;lower.add(end);end.position.y=-11;
 const solve=twoBoneSolver(upper,lower,end),target=parent.localToWorld(new THREE.Vector3(3,-14,6)),pole=parent.localToWorld(new THREE.Vector3(-10,-4,12));
 const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.4,-.1));solve(target,pole,orientation);parent.updateMatrixWorld(true);
 assert.ok(end.getWorldPosition(new THREE.Vector3()).distanceTo(target)<1e-8);
 assert.ok(end.getWorldQuaternion(new THREE.Quaternion()).angleTo(orientation)<1e-7);
 assert.ok(lower.getWorldPosition(new THREE.Vector3()).distanceTo(pole)<upper.getWorldPosition(new THREE.Vector3()).distanceTo(pole));
 solve(new THREE.Vector3(400,-400,90),pole,orientation);parent.updateMatrixWorld(true);
 assert.ok(end.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
 assert.ok(end.getWorldPosition(new THREE.Vector3()).distanceTo(upper.getWorldPosition(new THREE.Vector3()))<22*1.3);
});

test('all roster fittings exist and both hands maintain contact with bows and two-handed weapons',()=>{
 assert.deepEqual(Object.keys(AVATAR_CONTACTS).sort(),CHAMPIONS.map(c=>c.id).sort());
 const resources=new AvatarModelResources();let fixtures=0;
 for(const kit of CHAMPIONS){
  const profile=AVATAR_CONTACTS[kit.id];if(!profile.bow&&!profile.twoHand)continue;fixtures++;
  const model=buildAvatarModel(kit,resources),parts=new Map();model.body.traverse(n=>{if(n.userData.avatarPart)parts.set(n.userData.avatarPart,n);});
  for(const state of ['idle','walk','run','attack','cast'])for(const time of [0,.18,.42,.7]){
   model.animate(Object.freeze({motionState:state,motionTime:time}),time);model.body.updateMatrixWorld(true);
   const p=profile.twoHand,target=profile.bow?parts.get('bow').localToWorld(new THREE.Vector3(-weaponCycle(kit.id,{motionState:state,motionTime:time},time).draw*5,0,0)):
    parts.get('right-grip').localToWorld(new THREE.Vector3(p==='totem'?-11.5:p==='keg'?-8:p==='gun'?-2:0,p==='gun'?-6:p==='staff'?8:p==='keg'?2:8,p==='totem'||p==='keg'?8:p==='gun'?8:5));
   const palm=model.body.getObjectByName(profile.bow?'HandR':'HandL').localToWorld(new THREE.Vector3(0,-2,0));
   assert.ok(palm.distanceTo(target)<.001,`${kit.id} ${state} ${time}: contact error ${palm.distanceTo(target)}`);
  }
  model.dispose();
 }
 assert.equal(fixtures,12);disposeArenaTerrainResources(resources.owner);
});

test('walking distance drives stride and a stance foot stays fixed as its body moves, including pause and rewind',()=>{
 const resources=new AvatarModelResources(),kit=CHAMPIONS.find(c=>c.id==='c_vi'),model=buildAvatarModel(kit,resources),actor=new THREE.Group();actor.add(model.body);
 const scale=model.body.scale.y,gait=contactGait('walk'),speed=50;let history,first;
 for(let frame=0;frame<12;frame++){
  const second=frame/60,x=0,y=second*speed;
  const unit=Object.freeze({isAlive:true,hp:100,animState:'walk',attackTimer:0,x,y,vx:0,vy:speed});
  history=motionTimeline(history,unit,second,0,scale);actor.position.z=y;
  model.animate(Object.freeze({motionState:history.state,motionTime:second,gaitPhase:history.gaitPhase,plantFeet:true,moveX:0,moveZ:speed}),second);actor.updateMatrixWorld(true);
  const foot=model.body.getObjectByName('FootL').getWorldPosition(new THREE.Vector3());
  if(!first)first=foot.clone();assert.ok(foot.distanceTo(first)<1e-6,'stance foot slides '+foot.distanceTo(first));
  assert.ok(Math.abs(history.gaitPhase-y/(gait.span/gait.stance*scale))<1e-9);
  assert.deepEqual(motionTimeline(history,unit,second,0,scale),history,'paused history');
 }
 assert.equal(motionTimeline(history,{isAlive:true,hp:100,animState:'walk',attackTimer:0,x:0,y:0,vx:0,vy:speed},0,0,scale).gaitPhase,0);
 model.dispose();disposeArenaTerrainResources(resources.owner);
});

test('live stride uses avatar dimensions when the loaded GLB has a 40x meter conversion wrapper',()=>{
 const arena=new ArenaScene(new THREE.Mesh(new THREE.PlaneGeometry(2600,760),new THREE.ShaderMaterial()),2600,760);
 const kit=CHAMPIONS.find(c=>c.id==='c_vi'),model=buildAvatarModel(kit,arena.avatarResources),wrapper=new THREE.Group(),meters=new THREE.Group();
 wrapper.scale.setScalar(40);meters.scale.setScalar(.025);wrapper.add(meters);meters.add(model.body);
 arena.avatarAssets.instantiate=()=>({...model,body:wrapper});arena.avatarAssets.request=()=>Promise.resolve(true);arena.avatarAssets.has=()=>true;
 const unit={id:'contact',champion:kit,team:'blue',x:1000,y:380,isAlive:true,hp:100,facing:'right',animState:'walk',animTimer:0,attackTimer:0,vx:50,vy:0,shield:0,stunTimer:0,charmTimer:0};
 const frame={minions:[],structures:[],camps:[],dragon:{id:'dragon',isAlive:false},wards:[],projectiles:[],spells:[]};
 for(let i=0;i<5;i++)arena.update({...frame,champions:[Object.freeze({...unit,x:unit.x+i})],second:i/50});
 assert.ok(Math.abs(arena.actors.get('contact').motion.gaitPhase-4/(contactGait('walk').span/contactGait('walk').stance*model.body.scale.y))<1e-9);
 arena.close();disposeArenaTerrainResources(arena.scene);
});

test('every grounded avatar holds stance contacts throughout walk, run and lateral steps',()=>{
 const resources=new AvatarModelResources();let count=0;
 for(const kit of CHAMPIONS){
  if(!hasStandingAnatomy(kit.id)&&!['machine','hedgehog'].includes(avatarDesign(kit.id).body))continue;
  const model=buildAvatarModel(kit,resources),actor=new THREE.Group();actor.add(model.body);
  if(model.body.userData.floating){model.dispose();continue;}count++;
  for(const state of ['walk','run','strafe']){
   const previous=[null,null],gait=contactGait(state),scale=model.body.scale.y;
   for(let f=0;f<=90;f++){
    const phase=f/90,along=phase*gait.span/gait.stance*scale;
    actor.position.set(state==='strafe'?along:0,0,state==='strafe'?0:along);
    model.animate(Object.freeze({motionState:state,motionTime:phase,gaitPhase:phase,plantFeet:true,moveX:state==='strafe'?1:0,moveZ:state==='strafe'?0:1}),phase);actor.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
     const foot=model.body.getObjectByName('Foot'+(i?'R':'L')).getWorldPosition(new THREE.Vector3()),stance=(phase+i*.5)%1<gait.stance;
     if(stance&&previous[i])assert.ok(Math.hypot(foot.x-previous[i].x,foot.z-previous[i].z)<1e-5,`${kit.id} ${state} stance contact`);
     assert.ok(foot.toArray().every(Number.isFinite));previous[i]=stance?foot:null;
    }
   }
  }
  model.dispose();
 }
 assert.equal(count,37);disposeArenaTerrainResources(resources.owner);
});
