import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(s=>s&&!s.startsWith('#')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^(['"])(.*)\1$/,'$2')];}));
const candidate=JSON.parse(await readFile('.local-tools/mirelle-current-candidate.json','utf8'));
const endpoint='http://127.0.0.1:9244';
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
  await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(settings.EVOLUTION_OWNER_EMAIL??'owner@teamfight.local')};document.querySelector('[name=password]').value=${JSON.stringify(settings.EVOLUTION_OWNER_PASSWORD)};document.querySelector('[name=password]').form.requestSubmit();true`);
  await until('!document.querySelector("[name=password]")');await navigate('http://localhost:8089/evolution/registry/avatars');
 }
 const roster=await evaluate(`({count:document.querySelectorAll('.manage-card').length,missing:document.body.textContent.includes('deleted')})`);assert.equal(roster.count,45);assert.ok(roster.missing);
 await navigate(`http://localhost:8089/evolution/registry/avatars/c_invoker/base/${candidate.id}`);
 await until('!!document.querySelector("#base-inspection")?.dataset.ready || !!document.querySelector("#base-inspection")?.dataset.error');
 const loaded=await evaluate(`(()=>{const h=document.querySelector('#base-inspection');if(h.dataset.error)throw Error(h.dataset.error);const {container,scene}=h.inspection;return {bones:container.skeletons.reduce((n,s)=>n+s.bones.length,0),clips:container.animationGroups.map(g=>g.name),meshes:container.meshes.length,vertices:container.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),gpu:scene.getEngine().getGlInfo()};})()`);
 assert.equal(loaded.bones,48);assert.equal(loaded.clips.length,10);
 const seek=await evaluate(`(()=>{const h=document.querySelector('#base-inspection'),{container}=h.inspection;let samples=0;for(const group of container.animationGroups)for(const phase of [0,.15,.42,.7,1]){h.inspection.sample(group.name,phase);samples++;for(const node of container.transformNodes){const m=node.computeWorldMatrix(true);if(!Array.from(m.m).every(Number.isFinite))throw Error('Nonfinite transform');}}h.inspection.sample('',0);return {samples,finiteTransforms:true};})()`);assert.equal(seek.samples,50);
 await send('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('docs/mirelle-clean-base-20261024/backoffice-inspector.png',Buffer.from(r.data,'base64')));
 assert.deepEqual(errors,[]);
 const report={candidate_id:candidate.id,url:`http://localhost:8089/evolution/registry/avatars/c_invoker/base/${candidate.id}`,roster,loaded,seek,errors,status:'animated_base_unqualified',limits:['Browser load and seek smoke check only. Does not clear the independent collision failures.','No production match performance, mirrored-team, transition or artistic qualification.']};
 await writeFile('docs/mirelle-clean-base-20261024/browser-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{socket.close();await fetch(endpoint+'/json/close/'+page.id);}
