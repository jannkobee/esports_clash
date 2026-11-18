/**
 * Round responsibilities ("duties"): who does which job *this round*, separate from the
 * manager-assigned roster position.
 *
 * - The roster position (T_ENTRY, CT_ANCHOR_A, ...) is permanent for the match and is the
 *   strongest single prior, but it is not the answer by itself.
 * - Each duty holder is chosen for the whole team at once (one entry, one support, at most one
 *   lurker, an anchor per covered site), so two players never both take the same job while
 *   another job is left empty.
 * - Inputs are lawful team knowledge only: teammates' positions, health, weapons and utility
 *   (radar/HUD), the side's own plan, personalities and tendencies. Nothing reads opponents.
 * - Attributes enter only through the acting caller's leadership tendencies (strength
 *   exploitation / weakness protection): a caller knows the players. They never decide whether a
 *   player is *allowed* a duty, and they never change how well the duty is executed.
 * - Pure and deterministic: no random stream is consumed, so seeded replays are unchanged by
 *   when the allocator runs.
 */
import type { FpsBehaviorPreferences, FpsPosition } from './fpsPlayerArchitecture.ts';

export type FpsRoundDuty = 'entry' | 'trade' | 'support' | 'lurker' | 'anchor' | 'sniper';
export const FPS_ROUND_DUTIES: readonly FpsRoundDuty[] = ['entry', 'trade', 'support', 'lurker', 'anchor', 'sniper'];
export const FPS_ROUND_DUTY_LABELS: Record<FpsRoundDuty, string> = {
  entry: 'First contact', trade: 'Trade', support: 'Utility support', lurker: 'Lurk', anchor: 'Anchor', sniper: 'AWP',
};
export const FPS_ROUND_DUTY_TAGS: Record<FpsRoundDuty, string> = {
  entry: 'ENTRY', trade: 'TRADE', support: 'SUPPORT', lurker: 'LURK', anchor: 'ANCHOR', sniper: 'AWP',
};
export type FpsDutyWeapon = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol' | 'heavy';
export type FpsDutyPhase = 'opening' | 'execute' | 'post-plant' | 'retake';
export type FpsAttributeUnits = { rifling: number; sniping: number; entry: number; utility: number; positioning: number; shotcalling: number };

export interface FpsDutyCandidate {
  id: string; slot: number; position: FpsPosition; isIgl: boolean;
  hp: number; weapon: FpsDutyWeapon; bomb: boolean;
  /** Carried grenades. */
  smoke: number; flash: number; incendiary: number; he: number;
  /** Metres to this side's current objective lane (T: target-site entries, CT: own home site). Undefined when unknown. */
  travel?: number;
  /** CT home site. Anchors are elected per home site. */
  home?: 'A' | 'B';
  /** Six attributes as 0..1 units; read only through the caller's leadership tendencies. */
  attributes: FpsAttributeUnits;
  /** Effective 0..1 individual tendency. */
  tendency: (key: string) => number;
  preferences: FpsBehaviorPreferences;
  instruction?: 'balanced' | 'hold' | 'initiative' | 'support';
  /** Duty held right now (continuity): changing jobs mid-round has a cost. */
  current?: FpsRoundDuty;
}
export interface FpsDutyContext {
  side: 't' | 'ct';
  phase: FpsDutyPhase;
  /** Acting caller's effective 0..1 tendency, or undefined when nobody is directing the team. */
  leader?: (key: string) => number;
  /** The leader is the designated IGL (a secondary voice directs with less authority). */
  leaderIsIgl?: boolean;
  /** Gameplan structure / coach rigidity blend, 0..1: how firmly roster positions anchor round jobs. */
  structure: number;
  /** Gameplan / coach freedom, 0..1: how much a player's own preferences count. */
  freedom: number;
}
export interface FpsDutyAssignment {
  id: string; duty: FpsRoundDuty; score: number;
  /** Short, broadcast-safe reason for the assignment. */
  reason: string;
  /** CT coverage redistribution: this defender now covers another site. */
  home?: 'A' | 'B';
}

