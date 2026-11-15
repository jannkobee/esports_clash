import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,StandardMaterial} from '@babylonjs/core';
import {LIVE_FPS_MAP,LIVE_BOOST_SPOTS,liveWalkable,liveActorSolids,findLivePath} from './fps/fpsLiveMap.ts';
import {liveGroundHeight,liveTerrainPathClear} from './fps/fpsLiveTerrain.ts';
import {createTacticalOperativeMesh,FpsLiveViewer} from './fps/fpsLiveViewer.ts';

test('restaurant spawns have routes out from under their overhead roof',()=>{
  for(let slot=0;slot<5;slot++){
    const start={x:(slot-2)*2.2,z:-33-(slot%2)*1.4};
    assert.ok(liveWalkable(start));assert.ok(!liveActorSolids(start).some(w=>w.id==='restaurant-roof'));
    for(const goal of [{x:-19,z:-12},{x:20,z:-12}]){
      const path=findLivePath(start,goal);assert.ok(path.length,JSON.stringify(start));
      assert.deepEqual(path.at(-1),goal);
    }
  }
});

test('ground actors pass below roofs while elevated actors still collide with railings',()=>{
  const ground={x:0,z:-33},rail={x:30.4,z:18};
  assert.ok(!liveActorSolids(ground).some(w=>w.id==='restaurant-roof'));
  assert.ok(liveActorSolids(rail,1.8).some(w=>w.id==='b-apartments-parapet'));
  assert.ok(!liveActorSolids({x:6,z:3.35},1.8).some(w=>w.id==='mid-catwalk-pier--1-6'));
});

test('cached static routes are isolated from consumer mutation and threat-aware routes',()=>{
  const from={x:0,z:-33},to={x:-19,z:10};
  const path=findLivePath(from,to),saved=structuredClone(path);assert.ok(path.length>1);
  path[0].x=999;path.pop();
  assert.deepEqual(findLivePath(from,to),saved);
  const threatRoute=findLivePath(from,to,[{x:-19,z:0}],1);
  assert.ok(threatRoute.length);assert.deepEqual(threatRoute.at(-1),to);
  assert.deepEqual(findLivePath(from,to),saved);
});

test('an origin inside a solid cannot manufacture an escape through its walls',()=>{
  const wall=LIVE_FPS_MAP.solids.find(w=>w.id==='a-loggia-wall');
  const from={x:(wall.minX+wall.maxX)/2,z:(wall.minZ+wall.maxZ)/2};
  assert.equal(liveWalkable(from),false);
  for(const target of [{x:-31,z:24},{x:-19,z:9},{x:20,z:10}])assert.deepEqual(findLivePath(from,target),[]);
});

test('terrain checks reject an unbridged crossing and sheer climb without losing stepped access',()=>{
  assert.equal(liveTerrainPathClear({x:10,z:0},{x:10,z:3}),false);
  assert.equal(liveTerrainPathClear({x:0,z:-6},{x:0,z:12}),true);
  for(const perch of LIVE_BOOST_SPOTS){
    const from={x:perch.x,z:perch.z-2.2},to={x:perch.x,z:perch.z};
    assert.equal(liveTerrainPathClear(from,to),false);
    assert.equal(liveTerrainPathClear(from,to,undefined,true),true);
    assert.ok(findLivePath(from,to).length);assert.equal(liveGroundHeight(to),perch.height);
    assert.equal(liveTerrainPathClear({x:perch.x+2,z:perch.z},to,undefined,true),false);
  }
});

test('a death reuses its operative for the corpse and restores the rig for the next round',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),materials=new Map();
  const getMat=color=>{if(!materials.has(color))materials.set(color,new StandardMaterial(color,scene));return materials.get(color);};
  try{
    const operative=createTacticalOperativeMesh('ct','reused',scene,getMat),count=scene.meshes.length;
    const viewer=Object.create(FpsLiveViewer.prototype);
    Object.assign(viewer,{scene,material:getMat,actors:new Map([['reused',{operative}]]),corpseViews:new Map(),corpseTime:0,shadows:{removeShadowCaster(){}}});
    viewer.updateCorpses({time:1,corpses:[{id:1,playerId:'reused',attacking:false,at:1,x:-19,z:-8,y:0,yaw:0,vx:1,vz:0,crouch:false}]});
    assert.equal(viewer.corpseViews.get(1).operative,operative);assert.equal(scene.meshes.length,count);
    for(let i=1;i<45;i++)viewer.updateCorpses({time:1+i/30,corpses:[{id:1,playerId:'reused'}]});
    viewer.updateCorpses({time:3,corpses:[]});
    assert.equal(operative.root.isDisposed(),false);assert.equal(operative.leftElbowPivot.parent,operative.leftArmPivot);
    assert.equal(operative.rightKneePivot.parent,operative.rightLegPivot);assert.equal(operative.spine.position.x,0);
    assert.equal(operative.headPivot.position.y,1.54);assert.equal(scene.meshes.length,count);
  }finally{scene.dispose();engine.dispose();}
});
