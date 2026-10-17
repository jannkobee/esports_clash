import * as THREE from 'three';
import {AVATAR_CONTACTS,contactGait} from './avatarContactProfiles.ts';
import {avatarDesign} from './avatarDesigns.ts';
import {AUTHORED_AVATARS} from './avatarArt.ts';
import {hasStandingAnatomy} from './avatarStance.ts';
import type {AvatarPose} from './threeAvatarModels.ts';

/** Analytic two-bone solution with a pole and an explicit wrist/ankle orientation. */
export function twoBoneSolver(upper:THREE.Object3D,lower:THREE.Object3D,end:THREE.Object3D){
 const target=new THREE.Vector3(),pole=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3(),elbow=new THREE.Vector3();
 const inverse=new THREE.Matrix4(),q=new THREE.Quaternion(),endParent=new THREE.Quaternion();
 const downA=lower.position.clone().normalize(),downB=end.position.clone().normalize();
 const a=lower.position.length(),b=end.position.length();
 return (worldTarget:THREE.Vector3,worldPole:THREE.Vector3,worldOrientation:THREE.Quaternion)=>{
  upper.parent!.updateWorldMatrix(true,false);inverse.copy(upper.parent!.matrixWorld).invert();
  target.copy(worldTarget).applyMatrix4(inverse).sub(upper.position);pole.copy(worldPole).applyMatrix4(inverse).sub(upper.position);
  const distance=THREE.MathUtils.clamp(target.length(),Math.abs(a-b)+.001,a+b-.001);
  axis.copy(target).normalize();if(axis.lengthSq()<.5)axis.set(0,-1,0);
  bend.copy(pole).addScaledVector(axis,-pole.dot(axis));
  if(bend.lengthSq()<1e-8)bend.set(0,0,1).addScaledVector(axis,-axis.z);
  if(bend.lengthSq()<1e-8)bend.set(1,0,0);bend.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance);
  elbow.copy(axis).multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
  upper.quaternion.setFromUnitVectors(downA,bend.copy(elbow).normalize());
  q.setFromUnitVectors(downB,bend.copy(axis).multiplyScalar(distance).sub(elbow).normalize());
  lower.quaternion.copy(upper.quaternion).invert().multiply(q);
  lower.updateWorldMatrix(true,false);lower.getWorldQuaternion(endParent);
  end.quaternion.copy(endParent).invert().multiply(worldOrientation);
 };
}

