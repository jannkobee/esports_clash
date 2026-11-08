// Owner-started operational tool. Attach to an explicitly paused trusted runner;
// never change its allocation, engine, actor state or winning conditions.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {finalPerformance} from './final-performance.mjs';

const [folder,runnerText,authorization]=process.argv.slice(2);
assert.equal(authorization,'--owner-requested','Explicit owner authorization is required');
assert.match(folder??'',/^\/online-data\/[a-f0-9-]{36}$/);
const runner=Number(runnerText);assert.ok(Number.isInteger(runner)&&runner>1);
const command=(await readFile(`/proc/${runner}/cmdline`,'utf8')).replaceAll('\0',' ');
assert.ok(command.includes('/online/browser-worker.mjs')&&command.includes(folder),'Wrong paused runner');
assert.match(await readFile(`/proc/${runner}/status`,'utf8'),/^State:\s+T/m,'Pause the live runner first');
const {plan,plan_hash}=JSON.parse(await readFile(`${folder}/allocation.json`,'utf8'));
const prior=JSON.parse(await readFile(`${folder}/snapshot.json`,'utf8'));
assert.equal(prior.match_id,plan.match_id);assert.equal(prior.plan_hash,plan_hash);
assert.equal(prior.public_replay,true,'This tool requires an existing public scheduled recording');
const before=JSON.parse(await readFile(`${folder}/state.json`,'utf8'));
assert.equal(before.status,'running');
const atomicText=async(name,text)=>{await writeFile(`${folder}/${name}.tmp`,text);await rename(`${folder}/${name}.tmp`,`${folder}/${name}`);};
const atomic=async(name,value)=>atomicText(name,JSON.stringify(value));
let socket,verified=false;let id=0;const pending=new Map();
try{
  const pages=await (await fetch('http://127.0.0.1:9226/json/list')).json();
  const page=pages.find(p=>p.type==='page'&&p.url.startsWith('http://127.0.0.1:5174/'));
  assert.ok(page,'The original match browser must still be alive');
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('Private browser command timed out'));},60000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
  const capture=async()=>JSON.parse(await evaluate('JSON.stringify(window.__esportsTrusted.snapshot(),(key,value)=>key==="realName"?undefined:value)'));
  let snapshot=await capture();
  assert.ok(snapshot.second>=prior.snapshot.second&&snapshot.second<=prior.snapshot.second+.501,'Browser differs from the paused live recording');
  if(Math.abs(snapshot.second-prior.snapshot.second)<.001)assert.equal(snapshot.fingerprint,prior.snapshot.fingerprint,'Paused state changed');
  verified=true;
  const execution={mode:'owner_requested_fast_forward',requested_at:new Date().toISOString(),from_second:snapshot.second,
    original_live_sequence:prior.sequence,source_fingerprint:snapshot.fingerprint,
    notice:'Owner interrupted live coverage and requested simulated completion. Later Arena frames are sampled; all recorded event timestamps remain.'};
  await atomic('owner-fast-forward.json',execution);await mkdir(`${folder}/frames`,{recursive:true});
  let lastSequence=prior.sequence;const started=Date.now();let result;
  const record=async()=>{
    // Keep the original half-second timeline indices. Missing samples are explicit
    // gaps, so old event-to-replay links select the next actual retained frame.
    const sequence=Math.max(lastSequence+1,Math.ceil(snapshot.second*2-1e-6)+1);lastSequence=sequence;
    const message={type:'snapshot',schema:1,match_id:plan.match_id,sequence,plan_hash,versions:plan.versions,speed:1,
      started_at:prior.started_at,public_replay:true,execution,snapshot};
    const text=JSON.stringify(message),path=`${folder}/frames/${String(sequence).padStart(6,'0')}.json.gz`;
    await writeFile(`${path}.tmp`,gzipSync(text,{level:1}));await rename(`${path}.tmp`,path);await atomicText('snapshot.json',text);
    if(snapshot.finished){
      assert.ok(snapshot.report&&['blue','red'].includes(snapshot.report.winner));
      const nexus=Object.fromEntries(['blue','red'].map(team=>[team,snapshot.frame.structures.find(s=>s.team===team&&s.type==='nexus').isAlive]));
      const winner=nexus.red===false?'blue':nexus.blue===false?'red':null;
      assert.equal(snapshot.report.winner,winner,'A real Nexus finish is required');
      result={schema:1,match_id:plan.match_id,versions:plan.versions,seed:plan.seed,winner,report:snapshot.report,
        player_performance:finalPerformance(plan,snapshot.frame.champions),terminal_nexus:nexus,execution};
    }
    await atomic('state.json',{status:result?'completed':'running',sequence,started_at:prior.started_at,public_replay:true,execution,...(result?{result}:{})});
    await atomic('fast-forward-timing.json',{mode:execution.mode,arena_seconds:snapshot.second,wall_ms:Date.now()-started,sequence,finished:snapshot.finished});
  };
  await record();let reports=0;
  while(!result){
    assert.ok(Date.now()-started<20*60*1000,'Fast-forward exceeded its wall-time budget; no invented winner');
    assert.equal(await evaluate('window.__esportsTrusted.step(300)'),true);
    snapshot=await capture();assert.ok(snapshot.second<=1800.001,'Match exceeded its existing Arena budget; no invented winner');
    await record();
    if(++reports%6===0||result)console.log(JSON.stringify({status:result?'completed':'fast_forward',second:snapshot.second,sequence:lastSequence,...(result?{winner:result.winner}:{})}));
  }
}catch(error){
  if(verified)await atomic('state.json',{status:'failed',error:error.message,execution:{mode:'owner_requested_fast_forward'}});
  console.error(error.stack);process.exitCode=1;
}finally{
  if(verified){
    // The stopped live loop must never resume and overwrite the terminal record.
    try{process.kill(runner,'SIGKILL');}catch{}
    try{socket?.send(JSON.stringify({id:++id,method:'Browser.close'}));}catch{}
  }
  socket?.close();
}
