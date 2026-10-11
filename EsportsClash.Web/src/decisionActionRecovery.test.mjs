import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginOrContinueAction,
  chooseCommittedActionTarget,
  decisiveActionKey,
  inspectActionProgress,
  isActionRetryBlocked,
  isRepeatedlySwitching,
  recordActionFailure,
} from './decisionActionRecovery.ts';

const candidate = (id, x = 100, contextKey = 'stable') => ({ id, x, y: 0, contextKey });
const begin = (intent, id, now, contextKey = 'stable', mode = 'move') => beginOrContinueAction({
  intent, kind: 'champion', target: candidate(id), contextKey, mode, now,
  actor: { x: 0, y: 0 },
});

test('a viable concrete target is retained for the commitment window', () => {
  const first = begin(undefined, 'a', 10);
  const picked = chooseCommittedActionTarget({
    intent: first, kind: 'champion', preferred: candidate('b'),
    candidates: [candidate('b'), candidate('a')], now: 10.4,
  });
  assert.equal(picked?.id, 'a');
  assert.equal(chooseCommittedActionTarget({
    intent: first, kind: 'champion', preferred: candidate('b'),
    candidates: [candidate('b'), candidate('a')], now: 10.8,
  })?.id, 'b');
});

test('unsafe, unavailable, or unreachable candidates cannot be retained', () => {
  const first = begin(undefined, 'a', 10);
  for (const invalid of [{ safe: false }, { available: false }, { reachable: false }]) {
    assert.equal(chooseCommittedActionTarget({
      intent: first, kind: 'champion', preferred: candidate('a'),
      candidates: [{ ...candidate('a'), ...invalid }, candidate('b')], now: 10.2,
    })?.id, 'b');
  }
});

test('failures block only the failed action and release on timeout or meaningful context change', () => {
  const intent = begin(undefined, 'a', 10, 'wave:0|skill:0');
  const failures = recordActionFailure([], intent, 'unreachable', 10);
  assert.equal(isActionRetryBlocked(failures, intent.key, 11, 'wave:0|skill:0'), true);
  assert.equal(isActionRetryBlocked(failures, intent.key, 11, 'wave:2|skill:0'), false,
    'a cleared route or arriving wave releases the block');
  assert.equal(isActionRetryBlocked(failures, decisiveActionKey('champion', 'b'), 11, 'wave:0|skill:0'), false);
  assert.equal(isActionRetryBlocked(failures, intent.key, 12.5, 'wave:0|skill:0'), false);
  assert.equal(failures[0].reason, 'unreachable', 'the failure reason remains inspectable after retry opens');
});

test('movement progress refreshes the watchdog; a stalled move records non-progressing', () => {
  let intent = begin(undefined, 'a', 0);
  intent = { ...intent, lastX: 0, lastY: 0, bestDistance: 100 };
  let result = inspectActionProgress({ intent, failures: [], actor: { x: 5, y: 0 },
    target: { x: 100, y: 0 }, now: 0.4, emergencyInterrupt: false,
    available: true, safe: true, reachable: true });
  assert.equal(result.failedReason, undefined);
  assert.equal(result.intent?.lastProgressAt, 0.4);
  result = inspectActionProgress({ intent: result.intent, failures: result.failures,
    actor: { x: 5, y: 0 }, target: { x: 100, y: 0 }, now: 1.31,
    emergencyInterrupt: false, available: true, safe: true, reachable: true });
  assert.equal(result.failedReason, 'non-progressing');
  assert.equal(result.failures[0].reason, 'non-progressing');
});

test('target loss is unavailable while an emergency clears intent without adding a retry block', () => {
  const intent = begin(undefined, 'a', 0);
  const lost = inspectActionProgress({ intent, actor: { x: 0, y: 0 }, now: 0.1,
    emergencyInterrupt: false, available: false, safe: true, reachable: true });
  assert.equal(lost.failedReason, 'unavailable');
  const emergency = inspectActionProgress({ intent, actor: { x: 0, y: 0 }, now: 0.1,
    emergencyInterrupt: true, available: true, safe: true, reachable: true,
    target: { x: 100, y: 0 } });
  assert.equal(emergency.intent, undefined);
  assert.deepEqual(emergency.failures, []);
});

test('unsafe and unreachable selected actions retain distinct failure reasons', () => {
  const intent = begin(undefined, 'a', 0);
  const unsafe = inspectActionProgress({ intent, actor: { x: 0, y: 0 }, now: 0.1,
    emergencyInterrupt: false, available: true, safe: false, reachable: true,
    target: { x: 100, y: 0 } });
  assert.equal(unsafe.failedReason, 'unsafe');
  const unreachable = inspectActionProgress({ intent, actor: { x: 0, y: 0 }, now: 0.1,
    emergencyInterrupt: false, available: true, safe: true, reachable: false,
    target: { x: 100, y: 0 } });
  assert.equal(unreachable.failedReason, 'unreachable');
});

test('candidate evaluation stays bounded and preserves deterministic caller order', () => {
  const candidates = Array.from({ length: 20 }, (_, index) => candidate(String(index)));
  assert.equal(chooseCommittedActionTarget({ kind: 'champion', preferred: candidates[15],
    candidates, now: 0 })?.id, '0');
});

test('rapid action switching is detected and lengthens the next commitment', () => {
  let intent = begin(undefined, 'a', 0);
  intent = begin(intent, 'b', 0.3);
  intent = begin(intent, 'c', 0.6);
  intent = begin(intent, 'd', 0.9);
  assert.equal(isRepeatedlySwitching(intent), true);
  assert.ok(intent.committedUntil >= 2.05);
});
