/** New identity primitives. These do not alter pinned tactical simulation v2. */
export type FpsDnaKey = 'riskTolerance' | 'emotionalStability' | 'coachability' | 'tacticalDiscipline' | 'adaptability' | 'creativity' | 'confidenceVolatility' | 'socialTrust' | 'leadershipInitiative' | 'competitiveDrive' | 'teamOrientation' | 'preparationPreference';
export type FpsPlayerDNA = Record<FpsDnaKey, number>;
export const FPS_IDENTITY_BALANCE={personalityReaction:.28,instructionWeight:.3,temperature:.5,specialtyCap:.04,familiarityBase:.002,familiarityAdaptability:.003} as const;
export interface FpsScoutingProfile {player_id:string;personality_id:string|null;specialty_id:string|null;legacy_primary?:string|null;mapping:string;confidence:string;appearances?:number;gameplan_fit?:string|null;coach_fit?:string|null;team_chemistry?:string;familiarity?:string;role_familiarity?:Partial<Record<FpsPrimaryRole,number>>;recent_observations?:string[];observations:{risk:string;adaptability:string;preparation:string;team_orientation:string;pressure_response?:string;economy_discipline?:string}}

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

export type FpsSpecialtyOpportunity = 'coordinatedBreach' | 'allyFlashWindow' | 'coverageGap' | 'knownRotation' | 'compromisedPlan' | 'supportedDoubleFake' | 'preparedLongAngle' | 'exposedSniperRelocation' | 'openingSightline' | 'smokeCoverage' | 'coordinatedFlash' | 'retakeUtility' | 'interceptableRotation' | 'assignedFlankCoverage' | 'infiltrationWindow' | 'siteDelay' | 'defensiveCrossfire' | 'isolatedSiteHold' | 'immediateTrade' | 'entryFollowup' | 'breakCrossfire';
export interface FpsSpecialty { id: string; name: string; preferredRole: string; opportunity: FpsSpecialtyOpportunity; description: string }
/** Opportunities are facts supplied by a future tactical resolver, never inferred from a badge. */
export const FPS_SPECIALTIES: readonly FpsSpecialty[] = [
  {id:'contact_splitter',name:'Contact Splitter',preferredRole:'entry',opportunity:'coordinatedBreach',description:'Breaks a prepared position during a supported breach.'},
  {id:'flash_window_finisher',name:'Flash-Window Finisher',preferredRole:'entry',opportunity:'allyFlashWindow',description:'Converts an allied flash into an opening engagement.'},
  {id:'gap_punisher',name:'Gap Punisher',preferredRole:'entry',opportunity:'coverageGap',description:'Exploits accessible gaps in defensive coverage.'},
  {id:'rotation_decoder',name:'Rotation Decoder',preferredRole:'caller',opportunity:'knownRotation',description:'Interprets an observed rotation.'},
  {id:'midround_rebuilder',name:'Midround Rebuilder',preferredRole:'caller',opportunity:'compromisedPlan',description:'Rebuilds a compromised plan when alternatives remain.'},
  {id:'double_fake_conductor',name:'Double-Fake Conductor',preferredRole:'caller',opportunity:'supportedDoubleFake',description:'Coordinates supported pressure across multiple areas.'},
  {id:'long_lane_guardian',name:'Long-Lane Guardian',preferredRole:'sniper',opportunity:'preparedLongAngle',description:'Holds a prepared long angle with a suitable weapon.'},
  {id:'relocation_marksman',name:'Relocation Marksman',preferredRole:'sniper',opportunity:'exposedSniperRelocation',description:'Changes angle after exposure when a route exists.'},
  {id:'opening_sightline_expert',name:'Opening Sightline Expert',preferredRole:'sniper',opportunity:'openingSightline',description:'Executes a prepared early long-range engagement.'},
  {id:'smoke_cartographer',name:'Smoke Cartographer',preferredRole:'support',opportunity:'smokeCoverage',description:'Places available smoke to cover a useful sightline.'},
  {id:'entry_flash_synchronizer',name:'Entry Flash Synchronizer',preferredRole:'support',opportunity:'coordinatedFlash',description:'Times an available flash with a coordinated entry.'},
  {id:'retake_utility_expert',name:'Retake Utility Expert',preferredRole:'support',opportunity:'retakeUtility',description:'Uses available utility in a contested retake.'},
  {id:'rotation_cutter',name:'Rotation Cutter',preferredRole:'lurker',opportunity:'interceptableRotation',description:'Intercepts an identifiable enemy rotation.'},
  {id:'flank_sentinel',name:'Flank Sentinel',preferredRole:'lurker',opportunity:'assignedFlankCoverage',description:'Covers an assigned exposed flank.'},
  {id:'timing_ghost',name:'Timing Ghost',preferredRole:'lurker',opportunity:'infiltrationWindow',description:'Moves through an available unguarded window.'},
  {id:'delay_engineer',name:'Delay Engineer',preferredRole:'anchor',opportunity:'siteDelay',description:'Delays site pressure with viable tools or positions.'},
  {id:'crossfire_composer',name:'Crossfire Composer',preferredRole:'anchor',opportunity:'defensiveCrossfire',description:'Maintains a compatible defensive crossfire.'},
  {id:'last_line_defender',name:'Last-Line Defender',preferredRole:'anchor',opportunity:'isolatedSiteHold',description:'Holds defensible terrain with limited support.'},
  {id:'instant_refragger',name:'Instant Refragger',preferredRole:'trade',opportunity:'immediateTrade',description:'Converts a known, immediate trade opportunity.'},
  {id:'spacing_technician',name:'Spacing Technician',preferredRole:'trade',opportunity:'entryFollowup',description:'Supports an entry along a viable follow-up route.'},
  {id:'crossfire_breaker',name:'Crossfire Breaker',preferredRole:'trade',opportunity:'breakCrossfire',description:'Isolates a defender through teammate pressure.'},
];

