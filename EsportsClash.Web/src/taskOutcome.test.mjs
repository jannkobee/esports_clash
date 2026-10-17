import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTaskOutcome } from './taskOutcome.ts';
import { parsePairedMacroTarget } from './pairedMacroReplay.ts';

test('task rewards count actual camp/wave income and capped structure credit, never passive gold', () => {
  const start = { second: 120, deaths: 1 };
  const end = { second: 150, deaths: 1, gold: 9999 };
  assert.equal(summarizeTaskOutcome(start, end, []).reward, 0);
  const outcome = summarizeTaskOutcome(start, end, [
    { second: 125, kind: 'camp-share', targetId: 'camp', amount: 80 },
    { second: 127, kind: 'minion-last-hit', targetId: 'creep', amount: 20 },
    { second: 148, kind: 'structure-damage', targetId: 'tower', amount: 300 },
    { second: 151, kind: 'camp-share', targetId: 'late', amount: 5000 },
    { second: 130, kind: 'camp-share', targetId: 'bad', amount: NaN },
  ]);
  assert.equal(outcome.firstCompletionSeconds, 5);
  assert.equal(outcome.campClears, 1);
  assert.equal(outcome.minionKills, 1);
  assert.equal(outcome.campGold + outcome.waveGold, 100);
  assert.equal(outcome.structureDamage, 300);
  assert.equal(outcome.reward, .44);
  assert.equal(summarizeTaskOutcome(start, { ...end, deaths: 2 }, [
    { second: 125, kind: 'camp-share', targetId: 'camp', amount: 5000 },
  ]).reward, -1, 'a death followed by respawn must dominate farm income');
  assert.equal(summarizeTaskOutcome(start, { second: 121, deaths: 1 }, []), undefined);
});

test('paired task evaluation permits a bounded thirty-second window only', () => {
  const target = { actorId: 'blue_p_a', second: 120, incumbent: 'farm', alternate: 'push',
    fingerprint: '10:abc:def', arm: 'alternate', horizonSeconds: 30 };
  assert.ok(parsePairedMacroTarget(JSON.stringify(target)));
  assert.equal(parsePairedMacroTarget(JSON.stringify({ ...target, horizonSeconds: 31 })), undefined);
});
