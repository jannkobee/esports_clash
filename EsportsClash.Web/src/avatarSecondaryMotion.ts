import * as THREE from 'three';
import type { AvatarPose } from './threeAvatarModels.ts';

export const AVATAR_CROSSFADE_SECONDS = .20;
const clamp = THREE.MathUtils.clamp;
/** Exact damped spring step with a constant target; stable at variable frame rates. */
export function springStep(position:number, velocity:number, target:number, dt:number) {
  const omega=12, damping=.7, decay=Math.exp(-damping*omega*dt);
  const frequency=omega*Math.sqrt(1-damping*damping), offset=position-target;
  const a=(velocity+damping*omega*offset)/frequency, sin=Math.sin(frequency*dt), cos=Math.cos(frequency*dt);
  return {
    position:target+decay*(offset*cos+a*sin),
    velocity:decay*(velocity*cos-(damping*omega*a+frequency*offset)*sin),
  };
}

/** Presentation only. Call after a fresh clip pose; nothing is accumulated into clips. */
export function avatarSecondaryMotion(root:THREE.Object3D) {
  root.updateWorldMatrix(true,true);
  const rotation=new THREE.Quaternion(), inverse=new THREE.Quaternion(), rootRotation=new THREE.Quaternion();
  root.getWorldQuaternion(rootRotation);
  const metadata=root.userData.assetPreparation?.secondary_bones??{};
  const entries:{node:THREE.Object3D; x:THREE.Vector3; z:THREE.Vector3; depth:number; pitch:number; roll:number; vp:number; vr:number}[]=[];
  root.traverse(node=>{
    const settings=node.userData.secondaryMotion??metadata[node.name];
    const tag=String(node.userData.avatarPart??'');
    // Never guess from bone_17 or animate hands/weapons as cloth.
    if(!settings&&!/^cape-motion/.test(tag)&&!(/(?:ponytail|coat-tail|hair-chain)/i.test(node.name)&&node instanceof THREE.Bone))return;
    node.getWorldQuaternion(inverse).invert();
    entries.push({node,x:new THREE.Vector3(1,0,0).applyQuaternion(rootRotation).applyQuaternion(inverse),
      z:new THREE.Vector3(0,0,1).applyQuaternion(rootRotation).applyQuaternion(inverse),
      depth:clamp(Number(settings?.depth)||0,0,8),pitch:0,roll:0,vp:0,vr:0});
  });
  const chest=root.getObjectByName('Chest'),spine=root.getObjectByName('Spine');
  const chestAxis=new THREE.Vector3(1,0,0),spineAxis=new THREE.Vector3(0,0,1);
  if(chest){chest.getWorldQuaternion(inverse).invert();chestAxis.applyQuaternion(rootRotation).applyQuaternion(inverse);}
  if(spine){spine.getWorldQuaternion(inverse).invert();spineAxis.applyQuaternion(rootRotation).applyQuaternion(inverse);}
  let last:number|undefined, vx=0,vz=0,yaw=0;
  return (pose:AvatarPose,second:number)=>{
    const state=(pose.motionState??pose.animState??'idle').toLowerCase();
    const dead=state==='death'||state==='dead', dt=last===undefined?0:second-last;
    const moving=['walk','run','strafe'].includes(state);
    const nextX=Number.isFinite(pose.moveX)?pose.moveX!:0;
    const nextZ=Number.isFinite(pose.moveZ)?pose.moveZ!:moving?(state==='run'?180:80):0;
    const nextYaw=Number.isFinite(pose.motionYaw)?pose.motionYaw!:0;
    const reset=last===undefined||dt<0||dt>.25||dead;
    let forward=0,side=0,turn=0;
    if(!reset&&dt>0){
      const ax=(nextX-vx)/dt,az=(nextZ-vz)/dt;
      forward=clamp((ax*Math.sin(nextYaw)+az*Math.cos(nextYaw))*.00012,-.12,.12);
      side=clamp((ax*Math.cos(nextYaw)-az*Math.sin(nextYaw))*.00012,-.12,.12);
      turn=clamp(Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw))/dt*.018,-.12,.12);
    }
    const speed=Math.hypot(nextX,nextZ);
    for(const e of entries){
      if(reset){e.pitch=e.roll=e.vp=e.vr=0;}
      else if(dt>0){
        const gain=1/(1+e.depth*.35);
        const p=springStep(e.pitch,e.vp,((moving?Math.min(speed/180,1)*.06:0)+forward)*gain,dt);
        const r=springStep(e.roll,e.vr,(-side-turn)*gain,dt);
        e.pitch=clamp(p.position,-.18,.18);e.vp=p.velocity;
        e.roll=clamp(r.position,-.18,.18);e.vr=r.velocity;
      }
      e.node.quaternion.multiply(rotation.setFromAxisAngle(e.x,e.pitch));
      e.node.quaternion.multiply(rotation.setFromAxisAngle(e.z,e.roll));
    }
    // Upper-body stance shift keeps the authored hips and planted feet intact.
    const blend=THREE.MathUtils.smoothstep(pose.motionBlend??1,0,1);
    const idle=dead?0:(state==='idle'?blend:0)+(pose.previousMotion==='idle'?1-blend:0);
    if(chest)chest.quaternion.multiply(rotation.setFromAxisAngle(chestAxis,Math.sin(second*1.65)*.02*idle));
    if(spine)spine.quaternion.multiply(rotation.setFromAxisAngle(spineAxis,Math.sin(second*.8)*.006*idle));
    last=second;vx=nextX;vz=nextZ;yaw=nextYaw;
  };
}
