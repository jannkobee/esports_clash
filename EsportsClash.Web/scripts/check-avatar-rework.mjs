// Actual ArenaScene / shipped GLBs: targeted contact and Voltaire review, not a balance benchmark.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9244',vite=process.env.VITE_PORT??'5194';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
const wait=async expression=>{for(let n=0;n<300;n++){if(await evaluate(expression))return;await delay(100);}throw Error('Timeout: '+expression);};
try{
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});await wait('!!document.querySelector("nav button")');
 const result=await evaluate(`(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {ArenaScene}=await import('/src/threeArenaScene.ts');
  const {CHAMPIONS}=await import('/src/mockData.ts');
  const {getChampionBasicAttackRange}=await import('/src/basicAttackRangeRules.ts');
  const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2600,760),new THREE.MeshStandardMaterial({color:'#263b37'}));
  const arena=new ArenaScene(ground,2600,760),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(600,420,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-105,105,73.5,-73.5,1,2000);camera.position.set(1460,140,560);camera.lookAt(1310,30,380);
  const sheet=()=>{const c=document.createElement('canvas');c.width=1800;c.height=1020;return c;};
  const meleeSheet=sheet(),formSheet=sheet();
  const unit=(kit,id,x,y,extra={})=>({id,champion:kit,team:id==='source'?'blue':'red',x,y,vx:0,vy:0,isAlive:true,hp:1000,maxHp:1000,
   animState:'idle',animTimer:0,attackTimer:1,facing:'right',shield:0,stunTimer:0,charmTimer:0,items:[],...extra});
  const frame=(champions,second=1,spells=[])=>({champions,second,spells,minions:[],structures:[],camps:[],wards:[],projectiles:[],dragon:{id:'dragon',x:0,y:0,isAlive:false,hp:0,maxHp:1,name:'Dragon'}});
  const frozen=obj=>{if(obj&&typeof obj==='object'){Object.values(obj).forEach(frozen);Object.freeze(obj);}return obj;};
  const kits=CHAMPIONS.filter(c=>getChampionBasicAttackRange(c)<90),voltaire=CHAMPIONS.find(c=>c.id==='c_raijin'),targetKit=CHAMPIONS.find(c=>c.id==='c_solana');
  for(const kit of [...kits,voltaire,targetKit])if(!await arena.avatarAssets.request(kit.id))throw Error('GLB load failed '+kit.id);
  const coverage=[],samples=['c_solana','c_kazemaru','c_earthshaker','c_kaolin','c_vi','c_bristleback'];
  const draw=(canvas,index,title,note)=>{const ctx=canvas.getContext('2d'),x=index%3*600,y=90+Math.floor(index/3)*460;
   renderer.render(arena.scene,camera);ctx.drawImage(renderer.domElement,x,y);ctx.strokeStyle='#426068';ctx.strokeRect(x,y,599,459);
   ctx.fillStyle='#e2eff1';ctx.font='bold 20px system-ui';ctx.fillText(title,x+14,y+435);ctx.fillStyle='#a6cbd2';ctx.font='15px system-ui';ctx.fillText(note,x+14,y+455);};
  for(const canvas of [meleeSheet,formSheet]){const ctx=canvas.getContext('2d');ctx.fillStyle='#10212b';ctx.fillRect(0,0,1800,1020);ctx.fillStyle='#e2eff1';ctx.font='bold 28px system-ui';ctx.fillText(canvas===meleeSheet?'ACTUAL TARGET CONTACT / LOADED MODELS':'VOLTAIRE / IDENTITY-PRESERVING ABILITY REWORK',20,40);ctx.font='17px system-ui';ctx.fillText('Controlled ArenaScene fixtures using current GLBs and native clips; gameplay balance is not measured here.',20,70);}
  for(const kit of kits){
   const range=getChampionBasicAttackRange(kit),target=unit(targetKit,'target',1280+range,380);
   const source=unit(kit,'source',1280,380,{animState:'attack',basicAttackVisual:{targetId:'target',x:target.x,y:target.y,releasedAt:1,melee:true}});
   const input=frozen(frame([source,target])),before=JSON.stringify(input);arena.update(input);
   const actor=arena.actors.get('source'),tip=actor.weaponSocket().tip,error=Math.hypot(tip[0]-(target.x-16),tip[2]-target.y);
   if(error>1e-4||tip[1]<12||tip[1]>50)throw Error('Contact miss '+kit.id+' '+error+' height '+tip[1]);
   const paused=[...tip];for(let n=0;n<20;n++)arena.update(input);
   if(actor.weaponSocket().tip.some((v,i)=>Math.abs(v-paused[i])>1e-7))throw Error('Paused contact drifts '+kit.id);
   if(JSON.stringify(input)!==before)throw Error('Scene mutates gameplay '+kit.id);
   coverage.push({id:kit.id,alias:kit.displayName,range,horizontalError:error,height:tip[1],lunge:Math.hypot(actor.body.position.x,actor.body.position.z)});
   const index=samples.indexOf(kit.id);if(index>=0)draw(meleeSheet,index,kit.displayName+' / release at max range','Tip meets target surface; no damage/range changes');
   arena.update(frame([unit(kit,'source',1280,380),target],2));
   if(Math.hypot(actor.body.position.x,actor.body.position.z)>1e-8)throw Error('Lunge does not reset '+kit.id);
  }
  const formChecks=[];
  const states=[['Overload / charged right hand','passive'],['Static Remnant / armed electrical double','q'],['Electric Vortex / tether and coils','w'],['Ball Lightning / travelling form','r'],['Arrival / reforms at actual position','arrival'],['Interrupted / human form restored','interrupted']];
  for(let i=0;i<states.length;i++){
   const [title,state]=states[i],source=unit(voltaire,'source',1270,380,{animState:'cast',voltaireOverloadTimer:state==='passive'?6:0});
   if(state==='r'){source.x=1320;source.animState='walk';source.dash={kind:'raijin_bolt',startX:1270,startY:380,targetX:1400,targetY:380,remaining:.4};}
   const target=unit(targetKit,'target',1370,380),type={q:'static_remnant',w:'electric_vortex',arrival:'voltaire_arrival'}[state];
   const spell=type?{id:'fixture-'+i,type,x:state==='q'?1210:state==='w'?1370:1270,y:380,radius:state==='q'?65:state==='w'?18:55,duration:state==='q'?3.55:state==='w'?1:.2,maxDuration:state==='q'?4:state==='w'?1.4:.3,color:'#83efff',sourceX:1270,sourceY:380,sourceUnitId:'source',targetUnitId:state==='w'?'target':undefined,avatarName:'Raijin',abilitySlot:state==='q'?'skill1':state==='w'?'skill2':'ultimate'}:undefined;
   // In-flight legacy spell must not render a burst at its future destination.
   const future=state==='r'?[{id:'future',type:'ball_lightning',x:1490,y:380,radius:55,duration:.8,maxDuration:1,color:'#83efff',sourceUnitId:'source'}]:[];
   const input=frozen(frame([source,target],3+i,spell?[spell]:future)),before=JSON.stringify(input);arena.update(input);
   const actor=arena.actors.get('source'),ball=actor.body.getObjectByName('voltaire-ball-lightning'),outfit=actor.body.getObjectByName('outfit');
   if(!ball||ball.visible!==(state==='r')||outfit.visible===(state==='r'))throw Error('Loaded form mismatch '+state);
   if(JSON.stringify(input)!==before)throw Error('Form mutates gameplay '+state);
   formChecks.push({state,ballVisible:ball.visible,outfitVisible:outfit.visible});draw(formSheet,i,title,state==='r'?'Actor itself transforms; no early destination burst':'Explicit state / real clip and effect geometry');
  }
  const melee=meleeSheet.toDataURL(),forms=formSheet.toDataURL();arena.close();disposeArenaTerrainResources(arena.scene);renderer.dispose();renderer.forceContextLoss();
  return {melee,forms,coverage,formChecks};
 })()`);
 for(const key of ['melee','forms']){await writeFile('../docs/avatar-rework-'+key+'.png',Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
 // Exercise the real studio controls and descriptive UI as well as fixture rendering.
 await evaluate(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Avatars & Lore')).click()`);await wait('!!document.querySelector(".avatar-model-preview")');
 await evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes('Voltaire')).click()`);
 await wait(`document.querySelector('.avatar-model-preview__canvas').dataset.designId==='c_raijin'&&document.querySelector('.avatar-model-preview__canvas').dataset.modelFormat==='glb'`);
 const previews=[];
 for(const [label,pose] of [['PASSIVE','ability-passive'],['SKILL 1 (Q)','ability-q'],['SKILL 2 (W)','ability-w'],['ULTIMATE (R)','ability-r']]){
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.firstElementChild?.textContent===${JSON.stringify(label)}).click()`);await delay(100);
  await evaluate(`[...document.querySelectorAll('.avatar-model-preview button')].find(b=>b.textContent.startsWith('Preview ')).click()`);await delay(150);
  const value=await evaluate(`document.querySelector('select[aria-label="Avatar pose"]').value`);assert.equal(value,pose);previews.push(pose);
 }
 await evaluate(`document.querySelector('.avatar-model-preview button[aria-pressed="true"]').click();document.querySelector('.avatar-model-preview').scrollIntoView({block:'center'})`);await delay(150);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('../docs/avatar-rework-studio.png',Buffer.from(shot.data,'base64'));
 assert.ok(await evaluate(`document.body.textContent.includes('What you see')&&document.body.textContent.includes('Play around it')`));
 await evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes('Arsenaldo')).click()`);await delay(150);
 assert.equal(await evaluate(`document.querySelector('select[aria-label="Avatar pose"]').value`),'idle');
 result.studioPreviews=previews;result.switchToOtherAvatar='idle';
 await writeFile('../docs/avatar-rework-verification.json',JSON.stringify(result,null,2)+'\n');
 console.log('All 20 loaded melee avatars contact real target surfaces without paused drift; Voltaire form transitions and four studio controls pass.');
}finally{ws.close();}
