import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), 'online-verify-'));
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--disable-webgl',
  '--remote-debugging-port=9227', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const connections = [];
async function cdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const reply = JSON.parse(event.data), promise = pending.get(reply.id);
    if (promise) { pending.delete(reply.id); clearTimeout(promise.timeout); reply.error ? promise.reject(Error(JSON.stringify(reply.error))) : promise.resolve(reply.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id, timeout = setTimeout(() => { pending.delete(key); reject(Error(`CDP ${method} timed out`)); }, 30000);
    pending.set(key, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const result = { send, evaluate, close: () => socket.close() }; connections.push(result); return result;
}
let browser;
try {
  let version;
  for (let i = 0; i < 100; i++) { try { version = await (await fetch('http://127.0.0.1:9227/json/version')).json(); break; } catch { await wait(200); } }
  browser = await cdp(version.webSocketDebuggerUrl);
  const pages = [];
  const capture = `window.__onlineObserved={frames:{},connections:0}; const NativeSocket=window.WebSocket;
    window.WebSocket=class extends NativeSocket { constructor(...args){super(...args);window.__onlineObserved.connections++;
      this.addEventListener('message',event=>{try{const data=JSON.parse(event.data);if(data.type==='snapshot'){
        window.__onlineObserved.matchId=data.match_id;window.__onlineObserved.last=data;
        window.__onlineObserved.frames[data.sequence]=data.snapshot.fingerprint;
      }else if(data.type==='match-ended')window.__onlineObserved.ended=data.status;}catch{}});}};`;
  async function open(session, context) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: context });
    let info;
    for (let i = 0; i < 50; i++) {
      info = (await (await fetch('http://127.0.0.1:9227/json/list')).json()).find(page => page.id === targetId);
      if (info) break; await wait(100);
    }
    const page = await cdp(info.webSocketDebuggerUrl);
    await page.send('Page.enable'); await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: capture });
    await page.send('Page.navigate', { url: 'http://web/' });
    for (let i = 0; i < 100; i++) { if (await page.evaluate('!!document.querySelector("main")')) break; await wait(150); }
    await page.evaluate(`localStorage.setItem('esports-clash-api-session-v1', ${JSON.stringify(JSON.stringify(session))})`);
    await page.evaluate(`(() => { const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Online Normal'); if(!button)throw Error('Online tab missing');button.click(); })()`);
    for (let i = 0; i < 120; i++) { if (await page.evaluate('document.body.innerText.includes("Your trusted lineup")')) break; await wait(200); }
    assert.equal(await page.evaluate('document.body.innerText.includes("Your trusted lineup")'), true, 'Trusted roster failed to load');
    return { ...page, targetId, context };
  }
  for (const session of verificationSessions) {
    const { browserContextId } = await browser.send('Target.createBrowserContext');
    pages.push(await open(session, browserContextId));
  }
  for (const page of pages) {
    await page.evaluate(`(() => {const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Find human opponent');if(button&&!button.disabled)button.click();})()`);
    await wait(1000);
  }
  const started = Date.now();
  while (Date.now() - started < 120000) {
    if ((await pages[0].evaluate('window.__onlineObserved.last?.sequence??0')) > 5
      && (await pages[1].evaluate('window.__onlineObserved.last?.sequence??0')) > 5) break;
    const errors = await pages[0].evaluate('[...document.querySelectorAll("[role=alert]")].map(node=>node.textContent)');
    assert.deepEqual(errors, [], `Online UI errors: ${errors}`);
    await wait(1000);
  }
  const initial = await pages[0].evaluate('window.__onlineObserved');
  assert.ok(initial.last?.sequence > 5, 'Server did not stream an active match');
  const matchId = initial.matchId;
  const before = await pages[0].evaluate('window.__onlineObserved.last.sequence');
  await browser.send('Target.closeTarget', { targetId: pages[1].targetId });
  let advancing = before;
  for (let i = 0; i < 60 && advancing <= before; i++) {
    await wait(1000); advancing = await pages[0].evaluate('window.__onlineObserved.last.sequence');
  }
  assert.ok(advancing > before, 'Server stopped when another browser closed');
  pages[1] = await open(verificationSessions[1], pages[1].context);
  for (let i = 0; i < 90; i++) { if ((await pages[1].evaluate('window.__onlineObserved.last?.sequence??0')) >= advancing) break; await wait(500); }
  assert.equal(await pages[1].evaluate('window.__onlineObserved.matchId'), matchId);
  assert.ok((await pages[1].evaluate('window.__onlineObserved.last.sequence')) >= advancing);
  console.error(`Both viewers connected to ${matchId}; sequence advanced ${before} -> ${advancing} while the other browser was closed.`);
  let compared = [];
  let lastProgress = 0;
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const left = await pages[0].evaluate('window.__onlineObserved'), right = await pages[1].evaluate('window.__onlineObserved');
    compared = Object.keys(left.frames).filter(sequence => right.frames[sequence]);
    for (const sequence of compared) assert.equal(left.frames[sequence], right.frames[sequence], `Clients received different authoritative state at ${sequence}`);
    assert.notEqual(left.ended, 'failed', 'Trusted match worker failed');
    if (Date.now() - lastProgress > 60000) {
      console.error(`Authoritative sequence ${left.last?.sequence}, simulation ${Math.floor(left.last?.snapshot.second ?? 0)}s, ${compared.length} identical shared snapshots.`);
      lastProgress = Date.now();
    }
    if (left.ended === 'completed' && right.ended === 'completed') break;
    await wait(2000);
  }
  const final = await pages[0].evaluate('window.__onlineObserved');
  assert.equal(final.ended, 'completed', 'The real match did not finish within the verification budget');
  assert.ok(compared.length > 5);
  const screenshot = (await pages[0].send('Page.captureScreenshot', { format: 'png' })).data;
  await pages[1].send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(300);
  const mobile = await pages[1].evaluate('({width:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,alerts:[...document.querySelectorAll("[role=alert]")].map(node=>node.textContent)})');
  assert.ok(mobile.content <= mobile.width + 1); assert.deepEqual(mobile.alerts, []);
  console.log(JSON.stringify({ match_id: matchId, two_isolated_authenticated_browsers: true,
    renderer: 'Canvas fallback; WebGL separately visually inspected (two software GL viewers saturate the 2-CPU test container)',
    identical_shared_snapshots: compared.length, browser_close_did_not_stop_match: true,
    reconnected_to_same_match: true, final_sequence: final.last.sequence,
    terminal_fingerprint: final.last.snapshot.fingerprint, mobile, screenshot }));
} finally {
  for (const connection of connections) connection.close();
  chrome.kill('SIGTERM');
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else chrome.once('exit', resolve); });
  await rm(profile, { recursive: true, force: true });
}
