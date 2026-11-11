import type { FpsPoint } from './fpsSpatialWorld.ts';

export const liveAimAngle=(value:number)=>Math.atan2(Math.sin(value),Math.cos(value));
export const liveAimHeading=(from:FpsPoint,to:FpsPoint)=>Math.atan2(to.x-from.x,to.z-from.z);

/** Look along the route rather than at the next tiny steering correction. */
export function liveRouteLookAhead(from:FpsPoint,path:readonly FpsPoint[],metres=6):FpsPoint|undefined {
  let previous=from,remaining=metres;
  for(const point of path){
    const d=Math.hypot(point.x-previous.x,point.z-previous.z);
    if(d>=remaining&&d>0)return {x:previous.x+(point.x-previous.x)*remaining/d,z:previous.z+(point.z-previous.z)*remaining/d};
    remaining-=d;previous=point;
  }
  return path.length?{...path[path.length-1]}:undefined;
}

/** Finite turns with an eased final correction; no idle noise or overshoot. */
export function advanceLiveAimYaw(yaw:number,desired:number,mechanics:number,dt:number):number {
  const error=liveAimAngle(desired-yaw);
  if(Math.abs(error)<.002)return liveAimAngle(desired);
  const maxStep=(3.4+mechanics*3)*dt;
  const eased=error*(1-Math.exp(-(10+mechanics*8)*dt));
  return liveAimAngle(yaw+Math.max(-maxStep,Math.min(maxStep,eased)));
}
