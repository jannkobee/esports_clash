// Optional collection scheduling only. Uses the locked plan and unchanged paired runner.
// Assign disjoint seed ranges and separate disposable CDP ports to each process.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const plan = JSON.parse(await readFile('../docs/ml-context-v2-plan.json', 'utf8'));
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1];
const from = Number(argument('from')), to = Number(argument('to'));
if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) throw Error('Explicit seed range required');
const cases = plan.cases.filter(item => item.seed >= from && item.seed <= to);
if (!cases.length || new Set(cases.map(item => item.split)).size !== 1) throw Error('One planned split per shard required');
if (!['9223', '9224', '9225'].includes(process.env.CDP_PORT)) throw Error('Explicit disposable CDP_PORT required');
let frozenHash;
if (cases[0].split === 'heldout') {
  const bytes = await readFile('../docs/ml-context-v2-candidate.json');
  if (!JSON.parse(bytes).fit.sufficient) throw Error('Training candidate is insufficient');
  frozenHash = createHash('sha256').update(bytes).digest('hex');
}
for (const item of cases) {
  const output = resolve('../docs', `ml-context-v2-${item.id}.json`);
  try { await readFile(output); console.log(`Retaining ${item.id}`); continue; } catch {}
  const args = ['scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout',
    `--seed=${item.seed}`, `--draft=${item.draft}`, `--pair=${plan.pair}`,
    `--horizon=${plan.horizonSeconds}`, `--scout-seconds=${plan.scoutSeconds}`, `--output=${output}`];
  if (!item.swapped) args.push('--original');
  if (item.split === 'heldout') args.push('--reward-model=../docs/ml-context-v2-candidate.json');
  console.log(`Collecting ${item.id} on CDP ${process.env.CDP_PORT}`);
  await new Promise(done => execFile(process.execPath, args, { env: process.env, timeout: 240000,
    maxBuffer: 4 * 1024 * 1024 }, error => {
    if (error) console.log(`Runner ${item.id}: ${error.code ?? error.message}`);
    done();
  }));
  const raw = JSON.parse(await readFile(output, 'utf8'));
  if (frozenHash && raw.rewardModelHash !== frozenHash) throw Error('Evaluation model changed');
  console.log(JSON.stringify({ id: item.id, validPair: raw.validPair, learnedReplay: raw.rewardTrial?.validReplay }));
}
