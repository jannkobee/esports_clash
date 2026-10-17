import { adaptivePolicyScore, loadAdaptivePolicy, type AdaptiveAction, type AdaptivePolicy } from './adaptivePolicy.ts';
import type { TaskOutcome } from './taskOutcome.ts';

export interface PairedTaskExample {
  id: string; seed: number; draft: number; cardId: string; split: 'train' | 'heldout';
  validPair: boolean; incumbent: AdaptiveAction; alternate: AdaptiveAction;
  features: Record<string, number>; control: TaskOutcome; alternative: TaskOutcome;
}
const actions = new Set(['fight', 'wave', 'regroup', 'farm', 'push']);
const clamp = (value: number, bound: number) => Math.max(-bound, Math.min(bound, value));
const valid = (outcome: TaskOutcome) => outcome && Number.isFinite(outcome.reward)
  && outcome.reward >= -1 && outcome.reward <= 1 && outcome.horizonSeconds >= 30
  && outcome.horizonSeconds <= 30.1 && Number.isInteger(outcome.deaths) && outcome.deaths >= 0
  && [outcome.campGold, outcome.waveGold, outcome.structureDamage].every(value => Number.isFinite(value) && value >= 0)
  && (outcome.deaths === 0 || outcome.reward === -1);

/** Offline paired reward regression. Held-out worlds and duplicate seeds cannot train it. */
export function fitPairedTaskPolicy(start: AdaptivePolicy, examples: readonly PairedTaskExample[]) {
  const base = loadAdaptivePolicy(start), policy = loadAdaptivePolicy(start);
  const heldoutSeeds = new Set(examples.filter(example => example.split === 'heldout').map(example => example.seed));
  const seen = new Set<number>();
  const training = examples.filter(example => {
    if (example.split !== 'train' || !example.validPair || seen.has(example.seed) || heldoutSeeds.has(example.seed)
      || !Number.isInteger(example.seed) || example.seed < 1
      || !actions.has(example.incumbent) || !actions.has(example.alternate) || example.incumbent === example.alternate
      || !valid(example.control) || !valid(example.alternative)
      || Math.abs(example.control.horizonSeconds - example.alternative.horizonSeconds) > 1e-6
      || example.features.bias !== 1 || example.features[`card:${example.cardId}`] !== 1
      || !Object.values(example.features).every(Number.isFinite)) return false;
    seen.add(example.seed);
    return true;
  });
  const informative = training.filter(example => Math.abs(example.alternative.reward - example.control.reward) >= .02).length;
  const sufficient = training.length >= 4 && new Set(training.map(example => example.draft)).size >= 2
    && new Set(training.map(example => example.cardId)).size >= 2 && informative >= 2;
  const loss = (model: AdaptivePolicy) => training.length ? training.reduce((sum, item) => {
    const prediction = adaptivePolicyScore(model, item.alternate, item.features)
      - adaptivePolicyScore(model, item.incumbent, item.features);
    return sum + (prediction - clamp(item.alternative.reward - item.control.reward, .5)) ** 2;
  }, 0) / training.length : null;
  const initialLoss = loss(base);
  if (sufficient) for (let epoch = 0; epoch < 16; epoch++) for (const item of training) {
    const desired = clamp(item.alternative.reward - item.control.reward, .5);
    const error = desired - (adaptivePolicyScore(policy, item.alternate, item.features)
      - adaptivePolicyScore(policy, item.incumbent, item.features));
    const norm = Math.max(1, Object.values(item.features).reduce((sum, value) => sum + clamp(value, 1) ** 2, 0));
    for (const [key, value] of Object.entries(item.features)) {
      for (const [action, direction] of [[item.alternate, 1], [item.incumbent, -1]] as const) {
        const initial = base.weights[action][key] ?? 0;
        const proposed = (policy.weights[action][key] ?? 0) + direction * .04 * error * clamp(value, 1) / norm;
        policy.weights[action][key] = clamp(initial + clamp(proposed - initial, .08), 1);
      }
    }
  }
  const sanitized = loadAdaptivePolicy(policy);
  return { policy: sanitized, trainingEpisodes: training.length, informativeEpisodes: informative,
    trainingSeeds: [...seen], sufficient, initialLoss, fittedLoss: loss(sanitized),
    changed: JSON.stringify(base) !== JSON.stringify(sanitized) };
}
