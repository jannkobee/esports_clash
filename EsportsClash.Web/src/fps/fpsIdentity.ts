import {fpsBehaviorPreferences, type FpsPersonality, type FpsAssignments, type FpsPosition, type FpsObservedBehavior} from './fpsPlayerArchitecture.ts';
export * from './fpsPlayerArchitecture.ts';
export const FPS_IDENTITY_BALANCE={instructionWeight:.3,temperature:.42,familiarityBase:.002,familiarityAdaptability:.003} as const;
export interface FpsScoutingProfile {player_id:string;personality:FpsPersonality;assignments?:Partial<FpsAssignments>|null;observed?:FpsObservedBehavior;mapping:string;confidence:string;appearances?:number;gameplan_fit?:string|null;coach_fit?:string|null;team_chemistry?:string;familiarity?:string;role_familiarity?:Partial<Record<FpsPosition,number>>;recent_observations?:string[];observations:{risk:string;adaptability:string;preparation:string;team_orientation:string;pressure_response?:string;economy_discipline?:string}}
export type FpsDnaKey = 'riskTolerance' | 'emotionalStability' | 'coachability' | 'tacticalDiscipline' | 'adaptability' | 'creativity' | 'confidenceVolatility' | 'socialTrust' | 'leadershipInitiative' | 'competitiveDrive' | 'teamOrientation' | 'preparationPreference';
export type FpsPlayerDNA = Record<FpsDnaKey, number>;

// Player ID seeds a stable identity independently of the match seed and legacy badges.
export function generatePlayerDNA(playerId: string): FpsPlayerDNA {
  // UUIDs are ASCII; this byte-wise FNV scheme is shared with the server.
  const sample = (key: string) => {
    let hash=2166136261;
    for (const char of `${playerId}:fps-dna-v2:${key}`) hash=Math.imul(hash ^ char.charCodeAt(0),16777619) >>> 0;
    hash=Math.imul(hash ^ (hash >>> 16),0x45d9f3b) >>> 0;
    hash=Math.imul(hash ^ (hash >>> 16),0x45d9f3b) >>> 0;
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
  };
  const discipline=sample('discipline'), social=sample('social'), stability=sample('stability');
  const value=(n:number)=>Math.round(Math.max(0,Math.min(1,n))*100);
  return {riskTolerance:value(sample('risk')),emotionalStability:value(stability),coachability:value(.35*discipline+.65*sample('coachability')),tacticalDiscipline:value(discipline),adaptability:value(sample('adaptability')),creativity:value(sample('creativity')),confidenceVolatility:value(.35*(1-stability)+.65*sample('volatility')),socialTrust:value(social),leadershipInitiative:value(sample('leadership')),competitiveDrive:value(sample('drive')),teamOrientation:value(.35*social+.65*sample('team')),preparationPreference:value(.35*discipline+.65*sample('preparation'))};
}

