// Read-only UI acceptance in a fresh, isolated Chromium profile. No real login or mutations.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const profile=await mkdtemp(join(tmpdir(),'fps-reference-browser-'));
const output='/tmp/fps-reference-review';await mkdir(output,{recursive:true});
const debugPort=10000+Math.floor(Math.random()*10000);
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sockets=[];const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect(url){
  const socket=new WebSocket(url);sockets.push(socket);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map(),listeners=[];
  socket.addEventListener('message',({data})=>{const message=JSON.parse(data);const item=pending.get(message.id);
    if(item){pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);}
    else for(const listener of listeners)listener(message);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error(`Timed out: ${method}`));},60000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
  return {send,evaluate,listeners};
}
try{
  let version;
  for(let i=0;i<100;i++){try{version=await(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();break;}catch{await sleep(100);}}
  assert.ok(version,'Chromium did not start');
  const browser=await connect(version.webSocketDebuggerUrl);
  const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
  const targets=await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);
  const errors=[],environmentNotes=[];page.listeners.push(message=>{if(message.method==='Runtime.exceptionThrown'){
    const error=message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text;
    if(error.includes('WebSocket closed without opened')&&error.includes('/@vite/client'))environmentNotes.push('Container cannot connect to the host-only Vite HMR websocket.');
    else errors.push(error);
  }});
  await page.send('Runtime.enable');await page.send('Page.enable');
  const user={id:998877,name:'UI Review',email:'review@local.invalid',is_evolution_admin:true,supporter:{active:false}};
  await page.send('Fetch.enable',{patterns:[{urlPattern:'*backend/api/v1/*'}]});
  page.listeners.push(message=>{
    if(message.method!=='Fetch.requestPaused')return;
    const {requestId,request}=message.params;
    const path=new URL(request.url).pathname;
    const auth=Object.entries(request.headers).some(([key,value])=>key.toLowerCase()==='authorization'&&value==='Bearer isolated-ui-review');
    let data,status=200;
    if(path.endsWith('/me'))data={data:user};
    else if(auth&&path.endsWith('/world/operations'))data={data:{pending_jobs:0,engine:{status:'ready'},queues:['default','world']}};
    else if(auth&&path.includes('/online/office/inbox'))data={data:{items:[],unread:0,meta:{page:1,last_page:1,total:0}}};
    else if(auth&&path.endsWith('/club'))data={data:null};
    else if(auth||request.method!=='GET'){status=403;data={message:'Private mutation disabled in UI acceptance'};}
    const action=data?page.send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')}):page.send('Fetch.continueRequest',{requestId});
    action.catch(error=>{if(String(error).includes('Invalid InterceptionId'))environmentNotes.push('An intercepted request was cancelled by navigation.');else errors.push(String(error));});
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('esports-clash-api-session-v1',${JSON.stringify(JSON.stringify({token:'isolated-ui-review',user}))});`});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await page.send('Page.navigate',{url:'http://web/#settings'});
  async function waitFor(expression,label){for(let i=0;i<100;i++){if(await page.evaluate(expression))return;await sleep(150);}throw Error(`${label}: ${await page.evaluate("(document.querySelector('[role=alert] details p')?.textContent??'')+' '+document.body.innerText.slice(-1800)")}`);}
  const results=[];
  for(const [route,text] of [['settings','Watch the FPS simulation'],['hexapedia/fps','Build a five'],['hexapedia/roles','Entry Fragger'],['hexapedia/personalities','Icebound'],['hexapedia/weapons','Apex .338'],['hexapedia/equipment','Defuse'],['hexapedia/maps','Breakwater'],['hexapedia/attributes','Aim & mechanics'],['hexapedia/rules','Rounds & sides'],['settings','Watch the FPS simulation']]){
    await page.evaluate(`window.location.hash=${JSON.stringify(route)}`);
    await waitFor(`document.body.innerText.includes(${JSON.stringify(text)})`,route);
    if(route==='settings'){
      await waitFor(`document.body.innerText.includes('Owner operations')&&document.body.innerText.includes('engine / status')`,'settled Settings data');
      assert.equal(await page.evaluate(`document.querySelector('.cm-panel a[href="#fps-simulation"]').getBoundingClientRect().top<innerHeight`),true,'Watch action visible immediately in Settings');
    }
    assert.equal(await page.evaluate(`document.body.innerText.includes('This page could not open')`),false,route);
    results.push(route);
    if(route==='hexapedia/roles'||route==='settings'){const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,route==='settings'?'settings-desktop.png':'roles-desktop.png'),Buffer.from(shot.data,'base64'));}
  }
  // Exercise the same sidebar buttons the owner reported, after async data has settled.
  await page.evaluate(`Array.from(document.querySelectorAll('button.cm-nav-btn')).find(b=>b.textContent.includes('Hexapedia')).click()`);
  await waitFor(`!!document.querySelector('.avatarpedia')`,'Hexapedia sidebar click');
  await page.evaluate(`Array.from(document.querySelectorAll('button.cm-nav-btn')).find(b=>b.textContent.includes('Settings')).click()`);
  await waitFor(`document.body.innerText.includes('Watch the FPS simulation')&&document.body.innerText.includes('engine / status')`,'Settings sidebar click');
  assert.equal(await page.evaluate(`document.body.innerText.includes('This page could not open')`),false,'settled sidebar navigation');
  results.push('sidebar Hexapedia → Settings');
  await page.evaluate(`window.location.hash='hexapedia/personalities/icebound'`);
  await waitFor(`!!document.querySelector('.fps-reference__back')&&document.body.innerText.includes('Icebound')`,'personality detail');
  results.push('hexapedia/personalities/icebound');
  await page.evaluate(`window.location.hash='settings'`);
  await waitFor(`!!document.querySelector('.cm-panel a[href="#fps-simulation"]')`,'Settings watch link');
  await page.evaluate(`document.querySelector('.cm-panel a[href="#fps-simulation"]').click()`);
  await waitFor(`!!document.querySelector('[aria-label="Simulation map"]')`,'simulation setup');
  await page.evaluate(`if(!document.querySelector('.fps-lab input[type=checkbox]').checked)document.querySelector('.fps-lab input[type=checkbox]').click()`);
  await waitFor(`document.body.innerText.includes('Blue system')`,'identity setup');
  await page.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Run & watch simulation')).click()`);
  await waitFor(`!!document.querySelector('[aria-label="FPS match replay"]')`,'simulation replay');
  await waitFor(`!!document.querySelector('[aria-label="Pause replay"]')`,'autoplay');
  const replay=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'simulation-desktop.png'),Buffer.from(replay.data,'base64'));
  await page.evaluate(`window.location.hash='hexapedia/personalities'`);
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await waitFor(`document.body.innerText.includes('Icebound')`,'mobile personalities');
  const mobile=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'personalities-mobile.png'),Buffer.from(mobile.data,'base64'));
  assert.equal(await page.evaluate('document.documentElement.scrollWidth>window.innerWidth+2'),false,'Mobile horizontal overflow');
  assert.deepEqual(errors,[]);
  const result={routes:results,settled_settings:true,sidebar_clicks:true,simulation_autoplay:true,mobile_width:390,render_errors:errors,environment_notes:[...new Set(environmentNotes)],isolated_identity:true,no_server_mutations:true};
  await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{for(const socket of sockets)socket.close();chrome.kill();}
