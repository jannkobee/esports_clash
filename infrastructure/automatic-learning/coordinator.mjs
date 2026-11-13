import {fork} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {freemem,totalmem} from 'node:os';
import {statfsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Store,atomic} from './store.mjs';
import {root,baseline,approved,sha} from './model.mjs';
const config=JSON.parse(readFileSync(root+'EsportsClash.Api/AutomaticLearning/config/default.json'));
const directory=process.env.LEARNING_DATA??root+'EsportsClash.Api/storage/app/automatic-learning';
const store=new Store(directory);let stopping=false,child,healthySince=0;
process.on('SIGTERM',()=>{stopping=true;child?.kill('SIGTERM');});process.on('SIGINT',()=>{stopping=true;child?.kill('SIGTERM');});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function healthy(){
  const disk=statfsSync(directory);let reason=null;
  if(existsSync(directory+'/PAUSE'))reason='manual';
  if(freemem()/totalmem()<config.minimumMemoryFraction)reason='memory';
  if(disk.bavail/disk.blocks<config.minimumDiskFraction)reason='disk';
  if(process.env.LEARNING_REQUIRE_TELEMETRY==='true'){
    try{const t=JSON.parse(readFileSync(directory+'/telemetry.json'));if(Date.now()-t.at>120000||t.burstPercent<config.minimumBurstPercent||!t.applicationHealthy||t.memoryFraction<config.minimumMemoryFraction)reason='host-health';}catch{reason='missing-telemetry';}
  }
  if(reason)healthySince=0;else healthySince ||=Date.now();
  atomic(directory+'/heartbeat.json',{at:new Date().toISOString(),paused:reason,healthySince,completed:store.get('completed')??0});
  return !reason&&Date.now()-healthySince>=config.healthyResumeSeconds*1000;
}
function execute(job){
  return new Promise((resolve,reject)=>{
    child=fork(new URL('./match.mjs',import.meta.url),[],{stdio:['ignore','inherit','inherit','ipc']});let result;
    const timer=setTimeout(()=>child.kill('SIGKILL'),(config.maxMatchWallSeconds+30)*1000);
    child.on('message',message=>{try{
      if(message.type==='record')store.append(message.record,job.mode==='learn');
      if(message.type==='result')result=message.result;
    }catch(e){child.kill('SIGKILL');reject(e);}});
    child.on('error',reject);child.on('exit',()=>{clearTimeout(timer);resolve(result??{status:'aborted',failure:'worker-exit',rounds:0});});child.send(job);
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
  return {version:1,candidate:cycle.id,opponents,invalid,passed:!invalid&&opponents.incumbent.lower>0&&opponents.baseline.upper>=0,ablationRequired:true};
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
try{
  while(!stopping){
    await store.archive(new Date(),config.retentionDays);
    const exportDay=new Date().toISOString().slice(0,10);
    if(process.env.LEARNING_GIT_EXPORT==='true'&&store.get('exportDay')!==exportDay){
      const code=await new Promise(resolve=>{const exporter=fork(new URL('./export.mjs',import.meta.url),[],{stdio:'inherit'});exporter.on('exit',resolve);exporter.on('error',()=>resolve(1));});
      if(code===0)store.set('exportDay',exportDay);
    }
    if(!await healthy()){await sleep(10000);continue;}
    let cycle=store.get('cycle'),job=store.get('activeJob');
    if(!job){
      if(cycle){
        const index=cycle.index,opponent=cycle.phase??(index<config.evaluationPairs*2?'incumbent':'baseline');
        const pair=Math.floor(index/2)%config.evaluationPairs,side=index%2?'red':'blue';
        const rival=opponent==='baseline'?baseline():cycle.incumbent;
        const contender={...cycle.model};
        if(cycle.phase==='route-only'){contender.combat=cycle.incumbent.combat;contender.movement=cycle.incumbent.movement;}
        if(cycle.phase==='combat-only'){contender.navigation=cycle.incumbent.navigation;contender.movement=cycle.incumbent.movement;}
        if(cycle.phase==='movement-only'){contender.navigation=cycle.incumbent.navigation;contender.combat=cycle.incumbent.combat;}
        job={id:`${cycle.id}-${opponent}-${pair}-${side}`,seed:1500000000+pair,group:pair%4,mode:'frozen',candidateTeam:side,
          blue:side==='blue'?contender:rival,red:side==='red'?contender:rival};
      }else{
        const completed=store.get('completed')??0;
        if(completed>0&&completed%config.candidateEveryMatches===0&&store.get('lastCandidateCompleted')!==completed){
          const day=new Date().toISOString().slice(0,10);
          if(store.get('evaluationDay')===day){await sleep(10000);continue;}
          cycle={id:randomUUID(),index:0,model:store.get('model'),incumbent:approved()};
          store.transaction(()=>{store.set('cycle',cycle);store.set('evaluationDay',day);store.set('lastCandidateCompleted',completed);});continue;
        }
        const sequence=(store.get('sequence')??0)+1;store.set('sequence',sequence);
        const model=store.get('model');job={id:randomUUID(),seed:1+sequence%1000000000,group:sequence%4,mode:'learn',blue:model,red:model};
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
    });
    if(cycle&&cycle.index>=config.evaluationPairs*(cycle.phase?2:4)){
      if(!cycle.phase){
        cycle.report=evaluationReport(cycle);
        if(cycle.report.passed){cycle.phase='route-only';cycle.index=0;store.set('cycle',cycle);continue;}
      }else{
        const phase=cycle.phase,summary=ablationReport(cycle,phase);
        cycle.report.ablations??={};cycle.report.ablations[phase]=summary;
        if(cycle.phase==='route-only'){cycle.phase='combat-only';cycle.index=0;store.set('cycle',cycle);continue;}
        if(cycle.phase==='combat-only'){cycle.phase='movement-only';cycle.index=0;store.set('cycle',cycle);continue;}
        cycle.report.ablationRequired=false;
        cycle.report.passed&&=Object.values(cycle.report.ablations).length===3&&Object.values(cycle.report.ablations).every(r=>r.complete);
      }
      atomic(directory+'/candidates/'+cycle.id+'.json',{model:cycle.model,sha256:sha(cycle.model),report:cycle.report});
      atomic(directory+'/reports/evaluation-'+cycle.id+'.json',cycle.report);store.set('cycle',null);
    }
  }
}finally{store.close();}
