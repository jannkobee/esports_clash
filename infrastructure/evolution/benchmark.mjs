// Execute inside the runner over stdin. No study data is written or used for fitting.
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'evolution-benchmark-'));
const vite = process.env.BENCHMARK_COMPILED
  ? spawn('python', ['-m','http.server','5175','--bind','127.0.0.1','--directory','evolution-dist'], { stdio:'ignore', detached:true })
  : spawn('node', ['node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=5175', '--strictPort'], { stdio: 'ignore', detached: true });
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-webgl', '--remote-debugging-port=9228', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', detached: true });
let socket;
const modes = process.env.BENCHMARK_MODES?.split(',') ?? ['headless', '1x', '4x'];
const output = { verified_at: new Date().toISOString(), seed: 47, draft: 2, policy: 'empty-adaptive',
  scope: 'Compatibility only; excluded from learning. Paced modes execute the same 30 Hz ticks with 1x/4x wall-clock budgets; they do not benchmark the frontend speed button.',
  source_sha256: createHash('sha256').update(await readFile('src/components/AramMatchView.tsx')).digest('hex'), modes: [] };
const cpu = async () => Number((await readFile('/sys/fs/cgroup/cpu.stat', 'utf8')).match(/usage_usec (\d+)/)[1]);
async function memory() {
  const entries = Object.fromEntries((await readFile('/sys/fs/cgroup/memory.stat', 'utf8')).trim().split('\n').map(line => line.split(' ')));
  const current = Number(await readFile('/sys/fs/cgroup/memory.current', 'utf8'));
  return { anon_mib: Number(entries.anon) / 1048576, working_set_mib: (current - Number(entries.inactive_file)) / 1048576 };
}
try {
  let pages;
  for (let i = 0; i < 100; i++) { try { pages = await (await fetch('http://127.0.0.1:9228/json/list')).json(); await fetch('http://127.0.0.1:5175'); break; } catch { await wait(200); } }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', event => { const reply = JSON.parse(event.data), p = pending.get(reply.id); if (p) { pending.delete(reply.id); clearTimeout(p.timeout); reply.error ? p.reject(Error(JSON.stringify(reply.error))) : p.resolve(reply.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id, timeout = setTimeout(() => reject(Error('CDP timeout '+method)), 60000); pending.set(key, { resolve, reject, timeout }); socket.send(JSON.stringify({ id:key, method, params })); });
  const evaluate = async expression => { const reply = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true }); if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text); return reply.result.value; };
  await send('Runtime.enable');
  for (const mode of modes) {
    await send('Page.navigate', { url: 'http://127.0.0.1:5175/' + (process.env.BENCHMARK_COMPILED ? 'evolution-compiled.html' : process.env.BENCHMARK_FAST_PAGE ? 'evolution.html' : '') });
    for (let i=0;i<100;i++) { if(await evaluate(process.env.BENCHMARK_FAST_PAGE || process.env.BENCHMARK_COMPILED ? '!!window.__evolutionPageReady' : '!!document.querySelector("main")')) break; await wait(100); }
    await evaluate(`(async()=>{
      sessionStorage.setItem('esports-clash-macro-experiment','1');sessionStorage.setItem('esports-clash-macro-pair-mode','scout');
      sessionStorage.setItem('esports-clash-macro-pair-filter','audit-only');localStorage.removeItem('esports-clash-adaptive-policy');
      const compiled=window.__evolutionModules;
      const React=compiled?.React??(await import('/node_modules/.vite/deps/react.js')).default;const roots=compiled??await import('/node_modules/.vite/deps/react-dom_client.js');
      const {AramMatchView}=compiled??await import('/src/components/AramMatchView.tsx');const {INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES}=compiled??await import('/src/mockData.ts');
      const {buildPairedStudyDraft}=compiled??await import('/src/pairedStudyDraft.ts');const lineup=buildPairedStudyDraft(INITIAL_PLAYERS,CHAMPIONS,2);
      document.querySelector('#root').style.display='none';const node=document.createElement('div');document.body.append(node);
      window.fixtureRoot=(roots.createRoot??roots.default.createRoot)(node);window.fixtureRoot.render(React.createElement(AramMatchView,{
        seed:47,evaluationStartPaused:true,evaluationRenderless:${mode === 'headless' || mode === 'optimized4x'},
        blueLineup:lineup.slice(0,5),redLineup:lineup.slice(5),blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],
        onReplay:()=>{},onBatchStart:()=>{},onBatchStop:()=>{},onExit:()=>{},onMatchComplete:report=>{window.__benchmarkReport=report;}}));})()`);
    for(let i=0;i<100;i++){if(await evaluate('typeof window.__esportsPairedStep==="function"'))break;await wait(100);}
    const states=[await evaluate('window.__esportsPairedInspect()')], samples=[];
    const started=Date.now(), initialCpu=await cpu(); let ticks=0, state=states[0], lastProgress=0;
    while(!state.finished && ticks<36000) {
      const limit=ticks<900?900:ticks<3600?3600:36000;
      const count=Math.min(mode==='1x'?30:mode==='4x'||mode==='optimized4x'?120:300,limit-ticks);
      const tickStart=Date.now(); assert.equal(await evaluate(`window.__esportsPairedStep(${count})`),true);
      ticks+=count;state=await evaluate('window.__esportsPairedInspect()'); samples.push(await memory());
      if(ticks===900||ticks===3600||state.finished)states.push(state);
      if(Date.now()-lastProgress>60000){console.error(`${mode}: ${state.second.toFixed(1)} simulation seconds`);lastProgress=Date.now();}
      if(!state.finished&&mode!=='headless')await wait(Math.max(0,count/30/(mode==='1x'?1:4)*1000-(Date.now()-tickStart)));
    }
    assert.equal(state.finished,true,'No real terminal match within 1200 simulation seconds');
    const wall=(Date.now()-started)/1000,cpuSeconds=((await cpu())-initialCpu)/1e6;
    const row={mode,simulated_seconds:state.second,wall_seconds:wall,effective_speed:state.second/wall,cpu_seconds:cpuSeconds,cpu_percent:cpuSeconds/wall*100,
      memory:{mean_anon_mib:samples.reduce((n,s)=>n+s.anon_mib,0)/samples.length,max_sampled_anon_mib:Math.max(...samples.map(s=>s.anon_mib)),max_sampled_working_set_mib:Math.max(...samples.map(s=>s.working_set_mib)),vram_mib:null},states};
    if(output.modes.length)assert.deepEqual(states,output.modes[0].states,'Gameplay state/RNG/events/audits differ by scheduling');
    output.modes.push(row);console.error(`${mode} completed: ${wall.toFixed(2)}s wall, ${row.effective_speed.toFixed(2)}x, matching full-state fingerprints`);
    await evaluate('window.fixtureRoot.unmount()'); await wait(100);
  }
  output.parity=true;console.log(JSON.stringify(output));
} finally {
  socket?.close();for(const child of [chrome,vite]){try{process.kill(-child.pid,'SIGTERM');}catch{}await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
  await rm(profile,{recursive:true,force:true});
}
