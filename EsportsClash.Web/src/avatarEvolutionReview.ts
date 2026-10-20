import * as THREE from 'three';
import {AvatarAssetLibrary} from './avatarModelAssets.ts';
import {AvatarModelResources} from './threeAvatarModels.ts';
import {CHAMPIONS} from './mockData.ts';
import {combatDuration} from './avatarCombatMotion.ts';
import {contactGait} from './avatarContactProfiles.ts';
import {ArenaAbilityEffects} from './threeAbilityEffects.ts';

const query=new URLSearchParams(location.search),run=query.get('run')??'',candidate=query.get('candidate')??'baseline',id=query.get('avatar')??'c_invoker';
if(!/^[a-f0-9-]{36}$/.test(run)||!/^(baseline|candidate-\d{2})$/.test(candidate))throw Error('Invalid review asset');
const kit=CHAMPIONS.find(a=>a.id===id);if(!kit)throw Error('Unknown avatar');
const root=location.pathname.split('/viewer/')[0],url=`${root}/files/${run}/${candidate}.glb`;
const host=document.querySelector<HTMLDivElement>('#stage')!,status=document.querySelector<HTMLDivElement>('#status')!;
const resources=new AvatarModelResources(),library=new AvatarAssetLibrary(resources,()=>url),scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor('#101b2b',0);
const shaderErrors:string[]=[];
renderer.debug.onShaderError=()=>{shaderErrors.push('Actual WebGL shader compilation failed');};
renderer.outputColorSpace=THREE.SRGBColorSpace;host.replaceChildren(renderer.domElement);
scene.add(new THREE.HemisphereLight('#e8f5ff','#252b43',2.2));const light=new THREE.DirectionalLight('#ffe8cc',3);light.position.set(-80,150,130);scene.add(light);
const rim=new THREE.DirectionalLight('#85bbed',2);rim.position.set(90,70,-100);scene.add(rim);
const camera=new THREE.OrthographicCamera(-60,60,60,-60,.1,1200),effects=new ArenaAbilityEffects();scene.add(effects.root);
const variant=id==='c_invoker'?'claude':'current';
if(!await library.request(id,undefined,variant))throw Error('Asset failed to load');
const model=library.instantiate(id,variant);if(!model)throw Error('Rig failed to bind');scene.add(model.body);
let yaw=.6,pose='Idle',playing=false,second=0,last=performance.now();
const meshes:THREE.Mesh[]=[];model.body.traverse(n=>{if(n instanceof THREE.Mesh)meshes.push(n);});
const joint=(name:string)=>model.body.getObjectByName(name);
function draw(phase=0,angle=yaw,state=pose,gameplay=false) {
  const w=host.clientWidth||384,h=host.clientHeight||380;renderer.setSize(w,h,false);
  const moving=['Walk','Run','Strafe'].includes(state),duration=combatDuration(id,state.toLowerCase());
  if(!moving)model!.body.position.set(0,0,0);
  model!.animate({animState:state==='Ability'?'cast':state.toLowerCase(),motionState:state==='Ability'?'cast':state.toLowerCase(),motionTime:phase*duration,
    animTimer:phase*duration,gaitPhase:phase%1,plantFeet:moving,moveX:0,moveZ:70},phase*duration);
  const ability=state==='Ability',p=phase%1;
  effects.update([],ability?[{id:'review-ability',x:0,y:0,radius:30,color:kit!.accentColor,avatarName:kit!.name,
    duration:1-p,maxDuration:1,sourceUnitId:'review',sourceX:0,sourceY:0}]:[],phase,
    [{id:'review',x:0,y:0,isAlive:true,champion:{name:kit!.name},visualEvolution:model!.body.userData.visualEvolution}]);
  const span=gameplay?700:Math.max(110,model!.height*1.42),aspect=w/h,half=span/(2*Math.min(1,aspect));
  Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
  camera.position.set(Math.sin(angle)*220,gameplay?340:115,Math.cos(angle)*220);camera.lookAt(0,model!.height*.43,0);camera.updateProjectionMatrix();
  model!.body.updateMatrixWorld(true);for(const m of meshes)if(m instanceof THREE.SkinnedMesh)m.skeleton.update();
  renderer.render(scene,camera);
}
function bounds() {
  const box=new THREE.Box3();let finite=true;
  for(const mesh of meshes){const count=mesh.geometry.attributes.position.count;
    for(let i=0;i<count;i+=Math.max(1,Math.floor(count/100))){const point=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      finite=finite&&point.toArray().every(Number.isFinite);box.expandByPoint(point);}}
  return {finite,min:box.min.toArray(),max:box.max.toArray()};
}
function silhouette() {
  const canvas=renderer.domElement,gl=renderer.getContext(),pixels=new Uint8Array(canvas.width*canvas.height*4);
  gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let count=0,minX=canvas.width,maxX=0,minY=canvas.height,maxY=0,start=-1;const runs:number[]=[],rgb=[0,0,0];
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const index=y*canvas.width+x,visible=pixels[index*4+3]>16;
    if(visible){if(start<0)start=index;count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(let c=0;c<3;c++)rgb[c]+=pixels[index*4+c];}
    else if(start>=0){runs.push(start,index);start=-1;}
  }
  if(start>=0)runs.push(start,canvas.width*canvas.height);
  return {occupied_pixels:count,fill_ratio:count/(canvas.width*canvas.height),width:maxX-minX,height:maxY-minY,
    canvas:[canvas.width,canvas.height],mask_runs:runs,mean_rgb:rgb.map(x=>x/Math.max(1,count)),clipped:minX===0||maxX===canvas.width-1||minY===0||maxY===canvas.height-1};
}
async function evaluate() {
  playing=false;const clips=[],issues:string[]=[],samplePhases=[0,.12,.24,.36,.48,.6,.72,.84,.96];let maxFootDrift=0,maxTransitionJump=0;
  for(const name of ['Idle','Walk','Run','Strafe','Attack','Cast','Hit','Death','TurnLeft','TurnRight']){
    model!.body.position.set(0,0,0);let previous:THREE.Vector3|undefined;const frames=[];
    for(const phase of samplePhases){if(['Walk','Run','Strafe'].includes(name)){
      const state=name.toLowerCase(),gait=contactGait(state);
      const distance=phase*(model!.body.userData.strideDistances?.[state]??gait.span/gait.stance);
      model!.body.position.set(name==='Strafe'?distance:0,0,name==='Strafe'?0:distance);
    }
      draw(phase,0,name);const box=bounds();if(!box.finite)issues.push(`${name}: nonfinite skinned vertex`);
      const foot=joint('FootL')?.getWorldPosition(new THREE.Vector3());if(foot&&previous&&phase<contactGait(name.toLowerCase()).stance&&['Walk','Run','Strafe'].includes(name))maxFootDrift=Math.max(maxFootDrift,foot.distanceTo(previous));
      previous=foot;frames.push({phase,...box});
    }
    clips.push({name,frames});
  }
  model!.body.position.set(0,0,0);
  for(const blend of [0,.1,.25,.5,.75,1]){
    model!.animate({animState:'attack',motionState:'attack',motionTime:.2,previousMotion:'idle',previousMotionTime:.2,motionBlend:blend},20+blend);
    model!.body.updateMatrixWorld(true);const hand=joint('HandR')?.getWorldPosition(new THREE.Vector3());
    if(hand){const lastPoint=(evaluate as unknown as {lastPoint?:THREE.Vector3}).lastPoint;if(lastPoint&&blend>0)maxTransitionJump=Math.max(maxTransitionJump,hand.distanceTo(lastPoint));(evaluate as unknown as {lastPoint?:THREE.Vector3}).lastPoint=hand;}
  }
  const views=[];for(const [name,angle]of[['front',0],['side',Math.PI/2],['back',Math.PI]] as const){draw(.2,angle,'Idle');views.push({name,silhouette:silhouette(),triangles:renderer.info.render.triangles,draw_calls:renderer.info.render.calls});}
  const gameplayViews=[];for(const [name,state]of[['idle','Idle'],['attack','Attack'],['ability','Ability']] as const){draw(.42,.25,state,true);gameplayViews.push({name,silhouette:silhouette()});}
  let detailedMaterials=0,missingDetailMaps=0;
  const materials=new Set<THREE.Material>();for(const mesh of meshes)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
  for(const material of materials)if(material.userData.artFinish?.version===1){detailedMaterials++;const standard=material as THREE.MeshStandardMaterial;
    if(![standard.map,standard.normalMap,standard.roughnessMap,standard.metalnessMap].every(texture=>{
      const image=texture?.image as {width?:number;height?:number}|undefined;
      return !!image&&typeof image.width==='number'&&image.width>0&&typeof image.height==='number'&&image.height>0;
    }))missingDetailMaps++;}
  if(missingDetailMaps)issues.push('Generated PBR maps did not decode/load');if(shaderErrors.length)issues.push(...shaderErrors);
  draw(.45,.6,'Ability');const ability={effects:effects.stats(),triangles:renderer.info.render.triangles};
  draw(.2,.6,'Idle');const frameTimes:number[]=[];const context=renderer.getContext();
  for(let i=0;i<12;i++){const started=performance.now();draw(.2+i*.001,.6,'Idle');context.finish();frameTimes.push(performance.now()-started);}
  const mean=frameTimes.reduce((sum,x)=>sum+x,0)/frameTimes.length;
  return {passed:issues.length===0&&views.every(v=>v.silhouette.occupied_pixels>100&&!v.silhouette.clipped),issues,clips,views,
    gameplay:{passed:gameplayViews.every(v=>v.silhouette.occupied_pixels>10&&!v.silhouette.clipped),views:gameplayViews,scope:'Actual game asset library, animation/contact/VFX code at a standardized gameplay-scale camera; full-arena release verification remains separate.'},
    textures:{detailed_materials:detailedMaterials,missing_detail_maps:missingDetailMaps},shader_errors:shaderErrors,
    planted_foot_step_drift:maxFootDrift,blend_hand_step_jump:maxTransitionJump,ability,
    renderer:{triangles:renderer.info.render.triangles,draw_calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
      mean_frame_ms:mean,frame_samples_ms:frameTimes,scope:'Standardized local renderer, gl.finish per frame; software GPU in Docker, not device FPS.'},
    overlap_detection:'Conservative posed bounds comparison; precise self-intersection remains a Blender review diagnostic.'};
}
function animate(now:number){if(playing){second+=(now-last)/1000;draw(second%1);}last=now;requestAnimationFrame(animate);}requestAnimationFrame(animate);
document.querySelector<HTMLSelectElement>('#pose')!.onchange=e=>{pose=(e.target as HTMLSelectElement).value;second=0;draw(.35);};
document.querySelector<HTMLButtonElement>('#motion')!.onclick=e=>{playing=!playing;(e.target as HTMLButtonElement).textContent=playing?'Pause':'Play';};
document.querySelector<HTMLButtonElement>('#rotate')!.onclick=()=>{yaw+=Math.PI/4;draw(.35);};
draw(.2);status.textContent=`${kit.displayName} · actual ${variant} rig · ${candidate}`;
const resize=new ResizeObserver(()=>draw(second%1));resize.observe(host);
Object.assign(window,{__avatarEvolution:{ready:true,evaluate,draw:(phase:number,angle:number,state:string,mode='studio')=>draw(phase,angle,state,mode==='gameplay'),screenshot:()=>renderer.domElement.toDataURL('image/png')}});
window.addEventListener('pagehide',()=>{resize.disconnect();library.close();model.dispose();renderer.dispose();renderer.forceContextLoss();});
