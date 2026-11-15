import {FpsLiveSimulation} from '../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {findLivePath,distance,liveWalkable} from '../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {liveGroundHeight} from '../EsportsClash.Web/src/fps/fpsLiveTerrain.ts';
import {createFpsIdentityContext} from '../EsportsClash.Web/src/fps/fpsIdentityMatch.ts';
const cards=Array.from({length:10},(_,i)=>({id:`door-${i}`,name:`Door ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
for(const [from,to] of [
 [{x:-8,z:-30.4},{x:-19,z:9}],[{x:8,z:-30.4},{x:20,z:10}],
 [{x:2.6,z:-30},{x:-19,z:9}],[{x:-2.6,z:-30},{x:20,z:10}],
 [{x:8.5,z:-32.2},{x:20,z:10}],[{x:-8.5,z:-32.2},{x:-19,z:9}],
 [{x:-4.6,z:-33},{x:-19,z:9}],[{x:4.6,z:-33},{x:20,z:10}],
 ]){
 const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,createFpsIdentityContext(cards.slice(0,5),cards.slice(5))),p=sim.actors.find(a=>a.attacking);
 for(const a of sim.actors)a.hp=a===p?100:0;
 Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:20,remaining:80});
 Object.assign(p,{...from,goal:to,path:findLivePath(from,to),vx:0,vz:0,speed:0,jump:false,jumpY:liveGroundHeight(from),jumpVy:0,nextJump:Infinity,nextPeek:Infinity,target:undefined,contact:undefined,contactAt:-100,damageAt:-100,freezeDelay:0,equipped:'knife',reload:0});
 const initial=p.path.map(q=>({...q}));let peak=0;
 for(let i=0;i<900&&distance(p,to)>.7;i++){sim.time+=1/30;sim.advanceElevation(p,1/30);sim.move(p,1/30);peak=Math.max(peak,p.stuckFor);}
 console.log(JSON.stringify({from,valid:liveWalkable(from),to,final:{x:p.x,z:p.z},distance:distance(p,to),stuck:p.stuckFor,peak,path:p.path,initial}));
}
