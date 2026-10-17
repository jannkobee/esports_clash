import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9240',vite=process.env.VITE_PORT??'5190',prefix=process.env.OUTPUT_PREFIX??'avatar-mesh';
if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid prefix');
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
  const {CHAMPIONS}=await import('/src/mockData.ts');
  const ids=['c_astra','c_vi','c_senna','c_earthshaker','c_puck','c_voltgrip'];
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(500,460,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1740;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#0a121b';ctx.fillRect(0,0,2000,1740);ctx.fillStyle='#e9e0cd';ctx.font='bold 32px system-ui';ctx.fillText('ACTUAL GAME MODELS / v7 BEFORE — v8 REFINED',24,44);
  ctx.font='18px system-ui';ctx.fillStyle='#92aebe';ctx.fillText('Same camera, lighting and pose time. Geometry and fitted clothing changes; existing rigs retained.',24,79);
  const rows=[];
  for(let i=0;i<ids.length;i++){
   const id=ids[i],kit=CHAMPIONS.find(c=>c.id===id),pairX=i%2*1000,pairY=100+Math.floor(i/2)*540;
   for(const [column,version] of [7,8].entries()){
    const file=await new GLTFLoader().loadAsync('/models/avatars-v'+version+'/'+id+'.glb');let root;file.scene.traverse(n=>{if(n.userData.avatarPart==='avatar-root')root=n;});
    const resources=new AvatarModelResources(),model=bindAvatarModel(root,resources),scene=new THREE.Scene();scene.background=new THREE.Color('#15232e');scene.add(resources.owner);
    const scale=new THREE.Group();scale.scale.setScalar(40);scale.add(file.scene);scene.add(scale);
    scene.add(new THREE.HemisphereLight('#d5eaff','#353448',2.2));const key=new THREE.DirectionalLight('#ffe5c7',3);key.position.set(-70,140,100);scene.add(key);
    const rim=new THREE.DirectionalLight('#83b7ed',1.3);rim.position.set(70,90,-100);scene.add(rim);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#24323b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.5;scene.add(floor);
    const camera=new THREE.OrthographicCamera(-49,49,45,-45,1,600);camera.position.set(105,80,210);camera.lookAt(0,36,0);
    model.animate({motionState:'idle',motionTime:.35},.35);renderer.render(scene,camera);
    const x=pairX+column*500;ctx.drawImage(renderer.domElement,x,pairY);ctx.strokeStyle='#3a5362';ctx.strokeRect(x+1,pairY,498,529);
    ctx.fillStyle='#e9e0cd';ctx.font='bold 20px system-ui';ctx.fillText(kit.displayName,x+18,pairY+488);
    ctx.fillStyle=version===8?'#a6d6bd':'#91aabb';ctx.font='18px system-ui';ctx.fillText(version===8?'v8 / REFINED':'v7 / BEFORE',x+18,pairY+516);
    rows.push({id,version,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});model.dispose();disposeArenaTerrainResources(scene);
   }
  }
  renderer.dispose();renderer.forceContextLoss();return {png:canvas.toDataURL('image/png'),rows};
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 const data=result.result.value;await writeFile(`../docs/${prefix}-comparison.png`,Buffer.from(data.png.split(',')[1],'base64'));
 await writeFile(`../docs/${prefix}-comparison.json`,JSON.stringify({date:'2026-10-17',rows:data.rows,scope:'Six exact shipped GLB pairs under matching camera/light/idle pose; runtime v8 includes all 45.'},null,2)+'\n');
 console.log('Rendered six actual v7/v8 model comparisons.');
}finally{ws.close();}
