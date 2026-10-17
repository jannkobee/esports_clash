import * as THREE from 'three';
import {avatarDesign} from './avatarDesigns.ts';
import {hasStandingAnatomy} from './avatarStance.ts';
import type {AvatarPose} from './threeAvatarModels.ts';
import {AVATAR_MESH_PROFILES} from './avatarMeshProfiles.ts';

type Arm = readonly [number, number, number, number, number]; // shoulder x/y/z, elbow x/z
type Style = {left: Arm; right: Arm; spread: number; stagger: number; bend: number; twist: number; strike: Arm; cast: Arm; cycle: number};
const arm=(x:number,y:number,z:number,e:number,ez=0):Arm=>[x,y,z,e,ez];
const STYLES = {
  mage: {left:arm(-.46,-.24,-.38,-.85),right:arm(-.62,.2,.42,-.98),spread:2.1,stagger:3.3,bend:.24,twist:.16,strike:arm(-.65,-.25,-.06,.38),cast:arm(-.7,.2,.4,-.3),cycle:.8},
  archer: {left:arm(-.56,-.18,-.16,-.32),right:arm(-.48,-.35,-.35,-.8,-.35),spread:2.6,stagger:4.8,bend:.27,twist:.28,strike:arm(-.42,-.25,-.05,-.4,-.3),cast:arm(-.6,.1,.15,-.1),cycle:.86},
  gun: {left:arm(-.5,.24,-.25,-.7),right:arm(-.48,-.12,.16,-.55),spread:2.7,stagger:4.2,bend:.28,twist:.19,strike:arm(.22,.05,.06,-.28),cast:arm(-.55,-.2,.25,-.3),cycle:.65},
  dual: {left:arm(-.6,-.2,-.3,-.78),right:arm(-.5,.15,.32,-.7),spread:3.4,stagger:4.4,bend:.33,twist:.27,strike:arm(-.65,-.65,.42,.6),cast:arm(-.9,.5,.3,-.2),cycle:.72},
  sword: {left:arm(-.4,-.1,-.25,-.95),right:arm(-.48,.18,.26,-.72),spread:3,stagger:4.5,bend:.26,twist:.22,strike:arm(-.95,-.6,.45,.65),cast:arm(-.9,.3,.2,-.25),cycle:.9},
  shield: {left:arm(-.56,-.16,-.26,-.62),right:arm(-.35,.2,.26,-.6),spread:3.2,stagger:4.1,bend:.27,twist:.12,strike:arm(-.85,-.45,.35,.55),cast:arm(-.6,.12,.22,-.3),cycle:1},
  fist: {left:arm(-.76,-.1,-.23,-1.12),right:arm(-.64,.1,.2,-1.2),spread:3.2,stagger:4.6,bend:.36,twist:.18,strike:arm(-.95,-.25,-.1,1.05),cast:arm(-1.1,.15,.25,.7),cycle:.67},
  staff: {left:arm(-.35,-.15,-.25,-.8),right:arm(-.3,.08,.18,-.4),spread:2.9,stagger:4.6,bend:.27,twist:.22,strike:arm(-.7,-.55,.25,.4),cast:arm(-.8,.25,.18,-.2),cycle:.95},
  heavy: {left:arm(-.25,-.08,-.26,-.6),right:arm(-.3,.12,.22,-.5),spread:3.8,stagger:3.8,bend:.29,twist:.1,strike:arm(-.8,-.6,.35,.48),cast:arm(-.7,.2,.25,-.3),cycle:1.1},
  dancer: {left:arm(-.46,-.25,-.42,-.7),right:arm(-.42,.2,.4,-.68),spread:2.2,stagger:4.1,bend:.25,twist:.24,strike:arm(-.7,-.55,.5,.6),cast:arm(-.8,.3,.4,-.4),cycle:.76},
  creature: {left:arm(-.35,0,-.25,-.6),right:arm(-.4,0,.3,-.65),spread:0,stagger:0,bend:.2,twist:.12,strike:arm(-.7,-.3,.25,.45),cast:arm(-.8,.2,.3,-.2),cycle:.9},
} satisfies Record<string,Style>;
type StyleName=keyof typeof STYLES;
/** Explicit full-roster direction: no role/hash fallback determines a character's fighting style. */
export const COMBAT_MOTIONS: Readonly<Record<string,{style:StyleName;weight:number;lead:number;creature?:string}>>=Object.freeze({
 c_solana:{style:'shield',weight:1.1,lead:-1},c_astra:{style:'archer',weight:.95,lead:-1},c_kyumi:{style:'mage',weight:.9,lead:1},
 c_buck:{style:'gun',weight:1.2,lead:1},c_valkira:{style:'dual',weight:1.08,lead:-1},c_kage:{style:'dual',weight:.84,lead:1},
 c_kazemaru:{style:'sword',weight:.9,lead:1},c_kindra:{style:'archer',weight:.86,lead:1},c_cora:{style:'dancer',weight:.86,lead:-1},
 c_renn:{style:'dancer',weight:.92,lead:1},c_sylla:{style:'staff',weight:1.14,lead:-1},c_tequoia:{style:'staff',weight:.98,lead:1},
 c_zal:{style:'staff',weight:.9,lead:-1},c_xin:{style:'dual',weight:.95,lead:-1},c_raijin:{style:'mage',weight:1.15,lead:1},
 c_kaolin:{style:'heavy',weight:1.3,lead:-1},c_inai:{style:'staff',weight:.8,lead:1},c_qiyana:{style:'dancer',weight:1,lead:1},
 c_locke:{style:'sword',weight:.98,lead:-1},c_senna:{style:'gun',weight:1.18,lead:-1},c_largo:{style:'creature',weight:1,lead:1,creature:'frog'},
 c_shadowfiend:{style:'creature',weight:1.1,lead:-1,creature:'demon'},c_earthshaker:{style:'heavy',weight:1.4,lead:1},
 c_mirehook:{style:'heavy',weight:1.28,lead:-1},c_nullweaver:{style:'creature',weight:.7,lead:1,creature:'void'},
 c_voltgrip:{style:'creature',weight:1.4,lead:1,creature:'machine'},c_aetherbolt:{style:'mage',weight:.86,lead:-1},
 c_corsara:{style:'gun',weight:.94,lead:1},c_brewmaw:{style:'heavy',weight:1.35,lead:1},c_wraithhook:{style:'staff',weight:.95,lead:-1},
 c_invoker:{style:'mage',weight:1,lead:-1},c_hwei:{style:'staff',weight:.87,lead:1},c_jayce:{style:'heavy',weight:1.12,lead:-1},
 c_vi:{style:'fist',weight:1.1,lead:-1},c_jinx:{style:'gun',weight:.82,lead:1},c_puck:{style:'creature',weight:.65,lead:1,creature:'dragon'},
 c_batrider:{style:'creature',weight:.9,lead:-1,creature:'rider'},c_bristleback:{style:'creature',weight:1.2,lead:1,creature:'beast'},
 c_io:{style:'creature',weight:.6,lead:-1,creature:'light'},c_lulu:{style:'staff',weight:.72,lead:1},c_silencer:{style:'shield',weight:1.05,lead:-1},
 c_wukong_lol:{style:'staff',weight:.9,lead:1},c_monkeyking_dota:{style:'staff',weight:1.08,lead:-1},c_stepstone:{style:'fist',weight:.91,lead:1},
 c_skybreaker:{style:'creature',weight:1.2,lead:1,creature:'skiff'},
});
export const COMBAT_CLIPS=Object.freeze(['Idle','Walk','Run','Strafe','Attack','Cast','Hit','Death','TurnLeft','TurnRight']);
export function combatDuration(id:string,state:string){
 const style=STYLES[COMBAT_MOTIONS[id]?.style??'mage'];
 return state==='attack'?style.cycle*(COMBAT_MOTIONS[id]?.weight??1):state==='cast'?1.35:state==='hit'?.42:state==='death'?1.2:
  state==='walk'?.8:state==='run'?.6:state==='strafe'?1:state.startsWith('turn')?.65:2.4;
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
// Hand-authored timing: anticipation, release, follow-through, recovery. No hit resolution here.
const ATTACK=[[0,0],[.18,-.28],[.42,1],[.61,.38],[1,0]];
const CAST=[[0,0],[.25,-.2],[.55,1],[.73,.65],[1,0]];
function keySample(keys:number[][],time:number){
 const t=clamp(time);let index=1;while(index<keys.length-1&&t>keys[index][0])index++;
 const a=keys[index-1],b=keys[index];return THREE.MathUtils.lerp(a[1],b[1],ease((t-a[0])/(b[0]-a[0])));
}

export function combatAnimator(body:THREE.Group,id:string){
 const direction=COMBAT_MOTIONS[id];if(!direction)return (_pose:AvatarPose,_second:number)=>{};
 const style=STYLES[direction.style],standing=hasStandingAnatomy(id),width=(avatarDesign(id)?.width??12)*.85,art=AVATAR_MESH_PROFILES[id];
 const parts=new Map<string,THREE.Object3D>();body.traverse(node=>{if(node.userData.avatarPart)parts.set(node.userData.avatarPart,node);});
 const hips=body.getObjectByName('Hips')!,spine=body.getObjectByName('Spine')!,chest=body.getObjectByName('Chest')!,head=body.getObjectByName('Head')!;
 const arms=[parts.get('left-arm')!,parts.get('right-arm')!],elbows=['ForearmL','ForearmR'].map(n=>body.getObjectByName(n)!);
 const hands=['HandL','HandR'].map(n=>body.getObjectByName(n)!),legs=[parts.get('leg:-1')!,parts.get('leg:1')!];
 const calves=['CalfL','CalfR'].map(n=>body.getObjectByName(n)!),feet=['FootL','FootR'].map(n=>body.getObjectByName(n)!);
 const pivot=parts.get('motion-pivot');
 const animated=[hips,spine,chest,head,...arms,...elbows,...hands,...legs,...calves,...feet,...(pivot?[pivot]:[])];
 const previous=animated.map(()=>({position:new THREE.Vector3(),quaternion:new THREE.Quaternion()}));
 const previousBodyPosition=new THREE.Vector3();
 const rotation=new THREE.Quaternion(),q=new THREE.Quaternion();
 const aimRotation=new THREE.Quaternion(),aimEuler=new THREE.Euler();
 function sample(state:string,time:number,gaitPhase?:number){
  const duration=combatDuration(id,state),cyclic=['idle','walk','run','strafe','attack','cast'].includes(state);
  const phase=['walk','run','strafe'].includes(state)&&gaitPhase!==undefined?gaitPhase:cyclic?((time%duration)+duration)%duration/duration:clamp(time/duration);
  const attack=state==='attack'?keySample(ATTACK,phase):0,cast=state==='cast'?keySample(CAST,phase):0;
  const hit=state==='hit'?Math.sin(Math.PI*clamp(phase))* (1-phase*.5):0;
  const death=state==='death'?ease(phase):0,turn=state==='turnleft'?-Math.sin(Math.PI*phase):state==='turnright'?Math.sin(Math.PI*phase):0;
  const moving=state==='walk'||state==='run'||state==='strafe',gait=Math.sin(phase*Math.PI*2),breath=Math.sin(phase*Math.PI*2)*.018;
  const stroke=attack*(art?.sweep??0),castStroke=cast*(art?.sweep??0)*.4;
  if(pivot){pivot.position.set(0,0,0);pivot.rotation.set(0,0,0);}
  body.position.y=body.userData.floating?(8+Math.sin(phase*Math.PI*2)*1.2)*(1-death):0;
  if(standing){
   const lunge=attack*.1+cast*.05,crouch=style.bend+(state==='run'?.12:0)+hit*.08+death*.5;
   hips.position.set(-direction.lead*.65,32-1.4*direction.weight-death*8,.8+attack*.8-hit*1.1);
   hips.rotation.set(.20+lunge,style.twist*.5+attack*.12,.035*direction.lead);
   spine.rotation.set(-.38+breath-hit*.2+death*.7,style.twist*.3+attack*.1,0);
   chest.rotation.set(.18+lunge-hit*.22+death*.35,-style.twist+attack*.3+cast*.12+turn*.45,-.035*direction.lead);
   head.rotation.set(-.03-lunge+hit*.13+death*.45,style.twist*.18-turn*.15,0);
   // Equipment-specific weight transfer, sampled before wrist aim/contact solving.
   if(art){
    hips.position.z+=stroke*(art.attack==='thrust'||art.attack==='punch'?4:1.2);
    hips.rotation.y+=stroke*(art.attack==='cut'||art.attack==='sweep'?-.3:.12);
    chest.rotation.y+=stroke*(art.attack==='cut'||art.attack==='sweep'?.65:art.attack==='shot'?-.15:.25);
    chest.rotation.x+=stroke*(art.attack==='crush'?.25:art.attack==='weave'?-.1:.08);
    chest.rotation.z+=castStroke*(direction.lead*.4);
   }
   for(let i=0;i<2;i++){
    const side=i?1:-1,ready=i?style.right:style.left;
    const power=i?1:direction.style==='archer'?.25:.65;
    const movement=moving?gait*(i?-1:1)*(state==='run'?.32:.17):0;
    arms[i].rotation.set(ready[0]+attack*style.strike[0]*power+cast*style.cast[0]-movement+hit*.25+death*.4,
      ready[1]+attack*style.strike[1]*power+cast*style.cast[1],ready[2]+attack*style.strike[2]*side*.4+cast*style.cast[2]*side+turn*side*.15);
    elbows[i].rotation.set(ready[3]+attack*style.strike[3]*power+cast*style.cast[3]+death*.5,0,ready[4]+attack*style.strike[4]*power);
    if(art){
     arms[i].rotation.y+=stroke*(art.attack==='cut'||art.attack==='sweep'?side*.45:art.attack==='weave'?side*.3:0);
     arms[i].rotation.z+=castStroke*side*.5;
     if(art.attack==='punch'){arms[i].rotation.x-=stroke*(i?.6:.25);elbows[i].rotation.x+=stroke*(i?.55:.15);}
     if(art.attack==='thrust'&&i){arms[i].rotation.x-=stroke*.5;elbows[i].rotation.x+=stroke*.5;}
    }
    const wrist=direction.style==='archer'||direction.style==='gun'?-arms[i].rotation.x-elbows[i].rotation.x-(i?0:.18):direction.style==='staff'?.4:-.05;
    hands[i].rotation.set(wrist,side*.12+cast*side*.3,cast*side*.15);
    if(art?.attack==='weave')hands[i].rotation.y+=stroke*side*.25;
    if(direction.style==='archer'||direction.style==='gun'){
     // Keep long barrels/arrows aimed forward even while the torso recoils or collapses.
     // Counter the complete shoulder chain, including its yaw/roll, rather than just elbow pitch.
     rotation.copy(hips.quaternion).multiply(spine.quaternion).multiply(chest.quaternion).multiply(arms[i].quaternion).multiply(elbows[i].quaternion).invert();
     aimRotation.setFromEuler(aimEuler.set(direction.style==='archer'&&!i?-.12:0,style.twist*.15,side*.06));
     hands[i].quaternion.copy(rotation).multiply(aimRotation);
    }
    const knee=crouch+(i?.07:0),stride=moving?gait*(i?-1:1)*(state==='run'?.55:.35):0;
    const legX=-knee+stride+side*direction.lead*style.stagger/29,calfX=knee*1.9+(moving?Math.max(0,-gait*(i?-1:1))*.25:0);
    const spread=side*(.075+style.spread/29);
    legs[i].rotation.set(legX,0,spread);calves[i].rotation.set(calfX,0,0);
    // Solve vertical reach analytically; ankles invert the actual combined rotation.
    // Spread from the hip joint instead of translating the thigh out of the pelvis.
    legs[i].position.set(side*width*.43,4+17*Math.cos(spread)*Math.cos(legX)+12*(Math.cos(spread)*Math.cos(calfX)*Math.cos(legX)-Math.sin(calfX)*Math.sin(legX))+(moving?Math.max(0,gait*(i?-1:1))*3:0),.8);
    rotation.copy(legs[i].quaternion).multiply(q.copy(calves[i].quaternion));feet[i].quaternion.copy(rotation).invert();
   }
  }else{
   // Nonhuman silhouettes have their own whole-body keyframe accents, not human foot placement.
   hips.rotation.set(0,0,0);spine.rotation.set(0,0,0);chest.rotation.set(0,0,0);head.rotation.set(0,0,0);
   for(let i=0;i<2;i++){
    arms[i].rotation.set(-.35-attack*(i?.9:.6)-cast*.5,0,(i?1:-1)*.22);elbows[i].rotation.set(-.3+attack*.35,0,0);hands[i].rotation.set(0,0,0);
    legs[i].rotation.set(moving?gait*(i?-1:1)*.22:0,0,0);calves[i].rotation.set(moving?Math.max(0,-gait*(i?-1:1))*.3:0,0,0);feet[i].rotation.set(0,0,0);
   }
   if(pivot){
    const kind=direction.creature;
    const floating=['void','light','dragon','rider','skiff','demon'].includes(kind??'');
    pivot.position.y=(floating?Math.sin(phase*Math.PI*2)*1.2:moving?Math.max(0,gait)*1.3:breath*5)-death*5;
    pivot.rotation.set((kind==='skiff'?.035:.07)*gait+attack*.13+stroke*.16-hit*.16+death*.35,attack*.2+stroke*.25+turn*.32,
      (kind==='dragon'||kind==='rider'?.08:.025)*gait+cast*.06);
   }
  }
 }
 return (pose:AvatarPose,second:number)=>{
  const state=pose.motionState??(pose.animState==='dead'?'death':pose.animState??'idle');
  const time=pose.motionTime??pose.animTimer??second;
  if(pose.previousMotion&&pose.motionBlend!==undefined&&pose.motionBlend<1){
   sample(pose.previousMotion,pose.previousMotionTime??0);
   previousBodyPosition.copy(body.position);
   animated.forEach((node,i)=>{previous[i].position.copy(node.position);previous[i].quaternion.copy(node.quaternion);});
   sample(state,time,pose.gaitPhase);const blend=ease(pose.motionBlend);
   animated.forEach((node,i)=>{node.position.lerpVectors(previous[i].position,node.position,blend);node.quaternion.slerpQuaternions(previous[i].quaternion,node.quaternion,blend);});
   body.position.lerpVectors(previousBodyPosition,body.position,blend);
  }else sample(state,time,pose.gaitPhase);
  chest.rotation.x-=(pose.recoil??0)*.2;
 };
}
