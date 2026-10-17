import { selectUtilityDecision, type UtilityDecision, type UtilityFactors, type UtilityPriority } from './utilityDecision.ts';

/**
 * A narrow bridge from existing macro policy gates to the shared selector.
 * Callers own visibility, route, objective, tower, recall and cast legality;
 * this module never turns an unavailable action into a legal one.
 */
export type MacroActionKind = 'retreat' | 'relic' | 'defend' | 'finish' | 'fight' | 'objective' | 'wave' | 'push' | 'farm' | 'regroup' | 'hold';

export interface MacroActionCandidate {
  action: MacroActionKind;
  available: boolean;
  priority: UtilityPriority;
  contextKey: string;
  factors: UtilityFactors;
  reason: string;
}

export interface MacroActionCommitment {
  action: MacroActionKind;
  contextKey: string;
  until: number;
}

/** A held action keeps its original deadline; selection does not roll the timer forward. */
export function nextMacroCommitment(
  selected: MacroActionCandidate | undefined,
  reason: 'actor-unavailable' | 'no-legal-action' | 'commitment' | 'utility',
  prior: MacroActionCommitment | undefined,
  now: number,
): MacroActionCommitment | undefined {
  if (!selected) return undefined;
  if (reason === 'commitment' && prior?.action === selected.action
    && prior.contextKey === selected.contextKey && prior.until > now) return prior;
  return { action: selected.action, contextKey: selected.contextKey, until: now + .65 };
}

export function chooseMacroAction(input: {
  actorAvailable: boolean;
  now: number;
  candidates: readonly MacroActionCandidate[];
  commitment?: MacroActionCommitment;
}): UtilityDecision<MacroActionKind> {
  return selectUtilityDecision({
    actorAvailable: input.actorAvailable,
    now: input.now,
    explain: false,
    commitment: input.commitment ? {
      key: `macro:${input.commitment.action}`,
      contextKey: input.commitment.contextKey,
      until: input.commitment.until,
    } : undefined,
    candidates: input.candidates.map(candidate => ({
      key: `macro:${candidate.action}`,
      contextKey: candidate.contextKey,
      value: candidate.action,
      priority: candidate.priority,
      rejected: candidate.available ? undefined : 'existing-policy-gate',
      factors: candidate.factors,
      reason: candidate.reason,
    })),
  });
}
