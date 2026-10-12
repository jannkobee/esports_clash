import type { PlayerCard } from './types';

export const PERSONALITY_IDS = [
  'igl', 'captain', 'challenger', 'loyalist', 'glue_guy', 'silent_operator',
  'untiltable', 'cold_as_ice', 'short_fuse', 'fragile_mental', 'iron_will', 'clutch_performer',
  'overconfident', 'egoistic', 'momentum_junkie', 'revenge_driven', 'showman', 'perfectionist',
  'first_blood_hunter', 'counterpuncher', 'limit_tester', 'bodyguard', 'patient_predator', 'tunnel_vision',
  'objective_zealot', 'steal_gambler', 'siege_closer', 'wave_architect', 'bush_stalker', 'survivalist',
] as const;
export type PersonalityId = typeof PERSONALITY_IDS[number];
export type PersonalityAction = 'engage' | 'retreat' | 'chase' | 'peel' | 'objective' | 'siege' | 'wave' | 'regroup' | 'farm';

export interface PersonalityDefinition {
  id: PersonalityId; name: string; description: string; emotionalSensitivity: number;
  preferences: Partial<Record<PersonalityAction, number>>; teamwork: number; leadership: number;
  compatible: PersonalityId[]; strengths: string[]; weaknesses: string[]; observableEffects: string[];
}

const PERSONALITY_DETAILS: Record<PersonalityId, Pick<PersonalityDefinition, 'strengths' | 'weaknesses' | 'observableEffects'>> = {
  igl: { strengths: ['live coordination'], weaknesses: ['stubborn calls'], observableEffects: ['signals a team objective or fight call'] },
  captain: { strengths: ['loss recovery'], weaknesses: ['cautious conversion'], observableEffects: ['stabilizes a shaken group'] },
  challenger: { strengths: ['risk review'], weaknesses: ['hesitation'], observableEffects: ['reduces alignment with a losing call'] },
  loyalist: { strengths: ['call follow-through'], weaknesses: ['trusts bad calls'], observableEffects: ['aligns strongly with an IGL'] },
  glue_guy: { strengths: ['cohesion'], weaknesses: ['avoids confrontation'], observableEffects: ['dampens a group loss'] },
  silent_operator: { strengths: ['independent execution'], weaknesses: ['low leadership'], observableEffects: ['uses individual rather than teamwide preference'] },
  untiltable: { strengths: ['emotional stability'], weaknesses: ['less urgency'], observableEffects: ['retains organized calls after losses'] },
  cold_as_ice: { strengths: ['stable targeting'], weaknesses: ['slower momentum use'], observableEffects: ['holds a legal focus through disruption'] },
  short_fuse: { strengths: ['immediate response'], weaknesses: ['tilt'], observableEffects: ['frustration can favor a legal fight'] },
  fragile_mental: { strengths: ['self-preservation'], weaknesses: ['loss aversion'], observableEffects: ['setbacks favor regrouping'] },
  iron_will: { strengths: ['comeback resolve'], weaknesses: ['risk tolerance'], observableEffects: ['remains willing to contest from behind'] },
  clutch_performer: { strengths: ['decisive pressure play'], weaknesses: ['waits for a moment'], observableEffects: ['commits during a real critical window'] },
  overconfident: { strengths: ['pressure conversion'], weaknesses: ['overextension'], observableEffects: ['wins favor safe continued pressure'] },
  egoistic: { strengths: ['personal carry focus'], weaknesses: ['call discipline'], observableEffects: ['individual target opportunities lower call alignment'] },
  momentum_junkie: { strengths: ['streak pressure'], weaknesses: ['streak hesitation'], observableEffects: ['recent results amplify action preference'] },
  revenge_driven: { strengths: ['target persistence'], weaknesses: ['target bias'], observableEffects: ['recent killer gets legal target priority'] },
  showman: { strengths: ['outplay appetite'], weaknesses: ['unnecessary complexity'], observableEffects: ['favors real high-pressure play windows'] },
  perfectionist: { strengths: ['prepared execution'], weaknesses: ['delay'], observableEffects: ['waits for allied resources before optional fights'] },
  first_blood_hunter: { strengths: ['early pressure'], weaknesses: ['farm tradeoff'], observableEffects: ['only early-game windows gain aggression'] },
  counterpuncher: { strengths: ['punish timing'], weaknesses: ['passivity'], observableEffects: ['responds after observed enemy cooldown use'] },
  limit_tester: { strengths: ['limit pressure'], weaknesses: ['misjudgment'], observableEffects: ['frustration can select a difficult legal fight'] },
  bodyguard: { strengths: ['carry peel'], weaknesses: ['forgoes chase'], observableEffects: ['prioritizes an enemy threatening an ally'] },
  patient_predator: { strengths: ['pick discipline'], weaknesses: ['missed windows'], observableEffects: ['waits for isolated legal targets'] },
  tunnel_vision: { strengths: ['focus persistence'], weaknesses: ['reassessment'], observableEffects: ['keeps a current visible target'] },
  objective_zealot: { strengths: ['objective focus'], weaknesses: ['contest bias'], observableEffects: ['prioritizes legal objective regrouping'] },
  steal_gambler: { strengths: ['late secure awareness'], weaknesses: ['contest risk'], observableEffects: ['only favors a low-health objective finish'] },
  siege_closer: { strengths: ['structure conversion'], weaknesses: ['push depth'], observableEffects: ['uses a safe won-fight structure window'] },
  wave_architect: { strengths: ['wave preparation'], weaknesses: ['delayed pressure'], observableEffects: ['clears a wave before optional siege'] },
  bush_stalker: { strengths: ['ambush setup'], weaknesses: ['isolation'], observableEffects: ['holds a safe bush for an isolated target'] },
  survivalist: { strengths: ['recovery discipline'], weaknesses: ['early exit'], observableEffects: ['adverse fights favor retreat'] },
};

