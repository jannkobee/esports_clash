import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function inspect(folder,avatarId,candidate) {
  const profile=await mkdtemp(join(tmpdir(),'avatar-review-'));
  const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--no-first-run','--remote-debugging-port=9227',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  let socket;
  try {
    let page;
    for(let i=0;i<100;i++){try{page=(await(await fetch('http://127.0.0.1:9227/json/list')).json()).find(p=>p.type==='page');if(page)break;}catch{}await delay(100);}
    assert.ok(page,'Preview browser startup failed');socket=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let id=0;const pending=new Map();socket.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
    await send('Network.enable');await send('Network.setExtraHTTPHeaders',{headers:{Authorization:'Bearer '+process.env.EVOLUTION_WORKER_TOKEN}});
    await send('Emulation.setDeviceMetricsOverride',{width:512,height:480,deviceScaleFactor:1,mobile:false});
    const url=`http://127.0.0.1:8094/viewer/avatar-review.html?run=${folder.split('/').at(-1)}&avatar=${avatarId}&candidate=${candidate}`;
    await send('Page.navigate',{url});
    let ready=false;for(let i=0;i<300;i++){try{ready=await evaluate('!!window.__avatarEvolution?.ready');}catch{}if(ready)break;await delay(100);}
    assert.ok(ready,'Actual GLB review renderer did not become ready');
    const metrics=await evaluate('window.__avatarEvolution.evaluate()');
    const previews=[];
    for(const [name,angle,pose,phase] of [['front',0,'Idle',.2],['side',Math.PI/2,'Idle',.2],['back',Math.PI,'Idle',.2],['anticipation',.6,'Attack',.15],['strike',.6,'Attack',.42],['recovery',.6,'Attack',.82],['ability',.6,'Ability',.45]]) {
      await evaluate(`window.__avatarEvolution.draw(${phase},${angle},${JSON.stringify(pose)})`);
      const data=await evaluate('window.__avatarEvolution.screenshot()'),file=`${candidate}-${name}.png`;
      await writeFile(join(folder,file),Buffer.from(data.split(',')[1],'base64'));previews.push({name,file,pose,phase,angle});
    }
    return {...metrics,previews};
  }finally{
    socket?.close();chrome.kill('SIGTERM');
    await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else{const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);chrome.once('exit',()=>{clearTimeout(timer);resolve();});}});
    await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});
  }
}
