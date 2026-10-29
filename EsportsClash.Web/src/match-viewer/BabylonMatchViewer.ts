import { Engine, WebGPUEngine, Scene, FreeCamera, Camera, Vector3, Matrix, Viewport, Color3, Color4,
  HemisphericLight, DirectionalLight, StandardMaterial, GlowLayer, type AbstractEngine, type TransformNode } from '@babylonjs/core';
import { arenaGroundHeight } from '../arenaElevation';
import type { ArenaSceneFrame } from './ArenaFrame';
import { captureViewerSnapshot, type MatchViewer, type ViewerSnapshot, type ViewerActor } from './MatchViewer';
import { BabylonAssets, type AvatarAssetInstance } from './BabylonAssets';
import { buildBabylonBattlefield, buildBattlefieldActor } from './BabylonBattlefield';
import { BabylonEffects } from './BabylonEffects';
import type { VisualRelease } from '../avatarVisualRelease';

type ActorView={root:TransformNode;body:TransformNode;height:number;actor:ViewerActor;model?:AvatarAssetInstance;loading?:boolean;animate?:(actor:ViewerActor,second:number,dt:number)=>void};
const SPECTATOR_TILT=56.5*Math.PI/180;
/** Read-only presentation. Scene has no gameplay physics, RNG, callbacks or command writer. */
export class BabylonMatchViewer implements MatchViewer {
  private canvas:HTMLCanvasElement;
  private engine:AbstractEngine;
  private scene!:Scene;
  private camera:FreeCamera;
  private observer:ResizeObserver;
  private available=true;private disposed=false;
  private actors=new Map<string,ActorView>();
  private materials=new Map<string,StandardMaterial>();
  private assets:BabylonAssets;
  private effects:BabylonEffects;
  private battlefield:ReturnType<typeof buildBabylonBattlefield>;
  private current?:ViewerSnapshot;private previous?:ViewerSnapshot;private received=0;
  private lastTick=-1;private lastSecond=-1;
  private center={x:0,y:0,zoom:1};
  private lost=(event:Event)=>{event.preventDefault();this.available=false;this.onAvailability(false);};
  private restored=()=>{if(!this.disposed){this.available=true;this.onAvailability(true);}};
  static async create(host:HTMLElement,width:number,height:number,blue:number,red:number,onAvailability:(value:boolean)=>void,
    snapshot?:Promise<ReadonlyMap<string,VisualRelease>>){
    if(new URLSearchParams(location.search).get('graphics')==='webgpu'&&await WebGPUEngine.IsSupportedAsync){
      const canvas=document.createElement('canvas');let engine:WebGPUEngine|undefined;
      try{engine=new WebGPUEngine(canvas,{antialias:true});await engine.initAsync();
        return new BabylonMatchViewer(host,width,height,blue,red,onAvailability,snapshot,{canvas,engine});
      }catch(error){engine?.dispose();canvas.remove();console.warn('WebGPU unavailable; using WebGL',error);}
    }
    return new BabylonMatchViewer(host,width,height,blue,red,onAvailability,snapshot);
  }
  constructor(private host:HTMLElement,private width:number,private height:number,_blue:number,_red:number,
    private onAvailability:(available:boolean)=>void,snapshot?:Promise<ReadonlyMap<string,VisualRelease>>,
    initialized?:{canvas:HTMLCanvasElement;engine:AbstractEngine}){
    this.canvas=initialized?.canvas??document.createElement('canvas');
    Object.assign(this.canvas.style,{width:'100%',height:'100%',display:'block'});
    this.canvas.setAttribute('aria-label','Babylon match viewer');host.appendChild(this.canvas);
    try{this.engine=initialized?.engine??new Engine(this.canvas,true,{preserveDrawingBuffer:false,stencil:true});}
    catch(error){this.canvas.remove();throw error;}
    try{
      this.engine.setHardwareScalingLevel(1/Math.min(1.5,window.devicePixelRatio||1));
      this.scene=new Scene(this.engine);this.scene.useRightHandedSystem=true;
      this.scene.clearColor=new Color4(.03,.065,.08,1);
      this.scene.imageProcessingConfiguration.contrast=1.06;
      this.scene.imageProcessingConfiguration.exposure=1.0;
      this.camera=new FreeCamera('spectator',new Vector3(width/2,Math.sin(SPECTATOR_TILT)*3000,height/2+Math.cos(SPECTATOR_TILT)*3000),this.scene);
      this.camera.mode=Camera.ORTHOGRAPHIC_CAMERA;this.camera.minZ=1;this.camera.maxZ=7000;this.scene.activeCamera=this.camera;
      const sky=new HemisphericLight('sky',Vector3.Up(),this.scene);sky.intensity=.65;sky.diffuse=Color3.FromHexString('#e0eee0');sky.groundColor=Color3.FromHexString('#202a24');
      const sun=new DirectionalLight('sun',new Vector3(-.54,-.86,.38),this.scene);sun.intensity=.92;sun.diffuse=Color3.FromHexString('#fff6e0');sun.specular=Color3.FromHexString('#332e26');
      const rim=new DirectionalLight('rim',new Vector3(.58,-.68,-.44),this.scene);rim.intensity=.45;rim.diffuse=Color3.FromHexString('#98cce6');
      try{
        const glow=new GlowLayer('arena-cinema-glow',this.scene,{mainTextureFixedSize:512,blurKernelSize:24});
        glow.intensity=.30;
        glow.customEmissiveColorSelector=(mesh,_subMesh,material,result)=>{
          if(mesh.name.startsWith('painted-avatar:')||mesh.name.startsWith('mirelle-painted:')||mesh.name.startsWith('ability-token:')||mesh.name.startsWith('ability-art:')){
            result.set(0,0,0,0);
          }else if(material&&'emissiveColor' in material&&material.emissiveColor){
            const ec=material.emissiveColor as Color3;result.set(ec.r,ec.g,ec.b,1);
          }else{result.set(0,0,0,0);}
        };
      }catch{/* Fallback cleanly if glow layer is unsupported on minimal contexts */}
      this.battlefield=buildBabylonBattlefield(this.scene,width,height,color=>this.material(color));
      this.effects=new BabylonEffects(this.scene);this.assets=new BabylonAssets(this.scene,snapshot);
      this.canvas.addEventListener('webglcontextlost',this.lost);
      this.engine.onContextLostObservable.add(()=>{if(!this.disposed){this.available=false;this.onAvailability(false);}});
      this.engine.onContextRestoredObservable.add(this.restored);
      this.observer=new ResizeObserver(()=>{if(!this.disposed)this.engine.resize();});this.observer.observe(host);
      this.engine.resize();this.onAvailability(true);host.dataset.renderer='babylon';host.dataset.viewerStatus='3d-native-live';
      host.dataset.backend=this.engine instanceof WebGPUEngine?'webgpu':'webgl';
    }catch(error){this.scene?.dispose();this.engine.dispose();this.canvas.remove();throw error;}
  }
  private material(color:string){
    const key=/^#[0-9a-f]{6}$/i.test(color)?color:'#f5c96a';let m=this.materials.get(key);
    if(!m){
      m=new StandardMaterial(key,this.scene);
      const base=Color3.FromHexString(key);
      m.diffuseColor=base;
      m.specularColor=new Color3(.16,.16,.14);
      m.specularPower=32;
      if(['#5fe2ff','#ff6b84','#45bfd5','#d9536f','#e0b86b','#80c6ca','#a9d4df','#cc9665','#a99ac2','#adb87b','#97b5a8','#d8a16b'].includes(key.toLowerCase())){
        m.emissiveColor=base.scale(.42);
      }
      this.materials.set(key,m);
    }
    return m;
  }
  isAvailable(){return this.available&&!this.disposed;}
  private frustum(zoom:number){const aspect=Math.max(.1,this.host.clientWidth/Math.max(1,this.host.clientHeight));
    const halfH=(this.width+96)/(2*Math.max(.1,zoom)*Math.max(16/9,aspect));return {halfW:halfH*aspect,halfH};}
  viewport(x:number,y:number,zoom:number){const f=this.frustum(zoom),halfH=f.halfH/Math.sin(SPECTATOR_TILT);
    const clamp=(v:number,h:number,e:number,m:number)=>h*2>=e?e/2:Math.max(h-m,Math.min(e-h+m,v));
    return {x:clamp(x,f.halfW,this.width,48),y:clamp(y,halfH,this.height,96),halfW:f.halfW,halfH};}
  pan(dx:number,dy:number,zoom:number){const f=this.frustum(zoom);return {x:dx*f.halfW,y:dy*f.halfH/Math.sin(SPECTATOR_TILT)};}
  private setCamera(x:number,y:number,zoom:number){const f=this.frustum(zoom);this.center={x,y,zoom};
    this.camera.orthoLeft=-f.halfW;this.camera.orthoRight=f.halfW;this.camera.orthoTop=f.halfH;this.camera.orthoBottom=-f.halfH;
    this.camera.position.set(x,Math.sin(SPECTATOR_TILT)*3000,y+Math.cos(SPECTATOR_TILT)*3000);this.camera.setTarget(new Vector3(x,0,y));
    this.camera.getViewMatrix(true);this.camera.getProjectionMatrix(true);}
  project(x:number,y:number,height:number,width:number,screenHeight:number){
    const p=Vector3.Project(new Vector3(x,arenaGroundHeight(x,y)+height,y),Matrix.Identity(),
      this.camera.getTransformationMatrix(),new Viewport(0,0,width,screenHeight));return {x:p.x,y:p.y};}
  actorHeight(id:string){return this.actors.get(id)?.height??24;}
  loadSnapshot(snapshot:ViewerSnapshot){
    if(this.current===snapshot)return;
    if(this.current?.tick===snapshot.tick)return;
    this.previous=snapshot.tick>(this.current?.tick??-1)?this.current:undefined;
    this.current=snapshot;this.received=performance.now();
  }
  private ensureActor(actor:ViewerActor){
    let view=this.actors.get(actor.id);
    if(view&&(view.actor.heroId!==actor.heroId||view.actor.subtype!==actor.subtype||view.actor.assetVariant!==actor.assetVariant)){
      view.model?.dispose();view.root.dispose();this.actors.delete(actor.id);view=undefined;
    }
    if(!view){view={...buildBattlefieldActor(actor,this.scene,c=>this.material(c)),actor};this.actors.set(actor.id,view);}
    if(actor.kind==='champion'&&!view.model&&!view.loading){
      view.loading=true;const owner=view;
      void this.assets.instantiate(actor.heroId,actor.id,actor.assetVariant).then(model=>{
        if(!model)return;
        if(this.disposed||this.actors.get(actor.id)!==owner){model.dispose();return;}
        model.root.parent=owner.root;owner.model=model;owner.height=model.height;owner.body.setEnabled(false);
      }).catch(error=>{if(!this.disposed)console.warn('Avatar instance unavailable',actor.heroId,error);});
    }
    return view;
  }
  private update(){
    const snapshot=this.current;if(!snapshot)return;
    const prior=new Map(this.previous?.actors.map(a=>[a.id,a]));
    const span=Math.max(1/30,snapshot.second-(this.previous?.second??snapshot.second));
    const alpha=Math.min(1,(performance.now()-this.received)/(Math.min(.1,span)*1000));
    const seen=new Set<string>();
    for(const actor of snapshot.actors){
      if(!actor.alive&&actor.kind!=='champion'&&actor.kind!=='structure')continue;
      seen.add(actor.id);const view=this.ensureActor(actor);
      const before=prior.get(actor.id),blend=before?.alive&&actor.alive&&Math.hypot(before.x-actor.x,before.y-actor.y)<150?alpha:1;
      const x=(before?.x??actor.x)*(1-blend)+actor.x*blend,y=(before?.y??actor.y)*(1-blend)+actor.y*blend;
      view.root.position.set(x,arenaGroundHeight(x,y)+((actor.motion?.knockup??0)>0?24:0),y);
      const vx=actor.motion?.vx??0,vy=actor.motion?.vy??0;
      const heading=Math.hypot(vx,vy)>1&&actor.motion?.state==='walk'?Math.atan2(vx,vy):actor.facing<0?-Math.PI/2:Math.PI/2;
      view.root.rotation.y=heading;
      if(actor.kind==='structure')view.body.scaling.y=actor.alive?1:.12;
      if(actor.kind==='champion'){
        view.model?.animation.sample(actor,snapshot.second);
        if(!view.model)view.body.rotation.z=actor.alive?0:Math.PI/2;
      }
      if(!view.model&&view.animate)view.animate(actor,snapshot.second,span);
      view.actor=actor;
    }
    for(const [id,view] of this.actors)if(!seen.has(id)){view.model?.dispose();view.root.dispose();this.actors.delete(id);}
    if(this.lastTick!==snapshot.tick||this.lastSecond!==snapshot.second){this.effects.update(snapshot);this.battlefield.update(snapshot.actors);this.lastTick=snapshot.tick;this.lastSecond=snapshot.second;}
    this.host.dataset.actors=String(this.actors.size);this.host.dataset.models=String([...this.actors.values()].filter(a=>!!a.model).length);
    this.host.dataset.paintedArena=this.scene.metadata?.paintedArena??'ready';
    this.host.dataset.assetWarnings=String([...this.assets.diagnostics.values()].filter(w=>w.length>1).length);
    this.host.dataset.abilityTokens=String(this.effects.diagnostics().visible);this.host.dataset.abilityWorldMeshes=String(this.effects.diagnostics().worldMeshes);this.host.dataset.tick=String(snapshot.tick);this.host.dataset.fps=this.engine.getFps().toFixed(1);
  }
  renderArena(frame:ArenaSceneFrame,x:number,y:number,zoom:number){
    if(this.current?.tick!==Math.round(frame.second*30))this.loadSnapshot(captureViewerSnapshot(frame,this.current));
    return this.draw(x,y,zoom);
  }
  draw(x=this.center.x,y=this.center.y,zoom=this.center.zoom){if(!this.isAvailable())return false;
    try{this.engine.beginFrame();this.setCamera(x,y,zoom);this.update();this.scene.render();this.engine.endFrame();return true;}
    catch(error){console.error('Babylon viewer failed',error);this.available=false;this.onAvailability(false);return false;}}
  render(x:number,y:number,zoom:number){this.draw(x,y,zoom);return this.viewport(x,y,zoom);}
  whenReady(): Promise<void> {
    return this.scene.whenReadyAsync().then(() => {});
  }
  async preloadHeroes(heroIds: string[], onProgress?: (status: import("./BabylonAssets").MatchAssetManifestStatus) => void): Promise<void> {
    await this.assets.preloadAll(heroIds, onProgress);
  }
  diagnostics(){return {abilityArt:this.effects.diagnostics(),backend:this.host.dataset.backend,paintedBackdrop:this.scene.metadata?.paintedBackdrop,paintedArena:this.scene.metadata?.paintedArena,models:this.host.dataset.models,warnings:[...this.assets.diagnostics],animations:[...this.actors.values()].filter(a=>a.model).map(a=>({id:a.actor.id,...a.model!.animation.diagnostics()})),tick:this.current?.tick};}
  dispose(){if(this.disposed)return;this.disposed=true;this.available=false;this.observer.disconnect();
    this.canvas.removeEventListener('webglcontextlost',this.lost);
    for(const actor of this.actors.values()){actor.model?.dispose();}this.effects.dispose();this.assets.dispose();
    this.scene.dispose();this.engine.dispose();this.canvas.remove();this.actors.clear();this.materials.clear();
  }
}
