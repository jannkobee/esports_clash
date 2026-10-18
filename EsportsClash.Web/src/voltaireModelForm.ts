import * as THREE from 'three';
import type {AvatarModelResources,AvatarPose} from './threeAvatarModels.ts';

/** Runtime ability form uses the same actor position; no flight immunity or movement. */
export function voltaireModelForm(root:THREE.Group,resources:AvatarModelResources){
 if(root.userData.designId!=='c_raijin')return (_pose:AvatarPose,_second:number)=>{};
 const outfit=root.getObjectByName('outfit'),form=new THREE.Group();form.name='voltaire-ball-lightning';form.position.y=32;root.add(form);form.visible=false;
 resources.mesh(form,'ball','#d9ffff',[10,10,10],[0,0,0],true);
 const rings:THREE.Object3D[]=[];
 for(let i=0;i<3;i++){
  const ring=resources.mesh(form,'torus',i===1?'#ffffff':'#5de2fa',[15+i,15+i,15+i],[0,0,0],true);
  ring.rotation.set(i*Math.PI/3,.6+i,.4);rings.push(ring);
 }
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4;
  const spark=resources.mesh(form,'gem','#83efff',[1.3,4,1.3],[Math.cos(angle)*17,Math.sin(angle)*17,0],true);spark.rotation.z=angle;
 }
 const drums:THREE.Object3D[]=[];root.traverse(n=>{if(String(n.userData.avatarPart).startsWith('storm-drum:'))drums.push(n);});
 const hand=root.getObjectByName('HandR'),charge=new THREE.Group();charge.name='voltaire-overload-charge';charge.position.set(0,-2,5);hand?.add(charge);
 resources.mesh(charge,'gem','#d9ffff',[2.2,3,2.2],[0,0,0],true);
 return (pose:AvatarPose,second:number)=>{
  const dead=pose.motionState==='death'||pose.animState==='dead'||pose.animState==='death';
  const active=pose.dash?.kind==='raijin_bolt'&&(pose.dash.remaining??0)>0&&!dead;
  form.visible=active;if(outfit)outfit.visible=!active;drums.forEach(n=>{n.visible=!active;});
  charge.visible=!active&&(pose.voltaireOverloadTimer??0)>0&&!dead;charge.rotation.y=second*3;
  form.rotation.set(second*2,second*4,second*1.5);
  const pulse=1+Math.sin(second*23)*.035;form.scale.setScalar(pulse);
  rings.forEach((ring,i)=>{ring.rotation.z=second*(i%2?-4:4)+i;});
 };
}
