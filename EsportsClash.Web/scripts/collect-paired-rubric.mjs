// Execute every predeclared browser case, preserving invalid and no-target attempts.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const plan = JSON.parse(await readFile(resolve('../docs/ml-paired-rubric-plan.json'), 'utf8'));
for (const item of plan.cases) {
  const file = `../docs/ml-paired-rubric-${item.seed}-${item.side}-${item.pair}.json`;
  const args = ['scripts/paired-live-rollout.mjs', '--checkpoint', `--seed=${item.seed}`,
    `--horizon=${plan.horizonSeconds}`, `--pair=${item.pair}`, `--output=${file}`];
  if (item.side === 'original') args.push('--original');
  const started = Date.now();
  console.log(`Starting ${item.seed} ${item.side} ${item.pair}`);
  const result = await new Promise(resolveResult => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', chunk => { errorText += chunk; });
    child.on('error', error => resolveResult({ code: -1, error: error.message }));
    child.on('close', code => resolveResult({ code, error: errorText.slice(-1000) }));
  });
  let validPair = false;
  let cardId = null;
  try {
    const output = JSON.parse(await readFile(resolve(file), 'utf8'));
    validPair = output.validPair === true;
    cardId = output.scout?.event?.cardId ?? null;
  } catch { /* The analysis reports this as missing evidence. */ }
  console.log(JSON.stringify({ seed: item.seed, side: item.side, pair: item.pair,
    code: result.code, validPair, cardId,
    wallSeconds: Math.round((Date.now() - started) / 1000),
    error: result.code === 0 ? undefined : result.error }));
}
