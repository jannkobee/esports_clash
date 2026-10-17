import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessPairedOutcome } from './paired-outcome-rubric.mjs';

const read = async name => JSON.parse(await readFile(resolve('../docs', name), 'utf8'));
const beforeDiagnostic = await read('ml-scoring-before-81-original.json');
const old81 = await read('ml-gate-audit-81-original.json');
const instrumentationPreservedState = beforeDiagnostic.scout.inspection.fingerprint === old81.scout.inspection.fingerprint
  && beforeDiagnostic.scout.inspection.randomState === old81.scout.inspection.randomState;
assert.ok(instrumentationPreservedState, 'Diagnostic-only baseline drifted');
const examples = beforeDiagnostic.scout.inspection.opportunityAudit.examples
  .filter(row => row.incumbent === 'farm' && row.alternate === 'push').map(row => {
    const push = row.candidates.find(candidate => candidate.action === 'push');
    assert.equal(row.push.structureInRange, false);
    assert.equal(row.push.minionInRange, false);
    return { cardId: row.cardId, second: row.second, utilityGap: row.utilityGap,
      localThreat: row.push.localThreat, distantStructurePixels: row.push.structure.distance,
      pushDangerContribution: push.contributions.danger };
  });
assert.ok(examples.length > 0);
const runs = [];
for (const [seed, side] of [[81, 'original'], [82, 'swapped']]) {
  const beforeSource = `ml-gate-audit-${seed}-${side}.json`;
  const afterSource = `ml-scoring-coverage-${seed}-${side}.json`;
  const [before, after] = await Promise.all([read(beforeSource), read(afterSource)]);
  const summarize = data => {
    const inspection = data.scout.inspection;
    assert.ok(Math.abs(inspection.second - 180) < 1e-6);
    const audit = inspection.opportunityAudit;
    assert.equal(Object.values(audit.firstGates).reduce((sum, count) => sum + count, 0), audit.total);
    return { seconds: inspection.second, ticks: audit.total,
      eligible: audit.firstGates.eligible ?? 0,
      withLegalPair: audit.total - (audit.allGates['legal-pair'] ?? 0),
      safeExceptGap: audit.firstGates['utility-gap'] ?? 0,
      firstGates: audit.firstGates, pushPlans: inspection.executionAudit.pushPlans };
  };
  const corrected = summarize(after);
  assert.ok(corrected.pushPlans.total > 0);
  assert.equal(corrected.pushPlans.mismatches, 0, 'Scored push plan differs from executor');
  runs.push({ seed, side, beforeSource, afterSource, before: summarize(before), after: corrected });
}
const pairs = [];
for (const source of ['ml-scoring-after-81-original.json', 'ml-scoring-after-82-swapped.json']) {
  const data = await read(source);
  assert.equal(data.validPair, true, `Invalid duplicate controls: ${source}`);
  assert.equal(data.behavior.incumbent.assignmentReachedExecutor, true);
  assert.equal(data.behavior.alternate.assignmentReachedExecutor, true);
  pairs.push({ source, seed: data.seed, swapped: data.swapped,
    actorId: data.scout.event.actorId, cardId: data.scout.event.cardId, second: data.scout.event.second,
    validPair: data.validPair, experiment: data.replays[0].record.experiment,
    firstBehaviorDifference: data.behavior.firstBehaviorDifference,
    maxPositionDifferenceFirstCommitment: data.behavior.maxPositionDifferenceFirstCommitment,
    descriptiveThreeSecondProgressDelta: data.descriptiveAlternateMinusIncumbent,
    outcome: assessPairedOutcome(data.replays[0], data.replays[2]) });
}
const output = { method: 'Diagnostic baseline, natural fixed-step before/after coverage and separate exact-state paired rollouts. Before/after trajectories are not paired causal outcomes.',
  instrumentationPreservedState, examples, runs, pairs,
  limits: 'One draft, two early-match windows and two selected contexts. Tick counts are correlated. No learned-policy benefit established or offline policy promoted.',
  policyPromoted: false };
await writeFile(resolve('../docs/ml-push-scoring-analysis.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ instrumentationPreservedState,
  coverage: runs.map(run => ({ seed: run.seed, before: run.before.eligible, after: run.after.eligible,
    ticks: run.after.ticks, pushPlans: run.after.pushPlans })), pairs }, null, 2));
