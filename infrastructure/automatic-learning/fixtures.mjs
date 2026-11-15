import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../../EsportsClash.Web/src/fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../../EsportsClash.Web/src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile,FPS_ABILITIES} from '../../EsportsClash.Web/src/fps/fpsSkillProfile.ts';
export function fixture(seed,group=0){
  const cards=Array.from({length:10},(_,i)=>({id:`synthetic-${i}`,name:`Operative ${i+1}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
  const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
  const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+group*5)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map((p,i)=>{
    const profile=generateFpsSkillProfile(p.id,seed,'2026-11-13T00:00:00.000Z');
    if(group<3)profile.values=Object.fromEntries(FPS_ABILITIES.map((key,j)=>[key,Math.min(10,Math.max(1,[3,6,9][group]+((i+j)%3-1)))]));
    return [p.id,profile];
  }));
  return {cards,identity,profiles,configuration:{version:1,seed,group,profiles}};
}
