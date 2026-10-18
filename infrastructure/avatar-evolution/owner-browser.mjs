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
  await send('Page.navigate',{url:'http://api:8000/evolution/avatars'});await until('!!document.querySelector("input[name=password]")');
  await evaluate(`(()=>{document.querySelector('[name=email]').value=${JSON.stringify(validationCredentials.email)};document.querySelector('[name=password]').value=${JSON.stringify(validationCredentials.password)};document.querySelector('.login-form').requestSubmit()})()`);
  await until('!!document.querySelector("#live-reports")');
  await send('Page.navigate',{url:'http://api:8000/evolution/avatars'});await until('document.querySelector("h1")?.textContent.includes("Avatar Evolution")');
  const settings=await evaluate(`Object.fromEntries([...document.querySelector('form[action$="/avatars/settings"]').elements].filter(e=>e.name&&e.name!=='_token').map(e=>[e.name,e.value]))`);
  assert.equal(settings.enabled,'1');assert.equal(settings.candidates_per_cycle,'5');
  const csrf=await evaluate(`fetch('/evolution/avatars/settings',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({enabled:false})}).then(r=>r.status)`);assert.equal(csrf,419);
  await evaluate(`document.querySelector('form[action$="/avatars/settings"]').requestSubmit()`);
  await until('document.body.innerText.includes("Avatar automation settings saved.")');
  const publicBefore=await evaluate(`fetch('/api/v1/avatar-visuals').then(r=>r.json())`);assert.deepEqual(publicBefore.releases,[],'Generation cannot publish an unapproved design');
  const runLink=await evaluate(`[...document.querySelectorAll('.run-title a')].find(a=>a.href.includes('/avatars/'))?.href`);assert.ok(runLink);
  await send('Page.navigate',{url:runLink});await until('document.querySelectorAll("iframe").length>=6');
  const summary=await evaluate(`({title:document.querySelector('h1').textContent,passed:[...document.querySelectorAll('section.panel p')].filter(p=>p.textContent.includes('Technical validation:')&&p.textContent.includes('Passed')).length,
    approveButtons:[...document.querySelectorAll('button[value=approve]')].filter(b=>!b.disabled).length,errors:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})`);
  assert.equal(summary.passed,5);assert.equal(summary.approveButtons,5);assert.deepEqual(summary.errors,[]);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('#status')?.textContent.includes('Arsenaldo')`);
  const iframe=await evaluate(`({canvas:!!document.querySelector('iframe').contentDocument.querySelector('canvas'),status:document.querySelector('iframe').contentDocument.querySelector('#status').textContent})`);
  assert.ok(iframe.canvas);assert.ok(iframe.status.includes('Arsenaldo'));
  const glb=await evaluate(`(async()=>{const a=[...document.querySelectorAll('a')].find(a=>a.textContent==='Download candidate GLB');const r=await fetch(a.href),b=await r.arrayBuffer();return {url:a.href,status:r.status,bytes:b.byteLength,magic:new DataView(b).getUint32(0,true)}})()`);
  assert.equal(glb.status,200);assert.equal(glb.magic,0x46546c67);assert.ok(glb.bytes>100000);
  const cookies=(await send('Network.getCookies',{urls:[glb.url]})).cookies;
  const downloaded=await fetch(glb.url,{headers:{Cookie:cookies.map(c=>c.name+'='+c.value).join('; ')}});
  assert.equal(downloaded.status,200);glb.sha256=createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex');
  await evaluate(`document.querySelector('button[value=approve]').closest('section').scrollIntoView({block:'start'})`);
  await until(`(()=>{const frames=[...document.querySelector('button[value=approve]').closest('section').querySelectorAll('iframe')];return frames.length===2&&frames.every(f=>f.contentDocument?.querySelector('#status')?.textContent.includes('Arsenaldo'))})()`);
  const beforeAfter=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);
  await until(`(()=>{const frames=[...document.querySelector('button[value=approve]').closest('section').querySelectorAll('iframe')];return frames.every(f=>f.contentDocument?.querySelector('canvas')?.getBoundingClientRect().width<=f.contentDocument.documentElement.clientWidth+1)})()`);
  const mobile=await evaluate(`({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,frames:[...document.querySelector('button[value=approve]').closest('section').querySelectorAll('iframe')].map(f=>({viewport:f.contentDocument.documentElement.clientWidth,content:f.contentDocument.documentElement.scrollWidth,canvas:f.contentDocument.querySelector('canvas').getBoundingClientRect().width}))})`);
  assert.ok(mobile.content<=mobile.viewport+1,'Phone comparison overflows the page');
  for(const frame of mobile.frames){assert.ok(frame.content<=frame.viewport+1,'Phone review iframe overflows');assert.ok(frame.canvas<=frame.viewport+1,'Phone model canvas was not resized');}
  const mobileScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await evaluate(`document.querySelector('.account form').requestSubmit()`);await until('!!document.querySelector("input[name=password]")');
  await send('Page.navigate',{url:glb.url});await until('!!document.querySelector("input[name=password]")');
  console.log(JSON.stringify({owner_login:true,settings_saved_unchanged:settings,csrf_rejected:csrf,summary,iframe,mobile,
    private_asset_requires_login:true,unapproved_public_releases:publicBefore.releases.length,download:glb,
    published_during_validation:false,screenshot:beforeAfter.data,mobileScreenshot:mobileScreenshot.data}));
}finally{
  socket?.close();chrome.kill('SIGTERM');
  await new Promise(resolve=>{if(chrome.exitCode!==null||chrome.signalCode!==null)resolve();else{const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);chrome.once('exit',()=>{clearTimeout(timer);resolve();});}});
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});
}
