import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePairedBehavior } from './paired-behavior.mjs';

test('assignment labels do not count as execution when the actor falls through to lane advance', () => {
  const row = { second: 10, x: 0, y: 0, intent: 'push',
    decision: { second: 10, selected: 'regroup', reason: 'assigned:alternate' } };
  const result = summarizePairedBehavior([row], [row], 10);
  assert.equal(result.alternate.assignmentReachedExecutor, false);
  assert.equal(result.alternate.fallbackTicks, 1);
  const moved = { ...row, x: 2, intent: 'regroup' };
  const changed = summarizePairedBehavior([row], [moved], 10);
  assert.equal(changed.alternate.assignmentReachedExecutor, true);
  assert.equal(changed.maxPositionDifferenceFirstCommitment, 2);
});

test('a stale residual choice interrupted by another branch is not treated as a new execution', () => {
  const row = { second: 11, x: 0, y: 0, intent: 'regroup',
    decision: { second: 10, selected: 'regroup', reason: 'assigned:alternate' } };
  assert.equal(summarizePairedBehavior([row], [row], 10).alternate.residualDecisionTicks, 0);
});