export type PersonalityTrigger = 'pressure' | 'winningStreak' | 'personalMistake' | 'earlyRound' | 'lateRound' | 'losingStreak' | 'opening' | 'quietRound' | 'enemyCommitment' | 'desperate' | 'enemyDisrupted' | 'probeOpportunity' | 'preparedPlan' | 'contradictedCall' | 'allyContact' | 'setback' | 'planUnclear' | 'leadershipAbsent' | 'poorRetake' | 'utilityExecute' | 'economicTrouble' | 'futureBuy' | 'recoverableGear' | 'rolePurchase';
export type TacticalAction = 'pressure' | 'prepare' | 'react' | 'coordinate' | 'improvise' | 'save' | 'invest' | 'equip' | 'force' | 'probe';
export interface FpsCoach { tempo: number; rigidity: number; aggression: number; preparation: number; freedom: number; economy: number; communication: number; leadership: number; adaptability: number; development: number }
export interface FpsGameplan { tempo: number; structure: number; aggression: number; preparation: number; freedom: number; economy: number }
export const FPS_GAMEPLANS:Record<string,{name:string;plan:FpsGameplan}>={
  structured:{name:'Structured Execution',plan:{tempo:.4,structure:.9,aggression:.5,preparation:.9,freedom:.2,economy:.6}},
  default:{name:'Controlled Default',plan:{tempo:.25,structure:.7,aggression:.3,preparation:.8,freedom:.4,economy:.6}},
  pressure:{name:'High-Tempo Pressure',plan:{tempo:.9,structure:.5,aggression:.85,preparation:.35,freedom:.6,economy:.35}},
  reactive:{name:'Reactive Counterplay',plan:{tempo:.35,structure:.65,aggression:.35,preparation:.7,freedom:.5,economy:.6}},
  adaptive:{name:'Adaptive Midround',plan:{tempo:.55,structure:.4,aggression:.55,preparation:.6,freedom:.9,economy:.5}},
  resources:{name:'Resource Discipline',plan:{tempo:.35,structure:.65,aggression:.3,preparation:.7,freedom:.4,economy:.9}},
};
export interface FpsTeamIdentity { tempo: number; structure: number; aggression: number; preparation: number; freedom: number; economy: number }
export interface FpsTeamChemistry { trust: number; communication: number; understanding: number; leadershipAcceptance: number; roleCompetition: number }
export type FpsPrimaryRole = 'entry'|'caller'|'sniper'|'support'|'lurker'|'anchor'|'trade';
export interface FpsPlayer {id:string;personality:FpsPersonality;assignments?:FpsAssignments;observed?:FpsObservedBehavior;dna:FpsPlayerDNA;roleSuitability:number;familiarity:number;roleFamiliarity?:Partial<Record<FpsPosition,number>>;instruction?:'balanced'|'hold'|'initiative'|'support'}
export interface MatchStateContext {triggers:ReadonlySet<PersonalityTrigger>;confidence:number;fatigue:number;teamIdentity?:FpsTeamIdentity}
export interface PlayerTacticalFit {coachFit:number;gameplanFit:number;roleFit:number;teamChemistry:number;familiarity:number;overall:number}
export interface ScoredTacticalAction {action:TacticalAction;legal:boolean;tacticalValue:number;instruction:number}
export interface PlayerDecisionResult {action:TacticalAction;scores:{action:TacticalAction;score:number;probability:number}[];triggers:PersonalityTrigger[];instructionAdherence:number}
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
const similarity=(a:number,b:number)=>1-Math.abs(clamp01(a)-clamp01(b));
export function evaluatePersonalityTriggers(_player:FpsPlayer,state:MatchStateContext):PersonalityTrigger[]{return [...state.triggers];}
export function evaluateCoachFit(player:FpsPlayer,coach:FpsCoach):number {
  const p=fpsBehaviorPreferences(player.personality);return (similarity(p.deliberation,coach.preparation)+similarity(p.initiative,coach.aggression)+similarity(p.coordination,coach.communication)+similarity(1-p.deliberation,coach.freedom))/4;
}
export function evaluateGameplanFit(player:FpsPlayer,plan:FpsGameplan):number {
  const p=fpsBehaviorPreferences(player.personality);return (similarity(p.initiative,plan.aggression)+similarity(p.deliberation,plan.preparation)+similarity(p.coordination,plan.structure)+similarity(1-p.deliberation,plan.freedom))/4;
}
export function evaluateTeamChemistry(chemistry:FpsTeamChemistry):number{return clamp01((chemistry.trust+chemistry.communication+chemistry.understanding+chemistry.leadershipAcceptance+1-chemistry.roleCompetition)/5);}
export function evaluateTacticalCompatibility(player:FpsPlayer,coach:FpsCoach,plan:FpsGameplan,chemistry:FpsTeamChemistry):PlayerTacticalFit {
 const coachFit=evaluateCoachFit(player,coach),gameplanFit=evaluateGameplanFit(player,plan),teamChemistry=evaluateTeamChemistry(chemistry),familiarity=clamp01(player.familiarity),roleFit=clamp01(player.roleSuitability);
 return {coachFit,gameplanFit,teamChemistry,familiarity,roleFit,overall:(coachFit+gameplanFit+teamChemistry+familiarity+roleFit)/5};
}
/** Scores intentions using legal, observed opportunities. No numerical attributes or outcome stats enter here. */
export function scoreTacticalActions(player:FpsPlayer,state:MatchStateContext,coach:FpsCoach,plan:FpsGameplan,chemistry:FpsTeamChemistry,candidates:readonly ScoredTacticalAction[]):PlayerDecisionResult['scores'] {
  const p=fpsBehaviorPreferences(player.personality),fit=evaluateTacticalCompatibility(player,coach,plan,chemistry);
  const pressure=state.triggers.has('pressure')||state.triggers.has('desperate');
  const momentum=(clamp01(state.confidence)-.5)*p.pressureSensitivity*(pressure?.7:.35);
  const evidence=state.triggers.has('contradictedCall')||state.triggers.has('setback')||state.triggers.has('enemyCommitment');
  const adherence=clamp01(.25+.2*fit.familiarity+.15*coach.communication+.15*fit.teamChemistry+.15*coach.leadership);
  const preference:Record<TacticalAction,number>={pressure:(p.initiative-.5)*1.4+(1-p.deliberation)*.12+momentum,
    prepare:(.5-p.initiative)*.65+(p.deliberation-.5)*.4-momentum*.4,
    coordinate:(p.coordination-.5)*.85+(p.deliberation-.5)*.15,
    react:(p.reassessment-.5)*.3+(evidence?.22:0),improvise:(1-p.deliberation)*.35+(evidence?p.reassessment*.25:0)-p.coordination*.1,
    probe:(p.initiative-.5)*.65+(1-p.deliberation)*.1,save:(.5-p.initiative)*.3-momentum*.25,invest:(p.coordination-.5)*.3,equip:0,force:(p.initiative-.5)*.3};
  const scores=candidates.filter(c=>c.legal).map(c=>({action:c.action,score:Math.max(-4,Math.min(4,c.tacticalValue+preference[c.action]+adherence*Math.max(-1,Math.min(1,c.instruction))*FPS_IDENTITY_BALANCE.instructionWeight)),probability:0}));
  if(!scores.length)throw Error('No legal tactical action');
  const max=Math.max(...scores.map(c=>c.score)),weights=scores.map(c=>Math.exp((c.score-max)/FPS_IDENTITY_BALANCE.temperature)),sum=weights.reduce((a,b)=>a+b,0);
  return scores.map((c,i)=>({...c,probability:weights[i]/sum}));
}
export function evaluatePlayerAction(player:FpsPlayer,state:MatchStateContext,coach:FpsCoach,plan:FpsGameplan,chemistry:FpsTeamChemistry,candidates:readonly ScoredTacticalAction[],random:()=>number):PlayerDecisionResult {
  const scores=scoreTacticalActions(player,state,coach,plan,chemistry,candidates);let roll=random(),selected=scores.at(-1)!;
  for(const item of scores){roll-=item.probability;if(roll<=0){selected=item;break;}}
  const instructions=candidates.filter(c=>c.legal).map(c=>c.instruction),min=Math.min(...instructions),max=Math.max(...instructions),chosen=candidates.find(c=>c.legal&&c.action===selected.action)!;
  return {action:selected.action,scores,triggers:[...state.triggers],instructionAdherence:max===min?.5:clamp01((chosen.instruction-min)/(max-min))};
}
/** Bounded gradual learning; one event cannot transform a player's identity. */
export function developFpsFamiliarity(current: number, experience: number, adaptability: number): number {
  const value=clamp01(current); return clamp01(value+Math.max(0,Math.min(1,experience))*(FPS_IDENTITY_BALANCE.familiarityBase+FPS_IDENTITY_BALANCE.familiarityAdaptability*clamp01(adaptability))*(1-value));
}


