import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {Store,modelKey} from '../../infrastructure/automatic-learning/store.mjs';
import {baseline,sha,validateBundle} from '../../infrastructure/automatic-learning/model.mjs';
import {runMatch} from '../../infrastructure/automatic-learning/match.mjs';
import {teamLearningFromLineage} from './fps/fpsApprovedLearning.ts';
import {createFpsUtilityBrain} from './fps/fpsUtilityBrain.ts';

test('the rival worker lineage forks from main and experience lands only in its own lineage',async()=>{
  const directory=mkdtempSync(tmpdir()+'/fps-lineage-');let store;
  try{
    store=new Store(directory);
    const main=store.get('model'),rival=store.get(modelKey('worker:rival'));
    assert.deepEqual(rival,main,'the rival starts from the main lineage, not from scratch');
    const fork=store.versions('worker:rival')[0];
    assert.equal(fork.reason,'forked');assert.equal(fork.parent,store.versions('worker:main').at(-1).sha);
    assert.throws(()=>store.append({id:'x',kind:'combat',lineage:'worker:other',payload:{}},true),/Invalid experience envelope/);
    const records=[];
    const result=await runMatch({id:'lineage-run',seed:5,group:0,mode:'learn',lineages:{blue:'worker:main',red:'worker:rival'},
      blue:main,red:rival,maxSimulatedSeconds:240,maxMatchWallSeconds:240},r=>records.push(r));
    const learning=records.filter(r=>['navigation','combat','movement','utility'].includes(r.kind));
    assert.ok(learning.length>0);
    assert.ok(learning.every(r=>r.lineage==='worker:main'||r.lineage==='worker:rival'),'every learning record names its team lineage');
    for(const record of records)store.append(record,true,new Date('2026-02-01T01:00Z'));
    const mainUtility=learning.filter(r=>r.kind==='utility'&&r.lineage==='worker:main').reduce((n,r)=>n+r.payload.throws,0);
    const rivalUtility=learning.filter(r=>r.kind==='utility'&&r.lineage==='worker:rival').reduce((n,r)=>n+r.payload.throws,0);
    assert.equal(store.get('model').utility.throws-main.utility.throws,mainUtility);
    assert.equal(store.get(modelKey('worker:rival')).utility.throws-rival.utility.throws,rivalUtility);
    for(const lineage of ['worker:main','worker:rival']){
      const plays=records.filter(r=>r.kind==='playbook'&&r.lineage===lineage),book=store.get(modelKey(lineage)).playbooks.fontessa;
      assert.ok(plays.length>0,'each team learns its own playbook');assert.equal(book.rounds,plays.length);
      const other=lineage==='worker:main'?'worker:rival':'worker:main';
      assert.equal(store.get(modelKey(lineage)).opponents.opponents[other].rounds,plays.length,'the opponent model tracks the rival lineage');
      assert.doesNotThrow(()=>validateBundle(store.get(modelKey(lineage))),'a learned bundle (with its playbook) stays valid for the next job');
    }
    assert.ok(result.utility.throws>=mainUtility+rivalUtility);
    await store.archive(new Date('2026-02-01T03:00Z'));
    for(const lineage of ['worker:main','worker:rival'])
      assert.equal(store.versions(lineage).at(-1).sha,sha(JSON.stringify(store.get(modelKey(lineage)))),'hourly snapshots record each lineage');
    store.close();store=new Store(directory);
    assert.ok(store.versions('worker:rival').length>=2,'history survives a restart');
  }finally{try{store?.close();}catch{}rmSync(directory,{recursive:true,force:true});}
});

test('lineage responses parse per kind and fall back to the approved bundle',()=>{
  const approved=teamLearningFromLineage('worker:main',{kinds:{bundle:{version:3,payload:baseline()}}});
  assert.equal(approved.source,'server');assert.equal(approved.versions.bundle,3);assert.ok(approved.models.navigation);
  const utility=createFpsUtilityBrain();utility.throws=4;utility.successes=2;
  const mixed=teamLearningFromLineage('club:9',{kinds:{utility:{version:2,payload:utility}}},approved.models);
  assert.equal(mixed.models.utility.throws,4,'the lineage utility brain overrides the fallback');
  assert.equal(mixed.models.navigation,approved.models.navigation);
  const empty=teamLearningFromLineage('club:9',{kinds:{}},approved.models);
  assert.equal(empty.source,'approved');assert.equal(empty.models,approved.models);
  assert.equal(teamLearningFromLineage('club:9',{kinds:{bundle:{version:1,payload:{version:2}}}},undefined).models,undefined,'an invalid bundle is not used');
});

test('unappliable learning records are quarantined, not fatal, and Spillway jobs pass the worker invariants',async()=>{
  const directory=mkdtempSync(tmpdir()+'/fps-quarantine-');let store;
  try{
    store=new Store(directory);
    const bad={id:'q1',kind:'playbook',lineage:'worker:main',payload:{id:'q1',map:'fontessa',round:{id:'q1',side:'attack',playId:'v:missing',won:true}}};
    assert.equal(store.appendOrQuarantine(bad,true),false);
    assert.deepEqual(store.quarantined().map(q=>[q.id,q.reason]),[['q1','Unknown play']]);
    assert.throws(()=>store.appendOrQuarantine({id:'x',kind:'nope'},true),/Invalid experience envelope/);
    const main=store.get('model');
    const result=await runMatch({id:'spillway-run',seed:9,group:0,mode:'learn',mapId:'spillway',lineages:{blue:'worker:main',red:'worker:rival'},
      blue:main,red:store.get(modelKey('worker:rival')),maxSimulatedSeconds:240,maxMatchWallSeconds:240},()=>{});
    assert.ok(result.rounds>=1,`spillway match played rounds (failure: ${result.failure})`);
    assert.ok(!String(result.failure).includes('invariant'));
  }finally{try{store?.close();}catch{}rmSync(directory,{recursive:true,force:true});}
});
