import type {PlayerCard,PlayerAttributes} from './types.ts';
import {generateFpsPersonality,validateFpsPersonality} from './fps/fpsPlayerArchitecture.ts';
/** Explicit persisted-roster migration, shared policy with the server migration. */
export function migratePlayerAttributes(input:unknown):PlayerAttributes {
 const s=input as Record<string,number>,bounded=(v:number)=>Math.round(Math.max(1,Math.min(99,v)));
 if(s&&Number.isFinite(s.rifling))return Object.fromEntries(['rifling','sniping','entry','utility','positioning','shotcalling'].map(key=>[key,bounded(s[key]??50)])) as unknown as PlayerAttributes;
 return {rifling:bounded(s?.lan??50),sniping:bounded((s?.lan??50)*.55+(s?.clu??50)*.35+(s?.iq??50)*.1),entry:bounded((s?.lan??50)*.6+(s?.tf??50)*.4),utility:bounded(((s?.tf??50)+(s?.flx??50))/2),positioning:bounded(s?.iq??50),shotcalling:bounded(s?.ldr??s?.iq??50)};
}
export function normalizePlayerPersonality<T extends PlayerCard>(player:T):T {
 const personality=player.fpsIdentity?.personality?validateFpsPersonality(player.fpsIdentity.personality):generateFpsPersonality(player.id);
 const copy={...player,stats:migratePlayerAttributes(player.stats),personality:personality.name,fpsIdentity:player.fpsIdentity??{player_id:player.id,personality,mapping:'deterministic_id_v4',confidence:'natural preferences; insufficient match observations',observations:{risk:personality.playstyle,adaptability:personality.decisionStyle,preparation:personality.decisionStyle,team_orientation:personality.mindset}}};
 delete (copy as any).primaryPersonality;delete (copy as any).secondaryPersonality;
 return copy;
}
