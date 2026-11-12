import type { PlayerCard } from '../types.ts';
import { personalityOf, type PersonalityId } from '../playerPersonality.ts';
import type { FpsPlayerState } from './fpsTypes.ts';

export const FPS_ATTRIBUTE_LABELS = {
  lan: 'Aim & mechanics', tf: 'Trading & coordination', iq: 'Game sense',
  ldr: 'Shotcalling', clu: 'Clutch', sta: 'Stamina', flx: 'Weapon flexibility',
};

export interface FpsPreferences {
  aggression: number;
  coordination: number;
  patience: number;
  utility: number;
  conservation: number;
  leadership: number;
}

export type PersonalityCategory = 'leadership' | 'aggression' | 'tactical' | 'mentality' | 'economy';

export interface FpsPersonalityDefinition {
  id: PersonalityId;
  category: PersonalityCategory;
  name: string;
  description: string;
  tradeoff: string;
  preferences: Partial<FpsPreferences>;
}

// FPS interpretations preserve the underlying stable identity keys.
const FPS_PERSONALITY_BASE: Record<PersonalityId, Omit<FpsPersonalityDefinition, 'id'|'category'>> = {
  igl: { name: 'IGL / Shotcaller', description: 'Prefers coordinated site calls and prepared utility.', tradeoff: 'Can persist with a committed plan.', preferences: { coordination: .8, utility: .6, leadership: 1 } },
  captain: { name: 'Captain', description: 'Keeps the team together and helps teammates recover after lost rounds.', tradeoff: 'Favors preparation over immediate pressure.', preferences: { coordination: 1, patience: .5, leadership: .8 } },
  challenger: { name: 'Challenger', description: 'Questions marginal pushes and favors a measured default.', tradeoff: 'Can delay a decisive entry.', preferences: { patience: .8, conservation: .4, aggression: -.4, leadership: .3 } },
  loyalist: { name: 'Loyalist', description: 'Stays close to the called execute and follows up the entry.', tradeoff: 'May follow an imperfect call.', preferences: { coordination: 1, utility: .3 } },
  glue_guy: { name: 'Glue Guy', description: 'Supports trades and steadies teammates after setbacks.', tradeoff: 'Less inclined to initiate alone.', preferences: { coordination: 1, utility: .6, aggression: -.3 } },
  silent_operator: { name: 'Silent Operator', description: 'Prefers patient individual preparation to leading the group.', tradeoff: 'Less likely to become the caller.', preferences: { patience: .7, leadership: -.7, coordination: -.3 } },
  untiltable: { name: 'Untiltable', description: 'Keeps tactical preferences steady through losing streaks.', tradeoff: 'Less urgency from momentum.', preferences: { patience: .4, coordination: .3 } },
  cold_as_ice: { name: 'Cold as Ice', description: 'Holds a measured approach through wins and losses.', tradeoff: 'May pass on a fast opening.', preferences: { patience: .8, aggression: -.2, conservation: .3 } },
  short_fuse: { name: 'Short Fuse', description: 'Lost rounds increase the urge to force an opening duel.', tradeoff: 'Can rush before the team is ready.', preferences: { aggression: 1, patience: -.7, coordination: -.4 } },
  fragile_mental: { name: 'Fragile Mental', description: 'Setbacks encourage slower calls and equipment preservation.', tradeoff: 'Can become too hesitant after losses.', preferences: { aggression: -.6, conservation: .8, patience: .5 } },
  iron_will: { name: 'Iron Will', description: 'Continues seeking a coordinated comeback after lost rounds.', tradeoff: 'Less inclined to preserve equipment.', preferences: { aggression: .3, coordination: .4, conservation: -.5 } },
  clutch_performer: { name: 'Clutch Performer', description: 'Prefers patient preparation and remains composed after setbacks.', tradeoff: 'Personality alone does not improve clutch aim.', preferences: { patience: .6, conservation: -.2 } },
  overconfident: { name: 'Overconfident', description: 'Winning streaks encourage faster entries.', tradeoff: 'Can pressure before utility is ready.', preferences: { aggression: .8, patience: -.5, conservation: -.4 } },
  egoistic: { name: 'Solo Carry', description: 'Prefers being the first point of contact over supporting a trade.', tradeoff: 'Less willing to follow a support assignment.', preferences: { aggression: .6, coordination: -.8, utility: -.4 } },
  momentum_junkie: { name: 'Momentum Junkie', description: 'Speeds up after wins and slows down after repeated losses.', tradeoff: 'Call preferences fluctuate with results.', preferences: { aggression: .5, patience: -.3 } },
  revenge_driven: { name: 'Revenge Driven', description: 'Being eliminated increases the urge to take the next opening.', tradeoff: 'Can abandon patient preparation.', preferences: { aggression: .6, patience: -.4, coordination: -.2 } },
  showman: { name: 'Showman', description: 'Prefers an assertive breach to a quiet support assignment.', tradeoff: 'Can favor pressure over conservation.', preferences: { aggression: .6, conservation: -.6, utility: -.2 } },
  perfectionist: { name: 'Perfectionist', description: 'Prefers layered utility and a prepared site execute.', tradeoff: 'Can delay a fast opening.', preferences: { patience: .8, utility: .9, coordination: .5 } },
  first_blood_hunter: { name: 'First Blood Hunter', description: 'Volunteers for the opening duel in each round.', tradeoff: 'Less inclined to carry support utility.', preferences: { aggression: 1, patience: -.5, utility: -.3 } },
  counterpuncher: { name: 'Counterpuncher', description: 'Prefers a measured default and close trade follow-up.', tradeoff: 'Less likely to lead a rush.', preferences: { patience: .7, coordination: .5, aggression: -.3 } },
  limit_tester: { name: 'Limit Tester', description: 'Favors difficult entries, especially when frustrated.', tradeoff: 'Can push without full preparation.', preferences: { aggression: .8, patience: -.6, conservation: -.5 } },
  bodyguard: { name: 'Bodyguard', description: 'Favors close trades and utility support for the entry.', tradeoff: 'Often leaves the opening duel to a teammate.', preferences: { coordination: 1, utility: .7, aggression: -.5 } },
  patient_predator: { name: 'Patient Predator', description: 'Prefers patient preparation and precision weapons when affordable.', tradeoff: 'Less willing to lead a fast breach.', preferences: { patience: 1, aggression: -.2, coordination: -.2 } },
  tunnel_vision: { name: 'Tunnel Vision', description: 'Favors committed pressure over regrouping.', tradeoff: 'Less suited to utility support.', preferences: { aggression: .5, patience: -.5, utility: -.4 } },
  objective_zealot: { name: 'Device Specialist', description: 'Prioritizes utility preparation around the plant and defuse.', tradeoff: 'Less inclined to save during a retake.', preferences: { utility: .9, coordination: .6, conservation: -.5 } },
  steal_gambler: { name: 'Retake Gambler', description: 'Prefers another retake attempt over saving a weapon.', tradeoff: 'Risks equipment in poor numerical situations.', preferences: { conservation: -1, aggression: .4, utility: .3 } },
  siege_closer: { name: 'Round Closer', description: 'Prefers committed site pressure and prepared utility.', tradeoff: 'Less inclined to disengage and save.', preferences: { aggression: .4, utility: .5, conservation: -.5 } },
  wave_architect: { name: 'Execute Architect', description: 'Prepares smoke and flash layers before the breach.', tradeoff: 'Favors setup over immediate contact.', preferences: { utility: 1, patience: .7, coordination: .5 } },
  bush_stalker: { name: 'Angle Stalker', description: 'Prefers patient angle preparation over leading a group rush.', tradeoff: 'Less suited to close trade follow-up.', preferences: { patience: .9, coordination: -.5, aggression: -.1 } },
  survivalist: { name: 'Survivalist', description: 'Favors equipment preservation when a retake is heavily outnumbered.', tradeoff: 'Can give up a recoverable round.', preferences: { conservation: 1, aggression: -.7, patience: .5 } },
};

