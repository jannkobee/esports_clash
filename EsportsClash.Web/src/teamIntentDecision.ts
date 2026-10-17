import { selectUtilityDecision, type UtilityFactors, type UtilityPriority } from './utilityDecision.ts';

export type TeamIntentKind = 'defend' | 'fight' | 'objective' | 'regroup' | 'push' | 'hold';
export interface TeamIntentCandidate {
  intent: TeamIntentKind;
  available: boolean;
  priority: UtilityPriority;
  contextKey: string;
  factors: UtilityFactors;
  reason: string;
}
export interface TeamIntent { intent: TeamIntentKind; contextKey: string; until: number; }

/**
 * Team calls are a short-lived shared preference, never an executor. Existing
 * local rules still decide reachability, targetability, tower risk and casts.
 */
export function coordinateTeamIntent(input: {
  now: number;
  candidates: readonly TeamIntentCandidate[];
  commitment?: TeamIntent;
}) {
  return selectUtilityDecision({
    actorAvailable: true, now: input.now, explain: false,
    commitment: input.commitment ? {
      key: `team:${input.commitment.intent}`,
      contextKey: input.commitment.contextKey, until: input.commitment.until,
    } : undefined,
    candidates: input.candidates.map(candidate => ({
      key: `team:${candidate.intent}`, contextKey: candidate.contextKey,
      value: candidate.intent, priority: candidate.priority,
      rejected: candidate.available ? undefined : 'existing-policy-gate',
      factors: candidate.factors, reason: candidate.reason,
    })),
  });
}

/** Roles only bias legal macro candidates; they do not alter unit mechanics. */
export function teamIntentRole(intent: TeamIntentKind | undefined, primaryRole: string): TeamIntentKind | undefined {
  if (intent !== 'fight') return intent;
  return primaryRole === 'Support' ? 'regroup' : 'fight';
}
