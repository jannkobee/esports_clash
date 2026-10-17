import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { path, hash, read, rawName, verifySources, loadCase } from './broad-study-evidence.mjs';

const plan = await read('ml-broad-plan.json'); await verifySources(plan);
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1];
const split = argument('split'), from = Number(argument('from')), to = Number(argument('to'));
assert.ok(['fit', 'calibration', 'heldout'].includes(split), 'Explicit --split=fit|calibration|heldout required');
assert.ok(Number.isInteger(from) && Number.isInteger(to) && from <= to, 'Explicit disjoint seed range required');
assert.ok(['9223', '9224', '9225'].includes(process.env.CDP_PORT), 'Disposable CDP_PORT required');
const cases = plan.cases.filter(item => item.split === split && item.seed >= from && item.seed <= to);
assert.ok(cases.length, 'No planned cases in this shard');
let modelHash;
if (split !== 'fit') {
  const fitted = await read('ml-broad-proper-fit.json');
  assert.equal(fitted.planHash, hash(JSON.stringify(plan))); assert.ok(fitted.fit.sufficient);
  const proper = await Promise.all(plan.cases.filter(item => item.split === 'fit').map(item => loadCase(item, plan)));
  assert.equal(fitted.properHash, hash(JSON.stringify(proper)));
}
if (split === 'heldout') {
  const bytes = await readFile(path('ml-broad-candidate.json')), model = JSON.parse(bytes), witness = await read('ml-broad-freeze.json');
  modelHash = hash(bytes); assert.equal(witness.modelHash, modelHash); assert.ok(model.fit.sufficient && !model.promoted);
  assert.equal(model.planHash, hash(JSON.stringify(plan))); assert.equal(model.sourceHash, plan.sourceHash);
  const calibration = await Promise.all(plan.cases.filter(item => item.split === 'calibration').map(item => loadCase(item, plan)));
  assert.equal(model.calibrationHash, hash(JSON.stringify(calibration)));
}
for (const item of cases) {
  await verifySources(plan);
  const existing = await loadCase(item, plan);
  if (existing.status !== 'missing') { console.log(`Retaining ${item.id}: ${existing.status}`); continue; }
  const output = path(rawName(item)), args = ['scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout',
    `--seed=${item.seed}`, `--draft=${item.draft}`, `--after=${item.afterSeconds}`, `--scout-seconds=${item.scoutSeconds}`,
    `--pair=${plan.pair}`, `--horizon=${plan.horizonSeconds}`, `--output=${output}`];
  if (!item.swapped) args.push('--original');
  if (modelHash) {
    assert.equal(hash(await readFile(path('ml-broad-candidate.json'))), modelHash);
    args.push(`--reward-model=${path('ml-broad-candidate.json')}`);
  }
  console.log(`Collecting ${item.id}`);
  await new Promise(done => execFile(process.execPath, args, { env: process.env, timeout: 360000, maxBuffer: 6 * 1024 * 1024 }, error => {
    if (error) console.log(`Runner ${item.id}: ${error.code ?? error.message}`); done();
  }));
  const result = await loadCase(item, plan);
  if (modelHash && result.status !== 'missing') assert.equal((await read(rawName(item))).rewardModelHash, modelHash);
  console.log(JSON.stringify({ id: item.id, status: result.status, cardId: result.cardId }));
}
