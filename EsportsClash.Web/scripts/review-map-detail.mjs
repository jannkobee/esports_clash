import {writeFile} from 'node:fs/promises';
const outputPrefix=process.env.OUTPUT_PREFIX??'map-detail';
if(!/^[a-z0-9-]+$/.test(outputPrefix))throw Error('Invalid output prefix');
const port=process.env.CDP_PORT??'9248',vite=process.env.VITE_PORT??'5198',phase=process.argv.includes('--before')?'before':'after';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const r=JSON.parse(e.data);
 if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.exception?.description??r.params.exceptionDetails.text);
 if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error'&&r.params.args.some(a=>/Shader Error|VALIDATE_STATUS|WebGLProgram/.test(a.value??'')))errors.push(r.params.args.map(a=>a.value??a.description).join(' '));
 if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
try{
 await send('Runtime.enable');
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});
 const result=await evaluate(`(async()=>{
  const {ThreeArenaTerrain}=await import('/src/threeArenaTerrain.ts');
  const {CHAMPIONS}=await import('/src/mockData.ts');const {CAMP_ROCK_RINGS}=await import('/src/arenaRules.ts');
  const layout=await import('/src/arenaLayout.ts');const {barracksPosition}=await import('/src/arenaLandform.ts');
  const host=document.createElement('div');host.style.cssText='width:1600px;height:960px;position:fixed;left:0;top:0';document.body.append(host);
  const terrain=new ThreeArenaTerrain(host,2600,760,610,1990,()=>{});
  const kits=['c_solana','c_invoker','c_astra','c_vi','c_hwei','c_kazemaru'].map(id=>CHAMPIONS.find(c=>c.id===id));
  for(const kit of kits)await terrain.arena.avatarAssets.request(kit.id,undefined,kit.id==='c_invoker'?'claude':'current');
  const champions=kits.map((champion,i)=>({id:'hero-'+i,champion,team:i<3?'blue':'red',x:1150+(i%3)*42+(i<3?0:160),y:360+(i%2)*37,isAlive:true,hp:1000,maxHp:1000,
   facing:i<3?'right':'left',animState:'idle',animTimer:.35,attackTimer:0,vx:0,vy:0,shield:0,stunTimer:0,charmTimer:0}));
  const structures=['blue','red'].flatMap(team=>[
   ...['NEXUS','NEXUS_TOWER','INNER_TOWER','OUTER_TOWER'].map(t=>({id:team+t,team,type:t.toLowerCase(),x:layout[t+'_X'][team],y:380,isAlive:true,hp:1000,maxHp:1000,range:200})),
   ...['melee','ranged','catapult'].map(kind=>({id:team+kind,team,type:'barracks',barracksKind:kind,...barracksPosition(team,kind),isAlive:true,hp:1000,maxHp:1000}))]);
  const camps=CAMP_ROCK_RINGS.filter(r=>r.id!=='dragon_boss').map(r=>({...r,isAlive:true,hp:1000,maxHp:1000,type:r.id==='j_siege_golem'?'siege_golem':r.id.includes('blue_buff')?'blue_buff':r.id.includes('red_buff')?'red_buff':r.id.split('_').at(-1),name:r.id}));
  const frame={champions,minions:[],structures,camps,dragon:{id:'dragon_boss',x:1300,y:130,isAlive:true,hp:1000,maxHp:1000,type:'dragon_boss',name:'Embermaw'},projectiles:[],spells:[],wards:[],second:12};
  const original=JSON.stringify(frame),views=[];
  for(const [name,x,y,zoom] of [['overview',1300,380,1],['river',1300,380,2.7],['blue-base',360,380,3],['dragon-pit',1300,150,3.3]]){
   terrain.renderArena(frame,x,y,zoom);const png=terrain.renderer.domElement.toDataURL('image/png');
   views.push({name,png,calls:terrain.renderer.info.render.calls,triangles:terrain.renderer.info.render.triangles});
  }
  if(original!==JSON.stringify(frame))throw Error('Map rendering mutated live inputs');
  let pauseAndRewind;
  if(terrain.arena.scenery){
   const empty={...frame,champions:[],structures:[],camps:[],dragon:{id:'dragon',isAlive:false},second:12};
   terrain.renderArena(empty,1300,180,3.1);const initial=terrain.renderer.domElement.toDataURL();
   terrain.renderArena(empty,1300,180,3.1);if(initial!==terrain.renderer.domElement.toDataURL())throw Error('Ambient scene moves while paused');
   terrain.renderArena({...empty,second:14},1300,180,3.1);
   if(initial===terrain.renderer.domElement.toDataURL())throw Error('Ambient scene fails to animate');
   terrain.renderArena(empty,1300,180,3.1);if(initial!==terrain.renderer.domElement.toDataURL())throw Error('Ambient scene fails to rewind exactly');
   pauseAndRewind=true;
  }
  let video;
  if(${process.argv.includes('--video')}){
   const canvas=terrain.renderer.domElement,stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:5000000}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(done=>recorder.onstop=done);recorder.start();
   for(let f=0;f<144;f++){frame.second=12+f/24;terrain.renderArena(frame,1300,f<72?180:570,3.1);await new Promise(done=>setTimeout(done,1000/24));}
   recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
   video=await new Promise(done=>{const r=new FileReader();r.onload=()=>done(r.result);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
  }
  const scenery=terrain.arena.scenery?.stats(),programs=terrain.renderer.info.programs.map(p=>({name:p.name,runnable:p.diagnostics?.runnable??true}));
  if(programs.some(p=>!p.runnable))throw Error('Map shader did not compile');
  const resources=terrain.dispose();host.remove();return {views,video,scenery,pauseAndRewind,programs,resources};
 })()`);
 for(const view of result.views){await writeFile('../docs/'+outputPrefix+'-'+phase+'-'+view.name+'.png',Buffer.from(view.png.split(',')[1],'base64'));delete view.png;}
 if(result.video){await writeFile('../docs/'+outputPrefix+'-preview.webm',Buffer.from(result.video.split(',')[1],'base64'));delete result.video;}
 if(errors.length)throw Error(errors.join('\n'));result.errors=errors;
 await writeFile('../docs/'+outputPrefix+'-'+phase+'-verification.json',JSON.stringify(result,null,2)+'\n');
 console.log('Rendered four actual map views ('+phase+'); saved geometry/particle/disposal metrics.');
}finally{ws.close();}
