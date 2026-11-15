import { getLiveMapRuntime, LIVE_MAP_RUNTIMES } from './fpsLiveMapRegistry.ts';
import type { LiveMapId } from './fpsLiveMapTypes.ts';

export interface OrganizerBroadcast {
  version: number; layout:'arena'|'competition'|'spotlight'; accent:string;
  package:string; intro:string; round:string;
}
export interface FpsBroadcastOrganizer {id:string;name:string;broadcast:OrganizerBroadcast}
// The canonical built-in Hexapedia organizer remains usable for offline exhibitions.
export const SIGNAL_CIRCUIT:FpsBroadcastOrganizer={id:'signal-circuit',name:'Signal Circuit',broadcast:{
  version:1,layout:'arena',accent:'#e89c58',package:'Signal Circuit Matchday',
  intro:'THE VILLAGE TAKES THE STAGE',round:'ROUND SECURED',
}};
export function fpsBroadcastPresentation(value:unknown,organizers:readonly FpsBroadcastOrganizer[]=[SIGNAL_CIRCUIT],mapId?:LiveMapId) {
  const organizer=organizers.find(p=>p.id===value)??organizers[0]??SIGNAL_CIRCUIT;
  const runtime=mapId?getLiveMapRuntime(mapId):undefined;
  const intro=runtime&&runtime.id!=='fontessa'?`${runtime.definition.broadcast.displayName.toUpperCase()} TAKES THE STAGE`:organizer.broadcast.intro;
  return {...organizer,...organizer.broadcast,intro};
}
const escapeRegex=(name:string)=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const expandCalloutNames=(names:readonly string[])=>names.flatMap(name=>{
  const trimmed=name.trim();
  const base=trimmed.replace(/\s*\([^)]*\)\s*/g,' ').trim();
  return base&&base!==trimmed&&base.length>=3?[trimmed,base]:[trimmed];
});
const buildCalloutPattern=(names:readonly string[])=>{
  const unique=[...new Set(expandCalloutNames(names))].filter(Boolean).sort((a,b)=>b.length-a.length).map(escapeRegex);
  return unique.length>0?new RegExp(`(?<![a-z0-9])(?:${unique.join('|')})(?![a-z0-9])`,'gi'):/$^/;
};
const allCalloutPattern=buildCalloutPattern(Object.values(LIVE_MAP_RUNTIMES).flatMap(r=>r.definition.tactical.callouts.map(c=>c.name)));
const mapCalloutPatterns=new Map<LiveMapId,RegExp>();
function calloutPatternForMap(mapId?:LiveMapId):RegExp {
  if(!mapId)return allCalloutPattern;
  const cached=mapCalloutPatterns.get(mapId);
  if(cached)return cached;
  const runtime=getLiveMapRuntime(mapId);
  const pattern=buildCalloutPattern(runtime.definition.tactical.callouts.map(c=>c.name));
  mapCalloutPatterns.set(mapId,pattern);
  return pattern;
}
/** Keep tactical narration without restoring the location-name overlays the owner removed. */
export function fpsBroadcastText(text:string,mapId?:LiveMapId):string {
  return text.replace(calloutPatternForMap(mapId),'the area').replace(/near the area/gi,'nearby')
    .replace(/Contact the area/gi,'Contact ahead').replace(/Taking early the area contest/gi,'Contesting early space')
    .replace(/\s*\u00b7\s*the area$/i,'');
}
