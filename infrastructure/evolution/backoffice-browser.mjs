import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

export async function withBrowser(run) {
  const reviewRoot = resolve('.local-tools/backoffice-review');
  await mkdir(reviewRoot, { recursive: true });
  const profile = await mkdtemp(resolve(reviewRoot, 'profile-'));
  const reservation = createServer();
  await new Promise(done => reservation.listen(0, '127.0.0.1', done));
  const port = reservation.address().port;
  await new Promise(done => reservation.close(done));
  const executable = process.env.BROWSER_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'chromium');
  const chrome = spawn(executable, [
    '--headless=new', '--no-first-run', '--disable-extensions', '--disable-background-networking',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let launchError;
  chrome.on('error', error => { launchError = error; });
  let socket;
  const pause = ms => new Promise(done => setTimeout(done, ms));
  try {
    let pages;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError;
      try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; }
      catch { await pause(100); }
    }
    assert.ok(pages, 'Chrome must start');
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise(done => socket.addEventListener('open', done, { once: true }));
    let serial = 0;
    const pending = new Map(), errors = [];
    socket.addEventListener('close', () => { for (const request of pending.values()) request.reject(Error('Browser connection closed')); pending.clear(); });
    socket.addEventListener('message', event => {
      const reply = JSON.parse(event.data);
      if (reply.method === 'Runtime.exceptionThrown') errors.push(reply.params.exceptionDetails.exception?.description ?? reply.params.exceptionDetails.text);
      const request = pending.get(reply.id);
      if (!request) return;
      pending.delete(reply.id);
      reply.error ? request.reject(Error(reply.error.message)) : request.resolve(reply.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); reject(Error(`Browser request timed out: ${method}`)); }, 45000);
      pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
      return reply.result.value;
    };
    const until = async (expression, timeout = 25000) => {
      for (let tick = 0; tick < timeout / 100; tick++) {
        try { if (await evaluate(expression)) return; } catch {}
        await pause(100);
      }
      throw Error(`Timed out: ${expression}`);
    };
    const navigate = async path => {
      await send('Page.navigate', { url: `http://localhost:8089${path}` });
      await until(`location.pathname === ${JSON.stringify(path.split('?')[0])} && document.readyState === 'complete' && !!document.querySelector('main h1')`);
    };
    const viewport = async (width, height = 1000) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const screenshot = async file => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(reviewRoot, file), Buffer.from(shot.data, 'base64'));
    };
    await send('Page.enable'); await send('Runtime.enable');
    await viewport(1440);
    await navigate('/login');
    const env = Object.fromEntries((await readFile('.env.evolution.local', 'utf8')).split(/\r?\n/).filter(line => line.includes('=')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(env.EVOLUTION_OWNER_EMAIL)};document.querySelector('[name=password]').value=${JSON.stringify(env.EVOLUTION_OWNER_PASSWORD)};document.querySelector('.login-form').requestSubmit();true`);
    await until(`location.pathname === '/evolution' && !!document.querySelector('.report-nav')`);
    await run({ send, evaluate, until, navigate, viewport, screenshot, pause, errors, reviewRoot });
  } finally {
    socket?.close();
    chrome.kill();
    if (!launchError && chrome.exitCode === null && chrome.signalCode === null) await new Promise(done => chrome.once('exit', done));
    assert.ok(resolve(profile).startsWith(reviewRoot + sep), 'Only remove the disposable review profile');
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
}