export function developFpsChemistry(current: FpsTeamChemistry, interaction: {coordinated: boolean; roleConflict: boolean}): FpsTeamChemistry {
  const step=(value: number, positive: boolean) => clamp01(value+(positive ? .004*(1-value) : -.004*value));
  return {trust:step(current.trust,interaction.coordinated),communication:step(current.communication,interaction.coordinated),understanding:step(current.understanding,interaction.coordinated),leadershipAcceptance:current.leadershipAcceptance,roleCompetition:step(current.roleCompetition,interaction.roleConflict)};
}
export function evolveFpsTeamIdentity(current:FpsTeamIdentity,coach:FpsCoach,plan:FpsGameplan,roster:readonly FpsPersonality[]):FpsTeamIdentity {
 const preferences=roster.map(fpsBehaviorPreferences),mean=(key:'initiative'|'coordination'|'deliberation')=>preferences.length?preferences.reduce((n,p)=>n+p[key],0)/preferences.length:.5;
 const shift=(old:number,target:number)=>clamp01(old+Math.max(-.01,Math.min(.01,(target-old)*.03)));
 return {tempo:shift(current.tempo,(coach.tempo+plan.tempo+mean('initiative'))/3),structure:shift(current.structure,(coach.rigidity+plan.structure+mean('coordination'))/3),aggression:shift(current.aggression,(coach.aggression+plan.aggression+mean('initiative'))/3),preparation:shift(current.preparation,(coach.preparation+plan.preparation+mean('deliberation'))/3),freedom:shift(current.freedom,(coach.freedom+plan.freedom+1-mean('deliberation'))/3),economy:shift(current.economy,(coach.economy+plan.economy+.5)/3)};
}
