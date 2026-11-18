import type { FpsPlaybookUpdate } from './fpsLiveSimulation.ts';

/**
 * A finished match's contribution to a club lineage: the plays the team called, whether each round
 * was won, and only lawful observations of the opponent. Nothing from browser storage is uploaded;
 * the server deduplicates by (lineage, match) and the learning worker applies it.
 */
export interface FpsMatchExperience {
  match_ref:string;map:string;
  rounds:{round:number;side:'attack'|'defense';play_id:string;won:boolean;opponent?:string;observed?:Record<string,unknown>}[];
}
export function buildFpsMatchExperience(matchRef:string,map:string,updates:readonly FpsPlaybookUpdate[]):FpsMatchExperience {
  return {match_ref:matchRef,map,rounds:updates.slice(0,60).map(u=>{
    const round=Number(u.round.id.split(':').at(-3))||1;
    return {round:Math.min(60,Math.max(1,round)),side:u.round.side,play_id:u.round.playId,won:u.round.won,
      ...(u.round.opponent?{opponent:u.round.opponent}:{}),...(u.observed?{observed:{...u.observed.seen}}:{})};
  })};
}
/** Submit as the signed-in manager (the API only accepts their own club's lineage). */
export async function submitFpsMatchExperience(lineage:string,experience:FpsMatchExperience):Promise<boolean> {
  const {request,loadApiSession}=await import('../cloudPersistence.ts');
  const session=loadApiSession();if(!session||!/^club:[0-9]{1,18}$/.test(lineage)||!experience.rounds.length)return false;
  try{await request(`/fps/lineages/${encodeURIComponent(lineage)}/experience`,session,{method:'POST',body:JSON.stringify(experience)});return true;}
  catch{return false;}
}
