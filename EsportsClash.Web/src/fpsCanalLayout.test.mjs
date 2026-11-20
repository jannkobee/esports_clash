import test from 'node:test';
import assert from 'node:assert/strict';
import {LIVE_FPS_MAP,LIVE_TACTICAL,LIVE_CHOKES,findLivePath,liveWalkable,liveSightline,liveWallIntersections} from './fps/fpsLiveMap.ts';
import {LIVE_CANAL,LIVE_PORT,LIVE_BRIDGE,liveCutPavingRect,liveTerrainPathClear,liveGroundHeight} from './fps/fpsLiveTerrain.ts';
import {NullEngine,Scene,MeshBuilder,StandardMaterial} from '@babylonjs/core';
import {buildCanalWaterfront} from './fps/fpsCanalWaterfront.ts';

test('canal has dry compact bridge approaches, protected crossings and no walkable water shortcuts',()=>{
  assert.equal(LIVE_CANAL.maxZ-LIVE_CANAL.minZ,5);
  assert.equal(LIVE_CANAL.minZ-LIVE_BRIDGE.southApproach,4);
  for(const x of [-12,11,25])assert.equal(liveWalkable({x,z:0}),false);
  for(const x of [-31,-19,0,20,32]){
    const from={x,z:-7},to={x,z:10},path=findLivePath(from,to);
    assert.ok(path.length,`Crossing ${x} must remain connected`);
    let previous=from;
    for(const point of path){assert.ok(liveTerrainPathClear(previous,point));previous=point;}
    assert.deepEqual(path.at(-1),to);
  }
});

test('customs port is behind the dry CT spawn, with clear departures and no landscape covering harbor water',()=>{
  assert.ok(LIVE_PORT.minZ>43);
  const paving=liveCutPavingRect({minX:-115,maxX:115,minZ:-125,maxZ:125});
  for(const x of [-90,0,90])for(const z of [46,65,110])assert.ok(!paving.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ));
  for(const from of [{x:-5.5,z:41.5},{x:-3.5,z:40},{x:0,z:42},{x:3.5,z:41.5},{x:5.7,z:40}]){
    assert.ok(liveWalkable(from));assert.equal(liveGroundHeight(from),0);
    for(const site of ['A','B'])assert.ok(findLivePath(from,LIVE_TACTICAL[site].holds[0]).length);
  }
  assert.ok(liveSightline({x:0,z:42},{x:0,z:58},1.6,1.6),'The harbor must be visible over the low quay edge');
});

test('B has a low covered entry and tight masonry sides while A keeps an open approach',()=>{
  assert.ok(LIVE_CHOKES.find(c=>c.name==='B main').width<LIVE_CHOKES.find(c=>c.name==='A main').width);
  const ceiling=liveWallIntersections({x:18.5,y:1.6,z:9.5},{x:18.5,y:8,z:9.5});
  // The covered entry's ceiling: the slab, or one of the drawn timbers under it (they collide since 2026-11-20).
  assert.match(ceiling[0]?.wall.id??'',/^(b-sottoportego|visual-mercato-ceiling-)/);
  assert.ok(ceiling.some(h=>h.wall.id==='b-sottoportego'));
  assert.equal(liveWallIntersections({x:-19,y:1.6,z:9.5},{x:-19,y:8,z:9.5}).length,0);
  assert.ok(!liveSightline({x:18.5,z:11},{x:26,z:11}),'Tall shop row breaks the main-to-gallery cross angle');
  assert.ok(liveSightline({x:18.5,z:12},{x:18.5,z:19}),'Main entrance still opens onto the fountain side');
  assert.ok(liveSightline({x:-32,z:17.1},{x:-18,z:17.1}),'A retains its broad courtyard engagement');
  for(const site of ['A','B'])for(const point of [...LIVE_TACTICAL[site].entries,...LIVE_TACTICAL[site].holds,...LIVE_TACTICAL[site].postPlant]){
    assert.ok(liveWalkable(point),JSON.stringify(point));
    assert.ok(findLivePath(LIVE_FPS_MAP.spawns.attackers,point).length);
  }
});

test('waterfront meshes construct with finite geometry and boats stay inside the non-playable water',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),materials=new Map();
  const detail=(mesh,color)=>{if(!materials.has(color))materials.set(color,new StandardMaterial(color,scene));mesh.material=materials.get(color);mesh.isPickable=false;return mesh;};
  const box=(name,x,y,z,w,h,d,color)=>{const mesh=detail(MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),color);mesh.position.set(x,y,z);return mesh;};
  try{
    buildCanalWaterfront(scene,{box,detail});
    for(const name of ['canal-moored-gondola-west-hull','port-police-launch-hull','port-pier-deck','b-passage-lintel-7.87'])assert.ok(scene.getMeshByName(name),name);
    for(const mesh of scene.meshes){assert.ok(mesh.getVerticesData('position').every(Number.isFinite));assert.ok(mesh.position.asArray().every(Number.isFinite));}
    for(const name of ['canal-moored-gondola-west-hull','canal-moored-gondola-east-hull']){
      const mesh=scene.getMeshByName(name);mesh.computeWorldMatrix(true);const bounds=mesh.getBoundingInfo().boundingBox;
      assert.ok(bounds.minimumWorld.z>LIVE_CANAL.minZ&&bounds.maximumWorld.z<LIVE_CANAL.maxZ);
      assert.equal(liveWalkable({x:mesh.position.x,z:mesh.position.z}),false);
    }
  }finally{scene.dispose();engine.dispose();}
});
