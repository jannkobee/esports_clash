// Read historical bytes; emit a separate report. No fitting or evidence overwrite.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeTaskOutcome } from '../src/taskOutcome.ts';
import { chooseRewardGuidedMacro } from '../src/rewardMacroDecision.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';

const output = process.argv[2];
if (!output) throw Error('A new output path is required');
const manifest = [];
const read = async name => {
  const bytes = await readFile(resolve('../docs', name));
  manifest.push([name, createHash('sha256').update(bytes).digest('hex')]);
  return JSON.parse(bytes);
};
const plan = await read('ml-reward-guidance-plan.json');
const model = await read(plan.model);
assert.equal(manifest.at(-1)[1], plan.modelHash);
const cases = [];
for (const item of plan.cases) {
  const name = `ml-reward-${item.id}.json`;
  const raw = await read(name);
  assert.equal(raw.seed, item.seed); assert.equal(raw.rewardModelHash, plan.modelHash);
  assert.ok(raw.validPair && raw.rewardTrial.validReplay && raw.rewardTrial.assignmentReachedExecutor);
  const [a, repeat, alternate, learned] = raw.replays;
  for (const key of ['followupStateFingerprint', 'taskOutcome', 'taskEvents', 'followup']) assert.deepEqual(a.event[key], repeat.event[key]);
  const decision = chooseRewardGuidedMacro({ policy: model.fit.policy, features: a.event.features,
    experiment: { enabled: true, now: a.event.second, lastAssignmentSecond: -Infinity,
      healthFraction: a.event.actorStart.hpFraction, dangerousFight: false, insideEnemyTower: false,
      objectiveFight: false, defending: false, influenceThreat: 0, survival: 1, enemyDistance: Infinity,
      incumbent: a.event.incumbent, selectionReason: 'utility', candidates: a.event.decisionCandidates, randomDraw: -1 } });
  assert.deepEqual(decision, learned.event.rewardDecision);
  assert.equal(learned.record.selected, decision.selected);
  const reference = decision.changed ? alternate : a;
  for (const key of ['followupStateFingerprint', 'taskOutcome', 'taskEvents', 'followup']) assert.deepEqual(learned.event[key], reference.event[key]);
  for (const arm of [a, alternate, learned]) assert.deepEqual(arm.event.taskOutcome,
    summarizeTaskOutcome({ second: arm.event.second, deaths: arm.event.actorStart.deaths },
      { second: arm.event.followup.second, deaths: arm.event.followup.actor.deaths }, arm.event.taskEvents ?? []));
  cases.push({ seed: item.seed, changed: decision.changed, predictedAdvantage: decision.predictedAdvantage,
    rewardDelta: learned.event.taskOutcome.reward-a.event.taskOutcome.reward,
    broaderOutcome: assessPairedOutcome(a, learned).classification });
}
assert.equal(cases.filter(c => c.changed).length, 1);
assert.ok(cases.find(c => c.seed === 97).rewardDelta < 0);
const authority = await read('ml-reward-authority-analysis.json');
const summary = { cases: cases.length, changed: cases.filter(c => c.changed).length,
  negative_changes: cases.filter(c => c.changed && c.rewardDelta < 0).length,
  total_reward_delta: cases.reduce((sum,c) => sum+c.rewardDelta,0),
  execution_and_outcomes_recomputed: true, promoted: false };
await writeFile(resolve(output), JSON.stringify({ scope: 'Historical regression reproduction, not new generalization evidence',
  method: 'Recompute frozen decision, task rewards, repeated controls, learned execution and broader rubric',
  summary, cases, authority, manifest }, null, 2)+'\n', { flag:'wx' });
console.log(JSON.stringify(summary));
