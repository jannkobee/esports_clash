import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const profile=await mkdtemp(join(tmpdir(),'compute-owner-ui-'));
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--remote-debugging-port=9238',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
  let pages;for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9238/json/list')).json();break;}catch{await delay(100);}}
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
  const readState = () => evaluate(`({preference:document.querySelector('#compute-preference').value,text:document.querySelector('.compute-controls').innerText,jobs:[...document.querySelectorAll('[data-job-id]')].map(e=>e.dataset.jobId)})`);
  const original = await readState();
  const save = async value => {
    await evaluate(`(()=>{const select=document.querySelector('#compute-preference');select.value=${JSON.stringify(value)};select.form.requestSubmit();})()`);
    await until(`document.readyState === 'complete' && document.querySelector('#compute-preference')?.value === ${JSON.stringify(value)} && document.body.innerText.includes('Generation compute saved')`);
  };
  const layouts=[];
  let local, google, csrf;
  try {
    await save('local'); local=await readState();
    assert.ok(local.text.includes('Selected: Local'));
    assert.ok(local.text.includes('Generator: TRELLIS.2'));
    assert.ok(!local.text.includes('reuses saved avatar geometry'));
    await send('Page.navigate',{url:'http://api:8000/evolution/avatars/trellis/avatar/c_wukong_lol'});
    await until(`document.readyState==='complete' && !!document.querySelector('#compute-preference')`);
    assert.equal((await readState()).preference,'local');
    await save('google'); google=await readState();
    assert.ok(google.text.includes('automatically falls back to Local'));
    assert.ok(google.text.includes('Generator: TRELLIS.2'));
    const setup=await evaluate(`fetch(document.querySelector('a[href$="/setup/colab"]').href).then(async response=>({status:response.status,format:(await response.json()).nbformat}))`);
    assert.equal(setup.status,200);assert.equal(setup.format,4);
    const ready=await evaluate(`!document.body.innerText.includes('TRELLIS.2 setup needed.')`);
    if(!ready) assert.equal(await evaluate(`document.querySelector('.generation-action button').disabled`),true);
    for(const width of [1440,768,390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
      await evaluate(`document.querySelector('#generate').scrollIntoView({block:'start'})`);
      await delay(150);
      const layout=await evaluate(`({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,controlWidth:document.querySelector('#compute-preference').getBoundingClientRect().width})`);
      assert.ok(layout.content<=layout.viewport+1,JSON.stringify(layout));layouts.push(layout);
    }
    csrf=await evaluate(`fetch('/evolution/avatars/trellis/compute',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({compute_preference:'local'})}).then(r=>r.status)`);
    assert.equal(csrf,419);
    assert.equal((await readState()).preference,'google');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.querySelector('#generate').scrollIntoView({block:'start'})`);
    const shot=await send('Page.captureScreenshot',{format:'png'});
    // Compare history on the roster before/after; saving compute queues no jobs.
    await send('Page.navigate',{url:'http://api:8000/evolution/avatars/trellis'});
    await until(`document.readyState==='complete' && !!document.querySelector('#generation-roster')`);
    assert.deepEqual((await readState()).jobs,original.jobs);
    console.log(JSON.stringify({local:{preference:local.preference,text:local.text},google:{preference:google.preference,text:google.text},layouts,csrf,history_unchanged:true,original_preference:original.preference,screenshot:shot.data}));
  } finally {
    if((await readState()).preference !== original.preference) await save(original.preference);
  }
}finally{
  socket?.close();chrome.kill('SIGTERM');
  await new Promise(resolve=>{if(chrome.exitCode!==null||chrome.signalCode!==null)resolve();else{const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);chrome.once('exit',()=>{clearTimeout(timer);resolve();});}});
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});
}
