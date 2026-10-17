import * as THREE from 'three';
import {beveledPanel,loftSurface,taperedCurve} from './avatarSurfaceGeometry.ts';
import type {AvatarModelResources} from './threeAvatarModels.ts';

type V=[number,number,number];
/** Authored surfaces around existing palm fittings; no collider or animation timing changes. */
export function equipmentWorkshop(resources:AvatarModelResources,id:string,accent:string){
 let serial=0;
 const steel='#b8c4c7',gold='#d7b16a',leather='#4a3c36',dark='#25313b';
 const group=(parent:THREE.Object3D,name:string)=>{const g=new THREE.Group();g.name=name;g.userData.meshDetail=name;parent.add(g);return g;};
 const surface=(parent:THREE.Object3D,name:string,color:string,make:()=>THREE.BufferGeometry,at:V=[0,0,0],glow=false)=>{
  const mesh=new THREE.Mesh(resources.geometry(`${id}:workshop:${serial++}:${name}`,make),resources.material(color,glow));
  mesh.name=name;mesh.position.set(...at);parent.add(mesh);return mesh;
 };
 const line=(parent:THREE.Object3D,name:string,color:string,points:V[],radius:number,tip=1)=>surface(parent,name,color,()=>taperedCurve(points,radius,tip,Math.max(8,points.length*5)));
 const band=(parent:THREE.Object3D,color:string,r:number,y:number,z:number,squash=1)=>{
  const mesh=surface(parent,'fitted-band',color,()=>new THREE.TorusGeometry(r,.25,6,24),[0,y,z]);mesh.rotation.x=Math.PI/2;mesh.scale.y=squash;return mesh;
 };
 const panel=(parent:THREE.Object3D,name:string,color:string,points:[number,number][],depth:number,at:V)=>surface(parent,name,color,()=>beveledPanel(points,depth,.18),at);
 const grip=(parent:THREE.Object3D,z=5)=>{
  surface(parent,'leather-handle',leather,()=>loftSurface([[-9,1.2,1.1],[-8,1.35,1.2],[1,1.35,1.2],[2,1.1,1]],16),[0,0,z]);
  for(let i=0;i<6;i++)band(parent,'#705644',1.36,-8+i*1.6,z,.9);
 };
 return {
  sword(parent:THREE.Object3D,color:string,length:number,width:number){
   const weapon=group(parent,'forged-blade');
   // The ridge and sharpened facets are actual volume, with a narrower fuller inset.
   const half=width*.6;
   surface(weapon,'ridged-steel-blade',color,()=>loftSurface([[3,half*.65,.7],[8,half,1.0],[length*.65,half*.72,.8],[length-3,half*.3,.45],[length,.04,.04]],8),[0,0,5]);
   panel(weapon,'blade-fuller',dark,[[-.32,7],[.32,7],[.22,length-7],[0,length-4],[-.22,length-7]],.12,[0,0,6.02]);
   line(weapon,'swept-crossguard',gold,[[-width*1.2,4,5],[-width*.5,1.6,5],[0,2,5],[width*.5,1.6,5],[width*1.2,4,5]],.7);
   grip(weapon);surface(weapon,'pommel',gold,()=>loftSurface([[-12,.2,.2],[-11,1.8,1.4],[-9,1.2,1]],12),[0,0,5]);
   return weapon;
  },
  staff(parent:THREE.Object3D,color:string,length:number){
   const weapon=group(parent,'carved-staff');
   surface(weapon,'tapered-staff-shaft',color,()=>loftSurface([[-29,.8,.8],[-26,1.35,1.3],[-10,1.15,1.1],[10,1.2,1.1],[length-34,1.5,1.3],[length-29,.9,.8]],16),[0,0,5]);
   for(const y of [-24,-20,-8,-4,0,4,8,length-34])band(weapon,y<10?leather:gold,y<10?1.3:1.5,y,5);
   for(const side of [-1,1])line(weapon,'inlaid-staff-groove',gold,[[side*.8,12,5.8],[side*.9,22,5.7],[side*.7,length-32,5.5]],.13,.6);
   return weapon;
  },
  gun(parent:THREE.Object3D,length:number,radius:number,color:string,count=1){
   const weapon=group(parent,'crafted-firearm'),heavy=radius>5,r=heavy?3.1:Math.min(2.1,radius*.65),reach=heavy?length*.76:length*.9;
   panel(weapon,'shaped-receiver',color,[[-r*1.6,-4],[-r*1.7,2],[-r,5],[r*1.3,5],[r*1.7,2],[r*1.4,-4]],12,[0,0,10]);
   panel(weapon,'wooden-stock',leather,[[-2,-7],[-3,-4],[-2,4],[1,3],[2,-6]],6,[0,-2,0]);
   line(weapon,'trigger-guard',gold,[[-1,-2,6],[-2,-7,7],[2,-8,10],[2,-3,12]],.4);
   surface(weapon,'support-grip',leather,()=>loftSurface([[-8,2,1.5],[-7,2.2,1.8],[-3,2.3,2],[-2,1.8,1.7]],12),[-2,0,8]);
   for(let i=0;i<count;i++){
    const x=(i-(count-1)/2)*r*2.3;
    const barrel=surface(weapon,'turned-barrel',steel,()=>{const geometry=loftSurface([[0,r*.9,r*.9],[4,r,r],[reach-5,r*.85,r*.85],[reach-2,r*1.12,r*1.12],[reach,r*1.1,r*1.1]],20);geometry.setIndex(Array.from(geometry.index!.array).slice(0,-60));return geometry;},[x,2,8]);barrel.rotation.x=Math.PI/2;
    // Actual hollow rim and recessed bore, rather than a capped cylinder end.
    const rim=surface(weapon,'muzzle-rim',gold,()=>new THREE.TorusGeometry(r*.86,r*.22,6,24),[x,2,8+reach]);
    surface(weapon,'recessed-bore',dark,()=>new THREE.CircleGeometry(r*.8,24),[x,2,7.9+reach]);
    rim.userData.bore=true;
   }
   for(const z of [18,27]){
    const strap=surface(weapon,'barrel-brace',color,()=>new THREE.TorusGeometry(r*1.2,.45,6,20),[0,2,z]);strap.scale.x=count===2?2.1:1;
   }
   line(weapon,'front-sight',gold,[[0,4.5,reach+3],[0,7,reach+3]],.45);
   panel(weapon,'receiver-inlay',accent,[[-r,0],[0,-1.5],[r,0],[0,2]],.3,[0,1,16.3]);
   for(const x of [-r,r])surface(weapon,'receiver-rivet',gold,()=>new THREE.SphereGeometry(.45,8,6),[x,1.5,16.5]);
   return weapon;
  },
  bow(parent:THREE.Object3D,color:string){
   const points:V[]=[[0,-30,0],[5,-25,0],[9,-14,0],[10,0,0],[9,14,0],[5,25,0],[0,30,0]];
   const mesh=surface(parent,'continuous-recurve-limbs',color,()=>{
    const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),geometry=new THREE.TubeGeometry(curve,48,1.1,8,false),position=geometry.getAttribute('position');
    for(let row=0;row<=48;row++){const t=row/48,center=curve.getPointAt(t),width=.35+.65*Math.sin(Math.PI*t)**.7;
     for(let j=0;j<=8;j++){const i=row*9+j;position.setXYZ(i,center.x+(position.getX(i)-center.x)*width,center.y+(position.getY(i)-center.y)*width,center.z+(position.getZ(i)-center.z)*.65);}}
    geometry.computeVertexNormals();return geometry;
   });
   line(parent,'wrapped-bow-handle',leather,[[10,-4,0],[10,4,0]],1.15);
   for(const y of [-26,26])surface(parent,'bow-tip-inlay',accent,()=>new THREE.SphereGeometry(1,10,8),[4,y,0],true).scale.set(.8,2,.7);
   return mesh;
  },
  gauntlet(parent:THREE.Object3D,color:string,scale=1,at:V=[0,0,6]){
   const glove=group(parent,'articulated-gauntlet');glove.position.set(...at);glove.scale.setScalar(scale);
   surface(glove,'rounded-palm-plate',color,()=>loftSurface([[-3,5.4,4.2],[-1,6,5],[4,5.2,4.6],[8,3.7,3.6]],12));
   for(let f=0;f<4;f++){
    const x=(f-1.5)*3;
    surface(glove,'segmented-knuckle',steel,()=>loftSurface([[-9,1.05,1.1],[-8,1.4,2],[-4,1.4,2.4],[-1,1,1.8]],10),[x,0,2.8]);
    line(glove,'finger-articulation',dark,[[x-1.1,-5,5.1],[x+1.1,-5,5.1]],.16);
   }
   for(const side of [-1,1]){
    line(glove,'gauntlet-piston',gold,[[side*5,-4,1],[side*5,6,1]],.65);
    line(glove,'piston-shaft',steel,[[side*5,4,1],[side*5,9,1]],.35);
   }
   band(glove,gold,4.6,8,0,.88);panel(glove,'power-inlay',accent,[[-1.6,-1],[0,-3],[1.6,-1],[0,2]],.5,[0,2,5.7]);
   line(glove,'opposing-thumb',color,[[-5.5,1,3],[-7,-2,4],[-6,-6,3]],1.5,.75);
   return glove;
  },
  totem(parent:THREE.Object3D){
   const weapon=group(parent,'carved-earth-totem');
   surface(weapon,'tapered-totem-body','#746c56',()=>loftSurface([[-18,4.8,4.4],[-15,6.2,5.5],[-10,6,5.3],[12,6,5.3],[27,6.8,5.7],[32,5.6,4.7],[34,2.4,2.4]],12),[0,-12,8]);
   for(const y of [-14,0,15,28])band(weapon,gold,6.7,y-12,8,.86);
   line(weapon,'totem-side-handle',leather,[[-11.5,-8,8],[-11.5,14,8]],1.2);
   for(const y of [-8,14])line(weapon,'totem-handle-bracket',gold,[[-6,y,8],[-11.5,y,8]],.7);
   for(const y of [-6,7,20])panel(weapon,'incised-earth-rune',accent,[[-2,y],[0,y-2],[2,y],[0,y+3]],.25,[0,-12,13.8]);
   return weapon;
  },
  keg(parent:THREE.Object3D){
   const weapon=group(parent,'coopered-oak-cask');
   surface(weapon,'bulged-cask-staves','#8e6543',()=>loftSurface([[-27,5.8,5.8],[-25,7.1,7.1],[-18,8.6,8.6],[-11,9,9],[-4,8,8],[1,6.5,6.5]],24,.025),[0,0,8]);
   for(const y of [-24,-17,-6,0])band(weapon,steel,y===-17?8.8:y===-6?8.3:7,y,8);
   line(weapon,'cask-top-handle',leather,[[-8,2,8],[8,2,8]],1.3);
   for(let i=0;i<12;i++){const t=i*Math.PI/6;line(weapon,'stave-seam','#5b402b',[[Math.sin(t)*6.7,-24,8+Math.cos(t)*6.7],[Math.sin(t)*9.05,-11,8+Math.cos(t)*9.05],[Math.sin(t)*6.6,0,8+Math.cos(t)*6.6]],.09);}
   return weapon;
  },
 };
}
