import type {FpsPoint} from './fpsSpatialWorld.ts';
import type {LiveWorldPoint} from './fpsLiveMap.ts';

export interface LiveRayDirection {x:number;y:number;z:number}
export interface LiveHitTarget extends FpsPoint {crouch?:boolean;jumpY?:number}
export interface LiveActorHit {distance:number;region:'head'|'body'}

export function liveActorHeadY(actor:Pick<LiveHitTarget,'crouch'|'jumpY'>):number {
  return 1.54-(actor.crouch?.37:0)+(actor.jumpY??0);
}

export function liveRayDirection(yaw:number,pitch:number):LiveRayDirection {
  const horizontal=Math.cos(pitch);
  return {x:Math.sin(yaw)*horizontal,y:Math.sin(pitch),z:Math.cos(yaw)*horizontal};
}

function raySphereHit(from:LiveWorldPoint,direction:LiveRayDirection,center:LiveWorldPoint,radius:number,maxDistance:number):number|undefined {
  const ox=from.x-center.x,oy=from.y-center.y,oz=from.z-center.z;
  const along=ox*direction.x+oy*direction.y+oz*direction.z;
  const discriminant=along*along-(ox*ox+oy*oy+oz*oz-radius*radius);
  if(discriminant<0)return undefined;
  const root=Math.sqrt(discriminant),near=-along-root,far=-along+root;
  const hit=near>=0?near:far>=0?far:undefined;
  return hit!==undefined&&hit<=maxDistance?hit:undefined;
}

function rayCylinderHit(from:LiveWorldPoint,direction:LiveRayDirection,x:number,z:number,radius:number,minY:number,maxY:number,maxDistance:number):number|undefined {
  const ox=from.x-x,oz=from.z-z,a=direction.x**2+direction.z**2,b=2*(ox*direction.x+oz*direction.z),c=ox*ox+oz*oz-radius*radius;
  let radialStart=0,radialEnd=maxDistance;
  if(a<1e-12){if(c>0)return undefined;}
  else {
    const discriminant=b*b-4*a*c;if(discriminant<0)return undefined;
    const root=Math.sqrt(discriminant),near=(-b-root)/(2*a),far=(-b+root)/(2*a);
    radialStart=Math.max(0,near);radialEnd=Math.min(maxDistance,far);
  }
  let verticalStart=0,verticalEnd=maxDistance;
  if(Math.abs(direction.y)<1e-10){if(from.y<minY||from.y>maxY)return undefined;}
  else {
    const a=(minY-from.y)/direction.y,b=(maxY-from.y)/direction.y;
    verticalStart=Math.max(0,Math.min(a,b));verticalEnd=Math.min(maxDistance,Math.max(a,b));
  }
  const hit=Math.max(radialStart,verticalStart);
  return hit<=Math.min(radialEnd,verticalEnd)?hit:undefined;
}

/** Intersects the animated proxy model's head and torso separately. The first surface hit owns the hit region. */
export function traceLiveActorHit(from:LiveWorldPoint,direction:LiveRayDirection,maxDistance:number,target:LiveHitTarget):LiveActorHit|undefined {
  const jumpY=target.jumpY??0,head=raySphereHit(from,direction,{x:target.x,y:liveActorHeadY(target),z:target.z},.17,maxDistance);
  const top=target.crouch?1.32:1.50;
  const body=rayCylinderHit(from,direction,target.x,target.z,.30,.30+jumpY,top+jumpY,maxDistance);
  if(head===undefined&&body===undefined)return undefined;
  return head!==undefined&&(body===undefined||head<=body)?{distance:head,region:'head'}:{distance:body!,region:'body'};
}
