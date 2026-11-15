import {FpsLiveSimulation} from '../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {findLivePath,distance,liveWalkable} from '../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {createFpsIdentityContext} from '../EsportsClash.Web/src/fps/fpsIdentityMatch.ts';
const cards=Array.from({length:10},(_,i)=>({id:`grid-${i}`,name:`Grid ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,createFpsIdentityContext(cards.slice(0,5),cards.slice(5))),p=sim.actors.find(a=>a.attacking);
for(const a of sim.actors)a.hp=a===p?100:0;
Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:20,remaining:80});
let count=0,failures=[];
for(const x of [-8,-6,-4,-2,0,2,4,6,8])for(const z of [-39,-37,-35,-33,-31])for(const side of [-1,1]){
 const from={x,z},to={x:side*8,z:-24};if(!liveWalkable(from))continue;
 Object.assign(p,{...from,goal:to,path:findLivePath(from,to),vx:0,vz:0,speed:0,jump:false,jumpY:0,jumpVy:0,nextJump:Infinity,nextPeek:Infinity,target:undefined,contact:undefined,contactAt:-100,damageAt:-100,freezeDelay:0,equipped:'knife',reload:0,stuckFor:0,utilityPreparation:undefined,smokeLineupId:undefined,clearUntil:0});
 count++;
 for(let i=0;i<450&&distance(p,to)>.5;i++){sim.time+=1/30;sim.move(p,1/30);}
 if(distance(p,to)>.5)failures.push({from,to,final:{x:p.x,z:p.z},path:p.path,stuck:p.stuckFor});
}
console.log(JSON.stringify({count,failures}));
