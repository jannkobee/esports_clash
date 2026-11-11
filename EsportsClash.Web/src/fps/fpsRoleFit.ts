export type FpsSkillKey = 'lan'|'tf'|'iq'|'ldr'|'clu'|'sta'|'flx';
export interface FpsRoleDefinition {
  id:string; name:string; summary:string; strengths:string; tradeoff:string;
  weights:Partial<Record<FpsSkillKey,number>>; matchUse:string;
}
export const FPS_ROLES: FpsRoleDefinition[] = [
  {id:'entry',name:'Entry Fragger',summary:'Takes first contact and opens space for the team.',strengths:'Aim, flexibility and close follow-up.',tradeoff:'Needs a teammate ready to trade the opening duel.',weights:{lan:.7,flx:.2,tf:.1},matchUse:'The match assigns an entry from the complete attacking lineup each round.'},
  {id:'caller',name:'Shotcaller',summary:'Calls the site plan, coordinates the execute and reads the round.',strengths:'Shotcalling, game sense and teamwork.',tradeoff:'A good plan still needs aim and team execution.',weights:{ldr:.6,iq:.3,tf:.1},matchUse:'IGL is a separate responsibility and can accompany any combat assignment.'},
  {id:'sniper',name:'Sniper',summary:'Uses a precision rifle to threaten long sightlines.',strengths:'Aim, clutch skill and game sense.',tradeoff:'Expensive equipment makes a lost opening costly.',weights:{lan:.55,clu:.35,iq:.1},matchUse:'Sniper purchases also require enough money and a suitable round assignment.'},
  {id:'support',name:'Utility Support',summary:'Prepares smoke and flash layers and helps the entry reach the site.',strengths:'Game sense, teamwork and flexibility.',tradeoff:'Utility only helps when the team follows it.',weights:{iq:.45,tf:.35,flx:.2},matchUse:'Support carries the device and prepares resources for the execute.'},
  {id:'lurker',name:'Lurker',summary:'Works away from the main group to pressure rotations and watch a flank.',strengths:'Game sense, clutch decisions and flexibility.',tradeoff:'Distance from teammates makes immediate trades harder.',weights:{iq:.4,clu:.35,flx:.25},matchUse:'Uses a separate approach and guards the entry flank after a plant in identity matches.'},
  {id:'anchor',name:'Site Anchor',summary:'Holds a defensive site and buys time for rotations.',strengths:'Game sense, clutch decisions and trading.',tradeoff:'May need to hold with limited nearby support.',weights:{iq:.4,clu:.35,tf:.25},matchUse:'The defending lineup assigns an anchor each round.'},
  {id:'trade',name:'Trade Fragger',summary:'Follows the first player into contact and challenges their attacker.',strengths:'Teamwork, trading and aim.',tradeoff:'Poor spacing can miss the trade window.',weights:{tf:.75,lan:.25},matchUse:'Trades are recorded when a teammate answers the killer within 1.5 seconds.'},
];
export const FPS_PLAYER_ROLES=FPS_ROLES.map(role=>role.name);

/** Scouting fits use existing skills and never rewrite historical roles or stats. */
export function rankFpsRoleFits(stats?:Partial<Record<FpsSkillKey,number>>) {
  if(!stats||!(['lan','tf','iq','clu','flx'] as const).every(k=>Number.isFinite(stats[k])))return [];
  return FPS_ROLES.filter(role=>Object.keys(role.weights).every(key=>Number.isFinite(stats[key as FpsSkillKey]))).map((role,index)=>({...role,index,score:Object.entries(role.weights).reduce((sum,[key,weight])=>
    sum+stats[key as FpsSkillKey]!*weight!,0),
  })).sort((a,b)=>b.score-a.score||a.index-b.index);
}
export function fpsRoleFit(stats?:Partial<Record<FpsSkillKey,number>>):string {
  return rankFpsRoleFits(stats)[0]?.name??'Unscouted';
}
