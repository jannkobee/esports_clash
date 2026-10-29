import type { AramChampionUnit, LaneMinion, LaneStructure } from '../types';
import type { V3World } from '../v3Combat';

type Point = { readonly x:number; readonly y:number };
export type ArenaNeutral = Point & { readonly id:string; readonly isAlive:boolean; readonly hp:number;
  readonly maxHp:number; readonly type?:string; readonly name:string; readonly attackTimer?:number; readonly facingX?:number };
/** Borrowed only while copying. No renderer or DOM imports in the contract. */
export type ArenaSceneFrame = {
  readonly champions:readonly AramChampionUnit[];
  readonly minions:readonly LaneMinion[];
  readonly structures:readonly LaneStructure[];
  readonly camps:readonly ArenaNeutral[];
  readonly dragon:ArenaNeutral;
  readonly projectiles:readonly (Point & {readonly id:string;readonly color:string;readonly size:number;readonly angle:number;readonly attackerId?:string;readonly abilitySlot?:string})[];
  readonly spells:readonly (Point & {readonly id:string;readonly radius:number;readonly color:string;readonly duration:number;readonly maxDuration:number;readonly type?:string;readonly halfWidth?:number;readonly halfHeight?:number;readonly sourceX?:number;readonly sourceY?:number;readonly sourceUnitId?:string;readonly visualSourceUnitId?:string;readonly abilitySlot?:string})[];
  readonly wards:readonly (Point & {readonly id:string;readonly team:'blue'|'red'})[];
  readonly impacts?:readonly (Point & {readonly id:string;readonly avatarId:string;readonly kind:'melee'|'ranged';readonly color:string;readonly age:number})[];
  readonly abilityHits?:readonly (Point & {readonly id:string;readonly heroId:string;readonly slot:'skill1'|'skill2'|'ultimate';readonly second:number;readonly originX:number;readonly originY:number})[];
  readonly second:number;
  readonly v3?:Readonly<Pick<V3World,'tick'|'constructs'|'casts'> & Partial<Pick<V3World,'events'>>>;
};
