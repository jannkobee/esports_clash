import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {baseline,registryState,activeManifest} from '../../infrastructure/automatic-learning/model.mjs';
import {readRegistry,appendRegistryEvent,promoteBundle,promotedBundle,promotionHistory} from '../../infrastructure/automatic-learning/registry.mjs';
import {pairedScores,leagueVerdict,eloFromScore,candidateElo,promotionDecision,monitorDecision,metaReport} from '../../infrastructure/automatic-learning/promotion.mjs';
import {createFpsTeamPlaybook} from './fps/fpsLivePlaybook.ts';
import {compatibleApproved} from './fps/fpsApprovedLearning.ts';

const trained=n=>{const b=baseline();b.combat.updates=n;return b;};

test('promotions append to the registry, keep every bundle, and roll back only to promoted versions',()=>{
  const dir=mkdtempSync(tmpdir()+'/fps-registry-');
  try{
    const first=promoteBundle(dir,trained(1),{reason:'a'}),second=promoteBundle(dir,trained(2),{reason:'b'});
    assert.equal(registryState(readRegistry(dir)).active.sha256,second);
    assert.deepEqual(promotionHistory(dir).map(e=>e.sha256),[second,first]);
    appendRegistryEvent(dir,{action:'rollback',bundle:first+'.json',sha256:first,reason:'regressed'});
    assert.equal(activeManifest(dir+'/').sha256,first,'the API/worker manifest follows the registry');
    assert.equal(promotedBundle(dir,second).combat.updates,2,'rolled-back versions stay available');
    assert.throws(()=>appendRegistryEvent(dir,{action:'rollback',bundle:'f'.repeat(64)+'.json',sha256:'f'.repeat(64)}),/never promoted/);
    assert.equal(readRegistry(dir).events.length,3,'a refused event is not written');
    appendRegistryEvent(dir,{action:'pause',reason:'owner'});assert.equal(registryState(readRegistry(dir)).paused,true);
    assert.equal(readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).length,2);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('the owner CLI pauses, resumes and rolls back through the same append-only registry',()=>{
  const data=mkdtempSync(tmpdir()+'/fps-cli-');
  try{
    const digest=promoteBundle(data+'/models',trained(3));
    const cli=fileURLToPath(new URL('../../infrastructure/automatic-learning/registry.mjs',import.meta.url));
    const run=(...args)=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','--no-warnings',cli,...args],{env:{...process.env,LEARNING_DATA:data},encoding:'utf8'}));
    assert.equal(run('pause','test').paused,true);
    assert.equal(run('resume','test').paused,false);
    assert.equal(run('rollback','baseline','test').active.sha256,null);
    assert.equal(run('rollback',digest,'test').active.sha256,digest);
    assert.equal(readRegistry(data+'/models').events.length,5);
  }finally{rmSync(data,{recursive:true,force:true});}
});

test('promotion needs screening, ablations, a clean league and no pause; the monitor rolls back regressions',()=>{
  const results={};
  const put=(prefix,pairs,winsPerPair)=>{for(let p=0;p<pairs;p++)['blue','red'].forEach((side,i)=>{results[`${prefix}-${p}-${side}`]={status:'completed',winner:i<winsPerPair(p)?side:(side==='blue'?'red':'blue')};});};
  put('c-league-0',40,p=>p%2?1:1);put('c-league-1',40,()=>0);
  const even=pairedScores(id=>results[id],'c-league-0',40),worse=pairedScores(id=>results[id],'c-league-1',40);
  assert.equal(even.mean,0);assert.ok(worse.upper<0);
  assert.deepEqual(leagueVerdict([{sha256:'a',...even}]),{passed:true,regressions:[]});
  assert.deepEqual(leagueVerdict([{sha256:'a',...even},{sha256:'b',...worse}]).regressions,['b']);
  assert.equal(pairedScores(id=>results[id],'missing',3).complete,false);
  const passed={passed:true};
  assert.equal(promotionDecision({report:passed,league:{passed:true},paused:false,autoPromote:true}).promote,true);
  assert.equal(promotionDecision({report:passed,league:{passed:false},paused:false,autoPromote:true}).promote,false);
  assert.equal(promotionDecision({report:passed,paused:true,autoPromote:true}).promote,false);
  assert.equal(promotionDecision({report:{passed:false},paused:false,autoPromote:true}).promote,false);
  assert.equal(monitorDecision(worse).rollback,true);assert.equal(monitorDecision(even).rollback,false);
  assert.equal(monitorDecision({...worse,complete:false}).rollback,false,'an incomplete monitor never rolls back');
  assert.equal(eloFromScore(1500,0),1500);assert.ok(eloFromScore(1500,.25)>1500&&eloFromScore(1500,-.25)<1500);
  assert.equal(candidateElo([{opponentElo:1600,mean:0},{opponentElo:1400,mean:0}]),1500);
});

test('approved bundles may carry playbooks; old bundles and invalid books stay harmless',()=>{
  const bundle={...baseline(),playbooks:{fontessa:createFpsTeamPlaybook('fontessa')}};
  const loaded=compatibleApproved(JSON.parse(JSON.stringify(bundle)));
  assert.ok(loaded.playbooks.fontessa);
  const old=baseline();delete old.utility;assert.deepEqual(compatibleApproved(old).playbooks,{});
  const broken=structuredClone(bundle);broken.playbooks.fontessa.map='spillway';
  assert.deepEqual(compatibleApproved(broken).playbooks,{},'a mislabelled book is not used');
  const report=metaReport({'worker:main':bundle});
  assert.equal(report.lineages['worker:main'].maps.fontessa.attack.active,7);
  assert.ok(readFileSync(new URL('../../EsportsClash.Api/AutomaticLearning/config/default.json',import.meta.url),'utf8').includes('"autoPromote": true'));
});
