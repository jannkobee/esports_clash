import * as THREE from 'three';
import {twoBoneSolver} from './avatarContactRig.ts';
import {AVATAR_CONTACTS} from './avatarContactProfiles.ts';
import {bindWeaponSocket} from './avatarWeaponSockets.ts';

export type MeleeContact={x:number;y:number;z:number;weight:number};
/** Fit the actual weapon tip to a surface point after native pose evaluation.
 * Only mesh/bone transforms change; collider position, range and damage do not. */
export function bindMeleeContact(root:THREE.Group,id:string){
 const upper=root.getObjectByName('UpperArmR'),fore=root.getObjectByName('ForearmR'),hand=root.getObjectByName('HandR');
 const parts=new Map<string,THREE.Object3D>();root.traverse(n=>{if(n.userData.avatarPart)parts.set(n.userData.avatarPart,n);});
 const grip=parts.get('right-grip'),socket=bindWeaponSocket(root,id),frame=parts.get('outfit');
 const solve=upper&&fore&&hand?twoBoneSolver(upper,fore,hand):undefined;
 const leftUpper=root.getObjectByName('UpperArmL'),leftFore=root.getObjectByName('ForearmL'),leftHand=root.getObjectByName('HandL');
 const leftSolve=leftUpper&&leftFore&&leftHand?twoBoneSolver(leftUpper,leftFore,leftHand):undefined;
 const profile=AVATAR_CONTACTS[id];
 const point=new THREE.Vector3(),wrist=new THREE.Vector3(),shoulder=new THREE.Vector3(),tip=new THREE.Vector3(),offset=new THREE.Vector3(),direction=new THREE.Vector3(),pole=new THREE.Vector3();
 const q=new THREE.Quaternion(),desired=new THREE.Quaternion(),oldQ=new THREE.Quaternion(),leftQ=new THREE.Quaternion(),scale=new THREE.Vector3();
 const support=new THREE.Vector3(),leftShoulder=new THREE.Vector3(),leftGoal=new THREE.Vector3(),candidateWrist=new THREE.Vector3(),candidateLeft=new THREE.Vector3();
 const delta=new THREE.Vector3(),bestDelta=new THREE.Vector3(),axis=new THREE.Vector3(),aim=new THREE.Vector3(),original=new THREE.Vector3(),candidate=new THREE.Quaternion(),roll=new THREE.Quaternion();
 const supportAnchor=()=>{
  const kind=profile.twoHand;
  return support.set(kind==='totem'?-11.5:kind==='keg'?-8:kind==='gun'?-2:0,kind==='gun'?-6:kind==='staff'?8:kind==='keg'?2:8,kind==='totem'||kind==='keg'?8:kind==='gun'?8:5);
 };
 return (contact:MeleeContact,moveBody:(delta:THREE.Vector3)=>void)=>{
  const mounted=socket();if(!mounted||contact.weight<=0)return;
  point.set(contact.x,contact.y,contact.z);tip.set(...mounted.tip);
  if(!solve||!grip||!frame){
   // Creature equipment is rigidly attached to its arm group, rather than a palm.
   const arm=parts.get('right-arm');
   if(arm){
    arm.getWorldPosition(wrist);arm.getWorldQuaternion(oldQ);
    offset.subVectors(tip,wrist);direction.subVectors(point,wrist).normalize();
    if(offset.lengthSq()>.01){
     q.setFromUnitVectors(offset.normalize(),direction);desired.copy(q).multiply(oldQ);
     q.slerpQuaternions(oldQ,desired,contact.weight);arm.parent!.getWorldQuaternion(desired);
     arm.quaternion.copy(desired).invert().multiply(q);arm.updateWorldMatrix(true,true);
     tip.set(...socket()!.tip);
    }
   }
   direction.subVectors(point,tip);direction.y=0;if(direction.length()>32)direction.setLength(32);moveBody(direction.multiplyScalar(contact.weight));return;
  }
  hand!.getWorldPosition(wrist);upper!.getWorldPosition(shoulder);hand!.getWorldQuaternion(oldQ);
  offset.subVectors(tip,wrist);direction.subVectors(point,shoulder).normalize();
  if(offset.lengthSq()<.01)return;
  q.setFromUnitVectors(offset.clone().normalize(),direction);desired.copy(q).multiply(oldQ);
  upper!.getWorldScale(scale);const reach=(fore!.position.length()+hand!.position.length()-.05)*scale.y;
  if(profile?.twoHand&&leftSolve&&leftUpper&&leftFore&&leftHand){
   // Choose a small tilt/roll and a shared bounded step that leave BOTH palms
   // reachable. Pointing a long shaft straight out otherwise detaches its support hand.
   leftHand.getWorldQuaternion(leftQ);leftUpper.getWorldPosition(leftShoulder);
   supportAnchor();grip.localToWorld(support);support.sub(wrist);
   leftGoal.set(0,-2,0).applyQuaternion(leftQ).multiplyScalar(scale.y);
   const leftReach=(leftFore.position.length()+leftHand.position.length()-.05)*scale.y;
   original.copy(offset).normalize();axis.set(-direction.z,0,direction.x).normalize();
   let score=Infinity;
   for(const tilt of [0,-.35,.35,-.7,.7,-1.05,1.05])for(const spin of [0,-.6,.6,-1.2,1.2,Math.PI]){
    aim.copy(direction).applyAxisAngle(axis,tilt);candidate.setFromUnitVectors(original,aim);
    roll.setFromAxisAngle(aim,spin);candidate.premultiply(roll);
    candidateWrist.copy(point).sub(tip.copy(offset).applyQuaternion(candidate));
    candidateLeft.copy(candidateWrist).add(tip.copy(support).applyQuaternion(candidate)).sub(leftGoal);
    delta.set(0,0,0);
    for(let iteration=0;iteration<12;iteration++){
     for(const [goal,joint,r] of [[candidateWrist,shoulder,reach],[candidateLeft,leftShoulder,leftReach]] as const){
      tip.copy(goal).sub(joint).sub(delta);const horizontal=Math.hypot(tip.x,tip.z),allowed=Math.sqrt(Math.max(0,r*r-tip.y*tip.y));
      if(horizontal>allowed&&horizontal>.001){delta.x+=tip.x*(1-allowed/horizontal);delta.z+=tip.z*(1-allowed/horizontal);if(delta.length()>32)delta.setLength(32);}
     }
    }
    const rightError=Math.max(0,tip.copy(candidateWrist).sub(shoulder).sub(delta).length()-reach);
    const leftError=Math.max(0,tip.copy(candidateLeft).sub(leftShoulder).sub(delta).length()-leftReach);
    const cost=(rightError*rightError+leftError*leftError)*10000+delta.lengthSq()*.01+tilt*tilt+spin*spin*.1;
    if(cost<score){score=cost;q.copy(candidate);bestDelta.copy(delta);}
   }
   desired.copy(q).multiply(oldQ);wrist.copy(point).sub(offset.applyQuaternion(q));moveBody(bestDelta.multiplyScalar(contact.weight));
  }else{
   offset.applyQuaternion(q);wrist.copy(point).sub(offset);direction.subVectors(wrist,shoulder);
   if(direction.length()>reach){
    const horizontal=Math.hypot(direction.x,direction.z),allowed=Math.sqrt(Math.max(0,reach*reach-direction.y*direction.y));
    const lunge=Math.min(32,Math.max(0,horizontal-allowed)+.2);direction.y=0;if(direction.lengthSq()>.01)moveBody(direction.setLength(lunge*contact.weight));
   }
  }
  // Keep the original pose during recovery, and aim exactly at contact at release.
  upper!.updateWorldMatrix(true,true);hand!.getWorldPosition(shoulder);wrist.lerpVectors(shoulder,wrist,contact.weight);
  q.slerpQuaternions(oldQ,desired,contact.weight);desired.copy(q);
  frame.updateWorldMatrix(true,false);pole.set(28,34,12).applyMatrix4(frame.matrixWorld);solve(wrist,pole,desired);
  if(profile?.twoHand&&leftSolve&&leftHand){
   leftHand.getWorldQuaternion(leftQ);
   point.copy(supportAnchor());
   grip.localToWorld(point);point.sub(offset.set(0,-2,0).applyQuaternion(leftQ).multiplyScalar(scale.y));
   pole.set(-28,34,12).applyMatrix4(frame.matrixWorld);leftSolve(point,pole,leftQ);
  }
 };
}