const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const mean = (values: readonly number[]) => values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
const ATTRIBUTE_FOR: Record<FpsRoundDuty, keyof FpsAttributeUnits> = {
  entry: 'entry', trade: 'rifling', support: 'utility', lurker: 'positioning', anchor: 'positioning', sniper: 'sniping',
};
/** How naturally each roster position fits each round job (sniper is weapon-driven, not positional). */
const POSITION_PRIOR: Record<FpsPosition, Partial<Record<FpsRoundDuty, number>>> = {
  T_ENTRY: { entry: 1, trade: .45, support: .1, lurker: 0 },
  T_SUPPORT: { support: 1, trade: .55, entry: .15, lurker: 0 },
  T_FLEX: { trade: 1, entry: .5, support: .45, lurker: .1 },
  T_LURKER: { lurker: 1, trade: .35, entry: .15, support: .2 },
  T_IGL: { trade: .75, support: .6, entry: .25, lurker: .1 },
  CT_ANCHOR_A: { anchor: 1, trade: .3, support: .2 },
  CT_ANCHOR_B: { anchor: 1, trade: .3, support: .2 },
  CT_ROTATOR: { trade: 1, anchor: .35, support: .3 },
  CT_FLEX: { trade: 1, anchor: .45, support: .3 },
  CT_IGL: { trade: .8, anchor: .55, support: .5 },
};
const SELF_KEYS: Record<FpsRoundDuty, readonly string[]> = {
  entry: ['sacrificialEntry', 'spaceCreation', 'duelInitiative', 'earlyAggression'],
  trade: ['tradePriority', 'teammateCover', 'packSpacing', 'synchronizedPeek'],
  support: ['supportFlash', 'supportInitiative', 'utilitySharing', 'utilityCombination'],
  lurker: ['lurkFlank', 'soloInitiative', 'positionConcealment', 'timingExploitation'],
  anchor: ['anchorPersistence', 'crossfirePreference', 'positionConcealment', 'playDiscipline'],
  sniper: ['openingPick', 'scopePersistence'],
};

export function fpsDutyUtilityValue(c: Pick<FpsDutyCandidate, 'smoke' | 'flash' | 'incendiary' | 'he'>): number {
  return c.smoke + c.flash * .8 + c.incendiary * .8 + c.he * .4;
}

interface DutyTerms { prior: number; self: number; fit: number; spawn: number; state: number; lead: number; continuity: number }
const sumTerms = (t: DutyTerms) => t.prior + t.self + t.fit + t.spawn + t.state + t.lead + t.continuity;

