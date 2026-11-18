import {liveCutPavingRect} from './fpsLiveTerrain.ts';
import { MeshBuilder, Mesh, VertexData, Vector3, type Scene, type StandardMaterial } from '@babylonjs/core';
import { LIVE_FPS_MAP, type LiveSolid } from './fpsLiveMap.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import {buildVillageMarket} from './fpsVillageMarket.ts';
import {buildVillageFurnishings} from './fpsVillageFurnishings.ts';
import { LIVE_SURFACE_METRES, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';

export interface VillageBuilder {
  box:(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>Mesh;
  detail:<T extends Mesh>(mesh:T,color:string)=>T;
}

interface BuildingStyle {
  shutter:string;
  door:string;
  frame:string;
  quoins?:boolean;
  shopFaces?:('n'|'s'|'e'|'w')[];
  rollingShop?:boolean;
}

function buildingStyle(id:string):BuildingStyle {
  if(id==='mid-west-lower')return {shutter:'#3b6248',door:'#dfd4be',frame:'#e2d4b4',quoins:true,shopFaces:['e','s']};
  if(id==='mid-west-upper')return {shutter:'#486e52',door:'#5f4c3a',frame:'#dfd2b4',quoins:true,shopFaces:['e'],rollingShop:true};
  if(id==='apartments-south')return {shutter:'#6c523b',door:'#475e56',frame:'#d9cca9',quoins:true};
  if(id==='apartments-north')return {shutter:'#486268',door:'#5b4938',frame:'#dfd2b4',quoins:true};
  if(id==='customs-warehouse-east'||id==='freight-office-east')return {shutter:'#4f7257',door:'#68523d',frame:'#dfd1b0',quoins:true,shopFaces:['w'],rollingShop:true};
  if(id==='east-container')return {shutter:'#486e52',door:'#6a503a',frame:'#e0d2b0',quoins:true,shopFaces:['w','s'],rollingShop:true};
  if(id==='b-screen'||id==='pump-house')return {shutter:'#8f4239',door:'#e0d5be',frame:'#e2d5b7',quoins:true};
  if(id==='b-canal-house')return {shutter:'#476b59',door:'#dfd4be',frame:'#dfd1b2',quoins:true};
  if(id==='b-market-west-house')return {shutter:'#46704e',door:'#e2d7c1',frame:'#dfd2b4',quoins:true,shopFaces:['e'],rollingShop:true};
  if(id==='a-loggia-wall'||id==='a-screen')return {shutter:'#526b6e',door:'#485c55',frame:'#dfd2b5',quoins:true};
  return {shutter:'#527566',door:'#66523e',frame:'#dfd2b4',quoins:id!=='north-divider'};
}

/** Architecture and furnishings are attached to admitted cover; lanes contain no loose crate filler. */
/** Repeat a surface texture every `metres` across a large ground instead of stretching it once. */
function tileGround(mesh:Mesh,width:number,depth:number,metres:number):void {
  const u=width/metres,v=depth/metres,uv=mesh.getVerticesData('uv');
  if(!uv)return;
  for(let i=0;i<uv.length;i+=2){uv[i]*=u;uv[i+1]*=v;}
  mesh.setVerticesData('uv',uv);
}
const FACADE_NEIGHBOURS=LIVE_FPS_MAP.solids.filter(s=>!s.id.startsWith('mid-window-furniture-'));
/**
 * True when a facade feature's envelope would be buried in, or cut through, a neighbouring solid. Windows,
 * doors and quoins on faces that abut another building are skipped, so shutters never poke through a
 * neighbour's wall or roof and no hidden geometry is generated. Visual only: collision is not consulted for movement.
 */
export function liveFacadeBlocked(selfId:string,minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number):boolean {
  return FACADE_NEIGHBOURS.some(s=>s.id!==selfId&&s.minX<maxX-.02&&s.maxX>minX+.02&&(s.baseY??0)<maxY-.02&&s.height>minY+.02&&s.minZ<maxZ-.02&&s.maxZ>minZ+.02);
}
export function buildVillageArchitecture(scene:Scene,b:VillageBuilder,material:(hex:string)=>StandardMaterial,surfaces?:LiveSurfaceLibrary):void {
  const {box,detail}=b;
  /** Feature envelope on a Z-facing face (x along the face) or X-facing face (z along the face). */
  const blockedZ=(id:string,x:number,halfW:number,minY:number,maxY:number,fz:number,face:number,depth=.32)=>liveFacadeBlocked(id,x-halfW,x+halfW,minY,maxY,Math.min(fz,fz+face*depth),Math.max(fz,fz+face*depth));
  const blockedX=(id:string,z:number,halfW:number,minY:number,maxY:number,fx:number,side:number,depth=.32)=>liveFacadeBlocked(id,Math.min(fx,fx+side*depth),Math.max(fx,fx+side*depth),minY,maxY,z-halfW,z+halfW);
  const triangularPrism=(name:string,positions:number[],color:string)=>{
    const mesh=detail(new Mesh(name,scene),color),data=new VertexData(),normals:number[]=[];
    data.positions=positions;
    data.indices=[0,1,2,5,4,3,0,3,4,0,4,1,1,4,5,1,5,2,2,5,3,2,3,0];
    VertexData.ComputeNormals(data.positions,data.indices,normals);data.normals=normals;data.applyToMesh(mesh);
    return mesh;
  };
  const roof=(id:string,x:number,z:number,w:number,d:number,y:number,color='#a96548',withChimneys=y>=5.2)=>{
    const alongX=w>d*1.15;
    const span=alongX?d:w,run=alongX?w:d;
    const rise=Math.min(1.25,.28+span*.055),angle=Math.atan2(rise,span/2+.18),panel=Math.hypot(span/2+.18,rise);
    for(const side of [-1,1]){
      const part=box(`${id}-tile-roof-${side}`,alongX?x:x+side*(w/4+.09),y+rise/2,alongX?z+side*(d/4+.09):z,alongX?w+.4:panel,.12,alongX?panel:d+.4,color);
      if(alongX)part.rotation.x=side<0?-angle:angle;
      else part.rotation.z=side<0?angle:-angle;
      if(surfaces)part.material=surfaces.material('clay',color);
      // Timber eave corbels under the overhang match authentic Mediterranean eaves.
      const spanLimit=run/2-.7;
      for(let at=-spanLimit;at<=spanLimit+.01;at+=2.2){
        box(`${id}-corbel-${side}-${at.toFixed(1)}`,alongX?x+at:x+side*(w/2+.05),y-.08,alongX?z+side*(d/2+.05):z+at,.12,.14,.12,'#6e553d');
      }
      const face=(alongX?x:z)+side*(run/2+.06);
      const halfSpan=span/2+.18;
      if(alongX){
        triangularPrism(`${id}-gable-${side}`,[
          face-.035,y,z-halfSpan,face-.035,y,z+halfSpan,face-.035,y+rise,z,
          face+.035,y,z-halfSpan,face+.035,y,z+halfSpan,face+.035,y+rise,z,
        ],'#d2bc96');
      }else{
        triangularPrism(`${id}-gable-${side}`,[
          x-halfSpan,y,face-.035,x+halfSpan,y,face-.035,x,y+rise,face-.035,
          x-halfSpan,y,face+.035,x+halfSpan,y,face+.035,x,y+rise,face+.035,
        ],'#d2bc96');
      }
    }
    box(`${id}-ridge`,x,y+rise,z,alongX?w+.48:.2,.16,alongX?.2:d+.48,'#aa6245');
    if(withChimneys){
      const count=run>=11?2:1;
      for(let i=0;i<count;i++){
        const along=count===1?-run*.18:(i===0?-run*.28:run*.24);
        const cx=alongX?x+along:x+(i%2?-.65:.65),cz=alongX?z+(i%2?-.55:.55):z+along;
        const topY=y+rise*.82;
        box(`${id}-chimney-shaft-${i}`,cx,topY+.28,cz,.48,.78,.48,'#d4c7ab');
        box(`${id}-chimney-cap-${i}`,cx,topY+.69,cz,.6,.08,.6,'#c5b698');
        const pot=detail(MeshBuilder.CreateCylinder(`${id}-chimney-pot-${i}`,{height:.28,diameterTop:.18,diameterBottom:.24,tessellation:10},scene),'#b56e50');
        pot.position.set(cx,topY+.86,cz);
      }
    }
  };
  const door=(id:string,x:number,z:number,height:number,width:number,dirX:number,dirZ:number,style:BuildingStyle,wide=false)=>{
    const h=Math.min(2.35,height-.32),w=Math.min(wide?1.6:1.28,width*.46);
    const frameThick=.065,leafOut=.038;
    const isZ=dirZ!==0;
    box(`${id}-door-surround`,x,h/2+.06,z,isZ?w+.28:frameThick,h+.2,isZ?frameThick:w+.28,style.frame);
    box(`${id}-door-cornice`,x+dirX*.045,h+.18,z+dirZ*.045,isZ?w+.42:.16,.13,isZ?.16:w+.42,style.frame);
    box(`${id}-timber-door`,x+dirX*leafOut,h/2,z+dirZ*leafOut,isZ?w:.045,h,isZ?.045:w,style.door);
    for(const side of [-1,1]){
      box(`${id}-door-leaf-${side}`,x+dirX*(leafOut+.022)+(isZ?side*w*.23:0),h*.5,z+dirZ*(leafOut+.022)+(isZ?0:side*w*.23),isZ?w*.34:.022,h*.78,isZ?.022:w*.34,'#c5b89e');
      box(`${id}-door-ring-${side}`,x+dirX*(leafOut+.045)+(isZ?side*w*.1:0),h*.48,z+dirZ*(leafOut+.045)+(isZ?0:side*w*.1),.04,.07,.04,'#c4a463');
    }
    box(`${id}-door-step`,x+dirX*.12,.04,z+dirZ*.12,isZ?w+.36:.28,.08,isZ?.28:w+.36,'#b3a68c');
  };
  const quoins=(wall:LiveSolid)=>{
    const w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ;
    if(w<1.4||d<1.4)return;
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const cx=sx<0?wall.minX+.08:wall.maxX-.08,cz=sz<0?wall.minZ+.08:wall.maxZ-.08;
      let idx=0;
      for(let y=.56;y<wall.height-.25;y+=.48,idx++){
        const big=idx%2===0,qw=big?.38:.26,qd=big?.26:.38,qx=cx+sx*.025,qz=cz+sz*.025;
        if(liveFacadeBlocked(wall.id,qx-qw/2,qx+qw/2,y-.11,y+.11,qz-qd/2,qz+qd/2))continue;
        box(`${wall.id}-quoin-${sx}-${sz}-${idx}`,qx,y,qz,qw,.22,qd,idx%3?'#d9ccb0':'#cdc0a2');
      }
    }
  };
  const shutterWindowZ=(key:string,at:number,floor:number,fz:number,face:number,style:BuildingStyle,angleSeed:number,tall=false)=>{
    const h=tall?1.65:1.3,recessH=tall?1.45:1.08;
    box(`${key}-window-frame`,at,floor,fz,1.16,h,.065,style.frame);
    box(`${key}-window-recess`,at,floor,fz+face*.035,.96,recessH,.035,'#2e4549');
    box(`${key}-interior-ceiling`,at,floor+recessH/2-.03,fz+face*.14,.94,.04,.22,'#a99b7c');
    const curtain=box(`${key}-window-curtain`,at-.28,floor,fz+face*.1,.18,recessH*.9,.03,'#d7cab0');curtain.rotation.y=.18;
    box(`${key}-window-lamp`,at+.2,floor-.14,fz+face*.05,.16,.2,.03,'#d4ad67');
    if(!tall)box(`${key}-window-sill`,at,floor-h/2-.05,fz+face*.06,1.3,.1,.22,'#cdbf9d');
    const swing=[.82,.52,.16][Math.round(Math.abs(angleSeed))%3];
    for(const side of [-1,1]){
      const sh=box(`${key}-shutter-${side}`,at+side*(.52+swing*.22),floor,fz+face*(.07+swing*.1),.44,recessH,.045,style.shutter);
      sh.rotation.y=side*face*swing;
    }
  };
  const shutterWindowX=(key:string,at:number,floor:number,fx:number,side:number,style:BuildingStyle,angleSeed:number)=>{
    box(`${key}-window-frame`,fx,floor,at,.065,1.25,1.1,style.frame);
    box(`${key}-window-recess`,fx+side*.035,floor,at,.03,1.02,.9,(Math.round(at+floor)%3)?'#334a4d':'#8d724c');
    const swing=[.8,.48,.14][Math.round(Math.abs(angleSeed))%3];
    for(const leaf of [-1,1]){
      const sh=box(`${key}-shutter-${leaf}`,fx+side*(.07+swing*.1),floor,at+leaf*(.48+swing*.2),.045,1.02,.42,style.shutter);
      sh.rotation.y=leaf*swing;
    }
    box(`${key}-window-planter`,fx+side*.13,floor-.66,at,.2,.14,.84,'#a97b58');
    for(let plant=0;plant<3;plant++){
      const leaves=detail(MeshBuilder.CreateSphere(`${key}-herb-${plant}`,{diameter:.2,segments:5},scene),plant%2?'#6d8553':'#8a965f');
      leaves.position.set(fx+side*.15,floor-.52,at-.24+plant*.24);
    }
  };
  const shopBay=(key:string,cx:number,cz:number,isZ:boolean,dir:number,wSpan:number,rolling:boolean)=>{
    const bayW=Math.min(2.35,wSpan-.9);
    box(`${key}-arch-ring`,cx,1.42,cz,isZ?bayW+.3:.1,2.65,isZ?.1:bayW+.3,'#dad0b6');
    box(`${key}-shop-recess`,cx+(!isZ?dir*.03:0),1.32,cz+(isZ?dir*.03:0),isZ?bayW:.05,2.35,isZ?.05:bayW,rolling?'#677170':'#283d41');
    if(rolling){
      for(let s=0;s<7;s++){
        box(`${key}-rolling-slat-${s}`,cx+(!isZ?dir*.06:0),.42+s*.28,cz+(isZ?dir*.06:0),isZ?bayW-.08:.025,.14,isZ?.025:bayW-.08,s%2?'#7f8886':'#6c7472');
      }
      box(`${key}-shutter-box`,cx+(!isZ?dir*.08:0),2.56,cz+(isZ?dir*.08:0),isZ?bayW+.12:.14,.24,isZ?.14:bayW+.12,'#a49e8d');
    }else{
      for(const off of [-bayW*.34,0,bayW*.34])box(`${key}-mullion-${off}`,cx+(!isZ?dir*.055:off),1.32,cz+(isZ?dir*.055:off),.04,2.3,.04,'#dfd3b4');
      box(`${key}-window-shelf`,cx+(!isZ?dir*.12:0),.32,cz+(isZ?dir*.12:0),isZ?bayW+.18:.22,.16,isZ?.22:bayW+.18,'#b6a88a');
    }
    const sconceY=2.72;
    box(`${key}-sconce-arm`,cx+(!isZ?dir*.16:bayW*.58),sconceY,cz+(isZ?dir*.16:bayW*.58),isZ?.05:.22,.05,isZ?.22:.05,'#3d4541');
    box(`${key}-sconce-lantern`,cx+(!isZ?dir*.24:bayW*.58),sconceY-.14,cz+(isZ?dir*.24:bayW*.58),.14,.2,.14,'#e0b668');
  };
  const utilityBox=(key:string,x:number,y:number,z:number,isZ:boolean,dir:number)=>{
    box(`${key}-meter`,x+(!isZ?dir*.03:0),y,z+(isZ?dir*.03:0),isZ?.28:.06,.38,isZ?.06:.28,'#dad3c2');
    box(`${key}-meter-door`,x+(!isZ?dir*.065:0),y,z+(isZ?dir*.065:0),isZ?.22:.015,.3,isZ?.015:.22,'#c7bfae');
  };

  const campanile=(wall:LiveSolid)=>{
    const w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ,x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    box('a-crates-base-plinth',x,.22,z,w+.18,.44,d+.18,'#9f957f');
    quoins(wall);
    for(const y of [2.55,4.02,6.22])box(`a-crates-stringcourse-${y}`,x,y,z,w+.16,.14,d+.16,'#d9ccb0');
    door('a-crates-portal',wall.maxX+.025,z,wall.height,d,1,0,buildingStyle('a-crates'),true);
    for(const face of [-1,1]){
      const fz=face<0?wall.minZ-.045:wall.maxZ+.045;
      const clock=detail(MeshBuilder.CreateDisc(`a-crates-clock-${face}`,{radius:.92,tessellation:32},scene),'#ece1c3');
      clock.position.set(x,5.05,fz);clock.rotation.y=face>0?Math.PI:0;
      detail(MeshBuilder.CreateTorus(`a-crates-clock-rim-${face}`,{diameter:1.92,thickness:.11,tessellation:28},scene),'#b5a583').position.set(x,5.05,fz);
      box(`a-crates-hour-hand-${face}`,x-.12,5.2,fz+face*.02,.08,.56,.02,'#3c4d4c').rotation.z=-.55;
      box(`a-crates-minute-hand-${face}`,x+.16,4.9,fz+face*.022,.07,.78,.02,'#3c4d4c').rotation.z=-.7;
      box(`a-crates-belfry-arch-${face}`,x,5.88,fz,.9,.55,.04,'#314242');
    }
    for(const side of [-1,1]){
      const fx=side<0?wall.minX-.045:wall.maxX+.045;
      const clock=detail(MeshBuilder.CreateDisc(`a-crates-side-clock-${side}`,{radius:.92,tessellation:32},scene),'#ece1c3');
      clock.position.set(fx,5.05,z);clock.rotation.y=side>0?-Math.PI/2:Math.PI/2;
      box(`a-crates-side-hour-${side}`,fx+side*.02,5.2,z-.12,.02,.56,.08,'#3c4d4c').rotation.x=-.55;
      box(`a-crates-side-minute-${side}`,fx+side*.022,4.9,z+.16,.02,.78,.07,'#3c4d4c').rotation.x=.7;
      box(`a-crates-side-belfry-${side}`,fx,5.88,z,.04,.55,.9,'#314242');
    }
    const bell=detail(MeshBuilder.CreateCylinder('a-crates-campanile-bell',{height:.62,diameterTop:.36,diameterBottom:.68,tessellation:14},scene),'#8f7245');
    bell.position.set(x,5.88,z);
    const pyr=detail(MeshBuilder.CreateCylinder('a-crates-campanile-roof',{height:1.85,diameterTop:.22,diameterBottom:w*1.32,tessellation:4},scene),'#a96548');
    pyr.position.set(x,wall.height+.92,z);pyr.rotation.y=Math.PI/4;
    if(surfaces)pyr.material=surfaces.material('clay','#a96548');
    const spire=detail(MeshBuilder.CreateCylinder('a-crates-campanile-spire',{height:.85,diameterTop:.03,diameterBottom:.18,tessellation:8},scene),'#bfa15e');
    spire.position.set(x,wall.height+2.15,z);
  };

  const pavilion=(wall:LiveSolid)=>{
    const w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ,x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    const style=buildingStyle(wall.id);
    box(`${wall.id}-footing`,x,.16,z,w+.07,.32,d+.07,'#a69a80');
    box(`${wall.id}-cornice`,x,wall.height-.08,z,w+.12,.14,d+.12,'#dfd2b5');
    quoins(wall);
    roof(wall.id,x,z,w,d,wall.height,'#a96548',false);
    if(wall.id==='mid-approach-screen'){
      for(const face of [-1,1]){
        const fz=face<0?wall.minZ-.04:wall.maxZ+.04;
        box(`mid-approach-edicola-${face}`,x,1.65,fz,2.1,1.65,.06,'#d8cab0');
        box(`mid-approach-edicola-board-${face}`,x,1.65,fz+face*.035,1.8,1.3,.03,'#5e6457');
      }
      // Classic Italian cast-iron village water standpipe (fontanella) on the south face.
      const fontZ=wall.minZ-.14;
      const col=detail(MeshBuilder.CreateCylinder('village-fontanella-column',{height:1.05,diameter:.22,tessellation:12},scene),'#3f6351');
      col.position.set(x,.54,fontZ);
      const cap=detail(MeshBuilder.CreateSphere('village-fontanella-cap',{diameter:.28,segments:10},scene),'#3f6351');
      cap.position.set(x,1.1,fontZ);
      box('village-fontanella-spout',x,.74,fontZ-.14,.04,.04,.16,'#b5985a');
      const basin=detail(MeshBuilder.CreateCylinder('village-fontanella-basin',{height:.14,diameterTop:.52,diameterBottom:.34,tessellation:14},scene),'#9c9684');
      basin.position.set(x,.1,fontZ-.06);
      return;
    }
    if(wall.id==='b-car'){
      shopBay('b-car-kiosk',x,wall.minZ-.025,true,-1,w,true);
      utilityBox('b-car-box',x+1.35,1.25,wall.minZ-.02,true,-1);
      return;
    }
    if(wall.id==='b-coffins'){
      const fx=wall.maxX+.04;
      const awn=box('b-coffins-flower-awning',fx+.22,wall.height-.22,z,.55,.06,d-.2,'#4c7758');awn.rotation.z=.15;
      // Stripes follow the awning's tilt so they lie on the canvas instead of hovering over its low edge.
      for(let s=0;s<4;s++)box(`b-coffins-awning-stripe-${s}`,fx+.22,wall.height-.22+.037,z-d*.3+s*d*.2,.54,.014,.28,'#ebe1c4').rotation.z=.15;
      box('b-coffins-display-ledge',fx+.09,1.02,z,.24,.09,d-.35,'#8f6e49');
      const bloomPalette=['#cf5848','#e2b64d','#a85c88','#e88c5d'];
      for(let p=0;p<5;p++){
        const pz=z-d*.34+p*(d*.17);
        const pot=detail(MeshBuilder.CreateCylinder(`b-coffins-pot-${p}`,{height:.28,diameterTop:.22,diameterBottom:.15,tessellation:10},scene),'#b56e50');
        pot.position.set(fx+.1,1.2,pz);
        const flower=detail(MeshBuilder.CreateSphere(`b-coffins-bloom-${p}`,{diameter:.24,segments:7},scene),bloomPalette[p%bloomPalette.length]);
        flower.position.set(fx+.1,1.38,pz);
      }
      return;
    }
    if(wall.id==='west-container'){
      shopBay('west-workshop-door',wall.maxX+.025,z,false,1,d,false);
      for(const face of [-1,1])shutterWindowZ(`west-workshop-win-${face}`,x,2.05,face<0?wall.minZ-.025:wall.maxZ+.025,face,style,face);
      return;
    }
    // Service vaults and stores get recessed stone blind arches and louvered vents.
    for(const face of [-1,1]){
      const fz=face<0?wall.minZ-.025:wall.maxZ+.025;
      box(`${wall.id}-blind-arch-${face}`,x,wall.height*.46,fz,Math.min(1.5,w*.48),wall.height*.68,.045,'#c7baa0');
      box(`${wall.id}-vent-${face}`,x,wall.height*.55,fz+face*.025,Math.min(.9,w*.32),.55,.02,'#485754');
    }
    utilityBox(wall.id,x,1.25,wall.minZ-.02,true,-1);
  };

  const building=(wall:LiveSolid)=>{
    const design=liveVillageAsset(wall.id),w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ,x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    if(design.kind==='clock'){campanile(wall);return;}
    if(wall.height<=3.2){pavilion(wall);return;}
    const style=buildingStyle(wall.id);
    roof(wall.id,x,z,w,d,wall.height);
    if(style.quoins)quoins(wall);
    if(wall.id!=='a-loggia-wall')box(`${wall.id}-stringcourse`,x,2.76,z,w+.12,.12,d+.12,'#d9ccb0');
    box(`${wall.id}-eave-cornice`,x,wall.height-.11,z,w+.15,.16,d+.15,'#dfd2b5');

    // Divide the long market residential wing into four distinct townhouse bays along its west street face.
    if(wall.id==='market-residential-wing'){
      const bayColors=['#d4a26a','#c87d68','#dfd6c0','#c4cbb2'];
      for(let bIdx=0;bIdx<4;bIdx++){
        const bz=-24.3+bIdx*10.9;
        box(`market-bay-plaster-${bIdx}`,wall.minX-.015,wall.height/2,bz,.02,wall.height-.2,10.5,bayColors[bIdx]);
        if(bIdx>0)box(`market-bay-pilaster-${bIdx}`,wall.minX-.045,wall.height/2,bz-5.45,.09,wall.height,.32,'#dad0b6');
      }
    }

    for(const face of [-1,1]){
      const fz=face<0?wall.minZ-.028:wall.maxZ+.028;
      box(`${wall.id}-footing-${face}`,x,.195,fz,w,.38,.05,'#a69a80');
      const skipDoor=(wall.id==='a-loggia-wall'&&face<0)||(wall.id==='b-canal-house'&&face>0)||(wall.id==='mid-backstop'&&face<0)||(wall.id==='a-screen'&&face<0);
      if(!skipDoor){
        const shopDir=face<0?'s':'n';
        if(style.shopFaces?.includes(shopDir)){if(!blockedZ(wall.id,x,Math.min(2.35,w-.9)/2+.2,.1,2.9,fz,face))shopBay(`${wall.id}-shop-${face}`,x,fz,true,face,w,!!style.rollingShop);}
        else {
          const doorX=wall.id==='b-screen'&&face<0?18.1:x;
          if(!blockedZ(wall.id,doorX,Math.min(1.28,w*.46)/2+.22,.1,2.6,fz,face))door(`${wall.id}-${face}`,doorX,fz,wall.height,w,0,face,style);
        }
      }
      for(let floor=3.5;floor<wall.height-.55;floor+=2.25)for(let at=wall.minX+1.25;at<wall.maxX-.7;at+=2.65){
        if(wall.id==='a-loggia-wall'&&face<0&&floor<5.7)continue;
        if(wall.id==='b-canal-house'&&face>0&&floor<4.2)continue;
        if(blockedZ(wall.id,at,.95,floor-.75,floor+.75,fz,face))continue;
        shutterWindowZ(`${wall.id}-${face}-${floor}-${at.toFixed(1)}`,at,floor,fz,face,style,Math.round(at+floor));
      }
      if(wall.id==='b-canal-house'&&face>0){
        for(const bx of [23.4,26.6])shutterWindowZ(`${wall.id}-balcony-door-${bx}`,bx,4.98,fz,face,style,Math.round(bx),true);
      }
    }
    const promenadeDoors=[-24,-16,-8,0,8];
    for(const side of [-1,1]){
      const fx=side<0?wall.minX-.028:wall.maxX+.028;
      box(`${wall.id}-side-footing-${side}`,fx,.195,z,.05,.38,Math.max(.2,d-.12),'#a69a80');
      const shopDir=side<0?'w':'e';
      if(style.shopFaces?.includes(shopDir)&&d>=4&&wall.id!=='b-apartments-back'){
        const shopZ=wall.id==='customs-warehouse-east'||wall.id==='freight-office-east'?z-2.5:z;
        if(!blockedX(wall.id,shopZ,Math.min(2.35,Math.min(d,3.4)-.9)/2+.2,.1,2.9,fx,side))shopBay(`${wall.id}-side-shop-${side}`,fx,shopZ,false,side,Math.min(d,3.4),!!style.rollingShop);
      }
      if(!(wall.id==='b-apartments-back'&&side<0)){
        const floors=[3.5,5.75].filter(y=>y<wall.height-.6);
        for(const y of floors)for(let at=wall.minZ+1.3;at<wall.maxZ-.8;at+=2.8){
          if(wall.id==='market-residential-wing'&&side<0&&y<4.5&&promenadeDoors.some(dz=>Math.abs(at-dz)<1.55))continue;
          if(wall.id==='mid-west-lower'&&side>0&&y<4.2)continue;
          if(wall.id==='customs-warehouse-east'&&side<0&&y<4.2&&at>-14.8&&at<-10.2)continue;
          if(blockedX(wall.id,at,.9,y-.8,y+.65,fx,side))continue;
          shutterWindowX(`${wall.id}-${side}-${y}-${at.toFixed(1)}`,at,y,fx,side,style,Math.round(at+y));
        }
      }
      if(!blockedX(wall.id,wall.minZ+.18,.1,.2,wall.height-.1,fx,side,.2)){
        box(`${wall.id}-rain-pipe-${side}`,fx,wall.height/2,wall.minZ+.18,.07,wall.height-.15,.07,'#5a6860');
        box(`${wall.id}-rain-hopper-${side}`,fx,wall.height-.25,wall.minZ+.18,.18,.16,.18,'#6c7a72');
      }
      if(side>0&&d>=4&&!blockedX(wall.id,wall.minZ+.9,.16,1.1,1.5,fx,side,.1))utilityBox(`${wall.id}-util-${side}`,fx,1.3,wall.minZ+.9,false,side);
    }
    if(design.kind==='shop'&&wall.id.startsWith('b-')){
      const fz=wall.minZ-.11;
      box(`${wall.id}-display-shelf`,x,1.04,fz,Math.min(w-.3,2.6),.09,.21,'#8f704c');
      for(let i=0;i<8;i++){
        const fruit=detail(MeshBuilder.CreateSphere(`${wall.id}-market-goods-${i}`,{diameter:.16,segments:8},scene),i%3?'#cb9d49':'#73844a');
        fruit.position.set(x-.9+i*.25,1.18+(i%2)*.02,fz-.015);
      }
      const awning=box(`${wall.id}-shop-awning`,x,wall.height>4?2.85:wall.height-.18,fz-.18,w-.12,.06,.55,'#758b66');
      awning.rotation.x=-.13;
      for(let stripe=0;stripe<5;stripe++)box(`${wall.id}-awning-stripe-${stripe}`,x-w*.4+stripe*w*.2,(wall.height>4?2.85:wall.height-.18)+.036,fz-.18,w*.09,.012,.54,'#ded0aa').rotation.x=-.13;
    }
    if(wall.id==='mid-backstop'||wall.id==='a-screen'){
      const fz=wall.minZ-.055;
      box(`${wall.id}-notice-board-frame`,x,1.65,fz,Math.min(w-.35,2.7),1.3,.08,'#715b3f');
      for(let note=0;note<4;note++){
        const poster=box(`${wall.id}-notice-${note}`,x-.9+note*.58,1.65+(note%2)*.13,fz-.055,.43,.67,.014,note%2?'#e2d4ad':'#c4c6a2');poster.rotation.z=(note%3-1)*.05;
        for(let line=0;line<3;line++)box(`${wall.id}-notice-ink-${note}-${line}`,x-.9+note*.58,1.8+(note%2)*.13-line*.12,fz-.065,.27,.018,.006,'#827c65');
      }
    }
  };

  for(const wall of LIVE_FPS_MAP.solids){
    if(wall.id.startsWith('mid-window-furniture-'))continue;
    const design=liveVillageAsset(wall.id),x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2,w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ;
    if(['house','shop','civic','clock'].includes(design.kind))building(wall);
    else if(design.kind==='wall'){
      box(`${wall.id}-coping`,x,wall.height+.035,z,w+.09,.1,d+.09,'#d2c29e');
      if(/^(west|east|south)-wall|^(west|east)-outer-gate/.test(wall.id)){
        const alongZ=d>w,len=alongZ?d:w,steps=Math.max(1,Math.floor(len/6.5));
        for(let s=0;s<=steps;s++){
          const offset=-len/2+(steps===0?len/2:s*len/steps);
          const px=alongZ?x:x+offset,pz=alongZ?z+offset:z;
          box(`${wall.id}-pilaster-${s}`,px,wall.height/2+.05,pz,alongZ?w+.16:.42,wall.height+.12,alongZ?.42:d+.16,'#cfc0a0');
          if(s%2===0){
            const pot=detail(MeshBuilder.CreateCylinder(`${wall.id}-coping-pot-${s}`,{height:.22,diameterTop:.28,diameterBottom:.18,tessellation:10},scene),'#b56e50');
            pot.position.set(px,wall.height+.2,pz);
            const green=detail(MeshBuilder.CreateSphere(`${wall.id}-coping-bloom-${s}`,{diameter:.3,segments:6},scene),s%4?'#6c824e':'#cf9348');
            green.position.set(px,wall.height+.34,pz);green.scaling.y=.65;
          }
        }
      }
    }else if(design.kind==='timber'){
      for(let row=0;row<4;row++)for(let col=0;col<4;col++){
        const log=detail(MeshBuilder.CreateCylinder(`${wall.id}-fuel-log-${row}-${col}`,{height:d+.05,diameter:.35,tessellation:10},scene),'#8f714c');
        log.position.set(x-w*.36+col*w*.24,.24+row*.4,z);log.rotation.x=Math.PI/2;
      }
      box(`${wall.id}-rain-cover`,x,wall.height+.015,z,w,.045,d,'#6b7961');
    }else if(design.kind==='bench'){
      for(let slat=0;slat<4;slat++)box(`${wall.id}-seat-slat-${slat}`,x,wall.height+.01,z-d*.33+slat*(d*.22),w-.12,.06,d*.18,'#a98a5d');
      for(const side of [-1,1])box(`${wall.id}-armrest-${side}`,x+side*(w/2-.1),wall.height+.1,z,.08,.12,d-.08,'#4f645a');
    }
  }

  // Civic Palazzo Comunale portico arches, iron tie rods, pediment, doors, and courtyard seal.
  box('civic-loggia-eave',-23,3.94,25.65,10.1,.22,1.6,'#d7c8a6');
  for(const x of [-27.5,-24.6,-21.4,-18.5]){
    box(`civic-loggia-capital-${x}`,x,3.73,26,.68,.18,.68,'#ded1af');
    box(`civic-loggia-column-base-${x}`,x,.15,26,.65,.3,.65,'#b7a887');
  }
  for(const [idx,[a,bX]] of [[-27.5,-24.6],[-24.6,-21.4],[-21.4,-18.5]].entries()){
    const mid=(a+bX)/2,half=(bX-a)/2-.12;
    for(let i=0;i<11;i++){
      const t=(i+.5)/11*Math.PI,vx=mid-Math.cos(t)*half,vy=3.05+Math.sin(t)*.66;
      // Voussoir width follows the local arc length so the flatter crown has no gaps between stones.
      const arc=Math.PI/11*Math.hypot(half*Math.sin(t),.66*Math.cos(t));
      const stone=box(`a-loggia-arch-ring-${idx}-${i}`,vx,vy,25.95,Math.max(.28,arc+.02),.16,.38,i%2?'#d6c8aa':'#c6b797');
      stone.rotation.z=Math.atan2(Math.cos(t)*.66,Math.sin(t)*half);
    }
    const rod=detail(MeshBuilder.CreateCylinder(`a-loggia-tie-rod-${idx}`,{height:bX-a-.24,diameter:.035,tessellation:6},scene),'#464d47');
    rod.rotation.z=Math.PI/2;rod.position.set(mid,3.1,25.95);
  }
  triangularPrism('civic-portico-pediment',[
    -28.05,4.05,24.84,-17.95,4.05,24.84,-23,5.5,24.84,
    -28.05,4.05,25.4,-17.95,4.05,25.4,-23,5.5,25.4,
  ],'#d6c5a2');
  box('civic-main-door-frame',-23,1.6,26.35,2.8,3.2,.08,'#e0cfab');
  for(const side of [-1,1]){
    box(`civic-main-door-${side}`,-23+side*.6,1.5,26.28,1.16,3,.05,'#4b645e');
    box(`civic-door-glazing-${side}`,-23+side*.6,2.15,26.24,.8,.95,.03,'#324c50');
    box(`civic-door-pull-${side}`,-23+side*.18,1.25,26.235,.045,.38,.04,'#b99e60');
    box(`civic-flag-pole-${side}`,-23+side*3.3,5.8,26.12,.055,2.4,.055,'#a9aa99');
    // Wall brackets tie each pole back to the palazzo facade (it previously stood free above the eave).
    for(const y of [4.8,6.85])box(`civic-flag-bracket-${side}-${y}`,-23+side*3.3,y,26.26,.05,.05,.3,'#5b605a');
    box(`civic-flag-${side}`,-23+side*3.3+.42,6.35,26.12,.82,.58,.035,side<0?'#527e77':'#b79e60');
  }
  const crest=detail(MeshBuilder.CreateDisc('civic-courtyard-seal',{radius:.43,tessellation:24},scene),'#b29b5c');
  crest.position.set(-23,4.55,24.825);
  box('civic-seal-center',-23,4.55,24.81,.5,.65,.03,'#466f68');
  const civicRing=detail(MeshBuilder.CreateTorus('civic-courtyard-paving-seal',{diameter:5,thickness:.055,tessellation:48},scene),'#a58b58');
  civicRing.position.set(-23,.038,21);civicRing.metadata={castShadow:false};
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,spoke=box(`civic-paving-inlay-${i}`,-23+Math.sin(angle)*1.45,.034,21+Math.cos(angle)*1.45,.1,.012,1.2,'#b89f6f');
    spoke.rotation.y=angle;spoke.metadata={castShadow:false};
  }

  // Arrival and customs quay courts.
  for(const [id,x,z] of [['arrival',0,-37],['customs-quay',0,40]] as [string,number,number][]){
    const medallion=detail(MeshBuilder.CreateGround(`village-${id}-court`,{width:13,height:8},scene),'#b9ad91');
    medallion.position.set(x,.016,z);medallion.material=surfaces?.material('paving','#b9ad91')??material('#b9ad91');
    medallion.metadata={castShadow:false};
  }
  buildVillageFurnishings(scene,b);
  buildVillageMarket(scene,b);

  // Raised market residential promenade paving and doorways.
  const galleryPaving=detail(MeshBuilder.CreateGround('market-gallery-tiled-promenade',{width:2.8,height:41.9},scene),'#b9ab8d');galleryPaving.position.set(31.9,1.814,-7);galleryPaving.setVerticesData('uv',[0,0,.7,0,0,10.5,.7,10.5]);galleryPaving.material=surfaces?.material('clay','#b9ab8d')??material('#b9ab8d');
  for(const z of [-24,-16,-8,0,8]){
    box(`market-gallery-door-frame-${z}`,33.47,2.93,z,.06,2.25,1.25,'#dfceaa');
    box(`market-gallery-door-${z}`,33.42,2.85,z,.035,2.08,1.07,'#4c7164');
    box(`market-gallery-door-handle-${z}`,33.38,2.8,z+.35,.04,.16,.04,'#b89a5e');
  }
  for(const z of [-46.5]){
    const road=detail(MeshBuilder.CreateGround(`village-connecting-street-${z}`,{width:10.8,height:20},scene),'#b5aa8e');road.position.set(0,-.004,z);road.material=surfaces?.material('paving','#b5aa8e')??material('#b5aa8e');
    for(const x of [-5.6,5.6])box(`village-street-gatepost-${x}-${z}`,x,1.1,z,.55,2.2,.55,'#cbbb99');
  }

  // Surrounding village backdrop, olive groves, and distant hills.
  for(const [i,r] of liveCutPavingRect({minX:-115,maxX:115,minZ:-125,maxZ:125}).entries()){
    const gw=r.maxX-r.minX,gd=r.maxZ-r.minZ;
    const outsideGround=detail(MeshBuilder.CreateGround(`village-outside-terrain-${i}`,{width:gw,height:gd},scene),'#71806a');
    outsideGround.position.set((r.minX+r.maxX)/2,-.12,(r.minZ+r.maxZ)/2);outsideGround.metadata={castShadow:false};
    if(surfaces){outsideGround.material=surfaces.material('grass','#71806a');tileGround(outsideGround,gw,gd,LIVE_SURFACE_METRES.grass*2.5);}
  }
  for(const [x,z,w,d] of [[-39,0,5,114],[46,0,5,114],[0,-48,104,5],[0,48,104,5]] as number[][]){
    for(const [i,r] of liveCutPavingRect({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}).entries()){
      const rw=r.maxX-r.minX,rd=r.maxZ-r.minZ;
      const road=detail(MeshBuilder.CreateGround(`village-outside-road-${x}-${z}-${i}`,{width:rw,height:rd},scene),'#aaa58a');road.position.set((r.minX+r.maxX)/2,-.09,(r.minZ+r.maxZ)/2);
      if(surfaces){road.material=surfaces.material('paving','#aaa58a');tileGround(road,rw,rd,LIVE_SURFACE_METRES.paving);}
    }
  }
  const outsidePalette=['#d29b79','#d8bc82','#b95a49','#dcd3be'];
  const outsideStyles:BuildingStyle[]=[
    {shutter:'#4f7257',door:'#66523e',frame:'#e2d5b7',quoins:true},{shutter:'#6c523b',door:'#475e56',frame:'#dfd2b4',quoins:true},
    {shutter:'#486268',door:'#5b4938',frame:'#e0d2b0',quoins:true},{shutter:'#8f4239',door:'#e0d5be',frame:'#e2d5b7',quoins:true},
  ];
  for(const [idx,[x,z,w,d,h]] of [[-50.5,-26,12,13,8],[-50.5,13,13,15,10],[-50.5,33,12,14,8],[56,-25,13,14,9],[56,13,12,15,8],[56,34,13,13,10],[-22,-57,14,12,8],[2,-64,15,12,9],[24,-57,14,12,7]].entries()){
    const id=`village-outside-house-${x}-${z}`,style=outsideStyles[idx%outsideStyles.length];
    box(id,x,h/2,z,w,h,d,outsidePalette[idx%outsidePalette.length]);
    roof(id,x,z,w,d,h,'#a96548',h>=8);
    const wall={id,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height:h} as LiveSolid;
    quoins(wall);
    box(`${id}-stringcourse`,x,2.76,z,w+.12,.12,d+.12,'#d9ccb0');
    box(`${id}-eave-cornice`,x,h-.11,z,w+.15,.16,d+.15,'#dfd2b5');
    box(`${id}-footing`,x,.195,z,w+.06,.38,d+.06,'#a69a80');
    // Faces turned toward the playable village get doors and shuttered windows; the far side stays plain.
    const inwardX=Math.abs(x)>45?(x<0?1:-1):0,inwardZ=Math.abs(x)>45?0:(z<0?1:-1);
    for(const face of [-1,1]){
      if(inwardX===0&&face!==inwardZ)continue;
      const fz=face<0?z-d/2-.028:z+d/2+.028;
      if(inwardX===0)door(`${id}-${face}`,x,fz,h,w,0,face,style);
      for(let floor=3.5;floor<h-.55;floor+=2.4)for(let at=x-w/2+1.6;at<x+w/2-1;at+=3.1)
        shutterWindowZ(`${id}-${face}-${floor}-${at.toFixed(1)}`,at,floor,fz,face,style,Math.round(at+floor+idx));
    }
    if(inwardX!==0){
      const fx=inwardX<0?x-w/2-.028:x+w/2+.028;
      door(`${id}-side`,fx,z,h,d,inwardX,0,style);
      for(const y of [3.5,5.9,8.3].filter(y=>y<h-.6))for(let at=z-d/2+1.6;at<z+d/2-1;at+=3.2){
        if(y<4.2&&Math.abs(at-z)<1.6)continue;
        shutterWindowX(`${id}-side-${y}-${at.toFixed(1)}`,at,y,fx,inwardX,style,Math.round(at+y+idx));
      }
      box(`${id}-rain-pipe`,fx,h/2,z-d/2+.18,.07,h-.15,.07,'#5a6860');
    }
  }
  const olives=[[-43,-42],[-43.2,23.2],[43,-42],[44,22],[-12,-51],
    ...[-1,1].flatMap(side=>[64,77].flatMap(x=>[-42,-25,-8,9,26,43].map(z=>[side*x,z])))];
  for(const [x,z] of olives){
    const trunk=detail(MeshBuilder.CreateCylinder(`village-outside-olive-trunk-${x}-${z}`,{height:3,diameter:.35,tessellation:8},scene),'#6a5740');trunk.position.set(x,1.5,z);
    for(let i=0;i<5;i++){
      const crown=detail(MeshBuilder.CreateSphere(`village-outside-olive-crown-${x}-${z}-${i}`,{diameter:2.4,segments:10},scene),'#64795c');
      crown.position.set(x+Math.cos(i*2.4)*.8,3.7+(i%2)*.45,z+Math.sin(i*2.4)*.8);crown.scaling.y=.7;
    }
  }
  for(const [x,z,w,h,d] of [[-165,80,80,23,100],[165,90,100,28,80],[-25,185,130,25,80]] as number[][]){
    const hill=detail(MeshBuilder.CreateSphere(`village-outside-hill-${x}-${z}`,{diameter:1,segments:16},scene),'#879176');hill.scaling.set(w,h,d);hill.position.set(x,-h*.25,z);
  }
}
