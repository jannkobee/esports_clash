import {writeFile} from 'node:fs/promises';
const prefix=process.env.OUTPUT_PREFIX??'avatar-polish-before',port=process.env.CDP_PORT??'9243',vite=process.env.VITE_PORT??'5193';
if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid prefix');
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const task=pending.get(r.id);pending.delete(r.id);r.error?task.reject(Error(JSON.stringify(r.error))):task.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
try{
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});await new Promise(done=>setTimeout(done,700));
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
 const THREE=await import('/node_modules/.vite/deps/three.js');
 const {AvatarAssetLibrary}=await import('/src/avatarModelAssets.ts');
 const {AvatarModelResources}=await import('/src/threeAvatarModels.ts');
 const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
 const {combatDuration}=await import('/src/avatarCombatMotion.ts');
 const {CHAMPIONS}=await import('/src/mockData.ts');
 const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(420,430,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const camera=new THREE.OrthographicCamera(-59,59,60,-60,1,1000);camera.position.set(130,90,240);camera.lookAt(0,43,0);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#172833');scene.add(new THREE.HemisphereLight('#e5f3ff','#353144',2.4));
 const light=new THREE.DirectionalLight('#ffe6c9',3);light.position.set(-70,140,100);scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(250,250),new THREE.MeshStandardMaterial({color:'#263b40'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.5;scene.add(floor);
 const pages=[],coverage=[];
 for(const state of ['idle','attack'])for(let page=0;page<3;page++){
  const canvas=document.createElement('canvas');canvas.width=2100;canvas.height=1500;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#09141c';ctx.fillRect(0,0,2100,1500);ctx.fillStyle='#eae4d6';ctx.font='bold 28px system-ui';ctx.fillText('FULL ROSTER / '+state.toUpperCase()+' / '+(page+1)+' OF 3',20,40);
  for(let i=0;i<15;i++){
   const kit=CHAMPIONS[page*15+i];if(!await library.request(kit.id))throw Error('Load '+kit.id);
   const model=library.instantiate(kit.id),time=state==='attack'?combatDuration(kit.id,state)*.42:.35;
   model.animate({motionState:state,motionTime:time},time);scene.add(model.body);renderer.render(scene,camera);
   const x=i%5*420,y=60+Math.floor(i/5)*475;ctx.drawImage(renderer.domElement,x,y);ctx.fillStyle='#eae4d6';ctx.font='bold 20px system-ui';ctx.fillText(kit.displayName,x+12,y+451);
   ctx.strokeStyle='#3c5962';ctx.strokeRect(x+1,y,418,470);
   coverage.push({id:kit.id,state});scene.remove(model.body);model.dispose();
  }
  pages.push({name:state+'-'+(page+1),png:canvas.toDataURL('image/png')});
 }
 library.close();disposeArenaTerrainResources(library.owner);disposeArenaTerrainResources(resources.owner);disposeArenaTerrainResources(scene);renderer.dispose();renderer.forceContextLoss();return {pages,coverage};
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 const data=result.result.value;
 for(const page of data.pages)await writeFile('../docs/'+prefix+'-'+page.name+'.png',Buffer.from(page.png.split(',')[1],'base64'));
 await writeFile('../docs/'+prefix+'-review.json',JSON.stringify({coverage:data.coverage,sheets:data.pages.map(p=>prefix+'-'+p.name+'.png')},null,2)+'\n');
 console.log('Rendered all 45 loaded models in guard and attack poses across six close-up sheets.');
}finally{ws.close();}
