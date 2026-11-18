import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {Store,modelKey} from '../../infrastructure/automatic-learning/store.mjs';
import {experienceRecords,ingestExperience,pullAndPublish} from '../../infrastructure/automatic-learning/ingest.mjs';
import {buildFpsMatchExperience} from './fps/fpsLineageExperience.ts';

const row=(id,rounds,extra={})=>({id,lineage:'club:7',match_ref:`m-${id}`,payload:{map:'fontessa',rounds,utility:[],...extra}});
const round=(n,won)=>({round:n,side:'defense',play_id:'seed:stack_b',won,opponent:'club:9',observed:{opponentAttacked:true,plantSite:'B',earlyRush:false}});

test('a finished match becomes a lawful, bounded submission',()=>{
  const updates=[1,2].map(n=>({round:{id:`ep:1:${n}:blue:play`,side:'attack',playId:'seed:rush_b',won:n===1,opponent:'club:3'},
    observed:{opponent:'club:3',seen:{opponentAttacked:false,earlyRush:false,slowDefault:false,heavyUtility:false,saved:true,passiveAnchors:true}},change:{}}));
  const body=buildFpsMatchExperience('live-123-blue','spillway',updates);
  assert.deepEqual(body.rounds.map(r=>r.round),[1,2]);
  assert.equal(body.rounds[0].play_id,'seed:rush_b');
  assert.ok(!JSON.stringify(body).includes('hexatrick:'),'nothing from browser storage');
});

test('the worker applies club experience to that club lineage only, once, forking it from main',()=>{
  const dir=mkdtempSync(tmpdir()+'/fps-ingest-');let store;
  try{
    store=new Store(dir);const main=structuredClone(store.get('model'));
    const result=ingestExperience(store,[row(1,[round(1,true),round(2,false)]),row(2,[{...round(1,true),play_id:'v:unknown'}]),row(3,[round(3,true)],{map:'nowhere'})]);
    assert.deepEqual(result.changed,['club:7']);
    assert.deepEqual(result.rejected.map(r=>r.id),[2,3],'unknown plays and maps reject the whole row');
    const club=store.get(modelKey('club:7'));
    assert.equal(club.playbooks.fontessa.defense['seed:stack_b'].trials,2);
    assert.equal(club.playbooks.fontessa.defense['seed:stack_b'].vs['club:9'].wins,1);
    assert.equal(club.opponents.opponents['club:9'].plants.B,2);
    assert.equal(store.versions('club:7')[0].reason,'forked');
    assert.deepEqual(store.get('model'),main,'the main lineage is untouched');
    assert.equal(store.get(modelKey('club:7')).playbooks.fontessa.rounds,2,'the rejected row left no partial learning');
    ingestExperience(store,[row(1,[round(1,true),round(2,false)])]);
    assert.equal(store.get(modelKey('club:7')).playbooks.fontessa.rounds,2,'resubmitted rows are deduplicated');
    assert.equal(store.get('experienceAfter'),3);
    assert.throws(()=>experienceRecords({...row(4,[round(1,true)]),lineage:'worker:main'}),/Invalid experience row/);
  }finally{try{store?.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});

test('pull-and-publish sends each changed club lineage back as a promoted version',async()=>{
  const dir=mkdtempSync(tmpdir()+'/fps-pull-');let store;
  try{
    store=new Store(dir);const calls=[];
    const fetchImpl=async(url,init={})=>{calls.push({url,init});
      if(url.includes('/fps/lineage-experience'))return new Response(JSON.stringify({version:1,experience:[row(5,[round(1,true)])]}));
      return new Response('{}',{status:201});};
    const result=await pullAndPublish(store,{url:'https://api.example/v1',token:'t'.repeat(40),fetchImpl});
    assert.deepEqual(result.changed,['club:7']);
    const publish=calls.find(c=>c.url.endsWith('/fps/lineages/club%3A7/versions'));
    const body=JSON.parse(publish.init.body);
    assert.equal(body.kind,'bundle');assert.equal(body.promote,true);assert.equal(body.origin,'real-match');
    assert.equal(JSON.parse(body.payload).playbooks.fontessa.rounds,1);
    assert.equal(await pullAndPublish(store,{url:undefined,token:undefined}),null,'disabled without API settings');
  }finally{try{store?.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});
