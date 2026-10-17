import {writeFile} from 'node:fs/promises';
const folder=process.env.MODEL_FOLDER??'avatars-v6',prefix=process.env.OUTPUT_PREFIX??'avatar-combat';
if(!/^[a-z0-9-]+$/.test(folder)||!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid asset/output path');
const port=process.env.CDP_PORT??'9238',vite=process.env.VITE_PORT??'5188';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
try{
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});await new Promise(done=>setTimeout(done,800));
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {AvatarModelResources,bindAvatarModel}=await import('/src/threeAvatarModels.ts');
  const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
  const {combatDuration}=await import('/src/avatarCombatMotion.ts');
  const {CHAMPIONS}=await import('/src/mockData.ts');
  const fixtures=[['c_invoker','Arsenaldo / caster'],['c_astra','Aiselle / archer'],['c_vi','Knuckleberry / fists'],['c_senna','Noctabelle / two-hand gun'],['c_monkeyking_dota','Monkey King / staff'],['c_earthshaker','Earthshaker / heavy totem']].map(([id,label])=>[id,CHAMPIONS.find(c=>c.id===id).displayName+' / '+label.split(' / ')[1]]);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(500,440,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-43,43,38,-38,1,600);camera.position.set(105,80,210);camera.lookAt(0,36,0);
  const rows=[];
  for(const [id,label] of fixtures){
   const file=await new GLTFLoader().loadAsync('/models/${folder}/'+id+'.glb');let root;file.scene.traverse(n=>{if(n.userData.avatarPart==='avatar-root')root=n;});
   const resources=new AvatarModelResources(),model=bindAvatarModel(root,resources),scene=new THREE.Scene();scene.background=new THREE.Color('#14232e');scene.add(resources.owner);
   const scale=new THREE.Group();scale.scale.setScalar(40);scale.add(file.scene);scene.add(scale);
   scene.add(new THREE.HemisphereLight('#d5eaff','#353448',2.2));const key=new THREE.DirectionalLight('#ffe5c7',3);key.position.set(-70,140,100);scene.add(key);
   const rim=new THREE.DirectionalLight('#83b7ed',1.3);rim.position.set(70,90,-100);scene.add(rim);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#24323b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.5;scene.add(floor);
   rows.push({id,label,scene,model});
  }
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=1080;const ctx=canvas.getContext('2d');
  const schedule=[['idle',1.3],['walk',.8],['attack',1.1],['cast',1.35],['hit',.42],['turnleft',.65],['run',.6],['strafe',1],['death',1.2]];
  function render(second){
   let start=0,previous='idle',previousDuration=0,state='idle',local=0;
   for(const [name,duration] of schedule){state=name;local=second-start;if(local<duration)break;start+=duration;previous=name;previousDuration=duration;}
   ctx.fillStyle='#09121c';ctx.fillRect(0,0,1500,1080);ctx.fillStyle='#e7dfcb';ctx.font='bold 30px system-ui';ctx.fillText('ROSTER COMBAT ANIMATION / ACTUAL SHIPPED GLBs',25,45);
   ctx.font='17px system-ui';ctx.fillStyle='#8eafbf';ctx.fillText('Palm contact / two-handed holds / foot placement / weighted attack recovery',25,78);
   for(let i=0;i<rows.length;i++){
    const row=rows[i],x=i%3*500,y=100+Math.floor(i/3)*480;
    row.model.animate({motionState:state,motionTime:local,previousMotion:previous,previousMotionTime:previousDuration+local,motionBlend:Math.min(1,local/.16)},second);
    renderer.render(row.scene,camera);ctx.drawImage(renderer.domElement,x,y);ctx.strokeStyle='#365163';ctx.strokeRect(x+1,y,498,475);
    ctx.fillStyle='#e7dfcb';ctx.font='bold 20px system-ui';ctx.fillText(row.label,x+15,y+440);
    ctx.fillStyle='#9bcabf';ctx.font='16px system-ui';ctx.fillText(state.toUpperCase(),x+15,y+465);
   }
  }
  render(2.43);const attackPNG=canvas.toDataURL('image/png');render(3.94);const castPNG=canvas.toDataURL('image/png');
  render(.8);const png=canvas.toDataURL('image/png');
  if(${process.argv.includes('--stills')}){
   rows.forEach(row=>disposeArenaTerrainResources(row.scene));renderer.dispose();renderer.forceContextLoss();return {png,attackPNG,castPNG,fixtures};
  }
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4500000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(done=>recorder.onstop=done);recorder.start();
  const duration=schedule.reduce((sum,entry)=>sum+entry[1],0);
  for(let frame=0;frame<Math.ceil(duration*24);frame++){render(frame/24);await new Promise(done=>setTimeout(done,1000/24));}
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
  const video=await new Promise(done=>{const reader=new FileReader();reader.onload=()=>done(reader.result);reader.readAsDataURL(new Blob(chunks,{type:mime}));});
  rows.forEach(row=>disposeArenaTerrainResources(row.scene));renderer.dispose();renderer.forceContextLoss();
  return {png,attackPNG,castPNG,video,mime,fixtures:fixtures.map(([id,label])=>({id,label})),schedule,duration};
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 const data=result.result.value;
 await writeFile('../docs/'+prefix+'-motion-sheet.png',Buffer.from(data.png.split(',')[1],'base64'));
  await writeFile('../docs/'+prefix+'-attack-sheet.png',Buffer.from(data.attackPNG.split(',')[1],'base64'));
  await writeFile('../docs/'+prefix+'-cast-sheet.png',Buffer.from(data.castPNG.split(',')[1],'base64'));
 if(!data.video)console.log('Rendered ready, attack-release and cast-release review sheets.');
 else{
 await writeFile('../docs/'+prefix+'-preview.webm',Buffer.from(data.video.split(',')[1],'base64'));
 delete data.png;delete data.attackPNG;delete data.castPNG;delete data.video;await writeFile('../docs/'+prefix+'-motion-fixtures.json',JSON.stringify(data,null,2)+'\n');
 console.log('Rendered six fighting styles through nine motion states and saved an actual WebGL motion video.');
 }
}finally{ws.close();}
