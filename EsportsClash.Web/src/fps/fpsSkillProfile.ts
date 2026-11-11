import type { PlayerAttributes } from '../types.ts';
import type { FpsPrimaryRole } from './fpsIdentity.ts';

export const FPS_SKILL_GROUPS={
  execution:['reactions','crosshairPlacement','flicking','tracking','precision','recoilControl','movementControl','peeking','utilityExecution'],
  tactical:['awareness','informationReading','positioning','timing','decisionMaking','adaptability','economyJudgment'],
  team:['communication','trading','coordination','calling'],
  mental:['composure','concentration','consistency','resilience','stamina'],
} as const;
export type FpsAbility=typeof FPS_SKILL_GROUPS[keyof typeof FPS_SKILL_GROUPS][number];
export const FPS_ABILITIES=Object.values(FPS_SKILL_GROUPS).flat() as FpsAbility[];
export type FpsAbilityValues=Record<FpsAbility,number>;
export interface FpsSkillProfile {
  version:1;playerId:string;revision:number;seed:number;createdAt:string;
  source:'lab-generated-v1'|'lab-custom-v1'|'legacy_estimate_v1';values:FpsAbilityValues;
}
export const FPS_ABILITY_LABELS:Record<FpsAbility,string>={
  reactions:'Reactions',crosshairPlacement:'Crosshair placement',flicking:'Flicking',tracking:'Tracking',precision:'Precision',recoilControl:'Recoil control',movementControl:'Movement control',peeking:'Peeking',utilityExecution:'Utility execution',
  awareness:'Awareness',informationReading:'Information reading',positioning:'Positioning',timing:'Timing',decisionMaking:'Decision making',adaptability:'Adaptability',economyJudgment:'Economy judgment',
  communication:'Communication',trading:'Trading',coordination:'Coordination',calling:'Calling',composure:'Composure',concentration:'Concentration',consistency:'Consistency',resilience:'Resilience',stamina:'Stamina',
};
export const FPS_ABILITY_SUPPORT:Record<FpsAbility,{active:boolean;consumer:string}>={
  reactions:{active:true,consumer:'Noticed-contact to motor-response delay'},crosshairPlacement:{active:true,consumer:'Stable prepared-angle offset'},
  flicking:{active:true,consumer:'Large acquired-target correction'},tracking:{active:true,consumer:'Observed-sample motion estimate and sustained correction'},precision:{active:true,consumer:'Terminal correction and residual input error'},
  recoilControl:{active:true,consumer:'Compensation of actual accumulated weapon recoil'},movementControl:{active:true,consumer:'Brake-input initiation; fixed physical movement limits'},peeking:{active:true,consumer:'Chosen jiggle endpoint/return execution'},utilityExecution:{active:true,consumer:'Chosen throw placement error before ballistic resolution'},
  awareness:{active:true,consumer:'Lawful cue attention cadence'},informationReading:{active:true,consumer:'Evidence interpretation and uncertain sound localization'},positioning:{active:true,consumer:'Known-threat cover geometry selection'},timing:{active:true,consumer:'Timing pressure after a noticed shot cue'},decisionMaking:{active:true,consumer:'Contextual action comparison'},adaptability:{active:true,consumer:'Evidence-triggered plan assessment delay'},
  economyJudgment:{active:false,consumer:'Reserved: exhibition purchases are controlled by team policy'},
  communication:{active:true,consumer:'First-hand report latency and quality'},trading:{active:true,consumer:'Follow-up spacing and lane support'},coordination:{active:true,consumer:'Execute release spacing'},calling:{active:true,consumer:'Caller selection and command acknowledgment'},
  composure:{active:true,consumer:'Acute-pressure input noise'},concentration:{active:true,consumer:'Sustained attention under quiet/overload demand'},consistency:{active:true,consumer:'Symmetric conditional execution variation'},resilience:{active:true,consumer:'Recovery of event-caused attention setback'},stamina:{active:true,consumer:'Sustained exertion accumulation/recovery'},
};

