import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { summarizeTaskOutcome } from '../src/taskOutcome.ts';
import { chooseRewardGuidedMacro } from '../src/rewardMacroDecision.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';

const read = async name => JSON.parse(await readFile(resolve('../docs', name), 'utf8'));
const plan = await read('ml-reward-guidance-plan.json');
const modelText = await readFile(resolve('../docs', plan.model), 'utf8');
assert.equal(createHash('sha256').update(modelText).digest('hex'), plan.modelHash);
const model = JSON.parse(modelText);
assert.equal(model.trainingHash, plan.trainingHash);
const priorPlan = await read('ml-task-outcome-plan.json');
const previousSeeds = new Set(priorPlan.cases.map(item => item.seed));
assert.ok(plan.cases.every(item => !previousSeeds.has(item.seed)), 'Fresh test leaked prior worlds');
const smoke = await read('ml-reward-smoke-87-original.json');
const known = await read('ml-task-heldout-87-d0-original.json');
assert.equal(smoke.rewardModelHash, plan.modelHash);
assert.equal(smoke.scout.event.fingerprint, known.scout.event.fingerprint);
assert.ok(smoke.validPair && smoke.rewardTrial.validReplay && smoke.rewardTrial.assignmentReachedExecutor);
assert.equal(smoke.rewardTrial.decision.changed, true);
const integrationCheck = { source: 'ml-reward-smoke-87-original.json', excludedFromFreshStudy: true,
  sameKnownPredecisionState: true, selected: smoke.rewardTrial.selected,
  decision: smoke.rewardTrial.decision, assignmentReachedExecutor: true,
  validReplay: true, rubric: assessPairedOutcome(smoke.replays[0], smoke.replays[3]) };
const reports = [];
for (const item of plan.cases) {
  const source = `ml-reward-${item.id}.json`;
  let raw;
  try { raw = await read(source); } catch { reports.push({ ...item, source, status: 'missing' }); continue; }
  assert.equal(raw.seed, item.seed); assert.equal(raw.draft, item.draft); assert.equal(raw.swapped, item.swapped);
  assert.equal(raw.horizonSeconds, plan.horizonSeconds); assert.equal(raw.rewardModelHash, plan.modelHash);
  if (!raw.validPair || !raw.rewardTrial?.validReplay) {
    reports.push({ ...item, source, status: !raw.scout?.event ? 'no-target' : 'invalid-replay',
      reason: raw.scout?.rejected }); continue;
  }
  const [a, repeat, alternate, learned] = raw.replays;
  assert.ok([a, repeat, alternate, learned].every(run => run.event.matched && run.event.gate === null && !run.rejected));
  assert.equal(a.event.followupStateFingerprint, repeat.event.followupStateFingerprint);
  assert.deepEqual(a.event.followup, repeat.event.followup);
  assert.deepEqual(a.record.outcome, repeat.record.outcome);
  assert.deepEqual(a.event.taskEvents, repeat.event.taskEvents);
  assert.deepEqual(a.event.taskOutcome, repeat.event.taskOutcome);
  const decision = learned.event.rewardDecision;
  assert.equal(decision.margin, plan.minimumPredictedRewardAdvantage);
  assert.equal(learned.record.selected, decision.selected);
  assert.equal(raw.rewardTrial.assignmentReachedExecutor, true);
  const reference = decision.selected === a.record.selected ? a : alternate;
  assert.equal(learned.event.followupStateFingerprint, reference.event.followupStateFingerprint);
  assert.deepEqual(learned.event.followup, reference.event.followup);
  assert.deepEqual(learned.record.outcome, reference.record.outcome);
  assert.deepEqual(learned.event.taskEvents, reference.event.taskEvents);
  const hypothetical = chooseRewardGuidedMacro({ policy: model.fit.policy,
    features: a.event.features, experiment: {
      enabled: true, now: a.event.second, lastAssignmentSecond: -Infinity,
      healthFraction: a.event.actorStart.hpFraction, dangerousFight: false,
      insideEnemyTower: false, objectiveFight: false, defending: false,
      influenceThreat: 0, survival: 1, enemyDistance: Infinity,
      incumbent: a.event.incumbent, selectionReason: 'utility',
      candidates: a.event.decisionCandidates, randomDraw: -1,
    } });
  assert.deepEqual(decision, hypothetical, 'Actual model choice differs from frozen decision rule');
  for (const run of [a, alternate, learned]) {
    const expected = summarizeTaskOutcome({ second: run.event.second, deaths: run.event.actorStart.deaths },
      { second: run.event.followup.second, deaths: run.event.followup.actor.deaths }, run.event.taskEvents ?? []);
    assert.deepEqual(expected, run.event.taskOutcome);
    assert.ok(expected.horizonSeconds >= 30 && expected.horizonSeconds <= 30.1);
  }
  const rewardDelta = learned.event.taskOutcome.reward - a.event.taskOutcome.reward;
  const deathDelta = learned.event.taskOutcome.deaths - a.event.taskOutcome.deaths;
  reports.push({ ...item, source, status: 'valid', cardId: a.event.cardId, second: a.event.second,
    decision, executedAction: learned.record.selected, changed: learned.record.selected !== a.record.selected,
    incumbentTask: a.event.taskOutcome, learnedTask: learned.event.taskOutcome,
    rewardDelta, deathDelta, rubric: assessPairedOutcome(a, learned) });
}
const valid = reports.filter(item => item.status === 'valid');
const summary = { planned: plan.cases.length, valid: valid.length,
  noTarget: reports.filter(item => item.status === 'no-target').length,
  invalidReplay: reports.filter(item => item.status === 'invalid-replay').length,
  changedChoices: valid.filter(item => item.changed).length,
  improvedTask: valid.filter(item => item.rewardDelta >= .02).length,
  worsenedTask: valid.filter(item => item.rewardDelta <= -.02).length,
  unchangedTask: valid.filter(item => Math.abs(item.rewardDelta) < .02).length,
  totalRewardDelta: valid.reduce((sum, item) => sum + item.rewardDelta, 0),
  totalDeathDelta: valid.reduce((sum, item) => sum + item.deathDelta, 0),
  casesWithExtraDeaths: valid.filter(item => item.deathDelta > 0).length,
  casesWithFewerDeaths: valid.filter(item => item.deathDelta < 0).length };
const output = { method: 'Frozen learned ranking drives an actual fourth browser replay inside unchanged safe experimental gates; validate it against the same-action continuation before assessing outcomes',
  plan, summary, integrationCheck, reports, promoted: false,
  limits: 'Eight exploratory first-choice windows, not a full-match policy trial or a safety guarantee. No model refit or threshold tuning on these worlds. Noneligible and invalid cases remain in the denominator.' };
await writeFile(resolve('../docs/ml-reward-guidance-analysis.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ summary, reports }, null, 2));
