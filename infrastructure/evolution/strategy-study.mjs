// Run from EsportsClash.Web in the disposable CPU runner, after compiling the
// current DEV evaluation page. No deployment/model activation or generated code.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {liveExecutor} from './live-executor.mjs';
import {ACCEPTANCE,digest,configHash,proposeStrategies,assessStrategy,observeStrategyPair,registry} from './strategy-evolution.mjs';

const [command,folderArg,baselineArg]=process.argv.slice(2);
if(!['plan','run','rollback'].includes(command)||!folderArg)throw Error('Usage: strategy-study.mjs plan|run <folder> <verified-baseline.json> | rollback <registry> <policy-hash>');
const folder=resolve(folderArg);
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const write=async(path,value)=>{
  const bytes=JSON.stringify(value,null,2)+'\n';
  try{await writeFile(path,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||await readFile(path,'utf8')!==bytes)throw error;}
};
const currentManifest=async()=>{
  const files=[...(await readdir('src',{recursive:true})).filter(f=>/\.(tsx?|css)$/.test(f)).map(f=>'src/'+f),
    ...(await readdir('evolution-dist',{recursive:true})).filter(f=>/\.(html|js|css)$/.test(f)).map(f=>'evolution-dist/'+f)].sort();
  return Promise.all(files.map(async f=>[f,digest(await readFile(f,'utf8'))]));
};
const judgeManifest=async()=>Promise.all(['strategy-study.mjs','strategy-evolution.mjs','live-executor.mjs'].map(async file=>
  [file,digest(await readFile(new URL(file,import.meta.url),'utf8'))]));

