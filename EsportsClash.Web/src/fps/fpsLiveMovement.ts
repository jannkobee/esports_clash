import type { FpsPoint } from './fpsSpatialWorld.ts';
import { LIVE_WEAPONS, type LiveWeapon } from './fpsLiveWeapons.ts';

export const LIVE_RUN_SPEED=4.1;
export const LIVE_WALK_SPEED=1.65;
export const LIVE_CROUCH_SPEED=1.55;
export const LIVE_JUMP_SPEED=3.85;
export const LIVE_JUMP_VELOCITY=4.2;
export const LIVE_JUMP_GRAVITY=12.5;

export interface LiveVelocity {vx:number;vz:number}
export type LiveStance='run'|'walk'|'peek'|'brake'|'hold'|'crouch'|'jump'|'strafe';

export interface LiveJumpState {
  jump: boolean;
  jumpY: number;
  jumpVy: number;
}

export function advanceLiveJump(state: LiveJumpState, dt: number): LiveJumpState {
  if (!state.jump && state.jumpY <= 0) return { jump: false, jumpY: 0, jumpVy: 0 };
  let vy = state.jumpVy - LIVE_JUMP_GRAVITY * dt;
  let y = state.jumpY + vy * dt;
  if (y <= 0) {
    return { jump: false, jumpY: 0, jumpVy: 0 };
  }
  return { jump: true, jumpY: y, jumpVy: vy };
}
export function advanceLiveVelocity(current:LiveVelocity,wish:FpsPoint,dt:number,mechanics:number,airborne=false):LiveVelocity {
  const dx=wish.x-current.vx,dz=wish.z-current.vz,d=Math.hypot(dx,dz);
  const braking=Math.hypot(wish.x,wish.z)<.01;
  // Air steering is deliberately weaker than ground acceleration. It lets a jump
  // retain launch momentum while still allowing bounded direction correction.
  const control=Math.max(0,Math.min(1,mechanics));
  const acceleration=airborne?(braking?2+control*2:5+control*5):braking?16+control*20:24;
  const step=Math.min(d,acceleration*dt);
  return d<1e-8?{vx:wish.x,vz:wish.z}:{vx:current.vx+dx/d*step,vz:current.vz+dz/d*step};
}
export function liveShotSpeedLimit(weapon:string,mechanics:number):number {
  const category=LIVE_WEAPONS[weapon as LiveWeapon]?.category;
  if(category==='smg')return 2.1;
  if(category==='pistol'&&weapon!=='deagle')return 1.25;
  return category==='sniper'?.28+(1-Math.max(0,Math.min(1,mechanics)))*.35:.3+(1-Math.max(0,Math.min(1,mechanics)))*.8;
}
