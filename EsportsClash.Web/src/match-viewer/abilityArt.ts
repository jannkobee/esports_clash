import {PAINTED_ROSTER_ART} from './paintedRosterArt.ts';
import type {ViewerArtSlot} from './MatchViewer';

export const ABILITY_ART_CELLS:Readonly<Record<ViewerArtSlot,number>>={passive:0,skill1:1,skill2:2,ultimate:3};
export const MIRELLE_PATTERN_CELLS:Readonly<Record<string,number>>={seam:0,shelter:1,pocket:2,bridge:3,pleat:4,serrated:5,hem:6,waltz:7,cutout:8,canopy:9};
export function abilityArtCell(heroId:string,slot:ViewerArtSlot='passive',constructKind?:string){
  const art=Object.hasOwn(PAINTED_ROSTER_ART,heroId)?PAINTED_ROSTER_ART[heroId]:undefined;if(!art)return;
  const pattern=heroId==='c_invoker'&&constructKind&&Object.hasOwn(MIRELLE_PATTERN_CELLS,constructKind)?MIRELLE_PATTERN_CELLS[constructKind]:undefined;
  return pattern===undefined?{slug:art.slug,cell:ABILITY_ART_CELLS[slot],columns:2,rows:2}:
    {slug:'mirelle-pages',cell:pattern,columns:5,rows:2};
}
export function atlasUv(cell:number,columns:number,rows:number){
  const col=cell%columns,row=Math.floor(cell/columns),pad=.015;
  return {uOffset:(col+pad)/columns,vOffset:1-(row+1-pad)/rows,uScale:(1-pad*2)/columns,vScale:(1-pad*2)/rows};
}
