import type {AvatarPose} from './threeAvatarModels.ts';
import {combatDuration} from './avatarCombatMotion.ts';

/** Visual release remains at the established 42% clip sample. No combat timers. */
export function weaponCycle(id:string,pose:AvatarPose,second:number){
 const sample=(state:string,time:number)=>{
  if(state!=='attack')return {draw:.22,kick:0,follow:0,arrow:1};
  const phase=Math.max(0,Math.min(1,time/combatDuration(id,'attack')));
  const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
  const released=phase>=.42-1e-9,afterRelease=Math.max(0,phase-.42);
  const draw=!released?.22+.78*smooth(phase/.42):phase<.52?1-smooth(afterRelease/.1):.22*smooth((phase-.75)/.25);
  const kick=!released?0:(1-smooth(afterRelease/.3))*Math.exp(-afterRelease*8);
  const follow=phase<.42?smooth(phase/.42):1-smooth((phase-.42)/.58);
  return {draw,kick,follow,arrow:!released||phase>.92?1:0};
 };
 const current=sample(pose.motionState??pose.animState??'idle',pose.motionTime??pose.animTimer??second);
 if(!pose.previousMotion||(pose.motionBlend??1)>=1)return current;
 const previous=sample(pose.previousMotion,pose.previousMotionTime??0),blend=Math.max(0,Math.min(1,pose.motionBlend??1));
 return Object.fromEntries(Object.keys(current).map(key=>[key,previous[key as keyof typeof current]*(1-blend)+current[key as keyof typeof current]*blend])) as typeof current;
}

export type WeaponFinish='steel'|'sun'|'frost'|'shadow'|'ember'|'nature'|'storm'|'void'|'spirit'|'ink'|'powder'|'rocket'|'fist'|'earth'|'music';
export const AVATAR_WEAPON_FINISH:Readonly<Record<string,WeaponFinish>>={
 c_solana:'sun',c_astra:'frost',c_kyumi:'spirit',c_buck:'powder',c_valkira:'steel',c_kage:'shadow',c_kazemaru:'steel',c_kindra:'spirit',
 c_cora:'spirit',c_renn:'sun',c_sylla:'nature',c_tequoia:'nature',c_zal:'spirit',c_xin:'ember',c_raijin:'storm',c_kaolin:'earth',
 c_inai:'void',c_qiyana:'sun',c_locke:'ember',c_senna:'spirit',c_largo:'music',c_shadowfiend:'ember',c_earthshaker:'earth',c_mirehook:'steel',
 c_nullweaver:'void',c_voltgrip:'storm',c_aetherbolt:'sun',c_corsara:'powder',c_brewmaw:'earth',c_wraithhook:'spirit',c_invoker:'sun',
 c_hwei:'ink',c_jayce:'storm',c_vi:'fist',c_jinx:'rocket',c_puck:'spirit',c_batrider:'ember',c_bristleback:'earth',c_io:'storm',
 c_lulu:'nature',c_silencer:'void',c_wukong_lol:'sun',c_monkeyking_dota:'nature',c_stepstone:'fist',c_skybreaker:'powder',
};
export const WEAPON_FINISH_COLORS:Readonly<Record<WeaponFinish,string>>={steel:'#e0eef3',sun:'#ffe6a0',frost:'#a5eaff',shadow:'#b694e8',ember:'#ffad61',nature:'#b0df86',storm:'#83e9ff',void:'#c4a2ff',spirit:'#c9eced',ink:'#bb92e2',powder:'#ffd297',rocket:'#ffadbe',fist:'#c5d8e6',earth:'#d6bc8a',music:'#d5eda2'};
