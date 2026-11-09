// Trusted, fixed-step browser host. Policies supply preferences only through the
// component's explicit DEV strategy interface; no candidate-supplied JS is run.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

export async function liveExecutor() {
  const profile=await mkdtemp(join(tmpdir(),'strategy-executor-'));
  const server=spawn('python',['-m','http.server','5177','--bind','127.0.0.1','--directory','evolution-dist'],{stdio:'ignore'});
  const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-webgl',
    '--remote-debugging-port=9229',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  let socket; const pending=new Map(); let id=0;
  const close=async()=>{
    for(const handler of pending.values()){clearTimeout(handler.timer);handler.reject(Error('Executor closed'));}pending.clear();
    socket?.close();
    for(const child of [chrome,server]){child.kill('SIGTERM');await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));}
    // Chromium children may finish writing after the main process exits.
    await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  };
  try {
    let pages;
    for(let i=0;i<150;i++){
      if(server.exitCode!==null||chrome.exitCode!==null)throw Error('Live executor failed to start');
      try{pages=await(await fetch('http://127.0.0.1:9229/json/list')).json();await fetch('http://127.0.0.1:5177');break;}catch{await wait(200);}
    }
    if(!pages)throw Error('Live executor startup timed out');
    socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    socket.addEventListener('message',event=>{const reply=JSON.parse(event.data),handler=pending.get(reply.id);if(handler){
      pending.delete(reply.id);clearTimeout(handler.timer);reply.error?handler.reject(Error(JSON.stringify(reply.error))):handler.resolve(reply.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;
      const timer=setTimeout(()=>{pending.delete(key);reject(Error('Live executor CDP timeout: '+method));},60000);
      pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
    const evaluate=async expression=>{const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(reply.exceptionDetails)throw Error(reply.exceptionDetails.exception?.description??reply.exceptionDetails.text);return reply.result.value;};
    await send('Runtime.enable');
    return {close,async episode(item,onCheckpoint=()=>{},onLearning=()=>{}){
      const {seed,draft,swapped,strategies,renderless=true,maxSeconds=1200,wallSeconds=900}=item;
      assert.ok(Number.isInteger(seed)&&seed>0&&seed<=1000000);
      assert.ok(Number.isInteger(draft)&&draft>=0&&draft<10);
      assert.ok(typeof swapped==='boolean'&&Number.isFinite(maxSeconds)&&maxSeconds>=30&&maxSeconds<=1200);
      assert.ok(Number.isFinite(wallSeconds)&&wallSeconds>=1&&wallSeconds<=1800);
      await send('Page.navigate',{url:'http://127.0.0.1:5177/evolution-compiled.html'});
      let ready=false;
      for(let i=0;i<150;i++){if(await evaluate('!!window.__evolutionPageReady')){ready=true;break;}await wait(100);}
      assert.ok(ready,'Compiled fixture not ready');
      await evaluate(`(()=>{
        localStorage.clear();sessionStorage.clear();
        const {React,createRoot,AramMatchView,INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES,buildPairedStudyDraft}=window.__evolutionModules;
        const lineup=buildPairedStudyDraft(INITIAL_PLAYERS,CHAMPIONS,${draft});
        const host=document.createElement('div');document.body.append(host);document.querySelector('#root').style.display='none';
        window.fixtureRoot=createRoot(host);window.fixtureRoot.render(React.createElement(AramMatchView,{
          seed:${seed},evaluationStartPaused:true,evaluationRenderless:${renderless},trustedServer:true,evaluationStrategies:${JSON.stringify(strategies??{})},
          evaluationPolicies:${JSON.stringify(item.policies??{})},evaluationTraining:${item.training===true},
          evaluationController:${JSON.stringify(item.controller??'legacy')},evaluationControllers:${JSON.stringify(item.controllers??{})},
          blueLineup:lineup.slice(${swapped?'5':'0,5'}),redLineup:lineup.slice(${swapped?'0,5':'5'}),
          blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onReplay:()=>{},onBatchStart:()=>{},onBatchStop:()=>{},onExit:()=>{},
          onMatchComplete:(winner,mvp,stats)=>{window.__strategyResult={winner,stats:stats.map(u=>({id:u.id,team:u.team,
            player:u.player.id,champion:u.champion.id,kills:u.kills,deaths:u.deaths,cs:u.cs,gold:u.gold,damage:u.damageDealt}))};}}));
      })()`);
      ready=false;
      for(let i=0;i<150;i++){if(await evaluate('typeof window.__esportsTrusted?.step==="function"')){ready=true;break;}await wait(100);}
      assert.ok(ready,'Fixed-step simulation hook not ready');
      if(item.terminalFixture)assert.equal(await evaluate('window.__esportsTrusted.terminalFixture()'),true,'Invalid private terminal fixture');
      const inspect=()=>evaluate('(()=>{const s=window.__esportsTrusted.snapshot();return {second:s.second,fingerprint:s.fingerprint,randomState:s.randomState,finished:s.finished};})()');
      const states=[await inspect()];assert.equal(states[0].second,0);
      const started=Date.now();let ticks=0,finished=false,lastProgress=started,clock=0;
      let learning;
      const limit=Math.round(maxSeconds*30);
      while(!finished&&ticks<limit){
        if(Date.now()-started>wallSeconds*1000)return {status:'incomplete',reason:'wall-budget',states,second:clock,wall_seconds:(Date.now()-started)/1000};
        const boundary=ticks<900?900:ticks<3600?3600:limit;
        const count=Math.min(300,boundary-ticks,limit-ticks);
        assert.equal(await evaluate(`window.__esportsTrusted.step(${count})`),true);ticks+=count;
        if(item.policies||item.controller==='arena'){learning=await evaluate('window.__esportsTrusted.learning()');if(learning.rows.length)await onLearning(learning);}
        // Read the clock without capturing and hashing multi-megabyte state on every batch.
        const progress=await evaluate('({finished:!!window.__strategyResult})');finished=progress.finished;clock=ticks/30;
        if(ticks===900||ticks===3600||finished||ticks===limit){
          const state=await inspect();states.push(state);clock=state.second;
          await onCheckpoint({second:clock,wall_seconds:(Date.now()-started)/1000});
        }
        if(Date.now()-lastProgress>60000){console.error(`Live seed ${seed}: ~${clock.toFixed(1)}s simulation`);lastProgress=Date.now();}
      }
      const result=await evaluate('window.__strategyResult??null');
      if(item.training&&item.controller==='arena'){
        learning=await evaluate('window.__esportsTrusted.flushLearning()');if(learning.rows.length)await onLearning(learning);
      }
      await evaluate('window.fixtureRoot.unmount()');
      return {status:result?'terminal':'censored',states,result,second:clock,learning:learning?.counters,wall_seconds:(Date.now()-started)/1000};
    }};
  }catch(error){await close();throw error;}
}
