import {fork} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {freemem,totalmem} from 'node:os';
import {statfsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Store,atomic,modelKey,TRAINING_LINEAGES} from './store.mjs';
import {root,baseline,approved,sha,utilityOf,utilitySummary,registryState} from './model.mjs';
import {readRegistry,promoteBundle,promotedBundle,promotionHistory,appendRegistryEvent} from './registry.mjs';
import {pullAndPublish} from './ingest.mjs';
import {pairedScores,leagueVerdict,candidateElo,promotionDecision,monitorDecision,metaReport} from './promotion.mjs';
// LEARNING_CONFIG points at an alternative config (short soak runs); the tracked default otherwise.
const config=JSON.parse(readFileSync(process.env.LEARNING_CONFIG||root+'EsportsClash.Api/AutomaticLearning/config/default.json'));
const directory=process.env.LEARNING_DATA??root+'EsportsClash.Api/storage/app/automatic-learning';
const minBurstPercent=process.env.LEARNING_MIN_BURST_PERCENT!==undefined&&process.env.LEARNING_MIN_BURST_PERCENT!==''?Number(process.env.LEARNING_MIN_BURST_PERCENT):config.minimumBurstPercent;
const healthyResumeSeconds=process.env.LEARNING_HEALTHY_RESUME_SECONDS!==undefined&&process.env.LEARNING_HEALTHY_RESUME_SECONDS!==''?Number(process.env.LEARNING_HEALTHY_RESUME_SECONDS):config.healthyResumeSeconds;
const failureLimit=Math.max(1,config.healthFailureLimit??3);
// Automatic promotion (append-only registry in the data directory, exported to AutomaticLearning/models).
const modelsDir=directory+'/models';
const leaguePairs=config.leaguePairs??50,leagueSize=config.leagueSize??3,monitorPairs=config.monitorPairs??50;
const ABLATIONS=['route-only','combat-only','movement-only','playbook-only'];
/** The incumbent: this worker's promoted bundle once it has promoted one, else the reviewed repo bundle. */
function incumbent(){
  const registry=readRegistry(modelsDir);
  if(!registry.events.length)return approved();
  const active=registryState(registry).active;
  return active.sha256?promotedBundle(modelsDir,active.sha256):baseline();
}
const eloOf=digest=>promotionHistory(modelsDir).find(e=>e.sha256===digest)?.elo??1500;
let store;
try{store=new Store(directory);}catch(error){
  try{atomic(directory+'/heartbeat.json',{at:new Date().toISOString(),paused:'model-incompatible',error:String(error?.message??error),healthySince:0,completed:0});}catch{}
  throw error;
}
let stopping=false,child,healthySince=0,running=false,consecutiveFailures=0;
process.on('SIGTERM',()=>{stopping=true;child?.kill('SIGTERM');});process.on('SIGINT',()=>{stopping=true;child?.kill('SIGTERM');});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function writeHeartbeat(reason){
  atomic(directory+'/heartbeat.json',{at:new Date().toISOString(),paused:reason,healthySince,completed:store.get('completed')??0});
}
async function healthy(){
  const disk=statfsSync(directory);let reason=null;
  if(existsSync(directory+'/PAUSE'))reason='manual';
  if(freemem()/totalmem()<config.minimumMemoryFraction)reason='memory';
  if(disk.bavail/disk.blocks<config.minimumDiskFraction)reason='disk';
  if(process.env.LEARNING_REQUIRE_TELEMETRY==='true'){
    try{const t=JSON.parse(readFileSync(directory+'/telemetry.json'));if(Date.now()-t.at>180000||t.burstPercent<minBurstPercent||!t.applicationHealthy||t.memoryFraction<config.minimumMemoryFraction)reason='host-health';}catch{reason='missing-telemetry';}
  }
  const immediate=reason==='manual'||reason==='memory'||reason==='disk';
  if(reason){
    consecutiveFailures++;
    if(!running||immediate||consecutiveFailures>=failureLimit){healthySince=0;running=false;}
    else reason=null;
  }else{
    consecutiveFailures=0;
    healthySince ||=Date.now();
  }
  const ready=!reason&&Date.now()-healthySince>=healthyResumeSeconds*1000;
  if(ready)running=true;
  writeHeartbeat(reason);
  return ready;
}
function execute(job){
  return new Promise((resolve,reject)=>{
    child=fork(new URL('./match.mjs',import.meta.url),[],{stdio:['ignore','inherit','inherit','ipc']});let result;
    const timer=setTimeout(()=>child.kill('SIGKILL'),(config.maxMatchWallSeconds+30)*1000);
    // Keep heartbeat fresh during long matches so host-health.py and Docker healthcheck do not trip at 120s.
    const heartbeatTimer=setInterval(()=>{try{writeHeartbeat(null);}catch{}},20000);
    child.on('message',message=>{try{
      if(message.type==='record')store.appendOrQuarantine(message.record,job.mode==='learn');
      if(message.type==='result')result=message.result;
    }catch(e){child.kill('SIGKILL');reject(e);}});
    child.on('error',error=>{clearTimeout(timer);clearInterval(heartbeatTimer);reject(error);});
    // 'close', not 'exit': 'exit' can fire before queued IPC messages (the last records and the
    // result) are delivered, which silently dropped the end of long matches.
    child.on('close',(code,signal)=>{clearTimeout(timer);clearInterval(heartbeatTimer);resolve(result??{status:'aborted',failure:`worker-exit:${signal??code}`,rounds:0});});
    child.send(job);
  });
}
export function interval(values){
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const variance=values.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,values.length-1);
  const margin=1.96*Math.sqrt(variance/values.length);return {mean,lower:mean-margin,upper:mean+margin,n:values.length};
}
function evaluationReport(cycle){
  const opponents={};let invalid=false;
  for(const opponent of ['incumbent','baseline']){
    const values=[];const groups={};const sides={attack:{wins:0,rounds:0},defend:{wins:0,rounds:0}};
    for(let pair=0;pair<config.evaluationPairs;pair++){
      let wins=0;
      for(const side of ['blue','red']){
        const result=store.result(`${cycle.id}-${opponent}-${pair}-${side}`);
        if(result?.status!=='completed')invalid=true;
        if(result?.winner===side)wins++;
        for(const role of ['attack','defend']){sides[role].wins+=result?.roundSides?.[role]?.wins??0;sides[role].rounds+=result?.roundSides?.[role]?.rounds??0;}
      }
      const score=wins/2-.5;values.push(score);(groups[pair%4]??=[]).push(score);
    }
    opponents[opponent]={...interval(values),groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,interval(v)])),sides};
  }
  const utility={sharedByBothTeams:true,evaluatedWith:'incumbent',candidate:utilitySummary(cycle.model),incumbent:utilitySummary(cycle.incumbent)};
  return {version:1,candidate:cycle.id,opponents,utility,invalid,passed:!invalid&&opponents.incumbent.lower>0&&opponents.baseline.upper>=0,ablationRequired:true};
}
function ablationReport(cycle,phase){
  const values=[],groups={},candidateSides={blue:{wins:0,matches:0},red:{wins:0,matches:0}};
  const roundSides={attack:{wins:0,rounds:0},defend:{wins:0,rounds:0}};let complete=true;
  for(let pair=0;pair<config.evaluationPairs;pair++){
    let wins=0;
    for(const side of ['blue','red']){
      const result=store.result(`${cycle.id}-${phase}-${pair}-${side}`);
      if(result?.status!=='completed')complete=false;
      if(result?.winner===side){wins++;candidateSides[side].wins++;}
      candidateSides[side].matches++;
      for(const role of ['attack','defend']){
        roundSides[role].wins+=result?.roundSides?.[role]?.wins??0;
        roundSides[role].rounds+=result?.roundSides?.[role]?.rounds??0;
      }
    }
    const score=wins/2-.5;values.push(score);(groups[pair%4]??=[]).push(score);
  }
  return {...interval(values),complete,groups:Object.fromEntries(Object.entries(groups).map(([key,scores])=>[key,interval(scores)])),candidateSides,roundSides};
}
async function runGitExport(){
  if(process.env.LEARNING_GIT_EXPORT!=='true')return false;
  const code=await new Promise(resolve=>{const exporter=fork(new URL('./export.mjs',import.meta.url),[],{stdio:'inherit'});exporter.on('exit',resolve);exporter.on('error',()=>resolve(1));});
  return code===0;
}
try{
  while(!stopping){
    await store.archive(new Date(),config.retentionDays);
    const exportHour=new Date().toISOString().slice(0,13);
    if(process.env.LEARNING_GIT_EXPORT==='true'&&store.get('exportHour')!==exportHour){
      if(await runGitExport())store.set('exportHour',exportHour);
    }
    if(!await healthy()){await sleep(10000);continue;}
    // Real-match experience for club lineages (only when an API URL and worker token are configured).
    try{const ingested=await pullAndPublish(store);if(ingested?.rejected.length)atomic(directory+'/reports/experience-rejected-'+Date.now()+'.json',ingested);}
    catch(error){console.error('Real-match experience sync failed; will retry:',error?.message??error);}
    let cycle=store.get('cycle'),job=store.get('activeJob');
    if(!job){
      const monitor=store.get('monitor');
      if(!cycle&&monitor){
        // Post-promotion monitor: the promoted bundle against the version it replaced.
        const pair=Math.floor(monitor.index/2),side=monitor.index%2?'red':'blue';
        const promoted=promotedBundle(modelsDir,monitor.promoted),previous=monitor.previous?promotedBundle(modelsDir,monitor.previous):baseline();
        job={id:`${monitor.id}-monitor-${pair}-${side}`,seed:1600000000+pair,group:pair%4,mode:'frozen',candidateTeam:side,mapId:pair%2?'spillway':'fontessa',
          blue:side==='blue'?promoted:previous,red:side==='red'?promoted:previous,utility:utilityOf(previous)};
      }else if(cycle){
        const index=cycle.index,league=cycle.phase==='league'?cycle.league[Math.floor(index/(leaguePairs*2))]:undefined;
        const opponent=cycle.phase==='league'?`league-${Math.floor(index/(leaguePairs*2))}`:cycle.phase??(index<config.evaluationPairs*2?'incumbent':'baseline');
        const pair=Math.floor(index/2)%(cycle.phase==='league'?leaguePairs:config.evaluationPairs),side=index%2?'red':'blue';
        const rival=league?promotedBundle(modelsDir,league):opponent==='baseline'?baseline():cycle.incumbent;
        const contender={...cycle.model};
        // Single-learner ablations pin every other learned part (including playbooks) to the incumbent.
        const pin=keys=>{for(const k of keys){if(cycle.incumbent[k]===undefined)delete contender[k];else contender[k]=cycle.incumbent[k];}};
        if(cycle.phase==='route-only')pin(['combat','movement','playbooks','opponents']);
        if(cycle.phase==='combat-only')pin(['navigation','movement','playbooks','opponents']);
        if(cycle.phase==='movement-only')pin(['navigation','combat','playbooks','opponents']);
        if(cycle.phase==='playbook-only')pin(['navigation','combat','movement']);
        // The utility brain is shared by both teams, so it cannot change a paired win comparison; every
        // evaluation match pins the incumbent's brain and the candidate's is reported separately.
        job={id:`${cycle.id}-${opponent}-${pair}-${side}`,seed:1500000000+pair,group:pair%4,mode:'frozen',candidateTeam:side,mapId:pair%2?'spillway':'fontessa',
          blue:side==='blue'?contender:rival,red:side==='red'?contender:rival,utility:utilityOf(cycle.incumbent)};
      }else{
        const completed=store.get('completed')??0;
        if(completed>0&&completed%config.candidateEveryMatches===0&&store.get('lastCandidateCompleted')!==completed){
          const day=new Date().toISOString().slice(0,10);
          if(store.get('evaluationDay')===day){await sleep(10000);continue;}
          cycle={id:randomUUID(),index:0,model:store.get('model'),incumbent:incumbent()};
          store.recordVersion(cycle.model,'worker:main','candidate-frozen',{cycle:cycle.id},store.snapshotModel('pre-candidate'));
          store.transaction(()=>{store.set('cycle',cycle);store.set('evaluationDay',day);store.set('lastCandidateCompleted',completed);});continue;
        }
        const sequence=(store.get('sequence')??0)+1;store.set('sequence',sequence);
        // The two worker lineages play each other and alternate starting sides, so they co-evolve.
        const [first,second]=sequence%2?[TRAINING_LINEAGES[1],TRAINING_LINEAGES[0]]:TRAINING_LINEAGES;
        job={id:randomUUID(),seed:1+sequence%1000000000,group:sequence%4,mode:'learn',mapId:Math.floor(sequence/2)%2?'spillway':'fontessa',lineages:{blue:first,red:second},blue:store.get(modelKey(first)),red:store.get(modelKey(second))};
      }
      job={...job,maxSimulatedSeconds:config.maxSimulatedSeconds,maxMatchWallSeconds:config.maxMatchWallSeconds};
      store.set('activeJob',job);store.job(job);
    }
    // A crash after completed-round ingestion cannot safely replay altered timing: mark interrupted jobs aborted on restart.
    const interrupted=store.db.prepare('SELECT id FROM ledger WHERE id=?').get(job.id+':start');
    const result=store.result(job.id)??(interrupted?{status:'aborted',failure:'interrupted-process',rounds:0}:await execute(job));
    store.finish(job.id,result);
    store.append({id:job.id+':result',kind:'result',payload:result});
    store.transaction(()=>{
      store.finish(job.id,result);store.set('activeJob',null);
      if(job.mode==='learn'&&result.status==='completed')store.set('completed',(store.get('completed')??0)+1);
      if(cycle){cycle.index++;store.set('cycle',cycle);}
      else if(job.id.includes('-monitor-')){const m=store.get('monitor');if(m){m.index++;store.set('monitor',m);}}
    });
    const monitor=store.get('monitor');
    if(!cycle&&monitor&&monitor.index>=monitorPairs*2){
      const score=pairedScores(id=>store.result(id),`${monitor.id}-monitor`,monitorPairs),decision=monitorDecision(score);
      if(decision.rollback)appendRegistryEvent(modelsDir,{action:'rollback',bundle:monitor.previous?monitor.previous+'.json':null,sha256:monitor.previous,reason:'auto-rollback: '+decision.reason,by:'monitor'});
      atomic(directory+'/reports/monitor-'+monitor.id+'.json',{version:1,promoted:monitor.promoted,previous:monitor.previous,score,...decision});
      store.set('monitor',null);await runGitExport();continue;
    }
    const phaseLength=!cycle?0:cycle.phase==='league'?cycle.league.length*leaguePairs*2:config.evaluationPairs*(cycle.phase?2:4);
    if(cycle&&cycle.index>=phaseLength){
      const next=phase=>{cycle.phase=phase;cycle.index=0;store.set('cycle',cycle);};
      if(!cycle.phase){
        cycle.report=evaluationReport(cycle);
        if(cycle.report.passed){next(ABLATIONS[0]);continue;}
      }else if(ABLATIONS.includes(cycle.phase)){
        const phase=cycle.phase,summary=ablationReport(cycle,phase);
        cycle.report.ablations??={};cycle.report.ablations[phase]=summary;
        const following=ABLATIONS[ABLATIONS.indexOf(phase)+1];
        if(following){next(following);continue;}
        cycle.report.ablationRequired=false;
        cycle.report.passed&&=Object.values(cycle.report.ablations).length===ABLATIONS.length&&Object.values(cycle.report.ablations).every(r=>r.complete);
        // League: earlier promoted versions other than the incumbent itself.
        const incumbentSha=registryState(readRegistry(modelsDir)).active.sha256;
        cycle.league=promotionHistory(modelsDir).map(e=>e.sha256).filter((d,i,a)=>d!==incumbentSha&&a.indexOf(d)===i).slice(0,leagueSize);
        if(cycle.report.passed&&cycle.league.length){next('league');continue;}
      }else if(cycle.phase==='league'){
        const entries=cycle.league.map((digest,k)=>({sha256:digest,...pairedScores(id=>store.result(id),`${cycle.id}-league-${k}`,leaguePairs)}));
        cycle.report.league={entries,...leagueVerdict(entries)};
      }
      if(cycle.report.passed){
        const incumbentSha=registryState(readRegistry(modelsDir)).active.sha256;
        cycle.report.elo=candidateElo([{opponentElo:incumbentSha?eloOf(incumbentSha):1500,mean:cycle.report.opponents.incumbent.mean},
          ...(cycle.report.league?.entries??[]).map(e=>({opponentElo:eloOf(e.sha256),mean:e.mean}))]);
      }
      const registry=readRegistry(modelsDir),paused=registry.events.length?registryState(registry).paused:false;
      const decision=promotionDecision({report:cycle.report,league:cycle.report.league,paused:paused||existsSync(directory+'/PAUSE_PROMOTION'),autoPromote:config.autoPromote!==false});
      cycle.report.promotion=decision;
      if(decision.promote){
        const previous=registry.events.length?registryState(registry).active.sha256:null;
        const promoted=promoteBundle(modelsDir,cycle.model,{reason:decision.reason,cycle:cycle.id,elo:cycle.report.elo,by:'worker'});
        store.recordVersion(cycle.model,'worker:main','promoted',{cycle:cycle.id,registry:promoted});
        store.set('monitor',{id:randomUUID(),promoted,previous,index:0});
      }
      atomic(directory+'/candidates/'+cycle.id+'.json',{model:cycle.model,sha256:sha(cycle.model),report:cycle.report});
      atomic(directory+'/reports/evaluation-'+cycle.id+'.json',cycle.report);
      atomic(directory+'/reports/meta-'+cycle.id+'.json',metaReport(Object.fromEntries(TRAINING_LINEAGES.map(l=>[l,store.get(modelKey(l))]))));
      store.set('cycle',null);
      await runGitExport();
    }
  }
}finally{store.close();}
