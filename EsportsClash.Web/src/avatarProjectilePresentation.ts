import type { WeaponSocket } from './avatarWeaponSockets.ts';
type V = [number,number,number];
type Shot = {id:string;x:number;y:number;angle:number;targetX?:number;targetY?:number;type?:string};
type Launch = {x:number;y:number;tip:V;style:WeaponSocket['style'];second:number;travel:number;lastX:number;lastY:number;range:number};

/** Numeric launch snapshots only. Depart from the posed weapon and converge to
 * the existing collision path; a moving shooter cannot drag an airborne shot. */
export class AvatarProjectilePresentation {
 private readonly launches=new Map<string,Launch>();
 private second=-1;
 begin(second:number,ids:ReadonlySet<string>){
  if(second<this.second)this.launches.clear();
  this.second=second;
  for(const id of this.launches.keys())if(!ids.has(id))this.launches.delete(id);
 }
 sample(p:Shot,second:number,socket?:WeaponSocket,source?:{x:number;y:number}){
  if(['tornado','turret_shot','minion_shot','boss_breath','jungle_shot'].includes(p.type??''))return;
  let launch=this.launches.get(p.id);
  if(!launch&&socket){
   // Switching to 3D in the middle of a flight must not launch it a second time.
   if(source&&Math.hypot(p.x-source.x,p.y-source.y)>64)return;
   const range=p.targetX!==undefined&&p.targetY!==undefined?Math.hypot(p.targetX-p.x,p.targetY-p.y):180;
   launch={x:p.x,y:p.y,tip:[...socket.tip],style:socket.style,second,travel:0,lastX:p.x,lastY:p.y,range:Math.max(1,range)};
   this.launches.set(p.id,launch);
  }
  if(!launch)return;
  launch.travel+=Math.hypot(p.x-launch.lastX,p.y-launch.lastY);launch.lastX=p.x;launch.lastY=p.y;
  const blend=Math.max(0,1-launch.travel/Math.min(120,launch.range));
  const at:V=[p.x+(launch.tip[0]-launch.x)*blend,27+(launch.tip[1]-27)*blend,p.y+(launch.tip[2]-launch.y)*blend];
  // A short launch tail cannot appear behind the weapon, including paused frames.
  const length=Math.min(launch.travel,24),dx=Math.cos(p.angle),dz=Math.sin(p.angle);
  const tail:V=[at[0]-dx*length,at[1],at[2]-dz*length];
  return {at,tail,age:Math.max(0,second-launch.second),launch:launch.tip,style:launch.style};
 }
}
