import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const plan = JSON.parse(await readFile(resolve('../docs/ml-task-outcome-plan.json'), 'utf8'));
const selected = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const cases = selected ? plan.cases.filter(item => item.id === selected) : plan.cases;
if (!cases.length) throw Error('No planned cases selected');
const results = [];
for (const item of cases) {
  const path = resolve(`../docs/ml-task-${item.id}.json`);
  let output;
  try { output = JSON.parse(await readFile(path, 'utf8')); } catch {}
  if (!output) {
    const args = ['scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout',
      `--seed=${item.seed}`, `--draft=${item.draft}`, `--pair=${plan.pair}`,
      `--horizon=${plan.horizonSeconds}`, `--scout-seconds=${plan.scoutSeconds}`, `--output=${path}`];
    if (!item.swapped) args.push('--original');
    console.log(`Collecting ${item.id}`);
    await new Promise(done => execFile(process.execPath, args, { env: process.env, timeout: 240000,
      maxBuffer: 2 * 1024 * 1024 }, async error => {
      if (error) console.log(`${item.id}: runner ended with ${error.code ?? error.message}`);
      done();
    }));
    try { output = JSON.parse(await readFile(path, 'utf8')); }
    catch { output = { validPair: false, error: 'runner produced no evidence' }; }
  }
  if (output.seed !== undefined && (output.seed !== item.seed || output.draft !== item.draft
    || output.swapped !== item.swapped || output.horizonSeconds !== plan.horizonSeconds))
    throw Error(`Existing evidence does not match plan: ${item.id}`);
  const [a, , b] = output.replays ?? [];
  const result = { ...item, source: path, validPair: output.validPair,
    rejected: output.scout?.rejected, cardId: output.scout?.event?.cardId,
    second: output.scout?.event?.second,
    incumbentTask: a?.event?.taskOutcome, alternateTask: b?.event?.taskOutcome };
  results.push(result);
  await writeFile(resolve('../docs/ml-task-collection.json'), JSON.stringify({ plan, results }, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
