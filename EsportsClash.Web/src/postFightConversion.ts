import { selectUtilityDecision, type UtilityFactors } from './utilityDecision.ts';

export type PostFightConversion = 'push' | 'objective' | 'reset' | 'farm' | 'regroup';
export interface PostFightCandidate { action: PostFightConversion; available: boolean; contextKey: string; factors: UtilityFactors; reason: string; }

/** Selects among conversion options already validated by their existing owners. */
export function choosePostFightConversion(input: { now: number; wonFight: boolean; candidates: readonly PostFightCandidate[] }) {
  return selectUtilityDecision({ actorAvailable: input.wonFight, now: input.now, explain: false,
    candidates: input.candidates.map(candidate => ({ key: `convert:${candidate.action}`, contextKey: candidate.contextKey,
      value: candidate.action, priority: candidate.action === 'push' ? 'tactical' as const : 'optional' as const,
      rejected: candidate.available ? undefined : 'existing-policy-gate', factors: candidate.factors, reason: candidate.reason })),
  });
}
