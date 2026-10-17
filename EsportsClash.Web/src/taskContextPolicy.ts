import { isTaskFeature, validTaskActionContext, type TaskAction, type TaskActionContext } from './taskActionContext.ts';
import type { TaskOutcome } from './taskOutcome.ts';
import { validTeamTaskOutcome, type TeamTaskOutcome } from './teamTaskOutcome.ts';

export interface TaskContextPolicy {
  kind: 'task-context'; version: 1 | 2;
  objective?: 'team-v1';
  weights: Record<TaskAction, Record<string, number>>;
}
const actions = ['farm', 'push'] as const;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
export const emptyTaskContextPolicy = (objective?: 'team-v1'): TaskContextPolicy => ({ kind: 'task-context',
  version: objective ? 2 : 1, ...(objective ? { objective } : {}), weights: { farm: {}, push: {} } });

/** Separate schema: ordinary adaptive storage cannot load or deploy this model. */
export function loadTaskContextPolicy(raw: unknown): TaskContextPolicy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as TaskContextPolicy;
  if (item.kind !== 'task-context' || !item.weights || !((item.version === 1 && item.objective === undefined)
    || (item.version === 2 && item.objective === 'team-v1'))) return undefined;
  const model = emptyTaskContextPolicy(item.objective);
  for (const action of actions) {
    const source = item.weights[action];
    if (!source || typeof source !== 'object' || Object.keys(source).length > 128) return undefined;
    for (const [key, weight] of Object.entries(source)) {
      if (!isTaskFeature(key) || !Number.isFinite(weight) || Math.abs(weight) > 1) return undefined;
      model.weights[action][key] = weight;
    }
  }
  return model;
}

export function taskContextScore(model: TaskContextPolicy, action: TaskAction, context: TaskActionContext): number {
  return clamp(Object.entries(context.actions[action]).reduce((sum, [key, value]) =>
    sum + (model.weights[action][key] ?? 0) * value, 0));
}

export interface TaskContextExample<Outcome = TaskOutcome> {
  seed: number; draft: number; cardId: string; split: 'train' | 'heldout'; validPair: boolean;
  incumbent: TaskAction; alternate: TaskAction; taskContext: TaskActionContext;
  control: Outcome; alternative: Outcome;
}
// Fixed before collection. Stronger shrinkage for identity/resources than task observations.
export const TASK_CONTEXT_FIT = { minimumEpisodes: 16, minimumInformative: 4,
  taskPenalty: 1, sharedPenalty: 4, maximumWeight: 1, targetBound: 1 } as const;
const validOutcome = (value: TaskOutcome) => value && Number.isFinite(value.reward)
  && value.reward >= -1 && value.reward <= 1 && Number.isInteger(value.deaths) && value.deaths >= 0
  && value.horizonSeconds >= 30 && value.horizonSeconds <= 30.1
  && [value.campGold, value.waveGold, value.structureDamage].every(number => Number.isFinite(number) && number >= 0)
  && (value.deaths === 0 || value.reward === -1);

/** Ridge regression on independently replayed action reward differences, never match-winner labels. */
export function fitTaskContextPolicy(examples: readonly TaskContextExample[]) {
  return fitRewardPolicy(examples, validOutcome);
}

export function fitTeamTaskContextPolicy(examples: readonly TaskContextExample<TeamTaskOutcome>[]) {
  return fitRewardPolicy(examples, validTeamTaskOutcome, 'team-v1');
}

function fitRewardPolicy<Outcome extends { reward: number; horizonSeconds: number }>(
  examples: readonly TaskContextExample<Outcome>[], validate: (value: Outcome) => boolean, objective?: 'team-v1') {
  const heldout = new Set(examples.filter(item => item.split === 'heldout').map(item => item.seed));
  const seen = new Set<number>();
  const training = examples.filter(item => {
    if (item.split !== 'train' || !item.validPair || !Number.isInteger(item.seed) || item.seed < 1
      || seen.has(item.seed) || heldout.has(item.seed) || !actions.includes(item.incumbent)
      || !actions.includes(item.alternate) || item.incumbent === item.alternate
      || !validTaskActionContext(item.taskContext) || !validate(item.control) || !validate(item.alternative)
      || item.control.horizonSeconds < 30 || item.control.horizonSeconds > 30.1
      || Math.abs(item.control.horizonSeconds - item.alternative.horizonSeconds) > 1e-6
      || actions.some(action => item.taskContext.actions[action][`card:${item.cardId}`] !== 1)) return false;
    seen.add(item.seed); return true;
  });
  const informativeEpisodes = training.filter(item => Math.abs(item.alternative.reward - item.control.reward) >= .02).length;
  const sufficient = training.length >= TASK_CONTEXT_FIT.minimumEpisodes
    && informativeEpisodes >= TASK_CONTEXT_FIT.minimumInformative
    && new Set(training.map(item => item.draft)).size >= 2 && new Set(training.map(item => item.cardId)).size >= 2;
  const policy = emptyTaskContextPolicy(objective);
  const keys = actions.flatMap(action => [...new Set(training.flatMap(item => Object.keys(item.taskContext.actions[action])))].sort()
    .map(key => ({ action, key, penalty: key.startsWith('task:') ? TASK_CONTEXT_FIT.taskPenalty : TASK_CONTEXT_FIT.sharedPenalty })));
  const rows = training.map(item => keys.map(({ action, key }) =>
    (item.taskContext.actions[action][key] ?? 0) * (item.alternate === action ? 1 : -1)));
  const targets = training.map(item => clamp(item.alternative.reward - item.control.reward));
  if (sufficient) {
    // Solve the small dual system (I + X P^-1 X^T) alpha = y using pivoted elimination.
    const matrix = rows.map((row, i) => [...rows.map((other, j) =>
      row.reduce((sum, value, k) => sum + value * other[k] / keys[k].penalty, i === j ? 1 : 0)), targets[i]]);
    for (let column = 0; column < matrix.length; column++) {
      let pivot = column;
      for (let row = column + 1; row < matrix.length; row++)
        if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
      [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
      const divisor = matrix[column][column];
      if (!Number.isFinite(divisor) || Math.abs(divisor) < 1e-12) throw new Error('Singular task fit');
      for (let k = column; k <= matrix.length; k++) matrix[column][k] /= divisor;
      for (let row = 0; row < matrix.length; row++) if (row !== column) {
        const factor = matrix[row][column];
        for (let k = column; k <= matrix.length; k++) matrix[row][k] -= factor * matrix[column][k];
      }
    }
    keys.forEach(({ action, key, penalty }, k) => {
      policy.weights[action][key] = clamp(rows.reduce((sum, row, i) => sum + row[k] * matrix[i][matrix.length], 0) / penalty);
    });
  }
  const loss = training.length ? training.reduce((sum, item, i) => sum + (targets[i]
    - (taskContextScore(policy, item.alternate, item.taskContext)
      - taskContextScore(policy, item.incumbent, item.taskContext))) ** 2, 0) / training.length : null;
  return { policy, sufficient, configuration: TASK_CONTEXT_FIT, trainingEpisodes: training.length,
    informativeEpisodes, trainingSeeds: [...seen], fittedLoss: loss,
    zeroLoss: targets.length ? targets.reduce((sum, value) => sum + value ** 2, 0) / targets.length : null };
}
