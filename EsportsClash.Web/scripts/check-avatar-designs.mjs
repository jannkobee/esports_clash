// Actual model export plus the real Avatars & Lore studio, using disposable CDP Chrome.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const port=process.env.CDP_PORT??'9226',vite=process.env.VITE_PORT??'5176';
const outputPrefix=process.env.OUTPUT_PREFIX??'avatar-designs',useGlb=process.env.USE_GLB==='1';
assert.match(outputPrefix,/^[a-z0-9-]+$/);
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{const r=JSON.parse(event.data);
  if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.exception?.description??r.params.exceptionDetails.text);
  if(!r.id)return;const task=pending.get(r.id);pending.delete(r.id);r.error?task.reject(Error(JSON.stringify(r.error))):task.resolve(r.result);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(`../docs/${name}.png`,Buffer.from(r.data,'base64'));};
try {
  await send('Page.enable');await send('Runtime.enable');
  if(useGlb)await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});
  await wait('!!document.querySelector("nav button")');
  await evaluate(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Avatars & Lore')).click()`);
  await wait('!!document.querySelector(".avatar-model-preview")');
  await evaluate(`document.querySelector('.avatar-model-preview').scrollIntoView({block:'center'})`);
  await wait('Number(document.querySelector(".avatar-model-preview__canvas").dataset.drawCalls)>0');
  const roster=await evaluate(`(async()=>{const {CHAMPIONS}=await import('/src/mockData.ts');return CHAMPIONS.map(c=>({id:c.id,alias:c.displayName}));})()`);
  const covered=[];
  for(const kit of roster){
    await evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes(${JSON.stringify(kit.alias)})).click()`);
    await wait(`document.querySelector('.avatar-model-preview__canvas').dataset.designId===${JSON.stringify(kit.id)}`);
    if(useGlb)await wait(`document.querySelector('.avatar-model-preview__canvas').dataset.modelFormat==='glb'`);
    await delay(40);
    const row=await evaluate(`(()=>{const e=document.querySelector('.avatar-model-preview');return {id:e.querySelector('[data-design-id]').dataset.designId,
      calls:Number(e.querySelector('[data-draw-calls]').dataset.drawCalls),signature:e.querySelector('.avatar-model-preview__details strong').textContent,
      format:e.querySelector('[data-design-id]').dataset.modelFormat,canvases:e.querySelectorAll('canvas').length};})()`);
    assert.equal(row.id,kit.id);assert.ok(row.calls>3&&row.canvases===1&&row.signature);covered.push(row);
  }
  assert.equal(covered.length,45);
  if(useGlb){const download=await evaluate(`(async()=>{const a=document.querySelector('.avatar-model-preview a[download]');
    const bytes=new Uint8Array(await(await fetch(a.href)).arrayBuffer());return {name:a.download,magic:[...bytes.slice(0,4)]};})()`);
    assert.ok(download.name.endsWith('.glb'));assert.deepEqual(download.magic,[103,108,84,70]);}
  await evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes('Arsenaldo')).click()`);await delay(100);
  assert.equal(await evaluate(`document.querySelector('.avatar-model-preview button[aria-pressed]').getAttribute('aria-pressed')`),'false');
  const angle=await evaluate(`document.querySelector('.avatar-model-preview input').value`);
  const poses=await evaluate(`[...document.querySelector('.avatar-model-preview select').options].map(o=>o.value)`);
  assert.deepEqual(poses,['idle','walk','run','strafe','attack','cast','hit','death','turnleft','turnright']);
  for(const pose of poses){
    await evaluate(`(()=>{const e=document.querySelector('.avatar-model-preview select');e.value=${JSON.stringify(pose)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await delay(30);assert.equal(await evaluate(`document.querySelector('.avatar-model-preview select').value`),pose);
  }
  await evaluate(`document.querySelector('.avatar-model-preview input').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
  assert.notEqual(await evaluate(`document.querySelector('.avatar-model-preview input').value`),angle);
  await evaluate(`(()=>{const select=document.querySelector('.avatar-model-preview select');select.value='cast';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelector('.avatar-model-preview select').value`),'cast');
  await evaluate(`document.querySelector('.avatar-model-preview button[aria-pressed]').click()`);await delay(100);
  assert.equal(await evaluate(`document.querySelector('.avatar-model-preview button[aria-pressed]').getAttribute('aria-pressed')`),'true');
  await evaluate(`[...document.querySelectorAll('.avatar-model-preview button')].find(b=>b.textContent==='Reset view').click()`);await delay(100);
  assert.equal(await evaluate(`document.querySelector('.avatar-model-preview select').value`),'idle');
  await evaluate(`document.querySelector('.avatar-model-preview').scrollIntoView({block:'center'})`);await delay(100);
  await shot(`${outputPrefix}-studio`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(150);
  await evaluate(`document.querySelector('.avatar-model-preview').scrollIntoView({block:'center'})`);await delay(150);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  const box=await evaluate(`document.querySelector('.avatar-model-preview').getBoundingClientRect().toJSON()`);
  assert.ok(box.x>=0&&box.right<=390);await shot(`${outputPrefix}-studio-mobile`);
  await evaluate(`window.avatarContext=document.querySelector('.avatar-model-preview canvas').getContext('webgl2').getExtension('WEBGL_lose_context');window.avatarContext.loseContext()`);
  await wait(`document.querySelector('.avatar-model-preview__fallback')?.textContent.includes('unavailable')`);
  await evaluate('window.avatarContext.restoreContext()');await wait('!document.querySelector(".avatar-model-preview__fallback")');
  await evaluate(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Squad')).click()`);await delay(100);
  assert.equal(await evaluate('document.querySelectorAll(".avatar-model-preview canvas").length'),0);
  // Export a contact sheet from the same model builder. No mock illustrations or replacement assets.
  const sheet=await evaluate(`(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {CHAMPIONS}=await import('/src/mockData.ts');
    const {AvatarModelResources,buildAvatarModel}=await import('/src/threeAvatarModels.ts');
    const {AvatarAssetLibrary}=await import('/src/avatarModelAssets.ts');
    const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(300,294,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#101e2a',1);
    const scene=new THREE.Scene(),resources=new AvatarModelResources(),assets=new AvatarAssetLibrary(resources);scene.add(resources.owner,assets.owner);
    scene.add(new THREE.HemisphereLight('#e8f5ff','#252b43',2.2));
    const sun=new THREE.DirectionalLight('#ffe8cc',3);sun.position.set(-80,150,130);scene.add(sun);
    const rim=new THREE.DirectionalLight('#85bbed',2);rim.position.set(90,70,-100);scene.add(rim);
    resources.mesh(scene,'rod','#27394a',[36,4,36],[0,-3,0]);
    const camera=new THREE.OrthographicCamera(-70,70,70,-70,.1,1200);
    const canvas=document.createElement('canvas');canvas.width=2700;canvas.height=1990;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#080f18';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#e8dfca';ctx.font='bold 32px system-ui';ctx.fillText('ESPORTS CLASH / AVATAR DESIGN ROSTER',28,46);
    ctx.fillStyle='#8faebb';ctx.font='17px system-ui';ctx.fillText('45 avatar designs • ${useGlb?'imported GLBs; 34 use Blender-fitted Quaternius CC0 anatomy':'actual in-game geometry'} • 17 October 2026',28,76);
    const renderStats=[];
    for(let i=0;i<CHAMPIONS.length;i++){
      const kit=CHAMPIONS[i];
      if(${useGlb})await assets.request(kit.id);
      const model=${useGlb} ? assets.instantiate(kit.id) : buildAvatarModel(kit,resources);
      if(!model)throw Error('Missing GLB model '+kit.id);
      model.animate({animState:'idle'},.35);scene.add(model.body);
      const half=Math.max(61,model.height*.7);Object.assign(camera,{left:-half,right:half,top:half,bottom:-half});
      camera.position.set(110,110,190);camera.lookAt(0,model.height*.43,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
      const x=i%9*300,y=100+Math.floor(i/9)*378;
      ctx.drawImage(renderer.domElement,x+2,y,296,294);
      ctx.strokeStyle='#324957';ctx.strokeRect(x+2,y,296,366);
      ctx.fillStyle='#e7e4d8';ctx.font='bold 19px system-ui';ctx.fillText(kit.displayName,x+15,y+320);
      ctx.fillStyle='#88b7c7';ctx.font='14px system-ui';ctx.fillText(kit.primaryRole+' / '+kit.archetype,x+15,y+345,272);
      renderStats.push({id:kit.id,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});model.dispose();scene.remove(model.body);
    }
    assets.close();disposeArenaTerrainResources(scene);renderer.dispose();renderer.forceContextLoss();
    return {url:canvas.toDataURL('image/png'),renderStats};
  })()`);
  await writeFile(`../docs/${outputPrefix}-roster.png`,Buffer.from(sheet.url.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);
  await writeFile(`../docs/${outputPrefix}-verification.json`,JSON.stringify({date:'2026-10-17',covered,renderStats:sheet.renderStats,
    studio:{keyboardRotation:true,poses:true,animateReset:true,reducedMotionStartsStill:true,mobileOverflow:false,contextRecovery:true,unmount:true},errors,
    limits:'Controlled studio review; 34 shared artist anatomy sets, scout outfit retargeting, 11 earlier creature models. No physical-device performance claim.'},null,2)+'\n');
  console.log('All 45 real studio models, controls, mobile layout, context recovery, cleanup and model-sheet export passed.');
} finally {if(errors.length)console.error(errors);ws.close();}
