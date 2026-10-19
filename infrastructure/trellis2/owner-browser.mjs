import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const profile=await mkdtemp(join(tmpdir(),'avatar-owner-ui-'));
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--remote-debugging-port=9228',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
  let pages;for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9228/json/list')).json();break;}catch{await delay(100);}}
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();socket.addEventListener('message',e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const until=async expression=>{for(let i=0;i<200;i++){try{if(await evaluate(expression))return;}catch{}await delay(100);}throw Error('Page did not reach: '+expression);};
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://api:8000/evolution/avatars/trellis'});await until('!!document.querySelector("input[name=password]")');
  await evaluate(`(()=>{document.querySelector('[name=email]').value=${JSON.stringify(validationCredentials.email)};document.querySelector('[name=password]').value=${JSON.stringify(validationCredentials.password)};document.querySelector('.login-form').requestSubmit()})()`);
  await until('!!document.querySelector(".report-nav")');
  await send('Page.navigate',{url:'http://api:8000/evolution/avatars/trellis'});await until('!!document.querySelector("#generation-roster")');await until('document.readyState==="complete"');
  const initial=await evaluate(`({cards:document.querySelectorAll('.generation-card').length,title:document.querySelector('h1').textContent,nav:[...document.querySelectorAll('.report-nav a')].map(a=>({text:a.textContent,active:a.getAttribute('aria-current')})),images:document.querySelectorAll('.generation-art img').length})`);
  assert.equal(initial.cards,45);assert.equal(initial.title,'3D Generation');assert.ok(initial.nav.some(a=>a.text==='3D Enhancements'));assert.ok(initial.nav.some(a=>a.text==='3D Generation'&&a.active==='page'));
  await evaluate(`(()=>{const input=document.getElementById('generation-search');input.value='Dawnna';input.dispatchEvent(new Event('input'));})()`);
  const filtered=await evaluate(`[...document.querySelectorAll('.generation-card')].filter(c=>!c.hidden).map(c=>c.querySelector('h3').textContent)`);assert.deepEqual(filtered,['Dawnna']);
  await evaluate(`(()=>{const input=document.getElementById('generation-search');input.value='';input.dispatchEvent(new Event('input'));})()`);
  const csrf=await evaluate(`fetch('/evolution/avatars/trellis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar_id:'c_solana',seed:1})}).then(r=>r.status)`);assert.equal(csrf,419);
  await evaluate(`document.querySelector('.generation-action input[name=seed]').value='25009'`);
  await until(`document.querySelector('#live-status')?.textContent.includes('refreshed every 10 seconds')`);
  const seedPreserved=await evaluate(`document.querySelector('.generation-action input[name=seed]').value`);assert.equal(seedPreserved,'25009');
  await evaluate(`document.querySelector('.generation-action input[name=seed]').value='25001'`);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const references=await evaluate(`Promise.all([...document.querySelectorAll('.generation-art img')].map(async img=>{const response=await fetch(img.src);const bytes=new Uint8Array(await response.arrayBuffer());return {avatar:img.alt,status:response.status,png:bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,bytes:bytes.length};}))`);
  for(const reference of references){assert.equal(reference.status,200);assert.ok(reference.png);assert.ok(reference.bytes>10000);}
  await evaluate(`document.querySelector('#generation-roster').scrollIntoView({block:'start'})`);await delay(400);
  const rosterScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);
  const mobile=await evaluate('({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth})');assert.ok(mobile.content<=mobile.viewport+1);
  const mobileScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  console.log(JSON.stringify({initial,filtered,csrf,mobile,references,live_history_refresh:true,seed_input_preserved:true,screenshot:screenshot.data,mobileScreenshot:mobileScreenshot.data,rosterScreenshot:rosterScreenshot.data}));
}finally{
  socket?.close();chrome.kill('SIGTERM');
  await new Promise(resolve=>{if(chrome.exitCode!==null||chrome.signalCode!==null)resolve();else{const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);chrome.once('exit',()=>{clearTimeout(timer);resolve();});}});
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});
}
