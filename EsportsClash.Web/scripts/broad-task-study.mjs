import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { INITIAL_PLAYERS, CHAMPIONS } from '../src/mockData.ts';
import { buildPairedStudyDraft } from '../src/pairedStudyDraft.ts';
import { fitTeamTaskContextPolicy, TASK_CONTEXT_FIT } from '../src/taskContextPolicy.ts';
import { fitConfidenceTaskPolicy, TASK_CONFIDENCE_CONFIG } from '../src/taskConfidencePolicy.ts';
import { chooseRewardGuidedMacro } from '../src/rewardMacroDecision.ts';
import { TEAM_TASK_REWARD } from '../src/teamTaskOutcome.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';
import { path, hash, read, write, rawName, manifest, verifySources, loadCase, coverage } from './broad-study-evidence.mjs';

const command = process.argv[2], planName = 'ml-broad-plan.json', properName = 'ml-broad-proper-fit.json', modelName = 'ml-broad-candidate.json';
if (command === 'prepare') {
  const seen = new Set();
  for (const file of (await readdir('../docs')).filter(file => /^ml-.*plan\.json$/.test(file))) {
    const old = await read(file);
    for (const item of [...old.cases ?? [], ...old.development ?? []]) if (item.seed) seen.add(item.seed);
  }
  let seed = 1001;
  const cases = [];
  for (const split of ['fit', 'calibration', 'heldout']) for (let draft = 2; draft < 10; draft++)
    for (const afterSeconds of [120, 360, 600]) for (const swapped of split === 'fit' ? [false, true]
      : [Boolean((draft + afterSeconds / 120 + Number(split === 'heldout')) % 2)]) {
      assert.ok(!seen.has(seed), 'A planned world has already been seen');
      cases.push({ id: `${split}-${seed}-d${draft}-after${afterSeconds}-${swapped ? 'swapped' : 'original'}`,
        seed: seed++, split, draft, afterSeconds, scoutSeconds: afterSeconds + 120, swapped });
    }
  const drafts = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 2),
    buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, i + 2).map(({ player, champion }) => ({ playerId: player.id, championId: champion.id }))]));
  const sourceManifest = await manifest();
  const plan = { schema: 'broad-task-v1', createdAt: new Date().toISOString(), sourceManifest,
    sourceHash: hash(JSON.stringify(sourceManifest)), cases, drafts, pair: 'farm-push', horizonSeconds: 30,
    confidence: TASK_CONFIDENCE_CONFIG, fit: TASK_CONTEXT_FIT, reward: TEAM_TASK_REWARD,
    acceptance: { minimumValid: 18, minimumChanges: 4, minimumCoverage: .9,
      description: 'Prediction MSE must beat zero-contrast; positive team reward; more material gains (>=0.02) than losses; zero extra actor or allied-team death cases; zero broader worse changes. Useful overrides required before full-match evaluation. No deployment authority.' },
    method: '48 proper-fit, 24 calibration and 24 held-out independent worlds; eight role-aware drafts covering all 64 roster identities, three scout starts, both sides balanced per split. Freeze proper weights before calibration collection and calibrated model/witness before held-out collection. No retuning. Missing/invalid contexts retained, no replacements.',
    scope: 'Existing safe close farm/push pair only. No forced combat exploration, new vision, gate relaxation, or normal-match policy changes.' };
  await write(planName, plan, true); console.log(JSON.stringify({ planned: cases.length, sourceHash: plan.sourceHash, casesPerSplit: { fit: 48, calibration: 24, heldout: 24 } }));
  process.exit(0);
}
const plan = await read(planName); await verifySources(plan);
assert.deepEqual(plan.confidence, TASK_CONFIDENCE_CONFIG); assert.deepEqual(plan.fit, TASK_CONTEXT_FIT);
assert.deepEqual(plan.reward, TEAM_TASK_REWARD); assert.equal(new Set(plan.cases.map(item => item.seed)).size, plan.cases.length);
const planHash = hash(JSON.stringify(plan)), cases = await Promise.all(plan.cases.map(item => loadCase(item, plan)));
const proper = cases.filter(item => item.split === 'fit'), calibration = cases.filter(item => item.split === 'calibration');
const unseen = async split => { for (const item of plan.cases.filter(item => item.split === split)) {
  let exists = true; try { await access(path(rawName(item))); } catch (error) { if (error.code !== 'ENOENT') throw error; exists = false; }
  assert.equal(exists, false, `Freeze must precede any ${split} outcome file`);
} };
if (command === 'status') {
  const report = { planHash, sourceHash: plan.sourceHash, coverage: coverage(cases), cases: cases.map(({ taskContext, control, alternative, ...item }) => item), promoted: false };
  await write('ml-broad-collection.json', report); console.log(JSON.stringify(report.coverage, null, 2));
} else if (command === 'fit') {
  await unseen('calibration'); await unseen('heldout');
  assert.ok(proper.every(item => item.status !== 'missing'), 'Finish every predeclared proper-fit world first');
  const fit = fitTeamTaskContextPolicy(proper.map(item => ({ ...item, split: 'train' })));
  assert.ok(fit.sufficient); const artifact = { createdAt: new Date().toISOString(), planHash,
    sourceHash: plan.sourceHash, properHash: hash(JSON.stringify(proper)), fit, promoted: false };
  await write(properName, artifact, true); console.log(JSON.stringify({ properHash: artifact.properHash, fit: { ...fit, policy: undefined } }));
} else if (command === 'freeze') {
  await unseen('heldout'); const fitted = await read(properName);
  assert.equal(fitted.planHash, planHash); assert.equal(fitted.properHash, hash(JSON.stringify(proper)));
  assert.ok(calibration.every(item => item.status !== 'missing'), 'Finish every predeclared calibration world first');
  const fit = fitConfidenceTaskPolicy([...proper, ...calibration, ...plan.cases.filter(item => item.split === 'heldout')]);
  assert.ok(fit.sufficient); assert.deepEqual(fit.policy.policy, fitted.fit.policy, 'Calibration must not refit weights');
  const model = { createdAt: new Date().toISOString(), planHash, sourceHash: plan.sourceHash,
    properHash: fitted.properHash, calibrationHash: hash(JSON.stringify(calibration)), fit, promoted: false };
  await write(modelName, model, true); const modelHash = hash(await readFile(path(modelName)));
  await write('ml-broad-freeze.json', { createdAt: new Date().toISOString(), modelHash, planHash,
    sourceHash: plan.sourceHash, properHash: model.properHash, calibrationHash: model.calibrationHash, evaluationCollected: false }, true);
  console.log(JSON.stringify({ modelHash, errorBuffer: fit.policy.calibration.errorBuffer }));
} else if (command === 'analyze') {
  const model = await read(modelName), modelHash = hash(await readFile(path(modelName))), witness = await read('ml-broad-freeze.json');
  assert.equal(modelHash, witness.modelHash); assert.equal(model.planHash, planHash); assert.equal(model.sourceHash, plan.sourceHash);
  assert.equal(model.properHash, hash(JSON.stringify(proper))); assert.equal(model.calibrationHash, hash(JSON.stringify(calibration)));
  const reports = [];
  for (const example of cases.filter(item => item.split === 'heldout')) {
    if (example.status !== 'valid') { reports.push(example); continue; }
    const raw = await read(rawName(example)); assert.equal(raw.rewardModelHash, modelHash);
    assert.ok(raw.rewardTrial?.validReplay && raw.rewardTrial.assignmentReachedExecutor);
    const [a, , b, learned] = raw.replays;
    const decision = chooseRewardGuidedMacro({ confidencePolicy: model.fit.policy, taskContext: a.event.taskContext, features: a.event.features,
      experiment: { enabled: true, now: a.event.second, lastAssignmentSecond: -Infinity, healthFraction: a.event.actorStart.hpFraction,
        dangerousFight: false, insideEnemyTower: false, objectiveFight: false, defending: false, influenceThreat: 0,
        survival: 1, enemyDistance: Infinity, incumbent: a.event.incumbent, selectionReason: 'utility', candidates: a.event.decisionCandidates, randomDraw: -1 } });
    assert.deepEqual(learned.event.rewardDecision, decision); assert.equal(learned.record.selected, decision.selected);
    assert.ok(learned.event.matched && learned.event.gate === null);
    const reference = decision.changed ? b : a;
    for (const key of ['followupStateFingerprint', 'taskContext', 'teamStart', 'teamOutcome', 'taskEvents', 'taskOutcome', 'followup'])
      assert.deepEqual(learned.event[key], reference.event[key]);
    const actual = example.alternative.reward - example.control.reward, supported = Number.isFinite(decision.lowerBoundAdvantage);
    reports.push({ id: example.id, seed: example.seed, draft: example.draft, afterSeconds: example.afterSeconds,
      status: 'valid', cardId: example.cardId, rawHash: example.rawHash, changed: decision.changed, decision,
      rewardDelta: learned.event.teamOutcome.reward - example.control.reward,
      deathDelta: learned.event.taskOutcome.deaths - example.control.actorTask.deaths,
      teamDeathDelta: learned.event.teamOutcome.ownDeaths - example.control.ownDeaths,
      predictionError: supported ? (decision.predictedAdvantage - actual) ** 2 : null,
      zeroError: supported ? actual ** 2 : null, covered: supported ? actual >= decision.lowerBoundAdvantage : null,
      rubric: assessPairedOutcome(a, learned).classification });
  }
  const valid = reports.filter(item => item.status === 'valid'), supported = valid.filter(item => item.covered !== null);
  const mean = key => supported.length ? supported.reduce((sum, item) => sum + item[key], 0) / supported.length : null;
  const summary = { planned: reports.length, valid: valid.length, changed: valid.filter(item => item.changed).length,
    improved: valid.filter(item => item.rewardDelta >= .02).length, worsened: valid.filter(item => item.rewardDelta <= -.02).length,
    rewardDelta: valid.reduce((sum, item) => sum + item.rewardDelta, 0), extraDeathCases: valid.filter(item => item.deathDelta > 0).length,
    extraTeamDeathCases: valid.filter(item => item.teamDeathDelta > 0).length,
    broaderWorse: valid.filter(item => item.changed && ['worse', 'survival-worsened'].includes(item.rubric)).length,
    supported: supported.length, coverage: supported.length ? supported.filter(item => item.covered).length / supported.length : null,
    predictionLoss: mean('predictionError'), zeroPredictionLoss: mean('zeroError') };
  const passesExploratoryGate = summary.valid >= plan.acceptance.minimumValid && summary.changed >= plan.acceptance.minimumChanges
    && summary.rewardDelta > 0 && summary.improved > summary.worsened && !summary.extraDeathCases && !summary.extraTeamDeathCases
    && !summary.broaderWorse && summary.supported >= plan.acceptance.minimumValid
    && summary.coverage >= plan.acceptance.minimumCoverage && summary.predictionLoss < summary.zeroPredictionLoss;
  await write('ml-broad-analysis.json', { planHash, modelHash, summary, reports, passesExploratoryGate, promoted: false });
  console.log(JSON.stringify({ summary, passesExploratoryGate }, null, 2));
} else throw Error('Expected prepare, status, fit, freeze or analyze');
