import { writeFileSync } from 'node:fs';

const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const page = pages.find(item => item.type === 'page' && item.url.includes('127.0.0.1:5173')) ?? pages.find(item => item.type === 'page');
if (!page) throw Error('No browser page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.onopen = resolve);
let nextId = 0;
const pending = new Map();
socket.onmessage = event => {
  const response = JSON.parse(event.data);
  if (pending.has(response.id)) { pending.get(response.id)(response); pending.delete(response.id); }
};
const call = (method, params = {}) => {
  const id = ++nextId;
  const reply = new Promise(resolve => pending.set(id, resolve));
  socket.send(JSON.stringify({ id, method, params }));
  return reply;
};
const mobile = process.argv.includes('--mobile');
await call('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1280, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
await call('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await new Promise(resolve => setTimeout(resolve, 1500));
await call('Runtime.evaluate', { expression: "Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Squad Lineup'))?.click()" });
await new Promise(resolve => setTimeout(resolve, 300));
await call('Runtime.evaluate', { expression: "Array.from(document.querySelectorAll('h3')).find(element => element.textContent.includes('Club Reserves'))?.scrollIntoView({block:'start'})" });
await new Promise(resolve => setTimeout(resolve, 300));
const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(mobile ? 'squad-mobile-smoke.png' : 'squad-desktop-smoke.png', Buffer.from(shot.result.data, 'base64'));
socket.close();
