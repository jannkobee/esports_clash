import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
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
test('store resets untouched baseline on engine hash change but rejects trained mismatch',()=>{
 const directory=mkdtempSync(tmpdir()+'/fps-upgrade-');let store;
 try{
  store=new Store(directory);
  const stale={...baseline(),engine:'0'.repeat(64)};
  store.set('model',stale);store.close();
  store=new Store(directory);
  assert.equal(store.get('model').engine,baseline().engine);
  const trained={...baseline(),engine:'0'.repeat(64)};trained.combat.updates=1;
  store.set('model',trained);store.close();
  assert.throws(()=>new Store(directory),/Incompatible or invalid learning bundle/);
 }finally{try{store?.close();}catch{}rmSync(directory,{recursive:true,force:true});}
});
test('export pushes reports and passing candidates directly to main branch',()=>{
 const dir=mkdtempSync(tmpdir()+'/fps-export-');
 const bare=dir+'/remote.git',seedRepo=dir+'/seed',dataDir=dir+'/data';
 try{
  execFileSync('git',['init','--bare',bare],{stdio:'pipe'});
  execFileSync('git',['clone',bare,seedRepo],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'checkout','-b','main'],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'config','user.name','Test'],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'config','user.email','test@example.com'],{stdio:'pipe'});
  writeFileSync(seedRepo+'/README.md','init\n');
  execFileSync('git',['-C',seedRepo,'add','README.md'],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'commit','-m','Initial commit'],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'push','-u','origin','main'],{stdio:'pipe'});
  execFileSync('git',['--git-dir',bare,'symbolic-ref','HEAD','refs/heads/main'],{stdio:'pipe'});
  mkdirSync(dataDir+'/reports',{recursive:true});
  mkdirSync(dataDir+'/candidates',{recursive:true});
  writeFileSync(dataDir+'/reports/2026-11-15T10.json','{"version":1}\n');
  writeFileSync(dataDir+'/candidates/cand-pass.json','{"report":{"passed":true}}\n');
  writeFileSync(dataDir+'/candidates/cand-fail.json','{"report":{"passed":false}}\n');
  const exportScript=fileURLToPath(new URL('../../infrastructure/automatic-learning/export.mjs',import.meta.url));
  execFileSync(process.execPath,[exportScript],{
    env:{...process.env,LEARNING_DATA:dataDir,LEARNING_GIT_REMOTE:bare},stdio:'pipe'
  });
  // Advance main remotely to verify rebase-and-push / fast-forward on subsequent export.
  execFileSync('git',['-C',seedRepo,'pull','--rebase','origin','main'],{stdio:'pipe'});
  writeFileSync(seedRepo+'/OTHER.md','concurrent\n');
  execFileSync('git',['-C',seedRepo,'add','OTHER.md'],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'commit','-m','Concurrent main commit'],{stdio:'pipe'});
  execFileSync('git',['-C',seedRepo,'push','origin','main'],{stdio:'pipe'});
  writeFileSync(dataDir+'/reports/2026-11-15T11.json','{"version":1}\n');
  execFileSync(process.execPath,[exportScript],{
    env:{...process.env,LEARNING_DATA:dataDir,LEARNING_GIT_REMOTE:bare},stdio:'pipe'
  });
  const verifyDir=dir+'/verify';
  execFileSync('git',['clone','-b','main',bare,verifyDir],{stdio:'pipe'});
  assert.equal(readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/2026-11-15T10.json','utf8'),'{"version":1}\n');
  assert.equal(readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/2026-11-15T11.json','utf8'),'{"version":1}\n');
  assert.equal(readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/candidates/cand-pass.json','utf8'),'{"report":{"passed":true}}\n');
  assert.throws(()=>readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/candidates/cand-fail.json'));
  assert.equal(readFileSync(verifyDir+'/OTHER.md','utf8'),'concurrent\n');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
