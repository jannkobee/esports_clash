import {LIVE_FPS_MAP as m,findLivePath,liveWalkable,livePathLength} from '../EsportsClash.Web/src/fps/fpsLiveMap.ts';
for(const [a,b] of [[m.sites.A,m.sites.B],[{x:-17,z:24},{x:-16,z:28}],[{x:-16,z:28},{x:6,z:28}]])console.log({a,b,path:findLivePath(a,b),length:livePathLength(a,b)});
for(const x of [-20,-18,-17,-16,-14,-8,-6,-4,0,4,6,8])console.log(x,[24,26,27,28].map(z=>[z,liveWalkable({x,z})]));
