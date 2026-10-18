import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ArenaScenery} from './threeArenaScenery.ts';
import {ArenaScene} from './threeArenaScene.ts';
import {ARAM_BUSHES,CAMP_ROCK_RINGS,ROCK_TERRAIN} from './arenaRules.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';
const matrices=root=>{const all=[];root.traverse(n=>{if(n.isInstancedMesh)all.push(...n.instanceMatrix.array);});return all;};
test('scenery is deterministic, keeps tall trees outside play and decorations on existing walls/brush',()=>{
 const before=JSON.stringify({ARAM_BUSHES,CAMP_ROCK_RINGS,ROCK_TERRAIN}),a=new ArenaScenery(2600,760),b=new ArenaScenery(2600,760);
 assert.deepEqual(matrices(a.root),matrices(b.root));assert.deepEqual(a.footprints,b.footprints);
 for(const p of a.footprints){
  if(p.kind==='tree')assert.ok(p.y+p.radius<0||p.y-p.radius>760,'Tree canopy blocks playable terrain');
  if(p.kind==='torch')assert.ok(ROCK_TERRAIN.some(r=>Math.hypot(r.x-p.x,r.y-p.y)+p.radius<=r.radius),'Brazier blocks a camp entrance');
  if(p.kind==='rock')assert.ok(ROCK_TERRAIN.some(r=>r.x===p.x&&r.y===p.y&&r.radius===p.radius));
 }
 assert.equal(a.footprints.filter(p=>p.kind==='brush').length,ARAM_BUSHES.length);
 assert.equal(JSON.stringify({ARAM_BUSHES,CAMP_ROCK_RINGS,ROCK_TERRAIN}),before);
 assert.equal(a.stats().particleDraws,6);assert.ok(a.stats().particles<1000&&a.stats().instances<5000);
 disposeArenaTerrainResources(a.root);disposeArenaTerrainResources(b.root);
});
test('ambient and banner clocks pause/rewind together without growing buffers or retaining input objects',()=>{
 const scenery=new ArenaScenery(2600,760),tower=new THREE.Group();scenery.root.add(tower);scenery.decorateStructure(tower,{type:'outer_tower',team:'blue'});
 const points=[];scenery.root.traverse(n=>{if(n.isPoints)points.push(n);});
 const positions=points.map(n=>[...n.geometry.attributes.position.array]),count=scenery.root.children.length;
 for(const second of [17,17,24,17,0]){
  scenery.update(second);
  for(const p of points)assert.equal(p.material.uniforms.uTime.value,second);
  tower.traverse(n=>{if(n.material?.uniforms?.uTime)assert.equal(n.material.uniforms.uTime.value,second);});
 }
 assert.deepEqual(points.map(n=>[...n.geometry.attributes.position.array]),positions);assert.equal(scenery.root.children.length,count);
 disposeArenaTerrainResources(scenery.root);
});
test('new static batches, particles and shared structure resources dispose exactly once',()=>{
 const scenery=new ArenaScenery(2600,760),tower=new THREE.Group();scenery.root.add(tower);
 scenery.decorateStructure(tower,{type:'nexus',team:'red'});
 const geometries=new Set(),materials=new Set(),counts=[];let instances=0;
 scenery.root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);if(n.isInstancedMesh)n.addEventListener('dispose',()=>instances++);});
 for(const resource of [...geometries,...materials]){const count={value:0};counts.push(count);resource.addEventListener('dispose',()=>count.value++);}
 disposeArenaTerrainResources(scenery.root);assert.ok(counts.every(c=>c.value===1));assert.ok(instances>40);
});
test('arena water and ambient effects use the borrowed match time without mutating frozen game state',()=>{
 const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}}}),arena=new ArenaScene(new THREE.Mesh(new THREE.PlaneGeometry(2600,760),material),2600,760);
 const base=Object.freeze({champions:Object.freeze([]),minions:Object.freeze([]),structures:Object.freeze([]),camps:Object.freeze([]),wards:Object.freeze([]),spells:Object.freeze([]),projectiles:Object.freeze([]),dragon:Object.freeze({id:'dragon',isAlive:false})});
 const before=JSON.stringify(base);
 for(const second of [12,12,20,12]){arena.update(Object.freeze({...base,second}));assert.equal(arena.ground.material.uniforms.uTime.value,second);assert.equal(arena.scenery.time.value,second);}
 assert.equal(JSON.stringify(base),before);assert.equal(material.uniforms.uTime.value,0,'Original material belongs to the other renderer');
 arena.close();disposeArenaTerrainResources(arena.scene);material.dispose();
});

test('removed structure ornaments release instance buffers while retaining shared scenery geometry',()=>{
 const arena=new ArenaScene(new THREE.Mesh(new THREE.PlaneGeometry(2600,760),new THREE.ShaderMaterial()),2600,760);
 const structure=Object.freeze({id:'tower',type:'outer_tower',team:'blue',x:1050,y:380,isAlive:true,hp:1000,maxHp:1000,range:200});
 const frame={champions:[],minions:[],structures:[structure],camps:[],wards:[],spells:[],projectiles:[],dragon:{id:'dragon',isAlive:false},second:1};
 arena.update(frame);let released=0,geometryReleased=0;
 arena.actors.get('tower').group.traverse(n=>{if(n.isInstancedMesh){n.addEventListener('dispose',()=>released++);n.geometry.addEventListener('dispose',()=>geometryReleased++);}});
 arena.update({...frame,structures:[]});assert.equal(released,3);assert.equal(geometryReleased,0);assert.equal(arena.stats().actors,0);
 arena.close();disposeArenaTerrainResources(arena.scene);assert.equal(geometryReleased,3);
});

test('detailed neutral batches animate without changing camp state and release their own instance buffers',()=>{
 const arena=new ArenaScene(new THREE.Mesh(new THREE.PlaneGeometry(2600,760),new THREE.ShaderMaterial()),2600,760);
 const camp=Object.freeze({id:'camp',type:'dragon_boss',x:1300,y:130,isAlive:true,hp:1000,maxHp:1000,name:'Embermaw',attackTimer:1.2,facingX:-1});
 const frame=Object.freeze({champions:[],minions:[],structures:[],camps:[camp],wards:[],spells:[],projectiles:[],dragon:{id:'other',isAlive:false},second:12});
 const before=JSON.stringify(frame);arena.update(frame);
 const actor=arena.actors.get('camp');let released=0,geometryReleased=0;
 actor.group.traverse(n=>{if(n.isInstancedMesh){n.addEventListener('dispose',()=>released++);n.geometry.addEventListener('dispose',()=>geometryReleased++);}});
 const rotation=actor.body.getObjectByName('left-wing').rotation.z;
 arena.update({...frame,second:14});assert.notEqual(actor.body.getObjectByName('left-wing').rotation.z,rotation);
 arena.update(frame);assert.equal(actor.body.getObjectByName('left-wing').rotation.z,rotation);assert.equal(JSON.stringify(frame),before);
 arena.update({...frame,camps:[]});assert.ok(released>=4);assert.equal(geometryReleased,0);
 arena.close();disposeArenaTerrainResources(arena.scene);assert.ok(geometryReleased>0);
});
