// Isolated live-engine reproducibility fixture. Known seed 47 is never fresh learning.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const outputPath = process.argv[2];
if (!outputPath) throw Error('Output path required');
const profile = await mkdtemp(join(tmpdir(), 'intelligence-baseline-'));
const server = spawn('python', ['-m', 'http.server', '5175', '--bind', '127.0.0.1', '--directory', 'evolution-dist'], { stdio: 'ignore' });
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-webgl',
  '--remote-debugging-port=9228', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [...(await readdir('src', { recursive: true })).filter(f => /\.(tsx?|css)$/.test(f)).map(f => `src/${f}`),
  ...(await readdir('evolution-dist', { recursive: true })).filter(f => /\.(html|js|css)$/.test(f)).map(f => `evolution-dist/${f}`),
  'package-lock.json', 'scripts/live-baseline.mjs'].sort();
const manifest = await Promise.all(files.map(async f => [f, hash(await readFile(f))]));
const plan = { version: 1, seed: 47, draft: 2, maxTicks: 36000,
  policy: { version: 2, matches: 0, weights: { fight: {}, wave: {}, regroup: {}, farm: {}, push: {} } },
  cardMemory: 'empty-per-episode', scope: 'Known live-rule compatibility fixture; excluded from training and benefit estimates',
  episodes: [{ swapped: false, renderless: true }, { swapped: false, renderless: true },
    { swapped: true, renderless: true }, { swapped: true, renderless: true }, { swapped: false, renderless: false }],
  source_manifest: manifest, source_hash: hash(JSON.stringify(manifest)) };
await writeFile(outputPath + '.plan.json', JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
const report = { plan_hash: hash(await readFile(outputPath + '.plan.json')), source_hash: plan.source_hash,
  runtime: { node: process.version }, episodes: [], reproducible: false, production_eligible: false };
try {
  let pages;
  for (let i = 0; i < 150; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9228/json/list')).json(); await fetch('http://127.0.0.1:5175'); break; }
    catch { await pause(200); }
  }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const pending = new Map(); let id = 0;
  socket.addEventListener('message', event => {
    const reply = JSON.parse(event.data), handler = pending.get(reply.id);
    if (handler) { pending.delete(reply.id); clearTimeout(handler.timer); reply.error ? handler.reject(Error(JSON.stringify(reply.error))) : handler.resolve(reply.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(Error('CDP timeout: ' + method)); }, 60000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result.value;
  };
  await send('Runtime.enable');
  for (const episode of plan.episodes) {
    await send('Page.navigate', { url: 'http://127.0.0.1:5175/evolution-compiled.html' });
    let ready = false;
    for (let i = 0; i < 150; i++) { if (await evaluate('!!window.__evolutionPageReady')) { ready = true; break; } await pause(100); }
    assert.ok(ready, 'Compiled fixture did not load');
    await evaluate(`(() => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('esports-clash-adaptive-policy', ${JSON.stringify(JSON.stringify(plan.policy))});
      sessionStorage.setItem('esports-clash-macro-experiment','1');
      sessionStorage.setItem('esports-clash-macro-pair-mode','scout');
      sessionStorage.setItem('esports-clash-macro-pair-filter','audit-only');
      const {React,createRoot,AramMatchView,INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES,buildPairedStudyDraft}=window.__evolutionModules;
      const lineup=buildPairedStudyDraft(INITIAL_PLAYERS,CHAMPIONS,2);
      document.querySelector('#root').style.display='none';const host=document.createElement('div');document.body.append(host);
      window.fixtureRoot=createRoot(host);window.fixtureRoot.render(React.createElement(AramMatchView,{
        seed:47,evaluationStartPaused:true,evaluationRenderless:${episode.renderless},
        blueLineup:lineup.slice(${episode.swapped ? '5' : '0,5'}),redLineup:lineup.slice(${episode.swapped ? '0,5' : '5'}),
        blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onReplay:()=>{},onBatchStart:()=>{},onBatchStop:()=>{},onExit:()=>{},
        onMatchComplete:(winner,mvp,stats)=>{window.__baselineResult={winner,stats:stats.map(u=>({id:u.id,team:u.team,
          player:u.player.id,champion:u.champion.id,kills:u.kills,deaths:u.deaths,cs:u.cs,gold:u.gold,damage:u.damageDealt}))};}}));
    })()`);
    ready = false;
    for (let i=0;i<150;i++) { if(await evaluate('typeof window.__esportsPairedStep==="function"')) { ready=true;break; } await pause(100); }
    assert.ok(ready, 'Live fixed-step hook unavailable');
    let state = await evaluate('window.__esportsPairedInspect()');
    assert.equal(state.second, 0);
    const states = [state], start = Date.now(); let ticks = 0;
    while (!state.finished && ticks < plan.maxTicks) {
      const boundary = ticks < 900 ? 900 : ticks < 3600 ? 3600 : plan.maxTicks;
      const count = Math.min(300, boundary-ticks);
      assert.equal(await evaluate(`window.__esportsPairedStep(${count})`), true);
      ticks += count; state = await evaluate('window.__esportsPairedInspect()');
      if (ticks === 900 || ticks === 3600 || state.finished) states.push(state);
      if (Date.now()-start > 360000) throw Error('Full-match wall budget exhausted');
    }
    assert.ok(state.finished, 'Censored matches cannot establish terminal parity');
    const result = await evaluate('window.__baselineResult');
    assert.ok(result && ['blue','red'].includes(result.winner));
    const prior = report.episodes.find(e => e.swapped === episode.swapped);
    if (prior) { assert.deepEqual(states, prior.states, 'Complete state/RNG/audits differ'); assert.deepEqual(result, prior.result); }
    report.episodes.push({ ...episode, wall_seconds:(Date.now()-start)/1000, states, result });
    await writeFile(outputPath + '.partial.json', JSON.stringify(report, null, 2) + '\n');
    console.error(`Baseline ${episode.swapped?'swapped':'original'} renderless=${episode.renderless}: ${state.second.toFixed(2)}s; winner=${result.winner}; parity=${!!prior}`);
    await evaluate('window.fixtureRoot.unmount()');
  }
  report.reproducible = true;
  report.scope = plan.scope;
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ reproducible: true, episodes: report.episodes.length, source_hash: plan.source_hash }));
} finally {
  socket?.close();
  for (const child of [chrome, server]) { child.kill('SIGTERM'); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)); }
  await rm(profile, { recursive:true, force:true });
}