export const FPS_PERSONALITY_CATEGORIES: Record<PersonalityCategory,string> = {
  leadership:'Leadership & teamplay', aggression:'Aggression & openings', tactical:'Tactics & preparation',
  mentality:'Mentality & momentum', economy:'Economy & round decisions',
};
const taxonomy: Record<PersonalityCategory, PersonalityId[]> = {
  leadership:['igl','captain','loyalist','glue_guy','bodyguard'],
  aggression:['first_blood_hunter','egoistic','showman','limit_tester','tunnel_vision'],
  tactical:['wave_architect','perfectionist','patient_predator','bush_stalker','counterpuncher','challenger'],
  mentality:['untiltable','cold_as_ice','clutch_performer','iron_will','short_fuse','fragile_mental','overconfident','momentum_junkie','revenge_driven','silent_operator'],
  economy:['objective_zealot','steal_gambler','siege_closer','survivalist'],
};
const displayNames: Partial<Record<PersonalityId,string>> = {
  igl:'Tactical Caller', captain:'Morale Captain', loyalist:'System Loyalist', bodyguard:'Wingman',
  showman:'Playmaker', tunnel_vision:'Committed Rusher', perfectionist:'Methodical Planner',
  patient_predator:'Patient Hunter', bush_stalker:'Flank Watcher', challenger:'Careful Challenger',
  untiltable:'Stoic', cold_as_ice:'Ice Veins', clutch_performer:'Clutch Specialist', iron_will:'Comeback Fighter',
  short_fuse:'Hotheaded', fragile_mental:'Confidence Player', overconfident:'Frontrunner',
  momentum_junkie:'Streak Player', revenge_driven:'Ego Challenger', silent_operator:'Quiet Operator',
};
export const FPS_PERSONALITIES = Object.fromEntries(Object.entries(FPS_PERSONALITY_BASE).map(([key,trait]) => {
  const id=key as PersonalityId;
  const category=(Object.keys(taxonomy) as PersonalityCategory[]).find(group=>taxonomy[group].includes(id))!;
  return [id,{...trait,id,category,name:displayNames[id]??trait.name}];
})) as Record<PersonalityId,FpsPersonalityDefinition>;

