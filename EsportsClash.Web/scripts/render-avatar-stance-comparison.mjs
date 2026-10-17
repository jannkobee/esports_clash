import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9237',vite=process.env.VITE_PORT??'5187';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
try{
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});await new Promise(done=>setTimeout(done,700));
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
  const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1000;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#0c141e';ctx.fillRect(0,0,2000,1000);ctx.fillStyle='#e7dfcb';ctx.font='bold 36px system-ui';ctx.fillText('STANDING POSE / BEFORE AND AFTER',30,52);
  ctx.fillStyle='#9bb2c1';ctx.font='19px system-ui';ctx.fillText('Actual downloaded GLBs playing their native Idle clips / identical camera and lighting',30,86);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(500,760,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  let panel=0;
  for(const [id,name] of [['c_astra','Aiselle'],['c_invoker','Arsenaldo']])for(const version of [4,5]){
   const file=await new GLTFLoader().loadAsync('/models/avatars-v'+version+'/'+id+'.glb'),scene=new THREE.Scene();scene.background=new THREE.Color('#17232d');
   const actor=new THREE.Group();actor.scale.setScalar(40);actor.add(file.scene);scene.add(actor);
   const mixer=new THREE.AnimationMixer(file.scene);mixer.clipAction(file.animations.find(c=>c.name==='Idle')).play();mixer.setTime(.35);
   scene.add(new THREE.HemisphereLight('#d3e6f2','#45404b',2));
   const key=new THREE.DirectionalLight('#ffe5c7',3);key.position.set(-70,140,100);scene.add(key);
   const rim=new THREE.DirectionalLight('#88beef',1.5);rim.position.set(70,90,-100);scene.add(rim);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshStandardMaterial({color:'#24323b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.5;scene.add(floor);
   const camera=new THREE.OrthographicCamera(-34,34,52,-52,1,600);camera.position.set(220,76,0);camera.lookAt(0,35,0);renderer.render(scene,camera);
   ctx.drawImage(renderer.domElement,panel*500,120);ctx.strokeStyle='#384b59';ctx.strokeRect(panel*500+1,120,498,760);
   ctx.fillStyle=version===5?'#a8dbbf':'#b3c2cf';ctx.font='bold 23px system-ui';ctx.fillText(name.toUpperCase()+' / '+(version===4?'BEFORE':'AFTER'),panel*500+20,920);
   mixer.stopAllAction();mixer.uncacheRoot(file.scene);disposeArenaTerrainResources(scene);panel++;
  }
  ctx.fillStyle='#9bb2c1';ctx.font='19px system-ui';ctx.fillText('Lumbar curve / shifted hips / softened knees / relaxed shoulders and wrists / feet remain planted',30,971);
  renderer.dispose();renderer.forceContextLoss();return canvas.toDataURL('image/png');
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 await writeFile('../docs/avatar-stance-comparison.png',Buffer.from(result.result.value.split(',')[1],'base64'));
 console.log('Rendered native-clip posture comparison.');
}finally{ws.close();}
