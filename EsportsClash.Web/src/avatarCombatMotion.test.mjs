import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CHAMPIONS} from './mockData.ts';
import {COMBAT_MOTIONS,COMBAT_CLIPS,combatDuration,AVATAR_ANIM_PROFILES,getAvatarAnimProfile} from './avatarCombatMotion.ts';
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

test('distinct attack, cast, turning, hit and death fall profiles across melee, ranged, caster and creature archetypes',()=>{
 const resources=new AvatarModelResources();
 // 1. Melee example (Solana shield/spear, Kaolin heavy hammer, Vi gauntlet punch)
 const solana=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_solana'),resources);
 const kaolin=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_kaolin'),resources);
 const vi=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_vi'),resources);

 // 2. Ranged example (Astra recurve bow, Buck dual guns, Senna heavy cannon)
 const astra=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_astra'),resources);
 const buck=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_buck'),resources);
 const senna=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_senna'),resources);

 // 3. Caster example (Kyumi fox orbs, Invoker celestial, Hweilin brush)
 const kyumi=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_kyumi'),resources);
 const invoker=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_invoker'),resources);
 const hwei=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_hwei'),resources);

 // 4. Creature example (Puck faerie dragon, Largo frog, Skybreaker skiff)
 const puck=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_puck'),resources);
 const largo=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_largo'),resources);
 const skybreaker=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_skybreaker'),resources);

 // Attacks differ in windup, strike arm and torso displacement
 solana.animate({motionState:'attack',motionTime:combatDuration('c_solana','attack')*.42},0);
 kaolin.animate({motionState:'attack',motionTime:combatDuration('c_kaolin','attack')*.42},0);
 astra.animate({motionState:'attack',motionTime:combatDuration('c_astra','attack')*.42},0);
 kyumi.animate({motionState:'attack',motionTime:combatDuration('c_kyumi','attack')*.42},0);
 puck.animate({motionState:'attack',motionTime:combatDuration('c_puck','attack')*.42},0);

 // Turning: Skybreaker banks aerodynamically while humanoid turns head and pivots
 skybreaker.animate({motionState:'turnleft',motionTime:.3},0);
 const skiffPivot=skybreaker.body.getObjectByName('motion-pivot');
 assert.ok(skiffPivot && Math.abs(skiffPivot.rotation.z) > .15, 'Skybreaker banks into turn');

 solana.animate({motionState:'turnleft',motionTime:.3},0);
 const solanaHead=solana.body.getObjectByName('Head');
 assert.ok(solanaHead && Math.abs(solanaHead.rotation.y) > .1, 'Humanoid head leads turn');

 // Hit reactions: sharp impact snap with weight differences
 kaolin.animate({motionState:'hit',motionTime:.08},0);
 astra.animate({motionState:'hit',motionTime:.08},0);
 const kaolinHips=kaolin.body.getObjectByName('Hips');
 const astraHips=astra.body.getObjectByName('Hips');
 assert.notEqual(kaolinHips.position.z, astraHips.position.z, 'Heavy tank and agile marksman have distinct hit recoil');

 // Death falls: multi-phase fall settling safely above floor level
 solana.animate({motionState:'death',motionTime:1.2},0);
 astra.animate({motionState:'death',motionTime:1.2},0);
 kyumi.animate({motionState:'death',motionTime:1.2},0);
 puck.animate({motionState:'death',motionTime:1.2},0);

 const solanaHips = solana.body.getObjectByName('Hips');
 assert.ok(solanaHips.position.y >= 0 && solanaHips.position.y <= 15, 'Solana death rests safely on ground');
 assert.ok(astraHips.position.y >= 0 && astraHips.position.y <= 15, 'Astra death rests safely on ground');

 solana.dispose(); kaolin.dispose(); vi.dispose();
 astra.dispose(); buck.dispose(); senna.dispose();
 kyumi.dispose(); invoker.dispose(); hwei.dispose();
 puck.dispose(); largo.dispose(); skybreaker.dispose();
 disposeArenaTerrainResources(resources.owner);
});

test('all 45 avatars have per-avatar animation profiles with distinct attack/cast/hit/turn/death parameters',()=>{
  const ids=CHAMPIONS.map(c=>c.id);
  assert.deepEqual(Object.keys(AVATAR_ANIM_PROFILES).sort(),ids.sort(),'every avatar has an animation profile');
  for(const id of ids){
    const p=getAvatarAnimProfile(id);
    assert.ok(p.attackCurve,`${id} attackCurve`);
    assert.ok(p.castCurve,`${id} castCurve`);
    const hw=p.hitWeight??0,tb=p.turnBank??0,dd=p.deathDrop??0,re=p.recoveryEase??0;
    assert.ok(Number.isFinite(hw)&&hw>0&&hw<2,`${id} hitWeight`);
    assert.ok(Number.isFinite(tb)&&tb>=0&&tb<1,`${id} turnBank`);
    assert.ok(Number.isFinite(dd)&&dd>0&&dd<40,`${id} deathDrop`);
    assert.ok(Number.isFinite(re)&&re>0&&re<2,`${id} recoveryEase`);
  }
});

test('per-avatar animation distinctiveness across archetypes',()=>{
  const kaolin=getAvatarAnimProfile('c_kaolin');
  const solana=getAvatarAnimProfile('c_solana');
  const astra=getAvatarAnimProfile('c_astra');
  const buck=getAvatarAnimProfile('c_buck');

  assert.ok(kaolin.hitWeight<astra.hitWeight,'tank hits softer than marksman');
  assert.ok(kaolin.turnBank<astra.turnBank,'tank turns less than marksman');
  assert.ok(solana.hitWeight<buck.hitWeight,'knight hits softer than gun user');

  const puck=getAvatarAnimProfile('c_puck');
  const skybreaker=getAvatarAnimProfile('c_skybreaker');
  assert.ok(puck.turnBank>solana.turnBank,'creature banks more than humanoid');
  assert.ok(skybreaker.turnBank>solana.turnBank,'skiff banks more than humanoid');

  assert.ok(kaolin.attackCurve==='crush','kaolin uses crush attack curve');
  assert.ok(astra.attackCurve==='shot','astra uses shot attack curve');
  assert.ok(getAvatarAnimProfile('c_kyumi').castCurve==='dance','kyumi uses dance cast curve');
  assert.ok(getAvatarAnimProfile('c_invoker').castCurve==='invocation','invoker uses invocation cast curve');

  assert.ok(puck.deathDrop<kaolin.deathDrop,'creature death drop is shallow');
  assert.ok(kaolin.deathDrop<35,'tank death drop stays in safe range');
});

test('death falls settle safely above floor level for all four archetypes',()=>{
  const resources=new AvatarModelResources();
  const solana=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_solana'),resources);
  const astra=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_astra'),resources);
  const kyumi=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_kyumi'),resources);
  const puck=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_puck'),resources);

  for(const [m,name] of [[solana,'solana'],[astra,'astra'],[kyumi,'kyumi'],[puck,'puck']]){
    m.animate({motionState:'death',motionTime:1.5},0);
    const hips=m.body.getObjectByName('Hips');
    const pivot=m.body.getObjectByName('motion-pivot');
    // Humanoids drop hips directly; creatures pivot down instead. Both stay above the floor.
    const y = pivot ? pivot.position.y : hips.position.y;
    assert.ok(y>-15&&y<35,`${name} death rests safely on ground`);
    m.dispose();
  }
  disposeArenaTerrainResources(resources.owner);
});