/** No role restriction: a specialty may apply in any role if the real opportunity exists. */
export function evaluateSpecialtyActivation(specialty: FpsSpecialty, opportunities: ReadonlySet<FpsSpecialtyOpportunity>): boolean {
  return opportunities.has(specialty.opportunity);
}


export type FpsPersonalityCategory = 'mentality' | 'risk' | 'relationships' | 'economy';
export type PersonalityTrigger = 'pressure' | 'winningStreak' | 'personalMistake' | 'earlyRound' | 'lateRound' | 'losingStreak' | 'opening' | 'quietRound' | 'enemyCommitment' | 'desperate' | 'enemyDisrupted' | 'probeOpportunity' | 'preparedPlan' | 'contradictedCall' | 'allyContact' | 'setback' | 'planUnclear' | 'leadershipAbsent' | 'poorRetake' | 'utilityExecute' | 'economicTrouble' | 'futureBuy' | 'recoverableGear' | 'rolePurchase';
export type TacticalAction = 'pressure' | 'prepare' | 'react' | 'coordinate' | 'improvise' | 'save' | 'invest' | 'equip' | 'force' | 'probe';
export interface FpsPersonality { id: string; name: string; category: FpsPersonalityCategory; description: string; drawback: string; trigger: PersonalityTrigger; action: TacticalAction; }
// Each reaction is conditional; none contributes to mechanical skill.
export const FPS_IDENTITY_PERSONALITIES: readonly FpsPersonality[] = [
  {id:'icebound',name:'Icebound',category:'mentality',trigger:'pressure',action:'prepare',description:'Keeps a measured approach under pressure.',drawback:'May miss a sudden momentum opportunity.'},
  {id:'momentum_surfer',name:'Momentum Surfer',category:'mentality',trigger:'winningStreak',action:'pressure',description:'Becomes more proactive after sustained success.',drawback:'May overextend while ahead.'},
  {id:'redemption_chaser',name:'Redemption Chaser',category:'mentality',trigger:'personalMistake',action:'pressure',description:'Seeks responsibility after a personal mistake.',drawback:'Can chase revenge.'},
  {id:'pressure_magnet',name:'Pressure Magnet',category:'mentality',trigger:'pressure',action:'pressure',description:'Volunteers for difficult decisions in decisive rounds.',drawback:'Can attempt unnecessary hero plays.'},
  {id:'slow_burner',name:'Slow Burner',category:'mentality',trigger:'earlyRound',action:'probe',description:'Gathers information before becoming decisive.',drawback:'May surrender early momentum.'},
  {id:'reset_specialist',name:'Reset Specialist',category:'mentality',trigger:'losingStreak',action:'coordinate',description:'Seeks tactical discipline after setbacks.',drawback:'May resist a justified risk.'},
  {id:'window_pouncer',name:'Window Pouncer',category:'risk',trigger:'opening',action:'pressure',description:'Acts when an identifiable advantage appears.',drawback:'May hesitate with incomplete information.'},
  {id:'contact_hunter',name:'Contact Hunter',category:'risk',trigger:'quietRound',action:'pressure',description:'Looks for contact when a round stalls.',drawback:'May reveal their position without support.'},
  {id:'counterpuncher',name:'Counterpuncher',category:'risk',trigger:'enemyCommitment',action:'react',description:'Responds to an opponent commitment.',drawback:'Can be too reactive against patient opponents.'},
  {id:'calculated_gambler',name:'Calculated Gambler',category:'risk',trigger:'desperate',action:'improvise',description:'Considers unconventional plays when normal options look poor.',drawback:'May overvalue high-variance solutions.'},
  {id:'tempo_thief',name:'Tempo Thief',category:'risk',trigger:'enemyDisrupted',action:'pressure',description:'Changes pace against disrupted opponents.',drawback:'Can mistime the acceleration.'},
  {id:'boundary_tester',name:'Boundary Tester',category:'risk',trigger:'probeOpportunity',action:'probe',description:'Tests opponent reactions for information.',drawback:'Repeated probes can become predictable.'},
  {id:'structured_operator',name:'Structured Operator',category:'relationships',trigger:'preparedPlan',action:'coordinate',description:'Prefers executing agreed assignments.',drawback:'Can struggle when the plan collapses.'},
  {id:'tactical_skeptic',name:'Tactical Skeptic',category:'relationships',trigger:'contradictedCall',action:'improvise',description:'Questions calls contradicted by available information.',drawback:'Disagreement can delay a decision.'},
  {id:'silent_enabler',name:'Silent Enabler',category:'relationships',trigger:'allyContact',action:'coordinate',description:'Supports teammates through complementary actions.',drawback:'May lack direction without leadership.'},
  {id:'rally_voice',name:'Rally Voice',category:'relationships',trigger:'setback',action:'coordinate',description:'Tries to stabilize teammates after setbacks.',drawback:'Extra communication can consume time.'},
  {id:'independent_solver',name:'Independent Solver',category:'relationships',trigger:'planUnclear',action:'improvise',description:'Finds individual solutions when plans are unclear.',drawback:'May separate from the group.'},
  {id:'burden_carrier',name:'Burden Carrier',category:'relationships',trigger:'leadershipAbsent',action:'coordinate',description:'Takes initiative when leadership is absent.',drawback:'May conflict with an established caller.'},
  {id:'asset_guardian',name:'Asset Guardian',category:'economy',trigger:'poorRetake',action:'save',description:'Considers preserving equipment in poor retakes.',drawback:'Can leave a recoverable round.'},
  {id:'utility_investor',name:'Utility Investor',category:'economy',trigger:'utilityExecute',action:'invest',description:'Favors utility for planned executes.',drawback:'May sacrifice an individual weapon upgrade.'},
  {id:'force_buy_optimist',name:'Force-Buy Optimist',category:'economy',trigger:'economicTrouble',action:'force',description:'Considers a momentum-changing force buy.',drawback:'Can compromise later rounds.'},
  {id:'bankroll_planner',name:'Bankroll Planner',category:'economy',trigger:'futureBuy',action:'save',description:'Considers purchases across future rounds.',drawback:'May decline a worthwhile immediate opportunity.'},
  {id:'salvage_opportunist',name:'Salvage Opportunist',category:'economy',trigger:'recoverableGear',action:'save',description:'Looks to recover equipment at acceptable tactical cost.',drawback:'Can waste time pursuing equipment.'},
  {id:'role_first_buyer',name:'Role-First Buyer',category:'economy',trigger:'rolePurchase',action:'equip',description:'Prioritizes equipment for assigned duties.',drawback:'May be poorly equipped for surprises.'},
];

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
export interface FpsPlayer { id: string; personality: FpsPersonality; intensity: number; dna: FpsPlayerDNA; specialty?: FpsSpecialty; specialtyProficiency?: number; roleSuitability: number; familiarity: number; roleFamiliarity?: Partial<Record<FpsPrimaryRole,number>>; assignedRole?: FpsPrimaryRole|null; instruction?: 'balanced'|'hold'|'initiative'|'support' }
export interface MatchStateContext { triggers: ReadonlySet<PersonalityTrigger>; opportunities: ReadonlySet<FpsSpecialtyOpportunity>; confidence: number; fatigue: number; teamIdentity?: FpsTeamIdentity; }
export interface PlayerTacticalFit { coachFit: number; gameplanFit: number; roleFit: number; teamChemistry: number; familiarity: number; overall: number }
export interface ScoredTacticalAction { action: TacticalAction; legal: boolean; tacticalValue: number; instruction: number }
export interface PlayerDecisionResult { action: TacticalAction; scores: {action: TacticalAction; score: number; probability: number}[]; triggers: PersonalityTrigger[]; instructionAdherence: number }
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const similarity = (a: number,b: number) => 1-Math.abs(clamp01(a)-clamp01(b));
export function evaluatePersonalityTriggers(player: FpsPlayer, state: MatchStateContext): PersonalityTrigger[] {
  return state.triggers.has(player.personality.trigger) ? [player.personality.trigger] : [];
}
export function evaluateCoachFit(player: FpsPlayer, coach: FpsCoach): number {
  const d=player.dna;
  return (similarity(d.tacticalDiscipline/100,coach.rigidity)+similarity(d.preparationPreference/100,coach.preparation)+similarity(d.creativity/100,coach.freedom)+similarity(d.teamOrientation/100,coach.communication))/4;
}
export function evaluateGameplanFit(player: FpsPlayer, plan: FpsGameplan): number {
  const d=player.dna;
  return (similarity(d.riskTolerance/100,plan.aggression)+similarity(d.tacticalDiscipline/100,plan.structure)+similarity(d.preparationPreference/100,plan.preparation)+similarity(d.creativity/100,plan.freedom))/4;
}
export function evaluateTeamChemistry(chemistry: FpsTeamChemistry): number {
  return clamp01((chemistry.trust+chemistry.communication+chemistry.understanding+chemistry.leadershipAcceptance+(1-chemistry.roleCompetition))/5);
}
export function evaluateTacticalCompatibility(player: FpsPlayer, coach: FpsCoach, plan: FpsGameplan, chemistry: FpsTeamChemistry): PlayerTacticalFit {
  const coachFit=evaluateCoachFit(player,coach), gameplanFit=evaluateGameplanFit(player,plan), teamChemistry=evaluateTeamChemistry(chemistry), roleFit=clamp01(player.roleSuitability), familiarity=clamp01(player.familiarity);
  return {coachFit,gameplanFit,roleFit,teamChemistry,familiarity,overall:(coachFit+gameplanFit+teamChemistry+roleFit+familiarity)/5};
}
/** Caller supplies only observed context and candidates; illegal actions never enter selection. */
export function scoreTacticalActions(player: FpsPlayer, state: MatchStateContext, coach: FpsCoach, plan: FpsGameplan, chemistry: FpsTeamChemistry, candidates: readonly ScoredTacticalAction[]): PlayerDecisionResult['scores'] {
  const active=evaluatePersonalityTriggers(player,state).length>0, fit=evaluateTacticalCompatibility(player,coach,plan,chemistry);
  const culturalAlignment=state.teamIdentity ? (similarity(state.teamIdentity.tempo,plan.tempo)+similarity(state.teamIdentity.structure,plan.structure)+similarity(state.teamIdentity.preparation,plan.preparation))/3 : .5;
  const scores=candidates.filter(c=>c.legal).map(c=> {
    const personality=active && c.action===player.personality.action ? FPS_IDENTITY_BALANCE.personalityReaction*clamp01(player.intensity)*(.75+player.dna.competitiveDrive/400) : 0;
    const planResponse=fit.gameplanFit*.85+player.dna.adaptability/100*.15;
    const adherence=clamp01(player.dna.coachability/100)*(.1+.25*fit.familiarity+.15*fit.coachFit+.2*fit.teamChemistry+.15*culturalAlignment+.15*planResponse);
    const instruction=adherence*Math.max(-1,Math.min(1,c.instruction))*FPS_IDENTITY_BALANCE.instructionWeight;
    const coordination=c.action==='coordinate' ? ((fit.teamChemistry-.5)*.12+(culturalAlignment-.5)*.08) : 0;
    const risk=c.action==='pressure' || c.action==='force' ? (player.dna.riskTolerance/100-.5)*.18+(clamp01(state.confidence)-.5)*.08-clamp01(state.fatigue)*.04 : 0;
    return {action:c.action,score:Math.max(-4,Math.min(4,c.tacticalValue+personality+instruction+coordination+risk)),probability:0};
  });
  if (!scores.length) throw new Error('No legal tactical action');
  const max=Math.max(...scores.map(s=>s.score));
  const weights=scores.map(s=>Math.exp((s.score-max)/FPS_IDENTITY_BALANCE.temperature)); const total=weights.reduce((a,b)=>a+b,0);
  return scores.map((s,i)=>({...s,probability:weights[i]/total}));
}
export function evaluatePlayerAction(player: FpsPlayer, state: MatchStateContext, coach: FpsCoach, plan: FpsGameplan, chemistry: FpsTeamChemistry, candidates: readonly ScoredTacticalAction[], random: () => number): PlayerDecisionResult {
  const scores=scoreTacticalActions(player,state,coach,plan,chemistry,candidates); let roll=clamp01(random());
  let selected=scores[scores.length-1]; for(const score of scores) { roll-=score.probability; if(roll<0) { selected=score; break; } }
  const instructions=candidates.filter(c=>c.legal).map(c=>c.instruction),min=Math.min(...instructions),max=Math.max(...instructions);
  const chosen=candidates.find(c=>c.legal&&c.action===selected.action)!;
  return {action:selected.action,scores,triggers:evaluatePersonalityTriggers(player,state),instructionAdherence:max===min ? .5 : clamp01((chosen.instruction-min)/(max-min))};
}
/** Bounded gradual learning; one event cannot transform a player's identity. */
export function developFpsFamiliarity(current: number, experience: number, adaptability: number): number {
  const value=clamp01(current); return clamp01(value+Math.max(0,Math.min(1,experience))*(FPS_IDENTITY_BALANCE.familiarityBase+FPS_IDENTITY_BALANCE.familiarityAdaptability*clamp01(adaptability))*(1-value));
}


