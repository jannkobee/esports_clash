import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const folder = process.argv[2];
const { plan, plan_hash } = JSON.parse(await readFile(`${folder}/allocation.json`, 'utf8'));
const manifest = JSON.parse(await readFile('/online/manifest.json', 'utf8'));
const catalog = JSON.parse(await readFile('/online/catalog.json', 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const atomic = async (name, value) => { await writeFile(`${folder}/${name}.tmp`, JSON.stringify(value)); await rename(`${folder}/${name}.tmp`, `${folder}/${name}`); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, socket;
try {
  for (const [file, hash] of manifest.sources) assert.equal(sha(await readFile(`src/${file}`)), hash, `Worker source changed: ${file}`);
  assert.deepEqual(plan.versions, Object.fromEntries(['catalog_version', 'rules_version', 'policy_version', 'observation_version'].map(key => [key, manifest[key]])));
  assert.equal(sha(await readFile('/online/catalog.json')), manifest.catalog_version);
  if (plan.content_catalog) {
    assert.equal(plan.content_catalog.schema,1);
    assert.equal(sha(plan.content_catalog.canonical_records),plan.content_catalog.hash,'Allocated content snapshot changed');
    assert.deepEqual(JSON.parse(plan.content_catalog.canonical_records),plan.content_catalog.records);
  }
  const profile = `/tmp/online-browser-${plan.match_id}-${process.pid}`;
  chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--remote-debugging-port=9226', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9226/json/list')).json(); break; } catch { await wait(200); }
  }
  assert.ok(pages?.length, 'Private browser failed to start');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const pending = new Map(); let id = 0;
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data), handler = pending.get(data.id);
    if (handler) { pending.delete(data.id); clearTimeout(handler.timer); data.error ? handler.reject(Error(JSON.stringify(data.error))) : handler.resolve(data.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(Error(`CDP timeout: ${method}`)); }, 60000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result.value;
  };
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5174/' });
  for (let i = 0; i < 120; i++) { if (await evaluate('!!document.querySelector("main")')) break; await wait(200); }
  await evaluate(`(async () => {
    localStorage.removeItem('esports-clash-adaptive-policy');
    localStorage.removeItem('esports-clash-evaluation-reference-policy');
    sessionStorage.clear();
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const roots = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { AramMatchView } = await import('/src/components/AramMatchView.tsx');
    const { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } = await import('/src/mockData.ts');
    const { validateGameContent } = await import('/src/gameContent.ts');
    const plan = ${JSON.stringify(plan)};
    if(plan.content_catalog&&!validateGameContent(plan.content_catalog))throw Error('Invalid allocated content catalog');
    const arena=plan.versions.policy_version==='arena-command-v1';
    const hybrid=['baseline-hybrid-v1','original-v3-hybrid-v2'].includes(plan.versions.policy_version);
    if(arena&&plan.intelligence?.controller!=='arena')throw Error('Missing pinned arena controller');
    if(hybrid&&plan.intelligence?.controller!=='hybrid')throw Error('Missing pinned hybrid controller');
    const lineup = side => plan[side].map(slot => {
      const player = INITIAL_PLAYERS.find(card => card.id === slot.card_id);
      const champion = CHAMPIONS.find(avatar => avatar.id === slot.avatar_id);
      if (!player || !champion) throw Error('Unknown allocated card/avatar');
      return { player, champion };
    });
    document.querySelector('#root').style.display = 'none';
    const node = document.createElement('div'); document.body.append(node);
    window.onlineRoot = (roots.createRoot ?? roots.default.createRoot)(node);
    window.onlineRoot.render(React.createElement(AramMatchView, { seed: plan.seed,
      contentCatalog:plan.content_catalog??null,
      evaluationRenderless: true, evaluationStartPaused: true, trustedServer: true,
      evaluationController:arena?'arena':hybrid?'hybrid':'legacy',
      evaluationPolicies:(arena||hybrid)&&plan.intelligence.release?{blue:plan.intelligence.release.policy,red:plan.intelligence.release.policy}:undefined,
      intelligenceRelease:(arena||hybrid)?plan.intelligence.release:undefined,
      blueLineup: lineup('blue'), redLineup: lineup('red'),
      blueCoach: INITIAL_COACHES.find(coach => coach.id === plan.coach_id),
      redCoach: INITIAL_COACHES.find(coach => coach.id === plan.coach_id),
      blueTeamName: plan.clubs.blue, redTeamName: plan.clubs.red,
      onReplay: () => {}, onBatchStart: () => {}, onBatchStop: () => {}, onExit: () => {}, onMatchComplete: () => {} }));
  })()`);
  for (let i = 0; i < 100; i++) { if (await evaluate('!!window.__esportsTrusted')) break; await wait(100); }
  assert.equal(await evaluate('window.__esportsTrusted.snapshot().second'), 0);
  await mkdir(`${folder}/frames`, { recursive: true });
  const names = (await readdir(`${folder}/frames`)).filter(name => /^\d{6}\.json\.gz$/.test(name)).sort();
  let sequence = names.length ? Number(names.at(-1).split('.')[0]) : 0;
  if (sequence) {
    const saved = JSON.parse(gunzipSync(await readFile(`${folder}/frames/${names.at(-1)}`)).toString());
    const target = Math.round(saved.snapshot.second * 30);
    for (let steps = 0; steps < target; steps += 300) await evaluate(`window.__esportsTrusted.step(${Math.min(300, target - steps)})`);
    const restored = await evaluate('window.__esportsTrusted.snapshot()');
    assert.equal(restored.fingerprint, saved.snapshot.fingerprint, 'Seed recovery diverged from the persisted frame');
  }
  const started = Date.now();
  const speed = Math.max(1, Math.min(4, Number(process.env.ONLINE_SPEED ?? 1)));
  let didFinish = false;
  const smoke=process.argv.includes('--smoke');
  while (!smoke && Date.now() - started < 45 * 60 * 1000) {
    const tickStart = Date.now();
    if (sequence) await evaluate('window.__esportsTrusted.step(15)');
    const snapshot = await evaluate('window.__esportsTrusted.snapshot()');
    if (snapshot.second > 1800) throw Error('Match exceeded the simulation budget; no invented winner');
    const message = { type: 'snapshot', schema: 1, match_id: plan.match_id, sequence: ++sequence,
      plan_hash, versions: plan.versions, speed, snapshot };
    const framePath = `${folder}/frames/${String(sequence).padStart(6, '0')}.json.gz`;
    await writeFile(`${framePath}.tmp`, gzipSync(JSON.stringify(message)));
    await rename(`${framePath}.tmp`, framePath);
    await atomic('snapshot.json', message);
    let result;
    if (snapshot.finished) {
      assert.ok(snapshot.report && ['blue', 'red'].includes(snapshot.report.winner));
      result = { schema: 1, match_id: plan.match_id, versions: plan.versions, seed: plan.seed,
        winner: snapshot.report.winner, report: snapshot.report,
        terminal_nexus: Object.fromEntries(['blue', 'red'].map(team => [team,
          snapshot.frame.structures.find(structure => structure.team === team && structure.type === 'nexus').isAlive])) };
    }
    await atomic('state.json', { status: result ? 'completed' : 'running', sequence, ...(result ? { result } : {}) });
    if (result) { didFinish = true; console.log(JSON.stringify({ completed: plan.match_id, sequence, winner: result.winner })); break; }
    await wait(Math.max(0, 500 / speed - (Date.now() - tickStart)));
  }
  if(smoke) {
    const snapshot=await evaluate('window.__esportsTrusted.snapshot()');
    await atomic('smoke.json',{schema:1,content_hash:plan.content_catalog?.hash,versions:plan.versions,snapshot});
    console.log(JSON.stringify({smoke:true,second:snapshot.second,content_hash:plan.content_catalog?.hash}));
  } else if (!didFinish) throw Error('Match worker time budget exceeded; no result awarded');
} catch (error) {
  await atomic('state.json', { status: 'failed', error: error.message });
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  socket?.close();
  if (chrome) {
    chrome.kill('SIGTERM');
    await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else chrome.once('exit', resolve); });
  }
}
