import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BABYLON_CHECK_URL??'http://localhost:8088';
const cdp=process.env.BABYLON_CDP??'http://127.0.0.1:9238';
const target=await(await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error(method+' timed out')),120000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
try {
 await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/art/ability-drawings-v1/index.html'});await new Promise(r=>setTimeout(r,1800));
 const sheets=await evaluate(`(async()=>{const urls=[...new Set([...document.querySelectorAll('.token')].map(e=>getComputedStyle(e).backgroundImage.slice(5,-2)))];return await Promise.all(urls.map(async src=>{const i=new Image();i.src=src;await i.decode();return {src:src.split('/').pop(),width:i.naturalWidth,height:i.naturalHeight};}));})()`);
 assert.equal(sheets.length,46);const cells=await evaluate("document.querySelectorAll('.token').length");assert.equal(cells,190);
 await writeFile('../docs/arena-2d/ability-drawings-v1/gallery.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,400));const mobile=await evaluate('document.documentElement.scrollWidth<=innerWidth');assert.ok(mobile);
 assert.deepEqual(errors,[]);await writeFile('../docs/arena-2d/ability-drawings-v1/gallery-browser.json',JSON.stringify({sheets,cells,mobile,errors},null,2));console.log(JSON.stringify({sheets:sheets.length,cells,mobile,errors}));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}