export function fpsSkillRandom(seed:number,domain:string):()=>number {
  let state=seed>>>0;
  for(const char of domain)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
  return ()=>{let n=state+=0x6D2B79F5;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
export function validateFpsSkillProfile(value:unknown,playerId?:string):FpsSkillProfile {
  const p=value as FpsSkillProfile;
  if(!p||p.version!==1||typeof p.playerId!=='string'||(playerId!==undefined&&p.playerId!==playerId)||!Number.isInteger(p.revision)||p.revision<1
    ||!Number.isInteger(p.seed)||p.seed<1||p.seed>2147483647||typeof p.createdAt!=='string'||!Number.isFinite(Date.parse(p.createdAt))
    ||!['lab-generated-v1','lab-custom-v1','legacy_estimate_v1'].includes(p.source)||!p.values||Object.keys(p.values).length!==25
    ||FPS_ABILITIES.some(key=>!Number.isFinite(p.values[key])||p.values[key]<1||p.values[key]>10))throw Error('Invalid versioned FPS skill profile.');
  return {version:1,playerId:p.playerId,revision:p.revision,seed:p.seed,createdAt:p.createdAt,source:p.source,values:{...p.values}};
}
export function generateFpsSkillProfile(playerId:string,seed:number,createdAt:string):FpsSkillProfile {
  const random=fpsSkillRandom(seed,`skill-profile:${playerId}`),values={} as FpsAbilityValues;
  for(const group of Object.values(FPS_SKILL_GROUPS)){
    const cluster=4.8+random()*2.6;
    for(const key of group)values[key]=Math.round(Math.max(1,Math.min(10,cluster+(random()+random()-1)*3.8))*10)/10;
  }
  return validateFpsSkillProfile({version:1,playerId,revision:1,seed,createdAt,source:'lab-generated-v1',values});
}
export function pinFpsSkillProfile(value:unknown,playerId:string):FpsSkillProfile {
  const p=validateFpsSkillProfile(value,playerId);Object.freeze(p.values);return Object.freeze(p);
}
/** Shadow estimates are explicitly imputed. In particular old CLU does not identify Composure. */
export function estimateLegacyFpsSkillProfile(playerId:string,stats:PlayerAttributes,seed:number,createdAt:string):FpsSkillProfile {
  const p=generateFpsSkillProfile(playerId,seed,createdAt),random=fpsSkillRandom(seed,`imputation:${playerId}`);
  const groupBase=[stats.lan,stats.iq,stats.tf,50];
  Object.values(FPS_SKILL_GROUPS).forEach((keys,i)=>{
    const offsets=keys.map(()=>random()*2-1),mean=offsets.reduce((a,b)=>a+b,0)/offsets.length;
    keys.forEach((key,k)=>{p.values[key]=Math.round(Math.max(1,Math.min(10,1+Math.max(0,Math.min(100,groupBase[i]))*.09+offsets[k]-mean))*10)/10;});
  });
  p.source='legacy_estimate_v1';return p;
}
export const fpsAbilityUnit=(profile:FpsSkillProfile,key:FpsAbility)=>(profile.values[key]-1)/9;
export function fpsSkillSummaries(profile:FpsSkillProfile):Record<'Mechanics'|'Teamplay'|'Tactics'|'Calling'|'Composure'|'Stamina'|'Adaptability',number>{
  const average=(keys:readonly FpsAbility[])=>Math.round(keys.reduce((n,key)=>n+profile.values[key],0)/keys.length*10)/10;
  return {Mechanics:average(FPS_SKILL_GROUPS.execution),Teamplay:average(['communication','trading','coordination']),Tactics:average(FPS_SKILL_GROUPS.tactical.filter(k=>k!=='economyJudgment')),
    Calling:profile.values.calling,Composure:profile.values.composure,Stamina:profile.values.stamina,Adaptability:profile.values.adaptability};
}
const roleWeights:Record<FpsPrimaryRole,Partial<Record<FpsAbility,number>>>={
  entry:{crosshairPlacement:2,reactions:2,peeking:2,movementControl:1,precision:1},trade:{trading:3,awareness:1,reactions:1,precision:1},
  sniper:{crosshairPlacement:2,precision:3,flicking:2,composure:1},support:{utilityExecution:3,communication:2,coordination:2,decisionMaking:1},
  lurker:{informationReading:2,timing:2,positioning:2,awareness:1},anchor:{positioning:2,composure:2,informationReading:1,utilityExecution:1},caller:{calling:3,informationReading:2,decisionMaking:2,communication:1},
};
export function fpsDetailedRoleFit(profile:FpsSkillProfile,role:FpsPrimaryRole):number {
  const weights=Object.entries(roleWeights[role]) as [FpsAbility,number][];
  return weights.reduce((n,[key,w])=>n+profile.values[key]*w,0)/weights.reduce((n,[,w])=>n+w,0);
}