/** Per-candidate, per-duty score with its named terms (the terms drive the stated reason). */
export function scoreFpsDuty(c: FpsDutyCandidate, duty: FpsRoundDuty, team: readonly FpsDutyCandidate[], context: FpsDutyContext): DutyTerms | undefined {
  if (duty === 'sniper' && c.weapon !== 'sniper') return undefined;
  if (duty === 'anchor' && context.side !== 'ct') return undefined;
  if (duty === 'lurker' && context.side !== 't') return undefined;
  if (duty === 'entry' && context.side !== 't') return undefined;
  const lead = context.leader ?? (() => .5);
  const authority = context.leader ? (context.leaderIsIgl === false ? .55 : 1) : 0;
  const roleFlex = lead('roleFlexibility');
  // Structured callers hold players to their rehearsed jobs; flexible ones re-cast by situation.
  // Micromanagement narrows (never erases) a player's own preference: the floor keeps it alive.
  const wPos = clamp(.55 + context.structure * .8 + ((lead('structuredCalling') - .5) * .5 - (roleFlex - .5) * .7) * authority, .35, 1.5);
  const wSelf = Math.max(.35, .45 + context.freedom * .45 + ((lead('individualPlayAllowance') - .5) * .4 - (lead('micromanagement') - .5) * .3) * authority);
  const wSituation = .6 + roleFlex * .8 * Math.max(.5, authority);
  const prior = (POSITION_PRIOR[c.position][duty] ?? 0) * wPos * 1.6;
  const prefs = c.preferences;
  let self = (mean(SELF_KEYS[duty].map(c.tendency)) - .5) * 1.4;
  if (duty === 'entry') self += (prefs.initiative - .5) * .6 + (c.instruction === 'initiative' ? .25 : c.instruction === 'hold' ? -.2 : 0);
  if (duty === 'trade') self += (prefs.coordination - .5) * .5;
  if (duty === 'support') self += (prefs.coordination - .5) * .4 + (c.instruction === 'support' ? .25 : 0);
  if (duty === 'lurker') self += (.5 - prefs.coordination) * .5;
  if (duty === 'anchor') self += (.5 - prefs.initiative) * .4 + (c.instruction === 'hold' ? .2 : 0);
  self *= wSelf;
  // The caller's knowledge of strengths and weaknesses (leadership, not capability gating).
  const attr = ATTRIBUTE_FOR[duty], teamMean = mean(team.map(t => t.attributes[attr]));
  let fit = (c.attributes[attr] - teamMean) * 1.6 * (lead('strengthExploitation') - .2) * authority;
  if ((duty === 'entry' || duty === 'anchor') && c.attributes[attr] < .35) fit -= (.35 - c.attributes[attr]) * 2 * lead('weaknessProtection') * authority;
  // Spawn / position: who is actually closest to the lane takes first contact (or anchors it).
  let spawn = 0;
  const travels = team.map(t => t.travel).filter((v): v is number => v !== undefined && Number.isFinite(v));
  if (c.travel !== undefined && Number.isFinite(c.travel) && travels.length > 1 && (duty === 'entry' || duty === 'anchor')) {
    const behind = c.travel - Math.min(...travels);
    spawn = -Math.min(1.6, behind / 11) * (.45 + (context.leader ? lead('spawnExploitation') * .8 : .3)) * wSituation;
  }
  // Physical feasibility: health, weapon, grenades and the device.
  let state = 0;
  const util = fpsDutyUtilityValue(c);
  if (duty === 'entry') {
    // A hurt entry hands first contact over (around 30 HP on a neutral team; earlier on a flexible one).
    if (c.hp < 60) state -= (60 - c.hp) / 12 * wSituation;
    state += c.weapon === 'sniper' ? -1.5 : c.weapon === 'shotgun' || c.weapon === 'smg' ? .15 : c.weapon === 'pistol' ? -.15 : 0;
    if (c.bomb) state -= 3; // first contact with the device usually loses it
  } else if (duty === 'trade') {
    if (c.hp < 35) state -= .35;
    if (c.weapon === 'sniper') state -= .8;
  } else if (duty === 'support') {
    state += util <= 0 ? -1.4 : Math.min(1.2, util * .35) + Math.min(.4, c.flash * .2);
    if (c.bomb) state -= .45;
  } else if (duty === 'lurker') {
    if (c.bomb) state -= .7;
    if (c.hp < 40) state -= .3;
  } else if (duty === 'anchor') {
    if (c.hp < 40) state -= .45;
    if (c.weapon === 'sniper') state += .1;
  } else if (duty === 'sniper') state += 2.4;
  // Leadership expression: fragging IGLs lead from the front, delegating IGLs hand utility out,
  // lurk trust keeps (or pulls in) the lurker, star utilization frees the star from utility dumps.
  let leadTerm = 0;
  if (c.isIgl) {
    const front = c.tendency('leadFromFront');
    if (duty === 'entry') leadTerm += (front - .5) * 1.4;
    if (duty === 'trade') leadTerm += (front - .5) * .3;
    if (duty === 'support') leadTerm += (.5 - front) * .5 + (.5 - c.tendency('utilityDelegation')) * .8;
  }
  if (context.leader && duty === 'lurker' && c.position === 'T_LURKER') leadTerm += (lead('lurkTrust') - .5) * 1.2 * authority;
  if (context.leader && authority > 0) {
    const starScore = (t: FpsDutyCandidate) => t.attributes.rifling + t.attributes.entry + t.attributes.sniping * .5;
    const star = [...team].sort((a, b) => starScore(b) - starScore(a) || a.slot - b.slot)[0];
    if (star?.id === c.id && team.length >= 3) {
      const use = lead('starUtilization') - .5;
      if (duty === 'support') leadTerm -= use * 1.1;
      if (duty === 'trade' || duty === 'entry' || duty === 'sniper') leadTerm += use * .45;
    }
    if (duty === 'support' && !c.isIgl) leadTerm += (lead('utilityDelegation') - .5) * .3;
  }
  const continuity = c.current === duty ? .4 : 0;
  return { prior, self, fit, spawn, state, lead: leadTerm, continuity };
}

