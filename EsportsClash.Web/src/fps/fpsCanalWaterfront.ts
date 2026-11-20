import { MeshBuilder, type Scene } from '@babylonjs/core';
import { LIVE_CANAL, LIVE_CANAL_CROSSINGS } from './fpsLiveTerrain.ts';
import type { VillageBuilder } from './fpsVillageArchitecture.ts';
import type { LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import { buildMercatoGate } from './fpsVillageMercato.ts';

/** Waterfront dressing stays on admitted masonry or outside the playable boundary.
 * Watercraft never become invisible cover in a playable lane. */
export function buildCanalWaterfront(scene:Scene,b:VillageBuilder,surfaces?:LiveSurfaceLibrary):void {
  const {box,detail}=b,canal=LIVE_CANAL;
  const stone=(id:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#c8bca0')=>{
    const mesh=box(id,x,y,z,w,h,d,color);
    if(surfaces)mesh.material=surfaces.material('stone',color);
    return mesh;
  };
  const post=(id:string,x:number,z:number,top:number,striped=false)=>{
    const p=detail(MeshBuilder.CreateCylinder(id,{height:top-canal.bedY,diameter:.19,tessellation:8},scene),'#705b42');
    p.position.set(x,(top+canal.bedY)/2,z);
    if(striped)for(let i=0;i<5;i++){
      const band=detail(MeshBuilder.CreateCylinder(`${id}-band-${i}`,{height:.19,diameter:.2,tessellation:8},scene),i%2?'#447d87':'#d4c8a9');
      band.position.set(x,top-.12-i*.23,z);
    }
  };
  const boat=(id:string,x:number,z:number,length:number,yaw:number,covered=false)=>{
    // A tapered hull, raised bow and contrasting gunwale read as moored boats at street level.
    const y=canal.waterY+.18;
    const hull=detail(MeshBuilder.CreateCylinder(`${id}-hull`,{height:.46,diameterTop:1,diameterBottom:.7,tessellation:8},scene),'#273d3c');
    hull.scaling.set(length,1,1.12);hull.position.set(x,y,z);hull.rotation.y=yaw;
    const transform=(dx:number,dz:number)=>({x:x+Math.cos(yaw)*dx+Math.sin(yaw)*dz,z:z-Math.sin(yaw)*dx+Math.cos(yaw)*dz});
    const at=(name:string,dx:number,dy:number,dz:number,w:number,h:number,d:number,color:string)=>{
      const p=transform(dx,dz),mesh=box(`${id}-${name}`,p.x,y+dy,p.z,w,h,d,color);mesh.rotation.y=yaw;return mesh;
    };
    for(const side of [-1,1])at(`gunwale-${side}`,0,.25,side*.46,length*.8,.08,.09,'#a68c5d');
    for(const dx of [-.7,.65])at(`seat-${dx}`,dx,.19,0,.22,.08,.88,'#a78d60');
    at('bow',length*.42,.24,0,.48,.2,.62,'#3a504a');
    if(covered)at('canvas',-.35,.42,0,length*.44,.14,.93,'#4f6b7c');
  };

  // Each side crossing has a short stone arch instead of a broad floating slab.
  for(const [index,crossing] of LIVE_CANAL_CROSSINGS.entries()){
    if(index===2||index===4)continue;
    const center=(crossing.minX+crossing.maxX)/2,w=crossing.maxX-crossing.minX;
    for(const side of [-1,1]){
      const x=side<0?crossing.minX-.13:crossing.maxX+.13,parapetX=side<0?crossing.minX-.12:crossing.maxX+.12;
      // Capping centred on the parapet collider and 1 cm proud of it; it stood 11 cm above, where bullets passed.
      stone(`canal-footbridge-coping-${index}-${side}`,parapetX,.8,.3,.3,.12,5.06);
      for(let i=0;i<16;i++){
        const t=(i+.5)*Math.PI/16,z=.3-Math.cos(t)*2.5,y=-2.24+Math.sin(t)*2.07;
        stone(`canal-footbridge-arch-${index}-${side}-${i}`,x,y,z,.18,.26,.45,i%3?'#b8a487':'#d5c3a2').rotation.x=Math.atan2(-Math.cos(t)*2.07,Math.sin(t)*2.5);
      }
    }
    stone(`canal-footbridge-keystone-${index}`,center,-.12,.3,w,.18,.28);
  }

  // Close-set palazzi continue the canal beyond the arena; no grassy river banks.
  for(const x of [-78,-64,-50,49,63,77])for(const face of [-1,1]){
    const id=`canal-palazzo-${x}-${face}`,height=9+(Math.abs(x)%4),z=face<0?-7.2:7.8,front=face<0?-2.18:2.78;
    const color=['#c28f7c','#d1b98b','#b9b7a2'][Math.abs(x)%3];
    box(id,x,height/2,z,13.7,height,10,color);
    stone(`${id}-water-footing`,x,-1.25,z,13.7,2.5,10,'#929782');
    box(`${id}-tile-roof`,x,height+.12,z,14,.24,10.3,'#a5644c');
    stone(`${id}-cornice`,x,height-.15,front,13.9,.24,.24);
    for(const dx of [-4.4,0,4.4])for(const y of [2.5,5.4,8.3].filter(v=>v<height-.8)){
      stone(`${id}-frame-${dx}-${y}`,x+dx,y,front,1.6,2.05,.08);
      box(`${id}-shutter-${dx}-${y}`,x+dx,y,front-face*.06,1.32,1.8,.08,'#42645b');
      stone(`${id}-sill-${dx}-${y}`,x+dx,y-1.04,front-face*.1,1.78,.12,.25);
    }
  }

  // Narrow canal: mooring poles and restrained reflections, no mid-channel rubble.
  for(const x of [-25,-11,11,25]){
    post(`canal-mooring-${x}`,x,1.85,.35,true);
    post(`canal-mooring-pair-${x}`,x+1.4,1.85,.2);
  }
  boat('canal-moored-gondola-west',-12.4,1.08,4.4,0,true);
  boat('canal-moored-gondola-east',11.4,1.08,4.1,0,true);
  // Distinctive upper balconies on the B-side canal house, within its clearance margin.
  for(const x of [23.4,26.6]){
    stone(`b-canal-balcony-slab-${x}`,x,4.1,-2.08,1.8,.14,.25);
    for(const dx of [-.75,-.38,0,.38,.75])box(`b-canal-balcony-iron-${x}-${dx}`,x+dx,4.58,-1.99,.025,.85,.025,'#3d534d');
    box(`b-canal-balcony-rail-${x}`,x,5.02,-1.99,1.85,.04,.04,'#3d534d');
  }
  // The Mercato di Fontessa gate over the canal stair (stone portal, roof terrace, stairwell cheeks).
  buildMercatoGate(scene,b,surfaces);
  // Striped grocer's awning fixed to the market house under its first-floor sills and sized to the shop bay.
  const wallZ=7.4,rootY=2.72,reach=.85,drop=.22,awningX=24.45,awningW=2.6,slope=Math.atan2(drop,reach),run=Math.hypot(reach,drop);
  for(let s=0;s<10;s++){
    const x=awningX-awningW/2+(s+.5)*awningW/10,color=s%2?'#e8dcc0':'#955a51';
    box(`b-canal-shop-awning-${s}`,x,rootY-drop/2,wallZ-reach/2,awningW/10+.002,.02,run,color).rotation.x=-slope;
    box(`b-canal-shop-valance-${s}`,x,rootY-drop-.07,wallZ-reach-.01,awningW/10+.002,.15,.015,color);
  }
  box('b-canal-shop-awning',awningX,rootY+.03,wallZ-.06,awningW+.1,.1,.1,'#69533e');
  box('b-canal-shop-awning-front-bar',awningX,rootY-drop+.005,wallZ-reach,awningW+.04,.04,.04,'#3d4541');
  // Folding arms: wall bracket 0.3 m under the roller, rising to the front bar.
  const bracketY=rootY-.3,frontY=rootY-drop;
  for(const ax of [awningX-awningW/2+.15,awningX+awningW/2-.15]){
    const arm=box(`b-canal-shop-awning-arm-${ax.toFixed(1)}`,ax,(bracketY+frontY)/2,wallZ-reach/2,.025,.025,Math.hypot(reach,frontY-bracketY),'#3d4541');
    arm.rotation.x=Math.atan2(frontY-bracketY,reach);
    box(`b-canal-shop-awning-bracket-${ax.toFixed(1)}`,ax,bracketY,wallZ-.03,.06,.1,.06,'#3d4541');
  }

  // Port beyond CT: continuous quay wall, landing pier, fenders, piles and working boats.
  stone('port-seawall',0,-1.5,44.5,230,3,.3,'#8c9686');
  stone('port-quay-coping',0,-.08,44.4,230,.16,.48);
  stone('port-pier-deck',0,-.17,51.5,8,.34,14.2);
  for(const x of [-3.7,3.7])for(const z of [46,51,57]){
    post(`port-pier-pile-${x}-${z}`,x,z,.75);
    const fender=detail(MeshBuilder.CreateTorus(`port-rubber-fender-${x}-${z}`,{diameter:.6,thickness:.13,tessellation:12},scene),'#344541');
    fender.position.set(x,-.6,z);fender.rotation.z=Math.PI/2;
  }
  boat('port-police-launch',-7,51,6.4,Math.PI/2);
  box('port-police-cabin',-7,-.42,51,1.55,.9,2.2,'#d6ceb6');
  box('port-police-windscreen',-7,.03,49.98,1.22,.48,.04,'#42656b');
  boat('port-cargo-skiff',8,54,7,Math.PI/2,true);
  for(const x of [-11,11]){
    post(`port-quay-mooring-${x}`,x,44.65,.65,true);
    box(`port-coiled-rope-base-${x}`,x,.07,44,.5,.14,.5,'#a58f60');
  }
  // The port opens to water; distant marker piles supply scale without closing the skyline.
  for(const x of [-32,30])post(`port-channel-marker-${x}`,x,74,2.3,true);
}
