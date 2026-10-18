import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const ids = execFileSync('docker', ['ps', '--filter', 'label=com.docker.compose.service=match-worker',
  '--filter', 'label=com.docker.compose.oneoff=True', '--format', '{{.ID}}'], { encoding: 'utf8' }).trim().split(/\s+/);
if (!ids[0]) throw Error('Start verify-online.mjs first');
const source = `setTimeout(()=>{console.error('Capture exceeded 20 seconds');process.exit(1)},20000).unref();
const pages=await (await fetch('http://127.0.0.1:9227/json/list')).json();
const page=pages.find(page=>page.url==='http://web/'); if(!page)throw Error('Online page missing');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;const pending=new Map();ws.addEventListener('message',event=>{const reply=JSON.parse(event.data);const resolve=pending.get(reply.id);if(resolve){pending.delete(reply.id);resolve(reply.result);}});
const send=(method,params={})=>new Promise(resolve=>{const key=++id;pending.set(key,resolve);ws.send(JSON.stringify({id:key,method,params}));});
const metrics=await send('Page.getLayoutMetrics');
const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,
  clip:{x:0,y:0,width:1280,height:Math.min(2400,metrics.cssContentSize.height),scale:1}});
const state=await send('Runtime.evaluate',{expression:'({sequence:window.__onlineObserved.last?.sequence,second:window.__onlineObserved.last?.snapshot.second,canvasCount:document.querySelectorAll("canvas").length,alerts:[...document.querySelectorAll("[role=alert]")].map(node=>node.textContent)})',returnByValue:true});
console.log(JSON.stringify({screenshot:screenshot.data,...state.result.value}));ws.close();`;
const result = JSON.parse(execFileSync('docker', ['exec', '-i', ids[0], 'node', '--input-type=module'],
  { input: source, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
await writeFile('docs/online-normal-live.png', Buffer.from(result.screenshot, 'base64'));
delete result.screenshot;
console.log(JSON.stringify(result));