export type FpsTacticalRole = import('./fpsIdentity.ts').FpsPrimaryRole;
export const FPS_ROLE_LABELS: Record<FpsTacticalRole, string> = {
  entry: 'Entry Fragger', trade: 'Trade Fragger', support: 'Utility support', anchor: 'Site anchor',
  caller:'Shotcaller', sniper:'Sniper', lurker:'Lurker',
};

export interface FpsPsychology {
  confidence: number;
  composure: number;
  frustration: number;
  winStreak: number;
  lossStreak: number;
  lastRound: number;
}

export interface FpsRoundTactics {
  role: FpsTacticalRole;
  isCaller: boolean;
  traits: PersonalityId[];
  mood: FpsPsychology;
  preferences: FpsPreferences;
  reason: string;
  identity?: {personality:string;specialty?:string;intensity:string};
}

const bounded = (n: number, min = -1, max = 1) => Math.max(min, Math.min(max, n));
export const initialFpsPsychology = (): FpsPsychology => ({
  confidence: 50, composure: 70, frustration: 10, winStreak: 0, lossStreak: 0, lastRound: 0,
});

export function getFpsPreferences(card: PlayerCard, mood = initialFpsPsychology()): FpsPreferences {
  const traits = personalityOf(card);
  const has = (id: PersonalityId) => traits.includes(id);
  const result: FpsPreferences = { aggression: 0, coordination: 0, patience: 0, utility: 0, conservation: 0, leadership: 0 };
  for (const key of Object.keys(result) as (keyof FpsPreferences)[]) {
    result[key] = traits.reduce((sum, id) => sum + (FPS_PERSONALITIES[id].preferences[key] ?? 0), 0) / traits.length;
  }
  const frustration = Math.max(0, mood.frustration - 30) / 70;
  if (has('short_fuse') || has('limit_tester') || has('revenge_driven')) result.aggression += frustration * .35;
  if (has('fragile_mental')) { result.aggression -= frustration * .35; result.conservation += frustration * .25; }
  if (has('overconfident')) result.aggression += Math.min(3, mood.winStreak) * .06;
  if (has('momentum_junkie')) result.aggression += bounded((mood.winStreak - mood.lossStreak) * .08, -.24, .24);
  // Conditional pair effects resolve conflicting impulses without changing skills.
  if (has('survivalist') && has('overconfident') && mood.lossStreak >= 2) { result.aggression -= .2; result.conservation += .2; }
  if (has('bodyguard') && has('loyalist')) result.utility += .15;
  if (has('igl') && has('untiltable') && mood.lossStreak >= 2) { result.coordination += .15; result.patience += .1; }
  for (const key of Object.keys(result) as (keyof FpsPreferences)[]) result[key] = bounded(result[key]);
  return result;
}

/** Match-local feedback; repeated processing of the same round is a no-op. */
export function updateFpsPsychology(player: FpsPlayerState, won: boolean, roundNumber: number, teammates: FpsPlayerState[]): void {
  const mood = player.psychology ?? initialFpsPsychology();
  if (roundNumber <= mood.lastRound) return;
  const traits = personalityOf(player.card);
  const stable = traits.some(id => ['untiltable', 'cold_as_ice', 'clutch_performer', 'iron_will'].includes(id));
  const volatile = traits.some(id => ['short_fuse', 'fragile_mental', 'momentum_junkie'].includes(id));
  const stabilizer = teammates.some(p => p.playerId !== player.playerId && personalityOf(p.card).some(id => id === 'captain' || id === 'glue_guy'));
  const sensitivity = stable ? .45 : volatile ? 1.4 : 1;
  const recovery = 2 + player.card.stats.sta / 50 + (stabilizer ? 3 : 0);
  player.psychology = {
    confidence: bounded(mood.confidence + (won ? 5 : -5) * sensitivity, 0, 100),
    composure: bounded(mood.composure + recovery - (won ? 0 : 5 * sensitivity), 0, 100),
    frustration: bounded(mood.frustration + (won ? -8 : (player.isAlive ? 7 : 11) * sensitivity) - recovery, 0, 100),
    winStreak: won ? Math.min(5, mood.winStreak + 1) : 0,
    lossStreak: won ? 0 : Math.min(5, mood.lossStreak + 1),
    lastRound: roundNumber,
  };
}