const define = (id: PersonalityId, name: string, description: string, preferences: PersonalityDefinition['preferences'], emotionalSensitivity: number, teamwork: number, leadership: number, compatible: PersonalityId[]): PersonalityDefinition =>
  ({ id, name, description, preferences, emotionalSensitivity, teamwork, leadership, compatible, ...PERSONALITY_DETAILS[id] });

export const PERSONALITIES: Record<PersonalityId, PersonalityDefinition> = {
  igl: define('igl', 'IGL / Shotcaller', 'Coordinates live calls and can become stubborn once committed.', { engage: 2, objective: 2, regroup: 3 }, .85, 3, 5, ['loyalist','captain','objective_zealot']),
  captain: define('captain', 'Captain', 'Stabilizes morale and favors safe coordinated play.', { regroup: 3, peel: 1 }, .7, 5, 4, ['glue_guy','untiltable','bodyguard']),
  challenger: define('challenger', 'Challenger', 'Questions marginal calls and can introduce measured hesitation.', { retreat: 2, regroup: 1 }, 1, 1, 2, ['perfectionist','cold_as_ice','objective_zealot']),
  loyalist: define('loyalist', 'Loyalist', 'Follows trusted team calls even when they are imperfect.', { regroup: 3, engage: 1 }, .8, 5, 0, ['igl','captain','bodyguard']),
  glue_guy: define('glue_guy', 'Glue Guy', 'Reduces friction and keeps the group together.', { regroup: 3, peel: 1 }, .65, 5, 2, ['captain','untiltable','loyalist']),
  silent_operator: define('silent_operator', 'Silent Operator', 'Uses independent, reliable evaluation over loud calls.', { farm: 1 }, .75, 0, 1, ['cold_as_ice','patient_predator','perfectionist']),
  untiltable: define('untiltable', 'Untiltable', 'Absorbs setbacks with unusually steady decision-making.', { retreat: 1 }, .42, 2, 1, ['igl','captain','iron_will']),
  cold_as_ice: define('cold_as_ice', 'Cold as Ice', 'Keeps risk assessment stable through streaks.', { regroup: 1 }, .38, 1, 1, ['patient_predator','perfectionist','silent_operator']),
  short_fuse: define('short_fuse', 'Short Fuse', 'Tilt makes premature engages and chases more tempting.', { engage: 2, chase: 2 }, 1.55, -2, 0, ['limit_tester','revenge_driven','showman']),
  fragile_mental: define('fragile_mental', 'Fragile Mental', 'Repeated setbacks make the player overly defensive.', { retreat: 2, regroup: 1 }, 1.6, -1, 0, ['glue_guy','captain','survivalist']),
  iron_will: define('iron_will', 'Iron Will', 'Keeps looking for legitimate comeback opportunities.', { engage: 1, objective: 1 }, .7, 2, 1, ['untiltable','clutch_performer','objective_zealot']),
  clutch_performer: define('clutch_performer', 'Clutch Performer', 'Commits calmly in decisive fights and defenses.', { engage: 2, peel: 1 }, .62, 1, 1, ['iron_will','cold_as_ice','perfectionist']),
  overconfident: define('overconfident', 'Overconfident', 'Winning amplifies pressure and legal overextension.', { engage: 2, chase: 3, siege: 1 }, 1.25, -1, 0, ['siege_closer','showman','egoistic']),
  egoistic: define('egoistic', 'Egoistic', 'Prefers personal impact over a merely adequate call.', { chase: 2, engage: 1 }, 1.1, -3, 0, ['overconfident','revenge_driven','showman']),
  momentum_junkie: define('momentum_junkie', 'Momentum Junkie', 'Streaks amplify aggression or indecision.', { engage: 2, chase: 1 }, 1.45, -1, 0, ['overconfident','first_blood_hunter','iron_will']),
  revenge_driven: define('revenge_driven', 'Revenge Driven', 'Remembers recent killers and may prioritize them.', { chase: 2, engage: 1 }, 1.2, -1, 0, ['short_fuse','egoistic','tunnel_vision']),
  showman: define('showman', 'Showman', 'Values difficult outplays over plain opportunities.', { engage: 1, chase: 2 }, 1.1, -1, 0, ['overconfident','limit_tester','first_blood_hunter']),
  perfectionist: define('perfectionist', 'Perfectionist', 'Waits for positioning and synchronized resources.', { regroup: 2, retreat: 1 }, .65, 2, 1, ['cold_as_ice','wave_architect','counterpuncher']),
  first_blood_hunter: define('first_blood_hunter', 'First Blood Hunter', 'Trades some early farm for favorable early aggression.', { engage: 2, farm: -1 }, 1, 0, 0, ['showman','momentum_junkie','limit_tester']),
  counterpuncher: define('counterpuncher', 'Counterpuncher', 'Prefers responding after opponents spend key abilities.', { engage: 1, retreat: 1 }, .72, 1, 0, ['cold_as_ice','perfectionist','bodyguard']),
  limit_tester: define('limit_tester', 'Limit Tester', 'Attempts difficult but still legal combat limits.', { engage: 2, chase: 1 }, 1.2, -1, 0, ['short_fuse','showman','first_blood_hunter']),
  bodyguard: define('bodyguard', 'Bodyguard', 'Peels danger away from vulnerable teammates.', { peel: 4, engage: -1 }, .7, 4, 1, ['loyalist','captain','glue_guy']),
  patient_predator: define('patient_predator', 'Patient Predator', 'Waits for isolated enemies and ambush windows.', { engage: 1, regroup: -1 }, .6, 0, 0, ['cold_as_ice','bush_stalker','silent_operator']),
  tunnel_vision: define('tunnel_vision', 'Tunnel Vision', 'Sticks to a chosen target more than is ideal.', { chase: 2 }, 1.15, -2, 0, ['revenge_driven','egoistic','limit_tester']),
  objective_zealot: define('objective_zealot', 'Objective Zealot', 'Values Embermaw and Gravemarch contests highly.', { objective: 4, regroup: 1 }, .9, 2, 2, ['steal_gambler','igl','iron_will']),
  steal_gambler: define('steal_gambler', 'Steal Gambler', 'Looks for meaningful low-health objective steals.', { objective: 3 }, 1.1, -1, 0, ['objective_zealot','limit_tester','clutch_performer']),
  siege_closer: define('siege_closer', 'Siege Closer', 'Converts wins into structures, sometimes too far.', { siege: 4, chase: 1 }, 1, 1, 1, ['overconfident','wave_architect','igl']),
  wave_architect: define('wave_architect', 'Wave Architect', 'Prepares the main-lane wave before siege windows.', { wave: 4, siege: 1 }, .65, 2, 1, ['siege_closer','perfectionist','objective_zealot']),
  bush_stalker: define('bush_stalker', 'Bush Stalker', 'Uses safe vision gaps and bushes for ambushes.', { engage: 1, regroup: -1 }, .9, -1, 0, ['patient_predator','counterpuncher','first_blood_hunter']),
  survivalist: define('survivalist', 'Survivalist', 'Prioritizes safe positioning, disengage, and recovery.', { retreat: 4, regroup: 1 }, .72, 1, 0, ['fragile_mental','bodyguard','cold_as_ice']),
};

