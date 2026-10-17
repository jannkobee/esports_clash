import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adaptivePolicyScore } from '../src/adaptivePolicy.ts';
import { chooseMacroAction } from '../src/macroActionDecision.ts';
import { fitPairedTaskPolicy } from '../src/pairedTaskLearning.ts';
import { summarizeTaskOutcome } from '../src/taskOutcome.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';

const read = async name => JSON.parse(await readFile(resolve('../docs', name), 'utf8'));
const plan = await read('ml-task-outcome-plan.json');
assert.equal(new Set(plan.cases.map(item => item.seed)).size, plan.cases.length, 'Training/held-out seeds overlap');
const prior = (await read('ml-live-evaluation.json')).train.endingPolicy;
const trainCases = plan.cases.filter(item => item.split === 'train');
if (process.argv.includes('--wait-training')) {
  for (;;) {
    let collection;
    try { collection = await read('ml-task-collection.json'); } catch {}
    if (trainCases.every(item => collection?.results.some(result => result.id === item.id))) break;
    await new Promise(done => setTimeout(done, 1000));
  }
}

async function loadCase(item) {
  const source = `ml-task-${item.id}.json`;
  let raw;
  try { raw = await read(source); } catch { return { ...item, source, status: 'missing' }; }
  assert.equal(raw.seed, item.seed);
  assert.equal(raw.draft, item.draft);
  assert.equal(raw.swapped, item.swapped);
  assert.equal(raw.horizonSeconds, plan.horizonSeconds);
  if (!raw.validPair) return { ...item, source, status: raw.scout?.event ? 'invalid-controls'
    : 'no-target', reason: raw.scout?.rejected, second: raw.scout?.inspection?.second };
  const [a, repeat, b] = raw.replays;
  assert.ok([a, repeat, b].every(run => !run.rejected && run.event.matched));
  assert.equal(a.event.followupStateFingerprint, repeat.event.followupStateFingerprint);
  assert.deepEqual(a.record.outcome, repeat.record.outcome);
  assert.deepEqual(a.record.snapshot, repeat.record.snapshot);
  assert.deepEqual(a.event.followup, repeat.event.followup);
  assert.deepEqual(a.event.taskEvents, repeat.event.taskEvents);
  assert.deepEqual(a.event.taskOutcome, repeat.event.taskOutcome);
  assert.equal(a.record.selected, raw.scout.event.incumbent);
  assert.equal(b.record.selected, raw.scout.event.alternate);
  for (const run of [a, b]) {
    const expected = summarizeTaskOutcome({ second: run.event.second, deaths: run.event.actorStart.deaths },
      { second: run.event.followup.second, deaths: run.event.followup.actor.deaths }, run.event.taskEvents ?? []);
    assert.deepEqual(run.event.taskOutcome, expected);
    assert.ok(expected.horizonSeconds >= 30 && expected.horizonSeconds <= 30.1);
  }
  assert.equal(a.event.taskOutcome.horizonSeconds, b.event.taskOutcome.horizonSeconds);
  return { ...item, source, status: 'valid', second: a.event.second, cardId: a.event.cardId,
    validPair: true, incumbent: a.event.incumbent, alternate: a.event.alternate,
    features: a.event.features, candidates: a.event.decisionCandidates,
    control: a.event.taskOutcome, alternative: b.event.taskOutcome,
    rewardDelta: b.event.taskOutcome.reward - a.event.taskOutcome.reward,
    rubric: assessPairedOutcome(a, b) };
}
const training = await Promise.all(trainCases.map(loadCase));
const trainingHash = createHash('sha256').update(JSON.stringify(training)).digest('hex');
const candidatePath = resolve('../docs/ml-task-candidate.json');
if (process.argv.includes('--freeze')) {
  const fit = fitPairedTaskPolicy(prior, training.filter(item => item.status === 'valid'));
  const frozen = { method: 'Offline-only card-aware paired task reward regression; frozen from training worlds only',
    plan, trainingHash, fit, promoted: false };
  await writeFile(candidatePath, JSON.stringify(frozen, null, 2) + '\n');
  console.log(JSON.stringify({ candidatePath, ...fit, policy: undefined }));
} else {
  const frozen = await read('ml-task-candidate.json');
  assert.equal(frozen.trainingHash, trainingHash, 'Frozen training data changed');
  assert.deepEqual(frozen.plan, plan, 'Collection/fit plan changed after freeze');
  const policy = frozen.fit.policy;
  const heldout = await Promise.all(plan.cases.filter(item => item.split === 'heldout').map(loadCase));
  const choose = (model, item) => chooseMacroAction({ actorAvailable: true, now: item.second,
    candidates: item.candidates.map(candidate => ({ ...candidate,
      factors: { ...candidate.factors, learned: adaptivePolicyScore(model, candidate.action, item.features) } })) }).selected?.value;
  const evaluated = heldout.map(item => {
    if (item.status !== 'valid') return item;
    assert.equal(choose(prior, item), item.incumbent, 'Baseline selection does not reproduce held-out checkpoint');
    const selected = choose(policy, item);
    const outcome = selected === item.incumbent ? item.control : selected === item.alternate ? item.alternative : undefined;
    const target = Math.max(-.5, Math.min(.5, item.rewardDelta));
    const predict = model => adaptivePolicyScore(model, item.alternate, item.features)
      - adaptivePolicyScore(model, item.incumbent, item.features);
    return { ...item, selected, changed: selected !== item.incumbent, supported: !!outcome,
      candidateRewardDelta: outcome ? outcome.reward - item.control.reward : null,
      candidateDeathDelta: outcome ? outcome.deaths - item.control.deaths : null,
      baselinePredictionError: (predict(prior) - target) ** 2,
      candidatePredictionError: (predict(policy) - target) ** 2 };
  });
  const totals = { planned: plan.cases.length, validTraining: training.filter(item => item.status === 'valid').length,
    informativeTraining: frozen.fit.informativeEpisodes,
    validHeldout: evaluated.filter(item => item.status === 'valid').length,
    heldoutChoiceChanges: evaluated.filter(item => item.changed).length,
    heldoutUnsupportedChoices: evaluated.filter(item => item.status === 'valid' && !item.supported).length,
    heldoutRewardDelta: evaluated.reduce((sum, item) => sum + (item.candidateRewardDelta ?? 0), 0),
    heldoutDeathDelta: evaluated.reduce((sum, item) => sum + (item.candidateDeathDelta ?? 0), 0) };
  const validHeldout = evaluated.filter(item => item.status === 'valid');
  totals.baselineHeldoutPredictionLoss = validHeldout.length ? validHeldout.reduce((sum, item) =>
    sum + item.baselinePredictionError, 0) / validHeldout.length : null;
  totals.candidateHeldoutPredictionLoss = validHeldout.length ? validHeldout.reduce((sum, item) =>
    sum + item.candidatePredictionError, 0) / validHeldout.length : null;
  totals.zeroHeldoutPredictionLoss = validHeldout.length ? validHeldout.reduce((sum, item) =>
    sum + Math.max(-.5, Math.min(.5, item.rewardDelta)) ** 2, 0) / validHeldout.length : null;
  const output = { method: 'Predeclared matched thirty-second task outcomes; candidate frozen from disjoint training seeds; held-out policy selection evaluated only over already-legal captured actions',
    plan, trainingHash, fit: frozen.fit, totals, training, heldout: evaluated,
    limits: 'Small exploratory deterministic simulation sample. Thirty seconds can still miss a camp clear. Reward coefficients are authored proxies, not match-win labels. Held-out action checks are not a full-match policy trial. No live promotion.',
    promoted: false };
  await writeFile(resolve('../docs/ml-task-outcome-analysis.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ totals, sufficient: frozen.fit.sufficient, changed: frozen.fit.changed,
    initialLoss: frozen.fit.initialLoss, fittedLoss: frozen.fit.fittedLoss,
    training: training.map(({ candidates, features, ...item }) => item),
    heldout: evaluated.map(({ candidates, features, ...item }) => item) }, null, 2));
}
