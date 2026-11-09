import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(s=>s&&!s.startsWith('#')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^(['"])(.*)\1$/,'$2')];}));
const candidate={id:'1bb641cd-ce80-4e12-9018-e67de0ff6dc3'};
const endpoint='http://127.0.0.1:9238';
const page=await(await fetch(endpoint+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method+' timed out')),30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<480;i++){if(await evaluate(expression))return;await delay(250);}throw Error(expression);}
async function navigate(url){await send('Page.navigate',{url});await until('document.readyState!=="loading"');}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await navigate('http://localhost:8089/evolution/registry/avatars');
 if(await evaluate('!!document.querySelector("[name=email]")')){
  if(!settings.EVOLUTION_OWNER_PASSWORD)throw Error('Configured owner login missing');
  await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(settings.EVOLUTION_OWNER_EMAIL??'owner@teamfight.local')};document.querySelector('[name=password]').value=${JSON.stringify(settings.EVOLUTION_OWNER_PASSWORD)};document.querySelector('[name=password]').form.requestSubmit();true`);
  await until('!document.querySelector("[name=password]")');
 }
 const report={date:'2026-10-24',mode:'authenticated-read-only-audit',pages:[],errors};
 for(const [name,path] of [['generation','/evolution/avatars/trellis'],['preparation','/evolution/avatars/preparation'],['ashkar','/evolution/avatars/trellis/avatar/c_locke'],['mirelle','/evolution/avatars/trellis/avatar/c_invoker'],['base','/evolution/registry/avatars/c_invoker/base/'+candidate.id]]){
  await navigate('http://localhost:8089'+path);await delay(1600);
  const data=await evaluate(`({title:document.title,url:location.pathname,text:document.body.innerText,images:[...document.querySelectorAll('main img,.content img,#base-inspection')].map(i=>({alt:i.alt,src:i.getAttribute('src'),data:i.dataset.ready??i.dataset.error})),forms:[...document.forms].map(f=>({action:new URL(f.action).pathname,method:f.method,buttons:[...f.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),disabled:b.disabled}))}))})`);
  data.text=data.text.replaceAll(settings.EVOLUTION_OWNER_EMAIL??'owner@teamfight.local','[owner]');report.pages.push({name,...data});
  await send('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('docs/pipeline-audit-20261024/backoffice-'+name+'.png',Buffer.from(r.data,'base64')));
 }
 await until('!!document.querySelector("#base-inspection")?.dataset.ready || !!document.querySelector("#base-inspection")?.dataset.error');
 report.inspector=await evaluate(`(()=>{const h=document.querySelector('#base-inspection');return {ready:h.dataset.ready,error:h.dataset.error,status:document.querySelector('#base-status')?.textContent,clips:[...document.querySelectorAll('#base-clip option')].map(o=>o.textContent)};})()`);
 if(report.inspector.ready){
  for(const [label,clip,phase] of [['bind','',0],['idle','Idle',.42],['run','Run',.42],['attack','Attack',.42],['death','Death',1]]){
   await evaluate(`document.querySelector('#base-inspection').inspection.sample(${JSON.stringify(clip)},${phase})`);await delay(300);
   await send('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('docs/pipeline-audit-20261024/mirelle-'+label+'.png',Buffer.from(r.data,'base64')));
  }
 }
 const roster=JSON.parse(await readFile('docs/pipeline-audit-20261024/roster-inventory.json','utf8'));
 report.roster=[];
 for(const avatar of roster){
  const data=await evaluate(`(async()=>{const r=await fetch('/evolution/avatars/trellis/avatar/${avatar.id}');const d=new DOMParser().parseFromString(await r.text(),'text/html');return {status:r.status,text:d.body.innerText??d.body.textContent,forms:[...d.forms].filter(f=>['/evolution/avatars/trellis/reference','/evolution/avatars/trellis/weapon'].includes(new URL(f.action,location.origin).pathname)).map(f=>({action:new URL(f.action,location.origin).pathname,slot:f.querySelector('[name=weapon_slot]')?.value,images:[...f.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),alt:i.alt})),fields:[...f.querySelectorAll('input,select')].filter(e=>!['_token','_method'].includes(e.name)&&e.type!=='file').map(e=>({name:e.name,value:e.value}))}))};})()`);
  delete data.text;report.roster.push({id:avatar.id,name:avatar.name,...data});
 }
 await writeFile('docs/pipeline-audit-20261024/backoffice.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pages:report.pages.map(p=>({name:p.name,title:p.title,forms:p.forms.length})),inspector:report.inspector,roster:report.roster.length,errors}));
}finally{socket.close();await fetch(endpoint+'/json/close/'+page.id);}
