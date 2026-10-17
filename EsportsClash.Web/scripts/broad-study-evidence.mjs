import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validTaskActionContext } from '../src/taskActionContext.ts';
import { summarizeTaskOutcome } from '../src/taskOutcome.ts';
import { summarizeTeamTaskOutcome } from '../src/teamTaskOutcome.ts';
import { summarizePairedBehavior } from './paired-behavior.mjs';

export const path = name => resolve('../docs', name);
export const hash = value => createHash('sha256').update(value).digest('hex');
export const read = async name => JSON.parse(await readFile(path(name), 'utf8'));
export const write = (name, value, exclusive = false) => writeFile(path(name), JSON.stringify(value, null, 2) + '\n', exclusive ? { flag: 'wx' } : {});
export const rawName = item => `ml-broad-${item.id}.json`;

export async function manifest() {
  const files = [...(await readdir('src', { recursive: true })).filter(file => /\.(tsx?|css)$/.test(file))
    .map(file => `src/${file.replaceAll('\\', '/')}`), 'scripts/paired-live-rollout.mjs',
    'scripts/broad-task-study.mjs', 'scripts/broad-study-evidence.mjs', 'scripts/collect-broad-shard.mjs',
    'scripts/paired-behavior.mjs', 'scripts/paired-outcome-rubric.mjs', '../docs/ml-live-evaluation.json',
    'public/images/player-portraits-v1.png'].sort();
  return Promise.all(files.map(async file => [file, hash(await readFile(file))]));
}
export async function verifySources(plan) {
  assert.deepEqual(await manifest(), plan.sourceManifest, 'Locked study source/input changed');
  assert.equal(hash(JSON.stringify(plan.sourceManifest)), plan.sourceHash);
}

/** Validate evidence rather than trusting a runner's validPair boolean. */
export function validateBroadCase(raw, item, plan) {
  assert.equal(raw.seed, item.seed); assert.equal(raw.draft, item.draft); assert.equal(raw.swapped, item.swapped);
  assert.equal(raw.afterSeconds, item.afterSeconds); assert.equal(raw.horizonSeconds, plan.horizonSeconds);
  assert.equal(raw.pairFilter, plan.pair); assert.equal(raw.auditOnly, false); assert.equal(raw.cardFilter, '');
  assert.deepEqual(raw.draftLineup, plan.drafts[String(item.draft)]);
  if (!raw.validPair) return { ...item, status: raw.scout?.event ? 'invalid-controls' : 'no-target' };
  const [a, repeat, b] = raw.replays;
  assert.ok(a.event.second >= item.afterSeconds && a.event.second <= item.scoutSeconds + 1 / 30);
  for (const run of [a, repeat, b]) {
    assert.ok(!run.rejected && run.event.matched && run.event.gate === null);
    for (const key of ['actorId', 'second', 'fingerprint', 'cardId', 'incumbent', 'alternate', 'taskContext', 'teamStart', 'actorStart'])
      assert.deepEqual(run.event[key], raw.scout.event[key]);
    assert.deepEqual(run.event.taskOutcome, summarizeTaskOutcome(
      { second: run.event.second, deaths: run.event.actorStart.deaths },
      { second: run.event.followup.second, deaths: run.event.followup.actor.deaths }, run.event.taskEvents ?? []));
    assert.deepEqual(run.event.teamOutcome, summarizeTeamTaskOutcome(run.event.teamStart, run.event.teamOutcome.end, run.event.taskOutcome));
    assert.ok(run.event.taskOutcome.horizonSeconds >= 30 && run.event.taskOutcome.horizonSeconds <= 30.1);
    assert.equal(run.event.teamOutcome.end.second, run.event.followup.second);
    assert.equal(run.event.teamOutcome.end.ownStructureHp, run.event.followup.team.ownStructureHp);
    assert.equal(run.event.teamOutcome.end.enemyStructureHp, run.event.followup.team.enemyStructureHp);
  }
  assert.equal(a.record.selected, a.event.incumbent); assert.equal(repeat.record.selected, a.event.incumbent);
  assert.equal(b.record.selected, a.event.alternate); assert.ok(validTaskActionContext(a.event.taskContext));
  for (const key of ['followupStateFingerprint', 'taskContext', 'followup', 'teamOutcome', 'taskOutcome', 'taskEvents'])
    assert.deepEqual(a.event[key], repeat.event[key]);
  assert.deepEqual(a.record.snapshot, repeat.record.snapshot); assert.deepEqual(a.record.outcome, repeat.record.outcome);
  const behavior = summarizePairedBehavior(a.event.behaviorTrace, b.event.behaviorTrace, a.event.second);
  assert.ok(behavior.incumbent.assignmentReachedExecutor && behavior.alternate.assignmentReachedExecutor);
  return { ...item, status: 'valid', validPair: true, cardId: a.event.cardId,
    incumbent: a.event.incumbent, alternate: a.event.alternate, taskContext: a.event.taskContext,
    control: a.event.teamOutcome, alternative: b.event.teamOutcome };
}

export async function loadCase(item, plan) {
  let bytes;
  try { bytes = await readFile(path(rawName(item))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { ...item, status: 'missing' }; }
  return { ...validateBroadCase(JSON.parse(bytes), item, plan), rawHash: hash(bytes) };
}

export function coverage(cases) {
  const valid = cases.filter(item => item.status === 'valid');
  const counts = key => Object.fromEntries([...new Set(cases.map(item => item[key]))].map(value => [String(value), {
    planned: cases.filter(item => item[key] === value).length,
    valid: valid.filter(item => item[key] === value).length }]));
  return { planned: cases.length, valid: valid.length, missing: cases.filter(item => item.status === 'missing').length,
    noTarget: cases.filter(item => item.status === 'no-target').length,
    invalidControls: cases.filter(item => item.status === 'invalid-controls').length,
    observedCards: [...new Set(valid.map(item => item.cardId))].sort(), bySplit: counts('split'),
    byDraft: counts('draft'), byStage: counts('afterSeconds'),
    byDirection: Object.fromEntries([...new Set(valid.map(item => `${item.incumbent}->${item.alternate}`))]
      .map(direction => [direction, valid.filter(item => `${item.incumbent}->${item.alternate}` === direction).length])),
    byPushKind: Object.fromEntries(['advance', 'camp-exit', 'minion', 'structure'].map(kind =>
      [kind, valid.filter(item => item.taskContext.actions.push[`task:kind:${kind}`] === 1).length])) };
}
