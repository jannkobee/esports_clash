import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {FpsLiveSimulation} from '../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../EsportsClash.Web/src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../EsportsClash.Web/src/fps/fpsSkillProfile.ts';
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`perf-${i}`,name:`Operative ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,1337,'2026-11-14T00:00:00.000Z')]));
const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{skillProfiles:profiles});
let tick=0,calls=[];const totals={};
for(const method of ['throwUtility','previewUtility','workSmokeLineup','openingUtility','useInformationUtility','updateExecute','decide','move','safeUtilitySetup','releaseUtilityPreparation','objective','postPlantAssignment','setGoal','inImmediateFight']){
 const original=sim[method];if(!original)continue;
 sim[method]=function(...args){const at=performance.now(),result=original.apply(this,args),ms=performance.now()-at;
  (totals[method]??={count:0,totalMs:0,maxMs:0}).count++;totals[method].totalMs+=ms;totals[method].maxMs=Math.max(totals[method].maxMs,ms);
  if(ms>3){const p=args[0];calls.push({method,ms,id:p?.id,x:p?.x,z:p?.z,hp:p?.hp,kind:args[1],target:args[2],result:method==='throwUtility'?result:undefined,lineup:p?.smokeLineupId,action:p?.action,goal:p?.goal,utilityAt:p?.utilityAt});}return result;};
}
const slow=[];
for(tick=0;tick<13000;tick++){
 calls=[];const at=performance.now();sim.step();sim.snapshot();sim.drainAudioCues();const ms=performance.now()-at;
 if(ms>40){const item={tick,ms,round:sim.round,time:sim.time,calls};slow.push(item);console.log(JSON.stringify(item));}
}
console.log(JSON.stringify({totals}));writeFileSync('tmp/profile-smoke-hotpath.json',JSON.stringify({slow,totals},null,2));
