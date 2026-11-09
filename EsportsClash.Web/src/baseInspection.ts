import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import {CreateGround} from '@babylonjs/core/Meshes/Builders/groundBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import type {AnimationGroup} from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/loaders/glTF';
import {SkeletonViewer} from '@babylonjs/core/Debug/skeletonViewer';

let disposeActive:(()=>void)|undefined;

function initialize(){
  const host=document.querySelector<HTMLElement>('#base-inspection');
  if(!host?.dataset.asset||host.dataset.initialized)return;
  disposeActive?.();
  host.dataset.initialized='true';
  delete host.dataset.error;
  const canvas=document.createElement('canvas');
  canvas.style.cssText='width:100%;height:100%;display:block;touch-action:none';
  host.replaceChildren(canvas);
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:true});
  const scene=new Scene(engine);
  scene.useRightHandedSystem=true;
  scene.clearColor=new Color4(.035,.055,.075,1);
  const frontAngle=host.dataset.front==='negative-z'?-Math.PI/2:Math.PI/2;
  const camera=new ArcRotateCamera('base-camera',frontAngle,Math.PI/2.2,3.2,new Vector3(0,.9,0),scene);
  camera.minZ=.001;
  camera.attachControl(canvas,true);
  camera.lowerRadiusLimit=.2;
  camera.upperRadiusLimit=12;
  new HemisphericLight('base-light',new Vector3(.3,1,-.5),scene).intensity=1.3;
  const ground=CreateGround('inspection-floor',{width:5,height:5},scene);
  const floor=new StandardMaterial('floor-material',scene);
  floor.diffuseColor=new Color3(.08,.12,.15);
  ground.material=floor;
  const status=document.querySelector<HTMLElement>('#base-status')!;
  const clip=document.querySelector<HTMLSelectElement>('#base-clip')!;
  const phase=document.querySelector<HTMLInputElement>('#base-phase')!;
  const time=document.querySelector<HTMLInputElement>('#base-time');
  const play=document.querySelector<HTMLButtonElement>('#base-play')!;
  const speed=document.querySelector<HTMLSelectElement>('#base-speed')!;
  const skeletonButton=document.querySelector<HTMLButtonElement>('#base-skeleton')!;
  skeletonButton.setAttribute('aria-pressed','false');
  play.textContent='Play';
  phase.value='0';
  if(time)time.value='0';
  clip.replaceChildren(new Option('Bind pose',''));
  const wireframe=document.querySelector<HTMLButtonElement>('#base-wireframe');
  wireframe?.setAttribute('aria-pressed','false');
  const presets=[...document.querySelectorAll<HTMLButtonElement>('[data-base-view]')];
  const controls=[clip,phase,play,speed,skeletonButton,...presets,...(time?[time]:[]),...(wireframe?[wireframe]:[])];
  for(const control of controls)control.disabled=true;
  let current:AnimationGroup|undefined,playing=false,disposed=false,last=performance.now();
  const skeletons:SkeletonViewer[]=[];
  const resize=new ResizeObserver(()=>engine.resize());
  resize.observe(host);
  disposeActive=()=>{
    if(disposed)return;
    disposed=true;
    resize.disconnect();
    for(const viewer of skeletons)viewer.dispose();
    scene.dispose();
    engine.dispose();
    delete host.dataset.initialized;
    delete host.dataset.ready;
  };
  void LoadAssetContainerAsync(host.dataset.asset,scene).then(container=>{
    if(disposed){container.dispose();return;}
    container.addAllToScene();
    for(const group of container.animationGroups){group.stop();clip.add(new Option(group.name,group.name));}
    for(const skeleton of container.skeletons){
      const mesh=container.meshes.find(mesh=>mesh.skeleton===skeleton)??null;
      const viewer=new SkeletonViewer(skeleton,mesh,scene);
      viewer.isEnabled=false;
      skeletons.push(viewer);
      skeleton.returnToRest();
    }
    let minimum=new Vector3(Infinity,Infinity,Infinity),maximum=new Vector3(-Infinity,-Infinity,-Infinity);
    for(const mesh of container.meshes)if(mesh.getTotalVertices()>0){
      mesh.computeWorldMatrix(true);
      const bounds=mesh.getBoundingInfo().boundingBox;
      minimum=Vector3.Minimize(minimum,bounds.minimumWorld);
      maximum=Vector3.Maximize(maximum,bounds.maximumWorld);
    }
    const hasBounds=Number.isFinite(minimum.x)&&Number.isFinite(maximum.x);
    if(hasBounds)ground.position.y=minimum.y-Math.max(.0001,(maximum.y-minimum.y)*.002);
    const center=hasBounds?minimum.add(maximum).scale(.5):new Vector3(0,.9,0);
    // Keep room for limb motion and fit both axes on narrow inspection panels.
    const fitRadius=()=>{
      if(!hasBounds)return 3.2;
      const size=maximum.subtract(minimum);
      const tangent=Math.tan(camera.fov/2);
      const aspect=Math.max(.1,engine.getAspectRatio(camera));
      return Math.max(.5,(Math.max(size.y/2/tangent,Math.max(size.x,size.z)/2/(tangent*aspect))
        +Math.max(size.x,size.z)/2)*1.2);
    };
    const radius=fitRadius();
    camera.minZ=Math.max(.00001,radius*.001);
    camera.lowerRadiusLimit=radius*.15;
    camera.upperRadiusLimit=radius*6;
    ground.scaling.setAll(Math.max(1,radius/2));
    const preset=(view:string)=>{
      camera.setTarget(center);
      camera.radius=fitRadius();
      camera.alpha=view==='side'?0:view==='back'?-frontAngle:frontAngle;
      camera.beta=view==='fit'?Math.PI/2.2:Math.PI/2;
    };
    preset('fit');
    for(const button of presets)button.onclick=()=>preset(button.dataset.baseView??'fit');
    const duration=()=>current?Math.max(.001,(current.to-current.from)/(current.targetedAnimations[0]?.animation.framePerSecond??30)):0;
    const sample=()=>{
      if(current)current.goToFrame(current.from+Number(phase.value)*(current.to-current.from),true);
      if(time){time.max=String(duration());time.value=(Number(phase.value)*duration()).toFixed(3);}
    };
    const pause=()=>{playing=false;play.textContent='Play';};
    clip.onchange=()=>{
      pause();
      for(const group of container.animationGroups)group.stop();
      for(const skeleton of container.skeletons)skeleton.returnToRest();
      current=container.animationGroups.find(group=>group.name===clip.value);
      if(current){current.start(false);current.pause();}
      phase.value='0';
      sample();
    };
    phase.oninput=()=>{pause();sample();};
    if(time)time.oninput=()=>{
      pause();
      phase.value=String(duration()?Math.max(0,Math.min(1,Number(time.value)/duration())):0);
      sample();
    };
    play.onclick=()=>{
      if(!current)return;
      playing=!playing;
      play.textContent=playing?'Pause':'Play';
      last=performance.now();
    };
    skeletonButton.onclick=()=>{
      for(const viewer of skeletons)viewer.isEnabled=!viewer.isEnabled;
      skeletonButton.setAttribute('aria-pressed',String(skeletons[0]?.isEnabled??false));
    };
    let lines=false;
    if(wireframe)wireframe.onclick=()=>{
      lines=!lines;
      for(const material of container.materials)material.wireframe=lines;
      wireframe.setAttribute('aria-pressed',String(lines));
    };
    scene.onBeforeRenderObservable.add(()=>{
      const now=performance.now();
      if(playing&&current){
        const value=Number(phase.value)+(now-last)/1000*Number(speed.value)/duration();
        const death=current.name.toLowerCase().includes('death');
        phase.value=String(death?Math.min(1,value):value%1);
        sample();
        if(death&&value>=1)pause();
      }
      last=now;
    });
    for(const control of controls)control.disabled=false;
    status.textContent='Loaded '+container.skeletons.reduce((n,s)=>n+s.bones.length,0)+' bones · '+container.animationGroups.length+' exported clips · unqualified base';
    host.dataset.ready='true';
    host.dataset.clips=JSON.stringify(container.animationGroups.map(group=>group.name));
    Object.assign(host,{inspection:{scene,container,sample:(name:string,value:number)=>{
      clip.value=name;
      clip.dispatchEvent(new Event('change'));
      phase.value=String(Math.max(0,Math.min(1,value)));
      sample();
      scene.render();
    },camera}});
  }).catch(error=>{
    if(disposed)return;
    status.textContent='Base load failed: '+String(error);
    host.dataset.error=String(error);
  });
  engine.runRenderLoop(()=>{if(!disposed)scene.render();});
}

document.addEventListener('livewire:navigating',()=>{disposeActive?.();disposeActive=undefined;});
document.addEventListener('livewire:navigated',initialize);
window.addEventListener('pagehide',()=>disposeActive?.());
initialize();
