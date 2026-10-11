// Optional local visual smoke test: run Vite and a disposable headless Chrome
// with --remote-debugging-port=9223. No browser automation package is required.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const port = process.env.CDP_PORT ?? '9223';
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(page => page.type === 'page');
assert.ok(page, 'A disposable browser page is required');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const response = JSON.parse(event.data);
  if (response.method === 'Runtime.exceptionThrown') errors.push(response.params.exceptionDetails.exception?.description ?? response.params.exceptionDetails.text);
  if (response.id) { const request = pending.get(response.id); pending.delete(response.id); response.error ? request.reject(response.error) : request.resolve(response.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let retry = 0; retry < 40; retry++) {
    if (await evaluate('!!document.querySelector("nav button")')) break;
    await delay(500);
  }
  // Mount the real live arena with Arsenaldo in a deterministic fixture.
  await evaluate(`(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {AramMatchView} = await import('/src/components/AramMatchView.tsx');
    const {INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES} = await import('/src/mockData.ts');
    document.querySelector('#root').style.display = 'none';
    const host = document.createElement('div'); document.body.append(host);
    const avatars = [CHAMPIONS.find(c => c.name === 'Kaelen'), ...CHAMPIONS.filter(c => c.name !== 'Kaelen').slice(0,9)];
    const lineup = avatars.map((champion, i) => ({champion, player: INITIAL_PLAYERS[i]}));
    window.fixtureRoot = createRoot(host);
    window.fixtureRoot.render(React.createElement(AramMatchView, { seed: 47, blueLineup: lineup.slice(0,5), redLineup: lineup.slice(5),
      blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[0], onReplay: () => {}, onBatchStart: () => {}, onBatchStop: () => {}, onMatchComplete: () => {}, onExit: () => window.fixtureRoot.unmount() }));
  })()`);
  await delay(1200);
  const outputDir = join(tmpdir(), 'teamfight-spectator-check');
  await mkdir(outputDir, { recursive: true });
  for (const [width, height] of [[1920,1080], [1366,768], [1280,720], [1024,600], [390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(200);
    const geometry = await evaluate(`(() => {
      const shell = document.querySelector('.spectator-shell');
      const box = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
      return { shell:box(shell), canvas:box(shell.querySelector('canvas')), dock:box(shell.querySelector('footer')),
        units:[...shell.querySelectorAll('.spectator-unit')].map(box), overflow:shell.scrollWidth > shell.clientWidth || shell.scrollHeight > shell.clientHeight,
        clippedItems:[...shell.querySelectorAll('.spectator-items')].some(e => e.getBoundingClientRect().right > e.closest('.spectator-roster').getBoundingClientRect().right + 1) };
    })()`);
    assert.equal(geometry.overflow, false, JSON.stringify({width,height,geometry}));
    assert.equal(geometry.clippedItems, false, `Items clipped at ${width}`);
    assert.equal(geometry.units.length, 10);
    assert.ok(geometry.canvas.height > 90);
    assert.ok(geometry.units.every(box => box.bottom <= height + 1));
    const capture = await send('Page.captureScreenshot', { format: 'png' });
    const screenshot = join(outputDir, `spectator-${width}x${height}.png`);
    await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
    console.log(JSON.stringify({width,height,canvas:geometry.canvas,screenshot}));
  }
  await send('Emulation.setDeviceMetricsOverride', { width:1366, height:768, deviceScaleFactor:1, mobile:false });
  const click = label => evaluate(`(() => {const b=[...document.querySelectorAll('.spectator-shell button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button');b.click();})()`);
  if (process.env.CHECK_COMBAT === '1') {
    await click('4x');
    await delay(30000);
    await click('Insights'); await delay(100);
    const row = await evaluate(`([...document.querySelectorAll('[aria-label="Match insights"] tbody tr')].find(row=>row.textContent.includes('Arsenaldo')))?.textContent`);
    console.log('Live Arsenaldo cast totals:', row);
    const count = await evaluate(`(() => {const row=[...document.querySelectorAll('[aria-label="Match insights"] tbody tr')].find(row=>row.textContent.includes('Arsenaldo'));return row ? row.children[4].textContent.split('/').reduce((sum,n)=>sum+Number(n),0) : 0;})()`);
    assert.ok(count > 0, 'Arsenaldo must actually cast invoked spells in a live match');
    await evaluate(`document.querySelector('[aria-label="Close match insights"]').click()`);
  }
  await click('Pause'); await delay(100);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Resume match"]') !== null`), true);
  await click('Event log'); await delay(100);
  assert.equal(await evaluate(`!!document.querySelector('.spectator-records')`), true);
  await click('Squads & items'); await delay(100);
  await evaluate(`document.querySelector('.spectator-items button:not(:disabled)').click()`); await delay(100);
  assert.equal(await evaluate(`document.body.textContent.includes('Unique:')`), true);
  await click('Close'); await delay(100);
  await click('Insights'); await delay(100);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Match insights"]')`), true);
  await evaluate(`document.querySelector('[aria-label="Close match insights"]').click()`);
  await click('Lobby'); await delay(100);
  assert.equal(await evaluate(`document.body.style.overflow === 'hidden'`), false);
  await evaluate(`(async () => {
    const React=(await import('/node_modules/.vite/deps/react.js')).default;
    const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {ConfluxSpellbook}=await import('/src/components/ConfluxSpellbook.tsx');
    const {CHAMPIONS}=await import('/src/mockData.ts');
    const host=document.createElement('div');document.body.append(host);
    createRoot(host).render(React.createElement(ConfluxSpellbook,{champion:CHAMPIONS.find(c=>c.name==='Kaelen')}));
  })()`);
  await delay(150);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Choose invoked spell"] button').length`), 10);
  for (let index=0;index<10;index++) {
    await evaluate(`document.querySelectorAll('[aria-label="Choose invoked spell"] button')[${index}].click()`);
    await delay(40);
    assert.ok(await evaluate(`document.querySelector('[aria-label="Conflux spellbook"] article').textContent.includes('mana')`));
  }
  assert.deepEqual(errors, []);
  console.log('Spectator geometry, playback, tabs, item inspection, insights, and exit passed.');
} finally { ws.close(); }
