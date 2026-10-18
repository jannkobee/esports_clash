// Bridge to existing game validators; never reimplement rewards in Python.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { INITIAL_PLAYERS, CHAMPIONS } from '../src/mockData.ts';
import { buildPairedStudyDraft } from '../src/pairedStudyDraft.ts';
import { validateBroadCase } from './broad-study-evidence.mjs';
import { confidenceTaskAdvantage, loadConfidenceTaskPolicy } from '../src/taskConfidencePolicy.ts';
import { loadTaskContextPolicy, taskContextScore } from '../src/taskContextPolicy.ts';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';
import { summarizePairedBehavior } from './paired-behavior.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => { const bytes = await readFile(path); return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString()); };
const [command, ...args] = process.argv.slice(2);
if (command === 'manifest') {
  const files = [...(await readdir('src', { recursive: true })).filter(file => /\.(tsx?|css)$/.test(file)).map(file => `src/${file.replaceAll('\\', '/')}`),
    ...(await readdir('evolution-dist', { recursive: true })).filter(file => /\.(js|html|css)$/.test(file)).map(file => `evolution-dist/${file}`),
    'scripts/paired-live-rollout.mjs', 'scripts/evolution-evidence.mjs', 'scripts/broad-study-evidence.mjs',
    'scripts/paired-behavior.mjs', 'scripts/paired-outcome-rubric.mjs', 'package-lock.json', 'evolution.html', 'evolution-compiled.html', 'vite.evolution.config.ts',
    '../docs/ml-live-evaluation.json', '/runner/pipeline.py', '/runner/training.py', '/runner/train_stage.py', '/runner/operations.py', '/runner/server.py'].sort();
  const manifest = await Promise.all(files.map(async path => [path, hash(await readFile(path))]));
  const drafts = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 2),
    buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, i + 2).map(({ player, champion }) => ({ playerId: player.id, championId: champion.id }))]));
  console.log(JSON.stringify({ manifest, source_hash: hash(JSON.stringify(manifest)), drafts }));
} else if (command === 'validate') {
  const [rawPath, taskPath, planPath, candidatePath] = args;
  const raw = await read(rawPath), item = await read(taskPath), plan = await read(planPath);
  const example = validateBroadCase(raw, item, { ...plan, pair: 'farm-push', horizonSeconds: 30 });
  const result = { ...example, rawHash: hash(await readFile(rawPath)),
    simulated_seconds: (raw.scout?.event?.second ?? raw.scout?.inspection?.second ?? 0)
      + raw.replays.reduce((n, arm) => n + (arm.event?.taskOutcome?.horizonSeconds ?? 0), 0) };
  if (candidatePath && result.status === 'valid') {
    const candidate = await read(candidatePath), model = loadConfidenceTaskPolicy(candidate.fit.policy);
    assert.ok(model && candidate.promoted === false);
    assert.equal(raw.rewardModelHash, hash(await readFile(candidatePath)));
    const [a, , b, learned] = raw.replays;
    assert.ok(raw.rewardTrial?.validReplay && raw.rewardTrial.assignmentReachedExecutor && !learned.rejected);
    assert.ok(learned.event.matched && learned.event.gate === null);
    const decision = confidenceTaskAdvantage(model, example.taskContext, example.incumbent, example.alternate);
    const selected = decision.allowed ? example.alternate : example.incumbent;
    assert.equal(learned.record.selected, selected);
    assert.equal(learned.event.rewardDecision.selected, selected);
    const reference = selected === example.incumbent ? a : b;
    for (const key of ['actorId', 'second', 'fingerprint', 'cardId', 'incumbent', 'alternate', 'taskContext', 'teamStart', 'actorStart'])
      assert.deepEqual(learned.event[key], a.event[key]);
    for (const key of ['followupStateFingerprint', 'followup', 'taskOutcome', 'teamOutcome', 'taskEvents'])
      assert.deepEqual(learned.event[key], reference.event[key]);
    assert.deepEqual(learned.record.outcome, reference.record.outcome);
    assert.ok(summarizePairedBehavior(a.event.behaviorTrace, learned.event.behaviorTrace, a.event.second).alternate.assignmentReachedExecutor);
    const actual = example.alternative.reward - example.control.reward;
    const predicted = taskContextScore(model.policy, 'push', example.taskContext) - taskContextScore(model.policy, 'farm', example.taskContext);
    Object.assign(result, { changed: selected !== example.incumbent, selected,
      rewardDelta: learned.event.teamOutcome.reward - a.event.teamOutcome.reward,
      deathDelta: learned.event.taskOutcome.deaths - a.event.taskOutcome.deaths,
      teamDeathDelta: learned.event.teamOutcome.ownDeaths - a.event.teamOutcome.ownDeaths,
      supported: decision.reason !== 'unsupported-task-context' && decision.reason !== 'uncalibrated-direction',
      covered: actual >= predicted - model.calibration.errorBuffer,
      predictionError: (predicted - actual) ** 2, zeroError: actual ** 2,
      rubric: assessPairedOutcome(a, learned).classification });
  }
  console.log(JSON.stringify(result));
} else if (command === 'policy') {
  const model = await read(args[0]);
  assert.ok(model.kind === 'task-confidence' ? loadConfidenceTaskPolicy(model) : loadTaskContextPolicy(model));
  console.log(JSON.stringify({ valid: true }));
} else throw Error('Unknown evidence operation');
