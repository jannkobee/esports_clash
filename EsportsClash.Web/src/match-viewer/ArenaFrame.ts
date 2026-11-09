import type { AramChampionUnit, LaneMinion, LaneStructure } from '../types';
import type { V3World } from '../v3Combat';

type Point = { readonly x:number; readonly y:number };
export type ArenaNeutral = Point & { readonly id:string; readonly isAlive:boolean; readonly hp:number;
  readonly maxHp:number; readonly type?:string; readonly name:string; readonly attackTimer?:number; readonly facingX?:number };
/** Interactive battlefield props (Tracks 1: Phase 5-10 entities) rendered as 3D meshes. */
export type ArenaFeatureKind = 'scuttler' | 'speed_shrine' | 'blast_cone' | 'scryer_bloom' | 'honeyfruit' | 'hexgate' | 'supply_drop';
export type ArenaFeature = Point & { readonly id:string; readonly kind:ArenaFeatureKind;
  readonly team:'blue'|'red'|'neutral'; readonly active:boolean; readonly hp:number; readonly maxHp:number; readonly progress?:number };
export type ArenaElement = 'infernal' | 'mountain' | 'ocean' | 'cloud';
export type ArenaLightingId = 'daylight' | 'dusk' | 'overcast';
export type ArenaAtmosphere = { readonly lighting:ArenaLightingId; readonly element:ArenaElement|null };
/** Borrowed only while copying. No renderer or DOM imports in the contract. */
export type ArenaSceneFrame = {
  readonly champions:readonly AramChampionUnit[];
  readonly minions:readonly LaneMinion[];
  readonly structures:readonly LaneStructure[];
  readonly camps:readonly ArenaNeutral[];
  readonly dragon:ArenaNeutral;
  readonly projectiles:readonly (Point & {readonly id:string;readonly color:string;readonly size:number;readonly angle:number;readonly attackerId?:string;readonly abilitySlot?:string})[];
  readonly spells:readonly (Point & {readonly id:string;readonly radius:number;readonly color:string;readonly duration:number;readonly maxDuration:number;readonly type?:string;readonly halfWidth?:number;readonly halfHeight?:number;readonly sourceX?:number;readonly sourceY?:number;readonly sourceUnitId?:string;readonly visualSourceUnitId?:string;readonly abilitySlot?:string})[];
  readonly wards:readonly (Point & {readonly id:string;readonly team:'blue'|'red';readonly kind?:'stealth'|'control'|'farsight';readonly hp?:number;readonly maxHp?:number;readonly disabled?:boolean})[];
  readonly impacts?:readonly (Point & {readonly id:string;readonly avatarId:string;readonly kind:'melee'|'ranged';readonly color:string;readonly age:number})[];
  readonly abilityHits?:readonly (Point & {readonly id:string;readonly heroId:string;readonly slot:'skill1'|'skill2'|'ultimate';readonly second:number;readonly originX:number;readonly originY:number})[];
  readonly second:number;
  readonly features?:readonly ArenaFeature[];
  readonly atmosphere?:ArenaAtmosphere;
  readonly v3?:Readonly<Pick<V3World,'tick'|'constructs'|'casts'> & Partial<Pick<V3World,'events'>>>;
};
