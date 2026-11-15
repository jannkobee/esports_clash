export type FpsSkillKey=keyof import('../types.ts').PlayerAttributes;
/** Execution strength only; this never derives a role or a behavioral identity. */
export function fpsRoleFit(stats?:Partial<Record<FpsSkillKey,number>>):string {
  if(!stats)return 'Unscouted';const labels:Record<string,string>={rifling:'Rifling',sniping:'Sniping',entry:'Entry',utility:'Utility',positioning:'Positioning',shotcalling:'Shotcalling'};const best=Object.keys(labels).filter(k=>Number.isFinite(stats[k as FpsSkillKey])).sort((a,b)=>stats[b as FpsSkillKey]!-stats[a as FpsSkillKey]!)[0];return best?labels[best]+' execution':'Unscouted';
}
