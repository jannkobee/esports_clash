import { CHAMPIONS, INITIAL_COACHES, INITIAL_PLAYERS } from '../src/mockData.ts';

const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const page = pages.find(item => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
if (!page) throw Error('Arena page missing');
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
const evaluate = async expression => {
  const reply = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply.result.exceptionDetails) throw Error(JSON.stringify(reply.result.exceptionDetails));
  return reply.result.result.value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
if (process.argv.includes('--start')) {
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await delay(1300);
  const find = name => CHAMPIONS.find(champion => champion.name === name);
  const blueNames = ['Valkira', 'Buck', 'Kyumi', 'Astra', 'Renn'];
  const redNames = ['Tequoia', 'Cora', 'Kazemaru', 'Sylla', 'Kage'];
  const draft = {
    blue: INITIAL_PLAYERS.slice(0, 5).map((player, index) => ({ player, champion: find(blueNames[index]) })),
    red: INITIAL_PLAYERS.slice(5, 10).map((player, index) => ({ player, champion: find(redNames[index]) })),
    blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[1]
  };
  const report = { version: 1, seed: 12345, draft };
  await evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Squad Lineup')).click()");
  await delay(100);
  await evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('1-Lane ARAM Bridge')).click()");
  await delay(150);
  await evaluate(`(() => { const data=new DataTransfer(); data.items.add(new File([${JSON.stringify(JSON.stringify(report))}], 'turret-sample.json', {type:'application/json'})); const input=document.querySelector('input[type=file]'); input.files=data.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  await delay(350);
  console.log({ started: await evaluate("(() => {const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('Run 25'));button?.click();return !!button;})()") });
} else if (process.argv.includes('--long')) {
  console.log(await evaluate("(() => {const all=JSON.parse(localStorage.getItem('esports-clash-match-reports')||'[]');const id=all.at(-1)?.batchId;const report=all.filter(entry=>entry.batchId===id).sort((a,b)=>b.durationSeconds-a.durationSeconds)[0];return {durationSeconds:Math.round(report.durationSeconds),winner:report.winner,structures:report.events.filter(event=>event.type==='tower').map(event=>[Math.round(event.second),event.text]),lastEvents:report.events.slice(-12).map(event=>[Math.round(event.second),event.text])};})()"));
} else {
  console.log(await evaluate("(() => {const all=JSON.parse(localStorage.getItem('esports-clash-match-reports')||'[]');const id=all.at(-1)?.batchId;const reports=all.filter(report=>report.batchId===id);return {count:reports.length,averageSeconds:Math.round(reports.reduce((sum,report)=>sum+report.durationSeconds,0)/Math.max(1,reports.length)),maxSeconds:Math.round(Math.max(...reports.map(report=>report.durationSeconds))),under8:reports.filter(report=>report.durationSeconds<480).length,running:Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Stop')};})()"));
}
socket.close();