/** The set of round jobs this team needs right now (one slot per living player). */
function dutySlots(team: readonly FpsDutyCandidate[], context: FpsDutyContext): { duty: FpsRoundDuty; site?: 'A' | 'B'; optional?: boolean }[] {
  const n = team.length, snipers = Math.min(team.filter(c => c.weapon === 'sniper').length, Math.max(0, n - 1), 2);
  const slots: { duty: FpsRoundDuty; site?: 'A' | 'B'; optional?: boolean }[] = [];
  if (context.side === 't') {
    const lurkerAlive = team.some(c => c.position === 'T_LURKER');
    const lurk = context.phase !== 'execute' || lurkerAlive;
    if (context.phase !== 'post-plant' && n >= 2) slots.push({ duty: 'entry' });
    if (n >= 3 && team.some(c => fpsDutyUtilityValue(c) > 0)) slots.push({ duty: 'support' });
    if (lurk && (n >= 4 || (n === 3 && lurkerAlive && (context.leader?.('lurkTrust') ?? .5) > .55)) || context.phase === 'post-plant' && n >= 3 && lurkerAlive)
      slots.push({ duty: 'lurker', optional: true });
  } else if (context.phase !== 'retake') {
    for (const site of ['A', 'B'] as const) if (team.some(c => c.home === site) && slots.length < n) slots.push({ duty: 'anchor', site });
  } else if (n >= 3 && team.some(c => fpsDutyUtilityValue(c) >= 1.5)) slots.push({ duty: 'support' });
  for (let i = 0; i < snipers && slots.length < n; i++) slots.push({ duty: 'sniper' });
  while (slots.length < n) slots.push({ duty: 'trade' });
  return slots;
}

function reasonFor(duty: FpsRoundDuty, terms: DutyTerms, c: FpsDutyCandidate, team: readonly FpsDutyCandidate[], context: FpsDutyContext): string {
  if (duty === 'sniper') return 'Holds the AWP';
  // Phase changes dissolve jobs: say so instead of crediting a lane or preference.
  if (context.phase === 'post-plant' && duty === 'trade') return 'Post-plant — hold a trade angle on the device';
  if (context.phase === 'retake' && duty === 'trade') return 'Retake — trade into the site together';
  if (context.phase === 'retake' && duty === 'support') return 'Retake — utility for the retake';
  if (context.phase === 'post-plant' && duty === 'support') return 'Post-plant — utility to delay the retake';
  if (duty !== 'entry' && c.position === 'T_ENTRY' && c.hp < 60 && context.side === 't' && context.phase !== 'post-plant') return 'Hurt — hands off entry';
  const own = (POSITION_PRIOR[c.position][duty] ?? 0) >= 1;
  // Against the teammate whose roster position normally owns this job: the term that made the difference.
  const owner = own ? undefined : team.find(o => o.id !== c.id && (POSITION_PRIOR[o.position][duty] ?? 0) >= 1);
  if (own) return `${FPS_ROUND_DUTY_LABELS[duty]} — roster position`;
  const theirs = owner ? scoreFpsDuty(owner, duty, team, context) : undefined;
  const diff = (k: keyof DutyTerms) => terms[k] - (theirs?.[k] ?? 0);
  const causes: [number, string][] = [
    [diff('spawn'), duty === 'anchor' ? 'closest to the site' : 'best placed for the lane'],
    [diff('state'), duty === 'support' ? 'carries the utility' : owner && owner.hp < 60 ? 'healthier than the usual holder' : 'better equipped'],
    [diff('fit'), 'caller backs the strength'],
    [diff('lead'), c.isIgl && duty === 'entry' ? 'leads from the front' : 'caller\'s structure'],
    [diff('self'), 'own preference'],
  ];
  return `${FPS_ROUND_DUTY_LABELS[duty]} — ${causes.sort((a, b) => b[0] - a[0])[0][1]}`;
}

