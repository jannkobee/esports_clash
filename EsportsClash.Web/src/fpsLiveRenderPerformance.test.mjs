import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,MeshBuilder,StandardMaterial,TransformNode} from '@babylonjs/core';
import {createLiveGeometryIndex} from './fps/fpsStaticGeometry.ts';
import {LIVE_FPS_MAP,LIVE_COLLISION_SOLIDS,liveWallIntersections,liveWallSegmentHit,liveSightline} from './fps/fpsLiveMap.ts';
import {liveVillageAsset} from './fps/fpsVillageDesign.ts';
import {fpsSkillRandom} from './fps/fpsSkillProfile.ts';
import {FpsFixedStepClock} from './fps/fpsSpatialWorld.ts';
import {batchStaticLiveGeometry,interpolateLivePlayer,LiveRenderCache} from './fps/fpsLiveRenderOptimization.ts';
import {FpsLiveViewer,createTacticalOperativeMesh,applyOperativeAnimation} from './fps/fpsLiveViewer.ts';
import {launchLiveGrenade} from './fps/fpsLiveGrenades.ts';
import {buildLiveScenery} from './fps/fpsLiveScenery.ts';
import {LiveSurfaceLibrary} from './fps/fpsLiveGraphics.ts';

function sceneFixture(){
  const engine=new NullEngine();
  engine.createCanvas=(width,height)=>({width,height,getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){},
    fillRect(){},clearRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},save(){},restore(){},translate(){},scale(){},fillText(){},
    measureText:text=>({width:text.length*20}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
  })});
  const scene=new Scene(engine),materials=new Map();
  const material=color=>{if(!materials.has(color))materials.set(color,new StandardMaterial(color,scene));return materials.get(color);};
  return {engine,scene,material,dispose(){scene.dispose();engine.dispose();}};
}
test('indexed collision/sight candidates reproduce full geometry intersections for 240 seeded world rays',()=>{
  const random=fpsSkillRandom(42,'broad-phase'),index=createLiveGeometryIndex(LIVE_COLLISION_SOLIDS);
  for(let i=0;i<240;i++){
    const point=()=>({x:random()*68-34,z:random()*86-43,y:random()*6});
    const from=point(),to=point();
    const expected=LIVE_COLLISION_SOLIDS.flatMap(wall=>{const t=liveWallSegmentHit(from,to,wall);return t===undefined?[]:[{wall,t}];}).sort((a,b)=>a.t-b.t);
    assert.deepEqual(liveWallIntersections(from,to),expected);
    assert.equal(liveSightline(from,to,from.y,to.y),expected.length===0);
    for(const hit of expected)assert.ok(index(from,to).includes(hit.wall));
  }
});
test('a rendering work budget retains fixed simulation time until later frames can catch up',()=>{
  const clock=new FpsFixedStepClock(1/30);let ticks=0;
  assert.equal(clock.advance(.2,()=>ticks++,10,()=>false),1);
  assert.ok(clock.pendingSeconds>.16);
  assert.equal(clock.advance(0,()=>ticks++,10),5);assert.equal(ticks,6);assert.ok(clock.pendingSeconds<1e-8);
});

test('real village scenery batches substantially while preserving vertices and transparent geometry',t=>{
  const f=sceneFixture();
  try{
    const library=new LiveSurfaceLibrary(f.scene);buildLiveScenery(f.scene,f.material,library);
    const result=f.scene.metadata.fpsStaticBatch;
    assert.ok(result.output<result.input*.5,JSON.stringify(result));
    assert.equal(result.outputVertices,result.inputVertices);
    const transparent=f.scene.meshes.filter(m=>m.material?.needAlphaBlending());
    const vertices=f.scene.meshes.reduce((n,m)=>n+m.getTotalVertices(),0);
    batchStaticLiveGeometry([...f.scene.meshes]);
    assert.equal(f.scene.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),vertices);
    for(const mesh of transparent)assert.equal(mesh.isDisposed(),false);
    t.diagnostic(JSON.stringify({...result,sceneAfter:f.scene.meshes.length}));
    for(const wall of LIVE_FPS_MAP.solids){
      const base=wall.baseY??0,mesh=MeshBuilder.CreateBox(wall.id,{width:wall.maxX-wall.minX,height:wall.height-base,depth:wall.maxZ-wall.minZ},f.scene);
      mesh.position.set((wall.minX+wall.maxX)/2,base+(wall.height-base)/2,(wall.minZ+wall.maxZ)/2);
      mesh.material=library.material(liveVillageAsset(wall.id).surface,wall.color);mesh.receiveShadows=true;
    }
    const full=batchStaticLiveGeometry([...f.scene.meshes]);
    assert.equal(full.inputVertices,full.outputVertices);assert.ok(full.output<full.input*.85);
    t.diagnostic(JSON.stringify({worldBefore:full.input,worldAfter:full.output,vertices:full.outputVertices}));
  }finally{f.dispose();}
});

