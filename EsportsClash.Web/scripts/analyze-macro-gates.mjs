// Counts describe residual decision ticks, not independent training episodes.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sources = process.argv.slice(2);
if (!sources.length) throw Error('Provide one or more paired scout JSON paths');
const totals = { ticks: 0, eligible: 0, withLegalPair: 0, safeExceptGap: 0,
  firstGates: {}, allGates: {}, cardPairs: {} };
const mergeCounts = (target, counts) => {
  for (const [key, count] of Object.entries(counts)) {
    assert.ok(Number.isInteger(count) && count >= 0, `Invalid count: ${key}`);
    target[key] = (target[key] ?? 0) + count;
  }
};
const runs = [];
for (const source of sources) {
  const data = JSON.parse(await readFile(resolve(source), 'utf8'));
  const inspection = data.scout?.inspection;
  const audit = inspection?.opportunityAudit;
  assert.ok(audit && Number.isInteger(audit.total) && audit.total > 0, `Missing gate audit: ${source}`);
  assert.equal(Object.values(audit.firstGates).reduce((sum, count) => sum + count, 0), audit.total);
  const safeExceptGap = Object.values(audit.safeExceptGap).reduce((sum, row) => sum + row.count, 0);
  assert.equal(safeExceptGap, audit.firstGates['utility-gap'] ?? 0);
  const withLegalPair = audit.total - (audit.allGates['legal-pair'] ?? 0);
  runs.push({ source, seed: data.seed, swapped: data.swapped, seconds: inspection.second,
    ticks: audit.total, eligible: audit.firstGates.eligible ?? 0, withLegalPair, safeExceptGap,
    firstGates: audit.firstGates, allGates: audit.allGates, cardPairs: audit.safeExceptGap });
  totals.ticks += audit.total;
  totals.eligible += audit.firstGates.eligible ?? 0;
  totals.withLegalPair += withLegalPair;
  totals.safeExceptGap += safeExceptGap;
  mergeCounts(totals.firstGates, audit.firstGates);
  mergeCounts(totals.allGates, audit.allGates);
  for (const [key, row] of Object.entries(audit.safeExceptGap)) {
    assert.ok(row.minGap > .1 && row.maxGap >= row.minGap, `Invalid utility gap: ${key}`);
    const merged = (totals.cardPairs[key] ??= { count: 0, minGap: row.minGap, maxGap: row.maxGap });
    merged.count += row.count;
    merged.minGap = Math.min(merged.minGap, row.minGap);
    merged.maxGap = Math.max(merged.maxGap, row.maxGap);
  }
}
const report = { method: 'Evaluation-only gate coverage at residual decision ticks; simultaneous gates overlap; repeated ticks are not independent observations',
  limits: 'Early-match samples from one draft. No alternate was authorized by this analysis. No causal ML benefit or basis for policy promotion.',
  runs, totals };
await writeFile(resolve('../docs/ml-gate-audit-analysis.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(totals, null, 2));