export function avatarContactRig(body:THREE.Group,id:string){
 const profile=AVATAR_CONTACTS[id]??{},design=avatarDesign(id);
 const standing=hasStandingAnatomy(id),grounded=standing||design?.body==='machine'||design?.body==='hedgehog';
 const parts=new Map<string,THREE.Object3D>();body.traverse(n=>{if(n.userData.avatarPart)parts.set(n.userData.avatarPart,n);});
 const frame=parts.get('outfit')!,hips=body.getObjectByName('Hips')!;
 const upper=['UpperArmL','UpperArmR'].map(n=>body.getObjectByName(n)!);
 const elbows=['ForearmL','ForearmR'].map(n=>body.getObjectByName(n)!);
 const hands=['HandL','HandR'].map(n=>body.getObjectByName(n)!);
 const thigh=['ThighL','ThighR'].map(n=>body.getObjectByName(n)!);
 const calves=['CalfL','CalfR'].map(n=>body.getObjectByName(n)!);
 const feet=['FootL','FootR'].map(n=>body.getObjectByName(n)!);
 const legs=[parts.get('leg:-1')!,parts.get('leg:1')!];
 const grips=[parts.get('left-grip'),parts.get('right-grip')];
 const armSolve=upper.map((bone,i)=>twoBoneSolver(bone,elbows[i],hands[i]));
 const legSolve=thigh.map((bone,i)=>twoBoneSolver(bone,calves[i],feet[i]));
 const gender=AUTHORED_AVATARS[id]?.gender;
 const sole=body.userData.artistOutfit?(gender==='female'?2.6133506298065186:3.166356921195984):3;
 body.userData.contactSoleOffset=sole;
 const point=new THREE.Vector3(),pole=new THREE.Vector3(),offset=new THREE.Vector3(),target=new THREE.Vector3();
 const direction=new THREE.Vector3(),rotation=new THREE.Quaternion(),orientation=new THREE.Quaternion(),roll=new THREE.Euler();
 const bodyPosition=new THREE.Vector3(),worldScale=new THREE.Vector3(),rollRotation=new THREE.Quaternion();
 const palm=new THREE.Vector3(0,-2,0),anchor=[new THREE.Vector3(),new THREE.Vector3()];
 const planted=[false,false];let lastSecond=-1,lastState='',lastBody=new THREE.Vector3();
 const frameRotation=new THREE.Quaternion(),handRotation=[new THREE.Quaternion(),new THREE.Quaternion()];
 const bow=parts.get('bow'),strings=[parts.get('bowstring-upper'),parts.get('bowstring-lower')];
 const capes=[...parts].filter(([key])=>key.startsWith('cape-motion')).map(([,node])=>node);
 function solvePalm(i:number,localTarget:THREE.Vector3,desired:THREE.Quaternion){
  frame.updateWorldMatrix(true,false);target.copy(localTarget).applyMatrix4(frame.matrixWorld);
  offset.copy(palm).applyQuaternion(desired).multiplyScalar(frame.getWorldScale(point).y);target.sub(offset);
  pole.set((i?1:-1)*((design?.width??12)+10),34,4).applyMatrix4(frame.matrixWorld);
  armSolve[i](target,pole,desired);
 }
 return {
  reset(){upper.forEach(n=>n.quaternion.identity());thigh.forEach(n=>n.quaternion.identity());if(!standing)legs.forEach(n=>n.position.y=33);},
  apply(pose:AvatarPose,second:number){
   const blending=(pose.motionBlend??1)<.5&&pose.previousMotion;
   const state=blending?pose.previousMotion!:pose.motionState??(pose.animState==='dead'?'death':pose.animState??'idle');
   const time=blending?pose.previousMotionTime??0:pose.motionTime??pose.animTimer??second;
   const contactImpulse=(duration:number,idle:number)=>{
    const impulse=(s:string,t:number)=>s==='attack'?Math.sin(Math.PI*Math.min(1,t/duration))**2:idle;
    const current=impulse(pose.motionState??pose.animState??'idle',pose.motionTime??pose.animTimer??second);
    const blend=THREE.MathUtils.smoothstep(pose.motionBlend??1,0,1);
    return pose.previousMotion?THREE.MathUtils.lerp(impulse(pose.previousMotion,pose.previousMotionTime??0),current,blend):current;
   };
   const moving=['walk','run','strafe'].includes(state),cycle=state==='run'?.6:state==='strafe'?1:.8;
   const phase=((pose.gaitPhase??time/cycle)%1+1)%1;
   const death=state==='death';
   grips.forEach((grip,i)=>{const fitting=i?profile.right:profile.left;if(grip&&fitting)grip.position.set(...fitting);});
   body.updateMatrixWorld(true);frame.getWorldQuaternion(frameRotation);
   hands.forEach((hand,i)=>hand.getWorldQuaternion(handRotation[i]));
   if(standing&&profile.bow&&bow&&!death){
    bow.position.set(0,-4,-10);bow.rotation.y=-Math.PI/2;
    const draw=contactImpulse(.8,.2)*5;
    point.set(-4,42+(id==='c_kindra'?-2:0),16);solvePalm(0,point,handRotation[0]);
    body.updateMatrixWorld(true);
    point.set(-draw,0,0);bow.localToWorld(point);frame.worldToLocal(point);
    solvePalm(1,point,handRotation[1]);
    if(grips[1])grips[1].position.set(0,-5,-5);
    strings.forEach((line,i)=>{if(!line)return;line.position.set(-draw*.5,i?-15:15,0);
     direction.set(i?-draw:draw,30,0);line.quaternion.setFromUnitVectors(offset.set(0,1,0),direction.normalize());line.scale.y=Math.hypot(30,draw)/30;});
   }else if(standing&&profile.twoHand&&grips[1]&&!death){
    const kind=profile.twoHand;
    const strike=contactImpulse(.9,0);
    if(kind==='totem')handRotation[1].copy(frameRotation).multiply(rollRotation.setFromEuler(roll.set(.15-strike*.12,0,.85-strike*.15)));
    point.set((kind==='keg'?0:kind==='gun'||kind==='totem'?1:4)-strike*3,(kind==='staff'?38:43)+strike*(kind==='gun'?0:5),(kind==='staff'?9:6)+strike*(kind==='gun'?-2:4));
    solvePalm(1,point,handRotation[1]);body.updateMatrixWorld(true);
    point.set(kind==='totem'?-11.5:kind==='keg'?-8:kind==='gun'?-2:0,kind==='gun'?-6:kind==='staff'?8:kind==='keg'?2:8,kind==='totem'||kind==='keg'?8:kind==='gun'?8:5);
    grips[1].localToWorld(point);frame.worldToLocal(point);solvePalm(0,point,handRotation[0]);
   }
   capes.forEach((cape,i)=>{cape.rotation.set((moving?.10:.025)+Math.sin(phase*Math.PI*2-i*.3)*.025,Math.sin(phase*Math.PI*2-.4)*.035,0);});
   if(grounded&&!death){
    const gait=contactGait(state),floating=!!body.userData.floating;
    if(standing)hips.position.y-=(moving?(state==='strafe'?4.8:state==='run'?4.2:2.8):2.4)+Math.max(0,3-sole);
    body.updateMatrixWorld(true);body.getWorldQuaternion(rotation);
    if(moving&&pose.moveX!==undefined&&pose.moveZ!==undefined){direction.set(pose.moveX,0,pose.moveZ).applyQuaternion(orientation.copy(rotation).invert()).normalize();}
    else direction.set(state==='strafe'?1:0,0,state==='strafe'?0:1);
    body.getWorldPosition(bodyPosition);body.getWorldScale(worldScale);
    const rewind=second<lastSecond||bodyPosition.distanceTo(lastBody)>40||!pose.plantFeet;
    for(let i=0;i<2;i++){
     const side=i?1:-1,p=(phase+i*.5)%1,swing=moving&&p>=gait.stance;
     let along=0,lift=0,pitch=0;
     if(moving){
      if(!swing){along=gait.span*(.5-p/gait.stance);pitch=Math.max(0,(p/gait.stance-.82)/.18)*.22;}
      else{const t=(p-gait.stance)/(1-gait.stance),smooth=t*t*(3-2*t),m=-gait.span/gait.stance*(1-gait.stance);
       along=-gait.span*.5+gait.span*smooth+m*(2*t*t*t-3*t*t+t);lift=Math.sin(Math.PI*t)**2*gait.lift;pitch=-.16*Math.sin(Math.PI*t);}
     }
     // Preserve hip anchors; spread comes from leg rotation, not a disconnected thigh translation.
     legs[i].position.y=standing?hips.position.y+1:moving?26.5:30;
     body.updateMatrixWorld(true);
     feet[i].getWorldPosition(point);frame.worldToLocal(point);
     if(moving){point.set(side*((design?.width??12)*(standing?.85:1)*.43+3),sole+lift,.8).addScaledVector(direction,along);}
     else point.y=sole;
     const support=pitch>=0?8:-4;
     point.y+=sole*(Math.cos(pitch)-1)+support*Math.sin(pitch);
     target.copy(point).applyMatrix4(frame.matrixWorld);
     // Ground is the avatar's plane, including knock-up/hover offsets, not a simulation query.
     if(!floating)target.y=bodyPosition.y+point.y*worldScale.y;
     const lock=pose.plantFeet&&moving&&!swing&&!floating;
     if(lock){if(rewind||!planted[i]||lastState!==state)anchor[i].copy(target);target.x=anchor[i].x;target.z=anchor[i].z;}
     planted[i]=!!lock;
     pole.set(side*((design?.width??12)*.43+2),15,24).applyMatrix4(frame.matrixWorld);
     orientation.copy(rotation).multiply(rollRotation.setFromEuler(roll.set(pitch,0,0)));
     legSolve[i](target,pole,orientation);
    }
    lastSecond=second;lastState=state;lastBody.copy(bodyPosition);
   }else planted.fill(false);
  },
 };
}
