import * as THREE from 'three';
import {beveledPanel,loftSurface,taperedCurve} from './avatarSurfaceGeometry.ts';
import type {AvatarModelResources} from './threeAvatarModels.ts';
type V=[number,number,number];

/** Curved membranes with scalloped trailing edges, in the wing's local X/Z plane. */
export function wingMembrane(side:number,bat:boolean){
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(16,18,35,11);
 shape.quadraticCurveTo(24,8,28,-3);shape.quadraticCurveTo(17,-1,23,-16);
 shape.quadraticCurveTo(11,-10,12,-28);shape.quadraticCurveTo(5,-18,0,-9);shape.closePath();
 const geometry=new THREE.ShapeGeometry(shape,16),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),z=position.getY(i),arch=Math.sin(Math.min(1,x/35)*Math.PI)* (bat?4:5.5);
  position.setXYZ(i,x*side,arch,z);
  uv.setXY(i,x/35,(z+28)/46);
 }
 // ShapeGeometry's X/Y normal becomes +Y after the X/Z remap; mirror winding too.
 const indices=Array.from(geometry.index!.array);if(side>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function addCreatureMeshDetails(root:THREE.Group,id:string,resources:AvatarModelResources,primary:string,accent:string){
 let serial=0;
 const mesh=(name:string,color:string,create:()=>THREE.BufferGeometry,at:V=[0,0,0],glow=false)=>{
  const node=new THREE.Mesh(resources.geometry(`${id}:creature-detail:${serial++}:${name}`,create),resources.material(color,glow));node.name=name;node.position.set(...at);root.add(node);return node;
 };
 const line=(name:string,color:string,points:V[],r:number,tip=.5)=>mesh(name,color,()=>taperedCurve(points,r,tip,20));
 if(id==='c_largo'){
  for(const side of [-1,1]){
   line('heavy-frog-eyelid',primary,[[side*8,58,9],[side*12,63,8],[side*19,60,7]],1.3);
   for(let toe=0;toe<3;toe++)line('webbed-frog-toe',primary,[[side*18,5,10],[side*(18+(toe-1)*3),3,18],[side*(18+(toe-1)*4),2,22]],1.1,.65);
  }
  line('curved-frog-mouth','#414830',[[-18,46,16],[-8,43,22],[0,42.5,23],[8,43,22],[18,46,16]],.55);
  for(let i=0;i<7;i++)mesh('frog-skin-nodule','#8c995a',()=>new THREE.SphereGeometry(.8,10,8),[(i-3)*4,45+Math.sin(i)*2,-10]);
 }else if(id==='c_shadowfiend'){
  for(const side of [-1,1]){
   line('curved-soul-horn','#402731',[[side*6,72,0],[side*15,80,-3],[side*22,85,-7],[side*23,79,-11]],2.7,.08);
   for(let rib=0;rib<4;rib++)line('ribbed-demon-carapace','#80616a',[[side*2,51-rib*5,11],[side*11,49-rib*4,12],[side*17,46-rib*4,5]],.7);
   for(let claw=0;claw<3;claw++)line('curved-soul-talon','#eeafab',[[side*24+(claw-1)*5,13,6],[side*24+(claw-1)*5,7,10],[side*24+(claw-1)*4,10,15]],1,.1);
  }
 }else if(id==='c_voltgrip'){
  for(const side of [-1,1]){
   line('chassis-side-pipe','#3f4c55',[[side*15,20,7],[side*20,28,8],[side*20,42,5],[side*12,49,7]],1.4);
   for(let rivet=0;rivet<5;rivet++)mesh('brass-chassis-rivet','#d7b16a',()=>new THREE.SphereGeometry(.8,10,8),[side*14,23+rivet*5,13]);
  }
  for(let vent=0;vent<5;vent++)mesh('chassis-vent','#25313b',()=>beveledPanel([[-5,-.3],[5,-.3],[5,.3],[-5,.3]],.3,.1),[0,24+vent*1.8,15]);
 }else if(id==='c_puck'){
  line('sinuous-dragon-tail',primary,[[0,24,-13],[8,23,-25],[13,28,-35],[4,34,-43],[-4,33,-41]],3,.05);
  for(let scale=0;scale<7;scale++)mesh('dragon-dorsal-scale',accent,()=>loftSurface([[0,1.5,1],[2,1.2,.8],[4,.05,.05]],8),[0,31+Math.sin(scale*.5)*2,-12+scale*5]);
 }else if(id==='c_batrider'){
  mesh('stitched-rider-saddle','#4a3c36',()=>loftSurface([[34,7,5],[36,9,7],[38,8,6]],20),[0,0,-1]);
  for(const side of [-1,1])line('flight-harness','#d7b16a',[[side*7,37,5],[side*6,49,7],[side*3,56,5]],.55);
 }else if(id==='c_bristleback'){
  for(const side of [-1,1]){
   line('curved-beast-brow','#5a6840',[[side*3,55,22],[side*7,58,20],[side*11,55,17]],1.2);
   mesh('beast-eye','#14232e',()=>new THREE.SphereGeometry(1.2,12,10),[side*7,54.7,21]);
   line('beast-tusk','#eee7d4',[[side*7,45,21],[side*9,43,25],[side*8,48,27]],1.2,.12);
  }
  for(let row=0;row<3;row++)for(let i=0;i<5;i++)mesh('overlapping-quill-scale',i%2?primary:'#6b744d',()=>beveledPanel([[-4,-3],[4,-3],[3,3],[0,6],[-3,3]],1,.3),[(i-2)*7,27+row*8,-17-row*1.2]);
 }else if(id==='c_skybreaker'){
  for(const side of [-1,1]){
   line('pod-safety-rail','#b8c4c7',[[side*10,22,15],[side*12,31,14],[side*11,36,-8],[side*7,28,-17]],.7);
   for(let vent=0;vent<4;vent++)mesh('pod-cooling-fin','#3e4650',()=>beveledPanel([[-3,-1],[3,-1],[3,1],[-3,1]],.6,.15),[side*12,21+vent*2,-21]);
  }
  mesh('pilot-windscreen','#658f9a',()=>beveledPanel([[-7,-2],[7,-2],[5,7],[-5,7]],.4,.2),[0,31,12]);
 }else if(id==='c_nullweaver'||id==='c_io'){
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   line('spiraled-energy-filament',accent,[[Math.cos(a)*13,24,Math.sin(a)*13],[Math.cos(a+.45)*18,37,Math.sin(a+.45)*18],[Math.cos(a+.9)*11,51,Math.sin(a+.9)*11]],.35,.3);
  }
 }
}