export interface PlayerMood { confidence: number; excitement: number; frustration: number; composure: number; trust: number; }
export interface PlayerPsychologyState { mood: PlayerMood; recentWins: number; recentLosses: number; recentKillerId?: string; processedEventIds: string[]; }
export interface TeammateRelationship { trust: number; cooperation: number; rivalry: number; leadershipRespect: number; }
export interface TeamPsychology { morale: number; momentum: number; cohesion: number; leadershipAuthority: number; mentalities: string[]; iglId?: string; }
export interface PersonalityDecisionContext {
  healthFraction?: number;
  nearbyAllies?: number;
  nearbyEnemies?: number;
  callAlignment?: number;
  gameSeconds?: number;
  isSafe?: boolean;
  isContestedObjective?: boolean;
  objectiveHealthFraction?: number;
  allyThreatened?: boolean;
  enemySpentKeySkill?: boolean;
  isolatedTarget?: boolean;
  alliedResourcesReady?: boolean;
  siegeOpportunity?: boolean;
  isInBush?: boolean;
}
export interface PersonalityCombinationInfluence { id: string; label: string; delta: number; reason: string; }
export interface PersonalityDecisionTelemetry {
  action: PersonalityAction;
  baseline: number;
  baselineReason?: string;
  personalityDelta: number;
  moodDelta: number;
  coordinationDelta: number;
  combinationDelta?: number;
  combinations?: string[];
  safetyGate?: string;
  targetId?: string;
  commitUntil?: number;
  explanation: string;
  at: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));
