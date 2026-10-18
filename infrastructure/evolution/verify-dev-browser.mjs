// Executed through Docker stdin by verify-dev.mjs; credentials stay in memory.
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {lookup} from 'node:dns/promises';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'evolution-dev-ui-'));
const gateway=(await lookup('host.docker.internal')).address;
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage',
  `--host-resolver-rules=MAP localhost ${gateway}`, '--remote-debugging-port=9231',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try {
  let pages;
  for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9231/json/list')).json();break;}catch{await delay(100);}}
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map(),frames=[];
  socket.addEventListener('message',e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}
    if(r.method==='Network.webSocketFrameReceived'){try{frames.push(JSON.parse(r.params.response.payloadData));}catch{}}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const until=async expression=>{for(let i=0;i<300;i++){try{if(await evaluate(expression))return;}catch{}await delay(100);}throw Error('Page did not reach: '+expression+' '+JSON.stringify(await evaluate('({url:location.href,title:document.title,text:document.body?.innerText.slice(0,400)})'))+' frames='+JSON.stringify(frames.slice(-4)));};
  await send('Network.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:8089/evolution/ml/reports'});
  await until('!!document.querySelector("input[name=password]")');
  await evaluate(`(()=>{document.querySelector('[name=email]').value=${JSON.stringify(validationCredentials.email)};document.querySelector('[name=password]').value=${JSON.stringify(validationCredentials.password)};document.querySelector('.login-form').requestSubmit()})()`);
  await until('!!document.querySelector("#live-reports")');
  await send('Page.navigate',{url:'http://localhost:8089/evolution/ml/reports'});
  await until('document.querySelector("h1")?.textContent==="ML reports"');
  const ml=await evaluate(`({rows:document.querySelectorAll('.run-row').length,modelRows:document.querySelectorAll('a[href*="/avatars/"]').length,active:document.querySelector('[aria-current=page]')?.textContent})`);
  assert.equal(ml.active,'ML reports');
  await send('Page.navigate',{url:'http://localhost:8089/evolution/avatars/reports'});
  await until('document.querySelector("h1")?.textContent==="Model reports"');
  const models=await evaluate(`({rows:document.querySelectorAll('.run-row').length,active:document.querySelector('[aria-current=page]')?.textContent,mlEvidence:document.body.textContent.includes('Prediction MSE')})`);
  assert.equal(models.active,'Model reports');assert.ok(models.rows>0);assert.equal(models.mlEvidence,false);
  const download=await evaluate(`(async()=>{const a=[...document.querySelectorAll('a')].find(a=>a.textContent==='Download model JSON'),r=await fetch(a.href),j=await r.json();return {status:r.status,type:j.type,candidates:j.report.candidates?.length,disposition:r.headers.get('Content-Disposition')}})()`);
  assert.equal(download.status,200);assert.equal(download.type,'avatar-model');assert.ok(download.candidates>0);
  for(let i=0;i<100&&!frames.some(f=>f.type==='connected');i++)await delay(100);
  assert.ok(frames.some(f=>f.type==='connected'),'Laravel Vite websocket did not connect');
  console.log('EDIT:view');
  await until('!!document.querySelector("[data-dev-reload-probe]")');
  console.log('EDIT:css');
  await until('getComputedStyle(document.documentElement).getPropertyValue("--dev-reload-proof").trim()==="verified"');
  console.log('EDIT:php');
  await until(`fetch('/evolution/avatars/reports').then(r=>r.headers.get('X-Development-Probe')==='verified')`);
  const backendReloadFrames=frames.filter(f=>f.type==='full-reload').length;
  assert.ok(backendReloadFrames>=2);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);
  const mobile=await evaluate(`({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth})`);
  assert.ok(mobile.content<=mobile.viewport+1);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await send('Page.navigate',{url:'http://localhost:8088'});
  await until('document.querySelector("#root")?.children.length>0');
  await delay(1500);
  const origin=await evaluate('performance.timeOrigin'),start=frames.length;
  console.log('EDIT:react');
  for(let i=0;i<200&&!frames.slice(start).some(f=>f.type==='update');i++)await delay(100);
  const update=frames.slice(start).find(f=>f.type==='update');assert.ok(update,'React did not receive HMR update');
  assert.ok(update.updates.some(u=>u.path.includes('/src/App.tsx')));
  await delay(500);assert.equal(await evaluate('performance.timeOrigin'),origin,'React update caused a full page reload');
  console.log('RESULT:'+JSON.stringify({owner_login:true,ml,models,download,mobile,blade_reload:true,css_reload:true,php_reload:true,
    backend_reload_frames:backendReloadFrames,react_hmr:true,react_full_page_reload:false,screenshot:screenshot.data}));
} finally {
  socket?.close();chrome.kill('SIGTERM');
  await new Promise(resolve=>{if(chrome.exitCode!==null||chrome.signalCode!==null)resolve();else{const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);chrome.once('exit',()=>{clearTimeout(timer);resolve();});}});
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});
}
