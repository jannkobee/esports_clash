import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitConfidenceTaskPolicy, TASK_CONFIDENCE_CONFIG } from '../src/taskConfidencePolicy.ts';
import { taskContextScore, TASK_CONTEXT_FIT } from '../src/taskContextPolicy.ts';
import { validTaskActionContext } from '../src/taskActionContext.ts';
import { chooseRewardGuidedMacro } from '../src/rewardMacroDecision.ts';
import { summarizeTaskOutcome } from '../src/taskOutcome.ts';
import { summarizeTeamTaskOutcome, TEAM_TASK_REWARD } from '../src/teamTaskOutcome.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';
import { summarizePairedBehavior } from './paired-behavior.mjs';

const command = process.argv[2], path = name => resolve('../docs', name);
const read = async name => JSON.parse(await readFile(path(name), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, value, exclusive = false) => writeFile(path(name), JSON.stringify(value, null, 2) + '\n',
  exclusive ? { flag: 'wx' } : {});
const planName = 'ml-confidence-plan.json', modelName = 'ml-confidence-candidate.json';
// Hash every runtime TS/TSX module, plus the collector, evaluator and runner inputs.
const sources = [...(await readdir('src', { recursive: true })).filter(file => /\.tsx?$/.test(file))
  .map(file => `src/${file.replaceAll('\\', '/')}`), 'scripts/confidence-task-study.mjs',
  'scripts/collect-confidence-shard.mjs', 'scripts/paired-live-rollout.mjs',
  'scripts/paired-outcome-rubric.mjs', 'scripts/paired-behavior.mjs', '../docs/ml-live-evaluation.json'].sort();
const sourceManifest = () => Promise.all(sources.map(async file => [file, hash(await readFile(resolve(file)))]));
const sourceHash = async () => hash(JSON.stringify(await sourceManifest()));

if (command === 'prepare') {
  const oldPlan = await read('ml-team-plan.json');
  const development = await Promise.all(oldPlan.cases.filter(item => item.split === 'train').map(async item => {
    const rawFile = `ml-team-${item.id}.json`;
    return { ...item, split: item.seed <= 152 ? 'fit' : 'calibration', rawFile,
      expectedRawHash: hash(await readFile(path(rawFile))) };
  }));
  assert.deepEqual(development.map(item => item.seed), Array.from({ length: 32 }, (_, i) => 137 + i));
  const cases = Array.from({ length: 16 }, (_, i) => {
    const seed = 185 + i, draft = Math.floor(i / 2) % 2, swapped = i % 2 === 1;
    assert.ok(!oldPlan.cases.some(item => item.seed === seed));
    return { id: `heldout-${seed}-d${draft}-${swapped ? 'swapped' : 'original'}`, split: 'heldout', seed, draft, swapped };
  });
  const manifest = await sourceManifest();
  const plan = { schema: 'confidence-task-v1', createdAt: new Date().toISOString(),
    sourceHash: hash(JSON.stringify(manifest)), sourceManifest: manifest,
    priorPlanHash: hash(await readFile(path('ml-team-plan.json'))),
    pair: 'farm-push', horizonSeconds: 30, scoutSeconds: 240,
    confidence: TASK_CONFIDENCE_CONFIG, fit: TASK_CONTEXT_FIT, reward: TEAM_TASK_REWARD,
    acceptance: { minimumValid: 12, minimumChanges: 3, minimumCoverage: .9,
      description: 'Positive total team reward; more material gains (>=0.02) than losses; no extra actor/allied-team death case or broader worse changed case. At least 90% observed lower-bound coverage on supported contexts. Zero changes is not success. Full-match evidence remains necessary.' },
    method: 'Fit only seeds 137-152; calibrate signed, unclipped overprediction on 153-168 with the fixed finite-sample one-sided quantile; never refit afterward. Reject unsupported push kinds and reverse direction. No confidence-level, buffer or threshold retuning on held-out outcomes.',
    collection: 'First eligible safe pair after 120 seconds. Retain all missing/invalid worlds. Freeze model and witness before fresh collection. Older held-out seeds 169-184 remain seen and are excluded.',
    comparator: 'Same proper-fit model with raw 0.02 threshold, computed from the forced paired arms. Diagnostic counterfactual comparator, not a separately executed learned arm.',
    development, cases };
  await write(planName, plan, true);
  console.log(JSON.stringify({ sourceHash: plan.sourceHash, fitting: 16, calibration: 16, fresh: cases.length }));
  process.exit(0);
}
const plan = await read(planName);
assert.equal(plan.sourceHash, await sourceHash(), 'Study sources changed after plan lock');
assert.deepEqual(plan.confidence, TASK_CONFIDENCE_CONFIG);
assert.deepEqual(plan.fit, TASK_CONTEXT_FIT); assert.deepEqual(plan.reward, TEAM_TASK_REWARD);
assert.equal(new Set([...plan.development, ...plan.cases].map(item => item.seed)).size, 48);
const rawName = item => item.rawFile ?? `ml-confidence-${item.id}.json`;

async function loadCase(item) {
  let bytes;
  try { bytes = await readFile(path(rawName(item))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { ...item, status: 'missing' }; }
  const rawHash = hash(bytes), raw = JSON.parse(bytes);
  if (item.expectedRawHash) assert.equal(rawHash, item.expectedRawHash);
  assert.equal(raw.seed, item.seed); assert.equal(raw.draft, item.draft);
  assert.equal(raw.swapped, item.swapped); assert.equal(raw.horizonSeconds, plan.horizonSeconds);
  assert.equal(raw.pairFilter, plan.pair);
  if (!raw.validPair) return { ...item, status: raw.scout?.event ? 'invalid-controls' : 'no-target', rawHash };
  const [a, repeat, b] = raw.replays;
  assert.ok([a, repeat, b].every(run => !run.rejected && run.event.matched && run.event.gate === null));
  for (const run of [a, repeat, b]) for (const key of ['actorId', 'second', 'fingerprint', 'cardId', 'incumbent', 'alternate'])
    assert.deepEqual(run.event[key], raw.scout.event[key]);
  assert.equal(a.event.followupStateFingerprint, repeat.event.followupStateFingerprint);
  for (const key of ['taskEvents', 'taskOutcome', 'teamStart', 'teamOutcome', 'followup', 'taskContext'])
    assert.deepEqual(a.event[key], repeat.event[key]);
  assert.deepEqual(a.record.snapshot, repeat.record.snapshot); assert.deepEqual(a.record.outcome, repeat.record.outcome);
  assert.equal(a.record.selected, a.event.incumbent); assert.equal(b.record.selected, a.event.alternate);
  assert.ok(validTaskActionContext(a.event.taskContext));
  assert.deepEqual(a.event.taskContext, b.event.taskContext); assert.deepEqual(a.event.taskContext, raw.scout.event.taskContext);
  assert.deepEqual(a.event.teamStart, b.event.teamStart); assert.deepEqual(a.event.teamStart, raw.scout.event.teamStart);
  for (const run of [a, b]) {
    assert.deepEqual(run.event.taskOutcome, summarizeTaskOutcome(
      { second: run.event.second, deaths: run.event.actorStart.deaths },
      { second: run.event.followup.second, deaths: run.event.followup.actor.deaths }, run.event.taskEvents ?? []));
    assert.deepEqual(run.event.teamOutcome, summarizeTeamTaskOutcome(run.event.teamStart,
      run.event.teamOutcome.end, run.event.taskOutcome));
    assert.equal(run.event.teamOutcome.horizonSeconds, run.event.taskOutcome.horizonSeconds);
    assert.equal(run.event.teamOutcome.end.second, run.event.followup.second);
    assert.equal(run.event.teamOutcome.end.ownStructureHp, run.event.followup.team.ownStructureHp);
    assert.equal(run.event.teamOutcome.end.enemyStructureHp, run.event.followup.team.enemyStructureHp);
  }
  const behavior = summarizePairedBehavior(a.event.behaviorTrace, b.event.behaviorTrace, a.event.second);
  assert.ok(behavior.incumbent.assignmentReachedExecutor && behavior.alternate.assignmentReachedExecutor);
  return { ...item, status: 'valid', validPair: true, cardId: a.event.cardId,
    incumbent: a.event.incumbent, alternate: a.event.alternate, taskContext: a.event.taskContext,
    control: a.event.teamOutcome, alternative: b.event.teamOutcome,
    rewardDelta: b.event.teamOutcome.reward - a.event.teamOutcome.reward, rawHash };
}
const development = await Promise.all(plan.development.map(loadCase));
assert.ok(development.every(item => item.status === 'valid'), 'All predeclared development worlds must validate');
const developmentHash = hash(JSON.stringify(development)), planHash = hash(JSON.stringify(plan));
if (command === 'freeze') {
  const fit = fitConfidenceTaskPolicy([...development, ...plan.cases]);
  assert.ok(fit.sufficient, 'Insufficient independent fitting/calibration evidence');
  const model = { method: 'Proper-fit team ridge with separate fixed one-sided empirical error buffer; no refit',
    planHash, sourceHash: plan.sourceHash, developmentHash, fit, promoted: false };
  await write(modelName, model, true);
  const modelHash = hash(await readFile(path(modelName)));
  await write('ml-confidence-freeze.json', { createdAt: new Date().toISOString(), modelHash,
    planHash, sourceHash: plan.sourceHash, developmentHash, evaluationCollected: false }, true);
  console.log(JSON.stringify({ modelHash, developmentHash, fitting: fit.fittingEpisodes,
    calibration: fit.calibrationEpisodes, errorBuffer: fit.policy.calibration.errorBuffer,
    supportedPushKinds: fit.policy.supportedPushKinds, properFit: { ...fit.fit, policy: undefined } }, null, 2));
} else if (command === 'analyze') {
  const model = await read(modelName), modelHash = hash(await readFile(path(modelName)));
  const witness = await read('ml-confidence-freeze.json');
  assert.equal(witness.modelHash, modelHash); assert.equal(witness.planHash, planHash);
  assert.equal(model.sourceHash, plan.sourceHash); assert.equal(model.planHash, planHash);
  assert.equal(model.developmentHash, developmentHash); assert.ok(model.fit.sufficient);
  assert.deepEqual(model.fit, fitConfidenceTaskPolicy([...development, ...plan.cases]));
  const reports = [];
  for (const item of plan.cases) {
    const example = await loadCase(item);
    if (example.status !== 'valid') { reports.push(example); continue; }
    const raw = await read(rawName(item)); assert.equal(raw.rewardModelHash, modelHash);
    const [a, , b, learned] = raw.replays;
    assert.ok(raw.rewardTrial?.validReplay && raw.rewardTrial.assignmentReachedExecutor);
    const input = { taskContext: a.event.taskContext, features: a.event.features,
      experiment: { enabled: true, now: a.event.second, lastAssignmentSecond: -Infinity,
        healthFraction: a.event.actorStart.hpFraction, dangerousFight: false, insideEnemyTower: false,
        objectiveFight: false, defending: false, influenceThreat: 0, survival: 1,
        enemyDistance: Infinity, incumbent: a.event.incumbent, selectionReason: 'utility',
        candidates: a.event.decisionCandidates, randomDraw: -1 } };
    const decision = chooseRewardGuidedMacro({ ...input, confidencePolicy: model.fit.policy });
    const unbuffered = chooseRewardGuidedMacro({ ...input, taskPolicy: model.fit.policy.policy });
    assert.deepEqual(decision, learned.event.rewardDecision); assert.equal(decision.margin, plan.confidence.margin);
    assert.equal(learned.record.selected, decision.selected); assert.ok(learned.event.matched && learned.event.gate === null);
    const reference = decision.selected === a.record.selected ? a : b;
    assert.equal(learned.event.followupStateFingerprint, reference.event.followupStateFingerprint);
    assert.deepEqual(learned.event.taskContext, a.event.taskContext);
    for (const key of ['actorId', 'second', 'fingerprint', 'cardId']) assert.equal(learned.event[key], a.event[key]);
    for (const key of ['taskOutcome', 'taskEvents', 'teamStart', 'teamOutcome', 'followup'])
      assert.deepEqual(learned.event[key], reference.event[key]);
    const prediction = taskContextScore(model.fit.policy.policy, 'push', example.taskContext)
      - taskContextScore(model.fit.policy.policy, 'farm', example.taskContext);
    const supported = Number.isFinite(decision.lowerBoundAdvantage);
    reports.push({ ...example, taskContext: undefined, changed: decision.changed, decision,
      pairedAlternateRewardDelta: example.rewardDelta,
      rewardDelta: learned.event.teamOutcome.reward - example.control.reward,
      deathDelta: learned.event.taskOutcome.deaths - example.control.actorTask.deaths,
      teamDeathDelta: learned.event.teamOutcome.ownDeaths - example.control.ownDeaths,
      predictionError: (prediction - example.rewardDelta) ** 2, zeroPredictionError: example.rewardDelta ** 2,
      supported, covered: supported ? example.rewardDelta >= decision.lowerBoundAdvantage : null,
      unbuffered: { changed: unbuffered.changed, rewardDelta: unbuffered.changed ? example.rewardDelta : 0,
        deathDelta: unbuffered.changed ? example.alternative.actorTask.deaths - example.control.actorTask.deaths : 0,
        teamDeathDelta: unbuffered.changed ? example.alternative.ownDeaths - example.control.ownDeaths : 0,
        rubric: assessPairedOutcome(a, unbuffered.changed ? b : a).classification },
      rubric: assessPairedOutcome(a, learned) });
  }
  const valid = reports.filter(item => item.status === 'valid'), supported = valid.filter(item => item.supported);
  const summarize = rows => ({ changed: rows.filter(item => item.changed).length,
    improved: rows.filter(item => item.rewardDelta >= .02).length, worsened: rows.filter(item => item.rewardDelta <= -.02).length,
    rewardDelta: rows.reduce((sum, item) => sum + item.rewardDelta, 0),
    deathDelta: rows.reduce((sum, item) => sum + item.deathDelta, 0), extraDeathCases: rows.filter(item => item.deathDelta > 0).length,
    teamDeathDelta: rows.reduce((sum, item) => sum + item.teamDeathDelta, 0), extraTeamDeathCases: rows.filter(item => item.teamDeathDelta > 0).length });
  const summary = { planned: reports.length, valid: valid.length, ...summarize(valid),
    broaderWorse: valid.filter(item => item.changed && ['worse', 'survival-worsened'].includes(item.rubric.classification)).length,
    supported: supported.length, covered: supported.filter(item => item.covered).length,
    coverage: supported.length ? supported.filter(item => item.covered).length / supported.length : null,
    predictionLoss: valid.length ? valid.reduce((sum, item) => sum + item.predictionError, 0) / valid.length : null,
    zeroPredictionLoss: valid.length ? valid.reduce((sum, item) => sum + item.zeroPredictionError, 0) / valid.length : null,
    unbuffered: summarize(valid.map(item => item.unbuffered)) };
  const passesExploratoryGate = summary.valid >= plan.acceptance.minimumValid
    && summary.changed >= plan.acceptance.minimumChanges && summary.rewardDelta > 0
    && summary.improved > summary.worsened && !summary.extraDeathCases && !summary.extraTeamDeathCases
    && !summary.broaderWorse && summary.coverage >= plan.acceptance.minimumCoverage;
  await write('ml-confidence-analysis.json', { planHash, modelHash, developmentHash, summary,
    passesExploratoryGate, reports, promoted: false,
    limits: 'Two drafts; first eligible 30-second safe farm/push windows only. Pooled empirical calibration is not individual/card/subgroup safety or a full-match guarantee. No held-out tuning.' });
  console.log(JSON.stringify({ summary, passesExploratoryGate }, null, 2));
} else throw Error('Expected prepare, freeze or analyze');
