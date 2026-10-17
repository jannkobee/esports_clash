import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPIONS} from './mockData.ts';
import {COMBAT_MOTIONS,COMBAT_CLIPS,combatDuration} from './avatarCombatMotion.ts';
import {AvatarModelResources,buildAvatarModel} from './threeAvatarModels.ts';
import {avatarModelAnimations} from './avatarModelAnimations.ts';
import {motionTimeline} from './avatarMotionTimeline.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('all 45 avatars have directed fighting styles and ten finite, moving native clips',()=>{
 assert.deepEqual(Object.keys(COMBAT_MOTIONS).sort(),CHAMPIONS.map(c=>c.id).sort());
 assert.equal(new Set(Object.values(COMBAT_MOTIONS).map(p=>p.style)).size,11);
 const resources=new AvatarModelResources();
 for(const kit of CHAMPIONS){
  const model=buildAvatarModel(Object.freeze({...kit}),resources),clips=avatarModelAnimations(model);
  assert.deepEqual(clips.map(c=>c.name),COMBAT_CLIPS,kit.id);
  for(const clip of clips){
   assert.ok(clip.tracks.length>30,kit.id+' articulated tracks');
   assert.ok(clip.tracks.every(track=>[...track.values].every(Number.isFinite)));
  }
  const snapshot=()=>{const result=[];model.body.traverse(n=>{if(n.isBone||n.userData.avatarPart)result.push(...n.position.toArray(),...n.quaternion.toArray());});return result;};
  model.animate(Object.freeze({motionState:'attack',motionTime:0}),0);const ready=snapshot();
  model.animate(Object.freeze({motionState:'attack',motionTime:combatDuration(kit.id,'attack')*.42}),0);assert.notDeepEqual(snapshot(),ready,kit.id+' attack has release');
  model.animate(Object.freeze({motionState:'cast',motionTime:.7,previousMotion:'idle',previousMotionTime:.3,motionBlend:0}),0);const blended=snapshot();
  model.animate(Object.freeze({motionState:'idle',motionTime:.3}),0);assert.ok(snapshot().every((v,i)=>Math.abs(v-blended[i])<1e-12),kit.id+' transition starts at prior pose');
  for(const name of ['Idle','Walk','Run','Strafe']){
   const clip=clips.find(c=>c.name===name);
   for(const track of clip.tracks){const size=track.getValueSize();
    const a=[...track.values.slice(0,size)],b=[...track.values.slice(-size)];
    const dot=track.ValueTypeName==='quaternion'?Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0)):0;
    assert.ok(dot>1-1e-5||a.every((v,i)=>Math.abs(v-b[i])<1e-5),kit.id+' '+name+' loops '+track.name);
   }
  }
  model.dispose();
 }
 disposeArenaTerrainResources(resources.owner);
});

test('renderer motion history respects pause/rewind, shortest turns, shot restarts, hit recoil and one death clock',()=>{
 const unit=Object.freeze({isAlive:true,hp:100,animState:'idle',vx:0,vy:0,attackTimer:0});
 let timeline=motionTimeline(undefined,unit,4,Math.PI-.1);
 assert.deepEqual(motionTimeline(timeline,unit,4,Math.PI-.1),timeline,'paused input is stable');
 const turned=motionTimeline(timeline,unit,4.05,-Math.PI+.1);assert.ok(Math.abs(turned.yaw-timeline.yaw)<.2,'shortest angular path');
 const shot=Object.freeze({...unit,animState:'attack',attackTimer:1});timeline=motionTimeline(turned,shot,4.1,0);
 const firedAgain=motionTimeline(timeline,shot,4.5,0);assert.equal(firedAgain.started,4.1);
 const next=motionTimeline(firedAgain,Object.freeze({...shot,attackTimer:2}),4.6,0);assert.equal(next.started,4.6);
 const hurt=motionTimeline(next,Object.freeze({...shot,hp:90}),4.7,0);assert.equal(hurt.hit,4.7);
 const dead=Object.freeze({...unit,isAlive:false,hp:0});const death=motionTimeline(hurt,dead,5,0);
 assert.equal(motionTimeline(death,dead,5.6,0).death,5);
 const rewind=motionTimeline(death,unit,1,0);assert.equal(rewind.started,1);assert.equal(rewind.death,-1);
});
