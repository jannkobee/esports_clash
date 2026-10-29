import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const proxy=createServer((req,res)=>{const upstream=request({hostname:'web',port:80,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:8088'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>res.end());req.pipe(upstream);});
await new Promise(r=>proxy.listen(8088,'127.0.0.1',r));
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-webgl','--remote-debugging-port=9229','--window-size=1440,1100','--user-data-dir=/tmp/arena-ui-smoke','about:blank'],{stdio:'ignore'});
let socket;let id=0;const pending=new Map();
try{
  let pages;for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9229/json/list')).json();break;}catch{await wait(100);}}
  assert.ok(pages?.length);socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  socket.addEventListener('message',e=>{const reply=JSON.parse(e.data),handler=pending.get(reply.id);if(handler){pending.delete(reply.id);clearTimeout(handler.timer);reply.error?handler.reject(Error(JSON.stringify(reply.error))):handler.resolve(reply.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error('CDP timed out')),30000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  await send('Runtime.enable');await send('Page.navigate',{url:'http://localhost:8088/'});
  for(let i=0;i<200;i++){if(await evaluate('!![...document.querySelectorAll("button")].find(b=>b.textContent.includes("Clash Arena"))'))break;await wait(100);}
  assert.equal(await evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Clash Arena"));b?.click();return !!b;})()'),true);
  for(let i=0;i<100;i++){if(await evaluate('!![...document.querySelectorAll("button")].find(b=>b.textContent.includes("Launch Random Match"))'))break;await wait(100);}
  await wait(2000);
  assert.equal(await evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Launch Random Match"));b?.click();return !!b;})()'),true);
  for(let i=0;i<200;i++){if(await evaluate('!!document.querySelector("[aria-label=\\"Clash Arena spectator\\"]")'))break;await wait(100);}
  await wait(2000);
  const result=await evaluate(`(()=>{const summary=[...document.querySelectorAll('summary')].find(s=>s.textContent.includes('Learning AI:'));if(!summary)return {missing:true};summary.parentElement.open=true;const brief=[...document.querySelectorAll('summary')].find(s=>s.textContent.includes('Read the detailed directions'));if(brief)brief.parentElement.open=true;return {label:summary.textContent,hasDetailedBrief:!!brief,hasAllThreeBarracks:document.body.innerText.includes('all three barracks'),hasDiscoveryLesson:document.body.innerText.includes('Discover strategy through actual matches'),hasNoAvatarPlaystyles:document.body.innerText.includes('no authored per-avatar playstyles'),hasKitFacts:document.body.innerText.includes('automatically from the playable catalog'),hasTenCombinations:document.body.innerText.includes('The ten card and avatar combinations'),ordinaryPrivateBridgeAbsent:!window.__esportsTrusted};})()`);
  for(const key of ['hasDetailedBrief','hasAllThreeBarracks','hasDiscoveryLesson','hasNoAvatarPlaystyles','hasKitFacts','hasTenCombinations','ordinaryPrivateBridgeAbsent'])assert.equal(result[key],true,key);
  if(process.argv.includes('--expect-outcomes')){
    result.hasOutcomeRewards=await evaluate("document.body.innerText.includes('terminal outcome of +5') && document.body.innerText.includes('0.9998') && document.body.innerText.includes('base clicking disappears immediately')");
    assert.equal(result.hasOutcomeRewards,true);
  }
  if(process.argv.includes('--expect-checkpoint'))assert.ok(result.label.includes('experimental checkpoint'),result.label);
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('/output/spectator.png',Buffer.from(shot.data,'base64'));
  await writeFile('/output/ui-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{socket?.close();chrome.kill('SIGTERM');proxy.close();for(const h of pending.values())clearTimeout(h.timer);}
