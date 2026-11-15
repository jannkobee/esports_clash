from pathlib import Path
p=Path('EsportsClash.Web/src/fps/fpsIdentityMatch.ts');old=p.read_text(encoding='utf-8');context=old[old.index('export interface FpsObservedContext'):]
p.write_text('''import {generatePlayerDNA,type FpsPlayer} from './fpsIdentity.ts';
import {validateFpsPersonality,generateFpsPersonality,defaultFpsAssignments,validateFpsLineup,fpsExecutionRole,naturalFpsIdentity,emptyFpsObservedBehavior,type FpsAssignments} from './fpsPlayerArchitecture.ts';
import {initialFpsPsychology,getFpsPreferences} from './fpsPersonality.ts';
import type {FpsIdentityExperiment,FpsPlayerState} from './fpsTypes.ts';
import type {PersonalityTrigger} from './fpsIdentity.ts';
import type {PlayerCard} from '../types.ts';
export function createFpsIdentityContext(blue:PlayerCard[],red:PlayerCard[]):FpsIdentityExperiment {
 const team=()=>({coach:{tempo:.5,rigidity:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5,communication:.5,leadership:.5,adaptability:.5,development:.5},plan:{tempo:.5,structure:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5},chemistry:{trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5}});
 const players:Record<string,FpsPlayer>={};
 for(const roster of [blue,red]){const assignments=defaultFpsAssignments(roster.map(p=>p.id));for(const card of roster)players[card.id]={id:card.id,personality:card.fpsIdentity?.personality??generateFpsPersonality(card.id),assignments:assignments[card.id],observed:emptyFpsObservedBehavior(),dna:generatePlayerDNA(card.id),intensity:.5,roleSuitability:.5,familiarity:0};}
 return {players,teams:{blue:team(),red:team()}};
}
/** Fail closed; a match consumes the personality and side assignments frozen at allocation. */
export function hydrateFpsIdentityContext(input:FpsIdentityExperiment,ids:string[]):FpsIdentityExperiment {
 const result=structuredClone(input);
 if(!result?.players||!result.teams||ids.length!==10||new Set(ids).size!==10||Object.keys(result.players).sort().join()!==[...ids].sort().join())throw Error('Identity allocation must contain exactly ten allocated players');
 const dnaKeys=Object.keys(generatePlayerDNA('validation'));
 for(const id of ids){const player=result.players[id];player.personality=validateFpsPersonality(player.personality);
  if(player.id!==id||!dnaKeys.every(key=>Number.isFinite(player.dna?.[key])&&player.dna[key]>=0&&player.dna[key]<=100))throw Error('Invalid pinned player identity');
  for(const value of [player.familiarity,player.roleSuitability,...Object.values(player.roleFamiliarity??{})])if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid identity development');
  if(player.instruction&&!['balanced','hold','initiative','support'].includes(player.instruction))throw Error('Invalid individual instruction');
 }
 for(const group of [ids.slice(0,5),ids.slice(5)])validateFpsLineup(group.map(id=>({id,assignments:result.players[id].assignments!})));
 for(const side of ['blue','red'] as const){const team=result.teams[side];if(!team?.coach||!team.plan||!team.chemistry)throw Error('Missing pinned tactical system');
  const groups:[Record<string,number>,string[]][]=[[team.coach as unknown as Record<string,number>,['tempo','rigidity','aggression','preparation','freedom','economy','communication','leadership','adaptability','development']],[team.plan as unknown as Record<string,number>,['tempo','structure','aggression','preparation','freedom','economy']],[team.chemistry as unknown as Record<string,number>,['trust','communication','understanding','leadershipAcceptance','roleCompetition']]];
  for(const [values,keys] of groups)for(const key of keys)if(!Number.isFinite(values[key])||values[key]<0||values[key]>1)throw Error('Invalid tactical system dimension');
 }
 return result;
}
export function assignContextualRoles(players:FpsPlayerState[],context:FpsIdentityExperiment):void {
 validateFpsLineup(players.map(p=>({id:p.playerId,assignments:context.players[p.playerId].assignments!})));
 for(const player of players){const identity=context.players[player.playerId],position=identity.assignments![player.side==='attackers'?'t':'ct'],role=fpsExecutionRole(position),mood=player.psychology??initialFpsPsychology();
  player.tactics={role,position,isCaller:position.endsWith('IGL'),traits:[],mood:{...mood},preferences:getFpsPreferences({...player.card,fpsIdentity:{...player.card.fpsIdentity,personality:identity.personality} as any},mood),reason:'Match-locked '+position+' responsibility; movement remains contextual',identity:{personality:identity.personality.name,natural:naturalFpsIdentity(identity.personality,position),intensity:'natural'}};
 }
}
'''+context,encoding='utf-8')
p=Path('EsportsClash.Web/src/fps/fpsPersonality.ts')
p.write_text('''import type {PlayerCard} from '../types.ts';
import type {FpsPlayerState} from './fpsTypes.ts';
import {fpsBehaviorPreferences,generateFpsPersonality,type FpsPosition} from './fpsPlayerArchitecture.ts';
export const FPS_ATTRIBUTE_LABELS={rifling:'Rifling',sniping:'Sniping',entry:'Entry',utility:'Utility',positioning:'Positioning',shotcalling:'Shotcalling'};
export interface FpsPreferences {aggression:number;coordination:number;patience:number;utility:number;conservation:number;leadership:number}
export type FpsTacticalRole=import('./fpsIdentity.ts').FpsPrimaryRole;
export const FPS_ROLE_LABELS:Record<FpsTacticalRole,string>={entry:'Entry Rifler',trade:'Flex / Rotator',support:'Support Rifler',anchor:'Site Anchor',caller:'In-Game Leader',sniper:'Flex / AWPer',lurker:'Lurker'};
export interface FpsPsychology {confidence:number;composure:number;frustration:number;winStreak:number;lossStreak:number;lastRound:number}
export interface FpsRoundTactics {role:FpsTacticalRole;position?:FpsPosition;isCaller:boolean;traits:string[];mood:FpsPsychology;preferences:FpsPreferences;reason:string;identity?:{personality:string;natural?:string;intensity:string}}
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
 players.forEach((p,i)=>{const role=(p.side==='attackers'?t:ct)[i],mood=p.psychology??initialFpsPsychology();p.tactics={role,isCaller:i===0,traits:[],mood:{...mood},preferences:getFpsPreferences(p.card,mood),reason:'Locked lineup responsibility'};});
}
export function shouldSaveFpsRetake(defenders:FpsPlayerState[],attackers:FpsPlayerState[]):boolean {
 const living=defenders.filter(p=>p.isAlive),enemies=attackers.filter(p=>p.isAlive);
 return living.length>0&&living.length<=2&&enemies.length-living.length>=2&&living.some(p=>p.loadout.primaryWeapon)&&living.reduce((sum,p)=>sum+getFpsPreferences(p.card,p.psychology).conservation,0)/living.length>=.25;
}
''',encoding='utf-8')
