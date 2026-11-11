import {FPS_ROLES} from './fpsRoleFit.ts';
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,type FpsPrimaryRole,type PersonalityTrigger} from './fpsIdentity.ts';
import {initialFpsPsychology} from './fpsPersonality.ts';
import type {FpsIdentityExperiment,FpsPlayerState} from './types.ts';

/** Fail closed on incomplete private allocations; never generate replacement match DNA. */
export function hydrateFpsIdentityContext(input:FpsIdentityExperiment, ids:string[]):FpsIdentityExperiment {
  const result=structuredClone(input);
  if (!result || !result.players || !result.teams || Object.keys(result.players).sort().join()!==[...ids].sort().join()) throw Error('Identity allocation must contain exactly ten allocated players.');
  const dnaKeys=['riskTolerance','emotionalStability','coachability','tacticalDiscipline','adaptability','creativity','confidenceVolatility','socialTrust','leadershipInitiative','competitiveDrive','teamOrientation','preparationPreference'];
  for(const id of ids) {
    const player=result.players[id];
    const personality=FPS_IDENTITY_PERSONALITIES.find(item=>item.id===player.personality?.id);
    const specialty=player.specialty ? FPS_SPECIALTIES.find(item=>item.id===player.specialty?.id) : undefined;
    if(player.id!==id || !personality || (player.specialty&&!specialty) || !dnaKeys.every(key=>Number.isFinite(player.dna?.[key as keyof typeof player.dna]) && player.dna[key as keyof typeof player.dna]>=0 && player.dna[key as keyof typeof player.dna]<=100)) throw Error('Invalid pinned player identity.');
    for(const value of [player.intensity,player.familiarity,player.roleSuitability,player.specialtyProficiency??.5,...Object.values(player.roleFamiliarity??{})]) if(!Number.isFinite(value)||value<0||value>1) throw Error('Invalid identity development.');
    if(player.assignedRole && !FPS_ROLES.some(role=>role.id===player.assignedRole)) throw Error('Invalid assigned FPS role.');
    if(player.instruction && !['balanced','hold','initiative','support'].includes(player.instruction))throw Error('Invalid individual instruction.');
    if(Object.keys(player.roleFamiliarity??{}).some(key=>!FPS_ROLES.some(role=>role.id===key)))throw Error('Invalid role familiarity.');
    player.personality={...personality};player.specialty=specialty?{...specialty}:undefined;
  }
  for(const side of ['blue','red'] as const) {
    const team=result.teams[side];
    if(!team || !team.coach || !team.plan || !team.chemistry) throw Error('Missing pinned tactical system.');
    const required:[Record<string,number>,string[]][]=[
      [team.coach as unknown as Record<string,number>,['tempo','rigidity','aggression','preparation','freedom','economy','communication','leadership','adaptability','development']],
      [team.plan as unknown as Record<string,number>,['tempo','structure','aggression','preparation','freedom','economy']],
      [team.chemistry as unknown as Record<string,number>,['trust','communication','understanding','leadershipAcceptance','roleCompetition']],
      [(team.culture??team.plan) as unknown as Record<string,number>,['tempo','structure','aggression','preparation','freedom','economy']],
    ];
    for(const [group,keys] of required) for(const key of keys){const value=group[key];if(!Number.isFinite(value)||value<0||value>1) throw Error('Invalid tactical system dimension.');}
  }
  return result;
}

export function assignContextualRoles(players:FpsPlayerState[], context:FpsIdentityExperiment):void {
  const ordered=[...players].sort((a,b)=>a.playerId.localeCompare(b.playerId));
  const score=(p:FpsPlayerState,role:FpsPrimaryRole)=>{
    const definition=FPS_ROLES.find(r=>r.id===role)!;
    const skill=Object.entries(definition.weights).reduce((sum,[key,weight])=>sum+(p.card.stats[key as keyof typeof p.card.stats]??50)*weight!,0);
    return skill+(context.players[p.playerId].roleFamiliarity?.[role]??0)*3;
  };
  const requestedCaller=ordered.find(p=>context.players[p.playerId].assignedRole==='caller');
  const assigned=new Map<string,FpsPrimaryRole>();
  for(const player of ordered) {const role=context.players[player.playerId].assignedRole;if(role)assigned.set(player.playerId,role);}
  const jobs:FpsPrimaryRole[]=players[0].side==='attackers'?['entry','support','trade','sniper','lurker']:['anchor','support','trade','sniper','lurker'];
  for(const role of jobs) {
    if([...assigned.values()].includes(role))continue;
    const candidate=ordered.filter(p=>!assigned.has(p.playerId)).sort((a,b)=>score(b,role)-score(a,role)||a.playerId.localeCompare(b.playerId))[0];
    if(candidate)assigned.set(candidate.playerId,role);
  }
  const caller=requestedCaller??[...ordered].sort((a,b)=>score(b,'caller')-score(a,'caller') || Number(assigned.get(b.playerId)==='support')-Number(assigned.get(a.playerId)==='support') || a.playerId.localeCompare(b.playerId))[0];
  for(const player of ordered) {
    const identity=context.players[player.playerId], role=assigned.get(player.playerId)??'trade';
    identity.roleSuitability=Math.max(0,Math.min(1,score(player,role)/100));
    const mood=player.psychology??initialFpsPsychology();
    player.tactics={role,isCaller:player===caller,traits:[],mood:{...mood},preferences:{aggression:0,patience:0,utility:0,coordination:0,conservation:0,leadership:0},reason:identity.assignedRole?'Manager assignment':'Lineup assignment from skills and role familiarity',identity:{personality:identity.personality.name,specialty:identity.specialty?.name,intensity:identity.intensity>.7?'strong':'moderate'}};
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
