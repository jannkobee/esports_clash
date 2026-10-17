import { validTaskActionContext, type TaskActionContext } from './taskActionContext.ts';
import { fitTeamTaskContextPolicy, loadTaskContextPolicy, taskContextScore,
  type TaskContextExample, type TaskContextPolicy } from './taskContextPolicy.ts';
import { validTeamTaskOutcome, type TeamTaskOutcome } from './teamTaskOutcome.ts';

export const TASK_CONFIDENCE_CONFIG = { level: .9, minimumFitting: 16, minimumCalibration: 16,
  margin: .02, method: 'split-one-sided-v1' } as const;
const kinds = ['advance', 'camp-exit', 'structure', 'minion'] as const;
type PushKind = typeof kinds[number];
export interface ConfidenceTaskPolicy {
  kind: 'task-confidence'; version: 1; policy: TaskContextPolicy;
  fittingSeeds: number[]; calibrationSeeds: number[]; supportedPushKinds: PushKind[];
  calibration: { method: 'split-one-sided-v1'; level: number; sampleSize: number;
    quantileRank: number; overpredictionErrors: number[]; errorBuffer: number };
}
export type ConfidenceTaskExample = Omit<TaskContextExample<TeamTaskOutcome>, 'split'> & {
  split: 'fit' | 'calibration' | 'heldout';
};
const uniqueSeeds = (value: unknown): value is number[] => Array.isArray(value) && value.length <= 4096
  && value.every(seed => Number.isInteger(seed) && seed > 0) && new Set(value).size === value.length;
const pushKind = (context: TaskActionContext): PushKind | undefined => {
  const flags = kinds.filter(kind => context.actions.push[`task:kind:${kind}`] === 1);
  return flags.length === 1 && kinds.every(kind => context.actions.push[`task:kind:${kind}`] === Number(kind === flags[0]))
    ? flags[0] : undefined;
};

/** Reject missing/inconsistent uncertainty metadata instead of falling back to raw ranking. */
export function loadConfidenceTaskPolicy(raw: unknown): ConfidenceTaskPolicy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as ConfidenceTaskPolicy, c = item.calibration;
  const policy = loadTaskContextPolicy(item.policy);
  if (item.kind !== 'task-confidence' || item.version !== 1 || !policy || policy.version !== 2
    || policy.objective !== 'team-v1' || !uniqueSeeds(item.fittingSeeds) || !uniqueSeeds(item.calibrationSeeds)
    || item.fittingSeeds.length < TASK_CONFIDENCE_CONFIG.minimumFitting
    || item.calibrationSeeds.length < TASK_CONFIDENCE_CONFIG.minimumCalibration
    || item.calibrationSeeds.some(seed => item.fittingSeeds.includes(seed))
    || !Array.isArray(item.supportedPushKinds) || !item.supportedPushKinds.length
    || new Set(item.supportedPushKinds).size !== item.supportedPushKinds.length
    || !item.supportedPushKinds.every(kind => kinds.includes(kind))
    || !c || c.method !== TASK_CONFIDENCE_CONFIG.method || c.level !== TASK_CONFIDENCE_CONFIG.level
    || c.sampleSize !== item.calibrationSeeds.length
    || c.quantileRank !== Math.ceil((c.sampleSize + 1) * c.level) || c.quantileRank > c.sampleSize
    || !Array.isArray(c.overpredictionErrors) || c.overpredictionErrors.length !== c.sampleSize
    || !c.overpredictionErrors.every((error, i) => Number.isFinite(error) && Math.abs(error) <= 4
      && (i === 0 || error >= c.overpredictionErrors[i - 1]))
    || !Number.isFinite(c.errorBuffer) || c.errorBuffer < 0 || c.errorBuffer > 4
    || c.errorBuffer !== Math.max(0, c.overpredictionErrors[c.quantileRank - 1])) return undefined;
  return { kind: 'task-confidence', version: 1, policy,
    fittingSeeds: [...item.fittingSeeds], calibrationSeeds: [...item.calibrationSeeds],
    supportedPushKinds: [...item.supportedPushKinds], calibration: { ...c,
      overpredictionErrors: [...c.overpredictionErrors] } };
}

