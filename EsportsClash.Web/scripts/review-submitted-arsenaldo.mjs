import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT,origin='http://localhost:8088';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((done,reject)=>{
  ws.addEventListener('open',done,{once:true});ws.addEventListener('error',()=>reject(Error('Browser CDP connection failed')),{once:true});
});
let id=0;const pending=new Map(),errors=[];
ws.onmessage=event=>{const r=JSON.parse(event.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.exception?.description??r.params.exceptionDetails.text);
  if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('Browser CDP connection closed'));pending.clear();});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timeout: '+expression);};
const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../../docs/'+name+'.png',import.meta.url),Buffer.from(r.data,'base64'));};
try{
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});await wait('!!document.querySelector("nav button")');
  const setup=await evaluate(`(async()=>{
    const React=(await import('/node_modules/.vite/deps/react.js')).default,client=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AvatarModelPreview}=await import('/src/components/AvatarModelPreview.tsx');const {CHAMPIONS}=await import('/src/mockData.ts');
    const {getArsenaldoModelVariant}=await import('/src/avatarModelUrl.ts');
    document.querySelector('#root').style.display='none';document.body.style.background='#0c1622';document.body.style.margin='24px';
    const host=document.createElement('main');host.style.maxWidth='1100px';host.style.margin='auto';document.body.append(host);
    window.fixture=(client.createRoot??client.default.createRoot)(host);
    window.fixture.render(React.createElement(AvatarModelPreview,{champion:CHAMPIONS.find(c=>c.id==='c_invoker')}));
    window.preview=()=>{const walk=f=>!f?null:f.type?.name==='AvatarModelPreview'?f:walk(f.child)||walk(f.sibling);
      for(let h=walk(window.fixture._internalRoot.current)?.memoizedState;h;h=h.next)if(typeof h.memoizedState?.current?.setKit==='function')return h.memoizedState.current;};
    return {defaultVariant:getArsenaldoModelVariant()};
  })()`);
  assert.equal(setup.defaultVariant,'submitted');
  await wait(`document.querySelector('.avatar-model-preview__canvas')?.dataset.modelVariant==='submitted'`);
  const actual=await evaluate(`(()=>{const p=window.preview(),model=p.model,material=model.body.children[0].children[0].getObjectByProperty('isMesh',true).material;
    const maps={};for(const key of ['map','normalMap','metalnessMap','roughnessMap'])maps[key]=material[key]?{width:material[key].image.width,height:material[key].image.height}:null;
    const appearance=model.body.children[0],before=appearance.matrixWorld.toArray();
    for(const state of ['idle','walk','run','attack','cast','hit','death']){model.animate(Object.freeze({motionState:state}),.5);p.renderer.render(p.scene,p.camera);}
    return {variant:model.body.userData.modelVariant,animationSupport:model.body.userData.animationSupport,clips:model.body.userData.clips,
      source:p.host.dataset.modelUrl,height:model.height,maps,drawCalls:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles,
      staticTransformPreserved:before.every((v,i)=>v===appearance.matrixWorld.elements[i]),shaderErrors:p.renderer.info.programs.filter(program=>program.diagnostics?.runnable===false).length};})()`);
  assert.equal(actual.variant,'submitted');assert.equal(actual.animationSupport,'static-mesh');assert.deepEqual(actual.clips,[]);
  assert.ok(actual.maps.map&&actual.maps.normalMap&&actual.maps.metalnessMap&&actual.maps.roughnessMap);assert.equal(actual.shaderErrors,0);
  assert.equal(actual.height,74);assert.equal(actual.staticTransformPreserved,true);assert.match(actual.source,/arsenaldo-submitted-20261018/);
  await screenshot('arsenaldo-supplied-studio');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(400);
  const mobile=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.querySelector('.avatar-model-preview__canvas canvas').getBoundingClientRect().width,viewport:innerWidth})`);
  assert.equal(mobile.overflow,false);assert.ok(mobile.canvas>100&&mobile.canvas<390);await screenshot('arsenaldo-supplied-mobile');
  await evaluate(`(()=>{const s=document.querySelector('[aria-label="Arsenaldo model version"]');s.value='claude';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('.avatar-model-preview__canvas')?.dataset.modelVariant==='claude'`);
  await evaluate(`(()=>{const s=document.querySelector('[aria-label="Arsenaldo model version"]');s.value='submitted';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('.avatar-model-preview__canvas')?.dataset.modelVariant==='submitted'`);
  const downloaded=await evaluate(`(async()=>{const response=await fetch(document.querySelector('.avatar-model-preview__controls a').href),bytes=await response.arrayBuffer();return {bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')};})()`);
  assert.equal(downloaded.sha256,'29661d603b85a3c9227331a5d3b1b930ce23ed241e01f866e1563581c613a4d4');assert.deepEqual(errors,[]);
  await evaluate('window.fixture.unmount()');
  const result={date:'2026-10-18',actual,mobile,downloaded,oldAnimatedVariantSelectable:true,errors};
  await writeFile(new URL('../../docs/arsenaldo-supplied-browser-verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{ws.close();}
