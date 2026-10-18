// Executed through Docker stdin; credentials remain in memory and are never printed.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(join(tmpdir(), 'evolution-ui-'));
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--remote-debugging-port=9224', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let pages;
  for (let i = 0; i < 60; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9224/json/list')).json(); break; } catch { await delay(200); }
  }
  assert.ok(pages?.length, 'Browser startup failed');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const result = JSON.parse(event.data), handler = pending.get(result.id);
    if (handler) { pending.delete(result.id); result.error ? handler.reject(Error(JSON.stringify(result.error))) : handler.resolve(result.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return; } catch { /* Native navigation replaces the document. */ }
      await delay(150);
    }
    throw Error(`Page condition failed: ${expression}`);
  };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://web/' });
  await until('!!document.querySelector("main")');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Evolution Lab')`), false);
  await send('Page.navigate', { url: 'http://api:8000/evolution' });
  await until('!!document.querySelector("input[name=password]")');
  assert.equal(await evaluate('location.pathname'), '/login');
  await evaluate(`(() => { document.querySelector('[name=email]').value=${JSON.stringify(validationCredentials.email)};
    document.querySelector('[name=password]').value=${JSON.stringify(validationCredentials.password)};
    document.querySelector('.login-form').requestSubmit(); })()`);
  await until('!!document.querySelector("#live-reports")');
  assert.equal(await evaluate('location.pathname'), '/evolution');
  const csrf = await evaluate(`fetch('/evolution/settings',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({enabled:false})}).then(response=>response.status)`);
  assert.equal(csrf, 419, 'Owner mutations require CSRF');
  await evaluate(`document.querySelector('#schedule .settings-form').requestSubmit()`);
  await until('document.body.innerText.includes("Schedule saved.")');
  const desktop = await evaluate(`({ loaded: document.body.innerText.includes('Schedule & review window'),
    learning: document.body.innerText.includes('Machine learning reports'), balance: document.body.innerText.includes('Balance laboratory'),
    history: document.body.innerText.includes('Decision history'), errors: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent) })`);
  assert.ok(desktop.loaded && desktop.learning && desktop.balance && desktop.history);
  assert.deepEqual(desktop.errors, []);
  let operations, operationsScreenshot;
  if (typeof validationOperations !== 'undefined' && validationOperations) {
    await until('!!document.querySelector("#resources")');
    const before = await evaluate(`Object.fromEntries([...document.querySelector('#operations form').elements].filter(e=>e.name && e.name!=='_token').map(e=>[e.name,e.value]))`);
    assert.equal(before.workers, '1');
    assert.equal(before.speed, 'headless');
    await evaluate(`document.querySelector('#operations form').requestSubmit()`);
    await until('document.body.innerText.includes("Resource/storage operation recorded.")');
    const after = await evaluate(`Object.fromEntries([...document.querySelector('#operations form').elements].filter(e=>e.name && e.name!=='_token').map(e=>[e.name,e.value]))`);
    assert.deepEqual(after, before, 'Saving existing resource policy changed the displayed values');
    for (const action of ['preview', 'cleanup']) {
      await evaluate(`document.querySelector('#operations input[value=${action}]').form.requestSubmit()`);
      await until(`document.body.innerText.includes("Resource/storage operation recorded.") && !!document.querySelector("#operations pre") && JSON.parse(document.querySelector('#operations pre').textContent).dry_run === ${action === 'preview'}`);
      const result = await evaluate(`JSON.parse(document.querySelector('#operations pre').textContent)`);
      assert.equal(result.dry_run, action === 'preview');
      assert.deepEqual(result.candidates, [], 'Historical evidence must remain protected');
    }
    operations = await evaluate(`({health:document.querySelector('#resources').innerText, controls:!!document.querySelector('#operations'), cleanup:JSON.parse(document.querySelector('#operations pre').textContent)})`);
    assert.ok(operations.health.includes('CPU-only image'));
    assert.ok(operations.health.includes('retained checkpoints'));
    const panel = await evaluate(`({y:document.querySelector('#resources').getBoundingClientRect().top+scrollY, height:document.querySelector('#operations').getBoundingClientRect().bottom-document.querySelector('#resources').getBoundingClientRect().top})`);
    operationsScreenshot = (await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true,
      clip:{x:0,y:panel.y,width:1280,height:Math.min(2400,panel.height),scale:1}})).data;
  }
  await until('document.querySelector("#live-status").textContent.includes("Live reports")');
  const metrics = await send('Page.getLayoutMetrics');
  const screenshot = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1280, height: Math.min(2400, metrics.cssContentSize.height), scale: 1 } })).data;
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(400);
  const mobile = await evaluate(`({ pageWidth: document.documentElement.clientWidth, contentWidth: document.documentElement.scrollWidth,
    labWidth: document.querySelector('main').getBoundingClientRect().width })`);
  assert.ok(mobile.contentWidth <= mobile.pageWidth + 1, 'Dashboard causes horizontal page overflow');
  await evaluate(`document.querySelector('.run-links a').click()`);
  await until('document.body.innerText.includes("Evaluation evidence")');
  const report = await evaluate(`({ hasPlan:document.body.innerText.includes('Frozen execution plan'), hasMetrics:document.body.innerText.includes('Prediction MSE'), download:document.querySelector('a[download]')?.href ?? [...document.querySelectorAll('a')].find(a=>a.textContent.includes('Download report JSON'))?.href })`);
  assert.ok(report.hasPlan && report.hasMetrics && report.download);
  const download = await evaluate(`fetch(${JSON.stringify(report.download)}).then(async response=>({status:response.status,data:await response.json()}))`);
  assert.equal(download.status, 200); assert.ok(download.data.plan && download.data.progress);
  await evaluate(`document.querySelector('.account form').requestSubmit()`);
  await until('!!document.querySelector("input[name=password]")');
  await send('Page.navigate', { url: 'http://api:8000/evolution' });
  await until('!!document.querySelector("input[name=password]")');
  console.log(JSON.stringify({ desktop, mobile, native_session_login_logout: true, csrf_missing_rejected: csrf,
    live_report_refresh: true, schedule_form_saved_existing_values: true, report_download: { status: download.status, id: download.data.id },
    removed_from_game: true, operations, viewport_checks: ['1280x900', '390x844'], screenshot, operationsScreenshot }));
} finally {
  socket?.close();
  chrome.kill('SIGTERM');
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else chrome.once('exit', resolve); });
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
}
