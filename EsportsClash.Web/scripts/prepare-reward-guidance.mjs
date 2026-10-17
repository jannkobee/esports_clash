import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adaptivePolicyScore } from '../src/adaptivePolicy.ts';
import { scoreUtility } from '../src/utilityDecision.ts';

const read = async name => JSON.parse(await readFile(resolve('../docs', name), 'utf8'));
const text = await readFile(resolve('../docs/ml-task-candidate.json'), 'utf8');
const frozen = JSON.parse(text);
assert.equal(frozen.fit.sufficient, true);
const old = await read('ml-task-outcome-analysis.json');
const authority = old.heldout.filter(item => item.status === 'valid').map(item => {
  const a = item.candidates.find(candidate => candidate.action === item.incumbent);
  const b = item.candidates.find(candidate => candidate.action === item.alternate);
  const baseGap = scoreUtility({ ...a.factors, learned: 0 }).utility
    - scoreUtility({ ...b.factors, learned: 0 }).utility;
  const prediction = adaptivePolicyScore(frozen.fit.policy, item.alternate, item.features)
    - adaptivePolicyScore(frozen.fit.policy, item.incumbent, item.features);
  return { id: item.id, cardId: item.cardId, gapWithoutLearned: baseGap,
    predictedRewardAdvantage: prediction, additiveContribution: .04 * prediction,
    remainingGap: baseGap - .04 * prediction };
});
const cases = Array.from({ length: 8 }, (_, index) => ({ id: `fresh-${93 + index}-d${Math.floor(index / 2) % 2}-${index % 2 ? 'swapped' : 'original'}`,
  seed: 93 + index, draft: Math.floor(index / 2) % 2, swapped: index % 2 === 1 }));
const seen = new Set(old.plan.cases.map(item => item.seed));
assert.ok(cases.every(item => !seen.has(item.seed)));
const plan = { version: 1, method: 'Frozen reward-guided decision candidate, evaluated once at the first existing safe close farm/push checkpoint; two incumbent controls, alternate and actual learned-choice replay',
  model: 'ml-task-candidate.json', modelHash: createHash('sha256').update(text).digest('hex'),
  trainingHash: frozen.trainingHash, minimumPredictedRewardAdvantage: .02,
  scoutSeconds: 240, horizonSeconds: 30, pair: 'farm-push',
  rollout: 'First safe choice only; ordinary retreat/replanning thereafter. All existing experiment gates remain unchanged.',
  promotion: false, cases };
// Exclusive creation protects the declared fresh-test plan from accidental reuse/tuning.
await writeFile(resolve('../docs/ml-reward-guidance-plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve('../docs/ml-reward-authority-analysis.json'), JSON.stringify({
  method: 'Existing held-out contexts used only to diagnose prediction/utility units; not the fresh test set', authority }, null, 2) + '\n');
console.log(JSON.stringify({ plan, authority }, null, 2));
