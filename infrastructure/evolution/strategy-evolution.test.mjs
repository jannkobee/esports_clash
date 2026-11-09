import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ACCEPTANCE,ARENA_ACCEPTANCE,assessArena,digest,configHash,proposeStrategies,assessStrategy,observeStrategyPair,registry} from './strategy-evolution.mjs';
import {DEFAULT_AI_STRATEGY,loadAIStrategyConfig} from '../../EsportsClash.Web/src/aiStrategyConfig.ts';

// Synthetic gate fixtures, never collected gameplay evidence.
const fixture=()=>{
  const plan={acceptance:ACCEPTANCE,seedReservationVerified:true,sourceHash:digest('synthetic-source'),candidateHash:digest('synthetic-candidate'),
    evaluationCases:Array.from({length:80},(_,i)=>[false,true].map(swapped=>({seed:i+1,draft:i%2,swapped,opponentHash:digest('synthetic-opponent')}))).flat()};
  const observations=plan.evaluationCases.map(item=>({...item,status:'terminal',sourceHash:plan.sourceHash,
    candidateHash:plan.candidateHash,controlsMatch:true,winDelta:1,teamDeathDelta:0,rawHash:digest(item)}));
  return{plan,observations};
};

test('bounded parameter evolution is deterministic, diverse and preserves the input',()=>{
  const frozen=JSON.stringify(DEFAULT_AI_STRATEGY),a=proposeStrategies(DEFAULT_AI_STRATEGY,123,8);
  assert.deepEqual(a,proposeStrategies(DEFAULT_AI_STRATEGY,123,8));
  assert.equal(new Set(a.map(p=>p.hash)).size,8);
  assert.ok(a.every(p=>loadAIStrategyConfig(p.config)&&p.hash===configHash(p.config)));
  assert.equal(JSON.stringify(DEFAULT_AI_STRATEGY),frozen);
  assert.throws(()=>proposeStrategies(DEFAULT_AI_STRATEGY,0));
});

test('independent full-match gate rejects degraded, unstable, leaked and altered-criteria evidence',()=>{
  const {plan,observations}=fixture();
  assert.equal(assessStrategy(plan,observations.map(r=>({...r,winDelta:-1}))).status,'reject');
  assert.equal(assessStrategy(plan,observations.map((r,i)=>({...r,teamDeathDelta:i===0?1:0}))).status,'reject');
  assert.equal(assessStrategy(plan,observations.map((r,i)=>({...r,controlsMatch:i!==0}))).status,'reject');
  assert.equal(assessStrategy(plan,observations.map((r,i)=>({...r,sourceHash:i===0?'wrong':r.sourceHash}))).status,'reject');
  assert.throws(()=>assessStrategy({...plan,acceptance:{...ACCEPTANCE,confidence:.5}},observations));
  assert.throws(()=>assessStrategy(plan,[...observations,observations[0]]));
});

test('small positive averages and incomplete games remain inconclusive',()=>{
  const {plan,observations}=fixture();
  assert.equal(assessStrategy({...plan,evaluationCases:plan.evaluationCases.slice(0,4)},observations.slice(0,4)).status,'inconclusive');
  assert.equal(assessStrategy(plan,observations.map(r=>({...r,status:'censored'}))).status,'inconclusive');
  assert.equal(assessStrategy(plan,observations.slice(0,-1)).status,'inconclusive');
  assert.equal(assessStrategy(plan,observations).status,'promote');
  assert.equal(assessStrategy(plan,observations).productionEligible,false);
  assert.equal(assessStrategy({...plan,seedReservationVerified:false},observations).status,'inconclusive');
});
test('arena v2 allows winning trades while historical macro gates stay frozen',()=>{
  const {plan,observations}=fixture(),trades=observations.map(r=>({...r,teamDeathDelta:1}));
  assert.equal(assessStrategy(plan,trades).status,'reject');
  const accepted=assessArena({...plan,acceptance:ARENA_ACCEPTANCE},trades);
  assert.equal(accepted.status,'promote');assert.equal(accepted.extraTeamDeathCases,trades.length);
  assert.equal(assessArena({...plan,acceptance:ARENA_ACCEPTANCE},trades.map(r=>({...r,winDelta:0}))).status,'inconclusive');
});

test('registry preserves the champion after failed evidence and restores retained history',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'strategy-registry-test-'));
  try{
    const initial=await registry(folder,api=>api.current());
    const next=proposeStrategies(initial.config,27,2)[0];
    await assert.rejects(()=>registry(folder,api=>api.transition(next.config,{assessment:{status:'reject'}})));
    assert.equal((await registry(folder,api=>api.current())).hash,initial.hash);
    const {plan}=fixture();plan.candidateHash=next.hash;plan.incumbentHash=initial.hash;
    const observations=[],rawFolder=join(folder,'raw');await mkdir(rawFolder);
    for(const item of plan.evaluationCases){
      const team=item.swapped?'red':'blue',other=team==='blue'?'red':'blue';
      const control={status:'terminal',states:[{second:450,finished:true,fingerprint:'synthetic'}],result:{winner:other,
        stats:Array.from({length:10},(_,i)=>({team:i<5?'blue':'red',deaths:0}))}};
      const envelope={item,candidateHash:next.hash,sourceHash:plan.sourceHash,control,repeat:control,
        challenger:{...control,result:{...control.result,winner:team}}};
      const bytes=JSON.stringify(envelope,null,2)+'\n',rawHash=digest(bytes);
      await writeFile(join(rawFolder,rawHash+'.evidence.json'),bytes);
      observations.push(observeStrategyPair(plan,item,rawHash,envelope));
    }
    const evidence={plan,observations,assessment:assessStrategy(plan,observations)};
    await assert.rejects(()=>registry(folder,api=>api.transition(next.config,evidence)),/raw artifacts/);
    const promoted=await registry(folder,api=>api.transition(next.config,evidence,'promote',rawFolder));assert.equal(promoted.hash,next.hash);
    const restored=await registry(folder,api=>api.transition(initial.config,{reason:'synthetic rollback'},'rollback'));
    assert.equal(restored.hash,initial.hash);
    assert.equal(JSON.parse(await readFile(join(folder,'policies',next.hash+'.json'),'utf8')).parent,initial.hash);
    await writeFile(join(rawFolder,observations[0].rawHash+'.evidence.json'),'tampered raw evidence');
    await assert.rejects(()=>registry(folder,api=>api.transition(next.config,evidence,'promote',rawFolder)),/evidence hash mismatch/);
    assert.equal((await registry(folder,api=>api.current())).hash,initial.hash);
    await writeFile(join(folder,'champion.json'),JSON.stringify({...initial,hash:'tampered'}));
    await assert.rejects(()=>registry(folder,api=>api.current()),/hash mismatch/);
  }finally{await rm(folder,{recursive:true,force:true});}
});
