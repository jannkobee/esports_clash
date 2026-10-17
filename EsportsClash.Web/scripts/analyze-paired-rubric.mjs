// Analysis over the fixed plan. Never silently drop a planned attempt.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';

const plan = JSON.parse(await readFile(resolve('../docs/ml-paired-rubric-plan.json'), 'utf8'));
const cases = [];
for (const item of plan.cases) {
  const file = `ml-paired-rubric-${item.seed}-${item.side}-${item.pair}.json`;
  let output;
  try { output = JSON.parse(await readFile(resolve('../docs', file), 'utf8')); }
  catch { cases.push({ ...item, file, status: 'missing' }); continue; }
  if (output.seed !== item.seed || output.swapped !== (item.side === 'swapped')
    || output.pairFilter !== item.pair || output.horizonSeconds !== plan.horizonSeconds) {
    cases.push({ ...item, file, status: 'metadata-mismatch' }); continue;
  }
  if (!output.scout?.event?.fingerprint) {
    cases.push({ ...item, file, status: 'no-target',
      reason: output.scout?.rejected ?? 'no eligible scout choice' });
    continue;
  }
  if (!output.validPair) {
    cases.push({ ...item, file, status: 'invalid-pair',
      reason: output.replays?.find(run => run.rejected)?.rejected ?? 'duplicate controls differed',
      cardId: output.scout?.event?.cardId ?? null });
    continue;
  }
  const assessment = assessPairedOutcome(output.replays[0], output.replays[2]);
  cases.push({ ...item, file, status: assessment.classification === 'missing-metrics'
    ? 'missing-metrics' : 'accepted', cardId: output.scout?.event?.cardId ?? null,
    champion: output.scout?.event?.champion ?? null,
    incumbent: output.scout?.event?.incumbent,
    alternate: output.scout?.event?.alternate,
    ...assessment });
}
const strata = Object.fromEntries([...new Set(plan.cases.map(item => item.pair))].map(pair => {
  const rows = cases.filter(item => item.pair === pair);
  const accepted = rows.filter(item => item.status === 'accepted');
  return [pair, { planned: rows.length, accepted: accepted.length,
    cards: [...new Set(accepted.map(item => item.cardId))],
    classifications: accepted.reduce((counts, item) => {
      counts[item.classification] = (counts[item.classification] ?? 0) + 1;
      return counts;
    }, {}) }];
}));
const analysis = { plan: 'ml-paired-rubric-plan.json',
  attempted: cases.length, accepted: cases.filter(item => item.status === 'accepted').length,
  strata, cases, policyPromoted: false };
await writeFile(resolve('../docs/ml-paired-rubric-analysis.json'), JSON.stringify(analysis, null, 2) + '\n');
console.log(JSON.stringify({ attempted: analysis.attempted, accepted: analysis.accepted,
  strata: analysis.strata }, null, 2));
