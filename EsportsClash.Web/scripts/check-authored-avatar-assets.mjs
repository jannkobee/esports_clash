// Decode the actual PNG maps and exercise native skinning in a real browser.
import {writeFile} from 'node:fs/promises';
const port=process.env.CDP_PORT??'9236',vite=process.env.VITE_PORT??'5186';
const folder=process.env.MODEL_FOLDER??'avatars-v4',prefix=process.env.OUTPUT_PREFIX??'avatar-anatomy';
if(!/^[a-z0-9-]+$/.test(folder)||!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid output or model folder');
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();
ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
try{
 await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});
 await new Promise(done=>setTimeout(done,800));
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
  const {AvatarModelResources,bindAvatarModel}=await import('/src/threeAvatarModels.ts');
  const {AVATAR_CONTACTS,contactGait}=await import('/src/avatarContactProfiles.ts');
  const {hasStandingAnatomy}=await import('/src/avatarStance.ts');
  const {avatarDesign}=await import('/src/avatarDesigns.ts');
  const manifest=await(await fetch('/models/${folder}/manifest.json')).json(),rows=[];
  for(const asset of manifest.avatars){
   const file=await new GLTFLoader().loadAsync('/models/${folder}/'+asset.file),meshes=[],images=new Set();
   file.scene.traverse(node=>{if(node.isMesh){meshes.push(node);for(const material of Array.isArray(node.material)?node.material:[node.material])for(const value of Object.values(material))if(value?.isTexture){
    if(!value.image?.width||!value.image?.height)throw Error(asset.id+' undecoded image');images.add(value.image);
   }}});
   if(asset.anatomy!==false&&!images.size)throw Error(asset.id+' missing decoded maps');
   const mixer=new THREE.AnimationMixer(file.scene),clips=[];
   for(const clip of file.animations){
    mixer.stopAllAction();mixer.clipAction(clip).play();const frames=[];
    for(const time of ${['avatars-v6','avatars-v7','avatars-v8','avatars-v9'].includes(folder)?'[0,.18,.42,.7,1].map(f=>f*clip.duration)':'[0,.15,.35]'}){
     mixer.setTime(time);file.scene.updateMatrixWorld(true);const box=new THREE.Box3();
     for(const mesh of meshes){if(mesh.isSkinnedMesh)mesh.skeleton.update();const count=mesh.geometry.attributes.position.count;
      for(let i=0;i<count;i+=Math.max(1,Math.floor(count/24))){const point=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
       if(![point.x,point.y,point.z].every(Number.isFinite))throw Error(asset.id+' invalid posed vertex');box.expandByPoint(point);
      }
     }
     if(box.max.y>5||box.min.y<-.6||box.getSize(new THREE.Vector3()).length()>10)throw Error(asset.id+' '+clip.name+' t='+time+' invalid pose bounds '+JSON.stringify({min:box.min.toArray(),max:box.max.toArray()}));
     frames.push({time,min:box.min.toArray(),max:box.max.toArray()});
    }
    clips.push({name:clip.name,frames});
   }
   let outfitMotion;
   const outfit=meshes.find(m=>m.userData.anatomyTarget==='Outfit');
   if(outfit){
    mixer.stopAllAction();mixer.clipAction(file.animations.find(c=>c.name==='Walk')).play();
    const sample=time=>{mixer.setTime(time);file.scene.updateMatrixWorld(true);outfit.skeleton.update();return outfit.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(outfit.matrixWorld);};
    outfitMotion=sample(0).distanceTo(sample(.15));if(outfitMotion<1e-6)throw Error(asset.id+' outfit did not animate');
   }
   mixer.stopAllAction();mixer.uncacheRoot(file.scene);
   let contacts;
   if(['avatars-v7','avatars-v8','avatars-v9'].includes('${folder}')){
    let root;file.scene.traverse(n=>{if(n.userData.avatarPart==='avatar-root')root=n;});
    const resources=new AvatarModelResources(),model=bindAvatarModel(root,resources),profile=AVATAR_CONTACTS[asset.id];
    file.scene.scale.setScalar(40);let hands=0,closedHands=0;
    for(const side of ['L','R']){
     const hand=meshes.find(m=>m.userData.anatomyTarget==='Hand'+side);if(!hand)continue;
     const expected=(side==='L'?profile.closeLeft:profile.closeRight)??0;
     if(hand.morphTargetDictionary?.Grip!==0||hand.morphTargetInfluences?.[0]!==expected)throw Error(asset.id+' missing grip shape/default');
     hands++;if(expected>0)closedHands++;
    }
    let maxStanceDrift=0,steps=0;
    if(!root.userData.floating&&(hasStandingAnatomy(asset.id)||['machine','hedgehog'].includes(avatarDesign(asset.id).body))){
     for(const state of ['walk','run','strafe']){
      const prior=[null,null],gait=contactGait(state),scale=avatarDesign(asset.id).height/76;
      for(let f=0;f<=90;f++){
       const phase=f/90,along=phase*gait.span/gait.stance*scale;
       file.scene.position.set(state==='strafe'?along:0,0,state==='strafe'?0:along);
       model.animate({motionState:state,motionTime:phase,gaitPhase:phase,plantFeet:true,moveX:state==='strafe'?1:0,moveZ:state==='strafe'?0:1},phase);file.scene.updateMatrixWorld(true);
       for(let i=0;i<2;i++){
        const point=root.getObjectByName('Foot'+(i?'R':'L')).getWorldPosition(new THREE.Vector3()),stance=(phase+i*.5)%1<gait.stance;
        if(stance&&prior[i]){maxStanceDrift=Math.max(maxStanceDrift,Math.hypot(point.x-prior[i].x,point.z-prior[i].z));steps++;}prior[i]=stance?point:null;
       }
      }
     }
     if(maxStanceDrift>1e-5)throw Error(asset.id+' loaded stance foot drift '+maxStanceDrift);
    }
    contacts={hands,closedHands,maxStanceDrift,steps};model.dispose();disposeArenaTerrainResources(resources.owner);
   }
   disposeArenaTerrainResources(file.scene);
   rows.push({id:asset.id,decodedMaps:images.size,meshes:meshes.length,outfitMotion,contacts,clips});
  }
  return {date:'2026-10-17',models:rows.length,rows};
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 await writeFile(`../docs/${prefix}-native-verification.json`,JSON.stringify(result.result.value,null,2)+'\n');
 console.log(`Decoded images and exercised all native clips for ${result.result.value.models} models.`);
}finally{ws.close();}