export interface SpecialtyActivation { specialtyId: string; active: boolean; executionBonus: number; opportunity: FpsSpecialtyOpportunity }
/** Only a caller that has verified the tactical opportunity can request the capped execution effect. */
export function resolveTacticalExecution(specialty: FpsSpecialty | undefined, opportunities: ReadonlySet<FpsSpecialtyOpportunity>, proficiency: number): SpecialtyActivation | undefined {
  if (!specialty) return undefined;
  const active=evaluateSpecialtyActivation(specialty,opportunities);
  return {specialtyId:specialty.id,active,executionBonus:active ? FPS_IDENTITY_BALANCE.specialtyCap*clamp01(proficiency) : 0,opportunity:specialty.opportunity};
}
export function developFpsChemistry(current: FpsTeamChemistry, interaction: {coordinated: boolean; roleConflict: boolean}): FpsTeamChemistry {
  const step=(value: number, positive: boolean) => clamp01(value+(positive ? .004*(1-value) : -.004*value));
  return {trust:step(current.trust,interaction.coordinated),communication:step(current.communication,interaction.coordinated),understanding:step(current.understanding,interaction.coordinated),leadershipAcceptance:current.leadershipAcceptance,roleCompetition:step(current.roleCompetition,interaction.roleConflict)};
}
export function evolveFpsTeamIdentity(current: FpsTeamIdentity, coach: FpsCoach, plan: FpsGameplan, roster: readonly FpsPlayerDNA[]): FpsTeamIdentity {
  if (!roster.length) return {...current};
  const mean=(key: FpsDnaKey) => roster.reduce((sum,dna)=>sum+dna[key]/100,0)/roster.length;
  const shift=(old: number, target: number) => clamp01(old+Math.max(-.01,Math.min(.01,(target-old)*.03)));
  return {tempo:shift(current.tempo,(coach.tempo+plan.tempo+mean('riskTolerance'))/3),structure:shift(current.structure,(coach.rigidity+plan.structure+mean('tacticalDiscipline'))/3),aggression:shift(current.aggression,(coach.aggression+plan.aggression+mean('riskTolerance'))/3),preparation:shift(current.preparation,(coach.preparation+plan.preparation+mean('preparationPreference'))/3),freedom:shift(current.freedom,(coach.freedom+plan.freedom+mean('creativity'))/3),economy:shift(current.economy,(coach.economy+plan.economy+mean('tacticalDiscipline'))/3)};
}