export const defaultMood = (): PlayerMood => ({ confidence: 50, excitement: 30, frustration: 10, composure: 70, trust: 60 });
export function ensurePsychology(player: PlayerCard, state?: PlayerPsychologyState): PlayerPsychologyState {
  return state ?? { mood: defaultMood(), recentWins: 0, recentLosses: 0, processedEventIds: [] };
}
export function personalityOf(player: PlayerCard): PersonalityId[] {
  const primary = player.primaryPersonality ?? personalityForCard(player, 0);
  const secondary = player.secondaryPersonality ?? personalityForCard(player, 1, primary);
  return primary === secondary ? [primary] : [primary, secondary];
}
export function hasPersonalityCombination(player: PlayerCard, first: PersonalityId, second: PersonalityId): boolean {
  const traits = personalityOf(player);
  return traits.includes(first) && traits.includes(second);
}

/**
 * Pair effects are deliberately conditional directives rather than a second
 * stack of always-on stats. Callers still apply their own legality, safety,
 * commitment and visibility rules after receiving these preferences.
 */
export function personalityCombinationInfluences(
  player: PlayerCard, state: PlayerPsychologyState, action: PersonalityAction, context: PersonalityDecisionContext = {},
): PersonalityCombinationInfluence[] {
  const has = (first: PersonalityId, second: PersonalityId) => hasPersonalityCombination(player, first, second);
  const allies = context.nearbyAllies ?? 0;
  const enemies = context.nearbyEnemies ?? 0;
  const healthy = (context.healthFraction ?? 1) >= .62;
  const disadvantaged = enemies > allies || (context.healthFraction ?? 1) < .48 || context.isSafe === false;
  const influences: PersonalityCombinationInfluence[] = [];
  const add = (id: string, label: string, delta: number, reason: string) => influences.push({ id, label, delta, reason });

  if (has('igl', 'untiltable') && state.recentLosses >= 2 && (action === 'regroup' || action === 'defend')) {
    add('igl_untiltable', 'Composed call', 2.4, 'keeps an organized recovery call after setbacks');
  }
  if (has('egoistic', 'overconfident') && state.recentWins >= 2 && healthy && allies >= enemies && context.isSafe !== false
    && (action === 'engage' || action === 'chase' || action === 'siege')) {
    add('ego_overconfident', 'Star pressure', 1.8, 'presses a personal advantage after a real win');
  }
  if (has('cold_as_ice', 'patient_predator')) {
    if (context.isolatedTarget && context.isSafe !== false && action === 'engage') {
      add('cold_patient', 'Measured pick', 2.1, 'commits only to an isolated legal target');
    } else if (!context.isolatedTarget && action === 'regroup') {
      add('cold_patient', 'Measured hold', 1.5, 'declines an unprepared pick window');
    }
  }
  if (has('short_fuse', 'limit_tester') && state.mood.frustration >= 48 && healthy && allies >= enemies && context.isSafe !== false
    && (action === 'engage' || action === 'chase')) {
    add('short_limit', 'Volatile limit', 1.7, 'tilt favors a difficult but numerically supported fight');
  }
  if (has('bodyguard', 'loyalist')) {
    if (context.allyThreatened && action === 'peel') add('bodyguard_loyalist', 'Protect the call', 3, 'peels an endangered teammate before chasing');
    if (action === 'regroup' && (context.callAlignment ?? 0) >= .55) add('bodyguard_loyalist', 'Protect the call', 1.4, 'stays near the coordinated group');
  }
  if (has('objective_zealot', 'steal_gambler') && context.isContestedObjective) {
    if ((context.objectiveHealthFraction ?? 1) <= .32 && action === 'objective') {
      add('objective_steal', 'Calculated steal', 2.4, 'recognizes the protected objective finish window');
    } else if ((context.objectiveHealthFraction ?? 1) > .32 && action === 'engage') {
      add('objective_steal', 'Pit contest', 1.6, 'fights holders before a healthy objective, never through the pit');
    }
  }
  if (has('siege_closer', 'overconfident') && context.siegeOpportunity && healthy && allies >= enemies && context.isSafe !== false && action === 'siege') {
    add('siege_overconfident', 'Relentless conversion', 1.8, 'uses a safe post-win structure window');
  }
  // This pair resolves contradictory impulses once per decision. Survival wins
  // under immediate danger; confidence only expresses itself from a safe edge.
  if (has('overconfident', 'survivalist')) {
    if (disadvantaged && (action === 'retreat' || action === 'regroup')) {
      add('confidence_survival', 'Measured withdrawal', 2.7, 'survival overrides pressure in an adverse state');
    } else if (!disadvantaged && healthy && allies >= enemies && context.isSafe !== false && (action === 'engage' || action === 'chase')) {
      add('confidence_survival', 'Measured pressure', 1.2, 'confidence acts only from a stable advantage');
    }
  }
  return influences;
}

