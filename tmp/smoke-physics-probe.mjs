import {launchLiveGrenade,predictLiveGrenade,LIVE_UTILITY_RULES} from '../EsportsClash.Web/src/fps/fpsLiveGrenades.ts';
import {LIVE_OPENING_LINEUPS,LIVE_SMOKE_LINEUPS,liveWalkable} from '../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {liveGroundHeight} from '../EsportsClash.Web/src/fps/fpsLiveTerrain.ts';
for(const l of [
 {id:'ct-b-8-39',position:{x:8,z:39},target:{x:20,z:13.5}},
 {id:'ct-b-10-40',position:{x:10,z:40},target:{x:20,z:13.5}},
 {id:'b-return',position:{x:20,z:16},target:{x:27,z:29}},
 {id:'b-fountain-east',position:{x:20,z:16},target:{x:27,z:24}},
 {id:'t-mid',position:{x:0,z:-14},target:{x:0,z:15}},
 {id:'t-mid-room',position:{x:0,z:-14},target:{x:0,z:19.5}},
 {id:'ct-mid',position:{x:-6,z:28},target:{x:0,z:11}},
 ]){
 const errors=[];
 for(let flight=.8;flight<3.8;flight+=.1){
  const y=liveGroundHeight(l.position)+1.55,g=launchLiveGrenade(1,'smoke','p','blue',l.position,l.target,0,false,'overhead',y);
  g.detonateAt=flight;g.vx=(l.target.x-l.position.x)/flight;g.vz=(l.target.z-l.position.z)/flight;g.vy=(liveGroundHeight(l.target)+.12-y+.5*LIVE_UTILITY_RULES.gravity*flight*flight)/flight;
  const speed=Math.hypot(g.vx,g.vy,g.vz),end=predictLiveGrenade(g,0),error=Math.hypot(end.x-l.target.x,end.z-l.target.z),height=end.y-liveGroundHeight(l.target);
  if(speed<=33&&height<.5)errors.push({flight:+flight.toFixed(2),error:+error.toFixed(2),speed:+speed.toFixed(1),height:+height.toFixed(2),end:{x:+end.x.toFixed(2),z:+end.z.toFixed(2),y:+end.y.toFixed(2)}});
 }
 const normal=predictLiveGrenade(launchLiveGrenade(1,'smoke','p','blue',l.position,l.target,0,false,'overhead',liveGroundHeight(l.position)+1.55),0);
 console.log(JSON.stringify({id:l.id,walkable:liveWalkable(l.position),normal:{x:normal.x,z:normal.z,y:normal.y},best:errors.sort((a,b)=>a.error-b.error).slice(0,4)}));
}
