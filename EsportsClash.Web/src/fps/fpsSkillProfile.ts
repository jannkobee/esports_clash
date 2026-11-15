import type {PlayerAttributes} from '../types.ts';
export const FPS_SKILL_GROUPS={execution:['rifling','sniping','entry','utility','positioning','shotcalling']} as const;
export type FpsAbility=typeof FPS_SKILL_GROUPS.execution[number];
export const FPS_ABILITIES=[...FPS_SKILL_GROUPS.execution];
export type FpsAbilityValues=Record<FpsAbility,number>;
export interface FpsSkillProfile {version:2;playerId:string;revision:number;seed:number;createdAt:string;source:'lab-generated-v2'|'lab-custom-v2'|'player-attributes-v4'|'migrated-25-v1';values:FpsAbilityValues}
export const FPS_ABILITY_LABELS:Record<FpsAbility,string>={rifling:'Rifling',sniping:'Sniping',entry:'Entry',utility:'Utility',positioning:'Positioning',shotcalling:'Shotcalling'};
export const FPS_ABILITY_SUPPORT=Object.fromEntries(FPS_ABILITIES.map(key=>[key,{active:true,consumer:FPS_ABILITY_LABELS[key]+' execution quality'}])) as Record<FpsAbility,{active:boolean;consumer:string}>;
/** Consumer names describe existing mechanics, not additional attributes. */
export type FpsExecutionChannel=FpsAbility|'reactions'|'crosshairPlacement'|'flicking'|'tracking'|'precision'|'recoilControl'|'movementControl'|'peeking'|'utilityExecution'|'awareness'|'informationReading'|'timing'|'decisionMaking'|'adaptability'|'economyJudgment'|'communication'|'trading'|'coordination'|'calling'|'composure'|'concentration'|'consistency'|'resilience'|'stamina';
export function fpsSkillRandom(seed:number,domain:string):()=>number {let state=seed>>>0;for(const char of domain)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;return ()=>{let n=state+=0x6D2B79F5;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};}
export function validateFpsSkillProfile(value:unknown,playerId?:string):FpsSkillProfile {
 const p=value as FpsSkillProfile;
 if(!p||p.version!==2||typeof p.playerId!=='string'||(playerId!==undefined&&p.playerId!==playerId)||!Number.isInteger(p.revision)||p.revision<1||!Number.isInteger(p.seed)||p.seed<1||p.seed>2147483647||!Number.isFinite(Date.parse(p.createdAt))||!['lab-generated-v2','lab-custom-v2','player-attributes-v4','migrated-25-v1'].includes(p.source)||!p.values||Object.keys(p.values).length!==6||FPS_ABILITIES.some(key=>!Number.isFinite(p.values[key])||p.values[key]<1||p.values[key]>10))throw Error('Invalid six-attribute FPS profile');
 return {...p,values:{...p.values}};
}
export function generateFpsSkillProfile(playerId:string,seed:number,createdAt:string):FpsSkillProfile {
 const random=fpsSkillRandom(seed,`six-attributes:${playerId}`);
 return validateFpsSkillProfile({version:2,playerId,revision:1,seed,createdAt,source:'lab-generated-v2',values:Object.fromEntries(FPS_ABILITIES.map(key=>[key,Math.round((3+random()*6)*10)/10]))});
}
export function pinFpsSkillProfile(value:unknown,playerId:string):FpsSkillProfile {const p=validateFpsSkillProfile(value,playerId);Object.freeze(p.values);return Object.freeze(p);}
export function fpsSkillProfileFromAttributes(playerId:string,stats:PlayerAttributes,seed:number,createdAt:string):FpsSkillProfile {
 return validateFpsSkillProfile({version:2,playerId,revision:1,seed,createdAt,source:'player-attributes-v4',values:Object.fromEntries(FPS_ABILITIES.map(key=>[key,1+(Math.max(1,Math.min(99,stats[key]))-1)*9/98]))});
}
/** Explicit import migration only. The simulation never consumes 25 independent ratings. */
export function migrateFpsSkillProfile(value:unknown,playerId:string):FpsSkillProfile {
 const p=value as Omit<FpsSkillProfile,'version'|'values'>&{version:number;values:Record<string,number>};
 if(p?.version===2)return validateFpsSkillProfile(p,playerId);
 if(p?.version!==1||p.playerId!==playerId)throw Error('Unsupported profile migration');
 const average=(keys:string[])=>{if(keys.some(k=>!Number.isFinite(p.values[k])||p.values[k]<1||p.values[k]>10))throw Error('Invalid legacy abilities');return keys.reduce((n,k)=>n+p.values[k],0)/keys.length;};
 return validateFpsSkillProfile({...p,version:2,source:'migrated-25-v1',revision:p.revision+1,values:{rifling:average(['precision','tracking','recoilControl']),sniping:average(['precision','flicking','crosshairPlacement']),entry:average(['peeking','movementControl','reactions']),utility:average(['utilityExecution']),positioning:average(['positioning','awareness','informationReading']),shotcalling:average(['calling','communication','decisionMaking'])}});
}
export function fpsChannelAttribute(key:FpsExecutionChannel,sniper=false):FpsAbility|undefined {
 if(FPS_ABILITIES.includes(key as FpsAbility))return key as FpsAbility;
 if(['composure','concentration','consistency','resilience','stamina','adaptability'].includes(key))return undefined;
 if(['precision','tracking','flicking','crosshairPlacement','recoilControl','reactions'].includes(key))return sniper?'sniping':'rifling';
 if(['movementControl','peeking','trading'].includes(key))return 'entry';
 if(key==='utilityExecution')return 'utility';
 if(['calling','communication','coordination','economyJudgment'].includes(key))return 'shotcalling';
 return 'positioning';
}
export const fpsAbilityUnit=(p:FpsSkillProfile,key:FpsExecutionChannel,sniper=false)=>{const attribute=fpsChannelAttribute(key,sniper);return attribute?(p.values[attribute]-1)/9:.5;};
export function fpsActionAbility(action:string):FpsAbility {
 if(/throw|utility|smoke|flash|pin|lineup/i.test(action))return 'utility';if(/scop|snip/i.test(action))return 'sniping';
 if(/peek|swing|trad|breach/i.test(action))return 'entry';if(/engag|fir|spray|aim/i.test(action))return 'rifling';
 if(/regroup|call|plant|defus|rally/i.test(action))return 'shotcalling';return 'positioning';
}
export function fpsSkillSummaries(p:FpsSkillProfile):Record<string,number>{return Object.fromEntries(FPS_ABILITIES.map(key=>[FPS_ABILITY_LABELS[key],p.values[key]]));}
