import {FpsLiveSimulation} from '../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {findLivePath,distance} from '../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {createFpsIdentityContext} from '../EsportsClash.Web/src/fps/fpsIdentityMatch.ts';
const cards=Array.from({length:10},(_,i)=>({id:`team-${i}`,name:`Team ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,createFpsIdentityContext(cards.slice(0,5),cards.slice(5)));
Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:20,remaining:80});
for(const a of sim.actors)a.hp=a.attacking?100:0;
const allies=sim.actors.filter(a=>a.attacking);
for(const [i,p] of allies.entries()){
 Object.assign(p,{x:(i-2)*1.1,z:-31,goal:{x:(i%2?1:-1)*8,z:-24},vx:0,vz:0,speed:0,jump:false,jumpY:0,jumpVy:0,nextJump:Infinity,nextPeek:Infinity,target:undefined,contact:undefined,contactAt:-100,damageAt:-100,freezeDelay:0,equipped:'knife',reload:0,stuckFor:0,utilityPreparation:undefined,smokeLineupId:undefined,clearUntil:0});
 p.path=findLivePath(p,p.goal);
}
for(let i=0;i<900;i++){sim.time+=1/30;for(const p of allies)sim.move(p,1/30);}
console.log(JSON.stringify(allies.map(p=>({x:p.x,z:p.z,goal:p.goal,path:p.path,distance:distance(p,p.goal),stuck:p.stuckFor,speed:p.speed}))));
