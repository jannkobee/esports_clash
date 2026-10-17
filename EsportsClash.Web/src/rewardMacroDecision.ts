import { adaptivePolicyScore, type AdaptivePolicy } from './adaptivePolicy.ts';
import { inspectSafeMacroExperiment, type SafeMacroExperimentInput } from './safeMacroExperiment.ts';
import { chooseMacroAction } from './macroActionDecision.ts';
import { validTaskActionContext, type TaskActionContext } from './taskActionContext.ts';
import { taskContextScore, type TaskContextPolicy } from './taskContextPolicy.ts';
import { confidenceTaskAdvantage, loadConfidenceTaskPolicy, type ConfidenceTaskPolicy } from './taskConfidencePolicy.ts';

/** Evaluation candidate only: the existing safe close-pair gates retain authority. */
export function chooseRewardGuidedMacro(input: {
  experiment: SafeMacroExperimentInput; policy?: AdaptivePolicy; features: Record<string, number>;
  taskPolicy?: TaskContextPolicy; taskContext?: TaskActionContext;
  confidencePolicy?: ConfidenceTaskPolicy;
}) {
  const inspection = inspectSafeMacroExperiment(input.experiment);
  const pair = inspection.pair;
  const unchanged = { selected: input.experiment.incumbent, changed: false,
    predictedAdvantage: 0, margin: .02 };
  if (inspection.gates.length || !pair)
    return { ...unchanged, reason: inspection.gates[0] ?? 'legal-pair' };
  if ([pair.incumbent, pair.alternate].sort().join('-') !== 'farm-push')
    return { ...unchanged, reason: 'unsupported-task-pair' };
  const canonical = chooseMacroAction({ actorAvailable: true, now: input.experiment.now,
    candidates: input.experiment.candidates });
  if (canonical.selected?.value !== pair.incumbent)
    return { ...unchanged, reason: 'priority-or-incumbent-mismatch' };
  if ([input.policy, input.taskPolicy, input.confidencePolicy].filter(Boolean).length !== 1
    || !Object.values(input.features).every(Number.isFinite)
    || input.features.bias !== 1)
    return { ...unchanged, reason: 'missing-model-or-context' };
  if ((input.taskPolicy || input.confidencePolicy) && !validTaskActionContext(input.taskContext))
    return { ...unchanged, reason: 'missing-model-or-context' };
  if (input.confidencePolicy) {
    const model = loadConfidenceTaskPolicy(input.confidencePolicy);
    if (!model) return { ...unchanged, reason: 'missing-model-or-context' };
    const estimate = confidenceTaskAdvantage(model, input.taskContext!, pair.incumbent, pair.alternate);
    return { ...unchanged, ...estimate, selected: estimate.allowed ? pair.alternate : pair.incumbent,
      changed: estimate.allowed };
  }
  // The model was fitted to reward contrasts. Additive 0.04 preference scores
  // have different units, so this candidate tests the learned ranking directly
  // within the already-approved experimental pair, never in ordinary play.
  const predictedAdvantage = input.taskPolicy && input.taskContext
    ? taskContextScore(input.taskPolicy, pair.alternate as 'farm' | 'push', input.taskContext)
      - taskContextScore(input.taskPolicy, pair.incumbent as 'farm' | 'push', input.taskContext)
    : adaptivePolicyScore(input.policy!, pair.alternate, input.features)
      - adaptivePolicyScore(input.policy!, pair.incumbent, input.features);
  const changed = predictedAdvantage > unchanged.margin;
  return { selected: changed ? pair.alternate : pair.incumbent, changed, predictedAdvantage,
    margin: unchanged.margin, reason: changed ? 'predicted-task-benefit' : 'insufficient-task-advantage' };
}
