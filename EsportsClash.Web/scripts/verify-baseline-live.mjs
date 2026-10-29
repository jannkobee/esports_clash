// Real 30 Hz arena, no renderer or changed simulation step. Engineering evidence,
// never independent qualification. A caller must supply a NEW output file.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {intelligenceSourceHash} from './intelligence-source-hash.mjs';
const output=process.argv[2];
assert.ok(output,'Supply a new evidence filename');
const port=process.env.CDP_PORT??9235, origin=process.env.ARENA_ORIGIN??'http://127.0.0.1:5183';
const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.exception?.description??r.params.exceptionDetails.text);
  const p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout'));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Fixture not ready: '+expression);};
const runs=[];const sourceHash=intelligenceSourceHash();
try{
  await send('Runtime.enable');
  for(const spec of [
    {seed:71001,draft:0,mode:'baseline'},
    {seed:71001,draft:0,mode:'baseline',repeat:true},
    {seed:71002,draft:1,mode:'baseline',swapped:true},
    {seed:71001,draft:0,mode:'hybrid'},
    ...(process.env.BASELINE_ONLY==='1'?[]:[{seed:71001,draft:0,mode:'arena'}]),
  ]){
    await send('Page.navigate',{url:origin+'/evolution-compiled.html'});await waitFor('!!window.__evolutionPageReady');
    await evaluate(`(()=>{localStorage.clear();sessionStorage.clear();const {React,createRoot,AramMatchView,INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES,buildPairedStudyDraft}=window.__evolutionModules;
      const lineup=buildPairedStudyDraft(INITIAL_PLAYERS,CHAMPIONS,${spec.draft});
      window.fixtureRoot=createRoot(document.getElementById('root'));window.fixtureRoot.render(React.createElement(AramMatchView,{
        seed:${spec.seed},evaluationStartPaused:true,evaluationRenderless:true,trustedServer:true,contentCatalog:null,
        evaluationController:${JSON.stringify(spec.mode)},blueLineup:lineup.slice(${spec.swapped?'5':'0,5'}),redLineup:lineup.slice(${spec.swapped?'0,5':'5'}),
        blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onReplay:()=>{},onExit:()=>{},onBatchStart:()=>{},onBatchStop:()=>{},
        onMatchComplete:()=>{window.completed=true;}}));})()`);
    await waitFor('!!window.__esportsTrusted');const checkpoints=[];let finished=false;
    for(let tick=0;tick<36000&&!finished;tick+=300){
      await evaluate('window.__esportsTrusted.step(300)');finished=await evaluate('!!window.completed');
      if((tick+300)%9000===0||finished)checkpoints.push(await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot();return {second:s.second,fingerprint:s.fingerprint,randomState:s.randomState};})()`));
    }
    const data=await evaluate(`(()=>{const s=window.__esportsTrusted.snapshot(),r=s.report;return {
      status:s.finished?'terminal':'censored',second:s.second,fingerprint:s.fingerprint,randomState:s.randomState,winner:r?.winner,
      controllers:r?.gameplayControllers,calibration:r?.decisionCalibration,policy:JSON.parse(localStorage.getItem('esports-clash-adaptive-policy')||'null'),
      champions:s.frame.champions.map(c=>({id:c.id,team:c.team,avatar:c.champion.id,kills:c.kills,deaths:c.deaths,cs:c.cs,gold:c.gold,damage:c.damageDealt,intent:c.actionIntent?.kind})),
      structures:s.frame.structures.map(c=>({id:c.id,team:c.team,hp:c.hp,alive:c.isAlive})),events:s.events,
      evidence:r?.gameplayEvidence,demonstrations:window.__esportsTrusted.baselineLearning?.().records,
      decisions:r?.aiDecisionRecords??[]};})()`);
    runs.push({...spec,...data,checkpoints});console.log(JSON.stringify({seed:spec.seed,mode:spec.mode,status:data.status,second:data.second,winner:data.winner}));
    await evaluate('window.fixtureRoot.unmount()');
  }
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(runs[0].fingerprint,runs[1].fingerprint,'Baseline repeated full worlds differ');
  assert.deepEqual(runs[0].checkpoints,runs[1].checkpoints);
  for(const run of runs.filter(r=>r.mode==='baseline')){
    assert.equal(run.policy,null,'ML-off run updated learned weights');
    assert.ok(run.champions.reduce((n,c)=>n+c.cs,0)>0,'No farming progression');
    assert.ok(run.champions.reduce((n,c)=>n+c.damage,0)>0,'No combat progression');
  }
  await writeFile(output,JSON.stringify({scope:'Known-seed engineering, not promotion evidence',sourceHash,step:1/30,errors,runs},null,2)+'\n',{flag:'wx'});
}finally{socket.close();}
