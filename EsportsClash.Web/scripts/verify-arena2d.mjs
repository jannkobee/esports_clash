import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const cdp='http://127.0.0.1:9246';
const target=await(await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:5186/arena-2d.html'});
for(let i=0;i<60;i++){if(await evaluate("!!document.querySelector('#motions button')"))break;await new Promise(r=>setTimeout(r,500));}
await new Promise(r=>setTimeout(r,2500));
assert.equal(await evaluate("document.querySelectorAll('#roster option').length"),45);
await evaluate("document.querySelector('#pause').click()");
const before=await evaluate("document.querySelector('#readout').textContent");await new Promise(r=>setTimeout(r,300));assert.equal(await evaluate("document.querySelector('#readout').textContent"),before);
await evaluate("document.querySelector('#step').click()");assert.notEqual(await evaluate("document.querySelector('#readout').textContent"),before);
const states=[];for(let i=0;i<4;i++){states.push(await evaluate(`(()=>{document.querySelectorAll('#motions button')[${i}].click();return document.querySelector('#readout').textContent})()`));}
await evaluate("document.querySelectorAll('#motions button')[0].click();document.querySelector('#effect').value='canopy';document.querySelector('#effect').dispatchEvent(new Event('change'))");await new Promise(r=>setTimeout(r,200));
await writeFile('../docs/arena-2d/browser-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,300));
const overflow=await evaluate('document.documentElement.scrollWidth>innerWidth');assert.equal(overflow,false);
await writeFile('../docs/arena-2d/browser-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
assert.deepEqual(errors,[]);await writeFile('../docs/arena-2d/browser.json',JSON.stringify({states,pause:true,step:true,roster:45,mobileOverflow:overflow,errors,scope:'Isolated art preview; no live match qualification'},null,2));console.log('Browser controls, 45 references, responsive layout and exceptions pass.');
}finally{await send('Page.close').catch(()=>{});socket.close();}
