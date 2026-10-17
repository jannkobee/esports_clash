import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ArenaScene, applyArenaSceneCamera, arenaScenePan, clampArenaSceneCamera } from './threeArenaScene.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';
import {CHAMPIONS} from './mockData.ts';

test('tilted camera ground projection and drag agree at desktop and portrait aspects', () => {
  for (const aspect of [2.4, 16 / 9, .65]) for (const zoom of [1, 1.45, 2.5]) {
    const camera = new THREE.OrthographicCamera();
    applyArenaSceneCamera(camera, 1300, 380, zoom, aspect, 2600);
    const origin = new THREE.Vector3(1300, 0, 380).project(camera);
    assert.ok(Math.abs(origin.x) < 1e-12 && Math.abs(origin.y) < 1e-12);
    const pan = arenaScenePan(.2, .3, zoom, aspect, 2600);
    const point = new THREE.Vector3(1300 + pan.x, 0, 380 + pan.y).project(camera);
    assert.ok(Math.abs(point.x - .2) < 1e-12);
    assert.ok(Math.abs(point.y + .3) < 1e-12);
    const view = clampArenaSceneCamera(-999, 9999, zoom, aspect, 2600, 760);
    assert.ok(view.x >= 0 && view.x <= 2600 && view.y >= 0 && view.y <= 760);
    if (view.halfH * 2 >= 760) assert.equal(view.y, 380);
  }
});

test('seen champion deaths animate briefly without changing frozen units, then release the actor',()=>{
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(2600,760),new THREE.ShaderMaterial());
 const arena=new ArenaScene(ground,2600,760);
 const unit=Object.freeze({id:'dying',champion:CHAMPIONS[0],team:'blue',x:1000,y:380,isAlive:true,hp:100,
  facing:'right',animState:'idle',animTimer:0,attackTimer:0,vx:0,vy:0,shield:0,stunTimer:0,charmTimer:0});
 const base={champions:[unit],minions:[],structures:[],camps:[],dragon:{id:'dragon',isAlive:false},wards:[],projectiles:[],spells:[],second:1};
 arena.update(base);assert.equal(arena.stats().actors,1);
 const dead=Object.freeze({...unit,isAlive:false,hp:0,animState:'dead'}),before=JSON.stringify(dead);
 arena.update({...base,champions:[dead],second:1.1});assert.equal(arena.stats().actors,1,'death pose retained');
 arena.update({...base,champions:[dead],second:1.6});assert.equal(arena.stats().actors,1);
 arena.update({...base,champions:[dead],second:2.4});assert.equal(arena.stats().actors,0,'expired corpse removed');
 assert.equal(JSON.stringify(dead),before);arena.close();disposeArenaTerrainResources(arena.scene);
});

test('3D scene reads frozen live inputs and reclaims removed actors and pooled effect resources', () => {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 760), new THREE.ShaderMaterial());
  const arena = new ArenaScene(ground, 2600, 760);
  let instanceDisposals = 0;
  arena.scene.traverse(object => {
    if (object instanceof THREE.InstancedMesh) object.addEventListener('dispose', () => instanceDisposals++);
  });
  const champion = Object.freeze({ id: 'avatar', primaryRole: 'Mage', primaryColor: '#395fa8', accentColor: '#97dcff' });
  const unit = Object.freeze({ id: 'champion', champion, team: 'blue', x: 1200, y: 380, isAlive: true,
    facing: 'right', animState: 'cast', animTimer: .1, shield: 10, stunTimer: 0, charmTimer: 0 });
  const frame = Object.freeze({ champions: Object.freeze([unit]), minions: Object.freeze([]), structures: Object.freeze([]),
    camps: Object.freeze([]), dragon: Object.freeze({ id: 'dragon', isAlive: false }), wards: Object.freeze([]),
    projectiles: Object.freeze([Object.freeze({ id: 'shot', x: 1240, y: 380, size: 4, color: '#ffffff', angle: 0 })]),
    spells: Object.freeze([]), second: 10 });
  const original = JSON.stringify(frame);
  arena.update(frame); const first = arena.stats();
  arena.update(frame);
  assert.equal(JSON.stringify(frame), original);
  assert.equal(first.actors, 1); assert.ok(first.effects > 2);
  assert.deepEqual(arena.stats(), first);
  arena.update({ ...frame, champions: [], projectiles: [] });
  assert.equal(arena.stats().actors, 0);
  assert.equal(arena.stats().effects, 0);
  assert.equal(arena.stats().pooledEffects, first.pooledEffects);
  const stats = disposeArenaTerrainResources(arena.scene);
  assert.ok(stats.geometries >= 8 && stats.materials >= 12);
  assert.ok(instanceDisposals > 5, 'instanced props release their GPU instance buffers');
});
