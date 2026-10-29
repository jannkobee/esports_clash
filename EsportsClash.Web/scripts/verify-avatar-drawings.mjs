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
 await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/art/avatar-drawings-v1/index.html'});
 await new Promise(r=>setTimeout(r,1800));
 const images=await evaluate(`(async()=>{const imgs=[...document.images];for(const i of imgs)i.loading='eager';await Promise.all(imgs.map(i=>i.decode()));return imgs.map(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const pixels=x.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let n=3;n<pixels.length;n+=4){if(pixels[n]<16)clear++;if(pixels[n]>=240)solid++;}return {src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight,clearFraction:clear/(c.width*c.height),solidFraction:solid/(c.width*c.height)};});})()`);
 assert.equal(images.length,Number(process.env.EXPECTED_DRAWINGS??45));
 assert.ok(images.every(i=>i.width>=512&&i.height>=512));
 const search=await evaluate(`(()=>{const i=document.querySelector('#search');i.value='solenne';i.dispatchEvent(new Event('input'));const n=[...document.querySelectorAll('article')].filter(c=>!c.hidden).length;i.value='';i.dispatchEvent(new Event('input'));return n;})()`);assert.equal(search,1);
 const metrics=await send('Page.getLayoutMetrics');
 await writeFile('../docs/arena-2d/avatar-drawings-v1/gallery-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1440,height:metrics.cssContentSize.height,scale:1}})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,400));
 const mobile=await evaluate('document.documentElement.scrollWidth <= innerWidth');assert.ok(mobile);
 await writeFile('../docs/arena-2d/avatar-drawings-v1/gallery-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.deepEqual(errors,[]);
 await writeFile('../docs/arena-2d/avatar-drawings-v1/browser.json',JSON.stringify({base,images,search,mobile,errors},null,2));console.log(JSON.stringify({images:images.length,search,mobile,errors}));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id);}
