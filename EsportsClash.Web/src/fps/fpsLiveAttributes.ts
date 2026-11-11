import type { PlayerAttributes } from '../types.ts';

const unit=(value:number|undefined)=>Math.max(0,Math.min(1,(value??50)/100));
export interface LiveSkills { mechanics:number;gameSense:number;teamwork:number;clutch:number;stamina:number;flexibility:number;leadership:number }
export function liveSkills(stats:PlayerAttributes):LiveSkills {
  return {mechanics:unit(stats.lan),gameSense:unit(stats.iq),teamwork:unit(stats.tf),clutch:unit(stats.clu),stamina:unit(stats.sta),flexibility:unit(stats.flx),leadership:unit(stats.ldr??(stats.iq*.6+stats.tf*.4))};
}
/** Attributes change the quality/timing of an attempt, never guarantee the selected outcome. */
export function liveDecisionInterval(skills:LiveSkills):number {return 1.65-skills.gameSense*.45-skills.flexibility*.5;}
export function liveReactionTime(skills:LiveSkills,pressure:number,exertion:number):number {
  return .49-skills.mechanics*.19-skills.gameSense*.08+pressure*(1-skills.clutch)*.14+exertion*(1-skills.stamina)*.1;
}
export function livePressure(allies:number,knownThreats:number,remaining:number,objective:boolean):number {
  return Math.min(1,(allies===1?.5:0)+Math.max(0,knownThreats-allies)*.15+(objective&&remaining<15?.4:0));
}
export function liveAimSpread(skills:LiveSkills,base:number,pressure:number,exertion:number,moving:boolean|number,burst:number):number {
  return base*(1.8-skills.mechanics*1.1)*(1+pressure*(1-skills.clutch)*.65+exertion*(1-skills.stamina)*.35)
    +(typeof moving==='number'?Math.max(0,Math.min(1,moving))*.022:moving?.022:0)+Math.max(0,burst-2)*.0015*(1.1-skills.mechanics*.65);
}
export function liveReportDelay(skills:LiveSkills,communication:number):number {
  return .12+(1-skills.teamwork)*.65+(1-communication)*.5;
}

/** Deliberately fictional demonstration profiles, paired to keep team averages comparable. */
export const LIVE_DEMO_ATTRIBUTES:PlayerAttributes[]=[
  {lan:88,tf:72,iq:66,clu:78,sta:80,flx:83,ldr:63},
  {lan:91,tf:68,iq:79,clu:88,sta:71,flx:72,ldr:65},
  {lan:73,tf:86,iq:91,clu:82,sta:78,flx:80,ldr:93},
  {lan:85,tf:90,iq:76,clu:72,sta:88,flx:70,ldr:73},
  {lan:70,tf:87,iq:86,clu:77,sta:86,flx:88,ldr:85},
];
