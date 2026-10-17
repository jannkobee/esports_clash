import { loadAdaptivePolicy, type AdaptiveAction, type AdaptivePolicy } from './adaptivePolicy.ts';
import type { AIDecisionRecord } from './aiDecisionTelemetry.ts';

const actions = new Set(['fight', 'wave', 'regroup', 'farm', 'push']);
const isAction = (value: string): value is AdaptiveAction => actions.has(value);
const mean = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length;
const variance = (items: number[]) => items.length < 2 ? 0
  : items.reduce((sum, value) => sum + (value - mean(items)) ** 2, 0) / (items.length - 1);

export interface RandomizedGroup {
  pair: string;
  incumbent: AdaptiveAction;
  alternate: AdaptiveAction;
  assigned: { incumbent: number; alternate: number };
  outcomes: { incumbent: number; alternate: number };
  meanProgressPerSecond?: { incumbent: number; alternate: number };
  alternateMinusIncumbent?: number;
  descriptive95PercentHalfWidth?: number;
}

export interface RandomizedFit {
  policy: AdaptivePolicy;
  assigned: number;
  validOutcomes: number;
  groups: RandomizedGroup[];
  trainedGroups: number;
}

/** 50/50 intent-to-treat contrast. The uncertainty band is descriptive; match actors can interact. */
export function fitRandomizedMacroCandidate(start: AdaptivePolicy, records: readonly AIDecisionRecord[]): RandomizedFit {
  const policy = loadAdaptivePolicy(start);
  const grouped = new Map<string, { pair: string; incumbent: AdaptiveAction; alternate: AdaptiveAction;
    assigned: { incumbent: number; alternate: number }; outcomes: { incumbent: number[]; alternate: number[] } }>();
  for (const record of records) {
    const assignment = record.experiment;
    if (!assignment || !isAction(assignment.incumbent) || !isAction(assignment.alternate)
      || assignment.incumbent === assignment.alternate || assignment.propensity !== .5) continue;
    const key = `${assignment.pair}|${assignment.incumbent}|${assignment.alternate}`;
    const group = grouped.get(key) ?? { pair: assignment.pair, incumbent: assignment.incumbent,
      alternate: assignment.alternate, assigned: { incumbent: 0, alternate: 0 },
      outcomes: { incumbent: [], alternate: [] } };
    group.assigned[assignment.arm]++;
    if (record.outcome && record.outcome.horizonSeconds >= 2 && record.outcome.horizonSeconds <= 6
      && Number.isFinite(record.outcome.progress))
      group.outcomes[assignment.arm].push(record.outcome.progress / record.outcome.horizonSeconds);
    grouped.set(key, group);
  }
  let trainedGroups = 0;
  const groups: RandomizedGroup[] = [];
  for (const group of grouped.values()) {
    const control = group.outcomes.incumbent, alternate = group.outcomes.alternate;
    const summary: RandomizedGroup = { pair: group.pair, incumbent: group.incumbent,
      alternate: group.alternate, assigned: group.assigned,
      outcomes: { incumbent: control.length, alternate: alternate.length } };
    if (control.length && alternate.length) {
      const effect = mean(alternate) - mean(control);
      summary.meanProgressPerSecond = { incumbent: mean(control), alternate: mean(alternate) };
      summary.alternateMinusIncumbent = effect;
      if (control.length > 1 && alternate.length > 1)
        summary.descriptive95PercentHalfWidth = 1.96 * Math.sqrt(variance(control) / control.length
          + variance(alternate) / alternate.length);
      if (control.length >= 3 && alternate.length >= 3) {
        // A deliberately small offline-only preference update. No automatic deployment.
        const shrinkage = (control.length + alternate.length) / (control.length + alternate.length + 40);
        const delta = Math.max(-.04, Math.min(.04, effect * shrinkage));
        policy.weights[group.alternate].bias = Math.max(-1, Math.min(1,
          (policy.weights[group.alternate].bias ?? 0) + delta));
        policy.weights[group.incumbent].bias = Math.max(-1, Math.min(1,
          (policy.weights[group.incumbent].bias ?? 0) - delta));
        trainedGroups++;
      }
    }
    groups.push(summary);
  }
  return { policy, assigned: groups.reduce((sum, group) => sum + group.assigned.incumbent + group.assigned.alternate, 0),
    validOutcomes: groups.reduce((sum, group) => sum + group.outcomes.incumbent + group.outcomes.alternate, 0),
    groups, trainedGroups };
}
