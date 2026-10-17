import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = ['ml-action-audit-repeat-a.json', 'ml-action-audit-repeat-b.json',
  'ml-action-audit-complete-81-original.json', 'ml-action-audit-complete-81-original-repeat.json'];
const reports = [];
for (const file of files) {
  let output;
  try { output = JSON.parse(await readFile(resolve('../docs', file), 'utf8')); }
  catch { reports.push({ file, status: 'missing' }); continue; }
  const inspection = output.scout?.inspection;
  const audit = inspection?.executionAudit;
  const counts = audit?.counts ?? {};
  const unexpected = Object.entries(counts).filter(([key]) => {
    const [selected, intent] = key.split(':');
    return !({ fight: ['champion', 'hold'], regroup: ['regroup'], wave: ['minion'],
      farm: ['camp'], push: ['push', 'hold', 'minion', 'structure'] })[selected]?.includes(intent);
  });
  reports.push({ file, status: inspection ? 'inspected' : 'missing-inspection',
    second: inspection?.second, fingerprint: inspection?.fingerprint,
    randomState: inspection?.randomState, finished: inspection?.finished,
    pairStatus: output.validPair ? 'accepted' : output.scout?.rejected,
    residualTicks: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts, regroupPaths: audit?.regroupPaths, unexpected,
    samples: audit?.samples });
}
const [a, b] = reports;
const [fullA, fullB] = reports.slice(2);
const analysis = { method: 'Same seed/lineup; fresh browser mount for each fixed-step run. Action counts reflect the completed live executor pass, not only selected labels.',
  repeat: { sameSimulationState: typeof a.fingerprint === 'string' && a.fingerprint === b.fingerprint,
    sameRandomState: typeof a.randomState === 'number' && a.randomState === b.randomState,
    sameActionCounts: JSON.stringify(a.counts) === JSON.stringify(b.counts) },
  fullMatchRepeat: { sameSimulationState: typeof fullA.fingerprint === 'string' && fullA.fingerprint === fullB.fingerprint,
    sameRandomState: typeof fullA.randomState === 'number' && fullA.randomState === fullB.randomState,
    sameActionCounts: JSON.stringify(fullA.counts) === JSON.stringify(fullB.counts) },
  reports, policyPromoted: false };
await writeFile(resolve('../docs/ml-action-audit-analysis.json'), JSON.stringify(analysis, null, 2) + '\n');
console.log(JSON.stringify({ repeat: analysis.repeat, fullMatchRepeat: analysis.fullMatchRepeat,
  reports: reports.map(({ samples, ...report }) => report) }, null, 2));
