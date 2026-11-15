import type { PlayerAttributes } from '../types.ts';

const unit=(value:number|undefined)=>Math.max(0,Math.min(1,(value??50)/100));
export interface LiveSkills { mechanics:number;recoilControl:number;gameSense:number;teamwork:number;clutch:number;stamina:number;flexibility:number;leadership:number }
export function liveSkills(stats:PlayerAttributes):LiveSkills {
  // Legacy cards have no standalone recoil rating; retain LAN only as their explicit compatibility estimate.
  return {mechanics:unit(stats.rifling),recoilControl:unit(stats.rifling),gameSense:unit(stats.positioning),teamwork:unit(stats.entry),clutch:.5,stamina:.5,flexibility:.5,leadership:unit(stats.shotcalling??(stats.positioning*.6+stats.entry*.4))};
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
  {rifling:88,entry:72,positioning:66,sniping:78,utility:80,shotcalling:63},
  {rifling:91,entry:68,positioning:79,sniping:88,utility:71,shotcalling:65},
  {rifling:73,entry:86,positioning:91,sniping:82,utility:78,shotcalling:93},
  {rifling:85,entry:90,positioning:76,sniping:72,utility:88,shotcalling:73},
  {rifling:70,entry:87,positioning:86,sniping:77,utility:86,shotcalling:85},
];
