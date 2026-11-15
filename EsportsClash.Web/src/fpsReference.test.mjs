import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fpsReferenceEntries,searchFpsReference,FPS_REFERENCE_SECTIONS} from './fps/fpsReference.ts';
import {FPS_MAPS} from './fps/fpsMaps.ts';
import {FPS_WEAPONS} from './fps/fpsWeapons.ts';
import {LIVE_WEAPONS,canBuyLiveWeapon} from './fps/fpsLiveWeapons.ts';
import {listLiveMaps} from './fps/fpsLiveMapRegistry.ts';
import {FPS_IDENTITY_PERSONALITIES} from './fps/fpsIdentity.ts';
import {readPediaRoute} from './hexapedia.ts';
import {displayMetrics} from './displayMetrics.ts';
import {apiRecords} from './apiCollections.ts';

test('current FPS reference covers actual personalities, equipment, roles and maps',()=>{
  assert.deepEqual(fpsReferenceEntries('personalities').map(x=>x.id).sort(),FPS_IDENTITY_PERSONALITIES.map(p=>p.id).sort());
  const expectedMaps=[...listLiveMaps().map(m=>m.id),...Object.keys(FPS_MAPS)].sort();
  assert.deepEqual(fpsReferenceEntries('maps').map(x=>x.id).sort(),expectedMaps);
  const expectedLiveWeapons=Object.keys(LIVE_WEAPONS).filter(id=>canBuyLiveWeapon(id,true)||canBuyLiveWeapon(id,false));
  const expectedGear=[...Object.keys(FPS_WEAPONS),...expectedLiveWeapons,'live_knife','live_smoke','live_flash','live_incendiary','live_he','live_c4'].sort();
  assert.deepEqual([...fpsReferenceEntries('weapons'),...fpsReferenceEntries('equipment')].map(x=>x.id).sort(),expectedGear);
  assert.ok(fpsReferenceEntries('liveSimulation').length>=5);
  assert.ok(fpsReferenceEntries('roles').length===FPS_T_POSITIONS.length+FPS_CT_POSITIONS.length);
  for(const section of Object.keys(FPS_REFERENCE_SECTIONS))for(const item of fpsReferenceEntries(section))assert.ok(item.name&&item.summary&&item.id);
  assert.ok(searchFpsReference('Spillway').some(r=>r.href==='#hexapedia/maps/spillway'));
  assert.ok(searchFpsReference('Influence').some(r=>r.href.startsWith('#hexapedia/liveSimulation/')));
  assert.ok(searchFpsReference('Death-Callout').some(r=>r.href.startsWith('#hexapedia/liveSimulation/')));
});

test('every FPS directory and record address resolves cleanly',()=>{
  const previous=globalThis.window;
  try{
    for(const section of Object.keys(FPS_REFERENCE_SECTIONS)){
      globalThis.window={location:{hash:`#hexapedia/${section}`}};
      assert.equal(readPediaRoute().page,section);
      for(const item of fpsReferenceEntries(section)){
        globalThis.window.location.hash=`#hexapedia/${section}/${item.id}`;
        assert.deepEqual(readPediaRoute(),{page:section,id:item.id});
      }
    }
    globalThis.window.location.hash='#hexapedia/personalities/%zz';
    assert.ok(readPediaRoute().error);
  }finally{globalThis.window=previous;}
});

test('FPS search returns working references from the active equipment and role catalog',()=>{
  assert.ok(searchFpsReference('Anchor').some(x=>x.href.startsWith('#hexapedia/roles/')));
  const item=Object.values(FPS_WEAPONS).find(x=>x.category==='sniper');
  assert.ok(searchFpsReference(item.name).some(x=>x.href===`#hexapedia/weapons/${item.id}`));
  assert.equal(fpsReferenceEntries('personalities').length,54);assert.equal(fpsReferenceEntries('roles').length,10);assert.equal(fpsReferenceEntries('attributes').length,6);
});

test('optional nested operational metrics never become unrenderable React objects',()=>{
  const metrics=displayMetrics({pending_jobs:2,engine:{active:true,last_run:null},queues:['world','default']});
  assert.deepEqual(metrics,[['pending jobs','2'],['engine / active','Yes'],['engine / last run','Not recorded'],['queues','2 entries']]);
  assert.ok(metrics.every(([,value])=>typeof value==='string'));
});

test('keyed Laravel collections support settled Settings and Hexapedia list rendering',()=>{
  const rows={club_31:{club_id:31,club:'Club 31'},club_92:{club_id:92,club:'Club 92'}};
  assert.deepEqual(apiRecords(rows).slice(0,1).map(x=>x.club_id),[31]);
  assert.deepEqual(apiRecords([{id:1},{id:2}]).filter(x=>x.id===2),[{id:2}]);
  assert.deepEqual(apiRecords(null),[]);
  assert.deepEqual(apiRecords({bad:null,good:{id:1}}),[{id:1}]);
});
