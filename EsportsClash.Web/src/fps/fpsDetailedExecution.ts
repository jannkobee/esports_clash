import { fpsAbilityUnit, type FpsAbility, type FpsSkillProfile } from './fpsSkillProfile.ts';
import { liveAimAngle } from './fpsLiveAim.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { LiveWeapon } from './fpsLiveWeapons.ts';

export interface FpsMentalState {setback:number;attentionDebt:number;exertion:number}
export interface FpsSkillDiagnostics {
  noticedAt:number;cueAt:number;responseAt:number;reactionDelay:number;preAimError:number;inputErrorSum:number;inputSamples:number;
  reportDelaySum:number;reports:number;throwErrorSum:number;throws:number;recoilSamples:number;recoilResidualSum:number;
  brakeDelay:number;peekError:number;planAssessments:number;commands:number;decisions:number;
  timingWindows:number;
  inputErrorSquareSum:number;trackingErrorSum:number;trackingSamples:number;flickAngleRemoved:number;fineAngleRemoved:number;
  coverChoices:number;coverExposureSum:number;followSpacing:number;entryReleaseDelay:number;commandDelay:number;planAssessmentDelay:number;
}
export const emptyFpsSkillDiagnostics=():FpsSkillDiagnostics=>({noticedAt:-1,cueAt:-1,responseAt:-1,reactionDelay:0,preAimError:0,inputErrorSum:0,inputSamples:0,reportDelaySum:0,reports:0,throwErrorSum:0,throws:0,recoilSamples:0,recoilResidualSum:0,brakeDelay:0,peekError:0,planAssessments:0,commands:0,decisions:0,timingWindows:0,inputErrorSquareSum:0,trackingErrorSum:0,trackingSamples:0,flickAngleRemoved:0,fineAngleRemoved:0,coverChoices:0,coverExposureSum:0,followSpacing:0,entryReleaseDelay:0,commandDelay:0,planAssessmentDelay:0});
export const ability=(p:FpsSkillProfile,key:FpsAbility)=>fpsAbilityUnit(p,key);
export const detailedReactionDelay=(p:FpsSkillProfile)=>.45-ability(p,'reactions')*.27;
export function tickFpsMentalState(p:FpsSkillProfile,state:FpsMentalState,dt:number,speed:number,engaged:boolean,quiet:number):FpsMentalState {
  const stamina=ability(p,'stamina'),focus=ability(p,'concentration'),resilience=ability(p,'resilience');
  return {setback:Math.max(0,state.setback-dt*(.018+resilience*.075)),
    attentionDebt:Math.max(0,Math.min(1,state.attentionDebt+dt*(quiet>18?(1-focus)*.008:engaged?-.04:-.012))),
    exertion:Math.max(0,Math.min(1,state.exertion+dt*(engaged||speed>2.5?.0015+(1-stamina)*.0015:-.003-stamina*.002)))};
}
export function detailedSenseInterval(p:FpsSkillProfile,state:FpsMentalState):number {
  return .08+(1-ability(p,'awareness'))*.24+state.attentionDebt*.18+state.setback*.14+state.exertion*.08;
}
export function detailedAimYaw(yaw:number,desired:number,p:FpsSkillProfile,phase:'flick'|'track'|'fine',dt:number):number {
  const error=liveAimAngle(desired-yaw),key=phase==='flick'?'flicking':phase==='track'?'tracking':'precision',skill=ability(p,key);
  const maxStep=(phase==='flick'?2.5+skill*5:phase==='track'?2+skill*4:1.5+skill*3)*dt;
  const eased=error*(1-Math.exp(-(phase==='fine'?7+skill*17:10+skill*8)*dt));
  return Math.abs(error)<.001?desired:liveAimAngle(yaw+Math.max(-maxStep,Math.min(maxStep,eased)));
}
/** Symmetric input error has zero mean. No clipping of latent skill or favorable-outcome selection. */
export function detailedInputError(p:FpsSkillProfile,pressure:number,random:()=>number):number {
  const precision=.001+(1-ability(p,'precision'))*.016;
  const pressureNoise=pressure*(1-ability(p,'composure'))*.013;
  const variance=.65+(1-ability(p,'consistency'))*.7;
  return (random()+random()-1)*(precision+pressureNoise)*variance;
}
export const preparedAngleError=(p:FpsSkillProfile,random:()=>number)=>(random()*2-1)*(.004+(1-ability(p,'crosshairPlacement'))*.16);
export function detailedThrowPoint(p:FpsSkillProfile,from:FpsPoint,target:FpsPoint,random:()=>number):FpsPoint {
  const radius=.08+(1-ability(p,'utilityExecution'))*(.4+Math.hypot(target.x-from.x,target.z-from.z)*.075);
  const angle=random()*Math.PI*2,r=Math.sqrt(random())*radius;
  return {x:target.x+Math.cos(angle)*r,z:target.z+Math.sin(angle)*r};
}
export function advanceDetailedRecoil(recoil:number,p:FpsSkillProfile,dt:number):number {
  // Identical weapon impulses; the actor supplies compensation input between shots.
  const compensation=(.015+ability(p,'recoilControl')*.11)*dt;
  return Math.sign(recoil)*Math.max(0,Math.abs(recoil)-compensation);
}
export function detailedRecoilImpulse(weapon:LiveWeapon,burst:number):number {
  const magnitude=weapon==='rifle'?.018:weapon==='smg'?.012:weapon==='sniper'?.03:.006;
  return magnitude*(burst%6<3?1:-1);
}