/** Individual call response stays bounded; it never makes a protected action legal. */
export function personalityCallAlignment(player: PlayerCard, state: PlayerPsychologyState, context: PersonalityDecisionContext = {}): number {
  const traits = personalityOf(player);
  let delta = 0;
  if (traits.includes('loyalist')) delta += .16;
  if (traits.includes('igl')) delta += .08;
  if (traits.includes('glue_guy') || traits.includes('captain')) delta += .06;
  if (traits.includes('challenger') && ((context.nearbyEnemies ?? 0) > (context.nearbyAllies ?? 0) || (context.healthFraction ?? 1) < .5)) delta -= .14;
  if (traits.includes('egoistic') && context.isolatedTarget && state.mood.confidence >= 62) delta -= .12;
  if (traits.includes('bodyguard') && context.allyThreatened) delta += .1;
  if (traits.includes('fragile_mental') && state.recentLosses >= 2) delta -= .08;
  return Math.max(-.2, Math.min(.2, delta));
}
export function personalityForCard(player: PlayerCard, offset = 0, avoid?: PersonalityId): PersonalityId {
  let hash = 0; for (const char of String(player.id ?? player.name ?? 'anonymous')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const candidates = PERSONALITY_IDS.filter(id => id !== avoid);
  return candidates[(hash + offset * 13 + player.stats.iq + player.stats.tf) % candidates.length];
}
export function normalizePlayerPersonality<T extends PlayerCard>(player: T): T {
  const primary = player.primaryPersonality ?? personalityForCard(player);
  const secondary = player.secondaryPersonality ?? personalityForCard(player, 1, primary);
  return { ...player, primaryPersonality: primary, secondaryPersonality: secondary, personality: PERSONALITIES[primary].name, badges: player.badges.filter(b => !/Aggro Diver|Clutch King|Baron Steal|One-Tap God|Laning Demon|Unkillable Demon|Ice in Veins|Vision Master|Shotcaller|Golden Flash/i.test(b)) };
}
export type PsychologyEvent = 'kill'|'assist'|'death'|'multikill'|'rescue'|'comeback'|'teamfight_win'|'teamfight_loss'|'team_wipe'|'objective_steal'|'objective_loss'|'defense'|'failed_siege'|'failed_engagement'|'coordination';
export function applyMoodEvent(state: PlayerPsychologyState, eventId: string, kind: PsychologyEvent, traits: PersonalityId[]): PlayerPsychologyState {
  if (state.processedEventIds.includes(eventId)) return state;
  const sensitivity = traits.reduce((sum, id) => sum + PERSONALITIES[id].emotionalSensitivity, 0) / traits.length;
  const changes: Record<PsychologyEvent, Partial<PlayerMood>> = {
    kill: { confidence: 8, excitement: 8, frustration: -5 }, assist: { confidence: 4, excitement: 5, trust: 3 }, death: { confidence: -11, excitement: -5, frustration: 14 }, multikill: { confidence: 12, excitement: 16, frustration: -8 }, rescue: { confidence: 7, excitement: 5, frustration: -4, trust: 5 }, comeback: { confidence: 20, excitement: 22, frustration: -13, trust: 8 },
    teamfight_win: { confidence: 16, excitement: 18, frustration: -9, trust: 6 }, teamfight_loss: { confidence: -15, excitement: -9, frustration: 18, trust: -4 }, team_wipe: { confidence: 22, excitement: 22, frustration: -12, trust: 8 },
    objective_steal: { confidence: 18, excitement: 20, frustration: -10, trust: 4 }, objective_loss: { confidence: -12, frustration: 14 }, defense: { confidence: 10, composure: 4, trust: 4 }, failed_siege: { confidence: -8, excitement: -5, frustration: 10 }, failed_engagement: { confidence: -6, excitement: -4, frustration: 8, trust: -2 }, coordination: { confidence: 4, excitement: 4, trust: 7, frustration: -4 },
  };
  const delta = changes[kind]; const scale = kind === 'death' || kind === 'teamfight_loss' || kind === 'objective_loss' ? sensitivity : 1 / Math.max(.55, sensitivity);
  const mood = { ...state.mood };
  (Object.keys(delta) as (keyof PlayerMood)[]).forEach(key => mood[key] = clamp(mood[key] + (delta[key] ?? 0) * scale));
  return { ...state, mood, recentWins: /win|kill|multikill|rescue|comeback|wipe|steal|defense|coordination/.test(kind) ? state.recentWins + 1 : 0, recentLosses: /loss|death|siege|engagement/.test(kind) ? state.recentLosses + 1 : 0, processedEventIds: [...state.processedEventIds.slice(-31), eventId] };
}

export function applyTeamPsychologyEvent(players: { id: string; player: PlayerCard; psychology?: PlayerPsychologyState; relationships?: Record<string, TeammateRelationship>; isAlive?: boolean }[], eventId: string, kind: PsychologyEvent, leadershipOutcome?: 'success' | 'failure') {
  const iglId = leadershipOutcome ? selectIgl(players) : undefined;
  players.forEach(player => {
    player.psychology = applyMoodEvent(ensurePsychology(player.player, player.psychology), eventId, kind, personalityOf(player.player));
    Object.entries(player.relationships ?? {}).forEach(([teammateId, relationship]) => {
      if (kind === 'coordination' || kind === 'comeback' || kind === 'teamfight_win' || kind === 'team_wipe' || kind === 'defense') {
        relationship.trust = clamp(relationship.trust + 2); relationship.cooperation = clamp(relationship.cooperation + 2);
      } else if (kind === 'teamfight_loss' || kind === 'failed_siege' || kind === 'failed_engagement') {
        relationship.cooperation = clamp(relationship.cooperation - 1);
      }
      if (teammateId === iglId) relationship.leadershipRespect = clamp(relationship.leadershipRespect + (leadershipOutcome === 'success' ? 3 : -2));
    });
  });
}
export function decayMood(state: PlayerPsychologyState, traits: PersonalityId[], seconds: number): PlayerPsychologyState {
  const stable = traits.some(id => id === 'untiltable' || id === 'cold_as_ice') ? 1.45 : 1;
  const rate = Math.min(1, seconds * .018 * stable); const base = defaultMood(); const mood = { ...state.mood };
  (Object.keys(base) as (keyof PlayerMood)[]).forEach(key => mood[key] = clamp(mood[key] + (base[key] - mood[key]) * rate));
  return { ...state, mood };
}
export function personalityDecisionBreakdown(player: PlayerCard, state: PlayerPsychologyState, action: PersonalityAction, team?: TeamPsychology, context: PersonalityDecisionContext = {}) {
  const traits = personalityOf(player); const preferences = traits.reduce((sum, id) => sum + (PERSONALITIES[id].preferences[action] ?? 0), 0);
  const { confidence, excitement, frustration, composure, trust } = state.mood;
  const risk = (confidence - 50 + excitement - frustration * (composure / 100)) / 28;
  const aggressive = action === 'engage' || action === 'chase' || action === 'objective' || action === 'siege';
  const mood = aggressive ? risk : action === 'retreat' || action === 'regroup' ? -risk * .7 : 0;
  const coordination = team ? ((action === 'regroup' || action === 'peel' ? team.cohesion - 50 : 0) + (team.mentalities.includes('DIVIDED') ? -trust / 32 : 0)) / 12 : 0;
  const combinations = personalityCombinationInfluences(player, state, action, context);
  const combinationDelta = combinations.reduce((sum, influence) => sum + influence.delta, 0);
  return { personalityDelta: preferences, moodDelta: mood, coordinationDelta: coordination, combinationDelta, combinations,
    total: preferences + mood + coordination + combinationDelta };
}
export function personalityActionDelta(player: PlayerCard, state: PlayerPsychologyState, action: PersonalityAction, team?: TeamPsychology, context?: PersonalityDecisionContext): number {
  return personalityDecisionBreakdown(player, state, action, team, context).total;
}
export function selectIgl(players: { id: string; player: PlayerCard; psychology?: PlayerPsychologyState; isAlive?: boolean }[]): string | undefined {
  return players.filter(p => p.isAlive !== false).sort((a, b) => {
    const score = (p: typeof a) => personalityOf(p.player).reduce((s, id) => s + PERSONALITIES[id].leadership * 15, p.player.stats.iq) + (p.psychology?.mood.trust ?? 60) * .2;
    return score(b) - score(a) || a.id.localeCompare(b.id);
  })[0]?.id;
}
export function deriveTeamPsychology(players: { id: string; player: PlayerCard; psychology?: PlayerPsychologyState; relationships?: Record<string, TeammateRelationship>; isAlive?: boolean }[]): TeamPsychology {
  const active = players.filter(p => p.isAlive !== false); const iglId = selectIgl(active); const weight = (p: typeof active[number]) => personalityOf(p.player).some(id => id === 'igl' || id === 'captain') ? 1.5 : 1;
  const weighted = (fn: (p: typeof active[number]) => number) => active.reduce((sum, p) => sum + fn(p) * weight(p), 0) / Math.max(1, active.reduce((sum,p) => sum + weight(p),0));
  const hasStabilizer = active.some(p => personalityOf(p.player).some(id => id === 'captain' || id === 'glue_guy'));
  const hasComposedIgl = active.some(p => hasPersonalityCombination(p.player, 'igl', 'untiltable'));
  const recentTeamLosses = active.reduce((sum, p) => sum + (p.psychology?.recentLosses ?? 0), 0) / Math.max(1, active.length);
  const recoveryBonus = recentTeamLosses >= 2 ? (hasStabilizer ? 4 : 0) + (hasComposedIgl ? 3 : 0) : 0;
  const morale = weighted(p => (p.psychology?.mood.confidence ?? 50) - (p.psychology?.mood.frustration ?? 10) * .35 + (p.psychology?.mood.composure ?? 70) * .25) + recoveryBonus;
  const momentum = weighted(p => (p.psychology?.recentWins ?? 0) * 12 - (p.psychology?.recentLosses ?? 0) * 12 + (p.psychology?.mood.excitement ?? 30) * .25);
  const cohesion = weighted(p => (p.psychology?.mood.trust ?? 60)) + weighted(p => Object.values(p.relationships ?? {}).reduce((s,r) => s + r.cooperation, 0) / Math.max(1,Object.keys(p.relationships ?? {}).length)) * .2 + (hasStabilizer && recentTeamLosses >= 2 ? 3 : 0);
  const leadershipAuthority = iglId ? weighted(p => p.id === iglId ? (p.psychology?.mood.trust ?? 60) : p.relationships?.[iglId]?.leadershipRespect ?? 55) : 0;
  const mentalities = [morale >= 72 ? 'CONFIDENT' : '', momentum >= 32 && morale >= 64 ? 'OVERHYPED' : '', cohesion >= 72 ? 'DISCIPLINED' : '', morale < 42 ? 'SHAKEN' : '', weighted(p => p.psychology?.mood.frustration ?? 10) > 62 ? 'TILTED' : '', cohesion < 45 ? 'DIVIDED' : '', morale < 50 && momentum < -20 ? 'DESPERATE' : '', momentum > 16 && morale > 52 ? 'RALLYING' : ''].filter(Boolean);
  return { morale: clamp(morale), momentum: clamp(momentum + 50), cohesion: clamp(cohesion), leadershipAuthority: clamp(leadershipAuthority), mentalities, iglId };
}
