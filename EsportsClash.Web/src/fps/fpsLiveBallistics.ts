import type {FpsPoint} from './fpsSpatialWorld.ts';
import type {LiveWorldPoint} from './fpsLiveMap.ts';

export interface LiveRayDirection {x:number;y:number;z:number}
export interface LiveHitTarget extends FpsPoint {crouch?:boolean;jumpY?:number;/** Facing (radians, +z forward at 0). Orients the head and torso hit volumes; defaults to 0. */yaw?:number}
export interface LiveActorHit {distance:number;region:'head'|'body'}

/**
 * Hit volumes of the operative model, in metres above the feet. They follow the visible mesh: the head is a
 * skull-sized ellipsoid (narrower than it is tall or deep, never bigger than the drawn head), the neck a
 * short column, the chest and the abdomen elliptic cylinders (wider than deep) and the legs two separate
 * cylinders with a gap between them. A crouch lowers the head 0.37 m and folds the legs, as the model does.
 */
export const LIVE_HITBOX = {
  head: {centreOffset: .01, halfWidth: .09, halfHeight: .113, halfDepth: .1},
  neck: {radius: .055, bottom: 1.38, top: 1.46},
  stand: {
    chest: {halfWidth: .2, halfDepth: .135, bottom: 1.0, top: 1.4},
    abdomen: {halfWidth: .165, halfDepth: .115, bottom: .74, top: 1.0},
    legs: {radius: .08, side: .105, forward: 0, bottom: .05, top: .76},
  },
  crouch: {
    chest: {halfWidth: .2, halfDepth: .14, bottom: .8, top: 1.08},
    abdomen: {halfWidth: .165, halfDepth: .125, bottom: .52, top: .8},
    legs: {radius: .09, side: .11, forward: .08, bottom: .05, top: .54},
  },
} as const;
const LIVE_CROUCH_HEAD_DROP = .37;

export function liveActorHeadY(actor:Pick<LiveHitTarget,'crouch'|'jumpY'>):number {
  return 1.54-(actor.crouch?LIVE_CROUCH_HEAD_DROP:0)+(actor.jumpY??0);
}

export function liveRayDirection(yaw:number,pitch:number):LiveRayDirection {
  const horizontal=Math.cos(pitch);
  return {x:Math.sin(yaw)*horizontal,y:Math.sin(pitch),z:Math.cos(yaw)*horizontal};
}

/** Ray against an ellipsoid (half-axes across, up, along the facing) centred at `center`, facing `yaw`. */
function rayEllipsoidHit(from:LiveWorldPoint,direction:LiveRayDirection,center:LiveWorldPoint,yaw:number,ax:number,ay:number,az:number,maxDistance:number):number|undefined {
  const s=Math.sin(yaw),c=Math.cos(yaw);
  const rx=from.x-center.x,ry=from.y-center.y,rz=from.z-center.z;
  // Local frame: across = (cos, -sin), along = (sin, cos). Scaling by the half-axes keeps the ray parameter.
  const ox=(rx*c-rz*s)/ax,oy=ry/ay,oz=(rx*s+rz*c)/az;
  const dx=(direction.x*c-direction.z*s)/ax,dy=direction.y/ay,dz=(direction.x*s+direction.z*c)/az;
  const a=dx*dx+dy*dy+dz*dz,b=2*(ox*dx+oy*dy+oz*dz),k=ox*ox+oy*oy+oz*oz-1;
  const discriminant=b*b-4*a*k;
  if(a<1e-12||discriminant<0)return undefined;
  const root=Math.sqrt(discriminant),near=(-b-root)/(2*a),far=(-b+root)/(2*a);
  const hit=near>=0?near:far>=0?far:undefined;
  return hit!==undefined&&hit<=maxDistance?hit:undefined;
}

/** Ray against a vertical elliptic cylinder (half-axes across/along the facing) between `minY` and `maxY`. */
function rayEllipticCylinderHit(from:LiveWorldPoint,direction:LiveRayDirection,x:number,z:number,yaw:number,ax:number,az:number,minY:number,maxY:number,maxDistance:number):number|undefined {
  const s=Math.sin(yaw),c=Math.cos(yaw),rx=from.x-x,rz=from.z-z;
  return rayCylinderHit({x:(rx*c-rz*s)/ax,y:from.y,z:(rx*s+rz*c)/az},
    {x:(direction.x*c-direction.z*s)/ax,y:direction.y,z:(direction.x*s+direction.z*c)/az},0,0,1,minY,maxY,maxDistance);
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

/**
 * Intersects the operative's head, neck, chest, abdomen and legs separately. The first surface hit owns the
 * hit region: only the head volume is 'head'; everything else (neck, torso, legs) is 'body'.
 */
export function traceLiveActorHit(from:LiveWorldPoint,direction:LiveRayDirection,maxDistance:number,target:LiveHitTarget):LiveActorHit|undefined {
  const jumpY=target.jumpY??0,yaw=target.yaw??0,headSpec=LIVE_HITBOX.head;
  const head=rayEllipsoidHit(from,direction,{x:target.x,y:liveActorHeadY(target)+headSpec.centreOffset,z:target.z},yaw,headSpec.halfWidth,headSpec.halfHeight,headSpec.halfDepth,maxDistance);
  const pose=target.crouch?LIVE_HITBOX.crouch:LIVE_HITBOX.stand;
  let body:number|undefined;
  const take=(hit:number|undefined)=>{if(hit!==undefined&&(body===undefined||hit<body))body=hit;};
  if(!target.crouch){const neck=LIVE_HITBOX.neck;take(rayCylinderHit(from,direction,target.x,target.z,neck.radius,neck.bottom+jumpY,neck.top+jumpY,maxDistance));}
  else take(rayCylinderHit(from,direction,target.x,target.z,LIVE_HITBOX.neck.radius,pose.chest.top+jumpY,pose.chest.top+.06+jumpY,maxDistance));
  for(const part of [pose.chest,pose.abdomen])take(rayEllipticCylinderHit(from,direction,target.x,target.z,yaw,part.halfWidth,part.halfDepth,part.bottom+jumpY,part.top+jumpY,maxDistance));
  const legs=pose.legs,s=Math.sin(yaw),c=Math.cos(yaw);
  for(const side of [-1,1]){
    // Across = (cos, -sin), forward = (sin, cos) in world x/z.
    const lx=target.x+side*legs.side*c+legs.forward*s,lz=target.z-side*legs.side*s+legs.forward*c;
    take(rayCylinderHit(from,direction,lx,lz,legs.radius,legs.bottom+jumpY,legs.top+jumpY,maxDistance));
  }
  if(head===undefined&&body===undefined)return undefined;
  return head!==undefined&&(body===undefined||head<=body)?{distance:head,region:'head'}:{distance:body!,region:'body'};
}
