import type {FpsPoint} from './fpsSpatialWorld.ts';
import {distance,liveSightline} from './fpsLiveMap.ts';
import {liveGroundHeight} from './fpsLiveTerrain.ts';

export const LIVE_C4_RULES=Object.freeze({radius:16,safeDistance:17.5,maxDamage:500,coverScale:.42,armorScale:.88});
/** Same physical blast for both forces; walls and actual elevation attenuate it. */
export function liveC4Damage(bomb:FpsPoint,target:FpsPoint,armor:number,crouch=false,feetY=liveGroundHeight(target)):number {
 const sourceY=liveGroundHeight(bomb)+.15,targetY=feetY+(crouch?.7:1.0);
 const range=Math.hypot(distance(bomb,target),targetY-sourceY);
 if(range>=LIVE_C4_RULES.radius)return 0;
 const cover=liveSightline(bomb,target,sourceY,targetY)?1:LIVE_C4_RULES.coverScale;
 return LIVE_C4_RULES.maxDamage*(1-range/LIVE_C4_RULES.radius)*cover*(armor>0?LIVE_C4_RULES.armorScale:1);
}
