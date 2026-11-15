import {generatePlayerDNA,type FpsPlayer} from './fpsIdentity.ts';
import {validateFpsPersonality,generateFpsPersonality,defaultFpsAssignments,validateFpsLineup,fpsExecutionRole,naturalFpsIdentity,emptyFpsObservedBehavior} from './fpsPlayerArchitecture.ts';
import {initialFpsPsychology,getFpsPreferences} from './fpsPersonality.ts';
import type {FpsIdentityExperiment,FpsPlayerState} from './fpsTypes.ts';
import type {PersonalityTrigger} from './fpsIdentity.ts';
import type {PlayerCard} from '../types.ts';
/** Offline exhibition preset; official matches supply a manager-locked allocation. */
export function createFpsIdentityContext(blue:PlayerCard[],red:PlayerCard[]):FpsIdentityExperiment {
 const team=()=>({coach:{tempo:.5,rigidity:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5,communication:.5,leadership:.5,adaptability:.5,development:.5},plan:{tempo:.5,structure:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5},chemistry:{trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5}});
 const players:Record<string,FpsPlayer>={};
 for(const roster of [blue,red]){
  const supplied=roster.some(p=>Object.keys(p.fpsIdentity?.assignments??{}).length>0);
  const assignments=supplied?Object.fromEntries(roster.map(p=>[p.id,p.fpsIdentity?.assignments as import('./fpsPlayerArchitecture.ts').FpsAssignments])):defaultFpsAssignments(roster.map(p=>p.id));
  validateFpsLineup(roster.map(p=>({id:p.id,assignments:assignments[p.id]})));
  for(const card of roster)players[card.id]={id:card.id,personality:card.fpsIdentity?.personality??generateFpsPersonality(card.id),assignments:assignments[card.id],observed:emptyFpsObservedBehavior(),dna:generatePlayerDNA(card.id),roleSuitability:.5,familiarity:0};
 }
 return {players,teams:{blue:team(),red:team()}};
}
/** Fail closed; a match consumes the personality and side assignments frozen at allocation. */
export function hydrateFpsIdentityContext(input:FpsIdentityExperiment,ids:string[]):FpsIdentityExperiment {
 const result=structuredClone(input);
 if(!result?.players||!result.teams||ids.length!==10||new Set(ids).size!==10||Object.keys(result.players).sort().join()!==[...ids].sort().join())throw Error('Identity allocation must contain exactly ten allocated players');
 const dnaKeys=Object.keys(generatePlayerDNA('validation')) as (keyof import('./fpsIdentity.ts').FpsPlayerDNA)[];
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
  player.tactics={role,position,isCaller:position.endsWith('IGL'),traits:[],mood:{...mood},preferences:getFpsPreferences({...player.card,fpsIdentity:{...player.card.fpsIdentity,personality:identity.personality} as any},mood),reason:'Match-locked '+position+' responsibility; movement remains contextual',identity:{personality:identity.personality.name,dimensions:{...identity.personality},natural:naturalFpsIdentity(identity.personality,position)}};
 }
}
export interface FpsObservedContext {
  round:number; elapsed:number; quietSeconds:number; allies:number; enemies:number; winStreak:number; lossStreak:number;
  earlyDeath?:boolean; advantage?:boolean; disrupted?:boolean; prepared?:boolean; planCompromised?:boolean;
  callerAlive?:boolean; allyContact?:boolean; poorRetake?:boolean; utilityNeeded?:boolean; economicTrouble?:boolean;
  futureBuy?:boolean; recoverableGear?:boolean; rolePurchase?:boolean;
}
export function observedPersonalityTriggers(c:FpsObservedContext):Set<PersonalityTrigger> {
  const triggers=new Set<PersonalityTrigger>();
  if(c.round>=28 || c.allies===1)triggers.add('pressure');
  if(c.winStreak>=3)triggers.add('winningStreak');
  if(c.earlyDeath)triggers.add('personalMistake');
  if(c.round<=4)triggers.add('earlyRound');else triggers.add('lateRound');
  if(c.lossStreak>=2){triggers.add('losingStreak');triggers.add('setback');}
  if(c.advantage)triggers.add('opening');
  if(c.quietSeconds>=8)triggers.add('quietRound');
  if(c.enemies>0)triggers.add('enemyCommitment');
  if(c.allies<c.enemies || c.elapsed>90)triggers.add('desperate');
  if(c.disrupted)triggers.add('enemyDisrupted');
  if(c.enemies===0)triggers.add('probeOpportunity');
  if(c.prepared)triggers.add('preparedPlan');
  if(c.planCompromised){triggers.add('contradictedCall');triggers.add('planUnclear');}
  if(c.allyContact)triggers.add('allyContact');
  if(c.callerAlive===false)triggers.add('leadershipAbsent');
  if(c.poorRetake)triggers.add('poorRetake');
  if(c.utilityNeeded)triggers.add('utilityExecute');
  if(c.economicTrouble)triggers.add('economicTrouble');
  if(c.futureBuy)triggers.add('futureBuy');
  if(c.recoverableGear)triggers.add('recoverableGear');
  if(c.rolePurchase)triggers.add('rolePurchase');
  return triggers;
}
