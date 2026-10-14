/** Common deterministic arbitration. Mechanical validators stay with their owners. */
export type UtilityPriority = 'optional' | 'tactical' | 'finish' | 'emergency';
export type UtilityFactors = Partial<Record<
  'strategic' | 'tactical' | 'coordination' | 'personality' | 'mood'
  | 'danger' | 'travel' | 'resource' | 'opportunity', number>>;
export interface UtilityCandidate<T> {
  key: string;
  contextKey: string;
  value: T;
  priority: UtilityPriority;
  /** First failed mechanical/policy gate. Undefined means the owner validated it. */
  rejected?: string;
  factors: UtilityFactors;
  reason: string;
}
export interface UtilityCommitment { key: string; contextKey: string; until: number }
export interface UtilityTrace {
  key: string;
  priority: UtilityPriority;
  utility: number;
  contributions: UtilityFactors;
  rejected?: string;
  reason: string;
}
export interface UtilityDecision<T> {
  selected?: UtilityCandidate<T>;
  traces: UtilityTrace[];
  reason: 'actor-unavailable' | 'no-legal-action' | 'commitment' | 'utility';
  truncated: number;
}

const PRIORITY: Record<UtilityPriority, number> = { optional: 0, tactical: 1, finish: 2, emergency: 3 };
// Every input factor is normalized to [-1, 1]. Preferences cannot outweigh a
// higher-priority validated emergency or finish. Weights never affect mechanics.
export const UTILITY_WEIGHTS: Readonly<Required<UtilityFactors>> = Object.freeze({
  strategic: .30, tactical: .25, coordination: .12, personality: .05, mood: .03,
  danger: -.35, travel: -.10, resource: -.08, opportunity: -.15,
});
export const MAX_UTILITY_CANDIDATES = 32;

export function scoreUtility(factors: UtilityFactors, explain = true): { utility: number; contributions: UtilityFactors; valid: boolean } {
  const contributions: UtilityFactors = {};
  let utility = 0;
  for (const name of Object.keys(factors) as (keyof UtilityFactors)[]) {
    if (!Object.hasOwn(UTILITY_WEIGHTS, name)) return { utility: 0, contributions, valid: false };
    const value = factors[name] ?? 0;
    if (!Number.isFinite(value)) return { utility: 0, contributions, valid: false };
    const bounded = Math.max(name === 'danger' || name === 'travel' || name === 'resource' || name === 'opportunity' ? 0 : -1,
      Math.min(1, value));
    const contribution = bounded * UTILITY_WEIGHTS[name];
    if (explain) contributions[name] = contribution;
    utility += contribution;
  }
  return { utility, contributions, valid: true };
}

/**
 * Caller order breaks ties (including side-mirrored fixtures); no ID/side bonus
 * or RNG. A commitment can only retain a legal candidate in the highest tier.
 * Generators must emit emergency candidates before optional ones if bounded.
 */
export function selectUtilityDecision<T>(input: {
  actorAvailable: boolean;
  now: number;
  candidates: readonly UtilityCandidate<T>[];
  commitment?: UtilityCommitment;
  /** Disable trace allocation for existing 30Hz target calls; selection is identical. */
  explain?: boolean;
}): UtilityDecision<T> {
  const traces: UtilityTrace[] = [];
  const truncated = Math.max(0, input.candidates.length - MAX_UTILITY_CANDIDATES);
  if (!input.actorAvailable || !Number.isFinite(input.now))
    return { traces, truncated, reason: 'actor-unavailable' };
  let selected: UtilityCandidate<T> | undefined;
  let highestPriority = -1, highestUtility = -Infinity;
  let held: UtilityCandidate<T> | undefined;
  const keys = new Set<string>();
  for (const candidate of input.candidates.slice(0, MAX_UTILITY_CANDIDATES)) {
    const score = scoreUtility(candidate.factors, input.explain !== false);
    const rejected = candidate.rejected || (!score.valid ? 'non-finite-utility' : undefined)
      || (keys.has(candidate.key) ? 'duplicate-action' : undefined);
    keys.add(candidate.key);
    if (input.explain !== false) traces.push({ key: candidate.key, priority: candidate.priority, utility: score.utility,
      contributions: score.contributions, rejected, reason: candidate.reason });
    if (rejected) continue;
    const priority = PRIORITY[candidate.priority];
    if (priority > highestPriority || priority === highestPriority && score.utility > highestUtility) {
      selected = candidate; highestPriority = priority; highestUtility = score.utility;
    }
    if (input.commitment?.key === candidate.key && input.commitment.contextKey === candidate.contextKey
      && input.commitment.until > input.now) held = candidate;
  }
  if (held && PRIORITY[held.priority] === highestPriority)
    return { selected: held, traces, truncated, reason: 'commitment' };
  return { selected, traces, truncated, reason: selected ? 'utility' : 'no-legal-action' };
}
