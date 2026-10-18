import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9246',vite=process.env.VITE_PORT??'5196';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
const wait=async expression=>{for(let n=0;n<300;n++){if(await evaluate(expression))return;await delay(100);}throw Error('Timeout: '+expression);};
try{
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});await wait('!!document.querySelector("nav button")');
 const result=await evaluate(`(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {AvatarAssetLibrary}=await import('/src/avatarModelAssets.ts');const {AvatarModelResources}=await import('/src/threeAvatarModels.ts');
  const {bindWeaponSocket}=await import('/src/avatarWeaponSockets.ts');const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
  const {ArenaScene}=await import('/src/threeArenaScene.ts');const {CHAMPIONS}=await import('/src/mockData.ts');
  const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources);
  for(const variant of ['current','claude'])if(!await library.request('c_invoker',undefined,variant))throw Error('Load failed '+variant);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(600,430,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-60,60,43,-43,.1,1000);camera.position.set(130,90,190);camera.lookAt(0,37,0);
  const rows=['current','claude'].map(variant=>{
   const model=library.instantiate('c_invoker',variant),scene=new THREE.Scene();scene.background=new THREE.Color('#15252f');scene.add(model.body);
   scene.add(new THREE.HemisphereLight('#e6f3ff','#282435',2.3));const sun=new THREE.DirectionalLight('#ffe5ca',3);sun.position.set(-50,120,90);scene.add(sun);
   const floor=new THREE.Mesh(new THREE.CircleGeometry(46,48),new THREE.MeshStandardMaterial({color:'#30424a'}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;scene.add(floor);
   return {variant,model,scene,socket:bindWeaponSocket(model.body,'c_invoker')};
  });
  const coverage=[];
  for(const row of rows)for(const state of ['idle','walk','run','strafe','attack','cast','hit','death','turnleft','turnright'])for(const phase of [.1,.42,.8]){
   const duration=library.files.get(row.variant==='claude'?'c_invoker:claude':'c_invoker').animations.find(c=>c.name.toLowerCase()===state).duration;
   const pose=Object.freeze({motionState:state,motionTime:phase*duration});row.model.animate(pose,phase*duration);
   const snapshot=[];row.model.body.traverse(n=>{if(n.isBone||n.userData.avatarPart)snapshot.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray());});
   for(let n=0;n<30;n++)row.model.animate(pose,phase*duration);
   const after=[];row.model.body.traverse(n=>{if(n.isBone||n.userData.avatarPart)after.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray());});
   if(after.some((v,i)=>!Number.isFinite(v)||Math.abs(v-snapshot[i])>1e-7))throw Error('Paused pose drift '+row.variant+' '+state);
   const tip=row.socket()?.tip;if(!tip?.every(Number.isFinite))throw Error('Invalid posed socket '+state);
   coverage.push({variant:row.variant,state,phase,tip});
  }
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1370;const ctx=canvas.getContext('2d');
  const render=(second,states=['idle','attack','cast'])=>{
   ctx.fillStyle='#091721';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e8e3ce';ctx.font='bold 24px system-ui';ctx.fillText('ARSENALDO / CURRENT ORIGINAL vs CLAUDE ANIMATION',20,32);
   ctx.font='16px system-ui';ctx.fillStyle='#a3c1cd';ctx.fillText('Same model and textures. Right: submitted native clips, with runtime motion overlays bypassed.',20,60);
   for(let r=0;r<3;r++)for(let c=0;c<2;c++){
    const row=rows[c],state=states[r],x=c*600,y=80+r*430;
    row.model.animate({motionState:state,motionTime:second},second);renderer.render(row.scene,camera);ctx.drawImage(renderer.domElement,x,y);
    ctx.fillStyle='#0c1822';ctx.fillRect(x,y+397,600,33);ctx.fillStyle=c?'#b5e9e5':'#d8cbaf';ctx.font='bold 18px system-ui';ctx.fillText((c?'CLAUDE':'CURRENT ORIGINAL')+' / '+state,x+16,y+420);
   }
   return canvas.toDataURL('image/png');
  };
  const comparison=render(.35),reactions=render(.5,['walk','hit','death']);
  let video;
  if(${process.argv.includes('--video')}){
   const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:4000000}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(done=>recorder.onstop=done);recorder.start();
   for(let f=0;f<144;f++){render(f/24,['idle','walk',f<72?'attack':'cast']);await new Promise(done=>setTimeout(done,1000/24));}
   recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
   video=await new Promise(done=>{const reader=new FileReader();reader.onload=()=>done(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
  }
  // Verify that the actual arena selects this same imported file and exposes posed sockets.
  localStorage.setItem('esports-clash-arsenaldo-model','claude');
  const arena=new ArenaScene(new THREE.Mesh(new THREE.PlaneGeometry(2600,760),new THREE.ShaderMaterial()),2600,760);
  await arena.avatarAssets.request('c_invoker',undefined,'claude');
  const champion=CHAMPIONS.find(c=>c.id==='c_invoker'),unit=Object.freeze({id:'arsenaldo',champion,team:'blue',x:1200,y:380,isAlive:true,hp:1000,
   facing:'right',animState:'attack',animTimer:.35,attackTimer:1,vx:0,vy:0,shield:0,stunTimer:0,charmTimer:0,kaelenOrbs:Object.freeze(['fire','fire','fire'])});
  const frame=Object.freeze({champions:Object.freeze([unit]),second:1,minions:[],structures:[],camps:[],wards:[],spells:[],projectiles:[],dragon:{id:'dragon',isAlive:false}}),before=JSON.stringify(frame);
  arena.update(frame);const actor=arena.actors.get(unit.id),arenaVariant=actor.body.userData.modelVariant;
  if(arenaVariant!=='claude'||!actor.weaponSocket()?.tip.every(Number.isFinite)||before!==JSON.stringify(frame))throw Error('Arena import integration failed');
  const colors=[];actor.body.traverse(n=>{if(n.userData.avatarPart?.startsWith('element-orb:'))n.traverse(child=>{if(child.isMesh)colors.push(child.material.color.getHexString());});});
  if(new Set(colors).size!==1)throw Error('Live spell-orb colors lost');
  arena.close();disposeArenaTerrainResources(arena.scene);rows.forEach(row=>{row.model.dispose();disposeArenaTerrainResources(row.scene);});
  library.close();disposeArenaTerrainResources(library.owner);disposeArenaTerrainResources(resources.owner);renderer.dispose();renderer.forceContextLoss();
  return {comparison,reactions,video,coverage,arenaVariant,liveOrbColors:colors};
 })()`);
 for(const key of ['comparison','reactions']){await writeFile('../docs/arsenaldo-claude-'+key+'.png',Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
 if(result.video){await writeFile('../docs/arsenaldo-claude-preview.webm',Buffer.from(result.video.split(',')[1],'base64'));delete result.video;}
 await evaluate(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Avatars & Lore')).click()`);await wait('!!document.querySelector(".avatar-model-preview")');
 await evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes('Arsenaldo')).click()`);
 await wait(`document.querySelector('.avatar-model-preview__canvas').dataset.modelVariant==='claude'`);
 const selectVariant=async variant=>{
  await evaluate(`(()=>{const e=document.querySelector('select[aria-label="Arsenaldo model version"]');e.value=${JSON.stringify(variant)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('.avatar-model-preview__canvas').dataset.modelVariant===${JSON.stringify(variant)}`);
  assert.equal(await evaluate(`localStorage.getItem('esports-clash-arsenaldo-model')`),variant);
 };
 await selectVariant('current');await selectVariant('claude');
 const poses=await evaluate(`[...document.querySelector('select[aria-label="Avatar pose"]').options].map(o=>o.value)`);assert.equal(poses.length,10);
 for(const pose of poses){await evaluate(`(()=>{const e=document.querySelector('select[aria-label="Avatar pose"]');e.value=${JSON.stringify(pose)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(30);}
 await evaluate(`[...document.querySelectorAll('.avatar-model-preview button')].find(b=>b.textContent==='Reset view').click();document.querySelector('.avatar-model-preview').scrollIntoView({block:'center'})`);await delay(100);
 assert.match(await evaluate(`document.querySelector('.avatar-model-preview a[download]').href`),/imports\/arsenaldo-claude/);
 const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile('../docs/arsenaldo-claude-studio.png',Buffer.from(screenshot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(150);
 assert.ok(await evaluate(`(()=>{const e=document.querySelector('.avatar-model-preview');return e.scrollWidth<=e.clientWidth;})()`),'Studio overflows mobile width');
 result.studio={variants:['current','claude'],poses,mobileFits:true,downloadIsSubmittedFile:true};
 await writeFile('../docs/arsenaldo-claude-verification.json',JSON.stringify(result,null,2)+'\n');
 console.log('Both textured models, all ten clips, paused poses, actual arena selection/sockets/orb colors, studio version/pose controls and mobile layout pass.');
}finally{ws.close();}
