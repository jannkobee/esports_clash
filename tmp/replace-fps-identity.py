from pathlib import Path
import re
base=Path('EsportsClash.Web/src/fps')
p=base/'fpsIdentity.ts';s=p.read_text(encoding='utf-8')
dna=s[s.index('export type FpsDnaKey'):s.index('export type FpsSpecialtyOpportunity')]
dna=re.sub(r'export const FPS_IDENTITY_BALANCE=.*?;\n','',dna)
dna=re.sub(r'export interface FpsScoutingProfile .*?\n','',dna)
opportunity=s[s.index('export type FpsSpecialtyOpportunity'):s.index('export interface FpsSpecialty')].replace('FpsSpecialtyOpportunity','FpsTacticalOpportunity')
trigger=s[s.index('export type PersonalityTrigger'):s.index('export interface FpsPersonality')]
team=s[s.index('export interface FpsCoach'):s.index('export interface FpsPlayer {')]
tail=s[s.index('/** Bounded gradual learning;'):]
tail=tail[:tail.index('export interface SpecialtyActivation')]+tail[tail.index('export function developFpsChemistry'):]
core='''import {fpsBehaviorPreferences, type FpsPersonality, type FpsAssignments, type FpsObservedBehavior} from './fpsPlayerArchitecture.ts';
export * from './fpsPlayerArchitecture.ts';
export const FPS_IDENTITY_BALANCE={instructionWeight:.3,temperature:.42,familiarityBase:.002,familiarityAdaptability:.003} as const;
export interface FpsScoutingProfile {player_id:string;personality:FpsPersonality;assignments?:FpsAssignments;observed?:FpsObservedBehavior;mapping:string;confidence:string;appearances?:number;gameplan_fit?:string|null;coach_fit?:string|null;team_chemistry?:string;familiarity?:string;role_familiarity?:Partial<Record<FpsPrimaryRole,number>>;recent_observations?:string[];observations:{risk:string;adaptability:string;preparation:string;team_orientation:string;pressure_response?:string;economy_discipline?:string}}
'''+dna+opportunity+trigger+team+'''export interface FpsPlayer {id:string;personality:FpsPersonality;assignments?:FpsAssignments;observed?:FpsObservedBehavior;intensity:number;dna:FpsPlayerDNA;roleSuitability:number;familiarity:number;roleFamiliarity?:Partial<Record<FpsPrimaryRole,number>>;instruction?:'balanced'|'hold'|'initiative'|'support'}
export interface MatchStateContext {triggers:ReadonlySet<PersonalityTrigger>;opportunities:ReadonlySet<FpsTacticalOpportunity>;confidence:number;fatigue:number;teamIdentity?:FpsTeamIdentity}
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
'''+tail
p.write_text(core,encoding='utf-8')
# Retire all specialty execution bonuses; useful opportunities remain ordinary situational facts.
for name in ['fpsRoundSimulation.ts','fpsLiveSimulation.ts']:
 p=base/name;s=p.read_text(encoding='utf-8').replace('resolveTacticalExecution, ','').replace('FpsSpecialtyOpportunity','FpsTacticalOpportunity')
 s=re.sub(r'^.*const (?:utilityActivation|activation|effect)=resolveTacticalExecution.*\n','',s,flags=re.M)
 s=re.sub(r'^.*if \((?:utilityActivation|activation)\?\.active\).*\n','',s,flags=re.M)
 s=s.replace('const specialtyBonus=activation?.executionBonus ?? 0;','').replace('+specialtyBonus','')
 s=s.replace('const utilityFactor=1+(utilityActivation?.executionBonus ?? 0);','const utilityFactor=1;')
 s=s.replace("specialty?:string; ",'').replace(',specialty:this.identity.players[card.id].specialty?.name','').replace(',specialty:p.specialty','')
 p.write_text(s,encoding='utf-8')
p=base/'fpsSimulationEngine.ts';s=p.read_text(encoding='utf-8');s=re.sub(r'^.*(?:const activations=|if \(activations\) identity.specialtyProficiency).*\n','',s,flags=re.M);p.write_text(s,encoding='utf-8')
