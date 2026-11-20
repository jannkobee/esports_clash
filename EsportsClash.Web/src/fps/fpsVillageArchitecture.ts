import {liveCutPavingRect} from './fpsLiveTerrain.ts';
import { MeshBuilder, Mesh, VertexData, Vector3, type Scene, type StandardMaterial } from '@babylonjs/core';
import { LIVE_FPS_MAP, type LiveSolid } from './fpsLiveMap.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import {buildVillageMarket} from './fpsVillageMarket.ts';
import {buildVillageFurnishings} from './fpsVillageFurnishings.ts';
import { LIVE_SURFACE_METRES, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import { MeshDraft, addArchedWall } from './fpsVillageMeshDraft.ts';
import { CAMPANILE_BELFRY, PALAZZO_PEDIMENT, fontessaGalleryLeanTo, fontessaSlabRoofs, villageRoofShape } from './fpsVillageLayout.ts';

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
    // Shared with the roof colliders (fpsVillageColliders.ts), so what is drawn is what stops bullets and grenades.
    const {alongX,span,run,rise}=villageRoofShape(w,d);
    const angle=Math.atan2(rise,span/2+.18),panel=Math.hypot(span/2+.18,rise);
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
    // Callers pass a point 2.8 cm off the wall: step back onto the face so the surround, cornice, door and
    // leaves stay within 5 cm of the wall's collision (they stood up to 15 cm out, where shots grazed through).
    x-=dirX*.028;z-=dirZ*.028;
    const frameThick=.06,leafOut=.02;
    const isZ=dirZ!==0;
    box(`${id}-door-surround`,x+dirX*.01,h/2+.06,z+dirZ*.01,isZ?w+.28:frameThick,h+.2,isZ?frameThick:w+.28,style.frame);
    box(`${id}-door-cornice`,x+dirX*.01,h+.18,z+dirZ*.01,isZ?w+.42:.08,.13,isZ?.08:w+.42,style.frame);
    box(`${id}-timber-door`,x+dirX*leafOut,h/2,z+dirZ*leafOut,isZ?w:.03,h,isZ?.03:w,style.door);
    for(const side of [-1,1]){
      box(`${id}-door-leaf-${side}`,x+dirX*(leafOut+.02)+(isZ?side*w*.23:0),h*.5,z+dirZ*(leafOut+.02)+(isZ?0:side*w*.23),isZ?w*.34:.016,h*.78,isZ?.016:w*.34,'#c5b89e');
      box(`${id}-door-ring-${side}`,x+dirX*(leafOut+.045)+(isZ?side*w*.1:0),h*.48,z+dirZ*(leafOut+.045)+(isZ?0:side*w*.1),.04,.07,.04,'#c4a463');
    }
    box(`${id}-door-step`,x+dirX*.12,.04,z+dirZ*.12,isZ?w+.36:.28,.08,isZ?.28:w+.36,'#b3a68c');
  };
  const quoins=(wall:LiveSolid)=>{
    const w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ;
    if(w<1.4||d<1.4)return;
    // Bonded courses: each stone wraps the corner with alternating long and short returns, stands only
    // 3 cm proud and leaves a mortar joint, instead of short blocks floating out of the plaster like teeth.
    const proud=.03,course=.44,step=.48;
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const fx=sx<0?wall.minX:wall.maxX,fz=sz<0?wall.minZ:wall.maxZ;
      let idx=0;
      for(let y=.38+course/2;y<wall.height-.3;y+=step,idx++){
        const alongX=idx%2===0?.42:.26,alongZ=idx%2===0?.26:.42;
        const qw=alongX+proud,qd=alongZ+proud,qx=fx+sx*(proud-qw/2),qz=fz+sz*(proud-qd/2);
        if(liveFacadeBlocked(wall.id,qx-qw/2,qx+qw/2,y-course/2,y+course/2,qz-qd/2,qz+qd/2))continue;
        box(`${wall.id}-quoin-${sx}-${sz}-${idx}`,qx,y,qz,qw,course,qd,idx%3?'#d9ccb0':'#cdc0a2');
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
    // Ring centred on the wall face (5 cm proud) with the recess set back behind it; it used to stand 8 cm out.
    cx-=!isZ?dir*.028:0;cz-=isZ?dir*.028:0;
    box(`${key}-arch-ring`,cx,1.42,cz,isZ?bayW+.3:.1,2.65,isZ?.1:bayW+.3,'#dad0b6');
    box(`${key}-shop-recess`,cx+(!isZ?dir*.015:0),1.32,cz+(isZ?dir*.015:0),isZ?bayW:.05,2.35,isZ?.05:bayW,rolling?'#677170':'#283d41');
    if(rolling){
      for(let s=0;s<7;s++){
        box(`${key}-rolling-slat-${s}`,cx+(!isZ?dir*.032:0),.42+s*.28,cz+(isZ?dir*.032:0),isZ?bayW-.08:.025,.14,isZ?.025:bayW-.08,s%2?'#7f8886':'#6c7472');
      }
      box(`${key}-shutter-box`,cx+(!isZ?dir*.052:0),2.56,cz+(isZ?dir*.052:0),isZ?bayW+.12:.14,.24,isZ?.14:bayW+.12,'#a49e8d');
    }else{
      for(const off of [-bayW*.34,0,bayW*.34])box(`${key}-mullion-${off}`,cx+(!isZ?dir*.03:off),1.32,cz+(isZ?dir*.03:off),.04,2.3,.04,'#dfd3b4');
      box(`${key}-window-shelf`,cx+(!isZ?dir*.12:0),.32,cz+(isZ?dir*.12:0),isZ?bayW+.18:.22,.16,isZ?.22:bayW+.18,'#b6a88a');
    }
    const sconceY=2.72;
    box(`${key}-sconce-arm`,cx+(!isZ?dir*.16:bayW*.58),sconceY,cz+(isZ?dir*.16:bayW*.58),isZ?.05:.22,.05,isZ?.22:.05,'#3d4541');
    box(`${key}-sconce-lantern`,cx+(!isZ?dir*.24:bayW*.58),sconceY-.14,cz+(isZ?dir*.24:bayW*.58),.14,.2,.14,'#e0b668');
  };
  /**
   * Street-level window that never swings into a lane: closed louvred shutters or an iron grille, all within
   * 8 cm of the wall (`alongX` faces run along x, i.e. the wall faces ±z).
   */
  const groundWindow=(key:string,along:number,face:number,dir:number,alongX:boolean,style:BuildingStyle,grille:boolean)=>{
    const y=1.55,at=(offset:number,outBy:number,w:number,h:number,d:number,color:string,name:string,height=y,out=outBy-.014)=>
      box(`${key}-${name}`,alongX?along+offset:face+dir*out,height,alongX?face+dir*out:along+offset,alongX?w:d,h,alongX?d:w,color);
    at(0,0,1.02,1.32,.06,style.frame,'window-frame');
    at(0,.05,1.14,.08,.15,'#cdbf9d','window-sill',y-.7);
    if(grille){
      at(0,.03,.84,1.12,.02,'#2e4549','window-recess');
      for(let i=0;i<5;i++)at(-.32+i*.16,.065,.022,1.12,.022,'#3d4541',`grille-bar-${i}`);
      for(const dy of [-.32,.32])at(0,.065,.84,.022,.022,'#3d4541',`grille-rail-${dy}`,y+dy);
    }else{
      const slat=style.shutter;
      for(const side of [-1,1]){
        at(side*.21,.045,.41,1.12,.035,style.shutter,`shutter-${side}`);
        for(let s=0;s<6;s++)at(side*.21,.066,.36,.035,.012,slat,`side-slat-${side}-${s}`,y-.42+s*.17);
      }
    }
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
    // Four clock faces: dial, bronze rim in the wall plane (it used to lie flat, a ring floating round the
    // dial), twelve hour marks, hands at ten past ten and a centre boss. The belfry boxes that cut into the
    // top of each dial are gone; the bells now hang in an open belfry stage above the shaft.
    const clockY=5.05,dialR=.86,inZ=(face:number)=>({out:face,alongX:true}),inX=(side:number)=>({out:side,alongX:false});
    for(const [key,plane,{out,alongX}] of [['s',wall.minZ-.045,inZ(-1)],['n',wall.maxZ+.045,inZ(1)],['w',wall.minX-.045,inX(-1)],['e',wall.maxX+.045,inX(1)]] as const){
      const at=(along:number,y:number,offset:number)=>alongX?new Vector3(x+along,y,plane+out*offset):new Vector3(plane+out*offset,y,z+along);
      const dial=detail(MeshBuilder.CreateDisc(`a-crates-clock-${key}`,{radius:dialR,tessellation:36},scene),'#ece1c3');
      dial.position.copyFrom(at(0,clockY,0));dial.rotation.y=alongX?(out>0?Math.PI:0):(out>0?-Math.PI/2:Math.PI/2);
      const rim=detail(MeshBuilder.CreateTorus(`a-crates-clock-rim-${key}`,{diameter:dialR*2+.08,thickness:.1,tessellation:32},scene),'#b5a583');
      rim.position.copyFrom(at(0,clockY,.01));if(alongX)rim.rotation.x=Math.PI/2;else rim.rotation.z=Math.PI/2;
      for(let h=0;h<12;h++){
        const a=h*Math.PI/6,len=h%3?.12:.2,r=dialR-.08-len/2;
        const mark=box(`a-crates-clock-mark-${key}-${h}`,0,0,0,alongX?.035:.018,len,alongX?.018:.035,'#3c4d4c');
        mark.position.copyFrom(at(Math.sin(a)*r,clockY+Math.cos(a)*r,.012));if(alongX)mark.rotation.z=-a;else mark.rotation.x=a;
      }
      for(const [hand,phi,len,width] of [['hour',-Math.PI/3,.42,.07],['minute',Math.PI/3,.62,.05]] as const){
        const c=len/2-.05,piece=box(`a-crates-${hand}-hand-${key}`,0,0,0,alongX?width:.02,len,alongX?.02:width,'#3c4d4c');
        piece.position.copyFrom(at(Math.sin(phi)*c,clockY+Math.cos(phi)*c,.024));if(alongX)piece.rotation.z=-phi;else piece.rotation.x=phi;
      }
      const boss=detail(MeshBuilder.CreateCylinder(`a-crates-clock-boss-${key}`,{height:.05,diameter:.1,tessellation:12},scene),'#b5a583');
      boss.position.copyFrom(at(0,clockY,.03));if(alongX)boss.rotation.x=Math.PI/2;else boss.rotation.z=Math.PI/2;
    }
    // Open belfry: corner piers and centre mullions with two arched openings per face, an impost band,
    // sill walls, a cornice, the bell on its headstock, then the pyramid roof, spire and weather vane.
    const B=CAMPANILE_BELFRY,top=wall.height,belfryTop=top+B.height,springY=top+B.springAbove,pier=B.pier,mullion=B.mullion,wallT=B.wall;
    for(const sx of [-1,1])for(const sz of [-1,1])box(`a-crates-belfry-pilaster-${sx}-${sz}`,x+sx*(w/2-pier/2),top+.85,z+sz*(d/2-pier/2),pier,1.7,pier,'#dcd0b5');
    const arches=new MeshDraft(),openW=(w-2*pier-mullion)/2;
    for(const [plane,alongX,inward] of [[wall.minZ,true,1],[wall.maxZ,true,-1],[wall.minX,false,1],[wall.maxX,false,-1]] as const){
      const centre=alongX?x:z,lo=centre-(alongX?w:d)/2;
      box(`a-crates-belfry-mullion-pilaster-${alongX?'z':'x'}-${plane}`,alongX?x:plane+inward*wallT/2,top+.85,alongX?plane+inward*wallT/2:z,alongX?mullion:wallT,1.7,alongX?wallT:mullion,'#dcd0b5');
      for(const k of [0,1]){
        const from=lo+pier+k*(openW+mullion),to=from+openW;
        addArchedWall(arches,{along:alongX?'x':'z',from,to,openFrom:from,openTo:to,springY,rise:B.rise,topY:belfryTop-.1,faceA:plane,faceB:plane+inward*wallT,metres:LIVE_SURFACE_METRES.stone,steps:16});
        const mid=(from+to)/2;
        box(`a-crates-belfry-sill-${alongX?'z':'x'}-${plane}-${k}`,alongX?mid:plane+inward*wallT/2,top+B.sill/2,alongX?plane+inward*wallT/2:mid,alongX?openW:wallT,B.sill,alongX?wallT:openW,'#d2c5a8');
      }
    }
    const arched=detail(arches.build('a-crates-belfry-arches',scene),'#dcd0b5');if(surfaces)arched.material=surfaces.material('stone','#dcd0b5');
    box('a-crates-belfry-impost-stringcourse',x,springY-.04,z,w+.06,.08,d+.06,'#d9ccb0');
    box('a-crates-belfry-cornice',x,belfryTop,z,w+.34,B.cornice,d+.34,'#d9ccb0');
    box('a-crates-bell-crossbar',x,springY+.36,z,w-.7,.14,.18,'#6b5038');
    const bell=detail(MeshBuilder.CreateCylinder('a-crates-campanile-bell',{height:.62,diameterTop:.36,diameterBottom:.68,tessellation:16},scene),'#8f7245');
    bell.position.set(x,springY+.0,z);
    const roofBase=belfryTop+B.roofGap,roofH=B.roofHeight;
    const pyr=detail(MeshBuilder.CreateCylinder('a-crates-campanile-roof',{height:roofH,diameterTop:.22,diameterBottom:(w+B.roofOverhang)*Math.SQRT2,tessellation:4},scene),'#a96548');
    pyr.position.set(x,roofBase+roofH/2,z);pyr.rotation.y=Math.PI/4;
    if(surfaces)pyr.material=surfaces.material('clay','#a96548');
    const spire=detail(MeshBuilder.CreateCylinder('a-crates-campanile-spire',{height:.85,diameterTop:.03,diameterBottom:.18,tessellation:8},scene),'#bfa15e');
    spire.position.set(x,roofBase+roofH+.36,z);
    const vaneY=roofBase+roofH+.86;
    const rod=detail(MeshBuilder.CreateCylinder('a-crates-weather-vane-rod',{height:.5,diameter:.025,tessellation:6},scene),'#3c4340');rod.position.set(x,vaneY+.2,z);
    box('a-crates-weather-vane-arrow',x,vaneY+.34,z,.62,.025,.025,'#3c4340');
    box('a-crates-weather-vane-tail',x-.27,vaneY+.34,z,.12,.12,.012,'#3c4340');
    for(const [dx,dz] of [[.18,0],[0,.18]])box(`a-crates-weather-vane-cross-${dx}`,x,vaneY+.18,z,dx?.36:.02,.02,dz?.36:.02,'#3c4340');
    const ball=detail(MeshBuilder.CreateSphere('a-crates-weather-vane-ball',{diameter:.09,segments:8},scene),'#bfa15e');ball.position.set(x,vaneY+.02,z);
  };

  const pavilion=(wall:LiveSolid)=>{
    const w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ,x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    const style=buildingStyle(wall.id);
    box(`${wall.id}-footing`,x,.16,z,w+.07,.32,d+.07,'#a69a80');
    box(`${wall.id}-cornice`,x,wall.height-.08,z,w+.09,.14,d+.09,'#dfd2b5');
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
    // Stores: a planked door with iron straps on the long face, a small barred window opposite and the meter
    // beside the door (it used to be painted over the vent in the middle of a blind panel).
    const alongX=w>=d,span=alongX?w:d;
    const doorFace=alongX?wall.minZ-.015:wall.maxX+.015,doorDir=alongX?-1:1,winFace=alongX?wall.maxZ+.015:wall.minX-.015,winDir=-doorDir;
    const along=alongX?x:z,doorW=Math.min(1.1,span*.4);
    const put=(name:string,offset:number,face:number,dir:number,out:number,y:number,wAlong:number,h:number,depth:number,color:string)=>
      box(`${wall.id}-${name}`,alongX?along+offset:face+dir*out,y,alongX?face+dir*out:along+offset,alongX?wAlong:depth,h,alongX?depth:wAlong,color);
    put('store-door-surround',0,doorFace,doorDir,0,1.13,doorW+.24,2.26,.06,'#cfc0a0');
    put('store-door-board',0,doorFace,doorDir,.015,1.05,doorW,2.1,.03,'#66523e');
    for(const y of [.42,1.68])put(`store-door-strap-${y}`,0,doorFace,doorDir,.055,y,doorW-.08,.06,.012,'#3d4541');
    put('store-door-handle',doorW*.36,doorFace,doorDir,.065,1.05,.03,.14,.03,'#c4a463');
    put('store-window-frame',0,winFace,winDir,0,1.6,.9,.76,.05,'#cfc0a0');
    put('store-window-recess',0,winFace,winDir,.02,1.6,.72,.58,.02,'#2e4549');
    for(let i=0;i<4;i++)put(`store-window-bar-${i}`,-.24+i*.16,winFace,winDir,.045,1.6,.018,.58,.018,'#3d4541');
    if(span>=2.4){
      // Between the door surround and the corner quoins, touching the wall.
      const meterAt=along+(span/2-.62)*(alongX?1:-1);
      utilityBox(wall.id,alongX?meterAt:wall.maxX-.01,1.25,alongX?wall.minZ+.01:meterAt,alongX,doorDir);
    }
  };

  const building=(wall:LiveSolid)=>{
    const design=liveVillageAsset(wall.id),w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ,x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    if(design.kind==='clock'){campanile(wall);return;}
    if(wall.height<=3.2){pavilion(wall);return;}
    const style=buildingStyle(wall.id);
    roof(wall.id,x,z,w,d,wall.height);
    if(style.quoins)quoins(wall);
    if(wall.id!=='a-loggia-wall')box(`${wall.id}-stringcourse`,x,2.76,z,w+.09,.12,d+.09,'#d9ccb0');
    // The palazzo's piano-nobile band, where the portico roof meets the facade.
    else box(`${wall.id}-piano-nobile-stringcourse`,x,4.85,z,w+.09,.14,d+.09,'#d9ccb0');
    box(`${wall.id}-eave-cornice`,x,wall.height-.11,z,w+.09,.16,d+.09,'#dfd2b5');

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
    if(wall.height<4.6){
      // Single-storey inn wings and the guardhouse had no openings below their eaves at all.
      const grille=design.kind==='civic';
      for(const face of [-1,1]){
        const fz=face<0?wall.minZ-.028:wall.maxZ+.028;
        for(const k of [-2,-1,1,2]){
          const at=x+k*2.4;
          if(Math.abs(at-x)>w/2-.95||blockedZ(wall.id,at,.62,.8,2.3,fz,face,.14))continue;
          groundWindow(`${wall.id}-ground-${face}-${k}`,at,fz,face,true,style,grille);
        }
      }
      for(const side of [-1,1]){
        const fx=side<0?wall.minX-.028:wall.maxX+.028;
        for(const k of [-1,0,1]){
          const at=z+k*2.4;
          if(Math.abs(at-z)>d/2-.95||(side>0&&Math.abs(at-(wall.minZ+.9))<.95)||blockedX(wall.id,at,.62,.8,2.3,fx,side,.14))continue;
          groundWindow(`${wall.id}-ground-side-${side}-${k}`,at,fx,side,false,style,grille);
        }
      }
    }
    const promenadeDoors=[-24,-16,-8,0,8];
    for(const side of [-1,1]){
      const fx=side<0?wall.minX-.028:wall.maxX+.028;
      box(`${wall.id}-side-footing-${side}`,fx,.195,z,.05,.38,Math.max(.2,d-.12),'#a69a80');
      const shopDir=side<0?'w':'e';
      if(style.shopFaces?.includes(shopDir)&&d>=4&&wall.id!=='b-apartments-back'){
        // The market house's side shop faces the fountain, north of the Mercato gate rather than split by its pier.
        const shopZ=wall.id==='customs-warehouse-east'||wall.id==='freight-office-east'?z-2.5:wall.id==='east-container'?13:z;
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
      // A cap sitting on the wall top (1 cm proud), not 8.5 cm above it where bullets crossed it.
      box(`${wall.id}-coping`,x,wall.height-.04,z,w+.09,.1,d+.09,'#d2c29e');
      if(/^(west|east|south)-wall|^(west|east)-outer-gate/.test(wall.id)){
        const alongZ=d>w,len=alongZ?d:w,steps=Math.max(1,Math.floor(len/6.5));
        for(let s=0;s<=steps;s++){
          const offset=-len/2+.21+s*(len-.42)/steps;// end pilasters flush with the wall ends
          const px=alongZ?x:x+offset,pz=alongZ?z+offset:z;
          // Within 4 cm of the wall's collision, so a bullet skimming the wall cannot pass through a pilaster.
          box(`${wall.id}-pilaster-${s}`,px,wall.height/2,pz,alongZ?w+.08:.42,wall.height+.02,alongZ?.42:d+.08,'#cfc0a0');
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

  // Flat cutaway roof slabs read as bare orange plates: the Mid lookout, its civic annex and the Jade Lantern
  // dining room get pitched clay roofs, and the B apartments gallery a lean-to off the apartment wall. They are
  // tagged so the viewer hides them together with the slabs when roofs are cut away.
  {
    const start=scene.meshes.length,flat=(id:string)=>LIVE_FPS_MAP.solids.find(s=>s.id===id);
    for(const r of fontessaSlabRoofs(flat))roof(r.id,r.x,r.z,r.w,r.d,r.y,r.color,false);
    const leanTo=fontessaGalleryLeanTo(flat);
    if(leanTo){
      const {wallX,lowX,highY,lowY,frontX,slabY}=leanTo,run=wallX-lowX,cz=(leanTo.minZ+leanTo.maxZ)/2,len=leanTo.maxZ-leanTo.minZ+.3;
      box('b-apartments-lean-to-tile-roof',(wallX+lowX)/2,(highY+lowY)/2+.06,cz,Math.hypot(run,highY-lowY)+.06,.12,len,'#ae6447').rotation.z=Math.atan2(highY-lowY,run);
      box('b-apartments-lean-to-fascia',lowX+.02,lowY+.03,cz,.06,.14,len,'#6e553d');
      for(const [i,ez] of [leanTo.minZ-.12,leanTo.maxZ+.12].entries())triangularPrism(`b-apartments-lean-to-gable-${i}`,[
        frontX,lowY+.01,ez-.03,wallX,slabY,ez-.03,wallX,highY,ez-.03,
        frontX,lowY+.01,ez+.03,wallX,slabY,ez+.03,wallX,highY,ez+.03,
      ],'#d2bc96');
    }
    for(const mesh of scene.meshes.slice(start))mesh.metadata={...(mesh.metadata??{}),cutawayRoof:true};
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
    const finial=detail(MeshBuilder.CreateSphere(`civic-flag-finial-${side}`,{diameter:.1,segments:8},scene),'#c3a45c');finial.position.set(-23+side*3.3,7.05,26.12);
  }
  // Pediment: raking and base cornices, a recessed tympanum carrying the comune's arms, acroteria, and
  // clay tiles behind it down onto the portico (it was a bare flat triangle over a flat slab).
  const {left:pedL,right:pedR,base:pedY,apex:apexY,front:pedZ}=PALAZZO_PEDIMENT,pedCx=(pedL+pedR)/2;
  const rake=Math.atan2(apexY-pedY,(pedR-pedL)/2),rakeLen=Math.hypot((pedR-pedL)/2,apexY-pedY)+.24;
  for(const side of [-1,1])box(`civic-pediment-raking-cornice-${side}`,pedCx+side*(pedR-pedL)/4,(pedY+apexY)/2+.07,pedZ-.04,rakeLen,.17,.22,'#e0d2b2').rotation.z=side<0?rake:-rake;
  box('civic-pediment-base-cornice',pedCx,pedY+.06,pedZ-.05,pedR-pedL+.36,.14,.24,'#e0d2b2');
  triangularPrism('civic-pediment-tympanum',[
    pedL+.95,pedY+.2,pedZ-.012,pedR-.95,pedY+.2,pedZ-.012,pedCx,apexY-.27,pedZ-.012,
    pedL+.95,pedY+.2,pedZ-.002,pedR-.95,pedY+.2,pedZ-.002,pedCx,apexY-.27,pedZ-.002,
  ],'#c8b48d');
  const armsY=4.62,armsZ=pedZ-.03;
  const laurel=detail(MeshBuilder.CreateTorus('civic-arms-laurel',{diameter:.92,thickness:.07,tessellation:28},scene),'#8f8a52');
  laurel.rotation.x=Math.PI/2;laurel.position.set(pedCx,armsY,armsZ);
  box('civic-arms-shield',pedCx,armsY+.06,armsZ-.012,.42,.4,.03,'#466f68');
  box('civic-arms-shield-point',pedCx,armsY-.14,armsZ-.012,.3,.3,.03,'#466f68').rotation.z=Math.PI/4;
  box('civic-arms-band',pedCx,armsY,armsZ-.03,.08,.56,.012,'#e7dcc2').rotation.z=Math.PI/4;
  box('civic-arms-crown',pedCx,armsY+.33,armsZ-.012,.42,.08,.04,'#c3a45c');
  for(const dx of [-.15,0,.15]){const gem=detail(MeshBuilder.CreateSphere(`civic-arms-crown-point-${dx}`,{diameter:.07,segments:6},scene),'#c3a45c');gem.position.set(pedCx+dx,armsY+.4,armsZ-.012);}
  for(const [ax,ay] of [[pedCx,apexY+.06],[pedL+.12,pedY+.16],[pedR-.12,pedY+.16]]){
    box(`civic-pediment-acroterion-plinth-${ax}`,ax,ay+.09,pedZ+.05,.24,.18,.24,'#e0d2b2');
    const urn=detail(MeshBuilder.CreateSphere(`civic-pediment-acroterion-urn-${ax}`,{diameter:.2,segments:8},scene),'#d9ccb0');urn.position.set(ax,ay+.27,pedZ+.05);urn.scaling.y=1.2;
  }
  const tileRun=26.38-25.4,tileRise=4.78-4.2;
  box('civic-portico-tile-roof',pedCx,(4.2+4.78)/2+.04,(25.4+26.38)/2,pedR-pedL+.1,.1,Math.hypot(tileRun,tileRise),'#a96548').rotation.x=-Math.atan2(tileRise,tileRun);
  for(const [i,ex] of [pedL,pedR].entries())triangularPrism(`civic-portico-roof-end-${i}`,[
    ex-.03,4.05,25.4,ex-.03,4.05,26.4,ex-.03,4.8,26.4,ex+.03,4.05,25.4,ex+.03,4.05,26.4,ex+.03,4.8,26.4,
  ],'#d2bc96');
  // Courtyard: the gold ring now frames an inner ring and a sixteen-point compass rose, each point split
  // light and dark, instead of twelve loose sticks.
  const civicRing=detail(MeshBuilder.CreateTorus('civic-courtyard-paving-seal',{diameter:5,thickness:.055,tessellation:48},scene),'#a58b58');
  civicRing.position.set(-23,.038,21);civicRing.metadata={castShadow:false};
  const innerRing=detail(MeshBuilder.CreateTorus('civic-courtyard-paving-ring-inner',{diameter:3.2,thickness:.04,tessellation:40},scene),'#a58b58');
  innerRing.position.set(-23,.036,21);innerRing.metadata={castShadow:false};
  const roseLight=new MeshDraft(),roseDark=new MeshDraft(),roseY=.034,up={x:0,y:1,z:0},noUV:[number,number][]=[[0,0],[0,0],[0,0]];
  for(let k=0;k<16;k++){
    const a=k*Math.PI/8,len=k%4===0?2.25:k%2===0?1.55:1.0,half=Math.PI/16,base=.62,at=(angle:number,r:number)=>({x:-23+Math.sin(angle)*r,y:roseY,z:21+Math.cos(angle)*r});
    roseLight.tri([at(0,0),at(a-half,base),at(a,len)],up,noUV);
    roseDark.tri([at(0,0),at(a,len),at(a+half,base)],up,noUV);
  }
  for(const [draft,name,color] of [[roseLight,'civic-compass-rose-light','#e3d6b6'],[roseDark,'civic-compass-rose-dark','#8f7a52']] as const)detail(draft.build(name,scene),color).metadata={castShadow:false};
  const hub=detail(MeshBuilder.CreateDisc('civic-compass-rose-hub',{radius:.34,tessellation:24},scene),'#b29b5c');hub.rotation.x=Math.PI/2;hub.position.set(-23,roseY+.004,21);hub.metadata={castShadow:false};

  // The attackers' dining room has a cotto tile floor wall to wall; the customs quay keeps a paved court.
  const trattoriaFloor=detail(MeshBuilder.CreateGround('village-arrival-court',{width:17.7,height:10.2},scene),'#a5735a');
  trattoriaFloor.position.set(0,.016,-34.75);trattoriaFloor.metadata={castShadow:false};
  if(surfaces){
    // Street paving carries a polygon offset; the indoor tiles need a stronger one to stay on top of it.
    // 30 cm square cotto tiles (the paving map holds eight setts per repeat).
    trattoriaFloor.material=surfaces.material('paving','#a8705a',-1.2);tileGround(trattoriaFloor,17.7,10.2,2.4);
  }
  const quayCourt=detail(MeshBuilder.CreateGround('village-customs-quay-court',{width:13,height:8},scene),'#b0a58b');
  quayCourt.position.set(0,.016,40);quayCourt.metadata={castShadow:false};
  if(surfaces){quayCourt.material=surfaces.material('paving','#b0a58b');tileGround(quayCourt,13,8,LIVE_SURFACE_METRES.paving);}
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
    if(surfaces)tileGround(road,10.8,20,LIVE_SURFACE_METRES.paving);
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
