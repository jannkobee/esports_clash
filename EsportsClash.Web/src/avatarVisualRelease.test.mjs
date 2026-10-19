import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {visualReleaseUrl,validateVisualReleases} from './avatarVisualRelease.ts';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources} from './threeAvatarModels.ts';
import {avatarModelUrl} from './avatarModelUrl.ts';
import {ArenaAbilityEffects} from './threeAbilityEffects.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('approved visual URLs require a numeric release and complete content hash',()=>{
  assert.equal(visualReleaseUrl({id:2,sha256:'a'.repeat(64)},'/api/v1'),'/api/v1/avatar-visuals/assets/2/'+'a'.repeat(64)+'.glb');
  assert.equal(visualReleaseUrl({id:-1,sha256:'a'.repeat(64)}),undefined);
  assert.equal(visualReleaseUrl({id:2,sha256:'../unreviewed'}),undefined);
});
test('one release snapshot is retained for a renderer and a failed approved asset falls back to its original',async()=>{
  const oldFetch=globalThis.fetch,oldWindow=globalThis.window,resources=new AvatarModelResources();
  try{
    globalThis.window={};let requests=0;
    globalThis.fetch=async()=>{requests++;return {ok:true,json:async()=>({releases:[{id:7,avatar_id:'c_astra',variant:'current',sha256:'a'.repeat(64)}]})};};
    const library=new AvatarAssetLibrary(resources),loaded=[];
    library.loader.loadAsync=async url=>{loaded.push(url);if(url.includes('/avatar-visuals/'))throw Error('Offline release');return {scene:new THREE.Group(),animations:[]};};
    assert.equal(await library.request('c_astra'),true);
    assert.equal(library.sourceUrl('c_astra'),avatarModelUrl('c_astra'));
    globalThis.fetch=async()=>{throw Error('An active scene must not refresh releases');};
    assert.equal(await library.request('c_kyumi'),true);
    assert.equal(requests,1);assert.equal(loaded.length,3);library.close();
  }finally{globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;disposeArenaTerrainResources(resources.owner);}
});
test('a match-pinned snapshot survives renderer recreation without fetching the current global manifest',async()=>{
  const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
  const pinned=Promise.resolve(validateVisualReleases([{id:9,avatar_id:'c_astra',variant:'current',sha256:'a'.repeat(64)}]));
  try{
    globalThis.window={};globalThis.fetch=async()=>{throw Error('A pinned match must not fetch a newer global release');};
    for(let scene=0;scene<2;scene++){
      const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources,undefined,pinned),urls=[];
      library.loader.loadAsync=async url=>{urls.push(url);return {scene:new THREE.Group(),animations:[]};};
      assert.equal(await library.request('c_astra'),true);assert.deepEqual(urls,['/backend/api/v1/avatar-visuals/assets/9/'+'a'.repeat(64)+'.glb']);
      library.close();disposeArenaTerrainResources(resources.owner);
    }
    assert.equal(validateVisualReleases([{id:1,avatar_id:'c_astra',variant:'current',sha256:'../invalid'}]).size,0);
  }finally{globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});
test('evolved ability decoration is bounded, follows existing lifetimes and leaves borrowed events unchanged',()=>{
  const baseline=new ArenaAbilityEffects(),evolved=new ArenaAbilityEffects();
  const spell=Object.freeze({id:'test',type:'skill_burst',avatarName:'Kaelen',x:20,y:30,radius:40,duration:.5,maxDuration:1,color:'#83efff',sourceUnitId:'source'});
  const source=Object.freeze({id:'source',x:20,y:30,isAlive:true,champion:Object.freeze({name:'Kaelen'}),
    visualEvolution:Object.freeze({version:1,facet_count:10000,accent_height:10000,trail_segments:10000})});
  const snapshot=JSON.stringify({spell,source});baseline.update([], [spell], .5, [{...source,visualEvolution:undefined}]);evolved.update([], [spell], .5, [source]);
  assert.equal(evolved.stats().effects-baseline.stats().effects,5);
  for(const mesh of evolved.pool.slice(0,5))assert.ok(Math.hypot(mesh.position.x-spell.x,mesh.position.z-spell.y)<spell.radius);
  evolved.update([],[{...spell,duration:0}],1,[source]);assert.equal(evolved.stats().effects,0);
  assert.equal(JSON.stringify({spell,source}),snapshot);
  disposeArenaTerrainResources(baseline.root);disposeArenaTerrainResources(evolved.root);
});
