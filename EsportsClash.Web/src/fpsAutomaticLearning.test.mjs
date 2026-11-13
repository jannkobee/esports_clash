import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';
import {Store} from '../../infrastructure/automatic-learning/store.mjs';
import {FpsLiveMechanicsLearner} from './fps/fpsLiveMechanicsLearning.ts';
import {baseline} from '../../infrastructure/automatic-learning/model.mjs';
import {runMatch} from '../../infrastructure/automatic-learning/match.mjs';
test('durable ingestion is atomic, detects conflicting retries, and survives archive retention',async()=>{
 const directory=mkdtempSync(tmpdir()+'/fps-store-');let store;
 try{
  store=new Store(directory);const before=store.get('model');
  const record={id:'durable-1',kind:'combat',payload:{id:'durable-1',samples:[{context:'far:steady:loaded',action:'burst',reward:.7}]}};
  store.append(record,true,new Date('2026-01-01T01:00Z'));assert.equal(store.get('model').combat.updates,1);
  assert.equal(store.append(record,true),false);assert.throws(()=>store.append({...record,payload:{}},true));
  assert.throws(()=>store.append({id:'invalid',kind:'combat',payload:{id:'bad',samples:[{context:'invalid'}]}},true));assert.equal(store.get('model').combat.updates,1);
  await store.archive(new Date('2026-01-01T02:00Z'));
  assert.equal(JSON.parse(gunzipSync(readFileSync(directory+'/archives/2026-01-01T01.jsonl.gz'))).id,record.id);
  store.close();store=new Store(directory);assert.equal(store.append(record,true),false);
  await store.archive(new Date('2026-03-01T00:00Z'));assert.equal(store.append(record,true),false);assert.notDeepEqual(store.get('model'),before);
 }finally{store?.close();rmSync(directory,{recursive:true,force:true});}
});
test('frozen combat disables exploration and updates',()=>{
 const learner=new FpsLiveMechanicsLearner({mode:'frozen'}),before=learner.checkpoint();
 assert.equal(learner.choose('a','b','blue','far:steady:loaded',()=>0),'burst');learner.recordKill('a','b');
 assert.equal(learner.completeRound('blue','frozen'),undefined);assert.deepEqual(learner.checkpoint(),before);assert.equal(learner.stats().explorations,0);
});
test('actual headless engine reproduces frozen positions and never mutates team inputs',async()=>{
 const model=baseline(),before=structuredClone(model),job={id:'test-run',seed:421,group:1,blue:model,red:model,mode:'frozen',maxSimulatedSeconds:18,maxMatchWallSeconds:30};
 const a=await runMatch(job),b=await runMatch(job);delete a.wallSeconds;delete b.wallSeconds;assert.deepEqual(a,b);assert.deepEqual(model,before);assert.equal(a.status,'aborted');
});
test('team models remain separate when completed rounds settle',async()=>{
 const {fixture}=await import('../../infrastructure/automatic-learning/fixtures.mjs');
 const {FpsLiveSimulation}=await import('./fps/fpsLiveSimulation.ts');
 const f=fixture(42,1),blue=baseline(),red=baseline();red.combat.values['far:steady:loaded']={burst:-1,sustain:1};
 const sim=new FpsLiveSimulation(f.cards.slice(0,5),f.cards.slice(5),42,f.identity,{teamLearning:{blue:{mechanicsLearning:{model:blue.combat}},red:{mechanicsLearning:{mode:'frozen',model:red.combat}}}});
 const b=sim.combatLearner('blue'),r=sim.combatLearner('red');
 b.choose('synthetic-0','synthetic-5','blue','far:steady:loaded',()=>.99);r.choose('synthetic-5','synthetic-0','red','far:steady:loaded',()=>0);
 sim.finishRound('blue','test');assert.equal(b.checkpoint().updates,1);assert.equal(r.checkpoint().updates,0);assert.deepEqual(red.combat,r.checkpoint());
});
