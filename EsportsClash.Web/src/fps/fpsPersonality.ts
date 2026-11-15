import type {PlayerCard} from '../types.ts';
import type {FpsPlayerState} from './fpsTypes.ts';
import {fpsBehaviorPreferences,fpsExecutionRole,generateFpsPersonality,type FpsPosition} from './fpsPlayerArchitecture.ts';
export const FPS_ATTRIBUTE_LABELS={rifling:'Rifling',sniping:'Sniping',entry:'Entry',utility:'Utility',positioning:'Positioning',shotcalling:'Shotcalling'};
export interface FpsPreferences {aggression:number;coordination:number;patience:number;utility:number;conservation:number;leadership:number}
export type FpsTacticalRole=import('./fpsIdentity.ts').FpsPrimaryRole;
export const FPS_ROLE_LABELS:Record<FpsTacticalRole,string>={entry:'Entry Rifler',trade:'Flex / Rotator',support:'Support Rifler',anchor:'Site Anchor',caller:'In-Game Leader',sniper:'Flex / AWPer',lurker:'Lurker'};
export interface FpsPsychology {confidence:number;composure:number;frustration:number;winStreak:number;lossStreak:number;lastRound:number}
export interface FpsRoundTactics {role:FpsTacticalRole;position?:FpsPosition;isCaller:boolean;traits:string[];mood:FpsPsychology;preferences:FpsPreferences;reason:string;identity?:{personality:string;dimensions?:import('./fpsPlayerArchitecture.ts').FpsPersonality;natural?:string}}
export const initialFpsPsychology=():FpsPsychology=>({confidence:50,composure:70,frustration:10,winStreak:0,lossStreak:0,lastRound:0});
export function getFpsPreferences(card:PlayerCard,mood=initialFpsPsychology()):FpsPreferences {
 const p=fpsBehaviorPreferences(card.fpsIdentity?.personality??generateFpsPersonality(card.id)),momentum=(mood.confidence-50)/100*p.pressureSensitivity;
 return {aggression:(p.initiative-.5)*2+momentum,coordination:(p.coordination-.5)*2,patience:(p.deliberation+.5-p.initiative)/2,utility:(p.coordination-.5),conservation:(.5-p.initiative),leadership:0};
}
export function updateFpsPsychology(player:FpsPlayerState,won:boolean,roundNumber:number,_teammates:FpsPlayerState[]):void {
 const mood=player.psychology??initialFpsPsychology();if(roundNumber<=mood.lastRound)return;
 const p=fpsBehaviorPreferences(player.card.fpsIdentity?.personality??generateFpsPersonality(player.playerId)),sensitivity=.3+p.pressureSensitivity;
 const bound=(n:number)=>Math.max(0,Math.min(100,n));
 player.psychology={confidence:bound(mood.confidence+(won?5:-5)*sensitivity),composure:70,frustration:bound(mood.frustration+(won?-8:8*sensitivity)-3),winStreak:won?Math.min(5,mood.winStreak+1):0,lossStreak:won?0:Math.min(5,mood.lossStreak+1),lastRound:roundNumber};
}
export function updateContextualFpsPsychology(player:FpsPlayerState,won:boolean,roundNumber:number,_dna:unknown,_trust:number):void{updateFpsPsychology(player,won,roundNumber,[]);}
export function fpsRoleScore(player:FpsPlayerState,role:FpsTacticalRole):number {
 const s=player.card.stats;return role==='caller'?s.shotcalling:role==='entry'?s.entry:role==='support'?s.utility:role==='sniper'?s.sniping:role==='trade'?s.rifling:s.positioning;
}
export function rankFpsPlayers(players:FpsPlayerState[],role:FpsTacticalRole):FpsPlayerState[]{return [...players].sort((a,b)=>fpsRoleScore(b,role)-fpsRoleScore(a,role)||a.playerId.localeCompare(b.playerId));}
/** Allocation assigns positions once. This helper only updates the round view of those assignments. */
export function assignFpsTeamRoles(players:FpsPlayerState[],_contextual=false):void {
 const t=['caller','entry','support','lurker','trade'] as const,ct=['caller','trade','anchor','anchor','trade'] as const;
 players.forEach((p,i)=>{const position=p.card.fpsIdentity?.assignments?.[p.side==='attackers'?'t':'ct'];const role=position?fpsExecutionRole(position):(p.side==='attackers'?t:ct)[i],mood=p.psychology??initialFpsPsychology();p.tactics={role,position,isCaller:position?position.endsWith('IGL'):i===0,traits:[],mood:{...mood},preferences:getFpsPreferences(p.card,mood),reason:'Locked lineup responsibility'};});
}
export function shouldSaveFpsRetake(defenders:FpsPlayerState[],attackers:FpsPlayerState[]):boolean {
 const living=defenders.filter(p=>p.isAlive),enemies=attackers.filter(p=>p.isAlive);
 return living.length>0&&living.length<=2&&enemies.length-living.length>=2&&living.some(p=>p.loadout.primaryWeapon)&&living.reduce((sum,p)=>sum+getFpsPreferences(p.card,p.psychology).conservation,0)/living.length>=.25;
}
