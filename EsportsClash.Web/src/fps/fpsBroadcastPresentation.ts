import { LIVE_CALLOUTS } from './fpsLiveMap.ts';

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
export function fpsBroadcastPresentation(value:unknown,organizers:readonly FpsBroadcastOrganizer[]=[SIGNAL_CIRCUIT]) {
  const organizer=organizers.find(p=>p.id===value)??organizers[0]??SIGNAL_CIRCUIT;
  return {...organizer,...organizer.broadcast};
}
const locationNames=[...LIVE_CALLOUTS.map(p=>p.name)]
  .sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
const locationPattern=new RegExp(`\\b(?:${locationNames.join('|')})\\b`,'gi');
/** Keep tactical narration without restoring the location-name overlays the owner removed. */
export function fpsBroadcastText(text:string):string {
  return text.replace(locationPattern,'the area').replace(/near the area/gi,'nearby')
    .replace(/Contact the area/gi,'Contact ahead').replace(/Taking early the area contest/gi,'Contesting early space')
    .replace(/\s*\u00b7\s*the area$/i,'');
}