/** A one-sided empirical error buffer, not a per-card guarantee of future safety. */
export function confidenceTaskAdvantage(model: ConfidenceTaskPolicy, context: TaskActionContext,
  incumbent: string, alternate: string) {
  if (incumbent !== 'farm' || alternate !== 'push') return { allowed: false, reason: 'uncalibrated-direction' };
  if (!validTaskActionContext(context)) return { allowed: false, reason: 'missing-model-or-context' };
  const kind = pushKind(context);
  if (!kind || !model.supportedPushKinds.includes(kind))
    return { allowed: false, reason: 'unsupported-task-context' };
  const predictedAdvantage = taskContextScore(model.policy, 'push', context) - taskContextScore(model.policy, 'farm', context);
  const uncertainty = model.calibration.errorBuffer, lowerBoundAdvantage = predictedAdvantage - uncertainty;
  return { allowed: lowerBoundAdvantage > TASK_CONFIDENCE_CONFIG.margin,
    reason: lowerBoundAdvantage > TASK_CONFIDENCE_CONFIG.margin ? 'uncertainty-cleared' : 'uncertain-task-advantage',
    predictedAdvantage, uncertainty, lowerBoundAdvantage,
    calibrationSamples: model.calibration.sampleSize, calibrationLevel: model.calibration.level };
}

/** Fit once on proper training; calibrate on separate worlds; never refit afterward. */
export function fitConfidenceTaskPolicy(examples: readonly ConfidenceTaskExample[]) {
  const declared = (split: ConfidenceTaskExample['split']) => new Set(examples.filter(item => item.split === split).map(item => item.seed));
  const fitSeeds = declared('fit'), calibrationSeeds = declared('calibration'), heldoutSeeds = declared('heldout');
  const conflicts = new Set([...fitSeeds, ...calibrationSeeds].filter(seed => heldoutSeeds.has(seed)
    || (fitSeeds.has(seed) && calibrationSeeds.has(seed))));
  const seen = new Set<number>();
  const valid = examples.filter(item => {
    if (item.split === 'heldout' || conflicts.has(item.seed) || seen.has(item.seed)
      || !Number.isInteger(item.seed) || item.seed < 1 || !item.validPair
      || item.incumbent !== 'farm' || item.alternate !== 'push'
      || !validTaskActionContext(item.taskContext) || !pushKind(item.taskContext)
      || !validTeamTaskOutcome(item.control) || !validTeamTaskOutcome(item.alternative)
      || item.control.horizonSeconds < 30 || item.control.horizonSeconds > 30.1
      || Math.abs(item.control.horizonSeconds - item.alternative.horizonSeconds) > 1e-6
      || ['farm', 'push'].some(action => item.taskContext.actions[action as 'farm' | 'push'][`card:${item.cardId}`] !== 1)) return false;
    seen.add(item.seed); return true;
  });
  const fitting = valid.filter(item => item.split === 'fit').sort((a, b) => a.seed - b.seed);
  const calibration = valid.filter(item => item.split === 'calibration').sort((a, b) => a.seed - b.seed);
  const fit = fitTeamTaskContextPolicy(fitting.map(item => ({ ...item, split: 'train' as const })));
  const observations = calibration.map(item => {
    const prediction = taskContextScore(fit.policy, 'push', item.taskContext) - taskContextScore(fit.policy, 'farm', item.taskContext);
    // Use the full observed contrast, not the fitter's clipped target.
    const observed = item.alternative.reward - item.control.reward;
    return { seed: item.seed, prediction, observed, overprediction: prediction - observed };
  });
  const errors = observations.map(item => item.overprediction).sort((a, b) => a - b);
  const quantileRank = Math.ceil((errors.length + 1) * TASK_CONFIDENCE_CONFIG.level);
  const supportedPushKinds = [...new Set(fitting.map(item => pushKind(item.taskContext)!))].sort();
  const sufficient = fit.sufficient && fitting.length >= TASK_CONFIDENCE_CONFIG.minimumFitting
    && calibration.length >= TASK_CONFIDENCE_CONFIG.minimumCalibration && quantileRank <= errors.length
    && new Set(calibration.map(item => item.draft)).size >= 2
    && new Set(calibration.map(item => item.cardId)).size >= 2;
  const policy = sufficient ? loadConfidenceTaskPolicy({ kind: 'task-confidence', version: 1, policy: fit.policy,
    fittingSeeds: fitting.map(item => item.seed), calibrationSeeds: calibration.map(item => item.seed), supportedPushKinds,
    calibration: { method: TASK_CONFIDENCE_CONFIG.method, level: TASK_CONFIDENCE_CONFIG.level,
      sampleSize: errors.length, quantileRank, overpredictionErrors: errors,
      errorBuffer: Math.max(0, errors[quantileRank - 1]) } }) : undefined;
  return { policy, sufficient: sufficient && !!policy, configuration: TASK_CONFIDENCE_CONFIG,
    fittingEpisodes: fitting.length, calibrationEpisodes: calibration.length,
    conflictingSeeds: [...conflicts].sort((a, b) => a - b), fit, observations };
}
