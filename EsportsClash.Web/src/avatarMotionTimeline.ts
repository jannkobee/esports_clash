/** Per-renderer numeric history only; never retains units or advances combat. */
import {contactGait} from './avatarContactProfiles.ts';
export type MotionTimeline={state:string;started:number;from:string;fromTime:number;changed:number;second:number;hp:number;hit:number;attackTimer:number;yaw:number;death:number;gaitPhase:number;x?:number;y?:number};
type Input={isAlive:boolean;hp:number;animState:string;vx:number;vy:number;attackTimer:number;x?:number;y?:number};
export function motionTimeline(old:MotionTimeline|undefined,unit:Input,second:number,targetYaw:number,scale=1):MotionTimeline{
 const rewind=!old||second<old.second,dt=rewind?0:Math.min(.1,Math.max(0,second-old.second));
 const yawDelta=old?Math.atan2(Math.sin(targetYaw-old.yaw),Math.cos(targetYaw-old.yaw)):0;
 const state=!unit.isAlive?'death':unit.animState==='walk'?(Math.abs(unit.vy)>Math.abs(unit.vx)*1.5?'strafe':Math.hypot(unit.vx,unit.vy)>120?'run':'walk'):
  unit.animState==='idle'&&Math.abs(yawDelta)>.45?(yawDelta<0?'turnleft':'turnright'):unit.animState;
 const reset=rewind||state!==old.state||(state==='attack'&&unit.attackTimer>old.attackTimer+.05);
 const started=reset?second:old.started;
 const moving=['walk','run','strafe'].includes(state),gait=contactGait(state);
 const distance=!rewind&&unit.x!==undefined&&unit.y!==undefined&&old.x!==undefined&&old.y!==undefined?Math.hypot(unit.x-old.x,unit.y-old.y):Math.hypot(unit.vx,unit.vy)*dt;
 const gaitPhase=rewind?0:((old.gaitPhase+(moving&&distance<40?distance/(gait.span/gait.stance*Math.max(.1,scale)):0))%1);
 return {state,started,from:reset?(rewind?state:old.state):old.from,fromTime:reset?(rewind?0:second-old.started):old.fromTime,
  changed:reset?second:old.changed,second,hp:unit.hp,hit:!rewind&&unit.hp<old.hp&&second-old.hit>.22?second:rewind?-100:old.hit,
  attackTimer:unit.attackTimer,yaw:rewind?targetYaw:old.yaw+yawDelta*Math.min(1,dt*14),death:!unit.isAlive?(rewind||old.state!=='death'?second:old.death):-1,gaitPhase,x:unit.x,y:unit.y};
}