if(command==='rollback'){
  if(!/^[a-f0-9]{64}$/.test(baselineArg??''))throw Error('A retained policy hash is required');
  const policy=await read(join(folder,'policies',baselineArg+'.json'));
  console.log(JSON.stringify(await registry(folder,api=>api.transition(policy.config,{reason:'Explicit internal registry rollback'},'rollback'))));
}else if(command==='plan'){
  const baseline=await read(resolve(baselineArg??''));
  assert.equal(baseline.verified,true,'A verified live baseline is required before parameter evolution');
  const manifest=await currentManifest();assert.equal(digest(manifest),baseline.source_hash,'Baseline source is not current');
  const registryPath=resolve(process.env.STRATEGY_REGISTRY??join(folder,'..','strategy-registry'));
  const incumbent=await registry(registryPath,api=>api.current());
  const seedStart=Number(process.env.STRATEGY_SEED_START);
  if(!Number.isInteger(seedStart)||seedStart<1||seedStart>999000)throw Error('Declare STRATEGY_SEED_START from an unused seed block');
  const population=proposeStrategies(incumbent.config,seedStart,2);
  // A ledger, exported by the read-only audit, is mandatory. It includes fitting,
  // calibration, evaluation and interrupted allocations, not just valid worlds.
  const ledger=await read(resolve(process.env.STRATEGY_SEED_LEDGER??''));
  assert.ok(Array.isArray(ledger.exposed_seeds)&&ledger.complete===true,'Complete exposed-seed ledger required');
  const used=new Set(ledger.exposed_seeds);
  const fittingSeeds=Array.from({length:2},(_,i)=>seedStart+i);
  const evaluationSeeds=Array.from({length:32},(_,i)=>seedStart+2+i);
  assert.ok([...fittingSeeds,...evaluationSeeds].every(seed=>!used.has(seed)),'Exposed world reused');
  const policies=(await readdir(join(registryPath,'policies'))).filter(name=>name.endsWith('.json'));
  const opponents=await Promise.all(policies.map(name=>read(join(registryPath,'policies',name))));
  const fixed={...incumbent.config,farmStrategic:.52,farmTactical:.46,farmConversionTactical:.75};
  if(!opponents.some(p=>p.hash===configHash(fixed)))opponents.push({hash:configHash(fixed),config:fixed,provenance:'Fixed farm-biased reference, no claimed strength'});
  const cases=evaluationSeeds.flatMap((seed,i)=>opponents.flatMap(opponent=>[false,true].map(swapped=>
    ({seed,draft:2+i%2,swapped,opponentHash:opponent.hash}))));
  const plan={version:1,sourceHash:baseline.source_hash,manifest,judgeManifest:await judgeManifest(),
    baselineEvidenceHash:digest(await readFile(resolve(baselineArg),'utf8')),seedLedgerHash:digest(ledger),
    seedReservationVerified:false,
    incumbent,incumbentHash:incumbent.hash,registryPath,population,opponents,fittingSeeds,evaluationSeeds,evaluationCases:cases,
    acceptance:ACCEPTANCE,resource:{maxMinutes:90,wallSecondsPerMatch:900,concurrency:1},
    productionPromotion:false,algorithm:'bounded-antithetic-(1+lambda)-ES-v1'};
  await mkdir(folder,{recursive:true});await write(join(folder,'plan.json'),plan);
  console.log(JSON.stringify({planned:true,folder,challengers:population.length,evaluationWorlds:cases.length,
    scope:'Offline internal research; budget exhaustion is inconclusive, never replacement evidence'}));
}else{
  const plan=await read(join(folder,'plan.json'));
  assert.deepEqual(await currentManifest(),plan.manifest,'Simulation source changed');
  assert.deepEqual(await judgeManifest(),plan.judgeManifest,'Judge changed after predeclaration');
  assert.equal(plan.productionPromotion,false);assert.deepEqual(plan.acceptance,ACCEPTANCE);
  try{const priorResult=await read(join(folder,'result.json'));console.log(JSON.stringify(priorResult.assessment));process.exit(0);}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const incumbent=await registry(plan.registryPath,api=>api.current());assert.equal(incumbent.hash,plan.incumbentHash,'Incumbent changed since planning');
  let started=Date.now();
  try{const execution=await read(join(folder,'execution.json'));assert.equal(execution.planHash,digest(plan));started=execution.started;}
  catch(error){if(error.code!=='ENOENT')throw error;await write(join(folder,'execution.json'),{planHash:digest(plan),started});}
  let cancelled=false;
  const cancel=()=>{cancelled=true;};process.once('SIGTERM',cancel);process.once('SIGINT',cancel);
  const check=()=>{if(cancelled||Date.now()-started>plan.resource.maxMinutes*60000)throw Error(cancelled?'Cancelled; evidence retained':'Study wall budget exhausted; retain incumbent');};
  await mkdir(join(folder,'raw'),{recursive:true});
  const executor=await liveExecutor();const cache=new Map();let assessment={status:'inconclusive',reasons:['not-evaluated']};
  const run=async(seed,draft,swapped,strategies,label)=>{
    check();const item={seed,draft,swapped,strategies,maxSeconds:1200,
      wallSeconds:Math.max(1,Math.min(plan.resource.wallSecondsPerMatch,(plan.resource.maxMinutes*60000-(Date.now()-started))/1000))};
    const key=digest({seed,draft,swapped,strategies,label}),path=join(folder,'raw',key+'.json');
    try{const old=await read(path);assert.equal(old.item.seed,seed);return old.episode;}catch(error){if(error.code!=='ENOENT')throw error;}
    // Durable attempt marker: interruptions stay censored, never silently retried.
    try{await write(path+'.started',{item,at:new Date().toISOString()});}
    catch(error){if(error.code==='EEXIST')return{status:'incomplete',reason:'interrupted-prior-attempt'};throw error;}
    const episode=await executor.episode(item);await write(path,{item,episode,sourceHash:plan.sourceHash});return episode;
  };
  const measure=async(item,candidate)=>{
    check();const opponent=plan.opponents.find(p=>p.hash===item.opponentHash);assert.ok(opponent);
    const team=item.swapped?'red':'blue',enemy=team==='blue'?'red':'blue';
    const baseStrategies={[team]:plan.incumbent.config,[enemy]:opponent.config};
    const baselineKey=digest({...item,baseStrategies});let controls=cache.get(baselineKey);
    if(!controls){controls=[await run(item.seed,item.draft,item.swapped,baseStrategies,'control'),
      await run(item.seed,item.draft,item.swapped,baseStrategies,'repeat')];cache.set(baselineKey,controls);}
    const learned=await run(item.seed,item.draft,item.swapped,{...baseStrategies,[team]:candidate.config},'candidate-'+candidate.hash);
    const [a,b]=controls;
    const envelope={item,candidateHash:candidate.hash,sourceHash:plan.sourceHash,control:a,repeat:b,challenger:learned};
    const rawHash=digest(JSON.stringify(envelope,null,2)+'\n');await write(join(folder,'raw',rawHash+'.evidence.json'),envelope);
    return observeStrategyPair({...plan,candidateHash:candidate.hash},item,rawHash,envelope);
  };
  try{
    const fitting=[];
    for(const candidate of plan.population){
      const rows=[];
      for(const[order,seed]of plan.fittingSeeds.entries())for(const swapped of[false,true])rows.push(await measure(
        {seed,draft:2+order%2,swapped,opponentHash:plan.incumbentHash},candidate));
      fitting.push({candidate,rows,score:rows.every(r=>r.status==='terminal'&&r.controlsMatch)
        ?rows.reduce((sum,r)=>sum+r.winDelta,0)/rows.length:null});
    }
    await write(join(folder,'fitting.json'),fitting);
    const best=fitting.filter(f=>f.score!==null).sort((a,b)=>b.score-a.score||a.candidate.hash.localeCompare(b.candidate.hash))[0];
    if(!best)throw Error('No reproducible fitting challenger');
    const frozenPlan={...plan,candidateHash:best.candidate.hash};
    // Frozen winner selection precedes any heldout attempt; restart validates exact bytes.
    const freezePath=join(folder,'freeze.json');
    try{await write(freezePath,{candidate:best.candidate,fittingHash:digest(fitting),planHash:digest(plan)});}
    catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(await read(freezePath),{candidate:best.candidate,fittingHash:digest(fitting),planHash:digest(plan)});}
    const observations=[];
    for(const item of plan.evaluationCases){observations.push(await measure(item,best.candidate));
      await writeFile(join(folder,'progress.json'),JSON.stringify({completed:observations.length,planned:plan.evaluationCases.length}));}
    assert.deepEqual(await currentManifest(),plan.manifest);assert.deepEqual(await judgeManifest(),plan.judgeManifest);
    assessment=assessStrategy(frozenPlan,observations);
    const evidence={plan:frozenPlan,observations,assessment};await write(join(folder,'evaluation.json'),evidence);
    if(assessment.status==='promote')await registry(plan.registryPath,api=>api.transition(best.candidate.config,evidence,'promote',join(folder,'raw')));
  }catch(error){assessment={status:'inconclusive',reasons:[error.message],productionEligible:false};}
  finally{await executor.close();await writeFile(join(folder,'result.json'),JSON.stringify({assessment,productionPromoted:false,
    wallSeconds:(Date.now()-started)/1000},null,2)+'\n');process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);}
  console.log(JSON.stringify(assessment));
}
