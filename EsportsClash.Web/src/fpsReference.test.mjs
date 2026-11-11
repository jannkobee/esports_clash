import test from 'node:test';
import assert from 'node:assert/strict';
import {fpsReferenceEntries,searchFpsReference,FPS_REFERENCE_SECTIONS} from './fps/fpsReference.ts';
import {FPS_ROLES,rankFpsRoleFits} from './fps/fpsRoleFit.ts';
import {FPS_PERSONALITIES,FPS_PERSONALITY_CATEGORIES} from './fps/fpsPersonality.ts';
import {FPS_WEAPONS} from './fps/weapons.ts';
import {FPS_IDENTITY_PERSONALITIES} from './fps/fpsIdentity.ts';
import {PERSONALITY_IDS} from './playerPersonality.ts';
import {readPediaRoute} from './hexapedia.ts';
import {displayMetrics} from './displayMetrics.ts';
import {apiRecords} from './apiCollections.ts';

test('current FPS reference covers actual personalities, equipment, roles and maps',()=>{
  assert.deepEqual(fpsReferenceEntries('personalities').map(x=>x.id).sort(),FPS_IDENTITY_PERSONALITIES.map(p=>p.id).sort());
  assert.deepEqual(fpsReferenceEntries('legacyPersonalities').map(x=>x.id).sort(),[...PERSONALITY_IDS].sort());
  assert.equal(fpsReferenceEntries('maps').length,5);
  assert.deepEqual([...fpsReferenceEntries('weapons'),...fpsReferenceEntries('equipment')].map(x=>x.id).sort(),Object.keys(FPS_WEAPONS).sort());
  for(const trait of Object.values(FPS_PERSONALITIES))assert.ok(trait.id&&FPS_PERSONALITY_CATEGORIES[trait.category]);
  for(const section of Object.keys(FPS_REFERENCE_SECTIONS))for(const item of fpsReferenceEntries(section))assert.ok(item.name&&item.summary&&item.id);
});

test('leadership and mechanics produce distinct primary/secondary specialties without changing skills',()=>{
  const stats={lan:40,tf:60,iq:90,ldr:99,clu:60,sta:60,flx:50};
  const before=structuredClone(stats),fits=rankFpsRoleFits(stats);
  assert.equal(fits[0].name,'Shotcaller');assert.notEqual(fits[0].id,fits[1].id);
  assert.deepEqual(stats,before);
  assert.equal(rankFpsRoleFits({...stats,lan:99,flx:99,iq:30,ldr:30,clu:30,tf:50})[0].name,'Entry Fragger');
  for(const role of FPS_ROLES)assert.ok(Math.abs(Object.values(role.weights).reduce((a,b)=>a+b,0)-1)<1e-8);
});

test('every FPS directory and record address resolves without entering a disabled MOBA page',()=>{
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
  assert.ok(searchFpsReference('sniper').some(x=>x.href.startsWith('#hexapedia/roles/')));
  const item=Object.values(FPS_WEAPONS).find(x=>x.category==='sniper');
  assert.ok(searchFpsReference(item.name).some(x=>x.href===`#hexapedia/weapons/${item.id}`));
  assert.ok(searchFpsReference('morale').some(x=>x.href==='#hexapedia/legacyPersonalities/captain'));
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