/** Contextual v3 mood uses continuous DNA, not legacy badge names. */
export function updateContextualFpsPsychology(player: FpsPlayerState, won: boolean, roundNumber: number, dna: import('./fpsIdentity.ts').FpsPlayerDNA, trust: number): void {
  const mood=player.psychology ?? initialFpsPsychology();
  if (roundNumber<=mood.lastRound) return;
  const sensitivity=.5+dna.confidenceVolatility/100;
  const recovery=1.5+dna.emotionalStability/50+Math.max(0,Math.min(1,trust))*1.5;
  player.psychology={
    confidence:bounded(mood.confidence+(won?5:-5)*sensitivity,0,100),
    composure:bounded(mood.composure+recovery-(won?0:5*sensitivity),0,100),
    frustration:bounded(mood.frustration+(won?-8:(player.isAlive?7:11)*sensitivity)-recovery,0,100),
    winStreak:won?Math.min(5,mood.winStreak+1):0,
    lossStreak:won?0:Math.min(5,mood.lossStreak+1),lastRound:roundNumber,
  };
}

export function fpsRoleScore(player: FpsPlayerState, role: FpsTacticalRole | 'caller'): number {
  const prefs = getFpsPreferences(player.card, player.psychology);
  const { lan, tf, iq, ldr = 50 } = player.card.stats;
  // At most six points of preference: actual skills remain the main selection input.
  if (role === 'caller') return iq * .55 + ldr * .45 + prefs.leadership * 6;
  if (role === 'entry') return lan * .8 + tf * .2 + prefs.aggression * 6;
  if (role === 'trade') return tf * .8 + lan * .2 + prefs.coordination * 6;
  if (role === 'anchor') return iq * .5 + lan * .5 + prefs.patience * 6;
  return iq * .65 + tf * .35 + prefs.utility * 6;
}

export function rankFpsPlayers(players: FpsPlayerState[], role: FpsTacticalRole | 'caller'): FpsPlayerState[] {
  return [...players].sort((a, b) => fpsRoleScore(b, role) - fpsRoleScore(a, role) || a.playerId.localeCompare(b.playerId));
}

export function assignFpsTeamRoles(players: FpsPlayerState[], contextual = false): void {
  const living = players.filter(p => p.isAlive);
  const ranked=(group:FpsPlayerState[], role:FpsTacticalRole|'caller') => contextual ? [...group].sort((a,b)=>{
    const raw=(p:FpsPlayerState)=>{const {lan,tf,iq,ldr=50}=p.card.stats; return role==='caller'?iq*.55+ldr*.45:role==='entry'?lan*.8+tf*.2:role==='trade'?tf*.8+lan*.2:role==='anchor'?iq*.5+lan*.5:iq*.65+tf*.35;};
    return raw(b)-raw(a)||a.playerId.localeCompare(b.playerId);
  }) : rankFpsPlayers(group,role);
  const caller = ranked(living, 'caller')[0];
  const firstRole = living[0]?.side === 'defenders' ? 'anchor' : 'entry';
  const first = ranked(living, firstRole)[0];
  const trades = ranked(living.filter(p => p !== first), 'trade').slice(0, 2);
  for (const player of living) {
    const role = player === first ? firstRole : trades.includes(player) ? 'trade' : 'support';
    const traits = personalityOf(player.card);
    const mood = player.psychology ?? initialFpsPsychology();
    const streak = mood.lossStreak >= 2 ? 'Reassessing after consecutive lost rounds.' : mood.winStreak >= 2 ? 'Playing through a winning streak.' : 'Fresh round assessment.';
    player.tactics = {
      role, isCaller: player === caller, traits: [...traits], mood: { ...mood },
      preferences: getFpsPreferences(player.card, mood),
      reason: `${FPS_ROLE_LABELS[role]} selected from ${contextual?'skills':'skills and bounded preferences'}. ${streak}`,
    };
  }
}

/** Equipment saving is possible only with a gun and a severe numerical deficit. */
export function shouldSaveFpsRetake(defenders: FpsPlayerState[], attackers: FpsPlayerState[]): boolean {
  const living = defenders.filter(p => p.isAlive);
  const enemies = attackers.filter(p => p.isAlive);
  if (!living.length || living.length > 2 || enemies.length - living.length < 2 || !living.some(p => p.loadout.primaryWeapon)) return false;
  const conservation = living.reduce((sum, p) => sum + getFpsPreferences(p.card, p.psychology).conservation, 0) / living.length;
  return conservation >= .25;
}