/**
 * Elects one unique round job for every living player. Exhaustive over at most 5! orderings,
 * so the whole team is optimised together rather than greedily.
 */
export function assignFpsRoundDuties(team: readonly FpsDutyCandidate[], context: FpsDutyContext): FpsDutyAssignment[] {
  if (!team.length) return [];
  const ordered = [...team].sort((a, b) => a.slot - b.slot);
  // CT coverage: a site with no living home defender borrows the best-suited flexible defender
  // from a site that still has two or more (it never strips a site down to nobody).
  const homes = new Map(ordered.map(c => [c.id, c.home]));
  if (context.side === 'ct' && context.phase !== 'retake' && ordered.length >= 3) {
    for (const site of ['A', 'B'] as const) {
      if (ordered.some(c => homes.get(c.id) === site)) continue;
      const other = site === 'A' ? 'B' : 'A';
      const pool = ordered.filter(c => homes.get(c.id) === other);
      if (pool.length < 2) continue;
      const chosen = [...pool].sort((a, b) => {
        const s = (c: FpsDutyCandidate) => (POSITION_PRIOR[c.position].anchor ?? 0) * -.6 + c.tendency('rotationProactivity') * .6
          + c.attributes.positioning * .2 - (c.current === 'anchor' ? 1 : 0) - (c.weapon === 'sniper' ? .2 : 0);
        return s(b) - s(a) || a.slot - b.slot;
      })[0];
      homes.set(chosen.id, site);
    }
  }
  const view = ordered.map(c => ({ ...c, home: homes.get(c.id) }));
  const slots = dutySlots(view, context);
  const terms = view.map(c => slots.map(slot => {
    const t = scoreFpsDuty(c, slot.duty, view, context);
    if (!t) return undefined;
    if (slot.duty === 'anchor' && c.home !== slot.site) return undefined;
    return t;
  }));
  const tradeTerms = view.map(c => scoreFpsDuty(c, 'trade', view, context)!);
  const used = new Array(view.length).fill(false);
  let best = -Infinity, bestPick: number[] = [];
  const pick: number[] = [];
  // Optional slots (lurk) may fall back to trade when nobody fits them.
  const value = (player: number, slot: number) => {
    const t = terms[player][slot];
    const s = t ? sumTerms(t) : -Infinity;
    if (slots[slot].optional) return Math.max(s, sumTerms(tradeTerms[player]) - .05);
    return s;
  };
  const search = (slot: number, total: number) => {
    if (slot === slots.length) { if (total > best + 1e-9) { best = total; bestPick = [...pick]; } return; }
    for (let i = 0; i < view.length; i++) {
      if (used[i]) continue;
      const v = value(i, slot);
      if (v === -Infinity) continue;
      used[i] = true; pick.push(i);
      search(slot + 1, total + v);
      used[i] = false; pick.pop();
    }
  };
  search(0, 0);
  if (!bestPick.length) bestPick = view.map((_, i) => i);
  return bestPick.map((player, slot) => {
    const c = view[player];
    let duty = slots[slot]?.duty ?? 'trade';
    let t = terms[player][slot] ?? tradeTerms[player];
    if (slots[slot]?.optional && sumTerms(tradeTerms[player]) - .05 >= sumTerms(t)) { duty = 'trade'; t = tradeTerms[player]; }
    const moved = c.home !== team.find(o => o.id === c.id)?.home;
    return { id: c.id, duty, score: sumTerms(t), reason: moved ? `Covers ${c.home} — site left empty` : reasonFor(duty, t, c, view, context), ...(moved ? { home: c.home } : {}) };
  });
}
