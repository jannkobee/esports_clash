import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9228',vite=process.env.VITE_PORT??'5178';
const prefix=process.env.OUTPUT_PREFIX??'avatar-models',selected=process.env.MODEL_PLATE_IDS?.split(',');
const folder=process.env.MODEL_FOLDER??'avatars-v2';
const authored=['avatars-v4','avatars-v5','avatars-v6','avatars-v7','avatars-v8'].includes(folder);
if(!/^[a-z0-9-]+$/.test(folder))throw Error('Invalid model folder');
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
try{
  await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});
  await new Promise(done=>setTimeout(done,400));
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  for(const [id,label]of [['c_invoker','Arsenaldo'],['c_kyumi','Vixelle'],['c_skybreaker','Propella'],['c_astra','Aiselle'],['c_vi','Knuckleberry'],['c_kage','Vanta'],['c_tequoia','Fernanda'],['c_senna','Sennova'],['c_monkeyking_dota','PrimateMinister'],['c_earthshaker','Quakewell']]){
    if(selected&&!selected.includes(id))continue;
    if(!selected&&!['c_invoker','c_kyumi','c_skybreaker'].includes(id))continue;
    const data=await evaluate(`(async()=>{
      const THREE=await import('/node_modules/.vite/deps/three.js');
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const {AvatarModelResources,bindAvatarModel}=await import('/src/threeAvatarModels.ts');
      const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
      const file=await new GLTFLoader().loadAsync('/models/${folder}/${id}.glb');let inner;
      file.scene.traverse(node=>{if(node.userData.avatarPart==='avatar-root')inner=node;});
      const resources=new AvatarModelResources(),model=bindAvatarModel(inner,resources);model.animate({animState:'idle'},.35);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#17232d');scene.add(resources.owner);
      const object=new THREE.Group();object.scale.setScalar(40);object.add(file.scene);scene.add(object);
      object.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=false;node.frustumCulled=false;}});
      scene.add(new THREE.HemisphereLight('#d3e6f2','#45404b',2));
      const key=new THREE.DirectionalLight('#ffe5c7',3);key.position.set(-70,140,100);key.castShadow=true;
      Object.assign(key.shadow.camera,{left:-90,right:90,top:110,bottom:-70,near:1,far:400});key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.1;scene.add(key);
      const rim=new THREE.DirectionalLight('#88beef',1.5);rim.position.set(70,90,-100);scene.add(rim);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshStandardMaterial({color:'#24323b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.5;floor.receiveShadow=true;scene.add(floor);
      const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(500,760,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const half=Math.max(51,model.height*.57),camera=new THREE.OrthographicCamera(-half*500/760,half*500/760,half,-half,1,600);
      const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1000;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#0c141e';ctx.fillRect(0,0,2000,1000);ctx.fillStyle='#e7dfcb';ctx.font='bold 40px system-ui';ctx.fillText('${label.toUpperCase()} / MODEL TURNAROUND',30,58);
      ctx.fillStyle='#8da8ba';ctx.font='19px system-ui';ctx.fillText('${authored ? 'Blender-fitted Quaternius CC0 anatomy • textured PBR surfaces • original costume and equipment' : 'GLB mesh • UV surfaces • joint skinning • PBR color materials • meter-scale asset'}',30,91);
      const angles=[0,Math.PI/2,Math.PI,.55],labels=['FRONT','PROFILE','BACK','TOPOLOGY + RIG'];
      const wire=[];
      for(let i=0;i<4;i++){
        if(i===3){object.traverse(node=>{if(node instanceof THREE.Mesh){const original=node.material;
          node.material=(Array.isArray(original)?original:[original]).map(material=>{const next=material.clone();next.wireframe=true;next.color.set('#9bbbc9');next.emissive?.set('#000000');wire.push(next);return next;});if(!Array.isArray(original))node.material=node.material[0];}});
          const skeleton=new THREE.SkeletonHelper(object);scene.add(skeleton);}
        camera.position.set(Math.sin(angles[i])*220,87,Math.cos(angles[i])*220);camera.lookAt(0,model.height*.43,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
        ctx.drawImage(renderer.domElement,i*500,120);ctx.strokeStyle='#384b59';ctx.strokeRect(i*500+1,120,498,760);
        ctx.fillStyle='#c3d7df';ctx.font='bold 19px system-ui';ctx.fillText(labels[i],i*500+20,915);
      }
      ctx.fillStyle='#829eaf';ctx.font='18px system-ui';ctx.fillText('${folder==='avatars-v8' ? 'Refined equipment / connected sleeve sockets / individual proportions / carved and layered surfaces.' : folder==='avatars-v7' ? 'Palm contact and two-handed holds / grounded stride / finger grip shapes / ten native clips.' : folder==='avatars-v6' ? 'Combat-ready silhouette / staggered planted feet / weapon-specific guard / ten native clips.' : folder==='avatars-v5' ? 'Arched spine, shifted hips, relaxed knees and shoulders. Idle / Walk / Attack / Cast clips updated.' : authored ? 'Idle / Walk / Attack / Cast clips preserved. Shared anatomy and scout clothing; bespoke sculpting and animation polish remain.' : 'Idle / Walk / Attack / Cast clips included. Surface modeling pass; texture painting and final animation polish remain.'}',30,965);
      wire.forEach(m=>m.dispose());disposeArenaTerrainResources(scene);renderer.dispose();renderer.forceContextLoss();return canvas.toDataURL('image/png');
    })()`);
    await writeFile(`../docs/${prefix}-${label.toLowerCase()}-turnaround.png`,Buffer.from(data.split(',')[1],'base64'));
  }
  console.log('GLB front/profile/back/topology plates rendered.');
}finally{ws.close();}
