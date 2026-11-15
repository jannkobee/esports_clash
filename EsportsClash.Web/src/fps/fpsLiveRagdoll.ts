import type {LiveCorpse} from './fpsLiveSimulation.ts';
import {LIVE_COLLISION_SOLIDS} from './fpsLiveMap.ts';
import {liveFloorAt} from './fpsLiveTerrain.ts';
export interface RagPoint {x:number;y:number;z:number;px:number;py:number;pz:number}
export type RagJoint='pelvis'|'chest'|'head'|'ls'|'le'|'lh'|'rs'|'re'|'rh'|'lhp'|'lk'|'lf'|'rhp'|'rk'|'rf';
export interface LiveRagdoll {points:Record<RagJoint,RagPoint>;links:{a:RagJoint;b:RagJoint;length:number}[];inverseMass:Record<RagJoint,number>;age:number;accumulator:number;solids:readonly {minX:number;maxX:number;minZ:number;maxZ:number;height:number;baseY?:number}[]}
/** Cosmetic articulated Verlet bodies. No collision volume or information is fed back to actors. */
export function createLiveRagdoll(c:LiveCorpse):LiveRagdoll {
 const positions:Record<RagJoint,number[]>={pelvis:[0,.78,0],chest:[0,1.23,0],head:[0,1.54,0],ls:[-.235,1.31,0],le:[-.235,1.06,.02],lh:[-.235,.81,.06],rs:[.235,1.31,0],re:[.235,1.06,.03],rh:[.235,.81,.08],lhp:[-.11,.74,0],lk:[-.11,.38,0],lf:[-.11,.07,.06],rhp:[.11,.74,0],rk:[.11,.38,0],rf:[.11,.07,.06]};
 const points={} as Record<RagJoint,RagPoint>;
 const impact=c.impact,region=impact?.region??'torso',strength=Math.max(.25,Math.min(1.5,impact?.strength??.65));
 const horizontal=Math.hypot(impact?.direction.x??0,impact?.direction.z??0);
 const dirX=horizontal>.01?impact!.direction.x/horizontal:Math.sin(c.yaw),dirZ=horizontal>.01?impact!.direction.z/horizontal:Math.cos(c.yaw);
 const dirY=Math.max(-.65,Math.min(.65,impact?.direction.y??0));
 const inverseMass:Record<RagJoint,number>={pelvis:.55,chest:.65,head:1.05,ls:1,le:1.3,lh:1.5,rs:1,re:1.3,rh:1.5,lhp:.7,lk:1,lf:1.25,rhp:.7,rk:1,rf:1.25};
 for(const key of Object.keys(positions) as RagJoint[]){
  const [x,y,z]=positions[key],wx=c.x+x*Math.cos(c.yaw)+z*Math.sin(c.yaw),wz=c.z-x*Math.sin(c.yaw)+z*Math.cos(c.yaw),wy=c.y+y*(c.crouch?.76:1);
  const upper=['chest','ls','rs','head'].includes(key),lower=['lk','lf','rk','rf'].includes(key);
  let kick=.18,drop=0,lift=0;
  if(region==='head'){
   // The neck/head starts the fall, pulling the upper body after the hit.
   kick=key==='head'?3.7:upper?1.05:key==='pelvis'?.32:.15;
   drop=key==='head'?1.7:upper?.35:0;
  }else if(region==='legs'){
   kick=lower?1.9:key==='pelvis'?.8:upper?.4:.25;
   drop=key==='pelvis'||lower?1.2:upper?.5:0;
  }else if(region==='blast'){
   kick=1.8+(y/1.54)*.8;lift=.95+(y/1.54)*.4;
  }else if(region==='burn'){
   kick=upper?.38:.12;drop=upper?.8:key==='pelvis'?.5:0;
  }else{
   // A torso impact folds the chest/pelvis rather than flipping the head identically.
   kick=key==='chest'?1.9:key==='pelvis'?1.25:upper?.85:.3;
   drop=key==='pelvis'?.65:lower?.45:.1;
  }
  // Localize the impulse to the actual entrance point, including off-centre hits.
  const at=impact?.point,proximity=at?1/(1+Math.hypot(wx-at.x,wy-at.y,wz-at.z)*2):.4;
  const local=region==='blast'||region==='burn'?0:proximity*.65;
  const lateralX=at?wx-at.x:0,lateralZ=at?wz-at.z:0;
  const vx=c.vx+dirX*(kick+local)*strength+lateralX*local*.3;
  const vz=c.vz+dirZ*(kick+local)*strength+lateralZ*local*.3;
  const vy=(c.vy??0)+(dirY*kick+lift-drop)*strength;
  points[key]={x:wx,y:wy,z:wz,px:wx-vx/60,py:wy-vy/60,pz:wz-vz/60};
 }
 const pairs:[RagJoint,RagJoint][]=[['pelvis','chest'],['chest','head'],['chest','ls'],['chest','rs'],['ls','rs'],['ls','le'],['le','lh'],['rs','re'],['re','rh'],['pelvis','lhp'],['pelvis','rhp'],['lhp','rhp'],['lhp','lk'],['lk','lf'],['rhp','rk'],['rk','rf'],['ls','pelvis'],['rs','pelvis']];
 return {points,inverseMass,links:pairs.map(([a,b])=>({a,b,length:Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y,points[a].z-points[b].z)})),age:0,accumulator:0,solids:LIVE_COLLISION_SOLIDS.filter(w=>w.maxX>c.x-8&&w.minX<c.x+8&&w.maxZ>c.z-8&&w.minZ<c.z+8)};
}
export function stepLiveRagdoll(r:LiveRagdoll,dt:number):void {
 if(r.age>4)return;r.accumulator+=Math.max(0,Math.min(.1,dt));
 while(r.accumulator>=1/60){r.accumulator-=1/60;r.age+=1/60;
  for(const p of Object.values(r.points)){const x=p.x,y=p.y,z=p.z;p.x+=(p.x-p.px)*.985;p.y+=(p.y-p.py)*.985-9.8/3600;p.z+=(p.z-p.pz)*.985;p.px=x;p.py=y;p.pz=z;}
  for(let pass=0;pass<5;pass++){
   for(const link of r.links){const a=r.points[link.a],b=r.points[link.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||1,k=(d-link.length)/d,wa=r.inverseMass[link.a],wb=r.inverseMass[link.b],sum=wa+wb;a.x+=dx*k*wa/sum;a.y+=dy*k*wa/sum;a.z+=dz*k*wa/sum;b.x-=dx*k*wb/sum;b.y-=dy*k*wb/sum;b.z-=dz*k*wb/sum;}
   for(const [joint,p] of Object.entries(r.points)){
    const radius=joint==='head'?.15:joint==='chest'||joint==='pelvis'?.17:.075;
    const floor=liveFloorAt(p,p.y)+radius;if(p.y<floor){p.y=floor;p.px=p.x-(p.x-p.px)*.55;p.pz=p.z-(p.z-p.pz)*.55;}
    for(const w of r.solids){if(p.y<(w.baseY??0)-.07||p.y>w.height+.07||p.x<w.minX-.07||p.x>w.maxX+.07||p.z<w.minZ-.07||p.z>w.maxZ+.07)continue;
     const sides=[Math.abs(p.x-(w.minX-.07)),Math.abs(p.x-(w.maxX+.07)),Math.abs(p.z-(w.minZ-.07)),Math.abs(p.z-(w.maxZ+.07)),Math.abs(p.y-(w.height+.07))],side=sides.indexOf(Math.min(...sides));
     if(side===0)p.x=w.minX-.07;else if(side===1)p.x=w.maxX+.07;else if(side===2)p.z=w.minZ-.07;else if(side===3)p.z=w.maxZ+.07;else p.y=w.height+.07;
    }
   }
  }
 }
}