test('weapon mesh reuse stays bounded across repeated equipment changes and disposes retained resources',()=>{
  const f=sceneFixture();
  try{
    const cache=new LiveRenderCache(4,mesh=>mesh.dispose());let created=0;
    const get=key=>cache.get(key,()=>{created++;return MeshBuilder.CreateBox(key,{},f.scene);});
    const rifle=get('rifle');
    for(let i=0;i<100;i++){get('knife');assert.equal(get('rifle'),rifle);}
    assert.equal(created,2);assert.equal(f.scene.meshes.length,2);
    for(let i=0;i<12;i++)get(`utility-${i}`);
    assert.equal(f.scene.meshes.length,4);cache.clear();assert.equal(f.scene.meshes.length,0);
  }finally{f.dispose();}
});

test('reload and equip interpolation smooth visual timers while preserving authoritative events',()=>{
  const before={x:0,z:0,yaw:Math.PI-.1,speed:0,reload:2,weaponReady:.4,channel:.2,equipped:'ak47',lastShot:3};
  const current={...before,x:1,z:2,yaw:-Math.PI+.1,speed:4,reload:1.8,weaponReady:.2,channel:.4,lastShot:4};
  const p=interpolateLivePlayer(before,current,.5);
  assert.equal(p.x,.5);assert.equal(p.speed,2);assert.equal(p.reload,1.9);assert.equal(p.lastShot,4);
  assert.ok(Math.abs(p.yaw-Math.PI)<1e-6);
  assert.equal(interpolateLivePlayer(before,{...current,equipped:'glock',reload:0},.5).reload,0);
  assert.equal(before.x,0);
});

const player={id:'smooth',hp:100,x:0,z:0,yaw:0,pitch:0,weapon:'ak47',equipped:'ak47',speed:0,crouch:false,channel:0,reload:0,reloadDuration:2.5,weaponReady:0,lastShot:-100,lastSwing:-100,blinded:0,attacking:true};
test('utility pose changes blend at display rate without delaying the weapon world position',()=>{
  const f=sceneFixture();
  try{
    const run=hz=>{
      const view={operative:createTacticalOperativeMesh('t',`smooth-${hz}`,f.scene,f.material),force:'t',gunNode:new TransformNode('weapon',f.scene)};
      applyOperativeAnimation(view,player,10,1/hz);
      const old=view.operative.rightArmPivot.rotation.x;
      const next={...player,x:10,equipped:'smoke',utilityPrep:{phase:'pin',kind:'smoke',releaseAt:12,throwStyle:'underhand'}};
      applyOperativeAnimation(view,next,10+1/hz,1/hz);
      assert.ok(Math.abs(view.operative.rightArmPivot.rotation.x-old)<.3,'Action changes must not snap the shoulder');
      assert.ok(Math.abs(view.gunNode.position.x-10.2)<1e-5,'World tracking must stay current');
      for(let i=2;i<=hz;i++)applyOperativeAnimation(view,next,10+i/hz,1/hz);
      return view.operative.rightArmPivot.rotation.x;
    };
    assert.ok(Math.abs(run(60)-run(120))<.01);
  }finally{f.dispose();}
});

test('released grenade trails update the same finite geometry without mesh/material growth',()=>{
  const f=sceneFixture(),viewer=Object.create(FpsLiveViewer.prototype);
  Object.assign(viewer,{scene:f.scene,grenadeLineups:new Map(),grenadeOrigins:new Map(),lineupRound:1,lineupTime:0});
  const grenade=launchLiveGrenade(92,'smoke','thrower','red',{x:0,z:-17},{x:0,z:2},10,false,'medium',1.55);
  const frame={round:1,time:10,attackTeam:'red',players:[],grenades:[grenade]};
  try{
    viewer.updateGrenadeLineups(frame,10.1);
    const view=viewer.grenadeLineups.get('grenade:92'),tube=view.tube,line=view.line,geometry=tube.geometry;
    const count=f.scene.meshes.length,materials=f.scene.materials.length;
    for(let i=2;i<=25;i++)viewer.updateGrenadeLineups(frame,10+i/30);
    assert.equal(view.tube,tube);assert.equal(view.line,line);assert.equal(view.tube.geometry,geometry);
    assert.equal(f.scene.meshes.length,count);assert.equal(f.scene.materials.length,materials);
    assert.ok(tube.getVerticesData('position').every(Number.isFinite));
    assert.ok(line.getVerticesData('position').every(Number.isFinite));
  }finally{f.dispose();}
});
