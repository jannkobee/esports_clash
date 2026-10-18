// Run inside runner over stdin, with no active training run. Known seed 47 is compatibility evidence only.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'evolution-parity-'));
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=5173', '--strictPort'], { stdio: 'ignore' });
// Canvas baseline avoids expensive software WebGL; it still executes ordinary spectator drawing.
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-webgl',
  '--remote-debugging-port=9225', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
try {
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9225/json/list')).json(); await fetch('http://127.0.0.1:5173'); break; }
    catch { await delay(200); }
  }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const pending = new Map(); let id = 0;
  socket.addEventListener('message', event => { const result = JSON.parse(event.data), handler = pending.get(result.id); if (handler) {
    pending.delete(result.id); result.error ? handler.reject(Error(JSON.stringify(result.error))) : handler.resolve(result.result);
  } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Runtime.enable');
  const episodes = [];
  for (const renderless of [false, true]) {
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    for (let i = 0; i < 100; i++) { if (await evaluate('!!document.querySelector("main")')) break; await delay(100); }
    await evaluate(`(async () => {
      sessionStorage.setItem('esports-clash-macro-experiment', '1');
      sessionStorage.setItem('esports-clash-macro-pair-mode', 'scout');
      sessionStorage.setItem('esports-clash-macro-pair-filter', 'audit-only');
      localStorage.removeItem('esports-clash-adaptive-policy');
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const rootModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { AramMatchView } = await import('/src/components/AramMatchView.tsx');
      const { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } = await import('/src/mockData.ts');
      const { buildPairedStudyDraft } = await import('/src/pairedStudyDraft.ts');
      document.querySelector('#root').style.display = 'none';
      const host = document.createElement('div'); document.body.append(host);
      const lineup = buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, 2);
      window.fixtureRoot = (rootModule.createRoot ?? rootModule.default.createRoot)(host);
      window.fixtureRoot.render(React.createElement(AramMatchView, { seed: 47,
        evaluationStartPaused: true, evaluationRenderless: ${renderless},
        blueLineup: lineup.slice(0,5), redLineup: lineup.slice(5), blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[0],
        onReplay: () => {}, onBatchStart: () => {}, onBatchStop: () => {}, onMatchComplete: () => {}, onExit: () => {} }));
    })()`);
    for (let i = 0; i < 100; i++) { if (await evaluate('typeof window.__esportsPairedStep === "function"')) break; await delay(100); }
    const states = [await evaluate('window.__esportsPairedInspect()')];
    assert.equal(states[0].second, 0, 'Evaluation must start paused before any simulation tick');
    const started = Date.now();
    for (let i = 0; i < 6; i++) {
      assert.equal(await evaluate('window.__esportsPairedStep(300)'), true);
      if (i % 3 === 2) states.push(await evaluate('window.__esportsPairedInspect()'));
    }
    episodes.push({ renderless, wall_seconds: (Date.now() - started) / 1000, states });
    await evaluate('window.fixtureRoot.unmount()');
    await delay(100);
  }
  for (let i = 0; i < episodes[0].states.length; i++) assert.deepEqual(episodes[0].states[i], episodes[1].states[i], `Live state/RNG/execution mismatch at checkpoint ${i}`);
  console.log(JSON.stringify({ seed: 47, scope: 'Known compatibility fixture; excluded from learning evidence',
    exact_live_state_rng_and_audits: true, episodes }, null, 2));
} finally {
  socket?.close();
  for (const process of [chrome, vite]) {
    process.kill('SIGTERM');
    await new Promise(resolve => { if (process.exitCode !== null) resolve(); else process.once('exit', resolve); });
  }
  await rm(profile, { recursive: true, force: true });
}
