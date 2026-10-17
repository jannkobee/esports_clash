// Real app checks in an isolated disposable browser, without touching the user's profile.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const port = process.env.CDP_PORT ?? '9223', vitePort = process.env.VITE_PORT ?? '5174';
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(done => socket.addEventListener('open', done, { once: true }));
let id = 0; const pending = new Map();
socket.addEventListener('message', event => {
  const reply = JSON.parse(event.data); if (!reply.id) return;
  const request = pending.get(reply.id); pending.delete(reply.id);
  reply.error ? request.reject(Error(JSON.stringify(reply.error))) : request.resolve(reply.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const delay = ms => new Promise(done => setTimeout(done, ms));
const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`../docs/${name}.png`, Buffer.from(result.data, 'base64')); };
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/` });
  for (let i = 0; i < 80; i++) { if (await evaluate('document.querySelectorAll(".player-card").length >= 5')) break; await delay(100); }
  assert.ok(await evaluate('document.querySelectorAll(".player-card").length >= 5'));
  // Reset only the disposable profile's saved starting slots for a representative screenshot.
  await evaluate(`localStorage.removeItem('esports-clash-club-starting-five-v1')`);
  await send('Page.reload');
  for (let i = 0; i < 80; i++) { if (await evaluate('document.querySelectorAll(".player-card").length >= 5')) break; await delay(100); }
  const portraits = await evaluate(`(async () => {
    const { INITIAL_PLAYERS } = await import('/src/mockData.ts');
    const { portraitPosition } = await import('/src/playerPortraits.ts');
    const positions = INITIAL_PLAYERS.map(card => portraitPosition(card.avatarSvg));
    const image = new Image(); image.src = document.querySelector('.player-card__portrait').style.backgroundImage.slice(5, -2);
    await image.decode();
    return { count: positions.length, unique: new Set(positions).size, allMapped: positions.every(Boolean),
      width: image.naturalWidth, height: image.naturalHeight };
  })()`);
  assert.equal(portraits.count, 64); assert.equal(portraits.unique, 64); assert.ok(portraits.allMapped && portraits.width === portraits.height);
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  await screenshot('player-cards-desktop');
  // Keyboard card selection, a real reserve substitution, and saved state still work.
  const before = await evaluate(`document.querySelector('.player-card h3').textContent`);
  await evaluate(`document.querySelector('.player-card[role="button"]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' }); await delay(100);
  assert.equal(await evaluate('document.querySelector(".player-card").getAttribute("aria-pressed")'), 'true');
  const replacement = await evaluate(`document.querySelector('.player-card--compact h3').textContent`);
  await evaluate(`document.querySelector('.player-card--compact').click()`); await delay(100);
  assert.equal(await evaluate(`document.querySelector('.player-card h3').textContent`), replacement);
  // Return the displaced card to the first starting slot in this disposable profile.
  await evaluate(`document.querySelector('.player-card').click();`); await delay(80);
  await evaluate(`(() => { const input = document.querySelector('input[placeholder="Search player name"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(before)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await delay(100);
  await evaluate(`[...document.querySelectorAll('.player-card--compact')].find(card => card.querySelector('h3').textContent === ${JSON.stringify(before)}).click()`); await delay(100);
  await evaluate(`(() => { const input = document.querySelector('input[placeholder="Search player name"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await delay(100);
  assert.equal(await evaluate(`document.querySelector('.player-card h3').textContent`), before);
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Inspect'); button.focus(); button.click(); })()`);
  await delay(100);
  assert.ok(await evaluate('!!document.querySelector("[role=dialog][aria-modal=true]")'));
  assert.equal(await evaluate('document.activeElement?.getAttribute("aria-label")'), 'Close player details');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }); await delay(100);
  assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
  assert.equal(await evaluate('document.activeElement?.textContent.trim()'), 'Inspect');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate('window.scrollTo(0,0)'); await delay(100);
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  await evaluate(`document.querySelector('.player-card').scrollIntoView({ block: 'center' })`); await delay(80);
  await screenshot('player-cards-mobile');
  await evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Inspect').click()`); await delay(100);
  const modal = await evaluate(`(() => { const el = document.querySelector('[role=dialog]'), r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, viewport: innerHeight, scrollable: el.scrollHeight > el.clientHeight }; })()`);
  assert.ok(modal.top >= 0 && modal.bottom <= modal.viewport + 1);
  await screenshot('player-cards-inspector-mobile');
  await evaluate(`document.querySelector('[aria-label="Close player details"]').click()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const result = { portraits, desktopNoOverflow: true, mobileNoOverflow: true, keyboardSelection: true,
    reserveSwap: true, inspectorEscapeAndFocusRestore: true, mobileInspectorFits: true,
    screenshots: ['player-cards-desktop.png', 'player-cards-mobile.png', 'player-cards-inspector-mobile.png'] };
  await writeFile('../docs/player-card-ui-verification.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { socket.close(); }
