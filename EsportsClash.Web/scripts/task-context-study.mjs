import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitTaskContextPolicy, taskContextScore, TASK_CONTEXT_FIT } from '../src/taskContextPolicy.ts';
import { validTaskActionContext } from '../src/taskActionContext.ts';
import { chooseRewardGuidedMacro } from '../src/rewardMacroDecision.ts';
import { summarizeTaskOutcome } from '../src/taskOutcome.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';
import { summarizePairedBehavior } from './paired-behavior.mjs';

const command = process.argv[2];
const path = name => resolve('../docs', name);
const read = async name => JSON.parse(await readFile(path(name), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const write = async (name, value, exclusive = false) => writeFile(path(name), JSON.stringify(value, null, 2) + '\n',
  exclusive ? { flag: 'wx' } : {});
const sources = ['src/taskActionContext.ts', 'src/taskContextPolicy.ts', 'src/rewardMacroDecision.ts',
  'src/pairedMacroReplay.ts', 'src/components/AramMatchView.tsx', 'scripts/paired-live-rollout.mjs',
  'scripts/task-context-study.mjs'];
const sourceHash = async () => hash(JSON.stringify(await Promise.all(sources.map(async file =>
  [file, hash(await readFile(resolve(file)))]))));
const planName = 'ml-context-v2-plan.json', modelName = 'ml-context-v2-candidate.json';
if (command === 'prepare') {
  const seen = new Set([
    ...(await read('ml-task-outcome-plan.json')).cases,
    ...(await read('ml-reward-guidance-plan.json')).cases,
  ].map(item => item.seed));
  const cases = Array.from({ length: 36 }, (_, i) => {
    const seed = 101 + i, split = i < 24 ? 'train' : 'heldout', draft = Math.floor(i / 2) % 2;
    assert.ok(!seen.has(seed));
    return { id: `${split}-${seed}-d${draft}-${i % 2 ? 'swapped' : 'original'}`,
      split, seed, draft, swapped: i % 2 === 1 };
  });
  const plan = { schema: 'action-specific-task-v1', sourceHash: await sourceHash(),
    pair: 'farm-push', horizonSeconds: 30, scoutSeconds: 240,
    minimumPredictedRewardAdvantage: .02, fit: TASK_CONTEXT_FIT,
    acceptance: 'Exploratory positive evidence requires at least 8 valid held-out cases, at least 2 changed choices, positive total reward, more improved than worsened cases, zero added deaths, and no changed case rated worse by the broader rubric. This is not approval for full-match deployment.',
    collection: 'First naturally eligible safe farm/push pair after 120s in each world; retain missing/invalid cases. Freeze training-only model before collecting any held-out outcomes. No retuning.',
    cases };
  await write(planName, plan, true); console.log(JSON.stringify(plan));
  process.exit(0);
}
const plan = await read(planName);
let approvedSourceHash = plan.sourceHash;
try {
  const amendment = await read('ml-context-v2-source-amendment.json');
  assert.equal(amendment.originalSourceHash, plan.sourceHash);
  assert.equal(amendment.planHash, hash(JSON.stringify(plan)));
  approvedSourceHash = amendment.correctedSourceHash;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(approvedSourceHash, await sourceHash(), 'Study sources changed after plan lock; create a new study');
assert.equal(new Set(plan.cases.map(item => item.seed)).size, plan.cases.length);
const rawName = item => `ml-context-v2-${item.id}.json`;

async function loadCase(item) {
  let raw;
  try { raw = await read(rawName(item)); }
  catch { return { ...item, status: 'missing' }; }
  assert.equal(raw.seed, item.seed); assert.equal(raw.draft, item.draft);
  assert.equal(raw.swapped, item.swapped); assert.equal(raw.horizonSeconds, plan.horizonSeconds);
  if (!raw.validPair) return { ...item, status: raw.scout?.event ? 'invalid-controls' : 'no-target' };
  const [a, repeat, b] = raw.replays;
  assert.ok([a, repeat, b].every(run => !run.rejected && run.event.matched && run.event.gate === null));
  assert.equal(a.event.followupStateFingerprint, repeat.event.followupStateFingerprint);
  for (const key of ['taskEvents', 'taskOutcome', 'followup', 'taskContext']) assert.deepEqual(a.event[key], repeat.event[key]);
  assert.deepEqual(a.record.snapshot, repeat.record.snapshot); assert.deepEqual(a.record.outcome, repeat.record.outcome);
  assert.equal(a.record.selected, a.event.incumbent); assert.equal(b.record.selected, a.event.alternate);
  assert.ok(validTaskActionContext(a.event.taskContext));
  assert.deepEqual(a.event.taskContext, b.event.taskContext, 'Context is not predecision-only');
  assert.deepEqual(a.event.taskContext, raw.scout.event.taskContext);
  for (const run of [a, b]) {
    assert.deepEqual(run.event.taskOutcome, summarizeTaskOutcome(
      { second: run.event.second, deaths: run.event.actorStart.deaths },
      { second: run.event.followup.second, deaths: run.event.followup.actor.deaths }, run.event.taskEvents ?? []));
  }
  const behavior = summarizePairedBehavior(a.event.behaviorTrace, b.event.behaviorTrace, a.event.second);
  assert.ok(behavior.incumbent.assignmentReachedExecutor && behavior.alternate.assignmentReachedExecutor);
  return { ...item, status: 'valid', validPair: true, cardId: a.event.cardId,
    incumbent: a.event.incumbent, alternate: a.event.alternate, taskContext: a.event.taskContext,
    control: a.event.taskOutcome, alternative: b.event.taskOutcome,
    rewardDelta: b.event.taskOutcome.reward - a.event.taskOutcome.reward,
    rawHash: hash(await readFile(path(rawName(item)))) };
}
const trainingCases = plan.cases.filter(item => item.split === 'train');
if (command === 'collect') {
  const split = process.argv.find(arg => arg.startsWith('--split='))?.slice(8);
  assert.ok(['train', 'heldout'].includes(split), 'Explicit --split=train or heldout required');
  let modelHash;
  if (split === 'heldout') {
    const model = await read(modelName);
    assert.equal(model.sourceHash, approvedSourceHash);
    assert.equal(model.planHash, hash(JSON.stringify(plan))); assert.ok(model.fit.sufficient);
    assert.equal(model.trainingHash, hash(JSON.stringify(await Promise.all(trainingCases.map(loadCase)))));
    modelHash = hash(await readFile(path(modelName)));
  }
  const results = [];
  for (const item of plan.cases.filter(item => item.split === split)) {
    const output = path(rawName(item));
    let exists = false;
    try { await readFile(output); exists = true; } catch {}
    if (!exists) {
      const args = ['scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout',
        `--seed=${item.seed}`, `--draft=${item.draft}`, `--pair=${plan.pair}`, `--horizon=${plan.horizonSeconds}`,
        `--scout-seconds=${plan.scoutSeconds}`, `--output=${output}`];
      if (!item.swapped) args.push('--original');
      if (split === 'heldout') args.push(`--reward-model=${path(modelName)}`);
      console.log(`Collecting ${item.id}`);
      await new Promise(done => execFile(process.execPath, args, { env: process.env, timeout: 240000,
        maxBuffer: 4 * 1024 * 1024 }, error => {
        if (error) console.log(`Runner ${item.id}: ${error.code ?? error.message}`);
        done();
      }));
    }
    const result = await loadCase(item);
    if (split === 'heldout' && result.status === 'valid')
      assert.equal((await read(rawName(item))).rewardModelHash, modelHash);
    results.push({ ...item, status: result.status, cardId: result.cardId, rewardDelta: result.rewardDelta });
    await write(`ml-context-v2-${split}-collection.json`, { planHash: hash(JSON.stringify(plan)), modelHash, results });
    console.log(JSON.stringify(results.at(-1)));
  }
} else if (command === 'freeze') {
  const training = await Promise.all(trainingCases.map(loadCase));
  assert.ok(training.every(item => item.status !== 'missing'), 'Complete the predeclared training collection first');
  // Even malformed/duplicate training cases cannot claim a held-out seed.
  const heldoutGuards = plan.cases.filter(item => item.split === 'heldout');
  const fit = fitTaskContextPolicy([...training, ...heldoutGuards]);
  const model = { method: 'Frozen action-specific paired task ridge regression; independent training worlds only',
    planHash: hash(JSON.stringify(plan)), sourceHash: approvedSourceHash,
    trainingHash: hash(JSON.stringify(training)), fit, promoted: false };
  await write(modelName, model, true);
  console.log(JSON.stringify({ ...model, fit: { ...fit, policy: undefined } }));
} else if (command === 'analyze') {
  const model = await read(modelName), modelHash = hash(await readFile(path(modelName)));
  assert.equal(model.sourceHash, approvedSourceHash);
  assert.equal(model.planHash, hash(JSON.stringify(plan))); assert.ok(model.fit.sufficient);
  const training = await Promise.all(trainingCases.map(loadCase));
  assert.equal(model.trainingHash, hash(JSON.stringify(training)));
  const reports = [];
  for (const item of plan.cases.filter(item => item.split === 'heldout')) {
    const example = await loadCase(item);
    if (example.status !== 'valid') { reports.push(example); continue; }
    const raw = await read(rawName(item)); assert.equal(raw.rewardModelHash, modelHash);
    const [a, , b, learned] = raw.replays;
    assert.ok(raw.rewardTrial?.validReplay && raw.rewardTrial.assignmentReachedExecutor);
    const decision = chooseRewardGuidedMacro({ taskPolicy: model.fit.policy, taskContext: a.event.taskContext,
      features: a.event.features, experiment: { enabled: true, now: a.event.second,
        lastAssignmentSecond: -Infinity, healthFraction: a.event.actorStart.hpFraction,
        dangerousFight: false, insideEnemyTower: false, objectiveFight: false, defending: false,
        influenceThreat: 0, survival: 1, enemyDistance: Infinity, incumbent: a.event.incumbent,
        selectionReason: 'utility', candidates: a.event.decisionCandidates, randomDraw: -1 } });
    assert.deepEqual(decision, learned.event.rewardDecision); assert.equal(decision.margin, plan.minimumPredictedRewardAdvantage);
    assert.equal(learned.record.selected, decision.selected); assert.ok(learned.event.matched);
    const reference = decision.selected === a.record.selected ? a : b;
    assert.equal(learned.event.followupStateFingerprint, reference.event.followupStateFingerprint);
    assert.deepEqual(learned.event.taskContext, a.event.taskContext);
    for (const key of ['taskOutcome', 'taskEvents', 'followup']) assert.deepEqual(learned.event[key], reference.event[key]);
    const prediction = taskContextScore(model.fit.policy, example.alternate, example.taskContext)
      - taskContextScore(model.fit.policy, example.incumbent, example.taskContext);
    reports.push({ ...example, taskContext: undefined,
      changed: decision.changed, decision, rewardDelta: learned.event.taskOutcome.reward - example.control.reward,
      deathDelta: learned.event.taskOutcome.deaths - example.control.deaths,
      predictionError: (prediction - Math.max(-1, Math.min(1, example.rewardDelta))) ** 2,
      zeroPredictionError: Math.max(-1, Math.min(1, example.rewardDelta)) ** 2,
      rubric: assessPairedOutcome(a, learned) });
  }
  const valid = reports.filter(item => item.status === 'valid');
  const summary = { planned: reports.length, valid: valid.length, changed: valid.filter(item => item.changed).length,
    improved: valid.filter(item => item.rewardDelta >= .02).length,
    worsened: valid.filter(item => item.rewardDelta <= -.02).length,
    rewardDelta: valid.reduce((sum, item) => sum + item.rewardDelta, 0),
    deathDelta: valid.reduce((sum, item) => sum + item.deathDelta, 0),
    extraDeathCases: valid.filter(item => item.deathDelta > 0).length,
    broaderWorse: valid.filter(item => item.changed && ['worse', 'survival-worsened'].includes(item.rubric.classification)).length,
    predictionLoss: valid.length ? valid.reduce((sum, item) => sum + item.predictionError, 0) / valid.length : null,
    zeroPredictionLoss: valid.length ? valid.reduce((sum, item) => sum + item.zeroPredictionError, 0) / valid.length : null };
  const passesExploratoryGate = summary.valid >= 8 && summary.changed >= 2 && summary.rewardDelta > 0
    && summary.improved > summary.worsened && summary.extraDeathCases === 0 && summary.broaderWorse === 0;
  await write('ml-context-v2-analysis.json', { plan, modelHash, trainingHash: model.trainingHash,
    fit: model.fit, summary, passesExploratoryGate, reports, promoted: false,
    limits: 'First-choice 30-second proxy windows only, two fixed drafts, approximate route and basic-attack clear time. No full-match improvement or safety guarantee. No tuning on these held-out outcomes.' });
  console.log(JSON.stringify({ summary, passesExploratoryGate, reports }, null, 2));
} else throw Error('Expected prepare, collect --split=train|heldout, freeze, or analyze');
