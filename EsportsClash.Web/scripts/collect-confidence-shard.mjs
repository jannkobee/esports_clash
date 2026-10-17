// Disjoint evaluation shards; immutable plan/model/source checks before collection.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const plan = JSON.parse(await readFile('../docs/ml-confidence-plan.json', 'utf8'));
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1];
const from = Number(argument('from')), to = Number(argument('to'));
assert.ok(Number.isInteger(from) && Number.isInteger(to) && from <= to, 'Explicit seed range required');
const cases = plan.cases.filter(item => item.seed >= from && item.seed <= to);
assert.ok(cases.length && cases.every(item => item.split === 'heldout'));
assert.ok(['9223', '9224', '9225'].includes(process.env.CDP_PORT), 'Disposable CDP port required');
const bytes = await readFile('../docs/ml-confidence-candidate.json'), model = JSON.parse(bytes);
const witness = JSON.parse(await readFile('../docs/ml-confidence-freeze.json', 'utf8'));
const modelHash = hash(bytes);
assert.ok(model.fit.sufficient && !model.promoted);
assert.equal(witness.modelHash, modelHash); assert.equal(model.planHash, hash(JSON.stringify(plan)));
for (const item of cases) {
  for (const [file, expected] of plan.sourceManifest) assert.equal(hash(await readFile(file)), expected, `Changed source ${file}`);
  assert.equal(hash(await readFile('../docs/ml-confidence-candidate.json')), modelHash);
  const output = resolve('../docs', `ml-confidence-${item.id}.json`);
  let exists = false;
  try { await readFile(output); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) { console.log(`Retaining ${item.id}`); continue; }
  const args = ['scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout',
    `--seed=${item.seed}`, `--draft=${item.draft}`, `--pair=${plan.pair}`, `--horizon=${plan.horizonSeconds}`,
    `--scout-seconds=${plan.scoutSeconds}`, `--output=${output}`, '--reward-model=../docs/ml-confidence-candidate.json'];
  if (!item.swapped) args.push('--original');
  console.log(`Collecting ${item.id} on CDP ${process.env.CDP_PORT}`);
  await new Promise(done => execFile(process.execPath, args, { env: process.env, timeout: 240000,
    maxBuffer: 4 * 1024 * 1024 }, error => { if (error) console.log(`Runner ${item.id}: ${error.code ?? error.message}`); done(); }));
  const raw = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(raw.rewardModelHash, modelHash);
  console.log(JSON.stringify({ id: item.id, validPair: raw.validPair, learnedReplay: raw.rewardTrial?.validReplay }));
}
