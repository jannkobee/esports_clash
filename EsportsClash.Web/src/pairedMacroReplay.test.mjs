import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchRandom } from './matchReplay.ts';
import { pairedMacroTargetMatches, pairedStateFingerprint, parsePairedMacroTarget } from './pairedMacroReplay.ts';

test('game RNG state can be restored for a replay without changing its sequence', () => {
  const random = createMatchRandom(77);
  random();
  const checkpoint = random.getState();
  const expected = [random(), random()];
  random.setState(checkpoint);
  assert.deepEqual([random(), random()], expected);
});

test('paired replay accepts only an exact legal pair at the same actor, time, and state', () => {
  const fingerprint = pairedStateFingerprint({ actors: [{ id: 'red_p_a', hp: 10 }],
    memory: new Map([['a', 1]]), visible: new Set(['a']) });
  const same = pairedStateFingerprint({ actors: [{ id: 'red_p_a', hp: 10 }],
    memory: new Map([['a', 1]]), visible: new Set(['a']) });
  assert.equal(fingerprint, same);
  assert.notEqual(fingerprint, pairedStateFingerprint({ actors: [{ id: 'red_p_a', hp: 9 }],
    memory: new Map([['a', 1]]), visible: new Set(['a']) }));
  const target = parsePairedMacroTarget(JSON.stringify({ actorId: 'red_p_a', second: 142.2,
    incumbent: 'regroup', alternate: 'fight', fingerprint, arm: 'alternate' }));
  const assignment = { incumbent: 'regroup', alternate: 'fight', arm: 'alternate',
    selected: 'fight', pair: 'fight-regroup', propensity: .5, utilityGap: .02 };
  assert.ok(pairedMacroTargetMatches(target, 'red_p_a', 142.2, assignment, same));
  assert.equal(pairedMacroTargetMatches(target, 'red_p_a', 142.2, assignment, 'different'), false);
  assert.equal(pairedMacroTargetMatches(target, 'red_p_b', 142.2, assignment, same), false);
  assert.equal(parsePairedMacroTarget(JSON.stringify({ ...target, alternate: 'finish' })), undefined);
});
