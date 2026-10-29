import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CHAMPIONS} from './mockData.ts';
import {avatarModelUrl,getArsenaldoModelVariant} from './avatarModelUrl.ts';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources} from './threeAvatarModels.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('the all-45 fresh start exposes no deleted model URLs or legacy imported selection',()=>{
  assert.equal(CHAMPIONS.length,45);
  for(const champion of CHAMPIONS){assert.equal(avatarModelUrl(champion.id),'');assert.equal(existsSync(new URL('../public/models/avatars-v9/'+champion.id+'.glb',import.meta.url)),false);}
  for(const variant of ['current','claude','submitted'])assert.equal(avatarModelUrl('c_invoker',variant),'');
  assert.equal(getArsenaldoModelVariant(),'current');
});
test('a renderer with no published replacement makes no request for deleted assets',async()=>{
  const previous=globalThis.window;globalThis.window={};const resources=new AvatarModelResources();
  try{
    const library=new AvatarAssetLibrary(resources,undefined,Promise.resolve(new Map()));let loads=0;
    library.loader.loadAsync=async()=>{loads++;throw Error('Deleted asset must not be loaded');};
    assert.equal(await library.request('c_invoker'),false);assert.equal(loads,0);library.close();
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;disposeArenaTerrainResources(resources.owner);}
});
