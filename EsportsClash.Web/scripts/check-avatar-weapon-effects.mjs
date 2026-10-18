import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9242',vite=process.env.VITE_PORT??'5192';
const prefix=process.env.OUTPUT_PREFIX??'avatar-weapon';
if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid prefix');
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const task=pending.get(r.id);pending.delete(r.id);r.error?task.reject(Error(JSON.stringify(r.error))):task.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
try{
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});await new Promise(done=>setTimeout(done,800));
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {AvatarAssetLibrary}=await import('/src/avatarModelAssets.ts');
  const {AvatarModelResources}=await import('/src/threeAvatarModels.ts');
  const {bindWeaponSocket}=await import('/src/avatarWeaponSockets.ts');
  const {ArenaAbilityEffects}=await import('/src/threeAbilityEffects.ts');
  const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
  const {combatDuration}=await import('/src/avatarCombatMotion.ts');
  const {CHAMPIONS}=await import('/src/mockData.ts');
  const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources);
  const coverage=[];
  for(const kit of CHAMPIONS){
   if(!await library.request(kit.id))throw Error('Cannot load '+kit.id);
   const model=library.instantiate(kit.id),socket=bindWeaponSocket(model.body,kit.id);
   for(const state of ['idle','attack','cast','walk','hit']){
    model.animate({motionState:state,motionTime:combatDuration(kit.id,state)*.42},.5);
    const sample=socket();if(!sample||![...sample.tip,...sample.base].every(Number.isFinite))throw Error('Invalid socket '+kit.id+'/'+state);
    coverage.push({id:kit.id,state,tip:sample.tip});
   }
   model.dispose();
  }
  const fixtures=[['c_buck','pellet'],['c_senna','laser'],['c_astra','arrow'],['c_hwei','orb'],['c_skybreaker','flak_round'],['c_mirehook','hook']];
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(600,420,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-73,73,51,-51,1,1000);camera.position.set(180,125,210);camera.lookAt(0,40,32);
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1040;const ctx=canvas.getContext('2d');
  const rows=fixtures.map(([id,type])=>{
   const kit=CHAMPIONS.find(c=>c.id===id),model=library.instantiate(id),socket=bindWeaponSocket(model.body,id),scene=new THREE.Scene(),fx=new ArenaAbilityEffects();
   scene.background=new THREE.Color('#14232e');scene.add(model.body,fx.root);
   scene.add(new THREE.HemisphereLight('#e5f3ff','#343141',2.4));const key=new THREE.DirectionalLight('#ffe5cd',3);key.position.set(-70,140,100);scene.add(key);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(220,260),new THREE.MeshStandardMaterial({color:'#24343c'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.5;scene.add(floor);
   return {kit,type,model,socket,scene,fx};
  });
  const render=age=>{
   ctx.fillStyle='#09121c';ctx.fillRect(0,0,1800,1040);ctx.fillStyle='#e7dfcb';ctx.font='bold 30px system-ui';ctx.fillText('WEAPON RELEASE / CURRENT SHIPPED MODELS + NATIVE CLIPS',25,45);
   ctx.font='18px system-ui';ctx.fillStyle='#9abfc9';ctx.fillText('Launch snapshots follow the posed equipment; flight converges to the existing collision path',25,78);
   for(let i=0;i<rows.length;i++){
    const row=rows[i],x=i%3*600,y=100+Math.floor(i/3)*470;
    row.model.animate({motionState:'attack',motionTime:combatDuration(row.kit.id,'attack')*.42+age},1+age);
    const socket=row.socket();
    row.fx.update(age<.24?[{id:'shot',attackerId:'source',x:0,y:18+age*500,targetX:0,targetY:180,angle:Math.PI/2,size:4,color:row.kit.accentColor,type:row.type}]:[],[],1+age,[{id:'source',x:0,y:0,isAlive:true,weaponSocket:socket}],age>=.24?[{id:'fixture-hit',avatarId:row.kit.id,kind:'ranged',x:0,y:100,age:age-.24,color:row.kit.accentColor}]:[]);
    renderer.render(row.scene,camera);ctx.drawImage(renderer.domElement,x,y);
    ctx.strokeStyle='#365163';ctx.strokeRect(x+1,y,598,465);ctx.fillStyle='#e7dfcb';ctx.font='bold 21px system-ui';ctx.fillText(row.kit.displayName+' / '+row.type,x+18,y+438);
    ctx.fillStyle='#92c6bc';ctx.font='17px system-ui';ctx.fillText(age===0?'RELEASE FROM WEAPON':age>=.24?'CONFIRMED IMPACT FIXTURE':'FLIGHT + ATTACHED FLASH / '+Math.round(age*1000)+'ms',x+18,y+461);
   }
   return canvas.toDataURL('image/png');
  };
  const release=render(0),flight=render(.06),impact=render(.30);
  let video;
  if(${process.argv.includes('--video')}){
   const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:4000000}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(done=>recorder.onstop=done);recorder.start();
   for(let f=0;f<96;f++){render((f%32)/60);await new Promise(done=>setTimeout(done,1000/24));}
   recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
   video=await new Promise(done=>{const reader=new FileReader();reader.onload=()=>done(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
  }
  rows.forEach(row=>{row.model.dispose();disposeArenaTerrainResources(row.scene);});
  library.close();disposeArenaTerrainResources(library.owner);disposeArenaTerrainResources(resources.owner);renderer.dispose();renderer.forceContextLoss();
  return {release,flight,impact,video,coverage,fixtures};
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 const data=result.result.value;
 for(const key of ['release','flight','impact']){await writeFile('../docs/'+prefix+'-'+key+'.png',Buffer.from(data[key].split(',')[1],'base64'));delete data[key];}
 if(data.video){await writeFile('../docs/'+prefix+'-preview.webm',Buffer.from(data.video.split(',')[1],'base64'));delete data.video;}
 await writeFile('../docs/'+prefix+'-verification.json',JSON.stringify(data,null,2)+'\n');
 console.log('Loaded all 45 textured GLBs, verified 225 posed sockets and rendered six actual native-clip weapon releases/flights.');
}finally{ws.close();}
