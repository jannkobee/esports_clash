import * as THREE from 'three';
import {arsenaldoElements} from './arsenaldoModel.ts';
import {avatarDesign} from './avatarDesigns.ts';
import type {AvatarModel,AvatarModelResources,AvatarPose} from './threeAvatarModels.ts';

/** Owner-supplied static mesh. Normalize its scene transform, never its bytes.
 * It has no rig/animation; do not pretend that playing previous clips animates it.
 * The game's elemental presentation stays separate from the imported geometry.
 */
export function bindSubmittedArsenaldo(scene:THREE.Object3D,resources:AvatarModelResources):AvatarModel{
  const body=new THREE.Group(),appearance=new THREE.Group();body.add(appearance);appearance.add(scene);
  scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
  if(![...size.toArray(),...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)||size.y<=0)throw Error('Invalid submitted Arsenaldo bounds');
  const height=avatarDesign('c_invoker')!.height,scale=height/size.y;
  appearance.scale.setScalar(scale);
  appearance.position.set(-(bounds.min.x+bounds.max.x)*.5*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*.5*scale);
  body.name='avatar:c_invoker:submitted';
  body.userData={designId:'c_invoker',assetFormat:'glb',modelVariant:'submitted',clips:[],animationSupport:'static-mesh',hudHeight:height};
  arsenaldoElements(body,resources);
  const orbs=body.children.filter(node=>node.name.startsWith('element-orb:'));
  const colors={ice:'#8ad9f8',wind:'#b5a4f3',fire:'#ff9960'};
  const animate=(pose:AvatarPose,second:number)=>{
    const time=pose.clipPhase===undefined?second:pose.clipPhase*Math.PI*2;
    orbs.forEach((orb,i)=>{
      const angle=time*1.4+i*Math.PI*2/3;
      orb.position.set(Math.cos(angle)*29,55+Math.sin(angle)*11,Math.sin(angle)*19);
      orb.rotation.set(Math.sin(time+i)*.3,time*.6+i,Math.sin(time*.7+i)*.2);
      const element=pose.kaelenOrbs?.[i]??(['ice','wind','fire'] as const)[i];
      orb.traverse(node=>{if(node instanceof THREE.Mesh)node.material=resources.material(colors[element],true);});
    });
  };
  animate({},0);
  return {body,height,animate,dispose:()=>{}};
}
