import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from '../../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../../EsportsClash.Web/src/fps/fpsIdentity.ts';
import {emptyLiveIntel,rememberLiveIntel,liveIntelBeliefs,assessLiveIntel,strongestLiveIntel,clearLiveIntel} from '../../EsportsClash.Web/src/fps/fpsLiveIntel.ts';
import {launchLiveGrenade} from '../../EsportsClash.Web/src/fps/fpsLiveGrenades.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`intel-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=()=>{const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);sim.time=20;return sim;};
const sight=(id,x,z,observed=20)=>({key:`enemy:${id}`,enemyId:id,observerId:'observer',source:'sight',x,z,observed,confidence:.98,uncertainty:.45});
const addStack=(sim,p,site,count)=>{
  for(let i=0;i<count;i++)sim.observeIntel(p,sight(`known-${i}`,site==='A'?-19:20,14+i,sim.time),false);
};


for(const [x,z] of [[32,29],[31,30],[23,30],[20,32],[31,23]]){
 const sim=game(),p=sim.actors[3];Object.assign(p,{x,z,role:'anchor',smoke:1,utilityAt:0,target:undefined});addStack(sim,p,'B',2);
 for(const target of [{x:20,z:10},{x:31,z:9}]){const f=sim.previewUtility(p,'smoke',target,'overhead');console.log({from:{x,z},target,forecast:{x:f.x,y:f.y,z:f.z},safe:sim.safeUtilitySetup(p,'smoke',f)});}
 console.log('intent',sim.useInformationUtility(p,sim.actors.slice(0,5)),p.utilityPreparation);
}
