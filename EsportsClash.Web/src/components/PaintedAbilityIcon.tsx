import {abilityArtCell,atlasUv} from '../match-viewer/abilityArt';
import type {ViewerArtSlot} from '../match-viewer/MatchViewer';

export function PaintedAbilityIcon({heroId,slot}:{heroId:string;slot:ViewerArtSlot}){
  const art=abilityArtCell(heroId,slot);if(!art)return null;
  const uv=atlasUv(art.cell,art.columns,art.rows);
  return <i aria-hidden="true" className="painted-ability-icon" style={{
    backgroundImage:`url(${import.meta.env.BASE_URL}art/ability-drawings-v1/${art.slug}.png)`,
    backgroundSize:`${100/uv.uScale}% ${100/uv.vScale}%`,
    backgroundPosition:`${100*uv.uOffset/(1-uv.uScale)}% ${100*(1-uv.vOffset-uv.vScale)/(1-uv.vScale)}%`,
  }}/>;
}
