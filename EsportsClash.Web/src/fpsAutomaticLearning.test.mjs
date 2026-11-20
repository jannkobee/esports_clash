import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {Store,modelKey} from '../../infrastructure/automatic-learning/store.mjs';
import {pullAndPublish} from '../../infrastructure/automatic-learning/ingest.mjs';
import {FpsLiveMechanicsLearner} from './fps/fpsLiveMechanicsLearning.ts';
import {baseline} from '../../infrastructure/automatic-learning/model.mjs';
import {runMatch} from '../../infrastructure/automatic-learning/match.mjs';
test('settled club experience publishes once and survives a failed publication and restart', async () => {
 const directory=mkdtempSync(tmpdir()+'/fps-official-learning-');
 const lineage='worker:official-club-1';
 const experience={id:1,lineage,payload:{map:'fontessa',rounds:[{round:1,side:'attack',play_id:'seed:default_pick',won:true,opponent:'club:2'}]}};
 let store=new Store(directory);
 try{
  const options={url:'http://learning.test',token:'test',fetchImpl:async(url,request)=>{
   if(!request.method)return Response.json({experience:[experience]});
   return new Response(null,{status:503});
  }};
  await assert.rejects(pullAndPublish(store,options),/failed: 503/);
  const learned=store.get(modelKey(lineage)).playbooks.fontessa;
  assert.equal(learned.attack['seed:default_pick'].wins,1);
  store.close();
  store=new Store(directory);
  let published=0;
  options.fetchImpl=async(url,request)=>{
   if(!request.method){
    assert.equal(new URL(url).searchParams.get('after'),'1');
    return Response.json({experience:[]});
   }
   assert.ok(url.endsWith('/'+encodeURIComponent(lineage)+'/versions'));
   const body=JSON.parse(request.body);
   assert.deepEqual(JSON.parse(body.payload).playbooks.fontessa,learned);
   assert.equal(body.promote,true);
   published++;
   return new Response(null,{status:201});
  };
  await pullAndPublish(store,options);
  await pullAndPublish(store,options);
  assert.equal(published,1);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
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
test('engine code edits never reset learning; an incompatible learner is archived and forked, others kept',()=>{
 const directory=mkdtempSync(tmpdir()+'/fps-upgrade-');let store;
 try{
  store=new Store(directory);
  const edited={...baseline(),engine:'0'.repeat(64)};edited.combat.updates=3;
  store.set('model',edited);store.close();
  store=new Store(directory);
  assert.equal(store.get('model').combat.updates,3,'a simulation code edit keeps the trained model');
  const broken=structuredClone(store.get('model'));broken.navigation.updates=7;broken.combat={garbage:true};
  store.set('model',broken);store.close();
  store=new Store(directory);
  const migrated=store.get('model');
  assert.equal(migrated.navigation.updates,7,'validating learners are kept');
  assert.equal(migrated.combat.updates,0,'the invalid learner forks from its prior');
  const history=store.versions('worker:main'),archived=history.find(v=>v.reason==='archived-before-migration');
  assert.ok(archived);assert.deepEqual(store.versionPayload(archived.sha),broken,'the exact incompatible bundle is archived');
  const fork=history.find(v=>v.reason==='migrated');assert.equal(fork.parent,archived.sha);assert.deepEqual(fork.detail.forked,['combat']);
  assert.throws(()=>store.db.prepare('DELETE FROM model_versions').run(),/append-only/);
  assert.throws(()=>store.db.prepare("UPDATE model_versions SET reason='x'").run(),/append-only/);
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
  // Disable checkout conversion so the published blob bytes (LF) are compared exactly.
  execFileSync('git',['-c','core.autocrlf=false','clone','-b','main',bare,verifyDir],{stdio:'pipe'});
  assert.equal(execFileSync('git',['--git-dir',bare,'show','main:EsportsClash.Api/AutomaticLearning/reports/2026-11-15T10.json'],{encoding:'utf8'}),'{"version":1}\n');
  assert.equal(readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/2026-11-15T10.json','utf8'),'{"version":1}\n');
  assert.equal(readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/2026-11-15T11.json','utf8'),'{"version":1}\n');
  assert.equal(readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/candidates/cand-pass.json','utf8'),'{"report":{"passed":true}}\n');
  assert.throws(()=>readFileSync(verifyDir+'/EsportsClash.Api/AutomaticLearning/reports/candidates/cand-fail.json'));
  assert.equal(readFileSync(verifyDir+'/OTHER.md','utf8'),'concurrent\n');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('utility brain learns through worker records and stays optional in bundles',async()=>{
 const {validateBundle,upgradeTrainingBundle,isUntrainedBundle}=await import('../../infrastructure/automatic-learning/model.mjs');
 const {seedFpsUtilityBrain}=await import('./fps/fpsUtilityBrainStorage.ts');
 const old=baseline();delete old.utility;
 assert.equal(validateBundle(old).utility,undefined,'bundles approved before the utility brain stay valid');
 assert.deepEqual(upgradeTrainingBundle(old).utility,seedFpsUtilityBrain(),'training state starts utility learning from the seed');
 assert.ok(isUntrainedBundle(baseline()));
 assert.throws(()=>validateBundle({...baseline(),utility:{...seedFpsUtilityBrain(),successes:1e7}}),/Incompatible or invalid learning bundle/);
 const directory=mkdtempSync(tmpdir()+'/fps-utility-');let store;
 try{
  store=new Store(directory);const model=store.get('model'),records=[];
  const result=await runMatch({id:'utility-run',seed:7,group:1,blue:model,red:model,mode:'learn',maxSimulatedSeconds:120,maxMatchWallSeconds:120},r=>records.push(r));
  const utility=records.filter(r=>r.kind==='utility');
  assert.ok(result.utility.throws>0&&utility.length>0,'a learning match scores utility throws');
  for(const record of records)store.append(record,true,new Date('2026-01-01T01:00Z'));
  const learned=store.get('model').utility,emitted=utility.reduce((n,r)=>n+r.payload.throws,0),hits=utility.reduce((n,r)=>n+r.payload.successes,0);
  // Only completed rounds emit experience; throws in a round cut off by the time limit are scored but not learned.
  assert.ok(emitted>0&&emitted<=result.utility.throws);
  assert.equal(learned.throws-model.utility.throws,emitted);assert.equal(learned.successes-model.utility.successes,hits);
  assert.ok(utility.every(r=>JSON.stringify(r).length<20000),'records carry per-round deltas, not whole brains');
  assert.ok(!isUntrainedBundle(store.get('model')));
  assert.throws(()=>store.append({id:'bad-utility',kind:'utility',payload:{...utility[0].payload,id:'bad-utility',successes:utility[0].payload.throws+1}},true));
  assert.deepEqual(store.get('model').utility,learned);
  await store.archive(new Date('2026-01-01T02:00Z'));
  const manifest=JSON.parse(readFileSync(directory+'/reports/2026-01-01T01.json','utf8'));
  assert.equal(manifest.learningSamples.utility,emitted);assert.equal(manifest.utility.successes,hits);
 }finally{store?.close();rmSync(directory,{recursive:true,force:true});}
});
