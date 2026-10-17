import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const plan = JSON.parse(await readFile(resolve('../docs/ml-reward-guidance-plan.json'), 'utf8'));
const modelPath = resolve('../docs', plan.model);
const modelHash = createHash('sha256').update(await readFile(modelPath)).digest('hex');
if (modelHash !== plan.modelHash) throw Error('Frozen reward model changed');
const results = [];
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
for (const item of plan.cases.filter(item => !only || item.id === only)) {
  const path = resolve(`../docs/ml-reward-${item.id}.json`);
  let raw;
  try { raw = JSON.parse(await readFile(path, 'utf8')); } catch {}
  if (!raw) {
    console.log(`Collecting ${item.id}`);
    const args = ['scripts/paired-live-rollout.mjs', '--checkpoint', '--fixed-scout',
      `--seed=${item.seed}`, `--draft=${item.draft}`, `--pair=${plan.pair}`, `--horizon=${plan.horizonSeconds}`,
      `--scout-seconds=${plan.scoutSeconds}`, `--reward-model=${modelPath}`, `--output=${path}`];
    if (!item.swapped) args.push('--original');
    await new Promise(done => execFile(process.execPath, args, { env: process.env, timeout: 240000,
      maxBuffer: 2 * 1024 * 1024 }, error => { if (error) console.log(`${item.id}: runner exit ${error.code}`); done(); }));
    try { raw = JSON.parse(await readFile(path, 'utf8')); } catch { raw = null; }
  }
  if (raw && (raw.seed !== item.seed || raw.draft !== item.draft || raw.swapped !== item.swapped
    || raw.horizonSeconds !== plan.horizonSeconds || raw.rewardModelHash !== plan.modelHash))
    throw Error(`Planned context/model mismatch: ${item.id}`);
  const result = { ...item, validPair: raw?.validPair ?? false,
    validRewardReplay: raw?.rewardTrial?.validReplay ?? false, cardId: raw?.scout?.event?.cardId,
    second: raw?.scout?.event?.second, rejected: raw?.scout?.rejected,
    decision: raw?.rewardTrial?.decision,
    incumbent: raw?.replays?.[0]?.event?.taskOutcome, rewardGuided: raw?.replays?.[3]?.event?.taskOutcome };
  results.push(result);
  await writeFile(resolve('../docs/ml-reward-guidance-collection.json'), JSON.stringify({ plan, results }, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
