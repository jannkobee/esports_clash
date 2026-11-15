export interface FreeFlightPose {x:number;y:number;z:number;yaw:number;pitch:number}
export function advanceFreeFlight(p:FreeFlightPose,keys:ReadonlySet<string>,dt:number):FreeFlightPose {
  const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  const up=Number(keys.has('KeyE'))-Number(keys.has('KeyQ')),length=Math.max(1,Math.hypot(forward,right,up));
  const step=Math.max(0,Math.min(.1,dt))*(keys.has('ShiftLeft')||keys.has('ShiftRight')?22:7)/length;
  return {...p,x:Math.max(-34,Math.min(34,p.x+(Math.sin(p.yaw)*forward+Math.cos(p.yaw)*right)*step)),
    z:Math.max(-43,Math.min(43,p.z+(Math.cos(p.yaw)*forward-Math.sin(p.yaw)*right)*step)),
    y:Math.max(-1,Math.min(65,p.y+up*step))};
}
/** Independent spectator controls, active even while simulation time is paused. */
export class FreeMapControls {
  active=false;pose:FreeFlightPose={x:0,y:7,z:10,yaw:0,pitch:.1};
  private keys=new Set<string>();private dragging=false;private remove:(()=>void)[]=[];
  constructor(canvas:HTMLCanvasElement){
    canvas.tabIndex=0;
    const doc=canvas.ownerDocument;
    const listen=(target:EventTarget,type:string,fn:EventListener)=>{target.addEventListener(type,fn);this.remove.push(()=>target.removeEventListener(type,fn));};
    listen(doc,'keydown',((e:KeyboardEvent)=>{
      if(!this.active||doc.activeElement!==canvas||e.ctrlKey||e.metaKey||e.altKey)return;
      if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}
    }) as EventListener);
    listen(doc,'keyup',((e:KeyboardEvent)=>{this.keys.delete(e.code);}) as EventListener);
    listen(canvas,'blur',()=>{this.keys.clear();this.dragging=false;});
    if(doc.defaultView)listen(doc.defaultView,'blur',()=>{this.keys.clear();this.dragging=false;});
    listen(canvas,'pointerdown',((e:PointerEvent)=>{if(!this.active)return;canvas.focus();canvas.setPointerCapture(e.pointerId);this.dragging=true;}) as EventListener);
    listen(canvas,'pointerup',()=>{this.dragging=false;});
    listen(canvas,'pointercancel',()=>{this.dragging=false;this.keys.clear();});
    listen(canvas,'pointermove',((e:PointerEvent)=>{if(this.active&&this.dragging){this.pose.yaw+=e.movementX*.003;this.pose.pitch=Math.max(-1.5,Math.min(1.5,this.pose.pitch+e.movementY*.003));}}) as EventListener);
    listen(canvas,'contextmenu',((e:Event)=>{if(this.active)e.preventDefault();}) as EventListener);
  }
  update(active:boolean,dt:number):FreeFlightPose {
    if(!active){this.keys.clear();this.dragging=false;}
    this.active=active;if(active)this.pose=advanceFreeFlight(this.pose,this.keys,dt);return this.pose;
  }
  dispose(){for(const remove of this.remove)remove();this.keys.clear();}
}
